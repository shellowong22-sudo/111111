import { load } from "cheerio";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { ucheerAiSearchSnapshots } from "../drizzle/schema";
import { getDb } from "./db";

const SEARCH_TIMEOUT_MS = 12_000;
const MAX_QUERY_LENGTH = 240;
const MAX_RESULTS = 6;
const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const execFileAsync = promisify(execFile);
const SEARCH_SNAPSHOT_TTL_MS = 5 * 60_000;
const snapshotCache = new Map<string, { fetchedAt: string; results: UcheerSearchResult[] }>();
let snapshotsReady: Promise<void> | null = null;
const BLOCKED_HOSTS = /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/i;
const TRACKING_KEYS = /^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i;
const DOCUMENT_HOSTS = [
  "sec.gov", "federalreserve.gov", "bls.gov", "bea.gov", "treasury.gov",
  "bankofengland.co.uk", "boj.or.jp", "ecb.europa.eu", "imf.org",
  "worldbank.org", "bis.org", "oecd.org", "europa.eu",
];

export type UcheerSearchResult = {
  title: string;
  url: string;
  excerpt: string;
  content?: string;
  fetchedAt?: string;
  rank: number;
};

export type UcheerSearchDecision = {
  shouldSearch: boolean;
  query: string;
  evaluatedBy: "typesafe" | "deterministic";
};

function cleanText(value: string, maxLength: number) {
  return value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function latestUserText(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

/**
 * TypeSafe decides whether a user request needs fresh external material.
 * The deterministic branch is intentionally conservative and keeps chat
 * usable when no TypeSafe credential is configured.
 */
export async function decideUcheerSearch(input: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  symbol?: string;
  market?: string;
}): Promise<UcheerSearchDecision> {
  const userText = cleanText(latestUserText(input.messages), MAX_QUERY_LENGTH);
  const query = cleanText(
    [userText, input.symbol, input.market].filter(Boolean).join(" "),
    MAX_QUERY_LENGTH,
  );
  if (!query) return { shouldSearch: false, query: "", evaluatedBy: "deterministic" };

  const hasFreshnessSignal = /最新|近期|今天|本周|本月|现在|实时|全球|国际|数据|新闻|公告|政策|财报|查询|查找|搜索|资料|报告|论文|earnings|news|latest|today|research|report|search|current|real[- ]?time/i.test(query);
  const conceptualOnly = /^(?:请|帮我)?(?:解释|说明|介绍|什么是|如何理解|含义|原理|区别)/i.test(userText)
    && !/最新|近期|今天|现在|实时|新闻|公告|政策|财报|数据|current|latest|today|real[- ]?time/i.test(userText);
  const deterministicNeed = hasFreshnessSignal && !conceptualOnly;
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    return { shouldSearch: deterministicNeed, query, evaluatedBy: "deterministic" };
  }

  const body = {
    model: process.env.TYPESAFE_MODEL?.trim() || "jev-latest",
    state: {
      request: query,
      terminalContext: {
        symbol: cleanText(input.symbol ?? "", 80),
        market: cleanText(input.market ?? "", 80),
      },
    },
    questions: {
      needs_search: {
        type: "noul",
        instructions: "判断这个金融终端请求是否需要查询当前或外部公开资料，才能给出有依据的回答。",
        criteria: {
          true: "用户明确要求最新、实时、新闻、报告、公告、资料、数据、全球信息，或请求涉及会随时间变化的事实。",
          false: "用户只要求解释概念、推导公式、整理已提供文字，且不需要外部事实。",
        },
      },
    },
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(TYPESAFE_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) break;
      const payload = await response.json() as {
        answers?: { needs_search?: { type?: string; noul?: number } };
      };
      const noul = payload.answers?.needs_search?.noul;
      if (typeof noul === "number" && Number.isFinite(noul)) {
        return { shouldSearch: noul >= 0.62, query, evaluatedBy: "typesafe" };
      }
      break;
    } catch {
      if (attempt === 0) await wait(150);
    }
  }

  return { shouldSearch: deterministicNeed, query, evaluatedBy: "deterministic" };
}

