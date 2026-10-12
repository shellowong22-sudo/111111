/**
 * 定价与风险 · 市场定价四个面板：实时行情（LIVE）、波动率曲面（VOL）、收益率曲线（YLD）、估值引擎（VAL）。
 * 数据：实时报价与盘口、日内 K 线、期权链（多到期日真实隐含波动率）、美债与欧元区收益率曲线。
 */
import { useMemo, useState } from "react";
import KlineChart from "@/uc/market/KlineChart";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useLiveKline, usePolled, useTick, useTicks, UP, DOWN } from "@/uc/market/live";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { f2, gbs, heat, sgn } from "@/uc/hubs/calc";
import { Seg } from "@/uc/news/kit";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { avg, halton, invNorm, Note, quantile, sd, TH, TR } from "./PricingKit";

/* ================================================================== LIVE 实时行情 */
const BOARD: BoardRow[] = [
  { symbol: "^GSPC", label: "标普500", group: "全球股指" }, { symbol: "^NDX", label: "纳指100", group: "全球股指" }, { symbol: "^DJI", label: "道琼斯", group: "全球股指" }, { symbol: "^RUT", label: "罗素2000", group: "全球股指" },
  { symbol: "sh000001", label: "上证指数", group: "全球股指" }, { symbol: "sh000300", label: "沪深300", group: "全球股指" }, { symbol: "sz399006", label: "创业板指", group: "全球股指" }, { symbol: "2800.HK", label: "盈富基金（恒指）", group: "全球股指" }, { symbol: "7203.T", label: "丰田汽车（日股）", group: "全球股指" },
  { symbol: "^IRX", label: "13周美债收益率", group: "利率与波动率" }, { symbol: "^FVX", label: "5年美债收益率", group: "利率与波动率" }, { symbol: "^TNX", label: "10年美债收益率", group: "利率与波动率" }, { symbol: "^TYX", label: "30年美债收益率", group: "利率与波动率" }, { symbol: "^VIX", label: "波动率指数", group: "利率与波动率" }, { symbol: "^MOVE", label: "美债波动率", group: "利率与波动率" },
  { symbol: "DXY", label: "美元指数", group: "外汇" }, { symbol: "EURUSD", label: "欧元/美元", group: "外汇" }, { symbol: "USDJPY", label: "美元/日元", group: "外汇" }, { symbol: "USDCNH", label: "美元/离岸人民币", group: "外汇" }, { symbol: "GBPUSD", label: "英镑/美元", group: "外汇" },
  { symbol: "CL", label: "WTI原油", group: "商品" }, { symbol: "BRENT", label: "布伦特原油", group: "商品" }, { symbol: "GC", label: "黄金", group: "商品" }, { symbol: "SI", label: "白银", group: "商品" }, { symbol: "HG", label: "铜", group: "商品" }, { symbol: "NG", label: "天然气", group: "商品" },
  { symbol: "BTC", label: "比特币", group: "加密资产" }, { symbol: "ETH", label: "以太坊", group: "加密资产" },
];
type Depth = { symbol: string; at: number; levels: number; last: number; bids: Array<{ px: number; qty: number }>; asks: Array<{ px: number; qty: number }> };

function SymInput({ value, onChange, quick }: { value: string; onChange: (s: string) => void; quick: Array<[string, string]> }) {
  const [inp, setInp] = useState(value);
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
      <form onSubmit={(e) => { e.preventDefault(); if (inp.trim()) onChange(inp.trim()); }} className="flex items-center gap-1">
        <span className="text-slate-400">标的</span>
        <input value={inp} onChange={(e) => setInp(e.target.value)} className="w-28 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 font-mono text-[11px] text-white" />
        <button className="border border-[#1d3047] px-1.5 text-cyan-300">确定</button>
      </form>
      {quick.map(([s, l]) => <button key={s} type="button" onClick={() => { setInp(s); onChange(s); }} className={`border px-1.5 ${value === s ? "border-cyan-500 text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-white"}`}>{l}</button>)}
    </div>
  );
}

function DepthView() {
  const [sym, setSym] = useState("sh600519");
  const d = usePolled<Depth>("ucMarket.depth", { symbol: sym }, 3000);
  const t = useTick(sym);
  const bids = d.data?.bids ?? [], asks = d.data?.asks ?? [];
  const b1 = bids[0], a1 = asks[0];
  const mid = b1 && a1 ? (b1.px + a1.px) / 2 : null;
  const spread = b1 && a1 ? a1.px - b1.px : null;
  const bq = bids.reduce((s, x) => s + x.qty, 0), aq = asks.reduce((s, x) => s + x.qty, 0);
  const imb = bq + aq ? (bq - aq) / (bq + aq) : null;
  const micro = b1 && a1 && b1.qty + a1.qty ? (a1.px * b1.qty + b1.px * a1.qty) / (b1.qty + a1.qty) : null;
  const maxQ = Math.max(1, ...bids.map((x) => x.qty), ...asks.map((x) => x.qty));
  const impact = (side: "B" | "S", notional: number) => {
    const book = side === "B" ? asks : bids;
    if (!mid || !book.length) return null;
    let left = notional, cost = 0, qty = 0;
    for (const lv of book) { const can = Math.min(lv.qty, left / lv.px); cost += can * lv.px; qty += can; left -= can * lv.px; if (left <= 1e-6) break; }
    if (left > 1e-6) return "beyond" as const;
    const vwap = cost / qty;
    return ((side === "B" ? vwap - mid : mid - vwap) / mid) * 1e4;
  };
  const sizes = [1e5, 5e5, 1e6, 5e6];
  return (
    <div>
      <SymInput value={sym} onChange={setSym} quick={[["sh600519", "贵州茅台"], ["sz000001", "平安银行"], ["sh510300", "沪深300ETF"], ["0700.HK", "腾讯控股"], ["AAPL", "苹果"], ["SPY", "标普ETF"]]} />
      <Kpis items={[["最新价", <span style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price ?? d.data?.last)}</span>, `${t?.name ?? sym} ${fmtPct(t?.changePct)}`], ["买卖价差", spread == null ? "—" : fmtPrice(spread, 3), mid && spread != null ? `${((spread / mid) * 1e4).toFixed(1)} 基点` : ""], ["盘口失衡", imb == null ? "—" : `${(imb * 100).toFixed(1)}%`, imb == null ? "" : imb > 0.2 ? "买盘占优" : imb < -0.2 ? "卖盘占优" : "均衡"], ["微观价格", fmtPrice(micro, 3), mid && micro ? `较中间价 ${(((micro - mid) / mid) * 1e4).toFixed(2)} 基点` : ""]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]">
          <SectionHead title={`盘口（${d.data?.levels ? `${d.data.levels} 档` : "—"}）`} sub={d.data ? `更新 ${new Date(d.data.at).toLocaleTimeString("zh-CN", { hour12: false })}` : undefined} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">档位</th><th className="text-right">价格</th><th className="text-right">数量</th><th className="text-right">金额</th><th className="w-[40%] px-2" /></tr></thead>
            <tbody>
              {[...asks].reverse().map((x, i) => <tr key={`a${i}`} className={TR}><td className="px-2 py-0.5 text-emerald-300">卖{asks.length - i}</td><td className="text-right font-mono" style={{ color: DOWN }}>{fmtPrice(x.px, 3)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(x.qty)}</td><td className="text-right font-mono text-slate-500">{fmtCompact(x.qty * x.px)}</td><td className="px-2"><div style={{ width: `${(x.qty / maxQ) * 100}%`, background: "rgba(31,191,117,.35)", height: 8 }} /></td></tr>)}
              {bids.map((x, i) => <tr key={`b${i}`} className={TR}><td className="px-2 py-0.5 text-red-300">买{i + 1}</td><td className="text-right font-mono" style={{ color: UP }}>{fmtPrice(x.px, 3)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(x.qty)}</td><td className="text-right font-mono text-slate-500">{fmtCompact(x.qty * x.px)}</td><td className="px-2"><div style={{ width: `${(x.qty / maxQ) * 100}%`, background: "rgba(242,73,92,.35)", height: 8 }} /></td></tr>)}
              {!bids.length && !asks.length && <tr><td colSpan={5}><Empty loading={d.loading} text="该标的暂无盘口（期货 / 外汇 / 指数不提供）" /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="冲击成本（逐档吃单，相对中间价）" sub="单位：基点" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">委托金额（本币）</th><th className="text-right">买入冲击</th><th className="px-2 text-right">卖出冲击</th></tr></thead>
            <tbody>{sizes.map((n) => { const b = impact("B", n), s = impact("S", n); const show = (v: number | "beyond" | null) => (v == null ? "—" : v === "beyond" ? "超出可见档位" : v.toFixed(1)); return <tr key={n} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{fmtCompact(n)}</td><td className="text-right font-mono text-red-200">{show(b)}</td><td className="px-2 text-right font-mono text-emerald-200">{show(s)}</td></tr>; })}</tbody>
          </table>
          <Note>微观价格 = 以对手方挂单量加权的买一 / 卖一价，偏向挂单少的一侧，常领先于成交价变动。盘口失衡取可见档位挂单量之差 / 之和。美股仅提供全国最优一档。</Note>
          <SectionHead title="累计挂单深度" />
          <Bars data={[...[...bids].reverse().map((x, i, arr) => ({ k: fmtPrice(x.px, 2), v: arr.slice(i).reduce((s, y) => s + y.qty * y.px, 0) })), ...asks.map((x, i) => ({ k: fmtPrice(x.px, 2), v: -asks.slice(0, i + 1).reduce((s, y) => s + y.qty * y.px, 0) }))]} height={120} fmt={(v) => fmtCompact(Math.abs(v))} />
        </div>
      </div>
    </div>
  );
}

