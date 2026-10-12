/**
 * realDataService.ts
 * 统一真实金融数据服务层
 * 数据来源：Yahoo Finance API（内置）、FRED（公开无 key）、World Bank REST API
 * 所有数据在服务端获取，前端通过 tRPC 调用
 */
import { callDataApi } from "./_core/dataApi";
import * as XLSX from "xlsx";
import { fetchYFinancePythonHistory } from "./yfinancePythonAdapter";
import {
  archiveYahooFinanceChart,
  readArchivedYahooFinanceChart,
  recordYahooFinanceFailure,
  YAHOO_CANONICAL_CONTRACT_ID,
} from "./yahooFinancePersistence";

// ─── 类型定义 ──────────────────────────────────────────────────────────────────
export interface YieldPoint {
  date: string;
  value: number;
}
export interface YahooChartPoint extends YieldPoint {
  /** Exact provider timestamp when an intraday bar is returned. */
  timestamp?: string;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}
export interface YahooNewsItem {
  id: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  sourceUrl: string | null;
  itemType: string | null;
  relatedTickers: string[];
  plainLanguage: string;
}
export type YahooRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
export type YahooInterval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1h"
  | "1d"
  | "1wk"
  | "1mo";
export type YahooRealtimeStatus = "realtime" | "delayed" | "end_of_day" | "archived";
export type YahooChartResult = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  history: YahooChartPoint[];
  meta: Record<string, unknown>;
  source:
    | "Yahoo Finance chart via platform data API"
    | "Yahoo Finance public chart"
    | "yfinance community wrapper / Yahoo Finance public data"
    | "Nasdaq historical market data"
    | "Tonghuashun iFinD SDK";
};
export interface BondYieldData {
  symbol: string;
  name: string;
  current: number;
  change: number;
  changePct: number;
  history: YieldPoint[];
}
export interface SovereignBondRow {
  country: string;
  flag: string;
  iso2: string;
  y2: number;
  y5: number;
  y10: number;
  y30: number;
  change10y: number;
  currency: string;
}
export interface MacroIndicator {
  country: string;
  iso2: string;
  gdpUsd: number | null;
  debtGdpPct: number | null;
  inflationPct: number | null;
  currentAccountPct: number | null;
  year: number;
  history: {
    gdpUsd: Array<{ year: number; value: number }>;
    debtGdpPct: Array<{ year: number; value: number }>;
    inflationPct: Array<{ year: number; value: number }>;
    currentAccountPct: Array<{ year: number; value: number }>;
  };
  continuityFilled: boolean;
}

export interface TreasuryAuctionReference {
  recordDate: string;
  cusip: string;
  securityType: string;
  securityTerm: string;
  auctionDate: string;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: number | null;
  bidToCoverRatio: number | null;
  resultMetricLabel: string | null;
  resultMetricValue: number | null;
  couponRate: number | null;
}

// ─── 常量 ──────────────────────────────────────────────────────────────────────
// 各国国债收益率 ticker（Yahoo Finance）
export const YIELD_TICKERS: Record<
  string,
  { symbol: string; name: string; flag: string; country: string }
> = {
  US_10Y: {
    symbol: "^TNX",
    name: "US 10Y Treasury",
    flag: "🇺🇸",
    country: "United States",
  },
  US_30Y: {
    symbol: "^TYX",
    name: "US 30Y Treasury",
    flag: "🇺🇸",
    country: "United States",
  },
  US_5Y: {
    symbol: "^FVX",
    name: "US 5Y Treasury",
    flag: "🇺🇸",
    country: "United States",
  },
  US_3M: {
    symbol: "^IRX",
    name: "US 3M T-Bill",
    flag: "🇺🇸",
    country: "United States",
  },
};

// 全球国债 ETF（作为各国收益率代理）
export const INTL_BOND_ETFS: Record<
  string,
  { symbol: string; name: string; flag: string; region: string }
> = {
  IGOV: {
    symbol: "IGOV",
    name: "iShares Intl Treasury Bond",
    flag: "🌍",
    region: "International",
  },
  BWX: {
    symbol: "BWX",
    name: "SPDR Intl Treasury Bond",
    flag: "🌍",
    region: "International",
  },
  EMB: {
    symbol: "EMB",
    name: "iShares EM Bond (JPM)",
    flag: "🌏",
    region: "Emerging Markets",
  },
  PCY: {
    symbol: "PCY",
    name: "Invesco EM Sovereign Debt",
    flag: "🌏",
    region: "Emerging Markets",
  },
  VWOB: {
    symbol: "VWOB",
    name: "Vanguard EM Govt Bond",
    flag: "🌏",
    region: "Emerging Markets",
  },
  EMHY: {
    symbol: "EMHY",
    name: "iShares EM HY Bond",
    flag: "🌏",
    region: "Emerging Markets",
  },
  EMLC: {
    symbol: "EMLC",
    name: "VanEck EM Local Currency",
    flag: "🌏",
    region: "Emerging Markets",
  },
};

// CDS 利差代理 ETF
export const CDS_PROXY_ETFS: Record<
  string,
  { symbol: string; name: string; category: string }
> = {
  HYG: { symbol: "HYG", name: "iShares HY Corp Bond", category: "high_yield" },
  LQD: {
    symbol: "LQD",
    name: "iShares IG Corp Bond",
    category: "investment_grade",
  },
  JNK: { symbol: "JNK", name: "SPDR HY Bond ETF", category: "high_yield" },
  TIP: { symbol: "TIP", name: "iShares TIPS Bond", category: "inflation" },
  STIP: { symbol: "STIP", name: "iShares Short TIPS", category: "inflation" },
  BIL: { symbol: "BIL", name: "SPDR 1-3M T-Bill", category: "money_market" },
  SHV: {
    symbol: "SHV",
    name: "iShares Short Treasury",
    category: "money_market",
  },
};

// 国债期货
export const TREASURY_FUTURES: Record<
  string,
  { symbol: string; name: string; tenor: string }
> = {
  ZN: { symbol: "ZN=F", name: "US 10Y T-Note Futures", tenor: "10Y" },
  ZB: { symbol: "ZB=F", name: "US 30Y T-Bond Futures", tenor: "30Y" },
  ZT: { symbol: "ZT=F", name: "US 2Y T-Note Futures", tenor: "2Y" },
};

// FRED 系列
export const FRED_SERIES: Record<string, string> = {
  DGS10: "US 10Y Treasury Yield",
  DGS2: "US 2Y Treasury Yield",
  DGS5: "US 5Y Treasury Yield",
  DGS30: "US 30Y Treasury Yield",
  DGS1MO: "US 1M Treasury Yield",
  DGS3MO: "US 3M Treasury Yield",
  DGS6MO: "US 6M Treasury Yield",
  DGS1: "US 1Y Treasury Yield",
  FEDFUNDS: "Fed Funds Rate",
  DFII10: "US 10Y TIPS Yield (Real)",
  T10Y2Y: "US 10Y-2Y Yield Spread",
  T10Y3M: "US 10Y-3M Yield Spread",
  SOFR: "SOFR Rate",
};

// FRED 收录的 OECD 十年期政府债基准收益率（月度）。仅返回原始观测；不可得时返回空，不生成替代报价。
export const OECD_TEN_YEAR_GOVERNMENT_YIELD_SERIES: Record<
  string,
  { seriesId: string }
> = {
  DE: { seriesId: "IRLTLT01DEM156N" },
  JP: { seriesId: "IRLTLT01JPM156N" },
  GB: { seriesId: "IRLTLT01GBM156N" },
  AU: { seriesId: "IRLTLT01AUM156N" },
  CA: { seriesId: "IRLTLT01CAM156N" },
  KR: { seriesId: "IRLTLT01KRM156N" },
  FR: { seriesId: "IRLTLT01FRM156N" },
  IT: { seriesId: "IRLTLT01ITM156N" },
  ES: { seriesId: "IRLTLT01ESM156N" },
  BE: { seriesId: "IRLTLT01BEM156N" },
  CH: { seriesId: "IRLTLT01CHM156N" },
  DK: { seriesId: "IRLTLT01DKM156N" },
  NL: { seriesId: "IRLTLT01NLM156N" },
  NO: { seriesId: "IRLTLT01NOM156N" },
  NZ: { seriesId: "IRLTLT01NZM156N" },
  PL: { seriesId: "IRLTLT01PLM156N" },
  PT: { seriesId: "IRLTLT01PTM156N" },
  SE: { seriesId: "IRLTLT01SEM156N" },
};

export interface OecdSovereignYieldReference {
  country: string;
  seriesId: string;
  dataDate: string;
  value: number;
  frequency: "monthly";
  source: "FRED / OECD";
}

