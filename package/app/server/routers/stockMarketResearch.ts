import { createHash } from "node:crypto";
import { z } from "zod";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { and, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { equityListings, marketDataObservationHistory } from "../../drizzle/schema";
import { fetchPublicTicker } from "../stockTickerObservation";
import { parseFredObservations } from "../fredObservationParser";
import { FINMIND_MODULE_BINDINGS } from "../../shared/finmindModuleBindings";
import { readAkShareObservations } from "../aksharePersistence";
import {
  getStockEvtsFormPreference,
  getStockFsrcWatchlist,
  getStockResearchLayout,
  getStockSecSummaryAudit,
  saveStockEvtsFormPreference,
  saveStockFsrcWatchlist,
  saveStockResearchLayout,
  saveStockSecSummaryAudit,
  type StockCoverageSnapshot,
  type StockLayoutItem,
  type StockSecSummary,
} from "../stockMarketResearchDb";

const SEC_HEADERS = {
  "User-Agent": "Finance Hub research contact@finance-hub.local",
  Accept: "application/json,text/plain,*/*",
};
const FRED_SERIES = [
  { id: "SP500", label: "标普 500", group: "equity" },
  { id: "NASDAQCOM", label: "纳斯达克综合", group: "equity" },
  { id: "VIXCLS", label: "VIX 波动率", group: "volatility" },
  { id: "DGS10", label: "10 年期国债", group: "rates" },
  { id: "BAMLH0A0HYM2", label: "高收益 OAS", group: "credit" },
] as const;
type FredDefinition = (typeof FRED_SERIES)[number];
type TickerRecord = { cik_str: number; ticker: string; title: string };
const EVTS_FORMS = [
  "8-K",
  "10-K",
  "10-Q",
  "S-1",
  "S-1/A",
  "S-3",
  "S-4",
  "424B2",
  "424B3",
  "424B5",
  "DEFM14A",
] as const;
type EvtsForm = (typeof EVTS_FORMS)[number];
const defaultEvtsForms: EvtsForm[] = ["8-K"];
let issuerCache: { at: number; rows: TickerRecord[] } | null = null;
let environmentCache: { at: number; value: any } | null = null;
let pendingEnvironment: Promise<any> | null = null;
const companyFactsCache = new Map<string, { at: number; value: any }>();

type MarketBreadthObservation = {
  observationDate: string;
  payload: Record<string, unknown>;
};

type ArchivedStockObservation = {
  ticker: string;
  securityName: string | null;
  currency: string | null;
  source: string;
  retrievedAt: string | null;
  snapshotChangePct: number | null;
  history: Array<{
    date: string;
    value: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  }>;
};

type VerifiedAShareRow = {
  id: number;
  symbol: string;
  observationDate: string;
  payload: Record<string, unknown>;
};

export function projectVerifiedAShareUniverse(
  observations: VerifiedAShareRow[],
  query = "",
  page = 0,
  limit = 30,
) {
  const verified = observations.filter(row => row.payload.frequency === "verified_market_session");
  const observedAt = verified.map(row => row.observationDate).sort().at(-1) ?? null;
  const latest = new Map<string, VerifiedAShareRow>();
  for (const row of verified) {
    if (row.observationDate !== observedAt) continue;
    const symbol = row.symbol.toUpperCase();
    if (!latest.has(symbol) || row.id > latest.get(symbol)!.id) latest.set(symbol, row);
  }
  const keyword = query.trim().toLocaleLowerCase();
  const matched = [...latest.values()].flatMap(row => {
    const name = typeof row.payload.securityName === "string"
      ? row.payload.securityName.trim()
      : typeof row.payload.name === "string" ? row.payload.name.trim() : "";
    const price = numericField(row.payload, ["value", "price", "close"]);
    if (price === null || (keyword && !row.symbol.toLocaleLowerCase().includes(keyword) && !name.toLocaleLowerCase().includes(keyword))) return [];
    return [{ ticker: row.symbol.toUpperCase(), securityName: name || null, price, currency: "CNY", observationDate: row.observationDate }];
  }).sort((left, right) => left.ticker.localeCompare(right.ticker));
  return {
    observedAt,
    total: matched.length,
    page,
    rows: matched.slice(page * limit, (page + 1) * limit),
    frequency: "verified_market_session" as const,
    realtime: false as const,
  };
}

const STOCK_PRICE_ARCHIVE_CONTRACTS = [
  ...FINMIND_MODULE_BINDINGS
    .filter(binding => binding.dataContractId.includes(".ohlcv.daily.finmind.v1"))
    .map(binding => binding.dataContractId),
  "equity.twse.snapshot.v1",
  "equity.cn.a.snapshot.akshare.v1",
  "equity.hk.snapshot.akshare.v1",
  "equity.us.snapshot.akshare.v1",
  "market.ohlcv.daily.v1",
] as const;

function numericField(payload: Record<string, unknown>, keys: string[]) {
  return numericPayloadValue(payload, keys);
}

/**
 * Read the same immutable market ledger used by the public module feed.
 * This is intentionally archive-first: a rate-limited optional live provider
 * must not make the existing EQS screen appear empty when a real observation
 * is already permanently stored.  The response remains marked daily/delayed
 * by getWatchlistRows and never claims real-time freshness.
 */
async function readArchivedWatchlistRows(
  tickers: string[],
): Promise<Map<string, ArchivedStockObservation>> {
  const db = await getDb();
  const normalized = new Set(tickers.map(sanitizeTicker).filter(Boolean));
  if (!normalized.size) return new Map();
  const listingRows = db ? await db
    .select({
      symbol: equityListings.symbol,
      name: equityListings.name,
    })
    .from(equityListings)
    .where(
      or(
        ...[...normalized].flatMap(symbol => [
          eq(equityListings.symbol, symbol),
          like(equityListings.symbol, `${symbol}.%`),
        ]),
      ),
    )
    .limit(200) : [];
  const listingNames = new Map(
    listingRows.map(row => [
      row.symbol.replace(/\.[A-Z]+$/i, "").toUpperCase(),
      row.name,
    ]),
  );
  const finmindNames = new Map(
    FINMIND_MODULE_BINDINGS.map(binding => [
      binding.symbol.toUpperCase(),
      binding.label
        .replace(/日频行情|交易日|公开快照/g, "")
        .trim(),
    ]),
  );
  const dbRows = db ? await db
    .select({
      id: marketDataObservationHistory.id,
      symbol: marketDataObservationHistory.symbol,
      observationDate: marketDataObservationHistory.observationDate,
      fetchedAt: marketDataObservationHistory.fetchedAt,
      source: marketDataObservationHistory.source,
      dataContractId: marketDataObservationHistory.dataContractId,
      payload: marketDataObservationHistory.payload,
    })
    .from(marketDataObservationHistory)
    .where(
      and(
        inArray(marketDataObservationHistory.moduleId, [
          "stock-eqs",
          "admin-market-ingestion",
        ]),
        inArray(
          marketDataObservationHistory.dataContractId,
          STOCK_PRICE_ARCHIVE_CONTRACTS as unknown as string[],
        ),
        // The connector keeps exchange identifiers in their original case
        // (e.g. sh600000), while EQS input is normalized to uppercase.
        // Query the durable DB case-insensitively instead of depending on a
        // separate local ledger to make an archived ticker readable.
        inArray(sql<string>`UPPER(${marketDataObservationHistory.symbol})`, [...normalized]),
        or(
          ne(marketDataObservationHistory.dataContractId, "equity.cn.a.snapshot.akshare.v1"),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${marketDataObservationHistory.payload}, '$.frequency')) = 'verified_market_session'`,
        ),
      ),
    )
    .orderBy(
      desc(marketDataObservationHistory.observationDate),
      desc(marketDataObservationHistory.id),
    )
    .limit(20_000) : [];
  const localRows = (await readAkShareObservations("equity.cn.a.snapshot.akshare.v1", 10_000))
    .filter(row => normalized.has(row.symbol.toUpperCase()) && row.payload.frequency === "verified_market_session")
    .map((row, index) => ({
      id: -index,
      symbol: row.symbol,
      observationDate: row.observationDate,
      fetchedAt: new Date(row.fetchedAt),
      source: row.source,
      dataContractId: row.dataContractId,
      payload: row.payload,
    }));
  const rows = [...dbRows, ...localRows].sort((a, b) =>
    b.observationDate.localeCompare(a.observationDate) || b.id - a.id);

  const historyByTicker = new Map<
    string,
    Map<string, {
      date: string;
      value: number;
      open: number | null;
      high: number | null;
      low: number | null;
      close: number | null;
      volume: number | null;
      securityName: string | null;
      currency: string | null;
      source: string;
      retrievedAt: string | null;
      snapshotChangePct: number | null;
    }>
  >();
  for (const row of rows) {
    const payload =
      row.payload && typeof row.payload === "object"
        ? row.payload as Record<string, unknown>
        : {};
    if (row.dataContractId === "equity.cn.a.snapshot.akshare.v1" &&
        payload.frequency !== "verified_market_session") continue;
    const candidate =
      typeof row.symbol === "string" && row.symbol.trim()
        ? row.symbol.trim().toUpperCase()
        : typeof payload.symbol === "string"
          ? payload.symbol.trim().toUpperCase()
          : "";
    const ticker = normalized.has(candidate)
      ? candidate
      : candidate === "BRK.B" && normalized.has("BRK-B")
        ? "BRK-B"
        : candidate === "BRK-B" && normalized.has("BRK.B")
          ? "BRK.B"
          : "";
    if (!ticker) continue;
    const close = numericField(payload, ["close", "value", "price", "最新价"]);
    if (close === null || !row.observationDate) continue;
    const byDate = historyByTicker.get(ticker) ?? new Map();
    // Rows are ordered newest-first; first row wins for a date, preventing a
    // retry/revision from being rendered twice in the same series.
    if (!byDate.has(row.observationDate)) {
      byDate.set(row.observationDate, {
        date: row.observationDate,
        value: close,
        open: numericField(payload, ["open", "OpeningPrice", "开盘价"]),
        high: numericField(payload, ["high", "HighestPrice", "最高价"]),
        low: numericField(payload, ["low", "LowestPrice", "最低价"]),
        close,
        volume: numericField(payload, ["volume", "TradeVolume", "成交量"]),
        securityName:
          typeof payload.securityName === "string"
            ? payload.securityName
            : typeof payload.name === "string"
              ? payload.name
              : finmindNames.get(ticker) ?? listingNames.get(ticker) ?? null,
        currency:
          typeof payload.currency === "string"
            ? payload.currency
            : row.dataContractId === "equity.cn.a.snapshot.akshare.v1"
              ? "CNY"
            : row.dataContractId.startsWith("equity.tw") ||
                row.dataContractId === "equity.twse.snapshot.v1" ||
                /^\d{4,6}$/.test(ticker)
              ? "TWD"
              : "USD",
        source: row.source,
        retrievedAt: row.fetchedAt?.toISOString?.() ?? null,
        snapshotChangePct: row.dataContractId === "equity.cn.a.snapshot.akshare.v1"
          ? numericField(payload, ["changePct"]) : null,
      });
    }
    historyByTicker.set(ticker, byDate);
  }

  return new Map(
    [...historyByTicker.entries()].map(([ticker, points]) => {
      const ordered = [...points.values()]
        .sort((left, right) => left.date.localeCompare(right.date))
        .slice(-252);
      const latest = ordered.at(-1);
      return [
        ticker,
        {
          ticker,
          securityName: latest?.securityName ?? null,
          currency: latest?.currency ?? null,
          source: latest?.source ?? "永久归档公开观察",
          retrievedAt: latest?.retrievedAt ?? null,
          snapshotChangePct: latest?.snapshotChangePct ?? null,
          history: ordered.map(point => ({
            date: point.date,
            value: point.value,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
          })),
        },
      ] as const;
    }),
  );
}

function numericPayloadValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = payload[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw.replace(/,/g, "").replace(/%$/, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Derive a compact market-breadth view from the immutable EQS observations.
 * This is intentionally a projection, not a second data contract: the same
 * archived rows remain the single source for price, volume and change fields.
 */
export function summarizeMarketBreadth(
  observations: MarketBreadthObservation[],
) {
  const latestDate =
    observations.map(item => item.observationDate).sort().at(-1) ?? null;
  if (!latestDate) {
    return {
      status: "unavailable" as const,
      observedAt: null,
      total: 0,
      advancing: 0,
      declining: 0,
      unchanged: 0,
      totalVolume: null,
      totalTradeValue: null,
      topAdvancers: [],
      topDecliners: [],
      sourceBoundary: "尚无已归档的股票观察；系统不生成涨跌统计。",
    };
  }
  const latest = observations.filter(
    item => item.observationDate === latestDate,
  );
  // A single public snapshot can be delivered through more than one durable
  // retry/revision row.  The EQS breadth view is a projection of the
  // observation contract, so count each exchange/symbol once instead of
  // showing duplicate movers or double-counting volume.
  const latestBySecurity = new Map<string, MarketBreadthObservation>();
  for (const item of latest) {
    const payload = item.payload;
    const symbol =
      typeof payload.symbol === "string" ? payload.symbol.trim().toUpperCase() : "";
    const exchange =
      typeof payload.exchange === "string" ? payload.exchange.trim().toUpperCase() : "";
    const key = symbol ? `${exchange}:${symbol}` : `row:${latestBySecurity.size}`;
    if (!latestBySecurity.has(key)) latestBySecurity.set(key, item);
  }
  const uniqueLatest = [...latestBySecurity.values()];
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let volume = 0;
  let tradeValue = 0;
  let hasVolume = false;
  let hasTradeValue = false;
  const movers: Array<{
    symbol: string;
    name: string | null;
    value: number | null;
    change: number;
    changePct: number | null;
  }> = [];
  for (const item of uniqueLatest) {
    const changePct = numericPayloadValue(item.payload, [
      "changePct",
      "changePercent",
      "涨跌幅",
      "涨幅",
    ]);
    const change = numericPayloadValue(item.payload, [
      "change",
      "changeVal",
      "涨跌额",
      "涨跌",
    ]);
    const direction = changePct ?? change;
    if (direction === null || direction === 0) unchanged += 1;
    else if (direction > 0) advancing += 1;
    else declining += 1;
    const rowVolume = numericPayloadValue(item.payload, [
      "volume",
      "成交量",
      "TradeVolume",
    ]);
    const rowTradeValue = numericPayloadValue(item.payload, [
      "tradeValue",
      "成交额",
      "TradeValue",
    ]);
    if (rowVolume !== null) {
      volume += rowVolume;
      hasVolume = true;
    }
    if (rowTradeValue !== null) {
      tradeValue += rowTradeValue;
      hasTradeValue = true;
    }
    const symbol =
      typeof item.payload.symbol === "string" ? item.payload.symbol : "";
    if (symbol && direction !== null) {
      movers.push({
        symbol,
        name:
          typeof item.payload.name === "string" ? item.payload.name : null,
        value: numericPayloadValue(item.payload, [
          "value",
          "close",
          "收盘价",
          "最新价",
        ]),
        change: direction,
        changePct,
      });
    }
  }
  const byChange = (left: (typeof movers)[number], right: (typeof movers)[number]) =>
    right.change - left.change;
  return {
    status: uniqueLatest.length ? ("available" as const) : ("unavailable" as const),
    observedAt: latestDate,
    total: uniqueLatest.length,
    advancing,
    declining,
    unchanged,
    totalVolume: hasVolume ? volume : null,
    totalTradeValue: hasTradeValue ? tradeValue : null,
    topAdvancers: movers
      .filter(item => item.change > 0)
      .sort(byChange)
      .slice(0, 5),
    topDecliners: movers
      .filter(item => item.change < 0)
      .sort(byChange)
      .reverse()
      .slice(0, 5),
    sourceBoundary:
      "由 EQS 已归档的交易所/公开快照按同一观察日汇总；属于日内公开快照或最近交易日统计，不等同逐笔盘口。",
  };
}

export function summarizeEqsMarketBreadth(
  observations: Array<MarketBreadthObservation & { dataContractId: string }>,
) {
  // Different exchanges can have different trading days. Never let a newer
  // Taiwan session silently replace the A-share breadth or mix the two into
  // one count. The existing EQS header states which market was aggregated.
  const aShares = observations.filter(row => row.dataContractId === "equity.cn.a.snapshot.akshare.v1");
  const taiwan = observations.filter(row => row.dataContractId === "equity.twse.snapshot.v1");
  const selected = aShares.length ? aShares : taiwan;
  return {
    ...summarizeMarketBreadth(selected),
    marketScope: aShares.length ? "A股" : taiwan.length ? "台股" : null,
  };
}

const normalizeCik = (value: string | number) =>
  String(value).replace(/\D/g, "").padStart(10, "0").slice(-10);
const sanitizeTicker = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, "")
    .slice(0, 15);

function normalizeEvtsForms(value: unknown): EvtsForm[] {
  const forms = Array.isArray(value)
    ? value.filter(
        (item): item is EvtsForm =>
          typeof item === "string" &&
          (EVTS_FORMS as readonly string[]).includes(item)
      )
    : [];
  return Array.from(new Set(forms)).length
    ? Array.from(new Set(forms))
    : defaultEvtsForms;
}
async function getWatchlistRows(
  tickers: string[],
  range: "1mo" | "3mo" | "6mo" | "1y" = "3mo",
  includeHistory = false
) {
  const normalized = Array.from(
    new Set(tickers.map(sanitizeTicker).filter(Boolean))
  ).slice(0, 20);
  const archived = await readArchivedWatchlistRows(normalized);
  type LiveStockObservation = Awaited<ReturnType<typeof fetchPublicTicker>>;
  type WatchlistFetchResult = {
    archive: ArchivedStockObservation | null;
    live: LiveStockObservation;
  };
  const results: Array<readonly [string, WatchlistFetchResult]> = await Promise.all(
    normalized.map(
      async ticker => {
        const archive = archived.get(ticker);
        // A persisted observation is already a valid EQS result.  Do not
        // block the entire terminal on a provider that is currently rate
        // limited; the next scheduled collection will refresh the same
        // contract when the provider is available again.
        if (archive?.history.length) {
          return [ticker, { archive, live: null }] as const;
        }
        const live = await fetchPublicTicker(ticker, range);
        return [ticker, { archive: null, live }] as const;
      }
    )
  );
  const map = new Map(results);
  return normalized.map(ticker => {
    const item = map.get(ticker);
    const archive = item?.archive ?? null;
    const live = item?.live ?? null;
    if (archive?.history.length) {
      const history = archive.history.slice(-120);
      const latest = history.at(-1);
      const previous = history.at(-2);
      return {
        ticker,
        securityName: archive.securityName,
        status: "available" as const,
        price: latest?.value ?? null,
        changePct:
          latest && previous && previous.value !== 0
            ? ((latest.value - previous.value) / previous.value) * 100
            : archive.snapshotChangePct,
        currency: archive.currency,
        points: history.length,
        latestDate: latest?.date ?? null,
        source: archive.source,
        retrievedAt: archive.retrievedAt,
        frequency: "daily" as const,
        realtime: false as const,
        quality: "source-observed" as const,
        history: includeHistory
          ? history.map(point => ({
              date: point.date,
              value: point.value,
              open: point.open,
              high: point.high,
              low: point.low,
              close: point.close,
              volume: point.volume,
            }))
          : [],
      };
    }
    if (live && live.history.length) {
      return {
        ticker,
        securityName:
          typeof live.meta?.longName === "string"
            ? live.meta.longName
            : typeof live.meta?.shortName === "string"
              ? live.meta.shortName
              : null,
        status: "available" as const,
        price: live.price,
        changePct: live.changePct,
        currency: live.currency,
        points: live.history.length,
        latestDate: live.history.at(-1)?.date ?? null,
        source: live.source,
        retrievedAt:
          typeof live.meta?.retrievedAt === "string"
            ? live.meta.retrievedAt
            : null,
        frequency: "daily" as const,
        realtime: false as const,
        quality: "source-observed" as const,
        // The watchlist powers both the matrix and its drill-down charts. Keep the
        // actual bounded series in the response so a successful matrix row can
        // never degrade into a false "no history" chart state.
        history: includeHistory ? live.history.slice(-120) : [],
      };
    }
    return {
      ticker,
      securityName: null,
      status: "unavailable" as const,
      price: null,
      changePct: null,
      currency: null,
      points: 0,
      latestDate: null,
      source: null,
      retrievedAt: null,
      frequency: "daily" as const,
      realtime: false as const,
      quality: "unavailable" as const,
      history: [],
    };
  });
}
function toCoverageSnapshot(
  rows: Awaited<ReturnType<typeof getWatchlistRows>>
): StockCoverageSnapshot[] {
  return rows.map(row => ({
    ticker: row.ticker,
    status: row.status,
    points: row.points,
    latestDate: row.latestDate,
  }));
}
type CoverageChange =
  | {
      ticker: string;
      type: "coverage_restored" | "coverage_lost";
      before: StockCoverageSnapshot;
      after: StockCoverageSnapshot;
    }
  | {
      ticker: string;
      type: "history_shortened";
      before: StockCoverageSnapshot;
      after: StockCoverageSnapshot;
    };

function compareCoverage(
  previous: StockCoverageSnapshot[],
  next: StockCoverageSnapshot[]
): CoverageChange[] {
  const earlier = new Map(previous.map(row => [row.ticker, row]));
  const changes: CoverageChange[] = [];
  for (const row of next) {
    const before = earlier.get(row.ticker);
    if (!before) continue;
    if (before.status !== row.status) {
      changes.push({
        ticker: row.ticker,
        type:
          row.status === "available"
            ? ("coverage_restored" as const)
            : ("coverage_lost" as const),
        before,
        after: row,
      });
    } else if (row.status === "available" && row.points < before.points) {
      changes.push({
        ticker: row.ticker,
        type: "history_shortened",
        before,
        after: row,
      });
    }
  }
  return changes;
}

export function parseStockFredCsv(csv: string, definition: FredDefinition) {
  const { history, quality } = parseFredObservations(csv, definition.id);
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;
  return {
    ...definition,
    indicatorId: `fred:${definition.id}`,
    source: "FRED" as const,
    unit:
      definition.group === "equity"
        ? ("index_points" as const)
        : ("%" as const),
    realtime: false as const,
    frequency: "daily" as const,
    value: latest?.value ?? null,
    observationDate: latest?.date ?? null,
    change:
      latest && previous
        ? Number((latest.value - previous.value).toFixed(4))
        : null,
    history: history.slice(-180),
    quality,
    status: latest ? ("available" as const) : ("unavailable" as const),
  };
}

async function getEnvironment() {
  const started = Date.now();
  const series = await Promise.all(
    FRED_SERIES.map(async definition => {
      try {
        const response = await fetch(
          `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`,
          { signal: AbortSignal.timeout(8_000) }
        );
        if (!response.ok) throw new Error(String(response.status));
        return parseStockFredCsv(await response.text(), definition);
      } catch {
        return parseStockFredCsv("", definition);
      }
    })
  );
  const retrievedAt = new Date().toISOString();
  return {
    asOf: retrievedAt,
    retrievedAt,
    schemaVersion: 1,
    observationMode: "historical" as const,
    refreshAfterMs: 30_000,
    latencyMs: Date.now() - started,
    series,
    sourceStatus: series.every(item => item.status === "available")
      ? ("available" as const)
      : series.some(item => item.status === "available")
        ? ("partial" as const)
        : ("unavailable" as const),
    sourceLabel: "FRED 公开历史观察",
    sourceBoundary:
      "仅展示实际读取的股市、波动率、利率与信用环境历史观察，不构造个券报价、实时指数、交易信号或投资结论。",
  };
}

async function cachedEnvironment() {
  const now = Date.now();
  if (environmentCache && now - environmentCache.at < 30_000)
    return environmentCache.value;
  if (pendingEnvironment) return pendingEnvironment;
  pendingEnvironment = getEnvironment()
    .then(value => {
      environmentCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      pendingEnvironment = null;
    });
  return pendingEnvironment;
}

export async function getStockDisclosureIssuers() {
  if (issuerCache && Date.now() - issuerCache.at < 6 * 60 * 60 * 1000)
    return issuerCache.rows;
  const response = await fetch(
    "https://www.sec.gov/files/company_tickers.json",
    { headers: SEC_HEADERS, signal: AbortSignal.timeout(8_000) }
  );
  if (!response.ok) throw new Error(`SEC_${response.status}`);
  const rows = Object.values(
    (await response.json()) as Record<string, TickerRecord>
  ).filter(row => row?.ticker && row?.title && Number.isFinite(row?.cik_str));
  issuerCache = { at: Date.now(), rows };
  return rows;
}

export async function getStockDisclosureIssuerFilings(cikInput: string) {
  const cik = normalizeCik(cikInput);
  const response = await fetch(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    { headers: SEC_HEADERS, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) throw new Error(`SEC_SUBMISSIONS_${response.status}`);
  const body = (await response.json()) as any;
  const recent = body?.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];
  const docs: string[] = recent.primaryDocument ?? [];
  const filings = forms
    .map((form, index) => ({
      form,
      filingDate: dates[index] ?? null,
      accessionNumber: accessions[index] ?? null,
      primaryDocument: docs[index] ?? null,
      category: /^(S-1|S-3|S-4|424B|DEFM14A)/.test(form)
        ? "capital_markets"
        : form === "8-K"
          ? "event"
          : /^10-(K|Q)$/.test(form)
            ? "financial_report"
            : "other",
    }))
    .filter(item =>
      [
        "S-1",
        "S-1/A",
        "S-3",
        "S-4",
        "424B2",
        "424B3",
        "424B5",
        "DEFM14A",
        "8-K",
        "10-K",
        "10-Q",
      ].includes(item.form)
    )
    .slice(0, 80);
  return {
    issuer: {
      cik,
      name: body.name ?? null,
      tickers: Array.isArray(body.tickers) ? body.tickers : [],
      exchanges: Array.isArray(body.exchanges) ? body.exchanges : [],
      sic: body.sic ?? null,
      sicDescription: body.sicDescription ?? null,
    },
    filings,
    sourceStatus: "available" as const,
    sourceBoundary:
      "仅展示 SEC 实际返回的主体与申报元数据；不把申报目录解释为市场影响、估值、评级或交易结论。",
  };
}

function toPlainText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
async function getFilingText(input: {
  cik: string;
  accessionNumber: string;
  primaryDocument: string;
}) {
  const cik = normalizeCik(input.cik);
  const accession = input.accessionNumber.replace(/\D/g, "");
  if (!accession || !input.primaryDocument)
    throw new Error("SEC_IDENTIFIER_REQUIRED");
  const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${encodeURIComponent(input.primaryDocument)}`;
  const response = await fetch(sourceUrl, {
    headers: SEC_HEADERS,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`SEC_FILING_${response.status}`);
  return {
    cik,
    sourceUrl,
    text: toPlainText(await response.text()),
    retrievedAt: new Date(),
  };
}
async function getFilingExcerpt(input: {
  cik: string;
  accessionNumber: string;
  primaryDocument: string;
  keyword: string;
}) {
  const filing = await getFilingText(input);
  const key = input.keyword.trim().toLowerCase();
  const index = filing.text.toLowerCase().indexOf(key);
  const excerpt =
    index < 0
      ? null
      : filing.text.slice(
          Math.max(0, index - 420),
          Math.min(filing.text.length, index + key.length + 900)
        );
  return {
    status: excerpt ? ("available" as const) : ("not_found" as const),
    excerpt,
    sourceUrl: filing.sourceUrl,
    retrievedAt: filing.retrievedAt.toISOString(),
    sourceBoundary: excerpt
      ? "终端内只展示关键词附近的受限长度 SEC 原文片段；不重述或推断法律、交易或市场含义。"
      : "当前主文件未命中关键词；系统不以摘要或虚构证据替代。",
  };
}

const STOCK_LAYOUT_IDS = [
  "environment",
  "ticker",
  "issuer",
  "facts",
  "filing",
] as const;
const layoutItemSchema = z.object({
  id: z.enum(STOCK_LAYOUT_IDS),
  visible: z.boolean(),
});
const workspaceLayoutSchema = z.object({
  layout: z
    .array(layoutItemSchema)
    .length(STOCK_LAYOUT_IDS.length)
    .superRefine((items, ctx) => {
      const ids = new Set(items.map(item => item.id));
      if (
        ids.size !== STOCK_LAYOUT_IDS.length ||
        STOCK_LAYOUT_IDS.some(id => !ids.has(id))
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "布局必须恰好包含每一张可配置研究卡片一次。",
        });
    }),
});
export function validateStockWorkspaceLayout(value: unknown) {
  return workspaceLayoutSchema.safeParse(value);
}
const summarySchema = {
  type: "object" as const,
  properties: {
    headline: { type: "string" },
    headlineEvidence: { type: "string" },
    keyPoints: {
      type: "array",
      items: {
        type: "object",
        properties: { point: { type: "string" }, evidence: { type: "string" } },
        required: ["point", "evidence"],
        additionalProperties: false,
      },
      maxItems: 4,
    },
    financialFacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          period: { type: "string" },
          value: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["label", "period", "value", "evidence"],
        additionalProperties: false,
      },
      maxItems: 4,
    },
    riskAlerts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["category", "evidence"],
        additionalProperties: false,
      },
      maxItems: 4,
    },
    sourceLimitations: { type: "string" },
  },
  required: [
    "headline",
    "headlineEvidence",
    "keyPoints",
    "financialFacts",
    "riskAlerts",
    "sourceLimitations",
  ],
  additionalProperties: false,
};

