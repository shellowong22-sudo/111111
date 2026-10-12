/**
 * 定价与风险 · 风险六个面板：风险仪表盘（RISK）、风险价值（VaR）、压力测试（STRS）、尾部风险（TAIL）、
 * 交易对手信用估值调整（CVA/DVA）、损益归因（PNL）。
 * 组合 = 平台模拟账户的真实持仓（无持仓时用示例组合），价格与日线均为真实行情；所有指标现场计算。
 */
import { useMemo, useState } from "react";
import { fmtPct, toneOf } from "@/uc/market/live";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { corr, drawdown, f2, heat, sgn } from "@/uc/hubs/calc";
void sgn;
import { Seg } from "@/uc/news/kit";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { BENCH, Histogram, MKT_ZH, Note, PortBar, TH, TR, avg, beta, exKurt, invNorm, money, ols, pct, quantile, sd, skewness, usePortSeries, usePortfolio, type Port } from "./PricingKit";
import { useCurves, yieldFn } from "./LiveCommon";

const ewmaVol = (r: number[], lambda = 0.94) => { let v = r.length ? r[0] ** 2 : 0; for (const x of r) v = lambda * v + (1 - lambda) * x * x; return Math.sqrt(v); };
function contributions(p: Port, R: Record<string, number[]>, n = 250) {
  const syms = p.rows.map((r) => r.symbol);
  const cols = syms.map((s) => (R[s] ?? []).slice(-n));
  const len = Math.min(...cols.map((c) => c.length));
  if (!len || len < 30) return [];
  const port = Array.from({ length: len }, (_, i) => p.rows.reduce((a, r, k) => a + r.weight * cols[k][cols[k].length - len + i], 0));
  const vp = sd(port) ** 2 || 1e-12;
  return p.rows.map((r, k) => {
    const c = cols[k].slice(-len);
    const mc = avg(c), mp = avg(port);
    let cov = 0;
    for (let i = 0; i < len; i++) cov += (c[i] - mc) * (port[i] - mp);
    cov /= len - 1;
    return { ...r, share: (r.weight * cov) / vp, vol: sd(c) * Math.sqrt(252) };
  });
}

