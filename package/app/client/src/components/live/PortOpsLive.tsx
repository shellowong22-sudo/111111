/**
 * 组合管理分组 6 个小窗：组合总览（PORT）、风险价值与波动（PORT VR）、情景分析（PORT SA）、审计日志、集成监控、系统维护。
 * 持仓 = 平台自有交易系统的实时持仓 + 组合页保存的持仓；风险与情景全部由真实日线实时计算；
 * 审计日志来自交易系统永久入库的委托 / 成交 / 撤单流水；集成监控与系统维护读取平台真实运行指标。
 */
import { useEffect, useMemo, useState } from "react";
import { DOWN, UP, fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, f2, heat, mean, perf, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, VirtualRows, ownerId } from "@/uc/panels/kit";
import { KIND_ZH, MARKET_ZH, STATUS_ZH, fmtTs, useEvents, useFills, useOrders, usePositions, useSummary } from "@/uc/trade/kit";

type P = { onClose?: () => void };
export type Holding = { symbol: string; qty: number; cost: number };
export type Pf = { holdings: Holding[]; benchmark: string; cash: number };
/** 与组合页一致的默认持仓（用户未在组合页保存、交易账户也无持仓时使用） */
const DEFAULT_PF: Pf = { holdings: [{ symbol: "AAPL", qty: 50, cost: 300 }, { symbol: "NVDA", qty: 40, cost: 200 }, { symbol: "TLT", qty: 60, cost: 90 }, { symbol: "GLD", qty: 20, cost: 380 }, { symbol: "0700.HK", qty: 100, cost: 400 }], benchmark: "^GSPC", cash: 0 };
export const BENCH_ZH: Record<string, string> = { "^GSPC": "标普 500", "^NDX": "纳斯达克 100", "^DJI": "道琼斯", sh000300: "沪深 300", sh000001: "上证指数", SPY: "标普 500 ETF" };

const ccyOf = (s: string) => (/^(sh|sz|bj)\d/.test(s) ? "CNY" : /\.HK$/i.test(s) ? "HKD" : /\.T$/i.test(s) ? "JPY" : "USD");
const mktOf = (s: string) => (/^(sh|sz|bj)\d/.test(s) ? "CN" : /\.HK$/i.test(s) ? "HK" : /^\^|=F$|^[A-Z]{6}$|^(CL|GC|SI|HG|NG|ZN|ZT|ES|NQ|YM|RTY|BRENT|BTC|ETH)$/.test(s) ? "FUT" : /\.[A-Z]+$/i.test(s) ? "INTL" : "US");
const FX = ["USDCNH", "USDHKD", "USDJPY"];

export type BookRow = { symbol: string; name: string; src: string; qty: number; avgCost: number; ccy: string; market: string; mult: number; price: number | null; changePct: number | null; fx: number; mv: number; day: number; pnl: number | null; w: number };

/** 合并后的组合（统一折算美元） */
export function useBook() {
  const pos = usePositions();
  const pf = usePolled<Pf | null>("ucHubs.portfolio", { owner: ownerId() }, 120_000);
  const savedLoaded = !pf.loading;
  const trade = (pos.data?.rows ?? []).filter((r) => Math.abs(r.qty) > 1e-9);
  const saved = pf.data?.holdings?.length ? pf.data.holdings : savedLoaded && !trade.length ? DEFAULT_PF.holdings : [];
  const isDefault = savedLoaded && !pf.data?.holdings?.length && !trade.length;
  const base = useMemo(() => {
    const m = new Map<string, { symbol: string; name: string; src: Set<string>; qty: number; cost: number; ccy: string; market: string; mult: number; last: number | null }>();
    for (const p of trade) {
      const mult = p.marketValue && p.last && p.qty ? Math.abs(p.marketValue / (p.qty * p.last)) : 1;
      const e = m.get(p.symbol) ?? { symbol: p.symbol, name: p.name ?? p.symbol, src: new Set(), qty: 0, cost: 0, ccy: p.ccy || ccyOf(p.symbol), market: p.market || mktOf(p.symbol), mult, last: p.last };
      e.src.add("交易账户"); e.qty += p.qty; e.cost += p.qty * p.avgCost; m.set(p.symbol, e);
    }
    for (const h of saved) {
      const e = m.get(h.symbol) ?? { symbol: h.symbol, name: h.symbol, src: new Set(), qty: 0, cost: 0, ccy: ccyOf(h.symbol), market: mktOf(h.symbol), mult: 1, last: null };
      e.src.add(isDefault ? "默认持仓" : "组合页"); e.qty += h.qty; e.cost += h.qty * h.cost; m.set(h.symbol, e);
    }
    return [...m.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(trade.map((p) => [p.symbol, p.qty, p.avgCost, p.marketValue && p.last ? 1 : 0])), JSON.stringify(saved), isDefault]);
  const syms = base.map((b) => b.symbol);
  const ticks = useTicks([...syms, ...FX]);
  const fxOf = (ccy: string) => { const k = ccy === "CNY" || ccy === "CNH" ? "USDCNH" : ccy === "HKD" ? "USDHKD" : ccy === "JPY" ? "USDJPY" : null; if (!k) return 1; const v = ticks[k]?.price; return v ? 1 / v : NaN; };
  const rows0 = base.map((b) => {
    const t = ticks[b.symbol];
    const price = t?.price ?? b.last;
    const fx = fxOf(b.ccy);
    const mv = price != null ? b.qty * price * b.mult * fx : 0;
    const day = t?.change != null ? b.qty * t.change * b.mult * fx : 0;
    const avgCost = b.qty ? b.cost / b.qty : 0;
    return { symbol: b.symbol, name: t?.name ?? b.name, src: [...b.src].join(" + "), qty: b.qty, avgCost, ccy: b.ccy, market: b.market, mult: b.mult, price, changePct: t?.changePct ?? null, fx, mv: Number.isFinite(mv) ? mv : 0, day: Number.isFinite(day) ? day : 0, pnl: price != null && avgCost ? b.qty * (price - avgCost) * b.mult * fx : null, w: 0 };
  });
  const gross = rows0.reduce((a, r) => a + Math.abs(r.mv), 0);
  const rows: BookRow[] = rows0.map((r) => ({ ...r, w: gross ? r.mv / gross : 0 })).sort((a, b) => Math.abs(b.mv) - Math.abs(a.mv));
  const total = rows.reduce((a, r) => a + r.mv, 0);
  return { rows, total, gross, benchmark: pf.data?.benchmark || "^GSPC", cash: pf.data?.cash ?? 0, isDefault, loading: pos.loading || pf.loading, ticks };
}

/** 持仓日收益矩阵 + 当前权重下的组合日收益（简单收益） */
export function useBookReturns(book: ReturnType<typeof useBook>, days: number, extra: string[] = []) {
  const top = book.rows.filter((r) => r.mv).slice(0, 50);
  const syms = top.map((r) => r.symbol);
  const all = [...new Set([...syms, ...extra])];
  const pack = useCloses(all, days);
  return useMemo(() => {
    const ok = all.filter((s) => (pack.data?.[s]?.length ?? 0) > 30);
    const { dates, m } = align(pack.data ?? null, ok);
    const have = top.filter((r) => (m[r.symbol]?.length ?? 0) > 30);
    const g = have.reduce((a, r) => a + Math.abs(r.mv), 0) || 1;
    const w = have.map((r) => r.mv / g);
    const R = have.map((r) => { const c = m[r.symbol]; return c.slice(1).map((v, i) => v / c[i] - 1); });
    const n = R.length ? Math.min(...R.map((x) => x.length)) : 0;
    const rp = Array.from({ length: n }, (_, t) => R.reduce((a, r, i) => a + w[i] * r[r.length - n + t], 0));
    const coverage = book.gross ? have.reduce((a, r) => a + Math.abs(r.mv), 0) / book.gross : 0;
    return { dates: dates.slice(-n), m, have, w, R: R.map((r) => r.slice(-n)), rp, coverage, loading: pack.loading };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, JSON.stringify(top.map((r) => [r.symbol, Math.round(r.mv)]))]);
}

export const usd = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `$${fmtCompact(v)}`);
export const pctile = (a: number[], q: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const i = Math.max(0, Math.min(s.length - 1, Math.floor(q * (s.length - 1)))); return s[i]; };
export const covar = (a: number[], b: number[]) => { const n = Math.min(a.length, b.length); if (n < 3) return 0; const x = a.slice(-n), y = b.slice(-n); const mx = mean(x), my = mean(y); let s = 0; for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my); return s / (n - 1); };
const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
const th = "text-[10px] text-slate-500";

