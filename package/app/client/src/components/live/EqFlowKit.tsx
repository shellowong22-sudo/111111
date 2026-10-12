/**
 * 股票 / ETF / 资金流 / 交易组共用的小部件与计算（仅供 components/live/EqFlow* 使用）。
 * 全部基于实时行情与日线 / 分钟线计算，不含任何模拟数据。
 */
import { useEffect, useRef, useState } from "react";
import { ucGet, type Candle, type Period } from "@/uc/market/live";

/* ------------------------------------------------------------------ 表格样式 */
export const TH = "px-2 py-1 text-right font-normal";
export const THL = "px-2 py-1 text-left font-normal";
export const TD = "px-2 py-0.5 text-right font-mono";
export const TDL = "px-2 py-0.5 text-left";
export const ROW = "border-t border-[#0f1b29] hover:bg-[#0a1726]";
export const HEAD = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
export const INP = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white";
export const BTN = "border border-[#1d3047] px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-[#0a1726]";
export const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return <span className="inline-flex flex-wrap gap-1">{options.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)} className={`border px-1.5 text-[10px] ${value === k ? "border-cyan-500 bg-cyan-900/30 text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-slate-200"}`}>{l}</button>)}</span>;
}

/* ------------------------------------------------------------------ 多标的 K 线（含成交量） */
export type BarsMap = Record<string, Candle[]>;
/** 批量读取多标的 K 线（每批 6 个并发，逐批刷新显示），默认 5 分钟刷新 */
export function useBars(symbols: string[], limit = 80, period: Period = "1d", everyMs = 300_000) {
  const key = `${symbols.join("|")}#${limit}#${period}`;
  const [state, setState] = useState<{ key: string; data: BarsMap; loading: boolean }>({ key, data: {}, loading: symbols.length > 0 });
  const dataRef = useRef<BarsMap>({});
  useEffect(() => {
    if (!symbols.length) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;
    dataRef.current = {};
    setState({ key, data: {}, loading: true });
    const list = key.split("#")[0].split("|");
    const load = async () => {
      for (let i = 0; i < list.length && alive; i += 6) {
        await Promise.all(list.slice(i, i + 6).map(async (s) => {
          try {
            const r = await ucGet<{ candles: Candle[] }>("ucMarket.kline", { symbol: s, period, limit }, AbortSignal.timeout(20000));
            if (r.candles?.length) dataRef.current = { ...dataRef.current, [s]: r.candles };
          } catch {
            /* 单个标的失败保留上一次结果 */
          }
        }));
        if (alive) setState({ key, data: dataRef.current, loading: i + 6 < list.length && !Object.keys(dataRef.current).length });
      }
      if (alive) setState({ key, data: dataRef.current, loading: false });
      if (alive) t = setTimeout(load, typeof document !== "undefined" && document.hidden ? everyMs * 2 : everyMs);
    };
    void load();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, everyMs]);
  return state.key === key ? state : { key, data: {} as BarsMap, loading: symbols.length > 0 };
}

