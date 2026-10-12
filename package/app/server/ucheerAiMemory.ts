import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, like, lt, ne, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ucheerAiConversations,
  ucheerAiEvolutionEvents,
  ucheerAiMemories,
  ucheerAiMessages,
  standaloneSchedules,
} from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
let schemaReady: Promise<void> | null = null;

// This is also checked in as drizzle/0113_ucheer_ai_memory.sql. A deployed
// standalone server can bootstrap its own tables without an external migration step.
async function ensureTables(db: Database) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS ucheer_ai_conversations (
        id varchar(36) NOT NULL PRIMARY KEY, user_id int NOT NULL,
        title varchar(160) NOT NULL, last_summarized_message_id bigint NOT NULL DEFAULT 0,
        last_distill_attempted_message_id bigint NOT NULL DEFAULT 0,
        last_distill_status enum('never','pending','running','completed','failed') NOT NULL DEFAULT 'never',
        last_distill_error varchar(500) DEFAULT NULL, last_distill_at timestamp NULL DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY ucheer_ai_conversations_user_updated_idx (user_id, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS ucheer_ai_messages (
        id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY, conversation_id varchar(36) NOT NULL,
        user_id int NOT NULL, role enum('user','assistant') NOT NULL,
        content text NOT NULL, feedback enum('helpful','unhelpful') DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY ucheer_ai_messages_user_conversation_idx (user_id, conversation_id, id),
        KEY ucheer_ai_messages_feedback_idx (feedback)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS ucheer_ai_memories (
        id int NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id int NOT NULL,
        kind enum('core','daily') NOT NULL, content varchar(600) NOT NULL,
        fingerprint varchar(64) NOT NULL, memory_key varchar(120) NOT NULL DEFAULT '',
        confidence varchar(16) NOT NULL DEFAULT '0.70', evidence varchar(600) NOT NULL DEFAULT '',
        status enum('active','superseded') NOT NULL DEFAULT 'active',
        last_seen_message_id bigint NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY ucheer_ai_memories_user_fingerprint_uq (user_id, fingerprint),
        KEY ucheer_ai_memories_user_key_idx (user_id, memory_key, status),
        KEY ucheer_ai_memories_user_kind_updated_idx (user_id, kind, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS ucheer_ai_evolution_events (
        id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id int NOT NULL,
        conversation_id varchar(36) DEFAULT NULL,
        event_type enum('memory_captured','distillation_completed','distillation_failed','feedback_recorded') NOT NULL,
        status enum('completed','failed','skipped') NOT NULL,
        processed_message_id bigint DEFAULT NULL, detail varchar(500) NOT NULL DEFAULT '',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY ucheer_ai_evolution_events_user_created_idx (user_id, created_at),
        KEY ucheer_ai_evolution_events_status_idx (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      // Existing deployments may have the 0113 tables already. These idempotent
      // upgrades keep persistence intact without requiring a manual restart.
      const upgrades = [
        sql`ALTER TABLE ucheer_ai_conversations ADD COLUMN last_distill_attempted_message_id bigint NOT NULL DEFAULT 0`,
        sql`ALTER TABLE ucheer_ai_conversations ADD COLUMN last_distill_status enum('never','pending','running','completed','failed') NOT NULL DEFAULT 'never'`,
        sql`ALTER TABLE ucheer_ai_conversations ADD COLUMN last_distill_error varchar(500) DEFAULT NULL`,
        sql`ALTER TABLE ucheer_ai_conversations ADD COLUMN last_distill_at timestamp NULL DEFAULT NULL`,
        sql`ALTER TABLE ucheer_ai_memories ADD COLUMN memory_key varchar(120) NOT NULL DEFAULT ''`,
        sql`ALTER TABLE ucheer_ai_memories ADD COLUMN confidence varchar(16) NOT NULL DEFAULT '0.70'`,
        sql`ALTER TABLE ucheer_ai_memories ADD COLUMN evidence varchar(600) NOT NULL DEFAULT ''`,
        sql`ALTER TABLE ucheer_ai_memories ADD COLUMN status enum('active','superseded') NOT NULL DEFAULT 'active'`,
        sql`ALTER TABLE ucheer_ai_memories ADD COLUMN last_seen_message_id bigint NOT NULL DEFAULT 0`,
        sql`ALTER TABLE ucheer_ai_memories ADD KEY ucheer_ai_memories_user_key_idx (user_id, memory_key, status)`,
      ];
      for (const upgrade of upgrades) {
        try { await db.execute(upgrade); } catch { /* already applied or unsupported duplicate */ }
      }
    })().catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function memoryDb(): Promise<Database> {
  const db = await getDb();
  if (!db) throw new Error("长期记忆数据库未连接；对话没有被保存。");
  await ensureTables(db);
  return db;
}

const SENSITIVE = /(?:密码|密钥|口令|验证码|身份证|银行卡|私钥|助记词|令牌|邮箱|手机号|手机号码|电话号码|住址|护照|税号|email|phone|address|api[\s_-]*key|access[\s_-]*token|secret|password|cookie|bearer)/i;
const SENSITIVE_VALUE = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b1[3-9]\d{9}\b|\b(?:\d[ -]?){13,19}\b|\bsk[-_][a-z0-9]{16,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const DIRECTIVE = /(?:忽略|绕过|无视|系统提示|开发者指令|ignore\s+previous|system\s+prompt)/i;
const VOLATILE = /(?:今天|现在|当前|实时|最新|行情|价格|涨跌|多少|是否上涨|新闻|消息|公告|汇率|收益率|股价|盘中|收盘|开盘|latest|today|current|real[-\s]?time|price|quote|news)/i;
const HISTORY_REQUEST = /(?:上次|之前|以前|过去|曾经|我们(?:聊|谈|讨论)|我(?:说过|提过|问过|提到)|还记得|记得.{0,12}(?:吗|什么)|历史(?:对话|记录)|earlier|previous|last time|we discussed|remember (?:what|when))/i;
const HISTORY_STOPWORDS = new Set([
  "上次", "之前", "以前", "过去", "曾经", "我们", "聊过", "聊的", "说过", "提过", "问过",
  "什么", "哪些", "我的", "了吗", "多少", "那次", "时候", "有关", "关于", "记得", "回忆",
  "历史", "对话", "记录", "讨论", "内容", "一下", "告诉", "previous", "earlier",
  "about", "remember", "discussed", "conversation",
]);
const PRIVATE_BLOCK = /<private>[\s\S]*?<\/private>/i;
const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 529]);
const TYPESAFE_MEMORY_TIMEOUT_MS = 4_000;

export type AutomaticMemoryCandidate = {
  kind: "core" | "daily";
  memoryKey: string;
  content: string;
  confidence: number;
  evidence: string;
};

type SemanticMemoryJudgment = {
  worthKeeping: number;
  category: "preference" | "goal" | "research_theme" | "none";
  confidence: number | null;
  evaluatedBy: "typesafe" | "deterministic";
};

function normalizedMemoryText(value: string) {
  return value
    .replace(/<private>[\s\S]*?<\/private>/gi, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function memorySafe(value: string, minLength = 3) {
  if (PRIVATE_BLOCK.test(value)) return null;
  const clean = normalizedMemoryText(value).slice(0, 560);
  return clean.length >= minLength && !SENSITIVE.test(clean) && !SENSITIVE_VALUE.test(clean)
    && !DIRECTIVE.test(clean) ? clean : null;
}

export type UcheerMemoryIndexEntry = {
  id: string;
  kind: "memory" | "message";
  conversationId: string | null;
  role: "user" | "assistant" | null;
  createdAt: Date;
  preview: string;
  score: number;
  tokenEstimate: number;
};

export type UcheerMemoryDetail = {
  id: string;
  kind: "memory" | "message";
  conversationId: string | null;
  role: "user" | "assistant" | null;
  content: string;
  createdAt: Date;
  tokenEstimate: number;
};

function addCandidate(
  target: AutomaticMemoryCandidate[],
  candidate: Omit<AutomaticMemoryCandidate, "content" | "evidence"> & { content: string; evidence?: string },
) {
  const content = memorySafe(candidate.content);
  const evidence = memorySafe(candidate.evidence ?? candidate.content, 5);
  if (!content || !evidence) return;
  // Daily memories are research themes, not a cache for moving market facts.
  // Core preferences/goals may legitimately mention a user's preferred
  // recency, but a volatile daily statement must never become durable context.
  if ((candidate.kind === "daily" || candidate.memoryKey.startsWith("research.")) && VOLATILE.test(content)) return;
  if (target.some(item => item.memoryKey === candidate.memoryKey)) return;
  target.push({ ...candidate, content, evidence });
}

function deterministicMemoryJudgment(text: string, candidates: AutomaticMemoryCandidate[]): SemanticMemoryJudgment {
  if (!candidates.length && !/(?:偏好|喜欢|习惯|目标|计划|长期|持续|研究|跟踪|关注|策略|组合|风险)/i.test(text)) {
    return { worthKeeping: 0.08, category: "none", confidence: null, evaluatedBy: "deterministic" };
  }
  const first = candidates[0];
  if (first?.memoryKey.startsWith("preference.")) {
    return { worthKeeping: 0.92, category: "preference", confidence: 0.9, evaluatedBy: "deterministic" };
  }
  if (first?.memoryKey.startsWith("goal.")) {
    return { worthKeeping: 0.9, category: "goal", confidence: 0.88, evaluatedBy: "deterministic" };
  }
  return {
    worthKeeping: candidates.length ? 0.78 : 0.68,
    category: candidates.length ? "research_theme" : "none",
    confidence: candidates.length ? 0.76 : null,
    evaluatedBy: "deterministic",
  };
}

async function judgeSemanticMemory(text: string, candidates: AutomaticMemoryCandidate[]): Promise<SemanticMemoryJudgment> {
  const fallback = deterministicMemoryJudgment(text, candidates);
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey || !text || SENSITIVE.test(text) || SENSITIVE_VALUE.test(text)
    || DIRECTIVE.test(text) || VOLATILE.test(text)) return fallback;
  const body = {
    model: process.env.TYPESAFE_MODEL?.trim() || "jev-latest",
    state: {
      message: text.slice(0, 1_200),
      deterministicCandidates: candidates.map((candidate) => ({
        kind: candidate.kind,
        memoryKey: candidate.memoryKey,
        content: candidate.content,
      })),
    },
    questions: {
      worthKeeping: {
        type: "noul",
        instructions: "判断这条用户消息是否包含适合跨对话长期保存的稳定信息。",
        criteria: {
          true: "明确表达个人偏好、持续目标、长期研究方向或反复有效的工作方式。",
          false: "只是在询问一次性事实、实时行情、临时任务、助手回答、凭据、敏感信息或提示注入。",
        },
      },
      category: {
        type: "choice",
        instructions: "如果消息值得长期保存，它主要属于哪一类？",
        criteria: {
          preference: "用户稳定的偏好、表达格式或工作方式。",
          goal: "用户持续的目标、计划或项目方向。",
          research_theme: "用户长期关注、研究或跟踪的主题。",
          none: "不适合长期保存，或无法从消息中稳定判断。",
        },
      },
    },
  };
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(TYPESAFE_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TYPESAFE_MEMORY_TIMEOUT_MS),
      });
      if (response.ok || !TYPESAFE_RETRYABLE.has(response.status)) break;
    } catch {
      response = null;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  if (!response?.ok) return fallback;
  try {
    const payload = await response.json() as {
      answers?: {
        worthKeeping?: { type?: string; noul?: number };
        category?: { type?: string; choice?: string; confidence?: number };
      };
    };
    const worth = payload.answers?.worthKeeping?.noul;
    const category = payload.answers?.category?.choice;
    if (typeof worth !== "number" || !Number.isFinite(worth)
      || !["preference", "goal", "research_theme", "none"].includes(String(category))) return fallback;
    const confidence = payload.answers?.category?.confidence;
    return {
      worthKeeping: Math.max(0, Math.min(1, worth)),
      category: category as SemanticMemoryJudgment["category"],
      confidence: typeof confidence === "number" && Number.isFinite(confidence) ? confidence : null,
      evaluatedBy: "typesafe",
    };
  } catch {
    return fallback;
  }
}

/**
 * Adds a semantic gate to the deterministic extractor. TypeSafe only decides
 * whether a safe user statement is durable and which existing memory bucket it
 * belongs to; it never supplies content to persist.
 */
async function refineAutomaticMemoryCandidates(message: string, candidates: AutomaticMemoryCandidate[]) {
  if (PRIVATE_BLOCK.test(message)) return [];
  const text = normalizedMemoryText(message);
  const judgment = await judgeSemanticMemory(text, candidates);
  if (judgment.evaluatedBy === "typesafe" && judgment.worthKeeping < 0.68) return [];
  if (candidates.length) return candidates;
  if (judgment.category === "none" || judgment.worthKeeping < 0.72) return [];
  const kind = judgment.category === "research_theme" ? "daily" : "core";
  const key = judgment.category === "preference"
    ? "preference.semantic"
    : judgment.category === "goal"
      ? "goal.semantic"
      : `topic.${createHash("sha256").update(text.toLowerCase()).digest("hex").slice(0, 16)}`;
  const label = judgment.category === "preference"
    ? "用户偏好"
    : judgment.category === "goal"
      ? "用户持续目标"
      : "用户近期研究主题";
  const generated: AutomaticMemoryCandidate[] = [];
  addCandidate(generated, {
    kind,
    memoryKey: key,
    content: `${label}：${text.slice(0, 220)}`,
    confidence: Math.min(0.9, Math.max(0.68, judgment.confidence ?? judgment.worthKeeping)),
    evidence: text,
  });
  return generated;
}

/**
 * Extracts durable facts from the user's own message without requiring a
 * command such as “请记住”. Volatile market questions are deliberately
 * excluded; only preferences, ongoing goals and recurring research interests
 * become memory.
 */
export function automaticMemoryCandidates(message: string): AutomaticMemoryCandidate[] {
  if (PRIVATE_BLOCK.test(message)) return [];
  const text = normalizedMemoryText(message);
  if (!text || SENSITIVE.test(text) || SENSITIVE_VALUE.test(text) || DIRECTIVE.test(text)) return [];
  const candidates: AutomaticMemoryCandidate[] = [];
  const language = text.match(/(?:我|请)?(?:默认|习惯|偏好|希望|以后(?:回答|交流)(?:时)?(?:请)?)(?:用|使用)\s*(中文|简体中文|繁体中文|英文|英语)/i);
  if (language) {
    addCandidate(candidates, {
      kind: "core",
      memoryKey: "preference.language",
      content: `用户偏好使用${language[1]}交流。`,
      confidence: 0.96,
      evidence: text,
    });
  }
  const format = text.match(/(?:我|请)?(?:默认|习惯|偏好|希望|以后(?:回答|交流)(?:时)?(?:请)?)(?:用|采用|保持)?\s*(简洁|详细|专业|表格|要点|先给结论|先说结论)/i)
    ?? text.match(/(先给结论|先说结论|列出风险因素|重点列出风险)/i);
  if (format) {
    addCandidate(candidates, {
      kind: "core",
      memoryKey: "preference.response_format",
      content: `用户偏好${format[1]}的回答方式。`,
      confidence: 0.9,
      evidence: text,
    });
  }
  const preference = text.match(/(?:我|本人)(?:比较|更)?(?:喜欢|偏好|习惯|倾向于|希望)\s*(.{3,100})/);
  if (preference && !language && !format) {
    addCandidate(candidates, {
      kind: "core",
      memoryKey: "preference.general",
      content: `用户偏好：${preference[1]}`,
      confidence: 0.86,
      evidence: text,
    });
  }
  const goal = text.match(/(?:我的|目前的|长期的)?(?:目标|计划|项目|研究方向|工作重点)(?:是|为|包括)?\s*(.{4,140})/)
    // Stable product/project intent is durable even when the user does not
    // use the word “目标”. Keep this narrow so “我想查一条新闻” is not
    // accidentally promoted to long-term memory.
    ?? text.match(/(?:我|我们)(?:想|要|希望|正在|计划)\s*(?:打造|建设|开发|完善|建立|做成)\s*(.{4,140}(?:平台|系统|终端|产品|工作流))/i);
  if (goal) {
    addCandidate(candidates, {
      kind: "core",
      memoryKey: "goal.primary",
      content: `用户持续目标：${goal[1]}`,
      confidence: 0.86,
      evidence: text,
    });
  }
  const focus = text.match(/(?:我|本人)(?:长期|持续|重点|主要)(?:关注|研究|跟踪|配置)\s*(.{3,120})/);
  if (focus) {
    addCandidate(candidates, {
      kind: "core",
      memoryKey: "research.focus",
      content: `用户长期关注：${focus[1]}`,
      confidence: 0.84,
      evidence: text,
    });
  }
  const explicit = explicitMemoryCandidate(text);
  if (explicit && !candidates.some(item => item.content === explicit)) {
    addCandidate(candidates, {
      kind: "core",
      memoryKey: "preference.explicit",
      content: explicit,
      confidence: 0.92,
      evidence: text,
    });
  }
  if (!candidates.length && text.length >= 18 && !VOLATILE.test(text)
    && /(?:研究|分析|比较|跟踪|组合|风险|行业|市场结构|投资框架|策略)/i.test(text)) {
    addCandidate(candidates, {
      kind: "daily",
      memoryKey: `topic.${createHash("sha256").update(text.toLowerCase()).digest("hex").slice(0, 16)}`,
      content: `用户近期研究主题：${text.slice(0, 220)}`,
      confidence: 0.72,
      evidence: text,
    });
  }
  return candidates;
}

/** Only explicit durable user preferences become core memory, never model output or market quotes. */
export function explicitMemoryCandidate(message: string): string | null {
  const match = message.trim().match(/^(?:请|帮我)?记住[：:\s]*(.+)$/s)
    ?? message.trim().match(/^(?:以后|今后)(?:回答|和我交流)(?:时|都)?[，,：:\s]*(.+)$/s);
  if (!match) return null;
  const content = match[1].replace(/\s+/g, " ").trim().slice(0, 320);
  return content.length >= 3 && !SENSITIVE.test(content) && !SENSITIVE_VALUE.test(content)
    && !DIRECTIVE.test(content) ? content : null;
}

function safeSummary(value: string) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 540);
  return clean.length >= 8 && !SENSITIVE.test(clean) && !SENSITIVE_VALUE.test(clean)
    && !DIRECTIVE.test(clean) && !VOLATILE.test(clean) ? clean : null;
}

/**
 * The model may nominate a verbatim span, but it cannot author a memory.
 * Only an extractable, stable assertion from the user's own words is stored.
 * One-off questions and moving market observations remain in chat history.
 */
export function validatedDistillationCandidate(
  supportingQuote: string,
  userStatements: string[],
): AutomaticMemoryCandidate | null {
  const quote = safeSummary(supportingQuote);
  if (!quote || !userStatements.some(statement =>
    !SENSITIVE.test(statement) && !SENSITIVE_VALUE.test(statement) && !DIRECTIVE.test(statement)
    && normalizedMemoryText(statement).toLowerCase().includes(normalizedMemoryText(quote).toLowerCase()))) return null;
  const candidate = automaticMemoryCandidates(quote)
    .find(item => item.kind === "core" && /^(?:preference\.|goal\.|research\.focus)/.test(item.memoryKey));
  return candidate ? { ...candidate, evidence: quote } : null;
}

async function ownedConversation(db: Database, userId: number, conversationId: string) {
  const [row] = await db.select().from(ucheerAiConversations)
    .where(and(eq(ucheerAiConversations.id, conversationId), eq(ucheerAiConversations.userId, userId))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "对话不存在或不可访问。" });
  return row;
}

