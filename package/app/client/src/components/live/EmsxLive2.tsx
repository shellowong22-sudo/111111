/**
 * EMSX 电子交易工作台（第二组：组合、对冲、股票外汇与交易工具）。数据全部来自平台自有模拟交易系统与真实行情：
 *  - IMGR   库存与定价：账户内固收持仓按实时价重估、经验久期、DV01、相对建仓成本
 *  - TRDE   多品种列表：跨资产批量委托清单，一键逐笔提交并回显结果
 *  - IRSWAP 利率互换对冲：按国债曲线估算互换 DV01，换算为国债期货对冲张数并可直接下单
 *  - CDS    信用对冲：个股 / 组合对高收益与投资级信用基金的 Beta，换算对冲股数并可直接下单
 *  - EQUITY 股票执行：盘口、当日成交量加权均价与成交相对均价的执行偏差
 *  - FX     外汇执行：账户按币种的敞口与实时汇率折算
 *  - WORKFLOW 交易限额与预检：个人限额（永久保存）与当前持仓 / 当日成交的占用与超限
 *  - ETBT   单品种记录簿：单一标的的全部成交、持仓成本线与已实现 / 浮动盈亏
 *  - WATL   观察列表与技术状态：自选标的的均线位置、相对强弱、突破与波动，状态变化提示
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import KlineChart from "@/uc/market/KlineChart";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useLiveKline, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, useHub } from "@/uc/hubs/kit";
import { align, annVol, f2, mean, rets, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { FillsTable, OrderTicket, placeOrder, useFills, useOrders, usePositions, type Position } from "@/uc/trade/kit";
import { BTN, INP, MiniLine, Note, ROW, TD, TDL, TH, THL, tenorVal, useCurves, yieldFn, type P } from "./LiveCommon";
import { Desk, useEmpDur, useFutDv01, type Inst } from "./EmsxLive";

const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
const FI = new Set(["AGG", "BND", "SHY", "IEI", "IEF", "TLT", "TIP", "STIP", "LTPZ", "LQD", "VCIT", "VCSH", "VCLT", "IGIB", "HYG", "JNK", "SHYG", "USHY", "MUB", "VTEB", "SUB", "SHM", "TFI", "HYD", "EMB", "PCY", "CEMB", "EMHY", "EMLC", "LEMB", "MBB", "VMBS", "SPMB", "JMBS", "GNMA", "BIL", "SGOV", "BNDX", "BWX", "IGOV", "IAGG", "ISHG", "BNDW", "ZT", "ZF", "ZN", "ZB", "UB", "sh511010", "sh511260", "sh511090", "sh511020", "sh511030", "sh511220", "sh511360", "sh511880"]);
const isFi = (s: string) => FI.has(s);

/* ================================================================== IMGR 库存与定价 */
export function ImgrLive({ onClose: _ }: P) {
  const pos = usePositions();
  const rows = (pos.data?.rows ?? []).filter((p) => p.qty !== 0 && isFi(p.symbol));
  const dur = useEmpDur(rows.map((r) => r.symbol));
  const tot = rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  const dv = rows.reduce((s, r) => s + ((r.marketValue ?? 0) * (dur[r.symbol] ?? 0) * 0.0001), 0);
  return (
    <PanelShell code="IMGR" title="库存与定价">
      <Kpis items={[["固收持仓数", String(rows.length)], ["市值", fmtCompact(tot)], ["组合 DV01（每 1bp）", dv.toFixed(0)], ["浮动盈亏", <span style={{ color: toneOf(rows.reduce((s, r) => s + (r.unrealized ?? 0), 0)) }}>{fmtCompact(rows.reduce((s, r) => s + (r.unrealized ?? 0), 0))}</span>]]} />
      {!rows.length ? <><Empty text="账户内暂无固定收益持仓，可在下方下单建立" /><OrderTicket initial="IEF" strategy="IMGR" /></> : (
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>代码</th><th className={TH}>持仓</th><th className={TH}>成本</th><th className={TH}>现价</th><th className={TH}>相对成本</th><th className={TH}>市值</th><th className={TH}>浮动盈亏</th><th className={TH}>经验久期</th><th className={TH}>DV01</th><th className={TH}>+50bp 情景</th></tr></thead>
          <tbody>{rows.map((r) => { const D = dur[r.symbol] ?? null; const mv = r.marketValue ?? 0; return <tr key={r.symbol} className={ROW}><td className={`${TDL} font-mono text-cyan-200`}>{r.symbol}</td><td className={`${TD} text-slate-300`}>{r.qty}</td><td className={`${TD} text-slate-400`}>{fmtPrice(r.avgCost)}</td><td className={`${TD} text-white`}>{fmtPrice(r.last)}</td><td className={TD} style={{ color: toneOf(r.last && r.avgCost ? r.last - r.avgCost : null) }}>{r.last && r.avgCost ? sgn((r.last / r.avgCost - 1) * 100) : "—"}</td><td className={`${TD} text-slate-200`}>{fmtCompact(mv)}</td><td className={TD} style={{ color: toneOf(r.unrealized) }}>{fmtCompact(r.unrealized)}</td><td className={`${TD} text-slate-300`}>{f2(D, 2)}</td><td className={`${TD} text-slate-300`}>{D == null ? "—" : (mv * D * 0.0001).toFixed(0)}</td><td className={TD} style={{ color: "#1fbf75" }}>{D == null ? "—" : fmtCompact(-mv * D * 0.005)}</td></tr>; })}</tbody>
        </table>
      )}
      <Note>持仓取自平台模拟账户；经验久期为对 10 年美债收益率的回归久期，DV01 与情景为一阶近似。</Note>
    </PanelShell>
  );
}

