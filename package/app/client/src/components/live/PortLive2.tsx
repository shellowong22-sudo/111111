/**
 * 组合管理第二组：基准管理（BBU）、日内业绩（PORT IP）、持仓行情展示（PDSP）、跟踪误差（PORT TE）、组合特征（PORT CH / HD）。
 * 持仓与回放统一取自 PortOpsLive 的合并组合（交易账户实时持仓 + 组合页保存的持仓），各功能只做自己的那一个角度：
 * BBU 比较候选基准的拟合度并保存基准；PORT IP 只看今天的盘中路径；PDSP 只看行情位置与动量；
 * PORT TE 只看相对当前基准的主动风险；PORT CH 只看基本面特征与行业分布。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, ucGet, useKline, usePolled } from "@/uc/market/live";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { f2, heat, mean, perf, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Spark } from "@/uc/news/kit";
import { Empty, Kpis, PanelShell, SectionHead, ownerId } from "@/uc/panels/kit";
import { MARKET_ZH, ucPost } from "@/uc/trade/kit";
import { BENCH_ZH, covar, usd, useBook, useBookReturns, type BookRow, type Pf } from "@/components/live/PortOpsLive";

type P = { onClose?: () => void };
const th = "sticky top-0 z-[1] bg-[#0a1726] text-[10px] text-slate-500";
const tr = "cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]";
const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
const growth = (r: number[]) => r.reduce((v, x) => v * (1 + x), 1) - 1;
const simple = (c: number[]) => c.slice(1).map((v, i) => v / c[i] - 1);

/* ================================================================== BBU 基准管理 */
const CANDS: Array<[string, string]> = [["^GSPC", "标普 500"], ["^NDX", "纳斯达克 100"], ["^DJI", "道琼斯"], ["sh000300", "沪深 300"], ["sh000001", "上证指数"], ["^HSI", "恒生指数"], ["ACWI", "全球股票"], ["AGG", "美国综合债"]];
const nameOfBench = (s: string) => CANDS.find(([k]) => k === s)?.[1] ?? BENCH_ZH[s] ?? s;

