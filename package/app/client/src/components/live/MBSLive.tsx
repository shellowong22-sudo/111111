/**
 * 抵押债（MBS）26 个小窗功能 —— 全部接实时 / 官方数据，各窗口内容互不重复。
 * 数据：抵押债 ETF 与相关股票实时行情、美债收益率曲线、按揭利率（周度）、美联储机构抵押债操作结果（TBA）、
 * 美联储持仓（抵押债 / 商业抵押债）、证监会证券化披露、经济日历、新闻。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks, useProfile } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { align, annVol, drawdown, f2, heat, perf, rets, rollingVol, sgn, std, useCloses } from "@/uc/hubs/calc";
import { DocList, Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose: () => void };
type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }> };
type Housing = { pmms: Array<{ d: string; m30: number | null; m15: number | null }> };
type Soma = Array<{ d: string; mbs: number; cmbs: number; notes: number; bills: number; tips: number; agencies: number; total: number }>;
type Ambs = Array<{ id: string; date: string; type: string; direction: string; method: string; classType: string; status: string; submitted: number | null; accepted: number | null; details: Array<{ security: string; cusip: string; accepted: number | null; submitted: number | null; weightedPrice: number | null; leastFavorable: number | null }> }>;
type Filing = { id: string; company: string; ticker: string | null; form: string; date: string; items: string[]; url: string };

const useCurves = () => usePolled<Curves>("ucHubs.curves", {}, 1800_000);
const useHousing = () => usePolled<Housing>("ucHubs.housing", {}, 6 * 3600_000);
const useSoma = () => usePolled<Soma>("ucHubs.soma", {}, 6 * 3600_000);
const useAmbs = () => usePolled<Ambs>("ucHubs.ambs", {}, 1800_000);
const y10At = (c: Curves | null, d?: string) => { const row = d ? c?.us.find((x) => x.date <= d) : c?.us[0]; return row?.points.find((p) => p.tenor === "10Y")?.value ?? null; };

const MBS_ETF: Array<[string, string]> = [["MBB", "机构抵押债 ETF"], ["VMBS", "机构抵押债 ETF（二）"], ["SPMB", "抵押债综合 ETF"], ["JMBS", "主动管理抵押债 ETF"], ["GNMA", "吉利美抵押债 ETF"], ["CMBS", "商业抵押债 ETF"], ["MBSD", "抵押债久期对冲 ETF"]];
const MREIT: Array<[string, string]> = [["AGNC", "AGNC 投资"], ["NLY", "Annaly 资本"], ["DX", "Dynex 资本"], ["ARR", "ARMOUR 住宅"], ["TWO", "Two Harbors"], ["STWD", "喜达屋地产信托"], ["BXMT", "黑石抵押信托"], ["ARI", "阿波罗商业地产金融"], ["RITM", "Rithm 资本"], ["REM", "抵押信托 ETF"]];
const SERVICERS: Array<[string, string]> = [["RKT", "Rocket 公司"], ["UWMC", "UWM 控股"], ["COOP", "Mr. Cooper"], ["PFSI", "PennyMac 金融"], ["FNMA", "房利美"], ["FMCC", "房地美"], ["ESNT", "Essent 按揭保险"], ["MTG", "MGIC 按揭保险"], ["RDN", "Radian 按揭保险"]];

/** 一级按揭利差 = 30 年按揭利率 − 10 年美债收益率（周度） */
function usePrimarySpread() {
  const h = useHousing();
  const c = useCurves();
  return useMemo(() => {
    const pm = h.data?.pmms ?? [];
    const us = c.data?.us ?? [];
    if (!pm.length || !us.length) return [] as Array<{ d: string; m30: number; y10: number; s: number }>;
    const byDate = [...us].sort((a, b) => a.date.localeCompare(b.date));
    const first = byDate[0].date;
    const out: Array<{ d: string; m30: number; y10: number; s: number }> = [];
    let j = 0;
    for (const p of pm) {
      if (p.d < first || p.m30 == null) continue;
      while (j + 1 < byDate.length && byDate[j + 1].date <= p.d) j++;
      const y = byDate[j].points.find((x) => x.tenor === "10Y")?.value;
      if (y != null) out.push({ d: p.d, m30: p.m30, y10: y, s: (p.m30 - y) * 100 });
    }
    return out;
  }, [h.data, c.data]);
}

/* 1 */ export function MBSSecInfoPanel({ onClose }: P) {
  const sp = usePrimarySpread();
  const t = useTicks(["MBB", "IEI", "^TNX"]);
  const last = sp[sp.length - 1];
  const vals = sp.map((x) => x.s);
  const pct = last ? (vals.filter((v) => v <= last.s).length / vals.length) * 100 : null;
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return (
    <PanelShell code="MBS-1" title="抵押债市场概览" onClose={onClose}>
      <Kpis items={[["30 年按揭利率", last ? `${last.m30.toFixed(2)}%` : "—", last?.d], ["一级按揭利差", last ? `${last.s.toFixed(0)}bp` : "—", pct != null ? `两年分位 ${pct.toFixed(0)}%` : undefined], ["机构抵押债 ETF", fmtPrice(t.MBB?.price), fmtPct(t.MBB?.changePct)], ["10 年美债", t["^TNX"]?.price ? `${t["^TNX"].price.toFixed(3)}%` : "—", fmtPct(t["^TNX"]?.changePct)]]} />
      <SectionHead title="一级按揭利差（bp）" sub={mean != null ? `区间均值 ${mean.toFixed(0)}bp；高于均值 = 抵押债相对国债便宜` : undefined} />
      <Lines series={[{ name: "利差 bp", color: "#fbbf24", values: vals }, ...(mean != null ? [{ name: "均值", color: "#64748b", values: vals.map(() => mean), dash: true }] : [])]} xLabels={sp.map((x) => x.d.slice(2, 7))} height={180} fmt={(v) => v.toFixed(0)} />
      <SectionHead title="本窗口说明" />
      <div className="px-2 pb-2 text-[11px] leading-relaxed text-slate-400">抵押债窗口组覆盖：实时行情（MBS-9、MBS-20）、收益率与利差（MBS-18、MBS-23）、美联储 TBA 操作与持仓（MBS-7、MBS-10、MBS-25）、证券化披露（MBS-3、MBS-5）、日历（MBS-6）、计算工具（MBS-8、MBS-19）与新闻（MBS-13 ~ MBS-15）。</div>
    </PanelShell>
  );
}

