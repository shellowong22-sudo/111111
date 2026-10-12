import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import {
  financeWorldDataset,
  spiderAiProcessed,
  spiderDataBlood,
  spiderRawData,
} from "../drizzle/schema";
import { getDb } from "./db";
import { isFederalReservePressReleaseUrl } from "./agentReachOfficialNews";

/**
 * Agent Reach is an input adapter, not a second public content surface.
 * The existing spider_* and finance_world_dataset tables are the company's
 * canonical raw -> clean -> structured pipeline. Keeping this data in the
 * existing store avoids a parallel database and lets the Ucheer server use
 * the same lineage and dedupe rules as the other ingestion jobs.
 */
export type AgentReachReadDocument = {
  title?: string | null;
  url: string;
  published?: string | null;
  summary?: string | null;
  content?: string | null;
  fields?: Record<string, unknown>;
};

export type AgentReachReadResult = {
  mode: "web" | "rss";
  source: string;
  url: string;
  title?: string | null;
  content?: string | null;
  items?: AgentReachReadDocument[];
  observedAt: string;
  internal?: boolean;
  sourceReference?: string | null;
  tags?: string[];
};

export type AgentReachIngestionReceipt = {
  status: "stored" | "partial" | "unavailable" | "empty";
  attempted: number;
  stored: number;
  deduplicated: number;
  rejected: number;
  qualityAverage: number | null;
  dataBloodIds: string[];
  error?: string;
};

export type CompanyKnowledgeInput = {
  title: string;
  content: string;
  sourceName?: string;
  sourceReference?: string;
  tags?: string[];
};

function normalizedText(value: unknown, max = 60_000) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#(?:x[0-9a-f]+|[0-9]+));/gi, (entity) => {
      const name = entity.slice(1, -1).toLowerCase();
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      if (name in named) return named[name];
      const code = name.startsWith("#x") ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : " ";
    })
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizedParagraphs(value: unknown, max = 60_000) {
  return String(value ?? "").split(/\n\s*\n/).map(paragraph => normalizedText(paragraph, max))
    .filter(Boolean).join("\n\n").slice(0, max);
}

function hashText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function qualityFor(document: AgentReachReadDocument, cleanBody: string) {
  let score = 0;
  const checks: Record<string, unknown> = {
    hasTitle: Boolean(normalizedText(document.title, 700)),
    hasSourceUrl: /^https?:\/\//i.test(document.url),
    hasBody: cleanBody.length > 80,
    bodyLength: cleanBody.length,
    sourceUrl: document.url,
  };
  if (checks.hasTitle) score += 25;
  if (checks.hasSourceUrl) score += 25;
  if (checks.hasBody) score += 40;
  if (cleanBody.length > 500) score += 10;
  // Reader markdown from a portal homepage may be long without containing
  // an article. Keep its raw trace, but do not give navigation a top rating.
  let isHomepage = false;
  try {
    const sourceUrl = new URL(document.url);
    isHomepage = sourceUrl.pathname === "/" || sourceUrl.pathname === "";
  } catch { /* Invalid URLs are rejected by the source check above. */ }
  const markdownLinks = (String(document.content ?? "").match(/\]\(https?:\/\/[^)]+\)/g) ?? []).length;
  const navigationalPage = isHomepage && markdownLinks >= 12;
  checks.navigationalPage = navigationalPage;
  if (navigationalPage) score = Math.min(score, 65);
  const level = score >= 90 ? "L1" : score >= 70 ? "L2" : score >= 45 ? "L3" : "L4";
  return { score, level, checks };
}

function documentsFromRead(result: AgentReachReadResult): AgentReachReadDocument[] {
  if (result.mode === "rss") {
    return (result.items ?? []).map((item) => ({
      ...item,
      url: item.url || result.url,
      content: item.content || item.summary || "",
    }));
  }
  return [{
    title: result.title,
    url: result.url,
    content: result.content ?? "",
  }];
}

