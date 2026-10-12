/**
 * 定价（生成式AI与量子计算复杂产品定价）
 * 文档功能点：
 *  1. GAN 生成海量合成市场数据 + 量子计算优化 → 超高维非线性定价（定制ABS/合成CDS/结构化票据/非公开股权）
 *  2. 定价鲁棒性与不确定性区间评估
 *  3. 整合暗池+场外交易数据 → 实时评估定价合理性/市场深度
 *  4. "流动性黑洞风险"识别
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../_core/trpc';
import { fetchUSTreasuryCurve, fetchYahooChart } from '../realDataService';

// ─── Black-Scholes 期权定价引擎 ───────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
function normalPDF(x: number): number { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
function blackScholes(S: number, K: number, T: number, r: number, sigma: number, type: 'call' | 'put') {
  if (T <= 0) return { price: type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0), delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, vega: 0, theta: 0, rho: 0, d1: 0, d2: 0 };
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const price = type === 'call' ? S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2) : K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  const delta = type === 'call' ? normalCDF(d1) : normalCDF(d1) - 1;
  const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T));
  const vega = S * normalPDF(d1) * Math.sqrt(T) / 100;
  const theta = type === 'call' ? (-S * normalPDF(d1) * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365 : (-S * normalPDF(d1) * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  const rho = type === 'call' ? K * T * Math.exp(-r * T) * normalCDF(d2) / 100 : -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;
  return { price, delta, gamma, vega, theta, rho, d1, d2 };
}

const PRODUCTS = [
  { id: 'UST2Y', name: '2 年期名义国债现金流模板', tenor: '2Y', maturityYears: 2 },
  { id: 'UST5Y', name: '5 年期名义国债现金流模板', tenor: '5Y', maturityYears: 5 },
  { id: 'UST10Y', name: '10 年期名义国债现金流模板', tenor: '10Y', maturityYears: 10 },
  { id: 'UST30Y', name: '30 年期名义国债现金流模板', tenor: '30Y', maturityYears: 30 },
] as const;

export function calculateFixedRateBond(notional: number, couponRate: number, yieldRate: number, maturityYears: number, frequency: number) {
  const periods = Math.max(1, Math.round(maturityYears * frequency));
  const periodicCoupon = notional * couponRate / frequency;
  const periodicYield = yieldRate / frequency;
  let presentValue = 0;
  let weightedTime = 0;
  const cashflows = Array.from({ length: periods }, (_, index) => {
    const period = index + 1;
    const cashflow = periodicCoupon + (period === periods ? notional : 0);
    const discountFactor = 1 / Math.pow(1 + periodicYield, period);
    const pv = cashflow * discountFactor;
    presentValue += pv;
    weightedTime += (period / frequency) * pv;
    return { period, year: Number((period / frequency).toFixed(2)), cashflow: Number(cashflow.toFixed(2)), pv: Number(pv.toFixed(2)) };
  });
  const macaulayDuration = presentValue > 0 ? weightedTime / presentValue : 0;
  const modifiedDuration = macaulayDuration / (1 + periodicYield);
  const dv01 = modifiedDuration * presentValue * 0.0001;
  const cleanPricePer100 = presentValue / notional * 100;
  return { presentValue, cleanPricePer100, macaulayDuration, modifiedDuration, dv01, cashflows };
}

function findCurveYield(curve: Array<{ tenor: string; yield: number | null }>, tenor: string) {
  return curve.find((point) => point.tenor === tenor)?.yield ?? null;
}

export const pricingRouter = router({
  // ── Black-Scholes 期权定价 ────────────────────────────────────────────────
  calcOptionPrice: publicProcedure
    .input(z.object({ S: z.number().positive(), K: z.number().positive(), T: z.number().positive(), r: z.number().default(0.05), sigma: z.number().positive(), type: z.enum(['call', 'put']) }))
    .query(({ input }) => {
      const result = blackScholes(input.S, input.K, input.T, input.r, input.sigma, input.type);
      const intrinsic = input.type === 'call' ? Math.max(input.S - input.K, 0) : Math.max(input.K - input.S, 0);
      return { ...result, intrinsicValue: intrinsic, timeValue: result.price - intrinsic, breakeven: input.type === 'call' ? input.K + result.price : input.K - result.price };
    }),

  // ── 波动率曲面 ────────────────────────────────────────────────────────────
  getVolSurface: publicProcedure
    .input(z.object({ S: z.number().positive().default(189.5), r: z.number().default(0.05), symbol: z.string().default("AAPL") }))
    .query(async ({ input }) => {
      const chart = await fetchYahooChart(input.symbol, "1y", "1d", "US");
      if (!chart) {
        return {
          available: false as const,
          surface: [],
          spotPrice: null,
          limitation: "未取得可核验的历史收盘序列，无法计算波动率代理曲面。",
        };
      }
      const closes = chart.history
        .map(point => point.close)
        .filter((close): close is number => typeof close === "number" && close > 0);
      const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
      const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
      const variance = returns.length > 1
        ? returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (returns.length - 1)
        : 0;
      const realizedVol = Math.max(0.01, Math.sqrt(variance * 252));
      const spotPrice = chart.price || input.S;
      const strikes = [0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2].map(m => Math.round(spotPrice * m));
      const tenors = [{ t: 0.083, label: '1M' }, { t: 0.25, label: '3M' }, { t: 0.5, label: '6M' }, { t: 1.0, label: '1Y' }, { t: 2.0, label: '2Y' }];
      const surface = tenors.map(({ t, label }) => ({
        tenor: t, tenorLabel: label,
        strikes: strikes.map(K => {
          const m = K / spotPrice;
          const vol = Math.max(0.01, Math.min(2, realizedVol * (1 + 0.12 * Math.abs(m - 1) + 0.03 * t)));
          const c = blackScholes(spotPrice, K, t, input.r, vol, 'call');
          const p = blackScholes(spotPrice, K, t, input.r, vol, 'put');
          return { strike: K, moneyness: Math.round(m * 100), impliedVol: Math.round(vol * 10000) / 100, callPrice: Math.round(c.price * 100) / 100, putPrice: Math.round(p.price * 100) / 100, callDelta: Math.round(c.delta * 10000) / 10000, gamma: Math.round(c.gamma * 100000) / 100000, vega: Math.round(c.vega * 10000) / 10000 };
        }),
      }));
      return {
        available: true as const,
        surface,
        spotPrice,
        volatilityType: "realized historical volatility proxy",
        realizedVolatility: Number((realizedVol * 100).toFixed(2)),
        source: chart.source,
        observedAt: chart.meta.observedAt ?? chart.history.at(-1)?.date ?? null,
      };
    }),

  // ── 多资产风险聚合（MARS）────────────────────────────────────────────────
  getPortfolioRisk: publicProcedure.query(() => ({
    available: false as const,
    assets: [],
    correlationMatrix: null,
    limitation: "组合级风险需要用户真实持仓、成本、权重和基准收益序列；当前不生成固定组合或随机相关矩阵。",
  })),

  // ── 压力测试情景（SHOC/OSA）──────────────────────────────────────────────
  runStressTest: publicProcedure
    .input(z.object({ scenario: z.enum(['2008_crisis', 'covid_2020', 'rate_shock_2022', 'tech_crash', 'custom']), customShocks: z.object({ equity: z.number().optional(), rates: z.number().optional(), fx: z.number().optional(), credit: z.number().optional(), vol: z.number().optional() }).optional() }))
    .query(() => ({
      available: false as const,
      scenario: null,
      positions: [],
      limitation: "压力测试需要真实账户持仓和风险因子暴露；系统不会把固定示例组合冒充用户组合。",
    })),

  // ── XVA 估值调整 ─────────────────────────────────────────────────────────
  getXVA: publicProcedure.query(() => ({
    available: false as const,
    counterparties: [],
    totals: null,
    breakdown: [],
    limitation: "XVA 需要真实交易对手、净额协议、抵押品和暴露路径；当前不生成固定银行和 CDS 数值。",
  })),

  // ── 风险归因分析（BRM）──────────────────────────────────────────────────
  getRiskAttribution: publicProcedure.query(() => ({
    available: false as const,
    factors: [],
    historical: [],
    totalVar95: null,
    totalVar99: null,
    limitation: "风险归因需要真实持仓、基准和因子收益序列；当前不生成固定 VaR 历史。",
  })),

  listProducts: publicProcedure.query(() => ({
    success: true,
    products: PRODUCTS,
    note: '模板仅提供期限结构；票息、结算日、日计数与应计利息须由研究人员按具体证券条款录入。',
  })),

  /** 公开曲线下的固定票息国债现金流折现；每一步均可复算。 */
  price: publicProcedure
    .input(z.object({
      productId: z.enum(['UST2Y', 'UST5Y', 'UST10Y', 'UST30Y']).default('UST10Y'),
      notional: z.number().positive().max(10_000_000_000).default(10_000_000),
      couponRate: z.number().min(0).max(0.25).default(0.04),
      yieldRate: z.number().min(0).max(0.25).optional(),
      frequency: z.union([z.literal(1), z.literal(2)]).default(2),
    }))
    .query(async ({ input }) => {
      const product = PRODUCTS.find((item) => item.id === input.productId) ?? PRODUCTS[2];
      const curve = input.yieldRate === undefined ? await fetchUSTreasuryCurve() : [];
      const curveYield = input.yieldRate === undefined ? findCurveYield(curve, product.tenor) : null;
      const yieldRate = input.yieldRate ?? (curveYield === null ? null : curveYield / 100);
      if (yieldRate === null) {
        throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: '未能取得所选期限的公开曲线数据。请刷新，或在界面中输入经核验的到期收益率。' });
      }
      const base = calculateFixedRateBond(input.notional, input.couponRate, yieldRate, product.maturityYears, input.frequency);
      const shocks = [-0.01, -0.005, 0.005, 0.01].map((shift) => {
        const scenario = calculateFixedRateBond(input.notional, input.couponRate, Math.max(0, yieldRate + shift), product.maturityYears, input.frequency);
        return { yieldShiftBps: shift * 10_000, presentValue: scenario.presentValue, pnl: scenario.presentValue - base.presentValue };
      });
      return {
        success: true,
        product,
        input,
        curveYieldPct: curveYield,
        yieldSource: input.yieldRate === undefined ? 'FRED Treasury curve' : '用户输入（须自行核验）',
        methodology: '固定票息现金流按每期收益率折现；未计应计利息、税费、回购融资、流动性、信用或期权调整。',
        valuation: base,
        yieldShockScenarios: shocks,
        source: 'FRED',
        timestamp: new Date().toISOString(),
      };
    }),

  /** 公开数据无法验证的盘中深度不再估计；改为用户可执行的核验步骤。 */
  getLiquidityDepth: publicProcedure
    .input(z.object({ productId: z.enum(['UST2Y', 'UST5Y', 'UST10Y', 'UST30Y']).default('UST10Y') }))
    .query(({ input }) => {
      const product = PRODUCTS.find((item) => item.id === input.productId) ?? PRODUCTS[2];
      return {
        success: true,
        product,
        status: '需要核验',
        limitation: '公开数据源不提供可审计的暗池、RFQ 或实时订单簿深度；系统不会生成虚构的深度评分或“黑洞风险”数值。',
        checklist: [
          { step: '双边报价', question: '记录至少两家合格对手方的买卖价、名义规模和报价有效时间。' },
          { step: '成交与报价', question: '确认近期成交、报价覆盖、最小交易单位及清算安排。' },
          { step: '融资与交收', question: '核对 repo 可得性、特殊性、保证金和失败交收风险。' },
          { step: '执行约束', question: '确认限额、授权、合规限制和拆单规则后再提交任何订单。' },
        ],
        timestamp: new Date().toISOString(),
      };
    }),
});