export async function prepareUcheerTurn(userId: number, conversationId: string | undefined, userMessage: string) {
  const db = await memoryDb();
  let id = conversationId;
  if (id) await ownedConversation(db, userId, id);
  else {
    id = randomUUID();
    await db.insert(ucheerAiConversations).values({
      id, userId, title: userMessage.trim().slice(0, 70) || "新对话",
    });
  }
  const history = await db.select({ role: ucheerAiMessages.role, content: ucheerAiMessages.content })
    .from(ucheerAiMessages)
    .where(and(eq(ucheerAiMessages.userId, userId), eq(ucheerAiMessages.conversationId, id)))
    .orderBy(desc(ucheerAiMessages.id)).limit(30);
  const [earliestRecent] = await db.select({ id: ucheerAiMessages.id })
    .from(ucheerAiMessages)
    .where(and(eq(ucheerAiMessages.userId, userId), eq(ucheerAiMessages.conversationId, id)))
    .orderBy(desc(ucheerAiMessages.id)).limit(1).offset(29);
  const earlierUserMessages = earliestRecent
    ? await db.select({ content: ucheerAiMessages.content })
      .from(ucheerAiMessages).where(and(
        eq(ucheerAiMessages.userId, userId),
        eq(ucheerAiMessages.conversationId, id),
        eq(ucheerAiMessages.role, "user"),
        lt(ucheerAiMessages.id, earliestRecent.id),
      )).orderBy(desc(ucheerAiMessages.id)).limit(150)
    : [];
  const memories = await db.select({ kind: ucheerAiMemories.kind, content: ucheerAiMemories.content })
    .from(ucheerAiMemories).where(and(eq(ucheerAiMemories.userId, userId), eq(ucheerAiMemories.status, "active")))
    .orderBy(desc(ucheerAiMemories.updatedAt)).limit(30);
  const recallAnchors = historyRecallRequested(userMessage) ? historicalRecallTokens(userMessage) : null;
  let crossConversationMessages: Array<{ content: string; createdAt: Date }> = [];
  if (recallAnchors) {
    try {
      // Progressive disclosure: index first, then fetch details only for the
      // best message IDs. This replaces the old broad 80-row history scan.
      const index = await searchUcheerMemoryIndex(userId, userMessage, 18);
      const messageIds = index
        .filter(item => item.kind === "message" && item.conversationId !== id)
        .slice(0, 8)
        .map(item => ({ kind: "message" as const, id: Number(item.id.slice("message:".length)) }))
        .filter(item => Number.isSafeInteger(item.id) && item.id > 0);
      const details = await getUcheerMemoryDetails(userId, messageIds);
      crossConversationMessages = details
        .filter(item => item.kind === "message" && item.role === "user" && item.conversationId !== id)
        .map(item => ({ content: item.content, createdAt: item.createdAt }));
    } catch {
      // Search is an optimization. Existing owned-row retrieval remains the
      // safe fallback if an older deployment lacks one of the index fields.
      crossConversationMessages = await db.select({ content: ucheerAiMessages.content, createdAt: ucheerAiMessages.createdAt })
        .from(ucheerAiMessages)
        .where(and(
          eq(ucheerAiMessages.userId, userId),
          eq(ucheerAiMessages.role, "user"),
          ne(ucheerAiMessages.conversationId, id),
          recallAnchors.length
            ? or(...recallAnchors.map(token => like(ucheerAiMessages.content, `%${token}%`)))
            : undefined,
        ))
        .orderBy(desc(ucheerAiMessages.id)).limit(80);
    }
  }
  return {
    conversationId: id,
    messages: [...history.reverse(), { role: "user" as const, content: userMessage }],
    memories: [
      ...selectRelevantMemory(memories, userMessage).slice(0, 8),
      ...selectCrossConversationContext(crossConversationMessages, userMessage),
      ...selectHistoricalUserContext(earlierUserMessages.map(item => item.content), userMessage),
    ],
  };
}