function safeSourceName(value: string) {
  return normalizedText(value, 255) || "Agent Reach";
}

/**
 * Persist a successful public Agent Reach read.
 *
 * This function is deliberately idempotent at the raw content level. The
 * database remains the source of truth: no in-memory fallback is reported as
 * a successful company-database write.
 */
export async function ingestAgentReachRead(result: AgentReachReadResult): Promise<AgentReachIngestionReceipt> {
  const documents = documentsFromRead(result);
  if (!documents.length) return { status: "empty", attempted: 0, stored: 0, deduplicated: 0, rejected: 0, qualityAverage: null, dataBloodIds: [] };
  const db = await getDb();
  if (!db) {
    return {
      status: "unavailable",
      attempted: documents.length,
      stored: 0,
      deduplicated: 0,
      rejected: 0,
      qualityAverage: null,
      dataBloodIds: [],
      error: "DATABASE_UNAVAILABLE",
    };
  }

  let stored = 0;
  let deduplicated = 0;
  let rejected = 0;
  let qualityTotal = 0;
  let qualityCount = 0;
  const dataBloodIds: string[] = [];
  const sourceName = safeSourceName(result.mode === "rss" && result.source === "RSS/Atom"
    ? `RSS · ${new URL(result.url).hostname}` : result.source);
  const subtype = result.internal ? "company" : sourceName.includes("雪球") ? "xueqiu" : sourceName.includes("小红书") ? "xiaohongshu" : result.mode;

  for (const document of documents.slice(0, 50)) {
    const title = normalizedText(document.title, 700);
    const body = document.fields?.verifiedOfficialFullText === true &&
      isFederalReservePressReleaseUrl(document.url)
      ? normalizedParagraphs(document.content, 60_000)
      : normalizedText(document.content || document.summary, 60_000);
    const url = String(document.url || result.url || "").trim().slice(0, 1_200);
    // The dedupe fingerprint is content-based, not URL-based. The same
    // article syndicated through multiple public feeds must not become
    // several company records merely because its source URL differs.
    const canonical = [title, body].filter(Boolean).join("\n");
    if (!url || !body) {
      rejected += 1;
      continue;
    }
    const contentHash = hashText(canonical);
    const quality = qualityFor(document, body);
    qualityTotal += quality.score;
    qualityCount += 1;
    // A search-index hit is not yet a useful company research document.
    // Do not publish/store a mere short title as an extracted social post.
    if (quality.score < (subtype === "xueqiu" || subtype === "xiaohongshu" ? 70 : 45)) {
      rejected += 1;
      continue;
    }

    const existing = await db
      .select({ rawUuid: spiderRawData.rawUuid })
      .from(spiderRawData)
      .where(eq(spiderRawData.contentHash, contentHash))
      .limit(1);
    if (existing.length) {
      deduplicated += 1;
      continue;
    }

    const rawUuid = `ar_${randomUUID().replace(/-/g, "")}`.slice(0, 64);
    const processUuid = `arp_${randomUUID().replace(/-/g, "")}`.slice(0, 64);
    const datasetUuid = `ard_${randomUUID().replace(/-/g, "")}`.slice(0, 64);
    const dataBloodId = `arb_${randomUUID().replace(/-/g, "")}`.slice(0, 64);
    const observedAt = new Date(result.observedAt);
    const crawlTime = Number.isNaN(observedAt.getTime()) ? new Date() : observedAt;

    try {
      await db.transaction(async (tx) => {
        await tx.insert(spiderRawData).values({
          rawUuid,
          taskUuid: `agent-reach:${result.mode}`,
          sourceUrl: url,
          carrierType: `agent_reach_${result.mode}`,
          contentType: result.mode === "rss" ? "application/rss+xml" : "text/plain",
          rawContent: canonical,
          responseHeaders: {
            "x-agent-reach-source": sourceName,
            "x-agent-reach-title": title,
            "x-company-internal": result.internal ? "1" : "0",
            "x-company-source-reference": String(result.sourceReference ?? "").trim().slice(0, 1_000),
          },
          sourceLanguage: "auto",
          contentHash,
          httpStatus: 200,
          crawlTime,
          parseStatus: "parsed",
          archiveSnapshot: canonical.slice(0, 20_000),
        });
        await tx.insert(spiderAiProcessed).values({
          processUuid,
          rawUuid,
          parserType: "agent_reach_normalizer",
          aiModel: null,
          extractedEntities: [],
          normalizedContent: body,
          rewrittenContent: title ? `${title}\n${body}` : body,
          formulaStruct: { source: sourceName, mode: result.mode },
          qualityLevel: quality.level,
          qualityChecks: quality.checks,
          processStatus: "completed",
          errorDetail: null,
        });
        await tx.insert(financeWorldDataset).values({
          uuid: datasetUuid,
          dataTopType: "agent_reach",
          dataSubType: subtype,
          sourceUrl: url,
          sourceName,
          sourceLanguage: "auto",
          rawBinary: null,
          rawContent: canonical,
          aiProcessContent: body,
          region: null,
          country: null,
          exchange: null,
          isinCode: null,
          sedolCode: null,
          assetCode: null,
          assetType: "knowledge",
          listStatus: "active",
          listDate: null,
          delistDate: null,
          timeSeriesJson: null,
          financeArrayJson: {
            title, published: document.published ?? null,
            summary: result.mode === "rss" ? normalizedText(document.summary, 1_200) || null : null,
            sourceReference: String(result.sourceReference ?? "").trim().slice(0, 1_000) || null,
            // Only actual public RSS feeds can be followed after a separate
            // per-module, manual administrator grant.
            rssFeedUrl: result.mode === "rss" && result.source === "RSS/Atom" &&
              !result.internal && /^https?:\/\//i.test(result.url)
              ? result.url : null,
            fields: document.fields ?? null,
          },
          moneyFlowJson: null,
          entityRelationIds: [],
          tagList: ["agent-reach", subtype, ...(result.tags ?? []).slice(0, 18)],
          candidatePushModuleIds: ["ucheer-ai-internal"],
          isPush: false,
          pushRecordId: null,
          dataQualityLevel: quality.level,
          dataBloodId,
          crawlTime,
          archiveSnapshot: canonical.slice(0, 20_000),
        });
        await tx.insert(spiderDataBlood).values({
          dataBloodId,
          structuredDataUuid: datasetUuid,
          collectionName: "agent_reach_company_knowledge",
          rawUuids: [rawUuid],
          processUuids: [processUuid],
          sourceUrls: [url],
          transformationSteps: [
            { step: "raw_capture", parser: "agent_reach" },
            { step: "normalize", rule: "strip_html_collapse_whitespace" },
            { step: "quality_check", score: quality.score, level: quality.level },
            { step: "dedupe", key: contentHash },
          ],
        });
      });
      stored += 1;
      dataBloodIds.push(dataBloodId);
    } catch (error) {
      // A concurrent writer may have won the content-hash race. Re-check
      // before reporting a hard failure so retries remain idempotent.
      const raced = await db
        .select({ rawUuid: spiderRawData.rawUuid })
        .from(spiderRawData)
        .where(eq(spiderRawData.contentHash, contentHash))
        .limit(1);
      if (raced.length) deduplicated += 1;
      else throw error;
    }
  }

  const status = stored > 0 && rejected === 0 ? "stored" : stored > 0 ? "partial" : deduplicated > 0 ? "stored" : "empty";
  return {
    status,
    attempted: documents.length,
    stored,
    deduplicated,
    rejected,
    qualityAverage: qualityCount ? Math.round(qualityTotal / qualityCount) : null,
    dataBloodIds,
  };
}

