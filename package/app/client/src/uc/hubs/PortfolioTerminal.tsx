/**
 * 组合中心（/portfolio-optimizer）：实时持仓与盈亏 · 业绩对比基准 · 风险（波动 / 回撤 / Beta / VaR）· 相关性 · 有效前沿与优化权重 · 历史压力测试。
 * 持仓永久保存在平台数据库；所有计算基于真实日 K 线，行情实时跳动。
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DOWN, UP, fmtCompact, fmtPct, fmtPrice, toneOf, ucGet, useTicks, type Candle } from "@/uc/market/live";
import { SectionHead, Seg } from "@/uc/news/kit";
import { HubShell, Lines, useHub } from "./kit";

type Holding = { symbol: string; qty: number; cost: number };
type Pf = { holdings: Holding[]; benchmark: string; cash: number };
const DEFAULT_PF: Pf = { holdings: [{ symbol: "AAPL", qty: 50, cost: 300 }, { symbol: "NVDA", qty: 40, cost: 200 }, { symbol: "TLT", qty: 60, cost: 90 }, { symbol: "GLD", qty: 20, cost: 380 }, { symbol: "0700.HK", qty: 100, cost: 400 }], benchmark: "^GSPC", cash: 0 };
const FUNCS: Array<[string, string, string]> = [["hold", "PORT", "持仓与盈亏"], ["perf", "PERF", "业绩对比"], ["risk", "RISK", "风险指标"], ["corr", "CORR", "相关性"], ["opt", "OPT", "组合优化"], ["stress", "STRS", "历史压力测试"]];

function ownerId() {
  try {
    let id = window.localStorage.getItem("uc.pf.owner");
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem("uc.pf.owner", id);
    }
    return id;
  } catch {
    return "browser-default";
  }
}

/** 拉所有持仓与基准的日 K，按日期对齐成收益率矩阵 */
function useHistory(symbols: string[]) {
  const key = symbols.join(",");
  const [data, setData] = useState<{ key: string; dates: number[]; closes: Record<string, number[]> } | null>(null);
  useEffect(() => {
    if (!symbols.length) return;
    let alive = true;
    void Promise.all(symbols.map((s) => ucGet<{ candles: Candle[] }>("ucMarket.kline", { symbol: s, period: "1d", limit: 300 }).then((r) => [s, r.candles] as const).catch(() => [s, [] as Candle[]] as const))).then((list) => {
      if (!alive) return;
      const day = (t: number) => Math.floor((t + 8 * 3600e3) / 86400e3);
      const maps = list.map(([s, c]) => [s, new Map(c.map((k) => [day(k.t), k.c]))] as const);
      const dates = [...new Set(maps.flatMap(([, m]) => [...m.keys()]))].sort((a, b) => a - b).slice(-260);
      const closes: Record<string, number[]> = {};
      for (const [s, m] of maps) {
        let last = NaN;
        closes[s] = dates.map((d) => (m.has(d) ? (last = m.get(d)!) : last));
      }
      setData({ key, dates, closes });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data?.key === key ? data : null;
}
const rets = (arr: number[]) => arr.slice(1).map((v, i) => (Number.isFinite(v) && Number.isFinite(arr[i]) && arr[i] ? v / arr[i] - 1 : 0));
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const cov = (a: number[], b: number[]) => { const ma = mean(a), mb = mean(b); return a.reduce((x, _, i) => x + (a[i] - ma) * (b[i] - mb), 0) / Math.max(1, a.length - 1); };

export default function PortfolioTerminal({ initialFunc }: { initialFunc?: string } & Record<string, unknown> = {}) {
  const [func, setFunc] = useState(() => (initialFunc && FUNCS.some(([id]) => id === initialFunc) ? initialFunc : "hold"));
  const [pf, setPf] = useState<Pf | null>(null);
  const owner = useMemo(ownerId, []);
  useEffect(() => {
    ucGet<Pf | null>("ucHubs.portfolio", { owner }).then((d) => setPf(d ?? DEFAULT_PF)).catch(() => setPf(DEFAULT_PF));
  }, [owner]);
  const save = async (next: Pf) => {
    setPf(next);
    try {
      const res = await fetch("/api/trpc/ucHubs.savePortfolio", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: { owner, data: next } }) });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("组合保存失败，稍后重试");
    }
  };
  if (!pf) return <div className="p-6 text-[12px] text-slate-500">读取组合…</div>;
  return (
    <HubShell title="组合中心" code="PRT" funcs={FUNCS} func={func} setFunc={setFunc}>
      <PortfolioBody pf={pf} save={save} func={func} />
    </HubShell>
  );
}

function PortfolioBody({ pf, save, func }: { pf: Pf; save: (p: Pf) => void; func: string }) {
  const syms = pf.holdings.map((h) => h.symbol);
  const ticks = useTicks([...syms, pf.benchmark]);
  const hist = useHistory([...syms, pf.benchmark]);
  const { pick } = useHub();
  const [add, setAdd] = useState({ symbol: "", qty: "", cost: "" });

  const rows = pf.holdings.map((h) => {
    const t = ticks[h.symbol];
    const price = t?.price ?? null;
    const value = price != null ? price * h.qty : null;
    const pnl = price != null ? (price - h.cost) * h.qty : null;
    const day = t?.change != null ? t.change * h.qty : null;
    return { ...h, t, price, value, pnl, pnlPct: price != null && h.cost ? (price / h.cost - 1) * 100 : null, day };
  });
  const total = rows.reduce((n, r) => n + (r.value ?? 0), 0) + pf.cash;
  const totalCost = rows.reduce((n, r) => n + r.cost * r.qty, 0) + pf.cash;
  const dayPnl = rows.reduce((n, r) => n + (r.day ?? 0), 0);
  const weights = rows.map((r) => (total ? (r.value ?? 0) / total : 0));

  // 组合历史收益（按当前权重回看）
  const analytics = useMemo(() => {
    if (!hist) return null;
    const R = syms.map((s) => rets(hist.closes[s] ?? []));
    const B = rets(hist.closes[pf.benchmark] ?? []);
    const n = B.length;
    const port = Array.from({ length: n }, (_, i) => R.reduce((acc, r, k) => acc + (r[i] ?? 0) * weights[k], 0));
    const curve = [1];
    const bench = [1];
    for (let i = 0; i < n; i++) {
      curve.push(curve[i] * (1 + port[i]));
      bench.push(bench[i] * (1 + (B[i] ?? 0)));
    }
    let peak = 1, mdd = 0;
    for (const v of curve) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
    const vol = std(port) * Math.sqrt(252);
    const ann = Math.pow(curve[curve.length - 1], 252 / Math.max(1, n)) - 1;
    const rf = (ticks["^IRX"]?.price ?? 4) / 100;
    const beta = cov(port, B) / Math.max(1e-12, std(B) ** 2);
    const sorted = [...port].sort((a, b) => a - b);
    const var95 = -sorted[Math.floor(sorted.length * 0.05)];
    const cvar95 = -mean(sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.05))));
    const corr = R.map((a) => R.map((b) => cov(a, b) / Math.max(1e-12, std(a) * std(b))));
    const contrib = R.map((r, k) => weights[k] * cov(r, port) / Math.max(1e-12, std(port) ** 2));
    // 有效前沿：随机组合抽样
    const mu = R.map((r) => mean(r) * 252);
    const C = R.map((a) => R.map((b) => cov(a, b) * 252));
    const pts: Array<{ w: number[]; r: number; v: number; s: number }> = [];
    for (let t = 0; t < 2500; t++) {
      const raw = R.map(() => -Math.log(Math.random()));
      const sum = raw.reduce((a, b) => a + b, 0);
      const w = raw.map((x) => x / sum);
      const r = w.reduce((a, x, i) => a + x * mu[i], 0);
      let v = 0;
      for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) v += w[i] * w[j] * C[i][j];
      const sd = Math.sqrt(Math.max(0, v));
      pts.push({ w, r, v: sd, s: sd ? (r - rf) / sd : 0 });
    }
    const maxSharpe = pts.reduce((a, b) => (b.s > a.s ? b : a), pts[0]);
    const minVar = pts.reduce((a, b) => (b.v < a.v ? b : a), pts[0]);
    // 历史压力：基准最差的 8 个交易日，组合当天的表现
    const worst = B.map((b, i) => ({ i, b })).sort((a, b) => a.b - b.b).slice(0, 8).map(({ i, b }) => ({ date: new Date(hist.dates[i + 1] * 86400e3).toISOString().slice(0, 10), bench: b, port: port[i], loss: port[i] * total }));
    return { curve, bench, dates: hist.dates, vol, ann, mdd, beta, sharpe: vol ? (ann - rf) / vol : 0, var95, cvar95, corr, contrib, pts, maxSharpe, minVar, worst, benchVol: std(B) * Math.sqrt(252) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist, weights.map((w) => w.toFixed(3)).join(",")]);

  const doAdd = () => {
    const symbol = add.symbol.trim().toUpperCase();
    const qty = Number(add.qty);
    const cost = Number(add.cost) || ticks[symbol]?.price || 0;
    if (!symbol || !qty) return toast.error("请输入代码和数量");
    save({ ...pf, holdings: [...pf.holdings.filter((h) => h.symbol !== symbol), { symbol, qty, cost }] });
    setAdd({ symbol: "", qty: "", cost: "" });
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-[#1a2a3c] bg-[#060d16] px-3 py-2 text-[11px] sm:grid-cols-5">
        <div><div className="text-slate-500">组合市值</div><div className="font-mono text-[18px] text-white">{fmtCompact(total)}</div></div>
        <div><div className="text-slate-500">今日盈亏</div><div className="font-mono text-[18px]" style={{ color: toneOf(dayPnl) }}>{dayPnl > 0 ? "+" : ""}{fmtCompact(dayPnl)}</div></div>
        <div><div className="text-slate-500">累计盈亏</div><div className="font-mono text-[18px]" style={{ color: toneOf(total - totalCost) }}>{fmtCompact(total - totalCost)} <span className="text-[11px]">{fmtPct(totalCost ? (total / totalCost - 1) * 100 : null)}</span></div></div>
        <div><div className="text-slate-500">年化波动 / 夏普</div><div className="font-mono text-[18px] text-white">{analytics ? `${(analytics.vol * 100).toFixed(1)}% / ${analytics.sharpe.toFixed(2)}` : "—"}</div></div>
        <div><div className="text-slate-500">基准</div><select value={pf.benchmark} onChange={(e) => save({ ...pf, benchmark: e.target.value })} className="h-6 border border-[#1d3047] bg-[#050b13] text-[11px] text-slate-100">{["^GSPC", "^IXIC", "000300.SH", "^HSI", "^N225", "^STOXX50E"].map((b) => <option key={b}>{b}</option>)}</select></div>
      </div>

      {func === "hold" && (
        <div>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">代码</th><th className="text-right">数量</th><th className="text-right">成本</th><th className="text-right">现价</th><th className="text-right">今日</th><th className="text-right">市值</th><th className="text-right">权重</th><th className="text-right">盈亏</th><th className="text-right">收益率</th><th className="px-2" /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.symbol} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
                  <td className="cursor-pointer px-2 py-1" onClick={() => pick(r.symbol)}><span className="text-slate-100">{r.t?.name ?? r.symbol}</span><span className="ml-1 font-mono text-[9px] text-slate-500">{r.symbol}</span></td>
                  <td className="text-right"><input defaultValue={r.qty} onBlur={(e) => { const v = Number(e.target.value); if (v && v !== r.qty) save({ ...pf, holdings: pf.holdings.map((h) => (h.symbol === r.symbol ? { ...h, qty: v } : h)) }); }} className="w-16 bg-transparent text-right font-mono text-slate-200 outline-none focus:bg-[#0b1624]" /></td>
                  <td className="text-right"><input defaultValue={r.cost} onBlur={(e) => { const v = Number(e.target.value); if (v && v !== r.cost) save({ ...pf, holdings: pf.holdings.map((h) => (h.symbol === r.symbol ? { ...h, cost: v } : h)) }); }} className="w-20 bg-transparent text-right font-mono text-slate-400 outline-none focus:bg-[#0b1624]" /></td>
                  <td className="text-right font-mono" style={{ color: toneOf(r.t?.changePct) }}>{fmtPrice(r.price)}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(r.t?.changePct) }}>{fmtPct(r.t?.changePct)}</td>
                  <td className="text-right font-mono text-slate-200">{fmtCompact(r.value)}</td>
                  <td className="text-right font-mono text-slate-400">{(weights[i] * 100).toFixed(1)}%</td>
                  <td className="text-right font-mono" style={{ color: toneOf(r.pnl) }}>{fmtCompact(r.pnl)}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(r.pnlPct) }}>{fmtPct(r.pnlPct)}</td>
                  <td className="px-2 text-right"><button type="button" onClick={() => save({ ...pf, holdings: pf.holdings.filter((h) => h.symbol !== r.symbol) })} className="text-[10px] text-slate-500 hover:text-red-300">移除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2 border-t border-[#1a2a3c] px-2 py-2 text-[11px]">
            <span className="text-slate-400">添加持仓</span>
            <input value={add.symbol} onChange={(e) => setAdd({ ...add, symbol: e.target.value })} placeholder="代码：AAPL / 600519.SH / 0700.HK" className="h-6 w-[200px] border border-[#1d3047] bg-[#050b13] px-1.5 font-mono text-slate-100 outline-none" />
            <input value={add.qty} onChange={(e) => setAdd({ ...add, qty: e.target.value })} placeholder="数量" className="h-6 w-[80px] border border-[#1d3047] bg-[#050b13] px-1.5 font-mono text-slate-100 outline-none" />
            <input value={add.cost} onChange={(e) => setAdd({ ...add, cost: e.target.value })} placeholder="成本（空=现价）" className="h-6 w-[120px] border border-[#1d3047] bg-[#050b13] px-1.5 font-mono text-slate-100 outline-none" onKeyDown={(e) => e.key === "Enter" && doAdd()} />
            <button type="button" onClick={doAdd} className="border border-cyan-700 px-2 py-0.5 text-cyan-200 hover:bg-cyan-900/30">添加</button>
            <span className="ml-auto text-[10px] text-slate-500">持仓保存在平台数据库，换设备登录同一账号仍在</span>
          </div>
        </div>
      )}

      {func === "perf" && analytics && (
        <div>
          <SectionHead title="组合 vs 基准（按当前权重回看一年，起点为 1）" sub={`组合年化 ${(analytics.ann * 100).toFixed(1)}% · 最大回撤 ${(analytics.mdd * 100).toFixed(1)}%`} />
          <Lines series={[{ name: "组合", color: "#38bdf8", values: analytics.curve }, { name: pf.benchmark, color: "#94a3b8", values: analytics.bench, dash: true }]} xLabels={[analytics.dates[0], ...analytics.dates].map((d) => new Date(d * 86400e3).toISOString().slice(5, 10))} fmt={(v) => v.toFixed(3)} height={260} />
        </div>
      )}

      {func === "risk" && analytics && (
        <div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-[#1a2a3c] px-3 py-3 text-[11px] sm:grid-cols-4">
            {[["年化收益", `${(analytics.ann * 100).toFixed(2)}%`], ["年化波动", `${(analytics.vol * 100).toFixed(2)}%`], ["夏普比率", analytics.sharpe.toFixed(2)], ["最大回撤", `${(analytics.mdd * 100).toFixed(2)}%`], ["Beta（对基准）", analytics.beta.toFixed(2)], ["日 VaR 95%", `${(analytics.var95 * 100).toFixed(2)}% ≈ ${fmtCompact(analytics.var95 * total)}`], ["日 CVaR 95%", `${(analytics.cvar95 * 100).toFixed(2)}% ≈ ${fmtCompact(analytics.cvar95 * total)}`], ["基准波动", `${(analytics.benchVol * 100).toFixed(2)}%`]].map(([k, v]) => <div key={k}><div className="text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div></div>)}
          </div>
          <SectionHead title="风险贡献" sub="各持仓对组合总波动的贡献占比" />
          {rows.map((r, i) => (
            <div key={r.symbol} className="grid grid-cols-[140px_minmax(0,1fr)_70px_70px] items-center gap-2 border-b border-[#0f1b29] px-2 py-1 text-[11px]">
              <span className="text-slate-200">{r.t?.name ?? r.symbol}</span>
              <span className="h-[8px] bg-[#0b1624]"><span className="block h-full bg-amber-400/80" style={{ width: `${Math.max(0, Math.min(100, analytics.contrib[i] * 100))}%` }} /></span>
              <span className="text-right font-mono text-amber-200">{(analytics.contrib[i] * 100).toFixed(1)}%</span>
              <span className="text-right font-mono text-slate-500">权重 {(weights[i] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {func === "corr" && analytics && (
        <div className="overflow-x-auto">
          <SectionHead title="收益相关性（近一年日收益）" />
          <table className="text-[11px]">
            <thead><tr><th />{syms.map((s) => <th key={s} className="px-2 py-1 font-mono text-cyan-300">{s}</th>)}</tr></thead>
            <tbody>{syms.map((a, i) => <tr key={a}><td className="px-2 font-mono text-cyan-300">{a}</td>{syms.map((b, j) => { const v = analytics.corr[i][j]; return <td key={b} className="px-2 py-1 text-center font-mono" style={{ background: v >= 0 ? `rgba(242,73,92,${Math.abs(v) * 0.6})` : `rgba(31,191,117,${Math.abs(v) * 0.6})`, color: "#f8fafc" }}>{v.toFixed(2)}</td>; })}</tr>)}</tbody>
          </table>
        </div>
      )}

      {func === "opt" && analytics && (
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="bg-[#03070c]">
            <SectionHead title="有效前沿" sub="2,500 个随机权重组合（横轴波动，纵轴预期收益）" />
            <svg viewBox="0 0 400 260" className="w-full">
              {(() => {
                const xs = analytics.pts.map((p) => p.v), ys = analytics.pts.map((p) => p.r);
                const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
                const X = (v: number) => 30 + ((v - x0) / Math.max(1e-9, x1 - x0)) * 360;
                const Y = (v: number) => 240 - ((v - y0) / Math.max(1e-9, y1 - y0)) * 225;
                const cur = { v: analytics.vol, r: analytics.ann };
                return <>
                  {analytics.pts.map((p, i) => <circle key={i} cx={X(p.v)} cy={Y(p.r)} r={1.1} fill={`hsl(${200 - Math.max(0, Math.min(1, p.s / 2)) * 160},80%,55%)`} opacity={0.6} />)}
                  <circle cx={X(analytics.maxSharpe.v)} cy={Y(analytics.maxSharpe.r)} r={5} fill="none" stroke="#fbbf24" strokeWidth={2} />
                  <circle cx={X(analytics.minVar.v)} cy={Y(analytics.minVar.r)} r={5} fill="none" stroke="#38bdf8" strokeWidth={2} />
                  {cur.v >= x0 && cur.v <= x1 && <circle cx={X(cur.v)} cy={Y(Math.max(y0, Math.min(y1, cur.r)))} r={5} fill="#f2495c" />}
                  <text x={30} y={256} fontSize={9} fill="#5f7891">{(x0 * 100).toFixed(0)}%</text><text x={370} y={256} fontSize={9} fill="#5f7891">{(x1 * 100).toFixed(0)}%</text>
                </>;
              })()}
            </svg>
            <div className="flex gap-4 px-2 pb-2 text-[10px]"><span className="text-amber-300">○ 最高夏普</span><span className="text-sky-300">○ 最小波动</span><span className="text-red-300">● 当前组合</span></div>
          </div>
          <div className="bg-[#03070c]">
            <SectionHead title="建议权重" />
            <table className="w-full text-[11px]">
              <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">代码</th><th className="text-right">当前</th><th className="text-right">最高夏普</th><th className="px-2 text-right">最小波动</th></tr></thead>
              <tbody>{syms.map((s, i) => <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-1 font-mono text-slate-200">{s}</td><td className="text-right font-mono">{(weights[i] * 100).toFixed(1)}%</td><td className="text-right font-mono text-amber-200">{(analytics.maxSharpe.w[i] * 100).toFixed(1)}%</td><td className="px-2 text-right font-mono text-sky-200">{(analytics.minVar.w[i] * 100).toFixed(1)}%</td></tr>)}</tbody>
            </table>
            <div className="px-2 py-2 text-[10px] text-slate-500">最高夏普组合：预期年化 {(analytics.maxSharpe.r * 100).toFixed(1)}%、波动 {(analytics.maxSharpe.v * 100).toFixed(1)}%；最小波动组合：波动 {(analytics.minVar.v * 100).toFixed(1)}%。基于历史数据，不代表未来收益。</div>
          </div>
        </div>
      )}

      {func === "stress" && analytics && (
        <div>
          <SectionHead title="历史压力测试" sub={`基准 ${pf.benchmark} 过去一年最差的交易日，当前组合当天的表现`} />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">日期</th><th className="text-right">基准</th><th className="text-right">组合</th><th className="text-right">相对</th><th className="px-2 text-right">按当前市值损益</th></tr></thead>
            <tbody>{analytics.worst.map((w) => <tr key={w.date} className="border-t border-[#0f1b29]"><td className="px-2 py-1 font-mono text-slate-300">{w.date}</td><td className="text-right font-mono" style={{ color: DOWN }}>{fmtPct(w.bench * 100)}</td><td className="text-right font-mono" style={{ color: toneOf(w.port) }}>{fmtPct(w.port * 100)}</td><td className="text-right font-mono" style={{ color: w.port > w.bench ? UP : DOWN }}>{fmtPct((w.port - w.bench) * 100)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(w.loss) }}>{fmtCompact(w.loss)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {func !== "hold" && !analytics && <div className="px-3 py-10 text-center text-[11px] text-slate-500">正在读取持仓的历史K线…</div>}
      <span className="hidden"><Seg value="a" onChange={() => undefined} options={[["a", "a"]]} /></span>
    </div>
  );
}
