/**
 * 优先股 20 个小窗功能（实时 / 可计算 / 官方披露），各窗口内容互不重复。
 * 数据：优先股 ETF 与主要发行人实时行情与日线、美债曲线、证监会披露、发行人资产负债、平台运行指标。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks, type Candle } from "@/uc/market/live";
import { tradeSignals } from "@/uc/market/indicators";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, covMatrix, drawdown, f2, heat, mean, minVariance, ncdf, perf, portVol, rets, riskParity, rollingCorr, sgn, std, useCloses } from "@/uc/hubs/calc";
import { DocList, Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose: () => void };
const PFD: Array<[string, string]> = [["PFF", "优先股综合"], ["PGX", "优先股（宽基二）"], ["PFFD", "优先股（低费率）"], ["PGF", "金融业优先股"], ["PFXF", "非金融优先股"], ["FPE", "优先股与收益证券（主动）"], ["VRP", "浮动利率优先股"], ["PFLD", "短久期优先股"], ["PSK", "高评级优先股"]];
const NAME: Record<string, string> = Object.fromEntries([...PFD, ["TLT", "长期美债"], ["IEF", "中期美债"], ["SHY", "短期美债"], ["HYG", "高收益债"], ["LQD", "投资级债"], ["SPY", "标普 500"], ["VNQ", "房地产信托"], ["XLU", "公用事业"], ["XLF", "金融"], ["KBE", "银行"], ["KIE", "保险"], ["CWB", "可转债"]]);

/* WB */ export function PFWBPanel({ onClose }: P) {
  const syms = ["PFF", "PGX", "TLT", "IEF", "HYG", "^TNX"];
  const pack = useCloses(syms, 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const r = (s: string) => rets(m[s] ?? []).slice(-252);
  const beta = (a: string, b: string) => { const x = r(b), y = r(a); const n = Math.min(x.length, y.length); if (n < 30) return null; const mx = mean(x.slice(-n)), my = mean(y.slice(-n)); let c = 0, v = 0; for (let i = 0; i < n; i++) { c += (x[x.length - n + i] - mx) * (y[y.length - n + i] - my); v += (x[x.length - n + i] - mx) ** 2; } return v ? c / v : null; };
  const t = useTicks(["PFF", "^TNX"]);
  return (
    <PanelShell code="WB" title="优先股与利率、信用联动" onClose={onClose}>
      <Kpis items={[["优先股综合", fmtPrice(t.PFF?.price), fmtPct(t.PFF?.changePct)], ["10 年美债", t["^TNX"]?.price ? `${t["^TNX"].price.toFixed(3)}%` : "—"], ["对长债贝塔（1 年）", f2(beta("PFF", "TLT"), 2), "利率敏感度"], ["对高收益贝塔", f2(beta("PFF", "HYG"), 2), "信用敏感度"]]} />
      <SectionHead title="60 日滚动相关：优先股 vs 长债 / 高收益债" />
      <Lines zero series={[{ name: "对长期美债", color: "#38bdf8", values: rollingCorr(m.PFF ?? [], m.TLT ?? [], 60).slice(-500) }, { name: "对高收益债", color: "#f472b6", values: rollingCorr(m.PFF ?? [], m.HYG ?? [], 60).slice(-500) }]} xLabels={dates.slice(-500).map((d) => d.slice(2))} height={180} />
      <SectionHead title="优先股价格 vs 10 年美债收益率（两年）" />
      <Lines series={[{ name: "优先股（起点=100）", color: "#fbbf24", values: (m.PFF ?? []).slice(-500).map((v, i, a) => (v / a[0]) * 100) }, { name: "10 年收益率 ×20", color: "#38bdf8", values: (m["^TNX"] ?? []).slice(-500).map((v) => v * 20) }]} xLabels={dates.slice(-500).map((d) => d.slice(2))} height={160} fmt={(v) => v.toFixed(1)} />
    </PanelShell>
  );
}

/* WEI */ export function PFWEIPanel({ onClose }: P) {
  const L = ["PGF", "PFXF", "XLF", "KBE", "KIE", "XLU", "VNQ", "PFF", "SPY"];
  const pack = useCloses(L, 400);
  const ticks = useTicks(L);
  const { pick } = useHub();
  return (
    <PanelShell code="WEI" title="发行人行业轮动（优先股视角）" onClose={onClose}>
      <SectionHead title="主要优先股发行行业与对应优先股的区间表现" sub="银行、保险、公用事业与地产信托是优先股最大的发行方" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">今日</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">6月</th><th className="text-right">1年</th><th className="px-2 text-right">波动</th></tr></thead>
        <tbody>{L.map((s) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); return <tr key={s} onClick={() => pick(s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{NAME[s]}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className="text-right font-mono" style={{ color: toneOf(ticks[s]?.changePct) }}>{fmtPct(ticks[s]?.changePct)}</td>{[21, 63, 126, 252].map((n) => <td key={n} className="text-right font-mono" style={{ background: heat(perf(c, n), n / 10) }}>{sgn(perf(c, n), 1)}</td>)}<td className="px-2 text-right font-mono text-slate-400">{f2(annVol(c, 126), 1)}</td></tr>; })}</tbody>
      </table>
      <SectionHead title="金融业与非金融优先股相对表现（3 个月）" />
      <Bars data={["PGF", "PFXF", "PFF", "VRP", "PFLD"].map((s) => ({ k: NAME[s] ?? s, v: perf((pack.data?.[s] ?? []).map((x) => x[1]), 63) ?? 0 }))} fmt={(v) => `${v.toFixed(2)}%`} height={120} />
    </PanelShell>
  );
}

/* QFM */ export function PFQFMPanel({ onClose }: P) {
  const L = [...PFD.map(([s]) => s), "CWB", "HYG", "LQD"];
  const pack = useCloses(L, 400);
  const rows = useMemo(() => {
    const raw = L.map((s) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const ma200 = c.length >= 200 ? mean(c.slice(-200)) : null; return { s, m3: perf(c, 63), m6: perf(c, 126), m12: perf(c, 252), vol: annVol(c, 126), dd: c.length ? drawdown(c.slice(-252)).max : null, trend: ma200 ? (c[c.length - 1] / ma200 - 1) * 100 : null }; });
    const z = (k: keyof (typeof raw)[number], inv = false) => { const v = raw.map((r) => r[k] as number | null).filter((x): x is number => x != null); const mu = mean(v), sd = std(v) || 1; return (x: number | null) => (x == null ? 0 : ((x - mu) / sd) * (inv ? -1 : 1)); };
    const zm3 = z("m3"), zm6 = z("m6"), zm12 = z("m12"), zv = z("vol", true), zd = z("dd"), zt = z("trend");
    return raw.map((r) => { const f = { mom: (zm3(r.m3) + zm6(r.m6) + zm12(r.m12)) / 3, lowvol: zv(r.vol), quality: zd(r.dd), trend: zt(r.trend) }; return { ...r, ...f, score: f.mom * 0.35 + f.lowvol * 0.25 + f.quality * 0.2 + f.trend * 0.2 }; }).sort((a, b) => b.score - a.score);
  }, [pack.data]);
  return (
    <PanelShell code="QFM" title="多因子打分（优先股与混合资本）" onClose={onClose}>
      <SectionHead title="因子得分（标准化 z 值）与综合排名" sub="动量 35% · 低波动 25% · 回撤质量 20% · 趋势 20%；全部由最新日线实时计算" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">排名</th><th className="text-left">标的</th><th className="text-right">动量</th><th className="text-right">低波动</th><th className="text-right">回撤质量</th><th className="text-right">趋势</th><th className="text-right">综合</th><th className="text-right">6月</th><th className="px-2 text-right">波动</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-500">{i + 1}</td><td className="text-slate-100">{NAME[r.s] ?? r.s}</td>{[r.mom, r.lowvol, r.quality, r.trend].map((v, j) => <td key={j} className="text-right font-mono" style={{ background: heat(v, 2) }}>{v.toFixed(2)}</td>)}<td className="text-right font-mono font-semibold text-white">{r.score.toFixed(2)}</td><td className="text-right font-mono" style={{ color: toneOf(r.m6) }}>{sgn(r.m6, 1)}</td><td className="px-2 text-right font-mono text-slate-400">{f2(r.vol, 1)}</td></tr>)}{!pack.data && <tr><td colSpan={9}><Empty loading /></td></tr>}</tbody>
      </table>
    </PanelShell>
  );
}

