/**
 * 经济分析小窗（全部真实数据，角度互不重复）：
 *  - ECST 国家经济概览：单一经济体的核心年度指标（实际值 + 当年估计 + 未来预测）、最新月度通胀与政策利率、指标长期走势
 *  - ECAN 世界经济分析：跨经济体横向比较（增长 × 通胀象限散点、全部指标排名、地区汇总）
 *  - CENB 央行查找：单一央行档案——政策利率与通胀双线、实际利率、历次调整后本币 20 日表现（事件研究）、下一次议息、相关新闻
 * 年度数据为国际货币基金组织《世界经济展望》数据库（含预测），月度利率 / 通胀为各国央行与统计机构公布值；均写入平台数据库。
 */
import { useMemo, useState } from "react";
import { fmtPct, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, Lines } from "@/uc/hubs/kit";
import { f2, heat, mean, sgn, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, ROW, TD, TDL, TH, THL, useCalendarSpan, type P } from "./LiveCommon";
import { FX_CCYS, useCbRates, usdVal, type CbRow } from "./FxDeskLive";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
type Imf = { economies: Array<{ iso: string; name: string; region: string }>; indicators: Record<string, { label: string; data: Record<string, Array<{ y: number; v: number }>> }> };
const CODES = ["NGDP_RPCH", "PCPIPCH", "LUR", "BCA_NGDPD", "GGXWDG_NGDP", "GGXCNL_NGDP", "NGDPD", "NGDPDPC", "PPPSH", "NGAP_NPGDP"];
const useImf = () => usePolled<Imf>("ucHubs.imf", { codes: CODES }, 12 * 3600_000);
const Y = new Date().getFullYear();
const valAt = (d: Imf | null, code: string, iso: string, y: number) => d?.indicators[code]?.data[iso]?.find((x) => x.y === y)?.v ?? null;
const fmtV = (code: string, v: number | null) => (v == null ? "—" : code === "NGDPD" ? v.toLocaleString("zh-CN", { maximumFractionDigits: 0 }) : code === "NGDPDPC" ? v.toLocaleString("zh-CN", { maximumFractionDigits: 0 }) : `${v.toFixed(1)}%`);
/** IMF 经济体代码 → 央行利率库代码 */
const ISO_CB: Record<string, string> = { USA: "US", DEU: "XM", FRA: "XM", ITA: "XM", ESP: "XM", NLD: "XM", GBR: "GB", JPN: "JP", CHE: "CH", CAN: "CA", AUS: "AU", NZL: "NZ", SWE: "SE", NOR: "NO", CHN: "CN", HKG: "HK", KOR: "KR", IND: "IN", IDN: "ID", THA: "TH", MYS: "MY", PHL: "PH", BRA: "BR", MEX: "MX", CHL: "CL", COL: "CO", ZAF: "ZA", TUR: "TR", POL: "PL", SAU: "SA" };

