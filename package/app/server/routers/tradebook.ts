import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchPublicFutureQuotes } from "../publicMarketReference";

const PRIVATE_DATA_LIMITATION =
  "交易账簿、账户、成本、成交、现金流和风险指标需要经纪商/托管行授权或用户导入账本。当前没有可核验的账户数据，系统不生成示例持仓或随机 P&L。";

type TradebookPosition = {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  quantity: number;
  avgCost: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
  dayPnL: number | null;
  weight: number | null;
  beta: number | null;
  delta: number | null;
  gamma: number | null;
  vega: number | null;
  theta: number | null;
  impliedVol: number | null;
  duration: number | null;
  dv01: number | null;
  yieldToMaturity: number | null;
};

type PnLSummary = {
  totalPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  avgDailyPnL: number;
  stdDev: number;
  bestDay: number;
  worstDay: number;
};

type RiskGreeks = {
  totalDelta: number;
  totalGamma: number;
  totalVega: number;
  totalTheta: number;
  netBeta: number;
};

type RiskVar = {
  portfolioValue: number;
  var95: number;
  var99: number;
  cvar95: number;
};

type Concentration = {
  byAssetClass: Array<{ name: string; weight: number; value: number }>;
  bySector: Array<{ name: string; weight: number }>;
  top5Concentration: number;
};

export const tradebookRouter = router({
  getPositions: publicProcedure
    .input(
      z.object({
        account: z.string().optional(),
        assetClass: z.string().optional(),
        sector: z.string().optional(),
        showFlat: z.boolean().default(false),
      }),
    )
    .query(() => ({
      available: false as const,
      positions: [] as TradebookPosition[],
      summary: {
        totalMarketValue: null,
        totalUnrealizedPnL: null,
        totalRealizedPnL: null,
        totalDayPnL: null,
        totalCostBasis: null,
        totalPnL: null,
        returnPct: null,
        positionCount: 0,
      },
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getPositionDetail: publicProcedure
    .input(z.object({ positionId: z.string() }))
    .query(() => ({
      available: false as const,
      position: null as TradebookPosition | null,
      history: [] as Array<{ date: string; pnl: number | null }>,
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getPnLAnalysis: publicProcedure
    .input(
      z.object({
        account: z.string().optional(),
        period: z.enum(["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"]).default("1M"),
      }),
    )
    .query(() => ({
      available: false as const,
      history: [] as Array<{ date: string; cumulativePnL: number | null; dailyPnL: number | null }>,
      summary: null as PnLSummary | null,
      attribution: [] as Array<{ category: string; pnl: number | null; contribution: number | null }>,
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getRiskExposure: publicProcedure
    .input(z.object({ account: z.string().optional() }))
    .query(() => ({
      available: false as const,
      greeks: null as RiskGreeks | null,
      var: null as RiskVar | null,
      concentration: null as Concentration | null,
      stressTests: [] as Array<{ scenario: string; probability: number | null; impact: number | null }>,
      dv01: null,
      duration: null,
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getAccounts: publicProcedure.query(() => ({
    available: false as const,
    accounts: [],
    limitation: PRIVATE_DATA_LIMITATION,
  })),

  getCashFlows: publicProcedure
    .input(z.object({ account: z.string().optional(), days: z.number().default(30) }))
    .query(() => ({
      available: false as const,
      cashFlows: [],
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getTradebookSummary: publicProcedure.query(() => ({
    available: false as const,
    totalNav: null,
    totalLong: null,
    totalShort: null,
    netExposure: null,
    grossExposure: null,
    totalPnL: null,
    dayPnL: null,
    positionCount: 0,
    longCount: 0,
    shortCount: 0,
    accounts: 0,
    lastUpdated: null,
    limitation: PRIVATE_DATA_LIMITATION,
  })),

  /**
   * Public futures reference quotes remain useful in the existing BTFI panel.
   * They are explicitly labelled as market reference rows, never as positions.
   */
  getFuturesPositions: publicProcedure.query(async () => {
    const quotes = await fetchPublicFutureQuotes();
    return quotes
      .filter(quote => quote.available)
      .map(quote => ({
        symbol: quote.symbol,
        name: quote.name,
        exchange: quote.exchange,
        quantity: null,
        avgPrice: null,
        currentPrice: quote.price,
        pnl: null,
        dayPnL: quote.change,
        openInterest: null,
        expiry: null,
        contractSize: quote.multiplier,
        currency: quote.currency,
        initialMargin: null,
        maintenanceMargin: null,
        marginUsed: null,
        beta: null,
        delta: null,
        notional: null,
        changePct: quote.changePct,
        observedAt: quote.observedAt,
        realtimeStatus: quote.realtimeStatus,
        source: quote.source,
        marketReference: true,
      }));
  }),
});