/* ================================================================== TRDE 多品种列表 */
type Line = { symbol: string; side: "B" | "S"; type: "MKT" | "LMT"; qty: number; px: number | null; res?: string };
export function TrdeLive({ onClose: _ }: P) {
  const [lines, setLines] = useState<Line[]>([{ symbol: "IEF", side: "B", type: "MKT", qty: 100, px: null }, { symbol: "sh510300", side: "B", type: "MKT", qty: 1000, px: null }]);
  const [busy, setBusy] = useState(false);
  const ticks = useTicks(lines.map((l) => l.symbol).filter(Boolean));
  const up = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p, res: undefined } : l)));
  const total = lines.reduce((s, l) => s + (l.qty * (l.px ?? ticks[l.symbol]?.price ?? 0)) * (l.side === "B" ? 1 : -1), 0);
  const submitAll = async () => {
    setBusy(true);
    const out = [...lines];
    for (let i = 0; i < out.length; i++) {
      const l = out[i];
      if (!l.symbol || !l.qty) { out[i] = { ...l, res: "跳过：缺少代码或数量" }; continue; }
      try { const r = await placeOrder({ symbol: l.symbol, side: l.side, type: l.type, qty: l.qty, limitPx: l.type === "LMT" ? l.px ?? ticks[l.symbol]?.price ?? null : null, strategy: "TRDE" }); out[i] = { ...l, res: r.status === "REJECTED" ? `拒绝：${r.reject}` : `委托 ${r.id}` }; } catch (e) { out[i] = { ...l, res: `失败：${(e as Error).message}` }; }
      setLines([...out]);
    }
    setBusy(false);
    toast.success("批量委托已逐笔提交");
  };
  return (
    <PanelShell code="TRDE" title="多品种列表">
      <div className="flex items-center gap-2 px-2 py-1 text-[11px]"><button type="button" className={BTN} onClick={() => setLines((l) => [...l, { symbol: "", side: "B", type: "MKT", qty: 100, px: null }])}>添加一行</button><span className="text-slate-500">净买入金额（估）<b className="font-mono text-slate-200">{fmtCompact(total)}</b></span><button type="button" disabled={busy} onClick={() => void submitAll()} className="ml-auto border border-red-500 bg-red-600/30 px-3 py-0.5 text-red-100 disabled:opacity-40">{busy ? "提交中…" : "全部提交"}</button></div>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>代码</th><th className={THL}>方向</th><th className={THL}>类型</th><th className={TH}>数量</th><th className={TH}>限价</th><th className={TH}>最新</th><th className={TH}>估算金额</th><th className={THL}>结果</th><th className={TH} /></tr></thead>
        <tbody>{lines.map((l, i) => { const t = ticks[l.symbol]; return (
          <tr key={i} className={ROW}>
            <td className={TDL}><input value={l.symbol} onChange={(e) => up(i, { symbol: e.target.value.trim() })} className={`${INP} w-28`} /></td>
            <td className={TDL}><select value={l.side} onChange={(e) => up(i, { side: e.target.value as "B" })} className={INP}><option value="B">买入</option><option value="S">卖出</option></select></td>
            <td className={TDL}><select value={l.type} onChange={(e) => up(i, { type: e.target.value as "MKT" })} className={INP}><option value="MKT">市价</option><option value="LMT">限价</option></select></td>
            <td className={TD}><input type="number" value={l.qty} onChange={(e) => up(i, { qty: Number(e.target.value) || 0 })} className={`${INP} w-20`} /></td>
            <td className={TD}>{l.type === "LMT" ? <input type="number" value={l.px ?? ""} placeholder={t?.price ? String(t.price) : ""} onChange={(e) => up(i, { px: e.target.value === "" ? null : Number(e.target.value) })} className={`${INP} w-20`} /> : "—"}</td>
            <td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)}</td>
            <td className={`${TD} text-slate-300`}>{fmtCompact(l.qty * (l.px ?? t?.price ?? 0))}</td>
            <td className={`${TDL} text-[10px] text-amber-200`}>{l.res ?? ""}</td>
            <td className={TD}><button type="button" className="text-[10px] text-slate-500 hover:text-rose-300" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>删除</button></td>
          </tr>); })}</tbody>
      </table>
      <Note>逐笔按顺序提交到平台模拟账户，每行回显委托编号或拒绝原因；委托标记来源为本功能。</Note>
    </PanelShell>
  );
}

