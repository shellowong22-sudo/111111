import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { managedPublicDatasetStates, marketDataObservationHistory } from "../drizzle/schema";
import type { YahooChartPoint, YahooChartResult, YahooRange } from "./realDataService";
import { YFINANCE_COMMUNITY_LABEL, YFINANCE_COMMUNITY_PROVIDER_ID } from "./yfinancePythonAdapter";

export const YAHOO_CANONICAL_MODULE_ID = "admin-market-ingestion";
export const YAHOO_CANONICAL_CONTRACT_ID = "market.ohlcv.daily.v1";
export const YFINANCE_DATASET_STATE_ID = "provider.yfinance-community.yahoo-chart";
const LOCAL_DIR = path.resolve(".runtime", "yfinance-public");
const LOCAL_LEDGER = path.join(LOCAL_DIR, "history.json");

export type StoredYahooObservation = {
  symbol: string;
  observationDate: string;
  fetchedAt: string;
  source: YahooChartResult["source"];
  sourceReference: string;
  payload: Record<string, unknown>;
  contentHash: string;
};

type LocalLedger = {
  version: 1;
  providerId: typeof YFINANCE_COMMUNITY_PROVIDER_ID;
  moduleId: typeof YAHOO_CANONICAL_MODULE_ID;
  dataContractId: typeof YAHOO_CANONICAL_CONTRACT_ID;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "never" | "succeeded" | "failed";
  lastError: string | null;
  observations: StoredYahooObservation[];
};

const emptyLedger = (): LocalLedger => ({
  version: 1,
  providerId: YFINANCE_COMMUNITY_PROVIDER_ID,
  moduleId: YAHOO_CANONICAL_MODULE_ID,
  dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastStatus: "never",
  lastError: null,
  observations: [],
});

let localWriteQueue = Promise.resolve();

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key =>
    `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`
  ).join(",")}}`;
}

function observationHash(input: Omit<StoredYahooObservation, "fetchedAt" | "source" | "sourceReference" | "contentHash">) {
  return createHash("sha256").update(stableJson({
    moduleId: YAHOO_CANONICAL_MODULE_ID,
    dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
    symbol: input.symbol,
    observationDate: input.observationDate,
    payload: input.payload,
  })).digest("hex");
}

async function readLocalLedger(): Promise<LocalLedger> {
  try {
    const parsed = JSON.parse(await readFile(LOCAL_LEDGER, "utf8")) as LocalLedger;
    return parsed?.version === 1 && Array.isArray(parsed.observations) ? parsed : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

async function writeLocalLedger(ledger: LocalLedger) {
  await mkdir(LOCAL_DIR, { recursive: true });
  const temporary = `${LOCAL_LEDGER}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(ledger), "utf8");
  await rename(temporary, LOCAL_LEDGER);
}

export function mergeYahooObservations(
  existing: StoredYahooObservation[],
  incoming: StoredYahooObservation[],
) {
  const known = new Set(existing.map(item => item.contentHash));
  const inserted: StoredYahooObservation[] = [];
  let duplicate = 0;
  for (const observation of incoming) {
    if (known.has(observation.contentHash)) {
      duplicate += 1;
      continue;
    }
    known.add(observation.contentHash);
    inserted.push(observation);
  }
  return { observations: [...existing, ...inserted], inserted: inserted.length, duplicate };
}

function sourceReference(result: YahooChartResult) {
  if (result.source === "yfinance community wrapper / Yahoo Finance public data")
    return "python-adapter:yfinance-community@1.7.0";
  if (result.source === "Yahoo Finance chart via platform data API")
    return "platform-data-api:YahooFinance/get_stock_chart";
  return "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}";
}

function payloadFor(point: YahooChartPoint, currency: string) {
  return {
    timestamp: point.timestamp ?? null,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    value: point.value,
    volume: point.volume,
    currency,
  };
}

async function updateDatabaseState(status: "succeeded" | "failed", at: Date, error: string | null) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.insert(managedPublicDatasetStates).values({
    datasetId: YFINANCE_DATASET_STATE_ID,
    lastAttemptAt: at,
    lastSuccessAt: status === "succeeded" ? at : null,
    nextAttemptAt: null,
    consecutiveFailures: status === "failed" ? 1 : 0,
    lastStatus: status,
    lastError: error,
  }).onDuplicateKeyUpdate({ set: {
    lastAttemptAt: at,
    ...(status === "succeeded" ? { lastSuccessAt: at } : {}),
    consecutiveFailures: status === "failed" ? sql`${managedPublicDatasetStates.consecutiveFailures} + 1` : 0,
    lastStatus: status,
    lastError: error,
  } });
}