/* ------------------------------------------------------------------ 盘口（批量轮询） */
export type Depth = { symbol: string; at: number; levels: number; last: number; bids: Array<{ px: number; qty: number }>; asks: Array<{ px: number; qty: number }> };
export function useDepths(symbols: string[], everyMs = 10_000) {
  const key = symbols.join("|");
  const [map, setMap] = useState<Record<string, Depth>>({});
  useEffect(() => {
    if (!key) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;
    const list = key.split("|");
    const load = async () => {
      const out: Record<string, Depth> = {};
      for (let i = 0; i < list.length && alive; i += 6) {
        await Promise.all(list.slice(i, i + 6).map(async (s) => {
          try { out[s] = await ucGet<Depth>("ucMarket.depth", { symbol: s }, AbortSignal.timeout(12000)); } catch { /* 忽略 */ }
        }));
      }
      if (alive) setMap((m) => ({ ...m, ...out }));
      if (alive) t = setTimeout(load, typeof document !== "undefined" && document.hidden ? everyMs * 3 : everyMs);
    };
    void load();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [key, everyMs]);
  return map;
}

/* ------------------------------------------------------------------ 资金流指标（均为标准技术指标口径） */
export type FlowStats = {
  last: Candle | null;
  turnover: number | null; // 最近一根：成交量 × 收盘价（本币估算）
  avgTurnover20: number | null;
  rvol: number | null; // 最近一根成交量 ÷ 前 20 根均量
  cmf20: number | null; // 蔡金资金流（-1 ~ 1）
  mfi14: number | null; // 资金流量指数（0 ~ 100）
  dir5: number | null; // 近 5 根 涨跌方向加权成交额占比（-1 ~ 1）
  dir20: number | null;
  obvSlope: number | null; // OBV 20 根变化 ÷ 20 日均量
  signed: number | null; // 最近一根：成交额 × 涨跌方向
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export function flowStats(c: Candle[] | undefined): FlowStats {
  const empty: FlowStats = { last: null, turnover: null, avgTurnover20: null, rvol: null, cmf20: null, mfi14: null, dir5: null, dir20: null, obvSlope: null, signed: null };
  if (!c || c.length < 3) return empty;
  const bars = c.filter((b) => b.v != null && b.v >= 0);
  if (bars.length < 3) return { ...empty, last: c[c.length - 1] };
  const last = bars[bars.length - 1];
  const prev = bars.slice(-21, -1);
  const avgV = mean(prev.map((b) => b.v ?? 0));
  const turnover = (last.v ?? 0) * last.c;
  const avgTurnover20 = prev.length ? mean(prev.map((b) => (b.v ?? 0) * b.c)) : null;
  const w20 = bars.slice(-20);
  let mfv = 0, vs = 0;
  for (const b of w20) { const r = b.h - b.l; if (r > 0) mfv += (((b.c - b.l) - (b.h - b.c)) / r) * (b.v ?? 0); vs += b.v ?? 0; }
  const cmf20 = vs ? mfv / vs : null;
  let pos = 0, neg = 0;
  const w15 = bars.slice(-15);
  for (let i = 1; i < w15.length; i++) {
    const tp = (w15[i].h + w15[i].l + w15[i].c) / 3, tp0 = (w15[i - 1].h + w15[i - 1].l + w15[i - 1].c) / 3;
    const mf = tp * (w15[i].v ?? 0);
    if (tp > tp0) pos += mf; else if (tp < tp0) neg += mf;
  }
  const mfi14 = pos + neg > 0 ? (100 * pos) / (pos + neg) : null;
  const dir = (n: number) => {
    const w = bars.slice(-(n + 1));
    let s = 0, a = 0;
    for (let i = 1; i < w.length; i++) { const t = (w[i].v ?? 0) * w[i].c; a += t; s += Math.sign(w[i].c - w[i - 1].c) * t; }
    return a ? s / a : null;
  };
  let obv = 0;
  const w21 = bars.slice(-21);
  for (let i = 1; i < w21.length; i++) obv += Math.sign(w21[i].c - w21[i - 1].c) * (w21[i].v ?? 0);
  const p = bars[bars.length - 2];
  return {
    last, turnover, avgTurnover20, rvol: avgV ? (last.v ?? 0) / avgV : null, cmf20, mfi14, dir5: dir(5), dir20: dir(20),
    obvSlope: avgV ? obv / (avgV * 20) : null, signed: p ? Math.sign(last.c - p.c) * turnover : null,
  };
}

/* ------------------------------------------------------------------ 统计 */
export const avg = mean;
export function sd(a: number[]) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); }
export function betaOf(y: number[], x: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 20) return null;
  const xs = x.slice(-n), ys = y.slice(-n);
  const mx = mean(xs), my = mean(ys);
  let c = 0, v = 0;
  for (let i = 0; i < n; i++) { c += (xs[i] - mx) * (ys[i] - my); v += (xs[i] - mx) ** 2; }
  return v ? c / v : null;
}
export function corrOf(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) { c += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
  return vx && vy ? c / Math.sqrt(vx * vy) : null;
}
export const sret = (c: number[]) => c.slice(1).map((v, i) => v / c[i] - 1);
export const diffs = (c: number[]) => c.slice(1).map((v, i) => v - c[i]);
export function pctRank(arr: number[], v: number | null | undefined) { return v == null || !arr.length ? null : (arr.filter((x) => x <= v).length / arr.length) * 100; }
export function zScore(arr: number[], v: number | null | undefined) { if (v == null || arr.length < 10) return null; const s = sd(arr); return s ? (v - mean(arr)) / s : null; }
/** 按日期字符串对齐两个序列 */
export const dayOf = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

/** 迷你折线 */
export function Mini({ values, w = 80, h = 16, color = "#38bdf8" }: { values: Array<number | null | undefined>; w?: number; h?: number; color?: string }) {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length < 2) return <span className="text-slate-600">—</span>;
  const lo = Math.min(...v), hi = Math.max(...v);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - 1 - ((x - lo) / Math.max(1e-12, hi - lo)) * (h - 2)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} className="inline-block align-middle"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.1} /></svg>;
}
/** 区间位置条 */
export function Range({ lo, hi, v, w = 70 }: { lo: number | null | undefined; hi: number | null | undefined; v: number | null | undefined; w?: number }) {
  if (lo == null || hi == null || v == null || hi <= lo) return <span className="text-slate-600">—</span>;
  const f = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return <svg width={w} height={10} className="inline-block align-middle"><rect x={0} y={4} width={w} height={2} fill="#1d3047" /><rect x={f * (w - 3)} y={1} width={3} height={8} fill={f > 0.8 ? "#f2495c" : f < 0.2 ? "#1fbf75" : "#e2e8f0"} /></svg>;
}
/** -1~1 或任意带符号数值的横向条 */
export function SignBar({ v, max = 1, w = 70 }: { v: number | null | undefined; max?: number; w?: number }) {
  if (v == null || !Number.isFinite(v)) return <span className="text-slate-600">—</span>;
  const f = Math.max(-1, Math.min(1, v / (max || 1)));
  const half = w / 2;
  return <svg width={w} height={10} className="inline-block align-middle"><rect x={0} y={4.5} width={w} height={1} fill="#1d3047" /><rect x={f >= 0 ? half : half + f * half} y={1} width={Math.max(1, Math.abs(f) * half)} height={8} fill={f >= 0 ? "#f2495c" : "#1fbf75"} /></svg>;
}

/** 下载 CSV（带 BOM，Excel 可直接打开） */
export function downloadCsv(name: string, rows: Array<Array<string | number | null | undefined>>) {
  const text = `﻿${rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 持续采样（真实观测值按时间累积，用于盘中走势） */
export function useSampler<T>(value: T | null, everyMs: number, max = 360) {
  const [rows, setRows] = useState<Array<{ t: number; v: T }>>([]);
  const ref = useRef(value);
  ref.current = value;
  useEffect(() => {
    const push = () => { if (ref.current != null) setRows((r) => [...r.slice(-(max - 1)), { t: Date.now(), v: ref.current as T }]); };
    const first = setTimeout(push, 1500);
    const id = setInterval(push, everyMs);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [everyMs, max]);
  return rows;
}
