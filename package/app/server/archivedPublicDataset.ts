import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { managedPublicDatasetStates, marketDataObservationHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { MANAGED_PUBLIC_DATASETS } from "./adminPublicDatasetIngestion";
import { FINMIND_MODULE_BINDINGS } from "../shared/finmindModuleBindings";
import { displayTaiwanDerivativeUnderlyingName } from "../shared/taiwanDerivativeNames";
import { readAkShareObservations } from "./aksharePersistence";
import { readFinceptObservations } from "./finceptPersistence";
import { readPublicDatasetObservations } from "./publicDatasetPersistence";

type ArchiveContract = (typeof MANAGED_PUBLIC_DATASETS)[number] | {
  id: string; stateId: string; label: string; moduleId: string; dataContractId: string; dataScopeKey: string; symbol: string; frequency: string; pollMinutes: number; sourceBoundary: string;
};
const contracts = new Map<string, ArchiveContract>();
for (const dataset of MANAGED_PUBLIC_DATASETS) contracts.set(String(dataset.dataContractId), dataset);
for (const binding of FINMIND_MODULE_BINDINGS) contracts.set(binding.dataContractId, {
  id: binding.id, stateId: `finmind:${binding.id}`, label: binding.label, moduleId: binding.moduleId, dataContractId: binding.dataContractId,
  dataScopeKey: binding.dataScopeKey, symbol: binding.symbol, frequency: binding.frequency, pollMinutes: 30, sourceBoundary: binding.freshness,
});

type ArchiveRow = {
  id: number;
  symbol?: string;
  observationDate: string;
  fetchedAt: Date;
  source?: string | null;
  payload: unknown;
};
export function projectArchivedPublicObservations(rows: ArchiveRow[]) {
  const unique = new Map<string, ArchiveRow>();
  for (const row of [...rows].sort((a, b) => b.id - a.id)) {
    const raw = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {};
    const identity = `${row.symbol ?? (typeof raw.symbol === 'string' ? raw.symbol : '')}|${row.observationDate}`;
    if (!unique.has(identity)) unique.set(identity, row);
  }
  return [...unique.values()].sort((a, b) => a.observationDate.localeCompare(b.observationDate)).map(row => {
    const raw = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {};
    const payload: Record<string, number | string | null> = {};
    for (const key of ['value', 'usd', 'eur', 'cny', 'jpy', 'index', 'price', 'currentPrice', 'close', 'open', 'high', 'low', 'volume', 'change', 'changePct', 'priceChange', 'priceChangePercent', 'bid', 'ask', 'previousClose', 'change1h', 'change7d', 'marketCap', 'volume24h', 'circulatingSupply', 'maxSupply', 'ath', 'athDate', 'rank', 'coinId', 'pe', 'pbr', 'dividendYield', 'dividendYear', 'fiscalYearQuarter', 'cashDividend', 'contractMonth', 'contractDate', 'contractName', 'strikePrice', 'optionType', 'settlementPrice', 'tradingSession', 'openInterest', 'producerLong', 'producerShort', 'producerNet', 'swapLong', 'swapShort', 'swapNet', 'managedMoneyLong', 'managedMoneyShort', 'managedMoneyNet', 'otherReportLong', 'otherReportShort', 'otherReportNet', 'nonReportableLong', 'nonReportableShort', 'nonReportableNet', 'marketCode', 'reportDate', 'eventType', 'eventDate', 'underlyingSymbol', 'underlyingName', 'title', 'summary', 'url', 'description', 'announcementDate', 'paymentDate', 'recordDate', 'declarationDate', 'exDividendDate', 'annualizedAmount', 'companyName', 'epsPrevious', 'epsConsensus', 'epsActual', 'numEstimates', 'periodEnding', 'previousReportDate', 'reportingTime', 'ipoDate', 'sharePrice', 'offerAmount', 'shareCount', 'expectedPriceDate', 'filedDate', 'withdrawDate', 'dealStatus', 'dealId', 'country', 'eventName', 'gmt', 'actual', 'consensus', 'previous', 'symbol', 'name', 'securityName', 'exchange', 'currency', 'base', 'quote', 'unit', 'amount', 'fixingRate', 'tradeValue', 'transaction', 'fundCode', 'fundName', 'netAssetValue', 'observationType', 'frequency', 'freshness']) {
      if (!(key in raw)) continue;
      const value = raw[key];
      payload[key] = typeof value === 'number' && Number.isFinite(value)
        ? value
        : typeof value === 'string'
          ? (key === 'underlyingName' ? displayTaiwanDerivativeUnderlyingName(value) : value).slice(0, 2_000)
          : null;
    }
    if (typeof raw.periodKind === 'string' && ['forecast', 'estimate_or_forecast', 'historical_or_estimate'].includes(raw.periodKind)) payload.periodKind = raw.periodKind;
    // Expose safe provenance to the terminal: users need to see where and
    // when a value came from, while credentials, URLs and internal audit
    // details remain server-side.
    return {
      date: row.observationDate,
      retrievedAt: row.fetchedAt.toISOString(),
      source: row.source ?? null,
      payload,
    };
  });
}

export async function readArchivedPublicDataset(dataContractId: string, limit = 240) {
  const dataset = contracts.get(dataContractId);
  if (!dataset) return { available: false, status: "not_configured" as const, observations: [] };
  const requiresVerifiedSession = dataContractId === "equity.cn.a.snapshot.akshare.v1"
    || dataContractId === "index.cn.snapshot.akshare.v1";
  const localAkShareRows = dataContractId.includes(".akshare.")
    ? (await readAkShareObservations(
      dataContractId, requiresVerifiedSession ? 10_000 : limit,
    ))
      .filter(row => !requiresVerifiedSession || row.payload.frequency === "verified_market_session")
      .slice(0, limit)
    : [];
  const localFinceptRows = dataContractId.startsWith("equity.twse.") || dataContractId.startsWith("index.twse.")
    || dataContractId === "commodity.pl.gold.nbp.daily.v1" || dataContractId === "fx.pl.usd-pln.nbp.daily.v1"
    || dataContractId === "fx.pl.multi-pln.nbp.daily.v1" || dataContractId === "fx.cz.cnb.daily-reference.v1"
    || dataContractId === "fx.il.boi.daily-reference.v1"
    || dataContractId === "derivatives.global.cftc-disaggregated.weekly.v1"
    || dataContractId === "crypto.global.coingecko.markets.daily.v1"
    || dataContractId === "index.global.cboe-volatility.daily.v1"
    || dataContractId === "index.global.cboe-delayed-snapshot.daily.v1"
    || dataContractId === "equity.global.nasdaq-screener.daily.v1"
    || dataContractId === "equity.global.nasdaq-earnings-calendar.daily.v1"
    || dataContractId === "equity.global.nasdaq-dividend-calendar.daily.v1"
    || dataContractId === "equity.global.nasdaq-ipo-calendar.monthly.v1"
    || dataContractId === "macro.global.nasdaq-economic-calendar.daily.v1"
    ? await readFinceptObservations(dataContractId, limit)
    : [];
  const localGenericRows =
    !dataContractId.includes(".akshare.") &&
    !dataContractId.startsWith("equity.twse.") &&
    !dataContractId.startsWith("index.twse.") &&
    !dataContractId.startsWith("commodity.pl.gold.nbp.") &&
    !dataContractId.startsWith("fx.pl.usd-pln.nbp.") &&
    !dataContractId.startsWith("fx.pl.multi-pln.nbp.") &&
    !dataContractId.startsWith("fx.cz.cnb.") &&
    !dataContractId.startsWith("fx.il.boi.") &&
    !dataContractId.startsWith("derivatives.global.cftc-") &&
    !dataContractId.startsWith("crypto.global.coingecko.") &&
    !dataContractId.startsWith("index.global.cboe-") &&
    !dataContractId.startsWith("equity.global.nasdaq-") &&
    !dataContractId.startsWith("macro.global.nasdaq-")
      ? await readPublicDatasetObservations(dataContractId, limit)
      : [];
  const localRows = [...localAkShareRows, ...localFinceptRows, ...localGenericRows];
  const db = await getDb();
  if (!db) {
    const observations = projectArchivedPublicObservations(localRows.map((row, index) => ({
      id: localRows.length - index,
      symbol: row.symbol,
      observationDate: row.observationDate,
      fetchedAt: new Date(row.fetchedAt),
      source: "source" in row && typeof row.source === "string" ? row.source : null,
      payload: row.payload,
    })));
    return {
      available: observations.length > 0,
      status: observations.length > 0 ? "available" as const : "storage_unavailable" as const,
      observations,
    };
  }
  const scope = and(
    eq(marketDataObservationHistory.moduleId, dataset.moduleId),
    eq(marketDataObservationHistory.dataContractId, dataContractId),
    requiresVerifiedSession
      ? sql`JSON_UNQUOTE(JSON_EXTRACT(${marketDataObservationHistory.payload}, '$.frequency')) = 'verified_market_session'`
      : undefined,
  );
  // Limit distinct periods after revision selection, not raw ledger rows.
  const latestIds = db.select({ id: sql<number>`max(${marketDataObservationHistory.id})` }).from(marketDataObservationHistory).where(scope).groupBy(marketDataObservationHistory.symbol, marketDataObservationHistory.observationDate);
  const rows = await db.select({
    id: marketDataObservationHistory.id,
    symbol: marketDataObservationHistory.symbol,
    observationDate: marketDataObservationHistory.observationDate,
    fetchedAt: marketDataObservationHistory.fetchedAt,
    source: marketDataObservationHistory.source,
    payload: marketDataObservationHistory.payload,
  }).from(marketDataObservationHistory)
    .where(and(scope, inArray(marketDataObservationHistory.id, latestIds)))
    .orderBy(desc(marketDataObservationHistory.observationDate), desc(marketDataObservationHistory.id))
    .limit(Math.min(Math.max(limit, 1), 5000));
  const isDerivativeContract = dataContractId === 'derivatives.tw.futures.daily.finmind.v1' || dataContractId === 'derivatives.tw.options.daily.finmind.v1';
  const hasContractLevelRows = isDerivativeContract && rows.some(row => row.symbol !== dataset.symbol);
  // Earlier collector versions stored every derivative contract under TX/TXO,
  // causing same-day contracts to look like revisions. Preserve those ledger
  // rows for audit, but stop projecting them once contract-level rows exist.
  const observations = projectArchivedPublicObservations(hasContractLevelRows ? rows.filter(row => row.symbol !== dataset.symbol) : rows);
  if (!observations.length && localRows.length) {
    const fallbackObservations = projectArchivedPublicObservations(localRows.map((row, index) => ({
      id: localRows.length - index,
      symbol: row.symbol,
      observationDate: row.observationDate,
      fetchedAt: new Date(row.fetchedAt),
      source: "source" in row && typeof row.source === "string" ? row.source : null,
      payload: row.payload,
    })));
    return {
      available: fallbackObservations.length > 0,
      status: fallbackObservations.length > 0 ? "available" as const : "not_collected" as const,
      observations: fallbackObservations,
    };
  }
  const collection = (await db.select({
    datasetId: managedPublicDatasetStates.datasetId,
    lastAttemptAt: managedPublicDatasetStates.lastAttemptAt,
    lastSuccessAt: managedPublicDatasetStates.lastSuccessAt,
    nextAttemptAt: managedPublicDatasetStates.nextAttemptAt,
    lastStatus: managedPublicDatasetStates.lastStatus,
  }).from(managedPublicDatasetStates).where(inArray(managedPublicDatasetStates.datasetId, ['stateId' in dataset ? dataset.stateId : dataset.id])))[0] ?? null;
  return {
    available: observations.length > 0,
    status: observations.length > 0 ? "available" as const : collection?.lastStatus === "unavailable" ? "unavailable" as const : "not_collected" as const,
    observations,
  };
}
