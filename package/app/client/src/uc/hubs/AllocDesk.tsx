/**
 * 跨资产类页面：
 *  - SectorDesk（/sector-analysis）：美股 / A股 / 港股行业区间表现 · 相对强弱轮动象限 · 行业热力
 *  - AllocationDesk（/asset-allocation）：大类资产表现 · 风险收益分布 · 配置模型（等权 / 风险平价 / 最小方差 / 动量）与回测
 *  - CorrDesk（/mars）：跨资产相关矩阵（短期 vs 长期）· 关键资产对的滚动相关 · 跨资产波动
 *  - StressDesk（/risk-management）：市场压力综合指数 · 各指标分位 · 主要指数回撤监控
 */
import { useMemo, useState } from "react";
import { fmtPct, toneOf, useTicks } from "@/uc/market/live";
import { SectionHead, Seg } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, useHub, type BoardRow } from "./kit";
import { align, annVol, corr, covMatrix, drawdown, f2, heat, mean, minVariance, perf, portVol, rets, riskParity, rollingCorr, rollingVol, sgn, std, useCloses, ytd } from "./calc";

/* ================================================================== 行业轮动 */
const SECTORS: Record<string, { bench: [string, string]; list: Array<[string, string]> }> = {
  us: { bench: ["SPY", "标普 500"], list: [["XLK", "信息技术"], ["XLC", "通信服务"], ["XLY", "可选消费"], ["XLP", "必需消费"], ["XLF", "金融"], ["XLV", "医疗保健"], ["XLI", "工业"], ["XLE", "能源"], ["XLB", "材料"], ["XLU", "公用事业"], ["XLRE", "房地产"], ["SMH", "半导体"], ["IGV", "软件"], ["KRE", "地区银行"], ["XBI", "生物科技"], ["ITB", "住宅建筑"], ["XOP", "油气开采"], ["TAN", "太阳能"], ["JETS", "航空"], ["XRT", "零售"]] },
  cn: { bench: ["sh000300", "沪深 300"], list: [["sh512480", "半导体"], ["sh512720", "计算机"], ["sh515050", "通信 5G"], ["sz159995", "芯片"], ["sh512800", "银行"], ["sh512880", "证券"], ["sh512010", "医药"], ["sh512170", "医疗"], ["sh512690", "白酒"], ["sz159928", "消费"], ["sh515030", "新能源车"], ["sh515790", "光伏"], ["sh512400", "有色金属"], ["sh515220", "煤炭"], ["sh512660", "军工"], ["sh512200", "房地产"], ["sh516160", "新能源"], ["sh512980", "传媒"]] },
  hk: { bench: ["2800.HK", "盈富基金"], list: [["3033.HK", "恒生科技"], ["2828.HK", "国企指数"], ["0700.HK", "腾讯"], ["9988.HK", "阿里巴巴"], ["3690.HK", "美团"], ["1810.HK", "小米"], ["0939.HK", "建设银行"], ["1299.HK", "友邦保险"], ["0388.HK", "港交所"], ["0883.HK", "中海油"], ["1211.HK", "比亚迪"], ["2318.HK", "中国平安"], ["0016.HK", "新鸿基地产"], ["0941.HK", "中国移动"]] },
};
function Rotation({ rows, bench }: { rows: Array<{ s: string; l: string; c: number[] }>; bench: number[] }) {
  // 相对强弱比率（10 周均值归一）与其动量：简化版轮动象限
  const pts = rows.map((r) => {
    const rs = r.c.map((v, i) => (bench[i] ? v / bench[i] : null)).filter((v): v is number => v != null);
    if (rs.length < 70) return null;
    const ma = (a: number[], n: number) => mean(a.slice(-n));
    const ratio = (rs[rs.length - 1] / ma(rs, 50)) * 100;
    const prev = (rs[rs.length - 11] / mean(rs.slice(-60, -10))) * 100;
    return { ...r, x: ratio, y: ratio - prev };
  }).filter(Boolean) as Array<{ s: string; l: string; x: number; y: number }>;
  if (!pts.length) return <div className="px-2 py-6 text-[11px] text-slate-500">读取日线…</div>;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xr = Math.max(2, ...xs.map((x) => Math.abs(x - 100))) * 1.15, yr = Math.max(1, ...ys.map((y) => Math.abs(y))) * 1.15;
  const W = 620, H = 340;
  const X = (v: number) => W / 2 + ((v - 100) / xr) * (W / 2 - 20);
  const Y = (v: number) => H / 2 - (v / yr) * (H / 2 - 20);
  const q = (p: { x: number; y: number }) => (p.x >= 100 ? (p.y >= 0 ? ["领涨", "#f2495c"] : ["转弱", "#fbbf24"]) : p.y >= 0 ? ["改善", "#38bdf8"] : ["落后", "#1fbf75"]);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 380 }}>
        <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="rgba(242,73,92,0.05)" /><rect x={0} y={0} width={W / 2} height={H / 2} fill="rgba(56,189,248,0.05)" /><rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="rgba(31,191,117,0.05)" /><rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="rgba(251,191,36,0.05)" />
        <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke="#334155" /><line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#334155" />
        {[["领涨（强且加速）", W - 6, 14, "end"], ["改善（弱但回升）", 6, 14, "start"], ["落后（弱且走弱）", 6, H - 6, "start"], ["转弱（强但减速）", W - 6, H - 6, "end"]].map(([t, x, y, a]) => <text key={String(t)} x={Number(x)} y={Number(y)} fontSize={10} textAnchor={a as "end" | "start"} fill="#64748b">{t}</text>)}
        {pts.map((p) => <g key={p.s}><circle cx={X(p.x)} cy={Y(p.y)} r={4} fill={q(p)[1]} /><text x={X(p.x) + 6} y={Y(p.y) + 3} fontSize={10} fill="#e2e8f0">{p.l}</text></g>)}
      </svg>
      
    </div>
  );
}
export function SectorDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "perf");
  const [mkt, setMkt] = useState("us");
  const cfg = SECTORS[mkt];
  const syms = [cfg.bench[0], ...cfg.list.map(([s]) => s)];
  const pack = useCloses(syms, 400);
  const ticks = useTicks(syms);
  const { pick } = useHub();
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data, mkt]);
  const rows = cfg.list.map(([s, l]) => ({ s, l, c: m[s] ?? [] }));
  const bench = m[cfg.bench[0]] ?? [];
  const table = rows.map((r) => ({ ...r, d1: ticks[r.s]?.changePct ?? null, w1: perf(r.c, 5), m1: perf(r.c, 21), m3: perf(r.c, 63), m6: perf(r.c, 126), ytd: ytd(r.c, dates), y1: perf(r.c, 252), rel3: perf(r.c, 63) != null && perf(bench, 63) != null ? perf(r.c, 63)! - perf(bench, 63)! : null, vol: annVol(r.c, 63) }));
  const [sort, setSort] = useState<string>("m1");
  const sorted = [...table].sort((a, b) => ((b as any)[sort] ?? -1e9) - ((a as any)[sort] ?? -1e9));
  const th = (k: string, l: string) => <th className="cursor-pointer text-right hover:text-white" onClick={() => setSort(k)}>{l}{sort === k ? " ▼" : ""}</th>;
  return (
    <HubShell title="行业与板块分析" code="SECT" func={func} setFunc={setFunc}
      funcs={[["perf", "SECP", "区间表现"], ["rrg", "RRG", "轮动象限"], ["heat", "SECH", "行业热力"], ["board", "SECB", "实时看板"]]}
      right={<Seg value={mkt} onChange={setMkt} options={[["us", "美股"], ["cn", "A股"], ["hk", "港股"]]} />}>
      {func === "perf" && (
        <div>
          <SectionHead title={`行业区间表现（基准：${cfg.bench[1]}）`} sub={pack.loading && !pack.data ? "读取日线…" : "点击表头排序；点击行业看实时 K 线"} />
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">行业</th>{th("d1", "今日")}{th("w1", "1周")}{th("m1", "1月")}{th("m3", "3月")}{th("m6", "6月")}{th("ytd", "年初至今")}{th("y1", "1年")}{th("rel3", "3月超额")}{th("vol", "3月波动")}</tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.s} onClick={() => pick(r.s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
                  <td className="px-2 py-0.5 text-slate-100">{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td>
                  {[["d1", 3], ["w1", 5], ["m1", 10], ["m3", 15], ["m6", 25], ["ytd", 30], ["y1", 40], ["rel3", 10]].map(([k, sc]) => <td key={String(k)} className="text-right font-mono" style={{ background: heat((r as any)[k], Number(sc)), color: "#f1f5f9" }}>{sgn((r as any)[k], 1)}</td>)}
                  <td className="px-2 text-right font-mono text-slate-400">{f2(r.vol, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {func === "rrg" && <><SectionHead title={`行业轮动象限（相对 ${cfg.bench[1]}）`} /><Rotation rows={rows} bench={bench} /></>}
      {func === "heat" && (
        <div>
          <SectionHead title="近 12 周逐周涨跌热力（%）" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[10px]">
              <thead className="text-slate-500"><tr><th className="px-2 py-1 text-left">行业</th>{Array.from({ length: 12 }, (_, i) => <th key={i} className="text-center">{dates[dates.length - 1 - (11 - i) * 5]?.slice(5) ?? ""}</th>)}</tr></thead>
              <tbody>{rows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{r.l}</td>{Array.from({ length: 12 }, (_, i) => { const e = r.c.length - 1 - (11 - i) * 5; const v = e - 5 >= 0 ? (r.c[e] / r.c[e - 5] - 1) * 100 : null; return <td key={i} className="text-center font-mono" style={{ background: heat(v, 6), color: "#f1f5f9" }}>{v == null ? "" : v.toFixed(1)}</td>; })}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {func === "board" && <LiveBoard rows={[{ symbol: cfg.bench[0], label: cfg.bench[1], group: "基准" }, ...cfg.list.map(([s, l]) => ({ symbol: s, label: l, group: "行业" }))]} />}
    </HubShell>
  );
}

/* ================================================================== 大类资产配置 */
const ASSETS: Array<[string, string, string]> = [["SPY", "美股大盘", "#f2495c"], ["QQQ", "美股科技", "#fb7185"], ["IWM", "美股小盘", "#f97316"], ["EFA", "发达市场", "#fbbf24"], ["EEM", "新兴市场", "#a3e635"], ["sh510300", "A股沪深300", "#ef4444"], ["TLT", "长期美债", "#38bdf8"], ["IEF", "中期美债", "#60a5fa"], ["LQD", "投资级信用", "#818cf8"], ["HYG", "高收益债", "#a78bfa"], ["GLD", "黄金", "#facc15"], ["DBC", "商品", "#d97706"], ["VNQ", "房地产信托", "#34d399"], ["UUP", "美元", "#94a3b8"], ["BTC", "比特币", "#f59e0b"]];
function backtest(m: Record<string, number[]>, syms: string[], weightsFn: (win: Record<string, number[]>) => number[], lookback = 126, step = 21) {
  const n = Math.min(...syms.map((s) => m[s]?.length ?? 0));
  const eq: number[] = [];
  let v = 1;
  let w = syms.map(() => 1 / syms.length);
  for (let i = lookback; i < n; i++) {
    if ((i - lookback) % step === 0) {
      const win = Object.fromEntries(syms.map((s) => [s, m[s].slice(i - lookback, i + 1)]));
      w = weightsFn(win);
    }
    const r = syms.reduce((acc, s, k) => acc + w[k] * (m[s][i] / m[s][i - 1] - 1), 0);
    v *= 1 + r;
    eq.push(v);
  }
  return eq;
}
const models: Record<string, { label: string; fn: (win: Record<string, number[]>, syms: string[]) => number[] }> = {
  ew: { label: "等权", fn: (_w, syms) => syms.map(() => 1 / syms.length) },
  iv: { label: "波动率倒数", fn: (w, syms) => { const iv = syms.map((s) => 1 / Math.max(1e-6, std(rets(w[s])))); const t = iv.reduce((a, b) => a + b, 0); return iv.map((x) => x / t); } },
  rp: { label: "风险平价", fn: (w, syms) => riskParity(covMatrix(syms.map((s) => rets(w[s])))) },
  mv: { label: "最小方差", fn: (w, syms) => minVariance(covMatrix(syms.map((s) => rets(w[s])))) },
  mom: { label: "动量前 1/3", fn: (w, syms) => { const p = syms.map((s) => w[s][w[s].length - 1] / w[s][0] - 1); const k = Math.max(1, Math.round(syms.length / 3)); const top = [...p].sort((a, b) => b - a)[k - 1]; const sel = p.map((x) => (x >= top && x > 0 ? 1 : 0)); const t = sel.reduce((a: number, b: number) => a + b, 0); return t ? sel.map((x) => x / t) : syms.map(() => 1 / syms.length); } },
};
export function AllocationDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "perf");
  const [picked, setPicked] = useState<string[]>(["SPY", "EFA", "EEM", "TLT", "IEF", "HYG", "GLD", "DBC", "VNQ"]);
  const all = ASSETS.map(([s]) => s);
  const pack = useCloses(all, 1100);
  const { dates, m } = useMemo(() => align(pack.data ?? null, all), [pack.data]);
  const ticks = useTicks(all);
  const { pick } = useHub();
  const name = Object.fromEntries(ASSETS.map(([s, l]) => [s, l]));
  const color = Object.fromEntries(ASSETS.map(([s, , c]) => [s, c]));
  const rows = ASSETS.map(([s, l]) => { const c = m[s] ?? []; const r = rets(c.slice(-253)); const ret1y = perf(c, 252); const v = annVol(c, 252); return { s, l, d1: ticks[s]?.changePct ?? null, m1: perf(c, 21), m3: perf(c, 63), ytd: ytd(c, dates), y1: ret1y, y3: c.length > 756 ? ((c[c.length - 1] / c[c.length - 757]) ** (1 / 3) - 1) * 100 : null, vol: v, sharpe: ret1y != null && v ? (ret1y - 4) / v : null, dd: c.length ? drawdown(c.slice(-252)).max : null, r }; });
  const sel = picked.filter((s) => (m[s]?.length ?? 0) > 200);
  const curWin = Object.fromEntries(sel.map((s) => [s, (m[s] ?? []).slice(-127)]));
  const cov = sel.length > 1 ? covMatrix(sel.map((s) => rets(curWin[s]))) : [];
  const weights = Object.fromEntries(Object.entries(models).map(([k, md]) => [k, sel.length > 1 ? md.fn(curWin, sel) : []]));
  const bts = func === "bt" && sel.length > 1 ? Object.fromEntries(Object.entries(models).map(([k, md]) => [k, backtest(m, sel, (w) => md.fn(w, sel))])) : {};
  const btLen = Math.max(0, ...Object.values(bts).map((e) => e.length));
  const MC: Record<string, string> = { ew: "#94a3b8", iv: "#38bdf8", rp: "#fbbf24", mv: "#34d399", mom: "#f2495c" };
  return (
    <HubShell title="大类资产配置" code="ALLO" func={func} setFunc={setFunc}
      funcs={[["perf", "XAST", "资产表现"], ["rr", "RISK", "风险收益"], ["model", "WGT", "配置模型"], ["bt", "BTST", "模型回测"], ["board", "XBRD", "实时看板"]]}
      right={<span>{pack.loading && !pack.data ? "读取日线…" : `数据至 ${dates[dates.length - 1] ?? "—"}`}</span>}>
      {func === "perf" && (
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th><th className="text-right">今日</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">年初至今</th><th className="text-right">1年</th><th className="text-right">3年年化</th><th className="text-right">1年波动</th><th className="text-right">夏普（4%）</th><th className="text-right">1年最大回撤</th><th className="px-2 text-center">纳入模型</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="cursor-pointer px-2 py-0.5 text-slate-100" onClick={() => pick(r.s)}><span style={{ color: color[r.s] }}>■</span> {r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className="text-right font-mono" style={{ color: toneOf(r.d1) }}>{fmtPct(r.d1)}</td>{[[r.m1, 6], [r.m3, 12], [r.ytd, 25], [r.y1, 30], [r.y3, 15]].map(([v, sc], i) => <td key={i} className="text-right font-mono" style={{ background: heat(v as number | null, sc as number), color: "#f1f5f9" }}>{sgn(v as number | null, 1)}</td>)}<td className="text-right font-mono text-slate-300">{f2(r.vol, 1)}</td><td className="text-right font-mono text-slate-200">{f2(r.sharpe, 2)}</td><td className="text-right font-mono text-emerald-300">{sgn(r.dd, 1)}</td><td className="px-2 text-center"><input type="checkbox" checked={picked.includes(r.s)} onChange={() => setPicked((p) => (p.includes(r.s) ? p.filter((x) => x !== r.s) : [...p, r.s]))} /></td></tr>)}</tbody>
        </table>
      )}
      {func === "rr" && (() => {
        const pts = rows.filter((r) => r.vol != null && r.y1 != null);
        const W = 620, H = 320, maxV = Math.max(10, ...pts.map((p) => p.vol!)) * 1.1, lo = Math.min(-10, ...pts.map((p) => p.y1!)) * 1.1, hi = Math.max(10, ...pts.map((p) => p.y1!)) * 1.1;
        const X = (v: number) => 40 + (v / maxV) * (W - 60), Y = (v: number) => 10 + ((hi - v) / (hi - lo)) * (H - 40);
        return <div><SectionHead title="过去一年风险（波动率）与收益" /><svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 360 }}><line x1={40} x2={W} y1={Y(0)} y2={Y(0)} stroke="#334155" strokeDasharray="3 3" />{[0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={X(maxV * f)} y={H - 6} fontSize={9} textAnchor="middle" fill="#5f7891">{(maxV * f).toFixed(0)}%</text>)}{pts.map((p) => <g key={p.s} onClick={() => pick(p.s)} className="cursor-pointer"><circle cx={X(p.vol!)} cy={Y(p.y1!)} r={5} fill={color[p.s]} /><text x={X(p.vol!) + 7} y={Y(p.y1!) + 3} fontSize={10} fill="#e2e8f0">{p.l} {p.y1!.toFixed(0)}%</text></g>)}</svg><div className="px-2 text-[10px] text-slate-500">横轴年化波动率，纵轴一年收益；越靠左上风险调整后收益越好。</div></div>;
      })()}
      {func === "model" && (
        <div>
          <SectionHead title="配置模型权重（基于最近半年日收益协方差，每次打开实时重算）" sub={`纳入 ${sel.length} 个资产；可在「资产表现」勾选`} />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th>{Object.entries(models).map(([k, md]) => <th key={k} className="text-right" style={{ color: MC[k] }}>{md.label}</th>)}</tr></thead>
            <tbody>
              {sel.map((s, i) => <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{name[s]}</td>{Object.keys(models).map((k) => <td key={k} className="text-right font-mono"><span className="mr-1 inline-block h-1.5 bg-cyan-500/60 align-middle" style={{ width: `${(weights[k][i] ?? 0) * 60}px` }} />{((weights[k][i] ?? 0) * 100).toFixed(1)}%</td>)}</tr>)}
              <tr className="border-t border-[#1d3047] text-slate-300"><td className="px-2 py-1">组合预期波动率</td>{Object.keys(models).map((k) => <td key={k} className="text-right font-mono">{cov.length ? `${portVol(weights[k], cov).toFixed(2)}%` : "—"}</td>)}</tr>
            </tbody>
          </table>
          <div className="px-2 py-1 text-[10px] text-slate-500">风险平价：每个资产对组合风险的贡献相同；最小方差：只做多下组合波动最小；动量：选取过去半年涨幅前三分之一且为正的资产等权持有。</div>
        </div>
      )}
      {func === "bt" && (
        <div>
          <SectionHead title="模型回测（每月调仓，回看半年，不计交易成本）" sub={btLen ? `${dates[dates.length - btLen]} 至 ${dates[dates.length - 1]}` : "读取日线…"} />
          <Lines series={Object.entries(bts).map(([k, e]) => ({ name: models[k].label, color: MC[k], values: e }))} xLabels={dates.slice(-btLen).map((d) => d.slice(2))} height={260} fmt={(v) => v.toFixed(2)} />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">模型</th><th className="text-right">累计收益</th><th className="text-right">年化收益</th><th className="text-right">年化波动</th><th className="text-right">夏普</th><th className="px-2 text-right">最大回撤</th></tr></thead>
            <tbody>{Object.entries(bts).map(([k, e]) => { const r = rets(e); const yrs = e.length / 252; const ann = e.length ? (e[e.length - 1] ** (1 / Math.max(0.1, yrs)) - 1) * 100 : null; const v = std(r) * Math.sqrt(252) * 100; return <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5" style={{ color: MC[k] }}>{models[k].label}</td><td className="text-right font-mono text-white">{sgn(e.length ? (e[e.length - 1] - 1) * 100 : null, 1)}</td><td className="text-right font-mono text-slate-200">{sgn(ann, 2)}</td><td className="text-right font-mono text-slate-300">{f2(v, 2)}</td><td className="text-right font-mono text-slate-200">{ann != null && v ? ((ann - 4) / v).toFixed(2) : "—"}</td><td className="px-2 text-right font-mono text-emerald-300">{sgn(drawdown(e).max, 1)}</td></tr>; })}</tbody>
          </table>
        </div>
      )}
      {func === "board" && <LiveBoard rows={ASSETS.map(([s, l]) => ({ symbol: s, label: l, group: "大类资产" }))} />}
    </HubShell>
  );
}

/* ================================================================== 跨资产相关性 */
const CORR_ASSETS: Array<[string, string]> = [["SPY", "美股"], ["QQQ", "科技股"], ["EEM", "新兴市场"], ["sh000300", "沪深300"], ["TLT", "长债"], ["HYG", "高收益"], ["GLD", "黄金"], ["CL", "原油"], ["HG", "铜"], ["UUP", "美元"], ["USDJPY", "美元日元"], ["BTC", "比特币"]];
const PAIRS: Array<[string, string, string, string]> = [["SPY", "TLT", "股债相关（美股 vs 长债）", "#38bdf8"], ["SPY", "GLD", "美股 vs 黄金", "#facc15"], ["SPY", "UUP", "美股 vs 美元", "#94a3b8"], ["QQQ", "BTC", "科技股 vs 比特币", "#f59e0b"], ["CL", "HG", "原油 vs 铜", "#f472b6"], ["SPY", "HYG", "美股 vs 高收益债", "#a78bfa"]];
export function CorrDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "matrix");
  const syms = CORR_ASSETS.map(([s]) => s);
  const pack = useCloses(syms, 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const [win, setWin] = useState("63");
  const [win2, setWin2] = useState("60");
  const R = useMemo(() => Object.fromEntries(syms.map((s) => [s, rets(m[s] ?? [])])), [m]);
  const cm = (n: number) => syms.map((a) => syms.map((b) => corr(R[a].slice(-n), R[b].slice(-n))));
  const short = cm(Number(win)), long = cm(500);
  const name = Object.fromEntries(CORR_ASSETS);
  const [mode, setMode] = useState("now");
  return (
    <HubShell title="跨资产风险与相关性" code="MARS" func={func} setFunc={setFunc}
      funcs={[["matrix", "CORR", "相关矩阵"], ["roll", "RCOR", "滚动相关"], ["vol", "XVOL", "跨资产波动"], ["div", "DIVR", "分散度"]]}
      right={<span>{dates.length ? `${dates.length} 个共同交易日` : "读取日线…"}</span>}>
      {func === "matrix" && (
        <div>
          <SectionHead title="日收益相关系数" right={<span className="flex gap-2"><Seg value={mode} onChange={setMode} options={[["now", "当前"], ["diff", "较两年变化"]]} /><Seg value={win} onChange={setWin} options={[["21", "1月"], ["63", "3月"], ["126", "半年"], ["250", "1年"]]} /></span>} />
          <div className="overflow-x-auto">
            <table className="min-w-[860px] text-[10px]">
              <thead><tr><th />{syms.map((s) => <th key={s} className="px-1 py-1 text-cyan-300">{name[s]}</th>)}</tr></thead>
              <tbody>{syms.map((a, i) => <tr key={a}><td className="px-2 py-0.5 text-right text-cyan-300">{name[a]}</td>{syms.map((b, j) => { const v = mode === "now" ? short[i][j] : short[i][j] != null && long[i][j] != null ? short[i][j]! - long[i][j]! : null; return <td key={b} className="px-1 py-1 text-center font-mono" style={{ background: i === j ? "#0f1b29" : heat(v, mode === "now" ? 1 : 0.6), color: "#f1f5f9" }}>{i === j ? "" : v == null ? "—" : v.toFixed(2)}</td>; })}</tr>)}</tbody>
            </table>
          </div>
          
        </div>
      )}
      {func === "roll" && (
        <div>
          <SectionHead title="关键资产对滚动相关系数" right={<Seg value={win2} onChange={setWin2} options={[["20", "20日"], ["60", "60日"], ["120", "120日"]]} />} />
          <Lines zero series={PAIRS.map(([a, b, l, c]) => ({ name: l, color: c, values: rollingCorr(m[a] ?? [], m[b] ?? [], Number(win2)).slice(-500) }))} xLabels={dates.slice(-500).map((d) => d.slice(2))} height={280} />
          <table className="w-full text-[11px]"><tbody>{PAIRS.map(([a, b, l, c]) => { const r = rollingCorr(m[a] ?? [], m[b] ?? [], Number(win2)).filter((x): x is number => x != null); const now = r[r.length - 1]; const avg = mean(r); return <tr key={l} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5" style={{ color: c }}>{l}</td><td className="text-right font-mono text-white">{f2(now, 2)}</td><td className="text-right text-[10px] text-slate-500">两年均值 {f2(avg, 2)}</td><td className="px-2 text-right text-[10px]" style={{ color: now != null && Math.abs(now - avg) > 0.3 ? "#fbbf24" : "#64748b" }}>{now != null && Math.abs(now - avg) > 0.3 ? "显著偏离常态" : "常态区间"}</td></tr>; })}</tbody></table>
        </div>
      )}
      {func === "vol" && (
        <div>
          <SectionHead title="跨资产 20 日实现波动率（年化 %）" />
          <Lines series={[["SPY", "#f2495c"], ["TLT", "#38bdf8"], ["GLD", "#facc15"], ["CL", "#f472b6"], ["USDJPY", "#94a3b8"]].map(([s, c]) => ({ name: name[s], color: c, values: rollingVol(m[s] ?? [], 20).slice(-500) }))} xLabels={dates.slice(-500).map((d) => d.slice(2))} height={240} />
          <Bars data={syms.map((s) => ({ k: name[s], v: annVol(m[s] ?? [], 20) ?? 0, v2: annVol(m[s] ?? [], 250) ?? 0 }))} label={["20日", "1年"]} fmt={(v) => `${v.toFixed(1)}%`} height={150} />
        </div>
      )}
      {func === "div" && (() => {
        const avgCorr = (n: number, end: number) => { const vals: number[] = []; for (let i = 0; i < syms.length; i++) for (let j = i + 1; j < syms.length; j++) { const c = corr(R[syms[i]].slice(end - n, end), R[syms[j]].slice(end - n, end)); if (c != null) vals.push(c); } return vals.length ? mean(vals) : null; };
        const L = R[syms[0]]?.length ?? 0;
        const series: Array<number | null> = [];
        for (let e = Math.max(63, L - 500); e <= L; e += 5) series.push(avgCorr(63, e));
        return <div><SectionHead title="平均两两相关系数（63 日滚动）" /><Lines series={[{ name: "平均相关", color: "#fbbf24", values: series }]} height={220} /><div className="px-2 text-[11px] text-slate-300">当前：<b className="font-mono text-white">{f2(series[series.length - 1], 3)}</b>　区间最高 {f2(Math.max(...series.filter((x): x is number => x != null)), 3)}　最低 {f2(Math.min(...series.filter((x): x is number => x != null)), 3)}</div></div>;
      })()}
    </HubShell>
  );
}

/* ================================================================== 市场压力监控 */
const STRESS_SYMS = ["^VIX", "^VIX3M", "^MOVE", "HYG", "IEI", "SPY", "QQQ", "IWM", "EEM", "sh000300", "UUP", "GLD", "KRE", "BTC", "^TNX", "^IRX"];
const DD_LIST: Array<[string, string]> = [["SPY", "标普 500"], ["QQQ", "纳指 100"], ["IWM", "罗素 2000"], ["EEM", "新兴市场"], ["sh000300", "沪深 300"], ["2800.HK", "恒生指数 ETF"], ["EWJ", "日本"], ["KRE", "地区银行"], ["HYG", "高收益债"], ["TLT", "长期美债"], ["GLD", "黄金"], ["BTC", "比特币"]];
export function StressDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "gauge");
  const syms = [...new Set([...STRESS_SYMS, ...DD_LIST.map(([s]) => s)])];
  const pack = useCloses(syms, 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, ["^VIX", "^VIX3M", "^MOVE", "HYG", "IEI", "SPY", "KRE", "UUP", "^TNX", "^IRX"]), [pack.data]);
  const pct = (arr: number[], v: number) => (arr.length ? (arr.filter((x) => x <= v).length / arr.length) * 100 : null);
  const comps = useMemo(() => {
    const L = m.SPY?.length ?? 0;
    if (L < 130) return [];
    const last = (a: number[]) => a[a.length - 1];
    const hyRel = m.HYG.map((v, i) => v / m.IEI[i]);
    const hyDd = hyRel.map((_, i) => { const w = hyRel.slice(Math.max(0, i - 126), i + 1); return (hyRel[i] / Math.max(...w) - 1) * 100; });
    const spyDd = m.SPY.map((_, i) => { const w = m.SPY.slice(Math.max(0, i - 252), i + 1); return (m.SPY[i] / Math.max(...w) - 1) * 100; });
    const term = m["^VIX"].map((v, i) => v / m["^VIX3M"][i]);
    const curve = m["^TNX"].map((v, i) => v - m["^IRX"][i]);
    const bank = m.KRE.map((v, i) => v / m.SPY[i]);
    const bankDd = bank.map((_, i) => { const w = bank.slice(Math.max(0, i - 126), i + 1); return (bank[i] / Math.max(...w) - 1) * 100; });
    const usd = m.UUP.map((v, i) => (i >= 21 ? (v / m.UUP[i - 21] - 1) * 100 : 0));
    const defs: Array<[string, number[], boolean, (v: number) => string, string]> = [
      ["VIX 恐慌指数", m["^VIX"], true, (v) => v.toFixed(2), "股票隐含波动"],
      ["VIX 期限结构（VIX/VIX3M）", term, true, (v) => v.toFixed(3), "大于 1 = 倒挂"],
      ["美债波动率 MOVE", m["^MOVE"], true, (v) => v.toFixed(1), "利率不确定性"],
      ["高收益债相对国债回撤", hyDd, false, (v) => `${v.toFixed(2)}%`, "信用利差走阔"],
      ["标普距一年高点", spyDd, false, (v) => `${v.toFixed(2)}%`, "股市回撤"],
      ["地区银行相对大盘回撤", bankDd, false, (v) => `${v.toFixed(2)}%`, "银行体系压力"],
      ["美元 1 月涨幅", usd, true, (v) => `${v.toFixed(2)}%`, "美元流动性紧张"],
      ["10 年 − 3 月利差", curve, false, (v) => `${v.toFixed(2)}`, "倒挂 = 衰退预期"],
    ];
    return defs.map(([l, arr, highIsStress, fmt, note]) => { const v = last(arr); const p = pct(arr.slice(-500), v); const stress = p == null ? null : highIsStress ? p : 100 - p; return { l, v, fmt, note, p, stress, hist: arr.slice(-250) }; });
  }, [m]);
  const score = comps.length ? mean(comps.map((c) => c.stress ?? 50)) : null;
  const level = score == null ? "—" : score > 75 ? "高压" : score > 60 ? "偏紧" : score > 40 ? "中性" : "宽松";
  const lc = score == null ? "#94a3b8" : score > 75 ? "#1fbf75" : score > 60 ? "#fbbf24" : score > 40 ? "#94a3b8" : "#f2495c";
  const ddRows = DD_LIST.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const d = drawdown(c.slice(-252)); return { s, l, now: c.length ? d.now : null, max: c.length ? d.max : null, vol: annVol(c, 20), m1: perf(c, 21) }; });
  const { pick } = useHub();
  return (
    <HubShell title="风险管理 · 市场压力监控" code="RISK" func={func} setFunc={setFunc}
      funcs={[["gauge", "STRS", "压力综合指数"], ["dd", "DDWN", "回撤监控"], ["board", "RBRD", "风险指标看板"]]}
      right={score != null ? <span>综合压力 <b className="font-mono" style={{ color: lc }}>{score.toFixed(0)}</b>（{level}）</span> : <span>读取中…</span>}>
      {func === "gauge" && (
        <div>
          <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="bg-[#03070c] p-3">
              <div className="text-[11px] text-slate-400">市场压力综合指数（0–100）</div>
              <div className="font-mono text-[44px] font-bold leading-none" style={{ color: lc }}>{score == null ? "—" : score.toFixed(0)}</div>
              <div className="mt-1 text-[13px]" style={{ color: lc }}>{level}</div>
              <div className="mt-2 h-2 w-full bg-gradient-to-r from-[#f2495c] via-[#94a3b8] to-[#1fbf75]"><div className="relative h-2"><div className="absolute -top-1 h-4 w-1 bg-white" style={{ left: `${score ?? 0}%` }} /></div></div>
              <div className="mt-2 text-[10px] leading-relaxed text-slate-500">由 8 项指标在过去两年中的分位数等权合成；数值越高压力越大。所有指标随行情实时更新。数据至 {dates[dates.length - 1] ?? "—"}。</div>
            </div>
            <div className="bg-[#03070c]"><Bars data={comps.map((c) => ({ k: c.l.slice(0, 6), v: c.stress ?? 0 }))} fmt={(v) => v.toFixed(0)} height={170} /></div>
          </div>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">指标</th><th className="text-right">当前</th><th className="text-right">两年分位</th><th className="text-right">压力分</th><th className="px-2 text-left">含义</th><th className="px-2">一年走势</th></tr></thead>
            <tbody>{comps.map((c) => <tr key={c.l} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-100">{c.l}</td><td className="text-right font-mono text-white">{c.fmt(c.v)}</td><td className="text-right font-mono text-slate-300">{f2(c.p, 0, "%")}</td><td className="text-right font-mono font-semibold" style={{ color: (c.stress ?? 0) > 70 ? "#1fbf75" : (c.stress ?? 0) < 30 ? "#f2495c" : "#e2e8f0" }}>{f2(c.stress, 0)}</td><td className="px-2 text-[10px] text-slate-500">{c.note}</td><td className="px-2"><svg viewBox="0 0 100 16" className="h-4 w-28">{(() => { const h = c.hist; const lo = Math.min(...h), hi = Math.max(...h); return <polyline fill="none" stroke="#38bdf8" strokeWidth={1} points={h.map((v, i) => `${(i / Math.max(1, h.length - 1)) * 100},${16 - ((v - lo) / Math.max(1e-9, hi - lo)) * 15}`).join(" ")} />; })()}</svg></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {func === "dd" && (
        <div>
          <SectionHead title="主要资产回撤（相对一年内高点）" />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th><th className="text-right">当前回撤</th><th className="text-right">一年最大回撤</th><th className="text-right">1月</th><th className="text-right">20日波动</th><th className="px-2 text-left">回撤深度</th></tr></thead>
            <tbody>{ddRows.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{r.l}</td><td className="text-right font-mono" style={{ background: heat(r.now, 20), color: "#f1f5f9" }}>{sgn(r.now, 1)}</td><td className="text-right font-mono text-emerald-300">{sgn(r.max, 1)}</td><td className="text-right font-mono" style={{ color: toneOf(r.m1) }}>{sgn(r.m1, 1)}</td><td className="text-right font-mono text-slate-300">{f2(r.vol, 1)}</td><td className="px-2"><div className="h-2 w-40 bg-[#0f1b29]"><div className="h-2 bg-emerald-500/70" style={{ width: `${Math.min(100, Math.abs(r.now ?? 0) * 3)}%` }} /></div></td></tr>)}</tbody>
          </table>
          <SectionHead title="标普 500 一年回撤曲线（%）" />
          <Lines series={[{ name: "回撤", color: "#1fbf75", values: drawdown((m.SPY ?? []).slice(-252)).series }]} xLabels={dates.slice(-252).map((d) => d.slice(5))} height={160} fmt={(v) => v.toFixed(1)} />
        </div>
      )}
      {func === "board" && <LiveBoard rows={[["^VIX", "VIX"], ["^VIX3M", "VIX 3 个月"], ["^VVIX", "VVIX"], ["^SKEW", "尾部风险"], ["^MOVE", "美债波动率"], ["HYG", "高收益债"], ["KRE", "地区银行"], ["UUP", "美元"], ["GLD", "黄金"], ["^TNX", "10 年美债"], ["^IRX", "13 周美债"]].map(([s, l]) => ({ symbol: s, label: l, group: "风险指标" })) as BoardRow[]} />}
    </HubShell>
  );
}