/* ================================================================== PORT 组合总览 */
export function PortOverviewLive({ onClose }: P) {
  const [tab, setTab] = useState("hold");
  const book = useBook();
  const sum = useSummary();
  const { pick } = useHub();
  const bench = book.benchmark;
  const R = useBookReturns(book, 400, [bench]);
  const s = sum.data;
  const nav = useMemo(() => { let v = 1; return R.rp.map((x) => (v *= 1 + x)); }, [R.rp]);
  const bc = (R.m[bench] ?? []).slice(-(nav.length + 1));
  const bnav = bc.length > 1 ? bc.slice(1).map((v) => v / bc[0]) : [];
  const navFull = [1, ...nav];
  const byMkt = Object.entries(book.rows.reduce<Record<string, number>>((a, r) => { a[r.market] = (a[r.market] ?? 0) + r.mv; return a; }, {})).map(([k, v]) => ({ k: MARKET_ZH[k] ?? k, v }));
  const byCcy = Object.entries(book.rows.reduce<Record<string, number>>((a, r) => { a[r.ccy] = (a[r.ccy] ?? 0) + r.mv; return a; }, {})).map(([k, v]) => ({ k, v }));
  const hhi = book.rows.reduce((a, r) => a + r.w * r.w, 0);
  const top5 = book.rows.slice(0, 5).reduce((a, r) => a + Math.abs(r.w), 0);
  const dayTot = book.rows.reduce((a, r) => a + r.day, 0);
  const pnlTot = book.rows.reduce((a, r) => a + (r.pnl ?? 0), 0);
  return (
    <PanelShell code="PORT" title="组合总览" onClose={onClose} tabs={[["hold", "持仓明细"], ["perf", "净值与基准"], ["mix", "结构与集中度"]]} tab={tab} setTab={setTab} right={<span>{book.rows.length} 个持仓 · 统一折算美元</span>}>
      <Kpis items={[["持仓总市值", usd(book.total), `${book.rows.length} 项`], ["今日盈亏", <span style={{ color: toneOf(dayTot) }}>{usd(dayTot)}</span>, book.total ? sgn((dayTot / (book.total - dayTot)) * 100) : undefined], ["持仓浮动盈亏", <span style={{ color: toneOf(pnlTot) }}>{usd(pnlTot)}</span>, "按持仓成本"], ["交易账户权益", s ? fmtCompact(s.equity) : "—", s ? `收益率 ${sgn(s.returnPct)} · 现金 ${fmtCompact(s.cash)}` : undefined]]} />
      {book.isDefault && <Note>当前交易账户无持仓、组合页也未保存持仓，以下显示组合页默认持仓；在组合页保存或在交易系统成交后自动替换。</Note>}
      {tab === "hold" && <>
        <SectionHead title="持仓明细（实时）" sub="交易账户与组合页持仓按标的合并" />
        <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">市场</th><th className="text-left">来源</th><th className="text-right">数量</th><th className="text-right">成本</th><th className="text-right">现价</th><th className="text-right">涨跌幅</th><th className="text-right">市值($)</th><th className="text-right">权重</th><th className="text-right">浮盈($)</th><th className="px-2 text-right">今日($)</th></tr></thead>
          <tbody>{book.rows.map((r) => <tr key={r.symbol} onClick={() => pick(r.symbol)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td><td className="text-slate-400">{MARKET_ZH[r.market] ?? r.market}</td><td className="text-[10px] text-slate-500">{r.src}</td><td className="text-right font-mono text-slate-200">{r.qty}</td><td className="text-right font-mono text-slate-400">{fmtPrice(r.avgCost)}</td><td className="text-right font-mono text-white">{fmtPrice(r.price)}</td><td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className="text-right font-mono text-slate-200">{fmtCompact(r.mv)}</td><td className="text-right font-mono" style={{ background: heat(r.w * 100, 40) }}>{(r.w * 100).toFixed(1)}%</td><td className="text-right font-mono" style={{ color: toneOf(r.pnl) }}>{fmtCompact(r.pnl)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(r.day) }}>{fmtCompact(r.day)}</td></tr>)}
            {!book.rows.length && <tr><td colSpan={11}><Empty loading={book.loading} /></td></tr>}</tbody></table>
      </>}
      {tab === "perf" && <>
        <SectionHead title={`当前持仓一年回放 vs ${BENCH_ZH[bench] ?? bench}`} sub="按当前权重回放过去一年日线，衡量这组持仓本身的表现" />
        {nav.length > 20 ? <>
          <Lines series={[{ name: "当前持仓", color: "#fbbf24", values: navFull.map((v) => v * 100) }, { name: BENCH_ZH[bench] ?? bench, color: "#94a3b8", values: bc.map((v) => (v / bc[0]) * 100) }]} xLabels={R.dates.slice(-navFull.length).map((d) => d.slice(2))} height={200} fmt={(v) => v.toFixed(1)} />
          <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">区间</th><th className="text-right">持仓组合</th><th className="text-right">基准</th><th className="px-2 text-right">超额</th></tr></thead>
            <tbody>{([[5, "1 周"], [21, "1 月"], [63, "3 月"], [126, "6 月"], [Math.min(252, nav.length), "1 年"]] as Array<[number, string]>).map(([n, l]) => { const a = perf(navFull, n), b = perf([1, ...bnav], n); return <tr key={l} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-300">{l}</td><td className="text-right font-mono" style={{ color: toneOf(a) }}>{sgn(a)}</td><td className="text-right font-mono" style={{ color: toneOf(b) }}>{sgn(b)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(a != null && b != null ? a - b : null) }}>{a != null && b != null ? sgn(a - b) : "—"}</td></tr>; })}</tbody></table>
          <Note>数据覆盖持仓市值的 {(R.coverage * 100).toFixed(0)}%；回放不含交易成本与历史调仓。</Note>
        </> : <Empty loading={R.loading || book.loading} text="持仓历史数据不足" />}
      </>}
      {tab === "mix" && <>
        <Kpis items={[["前五大权重", `${(top5 * 100).toFixed(1)}%`], ["赫芬达尔指数", hhi.toFixed(3)], ["有效持仓数", hhi ? (1 / hhi).toFixed(1) : "—", "1 / HHI"], ["最大单一持仓", book.rows[0] ? `${(book.rows[0].w * 100).toFixed(1)}%` : "—", book.rows[0]?.name]]} />
        <SectionHead title="按市场分布（美元市值）" />
        <Bars data={byMkt} fmt={(v) => `$${fmtCompact(v)}`} height={120} />
        <SectionHead title="按币种分布（美元市值）" />
        <Bars data={byCcy} fmt={(v) => `$${fmtCompact(v)}`} height={110} />
        <SectionHead title="权重排序" />
        <Bars data={book.rows.slice(0, 15).map((r) => ({ k: r.name.slice(0, 8), v: r.w * 100 }))} fmt={(v) => `${v.toFixed(1)}%`} height={130} />
      </>}
    </PanelShell>
  );
}

/* ================================================================== PORT VR 风险价值与波动 */
export function PortVaRLive({ onClose }: P) {
  const [win, setWin] = useState("500");
  const [conf, setConf] = useState("95");
  const book = useBook();
  const R = useBookReturns(book, 780, []);
  const n = Math.min(Number(win), R.rp.length);
  const rp = R.rp.slice(-n);
  const q = conf === "99" ? 0.01 : 0.05;
  const z = conf === "99" ? 2.326 : 1.645;
  const v = book.total;
  const res = useMemo(() => {
    if (rp.length < 60) return null;
    const hv = -(pctile(rp, q) ?? 0);
    const tail = rp.filter((x) => x <= -hv);
    const es = tail.length ? -mean(tail) : hv;
    const sd = std(rp);
    const pv = z * sd - mean(rp);
    let ew = rp.slice(0, 20).reduce((a, x) => a + x * x, 0) / 20;
    for (const x of rp.slice(20)) ew = 0.94 * ew + 0.06 * x * x;
    const ewSd = Math.sqrt(ew);
    const varP = sd * sd;
    const comps = R.have.map((h, i) => { const ri = R.R[i].slice(-n); const c = covar(ri, rp); const beta = varP ? c / varP : 0; return { h, w: R.w[i], vol: std(ri) * Math.sqrt(252) * 100, beta, contrib: varP ? (R.w[i] * c) / varP : 0, standalone: -(pctile(ri, q) ?? 0) }; }).sort((a, b) => b.contrib - a.contrib);
    // 回测：滚动 250 日历史 VaR 的突破次数（最近 250 日）
    const bt: Array<{ r: number; var: number }> = [];
    for (let i = Math.max(250, R.rp.length - 250); i < R.rp.length; i++) bt.push({ r: R.rp[i], var: -(pctile(R.rp.slice(i - 250, i), q) ?? 0) });
    const breaches = bt.filter((x) => x.r < -x.var).length;
    const rollVol: number[] = []; for (let i = 60; i <= R.rp.length; i++) rollVol.push(std(R.rp.slice(i - 60, i)) * Math.sqrt(252) * 100);
    const hist = Array.from({ length: 21 }, (_, k) => -0.05 + k * 0.005);
    const bins = hist.map((lo, k) => ({ k: `${(lo * 100).toFixed(1)}`, v: rp.filter((x) => (k === 0 ? x < lo + 0.005 : k === 20 ? x >= lo : x >= lo && x < lo + 0.005)).length }));
    const worst = rp.map((x, i) => ({ x, d: R.dates[R.dates.length - n + i] })).sort((a, b) => a.x - b.x).slice(0, 8);
    return { hv, es, pv, ewSd, sd, comps, bt, breaches, rollVol, bins, worst };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R, n, q]);
  const exp = Math.round(250 * q * 10) / 10;
  return (
    <PanelShell code="PORT VR" title="风险价值与波动" onClose={onClose} right={<span className="flex items-center gap-2"><Seg value={conf} onChange={setConf} options={[["95", "95%"], ["99", "99%"]]} /><Seg value={win} onChange={setWin} options={[["250", "1 年样本"], ["500", "2 年样本"], ["750", "3 年样本"]]} /></span>}>
      {res ? <>
        <Kpis items={[[`1 日历史 VaR（${conf}%）`, usd(res.hv * v), `${(res.hv * 100).toFixed(2)}%`], [`1 日条件 VaR（ES）`, usd(res.es * v), `${(res.es * 100).toFixed(2)}%`], [`参数法 VaR（${conf}%）`, usd(res.pv * v), `10 日 ${usd(res.pv * Math.sqrt(10) * v)}`], ["年化波动（样本 / EWMA）", `${(res.sd * Math.sqrt(252) * 100).toFixed(1)}%`, `EWMA λ=0.94：${(res.ewSd * Math.sqrt(252) * 100).toFixed(1)}%`]]} />
        <SectionHead title="风险贡献分解" sub="合计为 100%" />
        <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">权重</th><th className="text-right">年化波动</th><th className="text-right">对组合贝塔</th><th className="text-right">单独 VaR</th><th className="text-right">风险贡献</th><th className="px-2 text-right">贡献 / 权重</th></tr></thead>
          <tbody>{res.comps.map((c) => <tr key={c.h.symbol} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{c.h.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{c.h.symbol}</span></td><td className="text-right font-mono text-slate-300">{(c.w * 100).toFixed(1)}%</td><td className="text-right font-mono text-slate-300">{c.vol.toFixed(1)}%</td><td className="text-right font-mono text-slate-200">{c.beta.toFixed(2)}</td><td className="text-right font-mono text-slate-400">{(c.standalone * 100).toFixed(2)}%</td><td className="text-right font-mono text-white" style={{ background: heat(c.contrib * 100, 40) }}>{(c.contrib * 100).toFixed(1)}%</td><td className="px-2 text-right font-mono" style={{ color: c.w && c.contrib / c.w > 1.2 ? UP : c.w && c.contrib / c.w < 0.8 ? DOWN : "#cbd5e1" }}>{c.w ? (c.contrib / c.w).toFixed(2) : "—"}</td></tr>)}</tbody></table>
        <SectionHead title="VaR 回测（最近 250 日，滚动一年历史 VaR）" sub={`突破 ${res.breaches} 次 · 理论期望 ${exp} 次 · ${res.breaches > exp * 2 ? "模型低估风险" : res.breaches < exp / 2 ? "模型偏保守" : "处于合理区间"}`} />
        <Lines zero series={[{ name: "组合日收益 %", color: "#38bdf8", values: res.bt.map((x) => x.r * 100) }, { name: `−VaR ${conf}%`, color: "#f2495c", values: res.bt.map((x) => -x.var * 100), dash: true }]} xLabels={R.dates.slice(-res.bt.length).map((d) => d.slice(2))} height={160} />
        <SectionHead title="60 日滚动年化波动（%）" />
        <Lines series={[{ name: "组合", color: "#fbbf24", values: res.rollVol }]} xLabels={R.dates.slice(-res.rollVol.length).map((d) => d.slice(2))} height={120} fmt={(x) => x.toFixed(1)} />
        <SectionHead title="日收益分布（样本期，%）" />
        <Bars data={res.bins} fmt={(x) => x.toFixed(0)} height={110} />
        <SectionHead title="样本期最差 8 个交易日" />
        <table className="w-full text-[11px]"><tbody>{res.worst.map((w) => <tr key={w.d} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{w.d}</td><td className="text-right font-mono" style={{ color: DOWN }}>{sgn(w.x * 100)}</td><td className="px-2 text-right font-mono text-slate-300">{usd(w.x * v)}</td></tr>)}</tbody></table>
        <Note>按当前持仓权重回放真实日线计算；数据覆盖持仓市值的 {(R.coverage * 100).toFixed(0)}%。</Note>
      </> : <Empty loading={R.loading || book.loading} text="持仓历史数据不足 60 个交易日" />}
    </PanelShell>
  );
}

/* ================================================================== PORT SA 情景分析 */
const HIST_SC: Array<[string, string, string, string]> = [
  ["covid", "新冠冲击", "2020-02-19", "2020-03-23"],
  ["hike22", "2022 加息熊市", "2022-01-03", "2022-10-12"],
  ["q418", "2018 四季度抛售", "2018-10-03", "2018-12-24"],
  ["svb", "硅谷银行事件", "2023-03-08", "2023-03-17"],
  ["carry", "日元套息平仓", "2024-07-16", "2024-08-05"],
  ["tariff", "2025 关税冲击", "2025-04-02", "2025-04-08"],
];
const FACTORS: Array<[string, string]> = [["SPY", "美股"], ["sh000300", "A股"], ["TLT", "美债长端"], ["GLD", "黄金"], ["USO", "原油"], ["UUP", "美元"]];
const PRESETS: Array<[string, number[]]> = [["美股回调 −10%", [-10, -4, 2, 1, -3, 1]], ["利率急升", [-5, -2, -8, -3, 0, 2]], ["滞胀", [-8, -5, -5, 4, 20, 1]], ["风险偏好回升", [6, 5, -1, -2, 3, -1]], ["中国资产重估", [0, 12, 0, 1, 2, -2]], ["美元走强 / 新兴承压", [-3, -6, 1, -4, -5, 4]]];
function closeAt(series: Array<[number, number]> | undefined, iso: string) {
  if (!series?.length) return null;
  const t = Date.parse(`${iso}T23:59:59Z`);
  let v: number | null = null;
  for (const [ts, c] of series) { if (ts <= t) v = c; else break; }
  return v != null && series[0][0] <= t - 3 * 86400e3 ? v : null;
}
function ols(y: number[], X: number[][]) {
  const n = Math.min(y.length, ...X.map((x) => x.length)); const k = X.length + 1;
  if (n < 60) return null;
  const A = Array.from({ length: k }, () => new Array(k).fill(0)), b = new Array(k).fill(0);
  for (let t = 0; t < n; t++) { const row = [1, ...X.map((x) => x[x.length - n + t])]; const yt = y[y.length - n + t]; for (let i = 0; i < k; i++) { b[i] += row[i] * yt; for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j]; } }
  for (let i = 0; i < k; i++) A[i][i] += 1e-9;
  for (let i = 0; i < k; i++) { let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let r = i + 1; r < k; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < k; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
  const beta = new Array(k).fill(0); for (let i = k - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < k; c++) s -= A[i][c] * beta[c]; beta[i] = s / A[i][i]; }
  return beta.slice(1);
}
export function PortScenarioLive({ onClose }: P) {
  const [tab, setTab] = useState("hist");
  const [shock, setShock] = useState<number[]>(PRESETS[0][1]);
  const book = useBook();
  const syms = book.rows.filter((r) => r.mv).slice(0, 50).map((r) => r.symbol);
  const longPack = useCloses(tab === "hist" ? syms : [], 2200);
  const fsyms = FACTORS.map(([s]) => s);
  const R = useBookReturns(book, tab === "fac" ? 300 : 30, tab === "fac" ? fsyms : []);
  const hist = useMemo(() => HIST_SC.map(([id, name, a, b]) => {
    let pnl = 0, cov = 0; const per: Array<{ s: string; r: number | null }> = [];
    for (const r of book.rows) { const p0 = closeAt(longPack.data?.[r.symbol], a), p1 = closeAt(longPack.data?.[r.symbol], b); const ret = p0 && p1 ? p1 / p0 - 1 : null; per.push({ s: r.symbol, r: ret }); if (ret != null) { pnl += r.mv * ret; cov += Math.abs(r.mv); } }
    return { id, name, a, b, pnl, pct: cov ? pnl / cov : null, coverage: book.gross ? cov / book.gross : 0, per };
  }), [longPack.data, book.rows]);
  const fac = useMemo(() => {
    if (tab !== "fac") return null;
    const FRall = fsyms.map((s) => { const c = R.m[s] ?? []; return c.slice(1).map((v, i) => v / c[i] - 1).slice(-252); });
    const idx = FRall.map((x, j) => (x.length >= 60 ? j : -1)).filter((j) => j >= 0);
    if (!idx.length || !R.have.length) return null;
    const FR = idx.map((j) => FRall[j]);
    return R.have.map((h, i) => { const b = ols(R.R[i].slice(-252), FR); return { h, w: R.w[i], beta: b ? fsyms.map((_, j) => (idx.includes(j) ? b[idx.indexOf(j)] : 0)) : null }; });
  }, [R, tab]);
  const impact = fac?.map((f) => { const r = f.beta ? f.beta.reduce((a, b, j) => a + b * shock[j], 0) : null; return { ...f, r, pnl: r != null ? (f.h.mv * r) / 100 : null }; }) ?? [];
  const totFac = impact.reduce((a, x) => a + (x.pnl ?? 0), 0);
  return (
    <PanelShell code="PORT SA" title="情景分析" onClose={onClose} tabs={[["hist", "历史情景重演"], ["fac", "因子冲击模拟"]]} tab={tab} setTab={setTab} right={<span>组合市值 {usd(book.total)}</span>}>
      {tab === "hist" && <>
        <SectionHead title="把当前持仓放回历史危机区间" sub="每个持仓按该区间的真实价格变动计算，无数据的持仓（当时未上市）不计入" />
        {longPack.data ? <>
          <Bars data={hist.filter((h) => h.pct != null).map((h) => ({ k: h.name, v: h.pct! * 100 }))} fmt={(x) => `${x.toFixed(1)}%`} height={140} />
          <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">情景</th><th className="text-left">区间</th><th className="text-right">组合损益($)</th><th className="text-right">收益率</th><th className="text-right">覆盖</th><th className="px-2 text-left">最差持仓</th></tr></thead>
            <tbody>{hist.map((h) => { const w = h.per.filter((x) => x.r != null).sort((a, b) => a.r! - b.r!)[0]; return <tr key={h.id} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{h.name}</td><td className="font-mono text-[10px] text-slate-500">{h.a} → {h.b}</td><td className="text-right font-mono" style={{ color: toneOf(h.pnl) }}>{fmtCompact(h.pnl)}</td><td className="text-right font-mono" style={{ color: toneOf(h.pct) }}>{h.pct == null ? "—" : sgn(h.pct * 100)}</td><td className="text-right font-mono text-slate-400">{(h.coverage * 100).toFixed(0)}%</td><td className="px-2 text-[10px] text-slate-400">{w ? `${w.s} ${sgn(w.r! * 100, 1)}` : "—"}</td></tr>; })}</tbody></table>
          <SectionHead title="各持仓在各情景中的涨跌（%）" />
          <div className="overflow-x-auto"><table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">标的</th>{hist.map((h) => <th key={h.id} className="text-right">{h.name}</th>)}</tr></thead>
            <tbody>{book.rows.map((r, i) => <tr key={r.symbol} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{r.name}</td>{hist.map((h) => { const x = h.per[i]?.r; return <td key={h.id} className="text-right font-mono" style={{ background: heat(x != null ? x * 100 : null, 30) }}>{x == null ? "—" : sgn(x * 100, 1, "")}</td>; })}</tr>)}</tbody></table></div>
        </> : <Empty loading={longPack.loading || book.loading} />}
      </>}
      {tab === "fac" && <>
        <div className="flex flex-wrap gap-1 px-2 py-1">{PRESETS.map(([l, v]) => <button key={l} type="button" onClick={() => setShock(v)} className={`border px-1.5 text-[10px] ${JSON.stringify(shock) === JSON.stringify(v) ? "border-cyan-500 text-cyan-200" : "border-[#1d3047] text-slate-400 hover:text-white"}`}>{l}</button>)}</div>
        <div className="flex flex-wrap gap-3 px-2 py-1 text-[11px] text-slate-400">{FACTORS.map(([s, l], j) => <label key={s}>{l} % <input type="number" step={0.5} value={shock[j]} onChange={(e) => setShock((x) => x.map((y, k) => (k === j ? Number(e.target.value) || 0 : y)))} className="w-14 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-white" /></label>)}</div>
        {fac ? <>
          <Kpis items={[["情景下组合损益", <span style={{ color: toneOf(totFac) }}>{usd(totFac)}</span>], ["组合收益率", <span style={{ color: toneOf(totFac) }}>{book.gross ? sgn((totFac / book.gross) * 100) : "—"}</span>], ["受冲击最大", impact.slice().sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0))[0]?.h.name ?? "—"], ["数据覆盖", `${(R.coverage * 100).toFixed(0)}%`]]} />
          <SectionHead title="各持仓的因子暴露与情景损益" />
          <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">标的</th>{FACTORS.map(([, l]) => <th key={l} className="text-right">{l}β</th>)}<th className="text-right">情景涨跌</th><th className="px-2 text-right">损益($)</th></tr></thead>
            <tbody>{impact.map((x) => <tr key={x.h.symbol} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{x.h.name}</td>{FACTORS.map((_, j) => <td key={j} className="text-right font-mono" style={{ background: heat(x.beta?.[j] ?? null, 1.5) }}>{f2(x.beta?.[j], 2)}</td>)}<td className="text-right font-mono" style={{ color: toneOf(x.r) }}>{sgn(x.r, 1)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(x.pnl) }}>{fmtCompact(x.pnl)}</td></tr>)}</tbody></table>
          <Bars data={impact.map((x) => ({ k: x.h.name.slice(0, 8), v: x.pnl ?? 0 }))} fmt={(x) => `$${fmtCompact(x)}`} height={120} />
        </> : <Empty loading={R.loading || book.loading} text="因子或持仓历史数据不足" />}
      </>}
    </PanelShell>
  );
}

