import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  adminDataModuleAutomationStepEvents,
  adminDataModuleContentItems,
  adminDataModuleDeliveryEvents,
  adminDataModuleDeliveryOperations,
  adminDataModuleDeliveryVersions,
  adminDataModuleProfiles,
  adminNewsIngestionArticles,
  adminNewsIngestionAuditEvents,
  adminNewsIngestionSources,
  announcementAcceptanceEvents,
  announcements,
  equityListings,
  marketData,
} from "../drizzle/schema";
import { ADMIN_DATA_MODULES } from "../shared/adminDataModules";
import { ADMIN_CRAWLER_STRATEGY_BY_MODULE } from "../shared/adminCrawlerStrategies";
import { getDb } from "./db";
import { withAdminDataModuleLease } from "./adminDataModuleQueue";
import { invokeLLM } from "./_core/llm";
import {
  ensureNewsLongformForModule,
  isTopLongformModule,
  toPlainNewsHeadline as formatNewsHeadline,
  TOP_NEWS_MIN_CHARACTERS,
} from "./newsLongform";

type ProfileRow = typeof adminDataModuleProfiles.$inferSelect;
type ContentRow = typeof adminDataModuleContentItems.$inferSelect;
type DeliveryOperationRow =
  typeof adminDataModuleDeliveryOperations.$inferSelect;
type DeliveryEventRow = typeof adminDataModuleDeliveryEvents.$inferSelect;
type StepEventRow = typeof adminDataModuleAutomationStepEvents.$inferSelect;
type MarketType =
  | "stock"
  | "bond"
  | "forex"
  | "commodity"
  | "index"
  | "derivative"
  | "option"
  | "fund";
type SourceKind = "real" | "simulated" | "mixed";

type MarketPayload = {
  symbol: string;
  name: string;
  market: MarketType;
  price: string;
  changeVal: string;
  changePct: string;
  volume: string;
  updatedAt: string;
};

type NewsPayload = {
  sourceId?: number;
  sourceItemKey: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  category: string;
  publishedAt: string;
};

type AnnouncementPayload = {
  title: string;
  content: string;
  type: "info" | "warning" | "urgent" | "maintenance";
  priority: number;
  expiresAt: string | null;
};

type ModuleFeedPayload = {
  moduleId: string;
  moduleName: string;
  targetPath: string;
  strategyKey: string;
  promptKey: string;
  viewType: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceObservedAt: string;
  symbol: string | null;
  securityName: string | null;
  country: string | null;
  exchange: string | null;
  evidenceTitle: string;
  insight: string;
  simulatedFields: string[];
  transformationVersion: string;
  contentLabel: string;
  contentDescription: string;
  targetLabel: string;
  rewriteStyle:
    | "source_faithful"
    | "plain_language"
    | "conversational"
    | "brief";
  rewriteEngine: string;
  originalSourceTitle: string;
  rewrittenSummary: string;
};

type ContentQualityReport = {
  score: number;
  passed: boolean;
  threshold: number;
  checks: Array<{ rule: string; passed: boolean; points: number }>;
  rejectionReasons: string[];
};

export const ADMIN_DATA_MODULE_QUALITY_THRESHOLD = 75;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// 内容去重不仅比较完整哈希，也拦截换标题、换标点后的近似重复稿。
// 使用字符 4-gram，兼容中文与英文，避免把不同主题的短标题误判为重复。
function similarityScore(left: string, right: string) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const shingles = (value: string) => {
    const text = normalize(value);
    const set = new Set<string>();
    for (let index = 0; index <= text.length - 4; index += 1)
      set.add(text.slice(index, index + 4));
    return set;
  };
  const a = shingles(left);
  const b = shingles(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function toPlainNewsHeadline(value: string) {
  return (
    value
      .replace(/^(?:AI|智能|自动)[·：:\s-]*/i, "")
      .replace(
        /(?:后台|管理端|人工定向推送|爬虫|crawler|模块\s*ID|映射)[^。；|]*/gi,
        ""
      )
      .replace(/[|｜]\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "货币市场最新动态"
  );
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function insertId(result: unknown) {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== "object") return 0;
  const value = Reflect.get(candidate, "insertId");
  return typeof value === "number" ? value : 0;
}

function affectedRows(result: unknown) {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== "object") return 0;
  const value = Reflect.get(candidate, "affectedRows");
  return typeof value === "number" ? value : 0;
}

function dailySequence(runKey: string, moduleId: string) {
  return Number.parseInt(digest({ runKey, moduleId }).slice(0, 8), 16);
}

function localCrawlerRewrite(
  text: string,
  style: ModuleFeedPayload["rewriteStyle"]
) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (style === "source_faithful") return clean;
  if (style === "brief") return clean.slice(0, 700);
  return clean.slice(0, 2000);
}

async function rewriteCrawlerCopy(input: {
  moduleId: string;
  sourceTitle: string;
  sourceSummary: string;
  moduleName: string;
  contentLabel: string;
  style: ModuleFeedPayload["rewriteStyle"];
  minimumCharacters?: number;
}) {
  if (input.style === "source_faithful" && !input.minimumCharacters)
    return { text: input.sourceSummary, engine: "source-faithful-v1" };
  if (process.env.LLM_API_KEY) {
    try {
      const styleInstruction =
        input.style === "plain_language"
          ? "使用大白话、短句，清楚易懂"
          : input.style === "conversational"
            ? "使用自然口语化表达"
            : "压缩为简短重点";
      const response = await invokeLLM({
        model: process.env.LLM_CRAWLER_MODEL || "gpt-5-mini",
        maxCompletionTokens: input.minimumCharacters ? 6000 : 500,
        messages: [
          {
            role: "system",
            content: `你是财经内容降重编辑。${styleInstruction}。只能改写输入标题和摘要，必须保留原有事实边界，不得补充具体数字、人物、事件、预测、评级或交易指令。可以补充通用的市场传导、核验问题、情景分支和持续观察框架。输出纯文本，不加生成过程或系统说明。${input.minimumCharacters ? `正文不少于 ${input.minimumCharacters} 个中文字符，分段完整，禁止出现“简单说”或“公开来源”。` : ""}`,
          },
          {
            role: "user",
            content: `目标模块：${input.moduleName}\n数据内容：${input.contentLabel}\n来源标题：${input.sourceTitle}\n来源摘要：${input.sourceSummary}`,
          },
        ],
      });
      const content = response.choices[0]?.message.content;
      const rewritten =
        typeof content === "string"
          ? content.trim()
          : Array.isArray(content)
            ? content
                .filter(
                  (part): part is { type: "text"; text: string } =>
                    part.type === "text" &&
                    typeof (part as { text?: unknown }).text === "string"
                )
                .map(part => part.text)
                .join("\n")
                .trim()
            : "";
      if (rewritten)
        return {
          text: input.minimumCharacters
            ? ensureNewsLongformForModule(
                input.moduleId,
                input.sourceTitle,
                rewritten,
                input.minimumCharacters
              )
            : rewritten.slice(0, 2000),
          engine: `llm:${process.env.LLM_CRAWLER_MODEL || "gpt-5-mini"}`,
        };
    } catch {
      // A configured model may be temporarily unavailable. Keep the crawler
      // usable and identify the local fallback in the stored result.
    }
  }
  const local = localCrawlerRewrite(input.sourceSummary, input.style);
  return {
    text: input.minimumCharacters
      ? ensureNewsLongformForModule(
          input.moduleId,
          input.sourceTitle,
          local,
          input.minimumCharacters
        )
      : local,
    engine: input.minimumCharacters
      ? "local-longform-editor-v2"
      : "local-ai-rewriter-v1",
  };
}

function numberText(value: number, decimalPlaces = 2) {
  return value.toFixed(decimalPlaces);
}

function simulatedMarketPayload(
  moduleId: string,
  moduleName: string,
  runKey: string
): MarketPayload {
  const sample = dailySequence(runKey, moduleId);
  const suffix = String(sample % 100000).padStart(5, "0");
  const price = 50 + (sample % 15_000) / 100;
  const change = ((sample % 801) - 400) / 100;
  const pct = (change / price) * 100;
  const symbols = ["stock", "index", "commodity", "forex"];
  return {
    symbol: `SIM-${moduleId
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 12)}-${suffix}`.slice(0, 32),
    name: `模拟观察 · ${moduleName} · ${suffix}`.slice(0, 128),
    market: symbols[sample % symbols.length] as MarketType,
    price: numberText(price),
    changeVal: numberText(change),
    changePct: numberText(pct),
    volume: String(100000 + (sample % 9_000_000)),
    updatedAt: new Date().toISOString(),
  };
}

function simulatedNewsPayload(
  moduleId: string,
  moduleName: string,
  runKey: string
): NewsPayload {
  const sample = dailySequence(runKey, moduleId);
  const suffix = String(sample % 100000).padStart(5, "0");
  const topics = [
    "市场结构观察",
    "跨资产流动性",
    "公开数据质量",
    "行业主题跟踪",
  ];
  const topic = topics[sample % topics.length];
  const publishedAt = new Date().toISOString();
  return {
    sourceItemKey: `simulated:${moduleId}:${runKey}`.slice(0, 512),
    title: `模拟内容 · ${moduleName} · ${topic} · ${suffix}`.slice(0, 255),
    summary: `这是按后台配置生成的模拟内容，用于验证既有新闻审核、发布、查询与回滚链路；它不代表事实、实时新闻或投资建议。主题编号：${suffix}。`,
    sourceUrl: `/news-hub?simulated=${encodeURIComponent(moduleId)}-${suffix}`,
    sourceName: "Finance Hub 模拟内容",
    category: "其他",
    publishedAt,
  };
}

