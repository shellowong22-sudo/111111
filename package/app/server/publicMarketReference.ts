import { fetchYahooChart, type YahooChartResult } from "./realDataService";

export type PublicFutureContract = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  multiplier: number;
  currency: string;
};

/**
 * Public Yahoo symbols are reference-market contracts, not a user's positions.
 * Keep this distinction explicit so a public quote can never be presented as
 * an account position, fill, or executable order.
 */
export const PUBLIC_FUTURE_CONTRACTS: PublicFutureContract[] = [
  { symbol: "ES", yahooSymbol: "ES=F", name: "E-mini S&P 500", exchange: "CME", multiplier: 50, currency: "USD" },
  { symbol: "NQ", yahooSymbol: "NQ=F", name: "E-mini Nasdaq 100", exchange: "CME", multiplier: 20, currency: "USD" },
  { symbol: "YM", yahooSymbol: "YM=F", name: "E-mini Dow", exchange: "CBOT", multiplier: 5, currency: "USD" },
  { symbol: "RTY", yahooSymbol: "RTY=F", name: "E-mini Russell 2000", exchange: "CME", multiplier: 50, currency: "USD" },
  { symbol: "CL", yahooSymbol: "CL=F", name: "WTI Crude Oil", exchange: "NYMEX", multiplier: 1000, currency: "USD" },
  { symbol: "GC", yahooSymbol: "GC=F", name: "Gold", exchange: "COMEX", multiplier: 100, currency: "USD" },
  { symbol: "SI", yahooSymbol: "SI=F", name: "Silver", exchange: "COMEX", multiplier: 5000, currency: "USD" },
  { symbol: "ZB", yahooSymbol: "ZB=F", name: "30-Year U.S. Treasury Bond", exchange: "CBOT", multiplier: 1000, currency: "USD" },
  { symbol: "ZN", yahooSymbol: "ZN=F", name: "10-Year U.S. Treasury Note", exchange: "CBOT", multiplier: 1000, currency: "USD" },
  { symbol: "6E", yahooSymbol: "6E=F", name: "Euro FX", exchange: "CME", multiplier: 125000, currency: "USD" },
];

export type PublicFutureQuote = PublicFutureContract & {
  available: boolean;
  price: number | null;
  change: number | null;
  changePct: number | null;
  observedAt: string | null;
  realtimeStatus: "delayed" | "end_of_day" | "unavailable";
  source: string;
  history: Array<{
    date: string;
    close: number;
    volume: number | null;
  }>;
  limitation?: string;
};

function metadata(result: YahooChartResult | null) {
  const meta = (result?.meta ?? {}) as Record<string, unknown>;
  const status = meta.realtimeStatus;
  const realtimeStatus: PublicFutureQuote["realtimeStatus"] =
    status === "delayed" || status === "end_of_day" ? status : "unavailable";
  return {
    observedAt:
      typeof meta.providerTimestamp === "string"
        ? meta.providerTimestamp
        : result?.history.at(-1)?.timestamp ?? result?.history.at(-1)?.date ?? null,
    realtimeStatus,
  };
}

export async function fetchPublicFutureQuotes(): Promise<PublicFutureQuote[]> {
  const results = await Promise.all(
    PUBLIC_FUTURE_CONTRACTS.map(async contract => {
      let result: YahooChartResult | null = null;
      try {
        result = await fetchYahooChart(contract.yahooSymbol, "5d", "1d");
      } catch {
        result = null;
      }
      const freshness = metadata(result);
      return {
        ...contract,
        available: Boolean(result),
        price: result?.price ?? null,
        change: result?.change ?? null,
        changePct: result?.changePct ?? null,
        observedAt: freshness.observedAt,
        realtimeStatus: result ? freshness.realtimeStatus : "unavailable",
        source: result?.source ?? "Yahoo Finance public chart",
        history: result?.history
          .filter(point => point.close !== null)
          .map(point => ({
            date: point.date,
            close: Number(point.close),
            volume: point.volume,
          })) ?? [],
        ...(result
          ? {}
          : {
              limitation:
                "该合约本次未取得可核验的公开行情；系统不会用随机数或上次价格补位。",
            }),
      };
    }),
  );
  return results;
}

export function calculateBasis(
  future: PublicFutureQuote,
  spot: YahooChartResult | null,
) {
  const futureLatest = future.history.at(-1)?.close ?? future.price;
  const spotLatest = spot?.history.at(-1)?.close ?? spot?.price ?? null;
  if (futureLatest === null || spotLatest === null || spotLatest === 0) return null;
  const futurePrevious = future.history.at(-2)?.close ?? futureLatest;
  const spotPrevious = spot?.history.at(-2)?.close ?? spotLatest;
  const basis = futureLatest - spotLatest;
  const previousBasis = futurePrevious - spotPrevious;
  return {
    basis,
    basisChange1D: basis - previousBasis,
    theoreticalBasis: basis,
    richCheap: basis > 0 ? "Rich" : basis < 0 ? "Cheap" : "Flat",
    carryYield: null,
    convenienceYield: null,
  };
}
