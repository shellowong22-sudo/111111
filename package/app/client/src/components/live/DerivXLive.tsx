/**
 * 衍生品补充两个功能（全部接真实数据）：
 *  - SWPM 掉期估值：用 SOFR 期货条推算的隔夜指数互换平价利率（短端）+ 美债收益率加最近可观测互换利差（长端）构建当日曲线，
 *         对用户自定义的固定—浮动互换估值：现值、平价利率、DV01、关键期限 DV01、逐期现金流、曲线情景；互换簿永久保存。
 *         （对冲下单在电子交易 IRSWAP，市场曲线本身在 USSW，这里只做单笔 / 自有互换的估值。）
 *  - MOSO 最活跃期权：跨主要标的的真实期权链，按成交量排名合约、各标的看跌 / 看涨比与成交 / 持仓比，异动合约汇总。
 *         （单一标的的期权链与异动明细在衍生品中心 OMON / UOA。）
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, ucGet } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { f2, heat, sgn } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { Note, ROW, TD, TDL, TH, THL, useCurves, yieldFn, type P } from "./LiveCommon";
import { buildOis, parRate, useMM } from "./RatesFxLive";

const INP = "w-24 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white outline-none";
const BTN = "border border-[#2a3c52] px-2 py-0.5 text-[11px] text-slate-200 hover:bg-[#0a1726] disabled:opacity-40";

/* ================================================================== SWPM 掉期估值 */
const NODES: Array<[string, number]> = [["1M", 1 / 12], ["3M", 0.25], ["6M", 0.5], ["1Y", 1], ["2Y", 2], ["3Y", 3], ["5Y", 5], ["7Y", 7], ["10Y", 10], ["20Y", 20], ["30Y", 30]];
const TENOR_OPTS: Array<[string, number]> = [["1Y", 1], ["2Y", 2], ["3Y", 3], ["5Y", 5], ["7Y", 7], ["10Y", 10], ["15Y", 15], ["20Y", 20], ["30Y", 30]];
type Node = { t: number; s: number; src: "互换" | "美债+利差" };
type Swap = { id: string; name: string; notional: number; fixed: number; tenor: number; freq: number; side: "pay" | "rec" };

function parAt(nodes: Node[], t: number) {
  if (!nodes.length) return null;
  if (t <= nodes[0].t) return nodes[0].s;
  for (let i = 1; i < nodes.length; i++) if (t <= nodes[i].t) { const a = nodes[i - 1], b = nodes[i]; return a.s + ((b.s - a.s) * (t - a.t)) / (b.t - a.t); }
  return nodes[nodes.length - 1].s;
}
/** 由平价利率逐期自举贴现因子（每期 1/f 年） */
function dfs(nodes: Node[], tenor: number, f: number, bump: (t: number) => number = () => 0) {
  const n = Math.round(tenor * f);
  const out: number[] = [];
  let ann = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / f;
    const s = ((parAt(nodes, t) ?? 0) + bump(t)) / 100;
    const df = (1 - (s / f) * ann) / (1 + s / f);
    out.push(df);
    ann += df;
  }
  return out;
}
function value(sw: Swap, nodes: Node[], bump?: (t: number) => number) {
  const d = dfs(nodes, sw.tenor, sw.freq, bump);
  if (!d.length) return null;
  const A = d.reduce((s, x) => s + x, 0) / sw.freq;
  const floatPv = 1 - d[d.length - 1];
  const sign = sw.side === "pay" ? 1 : -1;
  return { npv: sign * sw.notional * (floatPv - (sw.fixed / 100) * A), par: (floatPv / A) * 100, annuity: A, d };
}
const tri = (center: number, left: number, right: number) => (t: number) => (t <= left || t >= right ? 0 : t <= center ? (t - left) / (center - left) : (right - t) / (right - center)) * 0.01;