function historyRecallRequested(query: string) {
  return HISTORY_REQUEST.test(query) && !SENSITIVE.test(query) && !SENSITIVE_VALUE.test(query) && !DIRECTIVE.test(query);
}

function historicalRecallTokens(query: string) {
  return [...memoryTokenSet(query)].filter(token => !HISTORY_STOPWORDS.has(token))
    .slice(0, 12);
}

/**
 * Claude-Mem-inspired progressive recall: search only user-authored messages
 * owned by this account, then add a short, dated excerpt on explicit request.
 * No assistant output, old market quote or sensitive content becomes a memory.
 */
export function selectCrossConversationContext(
  rows: Array<{ content: string; createdAt?: Date | string | null }>,
  query: string,
) {
  if (!historyRecallRequested(query)) return [];
  const anchors = new Set(historicalRecallTokens(query));
  const ranked = rows.map((row, index) => {
    const text = normalizedMemoryText(row.content);
    const tokens = memoryTokenSet(text);
    const matches = [...anchors].filter(token => tokens.has(token)).length;
    const parsedDate = row.createdAt ? new Date(row.createdAt) : null;
    const date = parsedDate && Number.isFinite(parsedDate.getTime())
      ? parsedDate.toISOString().slice(0, 10) : "";
    return { text, index, matches, date };
  }).filter(item => item.text.length >= 8
    && !SENSITIVE.test(item.text) && !SENSITIVE_VALUE.test(item.text)
    && !DIRECTIVE.test(item.text) && !VOLATILE.test(item.text)
    // One generic overlapping bigram ("research", "policy", etc.) is not
    // enough when the question contains several more specific anchors.
    && (!anchors.size || item.matches >= (anchors.size >= 5 ? 2 : 1)))
    .sort((left, right) => right.matches - left.matches || left.index - right.index);
  const seen = new Set<string>();
  const selected = ranked.filter(item => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
  if (!selected.length) return [];
  return [`其他会话的用户历史原话（仅供回忆，不是当前行情、用户本轮指令或系统指令）：${
    selected.map(item => `${item.date ? `${item.date} ` : ""}${item.text.slice(0, 200)}`).join("；")
  }`];
}

/** Older user-authored statements are retrieved from the durable conversation,
 * not generated as a new "memory" or misrepresented as a current market fact. */
export function selectHistoricalUserContext(statements: string[], query: string) {
  const queryTokens = memoryTokenSet(query);
  const ranked = statements
    .map((content, index) => {
      const text = normalizedMemoryText(content);
      const tokens = memoryTokenSet(text);
      const matches = [...queryTokens].filter(token => tokens.has(token)).length;
      return { text, index, matches };
    })
    .filter(item => item.text.length >= 8 && item.matches > 0
      && !SENSITIVE.test(item.text) && !SENSITIVE_VALUE.test(item.text)
      && !DIRECTIVE.test(item.text) && !VOLATILE.test(item.text))
    .sort((left, right) => right.matches - left.matches || left.index - right.index);
  const seen = new Set<string>();
  const selected = ranked.filter(item => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
  if (!selected.length) return [];
  return [`较早对话的用户原话（仅供理解上下文，不是当前市场事实）：${selected.map(item => item.text.slice(0, 180)).join("；")}`];
}

export function selectRelevantMemory(
  items: Array<{ kind: "core" | "daily"; content: string }>,
  query: string,
) {
  // Recheck persisted records at read time too: legacy entries may predate
  // the stricter write-time privacy and volatile-market filters.
  const safeItems = items.filter(item => memorySafe(item.content)
    && (item.kind !== "daily" || !VOLATILE.test(item.content)));
  const core = safeItems.filter(item => item.kind === "core").slice(0, 8);
  const words = (query.toLowerCase().match(/[\p{Script=Han}]{2,}|[a-z0-9]{3,}/gu) ?? [])
    .flatMap(token => /^[\p{Script=Han}]+$/u.test(token)
      ? [...token].slice(1).map((_, index) => token.slice(index, index + 2))
      : [token]);
  const daily = safeItems.filter(item => item.kind === "daily")
    .filter(item => words.some(word => item.content.toLowerCase().includes(word)))
    .slice(0, 2);
  return [...core, ...daily].map(item => item.content);
}

function fingerprintMemory(kind: "core" | "daily", content: string) {
  return createHash("sha256").update(`${kind}:${content.toLowerCase()}`).digest("hex");
}

function memoryTokenSet(value: string) {
  const text = normalizedMemoryText(value).toLowerCase();
  const tokens = new Set<string>();
  for (const segment of text.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (segment.length < 2) tokens.add(segment);
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.add(segment.slice(index, index + 2));
    }
  }
  for (const word of text.match(/[a-z0-9]{3,}/gu) ?? []) tokens.add(word);
  return tokens;
}

function memorySearchTokens(query: string) {
  return [...memoryTokenSet(query)]
    .filter(token => !HISTORY_STOPWORDS.has(token))
    .slice(0, 10);
}

/**
 * Claude-Mem-inspired first layer: return a compact, token-budgeted index.
 * Full message text is intentionally not returned from this layer.
 */
export function rankUcheerMemoryIndex(
  rows: Array<{
    id: string;
    kind: "memory" | "message";
    conversationId: string | null;
    role: "user" | "assistant" | null;
    content: string;
    createdAt: Date;
  }>,
  query: string,
  limit = 12,
): UcheerMemoryIndexEntry[] {
  const anchors = memorySearchTokens(query);
  if (!anchors.length) return [];
  return rows.map((row, index) => {
    const text = normalizedMemoryText(row.content);
    const tokens = memoryTokenSet(text);
    const matches = anchors.filter(token => tokens.has(token)).length;
    const exactBoost = text.toLowerCase().includes(normalizedMemoryText(query).toLowerCase()) ? 4 : 0;
    const kindBoost = row.kind === "memory" ? 2 : 0;
    const score = matches * 2 + exactBoost + kindBoost;
    return {
      id: row.id,
      kind: row.kind,
      conversationId: row.conversationId,
      role: row.role,
      createdAt: row.createdAt,
      preview: text.slice(0, 180),
      score,
      tokenEstimate: Math.max(1, Math.ceil(text.length / 4)),
      _index: index,
      _matches: matches,
    };
  })
    .filter(row => row._matches > 0 && row.preview.length >= 8
      && !SENSITIVE.test(row.preview) && !SENSITIVE_VALUE.test(row.preview)
      && !DIRECTIVE.test(row.preview) && !VOLATILE.test(row.preview))
    .sort((left, right) => right.score - left.score
      || right.createdAt.getTime() - left.createdAt.getTime()
      || left._index - right._index)
    .slice(0, Math.max(1, Math.min(30, limit)))
    .map(({ _index: _ignoredIndex, _matches: _ignoredMatches, ...entry }) => entry);
}

/**
 * Search layer for authenticated Ucheer users. It searches only their own
 * active memories and user-authored messages, then returns compact index rows.
 */
export async function searchUcheerMemoryIndex(userId: number, query: string, limit = 12) {
  const db = await memoryDb();
  const anchors = memorySearchTokens(query);
  if (!anchors.length) return [];
  const textPredicate = or(...anchors.map(token => like(ucheerAiMemories.content, `%${token}%`)));
  const messagePredicate = or(...anchors.map(token => like(ucheerAiMessages.content, `%${token}%`)));
  const [memoryRows, messageRows] = await Promise.all([
    db.select({
      id: ucheerAiMemories.id,
      conversationId: sql<string | null>`NULL`,
      role: sql<"user" | "assistant" | null>`NULL`,
      content: ucheerAiMemories.content,
      createdAt: ucheerAiMemories.updatedAt,
    }).from(ucheerAiMemories).where(and(
      eq(ucheerAiMemories.userId, userId),
      eq(ucheerAiMemories.status, "active"),
      textPredicate,
    )).orderBy(desc(ucheerAiMemories.updatedAt)).limit(100),
    db.select({
      id: ucheerAiMessages.id,
      conversationId: ucheerAiMessages.conversationId,
      role: ucheerAiMessages.role,
      content: ucheerAiMessages.content,
      createdAt: ucheerAiMessages.createdAt,
    }).from(ucheerAiMessages).where(and(
      eq(ucheerAiMessages.userId, userId),
      eq(ucheerAiMessages.role, "user"),
      messagePredicate,
    )).orderBy(desc(ucheerAiMessages.id)).limit(240),
  ]);
  const rows = [
    ...memoryRows.map(row => ({ ...row, id: `memory:${row.id}`, kind: "memory" as const })),
    ...messageRows.map(row => ({ ...row, id: `message:${row.id}`, kind: "message" as const })),
  ];
  return rankUcheerMemoryIndex(rows, query, limit);
}

/**
 * Detail layer: fetch only IDs selected by the compact index. This keeps
 * private conversation text out of broad search responses and limits tokens.
 */
export async function getUcheerMemoryDetails(
  userId: number,
  ids: Array<{ kind: "memory" | "message"; id: number }>,
) {
  const db = await memoryDb();
  const memoryIds = [...new Set(ids.filter(item => item.kind === "memory").map(item => item.id))];
  const messageIds = [...new Set(ids.filter(item => item.kind === "message").map(item => item.id))];
  const [memoryRows, messageRows] = await Promise.all([
    memoryIds.length
      ? db.select({
        id: ucheerAiMemories.id,
        content: ucheerAiMemories.content,
        createdAt: ucheerAiMemories.updatedAt,
      }).from(ucheerAiMemories).where(and(
        eq(ucheerAiMemories.userId, userId),
        eq(ucheerAiMemories.status, "active"),
        inArray(ucheerAiMemories.id, memoryIds),
      ))
      : Promise.resolve([]),
    messageIds.length
      ? db.select({
        id: ucheerAiMessages.id,
        conversationId: ucheerAiMessages.conversationId,
        role: ucheerAiMessages.role,
        content: ucheerAiMessages.content,
        createdAt: ucheerAiMessages.createdAt,
      }).from(ucheerAiMessages).where(and(
        eq(ucheerAiMessages.userId, userId),
        inArray(ucheerAiMessages.id, messageIds),
      ))
      : Promise.resolve([]),
  ]);
  const details: UcheerMemoryDetail[] = [
    ...memoryRows.filter(row => memorySafe(row.content)).map(row => ({
      id: `memory:${row.id}`,
      kind: "memory" as const,
      conversationId: null,
      role: null,
      content: normalizedMemoryText(row.content),
      createdAt: row.createdAt,
      tokenEstimate: Math.max(1, Math.ceil(row.content.length / 4)),
    })),
    ...messageRows.filter(row => memorySafe(row.content)).map(row => ({
      id: `message:${row.id}`,
      kind: "message" as const,
      conversationId: row.conversationId,
      role: row.role,
      content: normalizedMemoryText(row.content),
      createdAt: row.createdAt,
      tokenEstimate: Math.max(1, Math.ceil(row.content.length / 4)),
    })),
  ];
  const order = new Map(ids.map((item, index) => [`${item.kind}:${item.id}`, index]));
  return details.sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER)
    - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Timeline layer: after a message is selected, fetch only nearby turns in
 * the same owned conversation to restore temporal context.
 */
export async function getUcheerMemoryTimeline(userId: number, messageId: number, before = 3, after = 3) {
  const db = await memoryDb();
  const [anchor] = await db.select({
    id: ucheerAiMessages.id,
    conversationId: ucheerAiMessages.conversationId,
    role: ucheerAiMessages.role,
    content: ucheerAiMessages.content,
    createdAt: ucheerAiMessages.createdAt,
  }).from(ucheerAiMessages).where(and(
    eq(ucheerAiMessages.id, messageId),
    eq(ucheerAiMessages.userId, userId),
  )).limit(1);
  if (!anchor) throw new TRPCError({ code: "NOT_FOUND", message: "记忆节点不存在或不可访问。" });
  const [older, newer] = await Promise.all([
    db.select({
      id: ucheerAiMessages.id,
      conversationId: ucheerAiMessages.conversationId,
      role: ucheerAiMessages.role,
      content: ucheerAiMessages.content,
      createdAt: ucheerAiMessages.createdAt,
    }).from(ucheerAiMessages).where(and(
      eq(ucheerAiMessages.userId, userId),
      eq(ucheerAiMessages.conversationId, anchor.conversationId),
      lt(ucheerAiMessages.id, anchor.id),
    )).orderBy(desc(ucheerAiMessages.id)).limit(Math.max(0, Math.min(8, before))),
    db.select({
      id: ucheerAiMessages.id,
      conversationId: ucheerAiMessages.conversationId,
      role: ucheerAiMessages.role,
      content: ucheerAiMessages.content,
      createdAt: ucheerAiMessages.createdAt,
    }).from(ucheerAiMessages).where(and(
      eq(ucheerAiMessages.userId, userId),
      eq(ucheerAiMessages.conversationId, anchor.conversationId),
      gt(ucheerAiMessages.id, anchor.id),
    )).orderBy(asc(ucheerAiMessages.id)).limit(Math.max(0, Math.min(8, after))),
  ]);
  return [...older.reverse(), anchor, ...newer].filter(row => memorySafe(row.content)).map(row => ({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: normalizedMemoryText(row.content),
    createdAt: row.createdAt,
  }));
}

function memorySimilarity(left: string, right: string) {
  const a = memoryTokenSet(left);
  const b = memoryTokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  const containment = intersection / Math.min(a.size, b.size);
  return Math.max(intersection / union, containment);
}

async function upsertMemory(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  userId: number,
  candidate: AutomaticMemoryCandidate,
  lastSeenMessageId: number,
) {
  const fingerprint = fingerprintMemory(candidate.kind, candidate.content);
  const [existing] = await tx.select({ id: ucheerAiMemories.id })
    .from(ucheerAiMemories)
    .where(and(
      eq(ucheerAiMemories.userId, userId),
      eq(ucheerAiMemories.memoryKey, candidate.memoryKey),
      eq(ucheerAiMemories.status, "active"),
    ))
    .limit(1);
  if (existing) {
    await tx.update(ucheerAiMemories).set({
      content: candidate.content,
      fingerprint,
      confidence: candidate.confidence.toFixed(2),
      evidence: candidate.evidence,
      lastSeenMessageId,
      updatedAt: new Date(),
    }).where(and(eq(ucheerAiMemories.id, existing.id), eq(ucheerAiMemories.userId, userId)));
    return { id: existing.id, updated: true };
  }
  if (candidate.kind === "daily") {
    const recent = await tx.select({
      id: ucheerAiMemories.id,
      content: ucheerAiMemories.content,
    }).from(ucheerAiMemories).where(and(
      eq(ucheerAiMemories.userId, userId),
      eq(ucheerAiMemories.kind, "daily"),
      eq(ucheerAiMemories.status, "active"),
    )).orderBy(desc(ucheerAiMemories.updatedAt)).limit(100);
    const similar = recent.find(item => memorySimilarity(item.content, candidate.content) >= 0.72);
    if (similar) {
      await tx.update(ucheerAiMemories).set({
        content: candidate.content,
        fingerprint,
        confidence: candidate.confidence.toFixed(2),
        evidence: candidate.evidence,
        lastSeenMessageId,
        updatedAt: new Date(),
      }).where(and(eq(ucheerAiMemories.id, similar.id), eq(ucheerAiMemories.userId, userId)));
      return { id: similar.id, updated: true };
    }
  }
  if (candidate.kind === "core" && candidate.memoryKey.startsWith("preference.")) {
    const generic = await tx.select({ id: ucheerAiMemories.id })
      .from(ucheerAiMemories)
      .where(and(
        eq(ucheerAiMemories.userId, userId),
        eq(ucheerAiMemories.memoryKey, "preference.general"),
        eq(ucheerAiMemories.status, "active"),
      ))
      .limit(10);
    if (generic.length) {
      await tx.update(ucheerAiMemories).set({ status: "superseded", updatedAt: new Date() })
        .where(and(eq(ucheerAiMemories.userId, userId), eq(ucheerAiMemories.memoryKey, "preference.general")));
    }
  }
  const [row] = await tx.insert(ucheerAiMemories).values({
    userId,
    kind: candidate.kind,
    content: candidate.content,
    fingerprint,
    memoryKey: candidate.memoryKey,
    confidence: candidate.confidence.toFixed(2),
    evidence: candidate.evidence,
    status: "active",
    lastSeenMessageId,
  }).$returningId();
  return { id: row.id, updated: false };
}

async function appendEvolutionEvent(
  dbOrTx: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
  values: {
    userId: number;
    conversationId?: string;
    eventType: "memory_captured" | "distillation_completed" | "distillation_failed" | "feedback_recorded";
    status: "completed" | "failed" | "skipped";
    processedMessageId?: number;
    detail?: string;
  },
) {
  await dbOrTx.insert(ucheerAiEvolutionEvents).values({
    userId: values.userId,
    conversationId: values.conversationId,
    eventType: values.eventType,
    status: values.status,
    processedMessageId: values.processedMessageId,
    detail: (values.detail ?? "").slice(0, 500),
  });
}

function fallbackDistillationCandidate(userStatements: string[]) {
  const candidates = userStatements
    .flatMap((statement) => automaticMemoryCandidates(statement))
    .filter((candidate, index, all) =>
      all.findIndex((other) => other.memoryKey === candidate.memoryKey && other.content === candidate.content) === index
    );
  // Prefer a durable preference/goal over a short-lived research theme. The
  // extractor already excludes volatile facts, credentials, and directives.
  return candidates.find((candidate) => candidate.kind === "core") ?? candidates[0] ?? null;
}

async function markDistillationSkipped(
  db: Database,
  input: {
    userId: number;
    conversationId: string;
    attemptedThrough: number;
    detail: string;
  },
) {
  await db.update(ucheerAiConversations).set({
    lastSummarizedMessageId: input.attemptedThrough,
    lastDistillStatus: "completed",
    lastDistillAt: new Date(),
    lastDistillError: null,
  }).where(and(
    eq(ucheerAiConversations.id, input.conversationId),
    eq(ucheerAiConversations.userId, input.userId),
  ));
  await appendEvolutionEvent(db, {
    userId: input.userId,
    conversationId: input.conversationId,
    eventType: "distillation_completed",
    status: "skipped",
    processedMessageId: input.attemptedThrough,
    detail: input.detail,
  });
}

async function persistDistillationCandidate(
  db: Database,
  input: {
    userId: number;
    conversationId: string;
    attemptedThrough: number;
    previousSummaryMessageId: number;
    candidate: AutomaticMemoryCandidate;
    detail: string;
  },
) {
  await db.transaction(async tx => {
    await upsertMemory(tx, input.userId, input.candidate, input.attemptedThrough);
    await tx.update(ucheerAiConversations).set({
      lastSummarizedMessageId: input.attemptedThrough,
      lastDistillStatus: "completed",
      lastDistillAt: new Date(),
      lastDistillError: null,
    }).where(and(
      eq(ucheerAiConversations.id, input.conversationId),
      eq(ucheerAiConversations.userId, input.userId),
      eq(ucheerAiConversations.lastSummarizedMessageId, input.previousSummaryMessageId),
    ));
    await appendEvolutionEvent(tx, {
      userId: input.userId,
      conversationId: input.conversationId,
      eventType: "distillation_completed",
      status: "completed",
      processedMessageId: input.attemptedThrough,
      detail: input.detail,
    });
  });
}

export async function saveUcheerTurn(userId: number, conversationId: string, userMessage: string, answer: string) {
  const db = await memoryDb();
  await ownedConversation(db, userId, conversationId);
  const candidates = await refineAutomaticMemoryCandidates(userMessage, automaticMemoryCandidates(userMessage));
  const messageId = await db.transaction(async tx => {
    await tx.insert(ucheerAiMessages).values({ userId, conversationId, role: "user", content: userMessage });
    const [row] = await tx.insert(ucheerAiMessages)
      .values({ userId, conversationId, role: "assistant", content: answer }).$returningId();
    await tx.update(ucheerAiConversations).set({
      updatedAt: new Date(),
      lastDistillStatus: "pending",
      lastDistillError: null,
    })
      .where(and(eq(ucheerAiConversations.id, conversationId), eq(ucheerAiConversations.userId, userId)));
    for (const candidate of candidates) {
      const stored = await upsertMemory(tx, userId, candidate, row.id);
      await appendEvolutionEvent(tx, {
        userId,
        conversationId,
        eventType: "memory_captured",
        status: "completed",
        processedMessageId: row.id,
        detail: `${candidate.kind}:${candidate.memoryKey}:${stored.updated ? "updated" : "created"}`,
      });
    }
    return row.id;
  });
  return messageId;
}

// CowAgent's daily distillation pattern, bounded to a user's own historical
// statements. No unattended code edits, trading actions or new model weights.
export async function distillUcheerConversation(userId: number, conversationId: string) {
  const db = await memoryDb();
  const conversation = await ownedConversation(db, userId, conversationId);
  const unseen = await db.select({ id: ucheerAiMessages.id, role: ucheerAiMessages.role, content: ucheerAiMessages.content })
    .from(ucheerAiMessages)
    .where(and(eq(ucheerAiMessages.userId, userId), eq(ucheerAiMessages.conversationId, conversationId),
      gt(ucheerAiMessages.id, conversation.lastSummarizedMessageId)))
    .orderBy(desc(ucheerAiMessages.id)).limit(24);
  if (!unseen.length || unseen[0].id <= conversation.lastDistillAttemptedMessageId) return false;
  if (unseen.length < 8) return false; // at least four completed turns
  const userStatements = unseen.filter(item => item.role === "user").reverse().map(item => item.content.slice(0, 500));
  if (userStatements.length < 4) return false;
  const safeStatements = userStatements.filter(item => !SENSITIVE.test(item)
    && !SENSITIVE_VALUE.test(item) && !DIRECTIVE.test(item));
  const attemptedThrough = unseen[0].id;
  await db.update(ucheerAiConversations).set({
    lastDistillStatus: "running",
    lastDistillAttemptedMessageId: attemptedThrough,
    lastDistillAt: new Date(),
    lastDistillError: null,
  }).where(and(
    eq(ucheerAiConversations.id, conversationId),
    eq(ucheerAiConversations.userId, userId),
    eq(ucheerAiConversations.lastDistillAttemptedMessageId, conversation.lastDistillAttemptedMessageId),
  ));
  if (!safeStatements.length) {
    await db.update(ucheerAiConversations).set({
      lastSummarizedMessageId: attemptedThrough,
      lastDistillStatus: "completed",
      lastDistillAt: new Date(),
    }).where(and(eq(ucheerAiConversations.id, conversationId), eq(ucheerAiConversations.userId, userId)));
    await appendEvolutionEvent(db, {
      userId, conversationId, eventType: "distillation_completed", status: "skipped",
      processedMessageId: attemptedThrough, detail: "没有可安全保存的用户陈述",
    });
    return false;
  }
  const candidateSchema = z.object({
    summary: z.string().max(540),
    supportingQuote: z.string().max(200),
    kind: z.enum(["core", "daily"]).default("daily"),
    memoryKey: z.string().max(120).default("research.summary"),
    confidence: z.number().min(0).max(1).default(0.72),
  });
  let raw: string | null = null;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "只根据用户原话提炼一条长期有用的偏好、持续目标或历史主题；不要将证券价格、市场动态、推测、助手回答或敏感凭据当作事实。没有值得记忆的内容时返回空 summary。输出严格 JSON：{\"summary\":\"...\",\"supportingQuote\":\"用户原文连续片段\",\"kind\":\"core|daily\",\"memoryKey\":\"稳定的记忆键\",\"confidence\":0.0}。" },
        { role: "user", content: JSON.stringify(safeStatements) },
      ],
      max_tokens: 320,
    });
    const content = response.choices?.[0]?.message?.content;
    raw = typeof content === "string" ? content : null;
  } catch (error) {
    const fallback = fallbackDistillationCandidate(safeStatements);
    if (fallback) {
      await persistDistillationCandidate(db, {
        userId,
        conversationId,
        attemptedThrough,
        previousSummaryMessageId: conversation.lastSummarizedMessageId,
        candidate: fallback,
        detail: `${fallback.kind}:${fallback.memoryKey}:verified-user-rule-fallback`,
      });
      return true;
    }
    await markDistillationSkipped(db, {
      userId,
      conversationId,
      attemptedThrough,
      detail: `模型整理不可用，安全规则未发现可保存内容：${String(error).slice(0, 180)}`,
    });
    return false;
  }
  if (!raw) {
    const fallback = fallbackDistillationCandidate(safeStatements);
    if (fallback) {
      await persistDistillationCandidate(db, {
        userId,
        conversationId,
        attemptedThrough,
        previousSummaryMessageId: conversation.lastSummarizedMessageId,
        candidate: fallback,
        detail: `${fallback.kind}:${fallback.memoryKey}:verified-user-rule-fallback`,
      });
      return true;
    }
    await markDistillationSkipped(db, {
      userId,
      conversationId,
      attemptedThrough,
      detail: "模型未返回可解析内容，安全规则未发现可保存内容",
    });
    return false;
  }
  let parsed: z.infer<typeof candidateSchema>;
  try { parsed = candidateSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""))); }
  catch {
    const fallback = fallbackDistillationCandidate(safeStatements);
    if (fallback) {
      await persistDistillationCandidate(db, {
        userId,
        conversationId,
        attemptedThrough,
        previousSummaryMessageId: conversation.lastSummarizedMessageId,
        candidate: fallback,
        detail: `${fallback.kind}:${fallback.memoryKey}:verified-user-rule-fallback`,
      });
      return true;
    }
    await markDistillationSkipped(db, {
      userId,
      conversationId,
      attemptedThrough,
      detail: "模型返回内容未通过结构校验，安全规则未发现可保存内容",
    });
    return false;
  }
  if (!parsed.summary.trim()) {
    await db.update(ucheerAiConversations).set({
      lastSummarizedMessageId: attemptedThrough,
      lastDistillStatus: "completed",
      lastDistillAt: new Date(),
    })
      .where(and(eq(ucheerAiConversations.id, conversationId), eq(ucheerAiConversations.userId, userId),
        eq(ucheerAiConversations.lastSummarizedMessageId, conversation.lastSummarizedMessageId)));
    await appendEvolutionEvent(db, {
      userId, conversationId, eventType: "distillation_completed", status: "skipped",
      processedMessageId: attemptedThrough, detail: "本轮没有值得长期保存的内容",
    });
    return false;
  }
  const candidate = parsed.summary.trim()
    ? validatedDistillationCandidate(parsed.supportingQuote, safeStatements)
    : null;
  if (!candidate) {
    await db.update(ucheerAiConversations).set({
      lastSummarizedMessageId: attemptedThrough,
      lastDistillStatus: "completed",
      lastDistillAt: new Date(),
      lastDistillError: null,
    }).where(and(eq(ucheerAiConversations.id, conversationId), eq(ucheerAiConversations.userId, userId)));
    await appendEvolutionEvent(db, {
      userId, conversationId, eventType: "distillation_completed", status: "skipped",
      processedMessageId: attemptedThrough, detail: "未找到可由用户原话验证的稳定记忆",
    });
    return false;
  }
  await persistDistillationCandidate(db, {
    userId,
    conversationId,
    attemptedThrough,
    previousSummaryMessageId: conversation.lastSummarizedMessageId,
    candidate,
    detail: `${candidate.kind}:${candidate.memoryKey}:verified-user-quote`,
  });
  return true;
}

