/**
 * 市场 / 外汇 / 利率 / 风险小窗共用的小部件与数据钩子（仅供 components/live 下各实现文件使用）。
 */
import { useMemo } from "react";
import { usePolled } from "@/uc/market/live";

export type P = { onClose?: () => void };

/* ------------------------------------------------------------------ 表格样式 */
export const TH = "px-2 py-1 text-right font-normal";
export const THL = "px-2 py-1 text-left font-normal";
export const TD = "px-2 py-0.5 text-right font-mono";
export const TDL = "px-2 py-0.5 text-left";
export const ROW = "border-t border-[#0f1b29] hover:bg-[#0a1726]";
export const INP = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white";
export const BTN = "border border-[#1d3047] px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-[#0a1726]";
export const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示

/* ------------------------------------------------------------------ 日期 */
export const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export const addDays = (n: number) => isoDay(new Date(Date.now() + n * 86400_000));

/* ------------------------------------------------------------------ 经济日历（服务端单次最多 10 天，固定 4 个窗口拼接） */
export type EconEvent = { id: string; date: string; time: number | null; country: string; region: string; name: string; nameZh: string; actual: string | null; consensus: string | null; previous: string | null; importance: 1 | 2 | 3; surprise: number | null; released: boolean };
/** back：向前回看天数（≤30），fwd：向后天数（≤10）；共 4 个固定请求槽位 */
export function useCalendarSpan(back: number, fwd: number) {
  const b = Math.min(30, Math.max(0, back));
  const f = Math.min(10, Math.max(1, fwd));
  const slot = (k: number) => (b > k * 10 ? { from: addDays(-Math.min(b, (k + 1) * 10)), days: Math.min(10, b - k * 10) } : null);
  const s0 = usePolled<EconEvent[]>("ucNews.calendar", slot(0), 900_000);
  const s1 = usePolled<EconEvent[]>("ucNews.calendar", slot(1), 3600_000);
  const s2 = usePolled<EconEvent[]>("ucNews.calendar", slot(2), 3600_000);
  const s3 = usePolled<EconEvent[]>("ucNews.calendar", { from: addDays(0), days: f }, 300_000);
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: EconEvent[] = [];
    for (const list of [s2.data, s1.data, s0.data, s3.data]) for (const e of list ?? []) { if (seen.has(e.id)) continue; seen.add(e.id); out.push(e); }
    return out.sort((a, b) => (a.time ?? Date.parse(`${a.date}T23:59:00Z`)) - (b.time ?? Date.parse(`${b.date}T23:59:00Z`)));
  }, [s0.data, s1.data, s2.data, s3.data]);
  return { rows, loading: s0.loading || s3.loading };
}
export const numOf = (s: string | null | undefined) => { if (!s) return null; const m = /-?\d+(?:\.\d+)?/.exec(s.replace(/,/g, "")); return m ? Number(m[0]) : null; };
export const evTime = (e: EconEvent) => (e.time ? new Date(e.time).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : e.date.slice(5));

/* ------------------------------------------------------------------ 美债曲线 */
export type UsCurve = { date: string; points: Array<{ tenor: string; value: number }> };
export type Curves = { us: UsCurve[]; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
export const useCurves = () => usePolled<Curves>("ucHubs.curves", {}, 1800_000);
export const TENOR_Y: Record<string, number> = { "1M": 1 / 12, "6W": 1.5 / 12, "2M": 2 / 12, "3M": 0.25, "4M": 4 / 12, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3, "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30 };
export const TENORS = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
/** 线性插值的收益率函数（年 → 小数） */
export function yieldFn(points: Array<{ tenor: string; value: number }>) {
  const p = points.map((x) => [TENOR_Y[x.tenor], x.value / 100] as [number, number]).filter(([t]) => t != null).sort((a, b) => a[0] - b[0]);
  return (t: number) => {
    if (!p.length) return null;
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const [t0, r0] = p[i - 1], [t1, r1] = p[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); }
    return p[p.length - 1][1];
  };
}
export const tenorVal = (c: UsCurve | undefined, t: string) => c?.points.find((p) => p.tenor === t)?.value ?? null;

/* ------------------------------------------------------------------ 期货 */
export type FutPoint = { code: string; month: string; price: number; prev: number | null; change: number | null; changePct: number | null; volume: number | null; time?: number | null };
export type FutCurve = { root: string; name: string; unit: string; structure: string; slopePct: number | null; points: FutPoint[] };
export const monthsBetween = (a: string, b: string) => (Date.parse(`${b}-15`) - Date.parse(`${a}-15`)) / (30.4375 * 86400_000);

/* ------------------------------------------------------------------ 隐波扫描 */
export type IvRow = { symbol: string; price: number | null; changePct: number | null; iv30: number | null; iv30Chg: number | null; rv20: number | null; rv60: number | null; rv120: number | null; ivRv: number | null; ivRank: number | null; ivPct: number | null; ivDays: number; fromHigh: number | null; cone: Array<{ n: number; min: number | null; p25: number | null; med: number | null; p75: number | null; max: number | null; now: number | null }> };

/* ------------------------------------------------------------------ 统计 */
export function pctRank(arr: number[], v: number) { return arr.length ? (arr.filter((x) => x <= v).length / arr.length) * 100 : null; }
export function median(arr: number[]) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function quantile(arr: number[], q: number) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; }
/** 最小二乘斜率（y 对 x） */
export function slope(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  return sxx ? sxy / sxx : null;
}
export const diffs = (c: number[]) => c.slice(1).map((v, i) => v - c[i]);
export const simpleRets = (c: number[]) => c.slice(1).map((v, i) => v / c[i] - 1);

/** 迷你折线（不带坐标轴） */
export function MiniLine({ values, w = 90, h = 18, color = "#38bdf8" }: { values: Array<number | null>; w?: number; h?: number; color?: string }) {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length < 2) return <span className="text-slate-600">—</span>;
  const lo = Math.min(...v), hi = Math.max(...v);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - 1 - ((x - lo) / Math.max(1e-12, hi - lo)) * (h - 2)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} className="inline-block align-middle"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.1} /></svg>;
}

/** 区间位置条：lo—hi 之间当前值的位置 */
export function RangeBar({ lo, hi, v, w = 90 }: { lo: number | null; hi: number | null; v: number | null; w?: number }) {
  if (lo == null || hi == null || v == null || hi <= lo) return <span className="text-slate-600">—</span>;
  const f = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return <svg width={w} height={10} className="inline-block align-middle"><rect x={0} y={4} width={w} height={2} fill="#1d3047" /><rect x={f * (w - 3)} y={1} width={3} height={8} fill={f > 0.8 ? "#f2495c" : f < 0.2 ? "#1fbf75" : "#e2e8f0"} /></svg>;
}