/* ================================================================== ECST 国家经济概览 */
export function EcstLive({ onClose }: P) {
  const [iso, setIso] = useState("CHN");
  const [code, setCode] = useState("NGDP_RPCH");
  const imf = useImf();
  const cb = useCbRates();
  const d = imf.data;
  const econ = d?.economies.find((e) => e.iso === iso);
  const years = [Y - 3, Y - 2, Y - 1, Y, Y + 1, Y + 2];
  const cbr = cb.data?.rows.find((r) => r.area === ISO_CB[iso]);
  const hist = d?.indicators[code]?.data[iso]?.filter((x) => x.y >= Y - 25 && x.y <= Y + 5) ?? [];
  const world = d?.indicators[code]?.data.WEOWORLD?.filter((x) => x.y >= Y - 25 && x.y <= Y + 5) ?? [];
  return (
    <PanelShell code="ECST" title="国家经济概览" onClose={onClose} right={<select value={iso} onChange={(e) => setIso(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-[11px] text-white">{(d?.economies ?? []).map((e) => <option key={e.iso} value={e.iso}>{e.name}</option>)}</select>}>
      <Kpis items={[["经济体", econ?.name ?? iso, econ?.region], [`${Y} 年增长（估计）`, fmtV("NGDP_RPCH", valAt(d, "NGDP_RPCH", iso, Y))], [`${Y} 年通胀（估计）`, fmtV("PCPIPCH", valAt(d, "PCPIPCH", iso, Y))], ["最新月度通胀", cbr?.cpi != null ? `${cbr.cpi.toFixed(2)}%` : "—", cbr?.cpiDate ?? ""], ["政策利率", cbr?.rate != null ? `${cbr.rate.toFixed(2)}%` : "—", cbr?.date ?? ""], ["名义 GDP（十亿美元）", fmtV("NGDPD", valAt(d, "NGDPD", iso, Y))]]} />
      {!d ? <Empty loading={imf.loading} /> : (
        <>
          <table className="w-full text-[11px]">
            <thead className={thead}><tr><th className={THL}>指标</th>{years.map((y) => <th key={y} className={TH}>{y}{y >= Y ? (y === Y ? "（估）" : "（预）") : ""}</th>)}<th className={TH}>与全球差（{Y}）</th><th className={TH}>近 25 年</th></tr></thead>
            <tbody>{CODES.map((c) => {
              const s = d.indicators[c]?.data[iso] ?? [];
              const w = valAt(d, c, "WEOWORLD", Y), v = valAt(d, c, iso, Y);
              return (
                <tr key={c} onClick={() => setCode(c)} className={`${ROW} cursor-pointer ${c === code ? "bg-[#0d2236]" : ""}`}>
                  <td className={`${TDL} text-slate-100`}>{d.indicators[c]?.label ?? c}</td>
                  {years.map((y) => { const x = valAt(d, c, iso, y); return <td key={y} className={`${TD} ${y >= Y ? "text-amber-200" : "text-white"}`}>{fmtV(c, x)}</td>; })}
                  <td className={TD} style={{ color: toneOf(v != null && w != null && !["NGDPD", "NGDPDPC", "PPPSH"].includes(c) ? v - w : null) }}>{v != null && w != null && !["NGDPD", "NGDPDPC", "PPPSH"].includes(c) ? sgn(v - w, 1, "") : "—"}</td>
                  <td className={TD}><MiniLine values={s.filter((x) => x.y >= Y - 25 && x.y <= Y).map((x) => x.v)} w={90} /></td>
                </tr>
              );
            })}</tbody>
          </table>
          <SectionHead title={`${d.indicators[code]?.label ?? code}：${econ?.name ?? iso} vs 全球`} sub="点击上表行切换指标；当年及以后为预测" />
          <Lines height={190} zero xLabels={hist.map((x) => String(x.y))} fmt={(v) => fmtV(code, v)} series={[{ name: econ?.name ?? iso, color: COLORS[0], values: hist.map((x) => x.v) }, ...(["NGDPD", "NGDPDPC", "PPPSH"].includes(code) ? [] : [{ name: "全球", color: "#94a3b8", values: hist.map((x) => world.find((w) => w.y === x.y)?.v ?? null), dash: true }])]} />
          <Note>年度数据含当年估计与未来预测（黄色），随官方《世界经济展望》每年 4 月、10 月更新；月度通胀与政策利率为最新公布值。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== ECAN 世界经济分析 */
function Scatter({ pts, xl, yl }: { pts: Array<{ k: string; x: number; y: number; r: number }>; xl: string; yl: string }) {
  if (!pts.length) return <Empty text="无数据" />;
  const W = 640, H = 300, pad = 36;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(0, ...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
  const sx = (v: number) => pad + ((v - x0) / Math.max(1e-9, x1 - x0)) * (W - pad * 2), sy = (v: number) => H - pad - ((v - y0) / Math.max(1e-9, y1 - y0)) * (H - pad * 2);
  const rmax = Math.max(...pts.map((p) => p.r), 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
      <line x1={sx(0)} x2={sx(0)} y1={pad / 2} y2={H - pad} stroke="#1d3047" /><line x1={pad} x2={W - pad / 2} y1={sy(0)} y2={sy(0)} stroke="#1d3047" />
      <text x={W - pad} y={H - 8} fontSize={10} fill="#5f7891" textAnchor="end">{xl} →</text><text x={8} y={14} fontSize={10} fill="#5f7891">↑ {yl}</text>
      {pts.map((p) => <g key={p.k}><circle cx={sx(p.x)} cy={sy(p.y)} r={3 + Math.sqrt(p.r / rmax) * 12} fill="rgba(56,189,248,0.25)" stroke="#38bdf8" strokeWidth={0.8} /><text x={sx(p.x) + 4} y={sy(p.y) - 4} fontSize={9} fill="#cbd5e1">{p.k}</text></g>)}
    </svg>
  );
}
export function EcanLive({ onClose }: P) {
  const [tab, setTab] = useState("quad");
  const [yr, setYr] = useState(String(Y));
  const [sortC, setSortC] = useState("NGDP_RPCH");
  const [region, setRegion] = useState("全部");
  const imf = useImf();
  const d = imf.data;
  const y = Number(yr);
  const econs = (d?.economies ?? []).filter((e) => e.region !== "全球" && (region === "全部" || e.region === region));
  const pts = econs.map((e) => ({ k: e.name, x: valAt(d, "NGDP_RPCH", e.iso, y), y: valAt(d, "PCPIPCH", e.iso, y), r: valAt(d, "NGDPD", e.iso, y) ?? 1 })).filter((p): p is { k: string; x: number; y: number; r: number } => p.x != null && p.y != null && p.y < 60);
  const dpts = econs.map((e) => ({ k: e.name, x: valAt(d, "GGXCNL_NGDP", e.iso, y), y: valAt(d, "GGXWDG_NGDP", e.iso, y), r: valAt(d, "NGDPD", e.iso, y) ?? 1 })).filter((p): p is { k: string; x: number; y: number; r: number } => p.x != null && p.y != null);
  const ranked = [...econs].map((e) => ({ e, v: valAt(d, sortC, e.iso, y) })).filter((x) => x.v != null).sort((a, b) => b.v! - a.v!);
  const regionAvg = ["美洲", "欧洲", "亚太", "中东非"].map((r) => { const v = (d?.economies ?? []).filter((e) => e.region === r).map((e) => ({ g: valAt(d, "NGDP_RPCH", e.iso, y), w: valAt(d, "NGDPD", e.iso, y) })).filter((x) => x.g != null && x.w != null); const tw = v.reduce((s, x) => s + x.w!, 0); return { k: r, v: tw ? v.reduce((s, x) => s + x.g! * x.w!, 0) / tw : 0 }; });
  return (
    <PanelShell code="ECAN" title="世界经济分析" onClose={onClose} tabs={[["quad", "增长 × 通胀"], ["fiscal", "财政 × 债务"], ["rank", "指标排名"]]} tab={tab} setTab={setTab}
      right={<span className="flex items-center gap-1 text-[10px] text-slate-500"><Seg value={yr} options={[Y - 2, Y - 1, Y, Y + 1, Y + 3].map((v) => [String(v), `${v}${v > Y ? "（预）" : v === Y ? "（估）" : ""}`] as [string, string])} onChange={setYr} /></span>}>
      <Kpis items={[["全球增长", fmtV("NGDP_RPCH", valAt(d, "NGDP_RPCH", "WEOWORLD", y))], ["发达经济体", fmtV("NGDP_RPCH", valAt(d, "NGDP_RPCH", "ADVEC", y))], ["新兴与发展中", fmtV("NGDP_RPCH", valAt(d, "NGDP_RPCH", "OEMDC", y))], ["全球通胀", fmtV("PCPIPCH", valAt(d, "PCPIPCH", "WEOWORLD", y))]]} />
      {!d ? <Empty loading={imf.loading} /> : (
        <>
          <div className="px-2 py-1"><Seg value={region} options={["全部", "美洲", "欧洲", "亚太", "中东非"].map((r) => [r, r] as [string, string])} onChange={setRegion} /></div>
          {tab === "quad" && <><SectionHead title={`${y} 年实际增长（横）× 通胀（纵）`} sub="右下象限为“高增长低通胀”" /><Scatter pts={pts} xl="实际 GDP 增速 %" yl="通胀 %" /><SectionHead title="各地区经济规模加权增速" /><Bars data={regionAvg} fmt={(v) => `${v.toFixed(2)}%`} height={100} /></>}
          {tab === "fiscal" && <><SectionHead title={`${y} 年财政余额 / GDP（横）× 政府债务 / GDP（纵）`} sub="左上象限：赤字大且债务高，财政空间最小" /><Scatter pts={dpts} xl="财政余额 / GDP %" yl="政府债务 / GDP %" /></>}
          {tab === "rank" && (
            <>
              <div className="flex flex-wrap gap-1 px-2 py-1">{CODES.map((c) => <button type="button" key={c} onClick={() => setSortC(c)} className={`border px-1.5 py-0.5 text-[10px] ${sortC === c ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500"}`}>{d.indicators[c]?.label}</button>)}</div>
              <table className="w-full text-[11px]">
                <thead className={thead}><tr><th className={THL}>排名</th><th className={THL}>经济体</th><th className={THL}>地区</th>{["NGDP_RPCH", "PCPIPCH", "LUR", "BCA_NGDPD", "GGXWDG_NGDP", "GGXCNL_NGDP", "NGDPDPC"].map((c) => <th key={c} className={`${TH} ${c === sortC ? "text-cyan-300" : ""}`}>{d.indicators[c]?.label}</th>)}</tr></thead>
                <tbody>{ranked.map((r, i) => <tr key={r.e.iso} className={ROW}><td className={`${TDL} text-slate-500`}>{i + 1}</td><td className={`${TDL} text-slate-100`}>{r.e.name}</td><td className={`${TDL} text-[10px] text-slate-500`}>{r.e.region}</td>{["NGDP_RPCH", "PCPIPCH", "LUR", "BCA_NGDPD", "GGXWDG_NGDP", "GGXCNL_NGDP", "NGDPDPC"].map((c) => { const v = valAt(d, c, r.e.iso, y); return <td key={c} className={TD} style={{ background: c === "NGDP_RPCH" || c === "BCA_NGDPD" || c === "GGXCNL_NGDP" ? heat(v, 8) : undefined }}>{fmtV(c, v)}</td>; })}</tr>)}</tbody>
              </table>
            </>
          )}
          <Note>数据为国际货币基金组织《世界经济展望》年度值，{Y} 年为估计、之后为预测。散点只显示通胀低于 60% 的经济体以保证可读。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== CENB 央行查找 */
const DECISION = /interest rate decision|rate decision|cash rate|bank rate|deposit facility|policy rate|repo rate|selic|benchmark rate|利率决议/i;
export function CenbLive({ onClose }: P) {
  const cb = useCbRates();
  const rows = cb.data?.rows ?? [];
  const [area, setArea] = useState("US");
  const r: CbRow | undefined = rows.find((x) => x.area === area);
  const ccy = FX_CCYS.find((c) => c.cb === area);
  const pack = useCloses(ccy ? [ccy.sym] : ["DXY"], 2600);
  const ticks = useTicks(ccy ? [ccy.sym] : ["DXY"]);
  const cal = useCalendarSpan(30, 10);
  const feed = useFeed(r ? { q: r.bank.replace(/（.*）/, ""), hours: 96, limit: 60, sort: "time" } : null, 300_000);
  const moves = useMemo(() => {
    if (!r) return [];
    const out: Array<{ d: string; from: number; to: number }> = [];
    for (let i = 1; i < r.hist.length; i++) if (r.hist[i].v !== r.hist[i - 1].v) out.push({ d: r.hist[i].d, from: r.hist[i - 1].v, to: r.hist[i].v });
    return out.reverse();
  }, [r]);
  // 事件研究：调整所在月份月初起本币对美元 20 个交易日的变化（月度数据只能定位到月）
  const study = useMemo(() => {
    if (!pack.data || !ccy && area !== "US") return [];
    const sym = ccy?.sym ?? "DXY";
    const arr = pack.data[sym] ?? [];
    const dates = arr.map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
    const vals = ccy ? usdVal(ccy, arr.map((x) => x[1])) : arr.map((x) => x[1]);
    return moves.map((m) => { const i = dates.findIndex((d) => d >= `${m.d}-01`); const j = i >= 0 ? Math.min(vals.length - 1, i + 20) : -1; return { ...m, ret: i >= 0 && j > i ? (vals[j] / vals[i] - 1) * 100 : null }; });
  }, [pack.data, moves, ccy, area]);
  const next = cal.rows.filter((e) => e.region === r?.name && DECISION.test(`${e.name} ${e.nameZh}`));
  const upcoming = next.filter((e) => !e.released).slice(0, 2), recent = next.filter((e) => e.released).slice(-2);
  const hikes = study.filter((s) => s.to > s.from && s.ret != null), cuts = study.filter((s) => s.to < s.from && s.ret != null);
  return (
    <PanelShell code="CENB" title="央行查找" onClose={onClose} right={<select value={area} onChange={(e) => setArea(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-[11px] text-white">{rows.map((x) => <option key={x.area} value={x.area}>{x.bank} · {x.name}</option>)}</select>}>
      {!r ? <Empty loading={cb.loading} /> : (
        <>
          <Kpis items={[["央行", r.bank, r.name], ["政策利率", `${r.rate?.toFixed(2)}%`, r.date ?? ""], ["实际利率", f2(r.real, 2, "%"), `通胀 ${f2(r.cpi, 2, "%")}`], ["最近一次调整", r.lastMove ? `${r.lastMove.d} ${r.lastMove.to > r.lastMove.from ? "加息" : "降息"} ${Math.abs((r.lastMove.to - r.lastMove.from) * 100).toFixed(0)}bp` : "6 年内未调整"], ["下次议息", upcoming[0] ? `${upcoming[0].date}` : "日历中暂无", upcoming[0]?.consensus ? `预期 ${upcoming[0].consensus}` : ""], [ccy ? `${ccy.zh}对美元（实时）` : "美元指数（实时）", fmtPct(ticks[ccy?.sym ?? "DXY"]?.changePct)]]} />
          <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="bg-[#03070c]">
              <SectionHead title="政策利率与通胀（月度）" sub="两线之差即实际利率" />
              <Lines height={200} xLabels={r.hist.map((h) => h.d)} fmt={(v) => `${v.toFixed(2)}%`} series={[{ name: "政策利率", color: COLORS[0], values: r.hist.map((h) => h.v) }, { name: "通胀同比", color: COLORS[2], values: r.hist.map((h) => r.cpiHist.find((c) => c.d === h.d)?.v ?? null), dash: true }]} />
              <SectionHead title="历次利率调整与本币随后 20 个交易日表现" sub={`加息后平均 ${sgn(hikes.length ? mean(hikes.map((h) => h.ret!)) : null)}（${hikes.length} 次）· 降息后平均 ${sgn(cuts.length ? mean(cuts.map((h) => h.ret!)) : null)}（${cuts.length} 次）`} />
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className={THL}>月份</th><th className={THL}>操作</th><th className={TH}>调整前</th><th className={TH}>调整后</th><th className={TH}>幅度</th><th className={TH}>{ccy ? `${ccy.zh}对美元 20 日` : "美元指数 20 日"}</th></tr></thead>
                <tbody>{study.slice(0, 14).map((m) => <tr key={m.d} className={ROW}><td className={`${TDL} font-mono text-slate-300`}>{m.d}</td><td className={TDL} style={{ color: m.to > m.from ? "#f2495c" : "#1fbf75" }}>{m.to > m.from ? "加息" : "降息"}</td><td className={`${TD} text-slate-400`}>{m.from.toFixed(2)}%</td><td className={`${TD} text-white`}>{m.to.toFixed(2)}%</td><td className={TD} style={{ color: toneOf(m.to - m.from) }}>{((m.to - m.from) * 100).toFixed(0)}bp</td><td className={TD} style={{ color: toneOf(m.ret) }}>{sgn(m.ret)}</td></tr>)}{!study.length && <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-500">近 6 年无利率调整</td></tr>}</tbody>
              </table>
            </div>
            <div className="bg-[#03070c]">
              <SectionHead title="议息日程" />
              <table className="w-full text-[11px]"><tbody>{[...recent, ...upcoming].map((e) => <tr key={e.id} className={ROW}><td className={`${TDL} font-mono text-slate-300`}>{e.date}</td><td className={`${TDL} text-slate-200`}>{e.nameZh || e.name}</td><td className={`${TD} text-slate-400`}>前值 {e.previous ?? "—"}</td><td className={`${TD} text-slate-400`}>预期 {e.consensus ?? "—"}</td><td className={`${TD} text-white`}>{e.actual ?? (e.released ? "—" : "待公布")}</td></tr>)}{!next.length && <tr><td className="px-2 py-3 text-center text-slate-500">近 40 天日历中没有该央行议息</td></tr>}</tbody></table>
              <SectionHead title={`${r.bank} 相关报道（96 小时）`} />
              <FeedList items={feed.items} loading={feed.loading} dense max={30} empty="近 96 小时没有相关报道" />
            </div>
          </div>
          <Note>政策利率与通胀为月度公布值，因此调整只能定位到月份；事件研究以调整当月月初起 20 个交易日的本币对美元变动近似（美国以美元指数衡量）。</Note>
        </>
      )}
    </PanelShell>
  );
}
