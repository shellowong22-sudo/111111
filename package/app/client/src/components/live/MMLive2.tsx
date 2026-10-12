/**
 * 货币市场分组（二），与 PGM / PBOC / 新闻研究、MIPR（政策利率与期限传导）、USSW（互换曲线）互不重复：
 *  - BTMM  资金面监控：隔夜利率分布与成交量、相对准备金利率的位置、短端利差（国库券—SOFR、商业票据—国库券）、逆回购与成交规模
 *          （MKTBEAT、货币市场菜单的 TCON 为同一实现）
 *  - MMIDX 货币市场指数：由每日 SOFR / EFFR 计算的 30 / 90 / 180 天复利平均与累计指数，对照同期国库券收益率
 *  - FIBC  债券计算器：自定义票息 / 期限 / 价格或收益率，按实时美债曲线给出久期、凸性、DV01 与对国债利差
 *  - CDIE  巴西 CDI：日利率、年化与累计，对照美元资金成本的利差
 *  - TWDI  台北金融业拆款定盘利率
 * 数据：纽约联储参考利率、美联储与欧洲央行公开利率、美国国债曲线、巴西央行 CDI、台湾拆款定盘（平台每日入库）。
 */
import { useMemo, useState } from "react";
import { fmtCompact, toneOf, usePolled } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines } from "@/uc/hubs/kit";
import { f2, heat, mean, sgn } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, ROW, TD, TDL, TH, THL, useCurves, yieldFn, type P } from "./LiveCommon";
import { useMM } from "./RatesFxLive";

type RatePoint = { date: string; value: number };
type RateSeries = { id: string; label: string; category: string; unit?: string; observationDate: string | null; value: number | null; changeBps: number | null; history: RatePoint[]; status: string };
type Snap = { asOf: string; rates: RateSeries[]; cdi: Array<{ date: string; valuePct: number }>; taiwanCallRate: Array<{ date: string; valuePct: number }> };
const useSnap = () => usePolled<Snap>("moneyMarketResearch.getSnapshot", {}, 600_000);
const pctRankOf = (arr: number[], v: number) => (arr.length ? (arr.filter((x) => x <= v).length / arr.length) * 100 : null);
const bp = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);

