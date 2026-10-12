/**
 * 模型预测分析（/model-predictions）：
 * 全部基于真实日线逐日“滚动外推”计算——每个交易日只用当天及以前的数据做出 h 日后的预测，
 * 到期后与真实值比对，得到误差、方向命中率、区间覆盖率与相对随机游走的改进幅度。
 * 模型：均值回归 Z 分数（AR(1) 半衰期）、时间序列动量、滚动线性回归趋势、EWMA 波动率。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { fmtPct, fmtPrice, toneOf, useTicks, UP, DOWN } from "@/uc/market/live";
import { useCloses, mean, std, f2 } from "@/uc/hubs/calc";
import { HubContext, SymbolPane } from "@/uc/hubs/kit";
import { SectionHead, Seg } from "@/uc/news/kit";

/* ------------------------------------------------------------------ 标的与模型 */
type Kind = "yield" | "price";
const TARGETS: Array<{ s: string; label: string; kind: Kind }> = [
  { s: "^TNX", label: "美国 10 年期国债收益率", kind: "yield" },
  { s: "^FVX", label: "美国 5 年期国债收益率", kind: "yield" },
  { s: "^TYX", label: "美国 30 年期国债收益率", kind: "yield" },
  { s: "^IRX", label: "美国 13 周国库券收益率", kind: "yield" },
  { s: "ZN", label: "10 年美债期货", kind: "price" },
  { s: "TLT", label: "20 年以上美债 ETF", kind: "price" },
  { s: "IEF", label: "7–10 年美债 ETF", kind: "price" },
  { s: "SHY", label: "1–3 年美债 ETF", kind: "price" },
  { s: "TIP", label: "通胀保值国债 ETF", kind: "price" },
  { s: "LQD", label: "投资级公司债 ETF", kind: "price" },
  { s: "HYG", label: "高收益公司债 ETF", kind: "price" },
  { s: "EMB", label: "新兴市场美元债 ETF", kind: "price" },
];
const ALL = TARGETS.map((t) => t.s);

type Param = { key: string; label: string; min: number; max: number; step: number; def: number };
const MODELS: Array<{ id: string; name: string; label: string; color: string; desc: string; params: Param[] }> = [
  {
    id: "zscore", name: "Mean-Reversion Z", label: "均值回归 Z 分数", color: "#38bdf8",
    desc: "z =（现值 − 滚动均值）/ 滚动标准差；|z| 超过阈值时，按窗口内偏离的 AR(1) 系数 φ 预测 h 日后回归到 均值 + 偏离 × φ^h；未触发时预测不变。",
    params: [
      { key: "window", label: "滚动窗口（交易日）", min: 20, max: 250, step: 5, def: 60 },
      { key: "threshold", label: "触发阈值（σ）", min: 0.5, max: 3, step: 0.1, def: 1.5 },
      { key: "h", label: "预测步长（交易日）", min: 1, max: 60, step: 1, def: 10 },
    ],
  },
  {
    id: "momentum", name: "Time-Series Momentum", label: "时间序列动量", color: "#fbbf24",
    desc: "以回看期内的平均日变动作为漂移，按收缩系数外推 h 日：预测 = 现值 + 收缩 × 漂移 × h；信号方向 = 回看期涨跌方向。",
    params: [
      { key: "lookback", label: "回看期（交易日）", min: 5, max: 250, step: 5, def: 60 },
      { key: "shrink", label: "收缩系数", min: 0.1, max: 1, step: 0.05, def: 0.5 },
      { key: "h", label: "预测步长（交易日）", min: 1, max: 60, step: 1, def: 10 },
    ],
  },
  {
    id: "trend", name: "Rolling OLS Trend", label: "滚动回归趋势", color: "#a78bfa",
    desc: "对窗口内的价格（或收益率）做时间的最小二乘回归，R² 不低于门槛才外推回归线到 h 日后，否则视为无趋势、预测不变。",
    params: [
      { key: "window", label: "回归窗口（交易日）", min: 10, max: 250, step: 5, def: 40 },
      { key: "minR2", label: "R² 门槛", min: 0, max: 0.9, step: 0.05, def: 0.3 },
      { key: "h", label: "预测步长（交易日）", min: 1, max: 60, step: 1, def: 10 },
    ],
  },
  {
    id: "ewma", name: "EWMA Volatility", label: "EWMA 波动率", color: "#f472b6",
    desc: "σ²ₜ = λσ²ₜ₋₁ + (1−λ)rₜ²，预测未来 h 日年化已实现波动率；收益率类标的按每日 bp 变动计算（单位：年化 bp），价格类按对数收益（单位：年化 %）。",
    params: [
      { key: "lambda", label: "衰减因子 λ", min: 0.8, max: 0.99, step: 0.01, def: 0.94 },
      { key: "h", label: "预测步长（交易日）", min: 5, max: 60, step: 1, def: 20 },
    ],
  },
];

/* ------------------------------------------------------------------ 计算引擎 */
type Row = { t: number; date: string; target: string; x: number; f: number; signal: number; actual: number | null; lo: number | null; hi: number | null; err: number | null; hit: boolean | null };
type Metrics = { n: number; mae: number; rmse: number; mape: number; hit: number | null; signals: number; coverage: number | null; rwMae: number | null; skill: number | null; capture: number[]; captureLast: number | null };

const dayKey = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

