import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchYahooChart } from "../realDataService";
import { calculateBasis, fetchPublicFutureQuotes } from "../publicMarketReference";

const PRIVATE_DATA_LIMITATION =
  "此页面的成交、经纪商、账户持仓、P&L、VaR 和订单簿属于私有交易数据。当前未配置经纪商、清算机构、托管行或用户导入账本，因此系统不生成模拟数据。";

const PUBLIC_REFERENCE_NOTE =
  "以下为 Yahoo Finance 公共期货参考行情，不代表用户持仓、成交或可执行报价；公共源通常为延迟或日频，实时权限需接入交易所/经纪商授权源。";
type AnyRow = Record<string, any>;

const emptyTbgs = {
  available: false as const,
  summary: {
    totalVolume: null,
    totalTrades: null,
    avgTradeSize: null,
    fillRate: null,
    avgLatency: null,
    marketShare: null,
  },
  venueBreakdown: [] as AnyRow[],
  assetBreakdown: [] as AnyRow[],
  hourlyActivity: [] as AnyRow[],
  marketMakingStats: null,
  source: null,
  limitation: PRIVATE_DATA_LIMITATION,
};

export const tradeBlotterRouter = router({
  getTBGSStats: publicProcedure.query(() => emptyTbgs),

  /**
   * BTFI is populated from public futures quotes. Position-specific columns are
   * deliberately null because a market quote is not an account position.
   */
  getFuturesPositions: publicProcedure.query(async () => {
    const quotes = await fetchPublicFutureQuotes();
    const positions = quotes
      .filter(quote => quote.available)
      .map(quote => {
        const last = quote.history.at(-1)?.close ?? quote.price;
        return {
          symbol: quote.symbol,
          name: quote.name,
          exchange: quote.exchange,
          multiplier: quote.multiplier,
          expiryMonth: null,
          daysToExpiry: null,
          currentPrice: last,
          avgCost: null,
          position: null,
          notional: null,
          unrealizedPnl: null,
          realizedPnl: null,
          delta: null,
          gamma: null,
          theta: null,
          margin: null,
          openInterest: null,
          volume: quote.history.at(-1)?.volume ?? null,
          rollDate: null,
          change: quote.change,
          changePct: quote.changePct,
          observedAt: quote.observedAt,
          realtimeStatus: quote.realtimeStatus,
          source: quote.source,
          marketReference: true,
        };
      });

    return {
      available: positions.length > 0,
      positions,
      summary: {
        totalLong: null,
        totalShort: null,
        totalUnrealizedPnl: null,
        totalRealizedPnl: null,
        totalMargin: null,
        netDelta: null,
      },
      source: positions.length > 0 ? "Yahoo Finance public chart" : null,
      limitation:
        positions.length > 0
          ? `${PUBLIC_REFERENCE_NOTE} 持仓、成本、保证金和 P&L 需账户授权。`
          : "当前未取得可核验的公开期货行情。",
      refreshedAt: new Date().toISOString(),
    };
  }),

  getRollCalendar: publicProcedure.query(() => ({
    available: false as const,
    data: [] as AnyRow[],
    source: null,
    limitation:
      "公开行情接口只提供连续合约参考价，未提供可审计的交易所合约主数据、到期日和展期规则；系统不猜测到期日。",
  })),

  getBasisAnalysis: publicProcedure.query(async () => {
    const quotes = await fetchPublicFutureQuotes();
    const pairs = [
      { future: "ES", spot: "^GSPC", spotName: "S&P 500 Spot" },
      { future: "NQ", spot: "^NDX", spotName: "Nasdaq 100 Spot" },
      { future: "YM", spot: "^DJI", spotName: "Dow Jones Spot" },
      { future: "RTY", spot: "^RUT", spotName: "Russell 2000 Spot" },
    ];
    const result = [];
    for (const pair of pairs) {
      const future = quotes.find(item => item.symbol === pair.future);
      if (!future?.available) continue;
      const spot = await fetchYahooChart(pair.spot, "5d", "1d");
      const basis = calculateBasis(future, spot);
      if (!basis) continue;
      result.push({
        future: `${pair.future} continuous`,
        spot: pair.spotName,
        basis: Number(basis.basis.toFixed(4)),
        basisChange1D: Number(basis.basisChange1D.toFixed(4)),
        basisChange1W: null,
        theoreticalBasis: Number(basis.theoreticalBasis.toFixed(4)),
        richCheap: basis.richCheap,
        carryYield: basis.carryYield,
        convenienceYield: basis.convenienceYield,
        source: `${future.source} + ${spot?.source ?? "Yahoo Finance public chart"}`,
        observedAt: future.observedAt,
      });
    }
    return {
      available: result.length > 0,
      data: result,
      limitation:
        result.length > 0
          ? "基差为连续合约与指数参考序列的价差，不是可交割现货基差；周变化、持有成本和便利收益需要对应市场数据源。"
          : "未取得同时可核验的期货与现货/指数序列。",
    };
  }),

  getTradeBookSummary: publicProcedure.query(() => ({
    available: false as const,
    books: [] as AnyRow[],
    aggregate: {
      totalAUM: null,
      totalDailyPnl: null,
      totalYtdPnl: null,
      totalPositions: null,
      weightedSharpe: null,
    },
    limitation: PRIVATE_DATA_LIMITATION,
  })),

  getTradeHistory: publicProcedure
    .input(z.object({ book: z.string().optional(), limit: z.number().optional() }).optional())
    .query(() => ({
      available: false as const,
      trades: [] as AnyRow[],
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getPnLAttribution: publicProcedure
    .input(z.object({ book: z.string().optional() }))
    .query(() => ({
      available: false as const,
      totalPnl: null,
      totalReturn: null,
      factors: [] as AnyRow[],
      periodStart: null,
      periodEnd: null,
      limitation: PRIVATE_DATA_LIMITATION,
    })),

  getRiskExposure: publicProcedure.query(() => ({
    available: false as const,
    data: [] as AnyRow[],
    limitation: PRIVATE_DATA_LIMITATION,
  })),
});