function resolveResultUrl(href: string) {
  const raw = href.trim();
  if (!raw) return null;
  try {
    const direct = new URL(raw, "https://html.duckduckgo.com");
    if (direct.hostname.endsWith("duckduckgo.com") && direct.pathname.startsWith("/l/")) {
      const redirected = direct.searchParams.get("uddg");
      if (redirected) return resolveResultUrl(redirected);
    }
    if (!["http:", "https:"].includes(direct.protocol) || direct.username || direct.password) return null;
    if (BLOCKED_HOSTS.test(direct.hostname) || direct.hostname.includes(":")
      || !direct.hostname.includes(".") || /^\d/.test(direct.hostname)
      || /^(?:localhost|127|10|192|172|169|0)\b/i.test(direct.hostname)) return null;
    direct.hash = "";
    for (const key of [...direct.searchParams.keys()]) {
      if (TRACKING_KEYS.test(key)) direct.searchParams.delete(key);
    }
    return direct.toString();
  } catch {
    return null;
  }
}

async function snapshotDb() {
  const db = await getDb();
  if (!db) return null;
  if (!snapshotsReady) {
    snapshotsReady = db.execute(sql`CREATE TABLE IF NOT EXISTS ucheer_ai_search_snapshots (
      query_hash varchar(64) NOT NULL PRIMARY KEY,
      results text NOT NULL, fetched_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      .then(() => undefined)
      .catch(error => { snapshotsReady = null; throw error; });
  }
  await snapshotsReady;
  return db;
}

function usableSnapshot(value: { fetchedAt: string; results: UcheerSearchResult[] }) {
  return Date.now() - new Date(value.fetchedAt).getTime() < SEARCH_SNAPSHOT_TTL_MS
    && Number.isFinite(new Date(value.fetchedAt).getTime())
    && value.results.some(row => row.content && resolveResultUrl(row.url));
}

async function loadSnapshot(queryHash: string) {
  const inMemory = snapshotCache.get(queryHash);
  if (inMemory && usableSnapshot(inMemory)) return inMemory.results;
  try {
    const db = await snapshotDb();
    if (!db) return null;
    const [snapshot] = await db.select().from(ucheerAiSearchSnapshots)
      .where(eq(ucheerAiSearchSnapshots.queryHash, queryHash)).limit(1);
    if (!snapshot) return null;
    const parsed = JSON.parse(snapshot.results) as UcheerSearchResult[];
    if (!Array.isArray(parsed)) return null;
    const rows = parsed.filter(row => row && typeof row.url === "string"
      && Boolean(resolveResultUrl(row.url)) && typeof row.title === "string"
      && typeof row.excerpt === "string" && (!row.content || typeof row.content === "string"))
      .slice(0, MAX_RESULTS).map((row, index) => ({
        title: cleanText(row.title, 240), url: resolveResultUrl(row.url)!,
        excerpt: cleanText(row.excerpt, 600),
        content: row.content ? cleanText(row.content, 4_000) : undefined,
        rank: index + 1, fetchedAt: snapshot.fetchedAt.toISOString(),
      }));
    const value = { fetchedAt: snapshot.fetchedAt.toISOString(), results: rows };
    if (!usableSnapshot(value)) return null;
    snapshotCache.set(queryHash, value);
    return rows;
  } catch { return null; }
}

async function storeSnapshot(queryHash: string, rows: UcheerSearchResult[]) {
  if (!rows.some(row => row.content)) return;
  const fetchedAt = new Date();
  const results = rows.map(row => ({ ...row, fetchedAt: fetchedAt.toISOString() }));
  snapshotCache.set(queryHash, { fetchedAt: fetchedAt.toISOString(), results });
  if (snapshotCache.size > 150) snapshotCache.delete(snapshotCache.keys().next().value!);
  try {
    const db = await snapshotDb();
    if (!db) return;
    await db.insert(ucheerAiSearchSnapshots).values({
      queryHash, results: JSON.stringify(results), fetchedAt,
    }).onDuplicateKeyUpdate({ set: { results: JSON.stringify(results), fetchedAt } });
  } catch { /* AI chat remains usable without the optional research archive. */ }
}

export function parseDuckDuckGoResults(html: string): UcheerSearchResult[] {
  const $ = load(html);
  const rows: UcheerSearchResult[] = [];
  const seen = new Set<string>();
  $(".result").each((_index, element) => {
    const anchor = $(element).find("a.result__a").first();
    const url = resolveResultUrl(anchor.attr("href") ?? "");
    const title = cleanText(anchor.text(), 240);
    const excerpt = cleanText($(element).find(".result__snippet").first().text(), 600);
    if (!url || !title || seen.has(url) || /(?:sign\s*in|log\s*in|登录|注册|buy now)/i.test(title)) return;
    seen.add(url);
    rows.push({ title, url, excerpt, rank: rows.length + 1 });
  });
  return rows.slice(0, MAX_RESULTS);
}

/** A second, public search index prevents one search-page outage from disabling research. */
export function parseBingRssResults(xml: string): UcheerSearchResult[] {
  const $ = load(xml, { xmlMode: true });
  const rows: UcheerSearchResult[] = [];
  const seen = new Set<string>();
  $("item").each((_index, element) => {
    const url = resolveResultUrl($(element).find("link").first().text());
    const title = cleanText($(element).find("title").first().text(), 240);
    const excerpt = cleanText($(element).find("description").first().text(), 600);
    if (!url || !title || seen.has(url) || /(?:sign\s*in|log\s*in|登录|注册|buy now)/i.test(title)) return;
    seen.add(url);
    rows.push({ title, url, excerpt, rank: rows.length + 1 });
  });
  return rows.slice(0, MAX_RESULTS);
}

async function fetchReadableExcerpt(url: string) {
  try {
    // Reading arbitrary search hits server-side is an SSRF/redirect risk.
    // Only known public research sites can supply full-text evidence.
    const host = new URL(url).hostname.toLowerCase();
    if (!DOCUMENT_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`))) return "";
    let html = "";
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "UcheerAI/1.0 (financial terminal research)",
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok && /^text\/html\b|^application\/xhtml\+xml\b/i.test(response.headers.get("content-type") ?? "")
        && Number(response.headers.get("content-length") ?? 0) <= 1_000_000) html = await response.text();
    } catch { /* Some local Windows HTTP stacks reject Node's direct connection. */ }
    if (!html && new URL(url).protocol === "https:") {
      try {
        // No shell, cookies or redirects. This fallback is restricted to the
        // explicit official-domain allowlist above and limits size/time.
        const { stdout } = await execFileAsync(process.platform === "win32" ? "curl.exe" : "curl", [
          "--silent", "--show-error", "--fail", "--proto", "=https",
          "--connect-timeout", "3", "--max-time", "7", "--max-filesize", "1000000",
          "--dump-header", "-", "--output", "-", url,
        ], { timeout: 8_000, maxBuffer: 1_100_000, encoding: "utf8" });
        const separator = stdout.match(/\r?\n\r?\n/);
        if (separator) {
          const head = stdout.slice(0, separator.index);
          if (/^HTTP\/[\d.]+\s+200\b/m.test(head)
            && /^content-type:\s*(?:text\/html|application\/xhtml\+xml)\b/im.test(head)) {
            html = stdout.slice((separator.index ?? 0) + separator[0].length);
          }
        }
      } catch { /* Optional fallback unavailable or official document unreachable. */ }
    }
    if (html.length > 1_000_000) return "";
    const $ = load(html);
    $("script,style,noscript,nav,footer,header,form,aside,iframe").remove();
    const root = $("article").first().length
      ? $("article").first()
      : $("main").first().length
        ? $("main").first()
        : $("body");
    return cleanText(root.text(), 4_000);
  } catch {
    return "";
  }
}

