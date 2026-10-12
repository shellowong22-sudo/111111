/**
 * 专业页面公用计算：日线对齐、区间收益、波动率、相关性、回撤、风险平价等（全部基于实时拉取的日线）。
 */
import { usePolled } from "@/uc/market/live";

export type Pack = Record<string, Array<[number, number]>>;
export const useCloses = (symbols: string[], days = 260) => usePolled<Pack>("ucHubs.closes", symbols.length ? { symbols, days } : null, 600_000);

const dayKey = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

/** 按日期对齐（只保留所有标的都有收盘价的日子；单个标的缺失时用前值补齐，最多补 7 天（覆盖长假）） */
export function align(pack: Pack | null, symbols: string[]) {
  if (!pack) return { dates: [] as string[], m: {} as Record<string, number[]> };
  const maps = symbols.map((s) => new Map((pack[s] ?? []).map(([t, c]) => [dayKey(t), c])));
  const all = [...new Set(maps.flatMap((m) => [...m.keys()]))].sort();
  const m: Record<string, number[]> = Object.fromEntries(symbols.map((s) => [s, [] as number[]]));
  const dates: string[] = [];
  const last: Array<number | null> = symbols.map(() => null);
  const gap: number[] = symbols.map(() => 0);
  for (const d of all) {
    let ok = true;
    const row: number[] = [];
    symbols.forEach((_, i) => {
      const v = maps[i].get(d);
      if (v != null) { last[i] = v; gap[i] = 0; row.push(v); }
      else if (last[i] != null && gap[i] < 7) { gap[i]++; row.push(last[i]!); }
      else ok = false;
    });
    if (!ok) continue;
    dates.push(d);
    symbols.forEach((s, i) => m[s].push(row[i]));
  }
  return { dates, m };
}

export const rets = (c: number[]) => c.slice(1).map((v, i) => Math.log(v / c[i]));
export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const std = (a: number[]) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export const annVol = (c: number[], n?: number) => { const r = rets(n ? c.slice(-(n + 1)) : c); return r.length > 2 ? std(r) * Math.sqrt(252) * 100 : null; };
export function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
export function rollingCorr(a: number[], b: number[], win: number) {
  const ra = rets(a), rb = rets(b);
  const out: Array<number | null> = [null];
  for (let i = 0; i < ra.length; i++) out.push(i + 1 >= win ? corr(ra.slice(i + 1 - win, i + 1), rb.slice(i + 1 - win, i + 1)) : null);
  return out;
}
export function rollingVol(c: number[], win: number) {
  const r = rets(c);
  const out: Array<number | null> = [null];
  for (let i = 0; i < r.length; i++) out.push(i + 1 >= win ? std(r.slice(i + 1 - win, i + 1)) * Math.sqrt(252) * 100 : null);
  return out;
}
/** 区间收益（按交易日数回看） */
export const perf = (c: number[], n: number) => (c.length > n ? (c[c.length - 1] / c[c.length - 1 - n] - 1) * 100 : null);
export function ytd(c: number[], dates: string[]) {
  const y = new Date().getFullYear();
  const i = dates.findIndex((d) => d >= `${y}-01-01`);
  return i > 0 ? (c[c.length - 1] / c[i - 1] - 1) * 100 : null;
}
export function drawdown(c: number[]) {
  let peak = -Infinity, mdd = 0;
  const series = c.map((v) => { peak = Math.max(peak, v); const dd = (v / peak - 1) * 100; mdd = Math.min(mdd, dd); return dd; });
  return { series, max: mdd, now: series[series.length - 1] ?? 0 };
}
export function covMatrix(cols: number[][]) {
  const n = cols.length;
  const ms = cols.map(mean);
  const len = Math.min(...cols.map((c) => c.length));
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    let s = 0;
    for (let k = 0; k < len; k++) s += (cols[i][k] - ms[i]) * (cols[j][k] - ms[j]);
    cov[i][j] = cov[j][i] = (s / (len - 1)) * 252;
  }
  return cov;
}
/** 风险平价（等风险贡献）迭代求解 */
export function riskParity(cov: number[][]) {
  const n = cov.length;
  let w = new Array(n).fill(1 / n);
  for (let it = 0; it < 500; it++) {
    const mrc = cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
    const tot = w.reduce((s, x, i) => s + x * mrc[i], 0);
    const target = tot / n;
    const nw = w.map((x, i) => x * Math.pow(target / Math.max(1e-12, x * mrc[i]), 0.5));
    const sum = nw.reduce((a, b) => a + b, 0);
    w = nw.map((x) => x / sum);
  }
  return w;
}
/** 最小方差（只做多）：投影梯度下降 */
export function minVariance(cov: number[][]) {
  const n = cov.length;
  let w = new Array(n).fill(1 / n);
  const lr = 0.5 / Math.max(1e-9, Math.max(...cov.map((r, i) => r[i])));
  for (let it = 0; it < 3000; it++) {
    const g = cov.map((row) => 2 * row.reduce((s, c, j) => s + c * w[j], 0));
    w = w.map((x, i) => Math.max(0, x - lr * g[i]));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    w = w.map((x) => x / sum);
  }
  return w;
}
export const portVol = (w: number[], cov: number[][]) => Math.sqrt(w.reduce((s, wi, i) => s + wi * cov[i].reduce((t, c, j) => t + c * w[j], 0), 0)) * 100;

/** 正态分布 */
export function ncdf(x: number) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const s = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + s * y);
}
export const npdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
/** 广义 Black-Scholes（b = 持有成本：股票 r-q，外汇 rd-rf，期货 0） */
export function gbs(type: "C" | "P", S: number, K: number, T: number, r: number, b: number, v: number) {
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) { const intr = Math.max(0, type === "C" ? S - K : K - S); return { price: intr, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }; }
  const sq = v * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (b + v * v / 2) * T) / sq;
  const d2 = d1 - sq;
  const eb = Math.exp((b - r) * T), er = Math.exp(-r * T);
  if (type === "C") {
    const price = S * eb * ncdf(d1) - K * er * ncdf(d2);
    return { price, delta: eb * ncdf(d1), gamma: (eb * npdf(d1)) / (S * sq), vega: (S * eb * npdf(d1) * Math.sqrt(T)) / 100, theta: (-(S * eb * npdf(d1) * v) / (2 * Math.sqrt(T)) - (b - r) * S * eb * ncdf(d1) - r * K * er * ncdf(d2)) / 365, rho: (K * T * er * ncdf(d2)) / 100 };
  }
  const price = K * er * ncdf(-d2) - S * eb * ncdf(-d1);
  return { price, delta: eb * (ncdf(d1) - 1), gamma: (eb * npdf(d1)) / (S * sq), vega: (S * eb * npdf(d1) * Math.sqrt(T)) / 100, theta: (-(S * eb * npdf(d1) * v) / (2 * Math.sqrt(T)) + (b - r) * S * eb * ncdf(-d1) + r * K * er * ncdf(-d2)) / 365, rho: (-K * T * er * ncdf(-d2)) / 100 };
}

export const heat = (v: number | null | undefined, scale: number) => {
  if (v == null || !Number.isFinite(v)) return undefined;
  const a = Math.min(1, Math.abs(v) / scale);
  return v > 0 ? `rgba(242,73,92,${0.1 + a * 0.55})` : `rgba(31,191,117,${0.1 + a * 0.55})`;
};
export const f2 = (v: number | null | undefined, d = 2, suffix = "") => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}${suffix}`);
export const sgn = (v: number | null | undefined, d = 2, suffix = "%") => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}${suffix}`);
