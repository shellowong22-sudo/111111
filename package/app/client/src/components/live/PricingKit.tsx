/**
 * 定价与风险组公用件：组合（平台模拟账户真实持仓 / 示例组合）、组合日收益序列、统计工具。
 * 所有风险指标均由实时行情与真实日线计算。
 */
import { useMemo, useState } from "react";
import { fmtCompact, useTicks } from "@/uc/market/live";
import { align, useCloses } from "@/uc/hubs/calc";
import { usePositions } from "@/uc/trade/kit";
import { Seg } from "@/uc/news/kit";

export const NOTIONAL = 1_000_000;
/** 示例组合：平台模拟账户无持仓时使用（权重固定，行情与日线为真实数据） */
export const SAMPLE: Array<[string, string, number]> = [
  ["SPY", "标普500ETF", 0.25],
  ["QQQ", "纳指100ETF", 0.1],
  ["sh510300", "沪深300ETF", 0.15],
  ["2800.HK", "盈富基金", 0.05],
  ["TLT", "20年+美债ETF", 0.15],
  ["GLD", "黄金ETF", 0.1],
  ["HYG", "高收益债ETF", 0.1],
  ["EFA", "发达市场ETF", 0.1],
];

export const NAME: Record<string, string> = {
  ...Object.fromEntries(SAMPLE.map(([s, l]) => [s, l])),
  "^GSPC": "标普500", "^NDX": "纳指100", "^DJI": "道琼斯", "^RUT": "罗素2000", "^VIX": "波动率指数", "^VIX3M": "3月波动率指数", "^VVIX": "波动率的波动率", "^SKEW": "尾部偏度指数", "^MOVE": "美债波动率", "^OVX": "原油波动率", "^GVZ": "黄金波动率",
  "^TNX": "10年美债收益率", "^IRX": "13周美债收益率", "^FVX": "5年美债收益率", "^TYX": "30年美债收益率",
  sh000001: "上证指数", sh000300: "沪深300", sz399001: "深证成指", sz399006: "创业板指", sh000905: "中证500",
  sh600519: "贵州茅台", sz000001: "平安银行", sh601318: "中国平安", sz300750: "宁德时代", "0700.HK": "腾讯控股", "9988.HK": "阿里巴巴", "0005.HK": "汇丰控股",
  ES: "标普期货", NQ: "纳指期货", CL: "WTI原油", BRENT: "布伦特原油", GC: "黄金", SI: "白银", HG: "铜", NG: "天然气", ZN: "10年美债期货", ZT: "2年美债期货",
  EURUSD: "欧元/美元", USDJPY: "美元/日元", USDCNH: "美元/离岸人民币", GBPUSD: "英镑/美元", DXY: "美元指数", USDHKD: "美元/港币",
  BTC: "比特币", ETH: "以太坊", IWM: "罗素2000ETF", IEF: "7-10年美债ETF", SHY: "1-3年美债ETF", LQD: "投资级债ETF", USO: "原油基金", UUP: "美元指数基金",
  AAPL: "苹果", NVDA: "英伟达", MSFT: "微软", TSLA: "特斯拉", AMZN: "亚马逊", META: "Meta", GOOGL: "谷歌",
  JPM: "摩根大通", BAC: "美国银行", C: "花旗", GS: "高盛", MS: "摩根士丹利", WFC: "富国银行", HSBC: "汇丰(美股)", UBS: "瑞银", DB: "德意志银行", BCS: "巴克莱",
};
export const nm = (s: string, fallback?: string | null) => NAME[s] ?? fallback ?? s;

const FUT = new Set(["CL", "GC", "SI", "HG", "NG", "ZN", "ZT", "ES", "NQ", "YM", "RTY", "BRENT", "ZC", "ZS", "ZW", "EURUSD", "USDJPY", "USDCNH", "GBPUSD", "AUDUSD", "USDCHF", "USDCAD", "DXY", "BTC", "ETH"]);
export function marketOf(s: string) {
  if (/^(sh|sz|bj)\d{6}$/i.test(s)) return "CN";
  if (/\.HK$/i.test(s)) return "HK";
  if (FUT.has(s) || /=F$/.test(s)) return "FUT";
  if (/^\^/.test(s) || /^[A-Z]{1,5}(\.[A-Z])?$/.test(s)) return "US";
  return "INTL";
}
/** 各市场的市场因子（用于贝塔、归因） */
export const BENCH: Record<string, string> = { CN: "sh000300", HK: "2800.HK", US: "SPY", FUT: "SPY", INTL: "SPY" };
export const MKT_ZH: Record<string, string> = { CN: "A股", HK: "港股", US: "美股", FUT: "期货/外汇/加密", INTL: "其他市场" };

