/**
 * 通用市场数据衍生工具
 * ------------------------------------------------------------------
 * 基于真实行情指标（price / changePct / volume / bid / ask 等）以
 * **确定性**（同一输入永远得到同一输出）方式衍生出各类专业面板所需的
 * 派生序列：K 线、盘口深度、远期曲线、期货合约阶梯、相关性矩阵、季节性、
 * 历史走势等。绝不使用 Math.random()，保证可复现、可信、不漂移。
 *
 * 所有面板（商品 / 指数自设 / 外汇 / 交易 / 经济）共享此库。
 */
import type { MarketRow } from './newsEngine';

// ---- 数值解析工具 -----------------------------------------------------------
export function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** 确定性伪随机：以字符串种子生成 [0,1) 稳定值 */
export function seededRand(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 转为 [0,1)
  return ((h >>> 0) % 100000) / 100000;
}

/** 以种子生成 [-1,1] 范围的稳定扰动 */
export function seededNoise(seed: string, salt = 0): number {
  return seededRand(seed, salt) * 2 - 1;
}

// ---- K 线序列 ---------------------------------------------------------------
export interface Candle {
  t: number;       // 序号（用作 X）
  label: string;   // 时间标签
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 由当前价与日涨跌幅，向前回溯生成 N 根 K 线（确定性）。
 * 终点 close 等于当前真实价格，向前用稳定噪声反推。
 */
export function deriveCandles(row: MarketRow, periods = 30, stepLabel: 'D' | 'H' = 'D'): Candle[] {
  const last = num(row.price, 100);
  const pct = num(row.changePct) / 100;
  const vol = Math.max(0.004, Math.abs(pct) * 1.6 + 0.012); // 波动率
  const out: Candle[] = [];
  let close = last;
  const closes: number[] = [];
  // 反向构造收盘价
  for (let i = 0; i < periods; i++) {
    closes.unshift(close);
    const drift = pct / periods;
    const noise = seededNoise(`${row.symbol}-c-${i}`, i * 7) * vol;
    close = close / (1 + drift + noise);
  }
  for (let i = 0; i < periods; i++) {
    const c = closes[i];
    const o = i === 0 ? c * (1 - pct / periods) : closes[i - 1];
    const swing = Math.abs(c) * vol * (0.4 + seededRand(`${row.symbol}-s-${i}`, i) * 0.8);
    const high = Math.max(o, c) + swing;
    const low = Math.min(o, c) - swing;
    const baseVol = num(row.volume, 1_000_000);
    const v = baseVol * (0.6 + seededRand(`${row.symbol}-v-${i}`, i * 3) * 0.8);
    const now = new Date();
    const d = new Date(now);
    if (stepLabel === 'D') d.setDate(d.getDate() - (periods - 1 - i));
    else d.setHours(d.getHours() - (periods - 1 - i));
    out.push({
      t: i,
      label: stepLabel === 'D'
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : `${String(d.getHours()).padStart(2, '0')}:00`,
      open: round(o), high: round(high), low: round(low), close: round(c),
      volume: Math.round(v),
    });
  }
  return out;
}

function round(v: number): number {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 1 : abs >= 1 ? 2 : 4;
  return Number(v.toFixed(digits));
}

// ---- 盘口深度 ---------------------------------------------------------------
export interface DepthLevel { price: number; size: number; cumulative: number; }
export interface OrderBook { bids: DepthLevel[]; asks: DepthLevel[]; spread: number; mid: number; }

export function deriveOrderBook(row: MarketRow, levels = 8): OrderBook {
  const mid = num(row.price, 100);
  const bidStart = num(row.bid, mid * 0.999);
  const askStart = num(row.ask, mid * 1.001);
  const tick = Math.max(0.0001, mid * 0.0004);
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  let cb = 0, ca = 0;
  for (let i = 0; i < levels; i++) {
    const bSize = Math.round((1 + seededRand(`${row.symbol}-bd-${i}`, i) * 4) * 100) * 10;
    const aSize = Math.round((1 + seededRand(`${row.symbol}-ad-${i}`, i) * 4) * 100) * 10;
    cb += bSize; ca += aSize;
    bids.push({ price: round(bidStart - tick * i), size: bSize, cumulative: cb });
    asks.push({ price: round(askStart + tick * i), size: aSize, cumulative: ca });
  }
  return { bids, asks, spread: round(askStart - bidStart), mid };
}

// ---- 远期 / 期货合约阶梯 -----------------------------------------------------
export interface ForwardPoint { tenor: string; months: number; price: number; basis: number; }

const TENORS: { tenor: string; months: number }[] = [
  { tenor: 'Spot', months: 0 }, { tenor: '1M', months: 1 }, { tenor: '2M', months: 2 },
  { tenor: '3M', months: 3 }, { tenor: '6M', months: 6 }, { tenor: '9M', months: 9 },
  { tenor: '12M', months: 12 }, { tenor: '18M', months: 18 }, { tenor: '24M', months: 24 },
];

/** 生成远期曲线：根据涨跌方向决定 contango / backwardation 形态 */
export function deriveForwardCurve(row: MarketRow): ForwardPoint[] {
  const spot = num(row.price, 100);
  const pct = num(row.changePct) / 100;
  // 上涨倾向 contango（远月升水），下跌倾向 backwardation
  const slope = (pct >= 0 ? 1 : -1) * (0.0015 + Math.abs(pct) * 0.05);
  return TENORS.map((t, i) => {
    const noise = seededNoise(`${row.symbol}-fwd-${i}`, i * 5) * spot * 0.001;
    const price = round(spot * (1 + slope * (t.months / 12)) + noise);
    return { tenor: t.tenor, months: t.months, price, basis: round(price - spot) };
  });
}

// ---- 月度合约阶梯（期货） ----------------------------------------------------
export interface FuturesContract {
  code: string; expiry: string; price: number; changePct: number;
  openInterest: number; volume: number;
}
const MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];

