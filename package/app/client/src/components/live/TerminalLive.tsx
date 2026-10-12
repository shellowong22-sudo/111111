/**
 * 终端常用小窗实时版：交易委托簿（实时盘口 + 逐笔报价）、价格预警（条件永久保存，按实时行情判断触发）、自选品种（永久保存，实时行情）。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks, UP, DOWN, type Tick } from "@/uc/market/live";
import { useCloses, perf, annVol } from "@/uc/hubs/calc";
import { useHub } from "@/uc/hubs/kit";
import { MiniKline } from "@/uc/market/WeiInsights";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { OrderTicket, OrdersTable, useOrders } from "@/uc/trade/kit";

const inp = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 font-mono text-[11px] text-white";
const btn = (on?: boolean) => `border px-1.5 py-0.5 text-[10px] ${on ? "border-cyan-500 bg-cyan-700/30 text-cyan-50" : "border-[#1d3047] text-slate-300 hover:bg-[#0d2236]"}`;
const newId = () => `${Date.now().toString(36)}${(performance.now() * 1000).toString(36).replace(".", "").slice(-4)}`;

/* ================================================================== 交易委托簿 */
type Depth = { symbol: string; at: number; levels: number; last: number; bids: Array<{ px: number; qty: number }>; asks: Array<{ px: number; qty: number }> };
const BOOK_PRESETS: Array<[string, string]> = [["sh600519", "贵州茅台"], ["sh601318", "中国平安"], ["sz300750", "宁德时代"], ["sz000001", "平安银行"], ["sh510300", "沪深300ETF"], ["0700.HK", "腾讯控股"], ["9988.HK", "阿里巴巴"], ["AAPL", "苹果"], ["NVDA", "英伟达"], ["SPY", "标普500ETF"]];
type Print = { time: number; price: number; dv: number | null; side: "B" | "S" | null };