function queryTokens(text: string) {
  const words = text.toLowerCase().match(/[\p{Script=Han}]{2,}|[a-z0-9]{3,}/gu) ?? [];
  return [...new Set(words.flatMap(word => /^[\p{Script=Han}]+$/u.test(word)
    ? [...word].slice(1).map((_, index) => word.slice(index, index + 2))
    : [word]))].filter(word => !/^(?:查询|搜索|最新|今天|数据|资料|请问|about|from|with|what|this)$/i.test(word));
}

export function rankUcheerSearchResults(query: string, results: UcheerSearchResult[]) {
  const tokens = queryTokens(query);
  return results
    .map((result, index) => {
      const title = result.title.toLowerCase();
      const excerpt = result.excerpt.toLowerCase();
      const overlap = tokens.reduce((score, token) => score + (title.includes(token) ? 3 : excerpt.includes(token) ? 1 : 0), 0);
      const host = new URL(result.url).hostname.toLowerCase();
      const authority = DOCUMENT_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`)) ? 2 : 0;
      return { result, index, score: overlap + authority };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ result }, index) => ({ ...result, rank: index + 1 }));
}

/**
 * Semantic relevance only reorders already retrieved public documents. The
 * model cannot invent a source URL or turn an unread search hit into evidence.
 */
export async function rankUcheerEvidence(query: string, results: UcheerSearchResult[]) {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return results;
  const candidates = results.filter(row => row.content).slice(0, MAX_RESULTS);
  if (candidates.length < 2) return results;
  const questions = Object.fromEntries(candidates.map((row, index) => [
    `relevant_${index}`,
    {
      type: "noul",
      instructions: `Does \`documents[${index}]\` contain evidence directly relevant to answering \`question\`? Similar financial topics alone are not sufficient.`,
      criteria: {
        true: "The document discusses the requested institution, instrument, event or period and contains concrete information useful to the answer.",
        false: "It is only a generic landing page, unrelated period or event, or does not address the actual question.",
      },
    },
  ]));
  try {
    const response = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.TYPESAFE_MODEL?.trim() || "jev-latest",
        state: {
          question: cleanText(query, MAX_QUERY_LENGTH),
          documents: candidates.map(row => ({
            title: cleanText(row.title, 200),
            excerpt: cleanText(row.content ?? "", 1_100),
          })),
        },
        questions,
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return results;
    const payload = await response.json() as { answers?: Record<string, { type?: string; noul?: number }> };
    const weights = new Map<string, number>();
    for (const [index, candidate] of candidates.entries()) {
      const answer = payload.answers?.[`relevant_${index}`];
      if (answer?.type !== "noul" || typeof answer.noul !== "number"
        || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return results;
      weights.set(candidate.url, answer.noul);
    }
    return results.map((result, index) => ({ result, index }))
      .sort((a, b) => (weights.get(b.result.url) ?? -1) - (weights.get(a.result.url) ?? -1) || a.index - b.index)
      .map(({ result }, index) => ({ ...result, rank: index + 1 }));
  } catch {
    return results;
  }
}

