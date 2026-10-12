/**
 * 交易账簿管理（实时版）：九个子功能全部基于平台自有交易系统的真实委托 / 成交 / 持仓 / 交收记录，
 * 叠加实时行情、日线计算、期货期限结构与期权链。每个子功能分析角度互不重复。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useKline, usePolled, useTicks, UP, DOWN } from "@/uc/market/live";
import { annVol, perf, rets, std, mean, useCloses } from "@/uc/hubs/calc";
import { Bars, LiveBoard, Lines, useHub } from "@/uc/hubs/kit";
import { Empty, Kpis, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { EventsList, FillsTable, MARKET_ZH, OrderTicket, OrdersTable, STATUS_ZH, cancelOrder, placeOrder, type Fill, type Position } from "@/uc/trade/kit";
import { TH, TR, isOpen, useBook } from "./OMSLive";

const STOCK_MKTS = ["CN", "HK", "US"];
const pctOf = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : (a / b) * 100);
const btn = (on?: boolean) => `border px-1.5 py-0.5 text-[10px] ${on ? "border-cyan-500 bg-cyan-700/30 text-cyan-50" : "border-[#1d3047] text-slate-300 hover:bg-[#0d2236]"}`;
const inp = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 font-mono text-[11px] text-white";
const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示

function rsi(c: number[], n = 14) {
  if (c.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = c.length - n; i < c.length; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
const ma = (c: number[], n: number) => (c.length >= n ? mean(c.slice(-n)) : null);

/* ================================================================== 1) 交易账簿股票：股票持仓簿 + 技术状态 */
export function LedgerStock() {
  const { positions, orders, summary } = useBook();
  const pos = positions.filter((p) => STOCK_MKTS.includes(p.market));
  const syms = pos.map((p) => p.symbol);
  const pack = useCloses(syms.slice(0, 60), 300);
  const ticks = useTicks(syms);
  const { pick } = useHub();
  const mvAll = pos.reduce((n, p) => n + (p.marketValue ?? 0), 0);
  const rows = pos.map((p) => {
    const c = (pack.data?.[p.symbol] ?? []).map((x) => x[1]);
    const px = ticks[p.symbol]?.price ?? p.last;
    const m20 = ma(c, 20), m60 = ma(c, 60);
    const r = rsi(c);
    const trend = px && m20 && m60 ? (px > m20 && m20 > m60 ? "多头排列" : px < m20 && m20 < m60 ? "空头排列" : "震荡") : "—";
    const hi = c.length ? Math.max(...c.slice(-250)) : null, lo = c.length ? Math.min(...c.slice(-250)) : null;
    return { p, px, m20, m60, r, trend, vol: annVol(c, 20), m1: perf(c, 21), pos52: px && hi && lo && hi > lo ? ((px - lo) / (hi - lo)) * 100 : null, w: pctOf(p.marketValue, mvAll), upct: pctOf(p.unrealized, p.cost) };
  });
  return (
    <div>
      <Kpis items={[["股票持仓", String(pos.length), `A股 ${pos.filter((p) => p.market === "CN").length} · 港股 ${pos.filter((p) => p.market === "HK").length} · 美股 ${pos.filter((p) => p.market === "US").length}`], ["股票市值", fmtCompact(mvAll), summary?.equity ? `占权益 ${((mvAll / summary.equity) * 100).toFixed(1)}%` : undefined], ["股票浮动盈亏", <span style={{ color: toneOf(pos.reduce((n, p) => n + (p.unrealized ?? 0), 0)) }}>{fmtCompact(pos.reduce((n, p) => n + (p.unrealized ?? 0), 0))}</span>], ["股票当日盈亏", <span style={{ color: toneOf(pos.reduce((n, p) => n + (p.dayPnl ?? 0), 0)) }}>{fmtCompact(pos.reduce((n, p) => n + (p.dayPnl ?? 0), 0))}</span>]]} />
      <OrderTicket initial={syms[0] ?? "sh600519"} strategy="股票账簿" />
      <SectionHead title="股票持仓与技术状态" sub="均线、RSI、波动率、一年区间位置均由最新日线计算；点击行看 K 线" />
      <table className="w-full text-[11px]">
        <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">数量</th><th className="text-right">成本</th><th className="text-right">现价</th><th className="text-right">浮盈</th><th className="text-right">浮盈率</th><th className="text-right">簿内权重</th><th className="text-right">MA20</th><th className="text-right">MA60</th><th className="text-left pl-2">趋势</th><th className="text-right">RSI14</th><th className="text-right">20日波动</th><th className="text-right">近1月</th><th className="px-2 text-right">一年区间位置</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.p.symbol} onClick={() => pick(r.p.symbol)} className={`cursor-pointer ${TR}`}>
              <td className="px-2 py-0.5 text-slate-100">{r.p.name ?? r.p.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.p.symbol}</span></td>
              <td className="text-right font-mono">{r.p.qty}</td><td className="text-right font-mono text-slate-400">{fmtPrice(r.p.avgCost)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(ticks[r.p.symbol]?.changePct) }}>{fmtPrice(r.px)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.p.unrealized) }}>{fmtCompact(r.p.unrealized)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.upct) }}>{fmtPct(r.upct)}</td>
              <td className="text-right font-mono text-slate-300">{r.w == null ? "—" : `${r.w.toFixed(1)}%`}</td>
              <td className="text-right font-mono text-slate-400">{fmtPrice(r.m20)}</td><td className="text-right font-mono text-slate-400">{fmtPrice(r.m60)}</td>
              <td className="pl-2" style={{ color: r.trend === "多头排列" ? UP : r.trend === "空头排列" ? DOWN : "#94a3b8" }}>{r.trend}</td>
              <td className="text-right font-mono" style={{ color: r.r == null ? undefined : r.r > 70 ? UP : r.r < 30 ? DOWN : "#cbd5e1" }}>{r.r == null ? "—" : r.r.toFixed(0)}{r.r != null && r.r > 70 ? " 超买" : r.r != null && r.r < 30 ? " 超卖" : ""}</td>
              <td className="text-right font-mono text-slate-300">{r.vol == null ? "—" : `${r.vol.toFixed(1)}%`}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.m1) }}>{fmtPct(r.m1)}</td>
              <td className="px-2 text-right font-mono text-slate-300">{r.pos52 == null ? "—" : `${r.pos52.toFixed(0)}%`}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={14}><Empty text="股票账簿暂无持仓。可用上方下单票据买入 A股 / 港股 / 美股。" /></td></tr>}
        </tbody>
      </table>
      <SectionHead title="股票委托（最近 50 笔）" />
      <OrdersTable rows={orders} filter={(o) => STOCK_MKTS.includes(o.market)} max={50} />
    </div>
  );
}