function ols(y: number[]) {
  const n = y.length;
  const mx = (n - 1) / 2;
  const my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (i - mx) * (y[i] - my); sxx += (i - mx) ** 2; syy += (y[i] - my) ** 2; }
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { a, b, r2 };
}

/** 单日预测（只用 x[0..t]） */
function forecastAt(model: string, x: number[], t: number, p: Record<string, number>, kind: Kind, varState: { v: number | null }): { f: number; signal: number; base: number } | null {
  const h = p.h;
  if (model === "zscore") {
    const w = p.window;
    if (t < w) return null;
    const seg = x.slice(t - w + 1, t + 1);
    const m = mean(seg), s = std(seg);
    if (!s) return { f: x[t], signal: 0, base: x[t] };
    const z = (x[t] - m) / s;
    if (Math.abs(z) < p.threshold) return { f: x[t], signal: 0, base: x[t] };
    const d = seg.map((v) => v - m);
    let num = 0, den = 0;
    for (let i = 1; i < d.length; i++) { num += d[i] * d[i - 1]; den += d[i - 1] ** 2; }
    const phi = Math.min(0.999, Math.max(0, den ? num / den : 0));
    return { f: m + (x[t] - m) * Math.pow(phi, h), signal: z > 0 ? -1 : 1, base: x[t] };
  }
  if (model === "momentum") {
    const L = p.lookback;
    if (t < L) return null;
    const drift = (x[t] - x[t - L]) / L;
    return { f: x[t] + p.shrink * drift * h, signal: Math.sign(drift), base: x[t] };
  }
  if (model === "trend") {
    const w = p.window;
    if (t < w) return null;
    const { a, b, r2 } = ols(x.slice(t - w + 1, t + 1));
    if (r2 < p.minR2) return { f: x[t], signal: 0, base: x[t] };
    return { f: a + b * (w - 1 + h), signal: Math.sign(b), base: x[t] };
  }
  // ewma：x 是水平值，内部转成日变动
  if (t < 1) return null;
  const r = kind === "yield" ? (x[t] - x[t - 1]) * 100 : Math.log(x[t] / x[t - 1]) * 100;
  varState.v = varState.v == null ? r * r : p.lambda * varState.v + (1 - p.lambda) * r * r;
  if (t < 60) return null;
  const f = Math.sqrt(varState.v * 252);
  // 基准：过去 20 日已实现波动率
  const rr: number[] = [];
  for (let i = t - 19; i <= t; i++) rr.push(kind === "yield" ? (x[i] - x[i - 1]) * 100 : Math.log(x[i] / x[i - 1]) * 100);
  const base = std(rr) * Math.sqrt(252);
  return { f, signal: Math.sign(f - base), base };
}

function realizedVol(x: number[], t: number, h: number, kind: Kind) {
  if (t + h >= x.length) return null;
  const rr: number[] = [];
  for (let i = t + 1; i <= t + h; i++) rr.push(kind === "yield" ? (x[i] - x[i - 1]) * 100 : Math.log(x[i] / x[i - 1]) * 100);
  return rr.length > 1 ? std(rr) * Math.sqrt(252) : null;
}

/** 滚动外推回测：逐日预测、到期比对 */
function runModel(model: string, x: number[], dates: string[], p: Record<string, number>, kind: Kind, testDays: number) {
  const h = Math.max(1, Math.round(p.h));
  const n = x.length;
  const rows: Row[] = [];
  const varState = { v: null as number | null };
  const errs: Array<{ realizedAt: number; e: number }> = [];
  const start = Math.max(0, n - 1 - testDays - h);
  let ready = 0;
  for (let t = 1; t < n; t++) {
    const fc = forecastAt(model, x, t, p, kind, varState);
    if (!fc || t < start) continue;
    const actual = model === "ewma" ? realizedVol(x, t, h, kind) : t + h < n ? x[t + h] : null;
    // 区间：用此前已到期的预测误差（最近 250 个）估计 1.96σ
    while (ready < errs.length && errs[ready].realizedAt <= t) ready++;
    const known = errs.slice(Math.max(0, ready - 250), ready).map((e) => e.e);
    const se = known.length >= 20 ? std(known) : null;
    const err = actual != null ? fc.f - actual : null;
    if (err != null) errs.push({ realizedAt: t + h, e: err });
    const hit = actual == null || fc.signal === 0 ? null : Math.sign(actual - fc.base) === fc.signal;
    rows.push({ t, date: dates[t], target: t + h < n ? dates[t + h] : `+${h}日`, x: model === "ewma" ? fc.base : x[t], f: fc.f, signal: fc.signal, actual, lo: se != null ? fc.f - 1.96 * se : null, hi: se != null ? fc.f + 1.96 * se : null, err, hit });
  }
  const done = rows.filter((r) => r.actual != null);
  const ae = done.map((r) => Math.abs(r.err!));
  const hits = done.filter((r) => r.hit != null);
  const cov = done.filter((r) => r.lo != null);
  const rw = model === "ewma" ? done.map((r) => Math.abs(r.x - r.actual!)) : done.map((r) => Math.abs(x[r.t] - r.actual!));
  const mae = mean(ae);
  const rwMae = rw.length ? mean(rw) : null;
  // 信号累计捕获：按信号持有下一交易日的变动（收益率类单位 bp，价格类单位 %）
  const capture: number[] = [];
  let cum = 0;
  if (model !== "ewma") {
    for (const r of rows) {
      if (r.t + 1 >= n) break;
      const d = kind === "yield" ? (x[r.t + 1] - x[r.t]) * 100 : (x[r.t + 1] / x[r.t] - 1) * 100;
      cum += r.signal * d;
      capture.push(cum);
    }
  }
  const metrics: Metrics = {
    n: done.length,
    mae,
    rmse: Math.sqrt(mean(ae.map((e) => e * e))),
    mape: mean(done.filter((r) => r.actual !== 0).map((r) => Math.abs(r.err! / r.actual!) * 100)),
    hit: hits.length ? (hits.filter((r) => r.hit).length / hits.length) * 100 : null,
    signals: hits.length,
    coverage: cov.length ? (cov.filter((r) => r.actual! >= r.lo! && r.actual! <= r.hi!).length / cov.length) * 100 : null,
    rwMae,
    skill: rwMae ? (1 - mae / rwMae) * 100 : null,
    capture,
    captureLast: capture.length ? capture[capture.length - 1] : null,
  };
  return { rows, metrics, h };
}