/** 管理员手工输入公司资料时使用同一条清洗、去重、血缘链路。 */
export async function ingestCompanyKnowledge(input: CompanyKnowledgeInput) {
  const reference = String(input.sourceReference ?? "").trim().slice(0, 1_000);
  const sourceUrl = `https://company.internal/knowledge/${randomUUID()}`;
  const receipt = await ingestAgentReachRead({
    mode: "web",
    source: normalizedText(input.sourceName, 255) || "公司内部输入",
    url: sourceUrl,
    title: input.title,
    content: input.content,
    observedAt: new Date().toISOString(),
    internal: true,
    sourceReference: reference || null,
    tags: input.tags,
  });
  return { ...receipt, internal: true, sourceReferenceStored: Boolean(reference), tags: (input.tags ?? []).slice(0, 20) };
}

export type AgentReachKnowledgeHit = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  content: string;
  qualityLevel: string;
  capturedAt: Date;
  internal: boolean;
  approved: boolean;
};

/**
 * Server-only retrieval for Ucheer. It intentionally returns cleaned text,
 * never raw payloads, credentials, task IDs or internal database identifiers.
 */
export async function searchAgentReachKnowledge(query: string, limit = 6, includeUnapproved = false): Promise<AgentReachKnowledgeHit[]> {
  const db = await getDb();
  const cleanQuery = normalizedText(query, 240);
  if (!db) {
    if (includeUnapproved) throw new Error("DATABASE_UNAVAILABLE");
    return [];
  }
  if (!cleanQuery) return [];
  // User questions are sentences, not exact excerpts from a document. Segment
  // Chinese and English into searchable terms so the approved corpus can
  // actually be retrieved from a natural-language question.
  const segments = [...new Intl.Segmenter("zh", { granularity: "word" }).segment(cleanQuery)]
    .filter((item) => item.isWordLike)
    .map((item) => item.segment.trim().toLowerCase());
  const stop = new Set(["请", "帮", "我", "我们", "你", "的", "了", "根据", "总结", "解释", "一下", "是什么", "如何", "可以", "资料", "文档", "公司", "内部", "当前", "关于", "and", "the", "what", "please"]);
  const terms = [...new Set(segments.filter((term) => term.length >= 2 && !stop.has(term)))].slice(0, 8);
  if (!terms.length) return [];
  try {
    const rows = await db
      .select({
        id: financeWorldDataset.uuid,
        content: financeWorldDataset.aiProcessContent,
        qualityLevel: financeWorldDataset.dataQualityLevel,
        capturedAt: financeWorldDataset.crawlTime,
        sourceUrl: financeWorldDataset.sourceUrl,
        sourceName: financeWorldDataset.sourceName,
        title: sql<string>`COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.title')), '')`,
        internal: sql<number>`CASE WHEN ${financeWorldDataset.sourceUrl} LIKE 'https://company.internal/%' THEN 1 ELSE 0 END`,
        approved: financeWorldDataset.isPush,
        metadata: financeWorldDataset.financeArrayJson,
      })
      .from(financeWorldDataset)
      .where(and(
        eq(financeWorldDataset.dataTopType, "agent_reach"),
        or(...terms.map((term) => {
          const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
          return or(
            like(financeWorldDataset.aiProcessContent, pattern),
            like(sql<string>`JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.title'))`, pattern),
          )!;
        }))!,
        ...(includeUnapproved ? [] : [eq(financeWorldDataset.isPush, true)]),
      ))
      .orderBy(desc(financeWorldDataset.crawlTime))
      .limit(Math.max(1, Math.min(limit, 12)));
    return rows.map((row) => ({
      id: row.id,
      title: row.title || "Agent Reach 资料",
      sourceUrl: row.sourceUrl,
      sourceName: row.sourceName,
      content: row.content ?? "",
      qualityLevel: row.qualityLevel,
      capturedAt: row.capturedAt,
      internal: row.internal === 1 || String(row.internal) === "1",
      approved: row.approved,
      rssFeedUrl: typeof row.metadata?.rssFeedUrl === "string" ? row.metadata.rssFeedUrl : null,
    }));
  } catch (error) {
    if (includeUnapproved) throw error;
    return [];
  }
}

