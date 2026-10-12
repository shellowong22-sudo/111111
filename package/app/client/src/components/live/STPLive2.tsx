/**
 * 直通式处理（STP）小窗功能 —— 第二组：直通配置 / 确认核验 / 分配账户 / 交收路由 / 转介队列 / 最佳执行。
 * 数据：平台自有交易系统（永久入库）、实时行情与日线、个人配置（永久保存在平台数据库）。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useKline, useTick, useTicks } from "@/uc/market/live";
import { Bars, useHub } from "@/uc/hubs/kit";
import { heat } from "@/uc/hubs/calc";
import { Seg } from "@/uc/news/kit";
import { Empty, Kpis, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { EventsList, STATUS_ZH, cancelOrder, placeOrder, useEvents, useFills, useOrders, usePositions, type Fill, type Order } from "@/uc/trade/kit";
import { Btn, Frame, NoTrades, ROUTE, SideTxt, TH, TR, addBiz, bizBetween, fmtDur, lotOf, marketOfCode, median, mktName, today, useFx, toCny, useNow, venueOf, type P } from "./STPLive";

/* ================================================================== ESTP 直通处理配置中心 */
type Rule = { on: boolean; maxNotional: number; maxFeeBps: number; allowMkt: boolean };
type Cfg = Record<string, Rule>;
type CfgDoc = { cfg: Cfg; hist: Array<{ ts: number; text: string }> };
const MKTS = ["CN", "HK", "US", "FUT", "INTL"];
const DEF_RULE: Rule = { on: true, maxNotional: 500_000, maxFeeBps: 30, allowMkt: true };
const DEF_CFG: Cfg = Object.fromEntries(MKTS.map((m) => [m, { ...DEF_RULE }]));

