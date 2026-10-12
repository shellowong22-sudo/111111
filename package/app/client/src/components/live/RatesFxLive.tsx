/**
 * 利率 / 互换分组小窗（USSW / IRS / WIR / YCQSIM / FICM），全部接真实数据，分析角度互不重复：
 *  - USSW   互换市场：用 3 个月 SOFR 期货条逐日复利构建 SOFR 隐含互换（OIS）平价曲线、远期矩阵、互换利差代理
 *  - IRS    利率曲线相对价值监控：美债曲线快照、利差与蝶式的统计位置（Z 值 / 分位）、套息与滚降、实时收益率
 *  - WIR    全球利率期货：美债期货与短端利率期货各合约行情、展期进度与跨期价差、SOFR 期货年度组合、机构持仓结构
 *  - YCQSIM 收益率曲线情景模拟：真实日变动的主成分分解、历史自举情景扇形、历史极端情景重演、曲线形态切换
 *  - FICM   固定收益板块监控：债券 ETF 按板块的区间表现、经验久期与股票贝塔（双因子回归）、利率 / 信用收益归因
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, LiveBoard, useHub } from "@/uc/hubs/kit";
import { align, annVol, drawdown, f2, heat, mean, perf, rets, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, ROW, RangeBar, TD, TDL, TH, THL, pctRank, quantile, tenorVal, useCurves, yieldFn, type FutCurve, type UsCurve, type P } from "./LiveCommon";

/* ================================================================== 公用 */
export type MMData = {
  series: Record<string, Array<{ d: string; v: number; vol: number | null; p1: number | null; p99: number | null }>>;
  target: { from: number | null; to: number | null };
  path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>;
  sofrStrip: Array<{ month: string; rate: number; chg: number | null; volume: number | null }>;
};
export const useMM = () => usePolled<MMData>("ucHubs.moneyMarket", {}, 900_000);
export type CotRow = { name: string; symbol: string; date: string; oi: number; dealerNet: number; assetMgrNet: number; levNet: number; assetMgrNetChg: number; levNetChg: number; levLongPct: number };
const bp = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);
const pc = (v: number | null | undefined, d = 3) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);
const lastOf = <T,>(a: T[] | undefined) => (a && a.length ? a[a.length - 1] : undefined);
const COLORS = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb923c", "#94a3b8", "#22d3ee"];
const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";

/* ================================================================== USSW：SOFR 隐含互换曲线 */
const DAY = 86400_000;
/** IMM 日：合约月第三个星期三 */
function immDate(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return Date.UTC(y, m - 1, 1 + ((3 - first + 7) % 7) + 14);
}
const todayUtc = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };

export type Ois = { df: number[]; maxDays: number };
/** 以 SOFR 期货条（每份合约覆盖 IMM 起 3 个月）+ 最新隔夜 SOFR 逐日复利得到贴现因子 */
export function buildOis(strip: MMData["sofrStrip"], spot: number | null, prev: boolean): Ois | null {
  if (!strip.length || spot == null) return null;
  const t0 = todayUtc();
  const segs = strip.map((s) => ({ start: immDate(s.month), rate: prev ? s.rate - (s.chg ?? 0) : s.rate })).sort((a, b) => a.start - b.start);
  const maxDays = Math.round((segs[segs.length - 1].start + 91 * DAY - t0) / DAY);
  if (maxDays < 30) return null;
  const df = [1];
  let k = -1;
  for (let d = 0; d < maxDays; d++) {
    const t = t0 + d * DAY;
    while (k + 1 < segs.length && segs[k + 1].start <= t) k++;
    const f = k >= 0 ? segs[k].rate : spot;
    df.push(df[d] / (1 + f / 100 / 360));
  }
  return { df, maxDays };
}
/** 平价互换利率（固定端年付、实际/360；不足 1 年为单期） */
export function parRate(o: Ois | null, years: number) {
  if (!o) return null;
  const n = Math.round(years * 365);
  if (n > o.maxDays || n <= 0) return null;
  if (years <= 1) return ((1 / o.df[n] - 1) * 360 / n) * 100;
  const pays: number[] = [];
  for (let d = n; d > 0; d -= 365) pays.unshift(d);
  let ann = 0, prevD = 0;
  for (const d of pays) { ann += ((d - prevD) / 360) * o.df[d]; prevD = d; }
  return ((1 - o.df[n]) / ann) * 100;
}
function fwdRate(o: Ois | null, y1: number, y2: number) {
  if (!o) return null;
  const a = Math.round(y1 * 365), b = Math.round(y2 * 365);
  if (b > o.maxDays || b <= a) return null;
  return ((o.df[a] / o.df[b] - 1) * 360 / (b - a)) * 100;
}
const SW_TENORS: Array<[string, number]> = [["1M", 1 / 12], ["3M", 0.25], ["6M", 0.5], ["9M", 0.75], ["1Y", 1], ["18M", 1.5], ["2Y", 2], ["3Y", 3]];
const SW_NOTE = "互换利率无公开逐期报价：本页以 3 个月 SOFR 期货条（IMM 起息，未作凸性调整）与最新隔夜 SOFR 逐日复利推算 SOFR 隔夜指数互换平价利率（固定端年付、实际/360）；美债为固定期限收益率（半年复利）。互换利差 = 隐含互换 − 同期限美债，仅作代理。";