/* ================================================================== 2) 交易账簿期货：期货 / 外汇行情与持仓风险 */
const FUT_BOARD = [
  { symbol: "ES", label: "标普500期货", group: "股指" }, { symbol: "NQ", label: "纳指100期货", group: "股指" }, { symbol: "YM", label: "道指期货", group: "股指" }, { symbol: "RTY", label: "罗素2000期货", group: "股指" },
  { symbol: "CL", label: "WTI 原油", group: "能源" }, { symbol: "BRENT", label: "布伦特原油", group: "能源" }, { symbol: "NG", label: "天然气", group: "能源" },
  { symbol: "GC", label: "黄金", group: "金属" }, { symbol: "SI", label: "白银", group: "金属" }, { symbol: "HG", label: "铜", group: "金属" },
  { symbol: "ZN", label: "10年美债期货", group: "利率" }, { symbol: "ZT", label: "2年美债期货", group: "利率" },
  { symbol: "ZC", label: "玉米", group: "农产品" }, { symbol: "ZS", label: "大豆", group: "农产品" }, { symbol: "ZW", label: "小麦", group: "农产品" },
  { symbol: "EURUSD", label: "欧元/美元", group: "外汇" }, { symbol: "USDJPY", label: "美元/日元", group: "外汇" }, { symbol: "USDCNH", label: "美元/离岸人民币", group: "外汇" },
];
export function LedgerFutures() {
  const { positions, orders, fills } = useBook();
  const pos = positions.filter((p) => !STOCK_MKTS.includes(p.market));
  const syms = pos.map((p) => p.symbol);
  const pack = useCloses(syms.slice(0, 60), 120);
  const rows = pos.map((p) => {
    const c = (pack.data?.[p.symbol] ?? []).map((x) => x[1]);
    const v = annVol(c, 20);
    const n = Math.abs(p.marketValue ?? 0);
    return { p, v, n, var95: v != null ? n * (v / 100 / Math.sqrt(252)) * 1.645 : null };
  });
  const totN = rows.reduce((s, r) => s + r.n, 0), totVar = rows.reduce((s, r) => s + (r.var95 ?? 0), 0);
  return (
    <div>
      <Kpis items={[["期货 / 外汇持仓", String(pos.length)], ["名义敞口", fmtCompact(totN)], ["单日 95% 风险价值（未分散）", fmtCompact(totVar), "各持仓 20 日波动率 × 1.645 合计"], ["期货成交笔数", String(fills.filter((f) => !STOCK_MKTS.includes(f.market)).length)]]} />
      <OrderTicket initial={syms[0] ?? "GC"} strategy="期货账簿" />
      <SectionHead title="持仓风险" />
      <table className="w-full text-[11px]">
        <thead className={TH}><tr><th className="px-2 py-1 text-left">品种</th><th className="text-right">数量</th><th className="text-right">成本</th><th className="text-right">现价</th><th className="text-right">涨跌幅</th><th className="text-right">名义敞口</th><th className="text-right">浮动盈亏</th><th className="text-right">当日盈亏</th><th className="text-right">20日波动率</th><th className="px-2 text-right">单日95%风险价值</th></tr></thead>
        <tbody>
          {rows.map(({ p, v, n, var95 }) => <tr key={p.symbol} className={TR}><td className="px-2 py-0.5 text-slate-100">{p.name ?? p.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{p.symbol}</span></td><td className="text-right font-mono">{p.qty}</td><td className="text-right font-mono text-slate-400">{fmtPrice(p.avgCost)}</td><td className="text-right font-mono text-white">{fmtPrice(p.last)}</td><td className="text-right font-mono" style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td><td className="text-right font-mono">{fmtCompact(n)}</td><td className="text-right font-mono" style={{ color: toneOf(p.unrealized) }}>{fmtCompact(p.unrealized)}</td><td className="text-right font-mono" style={{ color: toneOf(p.dayPnl) }}>{fmtCompact(p.dayPnl)}</td><td className="text-right font-mono text-slate-300">{v == null ? "—" : `${v.toFixed(1)}%`}</td><td className="px-2 text-right font-mono text-amber-200">{fmtCompact(var95)}</td></tr>)}
          {!rows.length && <tr><td colSpan={10}><Empty text="暂无期货 / 外汇持仓。" /></td></tr>}
        </tbody>
      </table>
      <SectionHead title="主力合约与主要汇率实时行情" sub="点击行看 K 线" />
      <LiveBoard rows={FUT_BOARD} />
      <SectionHead title="期货 / 外汇委托" />
      <OrdersTable rows={orders} filter={(o) => !STOCK_MKTS.includes(o.market)} max={50} />
    </div>
  );
}

/* ================================================================== 3) 交易账簿期权：持仓期权对冲测算 */
type ORow = { strike: number; bid: number; ask: number; last: number; iv: number; delta: number; oi: number; volume: number };
type Chain = { symbol: string; spot: number; iv30: number; expiries: string[]; expiry: string; chain: Array<{ strike: number; call: ORow | null; put: ORow | null }>; maxPain: number | null; stats: { atmIv: number | null; pcOiAll: number; skew25: number | null } } | null;
const ivp = (v: number | null | undefined) => (v == null || !v ? null : v < 3 ? v * 100 : v);
export function LedgerOptions() {
  const { positions } = useBook();
  const held = positions.filter((p) => p.market === "US");
  const [sym, setSym] = useState<string>(held[0]?.symbol ?? "SPY");
  const [input, setInput] = useState("");
  const [exp, setExp] = useState<string | undefined>(undefined);
  const q = usePolled<Chain>("ucHubs.options", { symbol: sym, ...(exp ? { expiry: exp } : {}) }, 300_000);
  const d = q.data;
  const t = useTicks([sym])[sym];
  const spot = t?.price ?? d?.spot ?? 0;
  const qty = held.find((p) => p.symbol === sym)?.qty ?? 0;
  const lots = qty >= 100 ? Math.floor(qty / 100) : 1;
  const days = d?.expiry ? Math.max(1, Math.round((Date.parse(`${d.expiry}T21:00:00Z`) - Date.now()) / 86400e3)) : null;
  const mid = (r: ORow) => (r.bid && r.ask ? (r.bid + r.ask) / 2 : r.last);
  const puts = (d?.chain ?? []).filter((x) => x.put && x.strike <= spot && x.strike >= spot * 0.85).map((x) => ({ k: x.strike, r: x.put! })).sort((a, b) => b.k - a.k).slice(0, 8);
  const calls = (d?.chain ?? []).filter((x) => x.call && x.strike >= spot && x.strike <= spot * 1.15).map((x) => ({ k: x.strike, r: x.call! })).sort((a, b) => a.k - b.k).slice(0, 8);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <span className="text-slate-400">标的</span>
        {[...new Set([...held.map((p) => p.symbol), "SPY", "QQQ", "AAPL", "NVDA"])].map((s) => <button key={s} type="button" onClick={() => { setSym(s); setExp(undefined); }} className={btn(sym === s)}>{s}{held.some((p) => p.symbol === s) ? " ·持仓" : ""}</button>)}
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { setSym(input.trim().toUpperCase()); setExp(undefined); } }} className="ml-2 flex gap-1"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="美股代码" className={`${inp} w-24`} /><button className={btn()}>查询</button></form>
      </div>
      {!d ? <Empty loading={q.loading} text="该标的无场内期权数据（支持美股与美股 ETF）。" /> : (
        <>
          <div className="flex flex-wrap items-center gap-1 px-2 py-1"><span className="text-[10px] text-slate-500">到期日</span>{d.expiries.slice(0, 10).map((e) => <button key={e} type="button" onClick={() => setExp(e)} className={btn(d.expiry === e)}>{e.slice(5)}</button>)}</div>
          <Kpis items={[["标的现价", fmtPrice(spot), fmtPct(t?.changePct)], ["账簿持股", qty ? String(qty) : "未持有", `测算按 ${lots} 张（每张 100 股）`], ["30日隐含波动率", ivp(d.iv30) == null ? "—" : `${ivp(d.iv30)!.toFixed(1)}%`, `平值 ${ivp(d.stats.atmIv)?.toFixed(1) ?? "—"}%`], ["到期剩余", days == null ? "—" : `${days} 天`, `最大痛点 ${fmtPrice(d.maxPain)}`]]} />
          <SectionHead title="保护性认沽：为持股买入下行保护的成本" sub="成本按买卖中间价" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-right">行权价</th><th className="text-right">价内外</th><th className="text-right">买价</th><th className="text-right">卖价</th><th className="text-right">隐含波动率</th><th className="text-right">Delta</th><th className="text-right">成本 / 现价</th><th className="text-right">年化成本</th><th className="text-right">最大亏损</th><th className="px-2 text-right">总权利金</th></tr></thead>
            <tbody>{puts.map(({ k, r }) => { const c = mid(r) / spot * 100; return <tr key={k} className={TR}><td className="px-2 py-0.5 text-right font-mono text-white">{fmtPrice(k)}</td><td className="text-right font-mono text-slate-400">{fmtPct((k / spot - 1) * 100)}</td><td className="text-right font-mono">{fmtPrice(r.bid)}</td><td className="text-right font-mono">{fmtPrice(r.ask)}</td><td className="text-right font-mono text-slate-300">{ivp(r.iv)?.toFixed(1) ?? "—"}%</td><td className="text-right font-mono text-slate-400">{r.delta.toFixed(2)}</td><td className="text-right font-mono text-amber-200">{c.toFixed(2)}%</td><td className="text-right font-mono text-slate-300">{days ? `${(c * 365 / days).toFixed(1)}%` : "—"}</td><td className="text-right font-mono" style={{ color: DOWN }}>{fmtPct((k / spot - 1) * 100 - c)}</td><td className="px-2 text-right font-mono text-slate-200">{fmtCompact(mid(r) * 100 * lots)}</td></tr>; })}{!puts.length && <tr><td colSpan={10}><Empty text="该到期日无合适行权价。" /></td></tr>}</tbody>
          </table>
          <SectionHead title="备兑认购：卖出认购增厚收益" sub="权利金按买价（可立即成交）" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-right">行权价</th><th className="text-right">价内外</th><th className="text-right">买价</th><th className="text-right">卖价</th><th className="text-right">隐含波动率</th><th className="text-right">Delta（被行权概率参考）</th><th className="text-right">权利金收益率</th><th className="text-right">年化</th><th className="text-right">封顶收益</th><th className="px-2 text-right">总权利金</th></tr></thead>
            <tbody>{calls.map(({ k, r }) => { const y = r.bid / spot * 100; return <tr key={k} className={TR}><td className="px-2 py-0.5 text-right font-mono text-white">{fmtPrice(k)}</td><td className="text-right font-mono text-slate-400">{fmtPct((k / spot - 1) * 100)}</td><td className="text-right font-mono">{fmtPrice(r.bid)}</td><td className="text-right font-mono">{fmtPrice(r.ask)}</td><td className="text-right font-mono text-slate-300">{ivp(r.iv)?.toFixed(1) ?? "—"}%</td><td className="text-right font-mono text-slate-400">{r.delta.toFixed(2)}</td><td className="text-right font-mono" style={{ color: UP }}>{y.toFixed(2)}%</td><td className="text-right font-mono text-slate-300">{days ? `${(y * 365 / days).toFixed(1)}%` : "—"}</td><td className="text-right font-mono" style={{ color: UP }}>{fmtPct((k / spot - 1) * 100 + y)}</td><td className="px-2 text-right font-mono text-slate-200">{fmtCompact(r.bid * 100 * lots)}</td></tr>; })}{!calls.length && <tr><td colSpan={10}><Empty text="该到期日无合适行权价。" /></td></tr>}</tbody>
          </table>
          <Note>平台模拟账户不撮合期权；本页以真实期权报价对账簿持股做对冲测算。</Note>
        </>
      )}
    </div>
  );
}

