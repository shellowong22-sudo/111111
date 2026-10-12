import { publicProcedure, router } from "../_core/trpc";

const RELEASES_URL = "https://www.pmi.spglobal.com/public/release/pressreleases";
const HOST = "https://www.pmi.spglobal.com";
const CACHE_MS = 5 * 60_000;

type PmiReleaseLink = { url: string; releasedAt: string | null };

function plainText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function monthIndex(value: string) {
  return ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(value.toLowerCase()) + 1;
}

function toUtcIso(dateText: string, timeText: string) {
  const match = dateText.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(20\d{2})$/);
  const month = match ? monthIndex(match[1]) : 0;
  if (!match || !month) return null;
  return new Date(Date.UTC(Number(match[3]), month - 1, Number(match[2]), Number(timeText.slice(0, 2)), Number(timeText.slice(3, 5)))).toISOString();
}

export function parseLatestUsManufacturingLink(html: string): PmiReleaseLink | null {
  const anchors = [...html.matchAll(/<a[^>]+href=["']([^"']*\/Public\/Home\/PressRelease\/[^"']+)["'][^>]*>[\s\S]*?<\/a>/gi)];
  for (const anchor of anchors) {
    const position = anchor.index ?? 0;
    const context = plainText(html.slice(Math.max(0, position - 900), Math.min(html.length, position + 240)));
    const release = context.match(/([A-Za-z]+\s+\d{1,2}\s+20\d{2})\s+(\d{2}:\d{2})\s+UTC\s+S&P Global US Manufacturing PMI(?![^]{0,60}Flash)/i);
    if (release) return { url: new URL(anchor[1], HOST).toString(), releasedAt: toUtcIso(release[1], release[2]) };
  }
  return null;
}

export function parseUsManufacturingRelease(html: string) {
  const text = plainText(html);
  const periodMatch = text.match(/recorded\s+(\d+(?:\.\d+)?)\s+in\s+([A-Za-z]+)\.?/i);
  const directionalMatch = text.match(/(?:rose|increased|edged\s+up)\s+from\s+(\d+(?:\.\d+)?)\s+in\s+([A-Za-z]+)\s+to\s+(\d+(?:\.\d+)?)\s+in\s+([A-Za-z]+)/i)
    ?? text.match(/(?:fell|declined|decreased|eased)\s+from\s+(\d+(?:\.\d+)?)\s+in\s+([A-Za-z]+)\s+to\s+(\d+(?:\.\d+)?)\s+in\s+([A-Za-z]+)/i);
  const currentValue = directionalMatch ? Number(directionalMatch[3]) : periodMatch ? Number(periodMatch[1]) : null;
  const previousValue = directionalMatch ? Number(directionalMatch[1]) : null;
  const observationPeriod = directionalMatch ? directionalMatch[4] : periodMatch?.[2] ?? null;
  const embargo = text.match(/Embargoed until\s+\d{4}\s+[A-Za-z]+\s+(\d{1,2}\s+[A-Za-z]+\s+20\d{2})\s*\/\s*(\d{2}:?\d{2})\s*UTC/i);
  const publicationAt = embargo ? (() => {
    const pieces = embargo[1].split(/\s+/);
    const month = monthIndex(pieces[1] ?? "");
    const utcTime = embargo[2].replace(":", "");
    return month ? new Date(Date.UTC(Number(pieces[2]), month - 1, Number(pieces[0]), Number(utcTime.slice(0, 2)), Number(utcTime.slice(2, 4)))).toISOString() : null;
  })() : null;
  return { currentValue: Number.isFinite(currentValue) ? currentValue : null, previousValue: Number.isFinite(previousValue) ? previousValue : null, observationPeriod, publicationAt, text };
}

let cached: { expiresAt: number; value: Awaited<ReturnType<typeof readLatestUsManufacturingPmi>> } | null = null;

export async function readLatestUsManufacturingPmi() {
  const retrievedAt = new Date().toISOString();
  try {
    const headers = { Accept: "text/html,application/xhtml+xml", "User-Agent": "FinanceHubResearch/1.0 (+https://finance-hub.local; official-public-data-reader)" };
    const indexResponse = await fetch(RELEASES_URL, { signal: AbortSignal.timeout(12_000), headers });
    if (!indexResponse.ok) throw new Error(`PMI_DIRECTORY_${indexResponse.status}`);
    const link = parseLatestUsManufacturingLink(await indexResponse.text());
    if (!link) throw new Error("PMI_US_MANUFACTURING_RELEASE_NOT_FOUND");
    const releaseResponse = await fetch(link.url, { signal: AbortSignal.timeout(12_000), headers });
    if (!releaseResponse.ok) throw new Error(`PMI_RELEASE_${releaseResponse.status}`);
    const parsed = parseUsManufacturingRelease(await releaseResponse.text());
    if (parsed.currentValue === null) throw new Error("PMI_CURRENT_VALUE_NOT_FOUND");
    return {
      available: true as const,
      source: "S&P Global PMI · 官方公开发布",
      sourceUrl: link.url,
      directoryUrl: RELEASES_URL,
      releasedAt: parsed.publicationAt ?? link.releasedAt,
      retrievedAt,
      observationPeriod: parsed.observationPeriod,
      value: parsed.currentValue,
      previousValue: parsed.previousValue,
      thresholdDistance: Number((parsed.currentValue - 50).toFixed(1)),
      limitation: "仅提取 S&P Global 公开美国制造业 PMI 发布中的标题、公开当前读数、可识别前值和 UTC 发布时间。该发布页提示底层 PMI 数据需另行授权；终端不复制全文、不推断市场影响或提供交易建议。",
    };
  } catch (error) {
    return {
      available: false as const,
      source: "S&P Global PMI · 官方公开发布",
      sourceUrl: RELEASES_URL,
      directoryUrl: RELEASES_URL,
      releasedAt: null,
      retrievedAt,
      observationPeriod: null,
      value: null,
      previousValue: null,
      thresholdDistance: null,
      limitation: `当前无法从 S&P Global 官方公开发布读取可验证的美国制造业 PMI：${error instanceof Error ? error.message : "PMI_SOURCE_UNAVAILABLE"}。系统不以 ZIP 保留读数、第三方转述或随机值替代。`,
    };
  }
}

export const pmiPublicRouter = router({
  getLatestUsManufacturing: publicProcedure.query(async () => {
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };
    const value = await readLatestUsManufacturingPmi();
    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return { ...value, cached: false };
  }),
});