/* ================================================================== IRSWAP 利率互换对冲 */
const SW_T = [2, 5, 10, 30];
export function IrswapLive({ onClose: _ }: P) {
  const cur = useCurves();
  const dv = useFutDv01();
  const [notional, setNotional] = useState("10000000");
  const [tenor, setTenor] = useState("10");
  const [dir, setDir] = useState<"pay" | "rec">("pay");
  const [busy, setBusy] = useState(false);
  const last = cur.data?.us.at(-1);
  const T = Number(tenor);
  const y = last ? yieldFn(last.points) : null;
  // 互换 DV01 ≈ 名义 × 年金系数 × 0.0001；年金按国债曲线贴现（半年付息）
  const annuity = y ? Array.from({ length: T * 2 }, (_, i) => { const t = (i + 1) / 2; const r = y(t) ?? 0; return 0.5 / Math.pow(1 + r / 2, 2 * t); }).reduce((s, v) => s + v, 0) : null;
  const swapDv = annuity != null ? Number(notional) * annuity * 0.0001 : null;
  const fut = dv.find((d) => d.s === (T <= 2 ? "ZT" : T <= 5 ? "ZF" : T <= 10 ? "ZN" : "ZB"));
  const n = swapDv != null && fut?.dv01 ? swapDv / fut.dv01 : null;
  // 付固定 = 久期空头 → 对冲需买入期货；收固定 = 久期多头 → 卖出期货
  const side: "B" | "S" = dir === "pay" ? "B" : "S";
  const go = async () => { if (!fut || !n) return; setBusy(true); try { const r = await placeOrder({ symbol: fut.s, side, type: "MKT", qty: Math.max(1, Math.round(n)), strategy: "IRSWAP" }); toast.success(r.status === "REJECTED" ? `已拒绝：${r.reject}` : `对冲委托 ${r.id} 已提交`); } catch (e) { toast.error((e as Error).message); } setBusy(false); };
  return (
    <PanelShell code="IRSWAP" title="利率互换对冲">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]"><span className="text-slate-500">互换名义本金（美元）</span><input value={notional} onChange={(e) => setNotional(e.target.value.replace(/[^\d.]/g, ""))} className={`${INP} w-32`} /><Seg value={tenor} options={SW_T.map((t) => [String(t), `${t} 年`] as [string, string])} onChange={setTenor} /><Seg value={dir} options={[["pay", "付固定"], ["rec", "收固定"]]} onChange={setDir} /></div>
      <Kpis items={[["曲线日期", last?.date ?? "—"], [`${T} 年国债收益率`, f2(tenorVal(last, `${T}Y`), 3, "%")], ["年金系数", f2(annuity, 3)], ["互换 DV01（每 1bp）", swapDv == null ? "—" : `$${swapDv.toFixed(0)}`], ["对冲合约", fut?.n ?? "—"], ["每手 DV01", fut?.dv01 == null ? "—" : `$${fut.dv01.toFixed(1)}`], ["所需张数", n == null ? "—" : `${side === "B" ? "买入" : "卖出"} ${n.toFixed(1)}`]]} />
      <div className="px-2 py-1"><button type="button" disabled={busy || !n} onClick={() => void go()} className={`border px-3 py-0.5 ${side === "B" ? "border-red-500 bg-red-600/30 text-red-100" : "border-emerald-500 bg-emerald-600/30 text-emerald-100"} disabled:opacity-40`}>{busy ? "提交中…" : `按市价${side === "B" ? "买入" : "卖出"} ${n ? Math.max(1, Math.round(n)) : "—"} 手 ${fut?.s ?? ""}`}</button></div>
      <SectionHead title="各期限互换 DV01 与期货对冲张数（每 1,000 万名义）" />
      <Bars data={SW_T.map((t) => { const a = y ? Array.from({ length: t * 2 }, (_, i) => { const tt = (i + 1) / 2; const r = y(tt) ?? 0; return 0.5 / Math.pow(1 + r / 2, 2 * tt); }).reduce((s, v) => s + v, 0) : 0; const f = dv.find((d) => d.s === (t <= 2 ? "ZT" : t <= 5 ? "ZF" : t <= 10 ? "ZN" : "ZB")); return { k: `${t} 年`, v: f?.dv01 ? (1e7 * a * 0.0001) / f.dv01 : 0 }; })} fmt={(v) => `${v.toFixed(1)} 手`} height={110} />
      <Note>互换曲线以国债曲线近似（未计互换利差），期货 DV01 为经验久期估算；结果用于确定对冲方向与规模，下单在平台模拟账户执行。</Note>
    </PanelShell>
  );
}