/**
 * Persistent-worker entry point. It is intentionally bounded and database
 * backed: after a restart it resumes pending conversations, while failed work
 * is retried only after a newer user turn marks it pending again.
 */
export async function runUcheerMemoryMaintenance(limit = 8) {
  const db = await memoryDb();
  const staleBefore = new Date(Date.now() - 15 * 60_000);
  await db.update(ucheerAiConversations).set({
    lastDistillStatus: "pending",
    lastDistillError: null,
  }).where(and(
    eq(ucheerAiConversations.lastDistillStatus, "running"),
    lt(ucheerAiConversations.lastDistillAt, staleBefore),
  ));
  const rows = await db.select({
    id: ucheerAiConversations.id,
    userId: ucheerAiConversations.userId,
  }).from(ucheerAiConversations)
    .where(or(
      eq(ucheerAiConversations.lastDistillStatus, "pending"),
      eq(ucheerAiConversations.lastDistillStatus, "running"),
    ))
    .orderBy(desc(ucheerAiConversations.updatedAt))
    .limit(Math.max(1, Math.min(20, limit)));
  let completed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const changed = await distillUcheerConversation(row.userId, row.id);
      if (changed) completed += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: rows.length, completed, failed };
}

export async function listUcheerConversations(userId: number) {
  const db = await memoryDb();
  return db.select({ id: ucheerAiConversations.id, title: ucheerAiConversations.title, updatedAt: ucheerAiConversations.updatedAt })
    .from(ucheerAiConversations).where(eq(ucheerAiConversations.userId, userId))
    .orderBy(desc(ucheerAiConversations.updatedAt)).limit(80);
}