export function officialSearchQuery(query: string) {
  const normalized = query.toLowerCase();
  const date = query.match(/(20\d{2})\s*年?\s*(0?[1-9]|1[0-2])\s*月?/);
  const year = date?.[1] ?? query.match(/\b20\d{2}\b/)?.[0] ?? "";
  const month = date ? new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, Number(date[2]) - 1, 1))) : "";
  const period = `${month} ${year}`.trim();
  if (/美联储|联邦储备|federal reserve|\bfomc\b|\bfed\b/i.test(normalized))
    return `site:federalreserve.gov FOMC press releases ${period}`.trim();
  if (/日本银行|日本央行|bank of japan|\bboj\b/i.test(normalized))
    return `site:boj.or.jp Bank of Japan monetary policy ${period}`.trim();
  if (/英国央行|英格兰银行|bank of england|\bboe\b/i.test(normalized))
    return `site:bankofengland.co.uk monetary policy ${period}`.trim();
  if (/欧洲央行|european central bank|\becb\b/i.test(normalized))
    return `site:ecb.europa.eu monetary policy ${period}`.trim();
  return null;
}

/**
 * Only links actually returned by this search may appear as citations.
 * Link matching is not a claim-level fact check: a readable document is
 * required before the assistant can treat a hit as full-text evidence.
 */
