/**
 * 全球债券市场页的三个分析功能（全部基于真实日线 / 官方月度数据计算）：
 *  - Linkage：跨市场收益相关矩阵 + 特征向量中心度（联动核心）+ 相关性体制变化 + 滚动相关
 *  - Optimizer：债券 ETF 组合（等权 / 逆波动 / 风险平价 / 最小方差）+ 经验久期 + 月度再平衡回测
 *  - RelValue：欧元区主权利差的相对价值（利差 × 利差波动、5 年分位、Z 分数）
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, useTicks } from "@/uc/market/live";
import { align, rets, mean, std, corr, rollingCorr, covMatrix, riskParity, minVariance, portVol, drawdown, heat, f2, useCloses } from "@/uc/hubs/calc";
import { Lines, useHub } from "@/uc/hubs/kit";
import { SectionHead, Seg } from "@/uc/news/kit";

/* ------------------------------------------------------------------ 跨市场联动 */
const NODES: Array<[string, string]> = [
  ["SHY", "美债1-3年"], ["IEF", "美债7-10年"], ["TLT", "美债20年+"], ["TIP", "通胀保值"], ["MBB", "机构MBS"], ["LQD", "投资级信用"], ["HYG", "高收益"], ["EMB", "新兴美元债"], ["BNDX", "全球综合(对冲)"], ["BWX", "国际国债"], ["IGOV", "发达国际国债"], ["SPY", "美股"], ["DXY", "美元指数"], ["GC", "黄金"], ["USDJPY", "美元日元"],
];

function eigenCentrality(m: number[][]) {
  const n = m.length;
  let v = new Array(n).fill(1 / Math.sqrt(n));
  for (let it = 0; it < 200; it++) {
    const nv = m.map((row, i) => row.reduce((s, x, j) => s + (i === j ? 0 : Math.abs(x)) * v[j], 0));
    const norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) || 1;
    v = nv.map((x) => x / norm);
  }
  const max = Math.max(...v) || 1;
  return v.map((x) => x / max);
}

