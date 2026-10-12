/**
 * 债券小窗（全部真实数据，角度互不重复）：
 *  - ILB  通胀挂钩债券（美国）：通胀保值国债实际收益率曲线、同期限名义收益率与盈亏平衡通胀率、历史走势与分位
 *  - WBI  全球通胀挂钩债券：各市场通胀挂钩债券基金的区间表现、经验实际久期、与盈亏平衡通胀变动的相关
 *  - BYFC 债券收益率预测：曲线隐含远期、随机游走与均值回归三种方法的 3 / 6 / 12 个月预测，及各方法的历史预测误差
 *  - CRAN 固定收益工作表：个人债券基金持仓（永久保存）的市值、损益、经验久期、DV01 与收益率平移情景
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, corr, f2, heat, mean, perf, rets, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { BTN, INP, MiniLine, Note, ROW, TD, TDL, TH, THL, TENOR_Y, tenorVal, useCurves, yieldFn, type P } from "./LiveCommon";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
type Real = { rows: Array<{ date: string; points: Array<{ tenor: string; value: number }> }> };
const useReal = () => usePolled<Real>("ucHubs.realCurve", {}, 3 * 3600_000);

/* ================================================================== ILB 通胀挂钩债券（美国） */
export function IlbLive({ onClose }: P) {
  const real = useReal();
  const cur = useCurves();
  const [tenor, setTenor] = useState("10Y");
  const rows = real.data?.rows ?? [];
  const last = rows.at(-1);
  const nomByDate = useMemo(() => new Map((cur.data?.us ?? []).map((c) => [c.date, c])), [cur.data]);
  const tenors = last?.points.map((p) => p.tenor) ?? [];
  const be = (date: string, t: string) => { const n = nomByDate.get(date); const nv = tenorVal(n, t); const r = rows.find((x) => x.date === date)?.points.find((p) => p.tenor === t)?.value; return nv != null && r != null ? nv - r : null; };
  const series = rows.filter((r) => nomByDate.has(r.date));
  const hist = series.map((r) => ({ d: r.date, real: r.points.find((p) => p.tenor === tenor)?.value ?? null, nom: tenorVal(nomByDate.get(r.date), tenor), be: be(r.date, tenor) }));
  const beVals = hist.map((h) => h.be).filter((x): x is number => x != null);
  const beNow = beVals.at(-1) ?? null;
  const bePct = beNow != null ? (beVals.filter((x) => x <= beNow).length / beVals.length) * 100 : null;
  const ago = (n: number) => hist[Math.max(0, hist.length - 1 - n)];
  return (
    <PanelShell code="ILB" title="通胀挂钩债券（美国）" onClose={onClose} right={<Seg value={tenor} options={tenors.map((t) => [t, t] as [string, string])} onChange={setTenor} />}>
      <Kpis items={[["数据日期", last?.date ?? "—"], [`${tenor} 实际收益率`, f2(hist.at(-1)?.real, 2, "%")], [`${tenor} 名义收益率`, f2(hist.at(-1)?.nom, 2, "%")], [`${tenor} 盈亏平衡通胀`, f2(beNow, 2, "%"), `近 3 年分位 ${f2(bePct, 0, "%")}`], ["盈亏平衡 1 月变动", hist.length > 21 && beNow != null && ago(21).be != null ? `${((beNow - ago(21).be!) * 100).toFixed(0)}bp` : "—"]]} />
      {!last ? <Empty loading={real.loading} /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>实际收益率</th><th className={TH}>名义收益率</th><th className={TH}>盈亏平衡通胀</th><th className={TH}>实际 1 周变动</th><th className={TH}>实际 1 月变动</th><th className={TH}>盈亏平衡 1 月变动</th></tr></thead>
            <tbody>{tenors.map((t) => { const r0 = last.points.find((p) => p.tenor === t)?.value ?? null; const w = rows.at(-6)?.points.find((p) => p.tenor === t)?.value, m = rows.at(-22)?.points.find((p) => p.tenor === t)?.value; const b0 = be(last.date, t), bm = rows.at(-22) ? be(rows.at(-22)!.date, t) : null; return (
              <tr key={t} onClick={() => setTenor(t)} className={`${ROW} cursor-pointer ${t === tenor ? "bg-[#0d2236]" : ""}`}><td className={`${TDL} text-slate-100`}>{t}</td><td className={`${TD} text-white`}>{f2(r0, 2, "%")}</td><td className={`${TD} text-slate-300`}>{f2(tenorVal(nomByDate.get(last.date), t), 2, "%")}</td><td className={`${TD} text-amber-200`}>{f2(b0, 2, "%")}</td><td className={TD} style={{ color: toneOf(r0 != null && w != null ? r0 - w : null) }}>{r0 != null && w != null ? `${((r0 - w) * 100).toFixed(0)}bp` : "—"}</td><td className={TD} style={{ color: toneOf(r0 != null && m != null ? r0 - m : null) }}>{r0 != null && m != null ? `${((r0 - m) * 100).toFixed(0)}bp` : "—"}</td><td className={TD} style={{ color: toneOf(b0 != null && bm != null ? b0 - bm : null) }}>{b0 != null && bm != null ? `${((b0 - bm) * 100).toFixed(0)}bp` : "—"}</td></tr>); })}</tbody>
          </table>
          <SectionHead title={`${tenor}：名义、实际与盈亏平衡通胀`} />
          <Lines height={220} xLabels={hist.map((h) => h.d)} fmt={(v) => `${v.toFixed(2)}%`} series={[{ name: "名义收益率", color: COLORS[0], values: hist.map((h) => h.nom) }, { name: "实际收益率", color: COLORS[4], values: hist.map((h) => h.real) }, { name: "盈亏平衡通胀", color: COLORS[2], values: hist.map((h) => h.be), dash: true }]} />
          <Note>实际收益率为美国财政部公布的通胀保值国债收益率曲线（日度）；盈亏平衡通胀 = 同期限名义国债收益率 − 实际收益率，代表市场隐含的平均通胀预期（含通胀风险溢价与流动性溢价）。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== WBI 全球通胀挂钩债券 */
const LINKERS: Array<[string, string, string]> = [["TIP", "美国通胀保值国债（全期限）", "美国"], ["STIP", "美国通胀保值国债（0-5 年）", "美国"], ["LTPZ", "美国通胀保值国债（15 年以上）", "美国"], ["SCHP", "美国通胀保值国债（低费率）", "美国"], ["WIP", "国际通胀挂钩国债（除美国）", "全球"], ["GTIP", "全球通胀挂钩债券（含美国）", "全球"], ["ITPS", "英国通胀挂钩国债", "英国"], ["IBCI", "欧元区通胀挂钩国债", "欧元区"]];
export function WbiLive({ onClose }: P) {
  const [look, setLook] = useState<"63" | "252" | "756">("252");
  const syms = LINKERS.map((l) => l[0]);
  const ticks = useTicks(syms);
  const pack = useCloses([...syms, "IEF", "TLT"], 900);
  const real = useReal();
  const cur = useCurves();
  const { pick } = useHub();
  const beDaily = useMemo(() => {
    const nom = new Map((cur.data?.us ?? []).map((c) => [c.date, tenorVal(c, "10Y")]));
    return new Map((real.data?.rows ?? []).map((r) => { const rv = r.points.find((p) => p.tenor === "10Y")?.value; const nv = nom.get(r.date); return [r.date, rv != null && nv != null ? { be: nv - rv, real: rv } : null] as const; }).filter((x) => x[1] != null) as Array<[string, { be: number; real: number }]>);
  }, [real.data, cur.data]);
  const st = useMemo(() => {
    if (!pack.data) return {} as Record<string, { c: number[]; p: number | null; ytd: number | null; vol: number | null; dur: number | null; cBe: number | null }>;
    const n = Number(look);
    return Object.fromEntries(syms.map((s) => {
      const arr = pack.data![s] ?? [];
      const c = arr.map((x) => x[1]);
      const dates = arr.map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
      const pairs: Array<[number, number, number]> = [];
      for (let i = 1; i < arr.length; i++) { const a = beDaily.get(dates[i]), b = beDaily.get(dates[i - 1]); if (a && b) pairs.push([c[i] / c[i - 1] - 1, a.real - b.real, a.be - b.be]); }
      const w = pairs.slice(-n);
      const xr = w.map((p) => p[1]), yr = w.map((p) => p[0]);
      const mx = mean(xr), my = mean(yr);
      let cov = 0, vx = 0; for (let i = 0; i < w.length; i++) { cov += (xr[i] - mx) * (yr[i] - my); vx += (xr[i] - mx) ** 2; }
      const dur = vx > 0 ? -(cov / vx) : null;
      return [s, { c: c.slice(-n), p: perf(c, n), ytd: ytd(c, dates), vol: c.length > 30 ? std(rets(c.slice(-n))) * Math.sqrt(252) * 100 : null, dur, cBe: w.length > 20 ? corr(yr, w.map((p) => p[2])) : null }];
    }));
  }, [pack.data, beDaily, look]);
  return (
    <PanelShell code="WBI" title="全球通胀挂钩债券" onClose={onClose} right={<Seg value={look} options={[["63", "3 月"], ["252", "1 年"], ["756", "3 年"]]} onChange={setLook} />}>
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>基金</th><th className={THL}>市场</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>区间收益</th><th className={TH}>年初至今</th><th className={TH}>年化波动</th><th className={TH}>经验实际久期</th><th className={TH}>与盈亏平衡通胀相关</th><th className={TH}>走势</th></tr></thead>
        <tbody>{LINKERS.map(([s, n, m]) => { const t = ticks[s], x = st[s]; return (
          <tr key={s} onClick={() => pick(s)} className={`${ROW} cursor-pointer`}><td className={`${TDL} text-slate-100`}>{n} <span className="font-mono text-[10px] text-slate-500">{s}</span></td><td className={`${TDL} text-[10px] text-slate-500`}>{m}</td><td className={`${TD} text-white`}>{fmtPrice(t?.price)}</td><td className={TD} style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</td><td className={TD} style={{ color: toneOf(x?.p), background: heat(x?.p, 10) }}>{sgn(x?.p)}</td><td className={TD} style={{ color: toneOf(x?.ytd) }}>{sgn(x?.ytd)}</td><td className={`${TD} text-slate-300`}>{f2(x?.vol, 1, "%")}</td><td className={`${TD} text-slate-300`}>{x?.dur != null ? (x.dur * 100).toFixed(1) : "—"}</td><td className={TD} style={{ background: heat(x?.cBe, 1) }}>{f2(x?.cBe)}</td><td className={TD}><MiniLine values={x?.c ?? []} w={80} /></td></tr>); })}</tbody>
      </table>
      <SectionHead title="经验实际久期（对美国 10 年实际收益率的敏感度）" />
      <Bars data={LINKERS.filter(([s]) => st[s]?.dur != null).map(([s]) => ({ k: s, v: st[s].dur! * 100 }))} fmt={(v) => v.toFixed(1)} height={110} />
      <Note>经验实际久期 = 基金日收益对美国 10 年实际收益率日变动（百分点）回归系数的相反数；与盈亏平衡通胀相关反映基金对通胀预期变化的暴露，非美市场基金还包含汇率影响。</Note>
    </PanelShell>
  );
}

/* ================================================================== BYFC 债券收益率预测 */
const FC_TENORS = ["2Y", "5Y", "10Y", "30Y"];
const HORIZONS: Array<[string, number]> = [["3 个月", 63], ["6 个月", 126], ["12 个月", 252]];
function forwardYield(points: Array<{ tenor: string; value: number }>, t: number, h: number) {
  const y = yieldFn(points);
  const a = y(h), b = y(t + h);
  if (a == null || b == null) return null;
  return (Math.pow(Math.pow(1 + b, t + h) / Math.pow(1 + a, h), 1 / t) - 1) * 100;
}
export function ByfcLive({ onClose }: P) {
  const cur = useCurves();
  const [tenor, setTenor] = useState("10Y");
  const us = cur.data?.us ?? [];
  const last = us.at(-1);
  const series = us.map((c) => tenorVal(c, tenor));
  const model = useMemo(() => {
    if (us.length < 300) return null;
    const T = TENOR_Y[tenor];
    const ys = us.map((c) => tenorVal(c, tenor));
    // 均值回归：日度 AR(1)
    const x: number[] = [], y: number[] = [];
    for (let i = 1; i < ys.length; i++) if (ys[i] != null && ys[i - 1] != null) { x.push(ys[i - 1]!); y.push(ys[i]!); }
    const mx = mean(x), my = mean(y); let c = 0, v = 0; for (let i = 0; i < x.length; i++) { c += (x[i] - mx) * (y[i] - my); v += (x[i] - mx) ** 2; }
    const phi = v > 0 ? c / v : 1, alpha = my - phi * mx, mu = phi < 1 ? alpha / (1 - phi) : mx;
    const now = ys.at(-1)!;
    const fc = HORIZONS.map(([l, h]) => ({ l, h, rw: now, fwd: last ? forwardYield(last.points, T, h / 252) : null, ar: mu + Math.pow(phi, h) * (now - mu) }));
    // 历史预测误差：在每个可回测的起点比较三种方法与实际
    const err = HORIZONS.map(([l, h]) => {
      const e = { rw: [] as number[], fwd: [] as number[], ar: [] as number[] };
      for (let i = 0; i + h < ys.length; i += 5) {
        const y0 = ys[i], y1 = ys[i + h];
        if (y0 == null || y1 == null) continue;
        e.rw.push(y1 - y0);
        const f = forwardYield(us[i].points, T, h / 252); if (f != null) e.fwd.push(y1 - f);
        e.ar.push(y1 - (mu + Math.pow(phi, h) * (y0 - mu)));
      }
      const rmse = (a: number[]) => (a.length ? Math.sqrt(mean(a.map((z) => z * z))) * 100 : null);
      return { l, n: e.rw.length, rw: rmse(e.rw), fwd: rmse(e.fwd), ar: rmse(e.ar) };
    });
    return { fc, err, mu, half: phi < 1 && phi > 0 ? -Math.log(2) / Math.log(phi) : null };
  }, [us, tenor]);
  return (
    <PanelShell code="BYFC" title="债券收益率预测" onClose={onClose} right={<Seg value={tenor} options={FC_TENORS.map((t) => [t, t] as [string, string])} onChange={setTenor} />}>
      <Kpis items={[["曲线日期", last?.date ?? "—"], [`当前 ${tenor}`, f2(tenorVal(last, tenor), 3, "%")], ["长期均值（模型估计）", f2(model?.mu, 2, "%")], ["回归半衰期", model?.half != null ? `${model.half.toFixed(0)} 个交易日` : "—"]]} />
      {!model ? <Empty loading={cur.loading} text="曲线历史不足" /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>预测期</th><th className={TH}>随机游走（不变）</th><th className={TH}>曲线隐含远期</th><th className={TH}>均值回归</th><th className={TH}>远期 − 当前</th></tr></thead>
            <tbody>{model.fc.map((f) => <tr key={f.l} className={ROW}><td className={`${TDL} text-slate-100`}>{f.l}后</td><td className={`${TD} text-slate-300`}>{f.rw.toFixed(3)}%</td><td className={`${TD} text-white`}>{f2(f.fwd, 3, "%")}</td><td className={`${TD} text-amber-200`}>{f.ar.toFixed(3)}%</td><td className={TD} style={{ color: toneOf(f.fwd != null ? f.fwd - f.rw : null) }}>{f.fwd != null ? `${((f.fwd - f.rw) * 100).toFixed(0)}bp` : "—"}</td></tr>)}</tbody>
          </table>
          <SectionHead title="各方法的历史预测误差（均方根误差，bp）" sub="数值越小越准；按曲线历史每 5 个交易日滚动回测" />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>预测期</th><th className={TH}>样本数</th><th className={TH}>随机游走</th><th className={TH}>曲线隐含远期</th><th className={TH}>均值回归</th><th className={THL}>最优</th></tr></thead>
            <tbody>{model.err.map((e) => { const best = [["随机游走", e.rw], ["曲线隐含远期", e.fwd], ["均值回归", e.ar]].filter((x) => x[1] != null).sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0]; return <tr key={e.l} className={ROW}><td className={`${TDL} text-slate-100`}>{e.l}</td><td className={`${TD} text-slate-400`}>{e.n}</td><td className={`${TD} text-slate-300`}>{f2(e.rw, 1)}</td><td className={`${TD} text-slate-300`}>{f2(e.fwd, 1)}</td><td className={`${TD} text-slate-300`}>{f2(e.ar, 1)}</td><td className={`${TDL} text-cyan-300`}>{best}</td></tr>; })}</tbody>
          </table>
          <SectionHead title={`${tenor} 历史走势`} />
          <Lines height={170} xLabels={us.map((c) => c.date)} fmt={(v) => `${v.toFixed(2)}%`} series={[{ name: tenor, color: COLORS[0], values: series }, { name: "模型长期均值", color: "#94a3b8", values: series.map(() => model.mu), dash: true }]} />
          <Note>曲线隐含远期由当前国债曲线插值计算（复利）；均值回归为日度一阶自回归模型。三者均为统计基准，非投资建议；回测区间受平台曲线历史长度限制。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== CRAN 固定收益工作表 */
type Pos = { s: string; qty: number; cost: number };
const CRAN_DEFAULT: Pos[] = [{ s: "SHY", qty: 1000, cost: 0 }, { s: "IEF", qty: 500, cost: 0 }, { s: "TLT", qty: 300, cost: 0 }, { s: "LQD", qty: 300, cost: 0 }, { s: "HYG", qty: 200, cost: 0 }];
export function CranLive({ onClose }: P) {
  const saved = useSaved<{ pos: Pos[] }>("cran-book");
  const [pos, setPos] = useState<Pos[]>(CRAN_DEFAULT);
  const [d, setD] = useState({ s: "", qty: "", cost: "" });
  useEffect(() => { if (saved.data?.pos?.length) setPos(saved.data.pos); }, [saved.data]);
  const syms = pos.map((p) => p.s);
  const ticks = useTicks(syms);
  const pack = useCloses([...syms, "^TNX"], 400);
  const persist = (next: Pos[]) => { setPos(next); void saveItem("cran-book", { pos: next }).catch(() => toast.error("保存失败")); };
  const dur = useMemo(() => {
    if (!pack.data) return {} as Record<string, number | null>;
    return Object.fromEntries(syms.map((s) => {
      const al = align(pack.data, [s, "^TNX"]);
      const c = al.m[s].slice(-253), y = al.m["^TNX"].slice(-253);
      const r = c.slice(1).map((v, i) => v / c[i] - 1), dy = y.slice(1).map((v, i) => v - y[i]);
      const mx = mean(dy), my = mean(r); let cv = 0, vx = 0; for (let i = 0; i < r.length; i++) { cv += (dy[i] - mx) * (r[i] - my); vx += (dy[i] - mx) ** 2; }
      return [s, vx > 0 ? -(cv / vx) * 100 : null];
    }));
  }, [pack.data, syms.join("|")]);
  const rows = pos.map((p) => { const px = ticks[p.s]?.price ?? null; const mv = px != null ? px * p.qty : null; const D = dur[p.s] ?? null; return { ...p, px, mv, pnl: px != null && p.cost ? (px - p.cost) * p.qty : null, D, dv01: mv != null && D != null ? mv * D * 0.0001 : null }; });
  const totMv = rows.reduce((s, r) => s + (r.mv ?? 0), 0), totDv = rows.reduce((s, r) => s + (r.dv01 ?? 0), 0);
  const pDur = totMv ? rows.reduce((s, r) => s + (r.mv ?? 0) * (r.D ?? 0), 0) / totMv : null;
  return (
    <PanelShell code="CRAN" title="固定收益工作表" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <input value={d.s} onChange={(e) => setD({ ...d, s: e.target.value.toUpperCase() })} placeholder="债券基金代码，如 AGG / BND / EMB" className={`${INP} w-48`} />
        <input value={d.qty} onChange={(e) => setD({ ...d, qty: e.target.value })} placeholder="份额" className={`${INP} w-20`} />
        <input value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} placeholder="成本价（可空）" className={`${INP} w-24`} />
        <button type="button" className={BTN} onClick={() => { const q = Number(d.qty); if (!d.s || !q) { toast.error("请填写代码与份额"); return; } persist([...pos.filter((p) => p.s !== d.s), { s: d.s, qty: q, cost: Number(d.cost) || ticks[d.s]?.price || 0 }]); setD({ s: "", qty: "", cost: "" }); }}>加入 / 更新</button>
      </div>
      <Kpis items={[["组合市值", fmtCompact(totMv)], ["组合经验久期", f2(pDur, 2)], ["组合 DV01（每 1bp）", totDv.toFixed(0)], ["浮动盈亏", <span style={{ color: toneOf(rows.reduce((s, r) => s + (r.pnl ?? 0), 0)) }}>{fmtCompact(rows.reduce((s, r) => s + (r.pnl ?? 0), 0))}</span>]]} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>代码</th><th className={TH}>份额</th><th className={TH}>成本</th><th className={TH}>现价</th><th className={TH}>今日</th><th className={TH}>市值</th><th className={TH}>权重</th><th className={TH}>浮动盈亏</th><th className={TH}>经验久期</th><th className={TH}>DV01</th><th className={TH} /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.s} className={ROW}><td className={`${TDL} font-mono text-cyan-200`}>{r.s}</td><td className={`${TD} text-slate-300`}>{r.qty}</td><td className={`${TD} text-slate-400`}>{r.cost ? r.cost.toFixed(2) : "—"}</td><td className={`${TD} text-white`}>{fmtPrice(r.px)}</td><td className={TD} style={{ color: toneOf(ticks[r.s]?.changePct) }}>{fmtPct(ticks[r.s]?.changePct)}</td><td className={`${TD} text-slate-200`}>{fmtCompact(r.mv)}</td><td className={`${TD} text-slate-400`}>{totMv && r.mv ? `${((r.mv / totMv) * 100).toFixed(1)}%` : "—"}</td><td className={TD} style={{ color: toneOf(r.pnl) }}>{r.pnl == null ? "—" : fmtCompact(r.pnl)}</td><td className={`${TD} text-slate-300`}>{f2(r.D, 2)}</td><td className={`${TD} text-slate-300`}>{r.dv01 == null ? "—" : r.dv01.toFixed(0)}</td><td className={TD}><button type="button" className="text-[10px] text-slate-500 hover:text-rose-300" onClick={() => persist(pos.filter((p) => p.s !== r.s))}>移除</button></td></tr>)}</tbody>
      </table>
      <SectionHead title="收益率平移情景（组合市值变动）" />
      <Bars data={[-100, -50, -25, 25, 50, 100].map((bp) => ({ k: `${bp > 0 ? "+" : ""}${bp}bp`, v: -totDv * bp }))} fmt={(v) => fmtCompact(v)} height={110} />
      <Note>经验久期 = 近 1 年基金日收益对 10 年美债收益率日变动（百分点）回归系数的相反数，已包含信用利差与利率的联动；情景为一阶线性近似。持仓永久保存在你的个人账户。</Note>
    </PanelShell>
  );
}