type Filing = { id: string; company: string; ticker: string | null; form: string; date: string; items: string[]; url: string };
/* EDS */ export function PFEDSPanel({ onClose }: P) {
  const [t, setT] = useState("redeem");
  const Q: Record<string, [string, string[], number]> = { redeem: ['"redemption" "preferred stock"', ["8-K"], 60], issue: ['"depositary shares" "preferred stock"', ["424B2", "424B5", "FWP"], 60], suspend: ['"suspend" "preferred" dividend', ["8-K"], 180], reset: ['"fixed-to-floating" OR "reset" "preferred"', ["8-K", "424B5"], 120] };
  const f = usePolled<{ total: number; rows: Filing[] }>("ucHubs.edgar", { q: Q[t][0], forms: Q[t][1], days: Q[t][2] }, 1800_000);
  return (
    <PanelShell code="EDS" title="事件驱动：优先股公告" onClose={onClose} tabs={[["redeem", "赎回公告"], ["issue", "新发行"], ["suspend", "暂停派息"], ["reset", "浮动 / 重定价"]]} tab={t} setTab={setT} right={f.data ? <span>{f.data.total} 份</span> : null}>
      <DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: `${r.company}${r.ticker ? `（${r.ticker}）` : ""}`, sub: `${r.form}${r.items.length ? ` · 事项 ${r.items.join(", ")}` : ""}`, date: r.date, url: r.url, tag: r.form }))} />
    </PanelShell>
  );
}

/* CMA */ export function PFCMAPanel({ onClose }: P) {
  const L = ["PFF", "LQD", "HYG", "CWB", "SPY", "VNQ", "XLU", "TLT"];
  const pack = useCloses(L, 760);
  const { m } = useMemo(() => align(pack.data ?? null, L), [pack.data]);
  const R = Object.fromEntries(L.map((s) => [s, rets(m[s] ?? []).slice(-252)]));
  return (
    <PanelShell code="CMA" title="跨市场比较" onClose={onClose}>
      <SectionHead title="优先股与其他收益型资产：风险收益（1 年）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th><th className="text-right">1年</th><th className="text-right">波动</th><th className="text-right">最大回撤</th><th className="text-right">与优先股相关</th><th className="px-2 text-right">与标普相关</th></tr></thead>
        <tbody>{L.map((s) => { const c = (m[s] ?? []).slice(-253); return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{NAME[s]}</td><td className="text-right font-mono" style={{ color: toneOf(perf(c, 252)) }}>{sgn(perf(c, 252), 1)}</td><td className="text-right font-mono text-slate-300">{f2(annVol(c), 1)}</td><td className="text-right font-mono text-emerald-300">{c.length ? sgn(drawdown(c).max, 1) : "—"}</td><td className="text-right font-mono" style={{ background: heat(corr(R.PFF, R[s]), 1) }}>{f2(corr(R.PFF, R[s]), 2)}</td><td className="px-2 text-right font-mono" style={{ background: heat(corr(R.SPY, R[s]), 1) }}>{f2(corr(R.SPY, R[s]), 2)}</td></tr>; })}</tbody>
      </table>
      <Bars data={L.map((s) => ({ k: NAME[s], v: perf(m[s] ?? [], 252) ?? 0, v2: annVol((m[s] ?? []).slice(-253)) ?? 0 }))} label={["1 年收益", "波动率"]} fmt={(v) => `${v.toFixed(1)}%`} height={140} />
    </PanelShell>
  );
}

function weightsTable(syms: string[], ws: Record<string, number[]>, cov: number[][], mu: number[]) {
  return (
    <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th>{Object.keys(ws).map((k) => <th key={k} className="text-right">{k}</th>)}</tr></thead>
      <tbody>{syms.map((s, i) => <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{NAME[s] ?? s}</td>{Object.values(ws).map((w, j) => <td key={j} className="text-right font-mono text-white">{((w[i] ?? 0) * 100).toFixed(1)}%</td>)}</tr>)}
        <tr className="border-t border-[#1d3047]"><td className="px-2 py-1 text-slate-400">预期波动</td>{Object.values(ws).map((w, j) => <td key={j} className="text-right font-mono text-slate-200">{portVol(w, cov).toFixed(2)}%</td>)}</tr>
        <tr><td className="px-2 py-1 text-slate-400">历史年化收益</td>{Object.values(ws).map((w, j) => <td key={j} className="text-right font-mono text-slate-200">{(w.reduce((a, x, i) => a + x * mu[i], 0) * 100).toFixed(2)}%</td>)}</tr></tbody>
    </table>
  );
}
/* POR */ export function PFPORPanel({ onClose }: P) {
  const [sel, setSel] = useState(["PFF", "PGF", "VRP", "PFLD", "HYG", "IEF", "SHY"]);
  const pack = useCloses(sel, 400);
  const { m } = useMemo(() => align(pack.data ?? null, sel), [pack.data, sel.join()]);
  const R = sel.map((s) => rets((m[s] ?? []).slice(-253)));
  const ok = R.every((r) => r.length > 60);
  const cov = ok ? covMatrix(R) : [];
  const mu = R.map((r) => mean(r) * 252);
  const maxSharpe = (() => { if (!ok) return []; let w = sel.map(() => 1 / sel.length); for (let it = 0; it < 2000; it++) { const pv = w.reduce((s, wi, i) => s + wi * cov[i].reduce((t, c, j) => t + c * w[j], 0), 0); const pr = w.reduce((s, wi, i) => s + wi * (mu[i] - 0.04), 0); const g = sel.map((_, i) => (mu[i] - 0.04) / Math.sqrt(pv) - (pr * cov[i].reduce((t, c, j) => t + c * w[j], 0)) / Math.pow(pv, 1.5)); w = w.map((x, i) => Math.max(0, x + 0.01 * g[i])); const s = w.reduce((a, b) => a + b, 0) || 1; w = w.map((x) => x / s); } return w; })();
  const ws = ok ? { 等权: sel.map(() => 1 / sel.length), 最小方差: minVariance(cov), 风险平价: riskParity(cov), 最大夏普: maxSharpe } : {};
  const ALL = [...PFD.map(([s]) => s), "HYG", "LQD", "IEF", "SHY", "TLT", "CWB"];
  return (
    <PanelShell code="POR" title="多目标组合优化" onClose={onClose}>
      <div className="flex flex-wrap gap-1 px-2 py-1">{ALL.map((s) => <button key={s} type="button" onClick={() => setSel((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))} className={`border px-1.5 text-[10px] ${sel.includes(s) ? "border-cyan-500 text-cyan-200" : "border-[#1d3047] text-slate-500"}`}>{NAME[s] ?? s}</button>)}</div>
      <SectionHead title="四种目标下的最优权重（基于最近一年日收益，实时重算）" />
      {ok ? weightsTable(sel, ws, cov, mu) : <Empty loading={pack.loading} text="至少选择两个有一年数据的资产" />}
    </PanelShell>
  );
}

