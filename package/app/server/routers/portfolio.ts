import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchYahooChart } from "../realDataService";

/**
 * Portfolio endpoints are account-bound. The previous implementation returned
 * a hard-coded portfolio and random performance/risk series, which made the
 * professional page look populated without any user data. Public market
 * history is still available for a selected symbol; account metrics remain
 * empty until a real holdings/ledger connector is configured.
 */
const ACCOUNT_DATA_LIMITATION =
  "未接入可核验的用户持仓、成本、成交、基准与账户风险源；系统不生成示例持仓、随机收益、VaR、归因或优化权重。";
type AnyRow = Record<string, any>;
const EMPTY_ROWS: AnyRow[] = [];

const benchmarkSymbols: Record<string, string> = {
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  RUT: "^RUT",
};

function unavailable<T>(data: T) {
  return {
    ...data,
    available: false as const,
    limitation: ACCOUNT_DATA_LIMITATION,
  };
}

export const portfolioRouter = router({
  getHoldings: publicProcedure.query(() =>
    unavailable({
      totalValue: null as number | null,
      totalCost: null as number | null,
      totalPnl: null as number | null,
      holdings: EMPTY_ROWS,
    }),
  ),

  getPerformance: publicProcedure
    .input(z.object({ days: z.number().int().positive().max(2500).default(252) }))
    .query(() => EMPTY_ROWS),

  getEfficientFrontier: publicProcedure.query(() =>
    unavailable({
      frontier: EMPTY_ROWS,
      currentPortfolio: null as Record<string, any> | null,
      minVariance: null as Record<string, any> | null,
      maxSharpe: null as Record<string, any> | null,
    }),
  ),

  getRiskMetrics: publicProcedure.query(() =>
    unavailable({
      var95: null as number | null,
      var99: null as number | null,
      cvar95: null as number | null,
      cvar99: null as number | null,
      sharpe: null as number | null,
      sortino: null as number | null,
      calmar: null as number | null,
      maxDrawdown: null as number | null,
      volatility: null as number | null,
      beta: null as number | null,
      alpha: null as number | null,
      informationRatio: null as number | null,
      trackingError: null as number | null,
      treynorRatio: null as number | null,
    }),
  ),

  getAttributionAnalysis: publicProcedure.query(() =>
    unavailable({
      totalReturn: null as number | null,
      benchmarkReturn: null as number | null,
      activeReturn: null as number | null,
      attribution: EMPTY_ROWS,
      sectorAttribution: EMPTY_ROWS,
    }),
  ),

  getStressTest: publicProcedure.query(() => EMPTY_ROWS),

  getCorrelationMatrix: publicProcedure.query(() =>
    unavailable({ assets: [] as string[], matrix: [] as number[][] }),
  ),

  getVarTimeSeries: publicProcedure
    .input(z.object({ days: z.number().int().positive().max(2500).default(90) }))
    .query(() => EMPTY_ROWS),

  /**
   * Public symbol history is not an account metric. It is fetched from the
   * existing Yahoo adapter so the drawer can show a real timestamped series
   * without implying that it is a portfolio holding.
   */
  getPriceHistory: publicProcedure
    .input(z.object({ symbol: z.string().trim().min(1).max(32), days: z.number().int().positive().max(2500).default(30) }))
    .query(async ({ input }) => {
      const range = input.days > 365 ? "2y" : input.days > 90 ? "1y" : input.days > 30 ? "3mo" : "1mo";
      const chart = await fetchYahooChart(input.symbol, range, "1d");
      if (!chart || chart.history.length === 0) {
        return {
          symbol: input.symbol,
          data: [],
          minPrice: null,
          maxPrice: null,
          firstPrice: null,
          lastPrice: null,
          totalReturn: null,
          available: false as const,
          limitation: "公开行情源未返回可验证历史；系统不生成替代价格序列。",
        };
      }
      const data = chart.history
        .filter(point => point.close != null)
        .map(point => ({
          date: point.date,
          price: Number(point.close),
          return: null as number | null,
        }));
      for (let i = 1; i < data.length; i++) {
        data[i].return = data[i - 1].price
          ? (data[i].price / data[i - 1].price - 1) * 100
          : null;
      }
      const prices = data.map(point => point.price);
      const firstPrice = data[0]?.price ?? null;
      const lastPrice = data.at(-1)?.price ?? null;
      return {
        symbol: input.symbol,
        data,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        firstPrice,
        lastPrice,
        totalReturn: firstPrice && lastPrice ? (lastPrice / firstPrice - 1) * 100 : null,
        available: data.length > 0,
        observedAt: chart.meta.observedAt ?? data.at(-1)?.date ?? null,
        source: chart.source,
        limitation: null,
      };
    }),

  getBenchmarkHistory: publicProcedure
    .input(z.object({
      benchmarks: z.array(z.enum(["SPX", "NDX", "DJI", "RUT"])).default(["SPX"]),
      days: z.number().int().positive().max(2500).default(30),
    }))
    .query(async ({ input }) => {
      const range = input.days > 365 ? "2y" : input.days > 90 ? "1y" : input.days > 30 ? "3mo" : "1mo";
      const results = await Promise.all(input.benchmarks.map(async benchmark => {
        const chart = await fetchYahooChart(benchmarkSymbols[benchmark], range, "1d");
        const points = chart?.history.filter(point => point.close != null) ?? [];
        let base: number | null = null;
        const data = points.map(point => {
          const close = Number(point.close);
          if (base == null) base = close;
          return { date: point.date, return: null as number | null, cumReturn: base ? (close / base - 1) * 100 : null };
        });
        for (let i = 1; i < points.length; i++) {
          const prior = Number(points[i - 1]?.close);
          const current = Number(points[i]?.close);
          if (data[i] && prior) data[i].return = (current / prior - 1) * 100;
        }
        return [benchmark, data] as const;
      }));
      const available = results.some(([, points]) => points.length > 0);
      return {
        benchmarks: input.benchmarks,
        meta: Object.fromEntries(input.benchmarks.map(benchmark => [benchmark, { name: benchmark, color: "#64748b" }])),
        data: Object.fromEntries(results),
        available,
        limitation: available ? null : "公开指数源未返回可验证历史；系统不生成基准序列。",
      };
    }),

  getOptimizationResult: publicProcedure
    .input(z.object({
      objective: z.enum(["maxSharpe", "minVariance", "maxReturn", "minCVaR"]),
      maxWeight: z.number().default(0.25),
      minWeight: z.number().default(0.01),
      targetReturn: z.number().optional(),
      maxRisk: z.number().optional(),
    }))
    .query(({ input }) => ({
      objective: input.objective,
      return: null as number | null,
      risk: null as number | null,
      sharpe: null as number | null,
      description: null,
      weights: EMPTY_ROWS,
      available: false as const,
      limitation: ACCOUNT_DATA_LIMITATION,
    })),
});