/* ================================================================== 风险价值 */
export function LiveVaR() {
  const p = usePortfolio();
  const s = usePortSeries(p, 760);
  const [conf, setConf] = useState("0.95");
  const [h, setH] = useState("1");
  const [tab, setTab] = useState("var");
  const c = Number(conf), H = Number(h);
  const r = s.port.slice(-500);
  const z = -invNorm(1 - c);
  const hq = quantile(r, 1 - c);
  const histVar = hq == null ? null : -hq * Math.sqrt(H);
  const tail = hq == null ? [] : r.filter((x) => x <= hq);
  const es = tail.length ? -avg(tail) * Math.sqrt(H) : null;
  const paramVar = r.length ? (z * sd(r) - avg(r)) * Math.sqrt(H) : null;
  const ewVar = r.length ? z * ewmaVol(r) * Math.sqrt(H) : null;
  const cf = (() => { if (r.length < 60) return null; const S = skewness(r), K = exKurt(r); const zz = -z; const zcf = zz + ((zz * zz - 1) * S) / 6 + ((zz ** 3 - 3 * zz) * K) / 24 - ((2 * zz ** 3 - 5 * zz) * S * S) / 36; return -(avg(r) + zcf * sd(r)) * Math.sqrt(H); })();
  const contrib = useMemo(() => contributions(p, s.R), [p, s.R]);
  const bt = useMemo(() => {
    const out: Array<{ d: string; r: number; v: number | null; breach: boolean }> = [];
    for (let i = 250; i < s.port.length; i++) { const w = s.port.slice(i - 250, i); const q = quantile(w, 1 - c); out.push({ d: s.dates[i], r: s.port[i], v: q, breach: q != null && s.port[i] < q }); }
    return out.slice(-250);
  }, [s.port, c]);
  const breaches = bt.filter((x) => x.breach).length;
  const expected = bt.length * (1 - c);
  return (
    <PanelShell code="VaR" title="风险价值" tabs={[["var", "VaR 与 ES"], ["contrib", "风险贡献"], ["bt", "回测"]]} tab={tab} setTab={setTab} right={<span className="flex gap-2"><Seg value={conf} onChange={setConf} options={[["0.95", "95%"], ["0.99", "99%"]]} /><Seg value={h} onChange={setH} options={[["1", "1日"], ["10", "10日"]]} /></span>}>
      <PortBar p={p} />
      {!s.ok ? <Empty loading={s.loading} text="日线不足，无法计算" /> : <>
        <Kpis items={[["历史模拟 VaR", pct(histVar), money(histVar != null ? histVar * p.total : null)], ["预期亏损 ES", pct(es), money(es != null ? es * p.total : null)], ["参数法 VaR", pct(paramVar)], ["EWMA VaR", pct(ewVar), "λ=0.94，更贴近当前波动"], ["Cornish-Fisher VaR", pct(cf), "修正偏度与峰度"]]} />
        {tab === "var" && <>
          <SectionHead title="组合近两年日收益分布" sub={`${r.length} 个交易日；平方根法则换算 ${H} 日`} />
          <Histogram values={r.map((x) => x * 100)} marks={[...(hq != null ? [{ v: hq * 100, color: "#fbbf24", label: `${(c * 100).toFixed(0)}% 分位` }] : []), ...(tail.length ? [{ v: avg(tail) * 100, color: "#f472b6", label: "尾部均值" }] : [])]} fmt={(v) => `${v.toFixed(2)}%`} />
          <SectionHead title="60 日滚动波动率（年化 %）" />
          <Lines series={[{ name: "组合", color: "#38bdf8", values: s.port.map((_, i) => (i >= 60 ? sd(s.port.slice(i - 60, i)) * Math.sqrt(252) * 100 : null)).slice(-500) }]} xLabels={s.dates.slice(-500).map((d) => d.slice(2))} height={150} fmt={(v) => v.toFixed(1)} />
        </>}
        {tab === "contrib" && <>
          <SectionHead title="各持仓对组合风险的贡献（近一年协方差）" sub="负值表示对冲作用" />
          <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">持仓</th><th className="text-right">权重</th><th className="text-right">自身波动</th><th className="text-right">风险贡献</th><th className="px-2 text-right">成分 VaR</th></tr></thead>
            <tbody>{contrib.map((x) => <tr key={x.symbol} className={TR}><td className="px-2 py-0.5 text-slate-100">{x.label}</td><td className="text-right font-mono text-slate-300">{pct(x.weight, 1)}</td><td className="text-right font-mono text-slate-300">{pct(x.vol, 1)}</td><td className="text-right font-mono" style={{ background: heat(x.share * 100, 40) }}>{pct(x.share, 1)}</td><td className="px-2 text-right font-mono text-slate-200">{money(histVar != null ? x.share * histVar * p.total : null)}</td></tr>)}</tbody></table>
          <Bars data={contrib.map((x) => ({ k: x.label.slice(0, 6), v: x.share * 100, v2: x.weight * 100 }))} label={["风险贡献 %", "权重 %"]} fmt={(v) => `${v.toFixed(1)}%`} height={150} />
        </>}
        {tab === "bt" && <>
          <SectionHead title={`近 250 日回测：实际突破 ${breaches} 次，理论约 ${expected.toFixed(1)} 次`} sub={breaches > expected * 1.8 ? "突破明显偏多：模型低估风险" : breaches < expected * 0.4 ? "突破偏少：模型偏保守" : "在合理范围内"} />
          <Lines zero series={[{ name: "日收益 %", color: "#94a3b8", values: bt.map((x) => x.r * 100) }, { name: "−VaR %", color: "#f2495c", values: bt.map((x) => (x.v != null ? x.v * 100 : null)) }]} xLabels={bt.map((x) => x.d.slice(2))} height={220} />
          <table className="w-full text-[11px]"><tbody>{bt.filter((x) => x.breach).slice(-12).reverse().map((x) => <tr key={x.d} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{x.d}</td><td className="text-right font-mono text-emerald-300">{pct(x.r)}</td><td className="px-2 text-right font-mono text-slate-400">VaR {pct(x.v != null ? -x.v : null)}</td></tr>)}</tbody></table>
        </>}
      </>}
    </PanelShell>
  );
}

