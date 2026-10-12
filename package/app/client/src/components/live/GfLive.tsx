/**
 * GF 图形化基本面：一只主标的的完整财务时间序列（营收 / 毛利 / 净利 / 自由现金流 / 每股收益，年度与季度），
 * 派生毛利率、净利率、自由现金流率与同比增速，并与最多 3 个对比标的做最新年度的增长与利润率比较。
 * 与报价页侧栏的“基本面”（单序列速览）、ANR（分析师一致预期）、RV（估值倍数相对比较）角度不同。
 * 数据：平台个股资料接口（公司财报汇总，按标的缓存）。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, toneOf, ucGet } from "@/uc/market/live";
import { Bars, Lines } from "@/uc/hubs/kit";
import { f2, sgn } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { Note, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";

type Fin = { label: string; unit: string; points: Array<{ period: string; value: number }> };
type Prof = { symbol: string; name: string | null; currency: string | null; sector: string | null; industry: string | null; metrics: Array<{ key: string; label: string; value: number | null }>; financials: Fin[] };
const INP = "w-24 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 font-mono text-[11px] text-white outline-none";

const series = (p: Prof | null | undefined, label: string) => p?.financials.find((f) => f.label === label)?.points ?? [];
const byPeriod = (pts: Array<{ period: string; value: number }>) => new Map(pts.map((x) => [x.period.slice(0, 7), x.value]));
function ratio(a: Array<{ period: string; value: number }>, b: Array<{ period: string; value: number }>) {
  const m = byPeriod(b);
  return a.map((x) => { const d = m.get(x.period.slice(0, 7)); return { period: x.period, value: d ? (x.value / d) * 100 : null }; });
}
const yoy = (pts: Array<{ value: number }>, lag: number) => pts.map((x, i) => (i >= lag && pts[i - lag].value ? ((x.value - pts[i - lag].value) / Math.abs(pts[i - lag].value)) * 100 : null));
function summary(p: Prof | null | undefined) {
  const rev = series(p, "年度营收"), ni = series(p, "年度净利润"), gp = series(p, "年度毛利"), fcf = series(p, "自由现金流");
  const last = rev[rev.length - 1], prev = rev[rev.length - 2];
  const m = (a: typeof rev) => { const v = byPeriod(a).get(last?.period.slice(0, 7) ?? ""); return v != null && last ? (v / last.value) * 100 : null; };
  return { period: last?.period ?? null, rev: last?.value ?? null, revG: last && prev ? ((last.value - prev.value) / Math.abs(prev.value)) * 100 : null, gm: m(gp), nm: m(ni), fm: m(fcf), pe: p?.metrics.find((x) => x.key === "pe")?.value ?? null };
}

export function GfLive({ onClose, symbol: initial }: P & { symbol?: string }) {
  const [main, setMain] = useState(initial || "AAPL");
  const [draft, setDraft] = useState(initial || "AAPL");
  const [peers, setPeers] = useState<string[]>(["MSFT", "GOOGL"]);
  const [peerIn, setPeerIn] = useState("");
  const [profs, setProfs] = useState<Record<string, Prof | null>>({});
  const [loading, setLoading] = useState(false);
  const all = useMemo(() => [main, ...peers.filter((x) => x !== main)].slice(0, 4), [main, peers]);
  useEffect(() => {
    let alive = true;
    const need = all.filter((s) => !(s in profs));
    if (!need.length) return;
    setLoading(true);
    void Promise.all(need.map((s) => ucGet<Prof | null>("ucMarket.profile", { symbol: s }).then((p) => [s, p] as const).catch(() => [s, null] as const))).then((r) => { if (alive) { setProfs((m) => ({ ...m, ...Object.fromEntries(r) })); setLoading(false); } });
    return () => { alive = false; };
  }, [all.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = profs[main];
  const rev = series(p, "年度营收"), ni = series(p, "年度净利润"), gp = series(p, "年度毛利"), fcf = series(p, "自由现金流"), eps = series(p, "每股收益(摊薄)");
  const qrev = series(p, "季度营收"), qni = series(p, "季度净利润");
  const gm = ratio(gp, rev), nm = ratio(ni, rev), fm = ratio(fcf, rev);
  const s0 = summary(p);
  const lbl = (x: { period: string }) => x.period.slice(0, 7);
  return (
    <PanelShell code="GF" title="图形化基本面" onClose={onClose} right={<span>{p?.name ?? main}{p?.currency ? ` · ${p.currency}` : ""}</span>}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5 text-[11px] text-slate-400">
        <span>标的</span>
        <input className={INP} value={draft} onChange={(e) => setDraft(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter" && draft) setMain(draft); }} />
        <button type="button" onClick={() => draft && setMain(draft)} className="border border-[#2a3c52] px-2 py-0.5 text-slate-200 hover:bg-[#0a1726]">确定</button>
        <span className="ml-4">对比</span>
        {peers.map((x) => <span key={x} className="flex items-center gap-1 border border-[#1a2a3c] px-1 font-mono">{x}<button type="button" onClick={() => setPeers((a) => a.filter((y) => y !== x))} className="text-slate-500 hover:text-slate-200">×</button></span>)}
        {peers.length < 3 && <><input className={INP} value={peerIn} placeholder="加入代码" onChange={(e) => setPeerIn(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter" && peerIn) { setPeers((a) => [...new Set([...a, peerIn])].slice(0, 3)); setPeerIn(""); } }} /><button type="button" disabled={!peerIn} onClick={() => { setPeers((a) => [...new Set([...a, peerIn])].slice(0, 3)); setPeerIn(""); }} className="border border-[#2a3c52] px-2 py-0.5 text-slate-200 hover:bg-[#0a1726] disabled:opacity-40">加入</button></>}
      </div>
      <Kpis items={[
        ["最近财年营收", s0.rev != null ? fmtCompact(s0.rev) : "—", s0.period ? `财年 ${s0.period.slice(0, 7)}` : undefined],
        ["营收同比", <span style={{ color: toneOf(s0.revG) }}>{sgn(s0.revG, 1)}</span>],
        ["毛利率 / 净利率", `${f2(s0.gm, 1, "%")} / ${f2(s0.nm, 1, "%")}`],
        ["自由现金流率", f2(s0.fm, 1, "%")],
      ]} />
      {!p ? <Empty loading={loading || !(main in profs)} text="该标的暂无财报数据（指数、期货、外汇或部分市场不适用）" /> : <>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="年度营收与净利润" />{rev.length ? <Bars data={rev.map((x) => ({ k: lbl(x), v: x.value, v2: byPeriod(ni).get(x.period.slice(0, 7)) ?? 0 }))} label={["营收", "净利润"]} height={150} /> : <Empty text="无年度营收" />}</div>
          <div className="bg-[#03070c]"><SectionHead title="利润率（%）" />{rev.length ? <Lines series={[{ name: "毛利率", color: "#38bdf8", values: gm.map((x) => x.value) }, { name: "净利率", color: "#fbbf24", values: nm.map((x) => x.value) }, { name: "自由现金流率", color: "#a78bfa", values: fm.map((x) => x.value) }]} xLabels={rev.map(lbl)} height={150} fmt={(v) => v.toFixed(1)} /> : <Empty text="无数据" />}</div>
          <div className="bg-[#03070c]"><SectionHead title="季度营收与同比（%）" />{qrev.length ? <><Bars data={qrev.map((x) => ({ k: lbl(x), v: x.value, v2: byPeriod(qni).get(x.period.slice(0, 7)) ?? 0 }))} label={["营收", "净利润"]} height={130} /><div className="flex gap-2 px-2 pb-1 font-mono text-[10px] text-slate-400">{yoy(qrev, 4).map((g, i) => <span key={i} style={{ color: toneOf(g) }}>{g == null ? "" : `${lbl(qrev[i])} ${sgn(g, 1)}`}</span>)}</div></> : <Empty text="无季度数据" />}</div>
          <div className="bg-[#03070c]"><SectionHead title="每股收益（摊薄）" />{eps.length ? <Bars data={eps.map((x) => ({ k: lbl(x), v: x.value }))} fmt={(v) => v.toFixed(2)} height={150} /> : <Empty text="无每股收益" />}</div>
        </div>
        <SectionHead title="年度明细" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>财年</th><th className={TH}>营收</th><th className={TH}>同比</th><th className={TH}>毛利</th><th className={TH}>净利润</th><th className={TH}>净利同比</th><th className={TH}>自由现金流</th><th className={TH}>每股收益</th></tr></thead>
          <tbody>{rev.map((x, i) => { const k = x.period.slice(0, 7); const g = yoy(rev, 1)[i]; const nis = byPeriod(ni); const nPrev = i ? nis.get(rev[i - 1].period.slice(0, 7)) : undefined; const n0 = nis.get(k); return <tr key={k} className={ROW}><td className={TDL}>{k}</td><td className={`${TD} text-white`}>{fmtCompact(x.value)}</td><td className={TD} style={{ color: toneOf(g) }}>{sgn(g, 1)}</td><td className={TD}>{fmtCompact(byPeriod(gp).get(k))}</td><td className={TD}>{fmtCompact(n0)}</td><td className={TD} style={{ color: toneOf(n0 != null && nPrev ? n0 - nPrev : null) }}>{n0 != null && nPrev ? sgn(((n0 - nPrev) / Math.abs(nPrev)) * 100, 1) : "—"}</td><td className={TD}>{fmtCompact(byPeriod(fcf).get(k))}</td><td className={TD}>{f2(byPeriod(eps).get(k), 2)}</td></tr>; })}</tbody>
        </table>
      </>}
      {all.length > 1 && <>
        <SectionHead title="同业对比（各自最近财年）" sub="币种为各公司财报币种" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>标的</th><th className={THL}>行业</th><th className={TH}>财年</th><th className={TH}>营收</th><th className={TH}>营收同比</th><th className={TH}>毛利率</th><th className={TH}>净利率</th><th className={TH}>自由现金流率</th></tr></thead>
          <tbody>{all.map((s) => { const q = profs[s]; const m = summary(q); return <tr key={s} className={`cursor-pointer ${ROW}`} onClick={() => { setMain(s); setDraft(s); }}><td className={TDL}>{q?.name ?? s}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span>{s === main && <span className="ml-1 text-[9px] text-amber-300">主标的</span>}</td><td className="px-2 text-[10px] text-slate-400">{q?.industry ?? q?.sector ?? (s in profs ? "—" : "…")}</td><td className={TD}>{m.period?.slice(0, 7) ?? "—"}</td><td className={TD}>{fmtCompact(m.rev)} <span className="text-[9px] text-slate-600">{q?.currency ?? ""}</span></td><td className={TD} style={{ color: toneOf(m.revG) }}>{sgn(m.revG, 1)}</td><td className={TD}>{f2(m.gm, 1, "%")}</td><td className={TD}>{f2(m.nm, 1, "%")}</td><td className={TD}>{f2(m.fm, 1, "%")}</td></tr>; })}</tbody>
        </table>
        <Note>点击同业行可切换为主标的。</Note>
      </>}
    </PanelShell>
  );
}
