/**
 * 外汇窗口（第三组，全部实时 / 真实数据计算，角度与其他外汇功能互不重复）：
 *  - XDSH 外汇市场状态仪表：全球交易时段（按各地时区与夏令时）、风险偏好合成指数（套息 / 避险 / 商品货币当日标准化变动）、美元广度
 *  - ALLQ 单一货币全球报价面：选定一种货币，对全部其他货币的实时交叉报价与 1 日 / 1 周 / 1 月 / 年内 / 1 年变动
 *  - FRD  外汇远期计算器：按两国政策利率的抛补利率平价，逐期限远期点、远期全价、年化持有成本，可算任意交割日
 *  - BFIX 平台半小时定盘：由平台自有分钟快照生成每 30 分钟的定盘价、定盘间变动与当日定盘走势
 *  - FXFA 套息交易分析：融资货币 × 目标货币的利差、利差 / 波动比、盈亏平衡汇率、历史滚动 3 个月套息收益分布与最大回撤
 */
import { useEffect, useMemo, useState } from "react";
import { fmtPct, toneOf, usePolled, useTicks, type Candle } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, f2, heat, mean, perf, rets, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { INP, MiniLine, Note, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";
import { fmtRate } from "./RatesFxLive3";
import { FX_CCYS, useCbRates, usdVal, type Ccy } from "./FxDeskLive";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
const USD: Ccy = { c: "USD", zh: "美元", sym: "DXY", inv: false, r: "美洲", cb: "US", g10: true };
const ALL = [USD, ...FX_CCYS];
const zhOf = (c: string) => ALL.find((x) => x.c === c)?.zh ?? c;
const dayKey = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

/* ================================================================== XDSH 外汇市场状态仪表 */
const SESSIONS: Array<{ n: string; tz: string; open: number; close: number }> = [
  { n: "惠灵顿", tz: "Pacific/Auckland", open: 8, close: 17 }, { n: "悉尼", tz: "Australia/Sydney", open: 8, close: 17 },
  { n: "东京", tz: "Asia/Tokyo", open: 9, close: 18 }, { n: "香港 / 新加坡", tz: "Asia/Hong_Kong", open: 9, close: 17 },
  { n: "法兰克福", tz: "Europe/Berlin", open: 8, close: 17 }, { n: "伦敦", tz: "Europe/London", open: 8, close: 17 }, { n: "纽约", tz: "America/New_York", open: 8, close: 17 },
];
/** 风险偏好成分：方向 +1 表示该项上涨 = 风险偏好上升 */
const RISK: Array<[string, string, 1 | -1, string]> = [
  ["AUDJPY", "澳元/日元", 1, "套息"], ["NZDJPY", "纽元/日元", 1, "套息"], ["GBPJPY", "英镑/日元", 1, "套息"], ["USDCHF", "美元/瑞郎", 1, "避险（反向）"],
  ["USDJPY", "美元/日元", 1, "避险（反向）"], ["GC", "黄金", -1, "避险"], ["AUDUSD", "澳元/美元", 1, "商品货币"], ["USDCAD", "美元/加元", -1, "商品货币（反向）"], ["^GSPC", "标普 500", 1, "股市"], ["^VIX", "波动率指数", -1, "恐慌（反向）"],
];
function localHM(tz: string, now: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { h: Number(g("hour")) % 24, m: Number(g("minute")), wd: g("weekday") };
}
export function XdshLive({ onClose }: P) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(id); }, []);
  const syms = RISK.map((r) => r[0]);
  const ticks = useTicks([...syms, ...FX_CCYS.map((c) => c.sym), "DXY"]);
  const pack = useCloses(syms, 120);
  const comp = RISK.map(([s, n, dir, g]) => {
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    const sd = std(rets(c.slice(-21))) * 100;
    const chg = ticks[s]?.changePct ?? null;
    const z = chg != null && sd > 0 ? (chg / sd) * dir : null;
    return { s, n, g, chg, z };
  });
  const zs = comp.map((x) => x.z).filter((x): x is number => x != null);
  const score = zs.length ? mean(zs) : null;
  const dayChg = (c: Ccy) => { const p = ticks[c.sym]?.changePct; return p == null ? null : c.inv ? (1 / (1 + p / 100) - 1) * 100 : p; };
  const vsUsd = FX_CCYS.map((c) => dayChg(c)).filter((x): x is number => x != null);
  const usdUp = vsUsd.filter((x) => x < 0).length;
  const em = FX_CCYS.filter((c) => !c.g10 && !["HKD", "CNH"].includes(c.c)).map(dayChg).filter((x): x is number => x != null);
  const g10 = FX_CCYS.filter((c) => c.g10).map(dayChg).filter((x): x is number => x != null);
  const state = score == null ? "—" : score > 0.75 ? "强烈风险偏好" : score > 0.25 ? "温和风险偏好" : score < -0.75 ? "强烈避险" : score < -0.25 ? "温和避险" : "中性";
  return (
    <PanelShell code="XDSH" title="外汇市场状态仪表" onClose={onClose}>
      <Kpis items={[["风险偏好合成指数", <span style={{ color: toneOf(score) }}>{f2(score)}</span>, state], ["美元指数", fmtRate(ticks.DXY?.price), fmtPct(ticks.DXY?.changePct)], ["美元广度（对美元下跌的货币）", `${usdUp} / ${vsUsd.length}`], ["G10 货币平均（对美元）", sgn(g10.length ? mean(g10) : null)], ["新兴货币平均（对美元）", sgn(em.length ? mean(em) : null)]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="bg-[#03070c]">
          <SectionHead title="全球外汇交易时段" sub="按各地当地时间与夏令时自动换算；工作日当地 8 / 9 点至 17 / 18 点视为主交易时段" />
          <table className="w-full text-[11px]"><tbody>{SESSIONS.map((s) => {
            const t = localHM(s.tz, now); const wk = !["Sat", "Sun"].includes(t.wd); const open = wk && t.h >= s.open && t.h < s.close;
            const left = open ? (s.close - t.h) * 60 - t.m : null;
            return (
              <tr key={s.n} className={ROW}>
                <td className={`${TDL} text-slate-100`}>{s.n}</td>
                <td className={`${TD} text-slate-300`}>{String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}</td>
                <td className={`${TDL}`} style={{ color: open ? "#f2495c" : "#64748b" }}>{open ? "● 交易中" : wk ? "休市" : "周末"}</td>
                <td className={`${TD} text-[10px] text-slate-500`}>{left != null ? `${Math.floor(left / 60)} 小时 ${left % 60} 分后收市` : ""}</td>
                <td className="w-40 px-2"><div className="relative h-2 bg-[#0a1726]"><div className="absolute h-2 bg-[#1d3047]" style={{ left: `${(s.open / 24) * 100}%`, width: `${((s.close - s.open) / 24) * 100}%` }} /><div className="absolute top-[-2px] h-3 w-px bg-amber-300" style={{ left: `${((t.h + t.m / 60) / 24) * 100}%` }} /></div></td>
              </tr>
            );
          })}</tbody></table>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="风险偏好合成指数成分" />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>成分</th><th className={THL}>类别</th><th className={TH}>今日</th><th className={TH}>标准化（风险方向）</th></tr></thead>
            <tbody>{comp.map((x) => <tr key={x.s} className={ROW}><td className={`${TDL} text-slate-100`}>{x.n}</td><td className={`${TDL} text-[10px] text-slate-500`}>{x.g}</td><td className={TD} style={{ color: toneOf(x.chg) }}>{fmtPct(x.chg)}</td><td className={TD} style={{ color: toneOf(x.z), background: heat(x.z, 2) }}>{f2(x.z)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <SectionHead title="风险偏好成分（标准化）" />
      <Bars data={comp.filter((x) => x.z != null).map((x) => ({ k: x.n, v: x.z! }))} fmt={(v) => v.toFixed(2)} height={110} />
      <Note>合成指数 &gt; 0 表示今日市场偏向风险资产（套息货币走强、避险资产走弱），绝对值越大越显著；单一成分 ±2 以上为异常变动。</Note>
    </PanelShell>
  );
}

/* ================================================================== ALLQ 单一货币全球报价面 */
export function AllqLive({ onClose }: P) {
  const [base, setBase] = useState("CNH");
  const [sortK, setSortK] = useState<"d" | "w1" | "m1" | "ytd" | "y1">("ytd");
  const ticks = useTicks(FX_CCYS.map((c) => c.sym));
  const pack = useCloses(FX_CCYS.map((c) => c.sym), 400);
  const { pick } = useHub();
  /** 每种货币的美元价值序列（USD = 1） */
  const usdSeries = useMemo(() => {
    if (!pack.data) return null;
    const al = align(pack.data, FX_CCYS.map((c) => c.sym).filter((s) => (pack.data![s] ?? []).length > 100));
    const out: Record<string, number[]> = { USD: al.dates.map(() => 1) };
    for (const c of FX_CCYS) if (al.m[c.sym]) out[c.c] = usdVal(c, al.m[c.sym]);
    return { dates: al.dates, out };
  }, [pack.data]);
  const nowUsd = (c: string) => { if (c === "USD") return 1; const x = FX_CCYS.find((y) => y.c === c); const p = x ? ticks[x.sym]?.price : null; return x && p ? (x.inv ? 1 / p : p) : null; };
  const prevUsd = (c: string) => { if (c === "USD") return 1; const x = FX_CCYS.find((y) => y.c === c); const p = x ? ticks[x.sym]?.prevClose : null; return x && p ? (x.inv ? 1 / p : p) : null; };
  const rows = ALL.filter((c) => c.c !== base).map((q) => {
    const b0 = nowUsd(base), q0 = nowUsd(q.c), bp = prevUsd(base), qp = prevUsd(q.c);
    const rate = b0 != null && q0 ? b0 / q0 : null;
    const d = rate != null && bp != null && qp ? (rate / (bp / qp) - 1) * 100 : null;
    const sb = usdSeries?.out[base], sq = usdSeries?.out[q.c];
    const cross = sb && sq ? sb.map((v, i) => v / sq[i]) : [];
    return { q, rate, d, w1: perf(cross, 5), m1: perf(cross, 21), ytd: usdSeries ? ytd(cross, usdSeries.dates) : null, y1: perf(cross, 252), spark: cross.slice(-120) };
  }).sort((a, b) => sortK === "d" ? (b.d ?? -99) - (a.d ?? -99) : ((b[sortK] ?? -99) - (a[sortK] ?? -99)));
  const strongerVs = rows.filter((r) => (r.ytd ?? 0) > 0).length;
  return (
    <PanelShell code="ALLQ" title="单一货币全球报价面" onClose={onClose} right={<span className="flex items-center gap-1 text-[10px] text-slate-500">基准货币<select value={base} onChange={(e) => setBase(e.target.value)} className={INP}>{ALL.map((c) => <option key={c.c} value={c.c}>{c.zh} {c.c}</option>)}</select></span>}>
      <Kpis items={[["基准货币", `${zhOf(base)} ${base}`], ["年内对其升值的货币数", `${strongerVs} / ${rows.length}`, "即基准货币相对多少种货币走强"], ["今日最大升幅", rows.length ? (() => { const r = [...rows].sort((a, b) => (b.d ?? -99) - (a.d ?? -99))[0]; return `对${r.q.zh} ${sgn(r.d)}`; })() : "—"]]} />
      <div className="px-2 py-1"><span className="mr-1 text-[10px] text-slate-500">排序</span><Seg value={sortK} options={[["d", "今日"], ["w1", "1 周"], ["m1", "1 月"], ["ytd", "年内"], ["y1", "1 年"]]} onChange={setSortK} /></div>
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>报价货币</th><th className={TH}>1 {base} = </th><th className={TH}>今日</th><th className={TH}>1 周</th><th className={TH}>1 月</th><th className={TH}>年内</th><th className={TH}>1 年</th><th className={TH}>近半年走势</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.q.c} onClick={() => pick(r.q.c === "USD" ? (FX_CCYS.find((x) => x.c === base)?.sym ?? "DXY") : r.q.sym)} className={`${ROW} cursor-pointer`}>
              <td className={`${TDL} text-slate-100`}>{r.q.zh} <span className="font-mono text-[10px] text-slate-500">{r.q.c}</span></td>
              <td className={`${TD} text-white`}>{fmtRate(r.rate)} <span className="text-[10px] text-slate-500">{r.q.c}</span></td>
              {[r.d, r.w1, r.m1, r.ytd, r.y1].map((v, i) => <td key={i} className={TD} style={{ color: toneOf(v), background: heat(v, i === 0 ? 1.5 : 15) }}>{sgn(v)}</td>)}
              <td className={TD}><MiniLine values={r.spark} w={90} color={(r.ytd ?? 0) >= 0 ? "#f2495c" : "#1fbf75"} /></td>
            </tr>
          ))}{!usdSeries && <tr><td colSpan={8}><Empty loading={pack.loading} /></td></tr>}</tbody>
        </table>
      </div>
      <Note>交叉汇率经两种货币各自对美元的实时报价套算；正值表示基准货币相对该货币升值。点击行打开对应 K 线。</Note>
    </PanelShell>
  );
}