const normalise = (value: string) => value.replace(/\s+/g, " ").trim();
function evidencePresent(evidence: string, source: string) {
  const normalized = normalise(evidence);
  return normalized.length >= 12 && normalise(source).includes(normalized);
}
function selectSummarySource(text: string) {
  const slices = [text.slice(0, 6_500)];
  const anchors = [
    /item\s+1a\s*[.:-]?\s*risk factors/i,
    /item\s+7\s*[.:-]?\s*management/i,
    /consolidated\s+(statements|financial)/i,
  ];
  for (const pattern of anchors) {
    const index = text.search(pattern);
    if (index >= 0)
      slices.push(
        text.slice(
          Math.max(0, index - 700),
          Math.min(text.length, index + 5_600)
        )
      );
  }
  return Array.from(new Set(slices.filter(Boolean)))
    .join("\n\n[章节节选]\n\n")
    .slice(0, 22_000);
}
export function validateStockSecSummary(
  value: unknown,
  source: string
): StockSecSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as any;
  if (
    typeof raw.headline !== "string" ||
    typeof raw.headlineEvidence !== "string" ||
    typeof raw.sourceLimitations !== "string" ||
    !evidencePresent(raw.headlineEvidence, source)
  )
    return null;
  const keyPoints = Array.isArray(raw.keyPoints)
    ? raw.keyPoints
        .filter(
          (row: any) =>
            typeof row?.point === "string" &&
            typeof row?.evidence === "string" &&
            evidencePresent(row.evidence, source)
        )
        .slice(0, 4)
        .map((row: any) => ({
          point: row.point.slice(0, 280),
          evidence: row.evidence.slice(0, 480),
        }))
    : [];
  const financialFacts = Array.isArray(raw.financialFacts)
    ? raw.financialFacts
        .filter(
          (row: any) =>
            ["label", "period", "value", "evidence"].every(
              key => typeof row?.[key] === "string"
            ) && evidencePresent(row.evidence, source)
        )
        .slice(0, 4)
        .map((row: any) => ({
          label: row.label.slice(0, 120),
          period: row.period.slice(0, 80),
          value: row.value.slice(0, 120),
          evidence: row.evidence.slice(0, 480),
        }))
    : [];
  const riskAlerts = Array.isArray(raw.riskAlerts)
    ? raw.riskAlerts
        .filter(
          (row: any) =>
            typeof row?.category === "string" &&
            typeof row?.evidence === "string" &&
            evidencePresent(row.evidence, source)
        )
        .slice(0, 4)
        .map((row: any) => ({
          category: row.category.slice(0, 120),
          evidence: row.evidence.slice(0, 480),
        }))
    : [];
  if (keyPoints.length + financialFacts.length + riskAlerts.length === 0)
    return null;
  return {
    headline: raw.headline.slice(0, 280),
    headlineEvidence: raw.headlineEvidence.slice(0, 480),
    keyPoints,
    financialFacts,
    riskAlerts,
    sourceLimitations: raw.sourceLimitations.slice(0, 280),
  };
}

