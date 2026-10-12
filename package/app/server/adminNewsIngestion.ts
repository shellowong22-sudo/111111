import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  adminNewsIngestionArticles,
  adminNewsIngestionAuditEvents,
  adminNewsIngestionSources,
} from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { assertResolvablePublicUrl } from "./agentReachService";
import { load } from 'cheerio';
import {
  toPublicNewsAnalyticsSource,
  toPublicPublishedAdminNews,
} from "./adminNewsPublic";
import { judgePublicNewsWithTypeSafe, type TypeSafeNewsCandidate } from "./typesafeNewsJudgment";

export { toPublicPublishedAdminNews } from "./adminNewsPublic";

type FeedSource = typeof adminNewsIngestionSources.$inferSelect;
type FeedItem = {
  sourceItemKey: string;
  sourceHeadline: string;
  sourceExcerpt: string | null;
  sourceUrl: string;
  sourcePublishedAt: Date | null;
};

const MAX_ITEMS_PER_RUN = 50;
const RSS_FETCH_ATTEMPTS = 3;
const RSS_RETRY_DELAYS_MS = [250, 750];
const SYNC_PROCESSING_DEADLINE_MS = 100_000;
const USER_AGENT =
  "Finance Hub public news reader/1.0 (RSS metadata only)";
const VERIFIED_WEBSITE_FEEDS: Record<string, string> = {
  "https://finance.sina.com.cn/":
    "https://rss.sina.com.cn/roll/finance/hot_roll.xml",
};