export function validateUcheerCitations(reply: string, results: UcheerSearchResult[]) {
  const allowed = new Set(results.map(result => resolveResultUrl(result.url)).filter(Boolean));
  let rejected = 0;
  const text = reply.replace(/\[([^\]\n]{1,240})\]\((https?:\/\/[^)\s]+)\)/g, (whole, label: string, url: string) => {
    if (allowed.has(resolveResultUrl(url))) return whole;
    rejected += 1;
    return label;
  });
  return { text, rejected };
}

export async function searchGlobalInformation(query: string): Promise<UcheerSearchResult[]> {
  const normalizedQuery = cleanText(query, MAX_QUERY_LENGTH);
  if (!normalizedQuery) return [];
  const queryHash = createHash("sha256").update(normalizedQuery.toLowerCase()).digest("hex");
  const cached = await loadSnapshot(queryHash);
  if (cached) return cached;
  async function searchOnce(term: string, engine: "duckduckgo" | "bing") {
    const url = engine === "duckduckgo"
      ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(term)}`
      : `https://www.bing.com/search?format=rss&q=${encodeURIComponent(term)}`;
    const response = await fetch(url, {
      headers: {
        accept: engine === "bing" ? "application/rss+xml,application/xml,text/xml" : "text/html,application/xhtml+xml",
        "user-agent": "UcheerAI/1.0 (financial terminal research)",
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = await response.text();
    return engine === "bing" ? parseBingRssResults(body) : parseDuckDuckGoResults(body);
  }
  try {
    const officialTerm = officialSearchQuery(normalizedQuery);
    const [general, official, alternate, alternateOfficial] = await Promise.all([
      searchOnce(normalizedQuery, "duckduckgo").catch(() => []),
      officialTerm ? searchOnce(officialTerm, "duckduckgo").catch(() => []) : Promise.resolve([]),
      searchOnce(normalizedQuery, "bing").catch(() => []),
      officialTerm ? searchOnce(officialTerm, "bing").catch(() => []) : Promise.resolve([]),
    ]);
    const seen = new Set<string>();
    const combined = [...official, ...alternateOfficial, ...general, ...alternate].filter(result => {
      if (seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    });
    const ranked = rankUcheerSearchResults(normalizedQuery, combined);
    const verifiedDomains = ranked.filter(result => {
      const host = new URL(result.url).hostname.toLowerCase();
      return DOCUMENT_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`));
    });
    const results = [...verifiedDomains.slice(0, 2), ...ranked.filter(item =>
      !verifiedDomains.slice(0, 2).some(officialResult => officialResult.url === item.url))]
      .slice(0, MAX_RESULTS).map((item, index) => ({ ...item, rank: index + 1 }));
    const enriched = await Promise.all(
      results.map(async (result) => ({
        ...result,
        content: await fetchReadableExcerpt(result.url),
      })),
    );
    const rows = await rankUcheerEvidence(normalizedQuery, enriched);
    await storeSnapshot(queryHash, rows);
    return rows;
  } catch {
    return [];
  }
}

export function buildSearchContext(results: UcheerSearchResult[]) {
  if (!results.length) return "本次检索未返回可读取的公开资料。不要据此编造事实；请说明资料暂不可用，并建议用户缩小查询条件。";
  return results
    .map((result) => [
      `资料 ${result.rank}`,
      `标题：${result.title}`,
      `搜索摘要（不能单独证明实时事实）：${result.excerpt || "无摘要"}`,
      result.content ? `正文摘录：${result.content}` : "",
      `核验状态：${result.content ? "已读取正文摘录，仍需核对主张" : "仅检索到标题与摘要，未核验正文"}`,
      `参考链接：${result.url}`,
    ].join("\n"))
    .join("\n\n");
}