export function BbuLive({ onClose }: P) {
  const book = useBook();
  const pf = usePolled<Pf | null>("ucHubs.portfolio", { owner: ownerId() }, 120_000);
  const [custom, setCustom] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const current = chosen ?? book.benchmark;
  const list = useMemo(() => [...new Set([...CANDS.map(([k]) => k), current, ...extra])], [current, extra]);
  const R = useBookReturns(book, 400, list);
  const rows = useMemo(() => list.map((b) => {
    const c = R.m[b] ?? [];
    const n = Math.min(252, R.rp.length, c.length - 1);
    if (n < 40) return { b, ok: false as const };
    const rp = R.rp.slice(-n);
    const br = simple(c).slice(-n);
    const vb = covar(br, br);
    const beta = vb ? covar(rp, br) / vb : null;
    const sp = std(rp), sb = std(br);
    const cor = sp && sb ? covar(rp, br) / (sp * sb) : null;
    const act = rp.map((x, i) => x - br[i]);
    const te = std(act) * Math.sqrt(252) * 100;
    const activeRet = (growth(rp) - growth(br)) * 100;
    return { b, ok: true as const, n, beta, cor, r2: cor == null ? null : cor * cor, te, activeRet, ir: te ? (mean(act) * 252 * 100) / te : null, benchRet: growth(br) * 100 };
  }), [list, R]);
  const best = rows.filter((r) => r.ok).sort((a, b) => ((b as { r2: number | null }).r2 ?? -1) - ((a as { r2: number | null }).r2 ?? -1))[0];
  const save = async (b: string) => {
    setMsg("保存中…");
    try {
      await ucPost("ucHubs.savePortfolio", { owner: ownerId(), data: { holdings: pf.data?.holdings ?? [], benchmark: b, cash: pf.data?.cash ?? 0 } });
      setChosen(b);
      setMsg(`已将基准设为 ${nameOfBench(b)}，组合总览、跟踪误差等功能将按新基准计算`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "保存失败"); }
  };
  const cur = rows.find((r) => r.b === current);
  return (
    <PanelShell code="BBU" title="基准管理" onClose={onClose} right={<span>当前基准：{nameOfBench(current)}</span>}>
      <Kpis items={[
        ["当前基准", nameOfBench(current), current],
        ["与当前基准相关性", cur?.ok ? f2(cur.cor, 2) : "—", cur?.ok ? `决定系数 ${f2(cur.r2, 2)}` : undefined],
        ["拟合度最高的候选", best ? nameOfBench(best.b) : "—", best?.ok ? `决定系数 ${f2(best.r2, 2)}` : undefined],
        ["回放覆盖", `${(R.coverage * 100).toFixed(0)}%`, "有一年日线的持仓市值占比"],
      ]} />
      <SectionHead title="候选基准拟合度（当前持仓一年日收益）" sub="决定系数越高，基准越能解释组合波动" />
      <table className="w-full text-[11px]">
        <thead className={th}><tr><th className="px-2 py-1 text-left">基准</th><th className="text-right">样本日</th><th className="text-right">相关性</th><th className="text-right">决定系数</th><th className="text-right">贝塔</th><th className="text-right">基准收益</th><th className="text-right">主动收益</th><th className="text-right">跟踪误差</th><th className="text-right">信息比率</th><th className="px-2 text-right">操作</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.b} className="border-t border-[#0f1b29]">
            <td className="px-2 py-0.5 text-slate-100">{nameOfBench(r.b)}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.b}</span>{r.b === current && <span className="ml-1 text-[9px] text-amber-300">当前</span>}{best?.b === r.b && <span className="ml-1 text-[9px] text-sky-300">最佳拟合</span>}</td>
            {r.ok ? <>
              <td className="text-right font-mono text-slate-500">{r.n}</td>
              <td className="text-right font-mono" style={{ background: heat((r.cor ?? 0) * 100, 100) }}>{f2(r.cor, 2)}</td>
              <td className="text-right font-mono text-white">{f2(r.r2, 2)}</td>
              <td className="text-right font-mono">{f2(r.beta, 2)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.benchRet) }}>{sgn(r.benchRet)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.activeRet) }}>{sgn(r.activeRet)}</td>
              <td className="text-right font-mono text-amber-200">{f2(r.te, 2, "%")}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.ir) }}>{f2(r.ir, 2)}</td>
            </> : <td colSpan={8} className="text-right text-slate-600">{R.loading ? "计算中…" : "历史数据不足"}</td>}
            <td className="px-2 text-right">{r.b !== current && r.ok && <button type="button" onClick={() => void save(r.b)} className="border border-sky-700 px-1.5 text-[10px] text-sky-200 hover:bg-sky-900/40">设为基准</button>}</td>
          </tr>))}
          {!book.rows.length && <tr><td colSpan={10}><Empty loading={book.loading} text="暂无持仓" /></td></tr>}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t border-[#1a2a3c] px-2 py-1.5 text-[11px]">
        <span className="text-slate-500">加入其他候选（指数或 ETF 代码）</span>
        <input value={custom} onChange={(e) => setCustom(e.target.value.trim())} placeholder="如 QQQ、^N225、sz399006" className="w-48 border border-[#1a2a3c] bg-[#06101b] px-1.5 py-0.5 font-mono text-slate-200 outline-none" />
        <button type="button" disabled={!custom} onClick={() => { setExtra((x) => [...new Set([...x, custom])]); setCustom(""); }} className="border border-[#2a3c52] px-2 text-slate-300 hover:bg-[#0a1726] disabled:opacity-40">加入比较</button>
        {msg && <span className="ml-2 text-amber-200">{msg}</span>}
      </div>
      {book.isDefault && <Note>交易账户与组合页暂无持仓，以上按默认持仓计算。</Note>}
    </PanelShell>
  );
}

