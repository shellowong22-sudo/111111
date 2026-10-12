/**
 * 组合管理第三组：历史业绩（PORT HP）、业绩归因（PORT PA）、交易模拟（PORT TS）、持仓新闻情绪（NL）、持仓事件（EVTS）、报告快照（PREP / DRPT）。
 * 每个功能只做一个角度：HP 只看交易账户已实现的历史（逐笔平仓、按月）；PA 只拆分各区间收益来源（本币 / 汇率）；
 * TS 只做下单前的假设测算；NL 只看持仓相关新闻；EVTS 只看业绩预期与监管申报；PREP 只做快照保存与前后对比。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, ucGet, useTicks } from "@/uc/market/live";
import { Bars, useHub } from "@/uc/hubs/kit";
import { align, f2, heat, mean, sgn, std, useCloses } from "@/uc/hubs/calc";
import { ReaderDrawer, Seg, ago, toNews, toneColor, TONE_LABEL, type News } from "@/uc/news/kit";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { MARKET_ZH, OrderTicket, useFills, type Fill } from "@/uc/trade/kit";
import { BENCH_ZH, covar, usd, useBook, type BookRow } from "@/components/live/PortOpsLive";
import { toCny, useFx } from "@/components/live/STPLive";

type P = { onClose?: () => void };
const th = "sticky top-0 z-[1] bg-[#0a1726] text-[10px] text-slate-500";
const tr = "cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]";
const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
const Btn = ({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => <button type="button" disabled={disabled} onClick={onClick} className="border border-[#2a3c52] px-2 py-0.5 text-[11px] text-slate-200 hover:bg-[#0a1726] disabled:opacity-40">{children}</button>;

/* ================================================================== PORT HP 历史业绩（已实现） */
type Close = { f: Fill; avg: number; pnl: number; pct: number; days: number };
function realize(fills: Fill[]) {
  const pos = new Map<string, { qty: number; cost: number; open: number }>();
  const closes: Close[] = [];
  for (const f of [...fills].sort((a, b) => a.ts - b.ts)) {
    const p = pos.get(f.symbol) ?? { qty: 0, cost: 0, open: f.ts };
    if (f.side === "B") {
      if (p.qty <= 1e-9) p.open = f.ts;
      p.cost += f.qty * f.px + f.fee + f.tax; p.qty += f.qty;
    } else if (p.qty > 1e-9) {
      const q = Math.min(f.qty, p.qty);
      const avg = p.cost / p.qty;
      const pnl = q * (f.px - avg) - f.fee - f.tax;
      closes.push({ f, avg, pnl, pct: avg ? (f.px / avg - 1) * 100 : 0, days: (f.ts - p.open) / 86400_000 });
      p.cost -= avg * q; p.qty -= q;
    }
    pos.set(f.symbol, p);
  }
  return closes;
}