/* AIDE */ export function PFAIDEPanel({ onClose }: P) {
  const L = PFD.map(([s]) => s);
  const pack = useCloses([...L, "^TNX", "HYG", "IEI"], 300);
  const c = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
  const tnx = c("^TNX");
  const rate1m = tnx.length > 21 ? (tnx[tnx.length - 1] - tnx[tnx.length - 22]) * 100 : null;
  const cr = perf(c("HYG"), 21) != null && perf(c("IEI"), 21) != null ? perf(c("HYG"), 21)! - perf(c("IEI"), 21)! : null;
  const rows = L.map((s) => {
    const x = c(s);
    if (x.length < 200) return { s, score: null as number | null, reasons: ["历史不足"] };
    const p = x[x.length - 1], m50 = mean(x.slice(-50)), m200 = mean(x.slice(-200));
    const reasons: string[] = [];
    let score = 0;
    if (p > m50) { score += 1; reasons.push("站上 50 日均线"); } else { score -= 1; reasons.push("跌破 50 日均线"); }
    if (m50 > m200) { score += 1; reasons.push("中期趋势向上"); } else { score -= 1; reasons.push("中期趋势向下"); }
    const mo = perf(x, 63) ?? 0;
    score += mo > 2 ? 1 : mo < -2 ? -1 : 0;
    reasons.push(`3 月动量 ${mo.toFixed(1)}%`);
    if (rate1m != null) { score += rate1m < -15 ? 1 : rate1m > 15 ? -1 : 0; reasons.push(`10 年利率 1 月 ${rate1m > 0 ? "+" : ""}${rate1m.toFixed(0)}bp`); }
    if (cr != null) { score += cr > 0.3 ? 1 : cr < -0.3 ? -1 : 0; reasons.push(`信用相对国债 ${cr > 0 ? "+" : ""}${cr.toFixed(2)}%`); }
    return { s, score, reasons };
  });
  return (
    <PanelShell code="AIDE" title="决策引擎（可解释规则模型）" onClose={onClose} right={<span>每次打开按最新行情重算</span>}>
      <SectionHead title="五项规则打分（−5 ~ +5）：均线位置、趋势、动量、利率方向、信用方向" />
      <table className="w-full text-[11px]"><tbody>{rows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-100">{NAME[r.s]}</td><td className="text-center font-mono text-[14px]" style={{ color: r.score == null ? "#64748b" : r.score >= 2 ? "#f2495c" : r.score <= -2 ? "#1fbf75" : "#e2e8f0" }}>{r.score == null ? "—" : `${r.score > 0 ? "+" : ""}${r.score}`}</td><td className="text-[11px]" style={{ color: r.score == null ? "#64748b" : r.score >= 2 ? "#f2495c" : r.score <= -2 ? "#1fbf75" : "#94a3b8" }}>{r.score == null ? "" : r.score >= 2 ? "偏多" : r.score <= -2 ? "偏空" : "中性"}</td><td className="px-2 text-[10px] text-slate-500">{r.reasons.join(" · ")}</td></tr>)}</tbody></table>
    </PanelShell>
  );
}

/* VIZ */ export function PFVIZPanel({ onClose }: P) {
  const [sel, setSel] = useState(["PFF", "PGX", "VRP", "PFLD", "HYG"]);
  const [range, setRange] = useState("250");
  const pack = useCloses(sel, 1300);
  const { dates, m } = useMemo(() => align(pack.data ?? null, sel), [pack.data, sel.join()]);
  const n = Number(range);
  const COL = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb923c", "#94a3b8", "#f2495c"];
  const ALL = [...PFD.map(([s]) => s), "HYG", "LQD", "TLT", "SPY", "CWB"];
  return (
    <PanelShell code="VIZ" title="交互式走势对比" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1">{ALL.map((s) => <button key={s} type="button" onClick={() => setSel((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s].slice(-8)))} className={`border px-1.5 text-[10px] ${sel.includes(s) ? "border-cyan-500 text-cyan-200" : "border-[#1d3047] text-slate-500"}`}>{NAME[s] ?? s}</button>)}<span className="ml-auto"><Seg value={range} onChange={setRange} options={[["63", "3月"], ["250", "1年"], ["500", "2年"], ["1250", "5年"]]} /></span></div>
      <SectionHead title="归一化走势（起点为 100）" />
      <Lines series={sel.map((s, i) => { const c = (m[s] ?? []).slice(-n); return { name: NAME[s] ?? s, color: COL[i % COL.length], values: c.map((v) => (v / c[0]) * 100) }; })} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={240} fmt={(v) => v.toFixed(1)} />
      <SectionHead title="区间回撤（%）" />
      <Lines series={sel.map((s, i) => ({ name: NAME[s] ?? s, color: COL[i % COL.length], values: drawdown((m[s] ?? []).slice(-n)).series }))} height={140} fmt={(v) => v.toFixed(1)} />
    </PanelShell>
  );
}

/* PORD */ export function PFPORDPanel({ onClose }: P) {
  const S = ["PFF", "HYG", "IEF", "SHY"];
  const [budget, setBudget] = useState([40, 25, 25, 10]);
  const pack = useCloses(S, 1300);
  const { dates, m } = useMemo(() => align(pack.data ?? null, S), [pack.data]);
  const n = Math.min(...S.map((s) => m[s]?.length ?? 0));
  const res = useMemo(() => {
    if (n < 200) return null;
    const b = budget.map((x) => x / budget.reduce((a, y) => a + y, 0));
    let v = 1, bh = 1, w = S.map(() => 0.25);
    const eq: number[] = [], eqbh: number[] = [];
    const w0 = S.map(() => 0.25);
    for (let i = 63; i < n; i++) {
      if ((i - 63) % 21 === 0) { const vols = S.map((s) => std(rets(m[s].slice(i - 63, i + 1))) || 1e-4); const raw = b.map((x, k) => x / vols[k]); const t = raw.reduce((a, y) => a + y, 0); w = raw.map((x) => x / t); }
      v *= 1 + S.reduce((a, s, k) => a + w[k] * (m[s][i] / m[s][i - 1] - 1), 0);
      bh *= 1 + S.reduce((a, s, k) => a + w0[k] * (m[s][i] / m[s][i - 1] - 1), 0);
      eq.push(v); eqbh.push(bh);
    }
    return { eq, eqbh, w };
  }, [m, n, budget.join()]);
  return (
    <PanelShell code="PORD" title="动态再平衡与风险预算" onClose={onClose}>
      <div className="flex flex-wrap gap-3 px-2 py-1 text-[11px] text-slate-400">{S.map((s, i) => <label key={s}>{NAME[s]} 风险预算 % <input type="number" value={budget[i]} onChange={(e) => setBudget((b) => b.map((x, j) => (j === i ? Math.max(0, Number(e.target.value) || 0) : x)))} className="w-14 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-white" /></label>)}</div>
      {res ? <>
        <Kpis items={[["风险预算策略累计", sgn((res.eq[res.eq.length - 1] - 1) * 100)], ["等权买入持有累计", sgn((res.eqbh[res.eqbh.length - 1] - 1) * 100)], ["策略最大回撤", sgn(drawdown(res.eq).max)], ["当前目标权重", res.w.map((x, i) => `${S[i]} ${(x * 100).toFixed(0)}%`).join(" ")]]} />
        <SectionHead title="净值曲线（每月按风险预算调仓，五年）" />
        <Lines series={[{ name: "风险预算", color: "#fbbf24", values: res.eq }, { name: "等权持有", color: "#94a3b8", values: res.eqbh }]} xLabels={dates.slice(-res.eq.length).map((d) => d.slice(2))} height={220} />
      </> : <Empty loading={pack.loading} />}
    </PanelShell>
  );
}

/* RPA */ export function PFRPAPanel({ onClose }: P) {
  const [s, setS] = useState("PFF");
  const F = ["TLT", "HYG", "SPY"];
  const syms = [s, ...F];
  const pack = useCloses(syms, 400);
  const { m } = useMemo(() => align(pack.data ?? null, syms), [pack.data, s]);
  const res = useMemo(() => {
    const y = rets((m[s] ?? []).slice(-253));
    const X = F.map((f) => rets((m[f] ?? []).slice(-253)));
    const n = Math.min(y.length, ...X.map((x) => x.length));
    if (n < 60) return null;
    const yy = y.slice(-n), XX = X.map((x) => x.slice(-n));
    // 普通最小二乘（带截距）：解正规方程
    const k = F.length + 1;
    const A = Array.from({ length: k }, () => new Array(k).fill(0)), bvec = new Array(k).fill(0);
    for (let t = 0; t < n; t++) { const row = [1, ...XX.map((x) => x[t])]; for (let i = 0; i < k; i++) { bvec[i] += row[i] * yy[t]; for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j]; } }
    for (let i = 0; i < k; i++) { let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [bvec[i], bvec[p]] = [bvec[p], bvec[i]]; for (let r = i + 1; r < k; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < k; c++) A[r][c] -= f * A[i][c]; bvec[r] -= f * bvec[i]; } }
    const beta = new Array(k).fill(0);
    for (let i = k - 1; i >= 0; i--) { let s2 = bvec[i]; for (let c = i + 1; c < k; c++) s2 -= A[i][c] * beta[c]; beta[i] = s2 / A[i][i]; }
    const fit = yy.map((_, t) => beta[0] + XX.reduce((a, x, j) => a + beta[j + 1] * x[t], 0));
    const ssr = yy.reduce((a, v, t) => a + (v - fit[t]) ** 2, 0), sst = yy.reduce((a, v) => a + (v - mean(yy)) ** 2, 0);
    const contrib = XX.map((x, j) => beta[j + 1] * x.reduce((a, v) => a + v, 0) * 100);
    return { beta, r2: 1 - ssr / sst, contrib, alpha: beta[0] * n * 100, total: yy.reduce((a, v) => a + v, 0) * 100 };
  }, [m, s]);
  return (
    <PanelShell code="RPA" title="风险归因（利率 / 信用 / 股票）" onClose={onClose} tabs={PFD.slice(0, 7).map(([x, l]) => [x, l])} tab={s} setTab={setS}>
      {res ? <>
        <Kpis items={[["利率因子贝塔（长债）", res.beta[1].toFixed(3)], ["信用因子贝塔（高收益）", res.beta[2].toFixed(3)], ["股票因子贝塔（标普）", res.beta[3].toFixed(3)], ["拟合优度 R²", res.r2.toFixed(3)]]} />
        <SectionHead title="过去一年收益归因（对数收益，%）" sub={`总收益 ${res.total.toFixed(2)}%`} />
        <Bars data={[{ k: "利率", v: res.contrib[0] }, { k: "信用", v: res.contrib[1] }, { k: "股票", v: res.contrib[2] }, { k: "特异（截距）", v: res.alpha }]} fmt={(v) => `${v.toFixed(2)}%`} height={150} />
      </> : <Empty loading={pack.loading} />}
    </PanelShell>
  );
}