function IntradayView() {
  const [sym, setSym] = useState("SPY");
  const k = useLiveKline(sym, "5m", 400);
  const s = useMemo(() => {
    const cs = k.candles;
    if (cs.length < 5) return null;
    const dayOf = (t: number) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    cs.forEach((c) => counts.set(dayOf(c.t), (counts.get(dayOf(c.t)) ?? 0) + 1));
    const lastDay = dayOf(cs[cs.length - 1].t);
    const today = cs.filter((c) => dayOf(c.t) === lastDay);
    const perDay = Math.max(...counts.values());
    const lr = today.slice(1).map((c, i) => Math.log(c.c / today[i].c));
    const allR = cs.slice(1).map((c, i) => Math.log(c.c / cs[i].c));
    const hasV = today.some((c) => (c.v ?? 0) > 0);
    let pv = 0, vv = 0;
    const vwap = today.map((c) => { const v = c.v ?? 0; pv += ((c.h + c.l + c.c) / 3) * v; vv += v; return vv ? pv / vv : null; });
    const hi = Math.max(...today.map((c) => c.h)), lo = Math.min(...today.map((c) => c.l));
    const last = today[today.length - 1].c, open = today[0].o;
    const big = lr.length ? lr.reduce((m, r) => (Math.abs(r) > Math.abs(m) ? r : m), 0) : 0;
    const vols = today.map((c) => c.v ?? 0);
    return { today, perDay, lastDay, rv: lr.length > 3 ? sd(lr) * Math.sqrt(perDay * 252) * 100 : null, rvAll: sd(allR) * Math.sqrt(perDay * 252) * 100, vwap, vwapNow: vwap[vwap.length - 1], hasV, hi, lo, last, open, pos: hi > lo ? ((last - lo) / (hi - lo)) * 100 : null, big, up: lr.filter((r) => r > 0).length, dn: lr.filter((r) => r < 0).length, volTop: vols.length ? (Math.max(...vols) / Math.max(1, avg(vols))) : null };
  }, [k.candles]);
  return (
    <div>
      <SymInput value={sym} onChange={setSym} quick={[["SPY", "标普ETF"], ["QQQ", "纳指ETF"], ["sh000300", "沪深300"], ["sh600519", "贵州茅台"], ["0700.HK", "腾讯控股"], ["GC", "黄金"], ["BTC", "比特币"]]} />
      {!s ? <Empty loading={k.loading} /> : (
        <>
          <Kpis items={[["开盘以来", <span style={{ color: toneOf(s.last - s.open) }}>{sgn(((s.last - s.open) / s.open) * 100)}</span>, s.lastDay], ["日内区间位置", s.pos == null ? "—" : `${s.pos.toFixed(0)}%`, `高 ${fmtPrice(s.hi)} / 低 ${fmtPrice(s.lo)}`], ["日内实现波动（年化）", f2(s.rv, 1, "%"), `近 ${Math.round(k.candles.length / s.perDay)} 日 5 分钟线：${f2(s.rvAll, 1, "%")}`], ["成交量加权均价", s.hasV ? fmtPrice(s.vwapNow) : "—", s.hasV && s.vwapNow ? `现价偏离 ${sgn(((s.last - s.vwapNow) / s.vwapNow) * 100)}` : "该品种无成交量"]]} />
          <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="bg-[#03070c]"><KlineChart candles={s.today} period="5m" height={300} live overlay="BOLL" subs={["VOL", "MACD"]} /></div>
            <div className="bg-[#03070c] text-[11px]">
              <SectionHead title="日内结构" />
              {[["5 分钟 K 线数", String(s.today.length)], ["上涨 / 下跌根数", `${s.up} / ${s.dn}`], ["最大单根波动", sgn(s.big * 100)], ["日内振幅", s.open ? sgn(((s.hi - s.lo) / s.open) * 100) : "—"], ["峰值量 / 平均量", s.hasV ? f2(s.volTop, 1, "×") : "—"], ["价格相对均价", s.hasV && s.vwapNow ? (s.last >= s.vwapNow ? "均价上方（买方主导）" : "均价下方（卖方主导）") : "—"]].map(([a, b]) => <div key={a} className="flex justify-between border-b border-[#0f1b29] px-2 py-1"><span className="text-slate-400">{a}</span><span className="font-mono text-slate-100">{b}</span></div>)}
              {s.hasV && <><SectionHead title="价格与成交量加权均价" /><Lines series={[{ name: "价格", color: "#e2e8f0", values: s.today.map((c) => c.c) }, { name: "加权均价", color: "#fbbf24", values: s.vwap }]} height={130} fmt={(v) => fmtPrice(v)} /></>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function LivePricing() {
  const [tab, setTab] = useState("board");
  const ticks = useTicks(BOARD.map((r) => r.symbol));
  const up = BOARD.filter((r) => (ticks[r.symbol]?.changePct ?? 0) > 0).length;
  const dn = BOARD.filter((r) => (ticks[r.symbol]?.changePct ?? 0) < 0).length;
  return (
    <PanelShell code="LIVE" title="实时行情与盘口微观结构" tabs={[["board", "跨资产报价墙"], ["depth", "盘口与冲击成本"], ["intra", "日内微观结构"]]} tab={tab} setTab={setTab} right={<span>上涨 {up} · 下跌 {dn}</span>}>
      {tab === "board" && <><LiveBoard rows={BOARD} showMini={false} extra={[{ head: "振幅", cell: (s) => { const t = ticks[s]; return t?.high != null && t.low != null && t.prevClose ? <span className="text-slate-300">{(((t.high - t.low) / t.prevClose) * 100).toFixed(2)}%</span> : "—"; } }, { head: "区间位置", cell: (s) => { const t = ticks[s]; if (t?.high == null || t.low == null || t.high <= t.low) return "—"; const p = ((t.price - t.low) / (t.high - t.low)) * 100; return <span style={{ color: p > 70 ? UP : p < 30 ? DOWN : "#cbd5e1" }}>{p.toFixed(0)}%</span>; } }]} /><Note>点击任一行在右侧查看实时 K 线。区间位置 = (现价 − 当日最低) / (当日最高 − 当日最低)。</Note></>}
      {tab === "depth" && <DepthView />}
      {tab === "intra" && <IntradayView />}
    </PanelShell>
  );
}

/* ================================================================== 期权链公用 */
type Opt = { strike: number; type: "C" | "P"; bid: number; ask: number; last: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number };
type Chain = { symbol: string; timestamp: string | null; spot: number; changePct: number; iv30: number; iv30Change: number; expiries: string[]; expiry: string; chain: Array<{ strike: number; call: Opt | null; put: Opt | null }>; maxPain: number; term: Array<{ exp: string; iv: number | null; oi: number }>; stats: { atmIv: number | null; skew25: number | null; pcOiAll: number; pcVolumeAll: number; callOi: number; putOi: number; totalContracts: number } };
const UL: Array<[string, string]> = [["SPY", "标普500ETF"], ["QQQ", "纳指100ETF"], ["IWM", "罗素2000ETF"], ["^GSPC", "标普500指数"], ["AAPL", "苹果"], ["NVDA", "英伟达"], ["TSLA", "特斯拉"], ["GLD", "黄金ETF"], ["TLT", "20年+美债ETF"]];
const dte = (e: string) => Math.max(0.5, (Date.parse(`${e}T20:00:00Z`) - Date.now()) / 86400e3);
const TARGETS = [7, 14, 30, 60, 90, 180, 270, 365];
function pickExpiries(exps: string[]) {
  const out: string[] = [];
  for (const t of TARGETS) { const best = [...exps].sort((a, b) => Math.abs(dte(a) - t) - Math.abs(dte(b) - t))[0]; if (best && !out.includes(best)) out.push(best); }
  return out.sort();
}
/** 期权隐波单位统一为百分数 */
function ivScale(c: Chain | null) {
  const ivs = (c?.chain ?? []).flatMap((r) => [r.call?.iv, r.put?.iv]).filter((v): v is number => v != null && v > 0);
  const med = quantile(ivs, 0.5);
  return med != null && med < 3 ? 100 : 1;
}
/** 虚值一侧的隐含波动率微笑：[{k = 行权价/现价, iv(%)}] */
function smileOf(c: Chain | null) {
  if (!c || !c.spot) return [];
  const sc = ivScale(c);
  return c.chain.map((r) => { const o = r.strike < c.spot ? r.put : r.call; return o && o.iv > 0 ? { k: r.strike / c.spot, iv: o.iv * sc, strike: r.strike } : null; }).filter((x): x is { k: number; iv: number; strike: number } => !!x && x.iv < 400 && x.k > 0.5 && x.k < 1.6).sort((a, b) => a.k - b.k);
}
function interp(pts: Array<{ k: number; iv: number }>, k: number) {
  if (pts.length < 2 || k < pts[0].k || k > pts[pts.length - 1].k) return null;
  for (let i = 1; i < pts.length; i++) if (pts[i].k >= k) { const a = pts[i - 1], b = pts[i]; return b.k === a.k ? a.iv : a.iv + ((b.iv - a.iv) * (k - a.k)) / (b.k - a.k); }
  return null;
}
function near25(c: Chain | null, type: "C" | "P") {
  if (!c) return null;
  const sc = ivScale(c);
  const list = c.chain.map((r) => (type === "C" ? r.call : r.put)).filter((o): o is Opt => !!o && o.iv > 0 && o.delta !== 0);
  const best = list.sort((a, b) => Math.abs(Math.abs(a.delta) - 0.25) - Math.abs(Math.abs(b.delta) - 0.25))[0];
  return best ? best.iv * sc : null;
}
const MON = Array.from({ length: 17 }, (_, i) => 0.8 + i * 0.025);
function useChains(sym: string) {
  const base = usePolled<Chain | null>("ucHubs.options", { symbol: sym }, 120_000);
  const exps = useMemo(() => pickExpiries(base.data?.expiries ?? []), [base.data?.expiries?.join()]);
  const slots = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => usePolled<Chain | null>("ucHubs.options", exps[i] ? { symbol: sym, expiry: exps[i] } : null, 180_000));
  const chains = exps.map((e, i) => ({ exp: e, dte: dte(e), c: slots[i]?.data ?? null }));
  return { base, chains, loading: base.loading };
}
function ivColor(v: number | null, lo: number, hi: number) {
  if (v == null) return undefined;
  const a = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  return `rgba(${Math.round(56 + a * 195)},${Math.round(130 + a * 61)},${Math.round(246 - a * 210)},0.45)`;
}

/* ================================================================== VOL 波动率曲面 */
type IvRow = { symbol: string; price: number | null; changePct: number | null; iv30: number | null; iv30Chg: number | null; rv20: number | null; rv60: number | null; rv120: number | null; ivRv: number | null; ivRank: number | null; ivPct: number | null; ivDays: number; fromHigh: number | null; cone: Array<{ n: number; min: number | null; p25: number | null; med: number | null; p75: number | null; max: number | null; now: number | null }> };

export function LiveVolSurface() {
  const [tab, setTab] = useState("smile");
  const [sym, setSym] = useState("SPY");
  const { base, chains } = useChains(sym);
  const iv = usePolled<IvRow[]>("ucHubs.ivScan", tab === "vrp" ? { symbols: UL.map(([s]) => s) } : null, 300_000);
  const ready = chains.filter((x) => x.c);
  const smiles = ready.map((x) => ({ ...x, pts: smileOf(x.c) }));
  const rows = smiles.map((x) => {
    const atm = interp(x.pts, 1);
    const p25 = near25(x.c, "P"), c25 = near25(x.c, "C");
    return { ...x, atm, p25, c25, rr: p25 != null && c25 != null ? c25 - p25 : null, bf: p25 != null && c25 != null && atm != null ? (p25 + c25) / 2 - atm : null, grid: MON.map((k) => interp(x.pts, k)) };
  });
  const allIv = rows.flatMap((r) => r.grid.filter((v): v is number => v != null));
  const lo = allIv.length ? Math.min(...allIv) : 0, hi = allIv.length ? Math.max(...allIv) : 1;
  const r30 = [...rows].sort((a, b) => Math.abs(a.dte - 30) - Math.abs(b.dte - 30))[0];
  const r90 = [...rows].sort((a, b) => Math.abs(a.dte - 90) - Math.abs(b.dte - 90))[0];
  const spot = base.data?.spot ?? null;
  const colors = ["#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#22d3ee", "#818cf8", "#e879f9"];
  const term = (base.data?.term ?? []).filter((t) => t.iv != null).map((t) => ({ ...t, d: dte(t.exp), iv: (t.iv ?? 0) * (ivScale(base.data ?? null)) }));
  const curIv = (iv.data ?? []).find((r) => r.symbol === sym.toUpperCase());
  return (
    <PanelShell code="VOL" title="期权隐含波动率曲面" tabs={[["smile", "波动率微笑"], ["term", "期限结构"], ["matrix", "曲面矩阵"], ["vrp", "波动率风险溢价"]]} tab={tab} setTab={setTab} right={base.data?.timestamp ? <span>期权报价 {String(base.data.timestamp).slice(0, 16)}</span> : null}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1">{UL.map(([s, l]) => <button key={s} type="button" onClick={() => setSym(s)} className={`border px-1.5 text-[11px] ${sym === s ? "border-cyan-500 text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-white"}`}>{l}</button>)}</div>
      <Kpis items={[["标的现价", fmtPrice(spot), fmtPct(base.data?.changePct)], ["30 天平值隐波", f2(r30?.atm, 2, "%"), r30 ? `${r30.exp}（${Math.round(r30.dte)} 天）` : ""], ["25Δ 风险逆转", f2(r30?.rr, 2), "看涨 25Δ − 看跌 25Δ，负值 = 下行保护更贵"], ["期限斜率（90−30 天）", r30?.atm != null && r90?.atm != null ? sgn(r90.atm - r30.atm, 2, "") : "—", r30?.atm != null && r90?.atm != null ? (r90.atm >= r30.atm ? "正常升水" : "倒挂：短期恐慌") : ""]]} />
      {!base.data && <Empty loading={base.loading} text="该标的暂无期权数据" />}
      {base.data && tab === "smile" && (
        <>
          <SectionHead title="各到期日波动率微笑（虚值期权隐波，横轴为行权价 / 现价）" sub={`已载入 ${ready.length} / ${chains.length} 个到期日`} />
          <Lines series={rows.map((r, i) => ({ name: `${r.exp.slice(5)}（${Math.round(r.dte)}天）`, color: colors[i % colors.length], values: r.grid }))} xLabels={MON.map((k) => `${(k * 100).toFixed(0)}%`)} height={240} fmt={(v) => v.toFixed(1)} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">到期日</th><th className="text-right">剩余天数</th><th className="text-right">平值隐波</th><th className="text-right">90% 行权价</th><th className="text-right">110% 行权价</th><th className="text-right">左偏斜（90%−平值）</th><th className="px-2 text-right">有效报价点</th></tr></thead>
            <tbody>{rows.map((r) => { const a = interp(r.pts, 0.9), b = interp(r.pts, 1.1); return <tr key={r.exp} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{r.exp}</td><td className="text-right font-mono text-slate-400">{Math.round(r.dte)}</td><td className="text-right font-mono text-amber-200">{f2(r.atm, 2)}</td><td className="text-right font-mono text-slate-300">{f2(a, 2)}</td><td className="text-right font-mono text-slate-300">{f2(b, 2)}</td><td className="text-right font-mono" style={{ background: heat(a != null && r.atm != null ? a - r.atm : null, 8) }}>{a != null && r.atm != null ? sgn(a - r.atm, 2, "") : "—"}</td><td className="px-2 text-right font-mono text-slate-500">{r.pts.length}</td></tr>; })}</tbody>
          </table>
          <Note>股票类标的通常呈“左偏微笑”：低行权价看跌期权隐波更高，反映市场为下跌保护支付的溢价；短期限微笑更陡。</Note>
        </>
      )}
      {base.data && tab === "term" && (
        <>
          <SectionHead title="平值 / 25Δ 看跌 / 25Δ 看涨 隐波期限结构" />
          <Lines series={[{ name: "平值", color: "#fbbf24", values: rows.map((r) => r.atm) }, { name: "25Δ 看跌", color: "#1fbf75", values: rows.map((r) => r.p25) }, { name: "25Δ 看涨", color: "#f2495c", values: rows.map((r) => r.c25) }]} xLabels={rows.map((r) => `${Math.round(r.dte)}天`)} height={190} fmt={(v) => v.toFixed(1)} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">到期日</th><th className="text-right">天数</th><th className="text-right">平值</th><th className="text-right">25Δ看跌</th><th className="text-right">25Δ看涨</th><th className="text-right">风险逆转</th><th className="text-right">蝶式</th><th className="text-right">隐含日波动</th><th className="px-2 text-right">到期 1σ 区间</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.exp} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{r.exp}</td><td className="text-right font-mono text-slate-400">{Math.round(r.dte)}</td><td className="text-right font-mono text-amber-200">{f2(r.atm, 2)}</td><td className="text-right font-mono text-emerald-200">{f2(r.p25, 2)}</td><td className="text-right font-mono text-red-200">{f2(r.c25, 2)}</td><td className="text-right font-mono" style={{ color: toneOf(r.rr) }}>{sgn(r.rr, 2, "")}</td><td className="text-right font-mono text-slate-300">{sgn(r.bf, 2, "")}</td><td className="text-right font-mono text-slate-300">{r.atm != null ? `${(r.atm / Math.sqrt(252)).toFixed(2)}%` : "—"}</td><td className="px-2 text-right font-mono text-slate-300">{r.atm != null && spot ? `±${fmtPrice(spot * (r.atm / 100) * Math.sqrt(r.dte / 365))}` : "—"}</td></tr>)}</tbody>
          </table>
          <SectionHead title="远期波动率（相邻到期日之间市场隐含的波动率）" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">区间</th><th className="text-right">起点隐波</th><th className="text-right">终点隐波</th><th className="px-2 text-right">远期波动率</th></tr></thead>
            <tbody>{term.slice(1).map((t, i) => { const a = term[i]; const v = (t.iv ** 2 * t.d - a.iv ** 2 * a.d) / (t.d - a.d); return <tr key={t.exp} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{a.exp.slice(5)} → {t.exp.slice(5)}</td><td className="text-right font-mono text-slate-400">{a.iv.toFixed(2)}</td><td className="text-right font-mono text-slate-400">{t.iv.toFixed(2)}</td><td className="px-2 text-right font-mono" style={{ color: v > 0 ? "#fbbf24" : "#f87171" }}>{v > 0 ? Math.sqrt(v).toFixed(2) : "日历套利（方差倒挂）"}</td></tr>; })}</tbody>
          </table>
        </>
      )}
      {base.data && tab === "matrix" && (
        <>
          <SectionHead title="隐含波动率曲面矩阵（行：到期日；列：行权价 / 现价）" sub={`色阶 ${lo.toFixed(1)}% → ${hi.toFixed(1)}%`} />
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className={TH}><tr><th className="px-2 py-1 text-left">到期</th>{MON.map((k) => <th key={k} className={`text-right ${Math.abs(k - 1) < 1e-9 ? "text-amber-300" : ""}`}>{(k * 100).toFixed(1)}</th>)}</tr></thead>
              <tbody>{rows.map((r) => <tr key={r.exp} className={TR}><td className="whitespace-nowrap px-2 py-0.5 font-mono text-slate-300">{r.exp.slice(2)}</td>{r.grid.map((v, i) => <td key={i} className="px-1 text-right font-mono text-slate-100" style={{ background: ivColor(v, lo, hi) }}>{v == null ? "" : v.toFixed(1)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <Note>矩阵由各到期日真实期权报价的虚值隐波按行权价线性插值得到，空白表示该区域无有效报价。横向看偏斜，纵向看期限结构。</Note>
        </>
      )}
      {tab === "vrp" && (
        <>
          <SectionHead title="波动率风险溢价" />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">30日隐波</th><th className="text-right">隐波日变</th><th className="text-right">20日实波</th><th className="text-right">60日实波</th><th className="text-right">风险溢价</th><th className="text-right">隐波分位</th><th className="px-2 text-right">隐波/实波</th></tr></thead>
            <tbody>{(iv.data ?? []).map((r) => <tr key={r.symbol} onClick={() => setSym(r.symbol)} className={`${TR} cursor-pointer hover:bg-[#0a1726] ${r.symbol === sym.toUpperCase() ? "bg-[#0d2236]" : ""}`}><td className="px-2 py-0.5 text-slate-100">{UL.find(([s]) => s === r.symbol)?.[1] ?? r.symbol}</td><td className="text-right font-mono text-amber-200">{f2(r.iv30, 2)}</td><td className="text-right font-mono" style={{ color: toneOf(r.iv30Chg) }}>{sgn(r.iv30Chg, 2, "")}</td><td className="text-right font-mono text-slate-300">{f2(r.rv20, 2)}</td><td className="text-right font-mono text-slate-300">{f2(r.rv60, 2)}</td><td className="text-right font-mono" style={{ background: heat(r.ivRv, 10) }}>{sgn(r.ivRv, 2, "")}</td><td className="text-right font-mono text-slate-300">{r.ivPct == null ? <span className="text-[9px] text-slate-600">累积 {r.ivDays} 天</span> : `${r.ivPct.toFixed(0)}%`}</td><td className="px-2 text-right font-mono text-slate-300">{r.iv30 && r.rv20 ? f2(r.iv30 / r.rv20, 2, "×") : "—"}</td></tr>)}{!iv.data && <tr><td colSpan={8}><Empty loading={iv.loading} /></td></tr>}</tbody>
          </table>
          <Bars data={(iv.data ?? []).map((r) => ({ k: UL.find(([s]) => s === r.symbol)?.[1] ?? r.symbol, v: r.ivRv ?? 0 }))} fmt={(v) => v.toFixed(2)} height={110} />
          {curIv && <><SectionHead title={`${UL.find(([s]) => s === curIv.symbol)?.[1] ?? curIv.symbol} 已实现波动率锥（一年）与当前隐波`} /><Lines series={[{ name: "最高", color: "#f87171", values: curIv.cone.map((c) => c.max) }, { name: "75分位", color: "#fb923c", values: curIv.cone.map((c) => c.p75) }, { name: "中位", color: "#94a3b8", values: curIv.cone.map((c) => c.med) }, { name: "25分位", color: "#34d399", values: curIv.cone.map((c) => c.p25) }, { name: "当前实波", color: "#22d3ee", values: curIv.cone.map((c) => c.now) }, ...(curIv.iv30 != null ? [{ name: "30日隐波", color: "#fbbf24", dash: true, values: curIv.cone.map(() => curIv.iv30) }] : [])]} xLabels={curIv.cone.map((c) => `${c.n}日`)} height={170} fmt={(v) => v.toFixed(1)} /></>}
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== YLD 收益率曲线 */
type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }>; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
const yrs = (t: string) => { const m = /^(\d+(?:\.\d+)?)(W|M|Y)$/.exec(t); if (!m) return null; const n = Number(m[1]); return m[2] === "W" ? n / 52 : m[2] === "M" ? n / 12 : n; };
const nsBasis = (t: number, tau: number) => { const x = t / tau; const f1 = (1 - Math.exp(-x)) / x; return [f1, f1 - Math.exp(-x)]; };
function lsq3(y: number[], X1: number[], X2: number[]) {
  const n = y.length;
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < n; i++) { const r = [1, X1[i], X2[i]]; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) A[a][b] += r[a] * r[b]; A[a][3] += r[a] * y[i]; } }
  for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; if (Math.abs(A[c][c]) < 1e-12) return null; for (let r = 0; r < 3; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j < 4; j++) A[r][j] -= f * A[c][j]; } }
  return A.map((r, i) => r[3] / r[i]);
}
/** Nelson-Siegel 拟合：网格搜索衰减参数 τ，其余参数最小二乘 */
function nsFit(pts: Array<{ t: number; y: number }>) {
  if (pts.length < 5) return null;
  let best: { tau: number; b: number[]; sse: number } | null = null;
  for (let tau = 0.3; tau <= 10; tau += 0.1) {
    const B = pts.map((p) => nsBasis(p.t, tau));
    const b = lsq3(pts.map((p) => p.y), B.map((x) => x[0]), B.map((x) => x[1]));
    if (!b) continue;
    const sse = pts.reduce((s, p, i) => s + (p.y - (b[0] + b[1] * B[i][0] + b[2] * B[i][1])) ** 2, 0);
    if (!best || sse < best.sse) best = { tau, b, sse };
  }
  if (!best) return null;
  const { tau, b } = best;
  return { tau, b, rmse: Math.sqrt(best.sse / pts.length), at: (t: number) => { const [f1, f2v] = nsBasis(Math.max(t, 1e-4), tau); return b[0] + b[1] * f1 + b[2] * f2v; } };
}

export function LiveYieldCurve() {
  const [tab, setTab] = useState("curve");
  const c = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const us = c.data?.us ?? [];
  const cur = us[0];
  const ago = (n: number) => us[Math.min(us.length - 1, n)];
  const tenors = (cur?.points ?? []).map((p) => p.tenor).filter((t) => yrs(t) != null);
  const val = (row: Curves["us"][number] | undefined, t: string) => row?.points.find((p) => p.tenor === t)?.value ?? null;
  const fit = useMemo(() => nsFit((cur?.points ?? []).map((p) => ({ t: yrs(p.tenor) ?? 0, y: p.value })).filter((p) => p.t > 0)), [cur?.date]);
  const fitPrev = useMemo(() => nsFit((ago(21)?.points ?? []).map((p) => ({ t: yrs(p.tenor) ?? 0, y: p.value })).filter((p) => p.t > 0)), [us.length, cur?.date]);
  const hist = [...us].reverse();
  const series = (t: string) => hist.map((d) => val(d, t));
  const yearsGrid = Array.from({ length: 30 }, (_, i) => i + 1);
  const fwd = (f: typeof fit) => (f ? yearsGrid.map((t) => { const z1 = t === 1 ? 0 : f.at(t - 1) / 100, z2 = f.at(t) / 100; return t === 1 ? z2 * 100 : ((Math.pow(1 + z2, t) / Math.pow(1 + z1, t - 1)) - 1) * 100; }) : []);
  const fwdNow = fwd(fit), fwdPrev = fwd(fitPrev);
  const fwdAB = (a: number, b: number) => { if (!fit) return null; const za = fit.at(a) / 100, zb = fit.at(a + b) / 100; return (Math.pow(Math.pow(1 + zb, a + b) / Math.pow(1 + za, a), 1 / b) - 1) * 100; };
  const sp = c.data?.spreads ?? [];
  const lastSp = sp[sp.length - 1];
  const invDays = sp.filter((s) => (s.s3m10 ?? 0) < 0).length;
  const eu = c.data?.eu ?? [];
  return (
    <PanelShell code="YLD" title="收益率曲线：拟合、演变、远期与利差" tabs={[["curve", "即期曲线与拟合"], ["evo", "期限结构演变"], ["fwd", "远期利率"], ["spread", "曲线利差与跨市场"]]} tab={tab} setTab={setTab} right={cur ? <span>美债曲线日期 {cur.date}</span> : null}>
      <Kpis items={[["2 年", f2(val(cur, "2Y"), 3, "%"), val(cur, "2Y") != null && val(ago(21), "2Y") != null ? `月变 ${sgn((val(cur, "2Y")! - val(ago(21), "2Y")!) * 100, 0, " 基点")}` : ""], ["10 年", f2(val(cur, "10Y"), 3, "%"), val(cur, "10Y") != null && val(ago(21), "10Y") != null ? `月变 ${sgn((val(cur, "10Y")! - val(ago(21), "10Y")!) * 100, 0, " 基点")}` : ""], ["10年−2年", lastSp?.s2s10 != null ? `${lastSp.s2s10} 基点` : "—", "曲线斜率"], ["10年−3月", lastSp?.s3m10 != null ? `${lastSp.s3m10} 基点` : "—", `近一年倒挂 ${invDays} 天`]]} />
      {!cur && <Empty loading={c.loading} />}
      {cur && tab === "curve" && (
        <>
          <SectionHead title="美债即期收益率曲线：市场 vs Nelson-Siegel 拟合 vs 一月前" sub={fit ? `τ=${fit.tau.toFixed(1)} · 拟合误差 ${(fit.rmse * 100).toFixed(1)} 基点` : undefined} />
          <Lines series={[{ name: "市场", color: "#fbbf24", values: tenors.map((t) => val(cur, t)) }, { name: "NS 拟合", color: "#22d3ee", dash: true, values: tenors.map((t) => (fit ? fit.at(yrs(t)!) : null)) }, { name: "一月前", color: "#64748b", values: tenors.map((t) => val(ago(21), t)) }]} xLabels={tenors} height={200} fmt={(v) => v.toFixed(2)} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">收益率</th><th className="text-right">拟合值</th><th className="text-right">残差（基点）</th><th className="text-right">1 周变动</th><th className="text-right">1 月变动</th><th className="text-right">3 月变动</th><th className="px-2 text-right">1 年变动</th></tr></thead>
            <tbody>{tenors.map((t) => { const v = val(cur, t); const fv = fit ? fit.at(yrs(t)!) : null; const ch = (n: number) => { const o = val(ago(n), t); return v != null && o != null ? (v - o) * 100 : null; }; const res = v != null && fv != null ? (v - fv) * 100 : null; return <tr key={t} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{t}</td><td className="text-right font-mono text-amber-200">{f2(v, 3)}</td><td className="text-right font-mono text-slate-400">{f2(fv, 3)}</td><td className="text-right font-mono" style={{ background: heat(res, 8) }}>{sgn(res, 1, "")}</td>{[5, 21, 63, 250].map((n) => <td key={n} className={`text-right font-mono ${n === 250 ? "px-2" : ""}`} style={{ color: toneOf(ch(n)) }}>{sgn(ch(n), 0, "")}</td>)}</tr>; })}</tbody>
          </table>
          <Note>残差为正 = 该期限收益率高于平滑曲线（相对便宜），为负 = 相对昂贵。NS 参数：水平 β₀={fit ? fit.b[0].toFixed(2) : "—"}，斜率 β₁={fit ? fit.b[1].toFixed(2) : "—"}，曲率 β₂={fit ? fit.b[2].toFixed(2) : "—"}。</Note>
        </>
      )}
      {cur && tab === "evo" && (
        <>
          <SectionHead title="关键期限收益率走势（近一年，%）" />
          <Lines series={[{ name: "3月", color: "#94a3b8", values: series("3M") }, { name: "2年", color: "#22d3ee", values: series("2Y") }, { name: "10年", color: "#fbbf24", values: series("10Y") }, { name: "30年", color: "#f472b6", values: series("30Y") }]} xLabels={hist.map((d) => d.date.slice(2))} height={190} fmt={(v) => v.toFixed(2)} />
          <SectionHead title="曲线三因子：水平 / 斜率 / 曲率" />
          <Lines zero series={[{ name: "斜率（基点）", color: "#22d3ee", values: hist.map((d) => { const a = val(d, "10Y"), b = val(d, "3M"); return a != null && b != null ? (a - b) * 100 : null; }) }, { name: "曲率（基点）", color: "#f472b6", values: hist.map((d) => { const a = val(d, "5Y"), b = val(d, "2Y"), e = val(d, "10Y"); return a != null && b != null && e != null ? (2 * a - b - e) * 100 : null; }) }]} xLabels={hist.map((d) => d.date.slice(2))} height={150} fmt={(v) => v.toFixed(0)} />
          <Lines series={[{ name: "水平（%）", color: "#fbbf24", values: hist.map((d) => { const a = val(d, "2Y"), b = val(d, "10Y"), e = val(d, "30Y"); return a != null && b != null && e != null ? (a + b + e) / 3 : null; }) }]} xLabels={hist.map((d) => d.date.slice(2))} height={110} fmt={(v) => v.toFixed(2)} />
          <SectionHead title="曲线快照对比" />
          <Lines series={[0, 21, 63, 125, 250].map((n, i) => ({ name: ago(n)?.date ?? "", color: ["#fbbf24", "#22d3ee", "#a78bfa", "#64748b", "#475569"][i], values: tenors.map((t) => val(ago(n), t)) }))} xLabels={tenors} height={170} fmt={(v) => v.toFixed(2)} />
        </>
      )}
      {cur && tab === "fwd" && (
        <>
          <SectionHead title="一年期远期利率曲线（由拟合即期曲线推导，%）" sub="以平价收益率近似即期利率" />
          <Lines series={[{ name: "当前", color: "#fbbf24", values: fwdNow }, { name: "一月前", color: "#64748b", values: fwdPrev }, { name: "即期（拟合）", color: "#22d3ee", dash: true, values: yearsGrid.map((t) => (fit ? fit.at(t) : null)) }]} xLabels={yearsGrid.map((t) => `${t}年`)} height={200} fmt={(v) => v.toFixed(2)} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">远期合约</th><th className="text-right">远期利率</th><th className="text-right">对应即期</th><th className="px-2 text-right">远期 − 即期（基点）</th></tr></thead>
            <tbody>{([[1, 1, "1年后的1年期"], [2, 1, "2年后的1年期"], [1, 2, "1年后的2年期"], [2, 3, "2年后的3年期"], [5, 5, "5年后的5年期"], [10, 10, "10年后的10年期"], [10, 20, "10年后的20年期"]] as Array<[number, number, string]>).map(([a, b, l]) => { const f = fwdAB(a, b); const z = fit ? fit.at(b) : null; return <tr key={l} className={TR}><td className="px-2 py-0.5 text-slate-200">{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{a}Y×{b}Y</span></td><td className="text-right font-mono text-amber-200">{f2(f, 3)}</td><td className="text-right font-mono text-slate-400">{f2(z, 3)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(f != null && z != null ? f - z : null) }}>{f != null && z != null ? sgn((f - z) * 100, 0, "") : "—"}</td></tr>; })}</tbody>
          </table>
          <Note>远期利率高于即期 = 市场隐含利率上行（或期限溢价）；“5年后的5年期”常被视作长期中性利率与期限溢价的观察窗口。</Note>
        </>
      )}
      {cur && tab === "spread" && (
        <>
          <SectionHead title="关键期限利差（基点，近一年）" />
          <Lines zero series={[{ name: "10年−2年", color: "#fbbf24", values: sp.map((s) => s.s2s10) }, { name: "10年−3月", color: "#22d3ee", values: sp.map((s) => s.s3m10) }, { name: "30年−5年", color: "#f472b6", values: sp.map((s) => s.s5s30) }]} xLabels={sp.map((s) => s.date.slice(2))} height={200} fmt={(v) => v.toFixed(0)} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">利差</th><th className="text-right">当前</th><th className="text-right">一年最低</th><th className="text-right">一年最高</th><th className="text-right">一年分位</th><th className="px-2 text-right">倒挂天数</th></tr></thead>
            <tbody>{(["s2s10", "s3m10", "s5s30"] as const).map((k) => { const v = sp.map((s) => s[k]).filter((x): x is number => x != null); const now = v[v.length - 1]; return <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-200">{({ s2s10: "10年−2年", s3m10: "10年−3月", s5s30: "30年−5年" })[k]}</td><td className="text-right font-mono text-amber-200">{now ?? "—"}</td><td className="text-right font-mono text-slate-400">{v.length ? Math.min(...v) : "—"}</td><td className="text-right font-mono text-slate-400">{v.length ? Math.max(...v) : "—"}</td><td className="text-right font-mono text-slate-300">{v.length && now != null ? `${((v.filter((x) => x <= now).length / v.length) * 100).toFixed(0)}%` : "—"}</td><td className="px-2 text-right font-mono text-slate-300">{v.filter((x) => x < 0).length}</td></tr>; })}</tbody>
          </table>
          <SectionHead title="美债 vs 欧元区（AAA 政府债）即期曲线" sub={c.data?.euDate ? `欧元区数据日期 ${c.data.euDate}` : undefined} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">美国</th><th className="text-right">欧元区</th><th className="px-2 text-right">美欧利差（基点）</th></tr></thead>
            <tbody>{eu.map((e) => { const u = val(cur, e.tenor); return <tr key={e.tenor} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{e.tenor}</td><td className="text-right font-mono text-amber-200">{f2(u, 3)}</td><td className="text-right font-mono text-cyan-200">{f2(e.value, 3)}</td><td className="px-2 text-right font-mono text-slate-200">{u != null ? ((u - e.value) * 100).toFixed(0) : "—"}</td></tr>; })}{!eu.length && <tr><td colSpan={4}><Empty text="欧元区曲线暂缺" /></td></tr>}</tbody>
          </table>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== VAL 估值引擎 */
function crr(type: "C" | "P", S: number, K: number, T: number, r: number, b: number, v: number, N: number, american: boolean) {
  const dt = T / N, u = Math.exp(v * Math.sqrt(dt)), d = 1 / u, p = (Math.exp(b * dt) - d) / (u - d), disc = Math.exp(-r * dt);
  const pay = (s: number) => Math.max(0, type === "C" ? s - K : K - s);
  const V = Array.from({ length: N + 1 }, (_, j) => pay(S * Math.pow(u, j) * Math.pow(d, N - j)));
  for (let i = N - 1; i >= 0; i--) for (let j = 0; j <= i; j++) { const cont = disc * (p * V[j + 1] + (1 - p) * V[j]); V[j] = american ? Math.max(cont, pay(S * Math.pow(u, j) * Math.pow(d, i - j))) : cont; }
  return V[0];
}
function qmc(type: "C" | "P", S: number, K: number, T: number, r: number, b: number, v: number, N: number) {
  let s = 0;
  for (let i = 1; i <= N; i++) { const z = invNorm(halton(i, 2)); const ST = S * Math.exp((b - (v * v) / 2) * T + v * Math.sqrt(T) * z); s += Math.max(0, type === "C" ? ST - K : K - ST); }
  return (Math.exp(-r * T) * s) / N;
}
const mid = (o: Opt | null) => (!o ? null : o.bid > 0 && o.ask > 0 ? (o.bid + o.ask) / 2 : o.last > 0 ? o.last : null);

export function LiveValuation() {
  const [tab, setTab] = useState("chain");
  const [sym, setSym] = useState("SPY");
  const [exp, setExp] = useState<string | null>(null);
  const base = usePolled<Chain | null>("ucHubs.options", { symbol: sym }, 120_000);
  const expiries = (base.data?.expiries ?? []).filter((e) => dte(e) >= 5).slice(0, 14);
  const useExp = exp && expiries.includes(exp) ? exp : expiries.find((e) => dte(e) >= 25) ?? expiries[0] ?? null;
  const ch = usePolled<Chain | null>("ucHubs.options", useExp ? { symbol: sym, expiry: useExp } : null, 120_000);
  const curves = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const c = ch.data;
  const S = c?.spot ?? 0;
  const T = useExp ? dte(useExp) / 365 : 0;
  const sc = ivScale(c ?? null);
  // 无风险利率：按到期期限在美债曲线上线性插值（连续复利）
  const r = useMemo(() => {
    const pts = (curves.data?.us?.[0]?.points ?? []).map((p) => ({ t: yrs(p.tenor) ?? 0, y: p.value })).filter((p) => p.t > 0).sort((a, b) => a.t - b.t);
    if (!pts.length || !T) return null;
    let y = pts[0].y;
    if (T >= pts[pts.length - 1].t) y = pts[pts.length - 1].y;
    else for (let i = 1; i < pts.length; i++) if (pts[i].t >= T) { const a = pts[i - 1], b = pts[i]; y = T <= a.t ? a.y : a.y + ((b.y - a.y) * (T - a.t)) / (b.t - a.t); break; }
    return Math.log(1 + y / 100);
  }, [curves.data, T]);
  const rr = r ?? 0;
  const atmIdx = c ? c.chain.reduce((bi, row, i, arr) => (Math.abs(row.strike - S) < Math.abs(arr[bi].strike - S) ? i : bi), 0) : 0;
  const rows = c ? c.chain.slice(Math.max(0, atmIdx - 10), atmIdx + 11) : [];
  // 平价推导的隐含持有成本 b 与股息率
  const parity = rows.map((row) => { const cm = mid(row.call), pm = mid(row.put); if (cm == null || pm == null || !T) return null; const F = row.strike + (cm - pm) * Math.exp(rr * T); return { strike: row.strike, cm, pm, F, b: Math.log(F / S) / T }; }).filter((x): x is { strike: number; cm: number; pm: number; F: number; b: number } => !!x && x.F > 0);
  const bImp = quantile(parity.map((p) => p.b), 0.5) ?? rr;
  const atm = c?.chain[atmIdx];
  const atmIv = atm ? (((atm.call?.iv ?? 0) + (atm.put?.iv ?? 0)) / ((atm.call?.iv ? 1 : 0) + (atm.put?.iv ? 1 : 0) || 1)) * sc / 100 : 0;
  const conv = useMemo(() => {
    if (!atm || !S || !T || !atmIv) return null;
    const K = atm.strike;
    const bs = gbs("C", S, K, T, rr, bImp, atmIv).price;
    const steps = [10, 25, 50, 100, 200, 400, 800];
    const paths = [64, 256, 1024, 4096, 16384, 65536];
    return { K, bs, crr: steps.map((n) => ({ n, v: crr("C", S, K, T, rr, bImp, atmIv, n, false) })), crrAm: steps.map((n) => ({ n, v: crr("P", S, K, T, rr, bImp, atmIv, n, true) })), bsPut: gbs("P", S, K, T, rr, bImp, atmIv).price, qmc: paths.map((n) => ({ n, v: qmc("C", S, K, T, rr, bImp, atmIv, n) })) };
  }, [atm?.strike, S, T, atmIv, rr, bImp]);
  return (
    <PanelShell code="VAL" title="期权估值引擎（基于真实期权链）" tabs={[["chain", "模型 vs 市场"], ["parity", "平价与隐含持有成本"], ["conv", "数值方法收敛"]]} tab={tab} setTab={setTab}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        {UL.map(([s, l]) => <button key={s} type="button" onClick={() => { setSym(s); setExp(null); }} className={`border px-1.5 ${sym === s ? "border-cyan-500 text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-white"}`}>{l}</button>)}
        <span className="ml-3 text-slate-400">到期日</span>
        <select value={useExp ?? ""} onChange={(e) => setExp(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 font-mono text-[11px] text-white">{expiries.map((e) => <option key={e} value={e}>{e}（{Math.round(dte(e))}天）</option>)}</select>
      </div>
      <Kpis items={[["标的现价", fmtPrice(S || null), fmtPct(c?.changePct)], ["无风险利率（期限匹配）", r != null ? `${(r * 100).toFixed(3)}%` : "—", "美债曲线插值，连续复利"], ["隐含持有成本 b", `${(bImp * 100).toFixed(3)}%`, `隐含股息率 ${((rr - bImp) * 100).toFixed(2)}%`], ["平值隐波", atmIv ? `${(atmIv * 100).toFixed(2)}%` : "—", atm ? `行权价 ${atm.strike}` : ""]]} />
      {!c && <Empty loading={ch.loading || base.loading} text="该标的暂无期权数据" />}
      {c && tab === "chain" && (
        <>
          <SectionHead title="逐行权价：市场中间价 vs 广义 BS（自身隐波）vs 平值单一波动率定价" />
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className={TH}><tr><th className="px-2 py-1 text-right">看涨市价</th><th className="text-right">模型</th><th className="text-right">微笑溢价</th><th className="text-right">Delta</th><th className="text-right">Gamma</th><th className="bg-[#0d2236] px-2 text-center text-amber-300">行权价</th><th className="text-right">看跌市价</th><th className="text-right">模型</th><th className="text-right">微笑溢价</th><th className="text-right">美式溢价</th><th className="text-right">Vega</th><th className="px-2 text-right">Theta/日</th></tr></thead>
              <tbody>{rows.map((row) => {
                const K = row.strike;
                const cv = (row.call?.iv ?? 0) * sc / 100, pv = (row.put?.iv ?? 0) * sc / 100;
                const cm = mid(row.call), pm = mid(row.put);
                const cModel = cv > 0 ? gbs("C", S, K, T, rr, bImp, cv) : null;
                const pModel = pv > 0 ? gbs("P", S, K, T, rr, bImp, pv) : null;
                const cFlat = atmIv ? gbs("C", S, K, T, rr, bImp, atmIv).price : null;
                const pFlat = atmIv ? gbs("P", S, K, T, rr, bImp, atmIv).price : null;
                const amer = pv > 0 && pModel ? crr("P", S, K, T, rr, bImp, pv, 200, true) - crr("P", S, K, T, rr, bImp, pv, 200, false) : null;
                const isAtm = K === atm?.strike;
                return (
                  <tr key={K} className={`${TR} ${isAtm ? "bg-[#0b1a2a]" : ""}`}>
                    <td className="px-2 py-0.5 text-right font-mono text-red-200">{fmtPrice(cm)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(cModel?.price)}</td>
                    <td className="text-right font-mono" style={{ background: heat(cm != null && cFlat != null ? cm - cFlat : null, Math.max(0.5, S * 0.004)) }}>{cm != null && cFlat != null ? sgn(cm - cFlat, 2, "") : "—"}</td>
                    <td className="text-right font-mono text-slate-400">{f2(cModel?.delta, 3)}</td><td className="text-right font-mono text-slate-400">{f2(cModel?.gamma, 4)}</td>
                    <td className="bg-[#0d2236] px-2 text-center font-mono text-amber-200">{K}</td>
                    <td className="text-right font-mono text-emerald-200">{fmtPrice(pm)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(pModel?.price)}</td>
                    <td className="text-right font-mono" style={{ background: heat(pm != null && pFlat != null ? pm - pFlat : null, Math.max(0.5, S * 0.004)) }}>{pm != null && pFlat != null ? sgn(pm - pFlat, 2, "") : "—"}</td>
                    <td className="text-right font-mono text-slate-300">{amer == null ? "—" : amer.toFixed(3)}</td>
                    <td className="text-right font-mono text-slate-400">{f2(pModel?.vega ?? cModel?.vega, 3)}</td><td className="px-2 text-right font-mono text-slate-400">{f2(pModel?.theta ?? cModel?.theta, 3)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <Note>模型价使用各合约自身的市场隐波、期限匹配的美债利率和由平价关系反推的持有成本；与市场中间价的偏差主要来自买卖价差与报价时滞。</Note>
        </>
      )}
      {c && tab === "parity" && (
        <>
          <SectionHead title="看涨看跌平价校验" sub={`中位隐含远期 ${fmtPrice(S * Math.exp(bImp * T))}，剩余 ${(T * 365).toFixed(0)} 天`} />
          <table className="w-full text-[11px]">
            <thead className={TH}><tr><th className="px-2 py-1 text-left">行权价</th><th className="text-right">看涨中间价</th><th className="text-right">看跌中间价</th><th className="text-right">C − P</th><th className="text-right">理论值</th><th className="text-right">偏差</th><th className="text-right">偏差（基点）</th><th className="text-right">隐含远期</th><th className="px-2 text-right">隐含持有成本</th></tr></thead>
            <tbody>{parity.map((p) => { const th = S * Math.exp((bImp - rr) * T) - p.strike * Math.exp(-rr * T); const dv = p.cm - p.pm - th; return <tr key={p.strike} className={TR}><td className="px-2 py-0.5 font-mono text-amber-200">{p.strike}</td><td className="text-right font-mono text-red-200">{fmtPrice(p.cm)}</td><td className="text-right font-mono text-emerald-200">{fmtPrice(p.pm)}</td><td className="text-right font-mono text-slate-200">{fmtPrice(p.cm - p.pm)}</td><td className="text-right font-mono text-slate-400">{fmtPrice(th)}</td><td className="text-right font-mono" style={{ color: toneOf(dv) }}>{sgn(dv, 3, "")}</td><td className="text-right font-mono" style={{ background: heat((dv / S) * 1e4, 10) }}>{((dv / S) * 1e4).toFixed(1)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(p.F)}</td><td className="px-2 text-right font-mono text-slate-300">{(p.b * 100).toFixed(2)}%</td></tr>; })}{!parity.length && <tr><td colSpan={9}><Empty text="缺少成对有效报价" /></td></tr>}</tbody>
          </table>
          <Note>美式期权（个股 / ETF）因提前行权权利，平价关系只在一定区间内成立；偏差持续超过买卖价差通常意味着借券成本或除息预期。指数期权为欧式，偏差应接近零。</Note>
        </>
      )}
      {c && tab === "conv" && conv && (
        <>
          <SectionHead title={`平值看涨（行权价 ${conv.K}）：解析解 vs 二叉树 vs 准蒙特卡洛`} sub={`解析解 ${conv.bs.toFixed(4)}`} />
          <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
            <div className="bg-[#03070c]">
              <Lines series={[{ name: "二叉树（欧式看涨）", color: "#22d3ee", values: conv.crr.map((x) => x.v) }, { name: "解析解", color: "#fbbf24", dash: true, values: conv.crr.map(() => conv.bs) }]} xLabels={conv.crr.map((x) => `${x.n}步`)} height={160} fmt={(v) => v.toFixed(3)} />
              <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">步数</th><th className="text-right">欧式看涨</th><th className="text-right">误差</th><th className="text-right">美式看跌</th><th className="px-2 text-right">美式−欧式</th></tr></thead>
                <tbody>{conv.crr.map((x, i) => <tr key={x.n} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{x.n}</td><td className="text-right font-mono text-slate-100">{x.v.toFixed(4)}</td><td className="text-right font-mono" style={{ color: toneOf(x.v - conv.bs) }}>{sgn(x.v - conv.bs, 4, "")}</td><td className="text-right font-mono text-slate-100">{conv.crrAm[i].v.toFixed(4)}</td><td className="px-2 text-right font-mono text-amber-200">{(conv.crrAm[i].v - conv.bsPut).toFixed(4)}</td></tr>)}</tbody></table>
            </div>
            <div className="bg-[#03070c]">
              <Lines series={[{ name: "准蒙特卡洛", color: "#a78bfa", values: conv.qmc.map((x) => x.v) }, { name: "解析解", color: "#fbbf24", dash: true, values: conv.qmc.map(() => conv.bs) }]} xLabels={conv.qmc.map((x) => `${x.n}`)} height={160} fmt={(v) => v.toFixed(3)} />
              <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">路径数</th><th className="text-right">估值</th><th className="text-right">绝对误差</th><th className="px-2 text-right">相对误差</th></tr></thead>
                <tbody>{conv.qmc.map((x) => <tr key={x.n} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{x.n}</td><td className="text-right font-mono text-slate-100">{x.v.toFixed(4)}</td><td className="text-right font-mono" style={{ color: toneOf(x.v - conv.bs) }}>{sgn(x.v - conv.bs, 4, "")}</td><td className="px-2 text-right font-mono text-slate-400">{((Math.abs(x.v - conv.bs) / conv.bs) * 100).toFixed(3)}%</td></tr>)}</tbody></table>
            </div>
          </div>
          <Note>参数全部取自市场：现价、平值隐波、期限匹配利率与平价隐含持有成本。二叉树误差随步数呈锯齿状收敛（奇偶步交替）；准蒙特卡洛采用 Halton 低差异序列，收敛速度接近 1/N，优于普通随机抽样的 1/√N。美式看跌与欧式之差即提前行权权利价值。</Note>
        </>
      )}
    </PanelShell>
  );
}

export { SymInput };