function simulatedAnnouncementPayload(
  moduleId: string,
  moduleName: string,
  runKey: string
): AnnouncementPayload {
  const sample = dailySequence(runKey, moduleId);
  const suffix = String(sample % 100000).padStart(5, "0");
  const types: AnnouncementPayload["type"][] = [
    "info",
    "warning",
    "maintenance",
    "urgent",
  ];
  return {
    title: `模拟公告 · ${moduleName} · ${suffix}`.slice(0, 255),
    content: `这是由后台自动化生成并明确标记的模拟公告，用于验证既有公告草稿、审核、发布、查询和回滚链路；不代表事实、系统故障或实际业务通知。公告编号：${suffix}。`,
    type: types[sample % types.length]!,
    priority: 1 + (sample % 100),
    expiresAt: new Date(
      Date.now() + (24 + (sample % 24)) * 60 * 60 * 1000
    ).toISOString(),
  };
}

function asMarketPayload(value: unknown): MarketPayload {
  if (!value || typeof value !== "object")
    throw new Error("MARKET_PAYLOAD_INVALID");
  const record = value as Record<string, unknown>;
  const market = record.market;
  const allowed = new Set<MarketType>([
    "stock",
    "bond",
    "forex",
    "commodity",
    "index",
    "derivative",
    "option",
    "fund",
  ]);
  const requiredText = [
    "symbol",
    "name",
    "price",
    "changeVal",
    "changePct",
    "volume",
  ] as const;
  if (
    !allowed.has(market as MarketType) ||
    requiredText.some(
      field => typeof record[field] !== "string" || !record[field]
    )
  )
    throw new Error("MARKET_PAYLOAD_FIELD_INVALID");
  return {
    symbol: String(record.symbol),
    name: String(record.name),
    market: market as MarketType,
    price: String(record.price),
    changeVal: String(record.changeVal),
    changePct: String(record.changePct),
    volume: String(record.volume),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function asNewsPayload(value: unknown): NewsPayload {
  if (!value || typeof value !== "object")
    throw new Error("NEWS_PAYLOAD_INVALID");
  const record = value as Record<string, unknown>;
  const requiredText = [
    "sourceItemKey",
    "title",
    "summary",
    "sourceUrl",
    "sourceName",
    "category",
    "publishedAt",
  ] as const;
  if (
    requiredText.some(
      field => typeof record[field] !== "string" || !record[field]
    )
  )
    throw new Error("NEWS_PAYLOAD_FIELD_INVALID");
  return {
    sourceId: typeof record.sourceId === "number" ? record.sourceId : undefined,
    sourceItemKey: String(record.sourceItemKey),
    title: String(record.title),
    summary: String(record.summary),
    sourceUrl: String(record.sourceUrl),
    sourceName: String(record.sourceName),
    category: String(record.category),
    publishedAt: String(record.publishedAt),
  };
}

function asAnnouncementPayload(value: unknown): AnnouncementPayload {
  if (!value || typeof value !== "object")
    throw new Error("ANNOUNCEMENT_PAYLOAD_INVALID");
  const record = value as Record<string, unknown>;
  const types = new Set<AnnouncementPayload["type"]>([
    "info",
    "warning",
    "urgent",
    "maintenance",
  ]);
  if (
    typeof record.title !== "string" ||
    !record.title ||
    typeof record.content !== "string" ||
    !record.content ||
    !types.has(record.type as AnnouncementPayload["type"]) ||
    typeof record.priority !== "number" ||
    !Number.isInteger(record.priority) ||
    record.priority < 0 ||
    record.priority > 100 ||
    !(record.expiresAt === null || typeof record.expiresAt === "string")
  )
    throw new Error("ANNOUNCEMENT_PAYLOAD_FIELD_INVALID");
  return {
    title: record.title,
    content: record.content,
    type: record.type as AnnouncementPayload["type"],
    priority: record.priority,
    expiresAt: record.expiresAt === null ? null : (record.expiresAt as string),
  };
}

export function assessAdminDataModuleContentQuality(input: {
  title: string;
  body: string;
  topic: string;
  category: string;
  keywords: string[];
  tags: string[];
  sourceKind: SourceKind;
  payload:
    | MarketPayload
    | NewsPayload
    | AnnouncementPayload
    | ModuleFeedPayload;
}): ContentQualityReport {
  const payloadFields = Object.values(input.payload).filter(
    value =>
      value !== undefined && value !== null && String(value).trim().length > 0
  ).length;
  const checks = [
    {
      rule: "标题长度不少于 8 个字符",
      passed: input.title.trim().length >= 8,
      points: 20,
    },
    {
      rule: "正文长度不少于 40 个字符",
      passed: input.body.trim().length >= 40,
      points: 20,
    },
    {
      rule: "主题与分类均已提供",
      passed: input.topic.trim().length > 0 && input.category.trim().length > 0,
      points: 15,
    },
    {
      rule: "至少存在一个关键词和一个标签",
      passed: input.keywords.length > 0 && input.tags.length > 0,
      points: 30,
    },
    {
      rule: "前端目标载荷包含完整非空字段",
      passed: payloadFields >= 6,
      points: 10,
    },
    {
      rule:
        input.sourceKind === "simulated"
          ? "模拟内容有明确来源标识"
          : "真实内容保留来源链路",
      passed:
        input.sourceKind === "simulated"
          ? /模拟/.test(`${input.title} ${input.body}`)
          : true,
      points: 5,
    },
  ];
  const score = checks.reduce(
    (total, check) => total + (check.passed ? check.points : 0),
    0
  );
  const threshold = ADMIN_DATA_MODULE_QUALITY_THRESHOLD;
  return {
    score,
    passed: score >= threshold,
    threshold,
    checks,
    rejectionReasons: checks
      .filter(check => !check.passed)
      .map(check => check.rule),
  };
}

async function profileForModule(moduleId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profile = (
    await db
      .select()
      .from(adminDataModuleProfiles)
      .where(eq(adminDataModuleProfiles.moduleId, moduleId))
      .limit(1)
  )[0];
  if (!profile) throw new Error("ADMIN_DATA_MODULE_PROFILE_NOT_FOUND");
  return profile;
}

async function createContentRow(input: {
  moduleId: string;
  runId?: number;
  jobItemId?: number;
  sourceKind: SourceKind;
  type: (typeof adminDataModuleContentItems.$inferInsert)["contentType"];
  title: string;
  body: string;
  topic: string;
  category: string;
  keywords: string[];
  tags: string[];
  sortWeight: number;
  sourceReference: string;
  payload:
    | MarketPayload
    | NewsPayload
    | AnnouncementPayload
    | ModuleFeedPayload;
  dedupeScope: "module" | "global" | "pushed";
  dedupePayload?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const qualityReport = assessAdminDataModuleContentQuality(input);
  const contentHash = digest(
    input.dedupePayload ?? {
      title: input.title,
      body: input.body,
      topic: input.topic,
      assetUrl: null,
      payload: input.payload,
    }
  );
  const duplicateWhere =
    input.dedupeScope === "module"
      ? and(
          eq(adminDataModuleContentItems.moduleId, input.moduleId),
          eq(adminDataModuleContentItems.contentHash, contentHash)
        )
      : input.dedupeScope === "pushed"
        ? and(
            eq(adminDataModuleContentItems.status, "delivered"),
            eq(adminDataModuleContentItems.contentHash, contentHash)
          )
        : eq(adminDataModuleContentItems.contentHash, contentHash);
  const duplicate = (
    await db
      .select()
      .from(adminDataModuleContentItems)
      .where(duplicateWhere)
      .limit(1)
  )[0];
  if (duplicate) return { item: duplicate, duplicate: true };

  // 近似稿拦截：同一模块、同一去重域内只检查最近 200 条，
  // 既能阻止改写后重复推送，又不会扫描历史全表拖慢采集任务。
  if (input.type === "news_article" && input.body.length >= 120) {
    const recent = await db
      .select()
      .from(adminDataModuleContentItems)
      .where(
        input.dedupeScope === "global"
          ? eq(adminDataModuleContentItems.dedupeScope, input.dedupeScope)
          : and(
              eq(adminDataModuleContentItems.moduleId, input.moduleId),
              eq(adminDataModuleContentItems.dedupeScope, input.dedupeScope)
            )
      )
      .orderBy(desc(adminDataModuleContentItems.createdAt))
      .limit(200);
    for (const candidate of recent) {
      if (!candidate.body) continue;
      if (
        similarityScore(
          `${input.title}\n${input.body}`,
          `${candidate.title}\n${candidate.body}`
        ) >= 0.9
      ) {
        return { item: candidate, duplicate: true };
      }
    }
  }
  const contentKey = `modcontent_${randomUUID().replaceAll("-", "")}`;
  const rowValues: typeof adminDataModuleContentItems.$inferInsert = {
    contentKey,
    moduleId: input.moduleId,
    runId: input.runId ?? null,
    jobItemId: input.jobItemId ?? null,
    contentType: input.type ?? "generic",
    sourceKind: input.sourceKind,
    status: qualityReport.passed
      ? ("pending_review" as const)
      : ("rejected" as const),
    title: input.title.slice(0, 700),
    body: input.body,
    assetUrl: null,
    topic: input.topic.slice(0, 200),
    category: input.category.slice(0, 80),
    keywords: input.keywords.slice(0, 30),
    tags: input.tags.slice(0, 30),
    sortWeight: input.sortWeight,
    sourceReference: input.sourceReference.slice(0, 1200),
    targetPayload: input.payload,
    contentHash,
    dedupeScope: input.dedupeScope,
    qualityScore: qualityReport.score,
    qualityReport,
    errorDetail: qualityReport.passed
      ? null
      : `QUALITY_CHECK_REJECTED: ${qualityReport.rejectionReasons.join("；")}`.slice(
          0,
          1800
        ),
  };
  try {
    // Keep the database unique key as the final idempotency gate.  A no-op
    // duplicate update avoids surfacing a race as a failed generation while
    // preserving the canonical row and its original audit fields.
    await db
      .insert(adminDataModuleContentItems)
      .values(rowValues)
      .onDuplicateKeyUpdate({ set: { contentHash: sql`content_hash` } });
  } catch (error) {
    // Two crawler workers can pass the preflight lookup at the same time.
    // The database unique key is the final idempotency gate; return the
    // existing canonical row instead of surfacing a false generation failure.
    const code =
      error && typeof error === "object"
        ? Reflect.get(error, "code")
        : undefined;
    if (code !== "ER_DUP_ENTRY") throw error;
    const concurrent = (
      await db
        .select()
        .from(adminDataModuleContentItems)
        .where(
          and(
            eq(adminDataModuleContentItems.dedupeScope, input.dedupeScope),
            eq(adminDataModuleContentItems.contentHash, contentHash)
          )
        )
        .limit(1)
    )[0];
    if (!concurrent) throw error;
    return { item: concurrent, duplicate: true };
  }
  const item = (
    await db
      .select()
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, contentKey))
      .limit(1)
  )[0];
  if (!item) {
    const canonical = (
      await db
        .select()
        .from(adminDataModuleContentItems)
        .where(duplicateWhere)
        .limit(1)
    )[0];
    if (canonical) return { item: canonical, duplicate: true };
    throw new Error("ADMIN_MODULE_CONTENT_CREATE_FAILED");
  }
  return { item, duplicate: false, qualityReport };
}

export async function generateAdminDataModuleContentDraft(input: {
  moduleId: string;
  runKey: string;
  runId?: number;
  jobItemId?: number;
  actorUserId: number;
  mode?: "fast_draft" | "rich_content";
}) {
  const profile = await profileForModule(input.moduleId);
  const module = ADMIN_DATA_MODULES.find(item => item.id === input.moduleId);
  if (!module) throw new Error("ADMIN_DATA_MODULE_ID_INVALID");
  if (profile.sourceKind === "none")
    throw new Error("ADMIN_MODULE_SOURCE_NOT_CONFIGURED");
  const keywords = stringList(profile.keywords);
  const tags = stringList(profile.tags);
  if (profile.targetContract === "market_snapshot") {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const simulated = profile.sourceKind === "simulated";
    const existing = simulated
      ? null
      : ((
          await db
            .select()
            .from(marketData)
            .orderBy(desc(marketData.updatedAt))
            .limit(1)
        )[0] ?? null);
    if (!simulated && !existing) throw new Error("MARKET_DATA_SOURCE_EMPTY");
    const payload: MarketPayload = simulated
      ? simulatedMarketPayload(module.id, module.name, input.runKey)
      : {
          symbol: existing!.symbol,
          name: existing!.name,
          market: existing!.market as MarketType,
          price: existing!.price,
          changeVal: existing!.changeVal,
          changePct: existing!.changePct,
          volume: existing!.volume,
          updatedAt:
            existing!.updatedAt?.toISOString() ?? new Date().toISOString(),
        };
    const body =
      input.mode === "rich_content"
        ? `市场快照：${payload.symbol}，价格 ${payload.price}，涨跌 ${payload.changePct}%，成交量 ${payload.volume}。已按模块主题“${profile.theme ?? module.name}”和关键词“${keywords.join("、")}”完成格式校验、分类、排序与去重。${simulated ? "本记录为明确标识的模拟观察，不代表实时或可执行报价。" : "本记录引用已有市场快照，不扩展为新的事实或投资建议。"}既有市场字段没有图片地址，素材保持为空。`
        : `市场快照：${payload.symbol}，价格 ${payload.price}，涨跌 ${payload.changePct}%。${simulated ? "本记录为模拟观察，不代表实时或可执行报价。" : "本记录引用现有市场快照。"}`;
    const created = await createContentRow({
      moduleId: module.id,
      runId: input.runId,
      jobItemId: input.jobItemId,
      sourceKind: simulated ? "simulated" : "real",
      type: "market_snapshot",
      title: payload.name,
      body,
      topic: profile.theme ?? module.name,
      category: module.domain,
      keywords,
      tags,
      sortWeight: profile.sortWeight,
      sourceReference: simulated
        ? "deterministic-simulated-market-payload"
        : "existing-market_data-snapshot",
      payload,
      dedupeScope: profile.dedupeScope,
      dedupePayload: simulated
        ? {
            kind: "simulated_market",
            runKey: input.runKey,
            moduleId: module.id,
          }
        : {
            kind: "market_snapshot",
            symbol: payload.symbol,
            updatedAt: payload.updatedAt,
          },
    });
    return {
      contentKey: created.item.contentKey,
      duplicate: created.duplicate,
      sourceKind: created.item.sourceKind,
      status: created.item.status,
      targetContract: profile.targetContract,
      qualityScore: created.item.qualityScore,
      qualityThreshold: ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityPassed:
        created.item.qualityScore >= ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityRejectionReasons: created.duplicate
        ? []
        : (created.qualityReport?.rejectionReasons ?? []),
    };
  }
  if (profile.targetContract === "news_review_pipeline") {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const simulated = profile.sourceKind === "simulated";
    const existing = simulated
      ? null
      : ((
          await db
            .select()
            .from(adminNewsIngestionArticles)
            .where(
              inArray(adminNewsIngestionArticles.status, [
                "queued",
                "draft",
                "approved",
              ])
            )
            .orderBy(desc(adminNewsIngestionArticles.updatedAt))
            .limit(1)
        )[0] ?? null);
    if (!simulated && !existing) throw new Error("NEWS_SOURCE_EMPTY");
    const payload: NewsPayload = simulated
      ? simulatedNewsPayload(module.id, module.name, input.runKey)
      : {
          sourceId: existing!.sourceId,
          sourceItemKey: `automated:${existing!.id}`.slice(0, 512),
          title: existing!.aiTitle ?? existing!.sourceHeadline,
          summary:
            existing!.aiSummary ??
            existing!.sourceExcerpt ??
            "已保存来源未提供摘要。",
          sourceUrl: existing!.sourceUrl,
          sourceName: "既有已许可来源",
          category: existing!.category ?? "其他",
          publishedAt:
            existing!.sourcePublishedAt?.toISOString() ??
            new Date().toISOString(),
        };
    // Long-form scaffolding is reserved for explicitly labelled simulation
    // runs.  Real source articles must retain their factual length/content;
    // padding them with generic analysis creates repetitive, AI-sounding copy.
    if (isTopLongformModule(module.id) && simulated)
      payload.summary = ensureNewsLongformForModule(
        module.id,
        payload.title,
        payload.summary,
        TOP_NEWS_MIN_CHARACTERS
      );
    const body =
      input.mode === "rich_content"
        ? `${payload.summary}\n\n后台主题：${profile.theme ?? module.name}；关键词：${keywords.join("、")}；标签：${tags.join("、")}。${simulated ? "该条内容为明确标识的模拟内容，不代表事实或实时新闻。" : "该条内容仅基于已保存来源元数据，不增加来源未提供的事实。"}既有新闻读取契约没有图片字段，素材保持为空。`
        : payload.summary;
    const created = await createContentRow({
      moduleId: module.id,
      runId: input.runId,
      jobItemId: input.jobItemId,
      sourceKind: simulated ? "simulated" : "real",
      type: "news_article",
      title: payload.title,
      body,
      topic: profile.theme ?? module.name,
      category: payload.category,
      keywords,
      tags,
      sortWeight: profile.sortWeight,
      sourceReference: simulated
        ? "deterministic-simulated-news-payload"
        : "existing-admin_news_ingestion_articles",
      payload,
      dedupeScope: profile.dedupeScope,
      dedupePayload: simulated
        ? { kind: "simulated_news", runKey: input.runKey, moduleId: module.id }
        : {
            kind: "news_source",
            sourceItemKey: payload.sourceItemKey,
            sourceUrl: payload.sourceUrl,
          },
    });
    return {
      contentKey: created.item.contentKey,
      duplicate: created.duplicate,
      sourceKind: created.item.sourceKind,
      status: created.item.status,
      targetContract: profile.targetContract,
      qualityScore: created.item.qualityScore,
      qualityThreshold: ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityPassed:
        created.item.qualityScore >= ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityRejectionReasons: created.duplicate
        ? []
        : (created.qualityReport?.rejectionReasons ?? []),
    };
  }
  if (profile.targetContract === "announcement_publication") {
    if (profile.sourceKind !== "simulated")
      throw new Error("ANNOUNCEMENT_SIMULATION_SOURCE_REQUIRED");
    const payload = simulatedAnnouncementPayload(
      module.id,
      module.name,
      input.runKey
    );
    const body = `${payload.content}\n\n后台主题：${profile.theme ?? module.name}；关键词：${keywords.join("、")}；标签：${tags.join("、")}。本记录为明确标识的模拟公告，不代表事实或实际系统通知。`;
    const created = await createContentRow({
      moduleId: module.id,
      runId: input.runId,
      jobItemId: input.jobItemId,
      sourceKind: "simulated",
      type: "announcement",
      title: payload.title,
      body,
      topic: profile.theme ?? module.name,
      category: "公告",
      keywords,
      tags,
      sortWeight: profile.sortWeight,
      sourceReference: "deterministic-simulated-announcement-payload",
      payload,
      dedupeScope: profile.dedupeScope,
      dedupePayload: {
        kind: "simulated_announcement",
        runKey: input.runKey,
        moduleId: module.id,
      },
    });
    return {
      contentKey: created.item.contentKey,
      duplicate: created.duplicate,
      sourceKind: created.item.sourceKind,
      status: created.item.status,
      targetContract: profile.targetContract,
      qualityScore: created.item.qualityScore,
      qualityThreshold: ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityPassed:
        created.item.qualityScore >= ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityRejectionReasons: created.duplicate
        ? []
        : (created.qualityReport?.rejectionReasons ?? []),
    };
  }
  if (profile.targetContract === "module_content_feed") {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const strategy = ADMIN_CRAWLER_STRATEGY_BY_MODULE.get(module.id);
    if (!strategy) throw new Error("ADMIN_CRAWLER_STRATEGY_NOT_FOUND");
    const ordinal = Math.max(
      0,
      ADMIN_DATA_MODULES.findIndex(item => item.id === module.id)
    );
    const [security, article] = await Promise.all([
      db
        .select()
        .from(equityListings)
        .orderBy(equityListings.id)
        .limit(1)
        .offset(ordinal),
      db
        .select()
        .from(adminNewsIngestionArticles)
        .where(
          inArray(adminNewsIngestionArticles.status, [
            "queued",
            "draft",
            "approved",
            "published",
          ])
        )
        .orderBy(desc(adminNewsIngestionArticles.updatedAt))
        .limit(1),
    ]);
    const listing = security[0] ?? null;
    const newsItem = article[0] ?? null;
    const sample = dailySequence(input.runKey, module.id);
    const useExternalEvidence = profile.sourceKind !== "simulated";
    const sourceLabel = !useExternalEvidence
      ? "明确标识的本地差异化模拟分析"
      : newsItem
        ? "已许可公开新闻元数据 + 全球证券主数据清单"
        : listing
          ? "全球证券主数据清单 + 本地差异化分析"
          : "本地差异化模拟分析";
    const evidenceTitle =
      newsItem?.aiTitle ??
      newsItem?.sourceHeadline ??
      (listing
        ? `${listing.symbol} · ${listing.name}`
        : `${module.name} 模拟观察样本`);
    const sourceUrl = useExternalEvidence
      ? (newsItem?.sourceUrl ?? null)
      : null;
    const rule =
      profile.recommendationRule &&
      typeof profile.recommendationRule === "object"
        ? (profile.recommendationRule as Record<string, unknown>)
        : {};
    const allowedRewriteStyles = new Set<ModuleFeedPayload["rewriteStyle"]>([
      "source_faithful",
      "plain_language",
      "conversational",
      "brief",
    ]);
    const configuredRewriteStyle =
      typeof rule.crawlerRewriteStyle === "string"
        ? (rule.crawlerRewriteStyle as ModuleFeedPayload["rewriteStyle"])
        : "source_faithful";
    const rewriteStyle = allowedRewriteStyles.has(configuredRewriteStyle)
      ? configuredRewriteStyle
      : "source_faithful";
    const rewriteInput =
      newsItem?.aiSummary ?? newsItem?.sourceExcerpt ?? evidenceTitle;
    const rewritten = await rewriteCrawlerCopy({
      moduleId: module.id,
      sourceTitle: evidenceTitle,
      sourceSummary: rewriteInput,
      moduleName: module.name,
      contentLabel: strategy.contentLabel,
      style: rewriteStyle,
      minimumCharacters:
        isTopLongformModule(module.id) && !newsItem
          ? TOP_NEWS_MIN_CHARACTERS
          : undefined,
    });
    const signalLabels: Record<string, string[]> = {
      analyst_rating: ["模拟上调观察", "模拟维持观察", "模拟下调观察"],
      dragon_tiger: [
        "模拟机构净流入观察",
        "模拟活跃席位观察",
        "模拟资金分歧观察",
      ],
      fundamental_value: [
        "模拟价值低估观察",
        "模拟质量改善观察",
        "模拟现金流关注",
      ],
      financial_news: ["事件驱动摘要", "跨市场新闻验证", "主题热度变化"],
      macro_finance: ["政策路径观察", "增长通胀映射", "利率敏感度变化"],
      derivatives_signal: ["波动率结构观察", "期限价差观察", "隐含风险变化"],
      filing_event: ["披露事件观察", "信用证据更新", "偿付能力线索"],
      market_event: ["价格行为观察", "成交活跃度观察", "跨市场联动"],
      security_master: ["标的主数据校验", "上市地映射", "证券范围核验"],
      fund_flow: ["模拟资金流向观察", "持仓集中度观察", "配置变化线索"],
      workflow_intelligence: ["任务异常识别", "信息优先级编排", "操作风险提示"],
    };
    const labels = signalLabels[strategy.sourceType] ?? ["差异化模块观察"];
    const signal = labels[sample % labels.length]!;
    // A simulated run is a separate, explicitly-labelled observation.  Keep
    // its batch identity in the title so consecutive runs cannot collapse to
    // the same visible draft merely because they selected the same signal
    // label.  Real-source content never receives this suffix: its canonical
    // source identity remains the only dedupe key across modules and runs.
    const simulatedBatchLabel = !useExternalEvidence
      ? ` · 模拟批次 ${String(sample % 100000).padStart(5, "0")}`
      : "";
    const simulatedFields = ["signal", "score", "ranking"];
    const score = 50 + (sample % 49);
    const insight = `${signal}；模块专属评分 ${score}/98。评分、排序与评级均为明确标识的本地模拟分析，仅用于功能演示；来源标题、证券代码、上市地与来源链接保留原始出处。`;
    const payload: ModuleFeedPayload = {
      moduleId: module.id,
      moduleName: module.name,
      targetPath: strategy.targetPath,
      strategyKey: strategy.strategyKey,
      promptKey: strategy.promptKey,
      viewType: strategy.viewType,
      sourceType: strategy.sourceType,
      sourceLabel,
      sourceUrl,
      sourceObservedAt: new Date().toISOString(),
      symbol: listing?.symbol ?? null,
      securityName: listing?.name ?? null,
      country: listing?.country ?? null,
      exchange: listing?.exchange ?? null,
      evidenceTitle,
      insight,
      simulatedFields,
      transformationVersion: strategy.transformationVersion,
      contentLabel: strategy.contentLabel,
      contentDescription: strategy.contentDescription,
      targetLabel: strategy.targetLabel,
      rewriteStyle,
      rewriteEngine: rewritten.engine,
      originalSourceTitle: evidenceTitle,
      rewrittenSummary: rewritten.text,
    };
    const isMoneyMarketModule = module.id.startsWith("mm-");
    const title = (
      isMoneyMarketModule
        ? isTopLongformModule(module.id)
          ? formatNewsHeadline(evidenceTitle)
          : `${strategy.contentLabel} · ${evidenceTitle}`
        : `${module.name} · ${strategy.focus} · ${signal}${simulatedBatchLabel}`
    ).slice(0, 700);
    const body = isMoneyMarketModule
      ? rewritten.text
      : `爬虫数据内容：${strategy.contentLabel}。推送目标：${strategy.targetLabel}。内容说明：${strategy.contentDescription}。AI 改写方式：${rewriteStyle}；改写引擎：${rewritten.engine}。改写结果：${rewritten.text}。证据输入：${evidenceTitle}${listing ? `；关联标的 ${listing.symbol} ${listing.name}（${listing.country} / ${listing.exchange}）` : ""}。${insight} 本条内容使用 ${strategy.transformationVersion} 独立转换规则，与其他模块不共用正文模板或去重空间。`;
    const sourceIdentity =
      useExternalEvidence && newsItem
        ? {
            kind: "news_source",
            sourceId: newsItem.sourceId,
            sourceItemKey: `ingestion:${newsItem.id}`,
            sourceUrl: newsItem.sourceUrl,
            sourcePublishedAt:
              newsItem.sourcePublishedAt?.toISOString() ?? null,
          }
        : useExternalEvidence && listing
          ? {
              kind: "security_master",
              symbol: listing.symbol,
              country: listing.country,
              exchange: listing.exchange,
            }
          : null;
    const created = await createContentRow({
      moduleId: module.id,
      runId: input.runId,
      jobItemId: input.jobItemId,
      sourceKind: sourceIdentity ? "mixed" : "simulated",
      type: "generic",
      title,
      body,
      topic: strategy.focus,
      category: module.domain,
      keywords: [...new Set([...keywords, ...strategy.queryTerms])],
      tags: [
        ...new Set([
          ...tags,
          strategy.sourceType,
          strategy.transformationVersion,
        ]),
      ],
      sortWeight: profile.sortWeight,
      sourceReference: sourceLabel,
      payload,
      // A source observation has one canonical content identity across the
      // terminal.  Module-specific strategy metadata remains in the payload,
      // while the source identity prevents the same article/security snapshot
      // being delivered repeatedly to different modules.
      dedupeScope: sourceIdentity ? "global" : "module",
      dedupePayload: isMoneyMarketModule
        ? {
            ...(sourceIdentity ?? {
              kind: "module_observation",
              moduleId: module.id,
              runKey: input.runKey,
            }),
            sourceUrl,
            evidenceTitle,
            rewrittenText: rewritten.text,
            transformationVersion: strategy.transformationVersion,
          }
        : (sourceIdentity ?? {
            kind: "module_observation",
            moduleId: module.id,
            runKey: input.runKey,
            strategyKey: strategy.strategyKey,
            transformationVersion: strategy.transformationVersion,
          }),
    });
    return {
      contentKey: created.item.contentKey,
      duplicate: created.duplicate,
      sourceKind: created.item.sourceKind,
      status: created.item.status,
      targetContract: profile.targetContract,
      qualityScore: created.item.qualityScore,
      qualityThreshold: ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityPassed:
        created.item.qualityScore >= ADMIN_DATA_MODULE_QUALITY_THRESHOLD,
      qualityRejectionReasons: created.duplicate
        ? []
        : (created.qualityReport?.rejectionReasons ?? []),
    };
  }
  throw new Error(
    `ADMIN_MODULE_DELIVERY_CONTRACT_NOT_WRITABLE:${profile.targetContract}`
  );
}

export function summarizeAdminDataModuleDeliveryStats(input: {
  contentItems: Array<Pick<ContentRow, "status" | "errorDetail">>;
  operations: Array<
    Pick<
      DeliveryOperationRow,
      "status" | "previousTargetSnapshot" | "errorDetail"
    >
  >;
  deliveryEvents: Array<
    Pick<DeliveryEventRow, "action" | "status" | "detail" | "itemCount">
  >;
  stepEvents: Array<Pick<StepEventRow, "action" | "status" | "detail">>;
}) {
  const duplicateCount = input.contentItems.filter(
    item => item.status === "skipped_duplicate"
  ).length;
  const otherSkippedCount = input.deliveryEvents
    .filter(event => event.status === "skipped" && event.action !== "pushed")
    .reduce((sum, event) => sum + Math.max(1, event.itemCount), 0);
  const skippedCount = duplicateCount + otherSkippedCount;
  const updatedCount = input.operations.filter(
    operation =>
      operation.status === "applied" &&
      operation.previousTargetSnapshot !== null &&
      operation.previousTargetSnapshot !== undefined
  ).length;
  const failedContentCount = input.contentItems.filter(
    item => item.status === "failed"
  ).length;
  const failedOperationCount = input.operations.filter(
    operation => operation.status === "failed"
  ).length;
  const failedEventCount = input.deliveryEvents.filter(
    event => event.status === "failed"
  ).length;
  const failedCount =
    failedContentCount + failedOperationCount + failedEventCount;
  const pushedEventCount = input.deliveryEvents
    .filter(event => event.action === "pushed" && event.status === "success")
    .reduce((sum, event) => sum + Math.max(1, event.itemCount), 0);
  const pushedCount = Math.max(
    input.contentItems.filter(item => item.status === "delivered").length,
    pushedEventCount
  );
  const newCount = Math.max(
    0,
    input.contentItems.length - duplicateCount - updatedCount
  );
  const failureReasons = [
    ...new Set([
      ...input.contentItems
        .filter(item => item.status === "failed" && item.errorDetail)
        .map(item => item.errorDetail!),
      ...input.operations
        .filter(
          operation => operation.status === "failed" && operation.errorDetail
        )
        .map(operation => operation.errorDetail!),
      ...input.deliveryEvents
        .filter(event => event.status === "failed")
        .map(event => event.detail),
      ...input.stepEvents
        .filter(event => event.status === "failed")
        .map(event => event.detail),
    ]),
  ];
  const skipReasons = [
    ...input.deliveryEvents
      .filter(event => event.status === "skipped")
      .map(event => event.detail),
    ...input.stepEvents
      .filter(event => event.status === "skipped")
      .map(event => event.detail),
  ];
  return {
    newCount,
    updatedCount,
    skippedCount,
    duplicateCount,
    otherSkippedCount,
    failedCount,
    pushedCount,
    failureReasons,
    skipReasons,
  };
}

export async function getAdminDataModuleDeliveryStats(input: {
  moduleId?: string;
  runId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const contentWhere =
    input.moduleId && input.runId
      ? and(
          eq(adminDataModuleContentItems.moduleId, input.moduleId),
          eq(adminDataModuleContentItems.runId, input.runId)
        )
      : input.moduleId
        ? eq(adminDataModuleContentItems.moduleId, input.moduleId)
        : input.runId
          ? eq(adminDataModuleContentItems.runId, input.runId)
          : undefined;
  const operationWhere =
    input.moduleId && input.runId
      ? and(
          eq(adminDataModuleDeliveryOperations.moduleId, input.moduleId),
          eq(adminDataModuleDeliveryOperations.runId, input.runId)
        )
      : input.moduleId
        ? eq(adminDataModuleDeliveryOperations.moduleId, input.moduleId)
        : input.runId
          ? eq(adminDataModuleDeliveryOperations.runId, input.runId)
          : undefined;
  const eventWhere =
    input.moduleId && input.runId
      ? and(
          eq(adminDataModuleDeliveryEvents.moduleId, input.moduleId),
          eq(adminDataModuleDeliveryEvents.runId, input.runId)
        )
      : input.moduleId
        ? eq(adminDataModuleDeliveryEvents.moduleId, input.moduleId)
        : input.runId
          ? eq(adminDataModuleDeliveryEvents.runId, input.runId)
          : undefined;
  const stepWhere =
    input.moduleId && input.runId
      ? and(
          eq(adminDataModuleAutomationStepEvents.moduleId, input.moduleId),
          eq(adminDataModuleAutomationStepEvents.runId, input.runId)
        )
      : input.moduleId
        ? eq(adminDataModuleAutomationStepEvents.moduleId, input.moduleId)
        : input.runId
          ? eq(adminDataModuleAutomationStepEvents.runId, input.runId)
          : undefined;
  const contentItems = contentWhere
    ? await db
        .select({
          status: adminDataModuleContentItems.status,
          errorDetail: adminDataModuleContentItems.errorDetail,
        })
        .from(adminDataModuleContentItems)
        .where(contentWhere)
    : await db
        .select({
          status: adminDataModuleContentItems.status,
          errorDetail: adminDataModuleContentItems.errorDetail,
        })
        .from(adminDataModuleContentItems);
  const operations = operationWhere
    ? await db
        .select({
          status: adminDataModuleDeliveryOperations.status,
          previousTargetSnapshot:
            adminDataModuleDeliveryOperations.previousTargetSnapshot,
          errorDetail: adminDataModuleDeliveryOperations.errorDetail,
        })
        .from(adminDataModuleDeliveryOperations)
        .where(operationWhere)
    : await db
        .select({
          status: adminDataModuleDeliveryOperations.status,
          previousTargetSnapshot:
            adminDataModuleDeliveryOperations.previousTargetSnapshot,
          errorDetail: adminDataModuleDeliveryOperations.errorDetail,
        })
        .from(adminDataModuleDeliveryOperations);
  const deliveryEvents = eventWhere
    ? await db
        .select({
          action: adminDataModuleDeliveryEvents.action,
          status: adminDataModuleDeliveryEvents.status,
          detail: adminDataModuleDeliveryEvents.detail,
          itemCount: adminDataModuleDeliveryEvents.itemCount,
        })
        .from(adminDataModuleDeliveryEvents)
        .where(eventWhere)
    : await db
        .select({
          action: adminDataModuleDeliveryEvents.action,
          status: adminDataModuleDeliveryEvents.status,
          detail: adminDataModuleDeliveryEvents.detail,
          itemCount: adminDataModuleDeliveryEvents.itemCount,
        })
        .from(adminDataModuleDeliveryEvents);
  const stepEvents = stepWhere
    ? await db
        .select({
          action: adminDataModuleAutomationStepEvents.action,
          status: adminDataModuleAutomationStepEvents.status,
          detail: adminDataModuleAutomationStepEvents.detail,
        })
        .from(adminDataModuleAutomationStepEvents)
        .where(stepWhere)
    : await db
        .select({
          action: adminDataModuleAutomationStepEvents.action,
          status: adminDataModuleAutomationStepEvents.status,
          detail: adminDataModuleAutomationStepEvents.detail,
        })
        .from(adminDataModuleAutomationStepEvents);
  return summarizeAdminDataModuleDeliveryStats({
    contentItems,
    operations,
    deliveryEvents,
    stepEvents,
  });
}

export async function listAdminDataModuleContent(input: {
  moduleId?: string;
  status?: (typeof adminDataModuleContentItems.$inferSelect)["status"];
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 40));
  const where =
    input.moduleId && input.status
      ? and(
          eq(adminDataModuleContentItems.moduleId, input.moduleId),
          eq(adminDataModuleContentItems.status, input.status)
        )
      : input.moduleId
        ? eq(adminDataModuleContentItems.moduleId, input.moduleId)
        : input.status
          ? eq(adminDataModuleContentItems.status, input.status)
          : undefined;
  const query = db.select().from(adminDataModuleContentItems);
  const rows = where
    ? await query
        .where(where)
        .orderBy(desc(adminDataModuleContentItems.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
    : await query
        .orderBy(desc(adminDataModuleContentItems.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
  return { page, pageSize, rows };
}

export async function approveAdminDataModuleContent(
  contentKey: string,
  actorUserId: number
) {
  const initialDb = await getDb();
  if (!initialDb) throw new Error("DATABASE_UNAVAILABLE");
  const initialContent = (
    await initialDb
      .select()
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, contentKey))
      .limit(1)
  )[0];
  if (!initialContent) throw new Error("ADMIN_MODULE_CONTENT_NOT_FOUND");
  return withAdminDataModuleLease(
    `admin-module-content-approval:${initialContent.moduleId}`,
    "review_and_version",
    async () => {
      const db = initialDb;
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      const content = (
        await db
          .select()
          .from(adminDataModuleContentItems)
          .where(eq(adminDataModuleContentItems.contentKey, contentKey))
          .limit(1)
      )[0];
      if (!content) throw new Error("ADMIN_MODULE_CONTENT_NOT_FOUND");
      if (content.status === "delivered")
        throw new Error("ADMIN_MODULE_CONTENT_ALREADY_DELIVERED");
      if (
        content.status === "rejected" ||
        content.status === "failed" ||
        content.status === "reverted"
      )
        throw new Error("ADMIN_MODULE_CONTENT_NOT_APPROVABLE");
      if (content.deliveryVersionId)
        return {
          contentKey,
          versionId: content.deliveryVersionId,
          status: "approved" as const,
          repeated: true,
        };
      const profile = await profileForModule(content.moduleId);
      const priorVersion =
        (
          await db
            .select()
            .from(adminDataModuleDeliveryVersions)
            .where(
              eq(adminDataModuleDeliveryVersions.moduleId, content.moduleId)
            )
            .orderBy(desc(adminDataModuleDeliveryVersions.version))
            .limit(1)
        )[0] ?? null;
      const version = (priorVersion?.version ?? 0) + 1;
      const payloadHash = digest(content.targetPayload);
      const versionInsert = await db
        .insert(adminDataModuleDeliveryVersions)
        .values({
          moduleId: content.moduleId,
          runId: content.runId,
          version,
          status: "approved",
          targetContract: profile.targetContract,
          targetCollection: profile.targetCollection,
          fieldMapping: profile.fieldMapping,
          payloadSnapshot: content.targetPayload ?? {},
          payloadHash,
          sourceKind: content.sourceKind,
          itemCount: 1,
          previousVersionId: priorVersion?.id ?? null,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        });
      const versionId = insertId(versionInsert);
      if (!versionId)
        throw new Error("ADMIN_MODULE_DELIVERY_VERSION_CREATE_FAILED");
      await db.transaction(async tx => {
        await tx
          .update(adminDataModuleContentItems)
          .set({
            status: "approved",
            deliveryVersionId: versionId,
            reviewedByUserId: actorUserId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleContentItems.id, content.id));
        await tx
          .update(adminDataModuleProfiles)
          .set({
            currentVersion: version,
            rollbackVersion: profile.currentVersion || null,
            runtimeStatus: "pending_delivery",
            updatedByUserId: actorUserId,
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleProfiles.moduleId, content.moduleId));
        await tx.insert(adminDataModuleDeliveryEvents).values({
          moduleId: content.moduleId,
          runId: content.runId,
          deliveryVersionId: versionId,
          action: "reviewed",
          status: "success",
          targetContract: profile.targetContract,
          targetDetail: profile.targetCollection ?? profile.frontendInterface,
          itemCount: 1,
          dataVersion: version,
          detail: "管理员已审核并批准候选内容；尚未推送到既有前端读取目标。",
          actorUserId,
        });
      });
      return {
        contentKey,
        versionId,
        status: "approved" as const,
        repeated: false,
      };
    }
  );
}

export async function rejectAdminDataModuleContent(
  contentKey: string,
  actorUserId: number,
  reason: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const content = (
    await db
      .select()
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, contentKey))
      .limit(1)
  )[0];
  if (!content) throw new Error("ADMIN_MODULE_CONTENT_NOT_FOUND");
  if (content.deliveryVersionId || content.status === "delivered")
    throw new Error("ADMIN_MODULE_CONTENT_REJECT_AFTER_VERSION_FORBIDDEN");
  await db
    .update(adminDataModuleContentItems)
    .set({
      status: "rejected",
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
      errorDetail: reason.slice(0, 1800),
      updatedAt: new Date(),
    })
    .where(eq(adminDataModuleContentItems.id, content.id));
  return { contentKey, status: "rejected" as const };
}

async function simulatedNewsSource(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const provider = "finance_hub_simulated";
  const existing = (
    await db
      .select()
      .from(adminNewsIngestionSources)
      .where(eq(adminNewsIngestionSources.provider, provider))
      .limit(1)
  )[0];
  if (existing) return existing;
  try {
    return await withAdminDataModuleLease(
      "admin-module:simulated-news-source",
      "delivery_source_initialization",
      async () => {
        const afterLease = (
          await db
            .select()
            .from(adminNewsIngestionSources)
            .where(eq(adminNewsIngestionSources.provider, provider))
            .limit(1)
        )[0];
        if (afterLease) return afterLease;
        try {
          await db.insert(adminNewsIngestionSources).values({
            name: "Finance Hub 模拟内容源",
            provider,
            feedUrl: "https://simulation.invalid/finance-hub/rss",
            sourceUrl: "https://simulation.invalid/finance-hub",
            sourceType: "api",
            isActive: false,
            maxItemsPerRun: 1,
            processingMode: "queued",
            lastStatus: "never",
            createdByUserId: actorUserId,
          });
        } catch (error) {
          const recovered = (
            await db
              .select()
              .from(adminNewsIngestionSources)
              .where(eq(adminNewsIngestionSources.provider, provider))
              .limit(1)
          )[0];
          if (recovered) return recovered;
          throw error;
        }
        const created = (
          await db
            .select()
            .from(adminNewsIngestionSources)
            .where(eq(adminNewsIngestionSources.provider, provider))
            .limit(1)
        )[0];
        if (!created) throw new Error("SIMULATED_NEWS_SOURCE_CREATE_FAILED");
        return created;
      }
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "ADMIN_MODULE_EXECUTION_BUSY"
    )
      throw error;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const joined = (
        await db
          .select()
          .from(adminNewsIngestionSources)
          .where(eq(adminNewsIngestionSources.provider, provider))
          .limit(1)
      )[0];
      if (joined) return joined;
    }
    throw new Error("SIMULATED_NEWS_SOURCE_INITIALIZATION_TIMEOUT");
  }
}