export function StpESTP({ onClose }: P) {
  const saved = useSaved<CfgDoc>("stp.cfg");
  const [doc, setDoc] = useState<CfgDoc | null>(null);
  const [draft, setDraft] = useState<Cfg | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!saved.loading && doc == null) { const d = saved.data ?? { cfg: DEF_CFG, hist: [] }; setDoc(d); setDraft({ ...DEF_CFG, ...d.cfg }); } }, [saved.loading]);
  const f = useFills();
  const o = useOrders();
  const fills = f.data ?? [];
  const ordMap = useMemo(() => new Map((o.data ?? []).map((x) => [x.id, x])), [o.data]);
  const cfg = doc ? { ...DEF_CFG, ...doc.cfg } : DEF_CFG;
  const evalFill = (x: Fill, c: Cfg) => {
    const r = c[x.market] ?? DEF_RULE;
    const why: string[] = [];
    if (!r.on) why.push("该市场未启用直通");
    if (x.notional > r.maxNotional) why.push("超出单笔金额上限");
    if (x.notional > 0 && ((x.fee + x.tax) / x.notional) * 1e4 > r.maxFeeBps) why.push("费用率超限");
    if (!r.allowMkt && ordMap.get(x.orderId)?.type === "MKT") why.push("市价单需人工复核");
    return why;
  };
  const res = fills.map((x) => ({ x, why: evalFill(x, cfg) }));
  const rate = (arr: typeof res) => (arr.length ? (arr.filter((r) => !r.why.length).length / arr.length) * 100 : null);
  const draftRate = draft ? (fills.length ? (fills.filter((x) => !evalFill(x, draft).length).length / fills.length) * 100 : null) : null;
  const days = useMemo(() => { const m: Record<string, typeof res> = {}; for (const r of res) (m[r.x.tradeDate] ??= []).push(r); return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-30); }, [res]);
  const reasons = Object.entries(res.flatMap((r) => r.why).reduce<Record<string, number>>((a, k) => { a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const save = async () => {
    if (!draft || !doc) return;
    const diff: string[] = [];
    for (const m of MKTS) { const a = cfg[m], b = draft[m]; if (a.on !== b.on) diff.push(`${mktName(m)} 直通${b.on ? "启用" : "停用"}`); if (a.maxNotional !== b.maxNotional) diff.push(`${mktName(m)} 金额上限 ${fmtCompact(a.maxNotional)}→${fmtCompact(b.maxNotional)}`); if (a.maxFeeBps !== b.maxFeeBps) diff.push(`${mktName(m)} 费用率上限 ${a.maxFeeBps}→${b.maxFeeBps} 基点`); if (a.allowMkt !== b.allowMkt) diff.push(`${mktName(m)} 市价单${b.allowMkt ? "允许直通" : "转人工"}`); }
    if (!diff.length) { setMsg("配置未变化"); return; }
    const next: CfgDoc = { cfg: draft, hist: [{ ts: Date.now(), text: diff.join("；") }, ...doc.hist].slice(0, 60) };
    setDoc(next);
    await saveItem("stp.cfg", next);
    setMsg(`已保存 ${diff.length} 项变更`);
  };
  const ord = o.data ?? [];
  const funnel: Array<[string, number]> = [["委托", ord.length], ["有成交的委托", ord.filter((x) => x.filledQty > 0).length], ["成交笔数", fills.length], ["自动直通", res.filter((r) => !r.why.length).length], ["待交收", fills.filter((x) => !x.settled).length], ["已交收", fills.filter((x) => x.settled).length]];
  const inp = "w-24 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-[11px] text-white";
  return (
    <Frame code="ESTP" title="直通处理配置中心" onClose={onClose} right={<span>配置永久保存在平台数据库</span>}>
      <Kpis items={[["直通率（现行配置）", rate(res) == null ? "—" : `${rate(res)!.toFixed(1)}%`, `${fills.length} 笔成交`], ["直通率（草稿配置）", draftRate == null ? "—" : `${draftRate.toFixed(1)}%`, "保存前即可预估影响"], ["转人工笔数", String(res.filter((r) => r.why.length).length)], ["配置变更次数", String(doc?.hist.length ?? 0)]]} />
      <SectionHead title="各市场直通规则" sub="成交满足全部条件即自动进入确认与交收，否则转人工复核" right={<><Btn onClick={() => setDraft({ ...cfg })}>还原</Btn><Btn tone="amber" onClick={() => void save()}>保存配置</Btn></>} />
      {msg && <div className="px-2 py-0.5 text-[10px] text-amber-200">{msg}</div>}
      <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">市场</th><th className="text-center">启用直通</th><th className="text-right">单笔金额上限（原币）</th><th className="text-right">费用率上限（基点）</th><th className="text-center">市价单直通</th><th className="text-right">成交笔数</th><th className="px-2 text-right">直通率</th></tr></thead>
        <tbody>{draft && MKTS.map((m) => { const r = draft[m]; const set = (patch: Partial<Rule>) => setDraft({ ...draft, [m]: { ...r, ...patch } }); const sub = res.filter((z) => z.x.market === m); return <tr key={m} className={TR}><td className="px-2 py-0.5 text-slate-100">{mktName(m)}</td><td className="text-center"><input type="checkbox" checked={r.on} onChange={(e) => set({ on: e.target.checked })} /></td><td className="text-right"><input type="number" value={r.maxNotional} onChange={(e) => set({ maxNotional: Number(e.target.value) || 0 })} className={inp} /></td><td className="text-right"><input type="number" value={r.maxFeeBps} onChange={(e) => set({ maxFeeBps: Number(e.target.value) || 0 })} className={inp} /></td><td className="text-center"><input type="checkbox" checked={r.allowMkt} onChange={(e) => set({ allowMkt: e.target.checked })} /></td><td className="text-right font-mono text-slate-400">{sub.length}</td><td className="px-2 text-right font-mono text-white">{rate(sub) == null ? "—" : `${rate(sub)!.toFixed(1)}%`}</td></tr>; })}{!draft && <tr><td colSpan={7}><Empty loading /></td></tr>}</tbody></table>
      {!fills.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交，直通率将在第一笔成交后按上表规则计算。" strategy="ESTP" /> : <>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="处理流程漏斗" />
            <table className="w-full text-[11px]"><tbody>{funnel.map(([k, v]) => <tr key={k} className={TR}><td className="w-28 px-2 py-0.5 text-slate-300">{k}</td><td className="px-2"><div className="h-3 bg-cyan-600/60" style={{ width: `${(v / Math.max(1, funnel[0][1], funnel[2][1])) * 100}%` }} /></td><td className="w-14 px-2 text-right font-mono text-white">{v}</td></tr>)}</tbody></table>
            <SectionHead title="转人工原因" />
            <table className="w-full text-[11px]"><tbody>{reasons.map(([k, n]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-amber-200">{k}</td><td className="px-2 text-right font-mono text-white">{n}</td></tr>)}{!reasons.length && <tr><td className="px-2 py-3 text-slate-500">全部成交均满足直通条件。</td></tr>}</tbody></table></div>
          <div className="bg-[#03070c]"><SectionHead title="每日直通率（按交易日）" />
            <Bars data={days.map(([d, arr]) => ({ k: d.slice(5), v: rate(arr) ?? 0 }))} fmt={(v) => `${v.toFixed(1)}%`} height={130} />
            <SectionHead title="配置变更记录" />
            <table className="w-full text-[11px]"><tbody>{(doc?.hist ?? []).map((h) => <tr key={h.ts} className={TR}><td className="w-[130px] px-2 py-0.5 font-mono text-[10px] text-slate-500">{new Date(h.ts).toLocaleString("zh-CN", { hour12: false })}</td><td className="px-2 text-slate-200">{h.text}</td></tr>)}{!doc?.hist.length && <tr><td className="px-2 py-3 text-slate-500">尚无变更记录，当前为默认规则。</td></tr>}</tbody></table></div>
        </div>
      </>}
    </Frame>
  );
}

/* ================================================================== VCAD 成交确认核验 */
type VR = { status: "ok" | "out" | "na"; devClose: number | null; pos: number | null; venue: string; side: "B" | "S" };
const dayKeys = (t: number) => [new Date(t).toISOString().slice(0, 10), new Date(t + 8 * 3600e3).toISOString().slice(0, 10)];
function VerifyRow({ f, onResult }: { f: Fill; onResult: (id: number, r: VR) => void }) {
  const k = useKline(f.symbol, "1d", 120);
  const bar = useMemo(() => k.candles.find((c) => dayKeys(c.t).includes(f.tradeDate)) ?? null, [k.candles, f.tradeDate]);
  const r: VR = useMemo(() => {
    const venue = venueOf(f.symbol, f.market);
    if (!bar) return { status: "na", devClose: null, pos: null, venue, side: f.side };
    const tol = Math.max(bar.h * 0.001, 1e-9);
    const ok = f.px >= bar.l - tol && f.px <= bar.h + tol;
    return { status: ok ? "ok" : "out", devClose: (f.px / bar.c - 1) * 1e4, pos: bar.h > bar.l ? ((f.px - bar.l) / (bar.h - bar.l)) * 100 : 50, venue, side: f.side };
  }, [bar, f]);
  useEffect(() => { if (!k.loading) onResult(f.id, r); }, [k.loading, r.status, r.devClose]);
  const { pick } = useHub();
  return (
    <tr className={TR}>
      <td className="px-2 py-0.5 font-mono text-slate-400">{f.id}</td><td className="font-mono text-[10px] text-slate-400">{f.tradeDate}</td>
      <td className="cursor-pointer text-slate-100" onClick={() => pick(f.symbol)}>{f.symbol}</td><td className="text-slate-400">{r.venue}</td><td className="text-center"><SideTxt s={f.side} /></td>
      <td className="text-right font-mono text-white">{fmtPrice(f.px)}</td><td className="text-right font-mono text-slate-400">{bar ? `${fmtPrice(bar.l)} – ${fmtPrice(bar.h)}` : "—"}</td><td className="text-right font-mono text-slate-300">{fmtPrice(bar?.c)}</td>
      <td className="text-right font-mono" style={{ color: toneOf(r.devClose) }}>{r.devClose == null ? "—" : r.devClose.toFixed(1)}</td>
      <td className="text-right font-mono text-slate-300">{r.pos == null ? "—" : `${r.pos.toFixed(0)}%`}</td>
      <td className="px-2" style={{ color: r.status === "ok" ? "#34d399" : r.status === "out" ? "#f87171" : "#64748b" }}>{k.loading ? "核验中…" : r.status === "ok" ? "已确认" : r.status === "out" ? "超出当日区间" : "无日线"}</td>
    </tr>
  );
}
export function StpVCAD({ onClose }: P) {
  const f = useFills();
  const [n, setN] = useState<"20" | "40" | "60">("40");
  const list = (f.data ?? []).slice(0, Number(n));
  const [res, setRes] = useState<Record<number, VR>>({});
  const onResult = useMemo(() => (id: number, r: VR) => setRes((s) => (s[id]?.status === r.status && s[id]?.devClose === r.devClose ? s : { ...s, [id]: r })), []);
  const vals = list.map((x) => res[x.id]).filter((v): v is VR => !!v);
  const ok = vals.filter((v) => v.status === "ok").length;
  const out = vals.filter((v) => v.status === "out").length;
  const checked = ok + out;
  const venues = Object.entries(vals.reduce<Record<string, { ok: number; out: number; na: number; dev: number[] }>>((a, v) => { const e = (a[v.venue] ??= { ok: 0, out: 0, na: 0, dev: [] }); e[v.status]++; if (v.devClose != null) e.dev.push(Math.abs(v.devClose)); return a; }, {}));
  const bucket = (side: "B" | "S", i: number) => vals.filter((v) => v.side === side && v.pos != null && Math.min(4, Math.floor(v.pos / 20)) === i).length;
  return (
    <Frame code="VCAD" title="成交确认核验（全账户）" onClose={onClose} right={<Seg value={n} options={[["20", "最近 20 笔"], ["40", "最近 40 笔"], ["60", "最近 60 笔"]]} onChange={setN} />}>
      <Kpis items={[["已核验", `${checked} / ${list.length}`, "以成交当日独立日线为准"], ["确认通过率", checked ? `${((ok / checked) * 100).toFixed(1)}%` : "—"], ["超出当日区间", <span style={{ color: out ? "#f87171" : "#34d399" }}>{out} 笔</span>, "价差超过当日最高最低 0.1%"], ["相对收盘偏离中位数", (() => { const m = median(vals.map((v) => v.devClose).filter((x): x is number => x != null)); return m == null ? "—" : `${m.toFixed(1)} 基点`; })()]]} />
      {!list.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交可供确认。每笔成交会与该标的成交当日的最高、最低、收盘价独立比对，超出区间即提示复核。" strategy="VCAD" /> : <>
        <SectionHead title="逐笔确认核验" sub="偏离以基点计" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">成交号</th><th className="text-left">交易日</th><th className="text-left">标的</th><th className="text-left">场所</th><th className="text-center">方向</th><th className="text-right">成交价</th><th className="text-right">当日区间</th><th className="text-right">收盘</th><th className="text-right">偏离收盘</th><th className="text-right">区间位置</th><th className="px-2 text-left">确认</th></tr></thead>
          <tbody>{list.map((x) => <VerifyRow key={x.id} f={x} onResult={onResult} />)}</tbody></table>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="按交易场所汇总" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">场所</th><th className="text-right">已确认</th><th className="text-right">超区间</th><th className="text-right">无日线</th><th className="px-2 text-right">平均绝对偏离</th></tr></thead>
              <tbody>{venues.map(([k, e]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-100">{k}</td><td className="text-right font-mono text-emerald-300">{e.ok}</td><td className="text-right font-mono text-red-300">{e.out}</td><td className="text-right font-mono text-slate-500">{e.na}</td><td className="px-2 text-right font-mono text-white">{e.dev.length ? `${(e.dev.reduce((a, b) => a + b, 0) / e.dev.length).toFixed(1)} 基点` : "—"}</td></tr>)}</tbody></table></div>
          <div className="bg-[#03070c]"><SectionHead title="成交价在当日区间中的位置分布" sub="买入越靠近低位、卖出越靠近高位越好" />
            <Bars data={["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"].map((k, i) => ({ k, v: bucket("B", i), v2: bucket("S", i) }))} label={["买入", "卖出"]} fmt={(v) => `${v} 笔`} height={130} /></div>
        </div>
      </>}
    </Frame>
  );
}

/* ================================================================== ALOB 分配账户设定 */
type Acct = { id: string; name: string; weight: number };
type AllocDoc = { accounts: Acct[]; rounding: "DOWN" | "ROUND"; remainder: "LARGEST" | "FRACTION" };
const DEF_ALLOC: AllocDoc = { accounts: [{ id: "MAIN", name: "主账户", weight: 100 }], rounding: "DOWN", remainder: "LARGEST" };
function allocate(totalQty: number, lot: number, accts: Acct[], rounding: AllocDoc["rounding"], remainder: AllocDoc["remainder"]) {
  const lots = Math.floor(totalQty / lot);
  const W = accts.reduce((s, a) => s + Math.max(0, a.weight), 0) || 1;
  const rows = accts.map((a) => { const raw = (lots * Math.max(0, a.weight)) / W; const base = rounding === "DOWN" ? Math.floor(raw) : Math.round(raw); return { ...a, raw, lots: base, frac: raw - Math.floor(raw) }; });
  let left = lots - rows.reduce((s, r) => s + r.lots, 0);
  const order = remainder === "LARGEST" ? [...rows].sort((a, b) => b.weight - a.weight) : [...rows].sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (left > 0 && order.length) { const r = remainder === "LARGEST" ? order[0] : order[i % order.length]; r.lots++; left--; i++; }
  i = 0;
  const rev = [...rows].sort((a, b) => a.frac - b.frac);
  while (left < 0 && rev.length) { const r = rev[i % rev.length]; if (r.lots > 0) { r.lots--; left++; } i++; if (i > 10000) break; }
  return { lots, odd: totalQty - lots * lot, rows: rows.map((r) => ({ ...r, qty: r.lots * lot })) };
}
export function StpALOB({ onClose }: P) {
  const saved = useSaved<AllocDoc>("stp.alloc");
  const [doc, setDoc] = useState<AllocDoc | null>(null);
  useEffect(() => { if (!saved.loading && doc == null) setDoc(saved.data ?? DEF_ALLOC); }, [saved.loading]);
  const persist = (d: AllocDoc) => { setDoc(d); void saveItem("stp.alloc", d); };
  const f = useFills();
  const p = usePositions();
  const [sym, setSym] = useState("sh600519");
  const [input, setInput] = useState("sh600519");
  const [side, setSide] = useState<"B" | "S">("B");
  const [qty, setQty] = useState(1000);
  const [type, setType] = useState<"LMT" | "MKT">("LMT");
  const [px, setPx] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [na, setNa] = useState({ id: "", name: "", weight: 50 });
  const t = useTick(sym);
  const lot = lotOf(sym);
  const plan = doc ? allocate(qty, lot, doc.accounts, doc.rounding, doc.remainder) : null;
  const submit = async () => {
    if (!plan) return;
    setBusy(true);
    const blk = `BLK${Date.now().toString(36).toUpperCase()}`;
    const out: string[] = [];
    for (const r of plan.rows.filter((x) => x.qty > 0)) {
      try { const res = await placeOrder({ symbol: sym, side, type, qty: r.qty, limitPx: type === "LMT" ? Number(px || t?.price) : null, account: r.id, strategy: "ALLOC", note: `母单 ${blk} 分配` }); out.push(`${r.name}（${r.id}）${r.qty}：${res.status === "REJECTED" ? `拒绝 ${res.reject}` : `委托 ${res.id} ${STATUS_ZH[res.status] ?? res.status}`}`); } catch (e) { out.push(`${r.name}（${r.id}）提交失败：${(e as Error).message}`); }
    }
    setLog([`母单 ${blk}：${sym} ${side === "B" ? "买入" : "卖出"} ${qty}`, ...out]);
    setBusy(false);
  };
  const fills = f.data ?? [];
  const pos = p.data?.rows ?? [];
  const accts = [...new Set([...(doc?.accounts.map((a) => a.id) ?? []), ...fills.map((x) => x.account), ...pos.map((x) => x.account)])];
  const nameOf = (id: string) => doc?.accounts.find((a) => a.id === id)?.name ?? id;
  const recon = useMemo(() => { const m = new Map<string, number>(); for (const x of fills) m.set(`${x.account}|${x.symbol}`, (m.get(`${x.account}|${x.symbol}`) ?? 0) + (x.side === "B" ? x.qty : -x.qty)); const keys = new Set([...m.keys(), ...pos.map((r) => `${r.account}|${r.symbol}`)]); return [...keys].map((k) => { const [a, s] = k.split("|"); const book = pos.find((r) => r.account === a && r.symbol === s)?.qty ?? 0; const fl = m.get(k) ?? 0; return { a, s, book, fl, diff: book - fl }; }).filter((r) => r.book || r.fl); }, [fills, pos]);
  const inp = "border border-[#1d3047] bg-[#07111c] px-1 font-mono text-[11px] text-white";
  return (
    <Frame code="ALOB" title="分配账户设定" onClose={onClose} right={<span>账户与规则永久保存在平台数据库</span>}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]">
          <SectionHead title="分配账户与权重" right={doc && <><Seg value={doc.rounding} options={[["DOWN", "向下取整"], ["ROUND", "四舍五入"]]} onChange={(v) => persist({ ...doc, rounding: v })} /><Seg value={doc.remainder} options={[["LARGEST", "余量给最大账户"], ["FRACTION", "余量按小数位"]]} onChange={(v) => persist({ ...doc, remainder: v })} /></>} />
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">账户代码</th><th className="text-left">名称</th><th className="text-right">权重</th><th className="text-right">占比</th><th className="px-2" /></tr></thead>
            <tbody>{(doc?.accounts ?? []).map((a) => { const W = doc!.accounts.reduce((s, x) => s + x.weight, 0) || 1; return <tr key={a.id} className={TR}><td className="px-2 py-0.5 font-mono text-cyan-200">{a.id}</td><td className="text-slate-100">{a.name}</td><td className="text-right"><input type="number" value={a.weight} onChange={(e) => persist({ ...doc!, accounts: doc!.accounts.map((x) => (x.id === a.id ? { ...x, weight: Math.max(0, Number(e.target.value) || 0) } : x)) })} className={`${inp} w-16 text-right`} /></td><td className="text-right font-mono text-slate-300">{((a.weight / W) * 100).toFixed(1)}%</td><td className="px-2 text-right">{a.id !== "MAIN" && <button type="button" onClick={() => persist({ ...doc!, accounts: doc!.accounts.filter((x) => x.id !== a.id) })} className="text-[10px] text-slate-500 hover:text-red-300">移除</button>}</td></tr>; })}{!doc && <tr><td colSpan={5}><Empty loading /></td></tr>}</tbody></table>
          <div className="flex flex-wrap items-center gap-1 px-2 py-1 text-[11px]"><input value={na.id} onChange={(e) => setNa({ ...na, id: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) })} placeholder="账户代码" className={`${inp} w-24`} /><input value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value.slice(0, 20) })} placeholder="名称" className={`${inp} w-28`} /><input type="number" value={na.weight} onChange={(e) => setNa({ ...na, weight: Number(e.target.value) || 0 })} className={`${inp} w-16 text-right`} /><Btn disabled={!doc || !na.id || doc.accounts.some((x) => x.id === na.id)} onClick={() => { persist({ ...doc!, accounts: [...doc!.accounts, { id: na.id, name: na.name || na.id, weight: na.weight }] }); setNa({ id: "", name: "", weight: 50 }); }}>新增账户</Btn></div>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="母单分配" sub={`最小交易单位 ${lot}（${mktName(marketOfCode(sym))}）`} />
          <div className="space-y-1 px-2 py-1 text-[11px]">
            <form onSubmit={(e) => { e.preventDefault(); setSym(input.trim()); setPx(""); }} className="flex items-center gap-1"><span className="w-10 text-slate-400">标的</span><input value={input} onChange={(e) => setInput(e.target.value)} className={`${inp} w-28`} /><button className="border border-[#1d3047] px-1.5 text-cyan-300">确定</button><span className="text-slate-300">{t?.name}</span><span className="ml-auto font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)} {fmtPct(t?.changePct)}</span></form>
            <div className="flex flex-wrap items-center gap-1"><span className="w-10 text-slate-400">方向</span><Seg value={side} options={[["B", "买入"], ["S", "卖出"]]} onChange={setSide} /><Seg value={type} options={[["LMT", "限价"], ["MKT", "市价"]]} onChange={setType} /><span className="ml-2 text-slate-400">总量</span><input type="number" value={qty} onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))} className={`${inp} w-24 text-right`} />{type === "LMT" && <><span className="text-slate-400">价格</span><input type="number" step="0.01" value={px} placeholder={t?.price ? String(t.price) : ""} onChange={(e) => setPx(e.target.value === "" ? "" : Number(e.target.value))} className={`${inp} w-20 text-right`} /></>}</div>
          </div>
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">账户</th><th className="text-right">理论手数</th><th className="text-right">分配手数</th><th className="text-right">分配数量</th><th className="px-2 text-right">预估金额</th></tr></thead>
            <tbody>{plan?.rows.map((r) => <tr key={r.id} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.name}</td><td className="text-right font-mono text-slate-400">{r.raw.toFixed(2)}</td><td className="text-right font-mono text-white">{r.lots}</td><td className="text-right font-mono text-white">{r.qty}</td><td className="px-2 text-right font-mono text-slate-300">{fmtCompact(r.qty * Number(px || t?.price || 0))}</td></tr>)}</tbody></table>
          {plan && plan.odd > 0 && <div className="px-2 text-[10px] text-amber-200">总量不是交易单位的整数倍，零股 {plan.odd} 不参与分配。</div>}
          <div className="flex items-center gap-2 px-2 py-1"><Btn tone="amber" disabled={busy || !t?.price || !plan?.lots} onClick={() => void submit()}>{busy ? "提交中…" : "按分配提交子单"}</Btn><span className="text-[10px] text-slate-500">每个账户各提交一笔子委托，按实时行情撮合</span></div>
          {log.length > 0 && <div className="px-2 pb-1 text-[10px] text-slate-300">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
        </div>
      </div>
      <SectionHead title="各账户持仓与成交" />
      <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">账户</th><th className="text-right">持仓标的数</th><th className="text-right">持仓市值</th><th className="text-right">浮动盈亏</th><th className="text-right">已实现</th><th className="text-right">成交笔数</th><th className="px-2 text-right">成交额</th></tr></thead>
        <tbody>{accts.map((a) => { const ps = pos.filter((r) => r.account === a && Math.abs(r.qty) > 1e-9); const fs = fills.filter((x) => x.account === a); const sum = (k: "marketValue" | "unrealized" | "realized") => ps.reduce((s, r) => s + (r[k] ?? 0), 0); return <tr key={a} className={TR}><td className="px-2 py-0.5 text-slate-100">{nameOf(a)}<span className="ml-1 font-mono text-[9px] text-slate-600">{a}</span></td><td className="text-right font-mono">{ps.length}</td><td className="text-right font-mono text-white">{fmtCompact(sum("marketValue"))}</td><td className="text-right font-mono" style={{ color: toneOf(sum("unrealized")) }}>{fmtCompact(sum("unrealized"))}</td><td className="text-right font-mono" style={{ color: toneOf(sum("realized")) }}>{fmtCompact(sum("realized"))}</td><td className="text-right font-mono text-slate-400">{fs.length}</td><td className="px-2 text-right font-mono text-slate-300">{fmtCompact(fs.reduce((s, x) => s + x.notional, 0))}</td></tr>; })}</tbody></table>
      <SectionHead title="账户持仓对账" sub="持仓簿数量 vs 由逐笔成交重算的数量，差异为 0 即对平" />
      {!recon.length ? <NoTrades loading={f.loading && !f.data} what="暂无持仓与成交，对账表为空。可用上方“母单分配”向多个账户提交子委托。" strategy="ALOB" /> :
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">账户</th><th className="text-left">标的</th><th className="text-right">持仓簿</th><th className="text-right">成交重算</th><th className="text-right">差异</th><th className="px-2 text-left">状态</th></tr></thead>
          <tbody>{recon.map((r) => <tr key={`${r.a}|${r.s}`} className={TR}><td className="px-2 py-0.5 text-slate-300">{nameOf(r.a)}</td><td className="text-slate-100">{r.s}</td><td className="text-right font-mono">{r.book}</td><td className="text-right font-mono">{r.fl}</td><td className="text-right font-mono" style={{ color: r.diff ? "#f87171" : "#64748b" }}>{r.diff}</td><td className="px-2" style={{ color: r.diff ? "#f87171" : "#34d399" }}>{r.diff ? "差异" : "已对平"}</td></tr>)}</tbody></table>}
    </Frame>
  );
}

