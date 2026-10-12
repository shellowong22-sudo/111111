/**
 * 风险 / 指数组（实时数据版，三）：
 * FIWS 固定收益组合工作台（债券 ETF 积木 · 经验久期 · 归因 · 优化）
 * RRG 相对旋转图（相对强度 / 动量四象限，可回放）
 * Correlation 跨资产相关性矩阵（多窗口 · 迁移 · 系统性程度）
 * LiquidityRisk 市场流动性风险（成交额 / 非流动性 / 价差估计 / 变现天数 / 流动性调整 VaR · 融资市场流动性）
 * 全部基于实时行情与真实日线计算；组合与观察名单永久保存在平台数据库。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useKline, useTick, useTicks, UP, DOWN } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, covMatrix, drawdown, f2, heat, mean, minVariance, perf, portVol, rets, riskParity, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { usePositions } from "@/uc/trade/kit";
import { Note, ROW, TD, TDL, TH, THL, yld, type P } from "./MacroXLive";

const INP = "border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white";
const BTN = "border border-[#1d3047] px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-[#0a1726]";
const weekday = (d: string) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; };

/* ================================================================== FIWS 固定收益组合工作台 */
const BLOCKS: Array<[string, string, string]> = [
  ["SHY", "1–3 年美国国债", "短久期利率"], ["IEI", "3–7 年美国国债", "中久期利率"], ["IEF", "7–10 年美国国债", "中长久期利率"], ["TLT", "20 年以上美国国债", "长久期利率"],
  ["TIP", "通胀保值国债", "实际利率"], ["MBB", "机构抵押债", "抵押证券"], ["LQD", "投资级公司债", "信用票息"], ["HYG", "高收益公司债", "信用下沉"],
  ["EMB", "新兴市场美元债", "跨境主权"], ["BNDX", "国际债（美元对冲）", "跨境久期"],
];
const DEF_W: Record<string, number> = { SHY: 20, IEF: 20, TLT: 10, LQD: 20, HYG: 15, EMB: 15 };
export function MacroFIWS({ onClose }: P) {
  const [tab, setTab] = useState("build");
  const saved = useSaved<Record<string, number>>("fiws");
  const [w, setW] = useState<Record<string, number> | null>(null);
  useEffect(() => { if (!saved.loading && w == null) setW(saved.data ?? DEF_W); }, [saved.loading]);
  const weights = w ?? DEF_W;
  const persist = (next: Record<string, number>) => { setW(next); void saveItem("fiws", next); };
  const syms = [...BLOCKS.map((b) => b[0]), "^TNX", "SPY"];
  const pack = useCloses(syms, 800);
  const t = useTicks(BLOCKS.map((b) => b[0]));
  const { pick } = useHub();
  const d = useMemo(() => {
    const a = align(pack.data ?? null, syms);
    const r: Record<string, number[]> = {};
    for (const s of BLOCKS.map((b) => b[0])) r[s] = (a.m[s] ?? []).slice(1).map((v, i) => (v / a.m[s][i] - 1) * 100);
    const dy = (a.m["^TNX"] ?? []).slice(1).map((v, i) => (yld(v) ?? 0) - (yld(a.m["^TNX"][i]) ?? 0));
    const spy = (a.m.SPY ?? []).slice(1).map((v, i) => (v / a.m.SPY[i] - 1) * 100);
    return { dates: a.dates, lv: a.m, r, dy, spy };
  }, [pack.data]);
  const N = 250;
  const beta = (x: number[], f: number[], n = N) => { const xs = x.slice(-n), fs = f.slice(-n); const k = Math.min(xs.length, fs.length); if (k < 30) return null; const mx = mean(xs.slice(-k)), mf = mean(fs.slice(-k)); let c = 0, v = 0; for (let i = 0; i < k; i++) { const a = xs[xs.length - k + i] - mx, b = fs[fs.length - k + i] - mf; c += a * b; v += b * b; } return v ? c / v : null; };
  const tot = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const wn = BLOCKS.map(([s]) => (weights[s] ?? 0) / tot);
  const port = useMemo(() => { const n = d.dates.length - 1; return Array.from({ length: Math.max(0, n) }, (_, i) => BLOCKS.reduce((acc, [s], j) => acc + wn[j] * (d.r[s]?.[i] ?? 0), 0)); }, [d, weights]);
  const nav = useMemo(() => { let v = 100; return port.map((x) => (v *= 1 + x / 100)); }, [port]);
  const stats = BLOCKS.map(([s, l, k], j) => {
    const c = d.lv[s] ?? [];
    const dur = beta(d.r[s] ?? [], d.dy);
    return { s, l, k, j, w: wn[j], y1: perf(c, 252), vol: annVol(c, 252), dur: dur != null ? -dur : null, eqb: beta(d.r[s] ?? [], d.spy), dd: c.length ? drawdown(c.slice(-252)).max : null };
  });
  const pDur = stats.reduce((a, x) => a + x.w * (x.dur ?? 0), 0);
  const pEq = stats.reduce((a, x) => a + x.w * (x.eqb ?? 0), 0);
  const pVol = port.length > 30 ? std(port.slice(-N)) * Math.sqrt(252) : null;
  const sorted = [...port.slice(-N)].sort((a, b) => a - b);
  const var95 = sorted.length > 50 ? -sorted[Math.floor(sorted.length * 0.05)] : null;
  const cov = useMemo(() => covMatrix(BLOCKS.map(([s]) => (d.r[s] ?? []).slice(-N).map((x) => x / 100))), [d]);
  const opt = useMemo(() => (cov.length && (d.r.SHY?.length ?? 0) > 60 ? { mv: minVariance(cov), rp: riskParity(cov) } : null), [cov]);
  const [per, setPer] = useState<"21" | "63" | "252">("63");
  const P = Number(per);
  const attr = useMemo(() => {
    if (port.length < P) return null;
    const total = (nav[nav.length - 1] / nav[nav.length - 1 - P] - 1) * 100;
    const dyP = d.dy.slice(-P).reduce((a, b) => a + b, 0);
    const spyP = d.spy.slice(-P).reduce((a, b) => a + b, 0);
    const rate = -pDur * dyP;
    const credit = pEq * spyP;
    const blocks = BLOCKS.map(([s, l], j) => ({ s, l, c: wn[j] * (d.r[s] ?? []).slice(-P).reduce((a, b) => a + b, 0) })).filter((x) => x.c !== 0);
    return { total, dyP, rate, credit, other: total - rate - credit, blocks };
  }, [port, nav, d, P, pDur, pEq]);
  const optRow = (name: string, ws: number[] | null) => {
    if (!ws) return null;
    const r = (d.r.SHY ?? []).slice(-N).map((_, i) => BLOCKS.reduce((a, [s], j) => a + ws[j] * ((d.r[s] ?? []).slice(-N)[i] ?? 0), 0));
    const cum = r.reduce((a, x) => a * (1 + x / 100), 1);
    return { name, ws, vol: portVol(ws, cov), ret: (cum - 1) * 100, dur: ws.reduce((a, x, j) => a + x * (stats[j].dur ?? 0), 0) };
  };
  const opts = [optRow("当前组合", wn), optRow("最小方差", opt?.mv ?? null), optRow("风险平价", opt?.rp ?? null), optRow("等权", BLOCKS.map(() => 1 / BLOCKS.length))].filter(Boolean) as Array<{ name: string; ws: number[]; vol: number; ret: number; dur: number }>;
  return (
    <PanelShell code="FIWS" title="固定收益组合工作台" onClose={onClose} tabs={[["build", "组合构建"], ["risk", "风险指标"], ["attr", "业绩归因"], ["opt", "组合优化"]]} tab={tab} setTab={setTab} right={<span>权重永久保存</span>}>
      <Kpis items={[["组合经验久期", f2(pDur, 2, " 年"), "对 10 年期收益率回归"], ["组合年化波动", f2(pVol, 2, "%")], ["1 年收益", nav.length > 252 ? sgn((nav[nav.length - 1] / nav[nav.length - 253] - 1) * 100, 2) : "—"], ["日 VaR 95%", var95 != null ? `${var95.toFixed(2)}%` : "—", "历史模拟，近 250 日"]]} />
      {tab === "build" && <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>积木</th><th className={THL}>风险暴露</th><th className={TH}>权重</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>1 年</th><th className={TH}>年化波动</th><th className={TH}>经验久期</th><th className={TH}>股票贝塔</th><th className={TH}>1 年最大回撤</th></tr></thead>
          <tbody>{stats.map((x) => (
            <tr key={x.s} className={ROW}>
              <td className={`${TDL} cursor-pointer`} onClick={() => pick(x.s)}><span className="text-slate-100">{x.l}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{x.s}</span></td>
              <td className={`${TDL} text-[10px] text-slate-500`}>{x.k}</td>
              <td className="px-2 text-right"><input type="number" min={0} max={100} value={weights[x.s] ?? 0} onChange={(e) => persist({ ...weights, [x.s]: Math.max(0, Number(e.target.value) || 0) })} className={`${INP} w-14 text-right`} /></td>
              <td className={`${TD} text-white`}>{fmtPrice(t[x.s]?.price)}</td>
              <td className={TD} style={{ color: toneOf(t[x.s]?.changePct) }}>{fmtPct(t[x.s]?.changePct)}</td>
              <td className={TD} style={{ color: toneOf(x.y1) }}>{sgn(x.y1, 2)}</td>
              <td className={`${TD} text-slate-300`}>{f2(x.vol, 2)}</td>
              <td className={`${TD} text-cyan-200`}>{f2(x.dur, 2)}</td>
              <td className={`${TD} text-slate-300`}>{f2(x.eqb, 2)}</td>
              <td className={`${TD} text-emerald-300`}>{sgn(x.dd, 1)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500">权重合计 {tot}（按比例归一）<button type="button" onClick={() => persist(DEF_W)} className={BTN}>恢复默认</button></div>
        <SectionHead title="组合净值（起点 100，按每日再平衡）" />
        {nav.length ? <Lines series={[{ name: "组合", color: "#fbbf24", values: nav }]} xLabels={d.dates.slice(1).map((x) => x.slice(2))} height={170} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} />}
        <Note>经验久期 = −（积木日收益 % 对 10 年期国债收益率日变动的回归系数），近 250 日估计；反映对长端利率的实际敏感度，短端积木会因曲线非平行移动而偏低。</Note>
      </>}
      {tab === "risk" && <>
        <SectionHead title="情景冲击（瞬时，按经验敏感度线性估计）" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>情景</th><th className={TH}>组合影响</th>{stats.filter((x) => x.w > 0).map((x) => <th key={x.s} className={TH}>{x.s}</th>)}</tr></thead>
          <tbody>{([["10 年期收益率 +100bp", 1, 0], ["10 年期收益率 +50bp", 0.5, 0], ["10 年期收益率 −50bp", -0.5, 0], ["10 年期收益率 −100bp", -1, 0], ["股市 −10%", 0, -10], ["滞胀：利率 +50bp 且股市 −10%", 0.5, -10]] as Array<[string, number, number]>).map(([l, dy, eq]) => {
            const imp = (x: (typeof stats)[number]) => -(x.dur ?? 0) * dy + (x.eqb ?? 0) * eq;
            const p = stats.reduce((a, x) => a + x.w * imp(x), 0);
            return <tr key={l} className={ROW}><td className={`${TDL} text-slate-200`}>{l}</td><td className={`${TD} font-semibold`} style={{ color: toneOf(p) }}>{sgn(p, 2)}</td>{stats.filter((x) => x.w > 0).map((x) => <td key={x.s} className={TD} style={{ color: toneOf(imp(x)) }}>{sgn(imp(x), 2)}</td>)}</tr>;
          })}</tbody>
        </table>
        <SectionHead title="积木日收益相关（近 250 日）" />
        <table className="w-full text-[10px]"><thead className="text-slate-500"><tr><th className={THL} />{BLOCKS.map(([s]) => <th key={s} className={TH}>{s}</th>)}</tr></thead>
          <tbody>{BLOCKS.map(([a]) => <tr key={a} className="border-t border-[#0f1b29]"><td className={`${TDL} font-mono text-slate-400`}>{a}</td>{BLOCKS.map(([b]) => { const c = corr((d.r[a] ?? []).slice(-N), (d.r[b] ?? []).slice(-N)); return <td key={b} className="px-1 text-center font-mono text-white" style={{ background: heat(c, 1) }}>{f2(c, 2)}</td>; })}</tr>)}</tbody></table>
        <SectionHead title="组合回撤" />
        {nav.length ? <Lines series={[{ name: "回撤 %", color: DOWN, values: drawdown(nav.slice(-504)).series }]} height={120} fmt={(v) => v.toFixed(1)} /> : null}
      </>}
      {tab === "attr" && <>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500">区间<Seg value={per} onChange={setPer} options={[["21", "1 月"], ["63", "3 月"], ["252", "1 年"]]} /></div>
        {attr ? <>
          <Kpis items={[["组合收益", sgn(attr.total, 2)], ["利率贡献", sgn(attr.rate, 2), `10 年期变动 ${sgn(attr.dyP * 100, 0, "bp")}`], ["信用 / 风险偏好贡献", sgn(attr.credit, 2), "股票贝塔 × 股市收益"], ["票息与其他", sgn(attr.other, 2), "残差：持有收益、曲线形态、特质"]]} />
          <Bars data={[{ k: "利率", v: attr.rate }, { k: "信用/风险偏好", v: attr.credit }, { k: "票息与其他", v: attr.other }]} fmt={(v) => `${v.toFixed(2)}%`} height={110} />
          <SectionHead title="按积木的收益贡献（%）" />
          <Bars data={attr.blocks.map((x) => ({ k: x.s, v: x.c }))} fmt={(v) => `${v.toFixed(2)}%`} height={120} />
        </> : <Empty loading={pack.loading} text="样本不足" />}
      </>}
      {tab === "opt" && <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>方案</th>{BLOCKS.map(([s]) => <th key={s} className={TH}>{s}</th>)}<th className={TH}>年化波动</th><th className={TH}>近 1 年收益</th><th className={TH}>经验久期</th><th className={TH} /></tr></thead>
          <tbody>{opts.map((o) => <tr key={o.name} className={ROW}><td className={`${TDL} text-slate-100`}>{o.name}</td>{o.ws.map((x, j) => <td key={j} className={`${TD} text-slate-300`}>{x > 0.0005 ? (x * 100).toFixed(1) : "—"}</td>)}<td className={`${TD} text-white`}>{f2(o.vol, 2)}</td><td className={TD} style={{ color: toneOf(o.ret) }}>{sgn(o.ret, 2)}</td><td className={`${TD} text-cyan-200`}>{f2(o.dur, 2)}</td><td className="px-2 text-right">{o.name !== "当前组合" && <button type="button" onClick={() => persist(Object.fromEntries(BLOCKS.map(([s], j) => [s, Math.round(o.ws[j] * 1000) / 10])))} className={BTN}>采用</button>}</td></tr>)}</tbody>
        </table>
        {!opt && <Empty loading={pack.loading} />}
        <Note>优化基于近 250 日日收益协方差，只做多、权重合计 100%；近 1 年收益为该权重的回溯表现，不代表未来。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== RRG 相对旋转图 */
const UNIV: Record<string, { name: string; bench: [string, string]; items: Array<[string, string]> }> = {
  us: { name: "美股行业", bench: ["SPY", "标普 500"], items: [["XLK", "科技"], ["XLF", "金融"], ["XLE", "能源"], ["XLV", "医疗"], ["XLI", "工业"], ["XLY", "可选消费"], ["XLP", "必需消费"], ["XLU", "公用事业"], ["XLB", "原材料"], ["XLRE", "地产"], ["XLC", "通信"]] },
  cn: { name: "A股行业", bench: ["sh000300", "沪深 300"], items: [["sh512880", "证券"], ["sh512800", "银行"], ["sh512170", "医疗"], ["sh512480", "半导体"], ["sh515790", "光伏"], ["sh512690", "白酒"], ["sh515220", "煤炭"], ["sh512400", "有色"], ["sh512660", "军工"], ["sh515050", "通信"], ["sh512200", "地产"], ["sz159928", "消费"]] },
  world: { name: "全球国家", bench: ["ACWI", "全球股票"], items: [["SPY", "美国"], ["EWJ", "日本"], ["EWG", "德国"], ["EWU", "英国"], ["EWQ", "法国"], ["MCHI", "中国"], ["INDA", "印度"], ["EWZ", "巴西"], ["EWY", "韩国"], ["EWT", "中国台湾"], ["EWA", "澳大利亚"], ["EWC", "加拿大"]] },
  asset: { name: "大类资产", bench: ["ACWI", "全球股票"], items: [["TLT", "美长债"], ["GLD", "黄金"], ["USO", "原油"], ["UUP", "美元"], ["EEM", "新兴市场"], ["IWM", "美小盘"], ["QQQ", "纳指"], ["HYG", "高收益债"], ["DBC", "商品"], ["VNQ", "美房地产"]] },
};
const QUAD = (x: number, y: number) => (x >= 100 ? (y >= 100 ? "领先" : "转弱") : y >= 100 ? "改善" : "落后");
const QCOL: Record<string, string> = { 领先: UP, 转弱: "#f59e0b", 落后: DOWN, 改善: "#38bdf8" };
const PAL = ["#f472b6", "#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#fb923c", "#22d3ee", "#e879f9", "#facc15", "#60a5fa", "#4ade80", "#f87171"];
export function MacroRRG({ onClose }: P) {
  const [u, setU] = useState("us");
  const [tailN, setTailN] = useState<"4" | "8" | "12">("8");
  const [back, setBack] = useState(0);
  const [play, setPlay] = useState(false);
  const U = UNIV[u];
  const syms = [U.bench[0], ...U.items.map((x) => x[0])];
  const pack = useCloses(syms, 900);
  const t = useTicks(syms);
  const { pick } = useHub();
  const W = 10, M = 4;
  const series = useMemo(() => {
    const a = align(pack.data ?? null, syms);
    const n = a.dates.length;
    const idx: number[] = [];
    for (let i = n - 1; i >= 0; i -= 5) idx.unshift(i);
    const wd = idx.map((i) => a.dates[i]);
    const out = U.items.map(([s, l]) => {
      const rs = idx.map((i) => (a.m[s][i] / a.m[U.bench[0]][i]) * 100);
      const rsr = rs.map((v, i) => (i >= W - 1 ? (100 * v) / mean(rs.slice(i - W + 1, i + 1)) : null));
      const rsm = rsr.map((v, i) => (v != null && i >= M && rsr[i - M] != null ? (100 * v) / rsr[i - M]! : null));
      return { s, l, rsr, rsm, rs };
    });
    return { wd, out };
  }, [pack.data, u]);
  const L = series.wd.length;
  const maxBack = Math.max(0, L - W - M - Number(tailN) - 1);
  useEffect(() => { if (!play) return; const id = setInterval(() => setBack((b) => (b <= 0 ? maxBack : b - 1)), 700); return () => clearInterval(id); }, [play, maxBack]);
  useEffect(() => { setBack(0); setPlay(false); }, [u]);
  const end = L - 1 - Math.min(back, maxBack);
  const T = Number(tailN);
  const pts = series.out.map((o, k) => ({ ...o, k, tail: Array.from({ length: T + 1 }, (_, j) => end - T + j).filter((i) => i >= 0).map((i) => ({ x: o.rsr[i], y: o.rsm[i] })).filter((p): p is { x: number; y: number } => p.x != null && p.y != null) }));
  const all = pts.flatMap((p) => p.tail);
  const span = Math.max(1.5, ...all.map((p) => Math.max(Math.abs(p.x - 100), Math.abs(p.y - 100)))) * 1.1;
  const S = 420;
  const sx = (x: number) => ((x - (100 - span)) / (2 * span)) * S;
  const sy = (y: number) => S - ((y - (100 - span)) / (2 * span)) * S;
  return (
    <PanelShell code="RRG" title="相对旋转图" onClose={onClose} right={<span>基准：{U.bench[1]}</span>}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[10px] text-slate-500">
        <Seg value={u} onChange={setU} options={Object.entries(UNIV).map(([k, v]) => [k, v.name] as [string, string])} />
        尾迹<Seg value={tailN} onChange={setTailN} options={[["4", "4 周"], ["8", "8 周"], ["12", "12 周"]]} />
        <button type="button" onClick={() => setPlay((p) => !p)} className={BTN}>{play ? "❚❚ 暂停回放" : "▶ 历史回放"}</button>
        <input type="range" min={0} max={maxBack} value={Math.min(back, maxBack)} onChange={(e) => { setPlay(false); setBack(Number(e.target.value)); }} className="w-40" />
        <span className="font-mono text-slate-300">截至 {series.wd[end] ?? "—"}</span>
      </div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c] p-2">
          {all.length ? (
            <svg viewBox={`-30 -10 ${S + 40} ${S + 40}`} className="w-full" style={{ maxHeight: 480 }}>
              <rect x={sx(100)} y={0} width={S - sx(100)} height={sy(100)} fill="rgba(242,73,92,0.06)" />
              <rect x={sx(100)} y={sy(100)} width={S - sx(100)} height={S - sy(100)} fill="rgba(245,158,11,0.06)" />
              <rect x={0} y={sy(100)} width={sx(100)} height={S - sy(100)} fill="rgba(31,191,117,0.06)" />
              <rect x={0} y={0} width={sx(100)} height={sy(100)} fill="rgba(56,189,248,0.06)" />
              <line x1={sx(100)} x2={sx(100)} y1={0} y2={S} stroke="#334155" /><line x1={0} x2={S} y1={sy(100)} y2={sy(100)} stroke="#334155" />
              <text x={S - 4} y={12} textAnchor="end" fontSize={11} fill={UP}>领先</text><text x={S - 4} y={S - 4} textAnchor="end" fontSize={11} fill="#f59e0b">转弱</text>
              <text x={4} y={S - 4} fontSize={11} fill={DOWN}>落后</text><text x={4} y={12} fontSize={11} fill="#38bdf8">改善</text>
              <text x={S / 2} y={S + 24} textAnchor="middle" fontSize={10} fill="#64748b">相对强度比率 →</text>
              <text x={-18} y={S / 2} textAnchor="middle" fontSize={10} fill="#64748b" transform={`rotate(-90 -18 ${S / 2})`}>相对强度动量 →</text>
              {pts.map((p) => { const c = PAL[p.k % PAL.length]; const h = p.tail[p.tail.length - 1]; if (!h) return null; return (
                <g key={p.s} className="cursor-pointer" onClick={() => pick(p.s)}>
                  <polyline points={p.tail.map((q) => `${sx(q.x)},${sy(q.y)}`).join(" ")} fill="none" stroke={c} strokeWidth={1.3} opacity={0.75} />
                  {p.tail.slice(0, -1).map((q, i) => <circle key={i} cx={sx(q.x)} cy={sy(q.y)} r={1.8} fill={c} opacity={0.5} />)}
                  <circle cx={sx(h.x)} cy={sy(h.y)} r={4.5} fill={c} stroke="#03070c" />
                  <text x={sx(h.x) + 6} y={sy(h.y) - 5} fontSize={10} fill={c}>{p.l}</text>
                </g>
              ); })}
            </svg>
          ) : <Empty loading={pack.loading} />}
        </div>
        <div className="bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>名称</th><th className={THL}>象限</th><th className={TH}>强度比率</th><th className={TH}>动量</th><th className={TH}>4 周相对</th><th className={TH}>13 周相对</th><th className={TH}>今日</th></tr></thead>
            <tbody>{pts.map((p) => { const h = p.tail[p.tail.length - 1]; const q = h ? QUAD(h.x, h.y) : "—"; const rel = (n: number) => (end - n >= 0 && p.rs[end - n] ? (p.rs[end] / p.rs[end - n] - 1) * 100 : null); return (
              <tr key={p.s} onClick={() => pick(p.s)} className={`${ROW} cursor-pointer`}>
                <td className={TDL}><span className="mr-1 inline-block h-2 w-2" style={{ background: PAL[p.k % PAL.length] }} /><span className="text-slate-100">{p.l}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{p.s}</span></td>
                <td className={`${TDL} font-semibold`} style={{ color: QCOL[q] ?? "#64748b" }}>{q}</td>
                <td className={`${TD} text-white`}>{f2(h?.x, 2)}</td><td className={`${TD} text-slate-300`}>{f2(h?.y, 2)}</td>
                <td className={TD} style={{ color: toneOf(rel(4)) }}>{sgn(rel(4), 2)}</td><td className={TD} style={{ color: toneOf(rel(13)) }}>{sgn(rel(13), 2)}</td>
                <td className={TD} style={{ color: toneOf(t[p.s]?.changePct) }}>{fmtPct(t[p.s]?.changePct)}</td>
              </tr>
            ); })}</tbody>
          </table>
          <Note>周频（每 5 个交易日取样）。相对强度 = 标的 ÷ 基准；强度比率 = 100 × 相对强度 ÷ 其 10 周均值；动量 = 100 × 强度比率 ÷ 4 周前强度比率。典型轮动方向为 改善 → 领先 → 转弱 → 落后（顺时针）。</Note>
        </div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== 跨资产相关性矩阵 */
const CA: Array<[string, string]> = [["^GSPC", "标普500"], ["^NDX", "纳指100"], ["^STOXX50E", "欧洲50"], ["^N225", "日经225"], ["sh000300", "沪深300"], ["^HSI", "恒生"], ["TLT", "美长债"], ["HYG", "高收益债"], ["GC", "黄金"], ["CL", "原油"], ["HG", "铜"], ["DXY", "美元"], ["USDJPY", "美元日元"], ["USDCNH", "美元人民币"], ["BTC", "比特币"], ["^VIX", "VIX"]];
function eigShare(m: number[][]) {
  const n = m.length;
  if (!n) return null;
  let v = new Array(n).fill(1 / Math.sqrt(n));
  let lam = 0;
  for (let it = 0; it < 100; it++) {
    const w = m.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
    const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
    lam = norm;
    v = w.map((x) => x / norm);
  }
  return (lam / n) * 100;
}
export function MacroCorrelation() {
  const [win, setWin] = useState<"30" | "90" | "252">("90");
  const [pair, setPair] = useState<[number, number]>([0, 6]);
  const [rw, setRw] = useState<"20" | "60">("60");
  const syms = CA.map((x) => x[0]);
  const pack = useCloses(syms, 800);
  const R = useMemo(() => {
    const a = align(pack.data ?? null, syms);
    const keep = a.dates.map((d, i) => ({ d, i })).filter((x) => weekday(x.d));
    const lv = syms.map((s) => keep.map((x) => a.m[s][x.i]));
    return { dates: keep.map((x) => x.d), r: lv.map((c) => rets(c)) };
  }, [pack.data]);
  const W = Number(win);
  const mat = (w: number, endOff = 0) => R.r.map((x) => R.r.map((y) => { const e = x.length - endOff; return corr(x.slice(Math.max(0, e - w), e), y.slice(Math.max(0, e - w), e)) ?? 0; }));
  const M = useMemo(() => mat(W), [R, W]);
  const M30 = useMemo(() => mat(30), [R]);
  const M252 = useMemo(() => mat(252), [R]);
  const n = CA.length;
  const pairs: Array<{ i: number; j: number; now: number; long: number; d: number }> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push({ i, j, now: M30[i][j], long: M252[i][j], d: M30[i][j] - M252[i][j] });
  pairs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const avgAbs = (m: number[][]) => { let s = 0, k = 0; for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) { s += Math.abs(m[i][j]); k++; } return k ? s / k : null; };
  const sysLine = useMemo(() => {
    const len = R.r[0]?.length ?? 0;
    const out: Array<{ d: string; v: number | null }> = [];
    for (let off = Math.min(len - 60, 500); off >= 0; off -= 5) { const m = mat(60, off); out.push({ d: R.dates[R.dates.length - 1 - off] ?? "", v: eigShare(m) }); }
    return out;
  }, [R]);
  const rwN = Number(rw);
  const roll = useMemo(() => { const a = R.r[pair[0]] ?? [], b = R.r[pair[1]] ?? []; return a.map((_, i) => (i + 1 >= rwN ? corr(a.slice(i + 1 - rwN, i + 1), b.slice(i + 1 - rwN, i + 1)) : null)); }, [R, pair, rwN]);
  const sd = R.r.map((x) => std(x.slice(-W)));
  const ewVol = (() => { const cov = covMatrix(R.r.map((x) => x.slice(-W))); return cov.length ? portVol(CA.map(() => 1 / n), cov) / 100 / Math.sqrt(252) : null; })();
  const divRatio = ewVol ? sd.reduce((a, b) => a + b / n, 0) / ewVol : null;
  return (
    <PanelShell code="CORR" title="跨资产相关性矩阵">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[10px] text-slate-500">窗口<Seg value={win} onChange={setWin} options={[["30", "30 日"], ["90", "90 日"], ["252", "252 日"]]} /><span>日对数收益相关；点击单元格查看该资产对的滚动相关</span></div>
      <Kpis items={[["平均绝对相关", f2(avgAbs(M), 3), `${W} 日`], ["第一主成分解释度", f2(eigShare(M), 1, "%"), "越高代表资产越同涨同跌"], ["等权分散化比率", f2(divRatio, 2), "越高代表分散化效果越好"], ["相关迁移最大", pairs[0] ? `${CA[pairs[0].i][1]}–${CA[pairs[0].j][1]}` : "—", pairs[0] ? `30 日 − 252 日 ${sgn(pairs[0].d, 2, "")}` : undefined]]} />
      {R.dates.length ? (
        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <thead><tr><th />{CA.map(([, l]) => <th key={l} className="px-1 py-1 font-normal text-slate-500" style={{ writingMode: "vertical-rl" }}>{l}</th>)}</tr></thead>
            <tbody>{CA.map(([, l], i) => <tr key={l}><td className="whitespace-nowrap px-2 text-right text-slate-300">{l}</td>{CA.map((_, j) => <td key={j} onClick={() => i !== j && setPair([i, j])} className={`h-6 w-11 cursor-pointer text-center font-mono text-white ${pair[0] === i && pair[1] === j ? "outline outline-1 outline-cyan-300" : ""}`} style={{ background: i === j ? "#0f1b29" : heat(M[i][j], 1) }}>{i === j ? "" : M[i][j].toFixed(2)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <Empty loading={pack.loading} />}
      <SectionHead title={`${CA[pair[0]][1]} vs ${CA[pair[1]][1]}：滚动相关`} right={<Seg value={rw} onChange={setRw} options={[["20", "20 日"], ["60", "60 日"]]} />} />
      {R.dates.length ? <Lines series={[{ name: "滚动相关", color: "#fbbf24", values: roll }]} xLabels={R.dates.slice(1).map((d) => d.slice(2))} height={150} fmt={(v) => v.toFixed(2)} zero /> : null}
      <SectionHead title="系统性程度（60 日窗口第一主成分解释度，%）" sub="上升意味着分散化失效、风险集中" />
      {sysLine.length ? <Lines series={[{ name: "第一主成分", color: "#f472b6", values: sysLine.map((x) => x.v) }]} xLabels={sysLine.map((x) => x.d.slice(2))} height={130} fmt={(v) => v.toFixed(0)} /> : null}
      <SectionHead title="相关性迁移最大的资产对（30 日 vs 252 日）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>资产对</th><th className={TH}>30 日</th><th className={TH}>252 日</th><th className={TH}>变化</th></tr></thead>
        <tbody>{pairs.slice(0, 12).map((p) => <tr key={`${p.i}-${p.j}`} onClick={() => setPair([p.i, p.j])} className={`${ROW} cursor-pointer`}><td className={`${TDL} text-slate-200`}>{CA[p.i][1]} – {CA[p.j][1]}</td><td className={TD} style={{ background: heat(p.now, 1) }}>{p.now.toFixed(2)}</td><td className={TD} style={{ background: heat(p.long, 1) }}>{p.long.toFixed(2)}</td><td className={TD} style={{ color: toneOf(p.d) }}>{sgn(p.d, 2, "")}</td></tr>)}</tbody></table>
    </PanelShell>
  );
}

/* ================================================================== 市场流动性风险 */
type LiqM = { adv: number | null; amihud: number | null; range: number | null; cs: number | null; dtl: number | null; lvar: number | null; value: number };
const DEF_WATCH = ["SPY", "QQQ", "IWM", "HYG", "LQD", "EMB", "TLT", "AAPL", "NVDA", "sh510300", "sh600519", "0700.HK"];
function LiqRow({ symbol, value, part, held, onM, onPick, onSel, sel, onRemove }: { symbol: string; value: number; part: number; held: boolean; onM: (s: string, m: LiqM) => void; onPick: (s: string) => void; onSel: (s: string) => void; sel: boolean; onRemove?: () => void }) {
  const k = useKline(symbol, "1d", 130);
  const t = useTick(symbol);
  const m = useMemo<LiqM>(() => {
    const c = k.candles.filter((x) => x.c > 0 && x.h > 0 && x.l > 0);
    if (c.length < 25) return { adv: null, amihud: null, range: null, cs: null, dtl: null, lvar: null, value };
    let f = /^(sh|sz|bj)\d{6}$/i.test(symbol) ? 100 : 1;
    const last = c[c.length - 1];
    if (t?.amount && t.time && last.v && new Date(t.time).toDateString() === new Date(last.t).toDateString()) {
      const r = t.amount / (last.v * last.c);
      if (r > 0) f = Math.pow(10, Math.round(Math.log10(r)));
    }
    const amt = c.map((x) => (x.v ?? 0) * x.c * f);
    const adv = mean(amt.slice(-20));
    const r = c.slice(1).map((x, i) => Math.log(x.c / c[i].c));
    const ami = r.slice(-60).map((x, i) => { const a = amt.slice(-60)[i]; return a > 0 ? Math.abs(x) * 100 / (a / 1e8) : null; }).filter((x): x is number => x != null);
    const range = mean(c.slice(-20).map((x) => (x.h - x.l) / x.c)) * 100;
    const k2 = 3 - 2 * Math.SQRT2;
    const css: number[] = [];
    for (let i = c.length - 20; i < c.length; i++) {
      if (i < 1) continue;
      const a = c[i - 1], b = c[i];
      const beta = Math.log(a.h / a.l) ** 2 + Math.log(b.h / b.l) ** 2;
      const gamma = Math.log(Math.max(a.h, b.h) / Math.min(a.l, b.l)) ** 2;
      const alpha = (Math.sqrt(2 * beta) - Math.sqrt(beta)) / k2 - Math.sqrt(gamma / k2);
      css.push(Math.max(0, (2 * (Math.exp(alpha) - 1)) / (1 + Math.exp(alpha))));
    }
    const cs = mean(css) * 1e4;
    const sd = std(r.slice(-60));
    const lvar = (2.326 * sd + (cs / 1e4) / 2) * 100;
    return { adv: adv || null, amihud: ami.length ? mean(ami) : null, range, cs, dtl: adv ? value / (adv * part) : null, lvar, value };
  }, [k.candles, t?.amount, value, part]);
  useEffect(() => { onM(symbol, m); }, [m]);
  return (
    <tr onClick={() => onSel(symbol)} className={`${ROW} cursor-pointer ${sel ? "bg-[#0d2236]" : ""}`}>
      <td className={TDL}><span className="text-slate-100" onDoubleClick={() => onPick(symbol)}>{t?.name ?? symbol}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{symbol}</span>{held && <span className="ml-1 border border-cyan-800 px-0.5 text-[9px] text-cyan-300">持仓</span>}</td>
      <td className={`${TD} text-white`}>{fmtPrice(t?.price)}</td>
      <td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td>
      <td className={`${TD} text-slate-200`}>{fmtCompact(m.adv)}</td>
      <td className={TD}>{m.adv && t?.amount ? <span style={{ color: t.amount / m.adv > 1.5 ? UP : "#cbd5e1" }}>{(t.amount / m.adv).toFixed(2)}×</span> : "—"}</td>
      <td className={`${TD} text-slate-300`}>{m.amihud != null ? m.amihud.toPrecision(3) : "—"}</td>
      <td className={`${TD} text-slate-300`}>{f2(m.range, 2)}</td>
      <td className={`${TD} text-amber-200`}>{f2(m.cs, 1)}</td>
      <td className={`${TD} text-slate-200`}>{fmtCompact(value)}</td>
      <td className={TD} style={{ color: m.dtl == null ? "#64748b" : m.dtl > 1 ? DOWN : "#cbd5e1" }}>{m.dtl == null ? "—" : m.dtl < 0.01 ? "<0.01" : m.dtl.toFixed(2)}</td>
      <td className={`${TD} text-white`}>{f2(m.lvar, 2)}</td>
      <td className="px-2 text-right">{onRemove && <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-[10px] text-slate-500 hover:text-red-300">移除</button>}</td>
    </tr>
  );
}
type Depth = { levels: number; last: number; bids: Array<{ px: number; qty: number }>; asks: Array<{ px: number; qty: number }> };
type MMRow = { d: string; v: number; vol: number | null; p1: number | null; p99: number | null };
export function MacroLiquidity() {
  const [tab, setTab] = useState("mkt");
  const pos = usePositions();
  const saved = useSaved<string[]>("liqwatch");
  const [watch, setWatch] = useState<string[] | null>(null);
  useEffect(() => { if (!saved.loading && watch == null) setWatch(saved.data ?? DEF_WATCH); }, [saved.loading]);
  const wl = watch ?? DEF_WATCH;
  const persist = (n: string[]) => { setWatch(n); void saveItem("liqwatch", n); };
  const [size, setSize] = useState(1_000_000);
  const [part, setPart] = useState(20);
  const [add, setAdd] = useState("");
  const held = (pos.data?.rows ?? []).filter((r) => r.qty !== 0);
  const heldSyms = held.map((r) => r.symbol);
  const rows = [...heldSyms, ...wl.filter((s) => !heldSyms.includes(s))];
  const [mets, setMets] = useState<Record<string, LiqM>>({});
  const onM = useMemo(() => (s: string, m: LiqM) => setMets((x) => ({ ...x, [s]: m })), []);
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel ?? rows[0] ?? null;
  const dp = usePolled<Depth>("ucMarket.depth", cur && tab === "mkt" ? { symbol: cur } : null, 5000);
  const bid = dp.data?.bids[0]?.px, ask = dp.data?.asks[0]?.px;
  const qs = bid && ask ? ((ask - bid) / ((ask + bid) / 2)) * 1e4 : null;
  const { pick } = useHub();
  const mm = usePolled<{ series: Record<string, MMRow[]> }>("ucHubs.moneyMarket", tab === "fund" ? {} : null, 600_000);
  const sofr = (mm.data?.series.SOFR ?? []).slice(-180);
  const heldM = held.map((r) => ({ r, m: mets[r.symbol] })).filter((x) => x.m);
  const heldVal = held.reduce((a, r) => a + Math.abs(r.marketValue ?? 0), 0);
  const wDtl = heldVal ? heldM.reduce((a, x) => a + (Math.abs(x.r.marketValue ?? 0) / heldVal) * (x.m!.dtl ?? 0), 0) : null;
  const lvarAmt = heldM.reduce((a, x) => a + Math.abs(x.r.marketValue ?? 0) * (x.m!.lvar ?? 0) / 100, 0);
  return (
    <PanelShell code="LIQR" title="市场流动性风险" tabs={[["mkt", "标的流动性"], ["fund", "融资市场流动性"]]} tab={tab} setTab={setTab}>
      {tab === "mkt" && <>
        <Kpis items={[["模拟账户持仓", String(held.length), heldVal ? `市值 ${fmtCompact(heldVal)}` : "无持仓时按名义规模测算"], ["持仓加权变现天数", wDtl != null && held.length ? wDtl.toFixed(2) : "—", `参与率 ${part}%`], ["持仓流动性调整 VaR 99%", held.length ? fmtCompact(lvarAmt) : "—", "一日"], [`${cur ?? "—"} 盘口价差`, qs != null ? `${qs.toFixed(1)}bp` : "—", dp.data?.levels ? `${dp.data.levels} 档盘口` : "该市场无盘口"]]} />
        <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[10px] text-slate-500">
          名义规模（未持仓标的）<input type="number" value={size} onChange={(e) => setSize(Math.max(0, Number(e.target.value) || 0))} className={`${INP} w-28 text-right`} />
          参与率 %<input type="number" value={part} min={1} max={100} onChange={(e) => setPart(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className={`${INP} w-14 text-right`} />
          <form onSubmit={(e) => { e.preventDefault(); const s = add.trim(); if (s && !wl.includes(s)) persist([...wl, s]); setAdd(""); }} className="flex items-center gap-1"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="加入观察，如 AAPL / sh600036" className={`${INP} w-44`} /><button className={BTN}>加入</button></form>
          <button type="button" onClick={() => persist(DEF_WATCH)} className={BTN}>恢复默认</button>
        </div>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>20日均成交额</th><th className={TH}>今日放量</th><th className={TH}>非流动性</th><th className={TH}>日振幅%</th><th className={TH}>估计价差bp</th><th className={TH}>头寸</th><th className={TH}>变现天数</th><th className={TH}>LVaR99%</th><th className={TH} /></tr></thead>
          <tbody>{rows.map((s) => { const h = held.find((r) => r.symbol === s); return <LiqRow key={s} symbol={s} value={h ? Math.abs(h.marketValue ?? 0) : size} part={part / 100} held={!!h} onM={onM} onPick={pick} onSel={setSel} sel={cur === s} onRemove={!h ? () => persist(wl.filter((x) => x !== s)) : undefined} />; })}</tbody>
        </table>
        {dp.data && (dp.data.bids.length || dp.data.asks.length) ? <>
          <SectionHead title={`${cur} 实时盘口`} />
          <table className="w-full text-[11px]"><tbody>{Array.from({ length: Math.max(dp.data.bids.length, dp.data.asks.length) }, (_, i) => <tr key={i} className={ROW}><td className={TD} style={{ color: UP }}>{fmtPrice(dp.data!.bids[i]?.px)}</td><td className={`${TD} text-slate-400`}>{fmtCompact(dp.data!.bids[i]?.qty)}</td><td className="w-6 text-center text-[9px] text-slate-600">{i + 1}</td><td className={`${TD} text-slate-400`}>{fmtCompact(dp.data!.asks[i]?.qty)}</td><td className={TD} style={{ color: DOWN }}>{fmtPrice(dp.data!.asks[i]?.px)}</td></tr>)}</tbody></table>
        </> : null}
        <Note>非流动性 = 近 60 日平均（|日收益%| ÷ 成交额（亿））；估计价差 = 用相邻两日最高 / 最低价估计的买卖价差（近 20 日均值）；变现天数 = 头寸 ÷（20 日均成交额 × 参与率）；流动性调整 VaR = 2.33 × 日波动 + 半个估计价差。持仓取自平台模拟账户。点击行看盘口，双击名称看 K 线。</Note>
      </>}
      {tab === "fund" && <>
        <Kpis items={[["担保隔夜融资利率", sofr.length ? `${sofr[sofr.length - 1].v.toFixed(2)}%` : "—", sofr[sofr.length - 1]?.d], ["当日成交量", sofr[sofr.length - 1]?.vol != null ? `${sofr[sofr.length - 1].vol!.toFixed(0)} 十亿美元` : "—"], ["利率分布宽度（99 − 1 分位）", sofr[sofr.length - 1]?.p99 != null && sofr[sofr.length - 1]?.p1 != null ? `${Math.round((sofr[sofr.length - 1].p99! - sofr[sofr.length - 1].p1!) * 100)}bp` : "—", "宽度扩大 = 融资分层 / 紧张"], ["半年成交量均值", sofr.length ? `${mean(sofr.map((x) => x.vol ?? 0)).toFixed(0)} 十亿美元` : "—"]]} />
        <SectionHead title="担保隔夜融资：成交量（十亿美元）" />
        {sofr.length ? <Bars data={sofr.map((x) => ({ k: x.d.slice(5), v: x.vol ?? 0 }))} fmt={(v) => v.toFixed(0)} height={120} /> : <Empty loading={mm.loading} />}
        <SectionHead title="利率分布：1 分位 / 中位 / 99 分位（%）" />
        {sofr.length ? <Lines series={[{ name: "99 分位", color: "#f472b6", values: sofr.map((x) => x.p99) }, { name: "成交利率", color: "#fbbf24", values: sofr.map((x) => x.v) }, { name: "1 分位", color: "#38bdf8", values: sofr.map((x) => x.p1) }]} xLabels={sofr.map((x) => x.d.slice(5))} height={170} fmt={(v) => v.toFixed(2)} /> : null}
        <SectionHead title="流动性敏感资产实时" />
        <LiveBoard rows={[{ symbol: "^VIX", label: "股市波动率" }, { symbol: "^MOVE", label: "美债波动率" }, { symbol: "HYG", label: "高收益债" }, { symbol: "BIL", label: "1–3 月国库券" }, { symbol: "DXY", label: "美元指数" }]} showMini={false} />
      </>}
    </PanelShell>
  );
}