export function SwpmLive({ onClose }: P) {
  const mm = useMM();
  const cv = useCurves();
  const [tab, setTab] = useState("val");
  const [sw, setSw] = useState<Swap>({ id: "", name: "", notional: 10_000_000, fixed: 0, tenor: 5, freq: 1, side: "pay" });
  const saved = useSaved<Swap[]>("swpm-book");
  const [local, setLocal] = useState<Swap[] | null>(null);
  const book = local ?? saved.data ?? [];
  const sofr = mm.data?.series.SOFR?.[mm.data.series.SOFR.length - 1];
  const ois = useMemo(() => buildOis(mm.data?.sofrStrip ?? [], sofr?.v ?? null, false), [mm.data, sofr?.v]);
  const ust = useMemo(() => (cv.data?.us[0] ? yieldFn(cv.data.us[0].points) : null), [cv.data]);
  const nodes = useMemo<Node[]>(() => {
    if (!ust) return [];
    const cover = ois ? ois.maxDays / 365 : 0;
    const swapNodes = NODES.filter(([, t]) => t <= cover).map(([, t]) => ({ t, s: parRate(ois, t)! })).filter((x) => x.s != null && Number.isFinite(x.s));
    const last = swapNodes[swapNodes.length - 1];
    const spread = last ? last.s - (ust(last.t) ?? 0) * 100 : 0;
    const longNodes = NODES.filter(([, t]) => t > (last?.t ?? 0)).map(([, t]) => ({ t, s: (ust(t) ?? 0) * 100 + spread, src: "美债+利差" as const }));
    return [...swapNodes.map((x) => ({ ...x, src: "互换" as const })), ...longNodes];
  }, [ois, ust]);
  const spreadBp = useMemo(() => { const last = nodes.filter((n) => n.src === "互换").pop(); return last && ust ? (last.s - (ust(last.t) ?? 0) * 100) * 100 : null; }, [nodes, ust]);
  useEffect(() => { if (!sw.fixed && nodes.length) { const v = value({ ...sw, fixed: 0 }, nodes); if (v) setSw((s) => ({ ...s, fixed: Number(v.par.toFixed(3)) })); } }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = nodes.length && sw.fixed ? value(sw, nodes) : null;
  const up = nodes.length && sw.fixed ? value(sw, nodes, () => 0.01) : null;
  const dv01 = v && up ? up.npv - v.npv : null;
  const krd = v ? NODES.map(([l, t], i) => { const left = i ? NODES[i - 1][1] : 0, right = i < NODES.length - 1 ? NODES[i + 1][1] : 60; const b = value(sw, nodes, tri(t, left, right)); return { k: l, v: b ? b.npv - v.npv : 0 }; }).filter((x) => Math.abs(x.v) > 0.5) : [];
  const scen: Array<[string, (t: number) => number]> = [["平行 +100bp", () => 1], ["平行 +50bp", () => 0.5], ["平行 +25bp", () => 0.25], ["平行 −25bp", () => -0.25], ["平行 −50bp", () => -0.5], ["平行 −100bp", () => -1], ["陡峭化（2 年 −25 / 10 年 +25）", (t) => (t <= 2 ? -0.25 : t >= 10 ? 0.25 : -0.25 + ((t - 2) / 8) * 0.5)], ["平坦化（2 年 +25 / 10 年 −25）", (t) => (t <= 2 ? 0.25 : t >= 10 ? -0.25 : 0.25 - ((t - 2) / 8) * 0.5)]];
  const flows = v ? v.d.map((df, i) => { const prev = i ? v.d[i - 1] : 1; const fwd = (prev / df - 1) * sw.freq * 100; const fix = (sw.notional * sw.fixed) / 100 / sw.freq; const flt = (sw.notional * fwd) / 100 / sw.freq; const net = (sw.side === "pay" ? 1 : -1) * (flt - fix); return { t: (i + 1) / sw.freq, df, fwd, fix, flt, net, pv: net * df }; }) : [];
  const saveSwap = async () => {
    if (!sw.name.trim() || !sw.fixed) return;
    const s = { ...sw, id: sw.id || String(Date.now()), name: sw.name.trim().slice(0, 40) };
    const next = [...book.filter((x) => x.id !== s.id), s].slice(-50);
    setLocal(next); setSw(s);
    await saveItem("swpm-book", next).catch(() => undefined);
  };
  const del = async (id: string) => { const next = book.filter((x) => x.id !== id); setLocal(next); await saveItem("swpm-book", next).catch(() => undefined); };
  const bookVals = book.map((b) => { const a = nodes.length ? value(b, nodes) : null; const u = nodes.length ? value(b, nodes, () => 0.01) : null; return { b, npv: a?.npv ?? null, par: a?.par ?? null, dv01: a && u ? u.npv - a.npv : null }; });
  const num = (x: string) => { const n = Number(x.replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
  return (
    <PanelShell code="SWPM" title="掉期估值（固定—浮动利率互换）" onClose={onClose} tabs={[["val", "估值与风险"], ["cf", "逐期现金流"], ["curve", "估值曲线"], ["book", `互换簿（${book.length}）`]]} tab={tab} setTab={setTab} right={<span>隔夜 SOFR {f2(sofr?.v, 2, "%")}{sofr ? `（${sofr.d}）` : ""}</span>}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px] text-slate-400">
        <Seg value={sw.side} options={[["pay", "付固定"], ["rec", "收固定"]]} onChange={(x) => setSw({ ...sw, side: x })} />
        <label>名义本金 <input className={INP} value={sw.notional.toLocaleString()} onChange={(e) => setSw({ ...sw, notional: num(e.target.value) })} /></label>
        <label>固定利率 % <input className={INP} type="number" step="0.01" value={sw.fixed || ""} onChange={(e) => setSw({ ...sw, fixed: Number(e.target.value) })} /></label>
        <label>期限 <select className={INP} value={sw.tenor} onChange={(e) => setSw({ ...sw, tenor: Number(e.target.value) })}>{TENOR_OPTS.map(([l, t]) => <option key={l} value={t}>{l}</option>)}</select></label>
        <label>付息频率 <select className={INP} value={sw.freq} onChange={(e) => setSw({ ...sw, freq: Number(e.target.value) })}><option value={1}>年付</option><option value={2}>半年付</option><option value={4}>季付</option></select></label>
        <button type="button" className={BTN} disabled={!v} onClick={() => v && setSw({ ...sw, fixed: Number(v.par.toFixed(4)) })}>设为平价</button>
        <input className="w-32 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-[11px] text-white outline-none" placeholder="互换名称（保存用）" value={sw.name} onChange={(e) => setSw({ ...sw, name: e.target.value })} />
        <button type="button" className={BTN} disabled={!sw.name.trim() || !sw.fixed} onClick={() => void saveSwap()}>保存到互换簿</button>
      </div>
      <Kpis items={[
        ["现值（美元）", v ? <span style={{ color: toneOf(v.npv) }}>{fmtCompact(v.npv)}</span> : "—", sw.side === "pay" ? "付固定：利率上升获益" : "收固定：利率下降获益"],
        ["平价固定利率", v ? `${v.par.toFixed(4)}%` : "—", v ? `与合约利率差 ${sgn((sw.fixed - v.par) * 100, 1, " bp")}` : undefined],
        ["DV01（曲线 +1bp）", dv01 == null ? "—" : <span style={{ color: toneOf(dv01) }}>{fmtCompact(dv01)}</span>],
        ["年金因子", v ? v.annuity.toFixed(4) : "—", "每 1 美元名义本金每年 1% 的现值"],
      ]} />
      {!nodes.length ? <Empty loading={mm.loading || cv.loading} text="曲线数据暂不可用" /> : <>
        {tab === "val" && v && <>
          <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
            <div className="bg-[#03070c]"><SectionHead title="关键期限 DV01（美元 / 1bp）" sub="仅在该期限节点附近抬升曲线 1bp 的现值变化" /><Bars data={krd} fmt={(x) => fmtCompact(x)} height={150} /></div>
            <div className="bg-[#03070c]"><SectionHead title="曲线情景" />
              <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>情景</th><th className={TH}>情景现值</th><th className={TH}>现值变化</th></tr></thead>
                <tbody>{scen.map(([l, fn]) => { const s = value(sw, nodes, fn); return <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className={`${TD} text-slate-200`}>{fmtCompact(s?.npv)}</td><td className={TD} style={{ color: toneOf(s ? s.npv - v.npv : null) }}>{s ? fmtCompact(s.npv - v.npv) : "—"}</td></tr>; })}</tbody></table></div>
          </div>
        </>}
        {tab === "cf" && v && <>
          <SectionHead title="逐期现金流" sub="浮动端按当前曲线隐含远期利率预估；正值为收入" />
          <div className="max-h-[420px] overflow-auto"><table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>付息时点（年）</th><th className={TH}>贴现因子</th><th className={TH}>隐含远期 %</th><th className={TH}>固定端</th><th className={TH}>浮动端（预估）</th><th className={TH}>净额</th><th className={TH}>现值</th></tr></thead>
            <tbody>{flows.map((x) => <tr key={x.t} className={ROW}><td className={TDL}>{x.t.toFixed(2)}</td><td className={TD}>{x.df.toFixed(5)}</td><td className={`${TD} text-amber-200`}>{x.fwd.toFixed(3)}</td><td className={TD}>{fmtCompact(x.fix)}</td><td className={TD}>{fmtCompact(x.flt)}</td><td className={TD} style={{ color: toneOf(x.net) }}>{fmtCompact(x.net)}</td><td className={TD} style={{ color: toneOf(x.pv) }}>{fmtCompact(x.pv)}</td></tr>)}</tbody>
          </table></div>
        </>}
        {tab === "curve" && <>
          <SectionHead title="当日估值曲线（平价利率 %）" />
          <Lines series={[{ name: "估值曲线", color: "#fbbf24", values: nodes.map((n) => n.s) }, { name: "美债", color: "#38bdf8", values: nodes.map((n) => (ust ? (ust(n.t) ?? 0) * 100 : null)) }]} xLabels={NODES.map(([l]) => l)} height={180} fmt={(x) => x.toFixed(2)} />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>平价利率</th><th className={TH}>美债</th><th className={TH}>差（bp）</th></tr></thead>
            <tbody>{nodes.map((n, i) => { const u = ust ? (ust(n.t) ?? 0) * 100 : null; return <tr key={n.t} className={ROW}><td className={TDL}>{NODES[i]?.[0]}</td><td className={`${TD} text-white`}>{n.s.toFixed(3)}</td><td className={TD}>{u?.toFixed(3)}</td><td className={TD}>{u != null ? ((n.s - u) * 100).toFixed(1) : "—"}</td></tr>; })}</tbody></table>
        </>}
        {tab === "book" && <>
          <SectionHead title="我的互换簿（按当日曲线重估）" sub="点击一行载入编辑" />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>名称</th><th className={THL}>方向</th><th className={TH}>名义本金</th><th className={TH}>固定利率</th><th className={TH}>期限</th><th className={TH}>平价</th><th className={TH}>现值</th><th className={TH}>DV01</th><th className={TH} /></tr></thead>
            <tbody>{bookVals.map(({ b, npv, par, dv01: d }) => <tr key={b.id} onClick={() => setSw(b)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{b.name}</td><td className="px-2 text-slate-300">{b.side === "pay" ? "付固定" : "收固定"}</td><td className={TD}>{fmtCompact(b.notional)}</td><td className={TD}>{b.fixed.toFixed(3)}%</td><td className={TD}>{b.tenor} 年</td><td className={`${TD} text-slate-400`}>{f2(par, 3, "%")}</td><td className={TD} style={{ color: toneOf(npv) }}>{fmtCompact(npv)}</td><td className={TD} style={{ color: toneOf(d) }}>{fmtCompact(d)}</td><td className="px-2 text-right"><button type="button" onClick={(e) => { e.stopPropagation(); void del(b.id); }} className="text-slate-500 hover:text-slate-200">删除</button></td></tr>)}
              {bookVals.length > 0 && <tr className="border-t border-[#1a2a3c] font-semibold"><td className={TDL} colSpan={6}>合计</td><td className={TD} style={{ color: toneOf(bookVals.reduce((s, x) => s + (x.npv ?? 0), 0)) }}>{fmtCompact(bookVals.reduce((s, x) => s + (x.npv ?? 0), 0))}</td><td className={TD}>{fmtCompact(bookVals.reduce((s, x) => s + (x.dv01 ?? 0), 0))}</td><td /></tr>}
              {!bookVals.length && <tr><td colSpan={9}><Empty loading={saved.loading} text="还没有保存的互换：在上方设定后点“保存到互换簿”。" /></td></tr>}</tbody></table>
        </>}
        <Note>互换利率没有公开逐期报价：短端由 3 个月 SOFR 期货条与隔夜 SOFR 推算，长端以美债收益率加最长可观测期限的互换—美债利差外推。对冲下单请用电子交易的利率互换对冲（IRSWAP）。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== MOSO 最活跃期权 */
type Opt = { strike: number; type: "C" | "P"; bid: number; ask: number; last: number; iv: number; delta: number; oi: number; volume: number };
type Chain = { symbol: string; spot: number; changePct: number; iv30: number; iv30Change: number; expiry: string; chain: Array<{ strike: number; call: Opt | null; put: Opt | null }>; stats: { callVolume: number; putVolume: number; callOi: number; putOi: number; pcVolumeAll: number; pcOiAll: number; atmIv: number | null }; unusual: Array<Opt & { exp: string }> };
const MOSO_SYMS: Array<[string, string]> = [["SPY", "标普500 ETF"], ["QQQ", "纳指100 ETF"], ["IWM", "罗素2000 ETF"], ["AAPL", "苹果"], ["NVDA", "英伟达"], ["TSLA", "特斯拉"], ["MSFT", "微软"], ["AMZN", "亚马逊"], ["META", "Meta"], ["GOOGL", "谷歌"], ["AMD", "AMD"], ["TLT", "20年美债 ETF"], ["GLD", "黄金 ETF"], ["SLV", "白银 ETF"]];
const ivp = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v <= 0 ? null : v > 3 ? v : v * 100);

export function MosoLive({ onClose }: P) {
  const { pick } = useHub();
  const [data, setData] = useState<Record<string, Chain | null>>({});
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<"ALL" | "C" | "P">("ALL");
  const [tab, setTab] = useState("top");
  useEffect(() => {
    let alive = true;
    const load = () => { void Promise.all(MOSO_SYMS.map(([s]) => ucGet<Chain | null>("ucHubs.options", { symbol: s }).then((c) => [s, c] as const).catch(() => [s, null] as const))).then((all) => { if (alive) { setData(Object.fromEntries(all)); setLoading(false); } }); };
    load();
    const t = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const nameOf = (s: string) => MOSO_SYMS.find(([k]) => k === s)?.[1] ?? s;
  const contracts = useMemo(() => {
    const out: Array<Opt & { sym: string; exp: string; spot: number }> = [];
    for (const [s, c] of Object.entries(data)) {
      if (!c) continue;
      const seen = new Set<string>();
      const push = (o: Opt | null, exp: string) => { if (!o || !o.volume) return; const k = `${exp}${o.type}${o.strike}`; if (seen.has(k)) return; seen.add(k); out.push({ ...o, sym: s, exp, spot: c.spot }); };
      for (const r of c.chain) { push(r.call ? { ...r.call, type: "C", strike: r.strike } : null, c.expiry); push(r.put ? { ...r.put, type: "P", strike: r.strike } : null, c.expiry); }
      for (const u of c.unusual ?? []) push(u, u.exp);
    }
    return out.sort((a, b) => b.volume - a.volume);
  }, [data]);
  const list = contracts.filter((o) => side === "ALL" || o.type === side).slice(0, 80);
  const unusual = contracts.filter((o) => o.volume > 500 && o.volume > o.oi * 1.5).slice(0, 60);
  const unders = Object.entries(data).filter(([, c]) => c).map(([s, c]) => ({ s, c: c!, vol: c!.stats.callVolume + c!.stats.putVolume, pc: c!.stats.putVolume / Math.max(1, c!.stats.callVolume), voi: (c!.stats.callVolume + c!.stats.putVolume) / Math.max(1, c!.stats.callOi + c!.stats.putOi) })).sort((a, b) => b.vol - a.vol);
  const totC = unders.reduce((s, u) => s + u.c.stats.callVolume, 0), totP = unders.reduce((s, u) => s + u.c.stats.putVolume, 0);
  return (
    <PanelShell code="MOSO" title="最活跃期权" onClose={onClose} tabs={[["top", "最活跃合约"], ["und", "按标的"], ["unu", "异动合约"]]} tab={tab} setTab={setTab} right={<span>{loading ? "读取期权链…" : `${unders.length} 个标的 · 近月到期为主 · 每 2 分钟刷新`}</span>}>
      <Kpis items={[["统计合约成交量", fmtCompact(totC + totP), "各标的近月到期"], ["看跌 / 看涨成交比", totC ? (totP / totC).toFixed(2) : "—", "大于 1 表示避险需求偏强"], ["异动合约数", String(unusual.length), "成交 > 500 且 > 1.5 倍持仓"], ["成交最集中标的", unders[0] ? nameOf(unders[0].s) : "—", unders[0] ? `${fmtCompact(unders[0].vol)} 张` : undefined]]} />
      {!contracts.length ? <Empty loading={loading} text="期权数据暂不可用" /> : <>
        {tab === "top" && <>
          <div className="flex items-center gap-2 px-2 py-1"><Seg value={side} options={[["ALL", "全部"], ["C", "看涨"], ["P", "看跌"]]} onChange={setSide} /></div>
          <div className="max-h-[440px] overflow-auto"><table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={THL}>到期</th><th className={THL}>类型</th><th className={TH}>行权价</th><th className={TH}>价内外</th><th className={TH}>最新</th><th className={TH}>买 / 卖</th><th className={TH}>隐波</th><th className={TH}>Delta</th><th className={TH}>成交量</th><th className={TH}>持仓量</th><th className={TH}>成交 / 持仓</th></tr></thead>
            <tbody>{list.map((o, i) => { const m = (o.strike / o.spot - 1) * 100; return <tr key={`${o.sym}${o.exp}${o.type}${o.strike}${i}`} onClick={() => pick(o.sym)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{nameOf(o.sym)}<span className="ml-1 font-mono text-[9px] text-slate-600">{o.sym}</span></td><td className="px-2 font-mono text-slate-400">{o.exp}</td><td className="px-2" style={{ color: o.type === "C" ? "#f2495c" : "#1fbf75" }}>{o.type === "C" ? "看涨" : "看跌"}</td><td className={`${TD} text-white`}>{fmtPrice(o.strike)}</td><td className={TD}>{sgn(m, 1)}</td><td className={TD}>{fmtPrice(o.last)}</td><td className={`${TD} text-slate-400`}>{fmtPrice(o.bid)} / {fmtPrice(o.ask)}</td><td className={`${TD} text-amber-200`}>{f2(ivp(o.iv), 1, "%")}</td><td className={TD}>{f2(o.delta, 2)}</td><td className={`${TD} font-semibold`}>{fmtCompact(o.volume)}</td><td className={`${TD} text-slate-400`}>{fmtCompact(o.oi)}</td><td className={TD} style={{ background: heat(Math.min(5, o.volume / Math.max(1, o.oi)) * 20, 100) }}>{(o.volume / Math.max(1, o.oi)).toFixed(2)}</td></tr>; })}</tbody>
          </table></div>
        </>}
        {tab === "und" && <>
          <SectionHead title="各标的期权成交（近月到期）" sub="看跌 / 看涨比（全部到期）用于对照；成交 / 持仓比越高，新开仓越活跃" />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={TH}>现价</th><th className={TH}>涨跌幅</th><th className={TH}>看涨成交</th><th className={TH}>看跌成交</th><th className={TH}>看跌 / 看涨（近月）</th><th className={TH}>看跌 / 看涨（全部）</th><th className={TH}>成交 / 持仓</th><th className={TH}>30 日隐波</th><th className={TH}>隐波变化</th></tr></thead>
            <tbody>{unders.map(({ s, c, pc, voi }) => <tr key={s} onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{nameOf(s)}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className={`${TD} text-white`}>{fmtPrice(c.spot)}</td><td className={TD} style={{ color: toneOf(c.changePct) }}>{fmtPct(c.changePct)}</td><td className={TD} style={{ color: "#f2495c" }}>{fmtCompact(c.stats.callVolume)}</td><td className={TD} style={{ color: "#1fbf75" }}>{fmtCompact(c.stats.putVolume)}</td><td className={TD} style={{ background: heat((pc - 1) * 100, 100) }}>{pc.toFixed(2)}</td><td className={TD}>{f2(c.stats.pcVolumeAll, 2)}</td><td className={TD}>{voi.toFixed(2)}</td><td className={`${TD} text-amber-200`}>{f2(ivp(c.iv30), 1, "%")}</td><td className={TD} style={{ color: toneOf(c.iv30Change) }}>{f2(c.iv30Change, 2)}</td></tr>)}</tbody></table>
          <SectionHead title="成交量排名（张）" />
          <Bars data={unders.map((u) => ({ k: nameOf(u.s).slice(0, 6), v: u.vol }))} height={140} />
        </>}
        {tab === "unu" && <>
          <SectionHead title="异动合约（全部到期）" sub="当日成交 > 500 张且超过 1.5 倍持仓量，通常意味着新的大额开仓" />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={THL}>到期</th><th className={THL}>类型</th><th className={TH}>行权价</th><th className={TH}>价内外</th><th className={TH}>成交量</th><th className={TH}>持仓量</th><th className={TH}>倍数</th><th className={TH}>隐波</th><th className={TH}>估算权利金</th></tr></thead>
            <tbody>{unusual.map((o, i) => <tr key={`${o.sym}${o.exp}${o.type}${o.strike}${i}`} onClick={() => pick(o.sym)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{nameOf(o.sym)}</td><td className="px-2 font-mono text-slate-400">{o.exp}</td><td className="px-2" style={{ color: o.type === "C" ? "#f2495c" : "#1fbf75" }}>{o.type === "C" ? "看涨" : "看跌"}</td><td className={`${TD} text-white`}>{fmtPrice(o.strike)}</td><td className={TD}>{sgn((o.strike / o.spot - 1) * 100, 1)}</td><td className={`${TD} font-semibold`}>{fmtCompact(o.volume)}</td><td className={TD}>{fmtCompact(o.oi)}</td><td className={`${TD} text-amber-200`}>{(o.volume / Math.max(1, o.oi)).toFixed(1)}</td><td className={TD}>{f2(ivp(o.iv), 1, "%")}</td><td className={TD}>{fmtCompact(o.volume * (o.last || (o.bid + o.ask) / 2) * 100)}</td></tr>)}
              {!unusual.length && <tr><td colSpan={10}><Empty text="今天还没有明显的异动合约" /></td></tr>}</tbody></table>
        </>}
      </>}
    </PanelShell>
  );
}