/** Publish only an explicitly selected, already-cleaned record to Ucheer. */
export async function setAgentReachKnowledgeApproval(id: string, approved: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [existing] = await db.select({ id: financeWorldDataset.uuid })
    .from(financeWorldDataset)
    .where(and(eq(financeWorldDataset.uuid, id), eq(financeWorldDataset.dataTopType, "agent_reach")))
    .limit(1);
  if (!existing) throw new Error("KNOWLEDGE_NOT_FOUND");
  await db.update(financeWorldDataset).set({ isPush: approved })
    .where(and(eq(financeWorldDataset.uuid, id), eq(financeWorldDataset.dataTopType, "agent_reach")));
  return { id, approved };
}

export async function listRecentAgentReachKnowledge(limit = 30) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select({
    id: financeWorldDataset.uuid,
    title: sql<string>`COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.title')), '')`,
    sourceUrl: financeWorldDataset.sourceUrl,
    sourceName: financeWorldDataset.sourceName,
    content: financeWorldDataset.aiProcessContent,
    qualityLevel: financeWorldDataset.dataQualityLevel,
    capturedAt: financeWorldDataset.crawlTime,
    approved: financeWorldDataset.isPush,
    metadata: financeWorldDataset.financeArrayJson,
  }).from(financeWorldDataset)
    .where(eq(financeWorldDataset.dataTopType, "agent_reach"))
    .orderBy(desc(financeWorldDataset.crawlTime))
    .limit(Math.max(1, Math.min(limit, 60)));
  return rows.map((row) => ({
    ...row,
    title: row.title || "Agent Reach 资料",
    content: (row.content ?? "").slice(0, 1_800),
    internal: row.sourceUrl.startsWith("https://company.internal/"),
    rssFeedUrl: typeof row.metadata?.rssFeedUrl === "string" ? row.metadata.rssFeedUrl : null,
  }));
}