/* AID */ export function PFAIDPanel({ onClose }: P) {
  const [risk, setRisk] = useState("3");
  const [need, setNeed] = useState("income");
  const L = ["PFF", "PFLD", "VRP", "PGF", "SHY", "IEF", "HYG"];
  const pack = useCloses(L, 760);
  const { m } = useMemo(() => align(pack.data ?? null, L), [pack.data]);
  const target = [4, 6, 8, 10, 13][Number(risk) - 1];
  const mix: Record<string, number> = need === "income" ? { PFF: 0.4, PGF: 0.2, VRP: 0.2, SHY: 0.2 } : need === "rate" ? { PFLD: 0.35, VRP: 0.35, SHY: 0.3 } : { PFF: 0.3, HYG: 0.3, IEF: 0.4 };
  const syms = Object.keys(mix);
  const ok = syms.every((s) => (m[s]?.length ?? 0) > 250);
  const cov = ok ? covMatrix(syms.map((s) => rets(m[s].slice(-253)))) : [];
  const vol0 = ok ? portVol(syms.map((s) => mix[s]), cov) : null;
  const scale = vol0 ? Math.min(1, target / vol0) : 1;
  const eq = ok ? (() => { let v = 1; const out: number[] = []; const n = Math.min(...syms.map((s) => m[s].length)); for (let i = n - 500; i < n; i++) { if (i < 1) continue; v *= 1 + syms.reduce((a, s) => a + mix[s] * scale * (m[s][i] / m[s][i - 1] - 1), 0); out.push(v); } return out; })() : [];
  return (
    <PanelShell code="AID" title="智能配置建议（按风险偏好与目标）" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-3 px-2 py-1 text-[11px] text-slate-400"><span>风险承受（1 保守 ~ 5 进取）</span><Seg value={risk} onChange={setRisk} options={[["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]} /><span>主要目标</span><Seg value={need} onChange={setNeed} options={[["income", "稳定收息"], ["rate", "防利率上行"], ["balance", "股债平衡"]]} /></div>
      {ok ? <>
        <Kpis items={[["目标波动率", `${target}%`], ["组合原始波动", `${vol0!.toFixed(2)}%`], ["风险资产比例", `${(scale * 100).toFixed(0)}%`, "其余为现金"], ["两年最大回撤（回测）", sgn(drawdown(eq).max)]]} />
        <SectionHead title="建议配置" />
        <table className="w-full text-[11px]"><tbody>{syms.map((s) => <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{NAME[s]}</td><td className="px-2 text-right font-mono text-white">{(mix[s] * scale * 100).toFixed(1)}%</td></tr>)}<tr className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">现金</td><td className="px-2 text-right font-mono text-white">{((1 - scale) * 100).toFixed(1)}%</td></tr></tbody></table>
        <SectionHead title="过去两年按此配置的净值" />
        <Lines series={[{ name: "建议配置", color: "#fbbf24", values: eq }]} height={150} />
        <div className="px-2 pb-2 text-[10px] text-slate-500">基于历史数据的规则化配置，不构成投资建议。</div>
      </> : <Empty loading={pack.loading} />}
    </PanelShell>
  );
}