/* ================================================================== BTMM 资金面监控 */
export function BtmmLive({ onClose, code = "BTMM" }: P & { code?: string }) {
  const mm = useMM();
  const snap = useSnap();
  const s = (id: string) => snap.data?.rates.find((r) => r.id === id && r.status === "available");
  const iorb = s("IORB")?.value ?? null;
  const target = mm.data?.target;
  const ON: Array<[string, string]> = [["SOFR", "担保隔夜融资利率"], ["EFFR", "有效联邦基金利率"], ["OBFR", "隔夜银行融资利率"], ["TGCR", "三方回购利率"], ["BGCR", "广义回购利率"]];
  const onRows = ON.map(([k, l]) => {
    const a = mm.data?.series[k] ?? [];
    const last = a[a.length - 1], prev = a[a.length - 2];
    const vols = a.slice(-21, -1).map((x) => x.vol).filter((x): x is number => x != null);
    return { k, l, last, chg: last && prev ? (last.v - prev.v) * 100 : null, vsIorb: last && iorb != null ? (last.v - iorb) * 100 : null, disp: last?.p1 != null && last?.p99 != null ? (last.p99 - last.p1) * 100 : null, vol: last?.vol ?? null, volAvg: vols.length ? mean(vols) : null, hist: a.slice(-60).map((x) => x.v) };
  });
  // 利差：按日期对齐两条序列
  const pair = (a: RatePoint[], b: RatePoint[]) => { const m = new Map(b.map((x) => [x.date, x.value])); return a.filter((x) => m.has(x.date)).map((x) => ({ d: x.date, v: (x.value - m.get(x.date)!) * 100 })); };
  const fromMM = (k: string) => (mm.data?.series[k] ?? []).map((x) => ({ date: x.d, value: x.v }));
  const SPREADS: Array<[string, string, RatePoint[], RatePoint[]]> = [
    ["SOFR − 准备金利率", "回购资金相对央行准备金利率的位置；转正说明准备金偏紧", fromMM("SOFR"), s("IORB")?.history ?? []],
    ["EFFR − 准备金利率", "联邦基金在利率走廊中的位置", fromMM("EFFR"), s("IORB")?.history ?? []],
    ["三方回购 − SOFR", "三方回购与整体回购的分层", fromMM("TGCR"), fromMM("SOFR")],
    ["3 个月国库券 − SOFR", "国库券相对隔夜资金的期限 / 供给溢价", s("DTB3")?.history ?? [], fromMM("SOFR")],
    ["3 个月金融商票 − 国库券", "金融机构短期信用溢价，压力期显著走阔", s("DCPF3M")?.history ?? [], s("DTB3")?.history ?? []],
    ["3 个月非金融商票 − 国库券", "实体企业短期融资溢价", s("DCPN3M")?.history ?? [], s("DTB3")?.history ?? []],
  ];
  const spreadRows = SPREADS.map(([l, note, a, b]) => { const p = pair(a, b); const last = p[p.length - 1]; const m1 = p[p.length - 22]; return { l, note, last, m1, rank: last ? pctRankOf(p.map((x) => x.v), last.v) : null, hist: p.slice(-120).map((x) => x.v) }; });
  const rrp = s("RRPONTSYD"), sofrVol = s("SOFRVOL"), ffVol = s("EFFRVOL");
  const sofr = onRows[0];
  return (
    <PanelShell code={code} title="资金面监控：隔夜利率、短端利差与流动性" onClose={onClose} right={target?.from != null ? <span>联邦基金目标区间 {target.from.toFixed(2)}–{target.to?.toFixed(2)}%</span> : null}>
      <Kpis items={[
        ["SOFR", sofr.last ? `${sofr.last.v.toFixed(2)}%` : "—", sofr.last ? `${sofr.last.d} · 相对准备金利率 ${bp(sofr.vsIorb)}bp` : undefined],
        ["准备金余额利率", iorb != null ? `${iorb.toFixed(2)}%` : "—"],
        ["隔夜逆回购使用量", rrp?.value != null ? `${fmtCompact(rrp.value)} 十亿美元` : "—", rrp?.observationDate ?? undefined],
        ["SOFR 成交规模", sofrVol?.value != null ? `${fmtCompact(sofrVol.value)} 十亿美元` : "—", sofrVol?.observationDate ?? undefined],
      ]} />
      <SectionHead title="隔夜利率：水平、分布与成交量" sub="成交量对比前 20 个交易日均值" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>利率</th><th className={TH}>最新</th><th className={TH}>日变动 bp</th><th className={TH}>相对准备金利率 bp</th><th className={TH}>分布宽度 bp</th><th className={TH}>成交量（十亿）</th><th className={TH}>相对 20 日均量</th><th className="px-2">近 60 日</th></tr></thead>
        <tbody>{onRows.map((r) => <tr key={r.k} className={ROW}><td className={TDL}>{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.k}</span></td><td className={`${TD} text-white`}>{r.last ? r.last.v.toFixed(2) : "—"}</td><td className={TD} style={{ color: toneOf(r.chg) }}>{bp(r.chg)}</td><td className={TD} style={{ color: toneOf(r.vsIorb) }}>{bp(r.vsIorb)}</td><td className={TD} style={{ background: heat(r.disp, 30) }}>{r.disp == null ? "—" : r.disp.toFixed(0)}</td><td className={TD}>{r.vol == null ? "—" : fmtCompact(r.vol)}</td><td className={TD} style={{ color: toneOf(r.vol != null && r.volAvg ? r.vol - r.volAvg : null) }}>{r.vol != null && r.volAvg ? sgn((r.vol / r.volAvg - 1) * 100, 1) : "—"}</td><td className="px-2"><MiniLine values={r.hist} w={90} color="#38bdf8" /></td></tr>)}</tbody>
      </table>
      {!mm.data && <Empty loading={mm.loading} />}
      <SectionHead title="短端利差（bp）" sub="历史分位基于近半年日度数据；分位越高越偏紧" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>利差</th><th className={TH}>最新</th><th className={TH}>约 1 月前</th><th className={TH}>变化</th><th className={TH}>半年分位</th><th className="px-2">走势</th><th className={THL}>含义</th></tr></thead>
        <tbody>{spreadRows.map((r) => <tr key={r.l} className={ROW}><td className={TDL}>{r.l}</td><td className={`${TD} text-white`}>{r.last ? r.last.v.toFixed(1) : "—"}</td><td className={TD}>{r.m1 ? r.m1.v.toFixed(1) : "—"}</td><td className={TD} style={{ color: toneOf(r.last && r.m1 ? r.last.v - r.m1.v : null) }}>{r.last && r.m1 ? bp(r.last.v - r.m1.v, 1) : "—"}</td><td className={TD} style={{ background: heat(r.rank != null ? r.rank - 50 : null, 50) }}>{r.rank == null ? "—" : `${r.rank.toFixed(0)}%`}</td><td className="px-2"><MiniLine values={r.hist} w={90} color="#fbbf24" /></td><td className="px-2 text-[10px] text-slate-500">{r.note}</td></tr>)}</tbody>
      </table>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="隔夜逆回购使用量（十亿美元）" />{rrp?.history.length ? <Lines series={[{ name: "逆回购", color: "#a78bfa", values: rrp.history.slice(-120).map((x) => x.value) }]} xLabels={rrp.history.slice(-120).map((x) => x.date.slice(5))} height={140} fmt={(v) => fmtCompact(v)} /> : <Empty loading={snap.loading} />}</div>
        <div className="bg-[#03070c]"><SectionHead title="成交规模（十亿美元）" />{sofrVol?.history.length ? <Lines series={[{ name: "SOFR", color: "#38bdf8", values: sofrVol.history.slice(-120).map((x) => x.value) }, { name: "联邦基金", color: "#f472b6", values: (ffVol?.history ?? []).slice(-120).map((x) => x.value) }]} xLabels={sofrVol.history.slice(-120).map((x) => x.date.slice(5))} height={140} fmt={(v) => fmtCompact(v)} /> : <Empty loading={snap.loading} />}</div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== MMIDX 货币市场指数 */
function compAvg(a: Array<{ d: string; v: number }>, days: number) {
  // 按日历日复利（周末与节假日沿用前一工作日利率），实际/360
  if (a.length < 2) return null;
  const end = Date.parse(a[a.length - 1].d);
  const start = end - days * 86400_000;
  let g = 1, n = 0;
  for (let i = 0; i < a.length; i++) {
    const t0 = Date.parse(a[i].d), t1 = i + 1 < a.length ? Date.parse(a[i + 1].d) : t0 + 86400_000;
    const from = Math.max(t0, start), to = Math.min(t1, end + 86400_000);
    if (to <= from) continue;
    const dd = Math.round((to - from) / 86400_000);
    g *= 1 + (a[i].v / 100 / 360) * dd;
    n += dd;
  }
  return n >= days * 0.9 ? ((g - 1) * 360) / n * 100 : null;
}
export function MmidxLive({ onClose }: P) {
  const mm = useMM();
  const snap = useSnap();
  const s = (id: string) => snap.data?.rates.find((r) => r.id === id && r.status === "available");
  const KEYS: Array<[string, string]> = [["SOFR", "SOFR"], ["EFFR", "有效联邦基金"], ["TGCR", "三方回购"], ["OBFR", "隔夜银行融资"]];
  const rows = KEYS.map(([k, l]) => { const a = mm.data?.series[k] ?? []; return { k, l, last: a[a.length - 1]?.v ?? null, a30: compAvg(a, 30), a90: compAvg(a, 90), a180: compAvg(a, 180) }; });
  const sofr = mm.data?.series.SOFR ?? [];
  const index = useMemo(() => { let g = 100; const out: number[] = []; for (let i = 0; i < sofr.length; i++) { const d = i + 1 < sofr.length ? Math.round((Date.parse(sofr[i + 1].d) - Date.parse(sofr[i].d)) / 86400_000) : 1; g *= 1 + (sofr[i].v / 100 / 360) * d; out.push(g); } return out; }, [sofr]);
  const bills: Array<[string, string, number]> = [["DTB4WK", "4 周国库券", 30], ["DTB3", "3 个月国库券", 90], ["DTB6", "6 个月国库券", 180]];
  const sofrRow = rows[0];
  return (
    <PanelShell code="MMIDX" title="货币市场指数：复利平均与累计指数" onClose={onClose} right={sofr.length ? <span>截至 {sofr[sofr.length - 1].d}</span> : null}>
      <Kpis items={[["SOFR 30 天复利平均", f2(sofrRow.a30, 4, "%")], ["SOFR 90 天复利平均", f2(sofrRow.a90, 4, "%")], ["SOFR 180 天复利平均", f2(sofrRow.a180, 4, "%")], ["SOFR 累计指数", index.length ? index[index.length - 1].toFixed(4) : "—", sofr.length ? `以 ${sofr[0].d} 为 100` : undefined]]} />
      <SectionHead title="复利平均利率（%，实际/360，按日历日复利）" sub="用于浮动利率合约结算：回看期内每日利率逐日复利后年化" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>基准</th><th className={TH}>最新</th><th className={TH}>30 天</th><th className={TH}>90 天</th><th className={TH}>180 天</th><th className={TH}>最新 − 180 天（bp）</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.k} className={ROW}><td className={TDL}>{r.l}</td><td className={`${TD} text-white`}>{f2(r.last, 2)}</td><td className={TD}>{f2(r.a30, 4)}</td><td className={TD}>{f2(r.a90, 4)}</td><td className={TD}>{f2(r.a180, 4)}</td><td className={TD} style={{ color: toneOf(r.last != null && r.a180 != null ? r.last - r.a180 : null) }}>{r.last != null && r.a180 != null ? bp((r.last - r.a180) * 100, 1) : "—"}</td></tr>)}</tbody>
      </table>
      <SectionHead title="已实现复利 vs 同期限国库券" sub="国库券为前瞻收益率，复利平均为过去已实现；两者之差反映市场对未来资金利率的预期变化与期限溢价" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限</th><th className={TH}>国库券收益率</th><th className={TH}>SOFR 已实现复利</th><th className={TH}>差（bp）</th></tr></thead>
        <tbody>{bills.map(([id, l, d]) => { const b = s(id)?.value ?? null; const a = d === 30 ? sofrRow.a30 : d === 90 ? sofrRow.a90 : sofrRow.a180; return <tr key={id} className={ROW}><td className={TDL}>{l}</td><td className={`${TD} text-white`}>{f2(b, 2)}</td><td className={TD}>{f2(a, 3)}</td><td className={TD} style={{ color: toneOf(b != null && a != null ? b - a : null) }}>{b != null && a != null ? bp((b - a) * 100, 1) : "—"}</td></tr>; })}</tbody>
      </table>
      <SectionHead title="SOFR 累计指数" />
      {index.length > 5 ? <Lines series={[{ name: "SOFR 累计指数", color: "#fbbf24", values: index }]} xLabels={sofr.map((x) => x.d.slice(2))} height={150} fmt={(v) => v.toFixed(3)} /> : <Empty loading={mm.loading} />}
      <Note>累计指数从样本首日起按每日 SOFR 逐日复利（周末与节假日沿用前一工作日利率）。</Note>
    </PanelShell>
  );
}