function normalizeArticleExcerpt(value: string) {
  return value.replace(/<!doctype[^>]*>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim().slice(0, 1_200);
}

function isSimulatedNewsSource(source: Pick<FeedSource, "name" | "provider" | "feedUrl" | "sourceUrl">) {
  return /模拟|simulat(?:ed|ion)|simulation\.invalid/i.test(
    `${source.name} ${source.provider} ${source.feedUrl} ${source.sourceUrl}`,
  );
}

/** Stable identity used before insert so one article cannot be assigned twice. */
function articleIdentity(item: Pick<FeedItem, "sourceHeadline" | "sourceUrl">) {
  const normalize = (value: string) => value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
  // Headline is the cross-feed canonical key. A URL is included only when a
  // feed has no meaningful headline; this avoids translated/redirected URLs
  // creating a second copy of the same announcement.
  const headline = normalize(item.sourceHeadline);
  return headline || normalize(item.sourceUrl);
}

/**
 * Real feeds are factual observations and are published automatically. The
 * transition is persisted so a scheduler restart never sends the same row
 * through a manual-review queue again. Simulated feeds remain isolated.
 */
async function autoPublishRealNews(source: FeedSource, actorUserId?: number | null) {
  if (isSimulatedNewsSource(source)) return 0;
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const pending = await db
    .select({ id: adminNewsIngestionArticles.id, sourceId: adminNewsIngestionArticles.sourceId, sourcePublishedAt: adminNewsIngestionArticles.sourcePublishedAt })
    .from(adminNewsIngestionArticles)
    .where(and(
      eq(adminNewsIngestionArticles.sourceId, source.id),
      inArray(adminNewsIngestionArticles.status, ["queued", "draft", "approved"]),
    ));
  if (!pending.length) return 0;
  const publishedAt = new Date();
  await db.update(adminNewsIngestionArticles)
    .set({ status: "published", publishedAt, processingError: null })
    .where(and(
      eq(adminNewsIngestionArticles.sourceId, source.id),
      inArray(adminNewsIngestionArticles.status, ["queued", "draft", "approved"]),
    ));
  await Promise.all(pending.map(article => audit({
    sourceId: article.sourceId,
    articleId: article.id,
    actorUserId: actorUserId ?? null,
    action: "published",
    detail: "真实公开资讯已自动清洗、去重并发布到既有要闻面板。",
  })));
  return pending.length;
}

/** Persist a short public-page summary when an RSS item carried no excerpt. */
export async function enrichAdminNewsArticleExcerpt(articleId: number) {
  const db = await getDb();
  if (!db) return false;
  const article = (await db.select({ id: adminNewsIngestionArticles.id, sourceUrl: adminNewsIngestionArticles.sourceUrl, sourceExcerpt: adminNewsIngestionArticles.sourceExcerpt, aiSummary: adminNewsIngestionArticles.aiSummary }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.id, articleId)).limit(1))[0];
  const usable = (value: string | null) => Boolean(value && !/(?:来源未提供|已保存来源|暂无摘要)/i.test(value));
  if (!article || usable(article.sourceExcerpt)) return Boolean(article?.sourceExcerpt);
  try {
    const endpoint = validateAdminNewsRssEndpoint(article.sourceUrl);
    if (!endpoint.valid) return false;
    endpoint.url.pathname = endpoint.url.pathname.replace(/\/{2,}/g, '/');
    const response = await fetch(endpoint.url, { redirect: 'manual', headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return false;
    const html = await response.text();
    if (html.length > 3_000_000 || !/<html[\s>]/i.test(html)) return false;
    const $ = load(html);
    $('script,style,nav,header,footer').remove();
    const paragraphs = $('article p, main p, #main p, .section p').toArray().map(node => normalizeArticleExcerpt($(node).text())).filter(text => text.length >= 40 && !/cookie|javascript|subscribe/i.test(text)).slice(0, 3).join(' ');
    const excerpt = normalizeArticleExcerpt(paragraphs);
    if (excerpt.length < 20) return false;
    await db.update(adminNewsIngestionArticles).set({ sourceExcerpt: excerpt }).where(eq(adminNewsIngestionArticles.id, articleId));
    return true;
  } catch { return false; }
}

/**
 * queued 模式只保存可归属的 RSS 元数据，等待管理员在 AI 管理页明确选择模板后生成。
 * immediate 是既有的来源级自动草稿行为，仍受来源配置与审核链路约束。
 */
export function getAdminNewsAutoDraftLimit(
  processingMode: FeedSource["processingMode"]
) {
  return processingMode === "immediate" ? Math.min(10, MAX_ITEMS_PER_RUN) : 0;
}

export function validateAdminNewsRssEndpoint(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const blockedHostname =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "0.0.0.0" ||
      hostname === "::1";
    const ipv4 = hostname
      .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
      ?.slice(1)
      .map(Number);
    const privateIpv4 =
      !!ipv4 &&
      (ipv4.some(octet => octet > 255) ||
        ipv4[0] === 10 ||
        ipv4[0] === 127 ||
        ipv4[0] === 0 ||
        (ipv4[0] === 169 && ipv4[1] === 254) ||
        (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
        (ipv4[0] === 192 && ipv4[1] === 168));
    if (url.protocol !== "https:")
      return { valid: false as const, reason: "RSS_URL_REQUIRES_HTTPS" };
    if (url.username || url.password)
      return {
        valid: false as const,
        reason: "RSS_URL_CREDENTIALS_NOT_ALLOWED",
      };
    if (blockedHostname || privateIpv4 || hostname.includes(":"))
      return { valid: false as const, reason: "RSS_URL_MUST_USE_PUBLIC_HOST" };
    return { valid: true as const, url };
  } catch {
    return { valid: false as const, reason: "RSS_URL_INVALID" };
  }
}

async function fetchAdminNewsRss(url: URL) {
  let lastError: unknown;
  for (let attempt = 0; attempt < RSS_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: {
          Accept: "application/rss+xml,application/xml,text/xml,*/*",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response;
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;
      if (!retryable || attempt === RSS_FETCH_ATTEMPTS - 1)
        throw new Error(`SOURCE_HTTP_${response.status}`);
      lastError = new Error(`SOURCE_HTTP_${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === RSS_FETCH_ATTEMPTS - 1) throw error;
    }
    await new Promise(resolve =>
      setTimeout(
        resolve,
        RSS_RETRY_DELAYS_MS[attempt] ??
          RSS_RETRY_DELAYS_MS[RSS_RETRY_DELAYS_MS.length - 1]
      )
    );
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("SOURCE_UNAVAILABLE");
}

/** 仅从公开主页的标准 alternate 链接发现 RSS／Atom，不提取或保存网页正文。 */
export async function discoverAdminNewsFeedUrl(websiteUrl: string) {
  const endpoint = validateAdminNewsRssEndpoint(websiteUrl);
  if (!endpoint.valid) throw new Error(endpoint.reason);
  await assertResolvablePublicUrl(endpoint.url.toString());
  const normalizedWebsiteUrl = `${endpoint.url.origin}${endpoint.url.pathname.replace(/\/+$/, "") || "/"}`;
  const verifiedFeedUrl = VERIFIED_WEBSITE_FEEDS[normalizedWebsiteUrl];
  if (verifiedFeedUrl) {
    const verifiedEndpoint = validateAdminNewsRssEndpoint(verifiedFeedUrl);
    if (!verifiedEndpoint.valid) throw new Error(verifiedEndpoint.reason);
    await assertResolvablePublicUrl(verifiedEndpoint.url.toString());
    const verifiedResponse = await fetch(verifiedEndpoint.url, {
      redirect: "manual",
      headers: {
        Accept:
          "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!verifiedResponse.ok)
      throw new Error(`SOURCE_HTTP_${verifiedResponse.status}`);
    if (
      !/<(?:rss|rdf:RDF|feed)[\s>]/i.test(
        (await verifiedResponse.text()).slice(0, 4_096)
      )
    )
      throw new Error("SOURCE_RESPONSE_NOT_RSS");
    return verifiedEndpoint.url.toString();
  }
  const response = await fetch(endpoint.url, {
    redirect: "manual",
    headers: {
      Accept:
        "application/rss+xml,application/atom+xml,application/xml,text/xml,text/html,*/*",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  const body = await response.text();
  if (/<(?:rss|rdf:RDF|feed)[\s>]/i.test(body.slice(0, 4_096)))
    return endpoint.url.toString();
  const candidate = [...body.matchAll(/<link\b([^>]*)>/gi)].find(
    match =>
      /\brel\s*=\s*["']alternate["']/i.test(match[1]) &&
      /\btype\s*=\s*["'](?:application\/(?:rss|atom)\+xml|application\/xml|text\/xml)["']/i.test(
        match[1]
      )
  );
  const href = candidate?.[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href) throw new Error("SOURCE_PUBLIC_FEED_NOT_DISCOVERED");
  const discovered = validateAdminNewsRssEndpoint(
    new URL(href, endpoint.url).toString()
  );
  if (!discovered.valid) throw new Error(discovered.reason);
  await assertResolvablePublicUrl(discovered.url.toString());
  return discovered.url.toString();
}

function decodeXml(value: string | undefined) {
  return (value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlField(block: string, field: string) {
  const match = block.match(
    new RegExp(`<${field}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${field}>`, "i")
  );
  return decodeXml(match?.[1]);
}

function xmlLink(block: string) {
  const elementValue = xmlField(block, "link");
  if (elementValue) return elementValue;
  const links = [...block.matchAll(/<link\b([^>]*)\/?>(?:\s*<\/link>)?/gi)];
  const alternate =
    links.find(match => /\brel\s*=\s*["']alternate["']/i.test(match[1])) ??
    links[0];
  const href = alternate?.[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  return decodeXml(href);
}

export function parseAdminNewsRss(xml: string, source: FeedSource): FeedItem[] {
  const blocks = [
    ...xml.matchAll(
      /<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi
    ),
  ].map(match => match[1]);
  return blocks.flatMap((block, index) => {
    const headline = normalizeArticleExcerpt(xmlField(block, "title")).slice(0, 700);
    const sourceUrl = normalizeArticleExcerpt(xmlLink(block) || source.sourceUrl).slice(0, 1_200);
    const sourceItemKey =
      xmlField(block, "guid") ||
      xmlField(block, "id") ||
      sourceUrl ||
      `${source.id}-${index}`;
    const publishedRaw =
      xmlField(block, "pubDate") ||
      xmlField(block, "published") ||
      xmlField(block, "updated") ||
      xmlField(block, "dc:date");
    const parsedDate = publishedRaw ? new Date(publishedRaw) : null;
    if (!headline) return [];
    return [
      {
        sourceItemKey: sourceItemKey.slice(0, 512),
        sourceHeadline: headline,
        sourceExcerpt:
          (
            xmlField(block, "description") ||
            xmlField(block, "summary") ||
            null
          ) ? normalizeArticleExcerpt(xmlField(block, "description") || xmlField(block, "summary") || "").slice(0, 1_200) || null : null,
        sourceUrl,
        sourcePublishedAt:
          parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
      },
    ];
  });
}

async function audit(input: {
  sourceId?: number | null;
  articleId?: number | null;
  actorUserId?: number | null;
  action: (typeof adminNewsIngestionAuditEvents.$inferInsert)["action"];
  detail?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(adminNewsIngestionAuditEvents).values({
    sourceId: input.sourceId ?? null,
    articleId: input.articleId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    detail: input.detail?.slice(0, 1_200) ?? null,
  });
}

async function draftArticle(articleId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const article = (
    await db
      .select()
      .from(adminNewsIngestionArticles)
      .where(eq(adminNewsIngestionArticles.id, articleId))
      .limit(1)
  )[0];
  if (!article) throw new Error("NEWS_INGESTION_ARTICLE_NOT_FOUND");

  try {
    const result = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "你是财经新闻编辑助手。只能基于输入标题和有限摘要写一篇 90-220 字的中文通俗解读草稿，不得补充未给出的事实、数字、人物、判断或交易建议。必须保持中性、明确来源，避免逐句改写或复制来源表述。输出严格 JSON。",
        },
        {
          role: "user",
          content: `来源标题：${article.sourceHeadline}\n来源摘要：${article.sourceExcerpt ?? "来源未提供摘要，只能概括标题信息。"}\n来源链接：${article.sourceUrl}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "news_editorial_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              category: {
                type: "string",
                enum: ["宏观", "市场", "公司", "政策", "科技", "其他"],
              },
              sentiment: {
                type: "string",
                enum: ["positive", "neutral", "negative", "uncertain"],
              },
              tickers: {
                type: "array",
                items: { type: "string" },
                maxItems: 8,
              },
            },
            required: ["title", "summary", "category", "sentiment", "tickers"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    const parsed = JSON.parse(typeof content === "string" ? content : "{}") as {
      title: string;
      summary: string;
      category: string;
      sentiment: "positive" | "neutral" | "negative" | "uncertain";
      tickers: string[];
    };
    if (!parsed.title?.trim() || !parsed.summary?.trim())
      throw new Error("AI_DRAFT_EMPTY");
    await db
      .update(adminNewsIngestionArticles)
      .set({
        status: "draft",
        aiTitle: parsed.title.trim().slice(0, 255),
        aiSummary: parsed.summary.trim().slice(0, 2_000),
        category: parsed.category,
        sentiment: parsed.sentiment,
        tickers: parsed.tickers
          .map(ticker => ticker.trim().toUpperCase())
          .filter(Boolean)
          .slice(0, 8),
        aiModel: "gpt-5-mini",
        aiGeneratedAt: new Date(),
        processingError: null,
      })
      .where(eq(adminNewsIngestionArticles.id, articleId));
    await audit({
      sourceId: article.sourceId,
      articleId,
      action: "draft_generated",
      detail: "已生成待审核的 AI 通俗摘要草稿；尚未发布。",
    });
    return { articleId, status: "draft" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_DRAFT_FAILED";
    await db
      .update(adminNewsIngestionArticles)
      .set({ status: "failed", processingError: message.slice(0, 1_000) })
      .where(eq(adminNewsIngestionArticles.id, articleId));
    await audit({
      sourceId: article.sourceId,
      articleId,
      action: "draft_failed",
      detail: `AI 草稿失败：${message}`,
    });
    return { articleId, status: "failed" as const };
  }
}

export async function syncAdminNewsSource(
  sourceId: number,
  actorUserId?: number | null,
  maxItemsOverride?: number
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const source = (
    await db
      .select()
      .from(adminNewsIngestionSources)
      .where(eq(adminNewsIngestionSources.id, sourceId))
      .limit(1)
  )[0];
  if (!source) throw new Error("NEWS_INGESTION_SOURCE_NOT_FOUND");
  if (!source.isActive)
    return {
      sourceId,
      status: "skipped" as const,
      reason: "SOURCE_INACTIVE",
      queued: 0,
      processed: 0,
      drafted: 0,
      failed: 0,
      waiting: 0,
      mode: source.processingMode,
    };
  if (source.sourceType !== "rss")
    return {
      sourceId,
      status: "skipped" as const,
      reason: "SOURCE_TYPE_NOT_IMPLEMENTED",
      queued: 0,
      processed: 0,
      drafted: 0,
      failed: 0,
      waiting: 0,
      mode: source.processingMode,
    };
  // Publish durable rows from an earlier run before attempting the network.
  // This keeps a temporary upstream outage from hiding already stored facts.
  const prePublished = await autoPublishRealNews(source, actorUserId);
  const endpoint = validateAdminNewsRssEndpoint(source.feedUrl);
  if (!endpoint.valid) {
    await db
      .update(adminNewsIngestionSources)
      .set({
        lastFetchedAt: new Date(),
        lastStatus: "unavailable",
        lastError: endpoint.reason,
      })
      .where(eq(adminNewsIngestionSources.id, sourceId));
    await audit({
      sourceId,
      actorUserId,
      action: "sync_completed",
      detail: `同步未执行：${endpoint.reason}`,
    });
    return {
      sourceId,
      status: "unavailable" as const,
      queued: 0,
      processed: 0,
      drafted: 0,
      failed: 0,
      waiting: 0,
      mode: source.processingMode,
      reason: endpoint.reason,
    };
  }

  await audit({
    sourceId,
    actorUserId,
    action: "sync_started",
    detail: "开始读取已配置 RSS 的标题、链接、日期与有限摘要。",
  });
  try {
    const response = await fetchAdminNewsRss(endpoint.url);
    const xml = await response.text();
    if (!/<(?:rss|rdf:RDF|feed)[\s>]/i.test(xml.slice(0, 4_096)))
      throw new Error("SOURCE_RESPONSE_NOT_RSS");
    const effectiveMaxItems = Math.min(
      Math.max(maxItemsOverride ?? source.maxItemsPerRun, 1),
      MAX_ITEMS_PER_RUN
    );
    const items = parseAdminNewsRss(xml, source).slice(0, effectiveMaxItems);
    const queued: number[] = [];
    const duplicate: number[] = [];
    const recentArticles: TypeSafeNewsCandidate[] = await db
      .select({
        id: adminNewsIngestionArticles.id,
        headline: adminNewsIngestionArticles.sourceHeadline,
        excerpt: adminNewsIngestionArticles.sourceExcerpt,
      })
      .from(adminNewsIngestionArticles)
      .orderBy(desc(adminNewsIngestionArticles.id))
      .limit(40);
    for (const item of items) {
      const existing = (
        await db
          .select({ id: adminNewsIngestionArticles.id })
          .from(adminNewsIngestionArticles)
          .where(
            and(
              eq(adminNewsIngestionArticles.sourceId, sourceId),
              eq(adminNewsIngestionArticles.sourceItemKey, item.sourceItemKey)
            )
          )
          .limit(1)
      )[0];
      if (existing) continue;
      // A feed may expose the same announcement under a new GUID or a
      // translated endpoint. Keep one canonical record across every source.
      const candidates = await db
        .select({ id: adminNewsIngestionArticles.id, sourceUrl: adminNewsIngestionArticles.sourceUrl, sourceHeadline: adminNewsIngestionArticles.sourceHeadline })
        .from(adminNewsIngestionArticles)
        .where(or(
          eq(adminNewsIngestionArticles.sourceUrl, item.sourceUrl),
          eq(adminNewsIngestionArticles.sourceHeadline, item.sourceHeadline),
        ))
        .limit(20);
      if (candidates.some(candidate => articleIdentity(candidate) === articleIdentity(item))) {
        duplicate.push(1);
        continue;
      }
      const semantic = await judgePublicNewsWithTypeSafe({
        headline: item.sourceHeadline,
        excerpt: item.sourceExcerpt,
        candidates: recentArticles.slice(0, 5),
      });
      if (semantic.duplicateArticleId !== null) {
        duplicate.push(1);
        await audit({
          sourceId,
          actorUserId,
          action: "sync_completed",
          detail: `语义重复已拦截；保留既有文章 ${semantic.duplicateArticleId}，未创建第二份记录。`,
        });
        continue;
      }
      const created = await db
        .insert(adminNewsIngestionArticles)
        .values({ sourceId, ...item, category: semantic.category, status: "queued" });
      const articleId = Number(
        (created as any)[0]?.insertId ?? (created as any).insertId
      );
      if (!articleId) throw new Error("NEWS_INGESTION_ARTICLE_CREATE_FAILED");
      queued.push(articleId);
      recentArticles.unshift({ id: articleId, headline: item.sourceHeadline, excerpt: item.sourceExcerpt });
      if (recentArticles.length > 40) recentArticles.length = 40;
      if (queued.length <= 5 && !item.sourceExcerpt) await enrichAdminNewsArticleExcerpt(articleId);
      await audit({
        sourceId,
        articleId,
        actorUserId,
        action: "article_queued",
        detail: "已保存清洗后的公开资讯，等待自动投递。",
      });
    }
    await db
      .update(adminNewsIngestionSources)
      .set({
        lastFetchedAt: new Date(),
        lastStatus: "available",
        lastError: null,
      })
      .where(eq(adminNewsIngestionSources.id, sourceId));
    const autoPublished = prePublished + await autoPublishRealNews(source, actorUserId);
    const draftLimit = 0;
    const pendingRows =
      draftLimit > 0
        ? await db
            .select({ id: adminNewsIngestionArticles.id })
            .from(adminNewsIngestionArticles)
            .where(
              and(
                eq(adminNewsIngestionArticles.sourceId, sourceId),
                eq(adminNewsIngestionArticles.status, "queued")
              )
            )
            .orderBy(asc(adminNewsIngestionArticles.createdAt))
            .limit(draftLimit)
        : [];
    const drafts = [] as Array<{
      articleId: number;
      status: "draft" | "failed";
    }>;
    const processingStartedAt = Date.now();
    for (let index = 0; index < pendingRows.length; index += 4) {
      if (Date.now() - processingStartedAt >= SYNC_PROCESSING_DEADLINE_MS)
        break;
      drafts.push(
        ...(await Promise.all(
          pendingRows.slice(index, index + 4).map(row => draftArticle(row.id))
        ))
      );
    }
    const drafted = drafts.filter(item => item.status === "draft").length;
    const failed = drafts.length - drafted;
    const remaining = await db
      .select({ id: adminNewsIngestionArticles.id })
      .from(adminNewsIngestionArticles)
      .where(
        and(
          eq(adminNewsIngestionArticles.sourceId, sourceId),
          eq(adminNewsIngestionArticles.status, "queued")
        )
      );
    const reason = items.length === 0 ? "SOURCE_FEED_EMPTY" : null;
    await audit({
      sourceId,
      actorUserId,
      action: "sync_completed",
      detail: reason
        ? `同步完成：本次未提供可导入条目；自动公开 ${autoPublished} 条，重复 ${duplicate.length} 条。`
        : `同步完成：新增 ${queued.length} 条，自动公开 ${autoPublished} 条，重复 ${duplicate.length} 条。`,
    });
    return {
      sourceId,
      status: "available" as const,
      queued: queued.length,
      processed: drafts.length,
      drafted,
      failed,
      waiting: remaining.length,
      published: autoPublished,
      duplicates: duplicate.length,
      mode: source.processingMode,
      reason,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SOURCE_UNAVAILABLE";
    await db
      .update(adminNewsIngestionSources)
      .set({
        lastFetchedAt: new Date(),
        lastStatus: "unavailable",
        lastError: message.slice(0, 600),
      })
      .where(eq(adminNewsIngestionSources.id, sourceId));
    await audit({
      sourceId,
      actorUserId,
      action: "sync_completed",
      detail: `同步未完成：${message}`,
    });
    return {
      sourceId,
      status: "unavailable" as const,
      queued: 0,
      processed: 0,
      drafted: 0,
      failed: 0,
      waiting: 0,
      mode: source.processingMode,
      reason: message,
    };
  }
}

export async function processActiveAdminNewsSources() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const sources = await db
    .select({ id: adminNewsIngestionSources.id })
    .from(adminNewsIngestionSources)
    .where(eq(adminNewsIngestionSources.isActive, true));
  // Sources are independent; parallel execution keeps the durable sweep
  // inside the scheduler timeout even when one public endpoint is slow.
  return Promise.all(sources.map(source => syncAdminNewsSource(source.id, null)));
}

export async function listAdminNewsAnalytics() {
  const db = await getDb();
  if (!db)
    return {
      sources: [],
      categories: [],
      sentiments: [],
      totalPublished: 0,
      totalDrafts: 0,
    };
  const [sources, articles] = await Promise.all([
    db
      .select()
      .from(adminNewsIngestionSources)
      .orderBy(desc(adminNewsIngestionSources.updatedAt))
      .limit(30),
    db
      .select()
      .from(adminNewsIngestionArticles)
      .orderBy(desc(adminNewsIngestionArticles.updatedAt))
      .limit(500),
  ]);
  const published = articles.filter(article => article.status === "published");
  const drafts = articles.filter(
    article => article.status === "draft" || article.status === "approved"
  );
  const countBy = <T extends string>(values: Array<T | null | undefined>) =>
    [
      ...values
        .reduce((map, value) => {
          const key = value || "未分类";
          map.set(key, (map.get(key) ?? 0) + 1);
          return map;
        }, new Map<string, number>())
        .entries(),
    ]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  return {
    sources: sources.map(source => ({
      id: source.id,
      name: source.name,
      provider: source.provider,
      isActive: source.isActive,
      lastStatus: source.lastStatus,
      lastFetchedAt: source.lastFetchedAt,
      lastError: source.lastError,
    })),
    categories: countBy(published.map(article => article.category)),
    sentiments: countBy(published.map(article => article.sentiment)),
    totalPublished: published.length,
    totalDrafts: drafts.length,
  };
}

export async function listPublishedAdminNews(limit = 24) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      article: adminNewsIngestionArticles,
      sourceName: adminNewsIngestionSources.name,
      provider: adminNewsIngestionSources.provider,
    })
    .from(adminNewsIngestionArticles)
    .innerJoin(
      adminNewsIngestionSources,
      eq(adminNewsIngestionArticles.sourceId, adminNewsIngestionSources.id)
    )
    .where(and(eq(adminNewsIngestionArticles.status, "published"),
      sql`CONCAT(COALESCE(${adminNewsIngestionSources.name}, ''), ' ', COALESCE(${adminNewsIngestionSources.provider}, '')) NOT REGEXP '模拟|simulat(ed|ion)'`))
    .orderBy(desc(adminNewsIngestionArticles.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 60));
  // Simulation runs remain available to administrators for audit, but they
  // must never be presented as live terminal news. Only named production
  // entries are exposed through the public publication contract.
  return rows
    .filter(({ sourceName, provider }) => !/模拟|simulat(?:ed|ion)/i.test(`${sourceName} ${provider}`))
    .slice(0, Math.min(Math.max(limit, 1), 60))
    .map(({ article }) => toPublicPublishedAdminNews(article, "财经要闻", "市场信息服务"))
    .filter((article): article is NonNullable<ReturnType<typeof toPublicPublishedAdminNews>> => Boolean(article));
}

export { audit as auditAdminNewsIngestion };