export function OrderBookLive({ title, symbol }: { title: string; symbol?: string }) {
  const init = !symbol || symbol === "SPX" ? "sh600519" : symbol;
  const [sym, setSym] = useState(init);
  const [input, setInput] = useState(init);
  const dq = usePolled<Depth>("ucMarket.depth", { symbol: sym }, 2500);
  const d = dq.data?.symbol === sym ? dq.data : null;
  const t = useTicks([sym])[sym] ?? null;
  const orders = useOrders().data ?? [];
  const [tape, setTape] = useState<Print[]>([]);
  const last = useRef<Tick | null>(null);
  useEffect(() => { setTape([]); last.current = null; }, [sym]);
  useEffect(() => {
    if (!t?.price || !t.time) return;
    const p = last.current;
    if (p && p.time === t.time && p.price === t.price && p.volume === t.volume) return;
    const dv = p && p.volume != null && t.volume != null ? t.volume - p.volume : null;
    const b = d?.bids[0]?.px, a = d?.asks[0]?.px;
    const side: Print["side"] = a && t.price >= a ? "B" : b && t.price <= b ? "S" : p ? (t.price > p.price ? "B" : t.price < p.price ? "S" : null) : null;
    if (p) setTape((x) => [{ time: t.time, price: t.price, dv, side }, ...x].slice(0, 80));
    last.current = t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.time, t?.price, t?.volume]);
  const bids = d?.bids ?? [], asks = d?.asks ?? [];
  const maxQ = Math.max(1, ...bids.map((x) => x.qty), ...asks.map((x) => x.qty));
  const b1 = bids[0], a1 = asks[0];
  const mid = b1 && a1 ? (b1.px + a1.px) / 2 : null;
  const micro = b1 && a1 && b1.qty + a1.qty ? (b1.px * a1.qty + a1.px * b1.qty) / (b1.qty + a1.qty) : null;
  const bq = bids.reduce((n, x) => n + x.qty, 0), aq = asks.reduce((n, x) => n + x.qty, 0);
  const imb = bq + aq ? ((bq - aq) / (bq + aq)) * 100 : null;
  const cum = (arr: Array<{ qty: number }>) => arr.map((_, i) => arr.slice(0, i + 1).reduce((n, x) => n + x.qty, 0));
  const ca = cum(asks), cb = cum(bids);
  const vwap = t?.amount && t?.volume ? t.amount / t.volume : null;
  const mine = orders.filter((o) => o.symbol === sym);
  const tapeUp = tape.filter((x) => x.side === "B").reduce((n, x) => n + (x.dv ?? 0), 0), tapeDn = tape.filter((x) => x.side === "S").reduce((n, x) => n + (x.dv ?? 0), 0);
  const Level = ({ px, qty, c, side }: { px: number; qty: number; c: number; side: "B" | "S" }) => (
    <tr className="border-t border-[#0b1622]">
      <td className="w-[46px] px-2 text-[10px] text-slate-500">{side === "S" ? "卖" : "买"}</td>
      <td className="text-right font-mono" style={{ color: side === "S" ? DOWN : UP }}>{fmtPrice(px, 3)}</td>
      <td className="relative w-[45%] px-2 text-right font-mono text-slate-200"><div className="absolute inset-y-0 right-0" style={{ width: `${(qty / maxQ) * 100}%`, background: side === "S" ? "rgba(31,191,117,.18)" : "rgba(242,73,92,.18)" }} /><span className="relative">{fmtCompact(qty)}</span></td>
      <td className="pr-2 text-right font-mono text-[10px] text-slate-500">{fmtCompact(c)}</td>
    </tr>
  );
  return (
    <PanelShell code="BOOK" title={title} right={d ? <span>{d.levels ? `${d.levels} 档盘口` : "无盘口"} · {new Date(d.at).toLocaleTimeString("zh-CN", { hour12: false })}</span> : null}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1">
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) setSym(input.trim()); }} className="flex gap-1"><input value={input} onChange={(e) => setInput(e.target.value)} className={`${inp} w-28`} /><button className={btn()}>切换</button></form>
        {BOOK_PRESETS.map(([s, l]) => <button key={s} type="button" onClick={() => { setSym(s); setInput(s); }} className={btn(sym === s)}>{l}</button>)}
      </div>
      <Kpis items={[
        [t?.name ?? sym, <span style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price, 3)}</span>, `${fmtPct(t?.changePct)} · 昨收 ${fmtPrice(t?.prevClose)}`],
        ["买卖价差", b1 && a1 ? fmtPrice(a1.px - b1.px, 3) : "—", mid && b1 && a1 ? `${(((a1.px - b1.px) / mid) * 1e4).toFixed(1)} 基点` : undefined],
        ["加权中间价", fmtPrice(micro, 3), mid ? `中间价 ${fmtPrice(mid, 3)}` : undefined],
        ["盘口失衡", imb == null ? "—" : <span style={{ color: toneOf(imb) }}>{imb.toFixed(1)}%</span>, `买 ${fmtCompact(bq)} / 卖 ${fmtCompact(aq)}`],
        ["当日均价", fmtPrice(vwap, 3), t?.price && vwap ? `现价偏离 ${(((t.price - vwap) / vwap) * 1e4).toFixed(1)} 基点` : "成交额 / 成交量"],
        ["成交量", fmtCompact(t?.volume), `成交额 ${fmtCompact(t?.amount)}`],
        ["日内区间", `${fmtPrice(t?.low)} – ${fmtPrice(t?.high)}`, t?.high && t?.low && t?.prevClose ? `振幅 ${(((t.high - t.low) / t.prevClose) * 100).toFixed(2)}%` : undefined],
        ["本窗口主动买 / 卖量", `${fmtCompact(tapeUp)} / ${fmtCompact(tapeDn)}`, `${tape.length} 笔报价更新`],
      ]} />
      <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
        <div className="bg-[#03070c]">
          <SectionHead title="盘口" sub="右列为累计量" />
          {!d ? <Empty loading={dq.loading} /> : !d.levels ? <Empty text="该品种无公开盘口，仅提供实时成交价。" /> : (
            <table className="w-full text-[11px]"><tbody>
              {asks.map((x, i) => ({ ...x, c: ca[i] })).reverse().map((x) => <Level key={`a${x.px}`} px={x.px} qty={x.qty} c={x.c} side="S" />)}
              <tr className="border-y border-[#1d3047] bg-[#07111c]"><td className="px-2 py-1 text-[10px] text-slate-400">最新</td><td className="text-right font-mono text-[13px] font-bold" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price ?? d.last, 3)}</td><td colSpan={2} className="px-2 text-right text-[10px] text-slate-500">{d.levels === 1 ? "最优一档报价" : "五档行情"}</td></tr>
              {bids.map((x, i) => <Level key={`b${x.px}`} px={x.px} qty={x.qty} c={cb[i]} side="B" />)}
            </tbody></table>
          )}
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="逐笔报价" sub="窗口打开后收到的每次实时报价；量为两次报价间成交量增量，方向按是否触及买一 / 卖一判断" />
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-[11px]"><tbody>
              {tape.map((x, i) => <tr key={`${x.time}-${i}`} className="border-t border-[#0b1622]"><td className="px-2 font-mono text-[10px] text-slate-500">{new Date(x.time).toLocaleTimeString("zh-CN", { hour12: false })}</td><td className="text-right font-mono" style={{ color: x.side === "B" ? UP : x.side === "S" ? DOWN : "#cbd5e1" }}>{fmtPrice(x.price, 3)}</td><td className="text-right font-mono text-slate-300">{x.dv == null ? "—" : fmtCompact(x.dv)}</td><td className="w-[30px] pr-2 text-right text-[10px]" style={{ color: x.side === "B" ? UP : x.side === "S" ? DOWN : "#64748b" }}>{x.side === "B" ? "买" : x.side === "S" ? "卖" : "—"}</td></tr>)}
              {!tape.length && <tr><td className="px-2 py-4 text-slate-500">等待实时报价更新…（休市时不会有新报价）</td></tr>}
            </tbody></table>
          </div>
        </div>
      </div>
      <SectionHead title="下单" />
      <OrderTicket key={sym} initial={sym} strategy="BOOK" />
      <SectionHead title={`本账户在该标的的委托（${mine.length}）`} />
      <OrdersTable rows={mine} max={50} />
    </PanelShell>
  );
}