export async function getUcheerConversation(userId: number, conversationId: string) {
  const db = await memoryDb();
  const session = await ownedConversation(db, userId, conversationId);
  const rows = await db.select({ id: ucheerAiMessages.id, role: ucheerAiMessages.role, content: ucheerAiMessages.content,
    feedback: ucheerAiMessages.feedback, createdAt: ucheerAiMessages.createdAt })
    .from(ucheerAiMessages)
    .where(and(eq(ucheerAiMessages.userId, userId), eq(ucheerAiMessages.conversationId, conversationId)))
    .orderBy(desc(ucheerAiMessages.id)).limit(200);
  return { id: session.id, title: session.title, messages: rows.reverse() };
}

export async function deleteUcheerConversation(userId: number, conversationId: string) {
  const db = await memoryDb();
  await ownedConversation(db, userId, conversationId);
  await db.transaction(async tx => {
    await tx.delete(ucheerAiMessages).where(and(eq(ucheerAiMessages.userId, userId), eq(ucheerAiMessages.conversationId, conversationId)));
    await tx.delete(ucheerAiConversations).where(and(eq(ucheerAiConversations.userId, userId), eq(ucheerAiConversations.id, conversationId)));
  });
  return { deleted: true };
}

export async function listUcheerMemories(userId: number) {
  const db = await memoryDb();
  return db.select({ id: ucheerAiMemories.id, kind: ucheerAiMemories.kind, content: ucheerAiMemories.content,
    confidence: ucheerAiMemories.confidence, status: ucheerAiMemories.status,
    updatedAt: ucheerAiMemories.updatedAt }).from(ucheerAiMemories)
    .where(and(eq(ucheerAiMemories.userId, userId), eq(ucheerAiMemories.status, "active")))
    .orderBy(desc(ucheerAiMemories.updatedAt)).limit(100);
}

