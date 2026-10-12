/**
 * 外汇专用数据衍生工具
 * ------------------------------------------------------------------
 * 基于真实 forex 行情确定性衍生：双向报价（bid/ask/spread）、
 * 远期点阵、隐含波动率期限结构、交叉汇率矩阵等。
 */
import type { MarketRow } from './newsEngine';
import { num, seededRand, seededNoise } from './marketDerive';

export interface FxQuote {
  pair: string;
  base: string;
  quote: string;
  mid: number;
  bid: number;
  ask: number;
  spreadPips: number;
  changePct: number;
  high: number;
  low: number;
}

/** 解析货币对名称（EUR/USD 或 EURUSD） */
export function parsePair(r: MarketRow): { base: string; quote: string } {
  const raw = (r.symbol || r.name).replace(/[^A-Za-z/]/g, '').toUpperCase();
  if (raw.includes('/')) {
    const [b, q] = raw.split('/');
    return { base: b.slice(0, 3), quote: q.slice(0, 3) };
  }
  return { base: raw.slice(0, 3) || 'XXX', quote: raw.slice(3, 6) || 'USD' };
}

export function toFxQuote(r: MarketRow): FxQuote {
  const { base, quote } = parsePair(r);
  const mid = num(r.price, 1);
  const isJpy = quote === 'JPY';
  const pip = isJpy ? 0.01 : 0.0001;
  const spreadPips = Number((0.6 + seededRand(r.symbol, 3) * 1.8).toFixed(1));
  const half = (spreadPips * pip) / 2;
  const pct = num(r.changePct);
  return {
    pair: `${base}/${quote}`,
    base, quote, mid,
    bid: round(mid - half, isJpy),
    ask: round(mid + half, isJpy),
    spreadPips,
    changePct: pct,
    high: round(mid * (1 + Math.abs(pct) / 100 * 0.6 + 0.001), isJpy),
    low: round(mid * (1 - Math.abs(pct) / 100 * 0.6 - 0.001), isJpy),
  };
}

function round(v: number, jpy = false): number {
  return Number(v.toFixed(jpy ? 3 : 5));
}

// ---- 远期点阵 ---------------------------------------------------------------
export interface FwdPoint { tenor: string; points: number; outright: number; }
const FWD_TENORS = ['ON', '1W', '1M', '2M', '3M', '6M', '9M', '1Y'];
const FWD_DAYS = [1, 7, 30, 60, 90, 180, 270, 365];

export function deriveFxForward(r: MarketRow): FwdPoint[] {
  const { quote } = parsePair(r);
  const isJpy = quote === 'JPY';
  const pip = isJpy ? 0.01 : 0.0001;
  const mid = num(r.price, 1);
  const pct = num(r.changePct) / 100;
  const carry = (pct >= 0 ? 1 : -1) * (2 + seededRand(r.symbol, 9) * 8); // pips/year 方向
  return FWD_TENORS.map((t, i) => {
    const frac = FWD_DAYS[i] / 365;
    const points = Number((carry * frac + seededNoise(`${r.symbol}-fp-${i}`, i) * 0.4).toFixed(1));
    return { tenor: t, points, outright: round(mid + points * pip, isJpy) };
  });
}

// ---- 隐含波动率期限结构 -----------------------------------------------------
export interface VolPoint { tenor: string; vol: number; }
const VOL_TENORS = ['1W', '1M', '2M', '3M', '6M', '1Y'];

export function deriveFxVol(r: MarketRow): VolPoint[] {
  const base = 5 + seededRand(r.symbol, 4) * 6 + Math.abs(num(r.changePct)) * 0.8;
  return VOL_TENORS.map((t, i) => ({
    tenor: t,
    vol: Number((base + i * 0.4 + seededNoise(`${r.symbol}-vol-${i}`, i) * 0.5).toFixed(2)),
  }));
}

// ---- 交叉汇率矩阵 -----------------------------------------------------------
export const G10 = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY'];

/** 由 forex 行情推导各货币对 USD 的强弱，再合成交叉矩阵 */
export function deriveCrossMatrix(rows: MarketRow[]): { ccys: string[]; matrix: (number | null)[][] } {
  // 每个货币对 USD 的「价格」（USD=1 基准）
  const usdRate: Record<string, number> = { USD: 1 };
  rows.forEach(r => {
    const { base, quote } = parsePair(r);
    const p = num(r.price, 1);
    if (quote === 'USD' && p > 0) usdRate[base] = p;        // base/USD
    else if (base === 'USD' && p > 0) usdRate[quote] = 1 / p; // USD/quote
  });
  const ccys = G10.filter(c => usdRate[c] !== undefined);
  const matrix = ccys.map(a => ccys.map(b => {
    if (a === b) return 1;
    if (!usdRate[a] || !usdRate[b]) return null;
    return Number((usdRate[a] / usdRate[b]).toFixed(a === 'JPY' || b === 'JPY' ? 3 : 5));
  }));
  return { ccys, matrix };
}

// ---- 货币强弱排名 -----------------------------------------------------------
export interface CcyStrength { ccy: string; score: number; }

export function deriveCcyStrength(rows: MarketRow[]): CcyStrength[] {
  const acc: Record<string, { sum: number; n: number }> = {};
  rows.forEach(r => {
    const { base, quote } = parsePair(r);
    const pct = num(r.changePct);
    (acc[base] = acc[base] || { sum: 0, n: 0 }).sum += pct;
    acc[base].n += 1;
    (acc[quote] = acc[quote] || { sum: 0, n: 0 }).sum -= pct;
    acc[quote].n += 1;
  });
  return Object.entries(acc)
    .map(([ccy, v]) => ({ ccy, score: Number((v.sum / Math.max(1, v.n)).toFixed(3)) }))
    .sort((a, b) => b.score - a.score);
}