export function PortHpLive({ onClose }: P) {
  const f = useFills();
  const fx = useFx();
  const { pick } = useHub();
  const fills = f.data ?? [];
  const closes = useMemo(() => realize(fills), [fills]);
  const cny = (v: number, c: string) => toCny(v, c, fx.data) ?? 0;
  const months = useMemo(() => {
    const m = new Map<string, { k: string; buy: number; sell: number; cost: number; pnl: number; n: number; win: number }>();
    for (const x of fills) { const k = x.tradeDate.slice(0, 7); const g = m.get(k) ?? { k, buy: 0, sell: 0, cost: 0, pnl: 0, n: 0, win: 0 }; if (x.side === "B") g.buy += cny(x.notional, x.ccy); else g.sell += cny(x.notional, x.ccy); g.cost += cny(x.fee + x.tax, x.ccy); m.set(k, g); }
    for (const c of closes) { const g = m.get(c.f.tradeDate.slice(0, 7)); if (g) { g.pnl += cny(c.pnl, c.f.ccy); g.n++; if (c.pnl > 0) g.win++; } }
    return [...m.values()].sort((a, b) => b.k.localeCompare(a.k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fills, closes, fx.data]);
  const tot = closes.reduce((s, c) => s + cny(c.pnl, c.f.ccy), 0);
  const wins = closes.filter((c) => c.pnl > 0), losses = closes.filter((c) => c.pnl <= 0);
  const gw = wins.reduce((s, c) => s + cny(c.pnl, c.f.ccy), 0), gl = -losses.reduce((s, c) => s + cny(c.pnl, c.f.ccy), 0);
  const cum = useMemo(() => { let s = 0; return [...months].reverse().map((g) => ({ k: g.k.slice(2), v: (s += g.pnl) })); }, [months]);
  return (
    <PanelShell code="PORT HP" title="历史业绩（交易账户已实现）" onClose={onClose} right={<span>移动加权成本法 · 折合人民币</span>}>
      <Kpis items={[
        ["累计已实现盈亏", <span style={{ color: toneOf(tot) }}>{fmtCompact(tot)}</span>, `${closes.length} 笔平仓`],
        ["胜率", closes.length ? `${((wins.length / closes.length) * 100).toFixed(0)}%` : "—", `盈 ${wins.length} / 亏 ${losses.length}`],
        ["盈亏比", gl > 0 ? (gw / gl).toFixed(2) : wins.length ? "无亏损" : "—"],
        ["平均持有天数", closes.length ? mean(closes.map((c) => c.days)).toFixed(1) : "—"],
      ]} />
      {!fills.length ? <Empty loading={f.loading && !f.data} text="交易账户暂无成交记录，平仓后这里按月统计已实现业绩。" /> : <>
        <SectionHead title="按月统计" sub="买卖额、交易成本与当月平仓实现的盈亏" />
        <table className="w-full text-[11px]">
          <thead className={th}><tr><th className="px-2 py-1 text-left">月份</th><th className="text-right">买入额</th><th className="text-right">卖出额</th><th className="text-right">佣金税费</th><th className="text-right">平仓笔数</th><th className="text-right">胜率</th><th className="px-2 text-right">已实现盈亏</th></tr></thead>
          <tbody>{months.map((g) => <tr key={g.k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-300">{g.k}</td><td className="text-right font-mono">{fmtCompact(g.buy)}</td><td className="text-right font-mono">{fmtCompact(g.sell)}</td><td className="text-right font-mono text-slate-400">{fmtCompact(g.cost)}</td><td className="text-right font-mono">{g.n}</td><td className="text-right font-mono text-slate-300">{g.n ? `${((g.win / g.n) * 100).toFixed(0)}%` : "—"}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(g.pnl) }}>{fmtCompact(g.pnl)}</td></tr>)}</tbody>
        </table>
        {cum.length > 1 && <><SectionHead title="累计已实现盈亏（按月）" /><Bars data={cum} fmt={(v) => fmtCompact(v)} height={120} /></>}
        <SectionHead title="逐笔平仓" sub="平仓价相对持仓均价（含买入费用）；盈亏已扣卖出费用" />
        <table className="w-full text-[11px]">
          <thead className={th}><tr><th className="px-2 py-1 text-left">日期</th><th className="text-left">标的</th><th className="text-right">数量</th><th className="text-right">持仓均价</th><th className="text-right">平仓价</th><th className="text-right">收益率</th><th className="text-right">持有天数</th><th className="px-2 text-right">盈亏（原币）</th></tr></thead>
          <tbody>{[...closes].reverse().slice(0, 200).map((c) => <tr key={c.f.id} onClick={() => pick(c.f.symbol)} className={tr}><td className="px-2 py-0.5 font-mono text-slate-400">{c.f.tradeDate}</td><td className="text-slate-100">{c.f.symbol}<span className="ml-1 text-[9px] text-slate-600">{MARKET_ZH[c.f.market] ?? c.f.market}</span></td><td className="text-right font-mono">{c.f.qty}</td><td className="text-right font-mono text-slate-400">{fmtPrice(c.avg)}</td><td className="text-right font-mono text-white">{fmtPrice(c.f.px)}</td><td className="text-right font-mono" style={{ color: toneOf(c.pct) }}>{sgn(c.pct)}</td><td className="text-right font-mono text-slate-400">{c.days.toFixed(1)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(c.pnl) }}>{fmtCompact(c.pnl)} <span className="text-[9px] text-slate-600">{c.f.ccy}</span></td></tr>)}
            {!closes.length && <tr><td colSpan={8}><Empty text="尚无平仓记录：卖出已有持仓后在此统计。" /></td></tr>}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== PORT PA 业绩归因 */
const FXPAIR: Record<string, string> = { CNY: "USDCNY", CNH: "USDCNY", HKD: "USDHKD", JPY: "USDJPY" };
const SPANS: Array<[string, string, number]> = [["1w", "1 周", 5], ["1m", "1 月", 21], ["3m", "3 月", 63], ["6m", "6 月", 126], ["1y", "1 年", 252]];

export function PortPaLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const [span, setSpan] = useState("1m");
  const n = SPANS.find(([k]) => k === span)![2];
  const rows = book.rows.filter((r) => r.mv).slice(0, 40);
  const fxSyms = [...new Set(rows.map((r) => FXPAIR[r.ccy]).filter(Boolean))];
  const bench = book.benchmark;
  const pack = useCloses([...rows.map((r) => r.symbol), ...fxSyms, bench], 300);
  const res = useMemo(() => {
    const ret = (s: string) => { const c = (pack.data?.[s] ?? []).map(([, v]) => v); return c.length > n ? c[c.length - 1] / c[c.length - 1 - n] - 1 : null; };
    const items = rows.map((r) => {
      const loc = ret(r.symbol);
      const pair = FXPAIR[r.ccy];
      const fxr = pair ? ret(pair) : 0;
      const fxEff = fxr == null ? null : 1 / (1 + fxr) - 1; // 美元兑外币上涨 = 外币贬值
      const total = loc == null ? null : (1 + loc) * (1 + (fxEff ?? 0)) - 1;
      return { r, loc, fxEff, total, cLoc: loc == null ? null : r.w * loc * 100, cFx: loc == null || fxEff == null ? null : r.w * (1 + loc) * fxEff * 100, cTot: total == null ? null : r.w * total * 100 };
    });
    const ok = items.filter((x) => x.cTot != null);
    const pr = ok.reduce((s, x) => s + (x.cTot ?? 0), 0);
    const loc = ok.reduce((s, x) => s + (x.cLoc ?? 0), 0);
    const fxc = ok.reduce((s, x) => s + (x.cFx ?? 0), 0);
    const b = ret(bench);
    const group = (key: (r: BookRow) => string) => Object.entries(items.reduce<Record<string, { w: number; loc: number; fx: number; tot: number }>>((a, x) => { const g = (a[key(x.r)] ??= { w: 0, loc: 0, fx: 0, tot: 0 }); g.w += x.r.w; g.loc += x.cLoc ?? 0; g.fx += x.cFx ?? 0; g.tot += x.cTot ?? 0; return a; }, {})).sort((a, b2) => b2[1].tot - a[1].tot);
    return { items: items.sort((a, b2) => (b2.cTot ?? -1e9) - (a.cTot ?? -1e9)), pr, loc, fxc, bench: b == null ? null : b * 100, byMkt: group((r) => MARKET_ZH[r.market] ?? r.market), byCcy: group((r) => r.ccy), cover: ok.reduce((s, x) => s + Math.abs(x.r.w), 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, n, JSON.stringify(rows.map((r) => [r.symbol, r.w.toFixed(4)])), bench]);
  const G = ({ title, data }: { title: string; data: Array<[string, { w: number; loc: number; fx: number; tot: number }]> }) => (
    <div className="bg-[#03070c]"><SectionHead title={title} />
      <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">分组</th><th className="text-right">权重</th><th className="text-right">本币贡献</th><th className="text-right">汇率贡献</th><th className="px-2 text-right">合计</th></tr></thead>
        <tbody>{data.map(([k, g]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{k}</td><td className="text-right font-mono">{(g.w * 100).toFixed(1)}%</td><td className="text-right font-mono" style={{ color: toneOf(g.loc) }}>{sgn(g.loc)}</td><td className="text-right font-mono" style={{ color: toneOf(g.fx) }}>{sgn(g.fx)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(g.tot) }}>{sgn(g.tot)}</td></tr>)}</tbody></table></div>
  );
  return (
    <PanelShell code="PORT PA" title="业绩归因" onClose={onClose} right={<Seg value={span} options={SPANS.map(([k, l]) => [k, l] as [string, string])} onChange={setSpan} />}>
      <Kpis items={[
        ["组合收益（美元计）", <span style={{ color: toneOf(res.pr) }}>{sgn(res.pr)}</span>, `覆盖 ${(res.cover * 100).toFixed(0)}% 市值`],
        ["其中：本币价格", <span style={{ color: toneOf(res.loc) }}>{sgn(res.loc)}</span>],
        ["其中：汇率折算", <span style={{ color: toneOf(res.fxc) }}>{sgn(res.fxc)}</span>, "非美元资产折回美元的影响"],
        [`相对 ${BENCH_ZH[bench] ?? bench}`, res.bench == null ? "—" : <span style={{ color: toneOf(res.pr - res.bench) }}>{sgn(res.pr - res.bench)}</span>, res.bench == null ? undefined : `基准 ${sgn(res.bench)}`],
      ]} />
      {!rows.length ? <Empty loading={book.loading} text="暂无持仓" /> : <>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2"><G title="按市场" data={res.byMkt} /><G title="按计价币种" data={res.byCcy} /></div>
        <SectionHead title="逐项贡献（百分点）" sub="按当前权重回看，不含区间内调仓" />
        <table className="w-full text-[11px]">
          <thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">币种</th><th className="text-right">权重</th><th className="text-right">本币收益</th><th className="text-right">汇率影响</th><th className="text-right">美元收益</th><th className="text-right">本币贡献</th><th className="text-right">汇率贡献</th><th className="px-2 text-right">合计贡献</th></tr></thead>
          <tbody>{res.items.map((x) => <tr key={x.r.symbol} onClick={() => pick(x.r.symbol)} className={tr}><td className="px-2 py-0.5 text-slate-100">{x.r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.r.symbol}</span></td><td className="text-slate-400">{x.r.ccy}</td><td className="text-right font-mono">{(x.r.w * 100).toFixed(1)}%</td><td className="text-right font-mono" style={{ color: toneOf(x.loc) }}>{x.loc == null ? "—" : sgn(x.loc * 100)}</td><td className="text-right font-mono" style={{ color: toneOf(x.fxEff) }}>{x.fxEff == null ? "—" : sgn(x.fxEff * 100)}</td><td className="text-right font-mono" style={{ color: toneOf(x.total) }}>{x.total == null ? "—" : sgn(x.total * 100)}</td><td className="text-right font-mono" style={{ color: toneOf(x.cLoc) }}>{sgn(x.cLoc)}</td><td className="text-right font-mono" style={{ color: toneOf(x.cFx) }}>{sgn(x.cFx)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(x.cTot), background: heat(x.cTot ?? 0, 2) }}>{sgn(x.cTot)}</td></tr>)}</tbody>
        </table>
        {pack.loading && <Note>读取历史收盘价…</Note>}
      </>}
    </PanelShell>
  );
}

/* ================================================================== PORT TS 交易模拟 */
type Trade = { symbol: string; qty: number };
export function PortTsLive({ onClose }: P) {
  const book = useBook();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const newSyms = trades.map((t) => t.symbol).filter((s) => !book.rows.some((r) => r.symbol === s));
  const t2 = useTicks(newSyms);
  const bench = book.benchmark;
  const all = [...new Set([...book.rows.slice(0, 40).map((r) => r.symbol), ...trades.map((t) => t.symbol), bench])];
  const pack = useCloses(all, 300);
  const calc = useMemo(() => {
    const fxOf = (s: string) => book.rows.find((r) => r.symbol === s)?.fx ?? 1;
    const price = (s: string) => book.rows.find((r) => r.symbol === s)?.price ?? t2[s]?.price ?? null;
    const mult = (s: string) => book.rows.find((r) => r.symbol === s)?.mult ?? 1;
    const before = new Map(book.rows.map((r) => [r.symbol, r.mv]));
    const after = new Map(before);
    let spend = 0;
    for (const t of trades) { const p = price(t.symbol); if (p == null) continue; const v = t.qty * p * mult(t.symbol) * fxOf(t.symbol); after.set(t.symbol, (after.get(t.symbol) ?? 0) + v); spend += v; }
    const syms = [...after.keys()].filter((s) => (pack.data?.[s]?.length ?? 0) > 60);
    const { m } = align(pack.data ?? null, [...syms, ...(pack.data?.[bench] ? [bench] : [])]);
    const R = syms.map((s) => { const c = m[s] ?? []; return c.slice(1).map((v, i) => v / c[i] - 1).slice(-250); });
    const bc = m[bench] ?? []; const br = bc.slice(1).map((v, i) => v / bc[i] - 1).slice(-250);
    const stat = (mv: Map<string, number>) => {
      const gross = [...mv.values()].reduce((s, v) => s + Math.abs(v), 0) || 1;
      const w = syms.map((s) => (mv.get(s) ?? 0) / gross);
      const len = R.length ? Math.min(...R.map((r) => r.length)) : 0;
      const rp = Array.from({ length: len }, (_, i) => R.reduce((s, r, k) => s + w[k] * r[r.length - len + i], 0));
      const vol = std(rp) * Math.sqrt(252) * 100;
      const b = br.slice(-len); const vb = covar(b, b);
      const top = [...mv.entries()].sort((a, c) => Math.abs(c[1]) - Math.abs(a[1]))[0];
      const hhi = [...mv.values()].reduce((s, v) => s + (v / gross) ** 2, 0);
      return { total: [...mv.values()].reduce((s, v) => s + v, 0), vol, var95: 1.645 * std(rp) * 100, beta: vb ? covar(rp, b) / vb : null, top: top ? { s: top[0], w: (Math.abs(top[1]) / gross) * 100 } : null, eff: hhi ? 1 / hhi : null };
    };
    return { b: stat(before), a: stat(after), spend, before, after, gb: [...before.values()].reduce((s, v) => s + Math.abs(v), 0) || 1, ga: [...after.values()].reduce((s, v) => s + Math.abs(v), 0) || 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, JSON.stringify(trades), JSON.stringify(book.rows.map((r) => [r.symbol, Math.round(r.mv)])), t2, bench]);
  const add = () => { const q = Number(qty); if (!sym || !Number.isFinite(q) || !q) return; setTrades((x) => [...x, { symbol: sym, qty: q }]); setSym(""); setQty(""); };
  const nameOf = (s: string) => book.rows.find((r) => r.symbol === s)?.name ?? t2[s]?.name ?? s;
  const rowsCmp = [...calc.after.keys()].map((s) => ({ s, wb: ((calc.before.get(s) ?? 0) / calc.gb) * 100, wa: ((calc.after.get(s) ?? 0) / calc.ga) * 100 })).filter((x) => Math.abs(x.wb - x.wa) > 0.01 || trades.some((t) => t.symbol === x.s)).sort((a, b) => Math.abs(b.wa - b.wb) - Math.abs(a.wa - a.wb));
  const M = ({ l, b, a, d = 2, unit = "" }: { l: string; b: number | null | undefined; a: number | null | undefined; d?: number; unit?: string }) => <tr className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-300">{l}</td><td className="text-right font-mono">{b == null ? "—" : `${b.toFixed(d)}${unit}`}</td><td className="text-right font-mono text-white">{a == null ? "—" : `${a.toFixed(d)}${unit}`}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(a != null && b != null ? a - b : null) }}>{a != null && b != null ? `${a - b > 0 ? "+" : ""}${(a - b).toFixed(d)}${unit}` : "—"}</td></tr>;
  return (
    <PanelShell code="PORT TS" title="交易模拟（下单前测算）" onClose={onClose} right={<span>正数为买入、负数为卖出 · 不会下单</span>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px]">
        <input value={sym} onChange={(e) => setSym(e.target.value.trim())} placeholder="代码，如 AAPL、sh600519、0700.HK" className="w-52 border border-[#1a2a3c] bg-[#06101b] px-1.5 py-0.5 font-mono text-slate-200 outline-none" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="数量（卖出填负数）" className="w-36 border border-[#1a2a3c] bg-[#06101b] px-1.5 py-0.5 font-mono text-slate-200 outline-none" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <Btn onClick={add} disabled={!sym || !qty}>加入模拟</Btn>
        {trades.length > 0 && <Btn onClick={() => setTrades([])}>清空</Btn>}
        {trades.map((t, i) => <span key={i} className="flex items-center gap-1 border border-[#1a2a3c] px-1.5 font-mono text-[10px]"><span style={{ color: t.qty > 0 ? "#f2495c" : "#1fbf75" }}>{t.qty > 0 ? "买" : "卖"}</span>{nameOf(t.symbol)} {Math.abs(t.qty)}<button type="button" onClick={() => setTicket(t.symbol)} className="text-sky-300 hover:underline">下单</button><button type="button" onClick={() => setTrades((x) => x.filter((_, j) => j !== i))} className="text-slate-500 hover:text-slate-200">×</button></span>)}
      </div>
      {ticket && <OrderTicket key={ticket} initial={ticket} strategy="PORT TS" />}
      <Kpis items={[["模拟成交金额", usd(calc.spend), calc.spend >= 0 ? "净买入" : "净卖出"], ["组合市值变化", usd(calc.a.total - calc.b.total)], ["年化波动变化", sgn(calc.a.vol - calc.b.vol, 2, " 个百分点")], ["日 VaR(95%) 变化", sgn(calc.a.var95 - calc.b.var95, 2, " 个百分点")]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="交易前后风险指标" sub="一年日收益、参数法 VaR" />
          <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">指标</th><th className="text-right">交易前</th><th className="text-right">交易后</th><th className="px-2 text-right">变化</th></tr></thead>
            <tbody><M l="年化波动" b={calc.b.vol} a={calc.a.vol} unit="%" /><M l="日 VaR（95%）" b={calc.b.var95} a={calc.a.var95} unit="%" /><M l={`相对 ${BENCH_ZH[bench] ?? bench} 贝塔`} b={calc.b.beta} a={calc.a.beta} /><M l="有效持仓数" b={calc.b.eff} a={calc.a.eff} d={1} /><M l="最大单一权重" b={calc.b.top?.w} a={calc.a.top?.w} d={1} unit="%" /></tbody></table></div>
        <div className="bg-[#03070c]"><SectionHead title="权重变化" />
          <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">交易前</th><th className="text-right">交易后</th><th className="px-2 text-right">变化</th></tr></thead>
            <tbody>{rowsCmp.map((x) => <tr key={x.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{nameOf(x.s)}</td><td className="text-right font-mono">{x.wb.toFixed(1)}%</td><td className="text-right font-mono text-white">{x.wa.toFixed(1)}%</td><td className="px-2 text-right font-mono" style={{ color: toneOf(x.wa - x.wb) }}>{sgn(x.wa - x.wb, 1, "")}</td></tr>)}
              {!rowsCmp.length && <tr><td colSpan={4}><Empty text="在上方输入代码与数量，查看交易对组合的影响。" /></td></tr>}</tbody></table></div>
      </div>
      {pack.loading && <Note>读取历史收盘价…</Note>}
    </PanelShell>
  );
}

/* ================================================================== NL 持仓新闻情绪 */
type UcNews = { id: string; title: string; summary: string | null; url: string | null; time: number; tone: 1 | 0 | -1; tags: string[] };
export function PortNewsLive({ onClose }: P) {
  const book = useBook();
  const rows = book.rows.slice(0, 12);
  const key = rows.map((r) => `${r.symbol}~${r.name}`).join("|");
  const [data, setData] = useState<Record<string, UcNews[]>>({});
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string>("ALL");
  const [open, setOpen] = useState<News | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () => { setLoading(true); void Promise.all(key.split("|").map((x) => { const [s, nm] = x.split("~"); return ucGet<UcNews[]>("ucMarket.news", { symbol: s, name: nm && nm !== s ? nm.slice(0, 60) : undefined }).then((v) => [s, v ?? []] as const).catch(() => [s, []] as const); })).then((all) => { if (alive) { setData(Object.fromEntries(all)); setLoading(false); } }); };
    load();
    const t = setInterval(load, 300_000);
    return () => { alive = false; clearInterval(t); };
  }, [key]);
  const week = Date.now() - 7 * 86400_000;
  const stat = rows.map((r) => { const xs = (data[r.symbol] ?? []).filter((n) => n.time >= week); const pos = xs.filter((n) => n.tone > 0).length, neg = xs.filter((n) => n.tone < 0).length; return { r, n: xs.length, pos, neg, score: xs.length ? (pos - neg) / xs.length : 0 }; });
  const wScore = stat.reduce((s, x) => s + x.r.w * x.score, 0);
  const items = useMemo(() => {
    const seen = new Set<string>();
    return Object.entries(data).filter(([s]) => sel === "ALL" || s === sel).flatMap(([s, xs]) => xs.map((n) => ({ s, n }))).sort((a, b) => b.n.time - a.n.time).filter(({ n }) => { const k = n.title.slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 120);
  }, [data, sel]);
  const nameOf = (s: string) => rows.find((r) => r.symbol === s)?.name ?? s;
  return (
    <PanelShell code="NL" title="持仓新闻情绪" onClose={onClose} right={<span>{loading ? "更新中…" : "近 7 日 · 每 5 分钟刷新"}</span>}>
      <Kpis items={[["持仓相关新闻（7 日）", String(stat.reduce((s, x) => s + x.n, 0))], ["利好 / 利空", `${stat.reduce((s, x) => s + x.pos, 0)} / ${stat.reduce((s, x) => s + x.neg, 0)}`], ["市值加权情绪", <span style={{ color: toneOf(wScore) }}>{wScore.toFixed(2)}</span>, "−1 全部利空 ~ +1 全部利好"], ["情绪最弱持仓", [...stat].filter((x) => x.n).sort((a, b) => a.score - b.score)[0]?.r.name ?? "—"]]} />
      <SectionHead title="各持仓情绪" sub="点击筛选该持仓的新闻" />
      <table className="w-full text-[11px]">
        <thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">权重</th><th className="text-right">今日涨跌</th><th className="text-right">新闻数</th><th className="text-right">利好</th><th className="text-right">利空</th><th className="px-2 text-left">情绪</th></tr></thead>
        <tbody>{stat.map((x) => <tr key={x.r.symbol} onClick={() => setSel(sel === x.r.symbol ? "ALL" : x.r.symbol)} className={`${tr} ${sel === x.r.symbol ? "bg-[#0a1726]" : ""}`}><td className="px-2 py-0.5 text-slate-100">{x.r.name}</td><td className="text-right font-mono">{(x.r.w * 100).toFixed(1)}%</td><td className="text-right font-mono" style={{ color: toneOf(x.r.changePct) }}>{fmtPct(x.r.changePct)}</td><td className="text-right font-mono">{x.n}</td><td className="text-right font-mono" style={{ color: "#f2495c" }}>{x.pos}</td><td className="text-right font-mono" style={{ color: "#1fbf75" }}>{x.neg}</td><td className="px-2"><div className="relative h-2 w-28 bg-[#0a1726]"><div className="absolute left-1/2 top-0 h-2 w-px bg-slate-600" />{x.n > 0 && <div className="absolute top-0 h-2" style={{ left: x.score >= 0 ? "50%" : `${50 + x.score * 50}%`, width: `${Math.abs(x.score) * 50}%`, background: x.score >= 0 ? "#f2495c" : "#1fbf75" }} />}</div></td></tr>)}</tbody>
      </table>
      <SectionHead title={sel === "ALL" ? "全部持仓新闻" : `${nameOf(sel)} 新闻`} sub="点击在本页阅读" />
      <div>{items.map(({ s, n }) => <div key={`${s}${n.id}`} onClick={() => setOpen(toNews(n, [s]))} className="flex cursor-pointer items-start gap-2 border-t border-[#0f1b29] px-2 py-1 hover:bg-[#0a1726]"><span className="w-12 shrink-0 text-[10px] text-slate-500">{ago(n.time)}</span><span className="w-10 shrink-0 text-[10px]" style={{ color: toneColor(n.tone) }}>{TONE_LABEL[n.tone]}</span><span className="w-20 shrink-0 truncate text-[10px] text-amber-200/80">{nameOf(s)}</span><span className="text-[11px] text-slate-200">{n.title}</span></div>)}
        {!items.length && <Empty loading={loading || book.loading} text="暂无相关新闻" />}</div>
      <ReaderDrawer item={open} onClose={() => setOpen(null)} />
    </PanelShell>
  );
}

/* ================================================================== EVTS 持仓事件 */
type Anr = { symbol: string; target: number | null; high: number | null; low: number | null; buy: number | null; hold: number | null; sell: number | null; meanRating: string | null; quarterly: Array<{ period: string; eps: number | null; count: number | null; up: number | null; down: number | null }> };
type Filing = { form: string; label: string; date: string; reportDate: string | null; description: string | null };
export function PortEventsLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const us = book.rows.filter((r) => r.market === "US" && /^[A-Z.]{1,6}$/.test(r.symbol)).slice(0, 15);
  const key = us.map((r) => r.symbol).join("|");
  const [anr, setAnr] = useState<Record<string, Anr | null>>({});
  const [fil, setFil] = useState<Record<string, Filing[]>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setLoading(true);
    const ss = key.split("|");
    void Promise.all([
      Promise.all(ss.map((s) => ucGet<Anr>("ucHubs.analyst", { symbol: s }).then((v) => [s, v] as const).catch(() => [s, null] as const))),
      Promise.all(ss.map((s) => ucGet<{ filings: Filing[] }>("ucNews.filings", { symbol: s }).then((v) => [s, v?.filings ?? []] as const).catch(() => [s, [] as Filing[]] as const))),
    ]).then(([a, f]) => { if (alive) { setAnr(Object.fromEntries(a)); setFil(Object.fromEntries(f)); setLoading(false); } });
    return () => { alive = false; };
  }, [key]);
  const recent = useMemo(() => Object.entries(fil).flatMap(([s, xs]) => xs.filter((x) => /^(8-K|10-Q|10-K|4|SC 13|DEF 14A|S-|424)/.test(x.form)).slice(0, 12).map((x) => ({ s, x }))).sort((a, b) => b.x.date.localeCompare(a.x.date)).slice(0, 80), [fil]);
  const nameOf = (s: string) => us.find((r) => r.symbol === s)?.name ?? s;
  const next = us.map((r) => ({ r, a: anr[r.symbol], q: anr[r.symbol]?.quarterly?.[0] })).filter((x) => x.a);
  return (
    <PanelShell code="EVTS" title="持仓事件：业绩预期与监管申报" onClose={onClose} right={<span>{loading ? "读取中…" : `${us.length} 个美股持仓`}</span>}>
      <Kpis items={[["覆盖持仓", String(us.length), "美股持仓（有分析师与申报数据）"], ["近 30 日申报", String(recent.filter((x) => x.x.date >= new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)).length)], ["盈利预期上调家数", String(next.filter((x) => (x.q?.up ?? 0) > (x.q?.down ?? 0)).length)], ["盈利预期下调家数", String(next.filter((x) => (x.q?.down ?? 0) > (x.q?.up ?? 0)).length)]]} />
      {!us.length ? <Empty loading={book.loading} text="当前持仓中没有美股；A股、港股的公告与业绩日程请在个股页查看。" /> : <>
        <SectionHead title="下一报告期盈利预期与目标价" sub="预期调整为近期分析师上调 / 下调家数" />
        <table className="w-full text-[11px]">
          <thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">下一报告期</th><th className="text-right">每股收益预期</th><th className="text-right">分析师数</th><th className="text-right">上调 / 下调</th><th className="text-right">现价</th><th className="text-right">平均目标价</th><th className="text-right">空间</th><th className="px-2 text-left">评级（买 / 持 / 卖）</th></tr></thead>
          <tbody>{next.map(({ r, a, q }) => { const up = a?.target && r.price ? (a.target / r.price - 1) * 100 : null; return <tr key={r.symbol} onClick={() => pick(r.symbol)} className={tr}><td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td><td className="font-mono text-slate-300">{q?.period ?? "—"}</td><td className="text-right font-mono text-white">{f2(q?.eps, 2)}</td><td className="text-right font-mono text-slate-400">{q?.count ?? "—"}</td><td className="text-right font-mono"><span style={{ color: "#f2495c" }}>{q?.up ?? 0}</span> / <span style={{ color: "#1fbf75" }}>{q?.down ?? 0}</span></td><td className="text-right font-mono">{fmtPrice(r.price)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(a?.target)}</td><td className="text-right font-mono" style={{ color: toneOf(up) }}>{sgn(up, 1)}</td><td className="px-2 font-mono text-[10px] text-slate-400">{a?.buy ?? 0} / {a?.hold ?? 0} / {a?.sell ?? 0}{a?.meanRating ? ` · ${a.meanRating}` : ""}</td></tr>; })}
            {!next.length && <tr><td colSpan={9}><Empty loading={loading} text="暂无分析师数据" /></td></tr>}</tbody>
        </table>
        <SectionHead title="近期监管申报" sub="重大事项、定期报告、内部人交易、股东大会材料等" />
        <table className="w-full text-[11px]">
          <thead className={th}><tr><th className="px-2 py-1 text-left">申报日</th><th className="text-left">标的</th><th className="text-left">类型</th><th className="text-left">报告期</th><th className="px-2 text-left">说明</th></tr></thead>
          <tbody>{recent.map(({ s, x }, i) => <tr key={`${s}${i}`} onClick={() => pick(s)} className={tr}><td className="px-2 py-0.5 font-mono text-slate-400">{x.date}</td><td className="text-slate-100">{nameOf(s)}</td><td className="text-amber-200">{x.form} <span className="text-[10px] text-slate-400">{x.label}</span></td><td className="font-mono text-slate-500">{x.reportDate ?? ""}</td><td className="px-2 text-[10px] text-slate-400">{x.description ?? ""}</td></tr>)}
            {!recent.length && <tr><td colSpan={5}><Empty loading={loading} text="暂无申报" /></td></tr>}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== PREP 报告快照（含 DRPT） */
type Snap = { ts: number; note: string; total: number; day: number; rows: Array<{ s: string; n: string; w: number; mv: number; px: number | null; pnl: number | null }> };
export function PrepLive({ onClose }: P) {
  const book = useBook();
  const saved = useSaved<Snap[]>("port-reports");
  const [local, setLocal] = useState<Snap[] | null>(null);
  const snaps = local ?? saved.data ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const base = snaps.find((s) => s.ts === sel) ?? snaps[0] ?? null;
  const take = async () => {
    const snap: Snap = { ts: Date.now(), note: note.trim().slice(0, 80), total: book.total, day: book.rows.reduce((s, r) => s + r.day, 0), rows: book.rows.slice(0, 80).map((r) => ({ s: r.symbol, n: r.name, w: r.w, mv: r.mv, px: r.price, pnl: r.pnl })) };
    const next = [snap, ...snaps].slice(0, 30);
    setLocal(next); setNote(""); setMsg("保存中…");
    try { await saveItem("port-reports", next); setMsg("快照已保存"); } catch { setMsg("保存失败"); }
  };
  const remove = async (ts: number) => { const next = snaps.filter((s) => s.ts !== ts); setLocal(next); await saveItem("port-reports", next).catch(() => undefined); };
  const csv = (s: Snap) => {
    const lines = [["代码", "名称", "权重%", "市值(美元)", "价格", "浮动盈亏(美元)"], ...s.rows.map((r) => [r.s, r.n, (r.w * 100).toFixed(2), r.mv.toFixed(2), r.px ?? "", r.pnl?.toFixed(2) ?? ""])];
    const blob = new Blob(["﻿" + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `组合快照_${new Date(s.ts).toLocaleDateString("sv-SE")}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const diff = useMemo(() => {
    if (!base) return [];
    const now = new Map(book.rows.map((r) => [r.symbol, r]));
    const then = new Map(base.rows.map((r) => [r.s, r]));
    return [...new Set([...now.keys(), ...then.keys()])].map((s) => { const a = then.get(s), b = now.get(s); const pxCh = a?.px && b?.price ? (b.price / a.px - 1) * 100 : null; return { s, n: b?.name ?? a?.n ?? s, w0: (a?.w ?? 0) * 100, w1: (b?.w ?? 0) * 100, mv0: a?.mv ?? 0, mv1: b?.mv ?? 0, pxCh, st: !a ? "新增" : !b ? "已移出" : "" }; }).sort((x, y) => Math.abs(y.w1 - y.w0) - Math.abs(x.w1 - x.w0));
  }, [base, book.rows]);
  const nowSnap: Snap = { ts: Date.now(), note: "当前", total: book.total, day: 0, rows: book.rows.map((r) => ({ s: r.symbol, n: r.name, w: r.w, mv: r.mv, px: r.price, pnl: r.pnl })) };
  const chg = base ? book.total - base.total : null;
  return (
    <PanelShell code="PREP" title="组合报告快照" onClose={onClose} right={<span>快照永久保存在平台，可随时与当前组合对比</span>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px]">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="快照备注（可选），如“月末复盘”" className="w-60 border border-[#1a2a3c] bg-[#06101b] px-1.5 py-0.5 text-slate-200 outline-none" />
        <Btn onClick={() => void take()} disabled={!book.rows.length}>生成当前快照</Btn>
        <Btn onClick={() => csv(nowSnap)} disabled={!book.rows.length}>导出当前持仓 CSV</Btn>
        {msg && <span className="text-amber-200">{msg}</span>}
      </div>
      <Kpis items={[["已保存快照", String(snaps.length)], ["对比基准快照", base ? new Date(base.ts).toLocaleString("zh-CN", { hour12: false }) : "—", base?.note || undefined], ["市值变化（美元）", chg == null ? "—" : <span style={{ color: toneOf(chg) }}>{usd(chg)}</span>, base && base.total ? sgn((chg! / base.total) * 100) : undefined], ["持仓变动", base ? `新增 ${diff.filter((d) => d.st === "新增").length} · 移出 ${diff.filter((d) => d.st === "已移出").length}` : "—"]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[0.8fr_1.4fr]">
        <div className="bg-[#03070c]"><SectionHead title="快照列表" sub="点击选为对比基准" />
          <table className="w-full text-[11px]"><tbody>{snaps.map((s) => <tr key={s.ts} onClick={() => setSel(s.ts)} className={`${tr} ${base?.ts === s.ts ? "bg-[#0a1726]" : ""}`}><td className="px-2 py-0.5 font-mono text-slate-300">{new Date(s.ts).toLocaleString("zh-CN", { hour12: false, year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td className="text-slate-400">{s.note}</td><td className="text-right font-mono">{usd(s.total)}</td><td className="text-right font-mono text-slate-500">{s.rows.length} 项</td><td className="px-2 text-right"><button type="button" onClick={(e) => { e.stopPropagation(); csv(s); }} className="text-sky-300 hover:underline">CSV</button><button type="button" onClick={(e) => { e.stopPropagation(); void remove(s.ts); }} className="ml-2 text-slate-500 hover:text-slate-200">删除</button></td></tr>)}
            {!snaps.length && <tr><td><Empty loading={saved.loading} text="还没有快照：点击“生成当前快照”保存一份。" /></td></tr>}</tbody></table></div>
        <div className="bg-[#03070c]"><SectionHead title="快照 → 当前：持仓变化" sub="按权重变化幅度排序；价格变化为快照时价格到现价" />
          <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">快照权重</th><th className="text-right">当前权重</th><th className="text-right">权重变化</th><th className="text-right">价格变化</th><th className="text-right">市值变化</th><th className="px-2 text-left">状态</th></tr></thead>
            <tbody>{diff.map((d) => <tr key={d.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{d.n}</td><td className="text-right font-mono text-slate-400">{d.w0.toFixed(1)}%</td><td className="text-right font-mono text-white">{d.w1.toFixed(1)}%</td><td className="text-right font-mono" style={{ color: toneOf(d.w1 - d.w0) }}>{sgn(d.w1 - d.w0, 1, "")}</td><td className="text-right font-mono" style={{ color: toneOf(d.pxCh) }}>{sgn(d.pxCh)}</td><td className="text-right font-mono" style={{ color: toneOf(d.mv1 - d.mv0) }}>{fmtCompact(d.mv1 - d.mv0)}</td><td className="px-2 text-amber-200">{d.st}</td></tr>)}
              {!diff.length && <tr><td colSpan={7}><Empty text="选择一个快照后显示变化" /></td></tr>}</tbody></table></div>
      </div>
    </PanelShell>
  );
}
