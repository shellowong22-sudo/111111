import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

// ============================================================
// Fixed Income Trading Router
// FIT (Fixed Income Trading) / FITG (Grid) / BOLT (Buy/Offer List Trading)
// BLOT (Bloomberg E-Trading Blotter) / TSOX (Fixed Income Execution Mgmt)
// PTBB (Portfolio Trading Basket) / IMGR (Inventory & Pricing)
// ============================================================

const BOND_UNIVERSE = [
  { isin: "US912828YV68", ticker: "T 2.875 05/15/32", issuer: "US Treasury", coupon: 2.875, maturity: "2032-05-15", ytm: 4.32, price: 94.21, duration: 5.8, dv01: 54.8, rating: "AAA", sector: "Government", currency: "USD", outstanding: 48200, bid: 94.19, ask: 94.23, spread: 4 },
  { isin: "US912828ZT09", ticker: "T 3.5 02/15/33", issuer: "US Treasury", coupon: 3.5, maturity: "2033-02-15", ytm: 4.41, price: 93.85, duration: 6.3, dv01: 59.1, rating: "AAA", sector: "Government", currency: "USD", outstanding: 52100, bid: 93.83, ask: 93.87, spread: 4 },
  { isin: "US38141GXZ20", ticker: "GS 4.25 10/21/29", issuer: "Goldman Sachs", coupon: 4.25, maturity: "2029-10-21", ytm: 5.12, price: 96.44, duration: 4.2, dv01: 40.5, rating: "A+", sector: "Financial", currency: "USD", outstanding: 3500, bid: 96.38, ask: 96.50, spread: 12 },
  { isin: "US459200JZ71", ticker: "IBM 3.625 02/12/31", issuer: "IBM Corp", coupon: 3.625, maturity: "2031-02-12", ytm: 5.28, price: 91.72, duration: 5.1, dv01: 46.8, rating: "A-", sector: "Technology", currency: "USD", outstanding: 2800, bid: 91.65, ask: 91.79, spread: 14 },
  { isin: "US037833AK68", ticker: "AAPL 3.85 08/04/46", issuer: "Apple Inc", coupon: 3.85, maturity: "2046-08-04", ytm: 5.45, price: 76.32, duration: 14.2, dv01: 108.5, rating: "AA+", sector: "Technology", currency: "USD", outstanding: 2000, bid: 76.18, ask: 76.46, spread: 28 },
  { isin: "US30231GAV29", ticker: "XOM 2.709 03/06/25", issuer: "ExxonMobil", coupon: 2.709, maturity: "2025-03-06", ytm: 5.18, price: 98.82, duration: 0.7, dv01: 6.9, rating: "AA-", sector: "Energy", currency: "USD", outstanding: 1500, bid: 98.78, ask: 98.86, spread: 8 },
  { isin: "XS2345678901", ticker: "BUND 0 08/15/30", issuer: "Germany", coupon: 0.0, maturity: "2030-08-15", ytm: 2.58, price: 82.14, duration: 6.8, dv01: 55.9, rating: "AAA", sector: "Government", currency: "EUR", outstanding: 25000, bid: 82.10, ask: 82.18, spread: 8 },
  { isin: "XS2345678902", ticker: "OAT 0.5 05/25/40", issuer: "France", coupon: 0.5, maturity: "2040-05-25", ytm: 3.12, price: 71.85, duration: 13.5, dv01: 97.0, rating: "AA-", sector: "Government", currency: "EUR", outstanding: 30000, bid: 71.75, ask: 71.95, spread: 20 },
];

const BLOTTER_TRADES = [
  { id: "BLT001", time: "09:31:22", isin: "US912828YV68", ticker: "T 2.875 05/15/32", side: "BUY", qty: 5000, price: 94.21, ytm: 4.32, counterparty: "Goldman Sachs", venue: "Bloomberg MTF", status: "FILLED", pnl: 0, settlementDate: "2026-07-01", trader: "J.Smith" },
  { id: "BLT002", time: "09:45:11", isin: "US38141GXZ20", ticker: "GS 4.25 10/21/29", side: "SELL", qty: 2000, price: 96.50, ytm: 5.10, counterparty: "JPMorgan", venue: "Voice", status: "FILLED", pnl: 2400, settlementDate: "2026-07-01", trader: "M.Chen" },
  { id: "BLT003", time: "10:12:44", isin: "US459200JZ71", ticker: "IBM 3.625 02/12/31", side: "BUY", qty: 3500, price: 91.72, ytm: 5.28, counterparty: "Morgan Stanley", venue: "Bloomberg MTF", status: "PARTIAL", pnl: 0, settlementDate: "2026-07-01", trader: "J.Smith" },
  { id: "BLT004", time: "10:28:55", isin: "US037833AK68", ticker: "AAPL 3.85 08/04/46", side: "BUY", qty: 1000, price: 76.32, ytm: 5.45, counterparty: "Barclays", venue: "Bloomberg MTF", status: "PENDING", pnl: 0, settlementDate: "2026-07-01", trader: "K.Lee" },
  { id: "BLT005", time: "11:05:33", isin: "XS2345678901", ticker: "BUND 0 08/15/30", side: "SELL", qty: 10000, price: 82.18, ytm: 2.56, counterparty: "Deutsche Bank", venue: "MTS", status: "FILLED", pnl: -800, settlementDate: "2026-07-01", trader: "M.Chen" },
];