/* ================================================================== 压力测试 */
const CRISES: Array<[string, string, string, string]> = [
  ["covid", "2020 新冠暴跌", "2020-02-19", "2020-03-23"],
  ["hike", "2022 加息冲击", "2022-01-03", "2022-10-12"],
  ["q418", "2018 四季度抛售", "2018-10-03", "2018-12-24"],
  ["svb", "2023 硅谷银行事件", "2023-03-08", "2023-03-15"],
  ["carry", "2024 日元套息平仓", "2024-07-10", "2024-08-05"],
  ["tariff", "2025 关税冲击", "2025-04-02", "2025-04-08"],
];
const FACTORS: Array<[string, string]> = [["SPY", "美股"], ["sh000300", "A股"], ["TLT", "长期美债"], ["GLD", "黄金"], ["UUP", "美元"], ["USO", "原油"]];
export function LiveStressTest() {
  const p = usePortfolio();
  const s = usePortSeries(p, 2600, FACTORS.map(([x]) => x));
  const [tab, setTab] = useState("hist");
  const [shock, setShock] = useState<Record<string, number>>({ SPY: -10, sh000300: -8, TLT: 3, GLD: 4, UUP: 2, USO: -15 });
  const raw = s.raw;
  const hist = useMemo(() => CRISES.map(([k, name, a, b]) => {
    const per = p.rows.map((r) => {
      const c = raw?.[r.symbol] ?? [];
      const p0 = [...c].reverse().find(([t]) => new Date(t).toISOString().slice(0, 10) <= a)?.[1];
      const p1 = [...c].reverse().find(([t]) => new Date(t).toISOString().slice(0, 10) <= b)?.[1];
      const first = c[0] ? new Date(c[0][0]).toISOString().slice(0, 10) : "9999";
      return { symbol: r.symbol, label: r.label, w: r.weight, ret: p0 && p1 && first <= a ? p1 / p0 - 1 : null };
    });
    const cov = per.filter((x) => x.ret != null);
    const covW = cov.reduce((s2, x) => s2 + Math.abs(x.w), 0);
    const tot = cov.reduce((s2, x) => s2 + x.w * (x.ret as number), 0);
    return { k, name, a, b, per, tot: cov.length ? tot : null, coverage: covW };
  }), [raw, p.rows]);
  const betas = useMemo(() => {
    const X = FACTORS.map(([f]) => (s.R[f] ?? []).slice(-250));
    return p.rows.map((r) => { const y = (s.R[r.symbol] ?? []).slice(-250); const len = Math.min(y.length, ...X.map((x) => x.length)); const fit = len > 60 ? ols(y.slice(-len), X.map((x) => x.slice(-len))) : null; return { ...r, b: fit?.betas ?? null, r2: fit?.r2 ?? null }; });
  }, [s.R, p.rows]);
  const factorPnl = betas.map((x) => ({ ...x, shockRet: x.b ? x.b.reduce((a, b2, i) => a + b2 * (shock[FACTORS[i][0]] ?? 0) / 100, 0) : null }));
  const factorTot = factorPnl.reduce((a, x) => a + x.weight * (x.shockRet ?? 0), 0);
  const presets: Array<[string, Record<string, number>]> = [["股灾", { SPY: -20, sh000300: -15, TLT: 5, GLD: 5, UUP: 3, USO: -25 }], ["滞胀", { SPY: -10, sh000300: -6, TLT: -8, GLD: 10, UUP: 2, USO: 25 }], ["加息", { SPY: -8, sh000300: -3, TLT: -12, GLD: -4, UUP: 4, USO: 0 }], ["美元走弱", { SPY: 3, sh000300: 5, TLT: 2, GLD: 6, UUP: -6, USO: 5 }], ["避险", { SPY: -6, sh000300: -4, TLT: 6, GLD: 6, UUP: 2, USO: -8 }], ["复苏", { SPY: 10, sh000300: 8, TLT: -4, GLD: -3, UUP: -2, USO: 12 }]];
  return (
    <PanelShell code="STRS" title="压力测试" tabs={[["hist", "历史危机回放"], ["factor", "因子冲击模拟"]]} tab={tab} setTab={setTab}>
      <PortBar p={p} />
      {tab === "hist" && <>
        <SectionHead title="当前持仓在历史危机区间的真实表现" sub="按各标的在危机起止日的真实收盘价计算；当时尚未上市的标的不计入（见覆盖率）" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">情景</th><th className="text-left">区间</th><th className="text-right">组合收益</th><th className="text-right">损益</th><th className="px-2 text-right">覆盖率</th></tr></thead>
          <tbody>{hist.map((x) => <tr key={x.k} className={TR}><td className="px-2 py-0.5 text-slate-100">{x.name}</td><td className="font-mono text-[10px] text-slate-500">{x.a} → {x.b}</td><td className="text-right font-mono" style={{ background: heat(x.tot != null ? x.tot * 100 : null, 25) }}>{pct(x.tot)}</td><td className="text-right font-mono" style={{ color: toneOf(x.tot) }}>{money(x.tot != null ? x.tot * p.total : null)}</td><td className="px-2 text-right font-mono text-slate-400">{pct(x.coverage, 0)}</td></tr>)}</tbody></table>
        {!s.raw && <Empty loading />}
        <SectionHead title="逐持仓情景收益" />
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">持仓</th>{hist.map((x) => <th key={x.k} className="text-right">{x.name.slice(5) || x.name}</th>)}</tr></thead>
          <tbody>{p.rows.map((r, i) => <tr key={r.symbol} className={TR}><td className="px-2 py-0.5 text-slate-200">{r.label}</td>{hist.map((x) => { const v = x.per[i]?.ret; return <td key={x.k} className="text-right font-mono" style={{ background: heat(v != null ? v * 100 : null, 30) }}>{v == null ? "—" : pct(v, 1)}</td>; })}</tr>)}</tbody></table></div>
      </>}
      {tab === "factor" && <>
        <SectionHead title="因子冲击（输入各因子涨跌 %，按各持仓近一年对因子的回归贝塔传导）" right={<span className="flex flex-wrap gap-1">{presets.map(([n, v]) => <button key={n} type="button" onClick={() => setShock(v)} className="border border-[#1d3047] px-1.5 text-[10px] text-cyan-300 hover:bg-[#0a1726]">{n}</button>)}</span>} />
        <div className="flex flex-wrap gap-3 px-2 py-1 text-[11px]">{FACTORS.map(([f, l]) => <label key={f} className="flex items-center gap-1 text-slate-400">{l}<input type="number" value={shock[f] ?? 0} onChange={(e) => setShock({ ...shock, [f]: Number(e.target.value) || 0 })} className="w-14 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-white" />%</label>)}</div>
        <Kpis items={[["组合冲击收益", pct(factorTot), money(factorTot * p.total)], ["平均解释度 R²", f2(avg(betas.map((x) => x.r2 ?? 0)), 2), "越高越可靠"]]} />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">持仓</th><th className="text-right">权重</th>{FACTORS.map(([, l]) => <th key={l} className="text-right">β {l}</th>)}<th className="text-right">R²</th><th className="px-2 text-right">冲击收益</th></tr></thead>
          <tbody>{factorPnl.map((x) => <tr key={x.symbol} className={TR}><td className="px-2 py-0.5 text-slate-100">{x.label}</td><td className="text-right font-mono text-slate-400">{pct(x.weight, 1)}</td>{FACTORS.map((_, i) => <td key={i} className="text-right font-mono text-slate-300">{x.b ? x.b[i].toFixed(2) : "—"}</td>)}<td className="text-right font-mono text-slate-400">{f2(x.r2, 2)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(x.shockRet) }}>{pct(x.shockRet)}</td></tr>)}</tbody></table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== 尾部风险 */
export function LiveTailRisk() {
  const p = usePortfolio();
  const s = usePortSeries(p, 1260, ["SPY"]);
  const [tab, setTab] = useState("dist");
  const r = s.port;
  const eq = useMemo(() => { let v = 1; return r.map((x) => (v *= 1 + x)); }, [r]);
  const dd = drawdown(eq);
  const yrs = r.length / 252;
  const cagr = eq.length ? eq[eq.length - 1] ** (1 / Math.max(0.1, yrs)) - 1 : null;
  const q05 = quantile(r, 0.05), q95 = quantile(r, 0.95);
  const worst = r.map((x, i) => ({ d: s.dates[i], x, spy: s.R.SPY?.[i] ?? null })).sort((a, b) => a.x - b.x).slice(0, 12);
  const down = r.filter((x) => x < 0);
  const spyR = s.R.SPY ?? [];
  const n = Math.min(r.length, spyR.length);
  const downBeta = (() => { const idx = Array.from({ length: n }, (_, i) => i).filter((i) => spyR[spyR.length - n + i] < 0); return beta(idx.map((i) => r[r.length - n + i]), idx.map((i) => spyR[spyR.length - n + i])); })();
  const upBeta = (() => { const idx = Array.from({ length: n }, (_, i) => i).filter((i) => spyR[spyR.length - n + i] > 0); return beta(idx.map((i) => r[r.length - n + i]), idx.map((i) => spyR[spyR.length - n + i])); })();
  return (
    <PanelShell code="TAIL" title="尾部风险" tabs={[["dist", "分布形态"], ["dd", "回撤"], ["worst", "极端日"]]} tab={tab} setTab={setTab}>
      <PortBar p={p} />
      {!s.ok ? <Empty loading={s.loading} text="日线不足" /> : <>
        <Kpis items={[["偏度", f2(skewness(r), 2), skewness(r) < 0 ? "左偏：大跌多于大涨" : "右偏"], ["超额峰度", f2(exKurt(r), 2), "大于 0 = 肥尾"], ["尾部比率", q05 && q95 ? f2(Math.abs(q95 / q05), 2) : "—", "95% 分位 / 5% 分位"], ["下行波动", pct(sd(down) * Math.sqrt(252)), "年化"], ["最大回撤", pct(dd.max / 100), `当前 ${pct(dd.now / 100)}`], ["卡玛比率", cagr != null && dd.max ? f2(cagr / Math.abs(dd.max / 100), 2) : "—", "年化收益 / 最大回撤"], ["下跌 / 上涨贝塔", `${f2(downBeta, 2)} / ${f2(upBeta, 2)}`, "相对标普"]]} />
        {tab === "dist" && <><SectionHead title="日收益分布（近五年）" /><Histogram values={r.map((x) => x * 100)} bins={50} marks={[...(q05 != null ? [{ v: q05 * 100, color: "#fbbf24", label: "5% 分位" }] : []), ...(q95 != null ? [{ v: q95 * 100, color: "#38bdf8", label: "95% 分位" }] : [])]} fmt={(v) => `${v.toFixed(2)}%`} />
          <SectionHead title="正态假设 vs 实际：超过 2 / 3 / 4 个标准差的天数" />
          <table className="w-full text-[11px]"><tbody>{[2, 3, 4].map((k) => { const m = avg(r), sdv = sd(r); const act = r.filter((x) => x < m - k * sdv).length; const exp = r.length * (1 - (k === 2 ? 0.97725 : k === 3 ? 0.99865 : 0.999968)); return <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-300">下跌超过 {k}σ</td><td className="text-right font-mono text-white">实际 {act} 天</td><td className="px-2 text-right font-mono text-slate-400">正态预期 {exp.toFixed(1)} 天</td></tr>; })}</tbody></table></>}
        {tab === "dd" && <><SectionHead title="组合回撤（%）" /><Lines series={[{ name: "回撤", color: "#1fbf75", values: dd.series }]} xLabels={s.dates.map((d) => d.slice(2))} height={200} fmt={(v) => v.toFixed(1)} />
          <SectionHead title="组合净值" /><Lines series={[{ name: "净值", color: "#38bdf8", values: eq }]} xLabels={s.dates.map((d) => d.slice(2))} height={160} /></>}
        {tab === "worst" && <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">日期</th><th className="text-right">组合</th><th className="text-right">标普</th><th className="px-2 text-right">损益</th></tr></thead><tbody>{worst.map((x) => <tr key={x.d} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{x.d}</td><td className="text-right font-mono text-emerald-300">{pct(x.x)}</td><td className="text-right font-mono" style={{ color: toneOf(x.spy) }}>{pct(x.spy)}</td><td className="px-2 text-right font-mono text-slate-200">{money(x.x * p.total)}</td></tr>)}</tbody></table>}
      </>}
    </PanelShell>
  );
}

/* ================================================================== CVA / DVA */
const CPTY: Array<[string, string, number]> = [["JPM", "摩根大通", 45], ["GS", "高盛", 60], ["MS", "摩根士丹利", 60], ["C", "花旗", 65], ["BAC", "美国银行", 55], ["HSBC", "汇丰", 50], ["UBS", "瑞银", 70], ["DB", "德意志银行", 80], ["BCS", "巴克莱", 75]];
export function LiveCVADVA() {
  const p = usePortfolio();
  const s = usePortSeries(p, 500);
  const curves = useCurves();
  const [cp, setCp] = useState(CPTY[0][0]);
  const [spread, setSpread] = useState<number | null>(null);
  const [own, setOwn] = useState(100);
  const [rec, setRec] = useState(40);
  const [years, setYears] = useState(5);
  const [tab, setTab] = useState("cva");
  const cs = spread ?? CPTY.find((x) => x[0] === cp)?.[2] ?? 60;
  const yf = useMemo(() => yieldFn(curves.data?.us[0]?.points ?? []), [curves.data]);
  const vol = s.port.length > 60 ? sd(s.port.slice(-250)) * Math.sqrt(252) : 0.15;
  const V = p.total;
  const prof = useMemo(() => {
    const out: Array<{ t: number; ee: number; ene: number; pfe: number; df: number; pdC: number; pdO: number }> = [];
    const lc = cs / 1e4 / (1 - rec / 100), lo = own / 1e4 / (1 - rec / 100);
    for (let i = 1; i <= years * 4; i++) {
      const t = i / 4;
      const sig = V * vol * Math.sqrt(t);
      const ee = sig * 0.3989, ene = sig * 0.3989, pfe = sig * 1.645;
      const y = yf(t) ?? 0.04;
      out.push({ t, ee, ene, pfe, df: Math.exp(-y * t), pdC: Math.exp(-lc * (t - 0.25)) - Math.exp(-lc * t), pdO: Math.exp(-lo * (t - 0.25)) - Math.exp(-lo * t) });
    }
    return out;
  }, [V, vol, cs, own, rec, years, yf]);
  const lgd = 1 - rec / 100;
  const cva = prof.reduce((a, x) => a + lgd * x.ee * x.df * x.pdC, 0);
  const dva = prof.reduce((a, x) => a + lgd * x.ene * x.df * x.pdO, 0);
  const banks: BoardRow[] = CPTY.map(([sym, l]) => ({ symbol: sym, label: l, group: "交易对手（银行股实时）" }));
  const { pick } = useHub();
  const inp = "w-16 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-white";
  return (
    <PanelShell code="CVA" title="交易对手信用估值调整" tabs={[["cva", "CVA / DVA"], ["profile", "暴露曲线"], ["cpty", "交易对手监控"]]} tab={tab} setTab={setTab}>
      <PortBar p={p} />
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2a3c] px-2 py-1 text-[11px] text-slate-400">
        <label className="flex items-center gap-1">交易对手<select value={cp} onChange={(e) => { setCp(e.target.value); setSpread(null); }} className="border border-[#1d3047] bg-[#07111c] px-1 text-slate-200">{CPTY.map(([sym, l]) => <option key={sym} value={sym}>{l}</option>)}</select></label>
        <label className="flex items-center gap-1">对手信用利差 bp<input type="number" value={cs} onChange={(e) => setSpread(Number(e.target.value) || 0)} className={inp} /></label>
        <label className="flex items-center gap-1">本方信用利差 bp<input type="number" value={own} onChange={(e) => setOwn(Number(e.target.value) || 0)} className={inp} /></label>
        <label className="flex items-center gap-1">回收率 %<input type="number" value={rec} onChange={(e) => setRec(Number(e.target.value) || 0)} className={inp} /></label>
        <label className="flex items-center gap-1">期限（年）<input type="number" value={years} onChange={(e) => setYears(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className={inp} /></label>
      </div>
      <Kpis items={[["CVA（对手违约损失）", money(cva), pct(V ? cva / V : null, 3)], ["DVA（本方违约收益）", money(dva), pct(V ? dva / V : null, 3)], ["双边调整 BCVA", money(cva - dva), "CVA − DVA"], ["组合年化波动", pct(vol), "近一年真实日收益"], ["峰值潜在暴露 PFE95", money(Math.max(0, ...prof.map((x) => x.pfe))), `${years} 年内`]]} />
      {tab === "cva" && <><SectionHead title="各季度 CVA 贡献" /><Bars data={prof.map((x) => ({ k: `${x.t}Y`, v: lgd * x.ee * x.df * x.pdC }))} height={160} /><Note>暴露按持仓市值与组合真实波动率推算（类远期头寸：EE = V·σ·√t·φ(0)）。信用利差默认值为大型银行的常见水平，可按实际报价修改；交易对手股价走势可在「交易对手监控」查看。</Note></>}
      {tab === "profile" && <><SectionHead title="暴露曲线" /><Lines series={[{ name: "预期暴露 EE", color: "#38bdf8", values: prof.map((x) => x.ee) }, { name: "潜在暴露 PFE95", color: "#f2495c", values: prof.map((x) => x.pfe) }]} xLabels={prof.map((x) => `${x.t}Y`)} height={200} fmt={(v) => money(v)} />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-right">时点</th><th className="text-right">EE</th><th className="text-right">PFE95</th><th className="text-right">贴现因子</th><th className="px-2 text-right">区间违约概率</th></tr></thead><tbody>{prof.filter((_, i) => i % 2 === 1).map((x) => <tr key={x.t} className={TR}><td className="px-2 py-0.5 text-right font-mono text-slate-300">{x.t}Y</td><td className="text-right font-mono text-white">{money(x.ee)}</td><td className="text-right font-mono text-red-300">{money(x.pfe)}</td><td className="text-right font-mono text-slate-400">{x.df.toFixed(4)}</td><td className="px-2 text-right font-mono text-slate-300">{pct(x.pdC, 3)}</td></tr>)}</tbody></table></>}
      {tab === "cpty" && <><SectionHead title="交易对手股价（点击看 K 线）" /><LiveBoard rows={banks} /><div className="px-2 py-1"><button type="button" onClick={() => pick(cp)} className="text-[11px] text-cyan-300 hover:underline">查看当前交易对手 K 线 ›</button></div></>}
    </PanelShell>
  );
}

/* ================================================================== 损益归因 */
const ATTR_F: Array<[string, string]> = [["SPY", "美股"], ["sh000300", "A股"], ["TLT", "利率"], ["GLD", "黄金"], ["UUP", "美元"]];
export function LivePnLAttribution() {
  const p = usePortfolio();
  const s = usePortSeries(p, 500, ATTR_F.map(([f]) => f));
  const [win, setWin] = useState("21");
  const [tab, setTab] = useState("day");
  const n = Number(win);
  const dayTot = p.rows.reduce((a, r) => a + (r.dayPnl ?? 0), 0);
  const byMkt = Object.entries(p.rows.reduce<Record<string, number>>((a, r) => { a[r.market] = (a[r.market] ?? 0) + (r.dayPnl ?? 0); return a; }, {}));
  const period = p.rows.map((r) => { const R = (s.R[r.symbol] ?? []).slice(-n); const cum = R.reduce((a, x) => a * (1 + x), 1) - 1; return { ...r, cum, pnl: cum * r.value }; });
  const fac = useMemo(() => {
    const y = s.port.slice(-250);
    const X = ATTR_F.map(([f]) => (s.R[f] ?? []).slice(-250));
    const len = Math.min(y.length, ...X.map((x) => x.length));
    const fit = len > 60 ? ols(y.slice(-len), X.map((x) => x.slice(-len))) : null;
    if (!fit) return null;
    const contrib = ATTR_F.map(([f, l], i) => { const fr = (s.R[f] ?? []).slice(-n).reduce((a, x) => a + x, 0); return { l, b: fit.betas[i], fr, c: fit.betas[i] * fr }; });
    const total = s.port.slice(-n).reduce((a, x) => a + x, 0);
    return { contrib, total, resid: total - contrib.reduce((a, x) => a + x.c, 0), r2: fit.r2 };
  }, [s.port, s.R, n]);
  const cumSeries = s.port.slice(-n).reduce<number[]>((a, x) => [...a, (a[a.length - 1] ?? 0) + x * p.total], []);
  return (
    <PanelShell code="PNL" title="损益归因" tabs={[["day", "今日损益"], ["period", "区间损益"], ["factor", "因子归因"]]} tab={tab} setTab={setTab} right={<Seg value={win} onChange={setWin} options={[["5", "1周"], ["21", "1月"], ["63", "3月"], ["250", "1年"]]} />}>
      <PortBar p={p} />
      <Kpis items={[["今日损益", money(dayTot), pct(p.total ? dayTot / p.total : null)], ["区间损益", money(cumSeries[cumSeries.length - 1] ?? null), `近 ${n} 个交易日`], ...(fac ? [["因子解释度 R²", f2(fac.r2, 2), "近一年回归"] as [string, string, string]] : [])]} />
      {tab === "day" && <><SectionHead title="今日各持仓损益（实时）" /><Bars data={[...p.rows].sort((a, b) => (b.dayPnl ?? 0) - (a.dayPnl ?? 0)).map((r) => ({ k: r.label.slice(0, 6), v: r.dayPnl ?? 0 }))} height={160} />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">持仓</th><th className="text-right">权重</th><th className="text-right">今日涨跌</th><th className="text-right">今日损益</th><th className="px-2 text-right">占比</th></tr></thead><tbody>{p.rows.map((r) => <tr key={r.symbol} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.label}</td><td className="text-right font-mono text-slate-400">{pct(r.weight, 1)}</td><td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className="text-right font-mono" style={{ color: toneOf(r.dayPnl) }}>{money(r.dayPnl)}</td><td className="px-2 text-right font-mono text-slate-400">{dayTot ? pct((r.dayPnl ?? 0) / dayTot, 0) : "—"}</td></tr>)}</tbody></table>
        <SectionHead title="按市场" /><table className="w-full text-[11px]"><tbody>{byMkt.map(([m, v]) => <tr key={m} className={TR}><td className="px-2 py-0.5 text-slate-200">{MKT_ZH[m] ?? m}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(v) }}>{money(v)}</td></tr>)}</tbody></table></>}
      {tab === "period" && <><SectionHead title={`近 ${n} 日累计损益`} /><Lines zero series={[{ name: "累计损益", color: "#38bdf8", values: cumSeries }]} xLabels={s.dates.slice(-n).map((d) => d.slice(5))} height={180} fmt={(v) => money(v)} />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">持仓</th><th className="text-right">区间涨跌</th><th className="px-2 text-right">区间损益</th></tr></thead><tbody>{[...period].sort((a, b) => b.pnl - a.pnl).map((r) => <tr key={r.symbol} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.label}</td><td className="text-right font-mono" style={{ color: toneOf(r.cum) }}>{pct(r.cum)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(r.pnl) }}>{money(r.pnl)}</td></tr>)}</tbody></table></>}
      {tab === "factor" && (fac ? <><SectionHead title={`近 ${n} 日组合收益的因子拆分`} sub="残差为选股 / 特质收益" />
        <Bars data={[...fac.contrib.map((x) => ({ k: x.l, v: x.c * 100 })), { k: "特质", v: fac.resid * 100 }]} fmt={(v) => `${v.toFixed(2)}%`} height={160} />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">因子</th><th className="text-right">贝塔</th><th className="text-right">因子区间收益</th><th className="px-2 text-right">贡献</th></tr></thead><tbody>{fac.contrib.map((x) => <tr key={x.l} className={TR}><td className="px-2 py-0.5 text-slate-200">{x.l}</td><td className="text-right font-mono text-slate-300">{x.b.toFixed(2)}</td><td className="text-right font-mono" style={{ color: toneOf(x.fr) }}>{pct(x.fr)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(x.c) }}>{pct(x.c)}</td></tr>)}<tr className={TR}><td className="px-2 py-0.5 text-slate-200">特质 / 残差</td><td /><td /><td className="px-2 text-right font-mono" style={{ color: toneOf(fac.resid) }}>{pct(fac.resid)}</td></tr><tr className={TR}><td className="px-2 py-0.5 font-semibold text-white">合计</td><td /><td /><td className="px-2 text-right font-mono text-white">{pct(fac.total)}</td></tr></tbody></table></> : <Empty loading={s.loading} text="日线不足" />)}
    </PanelShell>
  );
}

/* ================================================================== 风险仪表盘 */
const MKT_RISK: BoardRow[] = [["^VIX", "波动率指数"], ["^VIX3M", "3月波动率指数"], ["^MOVE", "美债波动率"], ["^SKEW", "尾部偏度指数"], ["^TNX", "10年美债收益率"], ["DXY", "美元指数"], ["HYG", "高收益债ETF"], ["GC", "黄金"]].map(([s, l]) => ({ symbol: s, label: l, group: "市场风险指标" }));
export function LiveRiskDashboard() {
  const p = usePortfolio();
  const s = usePortSeries(p, 500, ["SPY", "sh000300"]);
  const [tab, setTab] = useState("over");
  const r = s.port.slice(-250);
  const vol = r.length > 20 ? sd(r) * Math.sqrt(252) : null;
  const q = quantile(r, 0.05);
  const b = beta(r, (s.R.SPY ?? []).slice(-250));
  const bCn = beta(r, (s.R.sh000300 ?? []).slice(-250));
  let v = 1; const eq = r.map((x) => (v *= 1 + x));
  const dd = drawdown(eq);
  const hhi = p.rows.reduce((a, x) => a + x.weight ** 2, 0);
  const contrib = useMemo(() => contributions(p, s.R).sort((a, b2) => b2.share - a.share), [p, s.R]);
  const mkts = Object.entries(p.rows.reduce<Record<string, number>>((a, x) => { a[x.market] = (a[x.market] ?? 0) + x.weight; return a; }, {}));
  const syms = p.rows.map((x) => x.symbol).slice(0, 10);
  return (
    <PanelShell code="RISK" title="风险仪表盘" tabs={[["over", "总览"], ["corr", "持仓相关性"], ["mkt", "市场风险指标"]]} tab={tab} setTab={setTab}>
      <PortBar p={p} />
      <Kpis items={[["组合市值", money(p.total), `${p.rows.length} 个持仓`], ["年化波动", pct(vol), "近一年"], ["1 日 95% VaR", pct(q != null ? -q : null), money(q != null ? -q * p.total : null)], ["对标普贝塔", f2(b, 2), `对沪深300 ${f2(bCn, 2)}`], ["一年最大回撤", pct(dd.max / 100), `当前 ${pct(dd.now / 100)}`], ["集中度 HHI", f2(hhi, 3), `等效持仓数 ${hhi ? (1 / hhi).toFixed(1) : "—"}`]]} />
      {tab === "over" && <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="风险贡献前列" /><Bars data={contrib.slice(0, 10).map((x) => ({ k: x.label.slice(0, 6), v: x.share * 100 }))} fmt={(v2) => `${v2.toFixed(1)}%`} height={160} /></div>
        <div className="bg-[#03070c]"><SectionHead title="市场分布（权重）" /><Bars data={mkts.map(([m, w]) => ({ k: MKT_ZH[m] ?? m, v: w * 100 }))} fmt={(v2) => `${v2.toFixed(1)}%`} height={160} /><Note>基准：{Object.entries(BENCH).map(([m, sy]) => `${MKT_ZH[m]}→${sy}`).join("，")}</Note></div>
        <div className="bg-[#03070c] lg:col-span-2"><SectionHead title="组合一年净值与回撤" /><Lines series={[{ name: "净值", color: "#38bdf8", values: eq }]} xLabels={s.dates.slice(-250).map((d) => d.slice(5))} height={150} /></div>
      </div>}
      {tab === "corr" && <div className="overflow-x-auto"><SectionHead title="持仓间日收益相关（近一年）" /><table className="text-[10px]"><thead><tr><th />{syms.map((x) => <th key={x} className="px-1 text-cyan-300">{p.rows.find((r2) => r2.symbol === x)?.label.slice(0, 5)}</th>)}</tr></thead><tbody>{syms.map((a) => <tr key={a}><td className="px-2 text-right text-cyan-300">{p.rows.find((r2) => r2.symbol === a)?.label.slice(0, 6)}</td>{syms.map((b2) => { const c = a === b2 ? null : corr((s.R[a] ?? []).slice(-250), (s.R[b2] ?? []).slice(-250)); return <td key={b2} className="px-1 py-0.5 text-center font-mono" style={{ background: heat(c, 1), color: "#f1f5f9" }}>{c == null ? "" : c.toFixed(2)}</td>; })}</tr>)}</tbody></table></div>}
      {tab === "mkt" && <LiveBoard rows={MKT_RISK} />}
      {!s.ok && <Empty loading={s.loading} text="日线不足" />}
      <Note>所有指标由实时行情与真实日线现场计算；平台模拟账户有持仓时自动使用真实持仓。</Note>
    </PanelShell>
  );
}