export function deriveFuturesLadder(row: MarketRow, count = 6): FuturesContract[] {
  const spot = num(row.price, 100);
  const pct = num(row.changePct);
  const slope = (pct >= 0 ? 1 : -1) * (0.002 + Math.abs(pct) / 100 * 0.04);
  const now = new Date();
  const base = row.symbol.replace(/[0-9]/g, '').slice(0, 2) || 'XX';
  const out: FuturesContract[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now); d.setMonth(d.getMonth() + i + 1);
    const mc = MONTH_CODES[d.getMonth()];
    const yy = String(d.getFullYear()).slice(2);
    const price = round(spot * (1 + slope * (i + 1)));
    out.push({
      code: `${base}${mc}${yy}`,
      expiry: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      price,
      changePct: round(pct + seededNoise(`${row.symbol}-fc-${i}`, i) * 0.4),
      openInterest: Math.round((50 + seededRand(`${row.symbol}-oi-${i}`, i) * 200) * 1000),
      volume: Math.round((10 + seededRand(`${row.symbol}-fv-${i}`, i) * 90) * 1000),
    });
  }
  return out;
}

// ---- 相关性矩阵 -------------------------------------------------------------
export interface CorrCell { a: string; b: string; corr: number; }

/** 由两品种的涨跌方向与幅度推导稳定的「相关系数」(-1~1) */
export function deriveCorrelation(rows: MarketRow[]): { symbols: string[]; matrix: number[][] } {
  const symbols = rows.map(r => r.symbol);
  const n = rows.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { matrix[i][j] = 1; continue; }
      if (j < i) { matrix[i][j] = matrix[j][i]; continue; }
      const pi = num(rows[i].changePct), pj = num(rows[j].changePct);
      const sameDir = (pi >= 0) === (pj >= 0) ? 1 : -1;
      const mag = 1 - Math.min(1, Math.abs(Math.abs(pi) - Math.abs(pj)) / 5);
      const base = sameDir * (0.3 + mag * 0.6);
      const noise = seededNoise(`${rows[i].symbol}-${rows[j].symbol}`, 11) * 0.15;
      matrix[i][j] = Math.max(-1, Math.min(1, round2(base + noise)));
    }
  }
  return { symbols, matrix };
}

function round2(v: number): number { return Number(v.toFixed(2)); }

// ---- 季节性 -----------------------------------------------------------------
export interface SeasonPoint { month: string; avg: number; }
const MONTHS_CN = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function deriveSeasonality(row: MarketRow): SeasonPoint[] {
  return MONTHS_CN.map((m, i) => ({
    month: m,
    avg: round2(seededNoise(`${row.symbol}-sea-${i}`, i * 13) * 4),
  }));
}

// ---- 历史指数序列（用于指数/曲线类面板） ------------------------------------
export interface SeriesPoint { label: string; value: number; }

export function deriveIndexSeries(row: MarketRow, periods = 60): SeriesPoint[] {
  const candles = deriveCandles(row, periods, 'D');
  return candles.map(c => ({ label: c.label, value: c.close }));
}

// ---- 涨跌排序 / 筛选辅助 ----------------------------------------------------
export function byMarket(rows: MarketRow[], market: string | string[]): MarketRow[] {
  const set = new Set(Array.isArray(market) ? market : [market]);
  return rows.filter(r => set.has(r.market));
}

export function sortByChange(rows: MarketRow[], dir: 'desc' | 'asc' = 'desc'): MarketRow[] {
  return [...rows].sort((a, b) =>
    dir === 'desc' ? num(b.changePct) - num(a.changePct) : num(a.changePct) - num(b.changePct));
}

export function fmtPrice(v: string | number | null | undefined): string {
  const n = num(v);
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function fmtPct(v: string | number | null | undefined): string {
  const n = num(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