type Platform = { uptimeSec: number; node: string; cpus: number; load: number[]; sysMemTotal: number; sysMemFree: number; rss: number; heapUsed: number; heapTotal: number; streamClients: number; cacheEntries: number; warehouse: { news: number; kline: number; ticks: number; klineSymbols: number; partitions?: Record<string, string> } | null; warm?: Array<{ at: number; label: string; symbols: number; ms: number; ticks: number }>; feeds: { total: number; online: number; items: number }; lines: Array<{ line: string; ok: boolean; lastOkSec: number | null; fails: number }>; procs: Array<{ name: string; area: string; n: number; err: number; avg: number; max: number; lastSec: number }>; areas: Array<{ area: string; n: number; avg: number; err: number }>; perMinute: number[] };
const usePlatform = () => usePolled<Platform>("ucHubs.platform", {}, 5000);
const dur = (s: number) => `${Math.floor(s / 86400)}天${Math.floor((s % 86400) / 3600)}时${Math.floor((s % 3600) / 60)}分`;

/* DAT */ export function PFDATPanel({ onClose }: P) {
  const p = usePlatform();
  const w = p.data?.warehouse;
  return (
    <PanelShell code="DAT" title="数据层 · 平台数据仓库" onClose={onClose} right={<span>每 5 秒刷新</span>}>
      <Kpis items={[["已入库新闻", fmtCompact(w?.news), "清洗去重后永久保存"], ["已入库 K 线", fmtCompact(w?.kline), `${w?.klineSymbols ?? "—"} 个标的`], ["分钟行情快照", fmtCompact(w?.ticks)], ["新闻频道在线", p.data ? `${p.data.feeds.online} / ${p.data.feeds.total}` : "—", `${fmtCompact(p.data?.feeds.items)} 条在内存`]]} />
      <SectionHead title="行情线路健康（多线路自动切换）" />
      <table className="w-full text-[11px]"><tbody>{(p.data?.lines ?? []).map((l) => <tr key={l.line} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{l.line}</td><td style={{ color: l.ok ? "#1fbf75" : "#f2495c" }}>{l.ok ? "正常" : "暂停（自动切换中）"}</td><td className="text-right font-mono text-slate-400">{l.lastOkSec == null ? "—" : `${l.lastOkSec} 秒前成功`}</td><td className="px-2 text-right font-mono text-slate-500">连续失败 {l.fails}</td></tr>)}</tbody></table>
      <SectionHead title="数据库分区" />
      <table className="w-full text-[11px]"><tbody>{Object.entries(w?.partitions ?? {}).map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-300">{k === "uc_tick_minute" ? "分钟行情（按日分区）" : k === "uc_kline" ? "K 线（按年分区）" : k}</td><td className="px-2 text-right text-slate-200">{v}</td></tr>)}</tbody></table>
      <SectionHead title="开盘前预热记录" />
      <table className="w-full text-[11px]"><tbody>{(p.data?.warm ?? []).map((x) => <tr key={x.at} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{new Date(x.at).toLocaleString("zh-CN", { hour12: false })}</td><td className="text-slate-200">{x.label}</td><td className="text-right font-mono text-slate-300">{x.symbols} 个标的 · {x.ticks} 个报价</td><td className="px-2 text-right font-mono text-slate-400">{(x.ms / 1000).toFixed(1)} 秒</td></tr>)}{!(p.data?.warm ?? []).length && <tr><td className="px-2 py-1 text-slate-500">启动后 1 分钟执行首次预热</td></tr>}</tbody></table>
      <div className="px-2 py-1 text-[10px] text-slate-500">所有数据先清洗去重再写入平台自有数据库；上游任一线路异常时自动切换，并可直接从自有库回放历史。</div>
    </PanelShell>
  );
}

/* MDL */ export function PFMDLPanel({ onClose }: P) {
  const L = ["SPY", "QQQ", "PFF", "TLT", "GLD", "IWM"];
  const [s, setS] = useState("SPY");
  const k = usePolled<{ candles: Candle[] }>("ucMarket.kline", { symbol: s, period: "1d", limit: 750 }, 600_000);
  const stats = useMemo(() => {
    const c = k.data?.candles ?? [];
    const sig = tradeSignals(c);
    const fwd = (i: number, n: number) => (i + n < c.length ? (c[i + n].c / c[i].c - 1) * 100 : null);
    const agg = (side: "B" | "S", n: number) => { const v = sig.filter((x) => x.side === side).map((x) => fwd(x.i, n)).filter((x): x is number => x != null); return { n: v.length, avg: v.length ? mean(v) : null, hit: v.length ? (v.filter((x) => (side === "B" ? x > 0 : x < 0)).length / v.length) * 100 : null }; };
    const base = (n: number) => { const v: number[] = []; for (let i = 0; i + n < c.length; i++) v.push(fwd(i, n)!); return v.length ? mean(v) : null; };
    return { sig, rows: [5, 10, 20].map((n) => ({ n, b: agg("B", n), s: agg("S", n), base: base(n) })), recent: sig.slice(-10).reverse().map((x) => ({ ...x, date: c[x.i] ? new Date(c[x.i].t).toISOString().slice(0, 10) : "" })) };
  }, [k.data]);
  return (
    <PanelShell code="MDL" title="模型层 · 买卖点模型实盘检验" onClose={onClose} tabs={L.map((x) => [x, x])} tab={s} setTab={setS}>
      <SectionHead title="K 线买卖点模型（MACD / KDJ / 均线 / SAR / 布林 / RSI 多指标共振）近三年的事后表现" sub={`共 ${stats.sig.length} 个信号`} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">持有期</th><th className="text-right">买点次数</th><th className="text-right">买点平均收益</th><th className="text-right">买点胜率</th><th className="text-right">卖点次数</th><th className="text-right">卖点后平均收益</th><th className="text-right">卖点胜率</th><th className="px-2 text-right">同期随机基准</th></tr></thead>
        <tbody>{stats.rows.map((r) => <tr key={r.n} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{r.n} 日</td><td className="text-right font-mono text-slate-300">{r.b.n}</td><td className="text-right font-mono" style={{ color: toneOf(r.b.avg) }}>{sgn(r.b.avg)}</td><td className="text-right font-mono text-white">{f2(r.b.hit, 0, "%")}</td><td className="text-right font-mono text-slate-300">{r.s.n}</td><td className="text-right font-mono" style={{ color: toneOf(r.s.avg) }}>{sgn(r.s.avg)}</td><td className="text-right font-mono text-white">{f2(r.s.hit, 0, "%")}</td><td className="px-2 text-right font-mono text-slate-400">{sgn(r.base)}</td></tr>)}</tbody>
      </table>
      <SectionHead title="最近 10 个信号" />
      <table className="w-full text-[11px]"><tbody>{stats.recent.map((x) => <tr key={x.i} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{x.date}</td><td className="font-semibold" style={{ color: x.side === "B" ? "#f2495c" : "#1fbf75" }}>{x.side === "B" ? "买点" : "卖点"}</td><td className="px-2 text-[10px] text-slate-400">{x.reasons.join("、")}</td></tr>)}{!k.data && <tr><td><Empty loading /></td></tr>}</tbody></table>
    </PanelShell>
  );
}

/* APP */ export function PFAPPPanel({ onClose }: P) {
  const p = usePlatform();
  return (
    <PanelShell code="APP" title="应用层 · 接口调用与延迟" onClose={onClose} right={<span>每 5 秒刷新</span>}>
      <SectionHead title="近 60 分钟每分钟接口调用量" />
      <Bars data={(p.data?.perMinute ?? []).map((v, i) => ({ k: `${i - 59}`, v }))} fmt={(v) => v.toFixed(0)} height={110} />
      <SectionHead title="按业务域汇总" />
      <table className="w-full text-[11px]"><tbody>{(p.data?.areas ?? []).map((a) => <tr key={a.area} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{a.area}</td><td className="text-right font-mono text-white">{a.n.toLocaleString()} 次</td><td className="text-right font-mono text-slate-300">平均 {a.avg.toFixed(0)} ms</td><td className="px-2 text-right font-mono" style={{ color: a.err ? "#f2495c" : "#64748b" }}>失败 {a.err}</td></tr>)}</tbody></table>
      <SectionHead title="调用最多的接口（自本次启动）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">接口</th><th className="text-right">次数</th><th className="text-right">平均</th><th className="text-right">最慢</th><th className="px-2 text-right">最近</th></tr></thead><tbody>{(p.data?.procs ?? []).map((x) => <tr key={x.name} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-300">{x.name}</td><td className="text-right font-mono text-white">{x.n}</td><td className="text-right font-mono" style={{ color: x.avg > 2000 ? "#fbbf24" : "#e2e8f0" }}>{x.avg.toFixed(0)} ms</td><td className="text-right font-mono text-slate-400">{x.max} ms</td><td className="px-2 text-right font-mono text-slate-500">{x.lastSec}s</td></tr>)}</tbody></table>
    </PanelShell>
  );
}

/* INF */ export function PFINFPanel({ onClose }: P) {
  const p = usePlatform();
  const d = p.data;
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => { if (d) setHist((h) => [...h.slice(-59), d.heapUsed / 1048576]); }, [d]);
  return (
    <PanelShell code="INF" title="基础设施层 · 服务运行状态" onClose={onClose} right={<span>每 5 秒刷新</span>}>
      <Kpis items={[["持续运行", d ? dur(d.uptimeSec) : "—"], ["系统负载（1/5/15 分）", d ? d.load.map((x) => x.toFixed(2)).join(" / ") : "—", d ? `${d.cpus} 核` : undefined], ["服务内存", d ? `${(d.rss / 1048576).toFixed(0)} MB` : "—", d ? `堆 ${(d.heapUsed / 1048576).toFixed(0)} / ${(d.heapTotal / 1048576).toFixed(0)} MB` : undefined], ["系统可用内存", d ? `${(d.sysMemFree / 1073741824).toFixed(1)} / ${(d.sysMemTotal / 1073741824).toFixed(1)} GB` : "—"], ["实时推送连接", d?.streamClients ?? "—"], ["缓存条目", d?.cacheEntries ?? "—"], ["运行环境", d?.node ?? "—"], ["行情线路", d ? `${d.lines.filter((l) => l.ok).length} / ${d.lines.length} 正常` : "—"]]} />
      <SectionHead title="堆内存（MB，本窗口打开以来每 5 秒）" />
      <Lines series={[{ name: "堆内存", color: "#38bdf8", values: hist }]} height={130} fmt={(v) => v.toFixed(0)} />
    </PanelShell>
  );
}

type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }> };
/* PRC */ export function PFPRCPanel({ onClose }: P) {
  const c = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const [par, setPar] = useState(25);
  const [coupon, setCoupon] = useState(6.0);
  const [price, setPrice] = useState(24.5);
  const [callYears, setCallYears] = useState(3);
  const [kind, setKind] = useState("fixed");
  const [floatSpread, setFloatSpread] = useState(3.0);
  const tenorY: Record<string, number> = { "3M": 0.25, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3, "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30 };
  const pts = (c.data?.us[0]?.points ?? []).map((p) => [tenorY[p.tenor], p.value] as [number, number]).filter(([t]) => t != null).sort((a, b) => a[0] - b[0]);
  const rAt = (t: number) => { if (!pts.length) return 4; if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, r0] = pts[i - 1], [t1, r1] = pts[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); } return pts[pts.length - 1][1]; };
  const div = (par * coupon) / 100;
  const cy = (div / price) * 100;
  const ytc = (() => { let lo = -50, hi = 100; const n = Math.round(callYears * 4); for (let it = 0; it < 100; it++) { const y = (lo + hi) / 2; const q = y / 400; let pv = 0; for (let i = 1; i <= n; i++) pv += div / 4 / Math.pow(1 + q, i); pv += par / Math.pow(1 + q, n); if (pv > price) lo = y; else hi = y; } return (lo + hi) / 2; })();
  const sofr = rAt(0.25);
  const floatYield = kind === "float" ? ((par * (sofr + floatSpread)) / 100 / price) * 100 : null;
  const ytw = Math.min(cy, ytc);
  const spread = (ytw - rAt(kind === "fixed" ? 30 : callYears)) * 100;
  const inp = "w-20 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-[11px] text-white";
  return (
    <PanelShell code="PRC" title="优先股定价模型" onClose={onClose} right={<span>基准曲线：美债 {c.data?.us[0]?.date ?? "…"}</span>}>
      <div className="flex flex-wrap gap-3 px-2 py-1 text-[11px] text-slate-400"><Seg value={kind} onChange={setKind} options={[["fixed", "固定股息永续"], ["float", "固定转浮动"]]} /><label>面值 <input type="number" value={par} onChange={(e) => setPar(Number(e.target.value) || 25)} className={inp} /></label><label>股息率 % <input type="number" step={0.125} value={coupon} onChange={(e) => setCoupon(Number(e.target.value) || 0)} className={inp} /></label><label>市价 <input type="number" step={0.05} value={price} onChange={(e) => setPrice(Number(e.target.value) || 1)} className={inp} /></label><label>距可赎回（年） <input type="number" step={0.25} value={callYears} onChange={(e) => setCallYears(Math.max(0.25, Number(e.target.value) || 1))} className={inp} /></label>{kind === "float" && <label>浮动利差 % <input type="number" step={0.05} value={floatSpread} onChange={(e) => setFloatSpread(Number(e.target.value) || 0)} className={inp} /></label>}</div>
      <Kpis items={[["当期收益率", `${cy.toFixed(3)}%`], ["赎回收益率", `${ytc.toFixed(3)}%`], ["最差收益率", `${ytw.toFixed(3)}%`], ["对美债利差", `${spread.toFixed(0)}bp`], ["年股息", `${div.toFixed(3)}`], ["价格相对面值", `${((price / par - 1) * 100).toFixed(2)}%`, price > par ? "溢价：赎回风险高" : "折价：赎回概率低"], ["3 个月基准利率", `${sofr.toFixed(2)}%`], ["浮动后股息率", floatYield != null ? `${floatYield.toFixed(3)}%` : "—"]]} />
      <SectionHead title="不同市价下的当期收益率与赎回收益率" />
      <Lines series={[{ name: "当期收益率", color: "#38bdf8", values: Array.from({ length: 21 }, (_, i) => ((div / (par * (0.85 + i * 0.015))) * 100)) }, { name: "对应美债（同期限）", color: "#64748b", values: Array.from({ length: 21 }, () => rAt(kind === "fixed" ? 30 : callYears)), dash: true }]} xLabels={Array.from({ length: 21 }, (_, i) => (par * (0.85 + i * 0.015)).toFixed(2))} height={160} />
    </PanelShell>
  );
}