// ─── Yahoo Finance 数据获取 ────────────────────────────────────────────────────

/** 获取单个 ticker 的行情和历史数据 */
const YAHOO_CACHE_TTL_MS = 5 * 60_000;
const YAHOO_INTRADAY_CACHE_TTL_MS = 30_000;
const YAHOO_EMPTY_CACHE_TTL_MS = 30_000;
const INTRADAY_INTERVALS = new Set<YahooInterval>([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
]);

function isIntradayInterval(interval: YahooInterval) {
  return INTRADAY_INTERVALS.has(interval);
}

function freshnessMetadata(
  meta: Record<string, unknown>,
  interval: YahooInterval,
  observedAt: string | null,
) {
  const intraday = isIntradayInterval(interval);
  const regularMarketTime =
    typeof meta.regularMarketTime === "number" && Number.isFinite(meta.regularMarketTime)
      ? meta.regularMarketTime * 1000
      : null;
  const ageMs = regularMarketTime === null ? null : Math.max(0, Date.now() - regularMarketTime);
  // Yahoo's public chart and the community yfinance wrapper do not provide a
  // contractual real-time entitlement. Intraday bars are therefore exposed
  // as provider-delayed unless a future provider explicitly attests to live
  // timestamps. This prevents a successful HTTP response from being shown as
  // executable real-time market data.
  const realtimeStatus: YahooRealtimeStatus = intraday ? "delayed" : "end_of_day";
  return {
    realtimeStatus,
    live: false,
    frequency: intraday ? interval : "daily",
    observedAt,
    providerTimestamp: regularMarketTime ? new Date(regularMarketTime).toISOString() : null,
    providerAgeMs: ageMs,
  };
}
const yahooChartCache = new Map<
  string,
  { expiresAt: number; value: YahooChartResult | null }
>();
const yahooChartInflight = new Map<string, Promise<YahooChartResult | null>>();