async function createDeliveryOperation(input: {
  content: ContentRow;
  profile: ProfileRow;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const versionId = input.content.deliveryVersionId;
  if (!versionId) throw new Error("ADMIN_MODULE_CONTENT_VERSION_REQUIRED");
  const existing = (
    await db
      .select()
      .from(adminDataModuleDeliveryOperations)
      .where(
        eq(
          adminDataModuleDeliveryOperations.idempotencyKey,
          `delivery:${versionId}`
        )
      )
      .limit(1)
  )[0];
  if (existing) return { operation: existing, repeated: true };
  const payloadHash = digest(input.content.targetPayload);
  const key = `moddelivery_${randomUUID().replaceAll("-", "")}`;
  await db.insert(adminDataModuleDeliveryOperations).values({
    operationKey: key,
    idempotencyKey: `delivery:${versionId}`,
    moduleId: input.content.moduleId,
    runId: input.content.runId,
    jobItemId: input.content.jobItemId,
    deliveryVersionId: versionId,
    status: "queued",
    targetContract: input.profile.targetContract,
    targetReference:
      input.profile.targetCollection ?? input.profile.frontendInterface,
    payloadHash,
    candidatePayload: input.content.targetPayload ?? {},
    itemCount: 1,
  });
  const operation = (
    await db
      .select()
      .from(adminDataModuleDeliveryOperations)
      .where(eq(adminDataModuleDeliveryOperations.operationKey, key))
      .limit(1)
  )[0];
  if (!operation)
    throw new Error("ADMIN_MODULE_DELIVERY_OPERATION_CREATE_FAILED");
  return { operation, repeated: false };
}

export async function deliverApprovedAdminDataModuleContent(
  contentKey: string,
  actorUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const content = (
    await db
      .select()
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, contentKey))
      .limit(1)
  )[0];
  if (!content) throw new Error("ADMIN_MODULE_CONTENT_NOT_FOUND");
  if (content.status !== "approved" && content.status !== "queued_for_delivery")
    throw new Error("ADMIN_MODULE_CONTENT_APPROVAL_REQUIRED");
  const profile = await profileForModule(content.moduleId);
  if (
    profile.targetContract !== "market_snapshot" &&
    profile.targetContract !== "news_review_pipeline" &&
    profile.targetContract !== "announcement_publication" &&
    profile.targetContract !== "module_content_feed"
  )
    throw new Error("ADMIN_MODULE_DELIVERY_CONTRACT_NOT_WRITABLE");
  const { operation, repeated } = await createDeliveryOperation({
    content,
    profile,
    actorUserId,
  });
  if (operation.status === "applied")
    return {
      contentKey,
      operationKey: operation.operationKey,
      status: "delivered" as const,
      repeated: true,
    };
  const started = Date.now();
  try {
    await db
      .update(adminDataModuleDeliveryOperations)
      .set({ status: "applying", updatedAt: new Date() })
      .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
    if (profile.targetContract === "market_snapshot") {
      const payload = asMarketPayload(content.targetPayload);
      const previous =
        (
          await db
            .select()
            .from(marketData)
            .where(eq(marketData.symbol, payload.symbol))
            .limit(1)
        )[0] ?? null;
      await db.transaction(async tx => {
        await tx
          .insert(marketData)
          .values({
            symbol: payload.symbol,
            name: payload.name,
            market: payload.market,
            price: payload.price,
            changeVal: payload.changeVal,
            changePct: payload.changePct,
            volume: payload.volume,
            updatedAt: new Date(payload.updatedAt),
          })
          .onDuplicateKeyUpdate({
            set: {
              name: payload.name,
              market: payload.market,
              price: payload.price,
              changeVal: payload.changeVal,
              changePct: payload.changePct,
              volume: payload.volume,
              updatedAt: new Date(payload.updatedAt),
            },
          });
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "applied",
            previousTargetSnapshot: previous,
            resultSnapshot: payload,
            appliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
        await tx
          .update(adminDataModuleContentItems)
          .set({
            status: "delivered",
            publishedAt: new Date(),
            deliveryAttempts: content.deliveryAttempts + 1,
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleContentItems.id, content.id));
        await tx
          .update(adminDataModuleDeliveryVersions)
          .set({
            status: "delivered",
            pushedByUserId: actorUserId,
            pushedAt: new Date(),
          })
          .where(
            eq(adminDataModuleDeliveryVersions.id, content.deliveryVersionId!)
          );
        await tx
          .update(adminDataModuleProfiles)
          .set({
            runtimeStatus: "delivered",
            lastPushedAt: new Date(),
            updatedByUserId: actorUserId,
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleProfiles.moduleId, content.moduleId));
      });
    } else if (profile.targetContract === "news_review_pipeline") {
      const payload = asNewsPayload(content.targetPayload);
      const source =
        content.sourceKind === "simulated"
          ? await simulatedNewsSource(actorUserId)
          : payload.sourceId
            ? (
                await db
                  .select()
                  .from(adminNewsIngestionSources)
                  .where(eq(adminNewsIngestionSources.id, payload.sourceId))
                  .limit(1)
              )[0]
            : null;
      if (!source) throw new Error("NEWS_DELIVERY_SOURCE_NOT_FOUND");
      const publishedAt = new Date(payload.publishedAt);
      const articleInsert = await db.insert(adminNewsIngestionArticles).values({
        sourceId: source.id,
        sourceItemKey: payload.sourceItemKey,
        sourceHeadline: payload.title,
        sourceExcerpt: payload.summary,
        sourceUrl: payload.sourceUrl,
        sourcePublishedAt: publishedAt,
        status: "published",
        aiTitle: payload.title,
        aiSummary: payload.summary,
        category: payload.category,
        sentiment: "uncertain",
        tickers: [],
        aiModel: null,
        aiGeneratedAt: null,
        processingError: null,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        publishedByUserId: actorUserId,
        publishedAt: new Date(),
      });
      const articleId = insertId(articleInsert);
      if (!articleId) throw new Error("NEWS_DELIVERY_ARTICLE_CREATE_FAILED");
      await db.transaction(async tx => {
        await tx.insert(adminNewsIngestionAuditEvents).values({
          sourceId: source.id,
          articleId,
          actorUserId,
          action: "published",
          detail:
            "已由管理员批准的模块内容推送到既有新闻发布队列；保留来源标识和模拟/真实审计。",
        });
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "applied",
            previousTargetSnapshot: null,
            resultSnapshot: {
              articleId,
              sourceId: source.id,
              sourceItemKey: payload.sourceItemKey,
            },
            appliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
        await tx
          .update(adminDataModuleContentItems)
          .set({
            status: "delivered",
            publishedAt: new Date(),
            deliveryAttempts: content.deliveryAttempts + 1,
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleContentItems.id, content.id));
        await tx
          .update(adminDataModuleDeliveryVersions)
          .set({
            status: "delivered",
            pushedByUserId: actorUserId,
            pushedAt: new Date(),
          })
          .where(
            eq(adminDataModuleDeliveryVersions.id, content.deliveryVersionId!)
          );
        await tx
          .update(adminDataModuleProfiles)
          .set({
            runtimeStatus: "delivered",
            lastPushedAt: new Date(),
            updatedByUserId: actorUserId,
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleProfiles.moduleId, content.moduleId));
      });
    } else if (profile.targetContract === "announcement_publication") {
      const payload = asAnnouncementPayload(content.targetPayload);
      const now = new Date();
      let announcementId = 0;
      await db.transaction(async tx => {
        const announcementInsert = await tx.insert(announcements).values({
          title: payload.title,
          content: payload.content,
          type: payload.type,
          priority: payload.priority,
          status: "published",
          authorId: actorUserId,
          authorName: `后台自动化管理员 ${actorUserId}`,
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
          publishedAt: now,
          draftRevision: 1,
          acceptedRevision: 1,
          acceptanceNote: "已由后台模块审核链路批准的明确模拟公告。",
          acceptedAt: now,
          acceptedById: actorUserId,
          acceptedByName: `后台自动化管理员 ${actorUserId}`,
        });
        announcementId = insertId(announcementInsert);
        if (!announcementId)
          throw new Error("ANNOUNCEMENT_DELIVERY_CREATE_FAILED");
        await tx.insert(announcementAcceptanceEvents).values({
          announcementId,
          revision: 1,
          action: "confirmed",
          actorUserId,
          actorUserName: `后台自动化管理员 ${actorUserId}`,
          note: "模块候选已审核；该公告明确标识为模拟内容。",
        });
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "applied",
            previousTargetSnapshot: null,
            resultSnapshot: {
              announcementId,
              title: payload.title,
              status: "published",
            },
            appliedAt: now,
            updatedAt: now,
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
        await tx
          .update(adminDataModuleContentItems)
          .set({
            status: "delivered",
            publishedAt: now,
            deliveryAttempts: content.deliveryAttempts + 1,
            updatedAt: now,
          })
          .where(eq(adminDataModuleContentItems.id, content.id));
        await tx
          .update(adminDataModuleDeliveryVersions)
          .set({
            status: "delivered",
            pushedByUserId: actorUserId,
            pushedAt: now,
          })
          .where(
            eq(adminDataModuleDeliveryVersions.id, content.deliveryVersionId!)
          );
        await tx
          .update(adminDataModuleProfiles)
          .set({
            runtimeStatus: "delivered",
            lastPushedAt: now,
            updatedByUserId: actorUserId,
            updatedAt: now,
          })
          .where(eq(adminDataModuleProfiles.moduleId, content.moduleId));
      });
    } else if (profile.targetContract === "module_content_feed") {
      const payload = content.targetPayload as ModuleFeedPayload | null;
      if (
        !payload ||
        payload.moduleId !== content.moduleId ||
        !payload.strategyKey ||
        !payload.targetPath
      )
        throw new Error("MODULE_FEED_PAYLOAD_INVALID");
      const now = new Date();
      await db.transaction(async tx => {
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "applied",
            previousTargetSnapshot: null,
            resultSnapshot: {
              contentKey: content.contentKey,
              moduleId: content.moduleId,
              strategyKey: payload.strategyKey,
              targetPath: payload.targetPath,
            },
            appliedAt: now,
            updatedAt: now,
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
        await tx
          .update(adminDataModuleContentItems)
          .set({
            status: "delivered",
            publishedAt: now,
            deliveryAttempts: content.deliveryAttempts + 1,
            updatedAt: now,
          })
          .where(eq(adminDataModuleContentItems.id, content.id));
        await tx
          .update(adminDataModuleDeliveryVersions)
          .set({
            status: "delivered",
            pushedByUserId: actorUserId,
            pushedAt: now,
          })
          .where(
            eq(adminDataModuleDeliveryVersions.id, content.deliveryVersionId!)
          );
        await tx
          .update(adminDataModuleProfiles)
          .set({
            runtimeStatus: "delivered",
            lastPushedAt: now,
            updatedByUserId: actorUserId,
            updatedAt: now,
          })
          .where(eq(adminDataModuleProfiles.moduleId, content.moduleId));
      });
    }
    await db.insert(adminDataModuleDeliveryEvents).values({
      moduleId: content.moduleId,
      runId: content.runId,
      deliveryVersionId: content.deliveryVersionId,
      action: "pushed",
      status: "success",
      targetContract: profile.targetContract,
      targetDetail: profile.targetCollection ?? profile.frontendInterface,
      itemCount: 1,
      dataVersion: profile.currentVersion,
      durationMs: Date.now() - started,
      detail: `已推送到既有 ${profile.targetContract} 数据契约；前端接口、字段、缓存和路由没有修改。${content.sourceKind === "simulated" ? "该内容是明确标识的模拟内容。" : ""}`,
      actorUserId,
    });
    return {
      contentKey,
      operationKey: operation.operationKey,
      status: "delivered" as const,
      repeated,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ADMIN_MODULE_DELIVERY_FAILED";
    await db
      .update(adminDataModuleDeliveryOperations)
      .set({
        status: "failed",
        errorDetail: message.slice(0, 1800),
        updatedAt: new Date(),
      })
      .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
    await db
      .update(adminDataModuleContentItems)
      .set({
        status: "approved",
        deliveryAttempts: content.deliveryAttempts + 1,
        errorDetail: message.slice(0, 1800),
        updatedAt: new Date(),
      })
      .where(eq(adminDataModuleContentItems.id, content.id));
    await db.insert(adminDataModuleDeliveryEvents).values({
      moduleId: content.moduleId,
      runId: content.runId,
      deliveryVersionId: content.deliveryVersionId,
      action: "push_failed",
      status: "failed",
      targetContract: profile.targetContract,
      targetDetail: profile.targetCollection ?? profile.frontendInterface,
      itemCount: 0,
      dataVersion: profile.currentVersion,
      durationMs: Date.now() - started,
      detail: `推送失败，旧版本未被覆盖或已由事务回滚：${message}`.slice(
        0,
        1800
      ),
      actorUserId,
    });
    throw error;
  }
}

