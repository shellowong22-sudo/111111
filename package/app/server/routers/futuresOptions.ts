/**
 * MOSO/FOM - 期货与期权行情监控 (Futures & Options Monitor)
 * 二阶希腊字母模型计算 + 授权期权行情接入边界
 * 数学模型：BSM + Vanna/Charm/Speed；模型结果不得冒充市场行情
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { fetchYahooChart } from '../realDataService';

// ─── BSM 核心计算引擎 ─────────────────────────────────────────────────────────

/** 标准正态分布 CDF (Abramowitz & Stegun 近似) */
function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

/** 标准正态分布 PDF */
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** BSM d1, d2 参数 */
function bsmParams(S: number, K: number, T: number, r: number, q: number, sigma: number) {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

/** BSM 期权价格 */
function bsmPrice(S: number, K: number, T: number, r: number, q: number, sigma: number, isCall: boolean): number {
  const { d1, d2 } = bsmParams(S, K, T, r, q, sigma);
  if (isCall) {
    return S * Math.exp(-q * T) * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normCDF(-d2) - S * Math.exp(-q * T) * normCDF(-d1);
  }
}

/** 一阶希腊字母 */
function calcGreeks(S: number, K: number, T: number, r: number, q: number, sigma: number, isCall: boolean) {
  const { d1, d2 } = bsmParams(S, K, T, r, q, sigma);
  const phi_d1 = normPDF(d1);
  const N_d1 = normCDF(d1);
  const N_d2 = normCDF(d2);
  const eqT = Math.exp(-q * T);
  const erT = Math.exp(-r * T);

  const delta = isCall ? eqT * N_d1 : eqT * (N_d1 - 1);
  const gamma = eqT * phi_d1 / (S * sigma * Math.sqrt(T));
  const vega = S * eqT * phi_d1 * Math.sqrt(T) / 100; // per 1% vol change
  const theta_call = (-S * eqT * phi_d1 * sigma / (2 * Math.sqrt(T))
    - r * K * erT * N_d2
    + q * S * eqT * N_d1) / 365;
  const theta = isCall ? theta_call : theta_call + r * K * erT / 365 + q * S * eqT / 365;
  const rho = isCall ? K * T * erT * N_d2 / 100 : -K * T * erT * normCDF(-d2) / 100;

  return { delta, gamma, vega, theta, rho, d1, d2, phi_d1, N_d1, N_d2 };
}

/**
 * 二阶希腊字母计算
 * Vanna = ∂²C/∂S∂σ = -e^(-qT) * φ(d1) * d2/σ
 * Charm = ∂²C/∂S∂T = -e^(-qT) * φ(d1) * [2(r-q)T - d2*σ*√T] / (2T*σ*√T)
 * Speed = ∂³C/∂S³ = -Γ/S * (d1/(σ√T) + 1)
 * Vomma = ∂²C/∂σ² = Vega * d1*d2/σ (per 1% vol^2)
 * Ultima = ∂³C/∂σ³ = -Vega * (d1*d2*(1-d1*d2) + d1²+d2²) / σ²
 * DvannaDvol = ∂Vanna/∂σ
 */
function calcSecondOrderGreeks(
  S: number, K: number, T: number, r: number, q: number, sigma: number
) {
  const { d1, d2 } = bsmParams(S, K, T, r, q, sigma);
  const phi_d1 = normPDF(d1);
  const eqT = Math.exp(-q * T);
  const sqrtT = Math.sqrt(T);

  // Vanna: Delta对波动率的敏感度
  const vanna = -eqT * phi_d1 * d2 / sigma;

  // Charm: Delta对时间流逝的敏感度 (daily)
  const charm = -eqT * phi_d1 * (
    2 * (r - q) * T - d2 * sigma * sqrtT
  ) / (2 * T * sigma * sqrtT) / 365;

  // Speed: Gamma对标的价格的敏感度
  const gamma = eqT * phi_d1 / (S * sigma * sqrtT);
  const speed = -gamma / S * (d1 / (sigma * sqrtT) + 1);

  // Vomma: Vega对波动率的敏感度
  const vega = S * eqT * phi_d1 * sqrtT;
  const vomma = vega * d1 * d2 / sigma / 100;

  // Ultima: Vomma对波动率的敏感度
  const ultima = -vega * (d1 * d2 * (1 - d1 * d2) + d1 * d1 + d2 * d2) / (sigma * sigma) / 100;

  // DvannaDvol
  const dvannaDvol = vanna * (d1 * d2 - 1) / sigma;

  // Zomma: Gamma对波动率的敏感度
  const zomma = gamma * (d1 * d2 - 1) / sigma;

  // Color: Gamma对时间的敏感度 (daily)
  const color = -eqT * phi_d1 / (2 * S * T * sigma * sqrtT) * (
    2 * q * T + 1 + (2 * (r - q) * T - d2 * sigma * sqrtT) * d1 / (sigma * sqrtT)
  ) / 365;

  return { vanna, charm, speed, vomma, ultima, dvannaDvol, zomma, color };
}

/** 隐含波动率求解 (Newton-Raphson) */
function impliedVol(
  marketPrice: number, S: number, K: number, T: number,
  r: number, q: number, isCall: boolean
): number {
  let sigma = 0.20;
  for (let i = 0; i < 100; i++) {
    const price = bsmPrice(S, K, T, r, q, sigma, isCall);
    const { d1 } = bsmParams(S, K, T, r, q, sigma);
    const vega = S * Math.exp(-q * T) * normPDF(d1) * Math.sqrt(T);
    const diff = price - marketPrice;
    if (Math.abs(diff) < 1e-8) break;
    sigma -= diff / vega;
    if (sigma <= 0) sigma = 0.001;
    if (sigma > 5) sigma = 5;
  }
  return sigma;
}

// ─── 期权链数据生成 ──────────────────────────────────────────────────────────

interface OptionChainRow {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  // Call
  callBid: number; callAsk: number; callLast: number; callVol: number; callOI: number;
  callIV: number; callDelta: number; callGamma: number; callVega: number; callTheta: number;
  callRho: number;
  callVanna: number; callCharm: number; callSpeed: number; callVomma: number;
  callZomma: number; callColor: number; callUltima: number;
  // Put
  putBid: number; putAsk: number; putLast: number; putVol: number; putOI: number;
  putIV: number; putDelta: number; putGamma: number; putVega: number; putTheta: number;
  putRho: number;
  putVanna: number; putCharm: number; putSpeed: number; putVomma: number;
  putZomma: number; putColor: number; putUltima: number;
  // Misc
  pcRatio: number; intrinsicCall: number; intrinsicPut: number;
  arbitrageSignal: string | null; arbitrageScore: number;
}

interface Underlying {
  symbol: string; name: string; price: number; change: number; changePct: number;
  currency: string; hvol30: number | null; observedAt: string; source: string;
  iv30: null; iv60: null; iv90: null; ivRank: null; ivPercentile: null;
}

const UNDERLYING_REFERENCES = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
] as const;