/* ================================================================== 价格预警 */
type AlertKind = "above" | "below" | "pctUp" | "pctDown";
type PxAlert = { id: string; symbol: string; name: string | null; kind: AlertKind; value: number; note: string; createdAt: number; basePx: number | null; active: boolean; triggeredAt: number | null; triggerPx: number | null; hits: number; repeat: boolean };
const KIND_LAB: Record<AlertKind, string> = { above: "价格 ≥", below: "价格 ≤", pctUp: "日涨幅 ≥", pctDown: "日跌幅 ≥" };
const ALERT_KEY = "px-alerts";
const hit = (a: PxAlert, t: Tick) => a.kind === "above" ? t.price >= a.value : a.kind === "below" ? t.price <= a.value : a.kind === "pctUp" ? (t.changePct ?? 0) >= a.value : (t.changePct ?? 0) <= -a.value;
const gap = (a: PxAlert, t: Tick | null | undefined) => {
  if (!t) return null;
  if (a.kind === "above" || a.kind === "below") return ((a.value - t.price) / t.price) * 100;
  return a.kind === "pctUp" ? a.value - (t.changePct ?? 0) : -a.value - (t.changePct ?? 0);
};

/** 永久保存的个人列表：首次读取后在本地维护，变化即写回平台数据库 */
function useSavedList<T>(key: string) {
  const s = useSaved<T[]>(key);
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => { if (items === null && !s.loading) setItems(Array.isArray(s.data) ? s.data : []); }, [s.loading, s.data, items]);
  const commit = (next: T[]) => { setItems(next); void saveItem(key, next); };
  return { items, commit, loading: items === null };
}