export function UsswLive({ onClose }: P) {
  const [tab, setTab] = useState("curve");
  const mm = useMM();
  const cv = useCurves();
  const strip = mm.data?.sofrStrip ?? [];
  const sofr = lastOf(mm.data?.series.SOFR);
  const now = useMemo(() => buildOis(strip, sofr?.v ?? null, false), [strip, sofr?.v]);
  const prev = useMemo(() => buildOis(strip, sofr?.v ?? null, true), [strip, sofr?.v]);
  const us0 = cv.data?.us[0], us1 = cv.data?.us[1];
  const ust = useMemo(() => (us0 ? yieldFn(us0.points) : null), [us0]);
  const ustPrev = useMemo(() => (us1 ? yieldFn(us1.points) : null), [us1]);
  const rows = SW_TENORS.map(([t, y]) => {
    const s = parRate(now, y), sp = parRate(prev, y);
    const u = ust ? ust(y) : null, up = ustPrev ? ustPrev(y) : null;
    const uPct = u != null ? u * 100 : null, upPct = up != null ? up * 100 : null;
    return { t, y, s, chg: s != null && sp != null ? (s - sp) * 100 : null, u: uPct, uChg: uPct != null && upPct != null ? (uPct - upPct) * 100 : null, spread: s != null && uPct != null ? (s - uPct) * 100 : null, vsSofr: s != null && sofr ? (s - sofr.v) * 100 : null };
  }).filter((r) => r.s != null);
  const r1 = rows.find((r) => r.t === "1Y"), r2 = rows.find((r) => r.t === "2Y");
  const covEnd = now ? new Date(todayUtc() + now.maxDays * DAY).toISOString().slice(0, 10) : null;
  const FWD_START: Array<[string, number]> = [["即期", 0], ["3M", 0.25], ["6M", 0.5], ["1Y", 1], ["18M", 1.5], ["2Y", 2]];
  const FWD_LEN: Array<[string, number]> = [["3M", 0.25], ["6M", 0.5], ["1Y", 1]];
  return (
    <PanelShell code="USSW" title="互换市场 · SOFR 隐含互换曲线" onClose={onClose} tabs={[["curve", "隐含互换曲线"], ["fwd", "远期利率矩阵"], ["strip", "SOFR 期货条"], ["spread", "互换利差"]]} tab={tab} setTab={setTab} right={covEnd ? <span>曲线覆盖至 {covEnd}</span> : null}>
      <Kpis items={[["隔夜 SOFR", pc(sofr?.v, 2), sofr ? `定盘日 ${sofr.d}` : undefined], ["1 年隐含互换", pc(r1?.s), r1 ? `日变动 ${bp(r1.chg)} bp` : undefined], ["2 年隐含互换", pc(r2?.s), r2 ? `日变动 ${bp(r2.chg)} bp` : undefined], ["2 年互换利差", r2?.spread == null ? "—" : <span style={{ color: toneOf(r2.spread) }}>{bp(r2.spread)} bp</span>, "隐含互换 − 2 年美债"]]} />
      {tab === "curve" && <>
        <SectionHead title="SOFR 隐含互换平价利率 vs 美债" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>期限</th><th className={TH}>隐含互换</th><th className={TH}>日变动 bp</th><th className={TH}>较隔夜 SOFR bp</th><th className={TH}>美债收益率</th><th className={TH}>美债日变动 bp</th><th className={TH}>互换 − 美债 bp</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.t} className={ROW}><td className={`${TDL} text-slate-100`}>{r.t}</td><td className={`${TD} text-white`}>{pc(r.s)}</td><td className={TD} style={{ color: toneOf(r.chg) }}>{bp(r.chg)}</td><td className={TD} style={{ color: toneOf(r.vsSofr) }}>{bp(r.vsSofr)}</td><td className={`${TD} text-slate-300`}>{pc(r.u)}</td><td className={TD} style={{ color: toneOf(r.uChg) }}>{bp(r.uChg)}</td><td className={TD} style={{ background: heat(r.spread, 40) }}>{bp(r.spread)}</td></tr>)}
            {!rows.length && <tr><td colSpan={7}><Empty loading={mm.loading} /></td></tr>}
          </tbody>
        </table>
        <SectionHead title="曲线形态：隐含互换（今日 / 前一交易日）与美债" />
        {rows.length > 1 ? <Lines series={[{ name: "隐含互换", color: "#fbbf24", values: rows.map((r) => r.s) }, { name: "前一交易日", color: "#94a3b8", dash: true, values: rows.map((r) => (r.s != null && r.chg != null ? r.s - r.chg / 100 : null)) }, { name: "美债", color: "#38bdf8", values: rows.map((r) => r.u) }]} xLabels={rows.map((r) => r.t)} height={170} fmt={(v) => v.toFixed(2)} /> : <Empty loading={mm.loading} />}
        <Note>{SW_NOTE}</Note>
      </>}
      {tab === "fwd" && <>
        <SectionHead title="远期利率矩阵（起息 × 期限，%，括号内为日变动 bp）" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>起息</th>{FWD_LEN.map(([l]) => <th key={l} className={TH}>{l} 期</th>)}</tr></thead>
          <tbody>{FWD_START.map(([sl, s]) => <tr key={sl} className={ROW}><td className={`${TDL} text-slate-100`}>{sl}</td>{FWD_LEN.map(([l, len]) => { const f = fwdRate(now, s, s + len), fp = fwdRate(prev, s, s + len); const ch = f != null && fp != null ? (f - fp) * 100 : null; return <td key={l} className={TD} style={{ background: heat(f != null && sofr ? (f - sofr.v) * 100 : null, 120) }}><span className="text-white">{pc(f)}</span> <span className="text-[10px]" style={{ color: toneOf(ch) }}>({bp(ch)})</span></td>; })}</tr>)}</tbody>
        </table>
        <SectionHead title="3 个月远期利率路径（每季度起息）" />
        {now ? <Lines series={[{ name: "3 个月远期", color: "#fbbf24", values: Array.from({ length: Math.floor(now.maxDays / 91) }, (_, i) => fwdRate(now, i * 0.25, i * 0.25 + 0.25)) }, { name: "隔夜 SOFR", color: "#38bdf8", dash: true, values: Array.from({ length: Math.floor(now.maxDays / 91) }, () => sofr?.v ?? null) }]} xLabels={Array.from({ length: Math.floor(now.maxDays / 91) }, (_, i) => `${i * 3}M`)} height={160} fmt={(v) => v.toFixed(2)} /> : <Empty loading={mm.loading} />}
        <Note>色深表示远期利率相对当前隔夜 SOFR 的偏离（红高绿低）。远期低于隔夜 = 市场计入降息。</Note>
      </>}
      {tab === "strip" && <>
        <SectionHead title="3 个月 SOFR 期货条" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>合约月</th><th className={THL}>IMM 起息</th><th className={TH}>隐含利率</th><th className={TH}>日变动 bp</th><th className={TH}>季度步长 bp</th><th className={TH}>较隔夜 bp</th><th className={TH}>成交量</th></tr></thead>
          <tbody>
            {strip.map((s, i) => <tr key={s.month} className={ROW}><td className={`${TDL} font-mono text-slate-100`}>{s.month}</td><td className={`${TDL} font-mono text-[10px] text-slate-400`}>{new Date(immDate(s.month)).toISOString().slice(0, 10)}</td><td className={`${TD} text-white`}>{pc(s.rate)}</td><td className={TD} style={{ color: toneOf(s.chg != null ? s.chg * 100 : null) }}>{bp(s.chg != null ? s.chg * 100 : null)}</td><td className={TD} style={{ color: toneOf(i ? (s.rate - strip[i - 1].rate) * 100 : null) }}>{i ? bp((s.rate - strip[i - 1].rate) * 100) : "—"}</td><td className={TD} style={{ background: heat(sofr ? (s.rate - sofr.v) * 100 : null, 120) }}>{sofr ? bp((s.rate - sofr.v) * 100) : "—"}</td><td className={`${TD} text-slate-400`}>{s.volume != null ? s.volume.toLocaleString() : "—"}</td></tr>)}
            {!strip.length && <tr><td colSpan={7}><Empty loading={mm.loading} /></td></tr>}
          </tbody>
        </table>
        {strip.length > 1 && <Lines series={[{ name: "今日", color: "#fbbf24", values: strip.map((s) => s.rate) }, { name: "前一交易日", color: "#94a3b8", dash: true, values: strip.map((s) => s.rate - (s.chg ?? 0)) }]} xLabels={strip.map((s) => s.month.slice(2))} height={150} fmt={(v) => v.toFixed(2)} />}
      </>}
      {tab === "spread" && <>
        <SectionHead title="互换利差（bp）" />
        {rows.length ? <Bars data={rows.map((r) => ({ k: r.t, v: r.spread ?? 0 }))} fmt={(v) => `${v.toFixed(1)} bp`} height={150} /> : <Empty loading={mm.loading || cv.loading} />}
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>期限</th><th className={TH}>利差 bp</th><th className={TH}>利差日变动 bp</th><th className={TH}>互换贡献 bp</th><th className={TH}>美债贡献 bp</th></tr></thead>
          <tbody>{rows.map((r) => { const d = r.chg != null && r.uChg != null ? r.chg - r.uChg : null; return <tr key={r.t} className={ROW}><td className={`${TDL} text-slate-100`}>{r.t}</td><td className={`${TD} text-white`}>{bp(r.spread)}</td><td className={TD} style={{ color: toneOf(d) }}>{bp(d)}</td><td className={TD} style={{ color: toneOf(r.chg) }}>{bp(r.chg)}</td><td className={TD} style={{ color: toneOf(r.uChg != null ? -r.uChg : null) }}>{bp(r.uChg != null ? -r.uChg : null)}</td></tr>; })}</tbody>
        </table>
        <Note>{SW_NOTE}</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== IRS：曲线相对价值监控 */
const vbp = (c: UsCurve, t: string) => { const v = tenorVal(c, t); return v == null ? null : v * 100; };
const RV_DEFS: Array<{ k: string; n: string; kind: string; f: (c: UsCurve) => number | null }> = [
  { k: "2s10s", n: "2 年 − 10 年利差", kind: "利差", f: (c) => { const a = vbp(c, "10Y"), b = vbp(c, "2Y"); return a != null && b != null ? a - b : null; } },
  { k: "3m10y", n: "3 个月 − 10 年利差", kind: "利差", f: (c) => { const a = vbp(c, "10Y"), b = vbp(c, "3M"); return a != null && b != null ? a - b : null; } },
  { k: "2s5s", n: "2 年 − 5 年利差", kind: "利差", f: (c) => { const a = vbp(c, "5Y"), b = vbp(c, "2Y"); return a != null && b != null ? a - b : null; } },
  { k: "5s30s", n: "5 年 − 30 年利差", kind: "利差", f: (c) => { const a = vbp(c, "30Y"), b = vbp(c, "5Y"); return a != null && b != null ? a - b : null; } },
  { k: "10s30s", n: "10 年 − 30 年利差", kind: "利差", f: (c) => { const a = vbp(c, "30Y"), b = vbp(c, "10Y"); return a != null && b != null ? a - b : null; } },
  { k: "1s2s", n: "1 年 − 2 年利差", kind: "利差", f: (c) => { const a = vbp(c, "2Y"), b = vbp(c, "1Y"); return a != null && b != null ? a - b : null; } },
  { k: "f2510", n: "2s5s10s 蝶式", kind: "蝶式", f: (c) => { const a = vbp(c, "2Y"), b = vbp(c, "5Y"), d = vbp(c, "10Y"); return a != null && b != null && d != null ? 2 * b - a - d : null; } },
  { k: "f51030", n: "5s10s30s 蝶式", kind: "蝶式", f: (c) => { const a = vbp(c, "5Y"), b = vbp(c, "10Y"), d = vbp(c, "30Y"); return a != null && b != null && d != null ? 2 * b - a - d : null; } },
  { k: "f1210", n: "1s2s10s 蝶式", kind: "蝶式", f: (c) => { const a = vbp(c, "1Y"), b = vbp(c, "2Y"), d = vbp(c, "10Y"); return a != null && b != null && d != null ? 2 * b - a - d : null; } },
];
const SNAP_T = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
/** 平价债券修正久期（半年付） */
const modDur = (y: number, T: number) => { const r = y / 2; if (r <= 0) return T; return (1 - Math.pow(1 + r, -2 * T)) / y; };

export function IrsLive({ onClose }: P) {
  const [tab, setTab] = useState("rv");
  const [sel, setSel] = useState("2s10s");
  const cv = useCurves();
  const mm = useMM();
  const ticks = useTicks(["^IRX", "^FVX", "^TNX", "^TYX"]);
  const us = cv.data?.us ?? [];
  const asc = useMemo(() => [...us].reverse(), [us]);
  const stats = useMemo(() => RV_DEFS.map((d) => {
    const s = asc.map((c) => d.f(c));
    const v = s.filter((x): x is number => x != null);
    const cur = lastOf(v) ?? null;
    const m = mean(v), sd = std(v);
    const at = (k: number) => (v.length > k ? v[v.length - 1 - k] : null);
    return { ...d, series: s, cur, c5: cur != null && at(5) != null ? cur - at(5)! : null, c21: cur != null && at(21) != null ? cur - at(21)! : null, z: cur != null && sd ? (cur - m) / sd : null, pct: cur != null ? pctRank(v, cur) : null, lo: v.length ? Math.min(...v) : null, hi: v.length ? Math.max(...v) : null, mean: v.length ? m : null };
  }), [asc]);
  const selected = stats.find((s) => s.k === sel) ?? stats[0];
  const sofr = lastOf(mm.data?.series.SOFR)?.v ?? null;
  const c0 = us[0];
  const yf = useMemo(() => (c0 ? yieldFn(c0.points) : null), [c0]);
  const carry = [1, 2, 3, 5, 7, 10, 20, 30].map((T) => {
    const y = yf ? yf(T) : null;
    const yr = yf ? yf(T - 0.25) : null;
    if (y == null || yr == null || sofr == null) return { T, y: null as number | null, D: null as number | null, carry: null as number | null, roll: null as number | null, be: null as number | null };
    const D = modDur(y, T);
    const carryBp = (y * 100 - sofr) * 100 * 0.25;
    const rollY = (y - yr) * 10000;
    const rollBp = rollY * D;
    return { T, y: y * 100, D, carry: carryBp, roll: rollBp, be: (carryBp + rollBp) / D };
  });
  const ago = (k: number) => us[Math.min(us.length - 1, k)];
  const snapCols: Array<[string, UsCurve | undefined]> = [["今日", us[0]], ["1 周前", ago(5)], ["1 月前", ago(21)], ["3 月前", ago(63)], ["1 年前", ago(250)]];
  const tnx = ticks["^TNX"]?.price, fvx = ticks["^FVX"]?.price, tyx = ticks["^TYX"]?.price, irx = ticks["^IRX"]?.price;
  return (
    <PanelShell code="IRS" title="利率曲线相对价值监控" onClose={onClose} tabs={[["rv", "利差与蝶式"], ["snap", "曲线快照"], ["carry", "套息与滚降"], ["live", "实时收益率"]]} tab={tab} setTab={setTab} right={c0 ? <span>收盘曲线 {c0.date}</span> : null}>
      <Kpis items={[["2s10s", stats[0]?.cur == null ? "—" : `${bp(stats[0].cur, 0)} bp`, stats[0]?.z != null ? `一年 Z 值 ${stats[0].z.toFixed(2)}` : undefined], ["5s10s30s 蝶式", stats[7]?.cur == null ? "—" : `${bp(stats[7].cur, 0)} bp`, stats[7]?.pct != null ? `一年分位 ${stats[7].pct.toFixed(0)}%` : undefined], ["实时 5s30s", fvx != null && tyx != null ? `${bp((tyx - fvx) * 100, 1)} bp` : "—", "盘中 5 年 / 30 年收益率"], ["实时 3m10y", irx != null && tnx != null ? `${bp((tnx - irx) * 100, 1)} bp` : "—", "13 周贴现率"]]} />
      {tab === "rv" && <>
        <SectionHead title="利差 / 蝶式统计位置（近一年日度）" sub="正值腹部便宜。点行查看走势" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>组合</th><th className={THL}>类型</th><th className={TH}>当前 bp</th><th className={TH}>1 周</th><th className={TH}>1 月</th><th className={TH}>均值</th><th className={TH}>Z 值</th><th className={TH}>分位</th><th className="px-2">一年区间</th><th className="px-2">走势</th></tr></thead>
          <tbody>{stats.map((s) => <tr key={s.k} onClick={() => setSel(s.k)} className={`cursor-pointer ${ROW} ${sel === s.k ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{s.n}</td><td className={`${TDL} text-slate-500`}>{s.kind}</td><td className={`${TD} text-white`}>{bp(s.cur, 1)}</td><td className={TD} style={{ color: toneOf(s.c5) }}>{bp(s.c5, 1)}</td><td className={TD} style={{ color: toneOf(s.c21) }}>{bp(s.c21, 1)}</td><td className={`${TD} text-slate-400`}>{f2(s.mean, 1)}</td><td className={TD} style={{ background: heat(s.z, 2.5) }}>{f2(s.z, 2)}</td><td className={TD}>{f2(s.pct, 0, "%")}</td><td className="px-2"><RangeBar lo={s.lo} hi={s.hi} v={s.cur} /></td><td className="px-2"><MiniLine values={s.series.slice(-120)} /></td></tr>)}
            {!stats.some((s) => s.cur != null) && <tr><td colSpan={10}><Empty loading={cv.loading} /></td></tr>}</tbody>
        </table>
        {selected && <><SectionHead title={`${selected.n} 一年走势（bp）`} sub={selected.z != null ? `Z 值 ${selected.z.toFixed(2)}：${Math.abs(selected.z) > 2 ? "处于统计极端，均值回归信号较强" : Math.abs(selected.z) > 1 ? "偏离均值" : "接近均值"}` : undefined} />
          <Lines series={[{ name: selected.n, color: "#fbbf24", values: selected.series }, { name: "均值", color: "#64748b", dash: true, values: selected.series.map(() => selected.mean) }]} xLabels={asc.map((c) => c.date.slice(2))} height={170} fmt={(v) => v.toFixed(0)} zero /></>}
      </>}
      {tab === "snap" && <>
        <SectionHead title="美债收益率曲线快照（%）与变动（bp）" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>期限</th>{snapCols.map(([l, c]) => <th key={l} className={TH}>{l}<div className="font-mono text-[9px] text-slate-600">{c?.date.slice(5) ?? ""}</div></th>)}<th className={TH}>1 周 Δ</th><th className={TH}>1 月 Δ</th><th className={TH}>3 月 Δ</th><th className={TH}>1 年 Δ</th></tr></thead>
          <tbody>{SNAP_T.map((t) => { const v = snapCols.map(([, c]) => tenorVal(c, t)); const d = (i: number) => (v[0] != null && v[i] != null ? (v[0]! - v[i]!) * 100 : null); return <tr key={t} className={ROW}><td className={`${TDL} text-slate-100`}>{t}</td>{v.map((x, i) => <td key={i} className={`${TD} ${i ? "text-slate-400" : "text-white"}`}>{f2(x, 2)}</td>)}{[1, 2, 3, 4].map((i) => <td key={i} className={TD} style={{ background: heat(d(i), 60) }}>{bp(d(i), 0)}</td>)}</tr>; })}</tbody>
        </table>
        {us.length > 1 && <Lines series={snapCols.map(([l, c], i) => ({ name: l, color: COLORS[i], dash: i > 0, values: SNAP_T.map((t) => tenorVal(c, t)) }))} xLabels={SNAP_T} height={180} fmt={(v) => v.toFixed(2)} />}
      </>}
      {tab === "carry" && <>
        <SectionHead title="3 个月持有期套息与滚降（以隔夜 SOFR 融资）" sub={sofr != null ? `融资利率 ${sofr.toFixed(2)}%；滚降假设曲线形状不变` : undefined} />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>期限</th><th className={TH}>收益率</th><th className={TH}>修正久期</th><th className={TH}>套息 bp（价格）</th><th className={TH}>滚降 bp（价格）</th><th className={TH}>合计 bp</th><th className={TH}>盈亏平衡上行 bp</th></tr></thead>
          <tbody>{carry.map((r) => <tr key={r.T} className={ROW}><td className={`${TDL} text-slate-100`}>{r.T}Y</td><td className={`${TD} text-white`}>{pc(r.y, 2)}</td><td className={`${TD} text-slate-400`}>{f2(r.D, 2)}</td><td className={TD} style={{ color: toneOf(r.carry) }}>{bp(r.carry)}</td><td className={TD} style={{ color: toneOf(r.roll) }}>{bp(r.roll)}</td><td className={TD} style={{ color: toneOf(r.carry != null && r.roll != null ? r.carry + r.roll : null) }}>{r.carry != null && r.roll != null ? bp(r.carry + r.roll) : "—"}</td><td className={TD} style={{ background: heat(r.be, 15) }}>{bp(r.be, 2)}</td></tr>)}</tbody>
        </table>
        <Bars data={carry.map((r) => ({ k: `${r.T}Y`, v: r.be ?? 0 }))} fmt={(v) => `${v.toFixed(2)} bp`} height={130} />
        <Note>盈亏平衡上行 = (套息 + 滚降) / 修正久期：持有 3 个月内收益率上行少于该值仍不亏。倒挂曲线下短端融资成本高于收益，套息为负。</Note>
      </>}
      {tab === "live" && <>
        <LiveBoard rows={[["^IRX", "13 周美债贴现率"], ["^FVX", "5 年美债收益率"], ["^TNX", "10 年美债收益率"], ["^TYX", "30 年美债收益率"], ["^MOVE", "美债期权波动率"], ["ZT", "2 年美债期货"], ["ZN", "10 年美债期货"]].map(([s, l], i) => ({ symbol: s, label: l, group: i < 5 ? "现券收益率" : "国债期货" }))} />
        <Note>实时收益率单位为 %；点行在右侧查看 K 线。日内曲线利差见顶部指标。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== WIR：全球利率期货 */
const WIR_ROOTS = ["ZT", "ZF", "ZN", "ZB", "UB", "SR3", "ZQ"];
const STIR = new Set(["SR3", "ZQ"]);
const f32 = (p: number | null | undefined) => { if (p == null || !Number.isFinite(p)) return "—"; const i = Math.floor(p); const t = (p - i) * 32; return `${i}-${t.toFixed(1).padStart(4, "0")}`; };
const COT_RATES = ["ZT", "ZF", "ZN", "TN", "ZB", "SR3", "ZQ"];

export function WirLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const [root, setRoot] = useState("ZN");
  const fm = usePolled<FutCurve[]>("ucHubs.futuresMany", { roots: WIR_ROOTS }, 120_000);
  const cot = usePolled<CotRow[]>("ucHubs.cot", {}, 3600_000);
  const curves = (fm.data ?? []).filter(Boolean);
  const byRoot = (r: string) => curves.find((c) => c.root === r);
  const cur = byRoot(root);
  const sr3 = byRoot("SR3");
  const pack = (i0: number) => { const pts = sr3?.points.slice(i0, i0 + 4) ?? []; if (pts.length < 4) return null; const r = mean(pts.map((p) => 100 - p.price)); const c = mean(pts.map((p) => (p.change != null ? -p.change * 100 : 0))); return { r, c, from: pts[0].month, to: pts[3].month }; };
  const packs: Array<[string, ReturnType<typeof pack>]> = [["白色（第 1 年）", pack(0)], ["红色（第 2 年）", pack(4)], ["绿色（第 3 年）", pack(8)]];
  const rollOf = (c?: FutCurve) => { const a = c?.points[0], b = c?.points[1]; const va = a?.volume ?? 0, vb = b?.volume ?? 0; return a && b && va + vb > 0 ? { pct: (vb / (va + vb)) * 100, spread: a.price - b.price, a, b } : null; };
  const zn = byRoot("ZN");
  const znRoll = rollOf(zn);
  const cotRows = (cot.data ?? []).filter((r) => COT_RATES.includes(r.symbol)).sort((a, b) => COT_RATES.indexOf(a.symbol) - COT_RATES.indexOf(b.symbol));
  const znCot = cotRows.find((r) => r.symbol === "ZN");
  return (
    <PanelShell code="WIR" title="全球利率期货" onClose={onClose} tabs={[["board", "合约行情"], ["roll", "展期与跨期价差"], ["stir", "短端利率组合"], ["cot", "持仓结构"], ["live", "实时盘面"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["10 年美债期货主力", zn?.points[0] ? f32(zn.points[0].price) : "—", zn?.points[0] ? `${zn.points[0].code} ${sgn(zn.points[0].changePct)}` : undefined], ["10 年期货展期进度", znRoll ? `${znRoll.pct.toFixed(0)}%` : "—", "次月成交占比"], ["SOFR 白色组合利率", packs[0][1] ? pc(packs[0][1].r) : "—", packs[0][1] ? `日变动 ${bp(packs[0][1].c)} bp` : undefined], ["10 年期货杠杆基金净头寸", znCot ? znCot.levNet.toLocaleString() : "—", znCot ? `周变动 ${znCot.levNetChg > 0 ? "+" : ""}${znCot.levNetChg.toLocaleString()}` : undefined]]} />
      {tab === "board" && <>
        <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><Seg value={root} onChange={setRoot} options={WIR_ROOTS.map((r) => [r, byRoot(r)?.name ?? r] as [string, string])} /></div>
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>合约</th><th className={THL}>合约月</th><th className={TH}>价格</th>{!STIR.has(root) && <th className={TH}>32 进制</th>}{STIR.has(root) && <th className={TH}>隐含利率</th>}<th className={TH}>涨跌</th><th className={TH}>涨跌幅</th><th className={TH}>成交量</th><th className={TH}>成交占比</th></tr></thead>
          <tbody>
            {(cur?.points ?? []).map((p) => { const tot = (cur?.points ?? []).reduce((s, x) => s + (x.volume ?? 0), 0); return <tr key={p.code} className={ROW}><td className={`${TDL} font-mono text-slate-100`}>{p.code}</td><td className={`${TDL} font-mono text-slate-400`}>{p.month}</td><td className={`${TD} text-white`}>{fmtPrice(p.price, STIR.has(root) ? 3 : 4)}</td>{!STIR.has(root) && <td className={`${TD} text-slate-300`}>{f32(p.price)}</td>}{STIR.has(root) && <td className={`${TD} text-amber-200`}>{pc(100 - p.price)}</td>}<td className={TD} style={{ color: toneOf(p.change) }}>{p.change == null ? "—" : `${p.change > 0 ? "+" : ""}${p.change.toFixed(STIR.has(root) ? 3 : 4)}`}</td><td className={TD} style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td><td className={`${TD} text-slate-300`}>{p.volume?.toLocaleString() ?? "—"}</td><td className={TD}>{tot ? `${(((p.volume ?? 0) / tot) * 100).toFixed(1)}%` : "—"}</td></tr>; })}
            {!cur?.points.length && <tr><td colSpan={8}><Empty loading={fm.loading} /></td></tr>}
          </tbody>
        </table>
        {cur && cur.points.length > 1 && <Lines series={[{ name: STIR.has(root) ? "隐含利率 %" : "价格", color: "#fbbf24", values: cur.points.map((p) => (STIR.has(root) ? 100 - p.price : p.price)) }]} xLabels={cur.points.map((p) => p.month.slice(2))} height={140} fmt={(v) => v.toFixed(3)} />}
      </>}
      {tab === "roll" && <>
        <SectionHead title="国债期货展期价差" sub="价差以 32 进制显示" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>品种</th><th className={THL}>主力</th><th className={THL}>次月</th><th className={TH}>跨期价差</th><th className={TH}>价差（/32）</th><th className={TH}>主力成交</th><th className={TH}>次月成交</th><th className={TH}>展期进度</th></tr></thead>
          <tbody>{["ZT", "ZF", "ZN", "ZB", "UB"].map((r) => { const c = byRoot(r); const ro = rollOf(c); return <tr key={r} className={ROW}><td className={`${TDL} text-slate-100`}>{c?.name ?? r}</td><td className={`${TDL} font-mono text-slate-300`}>{c?.points[0]?.code ?? "—"}</td><td className={`${TDL} font-mono text-slate-400`}>{c?.points[1]?.code ?? "—"}</td><td className={`${TD} text-white`}>{ro ? ro.spread.toFixed(4) : "—"}</td><td className={TD}>{ro ? `${(ro.spread * 32).toFixed(2)}` : "—"}</td><td className={`${TD} text-slate-400`}>{ro?.a.volume?.toLocaleString() ?? "—"}</td><td className={`${TD} text-slate-400`}>{ro?.b.volume?.toLocaleString() ?? "—"}</td><td className={TD} style={{ background: heat(ro ? ro.pct - 50 : null, 50) }}>{ro ? `${ro.pct.toFixed(1)}%` : "—"}</td></tr>; })}</tbody>
        </table>
        <SectionHead title="联邦基金期货逐月隐含利率与月度变动" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>合约</th><th className={THL}>月份</th><th className={TH}>隐含利率</th><th className={TH}>较上月 bp</th><th className={TH}>日变动 bp</th><th className={TH}>成交量</th></tr></thead>
          <tbody>{(byRoot("ZQ")?.points ?? []).map((p, i, a) => <tr key={p.code} className={ROW}><td className={`${TDL} font-mono text-slate-100`}>{p.code}</td><td className={`${TDL} font-mono text-slate-400`}>{p.month}</td><td className={`${TD} text-white`}>{pc(100 - p.price)}</td><td className={TD} style={{ color: toneOf(i ? (a[i - 1].price - p.price) * 100 : null) }}>{i ? bp((a[i - 1].price - p.price) * 100) : "—"}</td><td className={TD} style={{ color: toneOf(p.change != null ? -p.change * 100 : null) }}>{bp(p.change != null ? -p.change * 100 : null)}</td><td className={`${TD} text-slate-400`}>{p.volume?.toLocaleString() ?? "—"}</td></tr>)}</tbody>
        </table>
      </>}
      {tab === "stir" && <>
        <SectionHead title="SOFR 期货年度组合（4 个季度合约平均隐含利率）" />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>组合</th><th className={THL}>覆盖合约月</th><th className={TH}>平均隐含利率</th><th className={TH}>日变动 bp</th></tr></thead>
          <tbody>{packs.map(([l, p]) => <tr key={l} className={ROW}><td className={`${TDL} text-slate-100`}>{l}</td><td className={`${TDL} font-mono text-slate-400`}>{p ? `${p.from} ~ ${p.to}` : "—"}</td><td className={`${TD} text-white`}>{pc(p?.r)}</td><td className={TD} style={{ color: toneOf(p?.c) }}>{bp(p?.c)}</td></tr>)}</tbody>
        </table>
        <SectionHead title="相邻季度跨期价差（bp）" />
        {sr3 && sr3.points.length > 1 ? <Bars data={sr3.points.slice(1).map((p, i) => ({ k: p.month.slice(2), v: ((sr3.points[i].price - p.price) * 100) }))} fmt={(v) => `${v.toFixed(1)} bp`} height={140} /> : <Empty loading={fm.loading} />}
        <SectionHead title="组合间价差" />
        <Kpis items={[["白 − 红", packs[0][1] && packs[1][1] ? `${bp((packs[1][1].r - packs[0][1].r) * 100)} bp` : "—", "第 2 年相对第 1 年"], ["红 − 绿", packs[1][1] && packs[2][1] ? `${bp((packs[2][1].r - packs[1][1].r) * 100)} bp` : "—", "第 3 年相对第 2 年"], ["白色日变动", packs[0][1] ? `${bp(packs[0][1].c)} bp` : "—"], ["红色日变动", packs[1][1] ? `${bp(packs[1][1].c)} bp` : "—"]]} />
      </>}
      {tab === "cot" && <>
        <SectionHead title="利率期货持仓结构（周度）" sub={cotRows[0] ? `报告日 ${cotRows[0].date}；单位：手` : undefined} />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>品种</th><th className={TH}>未平仓</th><th className={TH}>交易商净</th><th className={TH}>资管净</th><th className={TH}>资管周变</th><th className={TH}>杠杆基金净</th><th className={TH}>杠杆周变</th><th className={TH}>杠杆多头占比</th><th className={TH}>杠杆净 / 未平仓</th></tr></thead>
          <tbody>
            {cotRows.map((r) => <tr key={r.symbol} className={ROW}><td className={`${TDL} text-slate-100`}>{r.name}</td><td className={`${TD} text-slate-300`}>{r.oi.toLocaleString()}</td><td className={TD} style={{ color: toneOf(r.dealerNet) }}>{r.dealerNet.toLocaleString()}</td><td className={TD} style={{ color: toneOf(r.assetMgrNet) }}>{r.assetMgrNet.toLocaleString()}</td><td className={TD} style={{ color: toneOf(r.assetMgrNetChg) }}>{r.assetMgrNetChg.toLocaleString()}</td><td className={TD} style={{ color: toneOf(r.levNet) }}>{r.levNet.toLocaleString()}</td><td className={TD} style={{ color: toneOf(r.levNetChg) }}>{r.levNetChg.toLocaleString()}</td><td className={TD}>{r.levLongPct.toFixed(1)}%</td><td className={TD} style={{ background: heat(r.oi ? (r.levNet / r.oi) * 100 : null, 30) }}>{r.oi ? `${((r.levNet / r.oi) * 100).toFixed(1)}%` : "—"}</td></tr>)}
            {!cotRows.length && <tr><td colSpan={9}><Empty loading={cot.loading} /></td></tr>}
          </tbody>
        </table>
        {cotRows.length > 0 && <Bars data={cotRows.map((r) => ({ k: r.name, v: r.assetMgrNet / 1000, v2: r.levNet / 1000 }))} label={["资管净（千手）", "杠杆基金净（千手）"]} fmt={(v) => v.toFixed(0)} height={140} />}
        <Note>资管多头 / 杠杆基金空头的镜像结构通常对应现券—期货基差交易；杠杆基金空头急剧变化时留意基差平仓风险。</Note>
      </>}
      {tab === "live" && <LiveBoard rows={[["ZT", "2 年美债期货"], ["ZF=F", "5 年美债期货"], ["ZN", "10 年美债期货"], ["ZB=F", "30 年美债期货"], ["UB=F", "超长美债期货"], ["ZQ=F", "30 天联邦基金期货"], ["SR3=F", "3 个月 SOFR 期货"]].map(([s, l]) => ({ symbol: s, label: l, group: "利率期货主力" }))} />}
    </PanelShell>
  );
}

/* ================================================================== YCQSIM：收益率曲线情景模拟 */
const YC_T = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
/** 对称矩阵 Jacobi 特征分解 */
function jacobi(A: number[][]) {
  const n = A.length;
  const a = A.map((r) => [...r]);
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 80; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const kp = a[k][p], kq = a[k][q]; a[k][p] = c * kp - s * kq; a[k][q] = s * kp + c * kq; }
      for (let k = 0; k < n; k++) { const pk = a[p][k], qk = a[q][k]; a[p][k] = c * pk - s * qk; a[q][k] = s * pk + c * qk; }
      for (let k = 0; k < n; k++) { const kp = v[k][p], kq = v[k][q]; v[k][p] = c * kp - s * kq; v[k][q] = s * kp + c * kq; }
    }
  }
  const out = a.map((r, i) => ({ val: r[i], vec: v.map((row) => row[i]) })).sort((x, y) => y.val - x.val);
  return out;
}
const REGIME: Record<string, [string, string]> = { bs: ["牛陡", "#1fbf75"], bf: ["牛平", "#34d399"], es: ["熊陡", "#f2495c"], ef: ["熊平", "#fb923c"] };

export function YcqLive({ onClose }: P) {
  const [tab, setTab] = useState("pca");
  const [h, setH] = useState("21");
  const [pick, setPick] = useState(0);
  const cv = useCurves();
  const model = useMemo(() => {
    const us = [...(cv.data?.us ?? [])].reverse();
    const rows = us.map((c) => ({ date: c.date, v: YC_T.map((t) => tenorVal(c, t)) })).filter((r) => r.v.every((x) => x != null)) as Array<{ date: string; v: number[] }>;
    if (rows.length < 40) return null;
    const dates = rows.map((r) => r.date);
    const lv = rows.map((r) => r.v);
    const dch = lv.slice(1).map((r, i) => r.map((x, j) => (x - lv[i][j]) * 100));
    const n = YC_T.length;
    const mu = Array.from({ length: n }, (_, j) => mean(dch.map((r) => r[j])));
    const cov = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => dch.reduce((s, r) => s + (r[i] - mu[i]) * (r[j] - mu[j]), 0) / (dch.length - 1)));
    const eig = jacobi(cov).slice(0, 3);
    const total = cov.reduce((s, r, i) => s + r[i], 0);
    // 符号约定：水平因子载荷之和为正；斜率因子长端为正；曲率因子腹部为正
    const fixed = eig.map((e, k) => {
      let sgnv = 1;
      if (k === 0) sgnv = e.vec.reduce((s, x) => s + x, 0) >= 0 ? 1 : -1;
      if (k === 1) sgnv = e.vec[n - 1] - e.vec[0] >= 0 ? 1 : -1;
      if (k === 2) sgnv = e.vec[6] - (e.vec[0] + e.vec[n - 1]) / 2 >= 0 ? 1 : -1;
      return { val: e.val, vec: e.vec.map((x) => x * sgnv), share: (e.val / total) * 100 };
    });
    const scores = fixed.map((e) => { let acc = 0; return [0, ...dch.map((r) => (acc += r.reduce((s, x, j) => s + x * e.vec[j], 0)))]; });
    const vol = Array.from({ length: n }, (_, j) => std(dch.map((r) => r[j])));
    return { dates, lv, dch, fixed, scores, vol, total };
  }, [cv.data]);
  const H = Number(h);
  const fan = useMemo(() => {
    if (!model || model.lv.length <= H + 5) return null;
    const cur = model.lv[model.lv.length - 1];
    const q = [0.05, 0.25, 0.5, 0.75, 0.95];
    const out = YC_T.map((_, j) => { const ch: number[] = []; for (let i = H; i < model.lv.length; i++) ch.push(model.lv[i][j] - model.lv[i - H][j]); return q.map((p) => cur[j] + (quantile(ch, p) ?? 0)); });
    return { cur, out, windows: model.lv.length - H };
  }, [model, H]);
  const replay = useMemo(() => {
    if (!model) return [];
    const L = model.lv, W = 21, i10 = YC_T.indexOf("10Y"), i2 = YC_T.indexOf("2Y");
    const wins: Array<{ s: number; e: number; d: number[] }> = [];
    for (let e = W; e < L.length; e++) wins.push({ s: e - W, e, d: L[e].map((x, j) => (x - L[e - W][j]) * 100) });
    if (!wins.length) return [];
    const best = (f: (w: (typeof wins)[number]) => number, label: string) => { const w = wins.reduce((a, b) => (f(b) > f(a) ? b : a)); return { label, from: model.dates[w.s], to: model.dates[w.e], d: w.d }; };
    return [
      best((w) => w.d[i10], "10 年收益率最大上行"), best((w) => -w.d[i10], "10 年收益率最大下行"),
      best((w) => w.d[i10] - w.d[i2], "2s10s 最大陡峭化"), best((w) => w.d[i2] - w.d[i10], "2s10s 最大平坦化"),
      best((w) => -w.d[i2], "2 年收益率最大下行"), best((w) => w.d[i2], "2 年收益率最大上行"),
    ];
  }, [model]);
  const regimes = useMemo(() => {
    if (!model) return null;
    const L = model.lv, i10 = YC_T.indexOf("10Y"), i2 = YC_T.indexOf("2Y"), i3m = YC_T.indexOf("3M");
    const days: Array<{ date: string; k: string; lvl: number; slope: number }> = [];
    for (let e = 5; e < L.length; e++) {
      const lvl = ((L[e][i2] + L[e][i10]) / 2 - (L[e - 5][i2] + L[e - 5][i10]) / 2) * 100;
      const slope = ((L[e][i10] - L[e][i2]) - (L[e - 5][i10] - L[e - 5][i2])) * 100;
      days.push({ date: model.dates[e], lvl, slope, k: lvl < 0 ? (slope > 0 ? "bs" : "bf") : (slope > 0 ? "es" : "ef") });
    }
    const last120 = days.slice(-120);
    const counts = Object.keys(REGIME).map((k) => ({ k, n: last120.filter((d) => d.k === k).length }));
    const inv2 = L.filter((r) => r[i10] < r[i2]).length, inv3 = L.filter((r) => r[i10] < r[i3m]).length;
    let streak = 0; for (let i = days.length - 1; i >= 0 && days[i].k === days[days.length - 1].k; i--) streak++;
    return { days, last120, counts, inv2, inv3, streak, cur: lastOf(days) };
  }, [model]);
  const cur = model ? model.lv[model.lv.length - 1] : null;
  const sel = replay[pick];
  const share3 = model ? model.fixed.reduce((s, e) => s + e.share, 0) : null;
  return (
    <PanelShell code="YCQSIM" title="收益率曲线情景模拟" onClose={onClose} tabs={[["pca", "主成分结构"], ["fan", "自举情景扇形"], ["replay", "历史情景重演"], ["regime", "曲线形态切换"]]} tab={tab} setTab={setTab} right={model ? <span>{model.dates.length} 个交易日样本</span> : null}>
      <Kpis items={[["水平因子解释度", model ? f2(model.fixed[0].share, 1, "%") : "—", "第一主成分"], ["斜率因子解释度", model ? f2(model.fixed[1]?.share, 1, "%") : "—", "第二主成分"], ["前三因子合计", f2(share3, 1, "%"), "水平 + 斜率 + 曲率"], ["当前形态（5 日）", regimes?.cur ? <span style={{ color: REGIME[regimes.cur.k][1] }}>{REGIME[regimes.cur.k][0]}</span> : "—", regimes ? `已持续 ${regimes.streak} 个交易日` : undefined]]} />
      {!model && <Empty loading={cv.loading} text="曲线样本不足" />}
      {model && tab === "pca" && <>
        <SectionHead title="主成分载荷（每个因子 1 单位冲击下各期限的变动）" sub="基于近一年美债日变动（bp）协方差矩阵" />
        <Lines series={model.fixed.map((e, k) => ({ name: ["水平", "斜率", "曲率"][k], color: COLORS[k], values: e.vec }))} xLabels={YC_T} height={160} fmt={(v) => v.toFixed(2)} zero />
        <SectionHead title="因子累计得分（bp）" />
        <Lines series={model.fixed.map((_, k) => ({ name: ["水平", "斜率", "曲率"][k], color: COLORS[k], values: model.scores[k] }))} xLabels={model.dates.map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(0)} zero />
        <SectionHead title="各期限日波动（bp / 日）与年化（bp）" />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>期限</th>{YC_T.map((t) => <th key={t} className={TH}>{t}</th>)}</tr></thead>
          <tbody><tr className={ROW}><td className={`${TDL} text-slate-400`}>日波动</td>{model.vol.map((v, j) => <td key={j} className={`${TD} text-white`}>{v.toFixed(2)}</td>)}</tr><tr className={ROW}><td className={`${TDL} text-slate-400`}>年化</td>{model.vol.map((v, j) => <td key={j} className={TD} style={{ background: heat(v * Math.sqrt(252) - 80, 60) }}>{(v * Math.sqrt(252)).toFixed(0)}</td>)}</tr></tbody></table>
      </>}
      {model && tab === "fan" && fan && <>
        <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><span className="text-[10px] text-slate-500">情景期限</span><Seg value={h} onChange={setH} options={[["5", "1 周"], ["21", "1 个月"], ["63", "3 个月"]]} /><span className="text-[10px] text-slate-500">{fan.windows} 个历史滚动窗口</span></div>
        <SectionHead title="未来曲线分布（今日曲线 + 历史同期限变动分位数，%）" />
        <Lines series={[{ name: "5% 分位", color: "#1fbf75", dash: true, values: fan.out.map((r) => r[0]) }, { name: "25%", color: "#34d399", values: fan.out.map((r) => r[1]) }, { name: "今日", color: "#e2e8f0", values: fan.cur }, { name: "75%", color: "#fb923c", values: fan.out.map((r) => r[3]) }, { name: "95% 分位", color: "#f2495c", dash: true, values: fan.out.map((r) => r[4]) }]} xLabels={YC_T} height={190} fmt={(v) => v.toFixed(2)} />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>期限</th><th className={TH}>今日</th><th className={TH}>5%</th><th className={TH}>25%</th><th className={TH}>中位</th><th className={TH}>75%</th><th className={TH}>95%</th><th className={TH}>90% 区间宽度 bp</th></tr></thead>
          <tbody>{YC_T.map((t, j) => <tr key={t} className={ROW}><td className={`${TDL} text-slate-100`}>{t}</td><td className={`${TD} text-white`}>{fan.cur[j].toFixed(2)}</td>{fan.out[j].map((v, k) => <td key={k} className={TD} style={{ color: k === 2 ? "#e2e8f0" : k < 2 ? "#1fbf75" : "#f2495c" }}>{v.toFixed(2)}</td>)}<td className={`${TD} text-amber-200`}>{((fan.out[j][4] - fan.out[j][0]) * 100).toFixed(0)}</td></tr>)}</tbody></table>
        <Note>口径：对近一年每一个同长度滚动窗口的真实收益率变动取分位数，叠加到今日曲线（历史自举，不假设正态）。</Note>
      </>}
      {model && tab === "replay" && <>
        <SectionHead title="近一年 1 个月窗口极端情景，套用于今日曲线" sub="点行查看情景曲线" />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>情景</th><th className={THL}>历史区间</th>{["3M", "2Y", "5Y", "10Y", "30Y"].map((t) => <th key={t} className={TH}>{t} Δbp</th>)}<th className={TH}>2s10s Δbp</th></tr></thead>
          <tbody>{replay.map((r, i) => { const g = (t: string) => r.d[YC_T.indexOf(t)]; return <tr key={r.label} onClick={() => setPick(i)} className={`cursor-pointer ${ROW} ${pick === i ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{r.label}</td><td className={`${TDL} font-mono text-[10px] text-slate-400`}>{r.from} ~ {r.to}</td>{["3M", "2Y", "5Y", "10Y", "30Y"].map((t) => <td key={t} className={TD} style={{ background: heat(g(t), 60) }}>{bp(g(t), 0)}</td>)}<td className={TD} style={{ color: toneOf(g("10Y") - g("2Y")) }}>{bp(g("10Y") - g("2Y"), 0)}</td></tr>; })}</tbody></table>
        {sel && cur && <Lines series={[{ name: "今日曲线", color: "#e2e8f0", values: cur }, { name: `情景：${sel.label}`, color: "#fbbf24", values: cur.map((v, j) => v + sel.d[j] / 100) }]} xLabels={YC_T} height={170} fmt={(v) => v.toFixed(2)} />}
      </>}
      {model && tab === "regime" && regimes && <>
        <SectionHead title="近 120 个交易日曲线形态（水平与斜率）" />
        <div className="flex h-6 w-full gap-px px-2">{regimes.last120.map((d) => <div key={d.date} title={`${d.date} ${REGIME[d.k][0]} 水平 ${d.lvl.toFixed(1)}bp 斜率 ${d.slope.toFixed(1)}bp`} className="flex-1" style={{ background: REGIME[d.k][1] }} />)}</div>
        <div className="flex justify-between px-2 font-mono text-[9px] text-slate-500"><span>{regimes.last120[0]?.date}</span><span>{lastOf(regimes.last120)?.date}</span></div>
        <Kpis items={regimes.counts.map((c) => [REGIME[c.k][0], `${c.n} 天`, `${((c.n / Math.max(1, regimes.last120.length)) * 100).toFixed(0)}%`] as [string, string, string])} />
        <SectionHead title="5 日水平变动 vs 斜率变动（bp）" />
        <Lines series={[{ name: "水平", color: "#38bdf8", values: regimes.days.map((d) => d.lvl) }, { name: "斜率", color: "#fbbf24", values: regimes.days.map((d) => d.slope) }]} xLabels={regimes.days.map((d) => d.date.slice(2))} height={160} fmt={(v) => v.toFixed(0)} zero />
        <Note>近一年 2s10s 倒挂 {regimes.inv2} 天，3m10y 倒挂 {regimes.inv3} 天。牛陡多见于降息预期升温，熊陡多见于期限溢价上行。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== FICM：固定收益板块监控 */
const FICM_SECT: Record<string, { label: string; list: Array<[string, string]> }> = {
  ig: { label: "投资级", list: [["LQD", "投资级公司债"], ["USIG", "全市场投资级"], ["VCSH", "短期公司债"], ["VCIT", "中期公司债"], ["IGIB", "5–10 年投资级"], ["VCLT", "长期公司债"]] },
  hy: { label: "高收益", list: [["HYG", "高收益公司债"], ["JNK", "高收益债（宽基）"], ["SHYG", "短久期高收益"], ["ANGL", "堕落天使债"], ["BKLN", "优先担保贷款"], ["SRLN", "杠杆贷款"]] },
  em: { label: "新兴市场", list: [["EMB", "新兴美元主权"], ["PCY", "新兴主权等权"], ["VWOB", "新兴政府债"], ["CEMB", "新兴公司债"], ["EMHY", "新兴高收益"], ["EMLC", "新兴本币债"]] },
  muni: { label: "市政债", list: [["MUB", "全国市政债"], ["VTEB", "免税市政债"], ["TFI", "市政债综合"], ["SUB", "短期市政债"], ["SHM", "短期市政（宽基）"], ["HYD", "高收益市政"]] },
  abs: { label: "证券化", list: [["MBB", "机构抵押债"], ["VMBS", "机构抵押债（宽基）"], ["SPMB", "机构抵押债（指数）"], ["GNMA", "吉利美抵押债"], ["CMBS", "商业抵押债"], ["JAAA", "AAA 级贷款抵押"]] },
};
const FICM_BENCH: Array<[string, string]> = [["SHY", "1–3 年美债"], ["IEF", "7–10 年美债"], ["TLT", "20 年以上美债"]];
const FICM_ALL = [...Object.values(FICM_SECT).flatMap((s) => s.list.map(([k]) => k)), ...FICM_BENCH.map(([k]) => k), "SPY", "^TNX"];
/** 双因子回归：r = a + b1·Δy + b2·r_spy */
function ols2(y: number[], x1: number[], x2: number[]) {
  const n = Math.min(y.length, x1.length, x2.length);
  if (n < 30) return null;
  const my = mean(y.slice(-n)), m1 = mean(x1.slice(-n)), m2 = mean(x2.slice(-n));
  let s11 = 0, s22 = 0, s12 = 0, s1y = 0, s2y = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const a = x1[x1.length - n + i] - m1, b = x2[x2.length - n + i] - m2, c = y[y.length - n + i] - my;
    s11 += a * a; s22 += b * b; s12 += a * b; s1y += a * c; s2y += b * c; syy += c * c;
  }
  const det = s11 * s22 - s12 * s12;
  if (!det) return null;
  const b1 = (s1y * s22 - s2y * s12) / det, b2 = (s2y * s11 - s1y * s12) / det;
  const r2 = syy ? (b1 * s1y + b2 * s2y) / syy : null;
  return { b1, b2, r2 };
}

export function FicmLive({ onClose }: P) {
  const [tab, setTab] = useState("ig");
  const cl = useCloses(FICM_ALL, 300);
  const ticks = useTicks(FICM_ALL.filter((s) => s !== "^TNX"));
  const { pick } = useHub();
  const stats = useMemo(() => {
    const { dates, m } = align(cl.data ?? null, FICM_ALL);
    if (dates.length < 60) return null;
    const ty = m["^TNX"], spy = m.SPY;
    const dy = ty.slice(1).map((v, i) => (v - ty[i]) / 100);
    const rs = rets(spy);
    const W = 250, H = 63;
    const out: Record<string, { p1m: number | null; p3m: number | null; ytd: number | null; vol: number | null; mdd: number; dur: number | null; beta: number | null; r2: number | null; tot: number | null; rate: number | null; credit: number | null; resid: number | null }> = {};
    for (const s of FICM_ALL) {
      if (s === "^TNX" || !m[s]) continue;
      const c = m[s], r = rets(c);
      const fit = ols2(r.slice(-W), dy.slice(-W), rs.slice(-W));
      const tot = r.slice(-H).reduce((a, b) => a + b, 0) * 100;
      const rate = fit ? fit.b1 * dy.slice(-H).reduce((a, b) => a + b, 0) * 100 : null;
      const credit = fit ? fit.b2 * rs.slice(-H).reduce((a, b) => a + b, 0) * 100 : null;
      out[s] = { p1m: perf(c, 21), p3m: perf(c, 63), ytd: ytd(c, dates), vol: annVol(c, 60), mdd: drawdown(c.slice(-252)).max, dur: fit ? -fit.b1 : null, beta: fit ? fit.b2 : null, r2: fit?.r2 ?? null, tot, rate, credit, resid: rate != null && credit != null ? tot - rate - credit : null };
    }
    return { out, dy: dy.slice(-H).reduce((a, b) => a + b, 0) * 10000, spy: rs.slice(-H).reduce((a, b) => a + b, 0) * 100 };
  }, [cl.data]);
  const tbl = (list: Array<[string, string]>) => (
    <table className="w-full text-[11px]">
      <thead className={thead}><tr><th className={THL}>名称</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>1 月</th><th className={TH}>3 月</th><th className={TH}>年内</th><th className={TH}>60 日波动</th><th className={TH}>一年最大回撤</th><th className={TH}>经验久期</th><th className={TH}>股票贝塔</th><th className={TH}>拟合优度</th></tr></thead>
      <tbody>{list.map(([s, l]) => { const t = ticks[s]; const x = stats?.out[s]; return <tr key={s} onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}><td className={TDL}><span className="text-slate-100">{l}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className={`${TD} text-white`}>{fmtPrice(t?.price)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td><td className={TD} style={{ color: toneOf(x?.p1m) }}>{sgn(x?.p1m)}</td><td className={TD} style={{ color: toneOf(x?.p3m) }}>{sgn(x?.p3m)}</td><td className={TD} style={{ background: heat(x?.ytd, 8) }}>{sgn(x?.ytd)}</td><td className={`${TD} text-slate-300`}>{f2(x?.vol, 1, "%")}</td><td className={TD} style={{ color: DOWNISH(x?.mdd) }}>{f2(x?.mdd, 1, "%")}</td><td className={`${TD} text-amber-200`}>{f2(x?.dur, 1)}</td><td className={`${TD} text-cyan-200`}>{f2(x?.beta, 2)}</td><td className={`${TD} text-slate-500`}>{f2(x?.r2, 2)}</td></tr>; })}</tbody>
    </table>
  );
  const attr = (list: Array<[string, string]>) => (
    <table className="w-full text-[11px]">
      <thead className={thead}><tr><th className={THL}>名称</th><th className={TH}>近 63 日收益</th><th className={TH}>利率贡献</th><th className={TH}>信用 / 风险贡献</th><th className={TH}>残差（利差 / 票息等）</th></tr></thead>
      <tbody>{list.map(([s, l]) => { const x = stats?.out[s]; return <tr key={s} className={ROW}><td className={`${TDL} text-slate-100`}>{l}</td><td className={TD} style={{ color: toneOf(x?.tot) }}>{sgn(x?.tot)}</td><td className={TD} style={{ color: toneOf(x?.rate) }}>{sgn(x?.rate)}</td><td className={TD} style={{ color: toneOf(x?.credit) }}>{sgn(x?.credit)}</td><td className={TD} style={{ color: toneOf(x?.resid) }}>{sgn(x?.resid)}</td></tr>; })}</tbody>
    </table>
  );
  const sectAvg = (k: string, f: (x: NonNullable<typeof stats>["out"][string]) => number | null) => { const v = FICM_SECT[k].list.map(([s]) => (stats?.out[s] ? f(stats.out[s]) : null)).filter((x): x is number => x != null); return v.length ? mean(v) : null; };
  const sect = FICM_SECT[tab];
  return (
    <PanelShell code="FICM" title="固定收益板块监控" onClose={onClose} tabs={[...Object.entries(FICM_SECT).map(([k, v]) => [k, v.label] as [string, string]), ["x", "跨板块比较"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["10 年美债近 63 日变动", stats ? `${bp(stats.dy, 0)} bp` : "—", "利率因子"], ["标普 500 近 63 日", stats ? sgn(stats.spy) : "—", "风险因子"], ["投资级平均经验久期", f2(sectAvg("ig", (x) => x.dur), 1), "对 10 年收益率回归"], ["高收益平均股票贝塔", f2(sectAvg("hy", (x) => x.beta), 2), "对标普 500 回归"]]} />
      {!stats && <Empty loading={cl.loading} />}
      {stats && sect && <>
        <SectionHead title={`${sect.label}板块 ETF：表现与风险因子暴露`} sub="点行在右侧查看 K 线" />
        {tbl(sect.list)}
        <SectionHead title="近 63 个交易日收益归因（%）" />
        {attr(sect.list)}
        <SectionHead title="美债基准" />
        {tbl(FICM_BENCH)}
      </>}
      {stats && tab === "x" && <>
        <SectionHead title="板块平均：经验久期 / 股票贝塔" />
        <Bars data={Object.entries(FICM_SECT).map(([k, v]) => ({ k: v.label, v: sectAvg(k, (x) => x.dur) ?? 0, v2: (sectAvg(k, (x) => x.beta) ?? 0) * 10 }))} label={["经验久期", "股票贝塔 ×10"]} fmt={(v) => v.toFixed(2)} height={150} />
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>板块</th><th className={TH}>1 月</th><th className={TH}>3 月</th><th className={TH}>年内</th><th className={TH}>60 日波动</th><th className={TH}>经验久期</th><th className={TH}>股票贝塔</th><th className={TH}>63 日利率贡献</th><th className={TH}>63 日信用贡献</th><th className={TH}>单位波动收益（3 月）</th></tr></thead>
          <tbody>{Object.entries(FICM_SECT).map(([k, v]) => { const p3 = sectAvg(k, (x) => x.p3m), vo = sectAvg(k, (x) => x.vol); return <tr key={k} onClick={() => setTab(k)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{v.label}</td><td className={TD} style={{ color: toneOf(sectAvg(k, (x) => x.p1m)) }}>{sgn(sectAvg(k, (x) => x.p1m))}</td><td className={TD} style={{ color: toneOf(p3) }}>{sgn(p3)}</td><td className={TD} style={{ background: heat(sectAvg(k, (x) => x.ytd), 8) }}>{sgn(sectAvg(k, (x) => x.ytd))}</td><td className={`${TD} text-slate-300`}>{f2(vo, 1, "%")}</td><td className={`${TD} text-amber-200`}>{f2(sectAvg(k, (x) => x.dur), 1)}</td><td className={`${TD} text-cyan-200`}>{f2(sectAvg(k, (x) => x.beta), 2)}</td><td className={TD} style={{ color: toneOf(sectAvg(k, (x) => x.rate)) }}>{sgn(sectAvg(k, (x) => x.rate))}</td><td className={TD} style={{ color: toneOf(sectAvg(k, (x) => x.credit)) }}>{sgn(sectAvg(k, (x) => x.credit))}</td><td className={TD}>{p3 != null && vo ? f2(p3 / vo, 2) : "—"}</td></tr>; })}</tbody>
        </table>
      </>}
      <Note>口径：以各板块代表性债券 ETF 的真实日线计算；经验久期与股票贝塔为近 250 个交易日日收益对 10 年美债收益率变动、标普 500 日收益的双因子回归系数。收益归因 = 系数 × 同期因子变动，残差主要来自票息与利差。</Note>
    </PanelShell>
  );
}
const DOWNISH = (v: number | null | undefined) => (v == null ? "#94a3b8" : v < -10 ? "#1fbf75" : "#cbd5e1");