/* ================================================================== 4) TBGS 汇总视图 */
function realizedByDay(fills: Fill[]) {
  const asc = [...fills].sort((a, b) => a.ts - b.ts);
  const book = new Map<string, { q: number; c: number }>();
  const day = new Map<string, { r: number; turn: number; fee: number }>();
  for (const f of asc) {
    const k = `${f.account}|${f.symbol}`;
    const b = book.get(k) ?? { q: 0, c: 0 };
    const g = day.get(f.tradeDate) ?? { r: 0, turn: 0, fee: 0 };
    if (f.side === "B") { b.q += f.qty; b.c += f.qty * f.px; }
    else { const avg = b.q ? b.c / b.q : 0; g.r += (f.px - avg) * f.qty; b.c -= avg * f.qty; b.q -= f.qty; }
    g.turn += f.notional; g.fee += f.fee + f.tax;
    book.set(k, b); day.set(f.tradeDate, g);
  }
  return [...day.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
export function LedgerSummary() {
  const { positions, fills, summary: s } = useBook();
  const byMkt = Object.entries(positions.reduce<Record<string, Position[]>>((m, p) => { (m[p.market] ??= []).push(p); return m; }, {}));
  const mv = s?.marketValue ?? 0;
  const days = useMemo(() => realizedByDay(fills), [fills]);
  let cum = 0;
  const cumR = days.map(([, g]) => (cum += g.r - g.fee));
  const contrib = [...positions].map((p) => ({ k: p.name ?? p.symbol, v: (p.unrealized ?? 0) + p.realized })).sort((a, b) => b.v - a.v);
  return (
    <div>
      <Kpis items={[
        ["账户权益", fmtCompact(s?.equity), s ? `初始 ${fmtCompact(s.initial)}` : undefined], ["累计收益率", <span style={{ color: toneOf(s?.returnPct) }}>{fmtPct(s?.returnPct)}</span>], ["当日盈亏", <span style={{ color: toneOf(s?.dayPnl) }}>{fmtCompact(s?.dayPnl)}</span>], ["可用现金", fmtCompact(s?.cash), s?.equity ? `${((s.cash / s.equity) * 100).toFixed(1)}%` : undefined],
        ["持仓市值", fmtCompact(mv), `${positions.length} 个标的`], ["浮动盈亏", <span style={{ color: toneOf(s?.unrealized) }}>{fmtCompact(s?.unrealized)}</span>], ["已实现盈亏", <span style={{ color: toneOf(s?.realized) }}>{fmtCompact(s?.realized)}</span>], ["累计费用 / 成交额", `${fmtCompact(s?.feesPaid)} / ${fmtCompact(s?.turnover)}`],
      ]} />
      <SectionHead title="按市场汇总" />
      <table className="w-full text-[11px]">
        <thead className={TH}><tr><th className="px-2 py-1 text-left">市场</th><th className="text-left">币种</th><th className="text-right">标的数</th><th className="text-right">市值</th><th className="text-right">占持仓</th><th className="text-right">浮动盈亏</th><th className="text-right">当日盈亏</th><th className="text-right">已实现</th><th className="px-2 text-right">累计费用</th></tr></thead>
        <tbody>{byMkt.map(([m, ps]) => { const v = ps.reduce((n, p) => n + (p.marketValue ?? 0), 0); const u = ps.reduce((n, p) => n + (p.unrealized ?? 0), 0); const dp = ps.reduce((n, p) => n + (p.dayPnl ?? 0), 0); return <tr key={m} className={TR}><td className="px-2 py-0.5 text-slate-100">{MARKET_ZH[m] ?? m}</td><td className="text-slate-400">{ps[0].ccy}</td><td className="text-right font-mono">{ps.length}</td><td className="text-right font-mono">{fmtCompact(v)}</td><td className="text-right font-mono text-slate-300">{mv ? `${((v / mv) * 100).toFixed(1)}%` : "—"}</td><td className="text-right font-mono" style={{ color: toneOf(u) }}>{fmtCompact(u)}</td><td className="text-right font-mono" style={{ color: toneOf(dp) }}>{fmtCompact(dp)}</td><td className="text-right font-mono" style={{ color: toneOf(ps.reduce((n, p) => n + p.realized, 0)) }}>{fmtCompact(ps.reduce((n, p) => n + p.realized, 0))}</td><td className="px-2 text-right font-mono text-slate-400">{fmtCompact(ps.reduce((n, p) => n + p.fees, 0))}</td></tr>; })}{!byMkt.length && <tr><td colSpan={9}><Empty text="暂无持仓。" /></td></tr>}</tbody>
      </table>
      <SectionHead title="盈亏贡献（浮动 + 已实现）" />
      {contrib.length ? <Bars data={contrib.slice(0, 20)} height={120} /> : <Empty text="暂无持仓。" />}
      <SectionHead title="累计已实现盈亏（扣费后）与逐日成交额" sub="由成交记录按移动平均成本法逐笔重算" />
      {days.length ? <><Lines zero series={[{ name: "累计已实现（扣费）", color: "#fbbf24", values: cumR }]} xLabels={days.map(([d]) => d.slice(5))} fmt={(v) => fmtCompact(v)} height={150} /><Bars data={days.slice(-40).map(([d, g]) => ({ k: d.slice(5), v: g.turn }))} height={90} /></> : <Empty text="暂无成交。" />}
      <Note>口径：多币种按原币直接合计（账户未做汇率折算）。</Note>
    </div>
  );
}

/* ================================================================== 5) BTFI 期货持仓信息：持仓合约期限结构 */
const ROOTS: Record<string, string> = { CL: "WTI 原油", BZ: "布伦特原油", NG: "天然气", RB: "汽油", HO: "取暖油", GC: "黄金", SI: "白银", HG: "铜", PL: "铂", PA: "钯", ZC: "玉米", ZS: "大豆", ZW: "小麦", KC: "咖啡", SB: "糖", CC: "可可", CT: "棉花", LE: "活牛", HE: "瘦肉猪", ZT: "2年美债", ZF: "5年美债", ZN: "10年美债", ZB: "30年美债", UB: "超长美债", ZQ: "联邦基金", SR3: "3月期 SOFR", ES: "标普500", NQ: "纳指100", YM: "道指", RTY: "罗素2000" };
const rootOf = (s: string) => { const r = s.toUpperCase().replace(/=F$/, ""); return r === "BRENT" ? "BZ" : ROOTS[r] ? r : null; };
type Curve = { root: string; name: string; unit: string; points: Array<{ code: string; month: string; price: number; changePct: number | null; volume: number | null }>; structure: string; slopePct: number | null };
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
function CurveBlock({ root, pos }: { root: string; pos: Position | undefined }) {
  const q = usePolled<Curve>("ucHubs.futures", { root }, 120_000);
  const c = q.data;
  const pts = c?.points ?? [];
  const roll = pts.length > 1 ? ((pts[0].price / pts[1].price - 1) * 12) / Math.max(1, monthsBetween(pts[0].month, pts[1].month)) * 100 : null;
  return (
    <div className="border-b border-[#1a2a3c]">
      <SectionHead title={`${c?.name ?? ROOTS[root]}（${root}）${pos ? ` · 持仓 ${pos.qty} @ ${fmtPrice(pos.avgCost)}` : ""}`} sub={c ? `${c.structure} · 远近月价差 ${fmtPct(c.slopePct)} · 单位 ${c.unit}` : undefined} right={roll != null ? <span className="text-[10px]" style={{ color: toneOf(pos ? roll * Math.sign(pos.qty) : roll) }}>近月展期年化收益 {fmtPct(roll)}</span> : null} />
      {!pts.length ? <Empty loading={q.loading} text="暂无期限结构数据。" /> : (
        <div className="grid gap-px md:grid-cols-[1fr_300px]">
          <Lines series={[{ name: "各合约月价格", color: "#38bdf8", values: pts.map((p) => p.price) }, ...(pos ? [{ name: "持仓成本", color: "#fbbf24", values: pts.map(() => pos.avgCost), dash: true }] : [])]} xLabels={pts.map((p) => p.month.slice(2))} fmt={(v) => fmtPrice(v)} height={150} />
          <div className="max-h-[170px] overflow-y-auto"><table className="w-full text-[10px]"><tbody>{pts.map((p, i) => <tr key={p.code} className="border-t border-[#0f1b29]"><td className="px-2 font-mono text-slate-400">{p.month}</td><td className="text-right font-mono text-white">{fmtPrice(p.price)}</td><td className="text-right font-mono" style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td><td className="text-right font-mono text-slate-500">{i ? fmtPct((p.price / pts[0].price - 1) * 100) : "近月"}</td><td className="pr-2 text-right font-mono text-slate-500">{fmtCompact(p.volume)}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}
export function LedgerFutPositions() {
  const { positions } = useBook();
  const held = positions.map((p) => ({ p, r: rootOf(p.symbol) })).filter((x): x is { p: Position; r: string } => !!x.r);
  const [extra, setExtra] = useState("CL");
  const roots = [...new Set([...held.map((x) => x.r), extra])];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1"><span className="text-[10px] text-slate-500">对照品种</span>{Object.keys(ROOTS).map((r) => <button key={r} type="button" onClick={() => setExtra(r)} className={btn(extra === r)}>{ROOTS[r]}</button>)}</div>
      {!held.length && <Note>账簿暂无期货持仓（可在“交易账簿期货”下单）；下方显示所选对照品种的期限结构。</Note>}
      {roots.map((r) => <CurveBlock key={r} root={r} pos={held.find((x) => x.r === r)?.p} />)}
      <Note>展期年化收益 = (近月 / 次近月 − 1) 按月份间隔年化；贴水结构下多头展期为正收益。持仓按主力连续价格计价。</Note>
    </div>
  );
}

/* ================================================================== 6) TBMI 账簿市场影响分析 */
function ImpactRow({ symbol, name, qty, side }: { symbol: string; name: string; qty: number; side?: string }) {
  const k = useKline(symbol, "1d", 40);
  const t = useTicks([symbol])[symbol];
  const c = k.candles.slice(-21);
  const vols = c.slice(0, -1).map((x) => x.v ?? 0).filter((v) => v > 0);
  const adv = vols.length ? mean(vols) : null;
  const sd = c.length > 5 ? std(rets(c.map((x) => x.c))) : null;
  const part = adv ? (Math.abs(qty) / adv) * 100 : null;
  const imp = sd != null && adv ? sd * Math.sqrt(Math.abs(qty) / adv) * 1e4 : null;
  const px = t?.price ?? c[c.length - 1]?.c ?? null;
  return (
    <tr className={TR}>
      <td className="px-2 py-0.5 text-slate-100">{name}<span className="ml-1 font-mono text-[9px] text-slate-600">{symbol}</span>{side && <span className="ml-1 text-[9px] text-cyan-300">{side}</span>}</td>
      <td className="text-right font-mono">{qty}</td>
      <td className="text-right font-mono text-slate-200">{fmtCompact(px && qty ? Math.abs(qty) * px : null)}</td>
      <td className="text-right font-mono text-slate-300">{fmtCompact(adv)}</td>
      <td className="text-right font-mono text-slate-300">{fmtCompact(adv && px ? adv * px : null)}</td>
      <td className="text-right font-mono" style={{ color: part != null && part > 10 ? "#f87171" : part != null && part > 1 ? "#fbbf24" : "#cbd5e1" }}>{part == null ? "—" : part < 0.01 ? "<0.01%" : `${part.toFixed(2)}%`}</td>
      <td className="text-right font-mono text-slate-300">{adv ? (Math.abs(qty) / (adv * 0.1)).toFixed(2) : "—"}</td>
      <td className="text-right font-mono text-slate-300">{sd == null ? "—" : `${(sd * 100).toFixed(2)}%`}</td>
      <td className="text-right font-mono text-amber-200">{imp == null ? "—" : imp.toFixed(1)}</td>
      <td className="text-right font-mono text-amber-200">{imp != null && px ? fmtCompact((Math.abs(qty) * px * imp) / 1e4) : "—"}</td>
      <td className="px-2 text-right font-mono text-slate-400">{t?.volume && adv ? `${(t.volume / adv).toFixed(2)}×` : "—"}</td>
    </tr>
  );
}
export function LedgerImpact() {
  const { positions } = useBook();
  const [sym, setSym] = useState("sh600519");
  const [qty, setQty] = useState(10000);
  const [test, setTest] = useState<{ s: string; q: number } | null>(null);
  const tk = useTicks([sym])[sym];
  const Head = () => <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">数量</th><th className="text-right">金额</th><th className="text-right">20日日均量</th><th className="text-right">日均成交额</th><th className="text-right">占日均量</th><th className="text-right">清仓天数（10%参与率）</th><th className="text-right">日波动率</th><th className="text-right">预估冲击(基点)</th><th className="text-right">预估冲击成本</th><th className="px-2 text-right">今日量比</th></tr></thead>;
  return (
    <div>
      <SectionHead title="持仓流动性与平仓冲击" />
      <table className="w-full text-[11px]"><Head /><tbody>
        {positions.map((p) => <ImpactRow key={p.symbol} symbol={p.symbol} name={p.name ?? p.symbol} qty={p.qty} side="平仓" />)}
        {!positions.length && <tr><td colSpan={11}><Empty text="暂无持仓。可在下方做下单前冲击测算。" /></td></tr>}
      </tbody></table>
      <SectionHead title="下单前冲击测算" />
      <form onSubmit={(e) => { e.preventDefault(); if (sym.trim() && qty > 0) setTest({ s: sym.trim(), q: qty }); }} className="flex flex-wrap items-center gap-1 px-2 py-1 text-[11px]">
        <span className="text-slate-400">标的</span><input value={sym} onChange={(e) => setSym(e.target.value)} className={`${inp} w-28`} /><span className="text-slate-300">{tk?.name ?? ""} {fmtPrice(tk?.price)}</span>
        <span className="ml-2 text-slate-400">拟交易数量</span><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className={`${inp} w-28`} />
        <button className="border border-cyan-500 bg-cyan-700/30 px-2 py-0.5 text-[10px] text-cyan-50">测算</button>
      </form>
      {test && <table className="w-full text-[11px]"><Head /><tbody><ImpactRow key={`${test.s}-${test.q}`} symbol={test.s} name={tk?.name ?? test.s} qty={test.q} side="拟交易" /></tbody></table>}
      <Note>成交量单位：A股为股，其他市场按行情源原始单位；外汇与部分期货无成交量时不计算。</Note>
    </div>
  );
}

/* ================================================================== 7) AIM 资产指令：目标权重与调仓指令 */
const lotOf = (s: string) => (/^(sh|sz|bj)/i.test(s) ? 100 : 1);
export function LedgerAIM() {
  const { positions, orders, summary } = useBook();
  const saved = useSaved<Record<string, number>>("ledger-aim");
  const [tgt, setTgt] = useState<Record<string, number> | null>(null);
  useEffect(() => { if (tgt === null && !saved.loading) setTgt(saved.data && typeof saved.data === "object" ? saved.data : {}); }, [saved.loading, saved.data, tgt]);
  const targets = tgt ?? {};
  const [add, setAdd] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const syms = [...new Set([...positions.map((p) => p.symbol), ...Object.keys(targets)])];
  const ticks = useTicks(syms);
  const eq = summary?.equity ?? 0;
  const commit = (n: Record<string, number>) => { setTgt(n); void saveItem("ledger-aim", n); };
  const rows = syms.map((s) => {
    const p = positions.find((x) => x.symbol === s);
    const px = ticks[s]?.price ?? p?.last ?? null;
    const cur = p?.qty ?? 0;
    const w = eq && px ? ((cur * px) / eq) * 100 : 0;
    const tw = targets[s];
    const lot = lotOf(s);
    const want = tw != null && px && eq ? (eq * tw) / 100 / px : null;
    let d = want != null ? Math.round((want - cur) / lot) * lot : 0;
    if (d < 0) d = Math.max(d, -cur);
    return { s, name: p?.name ?? ticks[s]?.name ?? s, px, cur, w, tw, d, amt: px ? d * px : 0, chg: ticks[s]?.changePct ?? null };
  });
  const sumT = Object.values(targets).reduce((a, b) => a + b, 0);
  const trades = rows.filter((r) => r.tw != null && r.d !== 0 && r.px);
  const buyAmt = trades.filter((r) => r.d > 0).reduce((n, r) => n + r.amt, 0), sellAmt = -trades.filter((r) => r.d < 0).reduce((n, r) => n + r.amt, 0);
  const submit = async () => {
    setBusy(true);
    const out: string[] = [];
    for (const r of [...trades.filter((x) => x.d < 0), ...trades.filter((x) => x.d > 0)]) {
      try {
        const res = await placeOrder({ symbol: r.s, side: r.d > 0 ? "B" : "S", type: "MKT", qty: Math.abs(r.d), tif: "DAY", strategy: "AIM", note: `调仓至目标权重 ${r.tw}%` });
        out.push(`${r.name} ${r.d > 0 ? "买入" : "卖出"} ${Math.abs(r.d)}：${res.status === "REJECTED" ? `拒绝（${res.reject}）` : `委托 #${res.id} ${STATUS_ZH[res.status] ?? res.status}`}`);
      } catch (e) { out.push(`${r.name}：提交失败 ${(e as Error).message}`); }
    }
    setLog(out); setBusy(false);
  };
  return (
    <div>
      <Kpis items={[["账户权益", fmtCompact(eq)], ["目标权重合计", `${sumT.toFixed(1)}%`, sumT > 100 ? "超过 100%，将资金不足" : `现金目标 ${(100 - sumT).toFixed(1)}%`], ["待买入金额", fmtCompact(buyAmt), `${trades.filter((r) => r.d > 0).length} 笔`], ["待卖出金额", fmtCompact(sellAmt), `${trades.filter((r) => r.d < 0).length} 笔`]]} />
      <SectionHead title="目标权重与调仓指令" sub="填写目标权重（%），按实时价格与账户权益计算调仓数量（A股取整到 100 股）；目标永久保存" />
      <table className="w-full text-[11px]">
        <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">现价</th><th className="text-right">持仓</th><th className="text-right">当前权重</th><th className="text-right">目标权重 %</th><th className="text-right">偏离</th><th className="text-right">调仓数量</th><th className="text-right">调仓金额</th><th className="px-2" /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.s} className={TR}>
              <td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td>
              <td className="text-right font-mono" style={{ color: toneOf(r.chg) }}>{fmtPrice(r.px)}</td>
              <td className="text-right font-mono">{r.cur || ""}</td>
              <td className="text-right font-mono text-slate-300">{r.w.toFixed(2)}%</td>
              <td className="text-right"><input key={`${r.s}-${r.tw}`} type="number" step="0.5" defaultValue={r.tw ?? ""} placeholder="—" onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); const n = { ...targets }; if (v == null || !Number.isFinite(v)) delete n[r.s]; else n[r.s] = Math.max(0, v); commit(n); }} className={`${inp} w-16 text-right`} /></td>
              <td className="text-right font-mono" style={{ color: toneOf(r.tw != null ? r.w - r.tw : null) }}>{r.tw != null ? `${(r.w - r.tw).toFixed(2)}` : "—"}</td>
              <td className="text-right font-mono" style={{ color: r.d > 0 ? UP : r.d < 0 ? DOWN : "#64748b" }}>{r.tw != null ? (r.d > 0 ? `+${r.d}` : r.d) : ""}</td>
              <td className="text-right font-mono text-slate-200">{r.d ? fmtCompact(r.amt) : ""}</td>
              <td className="px-2 text-right">{r.tw != null && <button type="button" onClick={() => { const n = { ...targets }; delete n[r.s]; commit(n); }} className="text-[10px] text-slate-400 hover:text-red-300">清除目标</button>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9}><Empty loading={tgt === null} text="暂无持仓与目标。在下方加入标的后设置目标权重。" /></td></tr>}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 text-[11px]">
        <form onSubmit={(e) => { e.preventDefault(); const s = add.trim(); if (s && targets[s] == null) { commit({ ...targets, [s]: 0 }); setAdd(""); } }} className="flex gap-1"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="加入标的代码" className={`${inp} w-32`} /><button className={btn()}>加入目标清单</button></form>
        <button type="button" disabled={busy || !trades.length} onClick={() => void submit()} className="ml-auto border border-amber-500 bg-amber-600/20 px-3 py-0.5 text-amber-100 disabled:opacity-30">{busy ? "提交中…" : `生成并提交 ${trades.length} 笔调仓委托（市价，先卖后买）`}</button>
      </div>
      {log.length > 0 && <div className="border-y border-[#1a2a3c] px-2 py-1 text-[10px] text-amber-200">{log.map((l) => <div key={l}>{l}</div>)}</div>}
      <SectionHead title="调仓指令执行情况（策略 AIM）" />
      <OrdersTable rows={orders} filter={(o) => o.strategy === "AIM"} max={60} />
    </div>
  );
}

/* ================================================================== 8) TOMS 交易订单管理 */
export function LedgerTOMS() {
  const { orders, events } = useBook();
  const [st, setSt] = useState("OPEN");
  const [q, setQ] = useState("");
  const open = orders.filter(isOpen);
  const f = (o: (typeof orders)[number]) => (st === "ALL" || (st === "OPEN" ? isOpen(o) : o.status === st)) && (!q.trim() || o.symbol.toLowerCase().includes(q.trim().toLowerCase()) || (o.name ?? "").includes(q.trim()));
  return (
    <div>
      <OrderTicket initial={open[0]?.symbol ?? orders[0]?.symbol ?? "sh600519"} />
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1">
        {[["OPEN", `在途 ${open.length}`], ["ALL", `全部 ${orders.length}`], ...["FILLED", "CANCELLED", "REJECTED", "EXPIRED"].map((s) => [s, `${STATUS_ZH[s]} ${orders.filter((o) => o.status === s).length}`])].map(([k, l]) => <button key={k} type="button" onClick={() => setSt(k)} className={btn(st === k)}>{l}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选代码 / 名称" className={`${inp} ml-2 w-32 font-sans`} />
        <button type="button" disabled={!open.length} onClick={() => open.forEach((o) => void cancelOrder(o.id))} className="ml-auto border border-amber-500/60 px-2 py-0.5 text-[10px] text-amber-200 disabled:opacity-30">撤销全部在途（{open.length}）</button>
      </div>
      <OrdersTable rows={orders} filter={f} />
      <SectionHead title="最新事件" />
      <EventsList rows={events} max={40} />
    </div>
  );
}

/* ================================================================== 9) TSDM 交易结算与交收 */
export function LedgerSettlement() {
  const { fills, summary } = useBook();
  const cal = useMemo(() => {
    const m = new Map<string, { date: string; ccy: string; mkt: string; buy: number; sell: number; fee: number; tax: number; n: number; pending: number; trade: Set<string> }>();
    for (const f of fills) {
      const k = `${f.settleDate}|${f.market}`;
      const g = m.get(k) ?? { date: f.settleDate, ccy: f.ccy, mkt: f.market, buy: 0, sell: 0, fee: 0, tax: 0, n: 0, pending: 0, trade: new Set<string>() };
      if (f.side === "B") g.buy += f.notional; else g.sell += f.notional;
      g.fee += f.fee; g.tax += f.tax; g.n++; if (!f.settled) g.pending++; g.trade.add(f.tradeDate);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [fills]);
  const byMkt = Object.entries(fills.reduce<Record<string, { fee: number; tax: number; turn: number; n: number }>>((m, f) => { const g = (m[f.market] ??= { fee: 0, tax: 0, turn: 0, n: 0 }); g.fee += f.fee; g.tax += f.tax; g.turn += f.notional; g.n++; return m; }, {}));
  const pend = fills.filter((f) => !f.settled);
  const nextDate = pend.map((f) => f.settleDate).sort()[0];
  return (
    <div>
      <Kpis items={[["待交收笔数", String(pend.length), nextDate ? `最近交收日 ${nextDate}` : "全部已交收"], ["待交收资金净额", <span style={{ color: toneOf(summary?.unsettledCash) }}>{fmtCompact(summary?.unsettledCash)}</span>, "正数为待收、负数为待付"], ["已交收笔数", String(fills.length - pend.length)], ["累计佣金 + 税费", fmtCompact(fills.reduce((n, f) => n + f.fee + f.tax, 0))]]} />
      <SectionHead title="交收日历" sub="A股 T+1、港股 T+2、美股 T+1；按交收日与市场汇总资金收付" />
      <table className="w-full text-[11px]">
        <thead className={TH}><tr><th className="px-2 py-1 text-left">交收日</th><th className="text-left">市场</th><th className="text-left">币种</th><th className="text-left">对应交易日</th><th className="text-right">笔数</th><th className="text-right">买入应付</th><th className="text-right">卖出应收</th><th className="text-right">佣金</th><th className="text-right">税费</th><th className="text-right">净收付</th><th className="px-2 text-left">状态</th></tr></thead>
        <tbody>{cal.map((g) => { const net = g.sell - g.buy - g.fee - g.tax; return <tr key={`${g.date}${g.mkt}`} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{g.date}</td><td className="text-slate-300">{MARKET_ZH[g.mkt] ?? g.mkt}</td><td className="text-slate-400">{g.ccy}</td><td className="font-mono text-[10px] text-slate-500">{[...g.trade].sort().join("、")}</td><td className="text-right font-mono">{g.n}</td><td className="text-right font-mono" style={{ color: DOWN }}>{g.buy ? fmtCompact(-g.buy) : ""}</td><td className="text-right font-mono" style={{ color: UP }}>{g.sell ? fmtCompact(g.sell) : ""}</td><td className="text-right font-mono text-slate-400">{g.fee.toFixed(2)}</td><td className="text-right font-mono text-slate-400">{g.tax.toFixed(2)}</td><td className="text-right font-mono" style={{ color: toneOf(net) }}>{fmtCompact(net)}</td><td className="px-2" style={{ color: g.pending ? "#fbbf24" : "#34d399" }}>{g.pending ? `待交收 ${g.pending}` : "已交收"}</td></tr>; })}{!cal.length && <tr><td colSpan={11}><Empty text="暂无成交。" /></td></tr>}</tbody>
      </table>
      <SectionHead title="交易成本（按市场）" />
      <table className="w-full text-[11px]">
        <thead className={TH}><tr><th className="px-2 py-1 text-left">市场</th><th className="text-right">成交笔数</th><th className="text-right">成交额</th><th className="text-right">佣金</th><th className="text-right">税费（印花税等）</th><th className="px-2 text-right">综合费率(基点)</th></tr></thead>
        <tbody>{byMkt.map(([m, g]) => <tr key={m} className={TR}><td className="px-2 py-0.5 text-slate-100">{MARKET_ZH[m] ?? m}</td><td className="text-right font-mono">{g.n}</td><td className="text-right font-mono">{fmtCompact(g.turn)}</td><td className="text-right font-mono text-slate-300">{g.fee.toFixed(2)}</td><td className="text-right font-mono text-slate-300">{g.tax.toFixed(2)}</td><td className="px-2 text-right font-mono text-amber-200">{g.turn ? (((g.fee + g.tax) / g.turn) * 1e4).toFixed(2) : "—"}</td></tr>)}</tbody>
      </table>
      <SectionHead title="成交与交收明细（待交收在前）" />
      <FillsTable rows={[...pend, ...fills.filter((f) => f.settled)]} max={300} />
    </div>
  );
}
