/**
 * 风险 / 波动 / 图表 / 股指期货小窗（MARS / VCA / GP / WEIF），全部基于实时行情与真实日线：
 *  - MARS 多资产风险：自定义多资产组合的历史 / 参数 VaR 与 CVaR、成分 VaR、真实历史危机情景回放、因子回归分解、压力期相关性
 *  - VCA  波动率与相关性：两标的多窗口实现波动、期权隐波、GARCH(1,1) 拟合与波动率预测、滚动相关与贝塔
 *  - GP   价格对比图：多标的归一化走势与区间风险收益统计
 *  - WEIF 全球股指期货：期货行情、期现基差与隐含股息率、期货隐含开盘
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { align, annVol, corr, drawdown, f2, heat, mean, rollingCorr, rollingVol, sgn, std, useCloses, type Pack } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, Note, ROW, TD, TDL, TH, THL, quantile, simpleRets, slope, type FutCurve, type IvRow, type P } from "./LiveCommon";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6"];

/** 最小二乘多元回归（含截距），返回系数与 R² */
function ols(y: number[], X: number[][]) {
  const n = y.length, k = X.length + 1;
  if (n < k + 5) return null;
  const row = (i: number) => [1, ...X.map((x) => x[i])];
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  for (let i = 0; i < n; i++) { const r = row(i); for (let p = 0; p < k; p++) { b[p] += r[p] * y[i]; for (let q = 0; q < k; q++) A[p][q] += r[p] * r[q]; } }
  // 高斯消元
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    if (Math.abs(A[c][c]) < 1e-14) return null;
    for (let r = 0; r < k; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let q = c; q < k; q++) A[r][q] -= f * A[c][q]; b[r] -= f * b[c]; }
  }
  const beta = b.map((v, i) => v / A[i][i]);
  const my = mean(y);
  let sst = 0, sse = 0;
  for (let i = 0; i < n; i++) { const r = row(i); const fit = r.reduce((s, v, j) => s + v * beta[j], 0); sse += (y[i] - fit) ** 2; sst += (y[i] - my) ** 2; }
  return { alpha: beta[0], betas: beta.slice(1), r2: sst ? 1 - sse / sst : 0 };
}
const cov = (a: number[], b: number[]) => { const n = Math.min(a.length, b.length); const ma = mean(a.slice(-n)), mb = mean(b.slice(-n)); let s = 0; for (let i = 0; i < n; i++) s += (a[a.length - n + i] - ma) * (b[b.length - n + i] - mb); return n > 1 ? s / (n - 1) : 0; };

/* ================================================================== MARS 多资产风险 */
type Hold = { s: string; w: number };
const MARS_DEFAULT: Hold[] = [{ s: "SPY", w: 30 }, { s: "EFA", w: 10 }, { s: "EEM", w: 5 }, { s: "TLT", w: 20 }, { s: "LQD", w: 10 }, { s: "HYG", w: 5 }, { s: "GLD", w: 10 }, { s: "DBC", w: 10 }];
const FACTORS: Array<[string, string]> = [["SPY", "全球股票（美股）"], ["TLT", "利率（长债）"], ["UUP", "美元"], ["DBC", "商品"], ["GLD", "黄金"]];
const SCEN: Array<[string, string, string]> = [["2018 四季度抛售", "2018-09-20", "2018-12-24"], ["2020 新冠冲击", "2020-02-19", "2020-03-23"], ["2020 反弹", "2020-03-23", "2020-06-08"], ["2022 加息熊市", "2022-01-03", "2022-10-12"], ["2023 地区银行危机", "2023-03-08", "2023-03-17"], ["2024 日元套息平仓", "2024-07-31", "2024-08-05"], ["2025 关税冲击", "2025-04-02", "2025-04-08"]];
const Z = { 95: 1.6449, 99: 2.3263 } as const;