/* ================================================================== PORT IP 日内业绩 */
type Path = { t: number[]; pnl: number[] };
function IntradayRow({ r, onPath, pick }: { r: BookRow; onPath: (s: string, p: Path | null) => void; pick: (s: string) => void }) {
  const k = useKline(r.symbol, "5m", 160);
  const prev = r.price != null && r.changePct != null ? r.price / (1 + r.changePct / 100) : null;
  const today = useMemo(() => {
    const c = k.candles;
    if (!c.length) return [];
    const d = new Date(c[c.length - 1].t).toDateString();
    return c.filter((x) => new Date(x.t).toDateString() === d && !x.s);
  }, [k.candles]);
  const path = useMemo<Path | null>(() => (prev && today.length ? { t: today.map((x) => x.t), pnl: today.map((x) => r.qty * r.mult * r.fx * (x.c - prev)) } : null), [today, prev, r.qty, r.mult, r.fx]);
  useEffect(() => { onPath(r.symbol, path); }, [path, r.symbol, onPath]);
  const hi = today.length ? Math.max(...today.map((x) => x.h)) : null;
  const lo = today.length ? Math.min(...today.map((x) => x.l)) : null;
  const pos = hi != null && lo != null && r.price != null && hi > lo ? ((r.price - lo) / (hi - lo)) * 100 : null;
  const vwapDen = today.reduce((s, x) => s + (x.v ?? 0), 0);
  const vwap = vwapDen ? today.reduce((s, x) => s + (x.v ?? 0) * (x.h + x.l + x.c) / 3, 0) / vwapDen : null;
  return (
    <tr onClick={() => pick(r.symbol)} className={tr}>
      <td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td>
      <td className="text-right font-mono text-white">{fmtPrice(r.price)}</td>
      <td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td>
      <td className="text-right font-mono" style={{ color: toneOf(r.day) }}>{fmtCompact(r.day)}</td>
      <td className="text-right font-mono text-slate-300">{vwap ? fmtPrice(vwap) : "—"}</td>
      <td className="text-right font-mono" style={{ color: toneOf(vwap && r.price ? r.price - vwap : null) }}>{vwap && r.price ? sgn((r.price / vwap - 1) * 100) : "—"}</td>
      <td className="text-right font-mono text-slate-400">{pos == null ? "—" : `${pos.toFixed(0)}%`}</td>
      <td className="px-2">{today.length > 2 ? <Spark values={today.map((x) => x.c)} width={110} color={(r.changePct ?? 0) >= 0 ? "#f2495c" : "#1fbf75"} /> : <span className="text-[10px] text-slate-600">{k.loading ? "…" : "今日未开盘"}</span>}</td>
    </tr>
  );
}

export function PortIntradayLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const rows = book.rows.filter((r) => r.mv).slice(0, 24);
  const [paths, setPaths] = useState<Record<string, Path | null>>({});
  const onPath = useMemo(() => (s: string, p: Path | null) => setPaths((m) => (m[s] === p ? m : { ...m, [s]: p })), []);
  const dayTot = rows.reduce((a, r) => a + r.day, 0);
  const contrib = rows.map((r) => ({ r, bps: book.total ? (r.day / (book.total - dayTot)) * 1e4 : 0 })).sort((a, b) => b.bps - a.bps);
  const curve = useMemo(() => {
    const live = Object.values(paths).filter((p): p is Path => !!p && p.t.length > 0);
    if (!live.length) return null;
    const ts = [...new Set(live.flatMap((p) => p.t))].sort((a, b) => a - b);
    const tot = ts.map((t) => live.reduce((s, p) => { let i = -1; for (let j = 0; j < p.t.length && p.t[j] <= t; j++) i = j; return s + (i >= 0 ? p.pnl[i] : 0); }, 0));
    return { ts, tot };
  }, [paths]);
  const best = contrib[0], worst = contrib[contrib.length - 1];
  const up = rows.filter((r) => (r.changePct ?? 0) > 0).length;
  return (
    <PanelShell code="PORT IP" title="日内业绩" onClose={onClose} right={<span>5 分钟线 · 统一折算美元</span>}>
      <Kpis items={[
        ["今日组合盈亏", <span style={{ color: toneOf(dayTot) }}>{usd(dayTot)}</span>, book.total ? sgn((dayTot / (book.total - dayTot)) * 100) : undefined],
        ["上涨 / 下跌持仓", `${up} / ${rows.length - up}`],
        ["最大正贡献", best ? best.r.name : "—", best ? `${best.bps.toFixed(1)} 基点` : undefined],
        ["最大负贡献", worst && worst.bps < 0 ? worst.r.name : "—", worst && worst.bps < 0 ? `${worst.bps.toFixed(1)} 基点` : undefined],
      ]} />
      <SectionHead title="组合盘中盈亏路径（美元）" sub="各持仓按 5 分钟收盘价相对昨收累计；不同市场交易时段依次叠加" />
      {curve && curve.ts.length > 2 ? <Lines series={[{ name: "累计盈亏", color: dayTot >= 0 ? "#f2495c" : "#1fbf75", values: curve.tot }]} xLabels={curve.ts.map((t) => new Date(t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }))} height={170} fmt={(v) => fmtCompact(v)} zero /> : <Empty loading={book.loading} text="今日各持仓市场尚无盘中数据" />}
      <SectionHead title="收益贡献排序（基点）" />
      <Bars data={contrib.map(({ r, bps }) => ({ k: r.name.slice(0, 8), v: bps }))} fmt={(v) => v.toFixed(1)} height={130} />
      <SectionHead title="持仓盘中表现" sub="相对成交量加权均价的位置，以及现价在今日高低区间中的位置" />
      <table className="w-full text-[11px]">
        <thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">现价</th><th className="text-right">涨跌幅</th><th className="text-right">今日($)</th><th className="text-right">均价</th><th className="text-right">相对均价</th><th className="text-right">日内位置</th><th className="px-2 text-left">今日走势</th></tr></thead>
        <tbody>{rows.map((r) => <IntradayRow key={r.symbol} r={r} onPath={onPath} pick={pick} />)}{!rows.length && <tr><td colSpan={8}><Empty loading={book.loading} text="暂无持仓" /></td></tr>}</tbody>
      </table>
    </PanelShell>
  );
}