/* ================================================================== FRD 外汇远期计算器 */
const FRD_PAIRS = ["EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "USDCNH", "EURJPY", "EURCNH", "USDHKD", "USDKRW", "USDINR", "USDBRL", "USDMXN", "USDZAR", "USDTRY"];
const FRD_TENORS: Array<[string, number]> = [["1W", 7], ["2W", 14], ["1M", 30], ["2M", 61], ["3M", 91], ["6M", 182], ["9M", 273], ["1Y", 365], ["18M", 547], ["2Y", 730]];
export function FrdLive({ onClose }: P) {
  const [pair, setPair] = useState("USDCNH");
  const [date, setDate] = useState("");
  const [amt, setAmt] = useState("1000000");
  const ticks = useTicks([pair]);
  const cb = useCbRates();
  const [b, q] = [pair.slice(0, 3), pair.slice(3, 6)];
  const rate = (c: string) => { const area = ALL.find((x) => x.c === c)?.cb ?? (c === "CNY" ? "CN" : ""); return cb.data?.rows.find((r) => r.area === area)?.rate ?? null; };
  const rb = rate(b), rq = rate(q);
  const S = ticks[pair]?.price ?? null;
  const pips = pair.endsWith("JPY") || pair.endsWith("KRW") || pair.endsWith("INR") ? 100 : 10000;
  const fwd = (days: number) => (S != null && rb != null && rq != null ? (S * (1 + (rq / 100) * days / 360)) / (1 + (rb / 100) * days / 360) : null);
  const rows = FRD_TENORS.map(([t, d]) => { const F = fwd(d); return { t, d, F, pts: F != null && S != null ? (F - S) * pips : null, ann: F != null && S ? ((F / S - 1) * 365) / d * 100 : null }; });
  const custom = date ? Math.round((Date.parse(date) - Date.now()) / 86400_000) : null;
  const Fc = custom != null && custom > 0 ? fwd(custom) : null;
  const N = Number(amt) || 0;
  return (
    <PanelShell code="FRD" title="外汇远期计算器" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]">
        <select value={pair} onChange={(e) => setPair(e.target.value)} className={INP}>{FRD_PAIRS.map((p) => <option key={p}>{p}</option>)}</select>
        <span className="text-slate-500">自定义交割日</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INP} />
        <span className="text-slate-500">名义本金（{b}）</span><input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} className={`${INP} w-28`} />
      </div>
      <Kpis items={[["即期（实时）", fmtRate(S), fmtPct(ticks[pair]?.changePct)], [`${zhOf(b)}政策利率`, f2(rb, 3, "%")], [`${zhOf(q)}政策利率`, f2(rq, 3, "%")], ["利差（报价 − 基础）", rb != null && rq != null ? `${((rq - rb) * 100).toFixed(0)}bp` : "—"], ["自定义交割日远期", Fc != null ? `${fmtRate(Fc)}（${custom} 天）` : "—", Fc != null && S != null ? `远期点 ${((Fc - S) * pips).toFixed(1)} · 交割金额 ${(Fc * N).toLocaleString("zh-CN", { maximumFractionDigits: 0 })} ${q}` : ""]]} />
      {S == null || rb == null || rq == null ? <Empty loading={cb.loading} text="缺少即期或利率数据" /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>天数</th><th className={TH}>远期全价</th><th className={TH}>远期点</th><th className={TH}>年化升贴水</th><th className={TH}>到期交割（{q}）</th><th className={THL}>{b} 方向</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.t} className={ROW}><td className={`${TDL} text-slate-100`}>{r.t}</td><td className={`${TD} text-slate-400`}>{r.d}</td><td className={`${TD} text-white`}>{fmtRate(r.F)}</td><td className={TD} style={{ color: toneOf(r.pts) }}>{r.pts == null ? "—" : r.pts.toFixed(1)}</td><td className={TD} style={{ color: toneOf(r.ann) }}>{sgn(r.ann, 3)}</td><td className={`${TD} text-slate-300`}>{r.F == null ? "—" : (r.F * N).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}</td><td className={`${TDL} text-[10px] text-slate-400`}>{(r.pts ?? 0) > 0 ? "远期升水" : (r.pts ?? 0) < 0 ? "远期贴水" : "平价"}</td></tr>)}</tbody>
          </table>
          <SectionHead title="远期点期限曲线" />
          <Lines height={150} zero xLabels={rows.map((r) => r.t)} fmt={(v) => v.toFixed(1)} series={[{ name: "远期点", color: COLORS[0], values: rows.map((r) => r.pts) }]} />
          <Note>抛补利率平价：F = S × (1 + r报价 × 天数/360) ÷ (1 + r基础 × 天数/360)，利率取两国最新政策利率，为理论远期；实际市场远期还包含交叉货币基差与信用溢价，存在偏离。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== BFIX 平台半小时定盘 */