function useMarsData(hold: Hold[]) {
  const syms = hold.map((h) => h.s);
  const all = [...new Set([...syms, ...FACTORS.map((f) => f[0])])];
  const pack = useCloses(all, 2600);
  return useMemo(() => {
    const { dates, m } = align(pack.data ?? null, all);
    const tw = hold.reduce((s, h) => s + h.w, 0) || 1;
    const w = hold.map((h) => h.w / tw);
    const R: Record<string, number[]> = Object.fromEntries(all.map((s) => [s, simpleRets(m[s] ?? [])]));
    const port = (R[syms[0]] ?? []).map((_, i) => syms.reduce((s, x, j) => s + w[j] * (R[x]?.[i] ?? 0), 0));
    return { dates, m, R, port, w, syms, loading: pack.loading, raw: pack.data as Pack | null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, pack.loading, JSON.stringify(hold)]);
}

function MarsBody({ tab, hold, value }: { tab: string; hold: Hold[]; value: number }) {
  const d = useMarsData(hold);
  const { pick } = useHub();
  if (d.port.length < 60) return <Empty loading={d.loading} text="共同历史数据不足（请检查代码）" />;
  const win = d.port.slice(-252);
  if (tab === "var") {
    const hv = (q: number, arr: number[]) => -(quantile(arr, 1 - q) ?? 0);
    const es = (q: number, arr: number[]) => { const cut = quantile(arr, 1 - q) ?? 0; const t = arr.filter((x) => x <= cut); return t.length ? -mean(t) : null; };
    const sd = std(win);
    const covM = d.syms.map((a) => d.syms.map((b) => cov(d.R[a].slice(-252), d.R[b].slice(-252))));
    const sig = d.w.map((_, i) => covM[i].reduce((s, c, j) => s + c * d.w[j], 0));
    const pv = Math.sqrt(d.w.reduce((s, wi, i) => s + wi * sig[i], 0));
    const comp = d.syms.map((s, i) => ({ s, w: d.w[i], cvar: (d.w[i] * sig[i]) / pv * Z[95], share: (d.w[i] * sig[i]) / (pv * pv) * 100, vol: Math.sqrt(covM[i][i] * 252) * 100 }));
    const money = (x: number | null) => (x == null ? "—" : `${Math.round(x * value).toLocaleString()}`);
    const rows: Array<[string, number | null, number | null]> = [["历史法 VaR（近 1 年）", hv(0.95, win), hv(0.99, win)], ["历史法 CVaR（近 1 年）", es(0.95, win), es(0.99, win)], ["历史法 VaR（全样本）", hv(0.95, d.port), hv(0.99, d.port)], ["参数法 VaR（正态）", sd * Z[95], sd * Z[99]], ["参数法 VaR（10 日，√10）", sd * Z[95] * Math.sqrt(10), sd * Z[99] * Math.sqrt(10)]];
    return (
      <>
        <Kpis items={[["组合年化波动（近 1 年）", f2(sd * Math.sqrt(252) * 100, 2, "%")], ["1 日 95% VaR", `${f2(hv(0.95, win) * 100, 2, "%")}`, money(hv(0.95, win))], ["1 日 99% CVaR", `${f2((es(0.99, win) ?? 0) * 100, 2, "%")}`, money(es(0.99, win))], ["样本", `${d.port.length} 天`, `${d.dates[1]} 起`]]} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>度量（1 日，除注明）</th><th className={TH}>95%</th><th className={TH}>金额</th><th className={TH}>99%</th><th className={TH}>金额</th></tr></thead>
          <tbody>{rows.map(([l, a, b]) => <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className={`${TD} text-white`}>{f2(a == null ? null : a * 100, 2, "%")}</td><td className={`${TD} text-red-300`}>{money(a)}</td><td className={`${TD} text-white`}>{f2(b == null ? null : b * 100, 2, "%")}</td><td className={`${TD} text-red-300`}>{money(b)}</td></tr>)}</tbody>
        </table>
        <SectionHead title="成分 VaR（参数法 95%，近 1 年协方差）" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>资产</th><th className={TH}>权重</th><th className={TH}>年化波动</th><th className={TH}>成分 VaR</th><th className={TH}>风险贡献占比</th><th className="px-2" /></tr></thead>
          <tbody>{comp.map((c) => <tr key={c.s} onClick={() => pick(c.s)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{c.s}</td><td className={`${TD} text-slate-300`}>{f2(c.w * 100, 1, "%")}</td><td className={`${TD} text-slate-400`}>{f2(c.vol, 1, "%")}</td><td className={`${TD} text-white`}>{f2(c.cvar * 100, 3, "%")}</td><td className={`${TD} text-amber-200`}>{f2(c.share, 1, "%")}</td><td className="px-2"><span className="inline-block h-1.5 bg-amber-400/70" style={{ width: `${Math.max(0, Math.min(100, c.share))}px` }} /></td></tr>)}</tbody>
        </table>
        <SectionHead title="近 1 年日收益分布（%）" />
        <Bars data={(() => { const lo = Math.min(...win), hi = Math.max(...win), nb = 24, wd = (hi - lo) / nb || 1; const cnt = new Array(nb).fill(0); win.forEach((v) => cnt[Math.min(nb - 1, Math.floor((v - lo) / wd))]++); return cnt.map((c, i) => ({ k: ((lo + wd * (i + 0.5)) * 100).toFixed(1), v: lo + wd * (i + 0.5) < 0 ? -c : c })); })()} height={110} fmt={(v) => `${Math.abs(v)} 天`} />
      </>
    );
  }
  if (tab === "stress") {
    const at = (s: string, day: string) => { const i = d.dates.findIndex((x) => x >= day); return i >= 0 ? d.m[s]?.[i] ?? null : null; };
    const scen = SCEN.map(([l, a, b]) => {
      const ok = d.dates[0] <= a;
      const parts = d.syms.map((s, i) => { const p0 = at(s, a), p1 = at(s, b); return p0 && p1 ? d.w[i] * (p1 / p0 - 1) : null; });
      return { l, a, b, ok: ok && parts.every((x) => x != null), ret: parts.reduce<number>((s, x) => s + (x ?? 0), 0), parts };
    });
    const worst = (n: number) => { let best = { r: 0, i: 0 }; let v = 1; const lv = d.port.map((r) => (v *= 1 + r)); for (let i = n; i < lv.length; i++) { const r = lv[i] / lv[i - n] - 1; if (r < best.r) best = { r, i }; } return { r: best.r, from: d.dates[best.i - n + 1], to: d.dates[best.i + 1] }; };
    const w5 = worst(5), w20 = worst(20), w60 = worst(60);
    const betas = FACTORS.map(([f]) => d.syms.map((s) => { const a = d.R[s].slice(-504), b = d.R[f].slice(-504); return slope(b, a); }));
    const shocks: Array<[string, number, string]> = [["股票 −10%", -0.1, "SPY"], ["长债 −5%（约利率 +30bp）", -0.05, "TLT"], ["美元 +3%", 0.03, "UUP"], ["商品 −10%", -0.1, "DBC"], ["黄金 −8%", -0.08, "GLD"]];
    return (
      <>
        <SectionHead title="真实历史危机情景回放" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>情景</th><th className={THL}>区间</th><th className={TH}>组合收益</th><th className={TH}>金额</th>{d.syms.map((s) => <th key={s} className={TH}>{s}</th>)}</tr></thead>
          <tbody>{scen.map((x) => <tr key={x.l} className={ROW}><td className={TDL}>{x.l}</td><td className="px-2 font-mono text-[10px] text-slate-500">{x.a.slice(2)}→{x.b.slice(2)}</td>{x.ok ? <><td className={TD} style={{ background: heat(x.ret * 100, 20) }}>{sgn(x.ret * 100, 2)}</td><td className={`${TD} text-slate-300`}>{Math.round(x.ret * value).toLocaleString()}</td>{x.parts.map((p, i) => <td key={i} className={`${TD} text-[10px]`} style={{ color: toneOf(p) }}>{sgn(p == null ? null : p * 100, 2)}</td>)}</> : <td colSpan={2 + d.syms.length} className="px-2 text-[10px] text-slate-600">部分资产当时无数据</td>}</tr>)}</tbody>
        </table>
        <Kpis items={[["样本内最差 5 日", sgn(w5.r * 100, 2), `${w5.from} → ${w5.to}`], ["最差 20 日", sgn(w20.r * 100, 2), `${w20.from} → ${w20.to}`], ["最差 60 日", sgn(w60.r * 100, 2), `${w60.from} → ${w60.to}`], ["最大回撤", f2(drawdown(d.port.reduce<number[]>((a, r) => [...a, (a[a.length - 1] ?? 1) * (1 + r)], [])).max, 2, "%")]]} />
        <SectionHead title="单因子冲击（按近 2 年各资产对该因子的贝塔传导）" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>冲击</th><th className={TH}>组合影响</th><th className={TH}>金额</th></tr></thead>
          <tbody>{shocks.map(([l, sh, f]) => { const k = FACTORS.findIndex((x) => x[0] === f); const imp = d.syms.reduce((s, _, i) => s + d.w[i] * (betas[k][i] ?? 0) * sh, 0); return <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className={TD} style={{ color: toneOf(imp) }}>{sgn(imp * 100, 2)}</td><td className={`${TD} text-slate-300`}>{Math.round(imp * value).toLocaleString()}</td></tr>; })}</tbody>
        </table>
      </>
    );
  }
  if (tab === "factor") {
    const n = Math.min(504, d.port.length);
    const y = d.port.slice(-n);
    const X = FACTORS.map(([f]) => d.R[f].slice(-n));
    const fit = ols(y, X);
    const vp = std(y) ** 2;
    return (
      <>
        <Kpis items={[["解释度 R²", fit ? f2(fit.r2 * 100, 1, "%") : "—", "近 2 年日收益"], ["特质风险占比", fit ? f2((1 - fit.r2) * 100, 1, "%") : "—"], ["年化 α", fit ? sgn(fit.alpha * 252 * 100, 2) : "—"], ["组合年化波动", f2(Math.sqrt(vp * 252) * 100, 2, "%")]]} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>因子</th><th className={THL}>代理</th><th className={TH}>因子暴露（β）</th><th className={TH}>因子年化波动</th><th className={TH}>风险贡献</th></tr></thead>
          <tbody>{FACTORS.map(([f, l], k) => { const b = fit?.betas[k] ?? null; const contrib = b != null ? (b * cov(X[k], y)) / vp * 100 : null; return <tr key={f} onClick={() => pick(f)} className={`cursor-pointer ${ROW}`}><td className={TDL}>{l}</td><td className="px-2 font-mono text-slate-500">{f}</td><td className={`${TD} text-white`}>{f2(b, 3)}</td><td className={`${TD} text-slate-400`}>{f2(std(X[k]) * Math.sqrt(252) * 100, 1, "%")}</td><td className={TD} style={{ background: heat(contrib, 60) }}>{f2(contrib, 1, "%")}</td></tr>; })}</tbody>
        </table>
        <Note>多元回归：组合日收益 = α + Σ β·因子日收益 + 残差；风险贡献 = β·Cov(因子, 组合) / Var(组合)，各因子贡献与特质风险之和为 100%。</Note>
      </>
    );
  }
  // 相关性：正常日 vs 压力日（股票因子日跌幅处于最差 10%）
  const n = Math.min(1260, d.port.length);
  const spy = d.R.SPY.slice(-n);
  const cut = quantile(spy, 0.1) ?? 0;
  const idx = spy.map((v, i) => [v, i] as const);
  const stressI = idx.filter(([v]) => v <= cut).map(([, i]) => i), normI = idx.filter(([v]) => v > cut).map(([, i]) => i);
  const sub = (s: string, I: number[]) => { const r = d.R[s].slice(-n); return I.map((i) => r[i]); };
  const mat = (I: number[]) => d.syms.map((a) => d.syms.map((b) => corr(sub(a, I), sub(b, I))));
  const ms = mat(stressI), mn = mat(normI);
  const avg = (M: Array<Array<number | null>>) => { const v: number[] = []; M.forEach((r, i) => r.forEach((x, j) => { if (j > i && x != null) v.push(x); })); return v.length ? mean(v) : null; };
  return (
    <>
      <Kpis items={[["正常日平均两两相关", f2(avg(mn), 2)], ["压力日平均两两相关", f2(avg(ms), 2), `压力日 ${stressI.length} 天（股票跌幅最差 10%）`], ["相关性抬升", avg(ms) != null && avg(mn) != null ? sgn(avg(ms)! - avg(mn)!, 2, "") : "—", "分散化在下跌时的失效程度"], ["样本", `${n} 天`]]} />
      <SectionHead title="压力日相关矩阵（括号内为正常日）" />
      <div className="overflow-x-auto"><table className="text-[10px]"><thead><tr><th />{d.syms.map((s) => <th key={s} className="px-1 font-mono font-normal text-slate-400">{s}</th>)}</tr></thead>
        <tbody>{d.syms.map((a, i) => <tr key={a}><td className="px-1 font-mono text-slate-400">{a}</td>{d.syms.map((b, j) => <td key={b} className="px-1 py-0.5 text-center font-mono text-slate-100" style={{ background: i === j ? "#0f1b29" : heat(ms[i][j], 1) }}>{i === j ? "1" : <>{f2(ms[i][j], 2)}<span className="text-slate-400"> ({f2(mn[i][j], 2)})</span></>}</td>)}</tr>)}</tbody>
      </table></div>
    </>
  );
}
export function MarsLive({ onClose }: P) {
  const saved = useSaved<{ hold: Hold[]; value: number }>("mars");
  const [local, setLocal] = useState<{ hold: Hold[]; value: number } | null>(null);
  const cfg = local ?? saved.data ?? { hold: MARS_DEFAULT, value: 10_000_000 };
  const [draft, setDraft] = useState<string | null>(null);
  const [tab, setTab] = useState("var");
  const text = draft ?? cfg.hold.map((h) => `${h.s} ${h.w}`).join("\n");
  const apply = async () => {
    const hold = text.split(/\n|;|；/).map((l) => l.trim().split(/[\s,，]+/)).filter((p) => p[0]).map(([s, w]) => ({ s: s.trim(), w: Number(w) || 0 })).filter((h) => h.w > 0).slice(0, 20);
    if (!hold.length) return;
    const next = { ...cfg, hold };
    setLocal(next); setDraft(null);
    await saveItem("mars", next);
  };
  return (
    <PanelShell code="MARS" title="多资产风险" onClose={onClose} tabs={[["var", "VaR / CVaR"], ["stress", "压力测试"], ["factor", "因子分解"], ["corr", "压力期相关性"]]} tab={tab} setTab={setTab}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="bg-[#03070c] p-2 text-[11px]">
          <SectionHead title="组合（代码 权重）" />
          <textarea value={text} onChange={(e) => setDraft(e.target.value)} rows={10} className={`${INP} mt-1 w-full font-mono`} />
          <div className="mt-1 flex items-center gap-1"><span className="text-slate-500">市值</span><input type="number" value={cfg.value} onChange={(e) => setLocal({ ...cfg, value: Math.max(0, Number(e.target.value) || 0) })} className={`${INP} w-24 text-right font-mono`} /></div>
          <button type="button" onClick={() => void apply()} className={`${BTN} mt-1 w-full`}>应用并保存</button>
          <div className="mt-1 text-[10px] leading-relaxed text-slate-500">每行一个标的与权重（权重自动归一化）。支持美股 / ETF、A股、港股、期货、外汇等代码。保存后永久记录。</div>
        </div>
        <div className="min-w-0 bg-[#03070c]"><MarsBody tab={tab} hold={cfg.hold} value={cfg.value} /></div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== VCA 波动率与相关性 */
/** GARCH(1,1) 方差目标法极大似然（网格 + 局部细化） */
function garch(r: number[]) {
  if (r.length < 250) return null;
  const m = mean(r);
  const e = r.map((x) => x - m);
  const vL = e.reduce((s, x) => s + x * x, 0) / e.length;
  const ll = (a: number, b: number) => { if (a <= 0 || b <= 0 || a + b >= 0.9995) return -Infinity; const w = vL * (1 - a - b); let h = vL, L = 0; for (let i = 0; i < e.length; i++) { L += -Math.log(h) - (e[i] * e[i]) / h; h = w + a * e[i] * e[i] + b * h; } return L; };
  let best = { a: 0.05, b: 0.9, L: -Infinity };
  for (let a = 0.01; a <= 0.3; a += 0.01) for (let b = 0.6; b < 0.999 - a; b += 0.01) { const L = ll(a, b); if (L > best.L) best = { a, b, L }; }
  for (let step = 0.005; step > 0.0002; step /= 2) {
    let moved = true;
    while (moved) { moved = false; for (const [da, db] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, -step], [-step, step]]) { const L = ll(best.a + da, best.b + db); if (L > best.L) { best = { a: best.a + da, b: best.b + db, L }; moved = true; } } }
  }
  const w = vL * (1 - best.a - best.b);
  const hs: number[] = [];
  let h = vL;
  for (let i = 0; i < e.length; i++) { hs.push(h); h = w + best.a * e[i] * e[i] + best.b * h; }
  const p = best.a + best.b;
  const fc = (H: number) => { let s = 0; for (let k = 1; k <= H; k++) s += vL + Math.pow(p, k - 1) * (h - vL); return Math.sqrt((s / H) * 252) * 100; };
  return { a: best.a, b: best.b, p, longVol: Math.sqrt(vL * 252) * 100, next: Math.sqrt(h * 252) * 100, half: Math.log(0.5) / Math.log(p), hist: hs.map((x) => Math.sqrt(x * 252) * 100), fc };
}
function VcaBody({ tab, a, b }: { tab: string; a: string; b: string }) {
  const pack = useCloses([a, b], 1300);
  const iv = usePolled<IvRow[]>("ucHubs.ivScan", tab === "vol" ? { symbols: [a, b] } : null, 300_000);
  const { dates, m } = useMemo(() => align(pack.data ?? null, [a, b]), [pack.data, a, b]);
  const ca = m[a] ?? [], cb = m[b] ?? [];
  const g = useMemo(() => (tab === "garch" ? garch(simpleRets((pack.data?.[a] ?? []).map((x) => x[1])).slice(-1000)) : null), [tab, pack.data, a]);
  if (ca.length < 60) return <Empty loading={pack.loading} text="共同历史数据不足" />;
  const N = 252;
  if (tab === "vol") {
    const wins = [10, 20, 30, 60, 90, 250];
    const ivOf = (s: string) => (iv.data ?? []).find((r) => r.symbol === s.toUpperCase());
    return (
      <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th>{wins.map((w) => <th key={w} className={TH}>HV{w}</th>)}<th className={TH}>30日隐波</th><th className={TH}>隐波−HV30</th><th className={TH}>隐波排名</th><th className={TH}>HV30 一年分位</th></tr></thead>
          <tbody>{[a, b].map((s) => { const c = m[s]; const r = ivOf(s); const hv30 = annVol(c, 30); const roll = rollingVol(c, 30).slice(-N).filter((x): x is number => x != null); return <tr key={s} className={ROW}><td className={TDL}>{s}</td>{wins.map((w) => <td key={w} className={`${TD} text-slate-200`}>{f2(annVol(c, w), 2)}</td>)}<td className={`${TD} text-white`}>{f2(r?.iv30, 2)}</td><td className={TD} style={{ background: heat(r?.iv30 != null && hv30 != null ? r.iv30 - hv30 : null, 8) }}>{r?.iv30 != null && hv30 != null ? sgn(r.iv30 - hv30, 2, "") : "—"}</td><td className={`${TD} text-slate-400`}>{f2(r?.ivRank, 0)}</td><td className={`${TD} text-amber-200`}>{hv30 != null && roll.length ? f2((roll.filter((x) => x <= hv30).length / roll.length) * 100, 0, "%") : "—"}</td></tr>; })}</tbody>
        </table>
        <SectionHead title="30 日滚动实现波动率（%，近一年）" />
        <Lines series={[{ name: a, color: COLORS[0], values: rollingVol(ca, 30).slice(-N) }, { name: b, color: COLORS[1], values: rollingVol(cb, 30).slice(-N) }]} xLabels={dates.slice(-N).map((x) => x.slice(2))} height={180} />
        <SectionHead title={`波动率比 ${a} / ${b}（HV30）`} />
        <Lines series={[{ name: "波动率比", color: COLORS[2], values: (() => { const x = rollingVol(ca, 30), y = rollingVol(cb, 30); return x.map((v, i) => (v != null && y[i] ? v / y[i]! : null)).slice(-N); })() }]} height={110} />
        <Note>HV = 对数收益年化实现波动率（%）；隐波取自挂牌期权 30 日隐含波动率（仅对有挂牌期权的美股 / ETF / 指数可得）。</Note>
      </>
    );
  }
  if (tab === "garch") {
    if (!g) return <Empty text="样本不足 250 天，无法拟合" />;
    const H = [1, 5, 10, 21, 63, 126, 252];
    return (
      <>
        <Kpis items={[["α（冲击系数）", g.a.toFixed(4)], ["β（持续系数）", g.b.toFixed(4)], ["α+β（持续性）", g.p.toFixed(4), `半衰期 ${f2(g.half, 1)} 天`], ["长期均衡波动", f2(g.longVol, 2, "%")], ["下一日条件波动", f2(g.next, 2, "%"), g.next > g.longVol ? "高于长期均值，预计回落" : "低于长期均值，预计回升"], ["当前 HV20", f2(annVol((pack.data?.[a] ?? []).map((x) => x[1]), 20), 2, "%")]]} />
        <SectionHead title={`${a} 波动率预测期限结构（年化 %，未来 N 日平均）`} />
        <table className="w-full text-[11px]"><tbody><tr className="text-[10px] text-slate-500">{H.map((h) => <td key={h} className={TD}>{h} 日</td>)}</tr><tr>{H.map((h) => <td key={h} className={`${TD} text-white`}>{f2(g.fc(h), 2)}</td>)}</tr></tbody></table>
        <SectionHead title="条件波动率历史（%）" />
        <Lines series={[{ name: "GARCH 条件波动", color: COLORS[3], values: g.hist.slice(-500) }, { name: "长期均衡", color: "#94a3b8", values: g.hist.slice(-500).map(() => g.longVol), dash: true }]} height={170} />
        <Note>GARCH(1,1)：σ²ₜ₊₁ = ω + α·ε²ₜ + β·σ²ₜ，采用方差目标法（ω 由样本方差约束）对近 1000 个交易日做极大似然拟合。</Note>
      </>
    );
  }
  const ra = simpleRets(ca), rb = simpleRets(cb);
  const c20 = rollingCorr(ca, cb, 20).slice(-N), c60 = rollingCorr(ca, cb, 60).slice(-N), c120 = rollingCorr(ca, cb, 120).slice(-N);
  const beta = slope(rb.slice(-N), ra.slice(-N));
  const hist60 = rollingCorr(ca, cb, 60).filter((x): x is number => x != null);
  const now60 = hist60[hist60.length - 1] ?? null;
  return (
    <>
      <Kpis items={[["20 日相关", f2(c20[c20.length - 1], 2)], ["60 日相关", f2(now60, 2), hist60.length ? `5 年区间 ${f2(Math.min(...hist60), 2)} ~ ${f2(Math.max(...hist60), 2)}` : undefined], ["120 日相关", f2(c120[c120.length - 1], 2)], [`${a} 对 ${b} 的贝塔（1 年）`, f2(beta, 3)], ["全样本相关", f2(corr(ra, rb), 2), `${ra.length} 天`], ["60 日相关分位", now60 != null && hist60.length ? f2((hist60.filter((x) => x <= now60).length / hist60.length) * 100, 0, "%") : "—"]]} />
      <SectionHead title="滚动相关系数（近一年）" />
      <Lines series={[{ name: "20 日", color: COLORS[0], values: c20 }, { name: "60 日", color: COLORS[2], values: c60 }, { name: "120 日", color: COLORS[3], values: c120 }]} xLabels={dates.slice(-N).map((x) => x.slice(2))} height={190} zero />
    </>
  );
}
export function VcaLive({ onClose }: P) {
  const [tab, setTab] = useState("vol");
  const [a, setA] = useState("SPY");
  const [b, setB] = useState("TLT");
  const [ia, setIa] = useState("SPY");
  const [ib, setIb] = useState("TLT");
  return (
    <PanelShell code="VCA" title="波动率与相关性分析" onClose={onClose} tabs={[["vol", "历史与隐含波动"], ["garch", "GARCH 预测"], ["corr", "相关性"]]} tab={tab} setTab={setTab}
      right={<form onSubmit={(e) => { e.preventDefault(); if (ia.trim()) setA(ia.trim()); if (ib.trim()) setB(ib.trim()); }} className="flex items-center gap-1"><input value={ia} onChange={(e) => setIa(e.target.value)} className={`${INP} w-20`} /><span>vs</span><input value={ib} onChange={(e) => setIb(e.target.value)} className={`${INP} w-20`} /><button className={BTN}>分析</button></form>}>
      <VcaBody tab={tab} a={a} b={b} />
    </PanelShell>
  );
}

/* ================================================================== GP 价格对比图 */
const GP_R: Array<[string, string, number]> = [["3M", "3月", 63], ["6M", "6月", 126], ["1Y", "1年", 252], ["3Y", "3年", 756], ["5Y", "5年", 1260], ["10Y", "10年", 2520]];
function GpBody({ syms, range, mode }: { syms: string[]; range: string; mode: string }) {
  const n = GP_R.find((r) => r[0] === range)![2];
  const pack = useCloses(syms, Math.min(2600, n + 10));
  const { pick } = useHub();
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data, syms.join(",")]);
  const ds = dates.slice(-(n + 1));
  const cut = (s: string) => (m[s] ?? []).slice(-(n + 1));
  if (ds.length < 5) return <Empty loading={pack.loading} text="共同历史数据不足" />;
  const base = cut(syms[0]);
  const series = syms.map((s, i) => { const c = cut(s); return { name: s, color: COLORS[i % COLORS.length], values: mode === "rel" && i > 0 ? c.map((v, k) => (v / c[0]) / (base[k] / base[0]) * 100) : c.map((v) => (v / c[0]) * 100) }; }).filter((x, i) => mode !== "rel" || i > 0);
  return (
    <>
      <Lines series={series} xLabels={ds.map((x) => x.slice(2))} height={260} fmt={(v) => v.toFixed(1)} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={TH}>区间收益</th><th className={TH}>年化收益</th><th className={TH}>年化波动</th><th className={TH}>收益/波动</th><th className={TH}>最大回撤</th><th className={TH}>与 {syms[0]} 相关</th><th className={TH}>相对 {syms[0]}</th></tr></thead>
        <tbody>{syms.map((s, i) => { const c = cut(s); const ret = (c[c.length - 1] / c[0] - 1) * 100; const yrs = (c.length - 1) / 252; const ann = yrs >= 1 ? (Math.pow(1 + ret / 100, 1 / yrs) - 1) * 100 : null; const vol = annVol(c); const r0 = (base[base.length - 1] / base[0] - 1) * 100; return <tr key={s} onClick={() => pick(s)} className={`cursor-pointer ${ROW}`}><td className={TDL}><span style={{ color: COLORS[i % COLORS.length] }}>■</span> {s}</td><td className={TD} style={{ color: toneOf(ret) }}>{sgn(ret, 2)}</td><td className={`${TD} text-slate-300`}>{ann == null ? "—" : sgn(ann, 2)}</td><td className={`${TD} text-slate-300`}>{f2(vol, 2, "%")}</td><td className={`${TD} text-white`}>{vol ? f2((ann ?? ret / Math.max(yrs, 1e-9)) / vol, 2) : "—"}</td><td className={`${TD} text-emerald-300`}>{f2(drawdown(c).max, 2, "%")}</td><td className={`${TD} text-slate-400`}>{i ? f2(corr(simpleRets(c), simpleRets(base)), 2) : "—"}</td><td className={TD} style={{ color: toneOf(ret - r0) }}>{i ? sgn(ret - r0, 2) : "—"}</td></tr>; })}</tbody>
      </table>
    </>
  );
}
export function GpCompareLive({ onClose }: P) {
  const [syms, setSyms] = useState(["^GSPC", "^NDX", "sh000300", "^HSI"]);
  const [inp, setInp] = useState("^GSPC ^NDX sh000300 ^HSI");
  const [range, setRange] = useState("1Y");
  const [mode, setMode] = useState("abs");
  const ticks = useTicks(syms);
  return (
    <PanelShell code="GP" title="价格对比图" onClose={onClose}
      right={<span className="flex items-center gap-1"><Seg value={mode} onChange={setMode} options={[["abs", "归一化"], ["rel", `相对 ${syms[0]}`]]} /><Seg value={range} onChange={setRange} options={GP_R.map(([k, l]) => [k, l] as [string, string])} /></span>}>
      <form onSubmit={(e) => { e.preventDefault(); const l = [...new Set(inp.split(/[\s,，]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 6); if (l.length) setSyms(l); }} className="flex flex-wrap items-center gap-2 px-2 py-1">
        <input value={inp} onChange={(e) => setInp(e.target.value)} placeholder="最多 6 个代码，空格分隔" className={`${INP} w-72 font-mono`} /><button className={BTN}>对比</button>
        {syms.map((s, i) => <span key={s} className="font-mono text-[10px]" style={{ color: COLORS[i % COLORS.length] }}>{s} {fmtPrice(ticks[s]?.price)} <span style={{ color: toneOf(ticks[s]?.changePct) }}>{fmtPct(ticks[s]?.changePct)}</span></span>)}
      </form>
      <GpBody syms={syms} range={range} mode={mode} />
      
    </PanelShell>
  );
}

/* ================================================================== WEIF 全球股指期货 */
const EQF: Array<{ root: string; fut: string; cash: string; name: string }> = [
  { root: "ES", fut: "ES", cash: "^GSPC", name: "标普 500" },
  { root: "NQ", fut: "NQ", cash: "^NDX", name: "纳指 100" },
  { root: "YM", fut: "YM", cash: "^DJI", name: "道琼斯" },
  { root: "RTY", fut: "RTY", cash: "^RUT", name: "罗素 2000" },
];
const WEIF_BOARD: BoardRow[] = [
  ...EQF.map((x) => ({ symbol: x.fut, label: `${x.name}期货`, group: "美国股指期货" })),
  { symbol: "NKD", label: "日经 225 期货（美元）", group: "亚洲股指期货" },
  ...([["^STOXX50E", "欧洲斯托克 50"], ["^GDAXI", "德国 DAX"], ["^FTSE", "英国富时 100"], ["^N225", "日经 225"], ["^HSI", "恒生指数"], ["sh000300", "沪深 300"], ["^KS11", "韩国综合"], ["^AXJO", "澳洲标普 200"]] as Array<[string, string]>).map(([s, l]) => ({ symbol: s, label: l, group: "对应现货指数" })),
  ...([["^VIX", "VIX"], ["DXY", "美元指数"], ["^TNX", "10 年美债收益率"]] as Array<[string, string]>).map(([s, l]) => ({ symbol: s, label: l, group: "风险参照" })),
];
/** 合约月第三个周五（美国股指期货最后交易日） */
function thirdFriday(month: string) {
  const [y, mo] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1, 1));
  const first = (5 - d.getUTCDay() + 7) % 7;
  return Date.UTC(y, mo - 1, 1 + first + 14, 21);
}
type Macro = { rates: Array<{ key: string; value: number | null }> };
function WeifBody({ tab }: { tab: string }) {
  const many = usePolled<FutCurve[]>("ucHubs.futuresMany", tab === "basis" ? { roots: EQF.map((x) => x.root) } : null, 60_000);
  const macro = usePolled<Macro>("ucNews.macro", tab === "basis" ? {} : null, 1800_000);
  const ticks = useTicks(EQF.flatMap((x) => [x.fut, x.cash]));
  if (tab === "board") return <LiveBoard rows={WEIF_BOARD} />;
  if (tab === "open") {
    return (
      <>
        <SectionHead title="期货隐含开盘" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>指数</th><th className={TH}>期货最新</th><th className={TH}>期货涨跌幅</th><th className={TH}>现货昨收</th><th className={TH}>隐含开盘</th><th className={TH}>隐含涨跌点数</th><th className={TH}>现货最新</th></tr></thead>
          <tbody>{EQF.map((x) => { const f = ticks[x.fut], c = ticks[x.cash]; const imp = c?.prevClose && f?.changePct != null ? c.prevClose * (1 + f.changePct / 100) : null; return <tr key={x.root} className={ROW}><td className={TDL}>{x.name}</td><td className={`${TD} text-white`}>{fmtPrice(f?.price)}</td><td className={TD} style={{ color: toneOf(f?.changePct) }}>{fmtPct(f?.changePct)}</td><td className={`${TD} text-slate-400`}>{fmtPrice(c?.prevClose)}</td><td className={`${TD} text-amber-200`}>{fmtPrice(imp)}</td><td className={TD} style={{ color: toneOf(imp && c?.prevClose ? imp - c.prevClose : null) }}>{imp && c?.prevClose ? `${imp - c.prevClose > 0 ? "+" : ""}${fmtPrice(imp - c.prevClose)}` : "—"}</td><td className={`${TD} text-slate-300`}>{fmtPrice(c?.price)}</td></tr>; })}</tbody>
        </table>
        <Note>非美股交易时段（亚洲、欧洲时段及盘前），股指期货持续交易，可据此推算美股现货开盘位置。</Note>
      </>
    );
  }
  const sofr = macro.data?.rates.find((r) => r.key === "SOFR")?.value ?? null;
  return (
    <>
      <SectionHead title="期现基差与隐含股息率" sub={sofr != null ? `融资利率取 SOFR ${sofr.toFixed(2)}%` : "读取融资利率…"} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>指数</th><th className={THL}>近月合约</th><th className={TH}>期货</th><th className={TH}>现货</th><th className={TH}>基差（点）</th><th className={TH}>剩余天数</th><th className={TH}>年化持有收益</th><th className={TH}>隐含股息率</th><th className={TH}>次月−近月</th><th className={TH}>近月成交</th></tr></thead>
        <tbody>{EQF.map((x) => {
          const c = (many.data ?? []).find((k) => k.root === x.root);
          const [p0, p1] = c?.points ?? [];
          const S = ticks[x.cash]?.price ?? null;
          const F = p0?.price ?? null;
          const days = p0 ? Math.max(0, (thirdFriday(p0.month) - Date.now()) / 86400_000) : null;
          const carry = F && S && days && days > 1 ? (Math.log(F / S) * 365) / days * 100 : null;
          const divY = carry != null && sofr != null ? sofr - carry : null;
          return <tr key={x.root} className={ROW}><td className={TDL}>{x.name}</td><td className="px-2 font-mono text-slate-400">{p0?.code ?? "—"}</td><td className={`${TD} text-white`}>{fmtPrice(F)}</td><td className={`${TD} text-slate-300`}>{fmtPrice(S)}</td><td className={`${TD} text-amber-200`}>{F && S ? sgn(F - S, 2, "") : "—"}</td><td className={`${TD} text-slate-400`}>{days == null ? "—" : days.toFixed(0)}</td><td className={`${TD} text-slate-200`}>{f2(carry, 2, "%")}</td><td className={TD} style={{ color: divY != null && (divY < -1 || divY > 5) ? "#fbbf24" : "#e2e8f0" }}>{f2(divY, 2, "%")}</td><td className={`${TD} text-slate-300`}>{p0 && p1 ? sgn(p1.price - p0.price, 2, "") : "—"}</td><td className={`${TD} text-slate-400`}>{fmtCompact(p0?.volume)}</td></tr>;
        })}</tbody>
      </table>
      {!many.data && <Empty loading={many.loading} />}
      <Note>持有成本模型：F = S·e^{"{(r − q)·t}"}，年化持有收益 = ln(F/S)·365/天数，隐含股息率 q = 融资利率 − 年化持有收益。仅在现货指数交易时段两者同步报价时有意义；休市时段数值偏离属正常。</Note>
    </>
  );
}
export function WeifFuturesLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  return <PanelShell code="WEIF" title="全球股指期货" onClose={onClose} tabs={[["board", "期货行情"], ["basis", "基差与隐含股息"], ["open", "期货隐含开盘"]]} tab={tab} setTab={setTab}><WeifBody tab={tab} /></PanelShell>;
}