/* ================================================================== PDSP 持仓行情展示 */
export function PdspLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const rows = book.rows.slice(0, 40);
  const pack = useCloses(rows.map((r) => r.symbol), 300);
  const [sort, setSort] = useState<"w" | "m1" | "ytd" | "rng">("w");
  const data = useMemo(() => rows.map((r) => {
    const raw = pack.data?.[r.symbol] ?? [];
    const c = raw.map(([, v]) => v);
    if (r.price != null && c.length) c[c.length - 1] = r.price;
    const y = new Date().getFullYear();
    const yi = raw.findIndex(([t]) => new Date(t).getFullYear() === y);
    const last = c[c.length - 1];
    const w52 = c.slice(-252);
    const hi = w52.length ? Math.max(...w52) : null, lo = w52.length ? Math.min(...w52) : null;
    const ma = (n: number) => (c.length >= n ? mean(c.slice(-n)) : null);
    const m50 = ma(50), m200 = ma(200);
    const r20 = simple(c.slice(-21));
    return { r, w1: perf(c, 5), m1: perf(c, 21), m3: perf(c, 63), ytd: yi > 0 ? (last / c[yi - 1] - 1) * 100 : null, hi, lo, rng: hi != null && lo != null && hi > lo ? ((last - lo) / (hi - lo)) * 100 : null, d50: m50 ? (last / m50 - 1) * 100 : null, d200: m200 ? (last / m200 - 1) * 100 : null, vol20: r20.length > 5 ? std(r20) * Math.sqrt(252) * 100 : null, spark: c.slice(-60) };
  }).sort((a, b) => sort === "w" ? Math.abs(b.r.w) - Math.abs(a.r.w) : ((b[sort] ?? -1e9) as number) - ((a[sort] ?? -1e9) as number)), [rows, pack.data, sort]);
  const above200 = data.filter((d) => (d.d200 ?? 0) > 0).length;
  const nearHi = data.filter((d) => (d.rng ?? 0) >= 90).length;
  const nearLo = data.filter((d) => d.rng != null && d.rng <= 10).length;
  const S = ({ k, children }: { k: typeof sort; children: React.ReactNode }) => <button type="button" onClick={() => setSort(k)} className={sort === k ? "text-amber-300" : "hover:text-slate-300"}>{children}</button>;
  return (
    <PanelShell code="PDSP" title="持仓行情展示" onClose={onClose} right={<span>点击列名排序 · 点击标的看 K 线</span>}>
      <Kpis items={[["持仓数", String(data.length)], ["站上 200 日均线", `${above200} / ${data.length}`], ["接近一年高点", String(nearHi), "处于一年区间 90% 以上"], ["接近一年低点", String(nearLo), "处于一年区间 10% 以下"]]} />
      <table className="w-full text-[11px]">
        <thead className={th}><tr><th className="px-2 py-1 text-left"><S k="w">标的 / 权重</S></th><th className="text-left">市场</th><th className="text-right">现价</th><th className="text-right">今日</th><th className="text-right">1 周</th><th className="text-right"><S k="m1">1 月</S></th><th className="text-right">3 月</th><th className="text-right"><S k="ytd">年初至今</S></th><th className="px-2 text-left"><S k="rng">一年区间位置</S></th><th className="text-right">距 50 日线</th><th className="text-right">距 200 日线</th><th className="text-right">20 日波动</th><th className="px-2 text-left">60 日走势</th></tr></thead>
        <tbody>{data.map((d) => (
          <tr key={d.r.symbol} onClick={() => pick(d.r.symbol)} className={tr}>
            <td className="px-2 py-0.5 text-slate-100">{d.r.name}<span className="ml-1 font-mono text-[9px] text-slate-500">{(d.r.w * 100).toFixed(1)}%</span></td>
            <td className="text-slate-400">{MARKET_ZH[d.r.market] ?? d.r.market}</td>
            <td className="text-right font-mono text-white">{fmtPrice(d.r.price)}</td>
            {[d.r.changePct, d.w1, d.m1, d.m3, d.ytd].map((v, i) => <td key={i} className="text-right font-mono" style={{ color: toneOf(v) }}>{sgn(v)}</td>)}
            <td className="px-2"><div className="flex items-center gap-1"><span className="font-mono text-[9px] text-slate-600">{fmtPrice(d.lo)}</span><div className="relative h-1.5 w-20 bg-[#13243a]">{d.rng != null && <div className="absolute top-[-2px] h-2.5 w-1 bg-amber-300" style={{ left: `${Math.max(0, Math.min(100, d.rng))}%` }} />}</div><span className="font-mono text-[9px] text-slate-600">{fmtPrice(d.hi)}</span></div></td>
            <td className="text-right font-mono" style={{ color: toneOf(d.d50) }}>{sgn(d.d50, 1)}</td>
            <td className="text-right font-mono" style={{ color: toneOf(d.d200) }}>{sgn(d.d200, 1)}</td>
            <td className="text-right font-mono text-slate-300">{f2(d.vol20, 1, "%")}</td>
            <td className="px-2">{d.spark.length > 5 ? <Spark values={d.spark} width={100} color={(d.m3 ?? 0) >= 0 ? "#f2495c" : "#1fbf75"} /> : null}</td>
          </tr>))}
          {!data.length && <tr><td colSpan={13}><Empty loading={book.loading || pack.loading} text="暂无持仓" /></td></tr>}
        </tbody>
      </table>
    </PanelShell>
  );
}