const BOLT_QUOTES = [
  { dealer: "Goldman Sachs", bid: 94.19, ask: 94.23, bidSize: 5000, askSize: 5000, time: "07:14:18", score: 98 },
  { dealer: "JPMorgan", bid: 94.18, ask: 94.24, bidSize: 3000, askSize: 3000, time: "07:14:17", score: 95 },
  { dealer: "Morgan Stanley", bid: 94.17, ask: 94.25, bidSize: 2000, askSize: 2000, time: "07:14:16", score: 91 },
  { dealer: "Barclays", bid: 94.16, ask: 94.26, bidSize: 1500, askSize: 1500, time: "07:14:15", score: 87 },
  { dealer: "Deutsche Bank", bid: 94.15, ask: 94.27, bidSize: 2500, askSize: 2500, time: "07:14:14", score: 84 },
  { dealer: "Citi", bid: 94.14, ask: 94.28, bidSize: 2000, askSize: 2000, time: "07:14:13", score: 80 },
];

export const fixedIncomeTradeRouter = router({
  // FIT - Get bond universe
  getBondUniverse: publicProcedure
    .input(z.object({
      sector: z.string().optional(),
      currency: z.string().optional(),
      minRating: z.string().optional(),
      minYtm: z.number().optional(),
      maxYtm: z.number().optional(),
      minDuration: z.number().optional(),
      maxDuration: z.number().optional(),
    }).optional())
    .query(({ input }) => {
      void input;
      return { bonds: BOND_UNIVERSE.slice(0, 0), timestamp: Date.now(), available: false, limitation: '未配置经授权的可验证债券清单与报价；不以静态样例或合成 bid/ask 填充。' };
    }),

  // FITG - Fixed Income Trading Grid (matrix view)
  getTradingGrid: publicProcedure
    .input(z.object({ sector: z.string().optional() }).optional())
    .query(() => {
      const maturities = ["1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
      const sectors = ["Government", "Financial", "Technology", "Energy", "Healthcare"];
      return { grid: [] as Array<{ sector: string; yields: Array<{ maturity: string; yield: string; change: string; spread: string }> }>, maturities, sectors, timestamp: Date.now(), available: false, limitation: '未配置经授权的多交易商固收网格；不生成合成收益率或价差。' };
    }),

  // BOLT - Buy/Offer List Trading quotes
  getBoltQuotes: publicProcedure
    .input(z.object({ isin: z.string(), side: z.enum(["BUY", "SELL"]), qty: z.number() }))
    .query(({ input }) => {
      void input;
      return { quotes: BOLT_QUOTES.slice(0, 0), bestBid: null, bestAsk: null, spread: null, timestamp: Date.now(), available: false, limitation: '未配置经授权的多交易商债券报价；不以静态样例或随机价差替代。' };
    }),

  // BLOT - E-Trading Blotter
  getBlotter: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      side: z.string().optional(),
      trader: z.string().optional(),
      dateFrom: z.string().optional(),
    }).optional())
    .query(({ input }) => {
      void input;
      return { trades: BLOTTER_TRADES.slice(0, 0), stats: { total: 0, filled: 0, pending: 0, partial: 0, totalPnl: null, fillRate: null }, timestamp: Date.now(), available: false, limitation: '未配置交易账户记录簿；不显示静态成交样例。' };
    }),

  // Submit a trade
  submitTrade: publicProcedure
    .input(z.object({
      isin: z.string(),
      side: z.enum(["BUY", "SELL"]),
      qty: z.number(),
      price: z.number().optional(),
      orderType: z.enum(["MARKET", "LIMIT", "RFQ"]),
      dealer: z.string().optional(),
      venue: z.string().optional(),
    }))
    .mutation(({ input }) => {
      void input;
      return { success: false as const, orderId: null, fillPrice: null, fillQty: null, status: 'UNAVAILABLE', message: '未配置授权交易执行通道，系统不会伪造成交。', timestamp: Date.now() };
    }),

  // TSOX - Execution Management: execution quality analysis
  getExecutionAnalysis: publicProcedure.query(() => {
    return { vwap: null, twap: null, arrivalPrice: null, implementationShortfall: null, slippage: null, fillRate: null, venueBreakdown: [] as Array<{ venue: string; volume: number; avgPrice: number; fillRate: string; avgLatency: string }>, hourlyVolume: [] as Array<{ hour: string; volume: number; vwap: number }>, timestamp: Date.now(), available: false, limitation: '未配置交易执行记录；不计算合成 VWAP/TWAP 或执行缺口。' };
  }),

  // PTBB - Portfolio Trading Basket
  getBasket: publicProcedure.query(() => {
    return { basketId: null, name: null, created: null, status: 'UNAVAILABLE', items: [] as Array<{ isin: string; ticker: string; side: string; targetQty: number; filledQty: number; avgFillPrice: number; status: string; dv01Impact: string }>, totalDv01Impact: null as number | null, estimatedCost: null as number | null, timestamp: Date.now(), available: false, limitation: '未连接账户组合交易篮子；不显示静态组合或虚构成交进度。' };
  }),

  // IMGR - Inventory & Pricing
  getInventory: publicProcedure.query(() => {
    return { positions: [] as Array<{ isin: string; ticker: string; position: number; avgCost: number; currentPrice: number; pnl: number; dv01: number; duration: number; rating: string }>, totalDv01: null as number | null, totalPnl: null as number | null, timestamp: Date.now(), available: false, limitation: '未连接账户库存；不生成头寸、成本、盈亏或 DV01。' };
  }),

  // Yield curve data
  getYieldCurve: publicProcedure
    .input(z.object({ country: z.string().default("US") }))
    .query(({ input }) => {
      return { country: input.country, curve: [] as Array<{ tenor: number; label: string; yield: number; change: number; prev: number }>, timestamp: Date.now(), available: false, limitation: '该过程未配置官方国家曲线；不返回静态基准或随机波动。美国官方 PAR 曲线由 treasuryDailyYield 独立提供。' };
    }),
});