/* ================================================================== FIBC 债券计算器 */
function bondPrice(c: number, y: number, n: number, f: number, frac: number) {
  // c、y 为年化小数；n 为剩余付息次数；frac 为距下一付息日的期数比例（0~1）
  let p = 0;
  for (let i = 1; i <= n; i++) p += (c / f) / Math.pow(1 + y / f, i - 1 + frac);
  p += 1 / Math.pow(1 + y / f, n - 1 + frac);
  return p * 100;
}
function solveYield(c: number, price: number, n: number, f: number, frac: number) {
  let lo = -0.05, hi = 0.5;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (bondPrice(c, mid, n, f, frac) > price) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function FibcLive({ onClose }: P) {
  const cv = useCurves();
  const [coupon, setCoupon] = useState(4.5);
  const [years, setYears] = useState(10);
  const [freq, setFreq] = useState(2);
  const [mode, setMode] = useState<"price" | "yield">("price");
  const [price, setPrice] = useState(100);
  const [yieldIn, setYieldIn] = useState(4.5);
  const [face, setFace] = useState(1_000_000);
  const ust = useMemo(() => (cv.data?.us[0] ? yieldFn(cv.data.us[0].points) : null), [cv.data]);
  const periods = years * freq;
  const n = Math.ceil(periods - 1e-9);
  const frac = n - periods > 0 ? 1 - (n - periods) : 1;
  const accrued = (coupon / freq) * (1 - frac);
  const c = coupon / 100;
  const y = mode === "price" ? solveYield(c, price + accrued, n, freq, frac) : yieldIn / 100;
  const dirty = bondPrice(c, y, n, freq, frac);
  const clean = dirty - accrued;
  const dUp = bondPrice(c, y + 0.0001, n, freq, frac), dDn = bondPrice(c, y - 0.0001, n, freq, frac);
  const modDur = (dDn - dUp) / (2 * dirty * 0.0001);
  const convex = (dUp + dDn - 2 * dirty) / (dirty * 0.0001 ** 2);
  const macDur = modDur * (1 + y / freq);
  const dv01 = ((dDn - dUp) / 2) / 100 * face;
  const bench = ust ? ust(years) : null;
  const gSpread = bench != null ? (y - bench) * 1e4 : null;
  const grid = [-100, -50, -25, -10, 0, 10, 25, 50, 100].map((b) => { const p = bondPrice(c, y + b / 1e4, n, freq, frac) - accrued; return { b, p, ch: p - clean, pnl: ((p - clean) / 100) * face }; });
  const box = "w-20 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white outline-none";
  return (
    <PanelShell code="FIBC" title="债券计算器" onClose={onClose} right={cv.data?.us[0] ? <span>基准：美债曲线 {cv.data.us[0].date}</span> : null}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px] text-slate-400">
        <label>票息 % <input className={box} type="number" step="0.125" value={coupon} onChange={(e) => setCoupon(Number(e.target.value))} /></label>
        <label>剩余年限 <input className={box} type="number" step="0.25" min="0.25" value={years} onChange={(e) => setYears(Math.max(0.25, Number(e.target.value)))} /></label>
        <label>付息 <select className={box} value={freq} onChange={(e) => setFreq(Number(e.target.value))}><option value={1}>年付</option><option value={2}>半年付</option><option value={4}>季付</option></select></label>
        <Seg value={mode} options={[["price", "输入价格"], ["yield", "输入收益率"]]} onChange={setMode} />
        {mode === "price" ? <label>净价 <input className={box} type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label> : <label>收益率 % <input className={box} type="number" step="0.01" value={yieldIn} onChange={(e) => setYieldIn(Number(e.target.value))} /></label>}
        <label>面值 <input className={box} type="number" step="100000" value={face} onChange={(e) => setFace(Number(e.target.value))} /></label>
        <button type="button" disabled={bench == null} onClick={() => { if (bench != null) { setMode("yield"); setYieldIn(Number((bench * 100).toFixed(3))); } }} className="border border-[#2a3c52] px-2 py-0.5 text-slate-200 hover:bg-[#0a1726] disabled:opacity-40">按同期限美债收益率定价</button>
      </div>
      <Kpis items={[[mode === "price" ? "到期收益率" : "净价", mode === "price" ? `${(y * 100).toFixed(4)}%` : clean.toFixed(4), `全价 ${dirty.toFixed(4)} · 应计利息 ${accrued.toFixed(4)}`], ["修正久期", modDur.toFixed(3), `麦考利久期 ${macDur.toFixed(3)}`], ["凸性", convex.toFixed(2)], ["DV01", fmtCompact(dv01), `面值 ${fmtCompact(face)} · 每 100 面值 ${(((dDn - dUp) / 2)).toFixed(4)}`]]} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="相对美债" />
          <table className="w-full text-[11px]"><tbody>
            <tr className={ROW}><td className={TDL}>同期限美债收益率（插值）</td><td className={`${TD} text-white`}>{bench == null ? "—" : `${(bench * 100).toFixed(3)}%`}</td></tr>
            <tr className={ROW}><td className={TDL}>对美债利差</td><td className={TD} style={{ color: toneOf(gSpread) }}>{gSpread == null ? "—" : `${bp(gSpread, 1)} bp`}</td></tr>
            <tr className={ROW}><td className={TDL}>按美债收益率定价的净价</td><td className={TD}>{bench == null ? "—" : (bondPrice(c, bench, n, freq, frac) - accrued).toFixed(4)}</td></tr>
          </tbody></table></div>
        <div className="bg-[#03070c]"><SectionHead title="收益率变动情景" />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>收益率变动</th><th className={TH}>净价</th><th className={TH}>价格变化</th><th className={TH}>持仓损益</th></tr></thead>
            <tbody>{grid.map((g) => <tr key={g.b} className={ROW}><td className={TDL}>{g.b > 0 ? "+" : ""}{g.b} bp</td><td className={`${TD} text-white`}>{g.p.toFixed(3)}</td><td className={TD} style={{ color: toneOf(g.ch) }}>{g.ch.toFixed(3)}</td><td className={TD} style={{ color: toneOf(g.pnl) }}>{fmtCompact(g.pnl)}</td></tr>)}</tbody></table></div>
      </div>
      <SectionHead title="剩余现金流" sub={`面值 ${fmtCompact(face)}；贴现按当前收益率`} />
      <div className="max-h-[260px] overflow-auto"><table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className={THL}>期次</th><th className={TH}>距今（年）</th><th className={TH}>票息</th><th className={TH}>本金</th><th className={TH}>现值</th><th className={TH}>占全价比例</th></tr></thead>
        <tbody>{Array.from({ length: n }, (_, k) => { const i = k + 1; const tYr = (i - 1 + frac) / freq; const cpn = ((c / freq) * face); const prin = i === n ? face : 0; const pv = (cpn + prin) / Math.pow(1 + y / freq, i - 1 + frac); return <tr key={i} className={ROW}><td className={TDL}>{i}</td><td className={TD}>{tYr.toFixed(2)}</td><td className={TD}>{fmtCompact(cpn)}</td><td className={TD}>{prin ? fmtCompact(prin) : ""}</td><td className={`${TD} text-white`}>{fmtCompact(pv)}</td><td className={TD}>{((pv / ((dirty / 100) * face)) * 100).toFixed(2)}%</td></tr>; })}</tbody>
      </table></div>
      <Note>按剩余期限反推下一付息日（距今不足一期的部分计应计利息），收益率为按付息频率复利的到期收益率。</Note>
    </PanelShell>
  );
}

