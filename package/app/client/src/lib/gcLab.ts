/**
 * gcLab.ts — GC 绘制曲线图「曲线建模与情景实验室」纯前端计算库
 * 招牌功能（与 CORR/CRVF 零重叠）：
 *   ① 期限解析与样条插值（任意期限点的收益率）
 *   ② 曲线利差计算（两条曲线逐点利差，单位 bp）
 *   ③ 情景位移模拟（平行移动 / 陡峭化 / 平坦化 / 蝶式）
 *   ④ 久期 / 凸性 / DV01 计算器（基于平价债券假设）
 */

import type { GcCurvePoint, GcCurveSeries } from './crvfData';

// ── 期限字符串 → 年数 ──────────────────────────────────────────────────────────
export function tenorToYears(tenor: string): number {
  const t = tenor.trim().toUpperCase();
  const m = t.match(/^([\d.]+)\s*([DWMY])$/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'D': return n / 365;
    case 'W': return n / 52;
    case 'M': return n / 12;
    case 'Y': return n;
    default: return NaN;
  }
}

export function yearsToTenorLabel(years: number): string {
  if (years < 1) {
    const m = Math.round(years * 12);
    return `${m}M`;
  }
  return Number.isInteger(years) ? `${years}Y` : `${years.toFixed(1)}Y`;
}

// ── 线性插值（在已知曲线点上插出任意期限的值） ─────────────────────────────────
export function interpolateLinear(
  points: { x: number; y: number }[],
  x: number
): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (x <= sorted[0].x) return sorted[0].y;
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return sorted[sorted.length - 1].y;
}

// ── 单调三次样条插值（Fritsch–Carlson，避免过冲，金融曲线常用） ────────────────
export function monotoneCubicInterpolate(
  points: { x: number; y: number }[],
  xs: number[]
): number[] {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n < 2) return xs.map(() => (n === 1 ? pts[0].y : 0));
  const dx: number[] = [], dy: number[] = [], slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    dx.push(h);
    dy.push(pts[i + 1].y - pts[i].y);
    slope.push(h !== 0 ? (pts[i + 1].y - pts[i].y) / h : 0);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m[i] = 0;
    else m[i] = (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const t = 3 / h;
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  return xs.map(x => {
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts[n - 1].x) return pts[n - 1].y;
    let i = 0;
    while (i < n - 1 && x > pts[i + 1].x) i++;
    const h = dx[i];
    const t = (x - pts[i].x) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * pts[i].y + h10 * h * m[i] + h01 * pts[i + 1].y + h11 * h * m[i + 1];
  });
}

// ── 曲线点 → {x:年, y:收益率} ──────────────────────────────────────────────────
export function curveToXY(data: GcCurvePoint[]): { x: number; y: number }[] {
  return data
    .map(p => ({ x: tenorToYears(p.tenor), y: p.value }))
    .filter(p => !Number.isNaN(p.x))
    .sort((a, b) => a.x - b.x);
}

// ── 生成密集插值曲线（用于平滑绘制） ───────────────────────────────────────────
export function densifyCurve(
  data: GcCurvePoint[],
  steps = 60,
  method: 'linear' | 'spline' = 'spline'
): { years: number; tenor: string; value: number }[] {
  const xy = curveToXY(data);
  if (xy.length < 2) return [];
  const minX = xy[0].x, maxX = xy[xy.length - 1].x;
  const xs: number[] = [];
  for (let i = 0; i <= steps; i++) xs.push(minX + (maxX - minX) * (i / steps));
  const ys = method === 'spline'
    ? monotoneCubicInterpolate(xy, xs)
    : xs.map(x => interpolateLinear(xy, x));
  return xs.map((x, i) => ({ years: parseFloat(x.toFixed(3)), tenor: yearsToTenorLabel(x), value: parseFloat(ys[i].toFixed(4)) }));
}

// ── 任意期限点插值查询 ─────────────────────────────────────────────────────────
export function queryYield(data: GcCurvePoint[], tenor: string, method: 'linear' | 'spline' = 'spline'): number | null {
  const years = tenorToYears(tenor);
  if (Number.isNaN(years)) return null;
  const xy = curveToXY(data);
  if (xy.length < 2) return null;
  const v = method === 'spline'
    ? monotoneCubicInterpolate(xy, [years])[0]
    : interpolateLinear(xy, years);
  return parseFloat(v.toFixed(4));
}

// ── 两曲线利差（bp） ───────────────────────────────────────────────────────────
export function curveSpread(
  a: GcCurvePoint[],
  b: GcCurvePoint[],
  method: 'linear' | 'spline' = 'spline'
): { tenor: string; years: number; spreadBp: number }[] {
  const xyA = curveToXY(a);
  const xyB = curveToXY(b);
  if (xyA.length < 2 || xyB.length < 2) return [];
  const minX = Math.max(xyA[0].x, xyB[0].x);
  const maxX = Math.min(xyA[xyA.length - 1].x, xyB[xyB.length - 1].x);
  const steps = 40;
  const out: { tenor: string; years: number; spreadBp: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX + (maxX - minX) * (i / steps);
    const ya = method === 'spline' ? monotoneCubicInterpolate(xyA, [x])[0] : interpolateLinear(xyA, x);
    const yb = method === 'spline' ? monotoneCubicInterpolate(xyB, [x])[0] : interpolateLinear(xyB, x);
    out.push({ tenor: yearsToTenorLabel(x), years: parseFloat(x.toFixed(3)), spreadBp: parseFloat(((ya - yb) * 100).toFixed(1)) });
  }
  return out;
}