async function archiveLocally(result: YahooChartResult, fetchedAt: Date) {
  let outcome = { inserted: 0, duplicate: 0, total: result.history.length };
  localWriteQueue = localWriteQueue.then(async () => {
    const ledger = await readLocalLedger();
    const incoming: StoredYahooObservation[] = [];
    for (const point of result.history) {
      if (!point.date || point.close === null) continue;
      const identity = {
        symbol: result.symbol,
        observationDate: point.date,
        payload: payloadFor(point, result.currency),
      };
      const contentHash = observationHash(identity);
      incoming.push({
        ...identity,
        fetchedAt: fetchedAt.toISOString(),
        source: result.source,
        sourceReference: sourceReference(result),
        contentHash,
      });
    }
    const merged = mergeYahooObservations(ledger.observations, incoming);
    ledger.observations = merged.observations;
    outcome.inserted = merged.inserted;
    outcome.duplicate = merged.duplicate;
    ledger.lastAttemptAt = fetchedAt.toISOString();
    ledger.lastSuccessAt = fetchedAt.toISOString();
    ledger.lastStatus = "succeeded";
    ledger.lastError = null;
    await writeLocalLedger(ledger);
  });
  await localWriteQueue;
  return outcome;
}

export async function archiveYahooFinanceChart(result: YahooChartResult) {
  const fetchedAt = new Date();
  const history = result.history
    .filter(point => point.date && point.close !== null)
    .map(point => ({ date: point.date, payload: payloadFor(point, result.currency) }));
  try {
    const { archiveCanonicalObservationSeries } = await import("./adminMarketIngestion");
    const outcome = await archiveCanonicalObservationSeries({
      moduleId: YAHOO_CANONICAL_MODULE_ID,
      dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
      symbol: result.symbol,
      source: result.source,
      sourceReference: sourceReference(result),
      schemaVersion: "market-observation-v1",
      fetchedAt,
      history,
    });
    await updateDatabaseState("succeeded", fetchedAt, null);
    return { ...outcome, storage: "database" as const };
  } catch (databaseError) {
    const outcome = await archiveLocally(result, fetchedAt);
    return {
      ...outcome,
      revisions: 0,
      storage: "local-persistent-fallback" as const,
      databaseError: databaseError instanceof Error ? databaseError.message : "DATABASE_ARCHIVE_FAILED",
    };
  }
}

export async function recordYahooFinanceFailure(reason: string) {
  const at = new Date();
  try {
    await updateDatabaseState("failed", at, reason.slice(0, 1000));
  } catch {
    localWriteQueue = localWriteQueue.then(async () => {
      const ledger = await readLocalLedger();
      ledger.lastAttemptAt = at.toISOString();
      ledger.lastStatus = "failed";
      ledger.lastError = reason.slice(0, 1000);
      await writeLocalLedger(ledger);
    });
    await localWriteQueue;
  }
}

const RANGE_DAYS: Record<YahooRange, number> = {
  "1d": 7, "5d": 14, "1mo": 45, "3mo": 120,
  "6mo": 220, "1y": 400, "2y": 800, "5y": 1_900,
};

function chartFromStored(symbol: string, rows: StoredYahooObservation[], range: YahooRange): YahooChartResult | null {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RANGE_DAYS[range]);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const latestByDate = new Map<string, StoredYahooObservation>();
  rows
    .filter(row => row.symbol === symbol && row.observationDate >= cutoffDate)
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
    .forEach(row => { if (!latestByDate.has(row.observationDate)) latestByDate.set(row.observationDate, row); });
  const selected = [...latestByDate.values()].sort((a, b) => a.observationDate.localeCompare(b.observationDate));
  const history = selected.map((row): YahooChartPoint | null => {
    const value = typeof row.payload.value === "number" ? row.payload.value : row.payload.close;
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const nullable = (field: string) => typeof row.payload[field] === "number" && Number.isFinite(row.payload[field])
      ? row.payload[field] as number : null;
    const timestamp = typeof row.payload.timestamp === "string" && row.payload.timestamp
      ? row.payload.timestamp
      : undefined;
    return { date: row.observationDate, timestamp, value, open: nullable("open"), high: nullable("high"), low: nullable("low"), close: nullable("close"), volume: nullable("volume") };
  }).filter((point): point is YahooChartPoint => point !== null);
  const latest = history.at(-1);
  if (!latest) return null;
  const previous = history.at(-2)?.value ?? latest.value;
  const change = Number((latest.value - previous).toFixed(4));
  return {
    symbol,
    price: latest.value,
    change,
    changePct: previous ? Number(((change / previous) * 100).toFixed(3)) : 0,
    currency: typeof selected.at(-1)?.payload.currency === "string" ? selected.at(-1)!.payload.currency as string : "未提供",
    history,
    meta: {
      persistentFallback: true,
      live: false,
      realtimeStatus: "archived",
      dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
      lastSuccessfulFetchAt: selected.at(-1)?.fetchedAt ?? null,
    },
    source: selected.at(-1)?.source ?? "Yahoo Finance public chart",
  };
}

