/**
 * 平台自有交易系统前端公用件：下单票据、订单表、成交表、持仓表、账户概要、事件流水。
 * 数据全部来自 ucTrade（服务端按实时行情撮合并永久存库）。
 */
import { useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTick } from "@/uc/market/live";
import { ownerId } from "@/uc/panels/kit";
import { useHub } from "@/uc/hubs/kit";

export type Order = { id: number; account: string; symbol: string; name: string | null; market: string; side: "B" | "S"; type: "MKT" | "LMT" | "STP"; tif: string; qty: number; limitPx: number | null; stopPx: number | null; status: string; filledQty: number; avgPx: number | null; strategy: string | null; note: string | null; reject: string | null; createdAt: number; updatedAt: number };
export type Fill = { id: number; orderId: number; account: string; symbol: string; market: string; side: "B" | "S"; qty: number; px: number; fee: number; tax: number; ccy: string; ts: number; tradeDate: string; settleDate: string; settled: boolean; notional: number };
export type Position = { account: string; symbol: string; name: string | null; market: string; ccy: string; qty: number; cost: number; avgCost: number; realized: number; fees: number; unsettledQty: number; last: number | null; changePct: number | null; marketValue: number | null; unrealized: number | null; dayPnl: number | null; firstTs: number };
export type TradeEvent = { id: number; orderId: number | null; ts: number; kind: string; detail: string };
export type Summary = { equity: number; cash: number; unsettledCash: number; marketValue: number; unrealized: number; realized: number; initial: number; returnPct: number; dayPnl: number; orders: number; byStatus: Record<string, number>; fills: number; todayFills: number; pendingSettlement: number; turnover: number; feesPaid: number };