/* 2 */ export function MBSSECFPanel({ onClose }: P) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const all: BoardRow[] = [...MBS_ETF.map(([s, l]) => ({ symbol: s, label: l, group: "抵押债 ETF" })), ...MREIT.map(([s, l]) => ({ symbol: s, label: l, group: "抵押贷款信托" })), ...SERVICERS.map(([s, l]) => ({ symbol: s, label: l, group: "放贷 / 服务 / 按揭保险" }))];
  const rows = all.filter((r) => (cat === "all" || r.group === cat) && (!q || `${r.symbol}${r.label}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <PanelShell code="MBS-2" title="SECF 证券查找" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="代码 / 名称" className="w-40 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" /><Seg value={cat} onChange={setCat} options={[["all", "全部"], ["抵押债 ETF", "ETF"], ["抵押贷款信托", "抵押信托"], ["放贷 / 服务 / 按揭保险", "放贷与保险"]]} /><span className="text-[10px] text-slate-500">{rows.length} 只 · 点击看 K 线</span></div>
      <LiveBoard rows={rows} />
    </PanelShell>
  );
}

function useFilings(q: string, forms: string[], days: number) {
  return usePolled<{ total: number; rows: Filing[] }>("ucHubs.edgar", q ? { q, forms, days } : null, 1800_000);
}
const FORM_ZH: Record<string, string> = { "10-D": "分配报告", "ABS-15G": "资产证券化回购报告", "ABS-EE": "资产级明细", "424B5": "发行说明书", "424B2": "发行说明书", "8-K": "重大事项", "SF-3": "储架注册", "FWP": "自由撰写说明书", "10-K": "年报" };

/* 3 */ export function MBSMTGSPanel({ onClose }: P) {
  const [q, setQ] = useState('"mortgage pass-through certificates"');
  const [input, setInput] = useState(q);
  const [form, setForm] = useState("10-D");
  const f = useFilings(q, [form], 120);
  return (
    <PanelShell code="MBS-3" title="MTGS 抵押债披露检索" onClose={onClose} right={f.data ? <span>近 120 天共 {f.data.total} 份</span> : null}>
      <form onSubmit={(e) => { e.preventDefault(); setQ(input); }} className="flex flex-wrap items-center gap-2 px-2 py-1">
        <input value={input} onChange={(e) => setInput(e.target.value)} className="w-72 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" />
        <Seg value={form} onChange={setForm} options={[["10-D", "分配报告"], ["ABS-15G", "回购报告"], ["424B5", "发行说明书"], ["8-K", "重大事项"]]} />
        <button className="border border-cyan-700 px-2 text-[11px] text-cyan-200">检索</button>
      </form>
      <DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: r.company, sub: `${FORM_ZH[r.form] ?? r.form}（${r.form}）${r.items.length ? ` · 事项 ${r.items.join(", ")}` : ""}`, date: r.date, url: r.url, tag: r.form }))} />
    </PanelShell>
  );
}

/* 4 */ export function MBSMTGHPanel({ onClose }: P) {
  const h = useHousing();
  const [range, setRange] = useState("1400");
  const pm = (h.data?.pmms ?? []).slice(-Number(range));
  const v = pm.map((p) => p.m30).filter((x): x is number => x != null);
  const last = h.data?.pmms[h.data.pmms.length - 1];
  const at = (weeks: number) => h.data?.pmms[h.data.pmms.length - 1 - weeks]?.m30 ?? null;
  return (
    <PanelShell code="MBS-4" title="MTGH 按揭利率历史" onClose={onClose}>
      <Kpis items={[["30 年固定（最新）", last?.m30 != null ? `${last.m30.toFixed(2)}%` : "—", last?.d], ["较 4 周前", last?.m30 != null && at(4) != null ? `${Math.round((last.m30 - at(4)!) * 100)}bp` : "—"], ["较 52 周前", last?.m30 != null && at(52) != null ? `${Math.round((last.m30 - at(52)!) * 100)}bp` : "—"], ["区间高 / 低", v.length ? `${Math.max(...v).toFixed(2)} / ${Math.min(...v).toFixed(2)}` : "—"]]} />
      <SectionHead title="30 年 / 15 年固定按揭利率（%，周度）" right={<Seg value={range} onChange={setRange} options={[["52", "1年"], ["260", "5年"], ["520", "10年"], ["1400", "2000年至今"]]} />} />
      <Lines series={[{ name: "30 年", color: "#38bdf8", values: pm.map((p) => p.m30) }, { name: "15 年", color: "#fbbf24", values: pm.map((p) => p.m15) }, { name: "30−15 利差", color: "#a78bfa", values: pm.map((p) => (p.m30 != null && p.m15 != null ? p.m30 - p.m15 : null)) }]} xLabels={pm.map((p) => p.d.slice(0, 7))} height={230} />
      <SectionHead title="年度均值" />
      <Bars data={Object.entries((h.data?.pmms ?? []).reduce<Record<string, number[]>>((a, p) => { if (p.m30 != null) (a[p.d.slice(0, 4)] ??= []).push(p.m30); return a; }, {})).map(([y, a]) => ({ k: y.slice(2), v: a.reduce((s, x) => s + x, 0) / a.length }))} fmt={(x) => `${x.toFixed(2)}%`} height={120} />
    </PanelShell>
  );
}

/* 5 */ export function MBSNewIssuesPanel({ onClose }: P) {
  const [kind, setKind] = useState("rmbs");
  const Q: Record<string, [string, string[]]> = { rmbs: ['"mortgage pass-through certificates" OR "mortgage-backed notes"', ["424B5", "424B2", "FWP"]], cmbs: ['"commercial mortgage pass-through certificates"', ["424B5", "FWP"]], abs: ['"asset-backed notes" OR "asset backed securities"', ["424B5", "424B2"]], crt: ['"credit risk transfer" OR "STACR" OR "Connecticut Avenue Securities"', ["8-K", "424B5", "FWP"]] };
  const f = useFilings(Q[kind][0], Q[kind][1], 60);
  return (
    <PanelShell code="MBS-5" title="新发行及发售" onClose={onClose} tabs={[["rmbs", "住宅抵押债"], ["cmbs", "商业抵押债"], ["abs", "其他资产支持证券"], ["crt", "信用风险转移"]]} tab={kind} setTab={setKind} right={f.data ? <span>近 60 天 {f.data.total} 份发行文件</span> : null}>
      <DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: r.company, sub: `${FORM_ZH[r.form] ?? r.form}（${r.form}）`, date: r.date, url: r.url, tag: r.form }))} empty="近 60 天暂无此类发行文件" />
    </PanelShell>
  );
}

/* 6 */ type Ev = { id: string; date: string; time: number | null; region: string; nameZh: string; name: string; actual: string | null; consensus: string | null; previous: string | null; importance: number };
export function MBSMCALPanel({ onClose }: P) {
  const today = new Date().toISOString().slice(0, 10);
  const cal = usePolled<Ev[]>("ucNews.calendar", { from: today, days: 10 }, 300_000);
  const ambs = useAmbs();
  const housing = (cal.data ?? []).filter((e) => /hous|home|mortgage|building|construction|case-shiller|pending|mba|permit|rent|real estate|nahb/i.test(e.name) || /房|住宅|按揭|抵押|建筑|营建/.test(e.nameZh));
  return (
    <PanelShell code="MBS-6" title="MCAL 结构金融日历" onClose={onClose}>
      <SectionHead title="未来 10 天住房与按揭相关数据公布" sub={`${housing.length} 项`} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">日期</th><th className="text-left">时间</th><th className="text-left">地区</th><th className="text-left">事件</th><th className="text-right">前值</th><th className="text-right">预期</th><th className="px-2 text-right">公布</th></tr></thead>
        <tbody>{housing.map((e) => <tr key={e.id} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{e.date}</td><td className="font-mono text-slate-500">{e.time ? new Date(e.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="text-slate-400">{e.region}</td><td className="text-slate-100">{"★".repeat(e.importance)} {e.nameZh || e.name}</td><td className="text-right font-mono text-slate-400">{e.previous ?? "—"}</td><td className="text-right font-mono text-slate-300">{e.consensus ?? "—"}</td><td className="px-2 text-right font-mono text-white">{e.actual ?? "待公布"}</td></tr>)}{!housing.length && <tr><td colSpan={7}><Empty loading={cal.loading} text="未来 10 天无住房相关数据" /></td></tr>}</tbody>
      </table>
      <SectionHead title="美联储机构抵押债操作（最近）" />
      <table className="w-full text-[11px]"><tbody>{(ambs.data ?? []).slice(0, 10).map((a) => <tr key={a.id} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{a.date}</td><td className="text-slate-200">{a.type}</td><td className="text-slate-400">{a.direction}</td><td className="px-2 text-right font-mono text-white">{a.accepted != null ? `${fmtCompact(a.accepted)} 美元` : a.status}</td></tr>)}</tbody></table>
    </PanelShell>
  );
}

/* 7 */ export function MBSIMGRPanel({ onClose }: P) {
  const s = useSoma();
  const [range, setRange] = useState("260");
  const rows = (s.data ?? []).slice(-Number(range));
  const last = s.data?.[s.data.length - 1];
  const prev4 = s.data?.[s.data.length - 5];
  const prev52 = s.data?.[s.data.length - 53];
  const peak = s.data ? Math.max(...s.data.map((r) => r.mbs)) : null;
  return (
    <PanelShell code="MBS-7" title="IMGR 美联储抵押债库存" onClose={onClose}>
      <Kpis items={[["持有机构抵押债", last ? `${last.mbs.toFixed(0)} 十亿` : "—", last?.d], ["近 4 周变化", last && prev4 ? `${(last.mbs - prev4.mbs).toFixed(1)} 十亿` : "—", "缩表进度"], ["较一年前", last && prev52 ? `${(last.mbs - prev52.mbs).toFixed(0)} 十亿` : "—"], ["较峰值", last && peak ? `${(((last.mbs - peak) / peak) * 100).toFixed(1)}%` : "—"]]} />
      <SectionHead title="美联储持仓（十亿美元，周度）" right={<Seg value={range} onChange={setRange} options={[["52", "1年"], ["260", "5年"], ["600", "2015年至今"]]} />} />
      <Lines series={[{ name: "机构抵押债", color: "#38bdf8", values: rows.map((r) => r.mbs) }, { name: "中长期国债", color: "#fbbf24", values: rows.map((r) => r.notes) }, { name: "短期国债", color: "#a78bfa", values: rows.map((r) => r.bills) }]} xLabels={rows.map((r) => r.d.slice(2, 7))} height={210} fmt={(v) => v.toFixed(0)} />
      <SectionHead title="每周抵押债持仓变化（十亿美元）" />
      <Bars data={rows.slice(-52).map((r, i, a) => ({ k: r.d.slice(5), v: i ? r.mbs - a[i - 1].mbs : 0 }))} fmt={(v) => v.toFixed(1)} height={120} />
    </PanelShell>
  );
}

/* 8 */ export function MBSSTSHPanel({ onClose }: P) {
  const h = useHousing();
  const rate = h.data?.pmms[h.data.pmms.length - 1]?.m30 ?? 6.5;
  const [bal, setBal] = useState(1_000_000);
  const [wac, setWac] = useState<number | null>(null);
  const [term, setTerm] = useState(360);
  const [psa, setPsa] = useState(150);
  const [disc, setDisc] = useState<number | null>(null);
  const W = (wac ?? +(rate + 0.5).toFixed(3)) / 100 / 12;
  const D = (disc ?? +rate.toFixed(3)) / 100 / 12;
  const sched = useMemo(() => {
    let b = bal;
    const out: Array<{ m: number; bal: number; sched: number; prepay: number; int: number; cf: number }> = [];
    for (let m = 1; m <= term && b > 1; m++) {
      const cpr = Math.min(0.06, (0.002 * Math.min(m, 30))) * (psa / 100);
      const smm = 1 - Math.pow(1 - cpr, 1 / 12);
      const pay = (b * W) / (1 - Math.pow(1 + W, -(term - m + 1)));
      const int = b * W;
      const sp = Math.min(b, pay - int);
      const pre = (b - sp) * smm;
      out.push({ m, bal: b, sched: sp, prepay: pre, int, cf: sp + pre + int });
      b -= sp + pre;
    }
    return out;
  }, [bal, W, term, psa]);
  const pv = sched.reduce((s, r) => s + r.cf / Math.pow(1 + D, r.m), 0);
  const wal = sched.reduce((s, r) => s + (r.m / 12) * (r.sched + r.prepay), 0) / bal;
  const macD = sched.reduce((s, r) => s + (r.m / 12) * (r.cf / Math.pow(1 + D, r.m)), 0) / pv;
  const inp = "w-24 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-[11px] text-white";
  return (
    <PanelShell code="MBS-8" title="STSH 抵押池现金流工具" onClose={onClose} right={<span>当前 30 年按揭利率 {rate.toFixed(2)}%（自动代入）</span>}>
      <div className="flex flex-wrap gap-3 px-2 py-1 text-[11px] text-slate-400">
        <label>本金 <input type="number" value={bal} onChange={(e) => setBal(Number(e.target.value) || 0)} className={inp} /></label>
        <label>加权票息 % <input type="number" step={0.125} value={wac ?? +(rate + 0.5).toFixed(3)} onChange={(e) => setWac(Number(e.target.value) || null)} className={inp} /></label>
        <label>剩余期限（月） <input type="number" value={term} onChange={(e) => setTerm(Math.max(12, Number(e.target.value) || 360))} className={inp} /></label>
        <label>提前还款速度 PSA % <input type="number" step={25} value={psa} onChange={(e) => setPsa(Number(e.target.value) || 0)} className={inp} /></label>
        <label>贴现收益率 % <input type="number" step={0.125} value={disc ?? +rate.toFixed(3)} onChange={(e) => setDisc(Number(e.target.value) || null)} className={inp} /></label>
      </div>
      <Kpis items={[["理论价格（每 100 面值）", f2((pv / bal) * 100, 3)], ["加权平均寿命", `${wal.toFixed(2)} 年`], ["麦考利久期", `${macD.toFixed(2)} 年`], ["总现金流", fmtCompact(sched.reduce((s, r) => s + r.cf, 0))]]} />
      <SectionHead title="月度现金流构成（前 120 个月）" />
      <Lines series={[{ name: "计划本金", color: "#38bdf8", values: sched.slice(0, 120).map((r) => r.sched) }, { name: "提前还款", color: "#f472b6", values: sched.slice(0, 120).map((r) => r.prepay) }, { name: "利息", color: "#fbbf24", values: sched.slice(0, 120).map((r) => r.int) }]} height={170} fmt={(v) => fmtCompact(v)} />
      <SectionHead title="不同提前还款速度下的价格与寿命" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">PSA</th><th className="text-right">价格</th><th className="px-2 text-right">加权平均寿命</th></tr></thead><tbody>{[50, 100, 150, 200, 300, 400].map((p) => { let b = bal, pvv = 0, w = 0; for (let m = 1; m <= term && b > 1; m++) { const cpr = Math.min(0.06, 0.002 * Math.min(m, 30)) * (p / 100); const smm = 1 - Math.pow(1 - cpr, 1 / 12); const pay = (b * W) / (1 - Math.pow(1 + W, -(term - m + 1))); const it = b * W; const sp = Math.min(b, pay - it); const pre = (b - sp) * smm; pvv += (sp + pre + it) / Math.pow(1 + D, m); w += (m / 12) * (sp + pre); b -= sp + pre; } return <tr key={p} className={`border-t border-[#0f1b29] ${p === psa ? "bg-[#0d2236]" : ""}`}><td className="px-2 py-0.5 font-mono text-slate-300">{p}</td><td className="text-right font-mono text-white">{((pvv / bal) * 100).toFixed(3)}</td><td className="px-2 text-right font-mono text-slate-300">{(w / bal).toFixed(2)} 年</td></tr>; })}</tbody></table>
    </PanelShell>
  );
}

/* 9 */ export function MBSCurrentMarketPanel({ onClose }: P) {
  return (
    <PanelShell code="MBS-9" title="当前市场" onClose={onClose}>
      <LiveBoard rows={[...MBS_ETF.map(([s, l]) => ({ symbol: s, label: l, group: "抵押债 ETF" })), ...[["^IRX", "13 周美债"], ["^FVX", "5 年美债"], ["^TNX", "10 年美债"], ["^MOVE", "美债波动率"]].map(([s, l]) => ({ symbol: s, label: l, group: "利率基准" })), ...[["ZF=F", "5 年美债期货"], ["ZN", "10 年美债期货"]].map(([s, l]) => ({ symbol: s, label: l, group: "对冲工具" }))]} />
    </PanelShell>
  );
}

/* 10 */ export function MBSTBPFPanel({ onClose }: P) {
  const a = useAmbs();
  const [sel, setSel] = useState<string | null>(null);
  const list = a.data ?? [];
  const cur = list.find((x) => x.id === sel) ?? list.find((x) => x.details.length) ?? list[0];
  const byType = list.reduce<Record<string, number>>((acc, x) => { acc[x.type] = (acc[x.type] ?? 0) + (x.accepted ?? 0); return acc; }, {});
  return (
    <PanelShell code="MBS-10" title="TBPF 美联储 TBA 操作表现" onClose={onClose} right={<span>{list.length} 次操作</span>}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]">
          <SectionHead title="操作结果" />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">日期</th><th className="text-left">类型</th><th className="text-right">投标</th><th className="text-right">成交</th><th className="px-2 text-right">中标率</th></tr></thead>
            <tbody>{list.map((x) => <tr key={x.id} onClick={() => setSel(x.id)} className={`cursor-pointer border-t border-[#0f1b29] ${cur?.id === x.id ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 font-mono text-slate-400">{x.date}</td><td className="text-slate-200">{x.type}</td><td className="text-right font-mono text-slate-400">{fmtCompact(x.submitted)}</td><td className="text-right font-mono text-white">{fmtCompact(x.accepted)}</td><td className="px-2 text-right font-mono text-slate-300">{x.submitted && x.accepted != null ? `${((x.accepted / x.submitted) * 100).toFixed(1)}%` : "—"}</td></tr>)}{!list.length && <tr><td colSpan={5}><Empty loading={a.loading} /></td></tr>}</tbody>
          </table>
        </div>
        <div className="bg-[#03070c]">
          <SectionHead title={cur ? `${cur.date} ${cur.type}：按券种明细` : "明细"} />
          {cur?.details.length ? <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">券种</th><th className="text-right">成交面值</th><th className="text-right">加权价格</th><th className="px-2 text-right">最差价格</th></tr></thead><tbody>{cur.details.map((d, i) => <tr key={i} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{d.security}</td><td className="text-right font-mono text-white">{fmtCompact(d.accepted)}</td><td className="text-right font-mono text-slate-300">{f2(d.weightedPrice, 4)}</td><td className="px-2 text-right font-mono text-slate-400">{f2(d.leastFavorable, 4)}</td></tr>)}</tbody></table> : <Empty text="该次操作无券种明细" />}
          <SectionHead title="按操作类型累计成交（美元）" />
          <Bars data={Object.entries(byType).map(([k, v]) => ({ k: k.replace(/Outright |Purchase|Sale|Coupon Swap/g, (m) => ({ "Outright ": "", Purchase: "买入", Sale: "卖出", "Coupon Swap": "票息互换" } as Record<string, string>)[m] ?? m), v }))} height={130} />
        </div>
      </div>
    </PanelShell>
  );
}

/* 11 */ export function MBSRatingTrendPanel({ onClose }: P) {
  const syms = ["CMBS", "IEI", "BXP", "SLG", "VNO", "KRE", "XLRE", "MBB"];
  const pack = useCloses(syms, 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const rel = (a: string, b: string) => { const r = (m[a] ?? []).map((v, i) => v / m[b][i]); const base = r[0]; return r.map((v) => (base ? (v / base - 1) * 100 : null)); };
  const office = (m.BXP ?? []).map((_, i) => ((m.BXP[i] / m.BXP[0]) + (m.SLG[i] / m.SLG[0]) + (m.VNO[i] / m.VNO[0])) / 3 * 100 - 100);
  return (
    <PanelShell code="MBS-11" title="信用与评级压力（商业地产）" onClose={onClose}>
      <SectionHead title="商业抵押债相对国债、写字楼信托、地区银行（%，两年）" sub="写字楼与地区银行走弱、商业抵押债跑输国债，通常领先于商业抵押债评级下调" />
      <Lines zero series={[{ name: "商业抵押债 / 国债", color: "#38bdf8", values: rel("CMBS", "IEI") }, { name: "写字楼信托等权", color: "#f472b6", values: office }, { name: "地区银行 / 地产", color: "#fbbf24", values: rel("KRE", "XLRE") }, { name: "机构抵押债 / 国债", color: "#94a3b8", values: rel("MBB", "IEI") }]} xLabels={dates.map((d) => d.slice(2))} height={220} fmt={(v) => v.toFixed(1)} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="px-2 text-right">1年最大回撤</th></tr></thead><tbody>{[["CMBS", "商业抵押债 ETF"], ["BXP", "BXP 写字楼"], ["SLG", "SL Green 写字楼"], ["VNO", "沃那多"], ["KRE", "地区银行"]].map(([s, l]) => { const c = m[s] ?? []; return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{l}</td>{[21, 63, 252].map((n) => <td key={n} className="text-right font-mono" style={{ background: heat(perf(c, n), 15) }}>{sgn(perf(c, n), 1)}</td>)}<td className="px-2 text-right font-mono text-emerald-300">{c.length ? sgn(drawdown(c.slice(-252)).max, 1) : "—"}</td></tr>; })}</tbody></table>
    </PanelShell>
  );
}

/* 12 */ export function MBSBMMIPanel({ onClose }: P) {
  const sp = usePrimarySpread();
  const soma = useSoma();
  const pack = useCloses(["MBB", "IEI", "AGNC", "NLY", "^MOVE"], 400);
  const c = (s: string) => (pack.data?.[s] ?? []).map((x) => x[1]);
  const spv = sp.map((x) => x.s);
  const lastS = spv[spv.length - 1];
  const spPct = spv.length ? (spv.filter((v) => v <= lastS).length / spv.length) * 100 : null;
  const rel3 = perf(c("MBB"), 63) != null && perf(c("IEI"), 63) != null ? perf(c("MBB"), 63)! - perf(c("IEI"), 63)! : null;
  const mreit = ((perf(c("AGNC"), 21) ?? 0) + (perf(c("NLY"), 21) ?? 0)) / 2;
  const mv = c("^MOVE");
  const movePct = mv.length ? (mv.filter((v) => v <= mv[mv.length - 1]).length / mv.length) * 100 : null;
  const s = soma.data ?? [];
  const runoff = s.length > 5 ? (s[s.length - 1].mbs - s[s.length - 5].mbs) : null;
  const sig: Array<[string, string, string, string]> = [
    ["一级按揭利差", lastS != null ? `${lastS.toFixed(0)}bp` : "—", spPct != null ? `两年分位 ${spPct.toFixed(0)}%` : "", spPct == null ? "#94a3b8" : spPct > 70 ? "#f2495c" : spPct < 30 ? "#1fbf75" : "#94a3b8"],
    ["抵押债相对国债（3 月）", sgn(rel3), rel3 == null ? "" : rel3 > 0 ? "抵押债跑赢，利差收窄" : "抵押债跑输，利差走阔", toneOf(rel3)],
    ["抵押信托近 1 月", sgn(mreit), mreit > 0 ? "杠杆买盘积极" : "杠杆资金去风险", toneOf(mreit)],
    ["美债波动率分位", movePct != null ? `${movePct.toFixed(0)}%` : "—", "波动越高，提前还款期权越贵、抵押债越弱", movePct == null ? "#94a3b8" : movePct > 70 ? "#1fbf75" : "#f2495c"],
    ["美联储 4 周减持", runoff != null ? `${runoff.toFixed(1)} 十亿` : "—", "持续减持意味着最大买家缺席", "#94a3b8"],
  ];
  return (
    <PanelShell code="MBS-12" title="BMMI 市场洞察" onClose={onClose}>
      <SectionHead title="抵押债市场五项核心指标" />
      <table className="w-full text-[11px]"><tbody>{sig.map(([k, v, note, col]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-1.5 text-slate-200">{k}</td><td className="text-right font-mono text-[14px]" style={{ color: col }}>{v}</td><td className="px-2 text-[10px] text-slate-500">{note}</td></tr>)}</tbody></table>
      <SectionHead title="抵押债 ETF 与 5 年国债 ETF 60 日滚动波动率（%）" />
      <Lines series={[{ name: "机构抵押债", color: "#38bdf8", values: rollingVol(c("MBB"), 60).slice(-250) }, { name: "3–7 年国债", color: "#fbbf24", values: rollingVol(c("IEI"), 60).slice(-250) }]} height={150} />
    </PanelShell>
  );
}

/* 13 */ export function MBSNewsResearchPanel({ onClose }: P) {
  const [t, setT] = useState("mbs");
  const Q: Record<string, string> = { mbs: "mortgage-backed OR MBS OR 抵押贷款支持证券 OR agency mortgage", house: "housing market OR home sales OR 房价 OR 住房 OR housing starts", rate: "mortgage rates OR 按揭利率 OR 房贷利率", cre: "commercial real estate OR CMBS OR office loans OR 商业地产" };
  const feed = useFeed({ q: Q[t], limit: 150, hours: 168 });
  return <PanelShell code="MBS-13" title="新闻与研究报告" onClose={onClose} tabs={[["mbs", "抵押债"], ["house", "住房市场"], ["rate", "按揭利率"], ["cre", "商业地产"]]} tab={t} setTab={setT} right={<span>{feed.items.length} 条</span>}><FeedList items={feed.items} loading={feed.loading} dense /></PanelShell>;
}

/* 14 */ export function MBSFIRSPanel({ onClose }: P) {
  const flash = useFeed({ q: "mortgage OR housing OR 按揭 OR 房贷 OR 地产 OR Fannie OR Freddie OR Ginnie", kind: "flash", limit: 120, hours: 48 });
  const press = usePolled<Array<{ id: string; title: string; link: string; date: number; desc: string; label: string }>>("ucHubs.press", { keys: ["cfpb", "fedbank"] }, 900_000);
  return (
    <PanelShell code="MBS-14" title="FIRS 快讯与监管首发" onClose={onClose}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="住房与按揭快讯（48 小时）" sub={`${flash.items.length} 条`} /><FeedList items={flash.items} loading={flash.loading} dense /></div>
        <div className="bg-[#03070c]"><SectionHead title="消费金融与银行监管首发公告" /><DocList loading={press.loading} rows={(press.data ?? []).map((p) => ({ id: p.id, title: p.title, sub: p.label, date: p.date, url: p.link, summary: p.desc }))} /></div>
      </div>
    </PanelShell>
  );
}

/* 15 */ export function MBSNIPanel({ onClose }: P) {
  const feed = useFeed({ q: "securitization OR asset-backed OR CLO OR ABS OR 资产证券化 OR 证券化", limit: 150, hours: 336 });
  const f = useFilings('"asset-backed" OR "collateralized loan obligation"', ["8-K"], 30);
  return (
    <PanelShell code="MBS-15" title="NI 结构融资动态" onClose={onClose}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="结构融资新闻（两周）" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></div>
        <div className="bg-[#03070c]"><SectionHead title="证券化相关重大事项公告（30 天）" sub={f.data ? `${f.data.total} 份` : undefined} /><DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: r.company, sub: `重大事项 ${r.items.join(", ")}`, date: r.date, url: r.url, tag: r.form }))} /></div>
      </div>
    </PanelShell>
  );
}

function EtfAnalytics({ code, title, list, onClose }: { code: string; title: string; list: Array<[string, string]> } & P) {
  const [s, setS] = useState(list[0][0]);
  const pack = useCloses(list.map(([x]) => x), 760);
  const c = (pack.data?.[s] ?? []).map((x) => x[1]);
  const t = useTicks([s]);
  const dd = drawdown(c.slice(-252));
  const { pick } = useHub();
  return (
    <PanelShell code={code} title={title} onClose={onClose} tabs={list.map(([x, l]) => [x, l])} tab={s} setTab={setS}>
      <Kpis items={[["最新", fmtPrice(t[s]?.price), fmtPct(t[s]?.changePct)], ["1 年收益", sgn(perf(c, 252))], ["1 年波动率", f2(annVol(c, 252), 2, "%")], ["1 年最大回撤", sgn(dd.max)]]} />
      <SectionHead title="两年走势（收盘）" right={<button type="button" onClick={() => pick(s)} className="text-[10px] text-cyan-300 hover:underline">K 线与买卖点 ›</button>} />
      <Lines series={[{ name: s, color: "#38bdf8", values: c.slice(-500) }]} height={180} fmt={(v) => v.toFixed(2)} />
      <SectionHead title="月度收益（%）" />
      <Bars data={Array.from({ length: 24 }, (_, i) => { const e = c.length - 1 - (23 - i) * 21; return { k: `${24 - i}`, v: e - 21 >= 0 ? (c[e] / c[e - 21] - 1) * 100 : 0 }; })} fmt={(v) => `${v.toFixed(2)}%`} height={110} />
      <SectionHead title="与其他同类 ETF 的相关系数（日收益，1 年）" />
      <table className="w-full text-[11px]"><tbody>{list.filter(([x]) => x !== s).map(([x, l]) => { const a = rets(c.slice(-253)), b = rets((pack.data?.[x] ?? []).map((y) => y[1]).slice(-253)); const n = Math.min(a.length, b.length); const A = a.slice(-n), B = b.slice(-n); const ma = A.reduce((p, q) => p + q, 0) / n, mb = B.reduce((p, q) => p + q, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (A[i] - ma) * (B[i] - mb); sxx += (A[i] - ma) ** 2; syy += (B[i] - mb) ** 2; } const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null; return <tr key={x} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{l}</td><td className="px-2 text-right font-mono text-white">{f2(r, 3)}</td></tr>; })}</tbody></table>
    </PanelShell>
  );
}
/* 16 */ export function MBSGNAnalysisPanel({ onClose }: P) {
  return <EtfAnalytics code="MBS-16" title="吉利美 / 机构抵押债深度分析" list={[["GNMA", "吉利美"], ["MBB", "机构综合"], ["VMBS", "机构综合（二）"], ["SPMB", "抵押债综合"]]} onClose={onClose} />;
}

/* 17 */ export function MBSDESPanel({ onClose }: P) {
  const [s, setS] = useState("AGNC");
  const p = useProfile(s);
  const t = useTicks([s]);
  return (
    <PanelShell code="MBS-17" title="DES 证券简介" onClose={onClose} tabs={MREIT.slice(0, 9).map(([x, l]) => [x, l])} tab={s} setTab={setS}>
      <Kpis items={[["最新", fmtPrice(t[s]?.price), fmtPct(t[s]?.changePct)], ["交易所", p.data?.exchange ?? "—"], ["行业", p.data?.industry ?? p.data?.sector ?? "—"], ["币种", p.data?.currency ?? "—"]]} />
      <SectionHead title="估值与经营指标" />
      <table className="w-full text-[11px]"><tbody>{(p.data?.metrics ?? []).map((m) => <tr key={m.key} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-400">{m.label}</td><td className="px-2 text-right font-mono text-white">{m.value == null ? "—" : `${Math.abs(m.value) >= 1e6 ? fmtCompact(m.value) : m.value.toFixed(2)}${m.unit ?? ""}`}</td></tr>)}{!p.data && <tr><td><Empty loading={p.loading} /></td></tr>}</tbody></table>
      {(p.data?.financials ?? []).slice(0, 3).map((f) => <div key={f.label}><SectionHead title={`${f.label}（${f.unit}）`} /><Bars data={f.points.map((x) => ({ k: x.period.slice(0, 7), v: x.value }))} height={100} /></div>)}
    </PanelShell>
  );
}

/* 18 */ export function MBSYTPanel({ onClose }: P) {
  const c = useCurves();
  const h = useHousing();
  const now = c.data?.us[0];
  const m30 = h.data?.pmms[h.data.pmms.length - 1]?.m30 ?? null;
  const m15 = h.data?.pmms[h.data.pmms.length - 1]?.m15 ?? null;
  const pt = (t: string) => now?.points.find((p) => p.tenor === t)?.value ?? null;
  const rows: Array<[string, number | null, string]> = [["30 年固定按揭", m30, "周度"], ["15 年固定按揭", m15, "周度"], ["按揭 − 10 年美债", m30 != null && pt("10Y") != null ? (m30 - pt("10Y")!) * 100 : null, "bp"], ["按揭 − 5 年美债", m30 != null && pt("5Y") != null ? (m30 - pt("5Y")!) * 100 : null, "bp"], ["15 年按揭 − 5 年美债", m15 != null && pt("5Y") != null ? (m15 - pt("5Y")!) * 100 : null, "bp"]];
  return (
    <PanelShell code="MBS-18" title="YT 收益率表" onClose={onClose} right={now ? <span>美债 {now.date}</span> : null}>
      <SectionHead title="按揭利率与利差" />
      <table className="w-full text-[11px]"><tbody>{rows.map(([k, v, u]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-200">{k}</td><td className="px-2 text-right font-mono text-white">{v == null ? "—" : u === "bp" ? `${v.toFixed(0)} bp` : `${v.toFixed(2)}%`}</td></tr>)}</tbody></table>
      <SectionHead title="美债收益率（全部期限）" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">收益率</th><th className="text-right">1周</th><th className="px-2 text-right">1月</th></tr></thead><tbody>{(now?.points ?? []).map((p) => { const d = (k: number) => { const o = c.data?.us[k]?.points.find((x) => x.tenor === p.tenor)?.value; return o != null ? Math.round((p.value - o) * 100) : null; }; return <tr key={p.tenor} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-300">{p.tenor}</td><td className="text-right font-mono text-white">{p.value.toFixed(2)}%</td><td className="text-right font-mono" style={{ background: heat(d(5), 30) }}>{d(5) ?? "—"}</td><td className="px-2 text-right font-mono" style={{ background: heat(d(21), 50) }}>{d(21) ?? "—"}</td></tr>; })}</tbody></table>
    </PanelShell>
  );
}

/* 19 */ export function MBSFIBCPanel({ onClose }: P) {
  const c = useCurves();
  const [coupon, setCoupon] = useState(4.5);
  const [years, setYears] = useState(10);
  const [freq, setFreq] = useState(2);
  const [spread, setSpread] = useState(50);
  const ten = c.data?.us[0]?.points;
  const tenorY = (t: string) => ({ "1M": 1 / 12, "2M": 2 / 12, "3M": 0.25, "4M": 1 / 3, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3, "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30 } as Record<string, number>)[t];
  const base = (() => { const p = (ten ?? []).map((x) => [tenorY(x.tenor), x.value] as [number, number]).filter(([t]) => t != null).sort((a, b) => a[0] - b[0]); if (!p.length) return 4; for (let i = 1; i < p.length; i++) if (years <= p[i][0]) { const [t0, r0] = p[i - 1], [t1, r1] = p[i]; return r0 + ((r1 - r0) * (years - t0)) / (t1 - t0); } return p[p.length - 1][1]; })();
  const ytm = base + spread / 100;
  const price = (y: number) => { const n = Math.round(years * freq), cpn = coupon / freq, r = y / 100 / freq; let pv = 0; for (let i = 1; i <= n; i++) pv += cpn / Math.pow(1 + r, i); return pv + 100 / Math.pow(1 + r, n); };
  const P0 = price(ytm), Pu = price(ytm + 0.01), Pd = price(ytm - 0.01);
  const modDur = (Pd - Pu) / (2 * P0 * 0.0001);
  const conv = (Pu + Pd - 2 * P0) / (P0 * 0.0001 ** 2);
  const inp = "w-20 border border-[#1d3047] bg-[#07111c] px-1 text-right font-mono text-[11px] text-white";
  return (
    <PanelShell code="MBS-19" title="FIBC 债券计算器" onClose={onClose} right={<span>基准：同期限美债 {base.toFixed(3)}%（实时曲线插值）</span>}>
      <div className="flex flex-wrap gap-3 px-2 py-1 text-[11px] text-slate-400"><label>票息 % <input type="number" step={0.125} value={coupon} onChange={(e) => setCoupon(Number(e.target.value) || 0)} className={inp} /></label><label>剩余年限 <input type="number" step={0.5} value={years} onChange={(e) => setYears(Math.max(0.5, Number(e.target.value) || 1))} className={inp} /></label><label>付息频率 <Seg value={String(freq)} onChange={(v) => setFreq(Number(v))} options={[["1", "年"], ["2", "半年"], ["4", "季"], ["12", "月"]]} /></label><label>对美债利差 bp <input type="number" step={5} value={spread} onChange={(e) => setSpread(Number(e.target.value) || 0)} className={inp} /></label></div>
      <Kpis items={[["到期收益率", `${ytm.toFixed(3)}%`], ["全价（每 100）", P0.toFixed(4)], ["修正久期", modDur.toFixed(3)], ["凸性", conv.toFixed(2)], ["DV01（每百万）", (modDur * P0 * 0.0001 * 10000).toFixed(0)], ["基点价值", (P0 - Pu).toFixed(4)], ["当前收益率", `${((coupon / P0) * 100).toFixed(3)}%`], ["溢价 / 折价", P0 >= 100 ? "溢价" : "折价"]]} />
      <SectionHead title="价格—收益率曲线" />
      <Lines series={[{ name: "价格", color: "#38bdf8", values: Array.from({ length: 21 }, (_, i) => price(ytm - 2 + i * 0.2)) }]} xLabels={Array.from({ length: 21 }, (_, i) => (ytm - 2 + i * 0.2).toFixed(1))} height={170} />
    </PanelShell>
  );
}

/* 20 */ export function MBSQPanel({ onClose }: P) {
  const q = usePolled<Array<{ symbol: string; price: number | null; iv30: number | null; rv20: number | null; changePct: number | null }>>("ucHubs.ivScan", { symbols: [...MREIT.map(([s]) => s), ...SERVICERS.slice(0, 4).map(([s]) => s)] }, 300_000);
  const name = Object.fromEntries([...MREIT, ...SERVICERS]);
  return (
    <PanelShell code="MBS-20" title="Q 市场报价" onClose={onClose}>
      <LiveBoard rows={[...MREIT.map(([s, l]) => ({ symbol: s, label: l, group: "抵押贷款信托" })), ...SERVICERS.map(([s, l]) => ({ symbol: s, label: l, group: "放贷机构 / 按揭保险" }))]} extra={[{ head: "30日隐波", cell: (s) => { const r = q.data?.find((x) => x.symbol === s); return <span className="text-amber-200">{f2(r?.iv30, 1)}</span>; } }, { head: "20日实波", cell: (s) => f2(q.data?.find((x) => x.symbol === s)?.rv20, 1) }]} />
      <div className="px-2 py-1 text-[10px] text-slate-500">{Object.keys(name).length} 只按揭产业链标的；隐含波动率来自挂牌期权。</div>
    </PanelShell>
  );
}

/* 21 */ export function MBSCMAPPanel({ onClose }: P) {
  const SEG: Array<[string, string]> = [["BXP", "写字楼"], ["SLG", "写字楼（纽约）"], ["SPG", "购物中心"], ["O", "零售净租赁"], ["PLD", "物流仓储"], ["AVB", "公寓"], ["EQR", "公寓（二）"], ["HST", "酒店"], ["WELL", "医疗养老"], ["EQIX", "数据中心"], ["PSA", "自助仓储"], ["CMBS", "商业抵押债 ETF"]];
  const pack = useCloses(SEG.map(([s]) => s), 400);
  const ticks = useTicks(SEG.map(([s]) => s));
  const { pick } = useHub();
  return (
    <PanelShell code="MBS-21" title="CMAP 商业地产与商业抵押债地图" onClose={onClose}>
      <SectionHead title="按物业类型的表现热力（商业抵押债抵押品的风险地图）" />
      <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] sm:grid-cols-3 lg:grid-cols-4">
        {SEG.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const v = perf(c, 63); return <button key={s} type="button" onClick={() => pick(s)} className="px-2 py-2 text-left" style={{ background: heat(v, 20) ?? "#050b13" }}><div className="text-[11px] text-white">{l}</div><div className="font-mono text-[10px] text-slate-300">{s} · 今日 {fmtPct(ticks[s]?.changePct)}</div><div className="font-mono text-[13px] text-white">3月 {sgn(v, 1)}</div><div className="font-mono text-[10px] text-slate-300">1年 {sgn(perf(c, 252), 1)}</div></button>; })}
      </div>
      <div className="px-2 py-1 text-[10px] text-slate-500">商业抵押债的违约风险集中在写字楼与零售，物流、数据中心与公寓相对稳健；颜色为近 3 个月涨跌。</div>
    </PanelShell>
  );
}

/* 22 */ export function MBSIndexPanel({ onClose }: P) {
  const L: Array<[string, string, string]> = [["MBB", "机构抵押债", "#38bdf8"], ["GNMA", "吉利美", "#34d399"], ["CMBS", "商业抵押债", "#f472b6"], ["IEI", "3–7 年国债", "#94a3b8"], ["LQD", "投资级公司债", "#fbbf24"]];
  const pack = useCloses(L.map(([s]) => s), 1300);
  const [range, setRange] = useState("500");
  const { dates, m } = useMemo(() => align(pack.data ?? null, L.map(([s]) => s)), [pack.data]);
  const n = Number(range);
  return (
    <PanelShell code="MBS-22" title="抵押债指数" onClose={onClose}>
      <SectionHead title="抵押债指数化表现（起点为 100）" right={<Seg value={range} onChange={setRange} options={[["126", "半年"], ["250", "1年"], ["500", "2年"], ["1250", "5年"]]} />} />
      <Lines series={L.map(([s, l, col]) => { const c = (m[s] ?? []).slice(-n); return { name: l, color: col, values: c.map((v) => (c[0] ? (v / c[0]) * 100 : null)) }; })} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={230} fmt={(v) => v.toFixed(1)} />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">指数代理</th><th className="text-right">区间收益</th><th className="text-right">年化波动</th><th className="px-2 text-right">最大回撤</th></tr></thead><tbody>{L.map(([s, l]) => { const c = (m[s] ?? []).slice(-n); return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{l}</td><td className="text-right font-mono" style={{ color: toneOf(c.length ? c[c.length - 1] / c[0] - 1 : null) }}>{c.length ? sgn((c[c.length - 1] / c[0] - 1) * 100) : "—"}</td><td className="text-right font-mono text-slate-300">{f2(annVol(c), 2)}</td><td className="px-2 text-right font-mono text-emerald-300">{c.length ? sgn(drawdown(c).max) : "—"}</td></tr>; })}</tbody></table>
    </PanelShell>
  );
}

/* 23 */ export function MBSTBPFMCCNPanel({ onClose }: P) {
  const sp = usePrimarySpread();
  const t = useTicks(["^TNX", "^FVX", "MBB"]);
  const last = sp[sp.length - 1];
  const live = last && t["^TNX"]?.price ? (last.m30 - t["^TNX"].price) * 100 : null;
  const chg4 = sp.length > 4 ? sp[sp.length - 1].s - sp[sp.length - 5].s : null;
  return (
    <PanelShell code="MBS-23" title="TBPF 按揭利差实时监测" onClose={onClose}>
      <Kpis items={[["按揭 − 10 年（盘中）", live != null ? `${live.toFixed(0)}bp` : "—", "以最新按揭利率对实时 10 年收益率"], ["周度利差", last ? `${last.s.toFixed(0)}bp` : "—", last?.d], ["4 周变化", chg4 != null ? `${chg4 > 0 ? "+" : ""}${chg4.toFixed(0)}bp` : "—"], ["10 年美债（实时）", t["^TNX"]?.price ? `${t["^TNX"].price.toFixed(3)}%` : "—", fmtPct(t["^TNX"]?.changePct)]]} />
      <SectionHead title="按揭利率与 10 年美债（%）" />
      <Lines series={[{ name: "30 年按揭", color: "#38bdf8", values: sp.map((x) => x.m30) }, { name: "10 年美债", color: "#fbbf24", values: sp.map((x) => x.y10) }]} xLabels={sp.map((x) => x.d.slice(2, 7))} height={170} />
      <SectionHead title="利差周度变化（bp）" />
      <Bars data={sp.slice(-40).map((x, i, a) => ({ k: x.d.slice(5), v: i ? x.s - a[i - 1].s : 0 }))} fmt={(v) => v.toFixed(0)} height={110} />
    </PanelShell>
  );
}

/* 24 */ export function MBSAssetClassPanel({ onClose }: P) {
  const L: Array<[string, string]> = [["MBB", "机构抵押债"], ["CMBS", "商业抵押债"], ["GOVT", "全期限国债"], ["IEI", "3–7 年国债"], ["LQD", "投资级公司债"], ["HYG", "高收益债"], ["MUB", "市政债"], ["EMB", "新兴市场债"], ["TIP", "通胀保值债"]];
  const pack = useCloses(L.map(([s]) => s), 400);
  const rows = L.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const r = rets(c.slice(-253)); const y1 = perf(c, 252); const v = annVol(c, 252); return { s, l, m1: perf(c, 21), m3: perf(c, 63), y1, v, sh: y1 != null && v ? (y1 - 4) / v : null, dd: c.length ? drawdown(c.slice(-252)).max : null, sk: r.length ? (r.reduce((a, x) => a + (x - r.reduce((p, q) => p + q, 0) / r.length) ** 3, 0) / r.length) / Math.pow(std(r), 3) : null }; });
  return (
    <PanelShell code="MBS-24" title="资产类别对比" onClose={onClose}>
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">资产</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="text-right">波动</th><th className="text-right">夏普</th><th className="text-right">偏度</th><th className="px-2 text-right">最大回撤</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{r.l}</td>{[[r.m1, 3], [r.m3, 6], [r.y1, 12]].map(([v, sc], i) => <td key={i} className="text-right font-mono" style={{ background: heat(v as number | null, sc as number) }}>{sgn(v as number | null)}</td>)}<td className="text-right font-mono text-slate-300">{f2(r.v, 2)}</td><td className="text-right font-mono text-white">{f2(r.sh, 2)}</td><td className="text-right font-mono text-slate-400">{f2(r.sk, 2)}</td><td className="px-2 text-right font-mono text-emerald-300">{sgn(r.dd)}</td></tr>)}</tbody>
      </table>
      <Bars data={rows.map((r) => ({ k: r.l, v: r.y1 ?? 0, v2: r.v ?? 0 }))} label={["1 年收益", "波动率"]} fmt={(v) => `${v.toFixed(2)}%`} height={140} />
    </PanelShell>
  );
}

/* 25 */ export function MBSRMBSvsCMBSPanel({ onClose }: P) {
  const pack = useCloses(["MBB", "CMBS"], 1300);
  const soma = useSoma();
  const { dates, m } = useMemo(() => align(pack.data ?? null, ["MBB", "CMBS"]), [pack.data]);
  const ratio = (m.CMBS ?? []).map((v, i) => v / m.MBB[i]);
  const s = (soma.data ?? []).slice(-260);
  return (
    <PanelShell code="MBS-25" title="美国住宅 vs 商业抵押债" onClose={onClose}>
      <SectionHead title="商业抵押债 / 住宅抵押债 相对强弱（五年）" />
      <Lines series={[{ name: "商业 / 住宅", color: "#f472b6", values: ratio }]} xLabels={dates.map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(4)} />
      <SectionHead title="美联储持有：住宅机构抵押债 vs 商业机构抵押债（十亿美元）" />
      <Lines series={[{ name: "住宅", color: "#38bdf8", values: s.map((r) => r.mbs) }, { name: "商业（右轴量级较小）", color: "#fbbf24", values: s.map((r) => r.cmbs * 100) }]} xLabels={s.map((r) => r.d.slice(2, 7))} height={150} fmt={(v) => v.toFixed(0)} />
      <div className="px-2 text-[10px] text-slate-500">商业机构抵押债持仓已放大 100 倍以便同图比较。</div>
      <SectionHead title="两类抵押债 60 日滚动波动率（%）" />
      <Lines series={[{ name: "住宅", color: "#38bdf8", values: rollingVol(m.MBB ?? [], 60).slice(-500) }, { name: "商业", color: "#f472b6", values: rollingVol(m.CMBS ?? [], 60).slice(-500) }]} height={130} />
    </PanelShell>
  );
}

/* 26 */ type K = { t: number; o: number; h: number; l: number; c: number; v: number | null };
export function MBSVolumePerformancePanel({ onClose }: P) {
  const [s, setS] = useState("MBB");
  const k = usePolled<{ candles: K[] }>("ucMarket.kline", { symbol: s, period: "1d", limit: 260 }, 300_000);
  const c = k.data?.candles ?? [];
  const vol = c.map((x) => x.v ?? 0);
  const avg20 = vol.slice(-20).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(20, vol.length));
  const dollar = c.slice(-20).reduce((a, x) => a + (x.v ?? 0) * x.c, 0) / Math.max(1, Math.min(20, c.length));
  const ret = c.map((x, i) => (i ? (x.c / c[i - 1].c - 1) * 100 : 0));
  const amihud = c.slice(-60).reduce((a, x, i, arr) => (i ? a + Math.abs(x.c / arr[i - 1].c - 1) / Math.max(1, (x.v ?? 0) * x.c) : a), 0) / 59 * 1e9;
  return (
    <PanelShell code="MBS-26" title="成交量与表现" onClose={onClose} tabs={MBS_ETF.slice(0, 6).map(([x, l]) => [x, l])} tab={s} setTab={setS}>
      <Kpis items={[["20 日均量", fmtCompact(avg20)], ["20 日均成交额", `${fmtCompact(dollar)} 美元`], ["最新量 / 均量", vol.length ? `${(vol[vol.length - 1] / Math.max(1, avg20)).toFixed(2)} 倍` : "—"], ["流动性冲击系数", amihud.toFixed(3), "越低越容易成交"]]} />
      <SectionHead title="日成交量（近 120 日）" />
      <Bars data={c.slice(-120).map((x, i, a) => ({ k: new Date(x.t).toISOString().slice(5, 10), v: x.v ?? 0, ...(i ? {} : {}) }))} height={120} />
      <SectionHead title="放量日与收益（成交量高于 20 日均量 1.5 倍的交易日）" />
      <table className="w-full text-[11px]"><tbody>{c.map((x, i) => ({ x, i })).filter(({ x, i }) => i >= 20 && (x.v ?? 0) > 1.5 * (vol.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20)).slice(-12).reverse().map(({ x, i }) => <tr key={x.t} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-400">{new Date(x.t).toISOString().slice(0, 10)}</td><td className="text-right font-mono text-slate-200">{fmtCompact(x.v)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(ret[i]) }}>{sgn(ret[i])}</td></tr>)}</tbody></table>
      {!c.length && <Empty loading={k.loading} />}
    </PanelShell>
  );
}