export async function deleteUcheerMemory(userId: number, memoryId: number) {
  const db = await memoryDb();
  await db.delete(ucheerAiMemories).where(and(eq(ucheerAiMemories.userId, userId), eq(ucheerAiMemories.id, memoryId)));
  return { deleted: true };
}

export async function rateUcheerAnswer(userId: number, messageId: number, feedback: "helpful" | "unhelpful") {
  const db = await memoryDb();
  const [message] = await db.select({ id: ucheerAiMessages.id }).from(ucheerAiMessages)
    .where(and(eq(ucheerAiMessages.id, messageId), eq(ucheerAiMessages.userId, userId), eq(ucheerAiMessages.role, "assistant"))).limit(1);
  if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "回答不存在或不可访问。" });
  await db.update(ucheerAiMessages).set({ feedback })
    .where(and(eq(ucheerAiMessages.id, messageId), eq(ucheerAiMessages.userId, userId)));
  await appendEvolutionEvent(db, {
    userId,
    eventType: "feedback_recorded",
    status: "completed",
    processedMessageId: messageId,
    detail: feedback,
  });
  return { saved: true };
}

/** Counts only. Admins never receive other users' prompt/response content. */
export async function getUcheerMemoryOverview() {
  try {
    const db = await memoryDb();
    const [conversations] = await db.select({ value: count() }).from(ucheerAiConversations);
    const [messages] = await db.select({ value: count() }).from(ucheerAiMessages);
    const [memories] = await db.select({ value: count() }).from(ucheerAiMemories)
      .where(eq(ucheerAiMemories.status, "active"));
    const [daily] = await db.select({ value: count() }).from(ucheerAiMemories)
      .where(and(eq(ucheerAiMemories.kind, "daily"), eq(ucheerAiMemories.status, "active")));
    const [captured] = await db.select({ value: count() }).from(ucheerAiEvolutionEvents)
      .where(eq(ucheerAiEvolutionEvents.eventType, "memory_captured"));
    const [distilled] = await db.select({ value: count() }).from(ucheerAiEvolutionEvents)
      .where(eq(ucheerAiEvolutionEvents.eventType, "distillation_completed"));
    const [failures] = await db.select({ value: count() }).from(ucheerAiEvolutionEvents)
      .where(eq(ucheerAiEvolutionEvents.eventType, "distillation_failed"));
    const [pending] = await db.select({ value: count() }).from(ucheerAiConversations)
      .where(eq(ucheerAiConversations.lastDistillStatus, "pending"));
    const [running] = await db.select({ value: count() }).from(ucheerAiConversations)
      .where(eq(ucheerAiConversations.lastDistillStatus, "running"));
    const [failedConversations] = await db.select({ value: count() }).from(ucheerAiConversations)
      .where(eq(ucheerAiConversations.lastDistillStatus, "failed"));
    const [lastEvent] = await db.select({ createdAt: ucheerAiEvolutionEvents.createdAt })
      .from(ucheerAiEvolutionEvents).orderBy(desc(ucheerAiEvolutionEvents.createdAt)).limit(1);
    const [feedback] = await db.select({ value: count() }).from(ucheerAiMessages).where(eq(ucheerAiMessages.feedback, "unhelpful"));
    const recentJobs = await db.select({
      eventType: ucheerAiEvolutionEvents.eventType,
      status: ucheerAiEvolutionEvents.status,
      createdAt: ucheerAiEvolutionEvents.createdAt,
    }).from(ucheerAiEvolutionEvents).orderBy(desc(ucheerAiEvolutionEvents.id)).limit(8);
    const [schedule] = await db.select({
      enabled: standaloneSchedules.isEnabled,
      lastStatus: standaloneSchedules.lastStatus,
      lastExecutedAt: standaloneSchedules.lastExecutedAt,
    }).from(standaloneSchedules)
      .where(eq(standaloneSchedules.name, "Ucheer AI 自动记忆整理")).limit(1).catch(() => []);
    return { available: true, conversations: conversations.value, messages: messages.value,
      memories: memories.value, automaticSummaries: daily.value, correctionsNeeded: feedback.value,
      automaticCaptured: captured.value, distillationCompleted: distilled.value,
      evolutionFailures: failures.value, pendingDistillation: pending.value + running.value,
      failedDistillation: failedConversations.value, lastEvolutionAt: lastEvent?.createdAt ?? null,
      recentJobs, schedule: schedule ?? null };
  } catch {
    return { available: false, conversations: 0, messages: 0, memories: 0,
      automaticSummaries: 0, correctionsNeeded: 0, automaticCaptured: 0,
      distillationCompleted: 0, evolutionFailures: 0, pendingDistillation: 0,
      failedDistillation: 0, lastEvolutionAt: null, recentJobs: [],
      schedule: null as { enabled: boolean; lastStatus: string; lastExecutedAt: Date | null } | null };
  }
}