/* ================================================================== CDS 信用对冲 */
export function CdsHedgeLive({ onClose: _ }: P) {
  const [sym, setSym] = useState("BA");
  const [input, setInput] = useState("BA");
  const [amt, setAmt] = useState("1000000");
  const [busy, setBusy] = useState(false);
  const pack = useCloses([sym, "HYG", "LQD", "IEF"], 400);
  const ticks = useTicks([sym, "HYG", "LQD"]);
  const est = useMemo(() => {
    if (!pack.data) return null;
    const al = align(pack.data, [sym, "HYG", "LQD", "IEF"]);
    const r = (s: string) => rets(al.m[s].slice(-253));
    const a = r(sym);
    const reg = (b: number[]) => { const mb = mean(b), ma = mean(a); let cv = 0, vb = 0; for (let i = 0; i < a.length; i++) { cv += (b[i] - mb) * (a[i] - ma); vb += (b[i] - mb) ** 2; } const beta = vb > 0 ? cv / vb : null; const corr = beta != null ? beta * std(b) / std(a) : null; return { beta, corr }; };
    // 信用因子 = 高收益基金 − 久期匹配国债，剔除利率成分
    const hy = r("HYG"), ief = r("IEF");
    const credit = hy.map((v, i) => v - 0.5 * ief[i]);
    return { hyg: reg(hy), lqd: reg(r("LQD")), credit: reg(credit), vol: annVol(al.m[sym], 60) };
  }, [pack.data, sym]);
  const N = Number(amt) || 0;
  const hedgeShares = (beta: number | null, s: string) => (beta != null && ticks[s]?.price ? Math.round((N * beta) / ticks[s]!.price) : null);
  const hs = hedgeShares(est?.hyg.beta ?? null, "HYG");
  const go = async () => { if (!hs) return; setBusy(true); try { const r = await placeOrder({ symbol: "HYG", side: hs > 0 ? "S" : "B", type: "MKT", qty: Math.abs(hs), strategy: "CDS" }); toast.success(r.status === "REJECTED" ? `已拒绝：${r.reject}` : `对冲委托 ${r.id} 已提交`); } catch (e) { toast.error((e as Error).message); } setBusy(false); };
  return (
    <PanelShell code="CDS" title="信用对冲">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]"><form onSubmit={(e) => { e.preventDefault(); setSym(input.trim().toUpperCase()); }}><span className="text-slate-500">被对冲标的 </span><input value={input} onChange={(e) => setInput(e.target.value)} className={`${INP} w-24`} /></form><span className="text-slate-500">敞口金额（美元）</span><input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))} className={`${INP} w-28`} /><span className="text-slate-400">{sym} {fmtPrice(ticks[sym]?.price)} <span style={{ color: toneOf(ticks[sym]?.changePct) }}>{fmtPct(ticks[sym]?.changePct)}</span></span></div>
      {!est ? <Empty loading={pack.loading} /> : (
        <>
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>对冲工具</th><th className={TH}>Beta（1 年）</th><th className={TH}>相关系数</th><th className={TH}>对冲份额</th><th className={TH}>对冲金额</th></tr></thead>
            <tbody>{([["HYG 高收益债基金", est.hyg, "HYG"], ["LQD 投资级债基金", est.lqd, "LQD"], ["纯信用因子（高收益 − 0.5×国债）", est.credit, ""]] as Array<[string, { beta: number | null; corr: number | null }, string]>).map(([n, r, s]) => <tr key={n} className={ROW}><td className={`${TDL} text-slate-100`}>{n}</td><td className={`${TD} text-white`}>{f2(r.beta)}</td><td className={`${TD} text-slate-300`}>{f2(r.corr)}</td><td className={`${TD} text-amber-200`}>{s ? (hedgeShares(r.beta, s) ?? "—") : "—"}</td><td className={`${TD} text-slate-300`}>{r.beta != null ? fmtCompact(N * r.beta) : "—"}</td></tr>)}</tbody></table>
          <div className="px-2 py-1"><button type="button" disabled={busy || !hs} onClick={() => void go()} className="border border-emerald-500 bg-emerald-600/30 px-3 py-0.5 text-emerald-100 disabled:opacity-40">{busy ? "提交中…" : `按市价${(hs ?? 0) > 0 ? "卖出" : "买入"} ${Math.abs(hs ?? 0)} 股 HYG 对冲`}</button></div>
          <Note>没有公开的单名信用违约互换报价，这里以信用债基金作为可交易的信用对冲工具：Beta 为标的日收益对基金日收益的回归系数；相关系数低于 0.3 时对冲效果有限。{sym} 60 日年化波动 {f2(est.vol, 1, "%")}。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== EQUITY 股票执行 */
const EQ_UNI: Inst[] = [["sh600519", "贵州茅台"], ["sz300750", "宁德时代"], ["sh601318", "中国平安"], ["0700.HK", "腾讯控股"], ["9988.HK", "阿里巴巴"], ["AAPL", "苹果"], ["NVDA", "英伟达"], ["TSLA", "特斯拉"]];
export function EquityLive({ onClose: _ }: P) {
  return <Desk code="EQUITY" title="股票执行" uni={EQ_UNI}>{(sel) => <EqVwap sel={sel} />}</Desk>;
}
function EqVwap({ sel }: { sel: string }) {
  const k = useLiveKline(sel, "1m", 400);
  const fills = useFills();
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const day = k.candles.filter((c) => new Date(c.t + 8 * 3600_000).toISOString().slice(0, 10) === (k.candles.length ? new Date(k.candles[k.candles.length - 1].t + 8 * 3600_000).toISOString().slice(0, 10) : today));
  const pv = day.reduce((s, c) => s + ((c.h + c.l + c.c) / 3) * (c.v ?? 0), 0), vv = day.reduce((s, c) => s + (c.v ?? 0), 0);
  const vwap = vv ? pv / vv : null;
  const my = (fills.data ?? []).filter((f) => f.symbol === sel && f.tradeDate === today);
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="bg-[#03070c]"><SectionHead title={`${sel} 分时（1 分钟）`} sub={`当日成交量加权均价 ${vwap?.toFixed(3) ?? "—"}`} />{k.candles.length ? <KlineChart candles={k.candles} period="1m" height={220} live /> : <Empty loading={k.loading} />}</div>
      <div className="bg-[#03070c]"><SectionHead title="今日成交相对均价的执行偏差" />
        <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>时间</th><th className={THL}>方向</th><th className={TH}>数量</th><th className={TH}>成交价</th><th className={TH}>相对均价</th></tr></thead>
          <tbody>{my.map((f) => { const d = vwap ? ((f.px / vwap - 1) * 10000) * (f.side === "B" ? -1 : 1) : null; return <tr key={f.id} className={ROW}><td className={`${TDL} text-slate-400`}>{new Date(f.ts).toLocaleTimeString("zh-CN", { hour12: false })}</td><td className={TDL} style={{ color: f.side === "B" ? "#f2495c" : "#1fbf75" }}>{f.side === "B" ? "买" : "卖"}</td><td className={`${TD} text-slate-300`}>{f.qty}</td><td className={`${TD} text-white`}>{f.px.toFixed(3)}</td><td className={TD} style={{ color: toneOf(d) }}>{d == null ? "—" : `${d.toFixed(1)}bp`}</td></tr>; })}{!my.length && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-500">今日该标的暂无成交</td></tr>}</tbody></table>
        <Note>执行偏差为正 = 优于当日均价（买得更低 / 卖得更高）。</Note>
      </div>
    </div>
  );
}

/* ================================================================== FX 外汇执行 */
const FX_UNI: Inst[] = [["EURUSD", "欧元/美元"], ["USDJPY", "美元/日元"], ["GBPUSD", "英镑/美元"], ["AUDUSD", "澳元/美元"], ["USDCNH", "美元/离岸人民币"], ["USDCHF", "美元/瑞郎"], ["USDCAD", "美元/加元"], ["EURJPY", "欧元/日元"]];
export function FxExecLive({ onClose: _ }: P) {
  const pos = usePositions();
  const ticks = useTicks(["USDCNH", "USDHKD", "EURUSD", "USDJPY", "GBPUSD"]);
  const byCcy = useMemo(() => { const m: Record<string, number> = {}; for (const p of pos.data?.rows ?? []) { if (!p.marketValue) continue; m[p.ccy] = (m[p.ccy] ?? 0) + p.marketValue; } return m; }, [pos.data]);
  const toCny = (ccy: string, v: number) => { const usdcnh = ticks.USDCNH?.price; if (!usdcnh) return null; if (ccy === "CNY" || ccy === "CNH") return v; if (ccy === "USD") return v * usdcnh; if (ccy === "HKD" && ticks.USDHKD?.price) return (v / ticks.USDHKD.price) * usdcnh; if (ccy === "EUR" && ticks.EURUSD?.price) return v * ticks.EURUSD.price * usdcnh; if (ccy === "JPY" && ticks.USDJPY?.price) return (v / ticks.USDJPY.price) * usdcnh; if (ccy === "GBP" && ticks.GBPUSD?.price) return v * ticks.GBPUSD.price * usdcnh; return null; };
  const rows = Object.entries(byCcy).map(([c, v]) => ({ c, v, cny: toCny(c, v) }));
  const tot = rows.reduce((s, r) => s + (r.cny ?? 0), 0);
  return (
    <Desk code="FX" title="外汇执行" uni={FX_UNI}>
      {() => (
        <div className="bg-[#03070c]"><SectionHead title="账户按币种的持仓敞口（折人民币）" />
          {!rows.length ? <div className="px-2 py-3 text-[11px] text-slate-500">账户暂无持仓</div> : <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>币种</th><th className={TH}>市值（原币）</th><th className={TH}>折人民币</th><th className={TH}>占比</th><th className={TH}>人民币 1% 升值影响</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.c} className={ROW}><td className={`${TDL} text-slate-100`}>{r.c}</td><td className={`${TD} text-slate-300`}>{fmtCompact(r.v)}</td><td className={`${TD} text-white`}>{fmtCompact(r.cny)}</td><td className={`${TD} text-slate-400`}>{tot && r.cny ? `${((r.cny / tot) * 100).toFixed(1)}%` : "—"}</td><td className={TD} style={{ color: "#1fbf75" }}>{r.c === "CNY" || r.c === "CNH" || r.cny == null ? "—" : fmtCompact(-r.cny * 0.01)}</td></tr>)}</tbody></table>}
        </div>
      )}
    </Desk>
  );
}

