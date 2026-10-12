/**
 * 终端补充三个窗口（全部真实数据）：
 *  - 市场情绪（价格隐含）：波动率水平与期限结构、期权看跌看涨比与偏斜、信用与避险资产相对表现、趋势与行业广度，合成 0–100 情绪分。
 *    （新闻情绪在新闻终端与 TOP / NL 中，这里只用价格与期权数据。）
 *  - 选股筛选器：按市场、涨跌幅、成交额、市值、相对放量多条件筛选并排序。
 *  - GIY 日内收益率：美债 3 个月 / 5 年 / 10 年 / 30 年收益率 5 分钟走势、日内变动与曲线利差。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useKline, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, Seg, useFeed, type News } from "@/uc/news/kit";
import { Lines, useHub } from "@/uc/hubs/kit";
import { f2, heat, mean, perf, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";

const pctRank = (arr: number[], v: number) => (arr.length ? (arr.filter((x) => x <= v).length / arr.length) * 100 : null);
const closesOf = (pack: Record<string, Array<[number, number]>> | null | undefined, s: string) => (pack?.[s] ?? []).map(([, v]) => v);

/* ================================================================== 市场情绪（价格隐含） */
const SECTORS = ["XLK", "XLF", "XLV", "XLY", "XLP", "XLE", "XLI", "XLB", "XLU", "XLRE", "XLC"];
type OptStats = { stats: { pcVolumeAll: number; pcOiAll: number; atmIv: number | null; skew25: number | null } };
export function SentLive({ onClose, title }: P & { title?: string }) {
  const pack = useCloses(["^VIX", "^VIX3M", "SPY", "HYG", "LQD", "GLD", "TLT", ...SECTORS], 300);
  const t = useTicks(["^VIX", "^VIX3M", "SPY"]);
  const spy = usePolled<OptStats>("ucHubs.options", { symbol: "SPY" }, 300_000);
  const res = useMemo(() => {
    const vix = closesOf(pack.data, "^VIX"), v3 = closesOf(pack.data, "^VIX3M"), s = closesOf(pack.data, "SPY");
    if (vix.length < 60 || s.length < 210) return null;
    const vNow = t["^VIX"]?.price ?? vix[vix.length - 1];
    const v3Now = t["^VIX3M"]?.price ?? v3[v3.length - 1];
    const sNow = t.SPY?.price ?? s[s.length - 1];
    const vixRank = pctRank(vix.slice(-252), vNow);
    const termHist = vix.slice(-252).map((x, i) => { const y = v3.slice(-252)[i]; return y ? x / y : NaN; }).filter(Number.isFinite);
    const term = v3Now ? vNow / v3Now : null;
    const termRank = term != null ? pctRank(termHist, term) : null;
    const rel = (a: string, b: string, n = 20) => { const x = closesOf(pack.data, a), y = closesOf(pack.data, b); const pa = perf(x, n), pb = perf(y, n); return pa != null && pb != null ? pa - pb : null; };
    const relHist = (a: string, b: string, n = 20) => { const x = closesOf(pack.data, a), y = closesOf(pack.data, b); const L = Math.min(x.length, y.length); const out: number[] = []; for (let i = L - 250; i < L; i++) if (i > n) out.push((x[i] / x[i - n] - y[i] / y[i - n]) * 100); return out; };
    const credit = rel("HYG", "LQD"), creditRank = credit != null ? pctRank(relHist("HYG", "LQD"), credit) : null;
    const haven = rel("SPY", "TLT"), havenRank = haven != null ? pctRank(relHist("SPY", "TLT"), haven) : null;
    const gold = rel("SPY", "GLD");
    const ma200 = mean(s.slice(-200)), ma50 = mean(s.slice(-50));
    const trend = (sNow / ma200 - 1) * 100;
    const trendHist = s.slice(-250).map((_, k) => { const i = s.length - 250 + k; const m = mean(s.slice(Math.max(0, i - 199), i + 1)); return (s[i] / m - 1) * 100; });
    const trendRank = pctRank(trendHist, trend);
    const above = SECTORS.map((x) => { const c = closesOf(pack.data, x); return c.length > 50 ? c[c.length - 1] > mean(c.slice(-50)) : null; }).filter((x) => x != null) as boolean[];
    const breadth = above.length ? (above.filter(Boolean).length / above.length) * 100 : null;
    const r = s.slice(-21).map((v, i, a) => (i ? Math.log(v / a[i - 1]) : 0)).slice(1);
    const rv = std(r) * Math.sqrt(252) * 100;
    // 组件分：越高越“贪婪 / 风险偏好”
    const parts: Array<[string, number | null, string]> = [
      ["波动率水平", vixRank == null ? null : 100 - vixRank, `VIX ${vNow.toFixed(2)}，近一年 ${vixRank?.toFixed(0)}% 分位`],
      ["波动率期限结构", termRank == null ? null : 100 - termRank, `近月 / 3 个月比 ${term?.toFixed(3) ?? "—"}${term != null && term > 1 ? "（倒挂，避险）" : ""}`],
      ["信用偏好", creditRank, `高收益债相对投资级 20 日 ${sgn(credit)}`],
      ["股债偏好", havenRank, `股票相对长债 20 日 ${sgn(haven)}`],
      ["趋势", trendRank, `标普 500 ETF 距 200 日线 ${sgn(trend)}`],
      ["行业广度", breadth, `${above.filter(Boolean).length} / ${above.length} 个行业站上 50 日线`],
    ];
    const ok = parts.filter((p) => p[1] != null);
    const score = ok.length ? mean(ok.map((p) => p[1] as number)) : null;
    return { parts, score, vNow, v3Now, term, rv, ma50, ma200, sNow, gold, vixSeries: vix.slice(-120), termSeries: termHist.slice(-120) };
  }, [pack.data, t]);
  const o = spy.data?.stats;
  const label = (s: number | null) => (s == null ? "—" : s >= 75 ? "极度乐观" : s >= 55 ? "乐观" : s > 45 ? "中性" : s > 25 ? "谨慎" : "极度恐慌");
  return (
    <PanelShell code="SENT" title={title ?? "市场情绪（价格隐含）"} onClose={onClose}>
      <Kpis items={[
        ["综合情绪分", res?.score != null ? <span style={{ color: res.score >= 50 ? "#f2495c" : "#1fbf75" }}>{res.score.toFixed(0)}</span> : "—", label(res?.score ?? null)],
        ["VIX", res ? res.vNow.toFixed(2) : "—", res ? `隐含 vs 已实现（20 日）${(res.vNow - res.rv).toFixed(1)} 个点` : undefined],
        ["标普期权看跌 / 看涨", o ? f2(o.pcVolumeAll, 2) : "—", o ? `持仓比 ${f2(o.pcOiAll, 2)}` : "按成交量"],
        ["25 Delta 偏斜", o?.skew25 != null ? `${(o.skew25 * (o.skew25 < 1 ? 100 : 1)).toFixed(1)} 点` : "—", "看跌隐波 − 看涨隐波"],
      ]} />
      {!res ? <Empty loading={pack.loading} /> : <>
        <SectionHead title="情绪构成（0 = 极度恐慌，100 = 极度乐观）" sub="各项为近一年历史分位，综合分为等权平均" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>维度</th><th className={TH}>得分</th><th className="px-2 text-left">位置</th><th className={THL}>当前读数</th></tr></thead>
          <tbody>{res.parts.map(([l, v, d]) => <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className={`${TD} text-white`}>{v == null ? "—" : v.toFixed(0)}</td><td className="px-2"><div className="relative h-2 w-40 bg-gradient-to-r from-[#1fbf75]/40 via-slate-700 to-[#f2495c]/40">{v != null && <div className="absolute top-[-2px] h-3 w-1 bg-white" style={{ left: `${Math.max(0, Math.min(100, v))}%` }} />}</div></td><td className="px-2 text-[10px] text-slate-400">{d}</td></tr>)}</tbody>
        </table>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="VIX（近 120 日）" /><Lines series={[{ name: "VIX", color: "#f472b6", values: res.vixSeries }]} height={130} fmt={(v) => v.toFixed(1)} /></div>
          <div className="bg-[#03070c]"><SectionHead title="VIX 近月 / 3 个月比（>1 为倒挂）" /><Lines series={[{ name: "期限比", color: "#fbbf24", values: res.termSeries }]} height={130} fmt={(v) => v.toFixed(3)} /></div>
        </div>
        <Note>情绪分只使用价格与期权数据；新闻情绪请看新闻终端。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== 选股筛选器 */
type MostRow = { symbol: string; name: string; price: number | null; changePct: number | null; volume: number | null; amount: number | null; mcap: number | null; relVol: number | null };
type Most = { lists: Record<string, MostRow[]> };
const MKT: Array<["us" | "cn" | "hk", string]> = [["us", "美股"], ["cn", "A股"], ["hk", "港股"]];
export function ScreenLive({ onClose, title }: P & { title?: string }) {
  const { pick } = useHub();
  const [mkt, setMkt] = useState<"us" | "cn" | "hk">("us");
  const most = usePolled<Most>("ucHubs.most", { market: mkt }, 120_000);
  const [f, setF] = useState({ chgMin: "", chgMax: "", amtMin: "", capMin: "", capMax: "", relMin: "", q: "" });
  const [sort, setSort] = useState<keyof MostRow>("amount");
  const pool = useMemo(() => { const m = new Map<string, MostRow>(); for (const l of Object.values(most.data?.lists ?? {})) for (const r of l) m.set(r.symbol, r); return [...m.values()]; }, [most.data]);
  const n = (s: string) => (s.trim() === "" ? null : Number(s));
  const unit = mkt === "us" ? 1e9 : 1e8;
  const rows = pool.filter((r) => {
    const c = r.changePct ?? 0;
    if (n(f.chgMin) != null && c < n(f.chgMin)!) return false;
    if (n(f.chgMax) != null && c > n(f.chgMax)!) return false;
    if (n(f.amtMin) != null && (r.amount ?? 0) < n(f.amtMin)! * unit) return false;
    if (n(f.capMin) != null && (r.mcap ?? 0) < n(f.capMin)! * unit) return false;
    if (n(f.capMax) != null && (r.mcap ?? Infinity) > n(f.capMax)! * unit) return false;
    if (n(f.relMin) != null && (r.relVol ?? 0) < n(f.relMin)!) return false;
    if (f.q && !`${r.symbol}${r.name}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => ((b[sort] as number) ?? -Infinity) - ((a[sort] as number) ?? -Infinity));
  const box = "w-16 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white outline-none";
  const unitL = mkt === "us" ? "十亿" : "亿";
  const H = ({ k, children }: { k: keyof MostRow; children: React.ReactNode }) => <th className={TH}><button type="button" onClick={() => setSort(k)} className={sort === k ? "text-amber-300" : "hover:text-slate-300"}>{children}</button></th>;
  return (
    <PanelShell code="EQS" title={title ?? "选股筛选器"} onClose={onClose} right={<Seg value={mkt} options={MKT} onChange={setMkt} />}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px] text-slate-400">
        <label>涨跌幅 % <input className={box} value={f.chgMin} onChange={(e) => setF({ ...f, chgMin: e.target.value })} placeholder="下限" /> ~ <input className={box} value={f.chgMax} onChange={(e) => setF({ ...f, chgMax: e.target.value })} placeholder="上限" /></label>
        <label>成交额 ≥ <input className={box} value={f.amtMin} onChange={(e) => setF({ ...f, amtMin: e.target.value })} /> {unitL}</label>
        <label>市值 <input className={box} value={f.capMin} onChange={(e) => setF({ ...f, capMin: e.target.value })} placeholder="下限" /> ~ <input className={box} value={f.capMax} onChange={(e) => setF({ ...f, capMax: e.target.value })} placeholder="上限" /> {unitL}</label>
        <label>相对放量 ≥ <input className={box} value={f.relMin} onChange={(e) => setF({ ...f, relMin: e.target.value })} placeholder="倍" /></label>
        <input className="w-32 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-[11px] text-white outline-none" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="代码 / 名称" />
        <button type="button" onClick={() => setF({ chgMin: "", chgMax: "", amtMin: "", capMin: "", capMax: "", relMin: "", q: "" })} className="border border-[#2a3c52] px-2 py-0.5 text-slate-200 hover:bg-[#0a1726]">清空条件</button>
      </div>
      <Kpis items={[["候选池", String(pool.length), "当日成交活跃、涨跌幅居前与放量的证券"], ["符合条件", String(rows.length)], ["上涨 / 下跌", `${rows.filter((r) => (r.changePct ?? 0) > 0).length} / ${rows.filter((r) => (r.changePct ?? 0) < 0).length}`], ["平均涨跌幅", rows.length ? sgn(mean(rows.map((r) => r.changePct ?? 0))) : "—"]]} />
      <div className="max-h-[480px] overflow-auto"><table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>证券</th><H k="price">现价</H><H k="changePct">涨跌幅</H><H k="amount">成交额</H><H k="volume">成交量</H><H k="mcap">市值</H><H k="relVol">相对放量</H></tr></thead>
        <tbody>{rows.slice(0, 300).map((r) => <tr key={r.symbol} onClick={() => pick(r.symbol)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td><td className={`${TD} text-white`}>{fmtPrice(r.price)}</td><td className={TD} style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className={TD}>{fmtCompact(r.amount)}</td><td className={TD}>{fmtCompact(r.volume)}</td><td className={TD}>{fmtCompact(r.mcap)}</td><td className={TD} style={{ background: heat(((r.relVol ?? 1) - 1) * 50, 100) }}>{f2(r.relVol, 2)}</td></tr>)}
          {!rows.length && <tr><td colSpan={7}><Empty loading={most.loading} text="没有符合条件的证券，放宽条件试试" /></td></tr>}</tbody>
      </table></div>
      <Note>候选池为各市场当日成交额、成交量、涨跌幅与放量排行的并集；点击证券在右侧看 K 线。</Note>
    </PanelShell>
  );
}

/* ================================================================== GIY 日内收益率 */
const YLDS: Array<[string, string]> = [["^IRX", "3 个月"], ["^FVX", "5 年"], ["^TNX", "10 年"], ["^TYX", "30 年"]];
export function GiyLive({ onClose }: P) {
  const k0 = useKline("^IRX", "5m", 300), k1 = useKline("^FVX", "5m", 300), k2 = useKline("^TNX", "5m", 300), k3 = useKline("^TYX", "5m", 300);
  const ks = [k0, k1, k2, k3];
  const t = useTicks(YLDS.map(([s]) => s));
  const [sel, setSel] = useState(2);
  const today = (c: typeof k0.candles) => { if (!c.length) return c; const d = new Date(c[c.length - 1].t).toDateString(); return c.filter((x) => new Date(x.t).toDateString() === d); };
  const days = ks.map((k) => today(k.candles));
  const prev = (i: number) => { const s = YLDS[i][0]; const tk = t[s]; return tk?.prevClose ?? (tk && tk.change != null ? tk.price - tk.change : null); };
  const rows = YLDS.map(([s, l], i) => { const d = days[i]; const last = t[s]?.price ?? d[d.length - 1]?.c ?? null; const p = prev(i); return { s, l, last, chg: last != null && p != null ? (last - p) * 100 : null, hi: d.length ? Math.max(...d.map((x) => x.h)) : null, lo: d.length ? Math.min(...d.map((x) => x.l)) : null, spark: d.map((x) => x.c) }; });
  const d = days[sel];
  const spread = useMemo(() => { const a = days[0], b = days[2]; const m = new Map(a.map((x) => [x.t, x.c])); return b.filter((x) => m.has(x.t)).map((x) => ({ t: x.t, v: (x.c - m.get(x.t)!) * 100 })); }, [days[0], days[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const r10 = rows[2], r5 = rows[1], r30 = rows[3];
  return (
    <PanelShell code="GIY" title="日内收益率" onClose={onClose} right={<Seg value={String(sel)} options={YLDS.map(([, l], i) => [String(i), l] as [string, string])} onChange={(v) => setSel(Number(v))} />}>
      <Kpis items={[["10 年期", r10.last != null ? `${r10.last.toFixed(3)}%` : "—", r10.chg != null ? `日内 ${sgn(r10.chg, 1, " bp")}` : undefined], ["5 年期", r5.last != null ? `${r5.last.toFixed(3)}%` : "—", r5.chg != null ? `日内 ${sgn(r5.chg, 1, " bp")}` : undefined], ["30 年期", r30.last != null ? `${r30.last.toFixed(3)}%` : "—", r30.chg != null ? `日内 ${sgn(r30.chg, 1, " bp")}` : undefined], ["10 年 − 3 个月", r10.last != null && rows[0].last != null ? `${((r10.last - rows[0].last) * 100).toFixed(1)} bp` : "—"]]} />
      <SectionHead title={`${YLDS[sel][1]}收益率 · 5 分钟（%）`} sub={d.length ? `今日 ${d.length} 根` : undefined} />
      {d.length > 2 ? <Lines series={[{ name: YLDS[sel][1], color: "#38bdf8", values: d.map((x) => x.c) }]} xLabels={d.map((x) => new Date(x.t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }))} height={180} fmt={(v) => v.toFixed(3)} /> : <Empty loading={ks[sel].loading} text="今日尚无盘中数据（美国国债现货收益率在美东交易时段更新）" />}
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>最新</th><th className={TH}>日内变动 bp</th><th className={TH}>日内高</th><th className={TH}>日内低</th><th className={TH}>区间 bp</th><th className="px-2">走势</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.s} onClick={() => setSel(i)} className={`cursor-pointer ${ROW} ${sel === i ? "bg-[#0a1726]" : ""}`}><td className={TDL}>{r.l}</td><td className={`${TD} text-white`}>{f2(r.last, 3)}</td><td className={TD} style={{ color: toneOf(r.chg) }}>{sgn(r.chg, 1, "")}</td><td className={TD}>{f2(r.hi, 3)}</td><td className={TD}>{f2(r.lo, 3)}</td><td className={TD}>{r.hi != null && r.lo != null ? ((r.hi - r.lo) * 100).toFixed(1) : "—"}</td><td className="px-2"><MiniLine values={r.spark} w={100} color="#38bdf8" /></td></tr>)}</tbody>
      </table>
      {spread.length > 2 && <><SectionHead title="10 年与 3 个月日内利差（bp）" /><Lines series={[{ name: "利差", color: "#fbbf24", values: spread.map((x) => x.v) }]} xLabels={spread.map((x) => new Date(x.t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }))} height={120} fmt={(v) => v.toFixed(1)} /></>}
    </PanelShell>
  );
}


/* ================================================================== RATC 评级变动追踪 */
const UPW = /上调|调升|upgrade|raised to|raises .*rating|outlook to positive|展望.*正面/i;
const DNW = /下调|调降|downgrade|cut to|lowers .*rating|outlook to negative|展望.*负面|列入.*观察/i;
export function RatcLive({ onClose }: P) {
  const zh = useFeed({ q: "评级", limit: 150, hours: 336 });
  const en = useFeed({ q: "rating", limit: 150, hours: 336 });
  const [side, setSide] = useState<"all" | "up" | "down">("all");
  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...zh.items, ...en.items].filter((n) => /评级|rating|穆迪|标普|惠誉|Moody|S&P|Fitch|中诚信|联合资信/i.test(n.title)).filter((n) => { const k = n.title.slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.time - a.time);
  }, [zh.items, en.items]);
  const cls = (n: News) => (UPW.test(n.title) ? "up" : DNW.test(n.title) ? "down" : "other");
  const ups = items.filter((n) => cls(n) === "up"), downs = items.filter((n) => cls(n) === "down");
  const list = side === "up" ? ups : side === "down" ? downs : items;
  const byAgency = ["穆迪|Moody", "标普|S&P", "惠誉|Fitch", "中诚信", "联合资信"].map((re) => ({ k: re.split("|")[0], v: items.filter((n) => new RegExp(re, "i").test(n.title)).length }));
  return (
    <PanelShell code="RATC" title="评级变动追踪" onClose={onClose} right={<Seg value={side} options={[["all", "全部"], ["up", "上调"], ["down", "下调 / 负面"]]} onChange={setSide} />}>
      <Kpis items={[["近两周评级相关报道", String(items.length)], ["上调", String(ups.length)], ["下调 / 负面观察", String(downs.length)], ["上调 / 下调比", downs.length ? (ups.length / downs.length).toFixed(2) : "—"]]} />
      <SectionHead title="按评级机构" sub="标题中提及该机构的报道数" />
      <table className="w-full text-[11px]"><tbody><tr>{byAgency.map((a) => <td key={a.k} className="border-r border-[#0f1b29] px-2 py-1 text-center"><div className="text-[10px] text-slate-500">{a.k}</div><div className="font-mono text-white">{a.v}</div></td>)}</tr></tbody></table>
      <SectionHead title="评级动态" sub="按标题关键词归类为上调 / 下调；点击阅读原文" />
      <FeedList items={list} loading={zh.loading || en.loading} dense max={150} empty="近两周暂无评级相关报道" />
    </PanelShell>
  );
}