async function fetchYahooChartUncached(
  symbol: string,
  range: YahooRange = "1y",
  interval: YahooInterval = "1d",
  countryCode?: string
): Promise<YahooChartResult | null> {
  const parseChart = (
    response: Record<string, unknown>,
    source:
      | "Yahoo Finance chart via platform data API"
      | "Yahoo Finance public chart"
  ) => {
    const chart = response?.chart as Record<string, unknown>;
    if (!chart || !Array.isArray(chart.result) || !chart.result[0]) return null;

    const result = chart.result[0] as Record<string, unknown>;
    const meta = result.meta as Record<string, unknown>;
    const timestamps = result.timestamp as number[] | undefined;
    const quote = (result.indicators as Record<string, unknown>)
      ?.quote as Record<string, unknown>[];
    const opens = quote?.[0]?.open as (number | null)[] | undefined;
    const highs = quote?.[0]?.high as (number | null)[] | undefined;
    const lows = quote?.[0]?.low as (number | null)[] | undefined;
    const closes = quote?.[0]?.close as (number | null)[] | undefined;
    const volumes = quote?.[0]?.volume as (number | null)[] | undefined;

    const history: YahooChartPoint[] = [];
    if (timestamps && closes) {
      for (let i = 0; i < timestamps.length; i++) {
        const v = closes[i];
        if (v !== null && v !== undefined) {
          const d = new Date(timestamps[i] * 1000);
          const timestamp = d.toISOString();
          history.push({
            date: isIntradayInterval(interval) ? timestamp : timestamp.slice(0, 10),
            timestamp: isIntradayInterval(interval) ? timestamp : undefined,
            value: parseFloat(v.toFixed(4)),
            volume: Number.isFinite(volumes?.[i])
              ? Math.trunc(Number(volumes?.[i]))
              : null,
            open: Number.isFinite(opens?.[i])
              ? parseFloat(Number(opens?.[i]).toFixed(4))
              : null,
            high: Number.isFinite(highs?.[i])
              ? parseFloat(Number(highs?.[i]).toFixed(4))
              : null,
            low: Number.isFinite(lows?.[i])
              ? parseFloat(Number(lows?.[i]).toFixed(4))
              : null,
            close: parseFloat(v.toFixed(4)),
          });
        }
      }
    }

    const price = meta.regularMarketPrice;
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      history.length === 0
    )
      return null;
    const previousClose =
      meta.chartPreviousClose ?? meta.previousClose ?? price;
    const prevClose =
      typeof previousClose === "number" && Number.isFinite(previousClose)
        ? previousClose
        : price;
    const change = parseFloat((price - prevClose).toFixed(4));
    const changePct = prevClose
      ? parseFloat(((change / prevClose) * 100).toFixed(3))
      : 0;

    const latestTimestamp = history.at(-1)?.timestamp ?? history.at(-1)?.date ?? null;
    return {
      symbol,
      price,
      change,
      changePct,
      currency: typeof meta.currency === "string" ? meta.currency : "未提供",
      history,
      meta: {
        ...meta,
        ...freshnessMetadata(meta, interval, latestTimestamp),
        provider: source,
      },
      source,
    };
  };

  const lookupSymbol =
    countryCode === "US"
      ? symbol
          .trim()
          .toUpperCase()
          .replace(/\.(O|N|A|B)$/, "")
      : symbol;
  const fetchPublicChart = async () => {
    const endpoint = new URL(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(lookupSymbol)}`
    );
    endpoint.searchParams.set("range", range);
    endpoint.searchParams.set("interval", interval);
    endpoint.searchParams.set("events", "history");
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinanceHub/1.0)" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const parsed = parseChart(
      (await response.json()) as Record<string, unknown>,
      "Yahoo Finance public chart"
    );
    if (!parsed) throw new Error("YAHOO_PUBLIC_CHART_EMPTY");
    return parsed;
  };
  const fetchCommunityWrapper = async (): Promise<YahooChartResult> => {
    const response = await fetchYFinancePythonHistory(lookupSymbol, range, interval);
    const history = response.history.map(point => ({
      date: point.date,
      timestamp: point.date.includes("T") ? point.date : undefined,
      value: Number(point.close.toFixed(4)),
      volume: point.volume,
      open: point.open === null ? null : Number(point.open.toFixed(4)),
      high: point.high === null ? null : Number(point.high.toFixed(4)),
      low: point.low === null ? null : Number(point.low.toFixed(4)),
      close: Number(point.close.toFixed(4)),
    }));
    const latest = history.at(-1)!;
    const previous = history.at(-2)?.close ?? latest.close!;
    const price = latest.close!;
    const change = Number((price - previous).toFixed(4));
    return {
      symbol: response.symbol,
      price,
      change,
      changePct: previous ? Number(((change / previous) * 100).toFixed(3)) : 0,
      currency: response.currency,
      history,
      meta: {
        provider: response.provider,
        providerVersion: response.providerVersion,
        officialYahooApi: response.officialYahooApi,
        exchangeTimezoneName: response.exchangeTimezoneName,
        ...freshnessMetadata(
          {},
          interval,
          history.at(-1)?.timestamp ?? history.at(-1)?.date ?? null,
        ),
      },
      source: "yfinance community wrapper / Yahoo Finance public data",
    };
  };

  try {
    const resp = (await callDataApi("YahooFinance/get_stock_chart", {
      query: { symbol, interval, range, includeAdjustedClose: "true" },
      timeoutMs: 2_500,
    })) as Record<string, unknown>;
    const parsed = parseChart(
      resp,
      "Yahoo Finance chart via platform data API"
    );
    if (parsed) return parsed;
  } catch (error) {
    console.warn(
      "[Yahoo Chart] Platform data API unavailable; trying public chart endpoint",
      {
        symbol,
        range,
        reason: error instanceof Error ? error.message : "unknown",
      }
    );
  }

  try {
    // Both routes represent the same Yahoo chart dataset. The first verified
    // response wins and is persisted under one canonical contract downstream.
    return await Promise.any([fetchCommunityWrapper(), fetchPublicChart()]);
  } catch (error) {
    console.warn("[Yahoo Chart] Historical OHLC unavailable", {
      symbol,
      range,
      reason: error instanceof AggregateError
        ? error.errors.map(item => item instanceof Error ? item.message : String(item)).join(" | ")
        : error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/** 缓存已核验的公开行情结果，并合并同一代码的并发请求。源不可用时返回空，不生成补位曲线。 */
export async function fetchYahooChart(
  symbol: string,
  range: YahooRange = "1y",
  interval: YahooInterval = "1d",
  countryCode?: string
): Promise<YahooChartResult | null> {
  const cacheKey = [
    symbol.trim().toUpperCase(),
    range,
    interval,
    countryCode ?? "",
  ].join("|");
  const cached = yahooChartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = yahooChartInflight.get(cacheKey);
  if (existing) return existing;
  const request = fetchYahooChartUncached(symbol, range, interval, countryCode)
    .then(async value => {
      let resolved = value;
      if (value) {
        try {
          const persistence = await archiveYahooFinanceChart(value);
          resolved = {
            ...value,
            meta: {
              ...value.meta,
              ...freshnessMetadata(
                value.meta,
                interval,
                typeof value.meta.observedAt === "string" ? value.meta.observedAt : value.history.at(-1)?.date ?? null,
              ),
              persistentFallback: false,
              dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
              persistence,
            },
          };
        } catch (error) {
          resolved = {
            ...value,
            meta: {
              ...value.meta,
              ...freshnessMetadata(
                value.meta,
                interval,
                typeof value.meta.observedAt === "string" ? value.meta.observedAt : value.history.at(-1)?.date ?? null,
              ),
              persistentFallback: false,
              dataContractId: YAHOO_CANONICAL_CONTRACT_ID,
              persistenceError: error instanceof Error ? error.message : "PERSISTENCE_FAILED",
            },
          };
        }
      } else {
        await recordYahooFinanceFailure("Yahoo 公共图表与 yfinance 社区适配器均未返回可验证行情");
        resolved = await readArchivedYahooFinanceChart(symbol, range);
      }
      yahooChartCache.set(cacheKey, {
        expiresAt:
          Date.now() +
          (resolved
            ? isIntradayInterval(interval)
              ? YAHOO_INTRADAY_CACHE_TTL_MS
              : YAHOO_CACHE_TTL_MS
            : YAHOO_EMPTY_CACHE_TTL_MS),
        value: resolved,
      });
      return resolved;
    })
    .finally(() => yahooChartInflight.delete(cacheKey));
  yahooChartInflight.set(cacheKey, request);
  return request;
}

/** Force a provider request for the admin health check while preserving the same contract and archive path. */
export async function refreshYahooChart(
  symbol: string,
  range: YahooRange = "5d",
  interval: YahooInterval = "1d",
  countryCode?: string
) {
  const cacheKey = [symbol.trim().toUpperCase(), range, interval, countryCode ?? ""].join("|");
  yahooChartCache.delete(cacheKey);
  return fetchYahooChart(symbol, range, interval, countryCode);
}

const NASDAQ_HISTORY_CACHE_TTL_MS = 5 * 60_000;
const NASDAQ_HISTORY_EMPTY_CACHE_TTL_MS = 60_000;
const nasdaqHistoryCache = new Map<
  string,
  { expiresAt: number; value: YahooChartResult | null }
>();

export function parseNasdaqNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNasdaqDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[1]}-${match[2]}`;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

/** Nasdaq 官方历史接口兜底。仅使用实际返回的日线，不生成补位行情。 */
export async function fetchNasdaqHistorical(
  symbol: string,
  range: YahooRange = "1mo",
  assetClass: "etf" | "stocks" | "index" = "etf"
): Promise<YahooChartResult | null> {
  const normalized = symbol.trim().toUpperCase();
  const cacheKey = `${normalized}|${range}|${assetClass}`;
  const cached = nasdaqHistoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const calendarDays: Record<YahooRange, number> = {
    "1d": 7,
    "5d": 14,
    "1mo": 45,
    "3mo": 120,
    "6mo": 220,
    "1y": 400,
    "2y": 800,
    "5y": 1_900,
  };
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - calendarDays[range]);
  const endpoint = new URL(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(normalized)}/historical`
  );
  endpoint.searchParams.set("assetclass", assetClass);
  endpoint.searchParams.set("fromdate", from.toISOString().slice(0, 10));
  endpoint.searchParams.set("todate", to.toISOString().slice(0, 10));
  endpoint.searchParams.set("limit", "5000");

  let value: YahooChartResult | null = null;
  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent": "Mozilla/5.0 (compatible; FinanceHub/1.0)",
        referer: `https://www.nasdaq.com/market-activity/${assetClass}/${normalized.toLowerCase()}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = (await response.json()) as {
      data?: { tradesTable?: { rows?: Array<Record<string, unknown>> } } | null;
    };
    const history = (payload.data?.tradesTable?.rows ?? [])
      .map((row): YahooChartPoint | null => {
        const date = parseNasdaqDate(row.date);
        const close = parseNasdaqNumber(row.close);
        if (!date || close === null || close <= 0) return null;
        return {
          date,
          value: close,
          volume: parseNasdaqNumber(row.volume),
          open: parseNasdaqNumber(row.open),
          high: parseNasdaqNumber(row.high),
          low: parseNasdaqNumber(row.low),
          close,
        };
      })
      .filter((point): point is YahooChartPoint => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latestPoint = history.at(-1);
    const previousPoint = history.at(-2);
    if (latestPoint && history.length >= 2) {
      const change = Number(
        (
          latestPoint.value - (previousPoint?.value ?? latestPoint.value)
        ).toFixed(4)
      );
      value = {
        symbol: normalized,
        price: latestPoint.value,
        change,
        changePct: previousPoint?.value
          ? Number(((change / previousPoint.value) * 100).toFixed(3))
          : 0,
        currency: "USD",
        history,
        meta: {
          observedAt: latestPoint.date,
          assetClass,
          retrievedAt: new Date().toISOString(),
          frequency: "daily",
          realtime: false,
          realtimeStatus: "end_of_day",
        },
        source: "Nasdaq historical market data",
      };
    }
  } catch (error) {
    console.warn("[Nasdaq History] Historical series unavailable", {
      symbol: normalized,
      range,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  nasdaqHistoryCache.set(cacheKey, {
    expiresAt:
      Date.now() +
      (value ? NASDAQ_HISTORY_CACHE_TTL_MS : NASDAQ_HISTORY_EMPTY_CACHE_TTL_MS),
    value,
  });
  return value;
}

/** 批量获取多个 ticker；第三参数仅为兼容旧调用，不再生成连续参考数据。 */
export async function fetchMultipleYahoo(
  symbols: string[],
  range: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" = "1y",
  _allowReferenceFallback = false
) {
  const results = await Promise.allSettled(
    symbols.map(s => fetchYahooChart(s, range))
  );
  const map: Record<string, Awaited<ReturnType<typeof fetchYahooChart>>> = {};
  results.forEach((r, i) => {
    const sym = symbols[i];
    if (r.status === "fulfilled" && r.value && r.value.history.length >= 5) {
      map[sym] = r.value;
    } else map[sym] = null;
  });
  return map;
}

function createPlainLanguageNewsNote(
  title: string,
  publisher: string | null,
  itemType: string | null,
  relatedTickers: string[]
): string {
  const headlineLead =
    title
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 88)
      .replace(/[，,;；:：—–-].*$/, "")
      .trim() || "该公开标题";
  const attribution = publisher ? `发布者为${publisher}` : "发布者信息未提供";
  const typeLabel =
    itemType === "STORY"
      ? "文字报道"
      : itemType === "VIDEO"
        ? "视频报道"
        : itemType
          ? `来源类型 ${itemType}`
          : "未标注类型的条目";
  const tickerLabel = relatedTickers.length
    ? relatedTickers.slice(0, 4).join("、")
    : "未提供关联代码";
  return `大白话：来源把这条列为${typeLabel}，并关联代码 ${tickerLabel}；标题线索是“${headlineLead}”。终端只能确认这些来源元数据，未获得正文，不能进一步判断事件细节、业绩、分红、融资、并购或价格影响；需以来源页面核实。${attribution}。`;
}

function yahooNewsLookupSymbol(symbol: string, countryCode?: string): string {
  const normalized = symbol.trim().toUpperCase();
  return countryCode === "US"
    ? normalized.replace(/\.(O|N|A|B)$/, "")
    : normalized;
}

/** 读取指定代码的实际新闻条目；接口不可用或没有结果时返回明确空状态，不生成新闻文本。 */
export async function fetchYahooNews(
  symbol: string,
  limit = 6,
  countryCode?: string
): Promise<{
  available: boolean;
  source: string;
  items: YahooNewsItem[];
  limitation: string;
}> {
  const source = "Yahoo Finance public search";
  try {
    const lookupSymbol = yahooNewsLookupSymbol(symbol, countryCode);
    const endpoint = new URL(
      "https://query2.finance.yahoo.com/v1/finance/search"
    );
    endpoint.searchParams.set("q", lookupSymbol);
    endpoint.searchParams.set("quotesCount", "0");
    endpoint.searchParams.set(
      "newsCount",
      String(Math.max(1, Math.min(limit, 12)))
    );
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinanceHub/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    const candidates = Array.isArray(payload.news) ? payload.news : [];
    const canonicalSymbol = lookupSymbol;
    const items = candidates.flatMap((candidate, index) => {
      if (!candidate || typeof candidate !== "object") return [];
      const row = candidate as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!title) return [];
      const relatedTickers = Array.isArray(row.relatedTickers)
        ? row.relatedTickers.filter(
            (ticker): ticker is string => typeof ticker === "string"
          )
        : [];
      if (
        !relatedTickers.some(ticker => ticker.toUpperCase() === canonicalSymbol)
      )
        return [];
      const rawTimestamp =
        row.providerPublishTime ?? row.publishedAt ?? row.published_at;
      const publishedAt =
        typeof rawTimestamp === "number"
          ? new Date(rawTimestamp * 1000).toISOString()
          : typeof rawTimestamp === "string"
            ? rawTimestamp
            : null;
      const clickThrough = row.clickThroughUrl as
        | Record<string, unknown>
        | undefined;
      const sourceUrl =
        typeof row.link === "string"
          ? row.link
          : typeof row.url === "string"
            ? row.url
            : typeof clickThrough?.url === "string"
              ? clickThrough.url
              : null;
      return [
        {
          id:
            typeof row.uuid === "string"
              ? row.uuid
              : `${symbol}-${index}-${title}`,
          title,
          publisher: typeof row.publisher === "string" ? row.publisher : null,
          publishedAt,
          sourceUrl,
          itemType: typeof row.type === "string" ? row.type : null,
          relatedTickers,
          plainLanguage: createPlainLanguageNewsNote(
            title,
            typeof row.publisher === "string" ? row.publisher : null,
            typeof row.type === "string" ? row.type : null,
            relatedTickers
          ),
        },
      ];
    });
    return items.length
      ? {
          available: true,
          source,
          items,
          limitation:
            "新闻标题、发布者与时间来自免费公开搜索的本次实际返回；白话解读只按标题主题分类生成，不复写新闻全文，原文地址保留为来源定位且终端内不自动跳转。",
        }
      : {
          available: false,
          source,
          items: [],
          limitation:
            "当前免费公开新闻源没有返回与该证券代码直接关联的可验证条目；终端不生成摘要或替代新闻。",
        };
  } catch (error) {
    console.warn("[Yahoo News] unavailable", {
      symbol,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      available: false,
      source,
      items: [],
      limitation: "当前免费公开新闻源不可用；终端不生成摘要、标题或替代新闻。",
    };
  }
}

// ─── FRED 数据获取 ─────────────────────────────────────────────────────────────

const fredSeriesCache = new Map<
  string,
  { expiresAt: number; points: YieldPoint[] }
>();
const activeFredSeriesReads = new Map<string, Promise<YieldPoint[]>>();
const FRED_CACHE_TTL_MS = 5 * 60_000;
const FRED_EMPTY_CACHE_TTL_MS = 20_000;

async function readFredSeries(seriesId: string): Promise<YieldPoint[]> {
  const cached = fredSeriesCache.get(seriesId);
  if (cached && cached.expiresAt > Date.now()) return cached.points;
  const active = activeFredSeriesReads.get(seriesId);
  if (active) return active;
  const request = (async () => {
    try {
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return [];
      const text = await resp.text();
      const lines = text.trim().split("\n").slice(1);
      const points: YieldPoint[] = [];
      for (const line of lines) {
        const [date, val] = line.split(",");
        if (val && val.trim() !== "." && !isNaN(parseFloat(val))) {
          points.push({ date: date.trim(), value: parseFloat(val.trim()) });
        }
      }
      return points;
    } catch {
      return [];
    }
  })();
  activeFredSeriesReads.set(seriesId, request);
  try {
    const points = await request;
    fredSeriesCache.set(seriesId, {
      expiresAt:
        Date.now() +
        (points.length ? FRED_CACHE_TTL_MS : FRED_EMPTY_CACHE_TTL_MS),
      points,
    });
    return points;
  } finally {
    activeFredSeriesReads.delete(seriesId);
  }
}

/** 从 FRED 获取利率时间序列（CSV 格式，无需 API key） */
export async function fetchFredSeries(
  seriesId: string,
  limit = 252 // 约 1 年交易日
): Promise<YieldPoint[]> {
  const points = await readFredSeries(seriesId);
  return points.slice(-limit);
}

/** 批量获取多个 FRED 系列 */
export async function fetchMultipleFred(
  seriesIds: string[]
): Promise<Record<string, YieldPoint[]>> {
  const results = await Promise.allSettled(
    seriesIds.map(id => fetchFredSeries(id))
  );
  const map: Record<string, YieldPoint[]> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") map[seriesIds[i]] = r.value;
    else map[seriesIds[i]] = [];
  });
  return map;
}