/* ================================================================== WORKFLOW 交易限额与预检 */
type Limits = { maxOrder: number; maxPos: number; maxMarket: Record<string, number>; maxDayTurnover: number };
const DEF_LIM: Limits = { maxOrder: 200000, maxPos: 300000, maxMarket: { CN: 600000, HK: 300000, US: 600000, FUT: 300000, INTL: 100000 }, maxDayTurnover: 1000000 };
export function WorkflowLive({ onClose: _ }: P) {
  const saved = useSaved<Limits>("trade-limits");
  const [lim, setLim] = useState<Limits>(DEF_LIM);
  useEffect(() => { if (saved.data) setLim({ ...DEF_LIM, ...saved.data }); }, [saved.data]);
  const pos = usePositions(), orders = useOrders(), fills = useFills();
  const persist = (l: Limits) => { setLim(l); void saveItem("trade-limits", l).then(() => toast.success("限额已保存")).catch(() => toast.error("保存失败")); };
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const turnover = (fills.data ?? []).filter((f) => f.tradeDate === today).reduce((s, f) => s + Math.abs(f.notional), 0);
  const byMkt = (pos.data?.rows ?? []).reduce<Record<string, number>>((m, p) => { m[p.market] = (m[p.market] ?? 0) + Math.abs(p.marketValue ?? 0); return m; }, {});
  const bigPos = (pos.data?.rows ?? []).filter((p) => Math.abs(p.marketValue ?? 0) > lim.maxPos);
  const bigOrd = (orders.data ?? []).filter((o) => ["NEW", "PARTIAL"].includes(o.status) && (o.limitPx ?? o.avgPx ?? 0) * o.qty > lim.maxOrder);
  const bar = (used: number, cap: number) => <div className="h-2 w-32 bg-[#0a1726]"><div className="h-2" style={{ width: `${Math.min(100, (used / Math.max(1, cap)) * 100)}%`, background: used > cap ? "#f2495c" : used > cap * 0.8 ? "#fbbf24" : "#38bdf8" }} /></div>;
  const num = (v: number, f: (n: number) => void) => <input type="number" value={v} onChange={(e) => f(Number(e.target.value) || 0)} className={`${INP} w-28`} />;
  return (
    <PanelShell code="WORKFLOW" title="交易限额与预检">
      <Kpis items={[["超限持仓", String(bigPos.length)], ["超限在途委托", String(bigOrd.length)], ["今日成交额", fmtCompact(turnover), `上限 ${fmtCompact(lim.maxDayTurnover)}`]]} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>规则</th><th className={TH}>上限</th><th className={TH}>当前占用</th><th className={THL}>使用率</th></tr></thead>
        <tbody>
          <tr className={ROW}><td className={`${TDL} text-slate-200`}>单笔委托金额</td><td className={TD}>{num(lim.maxOrder, (v) => persist({ ...lim, maxOrder: v }))}</td><td className={`${TD} text-slate-300`}>在途最大 {fmtCompact(Math.max(0, ...(orders.data ?? []).filter((o) => ["NEW", "PARTIAL"].includes(o.status)).map((o) => (o.limitPx ?? 0) * o.qty)))}</td><td className={TDL}>{bigOrd.length ? <span className="text-rose-300">{bigOrd.length} 笔超限</span> : <span className="text-slate-500">正常</span>}</td></tr>
          <tr className={ROW}><td className={`${TDL} text-slate-200`}>单一标的持仓市值</td><td className={TD}>{num(lim.maxPos, (v) => persist({ ...lim, maxPos: v }))}</td><td className={`${TD} text-slate-300`}>最大 {fmtCompact(Math.max(0, ...(pos.data?.rows ?? []).map((p) => Math.abs(p.marketValue ?? 0))))}</td><td className={TDL}>{bigPos.length ? <span className="text-rose-300">{bigPos.map((p) => p.symbol).join("、")}</span> : <span className="text-slate-500">正常</span>}</td></tr>
          <tr className={ROW}><td className={`${TDL} text-slate-200`}>当日成交额</td><td className={TD}>{num(lim.maxDayTurnover, (v) => persist({ ...lim, maxDayTurnover: v }))}</td><td className={`${TD} text-slate-300`}>{fmtCompact(turnover)}</td><td className={TDL}>{bar(turnover, lim.maxDayTurnover)}</td></tr>
          {Object.entries(lim.maxMarket).map(([m, cap]) => <tr key={m} className={ROW}><td className={`${TDL} text-slate-200`}>市场敞口 · {({ CN: "A股", HK: "港股", US: "美股", FUT: "期货/外汇", INTL: "其他市场" } as Record<string, string>)[m] ?? m}</td><td className={TD}>{num(cap, (v) => persist({ ...lim, maxMarket: { ...lim.maxMarket, [m]: v } }))}</td><td className={`${TD} text-slate-300`}>{fmtCompact(byMkt[m] ?? 0)}</td><td className={TDL}>{bar(byMkt[m] ?? 0, cap)}</td></tr>)}
        </tbody>
      </table>
      <Note>限额永久保存在你的个人账户，实时对照平台模拟账户的持仓、在途委托与当日成交计算占用；超过 80% 黄色、超限红色。</Note>
    </PanelShell>
  );
}