/* ================================================================== ALOS 交收路由与券商映射 */
export function StpALOS({ onClose }: P) {
  const f = useFills();
  const fills = f.data ?? [];
  const [code, setCode] = useState("0700.HK");
  const [input, setInput] = useState("0700.HK");
  const t = useTick(code);
  const td = today();
  const mk = fills.find((x) => x.symbol === code)?.market ?? marketOfCode(code);
  const rt = ROUTE[mk];
  const stats = (arr: Fill[]) => { const n = arr.reduce((s, x) => s + x.notional, 0); return { n: arr.length, notional: n, fee: n ? (arr.reduce((s, x) => s + x.fee, 0) / n) * 1e4 : null, tax: n ? (arr.reduce((s, x) => s + x.tax, 0) / n) * 1e4 : null, lag: median(arr.map((x) => bizBetween(x.tradeDate, x.settleDate))), settled: arr.filter((x) => x.settled).length }; };
  const venues = Object.entries(fills.reduce<Record<string, Fill[]>>((a, x) => { (a[venueOf(x.symbol, x.market)] ??= []).push(x); return a; }, {})).map(([k, arr]) => ({ k, ...stats(arr) })).sort((a, b) => b.notional - a.notional);
  return (
    <Frame code="ALOS" title="交收路由与账户映射" onClose={onClose}>
      <SectionHead title="市场 → 交收路由" sub="平台撮合引擎按以下规则生成交收日与交收币种；实际费用率由历史成交反算" />
      <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">市场</th><th className="text-left">交易场所</th><th className="text-left">登记结算机构</th><th className="text-left">周期</th><th className="text-left">币种</th><th className="text-left">交易单位</th><th className="text-right">成交笔数</th><th className="text-right">成交额</th><th className="text-right">佣金率</th><th className="text-right">税费率</th><th className="px-2 text-right">实际交收间隔</th></tr></thead>
        <tbody>{Object.entries(ROUTE).map(([m, r]) => { const s = stats(fills.filter((x) => x.market === m)); return <tr key={m} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.name}</td><td className="text-slate-300">{r.ex}</td><td className="text-slate-300">{r.csd}</td><td className="font-mono text-amber-200">{r.cycle}</td><td className="font-mono text-slate-300">{r.ccy}</td><td className="text-slate-400">{r.lot}</td><td className="text-right font-mono">{s.n || "—"}</td><td className="text-right font-mono text-white">{s.n ? fmtCompact(s.notional) : "—"}</td><td className="text-right font-mono">{s.fee == null ? "—" : `${s.fee.toFixed(2)} 基点`}</td><td className="text-right font-mono">{s.tax == null ? "—" : `${s.tax.toFixed(2)} 基点`}</td><td className="px-2 text-right font-mono">{s.lag == null ? "—" : `${s.lag} 个工作日`}</td></tr>; })}</tbody></table>
      <SectionHead title="代码路由解析" sub="输入任意代码，查看其交易场所、交收机构与今天成交的交收日" />
      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) setCode(input.trim()); }} className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="如 sh600519 / 0700.HK / AAPL / GC" className="w-56 border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white" /><button className="border border-cyan-800 px-2 text-cyan-200">解析</button></form>
      <table className="w-full text-[11px]"><tbody>
        {([["代码", <span className="font-mono text-cyan-200">{code}</span>], ["名称", t?.name ?? "—"], ["最新价", <span className="font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)} {fmtPct(t?.changePct)}</span>], ["市场", mktName(mk)], ["交易场所", venueOf(code, mk)], ["登记结算机构", rt?.csd ?? "—"], ["交收周期", rt?.cycle ?? "—"], ["交收币种", rt?.ccy ?? "—"], ["最小交易单位", String(lotOf(code))], ["今日成交的交收日", rt ? `${addBiz(td, rt.days)}（${rt.cycle}，按工作日顺延）` : "—"], ["本账户历史成交", `${fills.filter((x) => x.symbol === code).length} 笔`]] as Array<[string, React.ReactNode]>).map(([k, v]) => <tr key={k} className={TR}><td className="w-40 px-2 py-0.5 text-slate-500">{k}</td><td className="px-2 text-slate-100">{v}</td></tr>)}
      </tbody></table>
      <SectionHead title="按交易场所的路由使用情况" />
      {!fills.length ? <NoTrades loading={f.loading && !f.data} what="暂无成交，路由使用统计为空。成交后按交易场所统计笔数、金额、实际费用率与交收间隔。" strategy="ALOS" /> :
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">场所</th><th className="text-right">笔数</th><th className="text-right">成交额</th><th className="text-right">佣金率</th><th className="text-right">税费率</th><th className="text-right">已交收</th><th className="px-2 text-right">占比</th></tr></thead>
          <tbody>{venues.map((v) => { const tot = venues.reduce((s, x) => s + x.notional, 0) || 1; return <tr key={v.k} className={TR}><td className="px-2 py-0.5 text-slate-100">{v.k}</td><td className="text-right font-mono">{v.n}</td><td className="text-right font-mono text-white">{fmtCompact(v.notional)}</td><td className="text-right font-mono">{v.fee?.toFixed(2) ?? "—"}</td><td className="text-right font-mono">{v.tax?.toFixed(2) ?? "—"}</td><td className="text-right font-mono text-emerald-300">{v.settled}/{v.n}</td><td className="px-2 text-right font-mono" style={{ background: heat((v.notional / tot) * 100, 100) }}>{((v.notional / tot) * 100).toFixed(1)}%</td></tr>; })}</tbody></table>}
    </Frame>
  );
}

/* ================================================================== SREF 转介队列 */
export function StpSREF({ onClose }: P) {
  const o = useOrders();
  const e = useEvents();
  const now = useNow(5000);
  const [maxAge, setMaxAge] = useState<"10" | "30" | "120">("30");
  const [maxDev, setMaxDev] = useState<"1" | "2" | "5">("2");
  const [msg, setMsg] = useState<string | null>(null);
  const ord = o.data ?? [];
  const live = ord.filter((x) => x.status === "NEW" || x.status === "PARTIAL");
  const t = useTicks([...new Set(live.map((x) => x.symbol))].slice(0, 60));
  const wk = Date.now() - 7 * 86400e3;
  const rejected = ord.filter((x) => x.status === "REJECTED" && x.createdAt >= wk);
  const why = (x: Order) => { const r: string[] = []; const age = now - x.createdAt; if (age > Number(maxAge) * 60e3) r.push(`挂单超过 ${maxAge} 分钟`); const lp = x.limitPx ?? x.stopPx; const last = t[x.symbol]?.price; if (lp && last) { const dev = Math.abs(lp / last - 1) * 100; if (dev > Number(maxDev)) r.push(`委托价偏离最新价 ${dev.toFixed(2)}%`); } if (x.status === "PARTIAL") r.push("部分成交"); return r; };
  const queue = live.map((x) => ({ x, why: why(x) })).filter((r) => r.why.length).sort((a, b) => a.x.createdAt - b.x.createdAt);
  const act = async (label: string, fn: () => Promise<unknown>) => { setMsg(`${label}…`); try { await fn(); setMsg(`${label}：已提交`); } catch (err) { setMsg(`${label}失败：${(err as Error).message}`); } };
  const remarket = (x: Order) => act(`委托 ${x.id} 改市价重下`, async () => { await cancelOrder(x.id); await placeOrder({ symbol: x.symbol, side: x.side, type: "MKT", qty: x.qty - x.filledQty, account: x.account, strategy: "SREF", note: `转介处理：替换委托 ${x.id}` }); });
  const resubmit = (x: Order) => act(`拒单 ${x.id} 重新提交`, () => placeOrder({ symbol: x.symbol, side: x.side, type: x.type, qty: x.qty, limitPx: x.limitPx, stopPx: x.stopPx, tif: x.tif as "DAY", account: x.account, strategy: "SREF", note: `重提委托 ${x.id}` }));
  const life = (s: string) => median(ord.filter((x) => x.status === s).map((x) => x.updatedAt - x.createdAt));
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); const k = d.toLocaleDateString("sv-SE"); const day = ord.filter((x) => new Date(x.createdAt).toLocaleDateString("sv-SE") === k); return { k: k.slice(5), v: day.filter((x) => x.status === "REJECTED").length, v2: day.filter((x) => x.status === "CANCELLED" || x.status === "EXPIRED").length }; }), [ord]);
  const hist = (e.data ?? []).filter((x) => ["CANCEL", "REJECT", "EXPIRE"].includes(x.kind));
  return (
    <Frame code="SREF" title="直通异常转介队列" onClose={onClose} right={<><span>挂单阈值</span><Seg value={maxAge} options={[["10", "10分"], ["30", "30分"], ["120", "2时"]]} onChange={setMaxAge} /><span>偏离阈值</span><Seg value={maxDev} options={[["1", "1%"], ["2", "2%"], ["5", "5%"]]} onChange={setMaxDev} /></>}>
      <Kpis items={[["待人工处理", <span style={{ color: queue.length ? "#fbbf24" : "#34d399" }}>{queue.length}</span>, `在途委托 ${live.length}`], ["近 7 日拒单", String(rejected.length)], ["成交委托存续中位数", fmtDur(life("FILLED"))], ["撤单委托存续中位数", fmtDur(life("CANCELLED"))]]} />
      {msg && <div className="px-2 py-0.5 text-[10px] text-amber-200">{msg}</div>}
      {!ord.length ? <NoTrades loading={o.loading && !o.data} what="暂无委托，转介队列为空。挂单过久、委托价明显偏离市场或部分成交的委托会自动进入此队列。" strategy="SREF" /> : <>
        <SectionHead title="转介队列（在途委托）" sub="可直接撤单，或撤单后以剩余数量按市价重新下单" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">委托</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-right">数量/已成</th><th className="text-right">委托价</th><th className="text-right">最新价</th><th className="text-right">已挂</th><th className="text-left pl-2">转介原因</th><th className="px-2 text-right">处理</th></tr></thead>
          <tbody>{queue.map(({ x, why: w }) => <tr key={x.id} className={TR}><td className="px-2 py-0.5 font-mono text-slate-400">{x.id}</td><td className="text-slate-100">{x.name ?? x.symbol}</td><td className="text-center"><SideTxt s={x.side} /></td><td className="text-right font-mono">{x.qty}/{x.filledQty}</td><td className="text-right font-mono text-white">{fmtPrice(x.limitPx ?? x.stopPx)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(t[x.symbol]?.price)}</td><td className="text-right font-mono text-slate-400">{fmtDur(now - x.createdAt)}</td><td className="pl-2 text-amber-200">{w.join("；")}</td><td className="space-x-1 px-2 text-right whitespace-nowrap"><Btn onClick={() => void act(`撤销委托 ${x.id}`, () => cancelOrder(x.id))}>撤单</Btn><Btn tone="amber" onClick={() => void remarket(x)}>改市价</Btn></td></tr>)}{!queue.length && <tr><td colSpan={9} className="px-2 py-4 text-slate-500">当前没有触发转介条件的在途委托。</td></tr>}</tbody></table>
        <SectionHead title="近 7 日拒单" sub="修正条件（如资金、持仓）后可原样重新提交" />
        <table className="w-full text-[11px]"><tbody>{rejected.map((x) => <tr key={x.id} className={TR}><td className="px-2 py-0.5 font-mono text-slate-400">{x.id}</td><td className="font-mono text-[10px] text-slate-500">{new Date(x.createdAt).toLocaleString("zh-CN", { hour12: false })}</td><td className="text-slate-100">{x.symbol} <SideTxt s={x.side} /> {x.qty}</td><td className="text-red-200">{x.reject}</td><td className="px-2 text-right"><Btn onClick={() => void resubmit(x)}>重新提交</Btn></td></tr>)}{!rejected.length && <tr><td className="px-2 py-3 text-slate-500">近 7 日没有拒单。</td></tr>}</tbody></table>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="近 30 天异常量" /><Bars data={days} label={["拒单", "撤单/失效"]} fmt={(v) => `${v} 笔`} height={120} /></div>
          <div className="bg-[#03070c]"><SectionHead title="处理历史（撤单 / 拒单 / 失效）" /><div className="max-h-[220px] overflow-y-auto"><EventsList rows={hist} max={80} /></div></div>
        </div>
      </>}
    </Frame>
  );
}

