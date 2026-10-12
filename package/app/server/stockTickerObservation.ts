import {
  fetchNasdaqHistorical,
  fetchYahooChart,
  type YahooChartResult,
} from "./realDataService";
import { fetchIfindMarketHistory } from "./ifindMarketData";

export type StockRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
export type StockAssetClass = "stocks" | "etf";
type Dependencies = {
  ifind: typeof fetchIfindMarketHistory;
  yahoo: typeof fetchYahooChart;
  nasdaq: typeof fetchNasdaqHistorical;
  now: () => number;
};

/** A missing value stays missing. Only positive, dated observations enter charts. */
export function cleanStockHistory(
  result: YahooChartResult | null,
  range: StockRange,
  now: number
): YahooChartResult | null {
  if (!result) return null;
  const end = new Date(now).toISOString().slice(0, 10);
  const from = new Date(now);
  const months = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "2y": 24, "5y": 60 }[
    range
  ];
  const originalDay = from.getUTCDate();
  from.setUTCDate(1);
  from.setUTCMonth(from.getUTCMonth() - months);
  const monthEnd = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)
  ).getUTCDate();
  from.setUTCDate(Math.min(originalDay, monthEnd));
  const start = from.toISOString().slice(0, 10);
  const unique = new Map<string, YahooChartResult["history"][number]>();
  for (const point of result.history) {
    const time = Date.parse(`${point.date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(point.date) ||
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== point.date ||
      point.date < start ||
      point.date > end ||
      !Number.isFinite(point.value) ||
      point.value <= 0
    )
      continue;
    const positive = (v: number | null) =>
      v !== null && Number.isFinite(v) && v > 0 ? v : null;
    unique.set(point.date, {
      ...point,
      open: positive(point.open),
      high: positive(point.high),
      low: positive(point.low),
      close: positive(point.close),
      volume:
        point.volume !== null &&
        Number.isFinite(point.volume) &&
        point.volume >= 0
          ? point.volume
          : null,
    });
  }
  const history = [...unique.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (!history.length) return null;
  return { ...result, history };
}

/** Coalesce subscribers and bound cache growth. A 403 source is not retried through a second URL. */
export function createStockTickerReader(
  deps: Dependencies = {
    ifind: fetchIfindMarketHistory,
    yahoo: fetchYahooChart,
    nasdaq: fetchNasdaqHistorical,
    now: Date.now,
  }
) {
  const cache = new Map<
    string,
    { until: number; value: YahooChartResult | null }
  >();
  const pending = new Map<string, Promise<YahooChartResult | null>>();
  return async (
    ticker: string,
    range: StockRange,
    assetClass: StockAssetClass = "stocks"
  ) => {
    const key = `${ticker}|${range}|${assetClass}`;
    const hit = cache.get(key);
    if (hit && hit.until > deps.now()) return hit.value;
    if (pending.has(key)) return pending.get(key)!;
    const read = async () => {
      let result: YahooChartResult | null = null;
      try {
        result = cleanStockHistory(
          await deps.ifind(ticker, range),
          range,
          deps.now()
        );
      } catch {
        /* Licensed local source is optional. */
      }
      if (!result) {
        try {
          result = cleanStockHistory(
            await deps.yahoo(ticker, range, "1d"),
            range,
            deps.now()
          );
        } catch {
          /* Independent public source below. */
        }
      }
      if (!result) {
        try {
          result = cleanStockHistory(
            await deps.nasdaq(ticker, range, assetClass),
            range,
            deps.now()
          );
        } catch {
          /* No invented fallback. */
        }
      }
      if (result)
        result = {
          ...result,
          meta: {
            ...result.meta,
            retrievedAt:
              result.meta.retrievedAt ?? new Date(deps.now()).toISOString(),
            frequency: result.meta.frequency ?? "daily",
            realtime:
              result.source === "Tonghuashun iFinD SDK" &&
              result.meta.realtime === true,
          },
        };
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(key, {
        until: deps.now() + (result ? 60_000 : 30_000),
        value: result,
      });
      return result;
    };
    const request = read().finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}

export const fetchPublicTicker = createStockTickerReader();