/* ================================================================== ETBT 单品种记录簿 */
export function EtbtLive({ onClose: _ }: P) {
  const fills = useFills();
  const pos = usePositions();
  const syms = [...new Set((fills.data ?? []).map((f) => f.symbol))];
  const [sel, setSel] = useState<string | null>(null);
  const s = sel ?? syms[0] ?? null;
  const k = useLiveKline(s, "1d", 160);
  const my = (fills.data ?? []).filter((f) => f.symbol === s).sort((a, b) => a.ts - b.ts);
  const p: Position | undefined = pos.data?.rows.find((x) => x.symbol === s);
  const buys = my.filter((f) => f.side === "B"), sells = my.filter((f) => f.side === "S");
  const avg = (a: typeof my) => { const q = a.reduce((x, f) => x + f.qty, 0); return q ? a.reduce((x, f) => x + f.qty * f.px, 0) / q : null; };
  return (
    <PanelShell code="ETBT" title="单品种记录簿" right={<select value={s ?? ""} onChange={(e) => setSel(e.target.value)} className={INP}>{syms.map((x) => <option key={x}>{x}</option>)}</select>}>
      {!s ? <Empty loading={fills.loading} text="暂无成交记录" /> : (
        <>
          <Kpis items={[["成交笔数", String(my.length)], ["买入均价 / 卖出均价", `${f2(avg(buys), 3)} / ${f2(avg(sells), 3)}`], ["当前持仓", String(p?.qty ?? 0), `持仓均价 ${f2(p?.avgCost, 3)}`], ["已实现盈亏", <span style={{ color: toneOf(p?.realized) }}>{fmtCompact(p?.realized)}</span>], ["浮动盈亏", <span style={{ color: toneOf(p?.unrealized) }}>{fmtCompact(p?.unrealized)}</span>], ["累计费用", fmtCompact(my.reduce((x, f) => x + f.fee + f.tax, 0))]]} />
          {k.candles.length ? <KlineChart candles={k.candles} period="1d" height={220} live /> : <Empty loading={k.loading} />}
          <div className="max-h-[260px] overflow-auto"><FillsTable rows={[...my].reverse()} /></div>
          <Note>该标的在平台模拟账户中的全部成交（永久入库）；持仓均价与已实现盈亏按成交逐笔计算。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== WATL 观察列表与技术状态 */
export function WatlLive({ onClose: _ }: P) {
  const saved = useSaved<{ list: string[] }>("watl-list");
  const [list, setList] = useState<string[]>(["sh000300", "^GSPC", "0700.HK", "NVDA", "GC", "BTC"]);
  const [add, setAdd] = useState("");
  useEffect(() => { if (saved.data?.list?.length) setList(saved.data.list); }, [saved.data]);
  const ticks = useTicks(list);
  const pack = useCloses(list, 260);
  const { pick } = useHub();
  const st = useMemo(() => Object.fromEntries(list.map((s) => {
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    if (c.length < 70) return [s, null];
    const ma = (n: number) => mean(c.slice(-n));
    const r = rets(c.slice(-15)); const up = r.filter((x) => x > 0).reduce((a, b) => a + b, 0), dn = -r.filter((x) => x < 0).reduce((a, b) => a + b, 0);
    const rsi = up + dn > 0 ? (up / (up + dn)) * 100 : 50;
    const hi20 = Math.max(...c.slice(-21, -1)), lo20 = Math.min(...c.slice(-21, -1));
    const atr = mean(rets(c.slice(-15)).map(Math.abs)) * 100;
    return [s, { ma20: ma(20), ma60: ma(60), rsi, hi20, lo20, atr, spark: c.slice(-60) }];
  })) as Record<string, { ma20: number; ma60: number; rsi: number; hi20: number; lo20: number; atr: number; spark: number[] } | null>, [pack.data, list.join("|")]);
  const persist = (n: string[]) => { setList(n); void saveItem("watl-list", { list: n }).catch(() => undefined); };
  return (
    <PanelShell code="WATL" title="观察列表与技术状态">
      <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="任意市场代码" className={`${INP} w-36`} /><button type="button" className={BTN} onClick={() => { const v = add.trim(); if (v && !list.includes(v)) persist([...list, v]); setAdd(""); }}>加入</button><span className="text-slate-500">列表永久保存</span></div>
      <table className="w-full text-[11px]">
        <thead className={thead}><tr><th className={THL}>代码</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={THL}>趋势</th><th className={TH}>相对强弱(14)</th><th className={THL}>突破</th><th className={TH}>平均日波幅</th><th className={TH}>今日 / 平均波幅</th><th className={TH}>近 3 个月</th><th className={TH} /></tr></thead>
        <tbody>{list.map((s) => { const t = ticks[s], x = st[s]; const px = t?.price ?? null; const trend = !x || px == null ? "—" : px > x.ma20 && x.ma20 > x.ma60 ? "多头排列" : px < x.ma20 && x.ma20 < x.ma60 ? "空头排列" : "震荡"; const brk = !x || px == null ? "—" : px > x.hi20 ? "上破 20 日高点" : px < x.lo20 ? "跌破 20 日低点" : "区间内"; const ratio = x && t?.changePct != null ? Math.abs(t.changePct) / x.atr : null; return (
          <tr key={s} className={ROW}>
            <td className={`${TDL} cursor-pointer font-mono text-cyan-200 hover:underline`} onClick={() => pick(s)}>{s}</td>
            <td className={`${TD} text-white`}>{fmtPrice(px)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
            <td className={TDL} style={{ color: trend === "多头排列" ? "#f2495c" : trend === "空头排列" ? "#1fbf75" : "#94a3b8" }}>{trend}</td>
            <td className={TD} style={{ color: x ? (x.rsi > 70 ? "#f2495c" : x.rsi < 30 ? "#1fbf75" : "#cbd5e1") : undefined }}>{x ? x.rsi.toFixed(0) : "—"}</td>
            <td className={TDL} style={{ color: brk.startsWith("上破") ? "#f2495c" : brk.startsWith("跌破") ? "#1fbf75" : "#64748b" }}>{brk}</td>
            <td className={`${TD} text-slate-300`}>{x ? `${x.atr.toFixed(2)}%` : "—"}</td>
            <td className={TD} style={{ color: (ratio ?? 0) >= 2 ? "#fbbf24" : "#cbd5e1" }}>{ratio == null ? "—" : `${ratio.toFixed(1)} 倍`}</td>
            <td className={TD}><MiniLine values={x?.spark ?? []} w={80} /></td>
            <td className={TD}><button type="button" className="text-[10px] text-slate-500 hover:text-rose-300" onClick={() => persist(list.filter((y) => y !== s))}>移除</button></td>
          </tr>); })}</tbody>
      </table>
      <Note>趋势：最新价、20 日与 60 日均线的排列；相对强弱为 14 日涨跌幅之比（&gt;70 超买、&lt;30 超卖）；突破以前 20 个交易日高低点为界。</Note>
    </PanelShell>
  );
}
