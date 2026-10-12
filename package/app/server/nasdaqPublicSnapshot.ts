import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { marketDataObservationHistory } from '../drizzle/schema';
import { getDb } from './db';
import { archiveCanonicalObservationSeries } from './adminMarketIngestion';

export const NASDAQ_SNAPSHOT_CONTRACT = 'market.public-quote.nasdaq.v1';
const archiveDir = path.resolve('.runtime/nasdaq-public-quotes');
export type PublicQuote = {
  symbol: string; price: number; change: number | null; changePct: number | null;
  currency: string | null; observedAt: string; retrievedAt: string; realtime: false;
  delayStatus: 'end_of_day' | 'delayed' | 'historical';
};
const number = (value: unknown) => {
  if (typeof value !== 'string' || !/^[+$\-\d,.%\s]+$/.test(value)) return null;
  const parsed = Number(value.replace(/[$,%\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Reject mismatched instruments, invalid dates, and unspecified freshness. */
export function parseNasdaqPublicSnapshot(payload: any, symbol: string, expectedSymbol: string, now = new Date()): PublicQuote | null {
  const data = payload?.data;
  if (data?.symbol !== expectedSymbol) return null;
  const quote = data.primaryData;
  const price = number(quote?.lastSalePrice);
  const stamp = String(quote?.lastTradeTimestamp ?? '').trim();
  const daily = /^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/.exec(stamp);
  // Intraday timestamps must include a timezone; never invent an exchange time.
  const timestamp = daily ? Date.parse(`${stamp} 00:00:00 GMT`) : /(?:EST|EDT|GMT|UTC|[+-]\d{2}:?\d{2})\b/.test(stamp) ? Date.parse(stamp) : NaN;
  if (price === null || price <= 0 || !Number.isFinite(timestamp) || timestamp > now.getTime() + 60_000) return null;
  return {
    symbol, price, change: number(quote.netChange), changePct: number(quote.percentageChange),
    currency: typeof quote.currency === 'string' && /^[A-Z]{3}$/.test(quote.currency) ? quote.currency : null,
    observedAt: daily ? new Date(timestamp).toISOString().slice(0, 10) : new Date(timestamp).toISOString(),
    retrievedAt: now.toISOString(), realtime: false,
    delayStatus: daily ? 'end_of_day' : 'delayed',
  };
}

function instrument(symbol: string, assetClass: 'index' | 'stocks' | 'etf') {
  const code = symbol.toUpperCase();
  if (assetClass === 'index') return ({ '^IXIC': 'COMP', '^NDX': 'NDX' } as Record<string, string>)[code] ?? null;
  return /^[A-Z]{1,6}$/.test(code) ? code : null;
}

async function persist(quote: PublicQuote, endpoint: string) {
  const { retrievedAt, ...observation } = quote;
  try {
    await archiveCanonicalObservationSeries({ moduleId: 'admin-market-ingestion', dataContractId: NASDAQ_SNAPSHOT_CONTRACT,
      symbol: quote.symbol, source: 'Nasdaq public quote', sourceReference: endpoint, schemaVersion: 'public-quote-v1',
      fetchedAt: new Date(retrievedAt), history: [{ date: quote.observedAt.slice(0, 10), payload: observation }] });
  } catch {
    // Immutable content-addressed files retain every distinct observation even
    // while the database is unavailable. The latest pointer is replaceable.
    const directory = path.join(archiveDir, encodeURIComponent(quote.symbol));
    await mkdir(directory, { recursive: true });
    const hash = createHash('sha256').update(JSON.stringify(observation)).digest('hex');
    try { await writeFile(path.join(directory, `${hash}.json`), JSON.stringify(quote), { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const temp = path.join(directory, `latest.${process.pid}.tmp`);
    await writeFile(temp, JSON.stringify(quote));
    await rename(temp, path.join(directory, 'latest.json'));
  }
}

async function historical(symbol: string): Promise<PublicQuote | null> {
  let result: PublicQuote | null = null;
  try {
    const db = await getDb();
    if (db) {
      const row = (await db.select().from(marketDataObservationHistory).where(and(
        eq(marketDataObservationHistory.dataContractId, NASDAQ_SNAPSHOT_CONTRACT),
        eq(marketDataObservationHistory.symbol, symbol),
      )).orderBy(desc(marketDataObservationHistory.observationDate), desc(marketDataObservationHistory.id)).limit(1))[0];
      if (row) result = { ...(row.payload as PublicQuote), retrievedAt: row.fetchedAt.toISOString() };
    }
  } catch { /* Local archive is independent of database availability. */ }
  try {
    const local = JSON.parse(await readFile(path.join(archiveDir, encodeURIComponent(symbol), 'latest.json'), 'utf8')) as PublicQuote;
    if (!result || local.observedAt > result.observedAt) result = local;
  } catch { /* No local history yet. */ }
  return result && result.symbol === symbol && Number.isFinite(result.price) && result.price > 0
    ? { ...result, realtime: false, delayStatus: 'historical' } : null;
}

const cache = new Map<string, { until: number; value: PublicQuote | null }>();
const pending = new Map<string, Promise<PublicQuote | null>>();
export async function fetchNasdaqPublicSnapshot(symbol: string, assetClass: 'index' | 'stocks' | 'etf') {
  symbol = symbol.toUpperCase();
  const code = instrument(symbol, assetClass);
  if (!code) return null;
  const key = `${symbol}|${assetClass}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const endpoint = `https://api.nasdaq.com/api/quote/${code}/info?assetclass=${assetClass}`;
    let quote: PublicQuote | null = null;
    try {
      const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
      if (response.ok) quote = parseNasdaqPublicSnapshot(await response.json(), symbol, code);
      if (quote) await persist(quote, endpoint);
    } catch { quote = null; }
    quote ??= await historical(symbol);
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 60_000, value: quote });
    return quote;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