/* ================================================================== CDIE 巴西 CDI */
export function CdieLive({ onClose }: P) {
  const snap = useSnap();
  const mm = useMM();
  const cdi = snap.data?.cdi ?? [];
  const ann = (d: number) => (Math.pow(1 + d / 100, 252) - 1) * 100;
  const last = cdi[cdi.length - 1];
  const acc = cdi.reduce((g, x) => g * (1 + x.valuePct / 100), 1);
  const sofr = mm.data?.series.SOFR?.[mm.data.series.SOFR.length - 1];
  return (
    <PanelShell code="CDIE" title="巴西银行间存款利率（CDI）" onClose={onClose} right={last ? <span>截至 {last.date}</span> : null}>
      <Kpis items={[["CDI 日利率", last ? `${last.valuePct.toFixed(6)}%` : "—"], ["年化（252 个工作日）", last ? `${ann(last.valuePct).toFixed(2)}%` : "—"], ["样本期累计", cdi.length ? `${((acc - 1) * 100).toFixed(3)}%` : "—", cdi.length ? `${cdi.length} 个工作日` : undefined], ["对美元 SOFR 利差", last && sofr ? `${bp((ann(last.valuePct) - sofr.v) * 100)} bp` : "—", "套息交易的名义利差"]]} />
      {!cdi.length ? <Empty loading={snap.loading} text="CDI 数据暂未更新" /> : <>
        <SectionHead title="CDI 年化利率（%）" />
        <Lines series={[{ name: "CDI 年化", color: "#34d399", values: cdi.map((x) => ann(x.valuePct)) }]} xLabels={cdi.map((x) => x.date.slice(5))} height={150} fmt={(v) => v.toFixed(2)} />
        <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>日期</th><th className={TH}>日利率 %</th><th className={TH}>年化 %</th><th className={TH}>累计（自样本首日）%</th></tr></thead>
          <tbody>{(() => { let g = 1; return cdi.map((x) => { g *= 1 + x.valuePct / 100; return { x, g }; }).reverse().map(({ x, g: gg }) => <tr key={x.date} className={ROW}><td className={TDL}>{x.date}</td><td className={TD}>{x.valuePct.toFixed(6)}</td><td className={`${TD} text-white`}>{ann(x.valuePct).toFixed(2)}</td><td className={TD}>{((gg - 1) * 100).toFixed(4)}</td></tr>); })()}</tbody></table>
        <Note>巴西利率期货（DI1）报价暂未接入，无法给出期货隐含 CDI 与实际 CDI 的对比；接入后在本页补充。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== TWDI 台北金融业拆款定盘利率 */
export function TwdiLive({ onClose }: P) {
  const snap = useSnap();
  const tw = snap.data?.taiwanCallRate ?? [];
  const last = tw[tw.length - 1], prev = tw[tw.length - 2];
  const [n, setN] = useState("60");
  const show = tw.slice(-Number(n));
  return (
    <PanelShell code="TWDI" title="台北金融业拆款定盘利率" onClose={onClose} right={<Seg value={n} options={[["20", "20 日"], ["60", "60 日"], ["250", "1 年"]]} onChange={setN} />}>
      <Kpis items={[["最新", last ? `${last.valuePct.toFixed(3)}%` : "—", last?.date], ["日变动", last && prev ? `${bp((last.valuePct - prev.valuePct) * 100, 1)} bp` : "—"], ["区间最高", show.length ? `${Math.max(...show.map((x) => x.valuePct)).toFixed(3)}%` : "—"], ["区间最低", show.length ? `${Math.min(...show.map((x) => x.valuePct)).toFixed(3)}%` : "—"]]} />
      {!tw.length ? <Empty loading={snap.loading} text="拆款定盘利率暂未更新，更新后自动显示。" /> : <>
        <Lines series={[{ name: "拆款定盘", color: "#38bdf8", values: show.map((x) => x.valuePct) }]} xLabels={show.map((x) => x.date.slice(5))} height={160} fmt={(v) => v.toFixed(3)} />
        <Bars data={show.slice(-20).map((x, i, a) => ({ k: x.date.slice(5), v: i ? (x.valuePct - a[i - 1].valuePct) * 100 : 0 }))} fmt={(v) => v.toFixed(1)} height={110} label={["日变动 bp", ""]} />
      </>}
    </PanelShell>
  );
}