export async function rollbackAdminDataModuleDeliveryVersion(
  versionId: number,
  actorUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const version = (
    await db
      .select()
      .from(adminDataModuleDeliveryVersions)
      .where(eq(adminDataModuleDeliveryVersions.id, versionId))
      .limit(1)
  )[0];
  if (!version) throw new Error("ADMIN_MODULE_DELIVERY_VERSION_NOT_FOUND");
  if (version.status !== "delivered")
    throw new Error("ADMIN_MODULE_DELIVERY_VERSION_NOT_DELIVERED");
  const operation = (
    await db
      .select()
      .from(adminDataModuleDeliveryOperations)
      .where(eq(adminDataModuleDeliveryOperations.deliveryVersionId, versionId))
      .limit(1)
  )[0];
  if (!operation || operation.status !== "applied")
    throw new Error("ADMIN_MODULE_DELIVERY_OPERATION_NOT_APPLIED");
  const profile = await profileForModule(version.moduleId);
  const previousVersion = version.previousVersionId
    ? ((
        await db
          .select()
          .from(adminDataModuleDeliveryVersions)
          .where(
            eq(adminDataModuleDeliveryVersions.id, version.previousVersionId)
          )
          .limit(1)
      )[0] ?? null)
    : null;
  const restoredCurrentVersion =
    previousVersion?.status === "delivered" ? previousVersion.version : 0;
  try {
    if (operation.targetContract === "market_snapshot") {
      const result = asMarketPayload(operation.resultSnapshot);
      const previous = operation.previousTargetSnapshot as MarketPayload | null;
      await db.transaction(async tx => {
        if (previous) {
          await tx
            .insert(marketData)
            .values({
              symbol: previous.symbol,
              name: previous.name,
              market: previous.market,
              price: previous.price,
              changeVal: previous.changeVal,
              changePct: previous.changePct,
              volume: previous.volume,
              updatedAt: new Date(previous.updatedAt),
            })
            .onDuplicateKeyUpdate({
              set: {
                name: previous.name,
                market: previous.market,
                price: previous.price,
                changeVal: previous.changeVal,
                changePct: previous.changePct,
                volume: previous.volume,
                updatedAt: new Date(previous.updatedAt),
              },
            });
        } else {
          await tx
            .delete(marketData)
            .where(eq(marketData.symbol, result.symbol));
        }
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "reverted",
            revertedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
      });
    } else if (operation.targetContract === "news_review_pipeline") {
      const result = operation.resultSnapshot as { articleId?: number } | null;
      const articleId = result?.articleId;
      if (
        typeof articleId !== "number" ||
        !Number.isSafeInteger(articleId) ||
        articleId < 1
      )
        throw new Error("NEWS_DELIVERY_RESULT_SNAPSHOT_INVALID");
      await db.transaction(async tx => {
        await tx
          .delete(adminNewsIngestionArticles)
          .where(eq(adminNewsIngestionArticles.id, articleId));
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "reverted",
            revertedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
      });
    } else if (operation.targetContract === "announcement_publication") {
      const result = operation.resultSnapshot as {
        announcementId?: number;
      } | null;
      const announcementId = result?.announcementId;
      if (
        typeof announcementId !== "number" ||
        !Number.isSafeInteger(announcementId) ||
        announcementId < 1
      )
        throw new Error("ANNOUNCEMENT_DELIVERY_RESULT_SNAPSHOT_INVALID");
      await db.transaction(async tx => {
        await tx
          .update(announcements)
          .set({ status: "archived" })
          .where(eq(announcements.id, announcementId));
        await tx
          .update(adminDataModuleDeliveryOperations)
          .set({
            status: "reverted",
            revertedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
      });
    } else if (operation.targetContract === "module_content_feed") {
      await db
        .update(adminDataModuleDeliveryOperations)
        .set({
          status: "reverted",
          revertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminDataModuleDeliveryOperations.id, operation.id));
    } else {
      throw new Error("ADMIN_MODULE_DELIVERY_CONTRACT_NOT_ROLLBACKABLE");
    }
    await db.transaction(async tx => {
      await tx
        .update(adminDataModuleDeliveryVersions)
        .set({ status: "reverted", revertedAt: new Date() })
        .where(eq(adminDataModuleDeliveryVersions.id, versionId));
      await tx
        .update(adminDataModuleContentItems)
        .set({ status: "reverted", updatedAt: new Date() })
        .where(eq(adminDataModuleContentItems.deliveryVersionId, versionId));
      await tx
        .update(adminDataModuleProfiles)
        .set({
          currentVersion: restoredCurrentVersion,
          rollbackVersion: version.version,
          runtimeStatus: "enabled",
          updatedByUserId: actorUserId,
          updatedAt: new Date(),
        })
        .where(eq(adminDataModuleProfiles.moduleId, version.moduleId));
      await tx.insert(adminDataModuleDeliveryEvents).values({
        moduleId: version.moduleId,
        runId: version.runId,
        deliveryVersionId: versionId,
        action: "reverted",
        status: "success",
        targetContract: operation.targetContract,
        targetDetail: operation.targetReference,
        itemCount: operation.itemCount,
        dataVersion: version.version,
        detail:
          "管理员已基于推送前快照撤回本次版本；既有前端读取目标已恢复上一状态。",
        actorUserId,
      });
    });
    return { versionId, status: "reverted" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ADMIN_MODULE_ROLLBACK_FAILED";
    await db.insert(adminDataModuleDeliveryEvents).values({
      moduleId: version.moduleId,
      runId: version.runId,
      deliveryVersionId: versionId,
      action: "push_failed",
      status: "failed",
      targetContract: operation.targetContract,
      targetDetail: operation.targetReference,
      itemCount: 0,
      dataVersion: version.version,
      detail: `撤回失败；未删除版本审计：${message}`.slice(0, 1800),
      actorUserId,
    });
    throw error;
  }
}

export async function retryAdminDataModuleDelivery(
  contentKey: string,
  actorUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const content = (
    await db
      .select()
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.contentKey, contentKey))
      .limit(1)
  )[0];
  if (!content) throw new Error("ADMIN_MODULE_CONTENT_NOT_FOUND");
  const versionId = content.deliveryVersionId;
  if (!versionId) throw new Error("ADMIN_MODULE_CONTENT_VERSION_REQUIRED");
  await db
    .update(adminDataModuleDeliveryOperations)
    .set({ status: "queued", errorDetail: null, updatedAt: new Date() })
    .where(
      and(
        eq(adminDataModuleDeliveryOperations.deliveryVersionId, versionId),
        eq(adminDataModuleDeliveryOperations.status, "failed")
      )
    );
  await db.insert(adminDataModuleDeliveryEvents).values({
    moduleId: content.moduleId,
    runId: content.runId,
    deliveryVersionId: versionId,
    action: "retried",
    status: "pending",
    targetContract: (await profileForModule(content.moduleId)).targetContract,
    targetDetail: "重试原既有目标",
    itemCount: 1,
    dataVersion: null,
    detail: "管理员已请求重试失败推送；重试仍使用原候选载荷和幂等键。",
    actorUserId,
  });
  return deliverApprovedAdminDataModuleContent(contentKey, actorUserId);
}