export function PriceAlertLive({ title }: { title: string }) {
  const { items, commit, loading } = useSavedList<PxAlert>(ALERT_KEY);
  const list = items ?? [];
  const syms = useMemo(() => [...new Set(list.map((a) => a.symbol))], [list]);
  const ticks = useTicks(syms);
  const [sym, setSym] = useState("sh600519");
  const [kind, setKind] = useState<AlertKind>("above");
  const [val, setVal] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "hit">("all");
  const preview = useTicks([sym.trim()])[sym.trim()];
  const [perm, setPerm] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "denied"));
  const { pick } = useHub();
  // 实时判断触发
  useEffect(() => {
    if (!items) return;
    let changed = false;
    const now = Date.now();
    const next = items.map((a) => {
      const t = ticks[a.symbol];
      if (!a.active || !t?.price) return a;
      // 重复提醒：同一条件触发后 10 分钟内不重复
      if (a.repeat && a.triggeredAt && now - a.triggeredAt < 600_000) return a;
      if (!hit(a, t)) return a;
      changed = true;
      const msg = `${t.name ?? a.symbol} ${KIND_LAB[a.kind]} ${a.kind.startsWith("pct") ? `${a.value}%` : fmtPrice(a.value)}：现价 ${fmtPrice(t.price)}（${fmtPct(t.changePct)}）`;
      toast.warning("价格预警触发", { description: msg });
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("价格预警触发", { body: msg }); } catch { /* 浏览器不支持 */ }
      return { ...a, active: a.repeat, triggeredAt: now, triggerPx: t.price, hits: a.hits + 1 };
    });
    if (changed) commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticks, items]);
  const add = () => {
    const s = sym.trim();
    const v = Number(val);
    if (!s || !Number.isFinite(v) || v <= 0) return;
    commit([{ id: newId(), symbol: s, name: preview?.name ?? null, kind, value: v, note: note.trim(), createdAt: Date.now(), basePx: preview?.price ?? null, active: true, triggeredAt: null, triggerPx: null, hits: 0, repeat }, ...list]);
    setVal(""); setNote("");
  };
  const upd = (id: string, f: (a: PxAlert) => PxAlert) => commit(list.map((a) => (a.id === id ? f(a) : a)));
  const shown = list.filter((a) => filter === "all" || (filter === "active" ? a.active : a.hits > 0)).map((a) => ({ a, t: ticks[a.symbol], g: gap(a, ticks[a.symbol]) })).sort((x, y) => Number(y.a.active) - Number(x.a.active) || Math.abs(x.g ?? 1e9) - Math.abs(y.g ?? 1e9));
  const near = shown.filter((x) => x.a.active && x.g != null && Math.abs(x.g) < (x.a.kind.startsWith("pct") ? 0.5 : 1)).length;
  return (
    <PanelShell code="ALRT" title={title} right={<span>{list.filter((a) => a.active).length} 条监控中</span>}>
      <Kpis items={[["预警总数", String(list.length)], ["监控中", String(list.filter((a) => a.active).length)], ["已触发（累计次数）", String(list.reduce((n, a) => n + a.hits, 0))], ["距触发很近", String(near), "价格条件 1% 内 / 涨跌幅 0.5 个百分点内"]]} />
      <div className="space-y-1 border-b border-[#1a2a3c] p-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-10 text-slate-400">标的</span><input value={sym} onChange={(e) => setSym(e.target.value)} className={`${inp} w-28`} />
          <span className="text-slate-300">{preview?.name ?? ""}</span><span className="font-mono" style={{ color: toneOf(preview?.changePct) }}>{fmtPrice(preview?.price)} {fmtPct(preview?.changePct)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-10 text-slate-400">条件</span>
          {(Object.keys(KIND_LAB) as AlertKind[]).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={btn(kind === k)}>{KIND_LAB[k]}</button>)}
          <input type="number" step="0.01" value={val} placeholder={kind.startsWith("pct") ? "百分比，如 3" : preview?.price ? String(preview.price) : "价格"} onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))} className={`${inp} w-24`} />
          {kind.startsWith("pct") && <span className="text-slate-500">%</span>}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" className={`${inp} w-36 font-sans`} />
          <label className="ml-1 flex items-center gap-1 text-slate-400"><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />重复提醒</label>
          <button type="button" disabled={!preview?.price || val === ""} onClick={add} className="ml-auto border border-cyan-500 bg-cyan-700/30 px-3 py-0.5 text-cyan-50 disabled:opacity-30">添加预警</button>
        </div>
        {perm !== "granted" && typeof Notification !== "undefined" && perm !== "denied" && <button type="button" onClick={() => void Notification.requestPermission().then(setPerm)} className={btn()}>开启桌面通知</button>}
      </div>
      <div className="flex items-center gap-1 px-2 py-1">{([["all", "全部"], ["active", "监控中"], ["hit", "已触发"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={btn(filter === k)}>{l}</button>)}<span className="ml-auto text-[10px] text-slate-500">条件随实时行情逐笔判断；预警列表永久保存，换设备登录后同样可见</span></div>
      {loading ? <Empty loading /> : (
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">条件</th><th className="text-right">现价</th><th className="text-right">涨跌幅</th><th className="text-right">距触发</th><th className="text-right">设置时价格</th><th className="text-left pl-2">状态</th><th className="text-left">最近触发</th><th className="text-left">备注</th><th className="px-2 text-right">操作</th></tr></thead>
          <tbody>
            {shown.map(({ a, t, g }) => (
              <tr key={a.id} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
                <td className="cursor-pointer px-2 py-0.5 text-slate-100" onClick={() => pick(a.symbol)}>{t?.name ?? a.name ?? a.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{a.symbol}</span></td>
                <td className="text-slate-300">{KIND_LAB[a.kind]} <b className="font-mono text-white">{a.kind.startsWith("pct") ? `${a.value}%` : fmtPrice(a.value)}</b>{a.repeat && <span className="ml-1 text-[9px] text-cyan-300">重复</span>}</td>
                <td className="text-right font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
                <td className="text-right font-mono text-amber-200">{g == null ? "—" : a.kind.startsWith("pct") ? `${g > 0 ? "+" : ""}${g.toFixed(2)} 点` : fmtPct(g)}</td>
                <td className="text-right font-mono text-slate-400">{fmtPrice(a.basePx)}</td>
                <td className="pl-2" style={{ color: a.active ? "#34d399" : a.hits ? "#fbbf24" : "#64748b" }}>{a.active ? "监控中" : a.hits ? "已触发" : "已停用"}</td>
                <td className="font-mono text-[10px] text-slate-400">{a.triggeredAt ? `${new Date(a.triggeredAt).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} @ ${fmtPrice(a.triggerPx)}${a.hits > 1 ? ` ×${a.hits}` : ""}` : "—"}</td>
                <td className="max-w-[140px] truncate text-slate-400" title={a.note}>{a.note}</td>
                <td className="whitespace-nowrap px-2 text-right">
                  <button type="button" onClick={() => upd(a.id, (x) => ({ ...x, active: !x.active, basePx: !x.active ? t?.price ?? x.basePx : x.basePx }))} className="mr-2 text-[10px] text-cyan-300 hover:underline">{a.active ? "停用" : a.hits ? "重新启用" : "启用"}</button>
                  <button type="button" onClick={() => commit(list.filter((x) => x.id !== a.id))} className="text-[10px] text-red-300 hover:underline">删除</button>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={10} className="px-2 py-6 text-slate-500">暂无预警。在上方输入标的与条件后添加。</td></tr>}
          </tbody>
        </table>
      )}
    </PanelShell>
  );
}

/* ================================================================== 自选品种 */
type WItem = { symbol: string; addedAt: number; addPx: number | null; group: string };
const WL_KEY = "watchlist";
const DEFAULT_WL: Array<[string, string]> = [["sh000001", "指数"], ["sh000300", "指数"], ["^GSPC", "指数"], ["sh600519", "A股"], ["sz300750", "A股"], ["0700.HK", "港股"], ["AAPL", "美股"], ["NVDA", "美股"], ["GC", "商品"], ["USDCNH", "外汇"], ["BTC", "加密"]];
type SortK = "manual" | "name" | "chg" | "amp" | "amount" | "since" | "m1" | "vol";

export function WatchlistLive({ title }: { title: string }) {
  const s = useSavedList<WItem>(WL_KEY);
  const items = s.items ?? [];
  const syms = items.map((x) => x.symbol);
  const ticks = useTicks(syms);
  const closes = useCloses(syms.slice(0, 60), 260);
  const [input, setInput] = useState("");
  const [grp, setGrp] = useState("");
  const [view, setView] = useState("全部");
  const [sort, setSort] = useState<SortK>("manual");
  const [desc, setDesc] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const { pick, picked } = useHub();
  const groups = ["全部", ...new Set(items.map((x) => x.group || "未分组"))];
  const add = () => {
    const sym = input.trim();
    if (!sym) return;
    if (items.some((x) => x.symbol === sym)) { setMsg(`${sym} 已在自选中`); return; }
    s.commit([...items, { symbol: sym, addedAt: Date.now(), addPx: null, group: grp.trim() || "未分组" }]);
    setInput(""); setMsg(null);
  };
  // 加入时价格：首个实时报价到达后记下
  useEffect(() => {
    if (!s.items) return;
    let changed = false;
    const next = s.items.map((x) => { const p = ticks[x.symbol]?.price; if (x.addPx == null && p) { changed = true; return { ...x, addPx: p }; } return x; });
    if (changed) s.commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticks, s.items]);
  const metric = (x: WItem) => {
    const t = ticks[x.symbol];
    const c = (closes.data?.[x.symbol] ?? []).map((p) => p[1]);
    return { t, amp: t?.high && t?.low && t?.prevClose ? ((t.high - t.low) / t.prevClose) * 100 : null, since: t?.price && x.addPx ? (t.price / x.addPx - 1) * 100 : null, m1: perf(c, 21), m3: perf(c, 63), vol: annVol(c, 60), hi52: c.length ? Math.max(...c.slice(-250)) : null };
  };
  const rows = items.map((x, i) => ({ x, i, m: metric(x) })).filter((r) => view === "全部" || (r.x.group || "未分组") === view);
  const key = (r: (typeof rows)[number]): number | string => sort === "name" ? (r.m.t?.name ?? r.x.symbol) : sort === "chg" ? r.m.t?.changePct ?? -1e9 : sort === "amp" ? r.m.amp ?? -1e9 : sort === "amount" ? r.m.t?.amount ?? -1e9 : sort === "since" ? r.m.since ?? -1e9 : sort === "m1" ? r.m.m1 ?? -1e9 : sort === "vol" ? r.m.vol ?? -1e9 : r.i;
  const sorted = sort === "manual" ? rows : [...rows].sort((a, b) => { const ka = key(a), kb = key(b); const c = typeof ka === "string" ? String(ka).localeCompare(String(kb), "zh") : (ka as number) - (kb as number); return desc ? -c : c; });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; s.commit(n); };
  const H = ({ k, children, left }: { k: SortK; children: React.ReactNode; left?: boolean }) => <th className={`cursor-pointer select-none ${left ? "text-left" : "text-right"} ${sort === k ? "text-cyan-300" : ""}`} onClick={() => { if (sort === k) setDesc(!desc); else { setSort(k); setDesc(true); } }}>{children}{sort === k ? (desc ? "↓" : "↑") : ""}</th>;
  const ups = rows.filter((r) => (r.m.t?.changePct ?? 0) > 0).length, dns = rows.filter((r) => (r.m.t?.changePct ?? 0) < 0).length;
  const avgChg = rows.length ? rows.reduce((n, r) => n + (r.m.t?.changePct ?? 0), 0) / rows.length : null;
  const best = [...rows].sort((a, b) => (b.m.t?.changePct ?? -1e9) - (a.m.t?.changePct ?? -1e9))[0];
  return (
    <PanelShell code="WL" title={title} right={<span>{items.length} 个品种</span>}>
      <Kpis items={[["上涨 / 下跌", <span><span style={{ color: UP }}>{ups}</span> / <span style={{ color: DOWN }}>{dns}</span></span>, `共 ${rows.length}`], ["平均涨跌幅", <span style={{ color: toneOf(avgChg) }}>{fmtPct(avgChg)}</span>, "等权"], ["今日最强", best?.m.t ? (best.m.t.name ?? best.x.symbol) : "—", best?.m.t ? fmtPct(best.m.t.changePct) : undefined], ["分组", String(groups.length - 1)]]} />
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex items-center gap-1">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="代码，如 sh600519 / 0700.HK / AAPL / GC" className={`${inp} w-56`} />
          <input value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="分组" list="wl-groups" className={`${inp} w-20 font-sans`} />
          <datalist id="wl-groups">{groups.slice(1).map((g) => <option key={g} value={g} />)}</datalist>
          <button className="border border-cyan-500 bg-cyan-700/30 px-2 py-0.5 text-[10px] text-cyan-50">加入自选</button>
        </form>
        {!items.length && !s.loading && <button type="button" onClick={() => s.commit(DEFAULT_WL.map(([sym, g]) => ({ symbol: sym, addedAt: Date.now(), addPx: null, group: g })))} className={btn()}>导入常用品种</button>}
        {msg && <span className="text-[10px] text-amber-200">{msg}</span>}
        <span className="ml-auto flex gap-1">{groups.map((g) => <button key={g} type="button" onClick={() => setView(g)} className={btn(view === g)}>{g}</button>)}</span>
      </div>
      {s.loading ? <Empty loading /> : (
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500"><tr>
            <H k="name" left><span className="px-2">名称</span></H><th className="text-right">最新</th><H k="chg">涨跌幅</H><th className="text-right">最高 / 最低</th><H k="amp">振幅</H><H k="amount">成交额</H><H k="since">加入以来</H><H k="m1">近1月</H><th className="text-right">近3月</th><H k="vol">60日波动率</H><th className="text-right">距一年高点</th><th className="px-2">日K</th><th className="px-2 text-right"><button type="button" onClick={() => setSort("manual")} className={sort === "manual" ? "text-cyan-300" : ""}>手动排序</button></th>
          </tr></thead>
          <tbody>
            {sorted.map(({ x, i, m }) => (
              <tr key={x.symbol} onClick={() => pick(x.symbol)} className={`cursor-pointer border-t border-[#0f1b29] ${picked === x.symbol ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                <td className="px-2 py-0.5"><span className="text-slate-100">{m.t?.name ?? x.symbol}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{x.symbol}</span><span className="ml-1 text-[9px] text-slate-500">{x.group}</span>{m.t === null && <span className="ml-1 text-[9px] text-red-300">无行情</span>}</td>
                <td className="text-right font-mono font-semibold" style={{ color: toneOf(m.t?.changePct) }}>{fmtPrice(m.t?.price)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(m.t?.changePct) }}>{fmtPct(m.t?.changePct)}</td>
                <td className="text-right font-mono text-slate-400">{fmtPrice(m.t?.high)} / {fmtPrice(m.t?.low)}</td>
                <td className="text-right font-mono text-slate-300">{m.amp == null ? "—" : `${m.amp.toFixed(2)}%`}</td>
                <td className="text-right font-mono text-slate-300">{fmtCompact(m.t?.amount)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(m.since) }} title={x.addPx ? `加入时 ${fmtPrice(x.addPx)}，${new Date(x.addedAt).toLocaleDateString("zh-CN")}` : ""}>{fmtPct(m.since)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(m.m1) }}>{fmtPct(m.m1)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(m.m3) }}>{fmtPct(m.m3)}</td>
                <td className="text-right font-mono text-slate-300">{m.vol == null ? "—" : `${m.vol.toFixed(1)}%`}</td>
                <td className="text-right font-mono text-slate-400">{m.hi52 && m.t?.price ? fmtPct((m.t.price / m.hi52 - 1) * 100) : "—"}</td>
                <td className="px-2 py-0.5"><MiniKline symbol={x.symbol} /></td>
                <td className="whitespace-nowrap px-2 text-right" onClick={(e) => e.stopPropagation()}>
                  {sort === "manual" && <><button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="mr-1 text-slate-400 disabled:opacity-20">▲</button><button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="mr-2 text-slate-400 disabled:opacity-20">▼</button></>}
                  <button type="button" onClick={() => s.commit(items.filter((y) => y.symbol !== x.symbol))} className="text-[10px] text-red-300 hover:underline">移除</button>
                </td>
              </tr>
            ))}
            {!sorted.length && <tr><td colSpan={13} className="px-2 py-6 text-slate-500">自选为空。输入代码加入，或导入常用品种。</td></tr>}
          </tbody>
        </table>
      )}
      <div className="px-2 py-1 text-[10px] text-slate-500">自选列表与分组永久保存；“加入以来”以加入后收到的首个实时价格为基准；区间收益与波动率按最新日线计算。点击任一行在右侧查看实时 K 线。</div>
    </PanelShell>
  );
}