export async function readArchivedYahooFinanceChart(symbol: string, range: YahooRange) {
  const normalized = symbol.trim().toUpperCase();
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const rows = await db.select({
      symbol: marketDataObservationHistory.symbol,
      observationDate: marketDataObservationHistory.observationDate,
      fetchedAt: marketDataObservationHistory.fetchedAt,
      source: marketDataObservationHistory.source,
      sourceReference: marketDataObservationHistory.sourceReference,
      payload: marketDataObservationHistory.payload,
      contentHash: marketDataObservationHistory.contentHash,
    }).from(marketDataObservationHistory).where(and(
      eq(marketDataObservationHistory.moduleId, YAHOO_CANONICAL_MODULE_ID),
      eq(marketDataObservationHistory.dataContractId, YAHOO_CANONICAL_CONTRACT_ID),
      eq(marketDataObservationHistory.symbol, normalized),
      like(marketDataObservationHistory.source, "%Yahoo Finance%"),
    )).orderBy(desc(marketDataObservationHistory.observationDate), desc(marketDataObservationHistory.id)).limit(2_000);
    return chartFromStored(normalized, rows.map(row => ({
      ...row,
      fetchedAt: row.fetchedAt.toISOString(),
      source: row.source as YahooChartResult["source"],
      sourceReference: row.sourceReference ?? "",
    })), range);
  } catch {
    return chartFromStored(normalized, (await readLocalLedger()).observations, range);
  }
}

export async function getYahooFinanceProviderStatus() {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const [state, countRows] = await Promise.all([
      db.select().from(managedPublicDatasetStates).where(eq(managedPublicDatasetStates.datasetId, YFINANCE_DATASET_STATE_ID)).limit(1),
      db.select({ count: sql<number>`count(*)` }).from(marketDataObservationHistory).where(and(
        eq(marketDataObservationHistory.moduleId, YAHOO_CANONICAL_MODULE_ID),
        eq(marketDataObservationHistory.dataContractId, YAHOO_CANONICAL_CONTRACT_ID),
        like(marketDataObservationHistory.source, "%Yahoo Finance%"),
      )),
    ]);
    const current = state[0];
    return {
      providerId: YFINANCE_COMMUNITY_PROVIDER_ID,
      providerLabel: YFINANCE_COMMUNITY_LABEL,
      officialYahooApi: false,
      dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
      canonicalModuleId: YAHOO_CANONICAL_MODULE_ID,
      lastStatus: current?.lastStatus ?? "never",
      available: current?.lastStatus === "succeeded",
      lastAttemptAt: current?.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: current?.lastSuccessAt?.toISOString() ?? null,
      lastError: current?.lastError ?? null,
      persistedObservationCount: Number(countRows[0]?.count ?? 0),
      storage: "database" as const,
      boundary: "社区版 yfinance 不是 Yahoo 官方 API；只有实际成功查询才标记可用，所有功能共用一个规范 OHLCV 合同且按内容哈希去重。",
    };
  } catch {
    const ledger = await readLocalLedger();
    return {
      providerId: YFINANCE_COMMUNITY_PROVIDER_ID,
      providerLabel: YFINANCE_COMMUNITY_LABEL,
      officialYahooApi: false,
      dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
      canonicalModuleId: YAHOO_CANONICAL_MODULE_ID,
      lastStatus: ledger.lastStatus,
      available: ledger.lastStatus === "succeeded",
      lastAttemptAt: ledger.lastAttemptAt,
      lastSuccessAt: ledger.lastSuccessAt,
      lastError: ledger.lastError,
      persistedObservationCount: ledger.observations.length,
      storage: "local-persistent-fallback" as const,
      boundary: "社区版 yfinance 不是 Yahoo 官方 API；开发环境无数据库时写入 .runtime 持久账本，生产环境应配置 DATABASE_URL。",
    };
  }
}
