import { publicProcedure, router } from "../_core/trpc";

const TIC_INDEX_URL = "https://home.treasury.gov/data/treasury-international-capital-tic-system/tic-press-releases-by-topic";
const TIC_PRESS_RELEASES_URL = "https://home.treasury.gov/news/press-releases";
const TREASURY_ORIGIN = "https://home.treasury.gov";

export type TicRelease = {
  available: boolean;
  source: string;
  sourceUrl: string | null;
  releaseDate: string | null;
  observationPeriod: string | null;
  netTicInflowBillions: number | null;
  privateInflowBillions: number | null;
  officialInflowBillions: number | null;
  netLongTermPurchasesBillions: number | null;
  retrievedAt: string;
  limitation: string;
};

function plainText(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseLatestTicReleaseUrl(html: string) {
  const named = [...html.matchAll(/<a\s+[^>]*href=(?:["'])?([^"'\s>]*\/news\/press-releases\/sb\d+\/?)(?:["'])?[^>]*>\s*Treasury International Capital Data for\b/gi)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href))
    .map((href) => new URL(href, TREASURY_ORIGIN).toString());
  if (named.length) return named.sort((left, right) => Number(right.match(/sb(\d+)/i)?.[1] ?? 0) - Number(left.match(/sb(\d+)/i)?.[1] ?? 0))[0] ?? null;
  const legacy = [...html.matchAll(/href=(?:["'])?([^"'\s>]*\/news\/press-releases\/sb\d+\/?)(?:["'])?/gi)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href))
    .map((href) => new URL(href, TREASURY_ORIGIN).toString());
  return legacy.sort((left, right) => Number(right.match(/sb(\d+)/i)?.[1] ?? 0) - Number(left.match(/sb(\d+)/i)?.[1] ?? 0))[0] ?? null;
}

function parseAmount(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  return /outflow|decreased|negative/i.test(match[0]) ? -raw : raw;
}

export function parseTicRelease(html: string, sourceUrl: string, retrievedAt = new Date().toISOString()): TicRelease {
  const text = plainText(html);
  const observationPeriod = text.match(/Treasury International Capital \(TIC\) data for ([A-Z][a-z]+\s+20\d{2})/i)?.[1] ?? null;
  const releaseDate = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}/)?.[0] ?? null;
  const netTicInflowBillions = parseAmount(text, /net TIC (?:inflow|outflow) of \$([\d.]+) billion/i);
  const privateInflowBillions = parseAmount(text, /net foreign private (?:inflows|outflows) were \$([\d.]+) billion/i);
  const officialInflowBillions = parseAmount(text, /net foreign official (?:inflows|outflows) were \$([\d.]+) billion/i);
  const netLongTermPurchasesBillions = parseAmount(text, /overall net foreign purchases of long-term securities (?:are |were )?estimated to have been \$([\d.]+) billion/i);
  const available = Boolean(observationPeriod && netTicInflowBillions !== null);
  return {
    available,
    source: "美国财政部 · Treasury International Capital（TIC）",
    sourceUrl,
    releaseDate,
    observationPeriod,
    netTicInflowBillions,
    privateInflowBillions,
    officialInflowBillions,
    netLongTermPurchasesBillions,
    retrievedAt,
    limitation: available
      ? "TIC 是按月发布的跨境证券、短期证券和银行流量统计；数据不涵盖直接投资，且托管口径不能准确归属每个最终持有国。结果不是实时资金流、国家归因或交易信号。"
      : "当前未能从美国财政部 TIC 官方发布解析观察月与净流入；终端不以 SOFR、国库券拍卖、ZIP 原展示或第三方估计替代。",
  };
}

let cache: { at: number; value: TicRelease } | null = null;
const CACHE_MS = 300_000;

export async function readLatestTicRelease(): Promise<TicRelease> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const retrievedAt = new Date().toISOString();
  try {
    const indexResponse = await fetch(TIC_INDEX_URL, { signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html", "User-Agent": "Finance-Hub-Research/1.0 (+terminal official-source reader)" } });
    if (!indexResponse.ok) throw new Error(`TIC_INDEX_${indexResponse.status}`);
    let sourceUrl = parseLatestTicReleaseUrl(await indexResponse.text());
    if (!sourceUrl) {
      const pressResponse = await fetch(TIC_PRESS_RELEASES_URL, { signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html", "User-Agent": "Finance-Hub-Research/1.0 (+terminal official-source reader)" } });
      if (!pressResponse.ok) throw new Error(`TIC_PRESS_CENTER_${pressResponse.status}`);
      sourceUrl = parseLatestTicReleaseUrl(await pressResponse.text());
    }
    if (!sourceUrl) throw new Error("TIC_RELEASE_NOT_FOUND");
    const releaseResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html", "User-Agent": "Finance-Hub-Research/1.0 (+terminal official-source reader)" } });
    if (!releaseResponse.ok) throw new Error(`TIC_RELEASE_${releaseResponse.status}`);
    const result = parseTicRelease(await releaseResponse.text(), sourceUrl, retrievedAt);
    cache = { at: Date.now(), value: result };
    return result;
  } catch (error) {
    const value: TicRelease = { available: false, source: "美国财政部 · Treasury International Capital（TIC）", sourceUrl: TIC_INDEX_URL, releaseDate: null, observationPeriod: null, netTicInflowBillions: null, privateInflowBillions: null, officialInflowBillions: null, netLongTermPurchasesBillions: null, retrievedAt, limitation: `TIC 官方发布当前不可读：${error instanceof Error ? error.message : "UNKNOWN"}。不以任何代理利率、拍卖、ZIP 固定内容或第三方估计替代。` };
    cache = { at: Date.now(), value };
    return value;
  }
}

export const ticPublicRouter = router({ latest: publicProcedure.query(() => readLatestTicRelease()) });