/* ================================================================== 审计日志 */
const KIND_COLOR: Record<string, string> = { FILL: "#34d399", REJECT: "#f87171", CANCEL: "#94a3b8", NEW: "#fbbf24", EXPIRE: "#64748b" };
export function AuditLogLive({ onClose }: P) {
  const [tab, setTab] = useState("all");
  const [kind, setKind] = useState("ALL");
  const [q, setQ] = useState("");
  const ev = useEvents();
  const od = useOrders();
  const fl = useFills();
  const events = ev.data ?? [];
  const orders = od.data ?? [];
  const fills = fl.data ?? [];
  const oById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const today = new Date().toDateString();
  const rows = events.filter((e) => (kind === "ALL" || e.kind === kind) && (!q || `${e.detail} ${e.orderId ?? ""} ${oById.get(e.orderId ?? -1)?.symbol ?? ""}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.ts - a.ts);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 13 + i); return d; });
  const perDay = days.map((d) => { const a = d.getTime(), b = a + 86400e3; const es = events.filter((e) => e.ts >= a && e.ts < b); return { k: `${d.getMonth() + 1}/${d.getDate()}`, v: es.filter((e) => e.kind === "FILL").length, v2: es.filter((e) => e.kind !== "FILL").length }; });
  const rejects = orders.filter((o) => o.status === "REJECTED");
  const reasons = Object.entries(rejects.reduce<Record<string, number>>((a, o) => { const k = o.reject || "未注明"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const unsettled = fills.filter((f) => !f.settled);
  const exportCsv = () => {
    const lines = [["时间", "类型", "委托号", "标的", "说明"].join(","), ...rows.map((e) => [new Date(e.ts).toISOString(), KIND_ZH[e.kind] ?? e.kind, e.orderId ?? "", oById.get(e.orderId ?? -1)?.symbol ?? "", `"${e.detail.replace(/"/g, '""')}"`].join(","))];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `审计日志_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <PanelShell code="AUDIT" title="审计日志 · 交易流水" onClose={onClose} tabs={[["all", "全部流水"], ["orders", "委托生命周期"], ["fills", "成交与交收"], ["exc", "异常与拒单"]]} tab={tab} setTab={setTab} right={<span>记录永久入库 · 不可修改</span>}>
      <Kpis items={[["流水总数", events.length.toLocaleString(), `今日 ${events.filter((e) => new Date(e.ts).toDateString() === today).length}`], ["委托", orders.length.toLocaleString(), Object.entries(orders.reduce<Record<string, number>>((a, o) => { a[o.status] = (a[o.status] ?? 0) + 1; return a; }, {})).map(([k, v]) => `${STATUS_ZH[k] ?? k} ${v}`).join(" · ")], ["成交笔数", fills.length.toLocaleString(), `费用 ${fmtCompact(fills.reduce((a, f) => a + f.fee + f.tax, 0))}`], ["待交收成交", unsettled.length.toLocaleString(), rejects.length ? `拒单 ${rejects.length}` : "无拒单"]]} />
      {tab === "all" && <>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1">
          <Seg value={kind} onChange={setKind} options={[["ALL", "全部"], ["NEW", "委托"], ["FILL", "成交"], ["CANCEL", "撤单"], ["REJECT", "拒单"], ["EXPIRE", "失效"]]} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="检索：标的 / 委托号 / 说明" className="w-48 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white placeholder:text-slate-600" />
          <span className="text-[10px] text-slate-500">{rows.length} 条</span>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="ml-auto border border-[#1d3047] px-2 text-[10px] text-slate-300 hover:text-white disabled:opacity-40">导出 CSV</button>
        </div>
        <VirtualRows rows={rows} height={420} header={<thead className={`sticky top-0 bg-[#0a1726] ${th}`}><tr><th className="px-2 py-1 text-left">时间</th><th className="text-left">类型</th><th className="text-left">委托号</th><th className="text-left">标的</th><th className="px-2 text-left">说明</th></tr></thead>} render={(e) => { const o = oById.get(e.orderId ?? -1); return <tr key={e.id} className="h-[22px] border-t border-[#0f1b29]"><td className="whitespace-nowrap px-2 font-mono text-[10px] text-slate-500">{fmtTs(e.ts)}</td><td style={{ color: KIND_COLOR[e.kind] ?? "#e2e8f0" }}>{KIND_ZH[e.kind] ?? e.kind}</td><td className="font-mono text-slate-500">{e.orderId ?? ""}</td><td className="font-mono text-slate-300">{o?.symbol ?? ""}</td><td className="truncate px-2 text-slate-200">{e.detail}</td></tr>; }} />
        {!rows.length && <Empty loading={ev.loading} text="暂无流水；在交易系统下单后自动记录" />}
        <SectionHead title="近 14 日活动" />
        <Bars data={perDay} label={["成交", "委托 / 撤单 / 其他"]} fmt={(x) => x.toFixed(0)} height={110} />
      </>}
      {tab === "orders" && <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">委托号</th><th className="text-left">创建</th><th className="text-left">最后更新</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-left">类型</th><th className="text-right">数量</th><th className="text-right">已成</th><th className="text-right">均价</th><th className="text-left">状态</th><th className="px-2 text-right">事件数</th></tr></thead>
        <tbody>{orders.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 300).map((o) => <tr key={o.id} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{o.id}</td><td className="font-mono text-[10px] text-slate-500">{fmtTs(o.createdAt)}</td><td className="font-mono text-[10px] text-slate-500">{fmtTs(o.updatedAt)}</td><td className="text-slate-100">{o.symbol}</td><td className="text-center" style={{ color: o.side === "B" ? UP : DOWN }}>{o.side === "B" ? "买" : "卖"}</td><td className="text-slate-400">{o.type === "MKT" ? "市价" : o.type === "LMT" ? `限价 ${fmtPrice(o.limitPx)}` : `止损 ${fmtPrice(o.stopPx)}`}</td><td className="text-right font-mono text-slate-200">{o.qty}</td><td className="text-right font-mono text-slate-300">{o.filledQty}</td><td className="text-right font-mono text-white">{fmtPrice(o.avgPx)}</td><td className="text-slate-300">{STATUS_ZH[o.status] ?? o.status}</td><td className="px-2 text-right font-mono text-slate-500">{events.filter((e) => e.orderId === o.id).length}</td></tr>)}
          {!orders.length && <tr><td colSpan={11}><Empty loading={od.loading} text="暂无委托" /></td></tr>}</tbody></table>}
      {tab === "fills" && <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">成交号</th><th className="text-left">时间</th><th className="text-left">标的</th><th className="text-center">方向</th><th className="text-right">数量</th><th className="text-right">价格</th><th className="text-right">金额</th><th className="text-right">费用</th><th className="text-right">税费</th><th className="pl-2 text-left">交易日</th><th className="text-left">交收日</th><th className="px-2 text-left">交收</th></tr></thead>
        <tbody>{fills.slice().sort((a, b) => b.ts - a.ts).slice(0, 300).map((f) => <tr key={f.id} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{f.id}</td><td className="font-mono text-[10px] text-slate-500">{fmtTs(f.ts)}</td><td className="text-slate-100">{f.symbol}</td><td className="text-center" style={{ color: f.side === "B" ? UP : DOWN }}>{f.side === "B" ? "买" : "卖"}</td><td className="text-right font-mono text-slate-200">{f.qty}</td><td className="text-right font-mono text-white">{fmtPrice(f.px)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(f.notional)}</td><td className="text-right font-mono text-slate-400">{f.fee.toFixed(2)}</td><td className="text-right font-mono text-slate-400">{f.tax.toFixed(2)}</td><td className="pl-2 font-mono text-[10px] text-slate-400">{f.tradeDate}</td><td className="font-mono text-[10px] text-slate-400">{f.settleDate}</td><td className="px-2" style={{ color: f.settled ? "#34d399" : "#fbbf24" }}>{f.settled ? "已交收" : "待交收"}</td></tr>)}
          {!fills.length && <tr><td colSpan={12}><Empty loading={fl.loading} text="暂无成交" /></td></tr>}</tbody></table>}
      {tab === "exc" && <>
        <SectionHead title="拒单原因统计" />
        <table className="w-full text-[11px]"><tbody>{reasons.map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{k}</td><td className="px-2 text-right font-mono text-white">{v}</td></tr>)}{!reasons.length && <tr><td><Empty text="无拒单记录" /></td></tr>}</tbody></table>
        <SectionHead title="拒单 / 撤单 / 失效事件" />
        <table className="w-full text-[11px]"><tbody>{events.filter((e) => e.kind === "REJECT" || e.kind === "CANCEL" || e.kind === "EXPIRE").sort((a, b) => b.ts - a.ts).slice(0, 200).map((e) => <tr key={e.id} className="border-t border-[#0f1b29]"><td className="w-[130px] px-2 py-0.5 font-mono text-[10px] text-slate-500">{fmtTs(e.ts)}</td><td className="w-[48px]" style={{ color: KIND_COLOR[e.kind] }}>{KIND_ZH[e.kind]}</td><td className="w-[60px] font-mono text-slate-500">{e.orderId ?? ""}</td><td className="pr-2 text-slate-200">{e.detail}</td></tr>)}</tbody></table>
        <SectionHead title="待交收成交" sub="A股 T+1 · 港股 T+2 · 美股 T+1" />
        <table className="w-full text-[11px]"><tbody>{unsettled.map((f) => <tr key={f.id} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{f.id}</td><td className="text-slate-100">{f.symbol}</td><td style={{ color: f.side === "B" ? UP : DOWN }}>{f.side === "B" ? "买" : "卖"} {f.qty}</td><td className="text-right font-mono text-slate-300">{fmtCompact(f.notional)} {f.ccy}</td><td className="px-2 text-right font-mono text-amber-300">交收日 {f.settleDate}</td></tr>)}{!unsettled.length && <tr><td><Empty text="全部成交均已交收" /></td></tr>}</tbody></table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== 平台运行指标 */