export async function getAgentReachKnowledgeOverview() {
  const db = await getDb();
  if (!db) {
    return { databaseConfigured: false, rawCount: 0, cleanCount: 0, structuredCount: 0, lineageCount: 0, lastCapturedAt: null, lastQualityLevel: null };
  }
  try {
    const [raw, clean, structured, lineage, latest] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(spiderRawData).where(like(spiderRawData.carrierType, "agent_reach_%")),
      db.select({ count: sql<number>`COUNT(*)` }).from(spiderAiProcessed).where(eq(spiderAiProcessed.parserType, "agent_reach_normalizer")),
      db.select({ count: sql<number>`COUNT(*)` }).from(financeWorldDataset).where(eq(financeWorldDataset.dataTopType, "agent_reach")),
      db.select({ count: sql<number>`COUNT(*)` }).from(spiderDataBlood).where(eq(spiderDataBlood.collectionName, "agent_reach_company_knowledge")),
      db.select({ updatedAt: spiderAiProcessed.updatedAt, qualityLevel: spiderAiProcessed.qualityLevel })
        .from(spiderAiProcessed).where(eq(spiderAiProcessed.parserType, "agent_reach_normalizer"))
        .orderBy(desc(spiderAiProcessed.updatedAt)).limit(1),
    ]);
    return {
      databaseConfigured: true,
      rawCount: Number(raw[0]?.count ?? 0),
      cleanCount: Number(clean[0]?.count ?? 0),
      structuredCount: Number(structured[0]?.count ?? 0),
      lineageCount: Number(lineage[0]?.count ?? 0),
      lastCapturedAt: latest[0]?.updatedAt ?? null,
      lastQualityLevel: latest[0]?.qualityLevel ?? null,
    };
  } catch {
    return { databaseConfigured: false, rawCount: 0, cleanCount: 0, structuredCount: 0, lineageCount: 0, lastCapturedAt: null, lastQualityLevel: null };
  }
}