export type PRow = { symbol: string; label: string; market: string; ccy: string; qty: number | null; value: number; weight: number; changePct: number | null; dayPnl: number | null; unrealized: number | null; realized: number | null; fees: number | null; avgCost: number | null; last: number | null };
export type Port = { rows: PRow[]; total: number; sample: boolean; hasReal: boolean; mode: "real" | "sample"; setMode: (m: "real" | "sample") => void; loading: boolean; fxNote: string | null };

export function usePortfolio(): Port {
  const [mode, setMode] = useState<"real" | "sample">("real");
  const pos = usePositions();
  const real = (pos.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9 && r.marketValue != null);
  const hasReal = real.length > 0;
  const sample = !hasReal || mode === "sample";
  const ticks = useTicks([...(sample ? SAMPLE.map((x) => x[0]) : []), "USDCNH", "USDHKD"]);
  const usd = ticks.USDCNH?.price ?? null;
  const hkd = ticks.USDHKD?.price ?? null;
  const key = JSON.stringify(real.map((r) => [r.symbol, r.qty, r.marketValue, r.dayPnl]));
  const sKey = sample ? SAMPLE.map(([s]) => ticks[s]?.changePct ?? "").join(",") : "";
  return useMemo(() => {
    if (sample) {
      const rows: PRow[] = SAMPLE.map(([s, label, w]) => {
        const c = ticks[s]?.changePct ?? null;
        const value = NOTIONAL * w;
        return { symbol: s, label, market: marketOf(s), ccy: "CNY", qty: null, value, weight: w, changePct: c, dayPnl: c == null ? null : (value * c) / 100 / (1 + c / 100), unrealized: null, realized: null, fees: null, avgCost: null, last: ticks[s]?.price ?? null };
      });
      return { rows, total: NOTIONAL, sample: true, hasReal, mode, setMode, loading: false, fxNote: null };
    }
    // 港币按联系汇率区间中值 7.8 兜底（仅在美元/港币报价暂缺时）
    const fx = (ccy: string) => (ccy === "CNY" ? 1 : ccy === "HKD" ? (usd ? usd / (hkd ?? 7.8) : null) : usd);
    const missing = real.some((r) => r.ccy !== "CNY" && fx(r.ccy) == null);
    const conv = real.map((r) => {
      const k = fx(r.ccy) ?? 1;
      return { symbol: r.symbol, label: nm(r.symbol, r.name), market: r.market, ccy: r.ccy, qty: r.qty, value: (r.marketValue ?? 0) * k, weight: 0, changePct: r.changePct, dayPnl: r.dayPnl == null ? null : r.dayPnl * k, unrealized: r.unrealized == null ? null : r.unrealized * k, realized: r.realized * k, fees: r.fees * k, avgCost: r.avgCost, last: r.last };
    });
    const net = conv.reduce((a, r) => a + r.value, 0);
    const gross = conv.reduce((a, r) => a + Math.abs(r.value), 0);
    const total = net > 0 ? net : gross;
    conv.forEach((r) => { r.weight = total ? r.value / total : 0; });
    return { rows: conv.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)), total, sample: false, hasReal, mode, setMode, loading: pos.loading, fxNote: missing ? "汇率报价未就绪，外币持仓暂按 1:1 折算" : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample, key, sKey, usd, hkd, mode, pos.loading]);
}

export function PortBar({ p, extra }: { p: Port; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] bg-[#07111c] px-2 py-1 text-[10px]">
      <span className={p.sample ? "border border-amber-700/60 px-1 text-amber-300" : "border border-cyan-800 px-1 text-cyan-300"}>{p.sample ? "示例组合（真实行情计算）" : `我的持仓 · ${p.rows.length} 个标的`}</span>
      <span className="text-slate-500">{p.sample ? `名义本金 ${fmtCompact(NOTIONAL)} 元，权重固定；平台模拟账户暂无持仓时使用` : `持仓市值 ${fmtCompact(p.total)} 元（外币按实时汇率折人民币）`}</span>
      {p.fxNote && <span className="text-amber-300">{p.fxNote}</span>}
      <span className="ml-auto flex items-center gap-2">{extra}{p.hasReal && <Seg value={p.mode} options={[["real", "我的持仓"], ["sample", "示例组合"]]} onChange={p.setMode} />}</span>
    </div>
  );
}