/* ================================================================== MIFI 最佳执行报告 */
export function StpMIFI({ onClose }: P) {
  const f = useFills();
  const o = useOrders();
  const fx = useFx();
  const [win, setWin] = useState<"7" | "30" | "all">("30");
  const since = win === "all" ? 0 : Date.now() - Number(win) * 86400e3;
  const ord = (o.data ?? []).filter((x) => x.createdAt >= since);
  const fills = (f.data ?? []).filter((x) => x.ts >= since);
  const ordMap = useMemo(() => new Map((o.data ?? []).map((x) => [x.id, x])), [o.data]);
  const firstFill = useMemo(() => { const m = new Map<number, number>(); for (const x of f.data ?? []) m.set(x.orderId, Math.min(m.get(x.orderId) ?? Infinity, x.ts)); return m; }, [f.data]);
  const cny = (x: Fill) => toCny(x.notional, x.ccy, fx.data) ?? 0;
  const totN = fills.reduce((s, x) => s + cny(x), 0) || 1;
  const venueOfOrder = (x: Order) => venueOf(x.symbol, x.market);
  const venues = [...new Set([...fills.map((x) => venueOf(x.symbol, x.market)), ...ord.map(venueOfOrder)])];
  const rows = venues.map((v) => {
    const fs = fills.filter((x) => venueOf(x.symbol, x.market) === v);
    const os = ord.filter((x) => venueOfOrder(x) === v);
    const n = fs.reduce((s, x) => s + cny(x), 0);
    const passive = fs.filter((x) => ordMap.get(x.orderId)?.type === "LMT");
    const improve = passive.map((x) => { const lp = ordMap.get(x.orderId)?.limitPx; return lp ? (x.side === "B" ? (lp - x.px) / lp : (x.px - lp) / lp) * 1e4 : null; }).filter((y): y is number => y != null);
    const speed = os.map((x) => (firstFill.has(x.id) ? firstFill.get(x.id)! - x.createdAt : null)).filter((y): y is number => y != null);
    const live = os.filter((x) => x.status !== "REJECTED");
    const q = live.reduce((s, x) => s + x.qty, 0);
    const nat = fs.reduce((s, x) => s + x.notional, 0);
    return { v, n, share: (n / totN) * 100, orders: os.length, ordShare: ord.length ? (os.length / ord.length) * 100 : 0, passive: fs.length ? (passive.length / fs.length) * 100 : null, improve: improve.length ? improve.reduce((a, b) => a + b, 0) / improve.length : null, cost: nat ? (fs.reduce((s, x) => s + x.fee + x.tax, 0) / nat) * 1e4 : null, speed: median(speed), fillRate: q ? (live.reduce((s, x) => s + x.filledQty, 0) / q) * 100 : null };
  }).sort((a, b) => b.n - a.n);
  const allSpeed = median(ord.map((x) => (firstFill.has(x.id) ? firstFill.get(x.id)! - x.createdAt : null)).filter((y): y is number => y != null));
  const liveAll = ord.filter((x) => x.status !== "REJECTED");
  const fr = liveAll.reduce((s, x) => s + x.qty, 0);
  const types = ["LMT", "MKT", "STP"].map((k) => ({ k: ({ LMT: "限价", MKT: "市价", STP: "止损" } as Record<string, string>)[k], v: ord.filter((x) => x.type === k).length, v2: ord.filter((x) => x.type === k && x.status === "FILLED").length }));
  return (
    <Frame code="MIFI" title="最佳执行报告（前五大执行场所）" onClose={onClose} right={<Seg value={win} options={[["7", "近 7 天"], ["30", "近 30 天"], ["all", "全部"]]} onChange={setWin} />}>
      <Kpis items={[["成交额（折人民币）", fmtCompact(fills.reduce((s, x) => s + cny(x), 0)), `${fills.length} 笔成交`], ["执行场所数", String(venues.length)], ["委托至首笔成交中位数", fmtDur(allSpeed), "执行速度"], ["数量成交率", fr ? `${((liveAll.reduce((s, x) => s + x.filledQty, 0) / fr) * 100).toFixed(1)}%` : "—", "成交可能性（不含拒单）"]]} />
      {!fills.length && !ord.length ? <NoTrades loading={f.loading && !f.data} what="所选区间内没有委托与成交。最佳执行报告按执行场所统计价格、成本、速度与成交可能性四项要素。" strategy="MIFI" /> : <>
        <SectionHead title="执行场所排名（按成交额）" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">排名</th><th className="text-left">执行场所</th><th className="text-right">成交额占比</th><th className="text-right">委托笔数</th><th className="text-right">委托占比</th><th className="text-right">被动成交占比</th><th className="text-right">价格改善</th><th className="text-right">显性成本</th><th className="text-right">执行速度</th><th className="px-2 text-right">成交率</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.v} className={`${TR} ${i < 5 ? "" : "opacity-60"}`}><td className="px-2 py-0.5 font-mono text-slate-500">{i + 1}</td><td className="text-slate-100">{r.v}</td><td className="text-right font-mono text-white" style={{ background: heat(r.share, 100) }}>{r.share.toFixed(1)}%</td><td className="text-right font-mono">{r.orders}</td><td className="text-right font-mono">{r.ordShare.toFixed(1)}%</td><td className="text-right font-mono">{r.passive == null ? "—" : `${r.passive.toFixed(0)}%`}</td><td className="text-right font-mono" style={{ color: toneOf(r.improve) }}>{r.improve == null ? "—" : `${r.improve.toFixed(1)} 基点`}</td><td className="text-right font-mono">{r.cost == null ? "—" : `${r.cost.toFixed(1)} 基点`}</td><td className="text-right font-mono text-slate-300">{fmtDur(r.speed)}</td><td className="px-2 text-right font-mono">{r.fillRate == null ? "—" : `${r.fillRate.toFixed(1)}%`}</td></tr>)}</tbody></table>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="成交额占比" /><Bars data={rows.map((r) => ({ k: r.v, v: r.share }))} fmt={(v) => `${v.toFixed(1)}%`} height={120} /></div>
          <div className="bg-[#03070c]"><SectionHead title="委托类型：提交量 vs 全部成交量" /><Bars data={types} label={["提交", "全部成交"]} fmt={(v) => `${v} 笔`} height={120} /></div>
        </div>
      </>}
    </Frame>
  );
}
