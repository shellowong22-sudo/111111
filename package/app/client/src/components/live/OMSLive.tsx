/**
 * 订单管理（OMS）实时版：委托时间线回放 / 做市报价与库存风控 / 组合↔委托联动 / 委托总览与执行质量。
 * 数据：平台自有交易系统（委托、成交、持仓、事件流水均真实存库，按实时行情撮合）+ 实时行情、盘口、分时 K 线。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useKline, usePolled, useTicks, UP, DOWN, type Candle, type Period } from "@/uc/market/live";
import { Bars, useHub } from "@/uc/hubs/kit";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { EventsList, FillsTable, KIND_ZH, MARKET_ZH, OrderTicket, OrdersTable, STATUS_COLOR, STATUS_ZH, cancelOrder, fmtTs, placeOrder, useEvents, useFills, useOrders, usePositions, useSummary, type Fill, type Order, type Position, type TradeEvent } from "@/uc/trade/kit";

/* ------------------------------------------------------------------ 公用 */
export const TYPE_ZH: Record<string, string> = { MKT: "市价", LMT: "限价", STP: "止损" };
export const sideZh = (s: "B" | "S") => (s === "B" ? "买" : "卖");
export const sideColor = (s: "B" | "S") => (s === "B" ? UP : DOWN);
export const fmtBp = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`);
export const fmtDur = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}毫秒`;
  if (ms < 60e3) return `${(ms / 1000).toFixed(1)}秒`;
  if (ms < 3600e3) return `${(ms / 60e3).toFixed(1)}分`;
  if (ms < 86400e3) return `${(ms / 3600e3).toFixed(1)}时`;
  return `${(ms / 86400e3).toFixed(1)}天`;
};
export const isOpen = (o: Order) => o.status === "NEW" || o.status === "PARTIAL";
export const TH = "sticky top-0 bg-[#0a1726] text-[10px] text-slate-500";
export const TR = "border-t border-[#0f1b29] hover:bg-[#0a1726]";

/** 按距今时长选分时粒度：越近越细 */
export const SPAN: Record<string, number> = { "1m": 60e3, "5m": 300e3, "60m": 3600e3, "1d": 86400e3 };
export const PERIOD_ZH: Record<string, string> = { "1m": "1分钟", "5m": "5分钟", "60m": "60分钟", "1d": "日线" };
export function pickPeriod(ageMs: number): [Period, number] {
  if (ageMs < 1.5 * 86400e3) return ["1m", 1500];
  if (ageMs < 7 * 86400e3) return ["5m", 2000];
  if (ageMs < 90 * 86400e3) return ["60m", 1500];
  return ["1d", 800];
}
/** 某一时刻的市场价格：取该时刻所在（或之前最近）一根 K 线；时刻落在 K 线内部取开盘价，之后取收盘价 */
export function pxAt(c: Candle[], ts: number, span: number): number | null {
  let lo = 0, hi = c.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (c[m].t <= ts) { k = m; lo = m + 1; } else hi = m - 1; }
  if (k < 0) return null;
  const x = c[k];
  return ts - x.t >= span ? x.c : x.o;
}
/** 执行收益（基点）：相对基准价，买入更低 / 卖出更高为正 */
export const edgeBp = (side: "B" | "S", px: number | null | undefined, ref: number | null | undefined) => (px == null || ref == null || !ref ? null : ((side === "B" ? ref - px : px - ref) / ref) * 1e4);

export function useBook() {
  const o = useOrders();
  const f = useFills();
  const p = usePositions();
  const s = useSummary();
  const e = useEvents();
  return { orders: o.data ?? [], fills: f.data ?? [], positions: (p.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9), allPositions: p.data?.rows ?? [], summary: s.data, events: e.data ?? [], loading: o.loading && !o.data };
}

/** 首笔成交时间（按委托） */
export function firstFillTs(fills: Fill[]) {
  const m = new Map<number, number>();
  for (const f of fills) m.set(f.orderId, Math.min(m.get(f.orderId) ?? Infinity, f.ts));
  return m;
}

function Btn({ on, children, onClick, disabled, tone }: { on?: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`border px-1.5 py-0.5 text-[10px] disabled:opacity-30 ${on ? "border-cyan-500 bg-cyan-700/30 text-cyan-50" : "border-[#1d3047] text-slate-300 hover:bg-[#0d2236]"}`} style={tone ? { color: tone } : undefined}>{children}</button>;
}

/* ================================================================== 委托时间线回放 */
type Step = { ev: TradeEvent; fill: Fill | null; status: string };
const KIND_STATUS: Record<string, string> = { NEW: "NEW", FILL: "FILLED", CANCEL: "CANCELLED", REJECT: "REJECTED", EXPIRE: "EXPIRED" };