const FIX_PAIRS = ["EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "USDCAD", "USDCNH", "NZDUSD"];
function useFix(sym: string) {
  const r = usePolled<{ candles: Candle[] }>("ucMarket.kline", { symbol: sym, period: "30m", limit: 240 }, 60_000);
  return r.data?.candles ?? null;
}
export function BfixLive({ onClose }: P) {
  const k0 = useFix(FIX_PAIRS[0]), k1 = useFix(FIX_PAIRS[1]), k2 = useFix(FIX_PAIRS[2]), k3 = useFix(FIX_PAIRS[3]), k4 = useFix(FIX_PAIRS[4]), k5 = useFix(FIX_PAIRS[5]), k6 = useFix(FIX_PAIRS[6]), k7 = useFix(FIX_PAIRS[7]);
  const ks = [k0, k1, k2, k3, k4, k5, k6, k7];
  const [sel, setSel] = useState(0);
  const ticks = useTicks(FIX_PAIRS);
  const days = [...new Set(ks.flatMap((k) => (k ?? []).map((c) => dayKey(c.t))))].sort();
  const [day, setDay] = useState<string | null>(null);
  const d = day ?? days.at(-1) ?? null;
  // 定盘价 = 每个半小时区间结束时的最后成交（即该 30 分钟 K 线收盘），时点 = 区间结束时刻
  const slots = useMemo(() => {
    const set = new Set<number>();
    ks.forEach((k) => (k ?? []).forEach((c) => { if (dayKey(c.t) === d) set.add(c.t); }));
    return [...set].sort((a, b) => b - a);
  }, [ks.map((k) => k?.length ?? 0).join("|"), d]);
  const fixAt = (i: number, t: number) => ks[i]?.find((c) => c.t === t)?.c ?? null;
  const prevFix = (i: number, t: number) => { const arr = ks[i] ?? []; const j = arr.findIndex((c) => c.t === t); return j > 0 ? arr[j - 1].c : null; };
  const label = (t: number) => new Date(t + 30 * 60_000).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });
  const curSeries = (ks[sel] ?? []).filter((c) => dayKey(c.t) === d);
  return (
    <PanelShell code="BFIX" title="平台半小时定盘" onClose={onClose} right={<span className="flex items-center gap-1 text-[10px] text-slate-500">日期 <select value={d ?? ""} onChange={(e) => setDay(e.target.value)} className={INP}>{days.slice(-5).map((x) => <option key={x}>{x}</option>)}</select></span>}>
      <Kpis items={FIX_PAIRS.slice(0, 5).map((p, i) => { const last = (ks[i] ?? []).filter((c) => dayKey(c.t) === d).at(-1); return [p, fmtRate(last?.c), `最新定盘 ${last ? label(last.t) : "—"} · 实时 ${fmtRate(ticks[p]?.price)}`] as [string, string, string]; })} />
      {!slots.length ? <Empty loading={ks.some((k) => k == null)} text="当日暂无定盘数据" /> : (
        <>
          <div className="overflow-auto" style={{ maxHeight: 360 }}>
            <table className="w-full text-[11px]">
              <thead className={thead}><tr><th className={THL}>定盘时点（北京时间）</th>{FIX_PAIRS.map((p, i) => <th key={p} className={`${TH} cursor-pointer ${i === sel ? "text-cyan-300" : ""}`} onClick={() => setSel(i)}>{p}</th>)}</tr></thead>
              <tbody>{slots.map((t) => <tr key={t} className={ROW}><td className={`${TDL} font-mono text-slate-300`}>{label(t)}</td>{FIX_PAIRS.map((p, i) => { const v = fixAt(i, t), pv = prevFix(i, t); const ch = v != null && pv ? (v / pv - 1) * 100 : null; return <td key={p} className={TD}><span className="text-white">{fmtRate(v)}</span> <span className="text-[9px]" style={{ color: toneOf(ch) }}>{ch == null ? "" : sgn(ch, 3)}</span></td>; })}</tr>)}</tbody>
            </table>
          </div>
          <SectionHead title={`${FIX_PAIRS[sel]} 当日定盘走势`} sub="点表头切换货币对" />
          <Lines height={150} xLabels={curSeries.map((c) => label(c.t))} fmt={(v) => fmtRate(v)} series={[{ name: "定盘价", color: COLORS[0], values: curSeries.map((c) => c.c) }]} />
          <Note>定盘价由平台自有的分钟级行情快照生成：取每个 30 分钟区间结束时的最新价，小字为相对上一定盘的变动。定盘记录随行情入库永久保留，可回看最近 5 个交易日。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== FXFA 套息交易分析 */
const FUNDERS = ["JPY", "CHF", "EUR", "USD", "CNH"];
const TARGETS = ["MXN", "BRL", "ZAR", "TRY", "INR", "IDR", "AUD", "NZD", "USD", "GBP", "CAD", "COP", "CLP", "HUF", "PLN"];
export function FxfaLive({ onClose }: P) {
  const [fund, setFund] = useState("JPY");
  const [sel, setSel] = useState("MXN");
  const cb = useCbRates();
  const syms = FX_CCYS.map((c) => c.sym);
  const pack = useCloses(syms, 1300);
  const rateOf = (c: string) => { const area = ALL.find((x) => x.c === c)?.cb ?? ""; return cb.data?.rows.find((r) => r.area === area) ?? null; };
  const rateAt = (c: string, month: string) => { const r = rateOf(c); if (!r) return null; let v: number | null = null; for (const h of r.hist) { if (h.d <= month) v = h.v; else break; } return v; };
  const model = useMemo(() => {
    if (!pack.data || !cb.data) return null;
    const ok = syms.filter((s) => (pack.data![s] ?? []).length > 300);
    const al = align(pack.data, ok);
    const usd: Record<string, number[]> = { USD: al.dates.map(() => 1) };
    for (const c of FX_CCYS) if (al.m[c.sym]) usd[c.c] = usdVal(c, al.m[c.sym]);
    return TARGETS.filter((t) => t !== fund && usd[t] && usd[fund]).map((t) => {
      const px = usd[t].map((v, i) => v / usd[fund][i]); // 1 单位目标货币值多少融资货币
      const rt = rateOf(t)?.rate ?? null, rf = rateOf(fund)?.rate ?? null;
      const carry = rt != null && rf != null ? rt - rf : null;
      const vol = std(rets(px.slice(-253))) * Math.sqrt(252) * 100;
      // 每日套息收益 = 即期变动 + 当月利差 / 252
      const daily = px.slice(1).map((v, i) => { const m = al.dates[i + 1].slice(0, 7); const a = rateAt(t, m), b = rateAt(fund, m); return v / px[i] - 1 + (a != null && b != null ? (a - b) / 100 / 252 : 0); });
      const eq = [1]; daily.forEach((r) => eq.push(eq[eq.length - 1] * (1 + r)));
      let peak = 1, mdd = 0; for (const v of eq) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
      const roll3: number[] = []; for (let i = 63; i < eq.length; i++) roll3.push((eq[i] / eq[i - 63] - 1) * 100);
      const ann = (Math.pow(eq[eq.length - 1], 252 / Math.max(1, daily.length)) - 1) * 100;
      return { t, carry, vol, ratio: carry != null && vol ? carry / vol : null, ann, mdd: mdd * 100, roll3, eq, dates: al.dates, worst3: roll3.length ? Math.min(...roll3) : null, winRate: roll3.length ? (roll3.filter((x) => x > 0).length / roll3.length) * 100 : null };
    }).sort((a, b) => (b.ratio ?? -9) - (a.ratio ?? -9));
  }, [pack.data, cb.data, fund]);
  const cur = model?.find((m) => m.t === sel) ?? model?.[0];
  const hist = useMemo(() => {
    if (!cur) return [];
    const bins = [-15, -10, -6, -3, 0, 3, 6, 10, 15];
    return bins.slice(0, -1).map((lo, i) => ({ k: `${lo}~${bins[i + 1]}%`, v: cur.roll3.filter((x) => x >= lo && x < bins[i + 1]).length }));
  }, [cur]);
  return (
    <PanelShell code="FXFA" title="套息交易分析" onClose={onClose} right={<span className="flex items-center gap-1 text-[10px] text-slate-500">融资货币 <Seg value={fund} options={FUNDERS.map((f) => [f, zhOf(f)] as [string, string])} onChange={setFund} /></span>}>
      {!model ? <Empty loading={pack.loading || cb.loading} /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>目标货币</th><th className={TH}>年利差</th><th className={TH}>1 年实现波动</th><th className={TH}>利差 / 波动</th><th className={TH}>近 5 年年化（含利差）</th><th className={TH}>最大回撤</th><th className={TH}>滚动 3 月胜率</th><th className={TH}>最差 3 个月</th><th className={TH}>一年盈亏平衡贬值</th><th className={TH}>净值</th></tr></thead>
            <tbody>{model.map((m) => (
              <tr key={m.t} onClick={() => setSel(m.t)} className={`${ROW} cursor-pointer ${cur?.t === m.t ? "bg-[#0d2236]" : ""}`}>
                <td className={`${TDL} text-slate-100`}>{zhOf(m.t)} <span className="font-mono text-[10px] text-slate-500">{m.t}/{fund}</span></td>
                <td className={TD} style={{ color: toneOf(m.carry) }}>{f2(m.carry, 2, "%")}</td>
                <td className={`${TD} text-slate-300`}>{f2(m.vol, 1, "%")}</td>
                <td className={TD} style={{ background: heat(m.ratio, 1) }}>{f2(m.ratio)}</td>
                <td className={TD} style={{ color: toneOf(m.ann) }}>{sgn(m.ann)}</td>
                <td className={TD} style={{ color: toneOf(m.mdd) }}>{sgn(m.mdd)}</td>
                <td className={`${TD} text-slate-300`}>{f2(m.winRate, 0, "%")}</td>
                <td className={TD} style={{ color: toneOf(m.worst3) }}>{sgn(m.worst3)}</td>
                <td className={`${TD} text-slate-300`}>{m.carry != null ? `${m.carry.toFixed(2)}%` : "—"}</td>
                <td className={TD}><MiniLine values={m.eq.filter((_, i) => i % 5 === 0)} w={90} color={m.ann >= 0 ? "#f2495c" : "#1fbf75"} /></td>
              </tr>
            ))}</tbody>
          </table>
          {cur && (
            <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
              <div className="bg-[#03070c]"><SectionHead title={`${zhOf(cur.t)} / ${zhOf(fund)} 套息净值（含利差）`} /><Lines height={170} xLabels={cur.dates} fmt={(v) => v.toFixed(3)} series={[{ name: "净值", color: COLORS[0], values: cur.eq }]} /></div>
              <div className="bg-[#03070c]"><SectionHead title="滚动 3 个月收益分布（次数）" sub="左尾越厚，套息平仓风险越大" /><Bars data={hist} fmt={(v) => v.toFixed(0)} height={170} /></div>
            </div>
          )}
          <Note>做多目标货币、借入融资货币；日收益 = 即期汇率变动 + 当月两国政策利率差 / 252（近似远期点），未计交易成本与基差。「一年盈亏平衡贬值」= 年利差，即目标货币一年内对融资货币贬值超过该幅度才会亏损。按利差 / 波动比排序。</Note>
        </>
      )}
    </PanelShell>
  );
}
