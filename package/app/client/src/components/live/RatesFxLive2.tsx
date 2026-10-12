/**
 * 外汇分组小窗（XCCY / FXFC / FXDS / FXTF / STNI / WVOL），全部接实时行情与真实日线，分析角度互不重复：
 *  - XCCY 美元—欧元利差与理论远期：美 / 欧政府曲线逐期限利差、零基差（抛补利率平价）理论远期点、10 年利差与汇率的月度联动
 *  - FXFC 外汇预测区间：近 10 年真实日线的同期限滚动收益经验分布 → 各期限价格区间；趋势 / 动量状态
 *  - FXDS 外汇价差分析：交叉盘实时报价 vs 美元两腿套算偏离；货币对配对价差的协整对冲比、Z 值与半衰期
 *  - FXTF 外汇资金流向：期货持仓（杠杆基金 / 资管 / 交易商）折算美元名义敞口与周度变化；货币 ETF 成交额异动
 *  - STNI 外汇实时报价：主要 / 交叉 / 亚洲与新兴货币报价板，货币强弱排名，日内相对走势
 *  - WVOL 全球波动率：跨资产波动率指数的一年位置与期限结构，货币 ETF 期权隐波 vs 实现波动，货币对实现波动锥
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, useKline, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, LiveBoard, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, f2, heat, mean, perf, rets, rollingVol, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, ROW, RangeBar, TD, TDL, TH, THL, pctRank, quantile, slope, useCurves, yieldFn, type IvRow, type P } from "./LiveCommon";
import type { CotRow } from "./RatesFxLive";

const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
const COLORS = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb923c", "#94a3b8", "#22d3ee"];
const bp = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);
const digitsOf = (v: number | null | undefined) => (v == null ? 4 : v > 20 ? 3 : v > 5 ? 4 : 5);
const PAIR_ZH: Record<string, string> = {
  EURUSD: "欧元/美元", USDJPY: "美元/日元", GBPUSD: "英镑/美元", AUDUSD: "澳元/美元", NZDUSD: "纽元/美元", USDCAD: "美元/加元", USDCHF: "美元/瑞郎", USDCNH: "美元/离岸人民币",
  EURJPY: "欧元/日元", EURGBP: "欧元/英镑", GBPJPY: "英镑/日元", AUDJPY: "澳元/日元", EURCHF: "欧元/瑞郎", CADJPY: "加元/日元", AUDNZD: "澳元/纽元", EURAUD: "欧元/澳元",
  CHFJPY: "瑞郎/日元", GBPCHF: "英镑/瑞郎", NZDJPY: "纽元/日元", EURCAD: "欧元/加元", USDHKD: "美元/港币", USDSGD: "美元/新加坡元", USDKRW: "美元/韩元", USDINR: "美元/印度卢比",
  USDMXN: "美元/墨西哥比索", USDBRL: "美元/巴西雷亚尔", USDZAR: "美元/南非兰特", USDTRY: "美元/土耳其里拉", USDTWD: "美元/新台币", DXY: "美元指数",
};
const zh = (s: string) => PAIR_ZH[s] ?? s;

/* ================================================================== XCCY */
type Sov = { countries: Array<{ code: string; name: string; date: string; y: number; hist: Array<{ d: string; y: number; s: number | null }> }> };
const CIP_T: Array<[string, number]> = [["1M", 1 / 12], ["3M", 0.25], ["6M", 0.5], ["1Y", 1], ["2Y", 2], ["3Y", 3], ["5Y", 5], ["7Y", 7], ["10Y", 10]];
const DIFF_T: Array<[string, number]> = [["3M", 0.25], ["1Y", 1], ["2Y", 2], ["5Y", 5], ["10Y", 10], ["20Y", 20], ["30Y", 30]];