const EXPIRIES = [
  { label: '1W', days: 7 }, { label: '2W', days: 14 }, { label: '1M', days: 30 },
  { label: '2M', days: 60 }, { label: '3M', days: 90 }, { label: '6M', days: 180 },
];

// ─── 自定义标的支持（预置标的之外的任意美股代码） ─────────────────────────────

const SYMBOL_RE = /^[A-Z]{1,5}$/;

/**
 * 解析标的元数据。这里故意不生成价格、波动率或成交字段；
 * 市场观测必须由授权行情源提供，模型输入也不能冒充交易所数据。
 */
function realizedVolatility30(history: Array<{ value: number }>): number | null {
  const values = history.slice(-31).map((point) => point.value).filter(Number.isFinite);
  if (values.length < 10) return null;
  const returns = values.slice(1).map((value, index) => Math.log(value / values[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
}

async function fetchUnderlying(symbolRaw: string): Promise<Underlying | null> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return null;
  const chart = await fetchYahooChart(symbol, '1mo', '1d');
  if (!chart) return null;
  const reference = UNDERLYING_REFERENCES.find(item => item.symbol === symbol);
  const observedAt = chart.history.at(-1)?.date ?? new Date().toISOString();
  return {
    symbol,
    name: reference?.name ?? symbol,
    price: chart.price,
    change: chart.change,
    changePct: chart.changePct,
    currency: chart.currency,
    hvol30: realizedVolatility30(chart.history),
    observedAt,
    source: chart.source,
    iv30: null,
    iv60: null,
    iv90: null,
    ivRank: null,
    ivPercentile: null,
  };
}

function buildOptionChain(underlying: Underlying | null, expiryDays: number): OptionChainRow[] {
  void underlying;
  void expiryDays;
  // 期权链、盘口、成交量、OI 和 IV 必须来自同一授权期权源。
  // BSM 仅用于用户主动输入的模型研究，不生成市场链。
  return [];
}

/** 波动率曲面必须来自授权期权源；当前不生成替代数据。 */
function buildIVSurface(underlying: Underlying | null) {
  void underlying;
  return [];
}

const MARKET_DATA_UNAVAILABLE_REASON = '未配置可授权的期权或期货行情提供方；不会用 BSM、随机数或写死快照生成期权链、IV、成交、持仓或期货报价。';

interface GlobalFuturesItem {
  ticker: string;
  name: string;
  last: number;
  chg: number;
  chgPct: number;
  vol: number;
  oi: number;
  high: number;
  low: number;
  settle: number;
  exchange: string;
}

interface GlobalFuturesCategory {
  category: string;
  items: GlobalFuturesItem[];
}

// ─── 对冲策略回测引擎 ────────────────────────────────────────────────────────

type HedgeStrategyType = 'collar' | 'call_spread' | 'put_spread' | 'butterfly';

interface HedgeLeg { type: 'call' | 'put'; side: 'buy' | 'sell'; strikeOffsetPct: number; qty: number }

/** 各策略的腿定义（行权价按现价百分比偏移，滚动开仓时动态确定） */
const HEDGE_LEG_TEMPLATES: Record<HedgeStrategyType, { name: string; legs: HedgeLeg[]; holdStock: boolean }> = {
  collar: {
    name: 'Collar（领口策略）', holdStock: true,
    legs: [
      { type: 'put', side: 'buy', strikeOffsetPct: -5, qty: 1 },
      { type: 'call', side: 'sell', strikeOffsetPct: +5, qty: 1 },
    ],
  },
  call_spread: {
    name: 'Call Spread（看涨价差）', holdStock: false,
    legs: [
      { type: 'call', side: 'buy', strikeOffsetPct: 0, qty: 1 },
      { type: 'call', side: 'sell', strikeOffsetPct: +5, qty: 1 },
    ],
  },
  put_spread: {
    name: 'Put Spread（看跌价差）', holdStock: false,
    legs: [
      { type: 'put', side: 'buy', strikeOffsetPct: 0, qty: 1 },
      { type: 'put', side: 'sell', strikeOffsetPct: -5, qty: 1 },
    ],
  },
  butterfly: {
    name: 'Butterfly（蝶式策略）', holdStock: false,
    legs: [
      { type: 'call', side: 'buy', strikeOffsetPct: -5, qty: 1 },
      { type: 'call', side: 'sell', strikeOffsetPct: 0, qty: 2 },
      { type: 'call', side: 'buy', strikeOffsetPct: +5, qty: 1 },
    ],
  },
};

const HEDGE_RANGE_DAYS: Record<string, string> = { '3mo': '3mo', '6mo': '6mo', '1y': '1y' };

/**
 * 对冲策略滚动回测：
 * - 每 21 个交易日（约 1 个月）以当日价格为基准开仓一轮策略腿（30 天到期）
 * - 每日用 BSM 对全部持仓腿盯市估值（IV 用标的 iv30 + 已实现波动微调）
 * - 到期时按内在价值结算，同日滚动开下一轮
 * - 返回与 EQBT 兼容的 equityCurve / metrics / trades 结构
 */
async function runHedgeBacktest(
  symbol: string, strategyType: HedgeStrategyType,
  range: '3mo' | '6mo' | '1y', initialCapital: number
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!SYMBOL_RE.test(normalizedSymbol)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `无效标的代码: ${symbol}` });
  }

  const yr = HEDGE_RANGE_DAYS[range] as '3mo' | '6mo' | '1y';
  const chart = await fetchYahooChart(normalizedSymbol, yr, '1d');
  if (!chart) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '公开历史行情当前不可用，系统不会以合成价格替代进行回测。' });
  }
  const history = chart.history;
  if (history.length < 30) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '历史数据不足（少于 30 个交易日），无法回测' });
  }

  const template = HEDGE_LEG_TEMPLATES[strategyType];
  const r = 0.0525, q = 0.013;
  const observedVol = realizedVolatility30(history);
  if (observedVol === null) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '真实标的历史数据不足，无法估算模型波动率。' });
  }
  // 仅用于模型估值的历史实现波动输入，不是市场隐含波动率。
  const baseIV = observedVol / 100;
  const ROLL_DAYS = 21;       // 每月滚动
  const TENOR_DAYS = 30;      // 每轮策略 30 天到期
  const CONTRACT_MULT = 100;

  // 用价格序列估算滚动已实现波动，让盯市 IV 有起伏
  const closes = history.map(h => h.value);
  const dates = history.map(h => h.date);

  function localIV(i: number): number {
    const lookback = 15;
    if (i < lookback) return baseIV;
    let sum = 0, sum2 = 0, n = 0;
    for (let j = i - lookback + 1; j <= i; j++) {
      const ret = Math.log(closes[j] / closes[j - 1]);
      sum += ret; sum2 += ret * ret; n++;
    }
    const mean = sum / n;
    const dailyVol = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    const rv = dailyVol * Math.sqrt(252);
    // IV 通常比 RV 有溢价，且做适度平滑
    return Math.max(0.05, 0.6 * baseIV + 0.4 * (rv * 1.1));
  }

  interface OpenLeg { type: 'call' | 'put'; side: 'buy' | 'sell'; strike: number; qty: number; entryPrice: number; expiryIdx: number }

  let cash = initialCapital;
  let openLegs: OpenLeg[] = [];
  // Collar 需要持有正股：用初始资金一半买入并全程持有
  let stockShares = 0;
  if (template.holdStock) {
    stockShares = Math.floor((initialCapital * 0.5) / closes[0]);
    cash -= stockShares * closes[0];
  }
  // 每轮开仓的合约手数按资金规模缩放（至少 1 手）
  const lotSize = Math.max(1, Math.floor(initialCapital / 100000) || 1);

  const equityCurve: Array<{ date: string; portfolio: number; benchmark: number }> = [];
  const trades: Array<{ date: string; action: string; detail: string; pnl: number }> = [];
  const benchmarkShares = initialCapital / closes[0];
  let nextRollIdx = 0;
  const roundPnls: number[] = [];
  let roundEntryValue = 0;

  function legMtm(leg: OpenLeg, i: number): number {
    const S = closes[i];
    const remain = Math.max(0, leg.expiryIdx - i);
    const sign = leg.side === 'buy' ? 1 : -1;
    if (remain === 0) {
      const intrinsic = leg.type === 'call' ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
      return sign * intrinsic * leg.qty * CONTRACT_MULT;
    }
    const T = (remain * (365 / 252)) / 365;
    const iv = localIV(i);
    const px = bsmPrice(S, leg.strike, Math.max(T, 1 / 365), r, q, iv, leg.type === 'call');
    return sign * px * leg.qty * CONTRACT_MULT;
  }

  for (let i = 0; i < closes.length; i++) {
    const S = closes[i];

    // 到期结算
    const expired = openLegs.filter(l => l.expiryIdx <= i);
    if (expired.length > 0) {
      let settleValue = 0;
      for (const leg of expired) {
        const intrinsic = leg.type === 'call' ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
        const sign = leg.side === 'buy' ? 1 : -1;
        settleValue += sign * intrinsic * leg.qty * CONTRACT_MULT;
      }
      cash += settleValue;
      const roundPnl = settleValue - roundEntryValue;
      roundPnls.push(roundPnl);
      trades.push({
        date: dates[i], action: 'SETTLE',
        detail: `${template.name} 到期结算 ${expired.length} 腿 @ $${S.toFixed(2)}`,
        pnl: parseFloat(roundPnl.toFixed(2)),
      });
      openLegs = openLegs.filter(l => l.expiryIdx > i);
    }

    // 滚动开仓（无持仓且到达滚动点）
    if (i >= nextRollIdx && openLegs.length === 0 && i + 5 < closes.length) {
      const iv = localIV(i);
      const expiryIdx = Math.min(closes.length - 1, i + ROLL_DAYS);
      let netCost = 0;
      const newLegs: OpenLeg[] = [];
      for (const tl of template.legs) {
        const strike = parseFloat((S * (1 + tl.strikeOffsetPct / 100)).toFixed(0));
        const T = TENOR_DAYS / 365;
        const px = bsmPrice(S, strike, T, r, q, iv, tl.type === 'call');
        const qty = tl.qty * lotSize;
        const sign = tl.side === 'buy' ? 1 : -1;
        netCost += sign * px * qty * CONTRACT_MULT;
        newLegs.push({ type: tl.type, side: tl.side, strike, qty, entryPrice: px, expiryIdx });
      }
      cash -= netCost;
      roundEntryValue = netCost;
      openLegs = newLegs;
      nextRollIdx = i + ROLL_DAYS;
      trades.push({
        date: dates[i], action: 'OPEN',
        detail: `${template.name} 开仓 ${newLegs.map(l => `${l.side === 'buy' ? '买' : '卖'}${l.qty}x ${l.strike}${l.type === 'call' ? 'C' : 'P'}`).join(' / ')}，净${netCost >= 0 ? '支出' : '收入'} $${Math.abs(netCost).toFixed(0)}`,
        pnl: 0,
      });
    }

    // 每日盯市
    let optionsValue = 0;
    for (const leg of openLegs) optionsValue += legMtm(leg, i);
    const portfolio = cash + stockShares * S + optionsValue;
    equityCurve.push({
      date: dates[i],
      portfolio: parseFloat(portfolio.toFixed(2)),
      benchmark: parseFloat((benchmarkShares * S).toFixed(2)),
    });
  }

  // 绩效指标
  const finalPortfolio = equityCurve[equityCurve.length - 1].portfolio;
  const finalBenchmark = equityCurve[equityCurve.length - 1].benchmark;
  const totalReturn = ((finalPortfolio - initialCapital) / initialCapital) * 100;
  const benchmarkReturn = ((finalBenchmark - initialCapital) / initialCapital) * 100;

  let peak = equityCurve[0].portfolio, maxDrawdown = 0;
  for (const p of equityCurve) {
    if (p.portfolio > peak) peak = p.portfolio;
    const dd = ((peak - p.portfolio) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].portfolio;
    if (prev > 0) dailyReturns.push((equityCurve[i].portfolio - prev) / prev);
  }
  const tradingDays = equityCurve.length;
  const annualizedReturn = tradingDays > 0
    ? (Math.pow(finalPortfolio / initialCapital, 252 / tradingDays) - 1) * 100
    : 0;
  const meanRet = dailyReturns.reduce((a, b) => a + b, 0) / Math.max(1, dailyReturns.length);
  const variance = dailyReturns.reduce((a, b) => a + (b - meanRet) * (b - meanRet), 0) / Math.max(1, dailyReturns.length);
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const riskFreeRate = 0.05;
  const sharpe = volatility > 0 ? (annualizedReturn / 100 - riskFreeRate) / (volatility / 100) : 0;
  const winRounds = roundPnls.filter(p => p > 0).length;
  const winRate = roundPnls.length > 0 ? (winRounds / roundPnls.length) * 100 : 0;

  return {
    symbol: normalizedSymbol,
    strategy: template.name,
    strategyType,
    range,
    dataSource: chart.source,
    valuationMode: 'modelled-bsm-with-observed-underlying-history',
    observedAt: chart.history.at(-1)?.date ?? null,
    equityCurve,
    trades: trades.slice(-40),
    metrics: {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      benchmarkReturn: parseFloat(benchmarkReturn.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      sharpe: parseFloat(sharpe.toFixed(3)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      numRounds: roundPnls.length,
      volatility: parseFloat(volatility.toFixed(2)),
    },
  };
}

// ─── tRPC Router ─────────────────────────────────────────────────────────────

export const futuresOptionsRouter = router({
  /** 获取所有标的列表 */
  getUnderlyings: publicProcedure.query(async () => {
    const observations = await Promise.all(UNDERLYING_REFERENCES.map(item => fetchUnderlying(item.symbol)));
    return UNDERLYING_REFERENCES.map((item, index) => {
      const observation = observations[index];
      return observation
        ? { ...observation, available: true as const, realtimeStatus: 'delayed' as const, quality: 'public-source-observation' as const }
        : {
            ...item, available: false as const, price: null, change: null, changePct: null,
            currency: null, hvol30: null, observedAt: null, source: null,
            iv30: null, iv60: null, iv90: null, ivRank: null, ivPercentile: null,
            realtimeStatus: 'unavailable' as const, quality: 'unavailable' as const,
          };
    });
  }),

  /**
   * NCEO 真实期权报价接入状态。当前项目没有已配置的授权期权行情提供方；
   * 此接口特意不回退至 BSM 模型链，避免模型 Bid／Ask 被呈现为市场报价。
   */
  getLiveQuoteStatus: publicProcedure
    .input(z.object({ symbol: z.string().trim().min(1).max(24) }))
    .query(({ input }) => ({
      available: false as const,
      symbol: input.symbol.toUpperCase(),
      provider: null as string | null,
      observedAt: null as string | null,
      delay: null as string | null,
      bid: null as number | null,
      ask: null as number | null,
      reason: '尚未配置可授权的期权市场数据提供方，因此不能显示真实或延迟 Bid／Ask、期权链、成交、盘口、OI、IV 或 Greeks。模型／模拟报价不会作为替代。',
      boundary: '该状态仅说明市场数据接入条件；不创建券商会话、不读取交易账户，也不发送订单。',
    })),

  /** 获取期权链。未接入授权源时只返回真实标的观测和结构化空状态。 */
  getOptionChain: publicProcedure
    .input(z.object({
      symbol: z.string(),
      expiryDays: z.number().int().min(1).max(730).default(30),
    }))
    .query(async ({ input }) => {
      const symbol = input.symbol.trim().toUpperCase();
      if (!SYMBOL_RE.test(symbol)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '代码格式无效：仅支持 1-5 位英文字母（如 MSFT、AMD）' });
      }
      const underlying = await fetchUnderlying(symbol);
      const chain: OptionChainRow[] = buildOptionChain(underlying, input.expiryDays);
      return {
        available: false as const,
        underlying,
        chain,
        stats: null,
        expiryOptions: EXPIRIES,
        provider: null,
        observedAt: underlying?.observedAt ?? null,
        source: underlying?.source ?? null,
        quality: 'unavailable' as const,
        realtimeStatus: 'unavailable' as const,
        schemaVersion: 'futures-options.v2',
        reason: MARKET_DATA_UNAVAILABLE_REASON,
      };
    }),

  /** 用真实公开行情验证标的；不再根据代码生成价格。 */
  validateSymbol: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(10) }))
    .query(async ({ input }) => {
      const symbol = input.symbol.trim().toUpperCase();
      if (!SYMBOL_RE.test(symbol)) {
        return { valid: false as const, message: '代码格式无效：仅支持 1-5 位英文字母（如 MSFT、AMD）' };
      }
      const u = await fetchUnderlying(symbol);
      if (!u) return { valid: false as const, message: '当前公开行情源无法验证该代码；未生成替代价格。' };
      return {
        valid: true as const,
        underlying: u,
      };
    }),

  /** 历史 IV 必须来自授权期权源；无源时保持空状态。 */
  getContractIVHistory: publicProcedure
    .input(z.object({
      symbol: z.string(),
      strike: z.number().positive(),
      expiryDays: z.number().int().min(1).max(730),
      isCall: z.boolean(),
    }))
    .query(async ({ input }) => {
      const symbol = input.symbol.trim().toUpperCase();
      if (!SYMBOL_RE.test(symbol)) throw new TRPCError({ code: 'BAD_REQUEST', message: `无效标的代码: ${input.symbol}` });
      const underlying = await fetchUnderlying(symbol);
      return {
        available: false as const,
        contractInfo: underlying ? {
          symbol, name: underlying.name, underlyingPrice: underlying.price,
          strike: input.strike, expiryDays: input.expiryDays, isCall: input.isCall,
          theoreticalPrice: null as number | null, currentIV: null as number | null,
        } : null,
        currentGreeks: null,
        ivHistory: [] as Array<{ date: string; iv: number; delta: number; gamma: number }>,
        source: underlying?.source ?? null,
        observedAt: underlying?.observedAt ?? null,
        quality: 'unavailable' as const,
        realtimeStatus: 'unavailable' as const,
        reason: MARKET_DATA_UNAVAILABLE_REASON,
      };
    }),

  /** 对冲策略一键回测（滚动持有 + BSM 每日盯市） */
  backtestHedgeStrategy: publicProcedure
    .input(z.object({
      symbol: z.string(),
      strategyType: z.enum(['collar', 'call_spread', 'put_spread', 'butterfly']),
      range: z.enum(['3mo', '6mo', '1y']).default('6mo'),
      initialCapital: z.number().min(1000).max(100000000).default(100000),
    }))
    .mutation(async ({ input }) => {
      return runHedgeBacktest(input.symbol, input.strategyType, input.range, input.initialCapital);
    }),

  /** 获取波动率曲面；无真实期权 IV 时禁止生成 AI 预测曲面。 */
  getIVSurface: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const underlying = await fetchUnderlying(input.symbol);
      const surface: Array<{ expiry: number; moneyness: number; strike: number; currentIV: number; predictedIV: number; ivDiff: number; arbitrageScore: number; signal: string }> = buildIVSurface(underlying);
      return {
        available: false as const,
        underlying,
        surface,
        arbitrageSignals: [] as Array<{ expiry: number; moneyness: number; strike: number; currentIV: number; predictedIV: number; ivDiff: number; arbitrageScore: number; signal: string }>,
        modelInfo: null,
        quality: 'unavailable' as const,
        realtimeStatus: 'unavailable' as const,
        reason: MARKET_DATA_UNAVAILABLE_REASON,
      };
    }),

  /** 全球期货必须由 OpenBB 期货历史／曲线分片提供，未配置时返回空集合。 */
  getGlobalFutures: publicProcedure.query(() => [] as GlobalFuturesCategory[]),

  /** 实时计算单个期权的完整希腊字母 */
  calcOptionGreeks: publicProcedure
    .input(z.object({
      S: z.number(), K: z.number(), T: z.number(),
      r: z.number().default(0.0525), q: z.number().default(0.013),
      sigma: z.number(), isCall: z.boolean().default(true),
    }))
    .query(({ input }) => {
      const { S, K, T, r, q, sigma, isCall } = input;
      const price = bsmPrice(S, K, T, r, q, sigma, isCall);
      const first = calcGreeks(S, K, T, r, q, sigma, isCall);
      const second = calcSecondOrderGreeks(S, K, T, r, q, sigma);
      return { price, ...first, ...second };
    }),

  /** 套利信号扫描 */
  scanArbitrageSignals: publicProcedure
    .input(z.object({ minScore: z.number().default(0.01) }))
    .query(({ input }) => {
      void input;
      return [] as Array<{ symbol: string; strike: number; expiry: string; signal: string; score: number; description: string }>;
    }),

  /** 市场概览统计 */
  getMarketStats: publicProcedure
    .input(z.object({ symbol: z.string().default('SPY') }))
    .query(async ({ input }) => {
      const underlying = await fetchUnderlying(input.symbol);
      return {
        available: false as const,
        symbol: input.symbol.trim().toUpperCase(),
        name: underlying?.name ?? input.symbol.trim().toUpperCase(),
        price: underlying?.price ?? null,
        change: underlying?.change ?? null,
        changePct: underlying?.changePct ?? null,
        currency: underlying?.currency ?? null,
        iv30: null, iv60: null, iv90: null, hvol30: underlying?.hvol30 ?? null,
        ivRank: null, ivPercentile: null, totalCallVol: null, totalPutVol: null,
        pcRatio: null, totalCallOI: null, totalPutOI: null, pcOIRatio: null,
        arbitrageCount: null, netVanna: null, netCharm: null, ivSkew: null,
        source: underlying?.source ?? null,
        observedAt: underlying?.observedAt ?? null,
        quality: 'unavailable' as const,
        realtimeStatus: 'unavailable' as const,
        reason: MARKET_DATA_UNAVAILABLE_REASON,
      };
    }),
});