type BS = { symbol: string; asOf: string | null; assets: number | null; liabilities: number | null; debt: number | null; equity: number | null; marketCap: number | null; preferred: number | null; interest: number | null; ebit: number | null };
/* CRD */ export function PFCRDPanel({ onClose }: P) {
  const ISS: Array<[string, string]> = [["JPM", "摩根大通"], ["BAC", "美国银行"], ["WFC", "富国银行"], ["C", "花旗"], ["GS", "高盛"], ["MS", "摩根士丹利"], ["USB", "美国合众银行"], ["MET", "大都会人寿"], ["PRU", "保德信"], ["ALL", "好事达"], ["DUK", "杜克能源"], ["SO", "南方电力"], ["NEE", "新纪元能源"], ["PSA", "Public Storage"]];
  const bs = usePolled<BS[]>("ucHubs.balance", { symbols: ISS.map(([s]) => s) }, 12 * 3600_000);
  const pack = useCloses(ISS.map(([s]) => s), 300);
  const c = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const r = (c.data?.us[0]?.points.find((p) => p.tenor === "1Y")?.value ?? 4) / 100;
  const rows = ISS.map(([s, l]) => {
    const b = bs.data?.find((x) => x.symbol === s);
    const closes = (pack.data?.[s] ?? []).map((x) => x[1]);
    const sE = (annVol(closes, 252) ?? 0) / 100;
    const E = b?.marketCap ?? null;
    const D = b?.liabilities ?? b?.debt ?? null;
    if (!E || !D || !sE) return { s, l, E, D, sE, dd: null as number | null, pd: null as number | null, lev: null as number | null, cov: b?.ebit && b?.interest ? b.ebit / Math.abs(b.interest) : null };
    // 默顿模型（简化：资产价值 = 股权市值 + 负债，资产波动 = 股权波动 × 股权占比；违约点取全部负债，期限 1 年）
    const V = E + D, sV = (sE * E) / V;
    const dd = (Math.log(V / D) + (r - (sV * sV) / 2)) / sV;
    return { s, l, E, D, sE, dd, pd: ncdf(-dd) * 100, lev: D / V, cov: b?.ebit && b?.interest ? b.ebit / Math.abs(b.interest) : null };
  }).sort((a, b) => (a.dd ?? 99) - (b.dd ?? 99));
  return (
    <PanelShell code="CRD" title="发行人信用分析与违约概率（默顿模型）" onClose={onClose}>
      <SectionHead title="主要优先股发行人：违约距离与一年违约概率" sub="输入为实时股价波动率、最新市值与最近一期资产负债表；银行负债含存款，违约距离天然偏低，应横向比较" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">发行人</th><th className="text-right">市值</th><th className="text-right">总负债</th><th className="text-right">股价波动</th><th className="text-right">杠杆</th><th className="text-right">利息覆盖</th><th className="text-right">违约距离</th><th className="px-2 text-right">一年违约概率</th></tr></thead>
        <tbody>{rows.map((x) => <tr key={x.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{x.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.s}</span></td><td className="text-right font-mono text-slate-300">{fmtCompact(x.E)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(x.D)}</td><td className="text-right font-mono text-slate-300">{x.sE ? `${(x.sE * 100).toFixed(1)}%` : "—"}</td><td className="text-right font-mono text-slate-400">{x.lev != null ? `${(x.lev * 100).toFixed(1)}%` : "—"}</td><td className="text-right font-mono text-slate-400">{f2(x.cov, 1, "倍")}</td><td className="text-right font-mono text-white">{f2(x.dd, 2)}</td><td className="px-2 text-right font-mono" style={{ color: (x.pd ?? 0) > 1 ? "#f2495c" : "#e2e8f0" }}>{x.pd == null ? "—" : x.pd < 0.0001 ? "<0.0001%" : `${x.pd.toFixed(4)}%`}</td></tr>)}{!bs.data && <tr><td colSpan={8}><Empty loading /></td></tr>}</tbody>
      </table>
    </PanelShell>
  );
}

type K = { t: number; o: number; h: number; l: number; c: number; v: number | null };
/* LIQ */ export function PFLIQPanel({ onClose }: P) {
  const L = PFD.map(([s]) => s);
  const ks = L.map((s) => s);
  const pack = usePolled<Record<string, Array<[number, number]>>>("ucHubs.closes", { symbols: ks, days: 260 }, 600_000);
  const [s, setS] = useState("PFF");
  const k = usePolled<{ candles: K[] }>("ucMarket.kline", { symbol: s, period: "1d", limit: 120 }, 300_000);
  const c = k.data?.candles ?? [];
  const dv = c.map((x) => (x.v ?? 0) * x.c);
  const amihud = c.slice(1).map((x, i) => (Math.abs(x.c / c[i].c - 1) / Math.max(1, (x.v ?? 0) * x.c)) * 1e9);
  const range = c.map((x) => ((x.h - x.l) / x.c) * 100);
  return (
    <PanelShell code="LIQ" title="流动性与市场微观结构" onClose={onClose} tabs={PFD.slice(0, 8).map(([x, l]) => [x, l])} tab={s} setTab={setS}>
      <Kpis items={[["20 日均成交额", `${fmtCompact(mean(dv.slice(-20)))} 美元`], ["价格冲击系数", f2(mean(amihud.slice(-20)), 3), "每十亿成交的价格变动；越低越好"], ["日内振幅（20 日均）", `${f2(mean(range.slice(-20)), 2)}%`], ["量能变化（5 日/60 日）", c.length > 60 ? `${(mean(dv.slice(-5)) / Math.max(1, mean(dv.slice(-60)))).toFixed(2)} 倍` : "—"]]} />
      <SectionHead title="日成交额（美元）" />
      <Bars data={c.slice(-90).map((x) => ({ k: new Date(x.t).toISOString().slice(5, 10), v: (x.v ?? 0) * x.c }))} height={110} />
      <SectionHead title="价格冲击系数（越高越难成交）" />
      <Lines series={[{ name: "冲击系数", color: "#f472b6", values: amihud.slice(-90) }]} height={110} fmt={(v) => v.toFixed(2)} />
      <SectionHead title="同类优先股 ETF 波动对比（1 年）" />
      <Bars data={L.map((x) => ({ k: NAME[x], v: annVol((pack.data?.[x] ?? []).map((y) => y[1]), 252) ?? 0 }))} fmt={(v) => `${v.toFixed(1)}%`} height={110} />
    </PanelShell>
  );
}

/* CASE */ export function PFCASEPanel({ onClose }: P) {
  const L = ["PFF", "PGX", "PGF", "TLT", "HYG", "SPY"];
  const pack = useCloses(L, 2600);
  const EP: Array<[string, string, string, string]> = [["疫情冲击", "2020-02-19", "2020-03-23", "流动性危机，优先股与高收益债同步暴跌，长债上涨"], ["加息周期", "2022-01-03", "2022-10-14", "利率快速上行，优先股与长债同时下跌，股债双杀"], ["地区银行危机", "2023-03-08", "2023-05-04", "银行优先股遭抛售，金融业优先股显著跑输"], ["2018 年末调整", "2018-10-01", "2018-12-24", "美联储加息叠加增长担忧，信用利差走阔"], ["2020 年复苏", "2020-03-23", "2020-12-31", "政策托底后信用资产快速修复"]];
  const ret = (s: string, a: string, b: string) => { const c = pack.data?.[s] ?? []; const dk = (t: number) => new Date(t).toISOString().slice(0, 10); const i = c.findIndex(([t]) => dk(t) >= a); let j = -1; for (let k = c.length - 1; k >= 0; k--) if (dk(c[k][0]) <= b) { j = k; break; } return i >= 0 && j > i ? (c[j][1] / c[i][1] - 1) * 100 : null; };
  const mdd = (s: string, a: string, b: string) => { const c = (pack.data?.[s] ?? []).filter(([t]) => { const d = new Date(t).toISOString().slice(0, 10); return d >= a && d <= b; }).map((x) => x[1]); return c.length ? drawdown(c).max : null; };
  return (
    <PanelShell code="CASE" title="历史情景复盘（真实走势）" onClose={onClose}>
      <SectionHead title="五段关键行情中各资产的区间收益（%）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">情景</th><th className="text-left">区间</th>{L.map((s) => <th key={s} className="text-right">{NAME[s]}</th>)}</tr></thead>
        <tbody>{EP.map(([n, a, b]) => <tr key={n} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{n}</td><td className="font-mono text-[10px] text-slate-500">{a} ~ {b}</td>{L.map((s) => { const v = ret(s, a, b); return <td key={s} className="text-right font-mono" style={{ background: heat(v, 30), color: "#f1f5f9" }}>{sgn(v, 1)}</td>; })}</tr>)}</tbody>
      </table>
      <SectionHead title="区间内最大回撤（%）" />
      <table className="w-full text-[11px]"><tbody>{EP.map(([n, a, b, note]) => <tr key={n} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{n}</td>{L.map((s) => <td key={s} className="text-right font-mono text-emerald-300">{sgn(mdd(s, a, b), 1)}</td>)}<td className="px-2 text-[10px] text-slate-500">{note}</td></tr>)}{!pack.data && <tr><td><Empty loading /></td></tr>}</tbody></table>
    </PanelShell>
  );
}

/* SOP */ export function PFSOPPanel({ onClose }: P) {
  const pack = useCloses(["^TNX", "HYG", "IEI", "PFF", "KBE", "^VIX"], 300);
  const c = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
  const tnx = c("^TNX"), pff = c("PFF"), vix = c("^VIX");
  const r1m = tnx.length > 21 ? (tnx[tnx.length - 1] - tnx[tnx.length - 22]) * 100 : null;
  const cr = perf(c("HYG"), 21) != null && perf(c("IEI"), 21) != null ? perf(c("HYG"), 21)! - perf(c("IEI"), 21)! : null;
  const bank = perf(c("KBE"), 21);
  const trend = pff.length > 200 ? pff[pff.length - 1] > mean(pff.slice(-200)) : null;
  const steps: Array<[string, string, string, boolean | null]> = [
    ["1. 判断利率方向", "优先股久期长，利率上行是最大风险", r1m == null ? "—" : `10 年美债 1 月 ${r1m > 0 ? "+" : ""}${r1m.toFixed(0)}bp`, r1m == null ? null : r1m < 15],
    ["2. 判断信用环境", "信用利差走阔时优先股（次级资本）先跌", cr == null ? "—" : `高收益相对国债 1 月 ${cr > 0 ? "+" : ""}${cr.toFixed(2)}%`, cr == null ? null : cr > -0.3],
    ["3. 检查银行业压力", "金融业是最大发行方，银行承压时金融优先股跑输", bank == null ? "—" : `银行股 1 月 ${bank > 0 ? "+" : ""}${bank.toFixed(1)}%`, bank == null ? null : bank > -5],
    ["4. 确认趋势", "价格在 200 日均线上方再加仓", trend == null ? "—" : trend ? "优先股综合在 200 日均线上方" : "优先股综合在 200 日均线下方", trend],
    ["5. 检查市场恐慌度", "恐慌指数高时分批建仓、控制单笔规模", vix.length ? `VIX ${vix[vix.length - 1].toFixed(1)}` : "—", vix.length ? vix[vix.length - 1] < 25 : null],
    ["6. 选择品种", "溢价高于面值的个券注意赎回风险，优先选择折价或浮动利率品种", "参见 PRC 定价模型与 LIQ 流动性", null],
    ["7. 分散与再平衡", "单一发行人不超过 5%，每月按风险预算再平衡", "参见 POR 与 PORD", null],
  ];
  const passed = steps.filter((s) => s[3] === true).length, checked = steps.filter((s) => s[3] != null).length;
  return (
    <PanelShell code="SOP" title="投资操作流程（实时核对）" onClose={onClose} right={<span>当前通过 {passed} / {checked} 项实时检查</span>}>
      <table className="w-full text-[11px]"><tbody>{steps.map(([k, why, v, ok]) => <tr key={k} className="border-t border-[#0f1b29] align-top"><td className="w-8 px-2 py-1.5 text-[14px]" style={{ color: ok == null ? "#64748b" : ok ? "#1fbf75" : "#f2495c" }}>{ok == null ? "·" : ok ? "✓" : "✕"}</td><td className="py-1.5"><div className="text-slate-100">{k}</div><div className="text-[10px] text-slate-500">{why}</div></td><td className="px-2 py-1.5 text-right font-mono text-white">{v}</td></tr>)}</tbody></table>
    </PanelShell>
  );
}