export function XccyLive({ onClose, tab0 = "diff" }: P & { tab0?: string }) {
  const [tab, setTab] = useState(tab0);
  const cv = useCurves();
  const sov = usePolled<Sov>("ucHubs.sovereign", {}, 6 * 3600_000);
  const cl = useCloses(["EURUSD", "^TNX"], 2000);
  const t = useTicks(["EURUSD"]).EURUSD;
  const us = cv.data?.us[0];
  const usF = useMemo(() => (us ? yieldFn(us.points) : null), [us]);
  const euF = useMemo(() => (cv.data?.eu.length ? yieldFn(cv.data.eu) : null), [cv.data]);
  const spot = t?.price ?? null;
  const diff = DIFF_T.map(([l, T]) => { const a = usF?.(T) ?? null, b = euF?.(T) ?? null; return { l, T, us: a != null ? a * 100 : null, eu: b != null ? b * 100 : null, d: a != null && b != null ? (a - b) * 10000 : null }; });
  const cip = CIP_T.map(([l, T]) => {
    const ru = usF?.(T) ?? null, re = euF?.(T) ?? null;
    if (ru == null || re == null || spot == null) return { l, T, F: null as number | null, pts: null as number | null, ann: null as number | null, ru, re };
    const F = T <= 1 ? (spot * (1 + ru * T)) / (1 + re * T) : spot * Math.pow((1 + ru) / (1 + re), T);
    return { l, T, F, pts: (F - spot) * 1e4, ann: ((F / spot - 1) / T) * 100, ru, re };
  });
  const monthly = useMemo(() => {
    const de = sov.data?.countries.find((c) => c.code === "DE");
    const { dates, m } = align(cl.data ?? null, ["EURUSD", "^TNX"]);
    if (!de || dates.length < 60) return null;
    const last = new Map<string, { fx: number; us: number }>();
    dates.forEach((d, i) => last.set(d.slice(0, 7), { fx: m.EURUSD[i], us: m["^TNX"][i] }));
    const rows = de.hist.map((h) => { const x = last.get(h.d.slice(0, 7)); return x ? { d: h.d.slice(0, 7), de: h.y, us: x.us, fx: x.fx, diff: (x.us - h.y) * 100 } : null; }).filter((x): x is { d: string; de: number; us: number; fx: number; diff: number } => x != null);
    if (rows.length < 12) return null;
    const dd = rows.slice(1).map((r, i) => r.diff - rows[i].diff);
    const df = rows.slice(1).map((r, i) => (r.fx / rows[i].fx - 1) * 100);
    const b = slope(dd.map((x) => x / 10), df);
    const lv = corr(rows.map((r) => r.diff), rows.map((r) => r.fx));
    return { rows, cChg: corr(dd, df), beta: b, cLvl: lv };
  }, [sov.data, cl.data]);
  const d2 = diff.find((x) => x.l === "2Y"), d10 = diff.find((x) => x.l === "10Y"), c1 = cip.find((x) => x.l === "1Y");
  return (
    <PanelShell code="XCCY" title="美元—欧元利差与理论远期" onClose={onClose} tabs={[["diff", "期限利差"], ["cip", "理论远期（零基差）"], ["link", "利差与汇率联动"]]} tab={tab} setTab={setTab} right={cv.data?.euDate ? <span>欧元区曲线 {cv.data.euDate}</span> : null}>
      <Kpis items={[["欧元/美元", fmtPrice(spot, 5), fmtPct(t?.changePct)], ["2 年美—欧利差", d2?.d == null ? "—" : `${bp(d2.d, 0)} bp`, "美债 − 欧元区 AAA"], ["10 年美—欧利差", d10?.d == null ? "—" : `${bp(d10.d, 0)} bp`], ["1 年理论远期点", c1?.pts == null ? "—" : `${bp(c1.pts, 1)} 点`, c1?.F != null ? `远期 ${c1.F.toFixed(5)}` : undefined]]} />
      {tab === "diff" && <>
        <SectionHead title="逐期限政府曲线利差" sub={us ? `美债 ${us.date}` : undefined} />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>期限</th><th className={TH}>美债 %</th><th className={TH}>欧元区 AAA %</th><th className={TH}>利差 bp</th></tr></thead>
          <tbody>{diff.map((r) => <tr key={r.l} className={ROW}><td className={`${TDL} text-slate-100`}>{r.l}</td><td className={`${TD} text-white`}>{f2(r.us, 3)}</td><td className={`${TD} text-slate-300`}>{f2(r.eu, 3)}</td><td className={TD} style={{ background: heat(r.d, 250) }}>{bp(r.d, 0)}</td></tr>)}</tbody></table>
        {diff.some((r) => r.d != null) ? <><Lines series={[{ name: "美债", color: "#38bdf8", values: diff.map((r) => r.us) }, { name: "欧元区 AAA", color: "#fbbf24", values: diff.map((r) => r.eu) }]} xLabels={diff.map((r) => r.l)} height={150} fmt={(v) => v.toFixed(2)} /><Bars data={diff.map((r) => ({ k: r.l, v: r.d ?? 0 }))} fmt={(v) => `${v.toFixed(0)} bp`} height={110} /></> : <Empty loading={cv.loading} />}
        <Note>利差曲线前端主要反映两地政策利率路径差异，后端反映期限溢价与增长 / 通胀预期差异。</Note>
      </>}
      {tab === "cip" && <>
        <SectionHead title="抛补利率平价下的欧元/美元理论远期" sub="1 年以内单利、1 年以上年复利；政府曲线作为两地无风险利率" />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>期限</th><th className={TH}>美元利率</th><th className={TH}>欧元利率</th><th className={TH}>理论远期</th><th className={TH}>远期点</th><th className={TH}>年化对冲收益（买欧元远期）</th></tr></thead>
          <tbody>{cip.map((r) => <tr key={r.l} className={ROW}><td className={`${TDL} text-slate-100`}>{r.l}</td><td className={`${TD} text-slate-300`}>{r.ru != null ? (r.ru * 100).toFixed(3) : "—"}</td><td className={`${TD} text-slate-300`}>{r.re != null ? (r.re * 100).toFixed(3) : "—"}</td><td className={`${TD} text-white`}>{r.F != null ? r.F.toFixed(5) : "—"}</td><td className={TD} style={{ color: toneOf(r.pts) }}>{bp(r.pts, 1)}</td><td className={TD} style={{ color: toneOf(r.ann) }}>{r.ann != null ? `${r.ann > 0 ? "+" : ""}${r.ann.toFixed(3)}%` : "—"}</td></tr>)}</tbody></table>
        {cip.some((r) => r.pts != null) && <Bars data={cip.map((r) => ({ k: r.l, v: r.pts ?? 0 }))} fmt={(v) => `${v.toFixed(1)} 点`} height={120} />}
        <Note>交叉货币基差（实际远期相对理论远期的偏离）无公开逐期报价，本页给出零基差理论值：远期点为正 = 美元利率高于欧元，欧元远期升水；欧元区投资者对冲美元资产时，年化对冲成本约等于两地利差。</Note>
      </>}
      {tab === "link" && <>
        {!monthly ? <Empty loading={sov.loading || cl.loading} /> : <>
          <Kpis items={[["月度变动相关系数", f2(monthly.cChg, 2), "Δ利差 vs 欧元/美元月涨跌"], ["敏感度", monthly.beta != null ? `${monthly.beta.toFixed(2)}%` : "—", "利差每扩大 10bp 对应欧元/美元月涨跌"], ["水平相关系数", f2(monthly.cLvl, 2), `${monthly.rows.length} 个月`], ["最新 10 年利差", `${bp(lastOfArr(monthly.rows)?.diff, 0)} bp`, lastOfArr(monthly.rows)?.d]]} />
          <SectionHead title="美德 10 年期国债利差（bp，月度）" />
          <Lines series={[{ name: "10 年利差", color: "#fbbf24", values: monthly.rows.map((r) => r.diff) }]} xLabels={monthly.rows.map((r) => r.d)} height={140} fmt={(v) => v.toFixed(0)} />
          <SectionHead title="欧元/美元（月末）" />
          <Lines series={[{ name: "欧元/美元", color: "#38bdf8", values: monthly.rows.map((r) => r.fx) }]} xLabels={monthly.rows.map((r) => r.d)} height={140} fmt={(v) => v.toFixed(3)} />
          <Note>理论上美—欧利差扩大利多美元（欧元/美元下跌），相关系数为负即符合利差驱动；接近零或为正说明汇率主要由其他因素（风险偏好、增长差、能源价格）主导。</Note>
        </>}
      </>}
    </PanelShell>
  );
}
const lastOfArr = <T,>(a: T[]) => (a.length ? a[a.length - 1] : undefined);

/* ================================================================== FXFC 外汇预测区间 */
const FC_PAIRS = ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCNH", "USDCAD", "USDCHF", "NZDUSD"];
const FC_H: Array<[string, number]> = [["1 个月", 21], ["3 个月", 63], ["6 个月", 126], ["1 年", 252]];
const Q5 = [0.05, 0.25, 0.5, 0.75, 0.95];
function horizonQ(c: number[], h: number) {
  const r: number[] = [];
  for (let i = h; i < c.length; i++) r.push(Math.log(c[i] / c[i - h]));
  return { q: Q5.map((p) => quantile(r, p)), n: r.length, all: r };
}

