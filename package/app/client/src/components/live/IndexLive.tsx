/**
 * 指数中心 10 个功能页（全部实时数据，内容互不重复）：
 * SECF 全球证券检索 · WEIF 全球股指期货与基差 · WBIX 全球债券指数 · GMM 全球宏观异动 · AGG 自建合成指数
 * FDFD 议息会议概率 · OTHER_INDEX 因子 / 主题 / 另类加权指数 · WT 指数盘中走势 · INDEX_DERIV 指数期权 · BBG 债券与商品指数族
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useProfile, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { align, annVol, corr, drawdown, f2, heat, perf, rets, sgn, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import KlineChart from "@/uc/market/KlineChart";
import { useLiveKline, type Period } from "@/uc/market/live";

type P = { onClose?: () => void };

/* SECF */ export function IdxSECF({ onClose }: P) {
  const [q, setQ] = useState("semiconductor");
  const [input, setInput] = useState(q);
  const r = usePolled<Array<{ symbol: string; name: string; exchange: string; type: string; sector: string | null; industry: string | null }>>("ucHubs.search", { q }, 600_000);
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel ?? r.data?.[0]?.symbol ?? null;
  const p = useProfile(cur);
  const t = useTicks((r.data ?? []).slice(0, 25).map((x) => x.symbol));
  const { pick } = useHub();
  return (
    <PanelShell code="SECF" title="全球证券检索" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) setQ(input.trim()); }} className="flex items-center gap-2 px-2 py-1"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="名称 / 代码 / 行业关键词（中英文）" className="w-72 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" /><button className="border border-cyan-700 px-2 text-[11px] text-cyan-200">检索</button><span className="text-[10px] text-slate-500">覆盖全球股票、ETF、指数、期货、外汇、加密资产</span></form>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]"><table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">代码</th><th className="text-left">名称</th><th className="text-left">类别</th><th className="text-left">交易所</th><th className="text-right">最新</th><th className="px-2 text-right">涨跌幅</th></tr></thead>
          <tbody>{(r.data ?? []).map((x) => <tr key={x.symbol} onClick={() => setSel(x.symbol)} onDoubleClick={() => pick(x.symbol)} className={`cursor-pointer border-t border-[#0f1b29] ${cur === x.symbol ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 font-mono text-cyan-200">{x.symbol}</td><td className="text-slate-100">{x.name}</td><td className="text-[10px] text-slate-400">{x.type}</td><td className="text-[10px] text-slate-500">{x.exchange}</td><td className="text-right font-mono text-white">{fmtPrice(t[x.symbol]?.price)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(t[x.symbol]?.changePct) }}>{fmtPct(t[x.symbol]?.changePct)}</td></tr>)}{!r.data?.length && <tr><td colSpan={6}><Empty loading={r.loading} text="无匹配结果" /></td></tr>}</tbody></table></div>
        <div className="bg-[#03070c]">
          <SectionHead title={cur ? `${p.data?.name ?? cur} 概要` : "选择左侧证券"} right={cur ? <button type="button" onClick={() => pick(cur)} className="text-[10px] text-cyan-300 hover:underline">K 线 ›</button> : null} />
          <Kpis items={[["交易所", p.data?.exchange ?? "—"], ["行业", p.data?.industry ?? p.data?.sector ?? "—"], ["币种", p.data?.currency ?? "—"], ["最新", fmtPrice(cur ? t[cur]?.price : null)]]} />
          <table className="w-full text-[11px]"><tbody>{(p.data?.metrics ?? []).slice(0, 14).map((m) => <tr key={m.key} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-400">{m.label}</td><td className="px-2 text-right font-mono text-white">{m.value == null ? "—" : Math.abs(m.value) >= 1e6 ? fmtCompact(m.value) : `${m.value.toFixed(2)}${m.unit ?? ""}`}</td></tr>)}</tbody></table>
        </div>
      </div>
    </PanelShell>
  );
}

/* WEIF */ export function IdxWEIF({ onClose }: P) {
  const PAIRS: Array<[string, string, string]> = [["ES", "^GSPC", "标普 500"], ["NQ", "^NDX", "纳指 100"], ["YM", "^DJI", "道琼斯"], ["RTY", "^RUT", "罗素 2000"], ["NKD", "^N225", "日经 225"]];
  const t = useTicks(PAIRS.flatMap(([f, c]) => [f, c]));
  const curves = usePolled<Array<{ root: string; name: string; points: Array<{ code: string; month: string; price: number; changePct: number | null; volume: number | null }> }>>("ucHubs.futuresMany", { roots: ["ES", "NQ", "YM", "RTY"] }, 120_000);
  const pack = useCloses(PAIRS.flatMap(([f, c]) => [f, c]), 260);
  return (
    <PanelShell code="WEIF" title="全球股指期货与基差" onClose={onClose}>
      <SectionHead title="期货 vs 现货：实时基差" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">指数</th><th className="text-right">期货</th><th className="text-right">涨跌幅</th><th className="text-right">现货</th><th className="text-right">涨跌幅</th><th className="text-right">基差</th><th className="px-2 text-right">基差率</th></tr></thead>
        <tbody>{PAIRS.map(([f, c, l]) => { const fp = t[f]?.price, cp = t[c]?.price; const b = fp != null && cp != null ? fp - cp : null; return <tr key={f} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{l}</td><td className="text-right font-mono text-white">{fmtPrice(fp)}</td><td className="text-right font-mono" style={{ color: toneOf(t[f]?.changePct) }}>{fmtPct(t[f]?.changePct)}</td><td className="text-right font-mono text-slate-300">{fmtPrice(cp)}</td><td className="text-right font-mono" style={{ color: toneOf(t[c]?.changePct) }}>{fmtPct(t[c]?.changePct)}</td><td className="text-right font-mono" style={{ color: toneOf(b) }}>{b == null ? "—" : b.toFixed(2)}</td><td className="px-2 text-right font-mono text-slate-300">{b != null && cp ? `${((b / cp) * 100).toFixed(3)}%` : "—"}</td></tr>; })}</tbody>
      </table>
      <SectionHead title="各合约月价格（季月合约）" />
      <table className="w-full text-[11px]"><tbody>{(curves.data ?? []).map((c) => <tr key={c.root} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{c.name}</td>{c.points.map((p) => <td key={p.code} className="text-right font-mono text-slate-200"><div className="text-[9px] text-slate-500">{p.code}</div>{fmtPrice(p.price)}<div className="text-[9px]" style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)} · 量 {fmtCompact(p.volume)}</div></td>)}</tr>)}{!curves.data && <tr><td><Empty loading /></td></tr>}</tbody></table>
      <SectionHead title="期货与现货的日收益相关（1 年）" />
      <Bars data={PAIRS.map(([f, c, l]) => ({ k: l, v: corr(rets((pack.data?.[f] ?? []).map((x) => x[1]).slice(-253)), rets((pack.data?.[c] ?? []).map((x) => x[1]).slice(-253))) ?? 0 }))} fmt={(v) => v.toFixed(3)} height={110} />
    </PanelShell>
  );
}

/* WBIX */ export function IdxWBIX({ onClose }: P) {
  const L: Array<[string, string, string]> = [["AGG", "美国综合债", "美国"], ["GOVT", "美国国债", "美国"], ["LQD", "美国投资级", "美国"], ["HYG", "美国高收益", "美国"], ["TIP", "美国通胀保值", "美国"], ["BNDX", "国际债（对冲）", "全球"], ["BWX", "国际国债（未对冲）", "全球"], ["IGOV", "发达国家国债", "全球"], ["EMB", "新兴市场美元债", "新兴"], ["EMLC", "新兴市场本币债", "新兴"], ["CBON", "中国债券", "中国"], ["sh511260", "中国十年国债 ETF", "中国"], ["IBGL.L", "欧元区长期国债", "欧洲"], ["IGLT.L", "英国国债", "欧洲"], ["2510.T", "日本国债 ETF", "日本"]];
  const pack = useCloses(L.map(([s]) => s), 400);
  const t = useTicks(L.map(([s]) => s));
  const { pick } = useHub();
  return (
    <PanelShell code="WBIX" title="全球债券指数" onClose={onClose}>
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">指数代理</th><th className="text-left">地区</th><th className="text-right">最新</th><th className="text-right">今日</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="text-right">波动</th><th className="px-2 text-right">最大回撤</th></tr></thead>
        <tbody>{L.map(([s, l, r]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); return <tr key={s} onClick={() => pick(s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className="text-[10px] text-slate-500">{r}</td><td className="text-right font-mono text-white">{fmtPrice(t[s]?.price)}</td><td className="text-right font-mono" style={{ color: toneOf(t[s]?.changePct) }}>{fmtPct(t[s]?.changePct)}</td>{[21, 63, 252].map((n) => <td key={n} className="text-right font-mono" style={{ background: heat(perf(c, n), n / 25) }}>{sgn(perf(c, n), 2)}</td>)}<td className="text-right font-mono text-slate-400">{f2(annVol(c, 252), 1)}</td><td className="px-2 text-right font-mono text-emerald-300">{c.length ? sgn(drawdown(c.slice(-252)).max, 1) : "—"}</td></tr>; })}</tbody>
      </table>
    </PanelShell>
  );
}

/* GMM */ export function IdxGMM({ onClose }: P) {
  const U: Array<[string, string, string]> = [["^GSPC", "标普 500", "股指"], ["^IXIC", "纳斯达克", "股指"], ["^STOXX50E", "欧洲斯托克 50", "股指"], ["^N225", "日经 225", "股指"], ["^HSI", "恒生指数", "股指"], ["000300.SH", "沪深 300", "股指"], ["^KS11", "韩国综指", "股指"], ["^BSESN", "印度孟买", "股指"], ["^BVSP", "巴西", "股指"], ["^TNX", "美 10 年收益率", "利率"], ["^IRX", "美 13 周收益率", "利率"], ["DXY", "美元指数", "外汇"], ["EURUSD", "欧元", "外汇"], ["USDJPY", "日元", "外汇"], ["USDCNH", "离岸人民币", "外汇"], ["GC", "黄金", "商品"], ["CL", "原油", "商品"], ["HG", "铜", "商品"], ["NG", "天然气", "商品"], ["BTC", "比特币", "加密"], ["^VIX", "VIX", "波动率"], ["^MOVE", "美债波动率", "波动率"]];
  const t = useTicks(U.map(([s]) => s));
  const pack = useCloses(U.map(([s]) => s), 300);
  const rows = U.map(([s, l, g]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const r = rets(c.slice(-61)); const sd = r.length > 10 ? Math.sqrt(r.reduce((a, x) => a + x * x, 0) / r.length) * 100 : null; const d = t[s]?.changePct ?? null; return { s, l, g, d, z: d != null && sd ? d / sd : null, w1: perf(c, 5), m1: perf(c, 21) }; }).sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0));
  return (
    <PanelShell code="GMM" title="全球宏观异动（按波动标准化）" onClose={onClose}>
      <SectionHead title="今日异动倍数（|倍数| > 2 为显著异动）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th><th className="text-left">类别</th><th className="text-right">今日</th><th className="text-right">异动倍数</th><th className="text-right">1周</th><th className="px-2 text-right">1月</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{r.l}</td><td className="text-[10px] text-slate-500">{r.g}</td><td className="text-right font-mono" style={{ color: toneOf(r.d) }}>{fmtPct(r.d)}</td><td className="text-right font-mono font-semibold" style={{ background: heat(r.z, 3), color: "#fff" }}>{f2(r.z, 2)}</td><td className="text-right font-mono" style={{ color: toneOf(r.w1) }}>{sgn(r.w1)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(r.m1) }}>{sgn(r.m1)}</td></tr>)}</tbody>
      </table>
      <Bars data={rows.slice(0, 12).map((r) => ({ k: r.l, v: r.z ?? 0 }))} fmt={(v) => v.toFixed(2)} height={120} />
    </PanelShell>
  );
}

/* AGG 自建合成指数 */ type Comp = { name: string; items: Array<{ s: string; w: number }> };
export function IdxAGG({ onClose }: P) {
  const saved = useSaved<Comp[]>("aggidx");
  const [list, setList] = useState<Comp[] | null>(null);
  useEffect(() => { if (!saved.loading && list == null) setList(saved.data ?? [{ name: "亚洲科技龙头", items: [{ s: "2330.TW", w: 30 }, { s: "005930.KS", w: 25 }, { s: "0700.HK", w: 25 }, { s: "6758.T", w: 20 }] }]); }, [saved.loading]);
  const [sel, setSel] = useState(0);
  const cur = list?.[Math.min(sel, (list?.length ?? 1) - 1)];
  const syms = cur?.items.map((x) => x.s) ?? [];
  const pack = useCloses([...syms, "SPY"], 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, [...syms, "SPY"]), [pack.data, syms.join()]);
  const idx = useMemo(() => { if (!cur || !dates.length) return []; const tw = cur.items.reduce((a, x) => a + x.w, 0) || 1; return dates.map((_, i) => cur.items.reduce((a, x) => a + (x.w / tw) * (m[x.s][i] / m[x.s][0]) * 100, 0)); }, [cur, dates, m]);
  const [ns, setNs] = useState(""); const [nw, setNw] = useState(10);
  const persist = (next: Comp[]) => { setList(next); void saveItem("aggidx", next); };
  return (
    <PanelShell code="AGG" title="自建合成指数" onClose={onClose} right={<span>定义永久保存在平台数据库</span>}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">{(list ?? []).map((c, i) => <button key={i} type="button" onClick={() => setSel(i)} className={`border px-1.5 text-[10px] ${i === sel ? "border-cyan-500 text-cyan-200" : "border-[#1d3047] text-slate-400"}`}>{c.name}</button>)}<button type="button" onClick={() => { const name = `自定义指数 ${(list?.length ?? 0) + 1}`; persist([...(list ?? []), { name, items: [] }]); setSel(list?.length ?? 0); }} className="border border-dashed border-[#1d3047] px-1.5 text-[10px] text-slate-400">＋ 新建</button></div>
      {cur && <>
        <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]"><input value={cur.name} onChange={(e) => persist(list!.map((c, i) => (i === sel ? { ...c, name: e.target.value } : c)))} className="w-40 border border-[#1d3047] bg-[#07111c] px-1 text-white" /><input value={ns} onChange={(e) => setNs(e.target.value)} placeholder="成分代码，如 AAPL / 0700.HK" className="w-44 border border-[#1d3047] bg-[#07111c] px-1 text-white" /><input type="number" value={nw} onChange={(e) => setNw(Number(e.target.value) || 0)} className="w-16 border border-[#1d3047] bg-[#07111c] px-1 text-right text-white" /><button type="button" onClick={() => { if (ns.trim()) { persist(list!.map((c, i) => (i === sel ? { ...c, items: [...c.items.filter((x) => x.s !== ns.trim()), { s: ns.trim(), w: nw }] } : c))); setNs(""); } }} className="border border-cyan-700 px-2 text-cyan-200">加入成分</button></div>
        <table className="w-full text-[11px]"><tbody>{cur.items.map((x) => { const c = m[x.s] ?? []; return <tr key={x.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-cyan-200">{x.s}</td><td className="text-right font-mono text-slate-300">权重 {x.w}</td><td className="text-right font-mono" style={{ color: toneOf(perf(c, 252)) }}>1年 {sgn(perf(c, 252), 1)}</td><td className="px-2 text-right"><button type="button" onClick={() => persist(list!.map((cc, i) => (i === sel ? { ...cc, items: cc.items.filter((y) => y.s !== x.s) } : cc)))} className="text-[10px] text-slate-500 hover:text-red-300">移除</button></td></tr>; })}</tbody></table>
        {idx.length ? <>
          <Kpis items={[["合成指数（起点 100）", idx[idx.length - 1].toFixed(2)], ["1 年收益", sgn(perf(idx, 252))], ["年化波动", f2(annVol(idx, 252), 2, "%")], ["相对标普（同期）", sgn(perf(idx, 252) != null && perf(m.SPY ?? [], 252) != null ? perf(idx, 252)! - perf(m.SPY, 252)! : null)]]} />
          <Lines series={[{ name: cur.name, color: "#fbbf24", values: idx }, { name: "标普 500", color: "#64748b", values: (m.SPY ?? []).map((v) => (v / m.SPY[0]) * 100) }]} xLabels={dates.map((d) => d.slice(2))} height={200} fmt={(v) => v.toFixed(1)} />
        </> : <Empty loading={pack.loading} text="加入至少一个成分后自动计算" />}
      </>}
    </PanelShell>
  );
}

/* FDFD 议息会议概率 */ type MM = { series: Record<string, Array<{ d: string; v: number }>>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number }> };
const FOMC_2026: Array<[string, number]> = [["2026-01", 28], ["2026-03", 18], ["2026-04", 29], ["2026-06", 17], ["2026-07", 29], ["2026-09", 16], ["2026-10", 28], ["2026-12", 9]];
export function IdxFDFD({ onClose }: P) {
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 600_000);
  const rows = useMemo(() => {
    const path = mm.data?.path ?? [];
    const effr = mm.data?.series.EFFR?.at(-1)?.v ?? null;
    if (!path.length || effr == null) return [];
    const now = new Date().toISOString().slice(0, 7);
    let pre = effr;
    const out: Array<{ m: string; day: number; pre: number; post: number; chg: number; pCut: number; pHike: number }> = [];
    for (const [mon, day] of FOMC_2026) {
      if (mon < now) continue;
      const avg = path.find((p) => p.month === mon)?.rate;
      if (avg == null) continue;
      const [y, mo] = mon.split("-").map(Number);
      const N = new Date(y, mo, 0).getDate();
      const post = (avg * N - pre * day) / (N - day);
      const chg = post - pre;
      out.push({ m: mon, day, pre, post, chg, pCut: Math.max(0, Math.min(1, -chg / 0.25)), pHike: Math.max(0, Math.min(1, chg / 0.25)) });
      const nxt = path.find((p) => p.month > mon);
      pre = nxt && !FOMC_2026.some(([mm2]) => mm2 === nxt.month) ? nxt.rate : post;
    }
    return out;
  }, [mm.data]);
  const tgt = mm.data?.target;
  return (
    <PanelShell code="FDFD" title="议息会议利率概率" onClose={onClose} right={tgt?.from != null ? <span>当前目标区间 {tgt.from.toFixed(2)}–{tgt.to?.toFixed(2)}%</span> : null}>
      <SectionHead title="每次议息会议结果概率" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">会议</th><th className="text-right">会前利率</th><th className="text-right">会后隐含</th><th className="text-right">隐含变动</th><th className="text-right">降息概率</th><th className="text-right">不变概率</th><th className="px-2 text-right">加息概率</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.m} className="border-t border-[#0f1b29]"><td className="px-2 py-1 font-mono text-slate-200">{r.m}-{String(r.day).padStart(2, "0")}</td><td className="text-right font-mono text-slate-400">{r.pre.toFixed(3)}%</td><td className="text-right font-mono text-white">{r.post.toFixed(3)}%</td><td className="text-right font-mono" style={{ color: toneOf(r.chg) }}>{(r.chg * 100).toFixed(1)}bp</td><td className="text-right font-mono" style={{ color: "#1fbf75" }}>{(r.pCut * 100).toFixed(1)}%</td><td className="text-right font-mono text-slate-200">{((1 - r.pCut - r.pHike) * 100).toFixed(1)}%</td><td className="px-2 text-right font-mono" style={{ color: "#f2495c" }}>{(r.pHike * 100).toFixed(1)}%</td></tr>)}{!rows.length && <tr><td colSpan={7}><Empty loading={mm.loading} text="本年度剩余议息会议无对应期货报价" /></td></tr>}</tbody>
      </table>
      <SectionHead title="各合约月隐含平均利率（%）" />
      <Bars data={(mm.data?.path ?? []).map((p) => ({ k: p.month.slice(2), v: p.rate }))} fmt={(v) => v.toFixed(3)} height={120} />
    </PanelShell>
  );
}

/* OTHER_INDEX */ export function IdxOther({ onClose }: P) {
  const G: Record<string, Array<[string, string]>> = {
    factor: [["MTUM", "动量"], ["QUAL", "质量"], ["USMV", "最小波动"], ["VLUE", "价值"], ["SIZE", "规模"], ["SPHB", "高贝塔"], ["SPLV", "低波动"], ["SPY", "市值加权基准"]],
    weight: [["SPY", "市值加权"], ["RSP", "等权"], ["SPHD", "高股息低波"], ["NOBL", "股息贵族"], ["QQQ", "纳指市值加权"], ["QQQE", "纳指等权"]],
    theme: [["BOTZ", "机器人与人工智能"], ["SMH", "半导体"], ["ICLN", "清洁能源"], ["LIT", "锂电池"], ["URA", "铀"], ["SKYY", "云计算"], ["HACK", "网络安全"], ["ARKK", "颠覆式创新"], ["IBIT", "比特币"], ["XAR", "航空航天"]],
    esg: [["ESGU", "美国 ESG"], ["SUSA", "美国可持续"], ["ESGD", "发达市场 ESG"], ["ESGE", "新兴市场 ESG"], ["SPY", "基准"]],
  };
  const [g, setG] = useState("factor");
  const L = G[g];
  const pack = useCloses(L.map(([s]) => s), 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, L.map(([s]) => s)), [pack.data, g]);
  const COL = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb923c", "#94a3b8", "#f2495c", "#22d3ee", "#e879f9"];
  const R = Object.fromEntries(L.map(([s]) => [s, rets((m[s] ?? []).slice(-253))]));
  return (
    <PanelShell code="OTHER_INDEX" title="因子 / 加权方式 / 主题 / 可持续指数" onClose={onClose} tabs={[["factor", "因子指数"], ["weight", "另类加权"], ["theme", "主题指数"], ["esg", "可持续"]]} tab={g} setTab={setG}>
      <Lines series={L.map(([s, l], i) => ({ name: l, color: COL[i % COL.length], values: (m[s] ?? []).map((v) => (v / m[s][0]) * 100) }))} xLabels={dates.map((d) => d.slice(2))} height={210} fmt={(v) => v.toFixed(1)} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">指数</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="text-right">2年</th><th className="text-right">波动</th><th className="px-2 text-right">与首项相关</th></tr></thead>
        <tbody>{L.map(([s, l]) => { const c = m[s] ?? []; return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td>{[21, 63, 252, 500].map((n) => <td key={n} className="text-right font-mono" style={{ background: heat(perf(c, n), n / 15) }}>{sgn(perf(c, n), 1)}</td>)}<td className="text-right font-mono text-slate-400">{f2(annVol(c, 252), 1)}</td><td className="px-2 text-right font-mono text-slate-300">{f2(corr(R[L[0][0]], R[s]), 2)}</td></tr>; })}</tbody>
      </table>
    </PanelShell>
  );
}

/* WT 指数盘中走势 */ export function IdxWT({ onClose }: P) {
  const L: Array<[string, string]> = [["^GSPC", "标普 500"], ["^IXIC", "纳斯达克"], ["^DJI", "道琼斯"], ["000300.SH", "沪深 300"], ["000001.SH", "上证指数"], ["399006.SZ", "创业板指"], ["^HSI", "恒生指数"], ["^N225", "日经 225"], ["^STOXX50E", "欧洲斯托克 50"], ["^FTSE", "富时 100"]];
  const [s, setS] = useState(L[0][0]);
  const [period, setPeriod] = useState<Period>("5m");
  const k = useLiveKline(s, period, period === "1d" ? 260 : 300);
  const t = useTicks(L.map(([x]) => x));
  return (
    <PanelShell code="WT" title="指数实时走势" onClose={onClose} right={<Seg value={period} onChange={(v) => setPeriod(v as Period)} options={[["1m", "1分"], ["5m", "5分"], ["15m", "15分"], ["60m", "60分"], ["1d", "日K"]]} />}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="bg-[#03070c]">{L.map(([x, l]) => <button key={x} type="button" onClick={() => setS(x)} className={`flex w-full justify-between border-b border-[#0f1b29] px-2 py-1 text-[11px] ${s === x ? "bg-[#0d2236] text-white" : "text-slate-300 hover:bg-[#0a1726]"}`}><span>{l}</span><span className="font-mono" style={{ color: toneOf(t[x]?.changePct) }}>{fmtPct(t[x]?.changePct)}</span></button>)}</div>
        <div className="min-w-0 bg-[#03070c]">{k.candles.length ? <KlineChart candles={k.candles} period={period} height={420} live overlay="MA" subs={["VOL", "MACD"]} signals /> : <Empty loading={k.loading} />}</div>
      </div>
    </PanelShell>
  );
}

/* INDEX_DERIV 指数期权 */ type Opt = { symbol: string; spot: number | null; changePct: number | null; iv30: number | null; expiries: string[]; stats?: Record<string, number | null>; maxPain?: number | null };
export function IdxDeriv({ onClose }: P) {
  const L: Array<[string, string]> = [["^GSPC", "标普 500"], ["^NDX", "纳指 100"], ["^RUT", "罗素 2000"], ["SPY", "标普 ETF"], ["QQQ", "纳指 ETF"], ["IWM", "小盘 ETF"], ["^VIX", "VIX"]];
  const [s, setS] = useState(L[0][0]);
  const o = usePolled<any>("ucHubs.options", { symbol: s }, 180_000);
  const iv = usePolled<Array<{ symbol: string; iv30: number | null; rv20: number | null; ivRv: number | null }>>("ucHubs.ivScan", { symbols: L.map(([x]) => x) }, 300_000);
  const st = o.data?.stats ?? {};
  const term: Array<{ expiry: string; iv: number | null }> = o.data?.term ?? o.data?.termStructure ?? [];
  return (
    <PanelShell code="INDEX_DERIV" title="指数期权总览" onClose={onClose} tabs={L} tab={s} setTab={setS}>
      <Kpis items={[["标的", fmtPrice(o.data?.spot), fmtPct(o.data?.changePct)], ["30 日隐含波动", f2(o.data?.iv30, 2, "%")], ["看跌 / 看涨（成交）", f2(st.pcVolume ?? st.putCallVolume ?? null, 2)], ["看跌 / 看涨（持仓）", f2(st.pcOi ?? st.putCallOi ?? null, 2)], ["最大痛点", fmtPrice(o.data?.maxPain ?? st.maxPain ?? null)], ["25 Delta 偏斜", f2(st.skew25 ?? st.skew ?? null, 2)], ["净伽马敞口", fmtCompact(st.netGex ?? st.gex ?? null)], ["到期日数量", o.data?.expiries?.length ?? "—"]]} />
      <SectionHead title="隐含波动率期限结构（%）" />
      <Lines series={[{ name: "平值隐波", color: "#fbbf24", values: term.map((x: any) => x.iv ?? x.atmIv ?? null) }]} xLabels={term.map((x: any) => String(x.expiry ?? x.date ?? "").slice(5))} height={150} />
      <SectionHead title="主要指数：隐含 vs 实现波动" />
      <Bars data={L.map(([x, l]) => { const r = iv.data?.find((y) => y.symbol === x); return { k: l, v: r?.iv30 ?? 0, v2: r?.rv20 ?? 0 }; })} label={["30日隐波", "20日实波"]} fmt={(v) => `${v.toFixed(1)}%`} height={130} />
      {o.loading && !o.data && <Empty loading />}
    </PanelShell>
  );
}

/* BBG 债券与商品指数族 */ export function IdxBBG({ onClose }: P) {
  const FAM: Record<string, BoardRow[]> = {
    bond: [["AGG", "美国综合债指数"], ["BND", "全市场债券指数"], ["IUSB", "美国全债市指数"], ["BNDX", "全球综合债（除美，对冲）"], ["FLOT", "浮息投资级指数"], ["MUB", "市政债指数"], ["VCLT", "长期公司债指数"]].map(([s, l]) => ({ symbol: s, label: l, group: "债券指数" })),
    cmdty: [["DBC", "综合商品指数"], ["GSG", "高盛商品指数"], ["BCI", "彭博类商品指数（广义）"], ["DJP", "商品总回报指数"], ["COMT", "商品优化指数"], ["PDBC", "优化综合商品指数"]].map(([s, l]) => ({ symbol: s, label: l, group: "商品指数" })),
    infl: [["TIP", "通胀保值国债指数"], ["SCHP", "通胀保值（低费率）"], ["STIP", "短期通胀保值"], ["RINF", "通胀预期指数"]].map(([s, l]) => ({ symbol: s, label: l, group: "通胀指数" })),
  };
  const [g, setG] = useState("bond");
  return (
    <PanelShell code="BBG" title="债券 · 商品 · 通胀指数族" onClose={onClose} tabs={[["bond", "债券指数"], ["cmdty", "商品指数"], ["infl", "通胀指数"]]} tab={g} setTab={setG}>
      <LiveBoard rows={FAM[g]} />
    </PanelShell>
  );
}