/* ================================================================== PORT TE 跟踪误差 */
export function PortTeLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const bench = book.benchmark;
  const R = useBookReturns(book, 520, [bench]);
  const res = useMemo(() => {
    const c = R.m[bench] ?? [];
    const n = Math.min(R.rp.length, c.length - 1);
    if (n < 80) return null;
    const rp = R.rp.slice(-n), br = simple(c).slice(-n), act = rp.map((x, i) => x - br[i]);
    const roll = act.map((_, i) => (i >= 59 ? std(act.slice(i - 59, i + 1)) * Math.sqrt(252) * 100 : null)).slice(-252);
    const a1 = act.slice(-252), p1 = rp.slice(-252), b1 = br.slice(-252);
    const te = std(a1) * Math.sqrt(252) * 100;
    const vb = covar(b1, b1);
    const beta = vb ? covar(p1, b1) / vb : null;
    const va = covar(a1, a1);
    const hold = R.have.map((h, i) => {
      const ri = R.R[i].slice(-a1.length);
      const bi = vb ? covar(ri, b1) / vb : null;
      const share = va ? (R.w[i] * covar(ri, a1)) / va : 0;
      return { h, w: R.w[i], beta: bi, share, te: share * te };
    }).sort((x, y) => y.share - x.share);
    let cum = 1, cb = 1;
    const relCurve = p1.map((x, i) => { cum *= 1 + x; cb *= 1 + b1[i]; return (cum / cb - 1) * 100; });
    return { te, beta, active: (growth(p1) - growth(b1)) * 100, ir: te ? (mean(a1) * 252 * 100) / te : null, roll, hold, relCurve, hit: (a1.filter((x) => x > 0).length / a1.length) * 100, dates: R.dates.slice(-roll.length) };
  }, [R, bench]);
  return (
    <PanelShell code="PORT TE" title="跟踪误差" onClose={onClose} right={<span>基准：{BENCH_ZH[bench] ?? nameOfBench(bench)}</span>}>
      <Kpis items={[
        ["事后跟踪误差（一年）", res ? `${res.te.toFixed(2)}%` : "—", "主动收益日波动年化"],
        ["主动收益（一年）", res ? <span style={{ color: toneOf(res.active) }}>{sgn(res.active)}</span> : "—"],
        ["信息比率", res ? f2(res.ir, 2) : "—", res ? `跑赢基准天数 ${res.hit.toFixed(0)}%` : undefined],
        ["相对基准贝塔", res ? f2(res.beta, 2) : "—"],
      ]} />
      {!res ? <Empty loading={R.loading || book.loading} text="持仓或基准历史数据不足" /> : <>
        <SectionHead title="60 日滚动跟踪误差（%）与累计相对收益（%）" />
        <Lines series={[{ name: "滚动跟踪误差", color: "#fbbf24", values: res.roll }, { name: "累计相对收益", color: "#38bdf8", values: res.relCurve.slice(-res.roll.length) }]} xLabels={res.dates.map((d) => d.slice(2))} height={180} fmt={(v) => v.toFixed(2)} zero />
        <SectionHead title="主动风险来源" sub="占比为负的持仓在降低跟踪误差" />
        <table className="w-full text-[11px]">
          <thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">权重</th><th className="text-right">相对基准贝塔</th><th className="text-right">跟踪误差占比</th><th className="px-2 text-right">贡献（百分点）</th></tr></thead>
          <tbody>{res.hold.map((x) => <tr key={x.h.symbol} onClick={() => pick(x.h.symbol)} className={tr}><td className="px-2 py-0.5 text-slate-100">{x.h.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.h.symbol}</span></td><td className="text-right font-mono">{(x.w * 100).toFixed(1)}%</td><td className="text-right font-mono">{f2(x.beta, 2)}</td><td className="text-right font-mono" style={{ background: heat(x.share * 100, 60) }}>{(x.share * 100).toFixed(1)}%</td><td className="px-2 text-right font-mono text-amber-200">{x.te.toFixed(2)}</td></tr>)}</tbody>
        </table>
        <Note>数据覆盖持仓市值的 {(R.coverage * 100).toFixed(0)}%；按当前权重回看，不含历史调仓。更换基准请在基准管理中操作。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== PORT CH 组合特征（含持仓分析） */
type Prof = { symbol: string; name: string | null; sector: string | null; industry: string | null; metrics: Array<{ key: string; label: string; value: number | null; unit?: string }> };
const METRICS: Array<[string, string, "harm" | "avg"]> = [["pe", "市盈率", "harm"], ["pb", "市净率", "harm"], ["ps", "市销率", "harm"], ["margin", "净利率", "avg"], ["revYoY", "营收同比", "avg"], ["niYoY", "净利同比", "avg"], ["mcap", "总市值", "avg"]];

export function PortCharLive({ onClose }: P) {
  const book = useBook();
  const { pick } = useHub();
  const rows = book.rows.filter((r) => r.mv > 0).slice(0, 30);
  const key = rows.map((r) => r.symbol).join("|");
  const [profs, setProfs] = useState<Record<string, Prof | null>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setLoading(true);
    void Promise.all(key.split("|").map((s) => ucGet<Prof | null>("ucMarket.profile", { symbol: s }).then((p) => [s, p] as const).catch(() => [s, null] as const))).then((all) => { if (alive) { setProfs(Object.fromEntries(all)); setLoading(false); } });
    return () => { alive = false; };
  }, [key]);
  const val = (s: string, k: string) => profs[s]?.metrics.find((m) => m.key === k)?.value ?? null;
  // 总市值各持仓币种不同，不做加权汇总，只在逐项表中按原币展示
  const agg = METRICS.filter(([k]) => k !== "mcap").map(([k, label, how]) => {
    const pts = rows.map((r) => ({ w: r.w, v: val(r.symbol, k) })).filter((p) => p.v != null && Number.isFinite(p.v)) as Array<{ w: number; v: number }>;
    const W = pts.reduce((s, p) => s + p.w, 0);
    if (!W) return { k, label, v: null as number | null, cov: 0 };
    const v = how === "harm" ? (() => { const pos = pts.filter((p) => p.v > 0); const w2 = pos.reduce((s, p) => s + p.w, 0); return w2 ? w2 / pos.reduce((s, p) => s + p.w / p.v, 0) : null; })() : pts.reduce((s, p) => s + p.w * p.v, 0) / W;
    return { k, label, v, cov: W };
  });
  const sectors = Object.entries(rows.reduce<Record<string, number>>((a, r) => { const s = profs[r.symbol]?.sector || (profs[r.symbol] === undefined ? "读取中" : "其他 / 基金"); a[s] = (a[s] ?? 0) + r.w * 100; return a; }, {})).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const fmtM = (k: string, v: number | null) => (v == null ? "—" : k === "mcap" ? fmtCompact(v) : ["margin", "revYoY", "niYoY"].includes(k) ? `${v.toFixed(1)}%` : v.toFixed(2));
  return (
    <PanelShell code="PORT CH" title="组合特征与持仓基本面" onClose={onClose} right={<span>{loading ? "读取基本面…" : `${rows.length} 个多头持仓`}</span>}>
      <Kpis items={agg.slice(0, 4).map((a) => [`加权${a.label}`, fmtM(a.k, a.v), a.cov ? `覆盖 ${(a.cov * 100).toFixed(0)}% 市值` : "无可用数据"] as [string, React.ReactNode, string])} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[1fr_1.2fr]">
        <div className="bg-[#03070c]">
          <SectionHead title="行业分布（市值权重 %）" />
          <Bars data={sectors} fmt={(v) => `${v.toFixed(1)}%`} height={Math.max(120, sectors.length * 18)} />
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="组合加权特征" />
          <table className="w-full text-[11px]"><tbody>{agg.map((a) => <tr key={a.k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-300">{a.label}</td><td className="text-right font-mono text-white">{fmtM(a.k, a.v)}</td><td className="px-2 text-right text-[10px] text-slate-500">覆盖 {(a.cov * 100).toFixed(0)}%</td></tr>)}</tbody></table>
        </div>
      </div>
      <SectionHead title="持仓基本面" sub="点击标的看 K 线" />
      <table className="w-full text-[11px]">
        <thead className={th}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">权重</th><th className="text-left">行业</th>{METRICS.map(([k, l]) => <th key={k} className="text-right">{l}</th>)}<th className="px-2" /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.symbol} onClick={() => pick(r.symbol)} className={tr}><td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td><td className="text-right font-mono">{(r.w * 100).toFixed(1)}%</td><td className="text-[10px] text-slate-400">{profs[r.symbol]?.industry || profs[r.symbol]?.sector || (profs[r.symbol] === undefined ? "…" : "—")}</td>{METRICS.map(([k]) => { const v = val(r.symbol, k); return <td key={k} className="text-right font-mono" style={{ color: ["revYoY", "niYoY"].includes(k) ? toneOf(v) : undefined }}>{fmtM(k, v)}</td>; })}<td className="px-2" /></tr>)}
          {!rows.length && <tr><td colSpan={METRICS.length + 4}><Empty loading={book.loading} text="暂无多头持仓" /></td></tr>}</tbody>
      </table>
    </PanelShell>
  );
}