export async function ucPost<T>(path: string, input: unknown): Promise<T> {
  const r = await fetch(`/api/trpc/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
  const j = await r.json();
  if (j?.error) throw new Error(j.error?.json?.message ?? "请求失败");
  return j?.result?.data?.json as T;
}
const own = () => ({ owner: ownerId() });
export function useOrders() { return usePolled<Order[]>("ucTrade.orders", own(), 3000); }
export function useFills() { return usePolled<Fill[]>("ucTrade.fills", own(), 5000); }
export function usePositions() { return usePolled<{ rows: Position[] }>("ucTrade.positions", own(), 4000); }
export function useSummary() { return usePolled<Summary>("ucTrade.summary", own(), 4000); }
export function useEvents() { return usePolled<TradeEvent[]>("ucTrade.events", own(), 4000); }
const bump = () => undefined;
export const placeOrder = async (o: { symbol: string; side: "B" | "S"; type: "MKT" | "LMT" | "STP"; qty: number; limitPx?: number | null; stopPx?: number | null; tif?: "DAY" | "GTC" | "IOC"; strategy?: string | null; note?: string | null; account?: string }) => { const r = await ucPost<{ id: number; status: string; reject: string | null }>("ucTrade.place", { ...own(), ...o }); bump(); return r; };
export const cancelOrder = async (id: number) => { const r = await ucPost<{ ok: boolean }>("ucTrade.cancel", { ...own(), id }); bump(); return r; };

export const STATUS_ZH: Record<string, string> = { NEW: "待成交", PARTIAL: "部分成交", FILLED: "已成交", CANCELLED: "已撤单", REJECTED: "已拒绝", EXPIRED: "已失效" };
export const STATUS_COLOR: Record<string, string> = { NEW: "#fbbf24", PARTIAL: "#38bdf8", FILLED: "#34d399", CANCELLED: "#94a3b8", REJECTED: "#f87171", EXPIRED: "#64748b" };
export const KIND_ZH: Record<string, string> = { NEW: "委托", FILL: "成交", CANCEL: "撤单", REJECT: "拒单", EXPIRE: "失效" };
export const MARKET_ZH: Record<string, string> = { CN: "A股", HK: "港股", US: "美股", FUT: "期货/外汇", INTL: "其他市场" };
export const fmtTs = (t: number) => new Date(t).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** 下单票据：实时报价、预估金额、风控提示 */
export function OrderTicket({ initial = "sh600519", strategy, compact }: { initial?: string; strategy?: string; compact?: boolean }) {
  const [symbol, setSymbol] = useState(initial);
  const [input, setInput] = useState(initial);
  const [side, setSide] = useState<"B" | "S">("B");
  const [type, setType] = useState<"MKT" | "LMT" | "STP">("LMT");
  const [qty, setQty] = useState(100);
  const [px, setPx] = useState<number | "">("");
  const [tif, setTif] = useState<"DAY" | "GTC" | "IOC">("DAY");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTick(symbol);
  const usePx = type === "MKT" ? t?.price ?? 0 : Number(px || t?.price || 0);
  const inp = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 font-mono text-[11px] text-white";
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await placeOrder({ symbol, side, type, qty, limitPx: type === "LMT" ? Number(px || t?.price) : null, stopPx: type === "STP" ? Number(px || t?.price) : null, tif, strategy: strategy ?? null });
      setMsg(r.status === "REJECTED" ? `已拒绝：${r.reject}` : `委托编号 ${r.id} 已提交（${STATUS_ZH[r.status] ?? r.status}）`);
    } catch (e) {
      setMsg(`提交失败：${(e as Error).message}`);
    }
    setBusy(false);
  };
  return (
    <div className={`space-y-1 p-2 text-[11px] ${compact ? "" : "border-b border-[#1a2a3c]"}`}>
      <form onSubmit={(e) => { e.preventDefault(); setSymbol(input.trim()); setPx(""); }} className="flex items-center gap-1"><span className="w-12 text-slate-400">标的</span><input value={input} onChange={(e) => setInput(e.target.value)} className={`${inp} w-32`} /><button className="border border-[#1d3047] px-1.5 text-cyan-300">确定</button><span className="ml-1 text-slate-300">{t?.name ?? ""}</span><span className="ml-auto font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)} {fmtPct(t?.changePct)}</span></form>
      <div className="flex flex-wrap items-center gap-1">
        <span className="w-12 text-slate-400">方向</span>
        {(["B", "S"] as const).map((s) => <button key={s} type="button" onClick={() => setSide(s)} className={`border px-2 ${side === s ? (s === "B" ? "border-red-500 bg-red-500/20 text-red-200" : "border-emerald-500 bg-emerald-500/20 text-emerald-200") : "border-[#1d3047] text-slate-400"}`}>{s === "B" ? "买入" : "卖出"}</button>)}
        <span className="ml-3 text-slate-400">类型</span>
        {([["LMT", "限价"], ["MKT", "市价"], ["STP", "止损"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setType(k)} className={`border px-1.5 ${type === k ? "border-cyan-500 text-cyan-100" : "border-[#1d3047] text-slate-400"}`}>{l}</button>)}
        <span className="ml-3 text-slate-400">有效期</span>
        <select value={tif} onChange={(e) => setTif(e.target.value as "DAY")} className={inp}><option value="DAY">当日</option><option value="GTC">撤单前有效</option><option value="IOC">立即成交否则撤销</option></select>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="w-12 text-slate-400">数量</span><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className={`${inp} w-24`} />
        {type !== "MKT" && <><span className="ml-2 text-slate-400">{type === "STP" ? "触发价" : "价格"}</span><input type="number" step="0.01" value={px} placeholder={t?.price ? String(t.price) : ""} onChange={(e) => setPx(e.target.value === "" ? "" : Number(e.target.value))} className={`${inp} w-24`} /></>}
        <span className="ml-2 text-slate-500">预估金额 <b className="font-mono text-slate-200">{fmtCompact(usePx * qty)}</b></span>
        <button type="button" disabled={busy || !t?.price} onClick={submit} className={`ml-auto border px-3 py-0.5 font-semibold ${side === "B" ? "border-red-500 bg-red-600/30 text-red-100" : "border-emerald-500 bg-emerald-600/30 text-emerald-100"} disabled:opacity-40`}>{busy ? "提交中…" : side === "B" ? "买入下单" : "卖出下单"}</button>
      </div>
      {msg && <div className="text-[10px] text-amber-200">{msg}</div>}
      <div className="text-[10px] text-slate-500">平台模拟账户（初始资金 100 万），按实时行情撮合成交；所有委托、成交、交收记录永久保存。</div>
    </div>
  );
}

export function OrdersTable({ rows, filter, max = 300 }: { rows: Order[]; filter?: (o: Order) => boolean; max?: number }) {
  const { pick } = useHub();
  const list = (filter ? rows.filter(filter) : rows).slice(0, max);
  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">编号</th><th className="text-left">时间</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-left">类型</th><th className="text-right">数量</th><th className="text-right">委托价</th><th className="text-right">成交量</th><th className="text-right">成交均价</th><th className="text-left pl-2">状态</th><th className="px-2" /></tr></thead>
      <tbody>
        {list.map((o) => (
          <tr key={o.id} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
            <td className="px-2 py-0.5 font-mono text-slate-400">{o.id}</td><td className="font-mono text-[10px] text-slate-500">{fmtTs(o.createdAt)}</td>
            <td className="cursor-pointer text-slate-100" onClick={() => pick(o.symbol)}>{o.name ?? o.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{o.symbol}</span></td>
            <td className="text-center" style={{ color: o.side === "B" ? "#f2495c" : "#1fbf75" }}>{o.side === "B" ? "买" : "卖"}</td>
            <td className="text-slate-400">{({ MKT: "市价", LMT: "限价", STP: "止损" } as Record<string, string>)[o.type]}·{o.tif}</td>
            <td className="text-right font-mono text-slate-200">{o.qty}</td><td className="text-right font-mono text-slate-300">{o.type === "MKT" ? "市价" : fmtPrice(o.limitPx ?? o.stopPx)}</td>
            <td className="text-right font-mono text-slate-200">{o.filledQty}</td><td className="text-right font-mono text-white">{fmtPrice(o.avgPx)}</td>
            <td className="pl-2" style={{ color: STATUS_COLOR[o.status] }} title={o.reject ?? ""}>{STATUS_ZH[o.status] ?? o.status}</td>
            <td className="px-2 text-right">{["NEW", "PARTIAL"].includes(o.status) && <button type="button" onClick={() => void cancelOrder(o.id)} className="text-[10px] text-amber-300 hover:underline">撤单</button>}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={11} className="px-2 py-6 text-slate-500">暂无委托。可在上方下单票据中提交第一笔委托。</td></tr>}
      </tbody>
    </table>
  );
}

export function FillsTable({ rows, max = 300 }: { rows: Fill[]; max?: number }) {
  const { pick } = useHub();
  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">成交号</th><th className="text-left">委托</th><th className="text-left">时间</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-right">数量</th><th className="text-right">价格</th><th className="text-right">金额</th><th className="text-right">佣金</th><th className="text-right">税费</th><th className="text-left pl-2">交易日</th><th className="text-left">交收日</th><th className="px-2 text-left">交收</th></tr></thead>
      <tbody>
        {rows.slice(0, max).map((f) => (
          <tr key={f.id} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
            <td className="px-2 py-0.5 font-mono text-slate-400">{f.id}</td><td className="font-mono text-slate-500">{f.orderId}</td><td className="font-mono text-[10px] text-slate-500">{fmtTs(f.ts)}</td>
            <td className="cursor-pointer text-slate-100" onClick={() => pick(f.symbol)}>{f.symbol}</td><td className="text-center" style={{ color: f.side === "B" ? "#f2495c" : "#1fbf75" }}>{f.side === "B" ? "买" : "卖"}</td>
            <td className="text-right font-mono text-slate-200">{f.qty}</td><td className="text-right font-mono text-white">{fmtPrice(f.px)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(f.notional)}</td>
            <td className="text-right font-mono text-slate-400">{f.fee.toFixed(2)}</td><td className="text-right font-mono text-slate-400">{f.tax.toFixed(2)}</td>
            <td className="pl-2 font-mono text-[10px] text-slate-400">{f.tradeDate}</td><td className="font-mono text-[10px] text-slate-400">{f.settleDate}</td>
            <td className="px-2" style={{ color: f.settled ? "#34d399" : "#fbbf24" }}>{f.settled ? "已交收" : "待交收"}</td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={13} className="px-2 py-6 text-slate-500">暂无成交记录。</td></tr>}
      </tbody>
    </table>
  );
}

export function PositionsTable({ rows }: { rows: Position[] }) {
  const { pick } = useHub();
  const open = rows.filter((r) => Math.abs(r.qty) > 1e-9);
  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">市场</th><th className="text-right">数量</th><th className="text-right">成本价</th><th className="text-right">现价</th><th className="text-right">涨跌幅</th><th className="text-right">市值</th><th className="text-right">浮动盈亏</th><th className="text-right">当日盈亏</th><th className="text-right">已实现</th><th className="px-2 text-right">待交收</th></tr></thead>
      <tbody>
        {open.map((p) => (
          <tr key={`${p.account}|${p.symbol}`} onClick={() => pick(p.symbol)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
            <td className="px-2 py-0.5 text-slate-100">{p.name ?? p.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{p.symbol}</span></td><td className="text-slate-400">{MARKET_ZH[p.market] ?? p.market}</td>
            <td className="text-right font-mono text-slate-200">{p.qty}</td><td className="text-right font-mono text-slate-300">{fmtPrice(p.avgCost)}</td><td className="text-right font-mono text-white">{fmtPrice(p.last)}</td>
            <td className="text-right font-mono" style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td><td className="text-right font-mono text-slate-200">{fmtCompact(p.marketValue)}</td>
            <td className="text-right font-mono" style={{ color: toneOf(p.unrealized) }}>{fmtCompact(p.unrealized)}</td><td className="text-right font-mono" style={{ color: toneOf(p.dayPnl) }}>{fmtCompact(p.dayPnl)}</td>
            <td className="text-right font-mono" style={{ color: toneOf(p.realized) }}>{fmtCompact(p.realized)}</td><td className="px-2 text-right font-mono text-amber-200">{p.unsettledQty || ""}</td>
          </tr>
        ))}
        {!open.length && <tr><td colSpan={11} className="px-2 py-6 text-slate-500">暂无持仓。</td></tr>}
      </tbody>
    </table>
  );
}

export function EventsList({ rows, max = 200 }: { rows: TradeEvent[]; max?: number }) {
  return (
    <table className="w-full text-[11px]">
      <tbody>
        {rows.slice(0, max).map((e) => (
          <tr key={e.id} className="border-t border-[#0f1b29]">
            <td className="w-[130px] px-2 py-0.5 font-mono text-[10px] text-slate-500">{fmtTs(e.ts)}</td>
            <td className="w-[48px]" style={{ color: e.kind === "FILL" ? "#34d399" : e.kind === "REJECT" ? "#f87171" : e.kind === "CANCEL" ? "#94a3b8" : "#fbbf24" }}>{KIND_ZH[e.kind] ?? e.kind}</td>
            <td className="w-[60px] font-mono text-slate-500">{e.orderId ?? ""}</td>
            <td className="pr-2 text-slate-200">{e.detail}</td>
          </tr>
        ))}
        {!rows.length && <tr><td className="px-2 py-6 text-slate-500">暂无事件。</td></tr>}
      </tbody>
    </table>
  );
}
