/**
 * 电子交易路由 (Electronic Trading & Order Management)
 * 蓝图章节: 2.13 电子交易及委托单递送
 * 功能代码: FIT / FITG / BOLT / BBTM / BLOT / TSOX / PTBB / NOTC / EMSX / IMGR / VCON / UACK
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchYahooChart } from "../realDataService";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

const OrderSideEnum = z.enum(["BUY", "SELL", "SHORT", "COVER"]);
const OrderTypeEnum = z.enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT", "MOC", "LOC", "TWAP", "VWAP", "POV", "IS"]);
const OrderStatusEnum = z.enum(["PENDING", "WORKING", "PARTIAL", "FILLED", "CANCELLED", "REJECTED", "EXPIRED"]);
const AssetClassEnum = z.enum(["EQUITY", "FIXED_INCOME", "FX", "COMMODITY", "DERIVATIVE", "FUND", "CRYPTO"]);
const AlgoTypeEnum = z.enum(["TWAP", "VWAP", "POV", "IS", "SNIPER", "ICEBERG", "ARRIVAL_PRICE"]);
const SIMULATED_TRADING_LIMITATION = '当前恢复资产未包含可核验的账户授权、经纪商回执、订单、成交、订单簿、风险或 VWAP 基准记录；系统不以内存样本、随机成交或固定报价替代。';
const UnavailableOrderSubmissionSchema = z.object({ allPassed: z.boolean(), order: z.object({ status: z.string(), avgFillPrice: z.number().nullable().optional() }), riskChecks: z.record(z.string(), z.boolean()) });

const PUBLIC_QUOTE_SYMBOLS: Record<string, string> = {
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  RUT: "^RUT",
  "EUR/USD": "EURUSD=X",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  GLD: "GLD",
  BTC: "BTC-USD",
  ES: "ES=F",
  OIL: "CL=F",
};

function normalizePublicQuoteSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase().replace(/\s+US$/, "");
  return PUBLIC_QUOTE_SYMBOLS[normalized] ?? normalized;
}

// This router is intentionally quote-only until a broker/account connector is
// configured. Do not keep example orders or executions in memory: they are
// indistinguishable from a user's real trading history in the UI.

// ─── 路由定义 ─────────────────────────────────────────────────────────────────

export const tradingRouter = router({
  /**
   * Public quote reference for the existing electronic-trading panel.
   * This is quote-only: it never creates an executable order and never falls
   * back to a fixed/sample price.
   */
  getLiveQuotes: publicProcedure
    .input(z.object({
      symbols: z.array(z.string().trim().min(1).max(32)).min(1).max(20),
    }))
    .query(async ({ input }) => {
      const queriedAt = new Date().toISOString();
      const items = await Promise.all(input.symbols.map(async (requested) => {
        const symbol = requested.trim();
        const providerSymbol = normalizePublicQuoteSymbol(symbol);
        const intraday = await fetchYahooChart(providerSymbol, "1d", "1m");
        const daily = intraday ? null : await fetchYahooChart(providerSymbol, "5d", "1d");
        const chart = intraday ?? daily;
        if (!chart) {
          return {
            symbol,
            providerSymbol,
            available: false as const,
            realtime: false as const,
            price: null,
            changePct: null,
            currency: null,
            observedAt: null,
            source: null,
            realtimeStatus: null,
            limitation: "公开行情源未返回可验证观察；系统不填充固定报价。",
          };
        }
        const latest = chart.history.at(-1);
        const realtimeStatus = typeof chart.meta.realtimeStatus === "string"
          ? chart.meta.realtimeStatus
          : chart.meta.persistentFallback === true
            ? "archived"
            : "end_of_day";
        const observedAt = typeof chart.meta.observedAt === "string"
          ? chart.meta.observedAt
          : latest?.timestamp ?? latest?.date ?? null;
        const current = Boolean(intraday && latest && chart.price != null);
        return {
          symbol,
          providerSymbol,
          available: current,
          realtime: current,
          price: current ? chart.price : null,
          changePct: current ? chart.changePct : null,
          currency: chart.currency,
          observedAt,
          source: chart.source,
          realtimeStatus,
          limitation: current
            ? null
            : "仅取得日频/归档观察；未作为电子交易报价使用。",
        };
      }));
      return { queriedAt, items };
    }),

  // ── 订单管理 ──────────────────────────────────────────────────────────────

  /** 获取订单列表（支持过滤） */
  getOrders: publicProcedure
    .input(z.object({
      status: z.array(OrderStatusEnum).optional(),
      assetClass: AssetClassEnum.optional(),
      account: z.string().optional(),
      symbol: z.string().optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(({ input }) => ({
      items: [],
      total: 0,
      page: input.page,
      pageSize: input.pageSize,
      available: false,
      limitation: SIMULATED_TRADING_LIMITATION,
    })),

  /** 提交新订单 */
  submitOrder: publicProcedure
    .input(z.object({
      symbol: z.string().min(1),
      name: z.string().default(""),
      side: OrderSideEnum,
      type: OrderTypeEnum,
      qty: z.number().positive(),
      price: z.number().optional(),
      stopPrice: z.number().optional(),
      assetClass: AssetClassEnum,
      account: z.string().default("ACC-001"),
      broker: z.string().default("Goldman Sachs"),
      algoType: AlgoTypeEnum.optional(),
      algoParams: z.record(z.string(), z.any()).optional(),
      tif: z.enum(["DAY", "GTC", "IOC", "FOK", "GTD"]).default("DAY"),
      notes: z.string().optional(),
    }))
    .output(UnavailableOrderSubmissionSchema)
    .mutation(() => { throw new Error(`来源不可用：${SIMULATED_TRADING_LIMITATION}`); }),

  /** 修改订单 */
  amendOrder: publicProcedure
    .input(z.object({
      orderId: z.string(),
      newQty: z.number().positive().optional(),
      newPrice: z.number().positive().optional(),
      newStopPrice: z.number().positive().optional(),
    }))
    .mutation(() => {
      throw new Error(`来源不可用：${SIMULATED_TRADING_LIMITATION}`);
    }),

  /** 撤销订单 */
  cancelOrder: publicProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(() => {
      throw new Error(`来源不可用：${SIMULATED_TRADING_LIMITATION}`);
    }),

  /** 批量撤销 */
  cancelAllOrders: publicProcedure
    .input(z.object({
      account: z.string().optional(),
      assetClass: AssetClassEnum.optional(),
    }))
    .mutation(() => {
      throw new Error(`来源不可用：${SIMULATED_TRADING_LIMITATION}`);
    }),

  // ── 执行监控 ──────────────────────────────────────────────────────────────

  /** 获取成交记录 */
  getExecutions: publicProcedure
    .input(z.object({
      orderId: z.string().optional(),
      symbol: z.string().optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(100),
    }))
    .query(() => ({
      items: [],
      total: 0,
      available: false,
      limitation: SIMULATED_TRADING_LIMITATION,
    })),

  /** 执行质量分析（VWAP对比/滑点统计） */
  getExecutionQuality: publicProcedure
    .input(z.object({ symbol: z.string().optional(), dateFrom: z.number().optional() }))
    .query(() => ({
      metrics: [],
      summary: {
        totalOrders: 0,
        totalFills: 0,
        avgSlippage: null,
        avgFillRate: null,
        totalCommission: null,
        marketImpact: null,
      },
      available: false,
      limitation: SIMULATED_TRADING_LIMITATION,
    })),

  // ── 算法交易 ──────────────────────────────────────────────────────────────

  /** 获取算法交易任务列表 */
  getAlgoOrders: publicProcedure.query(() => ({
    items: [],
    available: false,
    limitation: SIMULATED_TRADING_LIMITATION,
  })),

  /** 暂停/恢复算法订单 */
  pauseAlgoOrder: publicProcedure
    .input(z.object({ orderId: z.string(), action: z.enum(["PAUSE", "RESUME"]) }))
    .mutation(() => {
      throw new Error(`来源不可用：${SIMULATED_TRADING_LIMITATION}`);
    }),

  // ── 风险控制 ──────────────────────────────────────────────────────────────

  /** 获取实时风险指标 */
  getRiskMetrics: publicProcedure.query(() => ({ totalExposure: 0, exposureLimit: 0, exposureUtilization: 0, openOrders: 0, orderLimit: 0, orderUtilization: 0, dailyPnL: 0, dailyPnLLimit: 0, dailyTurnover: 0, turnoverLimit: 0, concentrationRisk: 0, concentrationLimit: 0, alerts: [], available: false, limitation: SIMULATED_TRADING_LIMITATION, asOf: new Date().toISOString() })),

  /** 获取订单簿快照。公开行情不包含可审计 Level 2，因此不拼接盘口。 */
  getOrderBook: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => ({
      symbol: input.symbol,
      timestamp: new Date().toISOString(),
      bids: [],
      asks: [],
      lastPrice: null,
      spread: null,
      spreadBps: null,
      midPrice: null,
      totalBidSize: null,
      totalAskSize: null,
      available: false,
      limitation: "公开行情源未提供可审计 Level 2 订单簿；系统不会用盘口模板或随机量填充。",
    })),

  /** 获取VWAP基准价格 */
  getVWAPBenchmark: publicProcedure
    .input(z.object({ symbol: z.string(), interval: z.enum(["1m", "5m", "15m", "30m", "1h"]).default("5m") }))
    .query(async ({ input }) => {
      const providerSymbol = normalizePublicQuoteSymbol(input.symbol);
      const chart = await fetchYahooChart(providerSymbol, "1d", input.interval === "1h" ? "60m" : input.interval);
      if (!chart) {
        return {
          symbol: input.symbol,
          interval: input.interval,
          data: [],
          available: false,
          limitation: "公开行情源未返回可验证的价格与成交量序列；系统不生成合成 VWAP。",
        };
      }
      let cumulativeVolume = 0;
      let cumulativeTurnover = 0;
      const data = chart.history
        .filter(point => point.close != null && point.volume != null)
        .map(point => {
          const volume = Number(point.volume);
          const price = Number(point.close);
          cumulativeVolume += volume;
          cumulativeTurnover += price * volume;
          return {
            time: point.timestamp ?? point.date,
            price,
            volume,
            vwap: cumulativeVolume > 0 ? cumulativeTurnover / cumulativeVolume : null,
          };
        });
      return {
        symbol: input.symbol,
        interval: input.interval,
        data,
        available: data.length > 0,
        observedAt: chart.meta.observedAt ?? data.at(-1)?.time ?? null,
        source: chart.source,
        limitation: data.length > 0 ? null : "行情源未返回包含成交量的序列；系统不填充合成数据。",
      };
    }),

  // ── 统计汇总 ──────────────────────────────────────────────────────────────

  /** 订单统计汇总 */
  getOrderSummary: publicProcedure.query(() => ({
    statusCounts: {},
    assetCounts: {},
    totalOrders: 0,
    totalNotional: null,
    totalExecutions: 0,
    workingOrders: 0,
    available: false,
    limitation: SIMULATED_TRADING_LIMITATION,
  })),
});