function ReplayChart({ order, steps, cur }: { order: Order; steps: Step[]; cur: number }) {
  const from = steps[0]?.ev.ts ?? order.createdAt;
  const to = Math.max(steps[steps.length - 1]?.ev.ts ?? order.updatedAt, from);
  const [period, limit] = pickPeriod(Date.now() - from);
  const span = SPAN[period];
  const k = useKline(order.symbol, period, limit);
  const pad = Math.max((to - from) * 0.35, span * 30);
  const win = useMemo(() => k.candles.filter((c) => c.t >= from - pad && c.t <= to + pad), [k.candles, from, to, pad]);
  if (k.loading && !k.candles.length) return <Empty loading />;
  if (win.length < 2) return <Empty text={`该委托前后无${PERIOD_ZH[period]}行情（休市时段或超出分时数据范围）。`} />;
  const lvl = [order.limitPx, order.stopPx, ...steps.map((s) => s.fill?.px ?? null)].filter((v): v is number => v != null && v > 0);
  let lo = Math.min(...win.map((c) => c.l), ...lvl);
  let hi = Math.max(...win.map((c) => c.h), ...lvl);
  const pd = (hi - lo) * 0.08 || hi * 0.002 || 1;
  lo -= pd; hi += pd;
  const W = 640, H = 200, L = 46;
  const t0 = win[0].t, t1 = Math.max(win[win.length - 1].t + span, to);
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - 6);
  const y = (v: number) => 6 + ((hi - v) / (hi - lo)) * (H - 22);
  const ref = order.limitPx ?? order.stopPx;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#132233" /><text x={2} y={y(v) + 3} fontSize={9} fill="#5f7891">{fmtPrice(v)}</text></g>; })}
      <polyline points={win.map((c) => `${x(c.t + span / 2).toFixed(1)},${y(c.c).toFixed(1)}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth={1.3} />
      {ref != null && <><line x1={L} x2={W - 6} y1={y(ref)} y2={y(ref)} stroke="#fbbf24" strokeDasharray="4 3" /><text x={W - 8} y={y(ref) - 3} fontSize={9} textAnchor="end" fill="#fbbf24">{order.type === "STP" ? "触发价" : "委托价"} {fmtPrice(ref)}</text></>}
      {steps.map((s, i) => (
        <g key={s.ev.id} opacity={i <= cur ? 1 : 0.25}>
          <line x1={x(s.ev.ts)} x2={x(s.ev.ts)} y1={6} y2={H - 16} stroke={i === cur ? "#f8fafc" : STATUS_COLOR[s.status] ?? "#64748b"} strokeDasharray={i === cur ? undefined : "2 3"} />
          <text x={x(s.ev.ts) + 2} y={H - 4} fontSize={9} fill={STATUS_COLOR[s.status] ?? "#94a3b8"}>{KIND_ZH[s.ev.kind] ?? s.ev.kind}</text>
          {s.fill && <circle cx={x(s.fill.ts)} cy={y(s.fill.px)} r={4} fill={sideColor(order.side)} stroke="#fff" strokeWidth={0.8} />}
        </g>
      ))}
    </svg>
  );
}

function ReplayDetail({ order, events, fills }: { order: Order; events: TradeEvent[]; fills: Fill[] }) {
  const steps = useMemo<Step[]>(() => {
    const evs = events.filter((e) => e.orderId === order.id).sort((a, b) => a.ts - b.ts || a.id - b.id);
    const fl = fills.filter((f) => f.orderId === order.id).sort((a, b) => a.ts - b.ts);
    let fi = 0;
    return evs.map((ev) => ({ ev, fill: ev.kind === "FILL" ? fl[fi++] ?? null : null, status: KIND_STATUS[ev.kind] ?? ev.kind }));
  }, [order.id, events, fills]);
  const [cur, setCur] = useState(0);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => { setCur(0); setPlay(false); }, [order.id]);
  useEffect(() => {
    if (!play) return;
    if (cur >= steps.length - 1) { setPlay(false); return; }
    const t = setTimeout(() => setCur((c) => Math.min(steps.length - 1, c + 1)), 1400 / speed);
    return () => clearTimeout(t);
  }, [play, cur, speed, steps.length]);
  const [period, limit] = pickPeriod(Date.now() - order.createdAt);
  const k = useKline(order.symbol, period, limit);
  const tk = useTicks([order.symbol])[order.symbol];
  const s = steps[Math.min(cur, steps.length - 1)];
  const filledSoFar = steps.slice(0, cur + 1).reduce((n, x) => n + (x.fill?.qty ?? 0), 0);
  const arrival = pxAt(k.candles, order.createdAt, SPAN[period]);
  const fill = steps.find((x) => x.fill)?.fill ?? null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px]">
        <span className="font-mono text-slate-400">#{order.id}</span>
        <span className="text-white">{order.name ?? order.symbol}<span className="ml-1 font-mono text-[10px] text-slate-500">{order.symbol}</span></span>
        <span style={{ color: sideColor(order.side) }}>{order.side === "B" ? "买入" : "卖出"} {order.qty}</span>
        <span className="text-slate-400">{TYPE_ZH[order.type]} · {order.tif}{order.limitPx != null ? ` · ${fmtPrice(order.limitPx)}` : ""}{order.stopPx != null ? ` · 触发 ${fmtPrice(order.stopPx)}` : ""}</span>
        <span style={{ color: STATUS_COLOR[order.status] }}>当前：{STATUS_ZH[order.status] ?? order.status}</span>
        {order.strategy && <span className="text-slate-500">策略 {order.strategy}</span>}
        <span className="ml-auto font-mono text-slate-400">现价 <b style={{ color: toneOf(tk?.changePct) }}>{fmtPrice(tk?.price)}</b></span>
      </div>
      {!steps.length ? <Empty text="该委托暂无事件流水（事件流水只保留最近 500 条）。" /> : (
        <>
          <div className="flex flex-wrap items-center gap-1 px-2 py-1">
            <Btn onClick={() => { setCur(0); setPlay(false); }}>⏮ 起点</Btn>
            <Btn disabled={cur <= 0} onClick={() => setCur((c) => Math.max(0, c - 1))}>◀ 上一步</Btn>
            <Btn on={play} onClick={() => { if (cur >= steps.length - 1) setCur(0); setPlay((p) => !p); }}>{play ? "⏸ 暂停" : "▶ 播放"}</Btn>
            <Btn disabled={cur >= steps.length - 1} onClick={() => setCur((c) => Math.min(steps.length - 1, c + 1))}>下一步 ▶</Btn>
            <Btn onClick={() => { setCur(steps.length - 1); setPlay(false); }}>终点 ⏭</Btn>
            <span className="ml-2 text-[10px] text-slate-500">速度</span>
            {[1, 2, 4].map((v) => <Btn key={v} on={speed === v} onClick={() => setSpeed(v)}>{v}×</Btn>)}
            <span className="ml-auto font-mono text-[10px] text-slate-400">第 {cur + 1} / {steps.length} 步 · 距下单 {fmtDur(s.ev.ts - order.createdAt)}</span>
          </div>
          <div className="mx-2 mb-1 h-1 bg-[#0f1b29]"><div className="h-1 bg-cyan-500" style={{ width: `${((cur + 1) / steps.length) * 100}%` }} /></div>
          <Kpis items={[
            ["回放状态", <span style={{ color: STATUS_COLOR[s.status] }}>{STATUS_ZH[s.status] ?? s.status}</span>, fmtTs(s.ev.ts)],
            ["累计成交", `${filledSoFar} / ${order.qty}`, `${((filledSoFar / order.qty) * 100).toFixed(0)}%`],
            ["下单时市价", fmtPrice(arrival), `${PERIOD_ZH[period]}K 线口径`],
            ["成交价 / 相对下单时", fill ? fmtPrice(fill.px) : "—", fill && arrival ? `${fmtBp(edgeBp(order.side, fill.px, arrival))} 基点` : undefined],
          ]} />
          <SectionHead title="委托生命周期与当时走势" sub={`蓝线为${PERIOD_ZH[period]}收盘价；竖线为事件时刻（白色为当前步）；圆点为成交价`} />
          <ReplayChart order={order} steps={steps} cur={cur} />
          <SectionHead title="事件流水" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">步</th><th className="text-left">时间</th><th className="text-left">事件</th><th className="text-right">当时市价</th><th className="text-right">耗时</th><th className="pl-2 text-left">明细</th></tr></thead>
            <tbody>
              {steps.map((x, i) => (
                <tr key={x.ev.id} onClick={() => { setCur(i); setPlay(false); }} className={`cursor-pointer border-t border-[#0f1b29] ${i === cur ? "bg-[#0d2236]" : i > cur ? "opacity-40" : "hover:bg-[#0a1726]"}`}>
                  <td className="px-2 py-0.5 font-mono text-slate-500">{i + 1}</td>
                  <td className="font-mono text-[10px] text-slate-400">{fmtTs(x.ev.ts)}</td>
                  <td style={{ color: STATUS_COLOR[x.status] }}>{KIND_ZH[x.ev.kind] ?? x.ev.kind}</td>
                  <td className="text-right font-mono text-slate-300">{fmtPrice(pxAt(k.candles, x.ev.ts, SPAN[period]))}</td>
                  <td className="text-right font-mono text-slate-500">{i ? `+${fmtDur(x.ev.ts - steps[i - 1].ev.ts)}` : "—"}</td>
                  <td className="pl-2 pr-2 text-slate-200">{x.ev.detail}{x.fill ? ` · 交易日 ${x.fill.tradeDate}，交收日 ${x.fill.settleDate}${x.fill.settled ? "（已交收）" : "（待交收）"}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {order.reject && <div className="px-2 py-1 text-[11px] text-red-300">拒单 / 撤销原因：{order.reject}</div>}
        </>
      )}
    </div>
  );
}

export function OmsReplay({ orderId, symbol, onClose }: { orderId?: string; symbol?: string; onClose?: () => void }) {
  const { orders, fills, events, loading } = useBook();
  const [q, setQ] = useState(symbol ?? "");
  const [st, setSt] = useState("ALL");
  const [sel, setSel] = useState<number | null>(orderId ? Number(orderId) || null : null);
  const list = useMemo(() => orders.filter((o) => (st === "ALL" || o.status === st) && (!q.trim() || o.symbol.toLowerCase().includes(q.trim().toLowerCase()) || (o.name ?? "").includes(q.trim()))), [orders, q, st]);
  useEffect(() => { if (sel == null && list.length) setSel(list[0].id); }, [list, sel]);
  const order = orders.find((o) => o.id === sel) ?? null;
  return (
    <PanelShell code="REPLAY" title="委托时间线回放" onClose={onClose} right={<span>委托 {orders.length} 笔</span>}>
      <div className="flex min-h-full">
        <div className="w-[250px] shrink-0 border-r border-[#1a2a3c]">
          <div className="space-y-1 border-b border-[#1a2a3c] p-1.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="按代码 / 名称筛选" className="w-full border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" />
            <div className="flex flex-wrap gap-1">{["ALL", "FILLED", "NEW", "CANCELLED", "REJECTED", "EXPIRED"].map((k) => <Btn key={k} on={st === k} onClick={() => setSt(k)}>{k === "ALL" ? "全部" : STATUS_ZH[k]}</Btn>)}</div>
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {list.map((o) => (
              <button key={o.id} type="button" onClick={() => setSel(o.id)} className={`block w-full border-b border-[#0f1b29] px-2 py-1 text-left text-[11px] ${sel === o.id ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                <div className="flex justify-between"><span className="text-slate-100">{o.name ?? o.symbol}</span><span style={{ color: STATUS_COLOR[o.status] }}>{STATUS_ZH[o.status]}</span></div>
                <div className="flex justify-between font-mono text-[10px] text-slate-500"><span>#{o.id} <span style={{ color: sideColor(o.side) }}>{sideZh(o.side)}</span> {o.qty} {TYPE_ZH[o.type]}</span><span>{fmtTs(o.createdAt)}</span></div>
              </button>
            ))}
            {!list.length && <Empty loading={loading} text="暂无委托。可在委托管理中下单后回放其完整生命周期。" />}
          </div>
        </div>
        <div className="min-w-0 flex-1">{order ? <ReplayDetail order={order} events={events} fills={fills} /> : <Empty loading={loading} text="请选择左侧一笔委托" />}</div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== CKAP 做市报价与库存风控 */
type Depth = { symbol: string; at: number; levels: number; last: number; bids: Array<{ px: number; qty: number }>; asks: Array<{ px: number; qty: number }> };
const MM_LIST: Array<[string, string, string]> = [
  ["sh510300", "沪深300ETF", "A股"], ["sh510500", "中证500ETF", "A股"], ["sh510050", "上证50ETF", "A股"], ["sz159915", "创业板ETF", "A股"], ["sh588000", "科创50ETF", "A股"], ["sh518880", "黄金ETF", "A股"], ["sh511010", "国债ETF", "A股"],
  ["2800.HK", "盈富基金", "港股"], ["3033.HK", "恒生科技ETF", "港股"],
  ["SPY", "标普500ETF", "美股"], ["QQQ", "纳指100ETF", "美股"], ["IWM", "罗素2000ETF", "美股"], ["GLD", "黄金ETF（美）", "美股"], ["TLT", "20年+美债ETF", "美股"],
];

function MMRow({ symbol, label, pos, open, size, onMsg }: { symbol: string; label: string; pos: Position | undefined; open: Order[]; size: number; onMsg: (m: string) => void }) {
  const d = usePolled<Depth>("ucMarket.depth", { symbol }, 6000).data;
  const t = useTicks([symbol])[symbol];
  const { pick } = useHub();
  const b = d?.bids[0], a = d?.asks[0];
  const mid = b && a ? (b.px + a.px) / 2 : null;
  const spr = b && a && mid ? ((a.px - b.px) / mid) * 1e4 : null;
  const bq = (d?.bids ?? []).reduce((n, x) => n + x.qty, 0), aq = (d?.asks ?? []).reduce((n, x) => n + x.qty, 0);
  const imb = bq + aq ? ((bq - aq) / (bq + aq)) * 100 : null;
  const inv = pos?.qty ?? 0;
  const pendB = open.filter((o) => o.side === "B").reduce((n, o) => n + o.qty - o.filledQty, 0);
  const pendS = open.filter((o) => o.side === "S").reduce((n, o) => n + o.qty - o.filledQty, 0);
  const quote = async (side: "B" | "S") => {
    const px = side === "B" ? b?.px : a?.px;
    if (!px) return;
    try {
      const r = await placeOrder({ symbol, side, type: "LMT", qty: size, limitPx: px, tif: "DAY", strategy: "CKAP" });
      onMsg(r.status === "REJECTED" ? `${label} ${side === "B" ? "买一" : "卖一"}挂单被拒：${r.reject}` : `${label} 已在${side === "B" ? "买一" : "卖一"} ${fmtPrice(px)} 挂${side === "B" ? "买" : "卖"} ${size}（委托 #${r.id}）`);
    } catch (e) { onMsg(`提交失败：${(e as Error).message}`); }
  };
  return (
    <tr className={TR}>
      <td className="cursor-pointer px-2 py-0.5 text-slate-100" onClick={() => pick(symbol)}>{label}<span className="ml-1 font-mono text-[9px] text-slate-600">{symbol}</span></td>
      <td className="text-right font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price, 3)}</td>
      <td className="text-right font-mono text-red-300">{b ? fmtPrice(b.px, 3) : "—"}</td><td className="text-right font-mono text-slate-400">{b ? fmtCompact(b.qty) : ""}</td>
      <td className="text-right font-mono text-emerald-300">{a ? fmtPrice(a.px, 3) : "—"}</td><td className="text-right font-mono text-slate-400">{a ? fmtCompact(a.qty) : ""}</td>
      <td className="text-right font-mono text-slate-200">{spr == null ? "—" : spr.toFixed(1)}</td>
      <td className="text-right font-mono" style={{ color: toneOf(imb) }}>{imb == null || (d?.levels ?? 0) < 2 ? "—" : `${imb.toFixed(0)}%`}</td>
      <td className="text-right font-mono text-white">{inv || ""}</td>
      <td className="text-right font-mono text-slate-300">{pos?.marketValue ? fmtCompact(pos.marketValue) : ""}</td>
      <td className="text-right font-mono" style={{ color: toneOf(pos?.unrealized) }}>{pos?.unrealized != null ? fmtCompact(pos.unrealized) : ""}</td>
      <td className="text-right font-mono text-amber-200">{pendB || pendS ? `${pendB}/${pendS}` : ""}</td>
      <td className="whitespace-nowrap px-2 text-right">
        <button type="button" disabled={!b} onClick={() => void quote("B")} className="mr-1 border border-red-500/60 px-1 text-[10px] text-red-200 disabled:opacity-30">挂买一</button>
        <button type="button" disabled={!a || inv < size} title={inv < size ? "库存不足，不能卖出" : ""} onClick={() => void quote("S")} className="border border-emerald-500/60 px-1 text-[10px] text-emerald-200 disabled:opacity-30">挂卖一</button>
      </td>
    </tr>
  );
}

type Rule = { name: string; value: number | null; limit: number; dir: "max" | "min"; fmt: (v: number) => string; note: string };
function ruleState(r: Rule) {
  if (r.value == null) return ["—", "#64748b"] as const;
  const ok = r.dir === "max" ? r.value <= r.limit : r.value >= r.limit;
  const warn = r.dir === "max" ? r.value > r.limit * 0.8 : r.value < r.limit * 1.25;
  return ok ? (warn ? (["接近阈值", "#fbbf24"] as const) : (["通过", "#34d399"] as const)) : (["超限", "#f87171"] as const);
}

export function OmsCKAP({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState("quote");
  const [mkt, setMkt] = useState("A股");
  const [size, setSize] = useState(100);
  const [msg, setMsg] = useState<string | null>(null);
  const { orders, positions, summary, fills } = useBook();
  const posOf = (s: string) => positions.find((p) => p.symbol === s);
  const eq = summary?.equity ?? 0;
  const weights = positions.map((p) => ({ p, w: eq ? ((p.marketValue ?? 0) / eq) * 100 : 0 })).sort((a, b) => b.w - a.w);
  const openBuyNotional = orders.filter((o) => isOpen(o) && o.side === "B").reduce((n, o) => n + (o.qty - o.filledQty) * (o.limitPx ?? o.stopPx ?? 0), 0);
  const recent = orders.slice(0, 50);
  const today = new Date().toISOString().slice(0, 10);
  const todayTurn = fills.filter((f) => f.tradeDate === today).reduce((n, f) => n + f.notional, 0);
  const rules: Rule[] = [
    { name: "单一标的集中度", value: weights[0]?.w ?? 0, limit: 25, dir: "max", fmt: (v) => `${v.toFixed(1)}%`, note: weights[0] ? `最大持仓：${weights[0].p.name ?? weights[0].p.symbol}` : "无持仓" },
    { name: "前三大持仓合计", value: weights.slice(0, 3).reduce((n, x) => n + x.w, 0), limit: 60, dir: "max", fmt: (v) => `${v.toFixed(1)}%`, note: "分散度约束" },
    { name: "现金比例", value: eq ? ((summary?.cash ?? 0) / eq) * 100 : null, limit: 5, dir: "min", fmt: (v) => `${v.toFixed(1)}%`, note: "流动性缓冲" },
    { name: "在途买单占用 / 可用现金", value: summary?.cash ? (openBuyNotional / summary.cash) * 100 : null, limit: 100, dir: "max", fmt: (v) => `${v.toFixed(1)}%`, note: `在途买单 ${fmtCompact(openBuyNotional)}` },
    { name: "待交收资金 / 权益", value: eq ? (Math.abs(summary?.unsettledCash ?? 0) / eq) * 100 : null, limit: 30, dir: "max", fmt: (v) => `${v.toFixed(1)}%`, note: `${summary?.pendingSettlement ?? 0} 笔待交收` },
    { name: "近 50 笔拒单率", value: recent.length ? (recent.filter((o) => o.status === "REJECTED").length / recent.length) * 100 : null, limit: 10, dir: "max", fmt: (v) => `${v.toFixed(1)}%`, note: "下单前置校验质量" },
    { name: "当日换手 / 权益", value: eq ? (todayTurn / eq) * 100 : null, limit: 100, dir: "max", fmt: (v) => `${v.toFixed(1)}%`, note: `当日成交额 ${fmtCompact(todayTurn)}` },
    { name: "当日盈亏 / 权益", value: eq ? ((summary?.dayPnl ?? 0) / eq) * 100 : null, limit: -3, dir: "min", fmt: (v) => `${v.toFixed(2)}%`, note: "单日止损线" },
  ];
  const fails = rules.filter((r) => ruleState(r)[0] === "超限").length;
  const rej = orders.filter((o) => o.status === "REJECTED");
  const reasons = Object.entries(rej.reduce<Record<string, number>>((m, o) => { const k = (o.reject ?? "未注明").replace(/（.*?）/g, "").replace(/\d+(\.\d+)?/g, "N"); m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const mmOrders = orders.filter((o) => o.strategy === "CKAP");
  return (
    <PanelShell code="CKAP" title="做市商：ETF 双边报价、库存与合规风控" onClose={onClose} tabs={[["quote", "双边报价与库存"], ["risk", "合规风控检查"], ["reject", "拒单分析"], ["mm", "做市委托"]]} tab={tab} setTab={setTab} right={<span style={{ color: fails ? "#f87171" : "#34d399" }}>{fails ? `${fails} 项超限` : "风控全部通过"}</span>}>
      {tab === "quote" && (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
            {["A股", "港股", "美股"].map((m) => <Btn key={m} on={mkt === m} onClick={() => setMkt(m)}>{m}</Btn>)}
            <span className="ml-3 text-slate-400">每笔报价数量</span>
            <input type="number" value={size} min={1} onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))} className="w-20 border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white" />
            {msg && <span className="ml-3 text-[10px] text-amber-200">{msg}</span>}
          </div>
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">ETF</th><th className="text-right">最新</th><th className="text-right">买一</th><th className="text-right">量</th><th className="text-right">卖一</th><th className="text-right">量</th><th className="text-right">价差(基点)</th><th className="text-right">盘口失衡</th><th className="text-right">库存</th><th className="text-right">库存市值</th><th className="text-right">库存浮盈</th><th className="text-right">在途买/卖</th><th className="px-2 text-right">报价</th></tr></thead>
            <tbody>{MM_LIST.filter((x) => x[2] === mkt).map(([s, l]) => <MMRow key={s} symbol={s} label={l} pos={posOf(s)} open={orders.filter((o) => o.symbol === s && isOpen(o))} size={size} onMsg={setMsg} />)}</tbody>
          </table>
          
        </>
      )}
      {tab === "risk" && (
        <>
          <Kpis items={[["账户权益", fmtCompact(eq)], ["可用现金", fmtCompact(summary?.cash)], ["持仓市值", fmtCompact(summary?.marketValue)], ["超限 / 预警", `${fails} / ${rules.filter((r) => ruleState(r)[0] === "接近阈值").length}`]]} />
          <SectionHead title="风控规则逐项检查" sub="基于本账户实时持仓、资金、在途委托与成交记录计算；阈值为平台默认风控参数" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">规则</th><th className="text-right">当前值</th><th className="text-right">阈值</th><th className="pl-3 text-left">结果</th><th className="text-left">说明</th></tr></thead>
            <tbody>{rules.map((r) => { const [lab, col] = ruleState(r); return <tr key={r.name} className={TR}><td className="px-2 py-1 text-slate-100">{r.name}</td><td className="text-right font-mono text-white">{r.value == null ? "—" : r.fmt(r.value)}</td><td className="text-right font-mono text-slate-400">{r.dir === "max" ? "≤ " : "≥ "}{r.fmt(r.limit)}</td><td className="pl-3 font-semibold" style={{ color: col }}>{lab}</td><td className="text-slate-400">{r.note}</td></tr>; })}</tbody>
          </table>
          <SectionHead title="持仓集中度" />
          <table className="w-full text-[11px]"><tbody>{weights.map(({ p, w }) => <tr key={p.symbol} className={TR}><td className="w-[180px] px-2 py-0.5 text-slate-100">{p.name ?? p.symbol}</td><td className="w-[60px] text-right font-mono text-white">{w.toFixed(1)}%</td><td className="px-2"><div className="h-2 bg-[#0f1b29]"><div className="h-2" style={{ width: `${Math.min(100, w * 2)}%`, background: w > 25 ? "#f87171" : w > 20 ? "#fbbf24" : "#38bdf8" }} /></div></td><td className="w-[90px] pr-2 text-right font-mono text-slate-400">{fmtCompact(p.marketValue)}</td></tr>)}{!weights.length && <tr><td className="px-2 py-4 text-slate-500">暂无持仓。</td></tr>}</tbody></table>
          
        </>
      )}
      {tab === "reject" && (
        <>
          <Kpis items={[["拒单总数", String(rej.length)], ["拒单率", orders.length ? `${((rej.length / orders.length) * 100).toFixed(1)}%` : "—"], ["拒单原因类别", String(reasons.length)], ["最近拒单", rej[0] ? fmtTs(rej[0].createdAt) : "—"]]} />
          <SectionHead title="拒单原因分布" sub="数字已归并，便于看出同类原因" />
          <table className="w-full text-[11px]"><tbody>{reasons.map(([k, n]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-200">{k}</td><td className="w-[60px] text-right font-mono text-red-300">{n}</td><td className="w-[40%] px-2"><div className="h-2 bg-[#0f1b29]"><div className="h-2 bg-red-500/70" style={{ width: `${(n / (reasons[0]?.[1] || 1)) * 100}%` }} /></div></td></tr>)}{!reasons.length && <tr><td className="px-2 py-4 text-slate-500">暂无拒单。</td></tr>}</tbody></table>
          <SectionHead title="拒单明细" />
          <OrdersTable rows={rej} max={100} />
        </>
      )}
      {tab === "mm" && (
        <>
          <Kpis items={[["做市委托", String(mmOrders.length)], ["在途", String(mmOrders.filter(isOpen).length)], ["已成交", String(mmOrders.filter((o) => o.status === "FILLED").length)], ["成交率", mmOrders.length ? `${((mmOrders.filter((o) => o.status === "FILLED").length / mmOrders.length) * 100).toFixed(0)}%` : "—"]]} />
          <div className="flex items-center gap-2 px-2 py-1"><button type="button" disabled={!mmOrders.some(isOpen)} onClick={() => { mmOrders.filter(isOpen).forEach((o) => void cancelOrder(o.id)); }} className="border border-amber-500/60 px-2 py-0.5 text-[10px] text-amber-200 disabled:opacity-30">撤销全部在途做市报价</button><span className="text-[10px] text-slate-500">仅包含本面板“挂买一 / 挂卖一”提交的委托</span></div>
          <OrdersTable rows={mmOrders} />
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== AIM ↔ TOMS 联动 */
export function OmsAimToms({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState("map");
  const { orders, fills, positions, summary, loading } = useBook();
  const syms = useMemo(() => [...new Set([...positions.map((p) => p.symbol), ...orders.filter(isOpen).map((o) => o.symbol)])], [positions, orders]);
  const ticks = useTicks(syms);
  const ff = useMemo(() => firstFillTs(fills), [fills]);
  const eq = summary?.equity ?? 0;
  const rows = syms.map((s) => {
    const p = positions.find((x) => x.symbol === s);
    const os = orders.filter((o) => o.symbol === s);
    const open = os.filter(isOpen);
    const pb = open.filter((o) => o.side === "B").reduce((n, o) => n + o.qty - o.filledQty, 0);
    const ps = open.filter((o) => o.side === "S").reduce((n, o) => n + o.qty - o.filledQty, 0);
    const px = ticks[s]?.price ?? p?.last ?? null;
    const qty = p?.qty ?? 0;
    const proj = qty + pb - ps;
    const lat = os.filter((o) => ff.has(o.id)).map((o) => ff.get(o.id)! - o.createdAt);
    const filled = os.filter((o) => o.status === "FILLED").length;
    const live = os.filter((o) => o.status !== "REJECTED").length;
    return { s, name: p?.name ?? os[0]?.name ?? ticks[s]?.name ?? s, qty, pb, ps, proj, px, w: eq && px ? ((qty * px) / eq) * 100 : 0, wp: eq && px ? ((proj * px) / eq) * 100 : 0, sellable: qty - (p?.unsettledQty ?? 0) - ps, n: os.length, fr: live ? (filled / live) * 100 : null, lat: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null, orphan: !qty && open.length > 0 };
  });
  const strat = useMemo(() => {
    const m = new Map<string, { n: number; open: number; filled: number; notional: number; mtm: number; fee: number }>();
    for (const o of orders) {
      const k = o.strategy ?? "手工";
      const g = m.get(k) ?? { n: 0, open: 0, filled: 0, notional: 0, mtm: 0, fee: 0 };
      g.n++; if (isOpen(o)) g.open++; if (o.status === "FILLED") g.filled++;
      m.set(k, g);
    }
    const byId = new Map(orders.map((o) => [o.id, o]));
    for (const f of fills) {
      const k = byId.get(f.orderId)?.strategy ?? "手工";
      const g = m.get(k);
      if (!g) continue;
      g.notional += f.notional; g.fee += f.fee + f.tax;
      const px = ticks[f.symbol]?.price;
      if (px) g.mtm += (f.side === "B" ? px - f.px : f.px - px) * f.qty;
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [orders, fills, ticks]);
  const { pick } = useHub();
  return (
    <PanelShell code="AIMTOMS" title="AIM↔TOMS 联动：组合持仓与委托对应" onClose={onClose} tabs={[["map", "持仓-委托映射"], ["strat", "策略归属"], ["ticket", "组合下单"]]} tab={tab} setTab={setTab}>
      <Kpis items={[
        ["持仓标的", String(positions.length), `权益 ${fmtCompact(eq)}`],
        ["有在途委托的标的", String(rows.filter((r) => r.pb || r.ps).length), `在途委托 ${orders.filter(isOpen).length} 笔`],
        ["在途买入金额", fmtCompact(rows.reduce((n, r) => n + r.pb * (r.px ?? 0), 0)), "按现价估算"],
        ["无持仓的在途委托", String(rows.filter((r) => r.orphan).length), "建仓中"],
      ]} />
      {tab === "map" && (
        <>
          <SectionHead title="持仓 ↔ 在途委托 ↔ 预期持仓" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">现价</th><th className="text-right">持仓</th><th className="text-right">权重</th><th className="text-right">在途买</th><th className="text-right">在途卖</th><th className="text-right">预期持仓</th><th className="text-right">预期权重</th><th className="text-right">可卖</th><th className="text-right">历史委托</th><th className="text-right">成交率</th><th className="px-2 text-right">平均成交耗时</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s} onClick={() => pick(r.s)} className={`cursor-pointer ${TR}`}>
                  <td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span>{r.orphan && <span className="ml-1 border border-amber-500/50 px-1 text-[9px] text-amber-300">建仓中</span>}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(ticks[r.s]?.changePct) }}>{fmtPrice(r.px)}</td>
                  <td className="text-right font-mono text-white">{r.qty || ""}</td><td className="text-right font-mono text-slate-300">{r.w ? `${r.w.toFixed(1)}%` : ""}</td>
                  <td className="text-right font-mono text-red-300">{r.pb || ""}</td><td className="text-right font-mono text-emerald-300">{r.ps || ""}</td>
                  <td className="text-right font-mono text-white">{r.proj}</td>
                  <td className="text-right font-mono" style={{ color: r.wp > r.w ? UP : r.wp < r.w ? DOWN : "#cbd5e1" }}>{r.wp.toFixed(1)}%</td>
                  <td className="text-right font-mono text-slate-300">{Math.max(0, r.sellable)}</td>
                  <td className="text-right font-mono text-slate-400">{r.n}</td><td className="text-right font-mono text-slate-300">{r.fr == null ? "—" : `${r.fr.toFixed(0)}%`}</td>
                  <td className="px-2 text-right font-mono text-slate-400">{fmtDur(r.lat)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={12}><Empty loading={loading} text="暂无持仓与在途委托。可在“组合下单”中提交委托。" /></td></tr>}
            </tbody>
          </table>
          <SectionHead title="在途委托" />
          <OrdersTable rows={orders} filter={isOpen} />
        </>
      )}
      {tab === "strat" && (
        <>
          <SectionHead title="按策略 / 来源归集" sub="卖出：成交价−现价）" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">策略</th><th className="text-right">委托</th><th className="text-right">在途</th><th className="text-right">已成交</th><th className="text-right">成交率</th><th className="text-right">成交金额</th><th className="text-right">费用</th><th className="px-2 text-right">成交后盈亏</th></tr></thead>
            <tbody>{strat.map(([k, g]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-100">{k}</td><td className="text-right font-mono">{g.n}</td><td className="text-right font-mono text-amber-200">{g.open}</td><td className="text-right font-mono">{g.filled}</td><td className="text-right font-mono">{g.n ? `${((g.filled / g.n) * 100).toFixed(0)}%` : "—"}</td><td className="text-right font-mono text-slate-200">{fmtCompact(g.notional)}</td><td className="text-right font-mono text-slate-400">{fmtCompact(g.fee)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(g.mtm) }}>{fmtCompact(g.mtm)}</td></tr>)}{!strat.length && <tr><td colSpan={8}><Empty text="暂无委托。" /></td></tr>}</tbody>
          </table>
          {strat.length > 0 && <Bars data={strat.map(([k, g]) => ({ k, v: g.mtm }))} height={110} />}
        </>
      )}
      {tab === "ticket" && (
        <>
          <OrderTicket initial={positions[0]?.symbol ?? "sh510300"} strategy="AIM" />
          <SectionHead title="组合指令（策略 AIM）提交的委托" />
          <OrdersTable rows={orders} filter={(o) => o.strategy === "AIM"} />
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== TOMS 总览与执行质量 */
type ExecRow = { o: Order; arrival: number | null; fill: number | null; edge: number | null; impr: number | null; drift: number | null; lat: number | null; period: Period };
function ExecGroup({ symbol, orders, fills, ff, onStats }: { symbol: string; orders: Order[]; fills: Fill[]; ff: Map<number, number>; onStats: (s: string, r: ExecRow[]) => void }) {
  const oldest = Math.min(...orders.map((o) => o.createdAt));
  const [period, limit] = pickPeriod(Date.now() - oldest);
  const k = useKline(symbol, period, limit);
  const tk = useTicks([symbol])[symbol];
  const rows: ExecRow[] = useMemo(() => orders.map((o) => {
    const fl = fills.filter((f) => f.orderId === o.id);
    const q = fl.reduce((n, f) => n + f.qty, 0);
    const fill = q ? fl.reduce((n, f) => n + f.px * f.qty, 0) / q : o.avgPx;
    const arrival = pxAt(k.candles, o.createdAt, SPAN[period]);
    const ref = o.type === "LMT" ? o.limitPx : null;
    return { o, arrival, fill, edge: edgeBp(o.side, fill, arrival), impr: ref != null ? edgeBp(o.side, fill, ref) : null, drift: fill && tk?.price ? ((o.side === "B" ? tk.price - fill : fill - tk.price) / fill) * 1e4 : null, lat: ff.has(o.id) ? ff.get(o.id)! - o.createdAt : null, period };
  }), [orders, fills, k.candles, period, tk?.price, ff]);
  const sig = rows.map((r) => `${r.o.id}:${r.edge?.toFixed(2)}:${r.drift?.toFixed(1)}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStats(symbol, rows); }, [sig]);
  return (
    <>
      {rows.map((r) => (
        <tr key={r.o.id} className={TR}>
          <td className="px-2 py-0.5 font-mono text-slate-500">{r.o.id}</td>
          <td className="text-slate-100">{r.o.name ?? r.o.symbol}</td>
          <td style={{ color: sideColor(r.o.side) }}>{sideZh(r.o.side)}</td>
          <td className="text-slate-400">{TYPE_ZH[r.o.type]}</td>
          <td className="text-right font-mono text-slate-200">{r.o.filledQty}</td>
          <td className="text-right font-mono text-slate-300">{fmtPrice(r.arrival)}</td>
          <td className="text-right font-mono text-white">{fmtPrice(r.fill)}</td>
          <td className="text-right font-mono" style={{ color: toneOf(r.edge) }}>{fmtBp(r.edge)}</td>
          <td className="text-right font-mono" style={{ color: toneOf(r.impr) }}>{fmtBp(r.impr)}</td>
          <td className="text-right font-mono" style={{ color: toneOf(r.drift) }}>{fmtBp(r.drift)}</td>
          <td className="text-right font-mono text-slate-400">{fmtDur(r.lat)}</td>
          <td className="px-2 text-right text-[10px] text-slate-500">{PERIOD_ZH[r.period]}</td>
        </tr>
      ))}
    </>
  );
}

export function OmsOverview({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState("dash");
  const { orders, fills, events, summary, loading } = useBook();
  const ff = useMemo(() => firstFillTs(fills), [fills]);
  const [stats, setStats] = useState<Record<string, ExecRow[]>>({});
  const onStats = useMemo(() => (s: string, r: ExecRow[]) => setStats((m) => ({ ...m, [s]: r })), []);
  const filled = orders.filter((o) => o.status === "FILLED" || o.status === "PARTIAL");
  const bySym = useMemo(() => { const m = new Map<string, Order[]>(); for (const o of filled.slice(0, 200)) m.set(o.symbol, [...(m.get(o.symbol) ?? []), o]); return [...m.entries()].slice(0, 24); }, [filled]);
  const all = Object.values(stats).flat();
  const avg = (a: Array<number | null>) => { const v = a.filter((x): x is number => x != null && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const wavg = (k: "edge" | "drift") => { let s = 0, w = 0; for (const r of all) { const v = r[k]; const n = (r.fill ?? 0) * r.o.filledQty; if (v != null && n) { s += v * n; w += n; } } return w ? s / w : null; };
  const n = orders.length;
  const cnt = (s: string) => orders.filter((o) => o.status === s).length;
  const decided = orders.filter((o) => o.status !== "REJECTED").length;
  const lats = orders.filter((o) => ff.has(o.id)).map((o) => ff.get(o.id)! - o.createdAt);
  const med = lats.length ? [...lats].sort((a, b) => a - b)[Math.floor(lats.length / 2)] : null;
  const group = (key: (o: Order) => string, lab: (k: string) => string) => {
    const m = new Map<string, Order[]>();
    for (const o of orders) m.set(key(o), [...(m.get(key(o)) ?? []), o]);
    return [...m.entries()].map(([k, os]) => {
      const live = os.filter((o) => o.status !== "REJECTED");
      const l = os.filter((o) => ff.has(o.id)).map((o) => ff.get(o.id)! - o.createdAt);
      const turn = fills.filter((f) => os.some((o) => o.id === f.orderId)).reduce((s, f) => s + f.notional, 0);
      return { k: lab(k), n: os.length, f: os.filter((o) => o.status === "FILLED").length, rate: live.length ? (os.filter((o) => o.status === "FILLED").length / live.length) * 100 : null, rej: (os.filter((o) => o.status === "REJECTED").length / os.length) * 100, lat: l.length ? l.reduce((a, b) => a + b, 0) / l.length : null, turn };
    }).sort((a, b) => b.n - a.n);
  };
  const hours = Array.from({ length: 24 }, (_, h) => ({ k: `${h}`, v: events.filter((e) => new Date(e.ts).getHours() === h && e.kind === "NEW").length, v2: events.filter((e) => new Date(e.ts).getHours() === h && e.kind === "FILL").length }));
  const days = useMemo(() => {
    const m = new Map<string, { n: number; f: number }>();
    for (const o of orders) { const d = new Date(o.createdAt).toLocaleDateString("sv-SE"); const g = m.get(d) ?? { n: 0, f: 0 }; g.n++; if (o.status === "FILLED") g.f++; m.set(d, g); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([d, g]) => ({ k: d.slice(5), v: g.n, v2: g.f }));
  }, [orders]);
  const Grp = ({ rows }: { rows: ReturnType<typeof group> }) => (
    <table className="w-full text-[11px]">
      <thead className={TH}><tr><th className="px-2 py-1 text-left">分组</th><th className="text-right">委托</th><th className="text-right">成交</th><th className="text-right">成交率</th><th className="text-right">拒单率</th><th className="text-right">平均成交耗时</th><th className="px-2 text-right">成交金额</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.k} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.k}</td><td className="text-right font-mono">{r.n}</td><td className="text-right font-mono">{r.f}</td><td className="text-right font-mono text-emerald-300">{r.rate == null ? "—" : `${r.rate.toFixed(0)}%`}</td><td className="text-right font-mono text-red-300">{r.rej.toFixed(0)}%</td><td className="text-right font-mono text-slate-400">{fmtDur(r.lat)}</td><td className="px-2 text-right font-mono text-slate-200">{fmtCompact(r.turn)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <PanelShell code="TOMS" title="交易委托管理系统总览：状态统计与执行质量" onClose={onClose} tabs={[["dash", "委托仪表盘"], ["exec", "执行质量"], ["flow", "事件流水"]]} tab={tab} setTab={setTab} right={<span>今日成交 {summary?.todayFills ?? 0} 笔</span>}>
      <Kpis items={[
        ["委托总数", String(n), `在途 ${cnt("NEW") + cnt("PARTIAL")}`],
        ["成交率", decided ? `${((cnt("FILLED") / decided) * 100).toFixed(1)}%` : "—", "已成交 / 非拒单委托"],
        ["拒单率 / 撤单率", n ? `${((cnt("REJECTED") / n) * 100).toFixed(1)}% / ${((cnt("CANCELLED") / n) * 100).toFixed(1)}%` : "—", `失效 ${cnt("EXPIRED")}`],
        ["成交耗时中位数", fmtDur(med), `${lats.length} 笔有成交`],
        ["相对下单时价格（加权）", wavg("edge") == null ? "—" : `${fmtBp(wavg("edge"))} 基点`, "正值 = 优于下单时市价"],
        ["成交后漂移（加权）", wavg("drift") == null ? "—" : `${fmtBp(wavg("drift"))} 基点`, "按实时价重估"],
        ["累计成交金额", fmtCompact(summary?.turnover), `${summary?.fills ?? 0} 笔`],
        ["累计费用", fmtCompact(summary?.feesPaid), summary?.turnover ? `${((summary.feesPaid / summary.turnover) * 1e4).toFixed(1)} 基点` : undefined],
      ]} />
      {tab === "dash" && (
        <>
          <SectionHead title="委托状态分布" />
          <Bars data={Object.keys(STATUS_ZH).map((s) => ({ k: STATUS_ZH[s], v: cnt(s) }))} fmt={(v) => String(Math.round(v))} height={100} />
          <SectionHead title="近 30 个自然日委托与成交笔数" />
          {days.length ? <Bars data={days} fmt={(v) => String(Math.round(v))} label={["委托", "成交"]} height={110} /> : <Empty loading={loading} text="暂无委托。" />}
          <SectionHead title="按市场" /><Grp rows={group((o) => o.market, (k) => MARKET_ZH[k] ?? k)} />
          <SectionHead title="按委托类型与有效期" /><Grp rows={group((o) => `${o.type}·${o.tif}`, (k) => { const [t, f] = k.split("·"); return `${TYPE_ZH[t] ?? t} · ${({ DAY: "当日", GTC: "撤单前有效", IOC: "立即成交否则撤销" } as Record<string, string>)[f] ?? f}`; })} />
          <SectionHead title="按时段（本地时间）：委托提交 vs 成交" sub="来自最近 500 条事件流水" />
          <Bars data={hours} fmt={(v) => String(Math.round(v))} label={["委托", "成交"]} height={100} />
        </>
      )}
      <div className={tab === "exec" ? "" : "hidden"}>
          <SectionHead title="逐笔执行质量" sub="下单时价格取下单时刻所在分时 K 线（越近越细：1 天内 1 分钟、7 天内 5 分钟、90 天内 60 分钟）；单位：基点，正值为有利" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">委托</th><th className="text-left">标的</th><th className="text-left">方向</th><th className="text-left">类型</th><th className="text-right">成交量</th><th className="text-right">下单时价格</th><th className="text-right">成交均价</th><th className="text-right">相对下单时</th><th className="text-right">相对限价</th><th className="text-right">成交后漂移</th><th className="text-right">成交耗时</th><th className="px-2 text-right">粒度</th></tr></thead>
            <tbody>
              {bySym.map(([s, os]) => <ExecGroup key={s} symbol={s} orders={os} fills={fills} ff={ff} onStats={onStats} />)}
              {!bySym.length && <tr><td colSpan={12}><Empty loading={loading} text="暂无成交委托。" /></td></tr>}
            </tbody>
          </table>
          {all.length > 0 && (
            <>
              <SectionHead title="按标的平均（基点）" />
              <Bars data={Object.entries(stats).filter(([, r]) => r.length).map(([s, r]) => ({ k: r[0].o.name ?? s, v: avg(r.map((x) => x.edge)) ?? 0, v2: avg(r.map((x) => x.drift)) ?? 0 }))} fmt={(v) => `${v.toFixed(1)}`} label={["相对下单时", "成交后漂移"]} height={120} />
            </>
          )}
      </div>
      {tab === "flow" && (
        <>
          <SectionHead title="事件流水（委托 / 成交 / 撤单 / 拒单 / 失效）" right={<span className="text-[10px] text-slate-500">{events.length} 条</span>} />
          <EventsList rows={events} max={500} />
          <SectionHead title="成交记录" />
          <FillsTable rows={fills} max={200} />
        </>
      )}
    </PanelShell>
  );
}