export function FxfcLive({ onClose }: P) {
  const [tab, setTab] = useState("range");
  const [h, setH] = useState("63");
  const [pair, setPair] = useState("EURUSD");
  const cl = useCloses(FC_PAIRS, 2600);
  const ticks = useTicks(FC_PAIRS);
  const { pick } = useHub();
  const closes = (s: string) => (cl.data?.[s] ?? []).map((x) => x[1]).filter((v) => v > 0);
  const spotOf = (s: string) => ticks[s]?.price ?? lastOfArr(closes(s)) ?? null;
  const H = Number(h);
  const table = useMemo(() => FC_PAIRS.map((s) => { const c = (cl.data?.[s] ?? []).map((x) => x[1]).filter((v) => v > 0); return { s, c, hq: c.length > H + 50 ? horizonQ(c, H) : null }; }), [cl.data, H]);
  const mom = useMemo(() => FC_PAIRS.map((s) => {
    const c = (cl.data?.[s] ?? []).map((x) => x[1]).filter((v) => v > 0);
    if (c.length < 260) return { s, c, r21: null, r63: null, r252: null, pct63: null, ma50: null, ma200: null, hi: null, lo: null, years: 0 };
    const r63 = Math.log(c[c.length - 1] / c[c.length - 64]);
    const hist = horizonQ(c, 63).all;
    const ma = (n: number) => mean(c.slice(-n));
    const y = c.slice(-252);
    return { s, c, r21: perf(c, 21), r63: perf(c, 63), r252: perf(c, 252), pct63: pctRank(hist, r63), ma50: ma(50), ma200: ma(200), hi: Math.max(...y), lo: Math.min(...y), years: c.length / 252 };
  }), [cl.data]);
  const cone = useMemo(() => { const c = closes(pair); const hs = [5, 10, 21, 42, 63, 126, 252]; return c.length > 300 ? hs.map((x) => ({ h: x, q: horizonQ(c, x).q })) : null; }, [cl.data, pair]);
  const sp = spotOf(pair);
  const years = (mom.find((m) => m.s === "EURUSD")?.years ?? 0).toFixed(1);
  return (
    <PanelShell code="FXFC" title="外汇预测区间" onClose={onClose} tabs={[["range", "期限区间"], ["cone", "单一货币对区间锥"], ["trend", "趋势与动量"]]} tab={tab} setTab={setTab} right={<span>样本约 {years} 年日线</span>}>
      {tab === "range" && <>
        <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><span className="text-[10px] text-slate-500">预测期限</span><Seg value={h} onChange={setH} options={FC_H.map(([l, v]) => [String(v), l] as [string, string])} /></div>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币对</th><th className={TH}>实时</th><th className={TH}>5% 分位</th><th className={TH}>25%</th><th className={TH}>中位</th><th className={TH}>75%</th><th className={TH}>95% 分位</th><th className={TH}>90% 区间宽度</th><th className={TH}>样本窗口</th></tr></thead>
          <tbody>{table.map(({ s, hq }) => { const spt = spotOf(s); const lv = hq && spt ? hq.q.map((q) => (q == null ? null : spt * Math.exp(q))) : null; const dg = digitsOf(spt); return <tr key={s} onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{zh(s)}</td><td className={`${TD} text-white`} style={{ color: toneOf(ticks[s]?.changePct) }}>{fmtPrice(spt, dg)}</td>{(lv ?? [null, null, null, null, null]).map((v, i) => <td key={i} className={TD} style={{ color: i === 2 ? "#e2e8f0" : i < 2 ? "#1fbf75" : "#f2495c" }}>{v == null ? "—" : v.toFixed(dg)}</td>)}<td className={`${TD} text-amber-200`}>{hq && hq.q[0] != null && hq.q[4] != null ? `${((Math.exp(hq.q[4]) - Math.exp(hq.q[0])) * 100).toFixed(1)}%` : "—"}</td><td className={`${TD} text-slate-500`}>{hq?.n ?? "—"}</td></tr>; })}
            {cl.loading && !cl.data && <tr><td colSpan={9}><Empty loading /></td></tr>}</tbody></table>
        <Note>口径：对每个货币对近 10 年每一个同长度滚动区间的真实对数收益取分位数，套用到实时价格得到价格区间；不使用机构预测，也不假设正态分布。点行查看 K 线。</Note>
      </>}
      {tab === "cone" && <>
        <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><Seg value={pair} onChange={setPair} options={FC_PAIRS.map((s) => [s, zh(s)] as [string, string])} /></div>
        {!cone || sp == null ? <Empty loading={cl.loading} /> : <>
          <SectionHead title={`${zh(pair)} 未来 1 周至 1 年价格区间锥`} sub={`实时 ${sp.toFixed(digitsOf(sp))}`} />
          <Lines series={Q5.map((p, i) => ({ name: `${(p * 100).toFixed(0)}%`, color: ["#1fbf75", "#34d399", "#e2e8f0", "#fb923c", "#f2495c"][i], dash: i === 0 || i === 4, values: cone.map((x) => (x.q[i] == null ? null : sp * Math.exp(x.q[i]!))) }))} xLabels={cone.map((x) => `${x.h}日`)} height={180} fmt={(v) => v.toFixed(digitsOf(sp))} />
          <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>交易日</th>{Q5.map((p) => <th key={p} className={TH}>{(p * 100).toFixed(0)}%</th>)}<th className={TH}>中位漂移</th></tr></thead>
            <tbody>{cone.map((x) => <tr key={x.h} className={ROW}><td className={`${TDL} text-slate-100`}>{x.h}</td>{x.q.map((q, i) => <td key={i} className={TD}>{q == null ? "—" : (sp * Math.exp(q)).toFixed(digitsOf(sp))}</td>)}<td className={TD} style={{ color: toneOf(x.q[2]) }}>{x.q[2] == null ? "—" : `${(x.q[2] * 100).toFixed(2)}%`}</td></tr>)}</tbody></table>
          <SectionHead title="近一年走势" />
          <Lines series={[{ name: zh(pair), color: "#38bdf8", values: closes(pair).slice(-252) }]} height={140} fmt={(v) => v.toFixed(digitsOf(sp))} />
        </>}
      </>}
      {tab === "trend" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币对</th><th className={TH}>1 月</th><th className={TH}>3 月</th><th className={TH}>1 年</th><th className={TH}>3 月动量历史分位</th><th className={TH}>距 50 日均线</th><th className={TH}>距 200 日均线</th><th className={THL}>均线状态</th><th className="px-2">一年区间位置</th><th className="px-2">近一年</th></tr></thead>
          <tbody>{mom.map((m) => { const spt = spotOf(m.s); const d50 = spt && m.ma50 ? (spt / m.ma50 - 1) * 100 : null; const d200 = spt && m.ma200 ? (spt / m.ma200 - 1) * 100 : null; const st = spt && m.ma50 && m.ma200 ? (spt > m.ma50 && m.ma50 > m.ma200 ? ["多头排列", "#f2495c"] : spt < m.ma50 && m.ma50 < m.ma200 ? ["空头排列", "#1fbf75"] : ["震荡", "#94a3b8"]) : ["—", "#94a3b8"]; return <tr key={m.s} onClick={() => pick(m.s)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{zh(m.s)}</td><td className={TD} style={{ color: toneOf(m.r21) }}>{sgn(m.r21)}</td><td className={TD} style={{ color: toneOf(m.r63) }}>{sgn(m.r63)}</td><td className={TD} style={{ color: toneOf(m.r252) }}>{sgn(m.r252)}</td><td className={TD} style={{ background: heat(m.pct63 != null ? m.pct63 - 50 : null, 50) }}>{f2(m.pct63, 0, "%")}</td><td className={TD} style={{ color: toneOf(d50) }}>{sgn(d50)}</td><td className={TD} style={{ color: toneOf(d200) }}>{sgn(d200)}</td><td className={TDL} style={{ color: st[1] }}>{st[0]}</td><td className="px-2"><RangeBar lo={m.lo} hi={m.hi} v={spt} /></td><td className="px-2"><MiniLine values={m.c.slice(-252)} /></td></tr>; })}</tbody></table>
        <Note>3 月动量历史分位：当前 63 日收益在该货币对历史所有 63 日收益中的位置，接近 0% / 100% 代表处于历史极端。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== FXDS 外汇价差分析 */
const CROSS: Array<{ s: string; a: string; b: string; op: "*" | "/" }> = [
  { s: "EURJPY", a: "EURUSD", b: "USDJPY", op: "*" }, { s: "EURGBP", a: "EURUSD", b: "GBPUSD", op: "/" }, { s: "GBPJPY", a: "GBPUSD", b: "USDJPY", op: "*" }, { s: "AUDJPY", a: "AUDUSD", b: "USDJPY", op: "*" },
  { s: "EURCHF", a: "EURUSD", b: "USDCHF", op: "*" }, { s: "CADJPY", a: "USDJPY", b: "USDCAD", op: "/" }, { s: "AUDNZD", a: "AUDUSD", b: "NZDUSD", op: "/" }, { s: "EURAUD", a: "EURUSD", b: "AUDUSD", op: "/" },
  { s: "CHFJPY", a: "USDJPY", b: "USDCHF", op: "/" }, { s: "GBPCHF", a: "GBPUSD", b: "USDCHF", op: "*" }, { s: "NZDJPY", a: "NZDUSD", b: "USDJPY", op: "*" }, { s: "EURCAD", a: "EURUSD", b: "USDCAD", op: "*" },
];
const RV_PAIRS: Array<[string, string, string]> = [["AUDUSD", "NZDUSD", "澳元 vs 纽元"], ["EURUSD", "GBPUSD", "欧元 vs 英镑"], ["EURUSD", "USDCHF", "欧元 vs 瑞郎"], ["USDCAD", "CL", "加元 vs 原油"], ["AUDUSD", "HG", "澳元 vs 铜"], ["USDJPY", "^TNX", "日元 vs 10 年美债收益率"], ["USDCNH", "USDKRW", "人民币 vs 韩元"], ["USDMXN", "USDBRL", "墨西哥比索 vs 巴西雷亚尔"]];
const RV_SYMS = [...new Set(RV_PAIRS.flatMap(([a, b]) => [a, b]))];
const pipOf = (s: string) => (s.endsWith("JPY") ? 0.01 : 0.0001);

export function FxdsLive({ onClose }: P) {
  const [tab, setTab] = useState("tri");
  const [sel, setSel] = useState(0);
  const syms = useMemo(() => [...new Set([...CROSS.flatMap((c) => [c.s, c.a, c.b]), ...RV_SYMS])], []);
  const ticks = useTicks(syms);
  const cl = useCloses(RV_SYMS, 420);
  const { pick } = useHub();
  const tri = CROSS.map((c) => {
    const q = ticks[c.s], a = ticks[c.a], b = ticks[c.b];
    const imp = a?.price && b?.price ? (c.op === "*" ? a.price * b.price : a.price / b.price) : null;
    const dev = q?.price && imp ? (q.price - imp) / pipOf(c.s) : null;
    const impChg = a?.changePct != null && b?.changePct != null ? (c.op === "*" ? (1 + a.changePct / 100) * (1 + b.changePct / 100) - 1 : (1 + a.changePct / 100) / (1 + b.changePct / 100) - 1) * 100 : null;
    const lag = q?.time && a?.time && b?.time ? (Math.max(q.time, a.time, b.time) - Math.min(q.time, a.time, b.time)) / 1000 : null;
    return { ...c, q, imp, dev, impChg, lag };
  });
  const rv = useMemo(() => RV_PAIRS.map(([a, b, l]) => {
    const { dates, m } = align(cl.data ?? null, [a, b]);
    if (dates.length < 120) return { a, b, l, ok: false as const };
    const la = m[a].slice(-250).map(Math.log), lb = m[b].slice(-250).map(Math.log);
    const beta = slope(lb, la);
    if (beta == null) return { a, b, l, ok: false as const };
    const s = la.map((x, i) => x - beta * lb[i]);
    const zs = s.map((_, i) => { if (i < 59) return null; const w = s.slice(i - 59, i + 1); const sd = std(w); return sd ? (s[i] - mean(w)) / sd : null; });
    const w60 = s.slice(-60), m60 = mean(w60), sd60 = std(w60);
    const ds = s.slice(1).map((x, i) => x - s[i]);
    const phi = slope(s.slice(0, -1), ds);
    const hl = phi != null && phi < 0 ? -Math.log(2) / Math.log(1 + phi) : null;
    const c = corr(rets(m[a].slice(-250)), rets(m[b].slice(-250)));
    return { a, b, l, ok: true as const, beta, s, zs, m60, sd60, hl, c, dates: dates.slice(-250) };
  }), [cl.data]);
  const liveZ = (r: (typeof rv)[number]) => { if (!r.ok) return null; const pa = ticks[r.a]?.price, pb = ticks[r.b]?.price; if (!pa || !pb || !r.sd60) return null; return (Math.log(pa) - r.beta * Math.log(pb) - r.m60) / r.sd60; };
  const cur = rv[sel];
  const maxDev = tri.reduce((m, r) => (r.dev != null && Math.abs(r.dev) > Math.abs(m ?? 0) ? r.dev : m), null as number | null);
  const ext = rv.filter((r) => r.ok && Math.abs(liveZ(r) ?? 0) > 2).length;
  return (
    <PanelShell code="FXDS" title="外汇价差分析" onClose={onClose} tabs={[["tri", "交叉盘偏离"], ["rv", "配对价差"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["监控交叉盘", `${CROSS.length}`], ["最大偏离", maxDev == null ? "—" : `${bp(maxDev, 1)} 点`], ["配对价差组合", `${RV_PAIRS.length}`, "协整对冲比 + Z 值"], ["|Z| > 2 的组合", `${ext}`]]} />
      {tab === "tri" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>交叉盘</th><th className={TH}>报价</th><th className={TH}>套算</th><th className={TH}>偏离（点）</th><th className={TH}>报价涨跌</th><th className={TH}>套算涨跌</th><th className={THL}>两腿</th><th className={TH}>报价时差（秒）</th></tr></thead>
          <tbody>{tri.map((r) => { const dg = r.s.endsWith("JPY") ? 3 : 5; return <tr key={r.s} onClick={() => pick(r.s)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{zh(r.s)}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className={`${TD} text-white`}>{fmtPrice(r.q?.price, dg)}</td><td className={`${TD} text-slate-300`}>{r.imp != null ? r.imp.toFixed(dg) : "—"}</td><td className={TD} style={{ background: heat(r.dev, 5) }}>{bp(r.dev, 1)}</td><td className={TD} style={{ color: toneOf(r.q?.changePct) }}>{fmtPct(r.q?.changePct)}</td><td className={TD} style={{ color: toneOf(r.impChg) }}>{fmtPct(r.impChg)}</td><td className={`${TDL} font-mono text-[10px] text-slate-500`}>{r.a} · {r.b}</td><td className={`${TD} text-slate-500`}>{r.lag != null ? r.lag.toFixed(0) : "—"}</td></tr>; })}</tbody></table>
        <Note>套算 = 两个对美元货币对的实时中间价相乘 / 相除。偏离主要来自各腿报价时间不同步与点差，持续偏离较大说明交叉盘流动性较弱或报价滞后。点行查看 K 线。</Note>
      </>}
      {tab === "rv" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>组合</th><th className={TH}>对冲比 β</th><th className={TH}>收益相关</th><th className={TH}>60 日 Z（收盘）</th><th className={TH}>实时 Z</th><th className={TH}>半衰期（日）</th><th className="px-2">Z 值走势</th></tr></thead>
          <tbody>{rv.map((r, i) => { const lz = liveZ(r); const lastZ = r.ok ? lastOfArr(r.zs) ?? null : null; return <tr key={r.l} onClick={() => setSel(i)} className={`cursor-pointer ${ROW} ${sel === i ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.a}/{r.b}</span></td><td className={TD}>{r.ok ? r.beta.toFixed(3) : "—"}</td><td className={TD}>{r.ok ? f2(r.c, 2) : "—"}</td><td className={TD} style={{ background: heat(lastZ, 3) }}>{f2(lastZ, 2)}</td><td className={TD} style={{ background: heat(lz, 3) }}>{f2(lz, 2)}</td><td className={TD}>{r.ok && r.hl != null ? r.hl.toFixed(0) : "不回归"}</td><td className="px-2">{r.ok ? <MiniLine values={r.zs.slice(-120)} /> : "—"}</td></tr>; })}
            {cl.loading && !cl.data && <tr><td colSpan={7}><Empty loading /></td></tr>}</tbody></table>
        {cur?.ok && <><SectionHead title={`${cur.l}：价差 Z 值（60 日滚动）`} />
          <Lines series={[{ name: "Z 值", color: "#fbbf24", values: cur.zs }, { name: "+2", color: "#f2495c", dash: true, values: cur.zs.map(() => 2) }, { name: "−2", color: "#1fbf75", dash: true, values: cur.zs.map(() => -2) }]} xLabels={cur.dates.map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(1)} zero /></>}
        <Note>口径：近 250 个交易日对数价格回归得到对冲比；半衰期由价差日变动对前值的回归（均值回归速度）推算。Z 值 &gt; 2 表示前者相对后者偏贵。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== FXTF 外汇资金流向 */
const COT_FX: Array<{ s: string; l: string; size: number; usdQuote: boolean }> = [
  { s: "EURUSD", l: "欧元", size: 125000, usdQuote: false }, { s: "USDJPY", l: "日元", size: 12_500_000, usdQuote: true }, { s: "GBPUSD", l: "英镑", size: 62500, usdQuote: false },
  { s: "USDCHF", l: "瑞郎", size: 125000, usdQuote: true }, { s: "USDCAD", l: "加元", size: 100000, usdQuote: true }, { s: "AUDUSD", l: "澳元", size: 100000, usdQuote: false },
  { s: "NZDUSD", l: "纽元", size: 100000, usdQuote: false }, { s: "USDMXN", l: "墨西哥比索", size: 500000, usdQuote: true },
];
const FX_ETF: Array<[string, string]> = [["FXE", "欧元"], ["FXY", "日元"], ["FXB", "英镑"], ["FXA", "澳元"], ["FXC", "加元"], ["FXF", "瑞郎"], ["UUP", "美元多头"], ["UDN", "美元空头"], ["CEW", "新兴市场货币"]];

function EtfFlowRow({ s, l }: { s: string; l: string }) {
  const k = useKline(s, "1d", 40);
  const t = useTicks([s])[s];
  const { pick } = useHub();
  const cs = k.candles;
  const prev = cs.slice(-21, -1).map((c) => c.v ?? 0).filter((v) => v > 0);
  const avg = prev.length ? mean(prev) : null;
  const vol = t?.volume ?? lastOfArr(cs)?.v ?? null;
  const px = t?.price ?? lastOfArr(cs)?.c ?? null;
  const ratio = vol != null && avg ? vol / avg : null;
  const dollar = vol != null && px != null ? (vol * px) / 1e6 : null;
  const signed = dollar != null && t?.changePct != null ? Math.sign(t.changePct) * dollar : null;
  const cum5 = cs.slice(-5).reduce((acc, c, i, a) => { const p0 = i ? a[i - 1].c : cs[cs.length - 6]?.c; return p0 && c.v ? acc + Math.sign(c.c - p0) * c.v * c.c / 1e6 : acc; }, 0);
  return <tr onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className={`${TD} text-white`}>{fmtPrice(px)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td><td className={`${TD} text-slate-300`}>{vol != null ? vol.toLocaleString() : "—"}</td><td className={TD} style={{ background: heat(ratio != null ? ratio - 1 : null, 1.5) }}>{ratio != null ? `${ratio.toFixed(2)}×` : "—"}</td><td className={`${TD} text-slate-300`}>{dollar != null ? dollar.toFixed(1) : "—"}</td><td className={TD} style={{ color: toneOf(signed) }}>{signed != null ? bp(signed, 1) : "—"}</td><td className={TD} style={{ color: toneOf(cum5) }}>{cs.length > 6 ? bp(cum5, 1) : "—"}</td></tr>;
}

export function FxtfLive({ onClose }: P) {
  const [tab, setTab] = useState("cot");
  const cot = usePolled<CotRow[]>("ucHubs.cot", {}, 3600_000);
  const ticks = useTicks([...COT_FX.map((c) => c.s), "DXY"]);
  const rows = COT_FX.map((c) => {
    const r = (cot.data ?? []).find((x) => x.symbol === c.s);
    const px = ticks[c.s]?.price;
    const usd = (n: number) => (px ? (c.usdQuote ? (n * c.size) / px : n * c.size * px) / 1e9 : null);
    return { ...c, r, lev: r ? usd(r.levNet) : null, am: r ? usd(r.assetMgrNet) : null, dl: r ? usd(r.dealerNet) : null, levChg: r ? usd(r.levNetChg) : null, amChg: r ? usd(r.assetMgrNetChg) : null };
  });
  const dxy = (cot.data ?? []).find((x) => x.symbol === "DXY");
  const usdLev = rows.reduce((s, r) => s - (r.lev ?? 0), 0);
  const usdAm = rows.reduce((s, r) => s - (r.am ?? 0), 0);
  const usdLevChg = rows.reduce((s, r) => s - (r.levChg ?? 0), 0);
  const date = rows.find((r) => r.r)?.r?.date;
  return (
    <PanelShell code="FXTF" title="外汇资金流向" onClose={onClose} tabs={[["cot", "期货持仓流向"], ["usd", "美元名义敞口"], ["etf", "货币 ETF 成交流"]]} tab={tab} setTab={setTab} right={date ? <span>持仓报告日 {date}</span> : null}>
      <Kpis items={[["杠杆基金美元净头寸", `${bp(usdLev, 1)} 十亿美元`, "由各外币期货净头寸折算（正 = 做多美元）"], ["杠杆基金周度变化", `${bp(usdLevChg, 1)} 十亿美元`], ["资管机构美元净头寸", `${bp(usdAm, 1)} 十亿美元`], ["美元指数期货杠杆净头寸", dxy ? dxy.levNet.toLocaleString() : "—", dxy ? `周变动 ${dxy.levNetChg.toLocaleString()} 手` : undefined]]} />
      {tab === "cot" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币（对美元）</th><th className={TH}>未平仓（手）</th><th className={TH}>杠杆基金净（手）</th><th className={TH}>周变动</th><th className={TH}>资管净（手）</th><th className={TH}>周变动</th><th className={TH}>交易商净（手）</th><th className={TH}>杠杆多头占比</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.s} className={ROW}><td className={`${TDL} text-slate-100`}>{x.l}</td><td className={`${TD} text-slate-300`}>{x.r?.oi.toLocaleString() ?? "—"}</td><td className={TD} style={{ color: toneOf(x.r?.levNet) }}>{x.r?.levNet.toLocaleString() ?? "—"}</td><td className={TD} style={{ color: toneOf(x.r?.levNetChg) }}>{x.r?.levNetChg.toLocaleString() ?? "—"}</td><td className={TD} style={{ color: toneOf(x.r?.assetMgrNet) }}>{x.r?.assetMgrNet.toLocaleString() ?? "—"}</td><td className={TD} style={{ color: toneOf(x.r?.assetMgrNetChg) }}>{x.r?.assetMgrNetChg.toLocaleString() ?? "—"}</td><td className={TD} style={{ color: toneOf(x.r?.dealerNet) }}>{x.r?.dealerNet.toLocaleString() ?? "—"}</td><td className={TD} style={{ background: heat(x.r ? x.r.levLongPct - 50 : null, 40) }}>{x.r ? `${x.r.levLongPct.toFixed(1)}%` : "—"}</td></tr>)}
            {!cot.data && <tr><td colSpan={8}><Empty loading={cot.loading} /></td></tr>}</tbody></table>
        <SectionHead title="杠杆基金 / 资管周度净变动（手）" />
        <Bars data={rows.filter((x) => x.r).map((x) => ({ k: x.l, v: x.r!.levNetChg, v2: x.r!.assetMgrNetChg }))} label={["杠杆基金", "资管机构"]} fmt={(v) => v.toLocaleString()} height={130} />
        <Note>方向均为“外币对美元”：净多 = 看多该货币、看空美元。期货持仓为周度公布（周二持仓，周五公布）。</Note>
      </>}
      {tab === "usd" && <>
        <SectionHead title="按实时汇率折算的名义净敞口（十亿美元，正 = 做多外币）" />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币</th><th className={TH}>实时汇率</th><th className={TH}>杠杆基金</th><th className={TH}>周变化</th><th className={TH}>资管机构</th><th className={TH}>周变化</th><th className={TH}>交易商</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.s} className={ROW}><td className={`${TDL} text-slate-100`}>{x.l}</td><td className={`${TD} text-slate-300`}>{fmtPrice(ticks[x.s]?.price, digitsOf(ticks[x.s]?.price))}</td><td className={TD} style={{ background: heat(x.lev, 10) }}>{bp(x.lev, 2)}</td><td className={TD} style={{ color: toneOf(x.levChg) }}>{bp(x.levChg, 2)}</td><td className={TD} style={{ background: heat(x.am, 10) }}>{bp(x.am, 2)}</td><td className={TD} style={{ color: toneOf(x.amChg) }}>{bp(x.amChg, 2)}</td><td className={TD} style={{ color: toneOf(x.dl) }}>{bp(x.dl, 2)}</td></tr>)}</tbody></table>
        <Bars data={rows.map((x) => ({ k: x.l, v: x.lev ?? 0, v2: x.am ?? 0 }))} label={["杠杆基金", "资管机构"]} fmt={(v) => `${v.toFixed(2)} 十亿`} height={140} />
        <Note>合约规模：欧元 12.5 万、日元 1250 万、英镑 6.25 万、瑞郎 12.5 万、加元 / 澳元 / 纽元 10 万、墨西哥比索 50 万（外币单位）。</Note>
      </>}
      {tab === "etf" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币 ETF</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>成交量</th><th className={TH}>量比（20 日）</th><th className={TH}>成交额（百万美元）</th><th className={TH}>方向成交额</th><th className={TH}>近 5 日方向成交额</th></tr></thead>
          <tbody>{FX_ETF.map(([s, l]) => <EtfFlowRow key={s} s={s} l={l} />)}</tbody></table>
        <Note>方向成交额 = 成交额 × 当日涨跌方向，用于观察场内资金的买卖压力；量比 &gt; 1.5 视为放量。点行查看 K 线。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== STNI 外汇实时报价 */
const ST_GROUPS: Array<[string, string[]]> = [["主要货币对", ["DXY", "EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD"]], ["交叉盘", ["EURJPY", "EURGBP", "GBPJPY", "AUDJPY", "EURCHF", "CADJPY"]], ["亚洲货币", ["USDCNH", "USDHKD", "USDSGD", "USDKRW", "USDTWD", "USDINR"]], ["新兴市场", ["USDMXN", "USDBRL", "USDZAR", "USDTRY"]]];
const ST_CCY = ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "NZD", "CAD", "CNH"];
const CCY_ZH: Record<string, string> = { USD: "美元", EUR: "欧元", JPY: "日元", GBP: "英镑", CHF: "瑞郎", AUD: "澳元", NZD: "纽元", CAD: "加元", CNH: "离岸人民币" };
const ST_STRENGTH = ["EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "USDCNH", "EURJPY", "EURGBP", "GBPJPY", "AUDJPY", "EURCHF", "CADJPY", "AUDNZD"];
const ST_INTRA = ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD"];

export function StniLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const ticks = useTicks(ST_STRENGTH);
  const k1 = useKline(tab === "intra" ? ST_INTRA[0] : null, "15m", 96);
  const k2 = useKline(tab === "intra" ? ST_INTRA[1] : null, "15m", 96);
  const k3 = useKline(tab === "intra" ? ST_INTRA[2] : null, "15m", 96);
  const k4 = useKline(tab === "intra" ? ST_INTRA[3] : null, "15m", 96);
  const strength = ST_CCY.map((c) => {
    const v: number[] = [];
    for (const p of ST_STRENGTH) { const ch = ticks[p]?.changePct; if (ch == null) continue; if (p.slice(0, 3) === c) v.push(ch); else if (p.slice(3) === c) v.push(-ch); }
    return { c, v: v.length ? mean(v) : null, n: v.length };
  }).sort((a, b) => (b.v ?? -99) - (a.v ?? -99));
  const intra = useMemo(() => {
    const sets = [k1.candles, k2.candles, k3.candles, k4.candles];
    const maps = sets.map((cs) => new Map(cs.map((c) => [c.t, c.c])));
    const ts = [...new Set(sets.flatMap((cs) => cs.map((c) => c.t)))].sort((a, b) => a - b).filter((t) => maps.every((m) => m.has(t)));
    if (ts.length < 5) return null;
    return { ts, series: maps.map((m) => { const b = m.get(ts[0])!; return ts.map((t) => (m.get(t)! / b - 1) * 100); }) };
  }, [k1.candles, k2.candles, k3.candles, k4.candles]);
  const top = strength[0], bot = strength[strength.length - 1];
  return (
    <PanelShell code="STNI" title="外汇实时报价" onClose={onClose} tabs={[["board", "报价板"], ["strength", "货币强弱"], ["intra", "日内相对走势"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["今日最强货币", top?.v != null ? CCY_ZH[top.c] : "—", top?.v != null ? sgn(top.v, 3) : undefined], ["今日最弱货币", bot?.v != null ? CCY_ZH[bot.c] : "—", bot?.v != null ? sgn(bot.v, 3) : undefined], ["欧元/美元", fmtPrice(ticks.EURUSD?.price, 5), fmtPct(ticks.EURUSD?.changePct)], ["美元/日元", fmtPrice(ticks.USDJPY?.price, 3), fmtPct(ticks.USDJPY?.changePct)]]} />
      {tab === "board" && <LiveBoard rows={ST_GROUPS.flatMap(([g, list]) => list.map((s) => ({ symbol: s, label: zh(s), group: g })))} />}
      {tab === "strength" && <>
        <SectionHead title="货币强弱排名（相对其余货币的平均当日涨跌，%）" sub={`基于 ${ST_STRENGTH.length} 个实时货币对`} />
        <Bars data={strength.map((x) => ({ k: CCY_ZH[x.c], v: x.v ?? 0 }))} fmt={(v) => `${v.toFixed(3)}%`} height={150} />
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>排名</th><th className={THL}>货币</th><th className={TH}>强弱得分</th><th className={TH}>参与货币对</th></tr></thead>
          <tbody>{strength.map((x, i) => <tr key={x.c} className={ROW}><td className={`${TDL} text-slate-500`}>{i + 1}</td><td className={`${TDL} text-slate-100`}>{CCY_ZH[x.c]}</td><td className={TD} style={{ background: heat(x.v, 0.8) }}>{sgn(x.v, 3)}</td><td className={`${TD} text-slate-500`}>{x.n}</td></tr>)}</tbody></table>
      </>}
      {tab === "intra" && <>
        <SectionHead title="近 24 小时 15 分钟相对走势（%，起点归零）" />
        {intra ? <Lines series={ST_INTRA.map((s, i) => ({ name: zh(s), color: COLORS[i], values: intra.series[i] }))} xLabels={intra.ts.map((t) => new Date(t).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" }))} height={200} fmt={(v) => v.toFixed(2)} zero /> : <Empty loading={k1.loading} />}
        <Note>美元/日元上行 = 美元走强；欧元/美元、英镑/美元、澳元/美元上行 = 美元走弱。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== WVOL 全球波动率 */
const VOL_IDX: Array<[string, string]> = [["^VIX", "标普 500 波动率"], ["^VIX3M", "标普 3 个月波动率"], ["^VVIX", "波动率的波动率"], ["^SKEW", "尾部风险指数"], ["^MOVE", "美债期权波动率"], ["^OVX", "原油波动率"], ["^GVZ", "黄金波动率"]];
const WV_ETF: Array<[string, string]> = [["FXE", "欧元"], ["FXY", "日元"], ["FXB", "英镑"], ["FXA", "澳元"], ["FXC", "加元"], ["FXF", "瑞郎"], ["UUP", "美元指数"], ["CEW", "新兴市场货币"]];
const WV_PAIRS = ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "USDCNH", "USDMXN", "USDBRL", "EURJPY", "EURGBP"];
const WV_WIN = [10, 21, 63, 126];

export function WvolLive({ onClose }: P) {
  const [tab, setTab] = useState("cross");
  const [sel, setSel] = useState("USDJPY");
  const vix = useCloses(VOL_IDX.map(([s]) => s), 300);
  const ticks = useTicks(VOL_IDX.map(([s]) => s));
  const iv = usePolled<IvRow[]>("ucHubs.ivScan", tab === "fxiv" ? { symbols: WV_ETF.map(([s]) => s) } : null, 300_000);
  const px = useCloses(tab === "cone" ? WV_PAIRS : [], 800);
  const { pick } = useHub();
  const vrows = VOL_IDX.map(([s, l]) => {
    const c = (vix.data?.[s] ?? []).map((x) => x[1]);
    const y = c.slice(-252);
    const live = ticks[s]?.price ?? lastOfArr(c) ?? null;
    return { s, l, c: y, live, chg: ticks[s]?.changePct ?? null, m1: perf(c, 21), pct: live != null && y.length > 20 ? pctRank(y, live) : null, lo: y.length ? Math.min(...y) : null, hi: y.length ? Math.max(...y) : null, med: y.length ? quantile(y, 0.5) : null };
  });
  const v1 = vrows[0].live, v3 = vrows[1].live;
  const cone = useMemo(() => WV_PAIRS.map((s) => {
    const c = (px.data?.[s] ?? []).map((x) => x[1]).filter((v) => v > 0);
    if (c.length < 200) return { s, w: null as null | Array<{ n: number; now: number | null; pct: number | null; lo: number | null; med: number | null; hi: number | null }>, c };
    return { s, c, w: WV_WIN.map((n) => { const rv = rollingVol(c, n).filter((x): x is number => x != null); const now = annVol(c, n); return { n, now, pct: now != null ? pctRank(rv, now) : null, lo: rv.length ? Math.min(...rv) : null, med: quantile(rv, 0.5), hi: rv.length ? Math.max(...rv) : null }; }) };
  }), [px.data]);
  const selRow = cone.find((r) => r.s === sel);
  return (
    <PanelShell code="WVOL" title="全球波动率监控" onClose={onClose} tabs={[["cross", "跨资产波动率"], ["fxiv", "货币期权隐波"], ["cone", "货币对实现波动锥"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["标普波动率", fmtPrice(v1, 2), vrows[0].pct != null ? `一年分位 ${vrows[0].pct.toFixed(0)}%` : undefined], ["期限结构 VIX / VIX3M", v1 && v3 ? (v1 / v3).toFixed(3) : "—", v1 && v3 ? (v1 / v3 > 1 ? "倒挂：短期恐慌" : "正常升水") : undefined], ["美债期权波动率", fmtPrice(vrows[4].live, 1), vrows[4].pct != null ? `一年分位 ${vrows[4].pct.toFixed(0)}%` : undefined], ["原油 / 黄金波动率", `${fmtPrice(vrows[5].live, 1)} / ${fmtPrice(vrows[6].live, 1)}`]]} />
      {tab === "cross" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>指数</th><th className={TH}>实时</th><th className={TH}>今日</th><th className={TH}>1 月变化</th><th className={TH}>一年中位</th><th className={TH}>一年分位</th><th className="px-2">一年区间</th><th className="px-2">一年走势</th></tr></thead>
          <tbody>{vrows.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className={`${TD} text-white`}>{fmtPrice(r.live, 2)}</td><td className={TD} style={{ color: toneOf(r.chg) }}>{fmtPct(r.chg)}</td><td className={TD} style={{ color: toneOf(r.m1) }}>{sgn(r.m1)}</td><td className={`${TD} text-slate-400`}>{f2(r.med, 2)}</td><td className={TD} style={{ background: heat(r.pct != null ? r.pct - 50 : null, 50) }}>{f2(r.pct, 0, "%")}</td><td className="px-2"><RangeBar lo={r.lo} hi={r.hi} v={r.live} /></td><td className="px-2"><MiniLine values={r.c} /></td></tr>)}</tbody></table>
        <SectionHead title="波动率指数一年走势（以一年中位数为 100）" />
        <Lines series={vrows.filter((r) => r.s !== "^SKEW" && r.med).map((r, i) => ({ name: r.l, color: COLORS[i], values: r.c.map((v) => (v / r.med!) * 100) }))} height={180} fmt={(v) => v.toFixed(0)} />
      </>}
      {tab === "fxiv" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币 ETF</th><th className={TH}>30 日隐波</th><th className={TH}>隐波变动</th><th className={TH}>20 日实波</th><th className={TH}>60 日实波</th><th className={TH}>120 日实波</th><th className={TH}>隐波 − 实波</th><th className={TH}>隐波 / 实波</th><th className={TH}>隐波排名</th><th className={TH}>隐波分位</th></tr></thead>
          <tbody>{WV_ETF.map(([s, l]) => { const r = (iv.data ?? []).find((x) => x.symbol === s); return <tr key={s} onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className={`${TD} text-white`}>{f2(r?.iv30, 2)}</td><td className={TD} style={{ color: toneOf(r?.iv30Chg) }}>{bp(r?.iv30Chg, 2)}</td><td className={`${TD} text-slate-300`}>{f2(r?.rv20, 2)}</td><td className={`${TD} text-slate-300`}>{f2(r?.rv60, 2)}</td><td className={`${TD} text-slate-400`}>{f2(r?.rv120, 2)}</td><td className={TD} style={{ background: heat(r?.ivRv, 4) }}>{bp(r?.ivRv, 2)}</td><td className={TD}>{r?.iv30 != null && r?.rv20 ? (r.iv30 / r.rv20).toFixed(2) : "—"}</td><td className={TD}>{r?.ivRank != null ? `${r.ivRank.toFixed(0)}` : "—"}</td><td className={TD}>{r?.ivPct != null ? `${r.ivPct.toFixed(0)}%` : "—"}</td></tr>; })}
            {!iv.data && <tr><td colSpan={10}><Empty loading={iv.loading} /></td></tr>}</tbody></table>
        {iv.data && <Bars data={WV_ETF.map(([s, l]) => { const r = iv.data!.find((x) => x.symbol === s); return { k: l, v: r?.iv30 ?? 0, v2: r?.rv20 ?? 0 }; })} label={["30 日隐波", "20 日实波"]} fmt={(v) => v.toFixed(2)} height={140} />}
        <Note>隐波 − 实波 &gt; 0：期权相对实际波动偏贵（卖方占优）；隐波排名 / 分位基于平台累积的历史隐波序列，样本较短时仅供参考。</Note>
      </>}
      {tab === "cone" && <>
        <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>货币对</th>{WV_WIN.map((n) => <th key={n} className={TH}>{n} 日实波</th>)}{WV_WIN.map((n) => <th key={`p${n}`} className={TH}>{n} 日分位</th>)}<th className="px-2">21 日区间位置</th></tr></thead>
          <tbody>{cone.map((r) => <tr key={r.s} onClick={() => setSel(r.s)} className={`cursor-pointer ${ROW} ${sel === r.s ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{zh(r.s)}</td>{WV_WIN.map((_, i) => <td key={i} className={`${TD} text-white`}>{f2(r.w?.[i].now, 2)}</td>)}{WV_WIN.map((_, i) => <td key={`p${i}`} className={TD} style={{ background: heat(r.w?.[i].pct != null ? r.w[i].pct! - 50 : null, 50) }}>{f2(r.w?.[i].pct, 0, "%")}</td>)}<td className="px-2"><RangeBar lo={r.w?.[1].lo ?? null} hi={r.w?.[1].hi ?? null} v={r.w?.[1].now ?? null} /></td></tr>)}
            {px.loading && !px.data && <tr><td colSpan={10}><Empty loading /></td></tr>}</tbody></table>
        {selRow?.w && <><SectionHead title={`${zh(sel)} 滚动实现波动（年化 %）`} />
          <Lines series={[{ name: "21 日", color: "#fbbf24", values: rollingVol(selRow.c, 21).slice(-500) }, { name: "63 日", color: "#38bdf8", values: rollingVol(selRow.c, 63).slice(-500) }]} height={160} fmt={(v) => v.toFixed(1)} />
          <table className="w-full text-[11px]"><thead className={thead}><tr><th className={THL}>窗口</th><th className={TH}>最小</th><th className={TH}>中位</th><th className={TH}>最大</th><th className={TH}>当前</th></tr></thead>
            <tbody>{selRow.w.map((w) => <tr key={w.n} className={ROW}><td className={`${TDL} text-slate-100`}>{w.n} 日</td><td className={`${TD} text-[#1fbf75]`}>{f2(w.lo, 2)}</td><td className={`${TD} text-slate-300`}>{f2(w.med, 2)}</td><td className={`${TD} text-[#f2495c]`}>{f2(w.hi, 2)}</td><td className={`${TD} text-white`}>{f2(w.now, 2)}</td></tr>)}</tbody></table></>}
        <Note>口径：约三年真实日线的滚动年化实现波动；分位表示当前值在历史滚动值中的位置。</Note>
      </>}
    </PanelShell>
  );
}