/** 读取 FRED 发布的 OECD 十年期政府债收益率；缺失系列或观测值保持为空。 */
export async function fetchOecdTenYearGovernmentYields(
  countryCodes: string[]
): Promise<Record<string, OecdSovereignYieldReference | null>> {
  const selections = countryCodes.flatMap(country => {
    const definition = OECD_TEN_YEAR_GOVERNMENT_YIELD_SERIES[country];
    return definition ? [{ country, ...definition }] : [];
  });
  const seriesData = await fetchMultipleFred(
    selections.map(selection => selection.seriesId)
  );
  return Object.fromEntries(
    countryCodes.map(country => {
      const selection = selections.find(item => item.country === country);
      const latest = selection ? seriesData[selection.seriesId]?.at(-1) : null;
      return [
        country,
        selection && latest
          ? {
              country,
              seriesId: selection.seriesId,
              dataDate: latest.date,
              value: latest.value,
              frequency: "monthly" as const,
              source: "FRED / OECD" as const,
            }
          : null,
      ];
    })
  );
}

// ─── World Bank 数据获取 ───────────────────────────────────────────────────────

/** 从 World Bank REST API 获取各国宏观指标 */
export async function fetchWorldBankIndicator(
  indicatorCode: string,
  countryCodes: string[],
  mrv = 3 // most recent values
): Promise<Record<string, { value: number; year: number }[]>> {
  try {
    const countryStr = countryCodes.join(";");
    const url = `https://api.worldbank.org/v2/country/${countryStr}/indicator/${indicatorCode}?format=json&mrv=${mrv}&per_page=200`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return {};
    const json = (await resp.json()) as [
      unknown,
      Array<{
        country: { id: string; value: string };
        date: string;
        value: number | null;
      }>,
    ];
    if (!Array.isArray(json) || !json[1]) return {};

    const result: Record<string, { value: number; year: number }[]> = {};
    for (const item of json[1]) {
      if (item.value === null) continue;
      const iso = item.country.id;
      if (!result[iso]) result[iso] = [];
      result[iso].push({ value: item.value, year: parseInt(item.date) });
    }
    return result;
  } catch {
    return {};
  }
}