/** 组合日收益序列（按当前权重回溯；简单收益） */
export function usePortSeries(p: Port, days = 760, extra: string[] = []) {
  const syms = useMemo(() => [...new Set([...p.rows.map((r) => r.symbol), ...extra])].slice(0, 60), [p.rows.map((r) => r.symbol).join(), extra.join()]);
  const pack = useCloses(syms, days);
  const wKey = p.rows.map((r) => `${r.symbol}:${r.weight.toFixed(5)}`).join();
  return useMemo(() => {
    const { dates, m } = align(pack.data ?? null, syms);
    const R: Record<string, number[]> = Object.fromEntries(syms.map((s) => [s, sret(m[s] ?? [])]));
    const n = Math.max(0, dates.length - 1);
    const port = Array.from({ length: n }, (_, i) => p.rows.reduce((a, r) => a + r.weight * (R[r.symbol]?.[i] ?? 0), 0));
    return { dates: dates.slice(1), m, R, port, raw: pack.data ?? null, loading: pack.loading, ok: n > 30 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, syms.join(), wKey]);
}

/* ------------------------------------------------------------ 统计工具 */
export const sret = (c: number[]) => c.slice(1).map((v, i) => v / c[i] - 1);
export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const sd = (a: number[]) => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export function quantile(a: number[], q: number) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function skewness(a: number[]) { const m = avg(a), s = sd(a); return s && a.length > 2 ? a.reduce((x, y) => x + ((y - m) / s) ** 3, 0) / a.length : 0; }
export function exKurt(a: number[]) { const m = avg(a), s = sd(a); return s && a.length > 3 ? a.reduce((x, y) => x + ((y - m) / s) ** 4, 0) / a.length - 3 : 0; }
/** 标准正态分位数（Acklam 近似） */
export function invNorm(p: number) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
/** Halton 低差异序列（准蒙特卡洛，确定性） */
export function halton(i: number, base: number) { let f = 1, r = 0, n = i; while (n > 0) { f /= base; r += f * (n % base); n = Math.floor(n / base); } return r; }
/** 普通最小二乘贝塔 */
export function beta(y: number[], x: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 20) return null;
  const xs = x.slice(-n), ys = y.slice(-n);
  const mx = avg(xs), my = avg(ys);
  let c = 0, v = 0;
  for (let i = 0; i < n; i++) { c += (xs[i] - mx) * (ys[i] - my); v += (xs[i] - mx) ** 2; }
  return v ? c / v : null;
}
/** 多元线性回归（含截距），返回系数与 R² */
export function ols(y: number[], X: number[][]) {
  const n = y.length, k = X.length + 1;
  if (n < k + 10) return null;
  const row = (i: number) => [1, ...X.map((x) => x[i])];
  const A: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) { const r = row(i); for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += r[a] * r[b]; A[a][k] += r[a] * y[i]; } }
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-14) return null;
    for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j]; }
  }
  const coef = A.map((r, i) => r[k] / r[i]);
  const my = avg(y);
  let ssr = 0, sst = 0;
  for (let i = 0; i < n; i++) { const f = row(i).reduce((s, v, j) => s + v * coef[j], 0); ssr += (y[i] - f) ** 2; sst += (y[i] - my) ** 2; }
  return { alpha: coef[0], betas: coef.slice(1), r2: sst ? 1 - ssr / sst : 0 };
}
export const pct = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);
export const money = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v < 0 ? "-" : ""}${fmtCompact(Math.abs(v))}`);
export const TH = "sticky top-0 bg-[#0a1726] text-[10px] text-slate-500";
export const TR = "border-t border-[#0f1b29]";
export const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);

/** 直方图（含竖向标记线），纯 SVG */
export function Histogram({ values, bins = 40, marks = [], height = 150, fmt = (v: number) => v.toFixed(2) }: { values: number[]; bins?: number; marks?: Array<{ v: number; color: string; label: string }>; height?: number; fmt?: (v: number) => string }) {
  if (values.length < 5) return <div className="px-2 py-6 text-[11px] text-slate-500">读取中…</div>;
  const lo = Math.min(...values, ...marks.map((m) => m.v)), hi = Math.max(...values, ...marks.map((m) => m.v));
  const w = (hi - lo) / bins || 1;
  const cnt = new Array(bins).fill(0);
  values.forEach((v) => { cnt[Math.min(bins - 1, Math.floor((v - lo) / w))]++; });
  const max = Math.max(...cnt);
  const W = 600, H = height, x = (v: number) => 30 + ((v - lo) / (hi - lo || 1)) * (W - 40);
  return (
    <div>
      <div className="flex flex-wrap gap-3 px-2 text-[10px]">{marks.map((m) => <span key={m.label} style={{ color: m.color }}>┃ {m.label} {fmt(m.v)}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {cnt.map((c, i) => { const v0 = lo + i * w; const h = (c / max) * (H - 24); return <rect key={i} x={x(v0) + 0.5} width={Math.max(0.5, x(v0 + w) - x(v0) - 1)} y={H - 16 - h} height={h} fill={v0 + w / 2 < 0 ? "#1fbf75" : "#f2495c"} opacity={0.75}><title>{`${fmt(v0)} ~ ${fmt(v0 + w)}：${c}`}</title></rect>; })}
        {marks.map((m) => <line key={m.label} x1={x(m.v)} x2={x(m.v)} y1={4} y2={H - 16} stroke={m.color} strokeWidth={1.4} strokeDasharray="4 2" />)}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={x(lo + (hi - lo) * f)} y={H - 3} fontSize={9} textAnchor="middle" fill="#5f7891">{fmt(lo + (hi - lo) * f)}</text>)}
      </svg>
    </div>
  );
}