export function Linkage() {
  const syms = NODES.map(([s]) => s);
  const pack = useCloses(syms, 600);
  const [win, setWin] = useState("120");
  const [pair, setPair] = useState<[string, string]>(["TLT", "SPY"]);
  const { pick } = useHub();
  const avail = useMemo(() => syms.filter((s) => (pack.data?.[s]?.length ?? 0) > 100), [pack.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const { dates, m } = useMemo(() => align(pack.data, avail), [pack.data, avail]);
  const W = Number(win);
  const calc = useMemo(() => {
    if (avail.length < 3 || dates.length < W + 2) return null;
    const R = Object.fromEntries(avail.map((s) => [s, rets(m[s])]));
    const recent = avail.map((a) => avail.map((b) => corr(R[a].slice(-W), R[b].slice(-W)) ?? 0));
    // 前一期（再往前 250 日、剔除最近窗口）作为体制对照
    const prevLen = Math.min(250, R[avail[0]].length - W);
    const prior = prevLen > 30 ? avail.map((a) => avail.map((b) => corr(R[a].slice(-W - prevLen, -W), R[b].slice(-W - prevLen, -W)) ?? 0)) : null;
    const cent = eigenCentrality(recent);
    const links: Array<{ a: string; b: string; c: number; d: number | null }> = [];
    for (let i = 0; i < avail.length; i++) for (let j = i + 1; j < avail.length; j++) links.push({ a: avail[i], b: avail[j], c: recent[i][j], d: prior ? recent[i][j] - prior[i][j] : null });
    return { recent, prior, cent, links };
  }, [dates, m, W, avail]);
  const name = (s: string) => NODES.find(([x]) => x === s)?.[1] ?? s;
  const roll = useMemo(() => (m[pair[0]] && m[pair[1]] ? rollingCorr(m[pair[0]], m[pair[1]], 60).slice(-500) : []), [m, pair]);
  if (!calc) return <div className="px-3 py-8 text-[11px] text-slate-500">{pack.loading ? "日线读取中…" : "日线不足"}</div>;
  const order = avail.map((s, i) => ({ s, i, c: calc.cent[i] })).sort((a, b) => b.c - a.c);
  const strongest = [...calc.links].sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 10);
  const shifts = calc.prior ? [...calc.links].filter((l) => l.d != null).sort((a, b) => Math.abs(b.d!) - Math.abs(a.d!)).slice(0, 10) : [];
  return (
    <div>
      <SectionHead title="跨市场日收益相关矩阵" sub={`最近 ${W} 个交易日对数收益；点击单元格查看该组合的 60 日滚动相关`} right={<Seg value={win} onChange={setWin} options={[["60", "60日"], ["120", "120日"], ["250", "250日"]]} />} />
      <div className="overflow-x-auto">
        <table className="text-[10px]">
          <thead><tr><th className="sticky left-0 bg-[#03070c] px-2 text-left text-slate-500">联动中心度排序</th>{order.map(({ s }) => <th key={s} className="w-12 px-0.5 text-center font-normal text-slate-400" title={name(s)}>{s}</th>)}</tr></thead>
          <tbody>
            {order.map(({ s, i, c }) => (
              <tr key={s}>
                <td className="sticky left-0 whitespace-nowrap bg-[#03070c] px-2 py-px"><button type="button" onClick={() => pick(s)} className="text-slate-200 hover:text-cyan-300">{name(s)}</button><span className="ml-1 font-mono text-cyan-300">{c.toFixed(2)}</span></td>
                {order.map(({ s: t, i: j }) => <td key={t} onClick={() => i !== j && setPair([s, t])} className={`cursor-pointer text-center font-mono ${pair[0] === s && pair[1] === t ? "outline outline-1 outline-cyan-400" : ""}`} style={{ background: i === j ? "#0f1b29" : heat(calc.recent[i][j], 1) }}>{i === j ? "" : calc.recent[i][j].toFixed(2)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-3">
        <div className="bg-[#03070c]">
          <SectionHead title="最强联动对" />
          <table className="w-full text-[11px]"><tbody>{strongest.map((l) => <tr key={l.a + l.b} onClick={() => setPair([l.a, l.b])} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-300">{name(l.a)} ↔ {name(l.b)}</td><td className="px-2 text-right font-mono" style={{ background: heat(l.c, 1) }}>{l.c.toFixed(2)}</td></tr>)}</tbody></table>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title="相关性体制变化" sub="最近窗口 − 此前 250 日" />
          <table className="w-full text-[11px]"><tbody>{shifts.map((l) => <tr key={l.a + l.b} onClick={() => setPair([l.a, l.b])} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-300">{name(l.a)} ↔ {name(l.b)}</td><td className="text-right font-mono text-slate-400">{l.c.toFixed(2)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(l.d) }}>{l.d! > 0 ? "+" : ""}{l.d!.toFixed(2)}</td></tr>)}</tbody></table>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title={`${name(pair[0])} ↔ ${name(pair[1])}`} sub="60 日滚动相关" />
          <Lines series={[{ name: "滚动相关", color: "#38bdf8", values: roll }]} xLabels={dates.slice(-roll.length).map((d) => d.slice(2))} height={170} zero />
          <div className="px-2 text-[10px] text-slate-500">股债相关由负转正时，国债对权益组合的对冲作用减弱（通胀主导的市场常见）。</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 组合优化 */
const UNIV: Array<[string, string]> = [["SHY", "美债1-3年"], ["IEI", "美债3-7年"], ["IEF", "美债7-10年"], ["TLH", "美债10-20年"], ["TLT", "美债20年+"], ["TIP", "通胀保值"], ["MBB", "机构MBS"], ["LQD", "投资级信用"], ["HYG", "高收益"], ["EMB", "新兴美元债"], ["BNDX", "全球综合(对冲)"], ["BWX", "国际国债"]];
type Method = "eq" | "iv" | "rp" | "mv";
const METHOD_NAME: Record<Method, string> = { eq: "等权", iv: "逆波动", rp: "风险平价", mv: "最小方差" };
const METHOD_COLOR: Record<Method, string> = { eq: "#94a3b8", iv: "#fbbf24", rp: "#38bdf8", mv: "#f472b6" };

function capWeights(w: number[], cap: number) {
  let x = [...w];
  for (let it = 0; it < 50; it++) {
    const over = x.map((v) => v > cap);
    if (!over.some(Boolean)) break;
    const excess = x.reduce((s, v) => s + Math.max(0, v - cap), 0);
    const freeSum = x.reduce((s, v, i) => s + (over[i] ? 0 : v), 0);
    x = x.map((v, i) => (over[i] ? cap : freeSum > 0 ? v + (excess * v) / freeSum : v));
  }
  return x;
}
function weightsFor(method: Method, logR: number[][], cap: number) {
  const n = logR.length;
  if (method === "eq") return new Array(n).fill(1 / n);
  const cov = covMatrix(logR);
  let w: number[];
  if (method === "iv") { const iv = cov.map((r, i) => 1 / Math.sqrt(Math.max(1e-12, r[i]))); const s = iv.reduce((a, b) => a + b, 0); w = iv.map((x) => x / s); }
  else if (method === "rp") w = riskParity(cov);
  else w = minVariance(cov);
  return capWeights(w, Math.max(cap, 1 / n));
}

export function Optimizer() {
  const syms = [...UNIV.map(([s]) => s), "^TNX"];
  const pack = useCloses(syms, 1300);
  const ticks = useTicks(UNIV.map(([s]) => s));
  const [method, setMethod] = useState<Method>("rp");
  const [look, setLook] = useState("252");
  const [cap, setCap] = useState(35);
  const { pick } = useHub();
  const assets = useMemo(() => UNIV.map(([s]) => s).filter((s) => (pack.data?.[s]?.length ?? 0) > 150), [pack.data]);
  const { dates, m } = useMemo(() => {
    const a = align(pack.data, assets);
    // 10 年期收益率按日期对齐到资产日线（缺失日沿用前值）
    const ty = new Map((pack.data?.["^TNX"] ?? []).map(([t, c]) => [new Date(t + 8 * 3600_000).toISOString().slice(0, 10), c]));
    let last: number | null = null;
    a.m["^TNX"] = a.dates.map((d) => { const v = ty.get(d); if (v != null) last = v; return last ?? NaN; });
    return a;
  }, [pack.data, assets]);
  const L = Number(look);
  const name = (s: string) => UNIV.find(([x]) => x === s)?.[1] ?? s;

  const now = useMemo(() => {
    if (assets.length < 3 || dates.length < L + 2) return null;
    const logR = assets.map((s) => rets(m[s].slice(-L - 1)));
    const cov = covMatrix(logR);
    const w = weightsFor(method, logR, cap / 100);
    const pv = portVol(w, cov);
    const mrc = cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));
    const tot = w.reduce((s, x, i) => s + x * mrc[i], 0) || 1;
    // 经验久期：资产日收益（%）对 10 年期收益率日变动（bp）的回归斜率 × −100
    const y = m["^TNX"].slice(-L - 1);
    const ys = y[y.length - 1] > 20 ? 0.1 : 1;
    const dy = y.slice(1).map((v, i) => (v - y[i]) * ys * 100);
    const okY = dy.every((v) => Number.isFinite(v));
    const vdy = okY ? std(dy) ** 2 : 0;
    const rows = assets.map((s, i) => {
      const c = m[s].slice(-L - 1);
      const r = c.slice(1).map((v, k) => (v / c[k] - 1) * 100);
      const mr = mean(r), md = mean(dy);
      const cv = r.reduce((acc, v, k) => acc + (v - mr) * (dy[k] - md), 0) / (r.length - 1);
      return { s, w: w[i], vol: Math.sqrt(cov[i][i]) * 100, ret: (c[c.length - 1] / c[0] - 1) * 100, rc: (w[i] * mrc[i]) / tot, dur: vdy && Number.isFinite(cv) ? (-cv / vdy) * 100 : null };
    });
    const pdur = rows.some((r) => r.dur != null) ? rows.reduce((s, r) => s + r.w * (r.dur ?? 0), 0) : null;
    return { rows, pv, pdur };
  }, [dates, m, method, L, cap, assets]);

  const bt = useMemo(() => {
    if (assets.length < 3 || dates.length < L + 60) return null;
    const out: Record<Method, number[]> = { eq: [], iv: [], rp: [], mv: [] };
    const start = L;
    (Object.keys(out) as Method[]).forEach((meth) => {
      let eq = 1, w: number[] = [];
      for (let t = start; t < dates.length; t++) {
        // 先按上一期权重计当日收益，再用截至当日的数据重新估计权重（无前视）
        if (t > start) eq *= 1 + assets.reduce((s, a, i) => s + w[i] * (m[a][t] / m[a][t - 1] - 1), 0);
        out[meth].push(eq);
        if ((t - start) % 21 === 0) w = weightsFor(meth, assets.map((s) => rets(m[s].slice(t - L, t + 1))), cap / 100);
      }
    });
    const stats = (Object.keys(out) as Method[]).map((k) => {
      const c = out[k];
      const r = c.slice(1).map((v, i) => v / c[i] - 1);
      const yrs = r.length / 252;
      const ann = (Math.pow(c[c.length - 1], 1 / Math.max(yrs, 0.01)) - 1) * 100;
      const vol = std(r) * Math.sqrt(252) * 100;
      return { k, ann, vol, sharpe: vol ? ann / vol : null, mdd: drawdown(c).max, total: (c[c.length - 1] - 1) * 100 };
    });
    return { out, stats, dates: dates.slice(start) };
  }, [dates, m, L, cap, assets]);

  const exportCsv = () => {
    if (!now) return;
    const csv = [["代码", "名称", "权重(%)", "年化波动(%)", "区间收益(%)", "风险贡献(%)", "经验久期(年)"], ...now.rows.map((r) => [r.s, name(r.s), (r.w * 100).toFixed(2), r.vol.toFixed(2), r.ret.toFixed(2), (r.rc * 100).toFixed(2), r.dur?.toFixed(2) ?? ""]), ["", "组合", "100", now.pv.toFixed(2), "", "100", now.pdur?.toFixed(2) ?? ""]].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `债券组合_${METHOD_NAME[method]}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!now) return <div className="px-3 py-8 text-[11px] text-slate-500">{pack.loading ? "日线读取中…" : "日线不足"}</div>;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <span className="text-slate-500">方法</span><Seg value={method} onChange={setMethod} options={(Object.keys(METHOD_NAME) as Method[]).map((k) => [k, METHOD_NAME[k]])} />
        <span className="text-slate-500">估计窗口</span><Seg value={look} onChange={setLook} options={[["126", "半年"], ["252", "1年"], ["504", "2年"]]} />
        <label className="flex items-center gap-1 text-slate-500">单一上限 <input type="range" min={10} max={100} step={5} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="w-24 accent-cyan-500" /><span className="font-mono text-cyan-200">{cap}%</span></label>
        <button type="button" onClick={exportCsv} className="ml-auto border border-[#1d3047] px-2 text-slate-300 hover:text-white">导出权重</button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] sm:grid-cols-4">
        {([["组合年化波动", `${now.pv.toFixed(2)}%`], ["组合经验久期", f2(now.pdur, 2, " 年")], ["10bp 收益率上行影响", f2(now.pdur != null ? -now.pdur * 0.1 : null, 2, "%")], ["最大单一权重", `${(Math.max(...now.rows.map((r) => r.w)) * 100).toFixed(1)}%`]] as Array<[string, string]>).map(([k, v]) => <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div></div>)}
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th><th className="text-right">实时</th><th className="text-right">涨跌幅</th><th className="text-right">权重</th><th className="px-2 text-left" /><th className="text-right">年化波动</th><th className="text-right">区间收益</th><th className="text-right">风险贡献</th><th className="px-2 text-right">经验久期</th></tr></thead>
        <tbody>
          {now.rows.map((r) => (
            <tr key={r.s} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
              <td className="px-2 py-0.5"><button type="button" onClick={() => pick(r.s)} className="text-slate-200 hover:text-cyan-300">{name(r.s)}</button><span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td>
              <td className="text-right font-mono" style={{ color: toneOf(ticks[r.s]?.changePct) }}>{fmtPrice(ticks[r.s]?.price)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(ticks[r.s]?.changePct) }}>{fmtPct(ticks[r.s]?.changePct)}</td>
              <td className="text-right font-mono text-white">{(r.w * 100).toFixed(1)}%</td>
              <td className="w-28 px-2"><div className="h-2 bg-cyan-500/70" style={{ width: `${Math.min(100, r.w * 100 * (100 / Math.max(cap, 20)))}%` }} /></td>
              <td className="text-right font-mono">{r.vol.toFixed(2)}%</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.ret) }}>{r.ret > 0 ? "+" : ""}{r.ret.toFixed(2)}%</td>
              <td className="text-right font-mono">{(r.rc * 100).toFixed(1)}%</td>
              <td className="px-2 text-right font-mono">{f2(r.dur, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {bt && (
        <>
          <SectionHead title="月度再平衡回测（每 21 个交易日按滚动窗口重新估计权重）" sub={`${bt.dates[0]} 起，未计交易成本`} />
          <Lines series={(Object.keys(bt.out) as Method[]).map((k) => ({ name: METHOD_NAME[k], color: METHOD_COLOR[k], values: bt.out[k].map((v) => (v - 1) * 100) }))} xLabels={bt.dates.map((d) => d.slice(2))} height={200} fmt={(v) => `${v.toFixed(1)}%`} zero />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">方法</th><th className="text-right">累计</th><th className="text-right">年化收益</th><th className="text-right">年化波动</th><th className="text-right">收益/波动</th><th className="px-2 text-right">最大回撤</th></tr></thead>
            <tbody>{bt.stats.map((s) => <tr key={s.k} onClick={() => setMethod(s.k)} className={`cursor-pointer border-t border-[#0f1b29] ${s.k === method ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5"><span style={{ color: METHOD_COLOR[s.k] }}>■</span> {METHOD_NAME[s.k]}</td><td className="text-right font-mono" style={{ color: toneOf(s.total) }}>{s.total.toFixed(2)}%</td><td className="text-right font-mono" style={{ color: toneOf(s.ann) }}>{s.ann.toFixed(2)}%</td><td className="text-right font-mono">{s.vol.toFixed(2)}%</td><td className="text-right font-mono">{f2(s.sharpe, 2)}</td><td className="px-2 text-right font-mono text-emerald-300">{s.mdd.toFixed(2)}%</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 相对价值：欧元区主权 */
export type Sov = { countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; spread1m: number | null; spread12m: number | null; chg1m: number | null; chg12m: number | null; hist: Array<{ d: string; y: number; s: number | null }> }> };

export function RelValue({ sov }: { sov: Sov | null }) {
  const [sel, setSel] = useState("IT");
  const rows = useMemo(() => (sov?.countries ?? []).filter((c) => c.code !== "DE" && c.spread != null).map((c) => {
    const s = c.hist.map((h) => h.s).filter((v): v is number => v != null);
    const ds = s.slice(1).map((v, i) => v - s[i]);
    const vol = ds.length > 6 ? std(ds) * Math.sqrt(12) : null;
    const m5 = mean(s), sd5 = std(s);
    const pct = s.length ? (s.filter((v) => v <= c.spread!).length / s.length) * 100 : null;
    return { ...c, vol, z: sd5 ? (c.spread! - m5) / sd5 : null, pct, ratio: vol ? c.spread! / vol : null, min: Math.min(...s), max: Math.max(...s) };
  }), [sov]);
  if (!rows.length) return <div className="px-3 py-8 text-[11px] text-slate-500">{sov ? "暂无数据" : "读取中…"}</div>;
  const cur = rows.find((r) => r.code === sel) ?? rows[0];
  // 散点：横轴 年化利差波动，纵轴 当前利差
  const Wd = 620, H = 300;
  const xs = rows.map((r) => r.vol ?? 0), ys = rows.map((r) => r.spread!);
  const x0 = 0, x1 = Math.max(...xs) * 1.1 || 1, y0 = Math.min(0, ...ys), y1 = Math.max(...ys) * 1.1 || 1;
  const X = (v: number) => 40 + ((v - x0) / (x1 - x0)) * (Wd - 50);
  const Y = (v: number) => 10 + ((y1 - v) / (y1 - y0)) * (H - 30);
  return (
    <div>
      <SectionHead title="欧元区主权利差：利差 × 利差波动" sub={`月度数据截至 ${rows[0].date}；横轴：近 5 年月度利差变动的年化波动（bp），纵轴：对德国 10 年利差（bp）；颜色：12 个月利差变动`} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]">
          <svg viewBox={`0 0 ${Wd} ${H}`} className="w-full" style={{ height: H }}>
            {[0, 0.5, 1].map((q) => { const v = y0 + (y1 - y0) * q; return <g key={q}><line x1={40} x2={Wd - 10} y1={Y(v)} y2={Y(v)} stroke="#132233" /><text x={2} y={Y(v) + 3} fontSize={9} fill="#5f7891">{v.toFixed(0)}</text></g>; })}
            {[0, 0.5, 1].map((q) => { const v = x0 + (x1 - x0) * q; return <text key={q} x={X(v)} y={H - 6} fontSize={9} textAnchor="middle" fill="#5f7891">{v.toFixed(0)}</text>; })}
            {rows.map((r) => (
              <g key={r.code} onClick={() => setSel(r.code)} className="cursor-pointer">
                <circle cx={X(r.vol ?? 0)} cy={Y(r.spread!)} r={r.code === cur.code ? 6 : 4} fill={r.chg12m == null ? "#64748b" : r.chg12m > 0 ? "#f2495c" : "#1fbf75"} stroke={r.code === cur.code ? "#fff" : "none"} opacity={0.85} />
                <text x={X(r.vol ?? 0) + 6} y={Y(r.spread!) + 3} fontSize={9} fill="#cbd5e1">{r.name}</text>
              </g>
            ))}
          </svg>
          
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title={`${cur.name} 10 年期：收益率与对德利差（月度）`} />
          <Lines series={[{ name: "对德利差 bp", color: "#fbbf24", values: cur.hist.map((h) => h.s) }]} xLabels={cur.hist.map((h) => h.d.slice(2))} height={130} fmt={(v) => v.toFixed(0)} zero />
          <Lines series={[{ name: `${cur.name} %`, color: "#38bdf8", values: cur.hist.map((h) => h.y) }]} xLabels={cur.hist.map((h) => h.d.slice(2))} height={110} />
        </div>
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">国家</th><th className="text-right">10年收益率</th><th className="text-right">对德利差</th><th className="text-right">1月变动</th><th className="text-right">12月变动</th><th className="text-right">5年区间</th><th className="text-right">5年分位</th><th className="text-right">Z 分数</th><th className="text-right">利差波动</th><th className="px-2 text-right">利差/波动</th></tr></thead>
        <tbody>
          {[...rows].sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1)).map((r) => (
            <tr key={r.code} onClick={() => setSel(r.code)} className={`cursor-pointer border-t border-[#0f1b29] ${r.code === cur.code ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
              <td className="px-2 py-0.5 text-slate-200">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.code}</span></td>
              <td className="text-right font-mono text-white">{r.y.toFixed(2)}%</td>
              <td className="text-right font-mono">{r.spread}</td>
              <td className="text-right font-mono" style={{ background: heat(r.spread1m != null ? r.spread! - r.spread1m : null, 30) }}>{r.spread1m != null ? r.spread! - r.spread1m : "—"}</td>
              <td className="text-right font-mono" style={{ background: heat(r.spread12m != null ? r.spread! - r.spread12m : null, 80) }}>{r.spread12m != null ? r.spread! - r.spread12m : "—"}</td>
              <td className="text-right font-mono text-slate-400">{r.min}–{r.max}</td>
              <td className="text-right font-mono">{f2(r.pct, 0, "%")}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.z) }}>{f2(r.z, 2)}</td>
              <td className="text-right font-mono text-slate-400">{f2(r.vol, 0)}</td>
              <td className="px-2 text-right font-mono text-cyan-200">{f2(r.ratio, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
    </div>
  );
}