/* ------------------------------------------------------------------ 图 */
function ForecastChart({ rows, color, fmt, h }: { rows: Row[]; color: string; fmt: (v: number) => string; h: number }) {
  const view = rows.slice(-180);
  if (view.length < 5) return <div className="px-2 py-10 text-[11px] text-slate-500">数据不足</div>;
  // 横轴按“目标日”排列：已到期的点画真实值，未到期的画预测
  const W = 900, H = 300, L = 46, R = 10, T = 8, B = 22;
  const vals = view.flatMap((r) => [r.f, r.actual, r.lo, r.hi].filter((v): v is number => v != null && Number.isFinite(v)));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad; hi += pad;
  const n = view.length;
  const X = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = (get: (r: Row) => number | null) => {
    let d = "", pen = false;
    view.forEach((r, i) => { const v = get(r); if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  const band = view.map((r, i) => (r.hi != null ? `${X(i).toFixed(1)},${Y(r.hi).toFixed(1)}` : null)).filter(Boolean);
  const bandLo = view.map((r, i) => (r.lo != null ? `${X(i).toFixed(1)},${Y(r.lo).toFixed(1)}` : null)).filter(Boolean).reverse();
  const firstPending = view.findIndex((r) => r.actual == null);
  return (
    <div>
      <div className="flex flex-wrap gap-3 px-2 text-[10px]">
        <span className="text-slate-200">━ 到期真实值</span>
        <span style={{ color }}>┅ {h} 日前做出的预测</span>
        <span className="text-slate-400">▒ 95% 误差区间（按历史预测误差）</span>
        {firstPending >= 0 && <span className="text-amber-300">│ 右侧为尚未到期的预测</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((q) => { const v = lo + (hi - lo) * q; return <g key={q}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#132233" /><text x={2} y={Y(v) + 3} fontSize={9} fill="#5f7891">{fmt(v)}</text></g>; })}
        {band.length > 2 && <polygon points={[...band, ...bandLo].join(" ")} fill={color} opacity={0.12} />}
        <path d={path((r) => r.actual)} fill="none" stroke="#e2e8f0" strokeWidth={1.3} />
        <path d={path((r) => r.f)} fill="none" stroke={color} strokeWidth={1.3} strokeDasharray="4 3" />
        {firstPending > 0 && <line x1={X(firstPending)} x2={X(firstPending)} y1={T} y2={H - B} stroke="#fbbf24" strokeDasharray="2 3" />}
        {[0, 0.25, 0.5, 0.75, 1].map((q) => { const i = Math.round(q * (n - 1)); return <text key={q} x={X(i)} y={H - 6} fontSize={9} textAnchor="middle" fill="#5f7891">{view[i].target.slice(2)}</text>; })}
      </svg>
    </div>
  );
}

function MiniLine({ values, color, height = 150, fmt }: { values: number[]; color: string; height?: number; fmt: (v: number) => string }) {
  if (values.length < 2) return <div className="px-2 py-6 text-[11px] text-slate-500">无信号记录</div>;
  const W = 600, H = height;
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  const X = (i: number) => 40 + (i / (values.length - 1)) * (W - 46);
  const Y = (v: number) => 6 + ((hi - v) / (hi - lo || 1)) * (H - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={40} x2={W - 6} y1={Y(0)} y2={Y(0)} stroke="#475569" strokeDasharray="3 3" />
      <text x={2} y={Y(hi) + 8} fontSize={9} fill="#5f7891">{fmt(hi)}</text>
      <text x={2} y={Y(lo)} fontSize={9} fill="#5f7891">{fmt(lo)}</text>
      <polyline points={values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth={1.3} />
    </svg>
  );
}

function Residuals({ rows, color, fmt }: { rows: Row[]; color: string; fmt: (v: number) => string }) {
  const done = rows.filter((r) => r.actual != null && r.err != null);
  if (done.length < 10) return <div className="px-2 py-6 text-[11px] text-slate-500">样本不足</div>;
  const W = 600, H = 260;
  const xs = done.map((r) => r.actual!), ys = done.map((r) => r.err!);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ylim = Math.max(...ys.map(Math.abs)) || 1;
  const X = (v: number) => 44 + ((v - x0) / (x1 - x0 || 1)) * (W - 50);
  const Y = (v: number) => 8 + ((ylim - v) / (2 * ylim)) * (H - 24);
  // 残差直方图（10 档）
  const bins = new Array(12).fill(0);
  ys.forEach((e) => { bins[Math.min(11, Math.floor(((e + ylim) / (2 * ylim)) * 12))]++; });
  const bmax = Math.max(...bins);
  // 残差一阶自相关（重叠预测天然正相关）
  const m = mean(ys);
  let a = 0, b = 0;
  for (let i = 1; i < ys.length; i++) { a += (ys[i] - m) * (ys[i - 1] - m); b += (ys[i - 1] - m) ** 2; }
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="bg-[#03070c]">
        <div className="px-2 text-[10px] text-slate-500">横轴：到期真实值 · 纵轴：预测 − 真实</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
          <line x1={44} x2={W - 6} y1={Y(0)} y2={Y(0)} stroke="#64748b" strokeDasharray="3 3" />
          <text x={2} y={Y(ylim) + 8} fontSize={9} fill="#5f7891">{fmt(ylim)}</text>
          <text x={2} y={Y(-ylim)} fontSize={9} fill="#5f7891">{fmt(-ylim)}</text>
          <text x={44} y={H - 3} fontSize={9} fill="#5f7891">{fmt(x0)}</text>
          <text x={W - 6} y={H - 3} fontSize={9} textAnchor="end" fill="#5f7891">{fmt(x1)}</text>
          {done.map((r, i) => <circle key={i} cx={X(r.actual!)} cy={Y(r.err!)} r={1.8} fill={color} opacity={0.6} />)}
        </svg>
      </div>
      <div className="bg-[#03070c] p-2 text-[11px]">
        <div className="mb-1 text-[10px] text-slate-500">残差分布</div>
        <div className="flex h-[120px] items-end gap-px">{bins.map((c, i) => <div key={i} className="flex-1" style={{ height: `${(c / bmax) * 100}%`, background: i < 6 ? DOWN : UP, opacity: 0.75 }} title={`${c}`} />)}</div>
        <table className="mt-2 w-full">
          <tbody>
            {[["样本数", String(done.length)], ["残差均值（偏差）", fmt(m)], ["残差标准差", fmt(std(ys))], ["一阶自相关", f2(b ? a / b : null, 3)], ["最大高估", fmt(Math.max(...ys))], ["最大低估", fmt(Math.min(...ys))]].map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="py-0.5 text-slate-400">{k}</td><td className="text-right font-mono text-slate-100">{v}</td></tr>)}
          </tbody>
        </table>
        <div className="mt-1 text-[10px] text-slate-500">偏差显著不为 0 说明模型系统性高估/低估；h 日预测相互重叠，残差自相关偏高属正常。</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 主组件 */
type HistoryRecord = { id: number; timestamp: string; modelId: string; modelLabel: string; modelColor: string; params: Record<string, number>; metrics: { mae: number; rmse: number; mape: number; accuracy: number }; seed: number };

const defParams = () => Object.fromEntries(MODELS.map((m) => [m.id, Object.fromEntries(m.params.map((p) => [p.key, p.def]))])) as Record<string, Record<string, number>>;

function download(name: string, rows: Array<Array<string | number | null>>) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ModelPredictionsLive() {
  const { user } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);
  const [modelId, setModelId] = useState("zscore");
  const [target, setTarget] = useState("^TNX");
  const [params, setParams] = useState(defParams);
  const [testDays, setTestDays] = useState("500");
  const [tab, setTab] = useState("forecast");
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  const pack = useCloses(ALL, 1600);
  const ticks = useTicks(ALL);
  const model = MODELS.find((m) => m.id === modelId)!;
  const tgt = TARGETS.find((t) => t.s === target)!;
  const p = params[modelId];

  const seriesOf = (s: string) => {
    const raw = pack.data?.[s] ?? [];
    const x = raw.map(([, c]) => c);
    // 收益率指数若以 10 倍报价，统一换算为百分比
    const k = TARGETS.find((t) => t.s === s)?.kind === "yield" && x.length && x[x.length - 1] > 20 ? 0.1 : 1;
    return { x: k === 1 ? x : x.map((v) => v * k), dates: raw.map(([t]) => dayKey(t)) };
  };
  const ser = useMemo(() => seriesOf(target), [pack.data, target]); // eslint-disable-line react-hooks/exhaustive-deps
  const res = useMemo(() => (ser.x.length > 80 ? runModel(modelId, ser.x, ser.dates, p, tgt.kind, Number(testDays)) : null), [ser, modelId, p, tgt.kind, testDays]);
  const allModels = useMemo(() => (ser.x.length > 80 ? MODELS.map((m) => ({ m, r: runModel(m.id, ser.x, ser.dates, params[m.id], tgt.kind, Number(testDays)) })) : []), [ser, params, tgt.kind, testDays]);
  const crossTargets = useMemo(() => (pack.data ? TARGETS.map((t) => { const s = seriesOf(t.s); return { t, r: s.x.length > 80 ? runModel(modelId, s.x, s.dates, p, t.kind, Number(testDays)) : null }; }) : []), [pack.data, modelId, p, testDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const isVol = modelId === "ewma";
  const unit = isVol ? (tgt.kind === "yield" ? " bp" : "%") : tgt.kind === "yield" ? "%" : "";
  const fmt = (v: number) => (isVol ? `${v.toFixed(1)}${unit}` : tgt.kind === "yield" ? `${v.toFixed(3)}%` : fmtPrice(v));
  const errFmt = (v: number) => (isVol ? `${v.toFixed(2)}${unit}` : tgt.kind === "yield" ? `${(v * 100).toFixed(1)}bp` : v.toFixed(3));
  const capUnit = tgt.kind === "yield" ? "bp" : "%";

  const latest = res?.rows[res.rows.length - 1] ?? null;
  const tick = ticks[target];

  // 历史运行记录（登录后入库）
  const runsQ = trpc.model.listRuns.useQuery(undefined, { enabled: !!user });
  const prevRuns = useRef<unknown>(undefined);
  useEffect(() => {
    if (runsQ.data && runsQ.data !== prevRuns.current) {
      prevRuns.current = runsQ.data;
      setHistory(runsQ.data.map((r) => ({ id: r.id, timestamp: r.timestamp, modelId: r.modelId, modelLabel: r.modelLabel, modelColor: r.modelColor, params: r.params, metrics: r.metrics, seed: r.seed })));
    }
  }, [runsQ.data]);
  const saveRun = trpc.model.saveRun.useMutation({ onSuccess: () => void runsQ.refetch() });
  const analyze = trpc.llm.analyzeModelPrediction.useMutation({
    onSuccess: (d) => { setAiReport(d.report); setTab("ai"); },
    onError: (e) => toast.error(`解读生成失败：${e.message}`),
  });

  const metricsForSave = () => {
    const m = res!.metrics;
    return { mae: +m.mae.toFixed(5), rmse: +m.rmse.toFixed(5), mape: +m.mape.toFixed(3), accuracy: +(m.hit ?? m.coverage ?? 0).toFixed(2) };
  };
  const recordRun = () => {
    if (!res) return;
    const mm = metricsForSave();
    const tIdx = TARGETS.findIndex((t) => t.s === target);
    const asOf = Number((latest?.date ?? "").replace(/-/g, "")) || 0;
    const saved = { ...p, target: tIdx, test: Number(testDays) };
    const label = `${model.label} · ${tgt.label}`;
    if (user) {
      saveRun.mutate({ modelId, modelLabel: label.slice(0, 128), modelColor: model.color, params: saved, ...mm, seed: asOf });
      toast.success("本次回测结果已保存");
    } else {
      setHistory((h) => [{ id: Date.now(), timestamp: new Date().toLocaleString("zh-CN", { hour12: false }), modelId, modelLabel: label, modelColor: model.color, params: saved, metrics: mm, seed: asOf }, ...h].slice(0, 20));
      toast.success("已记录（登录后可永久保存）");
    }
  };
  const restore = (r: HistoryRecord) => {
    const { target: ti, test, ...rest } = r.params;
    if (!MODELS.some((m) => m.id === r.modelId)) return toast.error("该记录的模型已下线");
    setModelId(r.modelId);
    setParams((prev) => ({ ...prev, [r.modelId]: { ...prev[r.modelId], ...rest } }));
    if (ti != null && TARGETS[ti]) setTarget(TARGETS[ti].s);
    if (test) setTestDays(String(test));
    setTab("forecast");
  };
  const genReport = () => {
    if (!res || !latest) return;
    const m = res.metrics;
    analyze.mutate({
      modelName: `${model.name} on ${tgt.label}`,
      modelLabel: model.label,
      params: p,
      metrics: metricsForSave(),
      predictionSummary: { forecastHorizon: res.h, latestPredicted: +latest.f.toFixed(4), trend: latest.signal > 0 ? "上行" : latest.signal < 0 ? "下行" : "无信号", avgConfidence: +(m.coverage ?? 0).toFixed(1) },
    });
  };

  const forecastChange = latest ? latest.f - latest.x : null;

  return (
    <HubContext.Provider value={{ pick: setPicked, picked }}>
      <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[#03070c] text-slate-200">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1">
          <span className="font-mono text-[11px] text-amber-300">MODL</span>
          <span className="text-[13px] font-semibold text-white">模型预测分析</span>
          <span className="text-[10px] text-slate-500">逐日滚动外推回测 · 只用预测当日及以前的数据</span>
          <span className="ml-auto flex items-center gap-2">
            <button type="button" onClick={recordRun} disabled={!res} className="border border-cyan-700 px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-cyan-900/30 disabled:opacity-40">记录本次回测</button>
            <button type="button" onClick={genReport} disabled={!res || analyze.isPending} className="border border-violet-700 px-2 py-0.5 text-[11px] text-violet-200 hover:bg-violet-900/30 disabled:opacity-40">{analyze.isPending ? "解读生成中…" : "智能解读"}</button>
          </span>
        </div>

        <div className={`grid min-h-0 flex-1 ${picked ? "lg:grid-cols-[minmax(0,1fr)_minmax(380px,38%)]" : ""}`}>
          <div className="min-w-0">
            <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[300px_minmax(0,1fr)]">
              {/* 配置 */}
              <div className="bg-[#050b13] p-2 text-[11px]">
                <div className="mb-1 text-[10px] text-slate-500">预测标的（点名称看 K 线）</div>
                <div className="max-h-[240px] overflow-y-auto border border-[#1a2a3c]">
                  {TARGETS.map((t) => {
                    const k = ticks[t.s];
                    return (
                      <div key={t.s} className={`flex cursor-pointer items-center gap-2 border-t border-[#0f1b29] px-1.5 py-0.5 first:border-t-0 ${target === t.s ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`} onClick={() => setTarget(t.s)}>
                        <span className="min-w-0 flex-1 truncate text-slate-200">{t.label}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPicked(t.s); }} className="font-mono text-[9px] text-slate-500 hover:text-cyan-300">{t.s}</button>
                        <span className="w-14 text-right font-mono" style={{ color: toneOf(k?.changePct) }}>{fmtPrice(k?.price)}</span>
                        <span className="w-12 text-right font-mono text-[10px]" style={{ color: toneOf(k?.changePct) }}>{fmtPct(k?.changePct)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mb-1 mt-2 text-[10px] text-slate-500">模型</div>
                <div className="grid grid-cols-2 gap-px bg-[#1a2a3c]">
                  {MODELS.map((m) => <button key={m.id} type="button" onClick={() => { setModelId(m.id); setAiReport(null); }} className={`px-1.5 py-1 text-left ${modelId === m.id ? "bg-[#0d2236] text-white" : "bg-[#050b13] text-slate-400 hover:bg-[#0a1726]"}`}><span className="mr-1" style={{ color: m.color }}>■</span>{m.label}</button>)}
                </div>
                {model.params.map((q) => (
                  <label key={q.key} className="mt-2 block">
                    <span className="flex justify-between text-[10px]"><span className="text-slate-400">{q.label}</span><span className="font-mono text-cyan-200">{p[q.key]}</span></span>
                    <input type="range" min={q.min} max={q.max} step={q.step} value={p[q.key]} onChange={(e) => setParams((prev) => ({ ...prev, [modelId]: { ...prev[modelId], [q.key]: Number(e.target.value) } }))} className="w-full accent-cyan-500" />
                  </label>
                ))}
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">回测区间<Seg value={testDays} onChange={setTestDays} options={[["250", "1年"], ["500", "2年"], ["1000", "4年"], ["1400", "全部"]]} /></div>
                <button type="button" onClick={() => setParams((prev) => ({ ...prev, [modelId]: defParams()[modelId] }))} className="mt-2 w-full border border-[#1d3047] py-0.5 text-[10px] text-slate-400 hover:text-white">恢复默认参数</button>
              </div>

              {/* 指标 */}
              <div className="bg-[#03070c]">
                <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] sm:grid-cols-4">
                  {([
                    ["最新值", tick?.price != null && !isVol && (tgt.kind === "price" || tick.price < 20) ? fmt(tick.price) : latest ? fmt(latest.x) : "—", isVol ? "近 20 日已实现波动率" : tick?.price != null && !isVol ? `实时 · 回测日线截至 ${latest?.date ?? "—"}` : `日线截至 ${latest?.date ?? "—"}`],
                    [`${res?.h ?? p.h} 日后预测`, latest ? fmt(latest.f) : "—", forecastChange == null ? "" : `较现值 ${forecastChange >= 0 ? "+" : ""}${errFmt(forecastChange)}`],
                    ["当前信号", latest ? (latest.signal > 0 ? "看涨/上行" : latest.signal < 0 ? "看跌/下行" : "无信号") : "—", latest?.lo != null ? `95% 区间 ${fmt(latest.lo)} ~ ${fmt(latest.hi!)}` : "误差样本不足"],
                    ["方向命中率", res?.metrics.hit != null ? `${res.metrics.hit.toFixed(1)}%` : "—", `有信号且已到期 ${res?.metrics.signals ?? 0} 次`],
                    ["MAE", res ? errFmt(res.metrics.mae) : "—", `已到期预测 ${res?.metrics.n ?? 0} 个`],
                    ["RMSE", res ? errFmt(res.metrics.rmse) : "—", `MAPE ${f2(res?.metrics.mape, 2, "%")}`],
                    ["相对随机游走", res?.metrics.skill != null ? `${res.metrics.skill >= 0 ? "+" : ""}${res.metrics.skill.toFixed(1)}%` : "—", "MAE 改进（正 = 优于“不变”预测）"],
                    ["区间覆盖率", f2(res?.metrics.coverage, 1, "%"), "理想值约 95%"],
                  ] as Array<[string, string, string]>).map(([k, v, s]) => <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div><div className="truncate text-[10px] text-slate-500">{s}</div></div>)}
                </div>
                <nav className="flex overflow-x-auto border-b border-[#1a2a3c] bg-[#050b13]">
                  {([["forecast", "预测走势"], ["table", "预测明细"], ["resid", "残差分析"], ["compare", "模型对比"], ["cross", "跨标的检验"], ["ai", `智能解读${aiReport ? " ●" : ""}`], ["history", `回测记录（${history.length}）`]] as Array<[string, string]>).map(([id, l]) => <button key={id} type="button" onClick={() => setTab(id)} className={`shrink-0 border-r border-[#111d2b] px-2.5 py-1 text-[11px] ${tab === id ? "bg-[#0d2236] text-white shadow-[inset_0_-2px_0_#22d3ee]" : "text-slate-400 hover:bg-[#0a1726]"}`}>{l}</button>)}
                </nav>
                {!res ? (
                  <div className="px-3 py-10 text-[11px] text-slate-500">{pack.loading ? "日线读取中…" : "该标的暂无足够日线"}</div>
                ) : tab === "forecast" ? (
                  <div>
                    <SectionHead title={`${model.label} · ${tgt.label}`} sub={`每个点是 ${res.h} 个交易日前做出的预测与到期真实值的对照`} />
                    <ForecastChart rows={res.rows} color={model.color} fmt={fmt} h={res.h} />
                    {!isVol && (
                      <>
                        <SectionHead title={`信号累计捕获（${capUnit}）`} sub={tgt.kind === "yield" ? "按信号方向持有收益率下一日变动的累计（收益率上行记为正）" : "按信号方向持有下一日涨跌幅的累计（未计交易成本）"} />
                        <MiniLine values={res.metrics.capture} color={model.color} fmt={(v) => `${v.toFixed(1)}${capUnit}`} />
                      </>
                    )}
                  </div>
                ) : tab === "table" ? (
                  <div>
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-500">
                      <span>最近 120 个预测（新→旧）</span>
                      <button type="button" onClick={() => download(`${model.label}_${tgt.s}_回测明细.csv`, [["预测日", "目标日", "现值", "预测", "到期真实", "误差", "信号", "方向命中", "区间下限", "区间上限"], ...res.rows.map((r) => [r.date, r.target, r.x, r.f, r.actual, r.err, r.signal, r.hit == null ? "" : r.hit ? "是" : "否", r.lo, r.hi])])} className="border border-[#1d3047] px-2 text-slate-300 hover:text-white">导出全部明细</button>
                    </div>
                    <div className="max-h-[520px] overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">预测日</th><th className="text-left">目标日</th><th className="text-right">现值</th><th className="text-right">预测</th><th className="text-right">到期真实</th><th className="text-right">误差</th><th className="text-right">信号</th><th className="px-2 text-right">命中</th></tr></thead>
                        <tbody>
                          {res.rows.slice(-120).reverse().map((r) => (
                            <tr key={r.t} className="border-t border-[#0f1b29]">
                              <td className="px-2 py-0.5 font-mono text-slate-400">{r.date}</td><td className="font-mono text-slate-400">{r.target}</td>
                              <td className="text-right font-mono text-slate-200">{fmt(r.x)}</td>
                              <td className="text-right font-mono" style={{ color: model.color }}>{fmt(r.f)}</td>
                              <td className="text-right font-mono text-white">{r.actual == null ? <span className="text-amber-300/70">未到期</span> : fmt(r.actual)}</td>
                              <td className="text-right font-mono" style={{ color: toneOf(r.err) }}>{r.err == null ? "—" : errFmt(r.err)}</td>
                              <td className="text-right" style={{ color: r.signal > 0 ? UP : r.signal < 0 ? DOWN : undefined }}>{r.signal > 0 ? "▲" : r.signal < 0 ? "▼" : "·"}</td>
                              <td className="px-2 text-right">{r.hit == null ? "—" : r.hit ? <span className="text-emerald-300">✓</span> : <span className="text-rose-300">✗</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : tab === "resid" ? (
                  <Residuals rows={res.rows} color={model.color} fmt={errFmt} />
                ) : tab === "compare" ? (
                  <div>
                    <SectionHead title={`四个模型在 ${tgt.label} 上的同区间回测（点击切换）`} sub="每个模型使用各自当前参数" />
                    <table className="w-full text-[11px]">
                      <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">模型</th><th className="text-right">步长</th><th className="text-right">样本</th><th className="text-right">MAE</th><th className="text-right">RMSE</th><th className="text-right">相对随机游走</th><th className="text-right">方向命中</th><th className="text-right">信号次数</th><th className="text-right">区间覆盖</th><th className="px-2 text-right">最新预测</th></tr></thead>
                      <tbody>
                        {allModels.map(({ m, r }) => {
                          const l = r.rows[r.rows.length - 1];
                          const vol = m.id === "ewma";
                          const ef = (v: number) => (vol ? `${v.toFixed(2)}${tgt.kind === "yield" ? " bp" : "%"}` : tgt.kind === "yield" ? `${(v * 100).toFixed(1)}bp` : v.toFixed(3));
                          return (
                            <tr key={m.id} onClick={() => setModelId(m.id)} className={`cursor-pointer border-t border-[#0f1b29] ${m.id === modelId ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                              <td className="px-2 py-1"><span style={{ color: m.color }}>■</span> {m.label}</td>
                              <td className="text-right font-mono">{r.h}</td><td className="text-right font-mono text-slate-400">{r.metrics.n}</td>
                              <td className="text-right font-mono">{ef(r.metrics.mae)}</td><td className="text-right font-mono">{ef(r.metrics.rmse)}</td>
                              <td className="text-right font-mono" style={{ color: r.metrics.skill == null ? undefined : r.metrics.skill > 0 ? "#34d399" : "#fb7185" }}>{r.metrics.skill == null ? "—" : `${r.metrics.skill.toFixed(1)}%`}</td>
                              <td className="text-right font-mono text-white">{f2(r.metrics.hit, 1, "%")}</td><td className="text-right font-mono text-slate-400">{r.metrics.signals}</td>
                              <td className="text-right font-mono">{f2(r.metrics.coverage, 1, "%")}</td>
                              <td className="px-2 text-right font-mono" style={{ color: m.color }}>{l ? (vol ? `${l.f.toFixed(1)}${tgt.kind === "yield" ? " bp" : "%"}` : tgt.kind === "yield" ? `${l.f.toFixed(3)}%` : fmtPrice(l.f)) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-2 py-1 text-[10px] text-slate-500">方向命中率只统计“有信号”的预测；波动率模型的方向指“未来波动高于/低于近 20 日”。命中率需结合信号次数看，样本少时不可靠。</div>
                  </div>
                ) : tab === "cross" ? (
                  <div>
                    <SectionHead title={`${model.label}（当前参数）在全部标的上的稳健性`} sub="同一参数跨标的回测，检验是否过拟合于单一标的；点击行切换标的" />
                    <table className="w-full text-[11px]">
                      <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">样本</th><th className="text-right">方向命中</th><th className="text-right">信号次数</th><th className="text-right">相对随机游走</th><th className="text-right">区间覆盖</th><th className="text-right">累计捕获</th><th className="px-2 text-right">当前信号</th></tr></thead>
                      <tbody>
                        {crossTargets.map(({ t, r }) => {
                          const l = r?.rows[r.rows.length - 1];
                          return (
                            <tr key={t.s} onClick={() => setTarget(t.s)} className={`cursor-pointer border-t border-[#0f1b29] ${t.s === target ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                              <td className="px-2 py-1 text-slate-200">{t.label}<span className="ml-1 font-mono text-[9px] text-slate-600">{t.s}</span></td>
                              <td className="text-right font-mono text-slate-400">{r?.metrics.n ?? "—"}</td>
                              <td className="text-right font-mono text-white" style={{ background: r?.metrics.hit != null ? `rgba(${r.metrics.hit >= 50 ? "52,211,153" : "251,113,133"},${Math.min(0.5, Math.abs(r.metrics.hit - 50) / 30)})` : undefined }}>{f2(r?.metrics.hit, 1, "%")}</td>
                              <td className="text-right font-mono text-slate-400">{r?.metrics.signals ?? "—"}</td>
                              <td className="text-right font-mono">{r?.metrics.skill == null ? "—" : `${r.metrics.skill.toFixed(1)}%`}</td>
                              <td className="text-right font-mono">{f2(r?.metrics.coverage, 1, "%")}</td>
                              <td className="text-right font-mono" style={{ color: toneOf(r?.metrics.captureLast) }}>{r?.metrics.captureLast == null ? "—" : `${r.metrics.captureLast.toFixed(1)}${t.kind === "yield" ? "bp" : "%"}`}</td>
                              <td className="px-2 text-right" style={{ color: l?.signal ? (l.signal > 0 ? UP : DOWN) : undefined }}>{!l ? "—" : l.signal > 0 ? "▲ 上行" : l.signal < 0 ? "▼ 下行" : "无"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : tab === "ai" ? (
                  <div className="p-2">
                    {analyze.isPending ? <div className="py-8 text-[11px] text-violet-300">正在根据本次回测指标生成解读…</div> : aiReport ? (
                      <div>
                        <div className="whitespace-pre-wrap border border-violet-900/50 bg-[#0a0716] p-3 text-[12px] leading-relaxed text-slate-200">{aiReport}</div>
                        <div className="mt-1 flex gap-2">
                          <button type="button" onClick={() => void navigator.clipboard.writeText(aiReport).then(() => toast.success("已复制"), () => toast.error("复制失败"))} className="border border-[#1d3047] px-2 text-[11px] text-slate-300 hover:text-white">复制</button>
                          <span className="text-[10px] text-slate-500">解读依据本页回测指标自动生成，仅供参考，不构成投资建议。</span>
                        </div>
                      </div>
                    ) : <div className="py-8 text-[11px] text-slate-500">点击右上角“智能解读”，根据当前模型、参数与回测指标生成文字解读。</div>}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-500">
                      <span>{user ? "已登录：记录永久保存" : "未登录：记录仅保留在本页"}；“恢复”会还原模型、标的、参数与回测区间并按最新日线重算</span>
                      {history.length > 0 && <button type="button" onClick={() => download(`模型回测记录_${new Date().toISOString().slice(0, 10)}.csv`, [["时间", "模型", "MAE", "RMSE", "MAPE(%)", "命中/覆盖(%)", "数据截至", "参数"], ...history.map((r) => [r.timestamp, r.modelLabel, r.metrics.mae, r.metrics.rmse, r.metrics.mape, r.metrics.accuracy, r.seed, Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(" ")])])} className="border border-[#1d3047] px-2 text-slate-300 hover:text-white">导出 CSV</button>}
                    </div>
                    {history.length === 0 ? <div className="px-3 py-8 text-[11px] text-slate-500">暂无记录，点击右上角“记录本次回测”。</div> : (
                      <table className="w-full text-[11px]">
                        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">时间</th><th className="text-left">模型 · 标的</th><th className="text-right">MAE</th><th className="text-right">RMSE</th><th className="text-right">MAPE</th><th className="text-right">命中/覆盖</th><th className="text-right">数据截至</th><th className="px-2" /></tr></thead>
                        <tbody>
                          {history.map((r) => (
                            <tr key={r.id} className="border-t border-[#0f1b29]">
                              <td className="px-2 py-0.5 font-mono text-slate-400">{r.timestamp}</td>
                              <td><span style={{ color: r.modelColor }}>■</span> {r.modelLabel}</td>
                              <td className="text-right font-mono">{r.metrics.mae}</td><td className="text-right font-mono">{r.metrics.rmse}</td><td className="text-right font-mono">{r.metrics.mape}%</td>
                              <td className="text-right font-mono text-white">{r.metrics.accuracy}%</td>
                              <td className="text-right font-mono text-slate-500">{r.seed > 19000000 ? String(r.seed).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "—"}</td>
                              <td className="px-2 text-right"><button type="button" onClick={() => restore(r)} className="text-cyan-300 hover:text-white">恢复</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {picked && <div className="min-h-[520px] border-l border-[#1a2a3c] bg-[#050a11]"><SymbolPane symbol={picked} onClose={() => setPicked(null)} /></div>}
        </div>
      </div>
    </HubContext.Provider>
  );
}