/** 获取主权债核心宏观数据（GDP、债务、通胀、经常账户） */
export async function fetchSovereignMacroData(
  countryCodes: string[]
): Promise<Record<string, MacroIndicator>> {
  const [gdpData, debtData, inflData, caData] = await Promise.all([
    fetchWorldBankIndicator("NY.GDP.MKTP.CD", countryCodes, 16),
    fetchWorldBankIndicator("GC.DOD.TOTL.GD.ZS", countryCodes, 16),
    fetchWorldBankIndicator("FP.CPI.TOTL.ZG", countryCodes, 16),
    fetchWorldBankIndicator("BN.CAB.XOKA.GD.ZS", countryCodes, 16),
  ]);

  const result: Record<string, MacroIndicator> = {};
  for (const iso of countryCodes) {
    const ascending = (rows: Array<{ value: number; year: number }> = []) =>
      [...rows]
        .filter(row => Number.isFinite(row.value) && Number.isFinite(row.year))
        .sort((a, b) => a.year - b.year);
    const sourceGdpHistory = ascending(gdpData[iso]);
    const sourceDebtHistory = ascending(debtData[iso]);
    const sourceInflHistory = ascending(inflData[iso]);
    const sourceCaHistory = ascending(caData[iso]);
    const gdpHistory = sourceGdpHistory;
    const debtHistory = sourceDebtHistory;
    const inflHistory = sourceInflHistory;
    const caHistory = sourceCaHistory;
    const gdp = gdpHistory.at(-1);
    const debt = debtHistory.at(-1);
    const infl = inflHistory.at(-1);
    const ca = caHistory.at(-1);
    result[iso] = {
      country: iso,
      iso2: iso,
      gdpUsd: gdp?.value ?? null,
      debtGdpPct: debt?.value ?? null,
      inflationPct: infl?.value ?? null,
      currentAccountPct: ca?.value ?? null,
      year:
        gdp?.year ??
        debt?.year ??
        infl?.year ??
        ca?.year ??
        new Date().getFullYear() - 1,
      history: {
        gdpUsd: gdpHistory,
        debtGdpPct: debtHistory,
        inflationPct: inflHistory,
        currentAccountPct: caHistory,
      },
      continuityFilled: false,
    };
  }
  return result;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 计算收益率曲线（从 FRED 多系列） */
export async function fetchUSTreasuryCurve(): Promise<
  {
    tenor: string;
    yield: number | null;
    label: string;
    observedAt: string | null;
  }[]
> {
  const seriesMap: Record<string, string> = {
    "1M": "DGS1MO",
    "3M": "DGS3MO",
    "6M": "DGS6MO",
    "1Y": "DGS1",
    "2Y": "DGS2",
    "5Y": "DGS5",
    "10Y": "DGS10",
    "30Y": "DGS30",
  };
  const ids = Object.values(seriesMap);
  const data = await fetchMultipleFred(ids);

  return Object.entries(seriesMap).map(([tenor, seriesId]) => {
    const pts = data[seriesId] ?? [];
    const latest = pts[pts.length - 1];
    return {
      tenor,
      // 缺少官方观测时保持空值；零收益率是有效市场观测，不能作为占位值。
      yield: latest?.value ?? null,
      label: `${tenor}: ${latest?.value?.toFixed(2) ?? "N/A"}%`,
      observedAt: latest?.date ?? null,
    };
  });
}

/** 获取利差（10Y - 2Y, 10Y - 3M） */
export async function fetchYieldSpreads(): Promise<{
  spread10y2y: number | null;
  spread10y3m: number | null;
  history10y2y: YieldPoint[];
  history10y3m: YieldPoint[];
}> {
  const data = await fetchMultipleFred(["T10Y2Y", "T10Y3M"]);
  const h10y2y = data["T10Y2Y"] ?? [];
  const h10y3m = data["T10Y3M"] ?? [];
  return {
    spread10y2y: h10y2y[h10y2y.length - 1]?.value ?? null,
    spread10y3m: h10y3m[h10y3m.length - 1]?.value ?? null,
    history10y2y: h10y2y,
    history10y3m: h10y3m,
  };
}

// ─── U.S. Treasury Official Auction Data ─────────────────────────────────────

const TREASURY_AUCTIONS_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";
const TREASURY_AUCTION_FIELDS = [
  "record_date",
  "cusip",
  "security_type",
  "security_term",
  "auction_date",
  "issue_date",
  "maturity_date",
  "offering_amt",
  "bid_to_cover_ratio",
  "high_yield",
  "high_investment_rate",
  "high_discnt_rate",
  "high_price",
  "int_rate",
].join(",");

function fiscalNumber(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "" || value === "null")
    return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * 查询美国财政部 Fiscal Data 的公开拍卖记录。
 * 该数据是一级市场官方拍卖参考，不是经授权的二级市场实时 bid/ask 报价。
 */
export async function fetchTreasuryAuctions(
  limit = 12
): Promise<TreasuryAuctionReference[]> {
  const size = Math.min(Math.max(Math.floor(limit), 1), 50);
  const params = new URLSearchParams({
    fields: TREASURY_AUCTION_FIELDS,
    sort: "-auction_date",
    "page[size]": String(size),
  });
  try {
    const response = await fetch(
      `${TREASURY_AUCTIONS_ENDPOINT}?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: Record<string, unknown>[];
    };
    if (!Array.isArray(payload.data)) return [];

    return payload.data
      .map(row => {
        const highYield = fiscalNumber(row.high_yield);
        const investmentRate = fiscalNumber(row.high_investment_rate);
        const discountRate = fiscalNumber(row.high_discnt_rate);
        const highPrice = fiscalNumber(row.high_price);
        const resultMetric =
          highYield !== null
            ? { label: "最高收益率", value: highYield }
            : investmentRate !== null
              ? { label: "投资利率", value: investmentRate }
              : discountRate !== null
                ? { label: "最高贴现率", value: discountRate }
                : highPrice !== null
                  ? { label: "最高价格", value: highPrice }
                  : { label: null, value: null };
        return {
          recordDate: String(row.record_date ?? ""),
          cusip: String(row.cusip ?? ""),
          securityType: String(row.security_type ?? ""),
          securityTerm: String(row.security_term ?? ""),
          auctionDate: String(row.auction_date ?? ""),
          issueDate:
            typeof row.issue_date === "string" && row.issue_date !== "null"
              ? row.issue_date
              : null,
          maturityDate:
            typeof row.maturity_date === "string" &&
            row.maturity_date !== "null"
              ? row.maturity_date
              : null,
          offeringAmount: fiscalNumber(row.offering_amt),
          bidToCoverRatio: fiscalNumber(row.bid_to_cover_ratio),
          resultMetricLabel: resultMetric.label,
          resultMetricValue: resultMetric.value,
          couponRate: fiscalNumber(row.int_rate),
        };
      })
      .filter(row => Boolean(row.auctionDate && row.cusip));
  } catch {
    return [];
  }
}

export type OfficialFinancingCalendarRecord = {
  id: string;
  countryCode: "US" | "DE" | "GB" | "JP" | "FR" | "IT";
  country: string;
  currency: "USD" | "EUR" | "GBP" | "JPY";
  auctionDate: string;
  eventType: "announcement" | "auction" | "settlement";
  securityType: string;
  securityTerm: string | null;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: number | null;
  couponRate: number | null;
  cusip?: string | null;
  isin?: string | null;
  sourceLabel: string;
  sourceUrl: string;
};

const GERMAN_ISSUANCE_CALENDAR_URL =
  "https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-calendar";
const JAPAN_MOF_WEEKLY_SCHEDULE_URL =
  "https://www.mof.go.jp/english/public_relations/weekly_schedule/index.htm";
const FRANCE_AFT_MONTHLY_CALENDAR_URL =
  "https://www.aft.gouv.fr/en/auction-indicative-calendars";
const FRANCE_AFT_HOME_URL = "https://www.aft.gouv.fr/en";
const READ_ONLY_READER_URL = (url: string) => `https://r.jina.ai/http://${url}`;
const ITALY_MEF_BOT_CALENDAR_URL = (year: number) =>
  `https://www.dt.mef.gov.it/export/sites/sitodt/modules/documenti_en/debito_pubblico/calendario/calendario_new/Calendario-BOT-${year}-ENG.pdf`;
const UK_DMO_D5D_REPORT_URL =
  "https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D5D";
const UK_DMO_D1A_REPORT_URL =
  "https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D1A";
const UK_DMO_PUBLICATIONS_URL =
  "https://www.dmo.gov.uk/publications/?offset=0&itemsPerPage=30&parentFilter=-1&childFilter=-1&startMonth=4&startYear=2025";
const ENGLISH_WEEKDAY =
  "(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
const ENGLISH_MONTH =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
const ENGLISH_DATE = `${ENGLISH_WEEKDAY},\\s+${ENGLISH_MONTH}\\s+\\d{1,2},\\s+\\d{4}`;
const UK_DMO_DATE = `${ENGLISH_WEEKDAY},\\s+\\d{1,2}\\s+${ENGLISH_MONTH}\\s+\\d{4}`;
let italyMefCalendarCache: {
  expiresAt: number;
  records: OfficialFinancingCalendarRecord[];
} | null = null;
let franceAftCalendarCache: {
  expiresAt: number;
  records: OfficialFinancingCalendarRecord[];
} | null = null;
let ukDmoCalendarCache: {
  expiresAt: number;
  records: OfficialFinancingCalendarRecord[];
} | null = null;
let ukDmoNextRequestAt = 0;

function englishDateToIso(value: string): string | null {
  const parsed = Date.parse(`${value} UTC`);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString().slice(0, 10)
    : null;
}

function frenchDateToIso(value: string): string | null {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function dmoFinancialYear(now = new Date()) {
  const year = now.getUTCFullYear() - (now.getUTCMonth() < 3 ? 1 : 0);
  return `${year}-${String(year + 1).slice(-2)}`;
}

function xlsSerialToIso(value: unknown): string | null {
  if (typeof value !== "number") return null;
  const date = new Date(
    Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000
  );
  return Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
}

function ukDmoDateToIso(value: string): string | null {
  const parsed = Date.parse(`${value.replace(",", "")} UTC`);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString().slice(0, 10)
    : null;
}

function normalizeGiltName(value: string) {
  return value
    .toLowerCase()
    .replace(/⅛/g, " 1/8 ")
    .replace(/¼/g, " 1/4 ")
    .replace(/⅜/g, " 3/8 ")
    .replace(/½/g, " 1/2 ")
    .replace(/⅝/g, " 5/8 ")
    .replace(/¾/g, " 3/4 ")
    .replace(/⅞/g, " 7/8 ")
    .replace(/[^a-z0-9]+/g, "");
}

async function fetchUkDmoOfficial(url: string, accept = "*/*") {
  const waitMs = Math.max(0, ukDmoNextRequestAt - Date.now());
  if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
  ukDmoNextRequestAt = Date.now() + 900;
  return fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: accept },
  });
}

function isDmoXls(bytes: Uint8Array) {
  return (
    bytes.byteLength > 1_024 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

async function fetchUkDmoWorkbook(url: string) {
  const accept =
    "application/vnd.ms-excel,application/octet-stream;q=0.9,*/*;q=0.8";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchUkDmoOfficial(url, accept);
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (isDmoXls(bytes))
        return XLSX.read(bytes, { type: "array", cellDates: false });
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 2_500));
  }
  return null;
}

async function fetchAftOfficialText(url: string) {
  try {
    const direct = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (direct.ok) {
      const text = await direct.text();
      if (!/Just a moment|cf-mitigated/i.test(text)) return text;
    }
  } catch {
    // 直接读取被防护或网络错误时，尝试只读转译；下游仍保留原始 AFT URL。
  }
  try {
    const fallback = await fetch(READ_ONLY_READER_URL(url), {
      signal: AbortSignal.timeout(15_000),
    });
    return fallback.ok ? await fallback.text() : "";
  } catch {
    return "";
  }
}

function financingEventRecords(
  input: Omit<
    OfficialFinancingCalendarRecord,
    "id" | "auctionDate" | "eventType"
  > & {
    idPrefix: string;
    announcementDate: string | null;
    auctionDate: string | null;
    settlementDate: string | null;
  }
) {
  const dates: Array<{
    eventType: OfficialFinancingCalendarRecord["eventType"];
    date: string | null;
  }> = [
    { eventType: "announcement", date: input.announcementDate },
    { eventType: "auction", date: input.auctionDate },
    { eventType: "settlement", date: input.settlementDate },
  ];
  return dates.flatMap(({ eventType, date }) =>
    date
      ? [
          {
            id: `${input.idPrefix}-${eventType}`,
            countryCode: input.countryCode,
            country: input.country,
            currency: input.currency,
            auctionDate: date,
            eventType,
            securityType: input.securityType,
            securityTerm: input.securityTerm,
            issueDate: input.issueDate,
            maturityDate: input.maturityDate,
            offeringAmount: input.offeringAmount,
            couponRate: input.couponRate,
            sourceLabel: input.sourceLabel,
            sourceUrl: input.sourceUrl,
          },
        ]
      : []
  );
}

function germanCalendarDate(value: string): string | null {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/**
 * 从 Deutsche Finanzagentur 已发布的 Upcoming Issues 正文提取官方发行记录。
 * 页面结构改变或字段缺失时返回空数组，调用方保持明确空状态而不推测发行计划。
 */
export async function fetchGermanFederalIssuanceCalendar(
  limit = 50
): Promise<OfficialFinancingCalendarRecord[]> {
  try {
    const response = await fetch(GERMAN_ISSUANCE_CALENDAR_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const normalized = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const pattern =
      /(\d{2}\.\d{2}\.\d{4})\s+(Bund(?:\s+\d+\s*Y)?|Bobl|Schatz|Bubill)(?:\s*\([A-Z]\))?\s+([\d.]+)\s+€\s+bn\s+([\d.]+\s*%)?\s*(\d{2}\.\d{2}\.\d{4})?/g;
    const rows: OfficialFinancingCalendarRecord[] = [];
    for (const match of normalized.matchAll(pattern)) {
      const auctionDate = germanCalendarDate(match[1]);
      if (!auctionDate) continue;
      const amount = Number(match[3]);
      const coupon = match[4] ? Number(match[4].replace("%", "").trim()) : null;
      rows.push({
        id: `DE-${auctionDate}-${match[2]}-${rows.length}`,
        countryCode: "DE",
        country: "德国",
        currency: "EUR",
        auctionDate,
        eventType: "auction",
        securityType: match[2],
        securityTerm: null,
        issueDate: auctionDate,
        maturityDate: match[5] ? germanCalendarDate(match[5]) : null,
        offeringAmount: Number.isFinite(amount) ? amount * 1_000_000_000 : null,
        couponRate: coupon !== null && Number.isFinite(coupon) ? coupon : null,
        sourceLabel: "Deutsche Finanzagentur",
        sourceUrl: GERMAN_ISSUANCE_CALENDAR_URL,
      });
      if (rows.length >= limit) break;
    }
    return rows;
  } catch {
    return [];
  }
}

/** 从日本财务省英文周度日程读取已发布的 JGB 公告和结果事件；日期为财务省公布日。 */
export async function fetchJapanMofWeeklyJgbEvents(
  limit = 50
): Promise<OfficialFinancingCalendarRecord[]> {
  try {
    const response = await fetch(JAPAN_MOF_WEEKLY_SCHEDULE_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const text = (await response.text())
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/\r/g, "")
      .replace(/\n{2,}/g, "\n");
    const year = text.match(/Year\s+(20\d{2})/)?.[1];
    if (!year) return [];
    const months: Record<string, string> = {
      January: "01",
      February: "02",
      March: "03",
      April: "04",
      May: "05",
      June: "06",
      July: "07",
      August: "08",
      September: "09",
      October: "10",
      November: "11",
      December: "12",
    };
    const rows: OfficialFinancingCalendarRecord[] = [];
    const dayPattern =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*([\s\S]*?)(?=\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b|\bNote\b|$)/g;
    for (const section of text.matchAll(dayPattern)) {
      const eventDate = `${year}-${months[section[1]]}-${section[2].padStart(2, "0")}`;
      for (const line of section[3]
        .split("\n")
        .map(value => value.trim())
        .filter(Boolean)) {
        if (
          !/(Auction Notice|Auction Result|Announcement).*(JGB|Japan Climate Transition Bond|Treasury Discount Bill)/i.test(
            line
          )
        )
          continue;
        const tenor = line.match(/(\d+(?:-year|-month))/i)?.[1] ?? null;
        rows.push({
          id: `JP-${eventDate}-${rows.length}`,
          countryCode: "JP",
          country: "日本",
          currency: "JPY",
          auctionDate: eventDate,
          eventType: /Auction Result/i.test(line)
            ? "settlement"
            : "announcement",
          securityType: line.replace(/^\d{1,2}:\d{2}\s*/, ""),
          securityTerm: tenor,
          issueDate: null,
          maturityDate: null,
          offeringAmount: null,
          couponRate: null,
          sourceLabel: "Japan Ministry of Finance Weekly Schedule",
          sourceUrl: JAPAN_MOF_WEEKLY_SCHEDULE_URL,
        });
        if (rows.length >= limit) return rows;
      }
    }
    return rows;
  } catch {
    return [];
  }
}

/** 从单场 AFT 发行公告提取明确披露的公告、拍卖及交收日期；范围金额不伪造成实际发行规模。 */
export function parseFranceAftIssuanceAnnouncement(
  text: string,
  sourceUrl: string
): OfficialFinancingCalendarRecord[] {
  const title = text.match(/(?:^#\s*|^Title:\s*)(.+)$/m)?.[1]?.trim() ?? "";
  if (!/AFT.?s next issuance/i.test(title)) return [];
  const securityType = /BTF/i.test(title)
    ? "BTF issuance announcement"
    : /OAT/i.test(title)
      ? "OAT issuance announcement"
      : null;
  if (!securityType) return [];
  const titleDate = title.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i
  );
  const announcementDate = titleDate
    ? englishDateToIso(`${titleDate[2]} ${titleDate[1]}, ${titleDate[3]}`)
    : null;
  const auctionDate = frenchDateToIso(
    text.match(/Auction date\s*\|\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? ""
  );

  const settlementDate = frenchDateToIso(
    text.match(/Settlement date\s*\|\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? ""
  );
  if (!auctionDate) return [];
  const sourceId =
    sourceUrl
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/[^a-z0-9]+/gi, "-")
      .toUpperCase() ?? auctionDate;
  return financingEventRecords({
    idPrefix: `FR-${auctionDate}-${sourceId}`,
    countryCode: "FR",
    country: "法国",
    currency: "EUR",
    announcementDate,
    auctionDate,
    settlementDate,
    securityType,
    securityTerm: null,
    issueDate: settlementDate,
    maturityDate: null,
    offeringAmount: null,
    couponRate: null,
    sourceLabel: "Agence France Trésor Issuance Announcement",
    sourceUrl,
  });
}

/**
 * AFT 月度日历本体为图片，故从官方首页当前明确列示的单场“next issuance”公告中读取事件。
 * 若 AFT 直接访问返回防护页，使用只读转译取得同一原始页面，不将任何第三方数据写入日历。
 */
export async function fetchFranceAftMonthlyCalendar(
  limit = 100
): Promise<OfficialFinancingCalendarRecord[]> {
  if (franceAftCalendarCache && franceAftCalendarCache.expiresAt > Date.now())
    return franceAftCalendarCache.records.slice(0, limit);
  const home = await fetchAftOfficialText(FRANCE_AFT_HOME_URL);
  if (!home) return [];
  const urls = [
    ...home.matchAll(
      /\[[^\]]*AFT.?s next issuance[^\]]*\]\((https:\/\/www\.aft\.gouv\.fr\/en\/publications\/communiques-presse\/[^)\s]+)\)/gi
    ),
  ]
    .map(match => match[1])
    .filter((url, index, values) => values.indexOf(url) === index)
    .slice(0, 8);
  if (!urls.length) return [];
  const records = (
    await Promise.all(
      urls.map(async url =>
        parseFranceAftIssuanceAnnouncement(await fetchAftOfficialText(url), url)
      )
    )
  ).flat();
  franceAftCalendarCache = { expiresAt: Date.now() + 10 * 60_000, records };
  return records.slice(0, limit);
}

/** 解析 MEF 英文 BOT 年度拍卖日历中的公告、拍卖及交收日期；只保留 PDF 明示的日期。 */
export function parseItalyMefBotCalendar(
  text: string,
  sourceUrl: string,
  limit = 100
): OfficialFinancingCalendarRecord[] {
  const rows: OfficialFinancingCalendarRecord[] = [];
  const normalized = text.replace(/\s+/g, " ").trim();
  const pattern = new RegExp(
    `(?:half month|end of month)\\s+((?:6|12)\\s+month\\s+BOTs)\\s+(${ENGLISH_DATE})\\s+(${ENGLISH_DATE})\\s+(${ENGLISH_DATE})\\s+(${ENGLISH_DATE})\\s+(${ENGLISH_DATE})\\s+\\d+`,
    "g"
  );
  for (const match of normalized.matchAll(pattern)) {
    const months = match[1].match(/(6|12)\s+month/i)?.[1];
    const securityTerm = months ? `${months} month` : null;
    const announcementDate = englishDateToIso(match[2]);
    const auctionDate = englishDateToIso(match[4]);
    const settlementDate = englishDateToIso(match[5]);
    const maturityDate = englishDateToIso(match[6]);
    if (!auctionDate) continue;
    rows.push(
      ...financingEventRecords({
        idPrefix: `IT-${auctionDate}-${match[1].replace(/\s+/g, "-").toUpperCase()}`,
        countryCode: "IT",
        country: "意大利",
        currency: "EUR",
        announcementDate,
        auctionDate,
        settlementDate,
        securityType: match[1],
        securityTerm,
        issueDate: settlementDate,
        maturityDate,
        offeringAmount: null,
        couponRate: null,
        sourceLabel: "MEF Treasury Bills Auction Calendar",
        sourceUrl,
      })
    );
    if (rows.length >= limit) return rows.slice(0, limit);
  }
  return rows;
}

/** 从意大利 MEF 官方年度 BOT 日历读取月度融资事件；结果短时缓存以减少官方文件重复读取。 */
export async function fetchItalyMefAuctions(
  limit = 100
): Promise<OfficialFinancingCalendarRecord[]> {
  if (italyMefCalendarCache && italyMefCalendarCache.expiresAt > Date.now())
    return italyMefCalendarCache.records.slice(0, limit);
  const year = new Date().getUTCFullYear();
  const sourceUrl = ITALY_MEF_BOT_CALENDAR_URL(year);
  try {
    const response = await fetch(READ_ONLY_READER_URL(sourceUrl), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return [];
    const records = parseItalyMefBotCalendar(
      await response.text(),
      sourceUrl,
      150
    );
    italyMefCalendarCache = { expiresAt: Date.now() + 10 * 60_000, records };
    return records.slice(0, limit);
  } catch {
    return [];
  }
}

/** 解析 DMO 官方 D5D XLS：仅保留明确标为 Outright Auction 的 gilt 发行记录。 */
export function parseUkDmoIssuanceCalendar(
  workbook: XLSX.WorkBook,
  sourceUrl = UK_DMO_D5D_REPORT_URL,
  limit = 100
): OfficialFinancingCalendarRecord[] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const headerIndex = rows.findIndex(
    row =>
      String(row[1] ?? "").includes("Operation Date") &&
      String(row[3] ?? "").includes("Gilt Name")
  );
  if (headerIndex < 0) return [];
  const records: OfficialFinancingCalendarRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const auctionDate = xlsSerialToIso(row[1]);
    const securityType = typeof row[3] === "string" ? row[3].trim() : "";
    const offeringAmount =
      typeof row[4] === "number" ? row[4] * 1_000_000 : null;
    const method = typeof row[6] === "string" ? row[6].trim() : "";
    if (!auctionDate || !securityType || method !== "Outright Auction")
      continue;
    const idSecurity = securityType
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase();
    records.push({
      id: `GB-${auctionDate}-${idSecurity}`,
      countryCode: "GB",
      country: "英国",
      currency: "GBP",
      auctionDate,
      eventType: "auction",
      securityType,
      securityTerm: /Index-linked/i.test(securityType) ? "Index-linked" : null,
      issueDate: null,
      maturityDate: null,
      offeringAmount,
      couponRate: null,
      sourceLabel: "UK DMO Outright Gilt Issuance Calendar (D5D)",
      sourceUrl,
    });
    if (records.length >= limit) break;
  }
  return records;
}

export function parseUkDmoGiltsInIssue(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName)
    return new Map<
      string,
      { maturityDate: string; sourceUrl: string; isin: string | null }
    >();
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
  });
  const headerIndex = rows.findIndex(
    row =>
      String(row[0] ?? "").includes("Conventional Gilts") &&
      String(row[2] ?? "").includes("Redemption Date")
  );
  const entries = new Map<
    string,
    { maturityDate: string; sourceUrl: string; isin: string | null }
  >();
  for (const row of rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0)) {
    const securityType = typeof row[0] === "string" ? row[0].trim() : "";
    const maturityDate = xlsSerialToIso(row[2]);
    if (
      !securityType ||
      !maturityDate ||
      !/Treasury (?:Gilt|Stock)/i.test(securityType)
    )
      continue;
    const isin =
      typeof row[1] === "string" && /^[A-Z0-9]{12}$/i.test(row[1].trim())
        ? row[1].trim().toUpperCase()
        : null;
    entries.set(normalizeGiltName(securityType), {
      maturityDate,
      sourceUrl: UK_DMO_D1A_REPORT_URL,
      isin,
    });
  }
  return entries;
}