type Platform = { uptimeSec: number; node: string; cpus: number; load: number[]; sysMemTotal: number; sysMemFree: number; rss: number; heapUsed: number; heapTotal: number; streamClients: number; cacheEntries: number; warehouse: { news: number; kline: number; ticks: number; klineSymbols: number; partitions?: Record<string, string> } | null; warm?: Array<{ at: number; label: string; symbols: number; ms: number; ticks: number }>; feeds: { total: number; online: number; items: number }; lines: Array<{ line: string; ok: boolean; lastOkSec: number | null; fails: number }>; procs: Array<{ name: string; area: string; n: number; err: number; avg: number; max: number; lastSec: number }>; areas: Array<{ area: string; n: number; avg: number; err: number }>; perMinute: number[] };
const usePlatform = () => usePolled<Platform>("ucHubs.platform", {}, 5000);
const dur = (s: number) => `${Math.floor(s / 86400)}天${Math.floor((s % 86400) / 3600)}时${Math.floor((s % 3600) / 60)}分`;
const mb = (b: number | null | undefined) => (b == null ? "—" : b > 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`);
const PROC_ZH: Record<string, string> = { "Market.ticks": "实时报价", "Market.kline": "K 线", "Market.klineTail": "K 线增量", "Market.news": "个股新闻", "Market.profile": "公司资料", "Market.depth": "盘口", "Market.session": "交易时段", "News.feed": "新闻流", "News.read": "正文阅读", "News.stats": "新闻统计", "News.trends": "热词", "News.sentiment": "情绪", "News.calendar": "经济日历", "News.macro": "宏观快照", "Hubs.closes": "日线收盘", "Hubs.platform": "运行指标", "Hubs.options": "期权链", "Hubs.portfolio": "组合读取", "Trade.orders": "委托查询", "Trade.fills": "成交查询", "Trade.positions": "持仓查询", "Trade.summary": "账户汇总", "Trade.events": "交易流水", "Trade.place": "下单", "Trade.cancel": "撤单" };

export function IntegrationMonitorLive({ onClose }: P) {
  const [view, setView] = useState("all");
  const p = usePlatform();
  const d = p.data;
  const procs = (d?.procs ?? []).filter((x) => view === "all" || x.area === view);
  const totN = (d?.areas ?? []).reduce((a, x) => a + x.n, 0);
  const totErr = (d?.areas ?? []).reduce((a, x) => a + x.err, 0);
  const avgMs = totN ? (d?.areas ?? []).reduce((a, x) => a + x.avg * x.n, 0) / totN : null;
  const status = (x: Platform["procs"][number]) => (x.n && x.err / x.n > 0.05 ? ["异常", UP] : x.avg > 3000 ? ["偏慢", "#fbbf24"] : x.lastSec > 1800 ? ["闲置", "#64748b"] : ["正常", DOWN]) as [string, string];
  const linesOk = (d?.lines ?? []).filter((l) => l.ok).length;
  const last5 = (d?.perMinute ?? []).slice(-5).reduce((a, b) => a + b, 0);
  return (
    <PanelShell code="INTEG" title="集成监控 · 接口与外部线路" onClose={onClose} tabs={[["all", "全部接口"], ...[...new Set((d?.areas ?? []).map((a) => a.area))].map((a) => [a, a] as [string, string])]} tab={view} setTab={setView} right={<span>每 5 秒刷新</span>}>
      <Kpis items={[["接口成功率", totN ? `${(((totN - totErr) / totN) * 100).toFixed(2)}%` : "—", `${totN.toLocaleString()} 次调用 · 失败 ${totErr}`], ["加权平均延迟", avgMs == null ? "—" : `${avgMs.toFixed(0)} ms`], ["行情线路", d ? `${linesOk} / ${d.lines.length} 正常` : "—", "异常时自动切换"], ["实时推送连接", d ? String(d.streamClients) : "—", `近 5 分钟 ${last5} 次调用`]]} />
      <SectionHead title="外部行情线路" />
      <table className="w-full text-[11px]"><tbody>{(d?.lines ?? []).map((l) => <tr key={l.line} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{l.line}</td><td style={{ color: l.ok ? DOWN : UP }}>{l.ok ? "● 在线" : "● 暂停"}</td><td className="text-right font-mono text-slate-400">{l.lastOkSec == null ? "尚未成功" : `${l.lastOkSec} 秒前成功`}</td><td className="px-2 text-right font-mono" style={{ color: l.fails ? "#fbbf24" : "#64748b" }}>连续失败 {l.fails}</td></tr>)}
        <tr className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">新闻采集频道</td><td style={{ color: d && d.feeds.online / Math.max(1, d.feeds.total) > 0.7 ? DOWN : "#fbbf24" }}>● {d ? `${d.feeds.online} / ${d.feeds.total} 在线` : "—"}</td><td className="text-right font-mono text-slate-400">3 小时内有成功采集</td><td className="px-2 text-right font-mono text-slate-500">{fmtCompact(d?.feeds.items)} 条</td></tr></tbody></table>
      <SectionHead title="接口健康矩阵" sub="失败率 > 5% 记为异常；平均 > 3 秒记为偏慢；30 分钟无调用记为闲置" />
      <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">接口</th><th className="text-left">业务域</th><th className="text-left">状态</th><th className="text-right">调用</th><th className="text-right">失败率</th><th className="text-right">平均</th><th className="text-right">最慢</th><th className="px-2 text-right">最近调用</th></tr></thead>
        <tbody>{procs.map((x) => { const [st, c] = status(x); return <tr key={x.name} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{PROC_ZH[x.name] ?? x.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.name}</span></td><td className="text-slate-400">{x.area}</td><td style={{ color: c }}>{st}</td><td className="text-right font-mono text-white">{x.n.toLocaleString()}</td><td className="text-right font-mono" style={{ color: x.err ? UP : "#64748b" }}>{x.n ? ((x.err / x.n) * 100).toFixed(2) : "0.00"}%</td><td className="text-right font-mono text-slate-200">{x.avg.toFixed(0)} ms</td><td className="text-right font-mono text-slate-400">{x.max} ms</td><td className="px-2 text-right font-mono text-slate-500">{x.lastSec < 60 ? `${x.lastSec} 秒前` : `${Math.round(x.lastSec / 60)} 分前`}</td></tr>; })}
          {!procs.length && <tr><td colSpan={8}><Empty loading={p.loading} /></td></tr>}</tbody></table>
      <SectionHead title="各业务域平均延迟（ms）" />
      <Bars data={(d?.areas ?? []).map((a) => ({ k: a.area, v: a.avg }))} fmt={(x) => x.toFixed(0)} height={110} />
    </PanelShell>
  );
}

export function SystemMaintenanceLive({ onClose }: P) {
  const p = usePlatform();
  const d = p.data;
  const [hist, setHist] = useState<Array<{ t: number; load: number; heap: number; mem: number }>>([]);
  useEffect(() => {
    if (!d) return;
    setHist((h) => [...h, { t: Date.now(), load: d.load[0] / Math.max(1, d.cpus), heap: d.heapUsed / 1024 ** 2, mem: (1 - d.sysMemFree / d.sysMemTotal) * 100 }].slice(-180));
  }, [d]);
  const memUse = d ? (1 - d.sysMemFree / d.sysMemTotal) * 100 : null;
  const loadPc = d ? d.load[0] / Math.max(1, d.cpus) : null;
  const checks: Array<[string, boolean | null, string]> = d ? [
    ["CPU 负载（1 分钟 / 核）< 1.0", loadPc! < 1, loadPc!.toFixed(2)],
    ["系统内存占用 < 90%", memUse! < 90, `${memUse!.toFixed(1)}%`],
    ["进程堆占用 < 85%", d.heapUsed / d.heapTotal < 0.85, `${((d.heapUsed / d.heapTotal) * 100).toFixed(0)}%`],
    ["行情线路全部在线", d.lines.every((l) => l.ok), `${d.lines.filter((l) => l.ok).length}/${d.lines.length}`],
    ["新闻频道在线率 > 70%", d.feeds.online / Math.max(1, d.feeds.total) > 0.7, `${d.feeds.online}/${d.feeds.total}`],
    ["数据仓库可读", d.warehouse != null, d.warehouse ? "正常" : "不可用"],
    ["开盘前预热已执行", (d.warm ?? []).length > 0, (d.warm ?? [])[0] ? new Date(d.warm![0].at).toLocaleTimeString("zh-CN", { hour12: false }) : "尚未执行"],
  ] : [];
  const passed = checks.filter((c) => c[1]).length;
  return (
    <PanelShell code="SYS" title="系统维护 · 运行资源与健康检查" onClose={onClose} right={<span>每 5 秒采样 · 本窗口已采 {hist.length} 次</span>}>
      <Kpis items={[["持续运行", d ? dur(d.uptimeSec) : "—", d ? `运行时 ${d.node} · ${d.cpus} 核` : undefined], ["CPU 负载 1/5/15 分", d ? d.load.map((x) => x.toFixed(2)).join(" / ") : "—", loadPc != null ? `每核 ${loadPc.toFixed(2)}` : undefined], ["系统内存", memUse != null ? `${memUse.toFixed(1)}%` : "—", d ? `${mb(d.sysMemTotal - d.sysMemFree)} / ${mb(d.sysMemTotal)}` : undefined], ["健康检查", d ? `${passed} / ${checks.length} 通过` : "—", d ? `缓存条目 ${d.cacheEntries.toLocaleString()}` : undefined]]} />
      <SectionHead title="健康检查清单" />
      <table className="w-full text-[11px]"><tbody>{checks.map(([k, ok, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="w-6 px-2 py-0.5" style={{ color: ok ? DOWN : UP }}>{ok ? "✓" : "✕"}</td><td className="text-slate-200">{k}</td><td className="px-2 text-right font-mono text-slate-300">{v}</td></tr>)}{!d && <tr><td><Empty loading={p.loading} /></td></tr>}</tbody></table>
      <SectionHead title="进程内存" />
      <table className="w-full text-[11px]"><tbody>{d && ([["常驻内存（RSS）", d.rss, d.sysMemTotal], ["堆已用 / 堆总量", d.heapUsed, d.heapTotal]] as Array<[string, number, number]>).map(([k, a, b]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="w-40 px-2 py-0.5 text-slate-300">{k}</td><td><div className="h-2 bg-[#0f1b29]"><div className="h-2 bg-cyan-600" style={{ width: `${Math.min(100, (a / b) * 100)}%` }} /></div></td><td className="w-40 px-2 text-right font-mono text-slate-200">{mb(a)} / {mb(b)}</td></tr>)}</tbody></table>
      <SectionHead title="本窗口打开以来的资源走势" sub="每核负载 · 系统内存 %" />
      {hist.length > 1 ? <Lines series={[{ name: "每核负载 ×100", color: "#fbbf24", values: hist.map((h) => h.load * 100) }, { name: "系统内存 %", color: "#38bdf8", values: hist.map((h) => h.mem) }, { name: "堆已用 MB", color: "#a78bfa", values: hist.map((h) => h.heap), dash: true }]} xLabels={hist.map((h) => new Date(h.t).toLocaleTimeString("zh-CN", { hour12: false }))} height={140} fmt={(x) => x.toFixed(1)} /> : <Empty loading text="采样中…" />}
      <SectionHead title="数据仓库与分区" />
      <table className="w-full text-[11px]"><tbody>
        {d?.warehouse && ([["新闻", d.warehouse.news], ["K 线", d.warehouse.kline], ["分钟行情快照", d.warehouse.ticks], ["K 线覆盖标的", d.warehouse.klineSymbols]] as Array<[string, number]>).map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-300">{k}</td><td className="px-2 text-right font-mono text-white">{v.toLocaleString()}</td></tr>)}
        {Object.entries(d?.warehouse?.partitions ?? {}).map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-400">{k === "uc_tick_minute" ? "分区维护 · 分钟行情（按日）" : k === "uc_kline" ? "分区维护 · K 线（按年）" : `分区维护 · ${k}`}</td><td className="px-2 text-right text-slate-200">{v}</td></tr>)}
      </tbody></table>
      <SectionHead title="预热任务日志" />
      <table className="w-full text-[11px]"><tbody>{(d?.warm ?? []).map((x) => <tr key={x.at} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{new Date(x.at).toLocaleString("zh-CN", { hour12: false })}</td><td className="text-slate-200">{x.label}</td><td className="text-right font-mono text-slate-300">{x.ticks} / {x.symbols} 报价成功</td><td className="px-2 text-right font-mono" style={{ color: x.ms > 30000 ? "#fbbf24" : "#94a3b8" }}>{(x.ms / 1000).toFixed(1)} 秒</td></tr>)}{d && !(d.warm ?? []).length && <tr><td className="px-2 py-1 text-slate-500">启动后约 1 分钟执行首次预热</td></tr>}</tbody></table>
    </PanelShell>
  );
}