// ── 情景位移模拟 ───────────────────────────────────────────────────────────────
export type ScenarioType = 'parallel' | 'steepen' | 'flatten' | 'butterfly';

export interface ScenarioParams {
  type: ScenarioType;
  /** 位移幅度（bp）。parallel: 整体平移；steepen/flatten: 长端相对短端变化；butterfly: 中端相对两端 */
  bp: number;
}

/**
 * 对曲线施加情景位移。返回新的曲线点（value 单位与原曲线一致，%）。
 * - parallel: 所有点 + bp/100
 * - steepen: 短端不动，长端 + bp/100（按期限线性加权）
 * - flatten: 短端不动，长端 - bp/100
 * - butterfly: 两端 + bp/100，中端 - bp/100（驼峰）
 */
export function applyScenario(data: GcCurvePoint[], params: ScenarioParams): GcCurvePoint[] {
  const xy = curveToXY(data);
  if (xy.length === 0) return data;
  const minX = xy[0].x, maxX = xy[xy.length - 1].x;
  const span = maxX - minX || 1;
  const midX = (minX + maxX) / 2;
  const shiftPct = params.bp / 100;
  return data.map(p => {
    const yrs = tenorToYears(p.tenor);
    let delta = 0;
    if (Number.isNaN(yrs)) { delta = params.type === 'parallel' ? shiftPct : 0; }
    else {
      const w = (yrs - minX) / span; // 0(短端)~1(长端)
      switch (params.type) {
        case 'parallel': delta = shiftPct; break;
        case 'steepen': delta = shiftPct * w; break;
        case 'flatten': delta = -shiftPct * w; break;
        case 'butterfly': {
          // 中端权重最大（驼峰），两端为正、中端为负
          const m = 1 - Math.abs(yrs - midX) / (span / 2); // 中端=1, 两端=0
          delta = shiftPct * (0.5 - m); // 两端+0.5, 中端-0.5
          break;
        }
      }
    }
    return { tenor: p.tenor, value: parseFloat((p.value + delta).toFixed(4)) };
  });
}

// ── 久期 / 凸性 / DV01 计算器 ──────────────────────────────────────────────────
export interface BondAnalytics {
  price: number;
  macaulayDuration: number;
  modifiedDuration: number;
  convexity: number;
  dv01: number;     // 每 100 面值的 DV01
  ytm: number;
}

/**
 * 基于给定 YTM 与期限，假设平价票息债（coupon = ytm，年付）计算债券分析指标。
 * 这是固定收益常规近似，用于优先股/债券曲线的久期凸性教学与对冲量计算。
 */
export function bondAnalytics(ytmPct: number, years: number, freq = 2, couponPct?: number): BondAnalytics {
  const y = ytmPct / 100;
  const c = (couponPct ?? ytmPct) / 100;
  const n = Math.max(1, Math.round(years * freq));
  const couponPerPeriod = (c * 100) / freq;
  const yPerPeriod = y / freq;
  const face = 100;
  let price = 0, weightedT = 0, convexSum = 0;
  for (let t = 1; t <= n; t++) {
    const cf = t === n ? couponPerPeriod + face : couponPerPeriod;
    const disc = Math.pow(1 + yPerPeriod, t);
    const pv = cf / disc;
    price += pv;
    weightedT += (t / freq) * pv;
    convexSum += (t * (t + 1)) * cf / Math.pow(1 + yPerPeriod, t + 2);
  }
  const macaulay = price > 0 ? weightedT / price : 0;
  const modified = macaulay / (1 + yPerPeriod);
  const convexity = price > 0 ? convexSum / (price * freq * freq) : 0;
  const dv01 = (modified * price) / 10000;
  return {
    price: parseFloat(price.toFixed(4)),
    macaulayDuration: parseFloat(macaulay.toFixed(4)),
    modifiedDuration: parseFloat(modified.toFixed(4)),
    convexity: parseFloat(convexity.toFixed(4)),
    dv01: parseFloat(dv01.toFixed(5)),
    ytm: ytmPct,
  };
}

// ── 曲线形状指标（斜率/曲率） ──────────────────────────────────────────────────
export function curveShapeMetrics(data: GcCurvePoint[]): {
  slope2s10s: number | null; // 10Y - 2Y (bp)
  slope3m10y: number | null;
  curvature: number | null;   // 2*5Y - 2Y - 10Y (bp, 蝶式)
} {
  const get = (t: string) => queryYield(data, t, 'spline');
  const y2 = get('2Y'), y10 = get('10Y'), y3m = get('3M'), y5 = get('5Y');
  return {
    slope2s10s: y2 != null && y10 != null ? parseFloat(((y10 - y2) * 100).toFixed(1)) : null,
    slope3m10y: y3m != null && y10 != null ? parseFloat(((y10 - y3m) * 100).toFixed(1)) : null,
    curvature: y2 != null && y5 != null && y10 != null ? parseFloat(((2 * y5 - y2 - y10) * 100).toFixed(1)) : null,
  };
}

export type { GcCurvePoint, GcCurveSeries };
