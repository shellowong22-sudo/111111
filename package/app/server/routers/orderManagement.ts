import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const ORDER_DATA_LIMITATION =
  "未配置真实经纪商、FIX/交易所、账户授权或 ETF AP 连接；系统不生成模拟订单、报价、篮子、连接成功或合规结果。";
type AnyRow = Record<string, any>;
const EMPTY_ROWS: AnyRow[] = [];

export const orderManagementRouter = router({
  getAIMOrders: publicProcedure
    .input(z.object({ status: z.string().optional(), side: z.string().optional(), account: z.string().optional() }).optional())
    .query(() => ({
      orders: EMPTY_ROWS,
      summary: { totalOrders: 0, pendingOrders: 0, filledOrders: 0, totalNotional: null, totalCommission: null, avgSlippage: null },
      available: false,
      limitation: ORDER_DATA_LIMITATION,
    })),

  submitAIMOrder: publicProcedure
    .input(z.object({
      security: z.string(),
      side: z.enum(["Buy", "Sell"]),
      qty: z.number().positive(),
      orderType: z.string(),
      limitPrice: z.number().optional(),
      account: z.string(),
      broker: z.string(),
      algo: z.string().optional(),
    }))
    .mutation(() => ({
      success: false as const,
      available: false as const,
      orderId: null,
      message: ORDER_DATA_LIMITATION,
    })),

  getTOMSOrders: publicProcedure
    .input(z.object({ side: z.string().optional(), status: z.string().optional() }).optional())
    .query(() => ({
      orders: EMPTY_ROWS,
      riskMetrics: { totalDV01: null, totalNotional: null, activeOrders: 0, avgSpread: null, riskUtilization: null },
      available: false,
      limitation: ORDER_DATA_LIMITATION,
    })),

  getMarketMakingQuotes: publicProcedure.query(() => ({
    quotes: EMPTY_ROWS,
    available: false,
    limitation: ORDER_DATA_LIMITATION,
  })),

  getETFBasket: publicProcedure
    .input(z.object({ etfTicker: z.string().optional() }))
    .query(() => ({
      etfTicker: null,
      navPerShare: null,
      marketPrice: null,
      premium: null,
      totalBasketValue: null,
      components: EMPTY_ROWS,
      creationUnit: null,
      cashComponent: null,
      estimatedFee: null,
      arbitrageOpportunity: null,
      available: false,
      limitation: ORDER_DATA_LIMITATION,
    })),

  getArbitrageMonitor: publicProcedure.query(() => ({
    items: EMPTY_ROWS,
    available: false,
    limitation: ORDER_DATA_LIMITATION,
  })),

  getETFOrders: publicProcedure.query(() => ({
    orders: EMPTY_ROWS,
    available: false,
    limitation: ORDER_DATA_LIMITATION,
  })),

  submitETFOrder: publicProcedure
    .input(z.object({ etf: z.string(), type: z.enum(["Creation", "Redemption"]), units: z.number().positive(), inKind: z.boolean() }))
    .mutation(() => ({
      success: false as const,
      available: false as const,
      orderId: null,
      type: null,
      units: null,
      etf: null,
      totalValue: null,
      message: ORDER_DATA_LIMITATION,
    })),

  getSystemStatus: publicProcedure.query(() => ({
    systems: EMPTY_ROWS,
    connections: EMPTY_ROWS,
    available: false,
    limitation: ORDER_DATA_LIMITATION,
  })),

  runConnectivityTest: publicProcedure
    .input(z.object({ venue: z.string() }))
    .mutation(({ input }) => ({
      success: false as const,
      available: false as const,
      venue: input.venue,
      latency: null as number | null,
      details: ORDER_DATA_LIMITATION,
    })),

  runComplianceCheck: publicProcedure
    .input(z.object({ security: z.string(), side: z.string(), qty: z.number(), price: z.number(), account: z.string() }))
    .mutation(() => ({
      success: false as const,
      available: false as const,
      overallStatus: "Unavailable" as string,
      checks: [] as AnyRow[],
      limitation: ORDER_DATA_LIMITATION,
    })),
});