export function parseUkDmoAuctionNotice(text: string, sourceUrl: string) {
  const securityType =
    text
      .match(
        /Auction of\s+£?[\d,]+(?:\.\d+)?\s+million\s+of\s+(.+?)(?=\s+\(ISIN|\s+Auction Details)/i
      )?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  const isin =
    text.match(/ISIN\s+Code:\s*([A-Z0-9]{12})/i)?.[1]?.toUpperCase() ?? null;
  const auctionDate = ukDmoDateToIso(
    text.match(new RegExp(`Auction Date\\s*(${UK_DMO_DATE})`, "i"))?.[1] ?? ""
  );
  const settlementDate = ukDmoDateToIso(
    text.match(
      new RegExp(`Issue and Settlement Date\\s*(${UK_DMO_DATE})`, "i")
    )?.[1] ?? ""
  );
  return securityType && auctionDate && settlementDate
    ? { securityType, isin, auctionDate, settlementDate, sourceUrl }
    : null;
}

async function fetchUkDmoGiltsInIssue() {
  const lastCobCandidate = new Date(Date.now() - 86_400_000);
  const cobDate = `${String(lastCobCandidate.getUTCDate()).padStart(2, "0")}/${String(lastCobCandidate.getUTCMonth() + 1).padStart(2, "0")}/${lastCobCandidate.getUTCFullYear()}`;
  const parameters = encodeURIComponent(`&COBDate=${cobDate}`);
  const url = `https://www.dmo.gov.uk/umbraco/surface/DataExport/GetDataExport?reportCode=D1A&exportFormatValue=xls&parameters=${parameters}`;
  try {
    const workbook = await fetchUkDmoWorkbook(url);
    return workbook
      ? parseUkDmoGiltsInIssue(workbook)
      : new Map<
          string,
          { maturityDate: string; sourceUrl: string; isin: string | null }
        >();
  } catch {
    return new Map<
      string,
      { maturityDate: string; sourceUrl: string; isin: string | null }
    >();
  }
}

async function fetchUkDmoAuctionNoticeSettlements() {
  try {
    const response = await fetchUkDmoOfficial(
      UK_DMO_PUBLICATIONS_URL,
      "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
    );
    if (!response.ok)
      return new Map<
        string,
        { settlementDate: string; sourceUrl: string; isin: string | null }
      >();
    const anchors = [
      ...(await response.text()).matchAll(
        /<a\s+href="(\/media\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi
      ),
    ]
      .filter(
        match => /Auction of/i.test(match[2]) && !/Prospectus/i.test(match[2])
      )
      .slice(0, 12);
    const notices = await Promise.all(
      anchors.map(async match => {
        const sourceUrl = new URL(
          match[1],
          "https://www.dmo.gov.uk"
        ).toString();
        const notice = parseUkDmoAuctionNotice(
          await fetchAftOfficialText(sourceUrl),
          sourceUrl
        );
        return notice;
      })
    );
    const entries = new Map<
      string,
      { settlementDate: string; sourceUrl: string; isin: string | null }
    >();
    notices.forEach(notice => {
      if (notice)
        entries.set(
          `${notice.auctionDate}:${normalizeGiltName(notice.securityType)}`,
          {
            settlementDate: notice.settlementDate,
            sourceUrl: notice.sourceUrl,
            isin: notice.isin,
          }
        );
    });
    return entries;
  } catch {
    return new Map<
      string,
      { settlementDate: string; sourceUrl: string; isin: string | null }
    >();
  }
}

/** 读取英国 DMO 官方 D5D XLS 报告；该报表按财年发布并在季度/拍卖前细化券种和规模。 */
export async function fetchUkDmoGiltAuctions(
  limit = 100
): Promise<OfficialFinancingCalendarRecord[]> {
  if (ukDmoCalendarCache && ukDmoCalendarCache.expiresAt > Date.now())
    return ukDmoCalendarCache.records.slice(0, limit);
  const financialYear = dmoFinancialYear();
  const parameters = encodeURIComponent(`&Financial Year=${financialYear}`);
  const url = `https://www.dmo.gov.uk/umbraco/surface/DataExport/GetDataExport?reportCode=D5D&exportFormatValue=xls&parameters=${parameters}`;
  try {
    const workbook = await fetchUkDmoWorkbook(url);
    if (!workbook) return [];
    const giltsInIssue = await fetchUkDmoGiltsInIssue();
    const settlements = await fetchUkDmoAuctionNoticeSettlements();
    const records = parseUkDmoIssuanceCalendar(
      workbook,
      UK_DMO_D5D_REPORT_URL,
      150
    ).map(record => {
      const normalizedName = normalizeGiltName(record.securityType);
      const settlement = settlements.get(
        `${record.auctionDate}:${normalizedName}`
      );
      const giltInIssue = giltsInIssue.get(normalizedName);
      const sourceNames = ["UK DMO Outright Gilt Issuance Calendar (D5D)"];
      if (giltInIssue) sourceNames.push("Gilts in Issue (D1A)");
      if (settlement) sourceNames.push("Auction Press Notice");
      return {
        ...record,
        issueDate: settlement?.settlementDate ?? null,
        maturityDate: giltInIssue?.maturityDate ?? null,
        isin: settlement?.isin ?? giltInIssue?.isin ?? null,
        sourceLabel: sourceNames.join(" + "),
        sourceUrl:
          settlement?.sourceUrl ?? giltInIssue?.sourceUrl ?? record.sourceUrl,
      };
    });
    ukDmoCalendarCache = { expiresAt: Date.now() + 10 * 60_000, records };
    return records.slice(0, limit);
  } catch {
    return [];
  }
}

/** 多国官方融资日历聚合；未有结构化官方记录的国家仅返回来源及真实待接入状态。 */
export async function fetchOfficialFinancingCalendar(limit = 100) {
  const [
    usAuctions,
    germanIssues,
    ukDmoEvents,
    japanEvents,
    franceEvents,
    italyEvents,
  ] = await Promise.all([
    fetchTreasuryAuctions(Math.min(limit, 50)),
    fetchGermanFederalIssuanceCalendar(limit),
    fetchUkDmoGiltAuctions(limit),
    fetchJapanMofWeeklyJgbEvents(limit),
    fetchFranceAftMonthlyCalendar(limit),
    fetchItalyMefAuctions(limit),
  ]);
  const usRecords: OfficialFinancingCalendarRecord[] = usAuctions.map(item => ({
    id: `US-${item.cusip}-${item.auctionDate}`,
    countryCode: "US",
    country: "美国",
    currency: "USD",
    auctionDate: item.auctionDate,
    eventType: "auction",
    securityType: item.securityType,
    securityTerm: item.securityTerm || null,
    issueDate: item.issueDate,
    maturityDate: item.maturityDate,
    offeringAmount: item.offeringAmount,
    couponRate: item.couponRate,
    cusip: item.cusip || null,
    sourceLabel: "U.S. Treasury Fiscal Data",
    sourceUrl:
      "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/",
  }));
  return {
    records: [
      ...usRecords,
      ...germanIssues,
      ...ukDmoEvents,
      ...japanEvents,
      ...franceEvents,
      ...italyEvents,
    ]
      .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate))
      .slice(0, limit),
    sources: [
      {
        countryCode: "US",
        country: "美国",
        status: usRecords.length
          ? ("available" as const)
          : ("unavailable" as const),
        sourceLabel: "U.S. Treasury Fiscal Data",
        sourceUrl:
          "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/",
        limitation: usRecords.length
          ? "官方一级市场记录，不是二级市场报价。"
          : "官方接口本次未返回可展示记录。",
      },
      {
        countryCode: "DE",
        country: "德国",
        status: germanIssues.length
          ? ("available" as const)
          : ("unavailable" as const),
        sourceLabel: "Deutsche Finanzagentur",
        sourceUrl: GERMAN_ISSUANCE_CALENDAR_URL,
        limitation: germanIssues.length
          ? "官方计划发行记录；金额保留欧元原始口径。"
          : "官方页面本次未解析到结构化发行记录。",
      },
      {
        countryCode: "GB",
        country: "英国",
        status: ukDmoEvents.length
          ? ("available" as const)
          : ("unavailable" as const),
        sourceLabel: "UK DMO Outright Gilt Issuance Calendar (D5D)",
        sourceUrl: UK_DMO_D5D_REPORT_URL,
        limitation: ukDmoEvents.length
          ? "官方 XLS 仅展示 Outright Auction；操作日、gilt 名称和名义规模按英镑原始口径保存，交收和到期日未披露时保持为空。"
          : "DMO 官方 D5D XLS 本次未解析到可展示的 Outright Auction。",
      },
      {
        countryCode: "JP",
        country: "日本",
        status: japanEvents.length
          ? ("available" as const)
          : ("unavailable" as const),
        sourceLabel: "Japan Ministry of Finance Weekly Schedule",
        sourceUrl: JAPAN_MOF_WEEKLY_SCHEDULE_URL,
        limitation: japanEvents.length
          ? "已发布的 JGB 公告/结果事件；事件日为财务省公布日，规模与到期日未披露时保持为空。"
          : "官方周度页面本次未解析到可展示的 JGB 事件。",
      },
      {
        countryCode: "FR",
        country: "法国",
        status: franceEvents.length
          ? ("available" as const)
          : ("unavailable" as const),
        sourceLabel: "Agence France Trésor Issuance Announcements",
        sourceUrl: FRANCE_AFT_MONTHLY_CALENDAR_URL,
        limitation: franceEvents.length
          ? "从 AFT 首页当前明确列示的单场发行公告读取公告、拍卖和交收日期；金额或期限未逐笔披露时保持为空。"
          : "AFT 官方公告本次未返回可解析的明确日期；系统未根据月度日历规律补造事件。",
      },
      {
        countryCode: "IT",
        country: "意大利",
        status: italyEvents.length
          ? ("available" as const)
          : ("unavailable" as const),
        sourceLabel: "MEF Treasury Bills Auction Calendar",
        sourceUrl: ITALY_MEF_BOT_CALENDAR_URL(new Date().getUTCFullYear()),
        limitation: italyEvents.length
          ? "官方 BOT 年度日历已明确披露公告、拍卖、交收与到期日期；金额须以单场公告为准，未披露时保持为空。"
          : "MEF 官方年度 BOT 日历本次未解析到可展示事件。",
      },
      {
        countryCode: "EU",
        country: "欧元区国家参考",
        status: "indexed",
        sourceLabel: "European Commission National Issuance Information",
        sourceUrl:
          "https://economic-financial-policy-committees.europa.eu/economic-and-financial-committee/working-groups/efc-sub-committee-eu-sovereign-debt-markets/issuance-calendar_en",
        limitation: "作为国家发布口径索引；不根据规律推测具体发行日期。",
      },
    ],
  };
}