async function summarizeStockSecFiling(input: {
  userId: number;
  cik: string;
  accessionNumber: string;
  primaryDocument: string;
}) {
  const filing = await getFilingText(input);
  const sourceFingerprint = createHash("sha256")
    .update(filing.text)
    .digest("hex");
  const sourceForModel = selectSummarySource(filing.text);
  const existing = await getStockSecSummaryAudit({
    ...input,
    cik: filing.cik,
    sourceFingerprint,
  });
  const cachedSummary = existing
    ? validateStockSecSummary(existing.summary, sourceForModel)
    : null;
  if (existing && cachedSummary)
    return {
      status: "available" as const,
      cached: true,
      summary: cachedSummary,
      model: existing.model,
      sourceFingerprint,
      retrievedAt: existing.retrievedAt.toISOString(),
      sourceBoundary:
        "摘要仅基于本次来源指纹对应的 SEC 主文件重点章节节选。标题、财务事实和风险提示均保留原文证据片段；不构成法律、会计、估值、评级、市场影响或投资结论。",
    };
  const catalog = await listLLMModels();
  const model =
    catalog.data.find(item => item.id === "gpt-5-mini")?.id ??
    catalog.data.find(item => item.id.startsWith("gpt-5"))?.id;
  if (!model) throw new Error("LLM_MODEL_UNAVAILABLE");
  const response = await invokeLLM({
    model,
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content:
          "你是审计型 SEC 申报阅读助手。只能依据给定文本，输出中文 JSON。不得预测、给出交易或投资建议、估值、评级、法律意见，或补充未披露事实。headline、point、label、period、value、category 和 sourceLimitations 使用中文；所有 evidence 与 headlineEvidence 必须保留来源原始语言，并从给定文本逐字、连续复制，不得翻译、改写、添加引号、插入省略号或拼接不同位置的片段。",
      },
      {
        role: "user",
        content: `请按给定 JSON Schema 摘要下列 SEC 主文件重点章节节选。文件标识：CIK ${filing.cik}；文件编号 ${input.accessionNumber}；主文件 ${input.primaryDocument}。只使用给定文本：\n${sourceForModel}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "stock_sec_filing_summary",
        strict: true,
        schema: summarySchema,
      },
    },
  });
  const content = response.choices[0]?.message.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : null;
  const summary = validateStockSecSummary(parsed, sourceForModel);
  if (!summary) throw new Error("LLM_SUMMARY_EVIDENCE_INSUFFICIENT");
  await saveStockSecSummaryAudit({
    ...input,
    cik: filing.cik,
    sourceFingerprint,
    model,
    summary,
    retrievedAt: filing.retrievedAt,
  });
  return {
    status: "available" as const,
    cached: false,
    summary,
    model,
    sourceFingerprint,
    retrievedAt: filing.retrievedAt.toISOString(),
    sourceBoundary:
      "摘要仅基于本次来源指纹对应的 SEC 主文件重点章节节选。标题、财务事实和风险提示均保留原文证据片段；不构成法律、会计、估值、评级、市场影响或投资结论。",
  };
}

const COMPANY_FACT_DEFINITIONS = [
  {
    id: "RevenueFromContractWithCustomerExcludingAssessedTax",
    label: "合同客户收入（不含代征税）",
    kind: "duration",
  },
  {
    id: "Revenues",
    label: "营业总收入（Revenues 独立口径）",
    kind: "duration",
  },
  { id: "NetIncomeLoss", label: "净利润", kind: "duration" },
  { id: "Assets", label: "资产总额", kind: "instant" },
  { id: "Liabilities", label: "负债总额", kind: "instant" },
  { id: "StockholdersEquity", label: "股东权益", kind: "instant" },
  { id: "EarningsPerShareDiluted", label: "稀释每股收益", kind: "duration" },
  {
    id: "EntityCommonStockSharesOutstanding",
    label: "普通股流通股数",
    kind: "instant",
  },
] as const;

function companyFactDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function normalizeStockCompanyFacts(body: any, cikInput: string) {
  const cik = normalizeCik(cikInput);
  const facts = body?.facts?.["us-gaap"] ?? {};
  const hash = (values: unknown[]) =>
    createHash("sha256")
      .update(JSON.stringify(values))
      .digest("hex")
      .slice(0, 24);
  const metrics = COMPANY_FACT_DEFINITIONS.flatMap(definition => {
    const units = facts[definition.id]?.units ?? {};
    const sourceUnit = ["USD", "USD/shares", "shares"].find(unit =>
      Array.isArray(units[unit])
    );
    if (!sourceUnit) return [];
    const seen = new Set<string>();
    const rows = (units[sourceUnit] as any[])
      .flatMap(row => {
        if (
          !row ||
          !["10-K", "10-Q", "10-K/A", "10-Q/A"].includes(row.form) ||
          typeof row.val !== "number" ||
          !Number.isFinite(row.val)
        )
          return [];
        const end = companyFactDate(row.end);
        const start = companyFactDate(row.start);
        if (!end || (row.start != null && (!start || start > end))) return [];
        const filed = companyFactDate(row.filed);
        const durationDays = start
          ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
          : null;
        // fy/fp describe the filing's fiscal context, not this fact's duration.
        // A 10-Q may include both one-quarter and year-to-date observations.
        const periodType =
          durationDays === null
            ? definition.kind === "instant"
              ? "instant"
              : "unknown"
            : durationDays >= 70 && durationDays <= 110
              ? "quarter"
              : durationDays >= 150 && durationDays <= 210
                ? "half_year"
                : durationDays >= 240 && durationDays <= 300
                  ? "nine_months"
                  : durationDays >= 330 && durationDays <= 385
                    ? "annual"
                    : "other";
        const accessionNumber =
          typeof row.accn === "string" && row.accn.trim()
            ? row.accn.trim()
            : null;
        const fy = Number.isInteger(row.fy) ? row.fy : null;
        const fp = typeof row.fp === "string" ? row.fp : null;
        const frame = typeof row.frame === "string" ? row.frame : null;
        const periodId = `sec-period:${hash([cik, definition.id, sourceUnit, start, end])}`;
        const id = `sec-fact:${hash([cik, definition.id, sourceUnit, start, end, row.val, filed, row.form, accessionNumber, fy, fp, frame])}`;
        // Different periods, accession numbers, amendments, or values are
        // separate evidence records. Never collapse them using end date alone.
        if (seen.has(id)) return [];
        seen.add(id);
        return [
          {
            id,
            periodId,
            start,
            end,
            durationDays,
            periodType,
            fy,
            fp,
            filed,
            filingDate: filed,
            value: row.val as number,
            form: row.form as string,
            accessionNumber,
            accn: accessionNumber,
            frame,
          },
        ];
      })
      .sort(
        (left, right) =>
          left.end.localeCompare(right.end) ||
          (left.start ?? "").localeCompare(right.start ?? "") ||
          (left.filed ?? "").localeCompare(right.filed ?? "") ||
          (left.accessionNumber ?? "").localeCompare(
            right.accessionNumber ?? ""
          ) ||
          left.id.localeCompare(right.id)
      );
    if (!rows.length) return [];
    const observations = rows.slice(-120);
    return [
      {
        id: definition.id,
        label: definition.label,
        unit: sourceUnit === "USD/shares" ? "USD/share" : sourceUnit,
        sourceUnit,
        periodKind: definition.kind,
        latestObservationDate: rows.at(-1)!.end,
        totalObservations: rows.length,
        truncatedObservations: Math.max(0, rows.length - observations.length),
        observations,
      },
    ];
  }).sort((left, right) =>
    right.latestObservationDate.localeCompare(left.latestObservationDate)
  );
  return {
    issuer: { cik, name: body?.entityName ?? null },
    metrics,
    sourceStatus: "available" as const,
    sourceBoundary:
      "仅展示 SEC XBRL 实际标准化事实与起止报告期；不同报告区间和申报版本分别保留。fy/fp 是申报财政期，不代表每条观察的持续期间；不混入前瞻预测、调整后口径、估值或市场价格。",
  };
}

export async function getStockDisclosureCompanyFacts(cikInput: string) {
  const cik = normalizeCik(cikInput);
  const cached = companyFactsCache.get(cik);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  const response = await fetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    { headers: SEC_HEADERS, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) throw new Error(`SEC_FACTS_${response.status}`);
  const value = normalizeStockCompanyFacts(await response.json(), cik);
  companyFactsCache.set(cik, { at: Date.now(), value });
  return value;
}

function selectedFact(
  facts: any,
  id: string,
  periodType?: "annual" | "instant"
) {
  const metric = (facts?.metrics ?? []).find((item: any) => item.id === id);
  const observations = (metric?.observations ?? []).filter(
    (item: any) => !periodType || item.periodType === periodType
  );
  const row = observations.at(-1) ?? null;
  return row
    ? {
        value: Number(row.value),
        end: row.end as string,
        filed: row.filed as string | null,
        form: row.form as string,
        unit: metric.unit as string,
      }
    : null;
}

export function deriveStockFundamentalSnapshot(facts: any) {
  const annualNetIncome = selectedFact(facts, "NetIncomeLoss", "annual");
  const annualEpsMetric = (facts?.metrics ?? []).find(
    (item: any) => item.id === "EarningsPerShareDiluted"
  );
  const annualEpsRows: any[] = Array.from(
    ((annualEpsMetric?.observations ?? []) as any[])
      .filter((item: any) => item.periodType === "annual")
      .reduce(
        (map: Map<string, any>, item: any) => map.set(item.end, item),
        new Map()
      )
      .values() as Iterable<any>
  ).sort((left: any, right: any) => left.end.localeCompare(right.end));
  const annualEps = annualEpsRows.at(-1) ?? null;
  const previousAnnualEps =
    annualEpsRows.length > 1 ? annualEpsRows.at(-2) : null;
  const assets = selectedFact(facts, "Assets", "instant");
  const liabilities = selectedFact(facts, "Liabilities", "instant");
  const equity = selectedFact(facts, "StockholdersEquity", "instant");
  const shares = selectedFact(
    facts,
    "EntityCommonStockSharesOutstanding",
    "instant"
  );
  const ratio = (
    numerator: number | undefined,
    denominator: number | undefined
  ) =>
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    Number(denominator) !== 0
      ? Number(((Number(numerator) / Number(denominator)) * 100).toFixed(4))
      : null;
  return {
    annualEps: annualEps ? Number(annualEps.value) : null,
    annualEpsGrowthPct:
      annualEps && previousAnnualEps
        ? ratio(
            Number(annualEps.value) - Number(previousAnnualEps.value),
            Math.abs(Number(previousAnnualEps.value))
          )
        : null,
    annualNetIncome: annualNetIncome?.value ?? null,
    assets: assets?.value ?? null,
    liabilities: liabilities?.value ?? null,
    equity: equity?.value ?? null,
    sharesOutstanding: shares?.value ?? null,
    roePct: ratio(annualNetIncome?.value, equity?.value),
    liabilitiesToAssetsPct: ratio(liabilities?.value, assets?.value),
    fiscalPeriodEnd: annualEps?.end ?? annualNetIncome?.end ?? null,
    latestBalanceDate: assets?.end ?? equity?.end ?? liabilities?.end ?? null,
    filedAt:
      annualEps?.filed ?? annualNetIncome?.filed ?? assets?.filed ?? null,
    form: annualEps?.form ?? annualNetIncome?.form ?? assets?.form ?? null,
    sourceStatus:
      facts?.sourceStatus === "available"
        ? ("available" as const)
        : ("unavailable" as const),
  };
}

export const stockMarketResearchRouter = router({
  searchEqsUniverse: publicProcedure
    .input(z.object({
      query: z.string().trim().max(60).default(""),
      page: z.number().int().min(0).max(300).default(0),
      limit: z.number().int().min(1).max(50).default(30),
    }))
    .query(async ({ input }) => {
      const contract = "equity.cn.a.snapshot.akshare.v1";
      const db = await getDb();
      let observations: VerifiedAShareRow[] = [];
      if (db) {
        const scope = and(
          eq(marketDataObservationHistory.moduleId, "stock-eqs"),
          eq(marketDataObservationHistory.dataContractId, contract),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${marketDataObservationHistory.payload}, '$.frequency')) = 'verified_market_session'`,
        );
        const observedAt = (await db.select({
          date: marketDataObservationHistory.observationDate,
        }).from(marketDataObservationHistory).where(scope)
          .orderBy(desc(marketDataObservationHistory.observationDate)).limit(1))[0]?.date;
        if (observedAt) observations = await db.select({
          id: marketDataObservationHistory.id,
          symbol: marketDataObservationHistory.symbol,
          observationDate: marketDataObservationHistory.observationDate,
          payload: marketDataObservationHistory.payload,
        }).from(marketDataObservationHistory)
          .where(and(scope, eq(marketDataObservationHistory.observationDate, observedAt)))
          .orderBy(desc(marketDataObservationHistory.id))
          .limit(10_000);
      }
      if (!observations.length) {
        observations = (await readAkShareObservations(contract, 10_000)).map((row, index) => ({
          id: 10_000 - index,
          symbol: row.symbol,
          observationDate: row.observationDate,
          payload: row.payload,
        }));
      }
      return projectVerifiedAShareUniverse(observations, input.query, input.page, input.limit);
    }),
  getMarketBreadth: publicProcedure.query(async () => {
    const db = await getDb();
    let observations: Array<MarketBreadthObservation & { dataContractId: string }> = [];
    if (db) {
      for (const contract of ["equity.cn.a.snapshot.akshare.v1", "equity.twse.snapshot.v1"]) {
        const verifiedSession = contract === "equity.cn.a.snapshot.akshare.v1"
          ? sql`JSON_UNQUOTE(JSON_EXTRACT(${marketDataObservationHistory.payload}, '$.frequency')) = 'verified_market_session'`
          : undefined;
        const latest = (await db
          .select({ observationDate: marketDataObservationHistory.observationDate })
          .from(marketDataObservationHistory)
          .where(and(
            eq(marketDataObservationHistory.moduleId, "stock-eqs"),
            eq(marketDataObservationHistory.dataContractId, contract),
            verifiedSession,
          ))
          .orderBy(desc(marketDataObservationHistory.observationDate))
          .limit(1))[0]?.observationDate;
        if (!latest) continue;
        observations = await db
          .select({
            dataContractId: marketDataObservationHistory.dataContractId,
            observationDate: marketDataObservationHistory.observationDate,
            payload: marketDataObservationHistory.payload,
          })
          .from(marketDataObservationHistory)
          .where(and(
            eq(marketDataObservationHistory.moduleId, "stock-eqs"),
            eq(marketDataObservationHistory.dataContractId, contract),
            eq(marketDataObservationHistory.observationDate, latest),
            verifiedSession,
          ))
          .orderBy(desc(marketDataObservationHistory.id))
          .limit(10_000);
        if (observations.length) break;
      }
    }
    if (observations.length) return summarizeEqsMarketBreadth(observations);
    // AKShare has a durable local ledger when MySQL is unavailable. Project
    // the exact same verified A-share contract into the existing EQS breadth
    // view; an empty primary DB is not evidence of an empty market.
    const local = (await readAkShareObservations("equity.cn.a.snapshot.akshare.v1", 10_000))
      .filter(row => row.payload.frequency === "verified_market_session");
    return summarizeEqsMarketBreadth(local.map(row => ({
      dataContractId: row.dataContractId,
      observationDate: row.observationDate,
      payload: row.payload,
    })));
  }),
  getWorkspaceLayout: protectedProcedure.query(async ({ ctx }) => {
    const layout = await getStockResearchLayout(ctx.user.id);
    return {
      layout: (layout?.layout ?? null) as StockLayoutItem[] | null,
      updatedAt: layout?.updatedAt?.toISOString() ?? null,
    };
  }),
  saveWorkspaceLayout: protectedProcedure
    .input(workspaceLayoutSchema)
    .mutation(async ({ ctx, input }) => {
      const layout = await saveStockResearchLayout(ctx.user.id, input.layout);
      return {
        layout: layout?.layout as StockLayoutItem[],
        updatedAt: layout?.updatedAt?.toISOString() ?? null,
      };
    }),
  getTickerObservation: publicProcedure
    .input(
      z.object({
        ticker: z.string().trim().min(1).max(15),
        range: z.enum(["1mo", "3mo", "6mo", "1y", "2y", "5y"]).default("6mo"),
        assetClass: z.enum(["stocks", "etf"]).default("stocks"),
      })
    )
    .query(async ({ input }) => {
      const ticker = sanitizeTicker(input.ticker);
      if (!ticker)
        return {
          status: "unavailable" as const,
          ticker: input.ticker,
          observation: null,
          sourceBoundary: "证券代码格式无效；系统不以示例证券或替代价格填充。",
        };
      const result = await fetchPublicTicker(
        ticker,
        input.range,
        input.assetClass
      );
      if (!result?.history.length)
        return {
          status: "unavailable" as const,
          ticker,
          observation: null,
          sourceBoundary:
            "当前无法读取该代码的公共日频观察；系统不生成模拟 OHLC、盘口或可执行报价。",
        };
      const meta = result.meta as any;
      const latest = result.history.at(-1)!;
      const previous = result.history.at(-2);
      const change = previous ? latest.value - previous.value : null;
      // One daily snapshot: do not combine an intraday headline quote with a daily chart.
      return {
        status: "available" as const,
        ticker,
        observation: {
          ticker,
          name: meta.longName ?? meta.shortName ?? ticker,
          exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
          currency: result.currency,
          price: latest.value,
          change,
          changePct:
            change !== null && previous
              ? (change / previous.value) * 100
              : null,
          dayHigh: latest.high,
          dayLow: latest.low,
          volume: latest.volume,
          regularMarketTime: null,
          observationDate: latest.date,
          retrievedAt: String(meta.retrievedAt),
          frequency: "daily" as const,
          realtime: false as const,
          adjustment: "source-defined" as const,
          source: result.source,
          history: result.history,
        },
        sourceLabel: result.source,
        sourceBoundary:
          "实际来源的日频历史收盘及原始OHLC/成交量；定期重读不代表行情实时。非盘口、ETF净值或含分红总回报；市场时间未返回时不以读取时间冒充。",
      };
    }),
  getWatchlistObservations: publicProcedure
    .input(
      z.object({
        tickers: z.array(z.string().trim().min(1).max(15)).min(1).max(20),
        range: z.enum(["1mo", "3mo", "6mo", "1y"]).default("3mo"),
        includeHistory: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => ({
      rows: await getWatchlistRows(
        input.tickers,
        input.range,
        input.includeHistory
      ),
      sourceBoundary:
        "仅显示服务器当前实际读取到的公共观察状态，不生成全市场排名、模拟筛选结果或交易信号。",
    })),
  getWatchlistFundamentals: publicProcedure
    .input(
      z.object({
        tickers: z.array(z.string().trim().min(1).max(15)).min(1).max(20),
      })
    )
    .query(async ({ input }) => {
      const tickers = Array.from(
        new Set(input.tickers.map(sanitizeTicker).filter(Boolean))
      ).slice(0, 20);
      try {
        const issuers = await getStockDisclosureIssuers();
        const byTicker = new Map(
          issuers.map(issuer => [issuer.ticker.toUpperCase(), issuer])
        );
        const rows = await Promise.all(
          tickers.map(async ticker => {
            const issuer =
              byTicker.get(ticker) ?? byTicker.get(ticker.replace(".", "-"));
            if (!issuer)
              return {
                ticker,
                cik: null,
                issuerName: null,
                status: "unavailable" as const,
                reason: "SEC 主体目录没有唯一匹配。",
                snapshot: null,
              };
            const cik = normalizeCik(issuer.cik_str);
            try {
              const facts = await getStockDisclosureCompanyFacts(cik);
              return {
                ticker,
                cik,
                issuerName: issuer.title,
                status: "available" as const,
                reason: null,
                snapshot: deriveStockFundamentalSnapshot(facts),
              };
            } catch {
              return {
                ticker,
                cik,
                issuerName: issuer.title,
                status: "unavailable" as const,
                reason: "SEC XBRL 公司事实当前不可读。",
                snapshot: null,
              };
            }
          })
        );
        return {
          rows,
          retrievedAt: new Date().toISOString(),
          sourceLabel: "SEC EDGAR XBRL companyfacts",
          sourceBoundary:
            "基本面字段仅来自 SEC XBRL 标准化事实。年度 EPS、净利润、资产、负债、权益及流通股数分别保留报告期和申报日；简单 P/E 仅在正年度稀释 EPS 与公共价格同时可读时计算，不等同 TTM、调整后或一致预期口径。",
        };
      } catch {
        return {
          rows: tickers.map(ticker => ({
            ticker,
            cik: null,
            issuerName: null,
            status: "unavailable" as const,
            reason: "SEC 主体目录当前不可读。",
            snapshot: null,
          })),
          retrievedAt: new Date().toISOString(),
          sourceLabel: "SEC EDGAR XBRL companyfacts",
          sourceBoundary:
            "SEC 来源当前不可读；系统不以缓存样本、固定财务比率或估算值替代。",
        };
      }
    }),
  getEvtsFormPreference: protectedProcedure.query(async ({ ctx }) => {
    const preference = await getStockEvtsFormPreference(ctx.user.id);
    return {
      forms: normalizeEvtsForms(preference?.preferenceValue?.forms),
      updatedAt: preference?.updatedAt?.toISOString() ?? null,
    };
  }),
  saveEvtsFormPreference: protectedProcedure
    .input(
      z.object({
        forms: z.array(z.enum(EVTS_FORMS)).min(1).max(EVTS_FORMS.length),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const preference = await saveStockEvtsFormPreference(ctx.user.id, {
        forms: normalizeEvtsForms(input.forms),
      });
      return {
        forms: normalizeEvtsForms(preference?.preferenceValue?.forms),
        updatedAt: preference?.updatedAt?.toISOString() ?? null,
      };
    }),
  getFsrcWatchlist: protectedProcedure.query(async ({ ctx }) => {
    const watchlist = await getStockFsrcWatchlist(ctx.user.id);
    return {
      exists: Boolean(watchlist),
      tickers: watchlist?.tickers ?? [],
      coverageSnapshot: watchlist?.coverageSnapshot ?? [],
      updatedAt: watchlist?.updatedAt?.toISOString() ?? null,
    };
  }),
  saveFsrcWatchlist: protectedProcedure
    .input(
      z.object({
        tickers: z.array(z.string().trim().min(1).max(15)).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getStockFsrcWatchlist(ctx.user.id);
      const rows = await getWatchlistRows(input.tickers);
      const coverageSnapshot = toCoverageSnapshot(rows);
      const coverageChanges = existing
        ? compareCoverage(existing.coverageSnapshot, coverageSnapshot)
        : [];
      const saved = await saveStockFsrcWatchlist({
        userId: ctx.user.id,
        tickers: coverageSnapshot.map(row => row.ticker),
        coverageSnapshot,
      });
      return {
        tickers: saved?.tickers ?? [],
        rows,
        coverageSnapshot,
        coverageChanges,
        updatedAt: saved?.updatedAt?.toISOString() ?? null,
        sourceBoundary:
          "清单只保存当前账户主动选择的代码与最近覆盖快照；价格和完整历史不写入账户数据库。",
      };
    }),
  refreshFsrcWatchlist: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await getStockFsrcWatchlist(ctx.user.id);
    if (!existing)
      return {
        status: "missing" as const,
        rows: [],
        coverageChanges: [],
        updatedAt: null,
        sourceBoundary: "当前账户尚未保存 FSRC 清单；请先核验并保存代码清单。",
      };
    const rows = await getWatchlistRows(existing.tickers);
    const coverageSnapshot = toCoverageSnapshot(rows);
    const coverageChanges = compareCoverage(
      existing.coverageSnapshot,
      coverageSnapshot
    );
    const saved = await saveStockFsrcWatchlist({
      userId: ctx.user.id,
      tickers: coverageSnapshot.map(row => row.ticker),
      coverageSnapshot,
    });
    return {
      status: "available" as const,
      rows,
      coverageChanges,
      updatedAt: saved?.updatedAt?.toISOString() ?? null,
      sourceBoundary:
        "覆盖变化仅比较当前服务器实际读取的状态、历史点数和最近观测日期；不以缓存样本或价格变化制造提醒。",
    };
  }),
  getEnvironment: publicProcedure.query(cachedEnvironment),
  searchIssuers: publicProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(80),
        limit: z.number().int().min(1).max(30).default(12),
      })
    )
    .query(async ({ input }) => {
      try {
        const token = input.query.toLowerCase();
        const cikToken = token.replace(/\D/g, "");
        const rows = await getStockDisclosureIssuers();
        return {
          status: "available" as const,
          results: rows
            .filter(
              row =>
                row.ticker.toLowerCase().includes(token) ||
                row.title.toLowerCase().includes(token) ||
                (cikToken.length > 0 &&
                  normalizeCik(row.cik_str).includes(cikToken))
            )
            .slice(0, input.limit)
            .map(row => ({
              cik: normalizeCik(row.cik_str),
              ticker: row.ticker,
              name: row.title,
            })),
          sourceBoundary:
            "SEC 上市主体目录只用于识别与公开披露核验，不表示证券覆盖或可交易性。",
        };
      } catch {
        return {
          status: "unavailable" as const,
          results: [],
          sourceBoundary: "当前无法读取 SEC 主体目录；系统不显示示例主体。",
        };
      }
    }),
  getIssuerFilings: publicProcedure
    .input(
      z.object({
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getStockDisclosureIssuerFilings(input.cik);
      } catch {
        return {
          issuer: null,
          filings: [],
          sourceStatus: "unavailable" as const,
          sourceBoundary:
            "当前无法读取 SEC 申报目录；系统不显示缓存样本或替代事件。",
        };
      }
    }),
  getFilingExcerpt: publicProcedure
    .input(
      z.object({
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/),
        accessionNumber: z.string().trim().min(10).max(32),
        primaryDocument: z.string().trim().min(1).max(240),
        keyword: z.string().trim().min(2).max(80),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getFilingExcerpt(input);
      } catch {
        return {
          status: "unavailable" as const,
          excerpt: null,
          sourceUrl: null,
          retrievedAt: new Date().toISOString(),
          sourceBoundary:
            "当前无法读取主文件正文；系统不显示虚构摘录或第三方页面内容。",
        };
      }
    }),
  getCompanyFacts: publicProcedure
    .input(
      z.object({
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getStockDisclosureCompanyFacts(input.cik);
      } catch {
        return {
          issuer: null,
          metrics: [],
          sourceStatus: "unavailable" as const,
          sourceBoundary:
            "当前无法读取 SEC XBRL 公司事实；系统不以估算值、缓存样本或预测替代。",
        };
      }
    }),
  summarizeFiling: protectedProcedure
    .input(
      z.object({
        cik: z
          .string()
          .trim()
          .regex(/^\d{1,10}$/),
        accessionNumber: z.string().trim().min(10).max(32),
        primaryDocument: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await summarizeStockSecFiling({ ...input, userId: ctx.user.id });
      } catch {
        return {
          status: "unavailable" as const,
          cached: false,
          summary: null,
          model: null,
          sourceFingerprint: null,
          retrievedAt: new Date().toISOString(),
          sourceBoundary:
            "当前无法基于可读 SEC 主文件生成带来源证据的结构化摘要；系统不显示替代摘要、预测或未核验风险结论。",
        };
      }
    }),
});
