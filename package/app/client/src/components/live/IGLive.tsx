/**
 * 法律 / 政府 / 行业分组 22 个小窗功能，全部接官方公开数据：
 * 法院案卷与判决、证监会披露、联邦公报（法规 / 拟议法规 / 总统文件）、联邦支出与合同、监管机构新闻稿，以及行业分组实时行情。
 */
import { useEffect, useState } from "react";
import { fmtCompact, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { f2, heat, perf, sgn, useCloses, annVol } from "@/uc/hubs/calc";
import { DocList, Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";

type P = { onClose: () => void };
type Court = { total: number; rows: Array<{ id: string; caseName: string; court: string; courtId: string; date: string; docket: string; nature: string | null; cause: string | null; judge: string | null; snippet: string; url: string | null }> };
type FR = Array<{ id: string; title: string; type: string; abstract: string | null; date: string; agencies: string[]; significant: boolean; effective: string | null; commentsClose: string | null; url: string }>;
type Filing = { id: string; company: string; ticker: string | null; form: string; date: string; items: string[]; url: string };
type Press = Array<{ id: string; title: string; link: string; date: number; desc: string; label: string }>;

const useCourts = (q: string, type: "r" | "o", days: number) => usePolled<Court>("ucHubs.courts", q ? { q, type, days } : null, 1800_000);
const useFR = (o: { agency?: string; type?: string; q?: string; per?: number } | null) => usePolled<FR>("ucHubs.fedRegister", o, 1800_000);
const courtRows = (c: Court | null) => (c?.rows ?? []).map((r) => ({ id: r.id, title: r.caseName, sub: [r.court, r.docket, r.nature, r.judge].filter(Boolean).join(" · "), date: r.date, url: r.url, summary: r.snippet || null }));
const frRows = (f: FR | null) => (f ?? []).map((d) => ({ id: d.id, title: d.title, sub: [d.agencies.join("、"), d.effective ? `生效 ${d.effective}` : null, d.commentsClose ? `意见截止 ${d.commentsClose}` : null].filter(Boolean).join(" · "), date: d.date, url: d.url, summary: d.abstract, tag: d.significant ? `${d.type} · 重大` : d.type }));

function SearchBar({ value, onSubmit, placeholder, extra }: { value: string; onSubmit: (v: string) => void; placeholder: string; extra?: React.ReactNode }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }} className="flex flex-wrap items-center gap-2 px-2 py-1"><input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="w-64 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" /><button className="border border-cyan-700 px-2 text-[11px] text-cyan-200">检索</button>{extra}</form>;
}

const TOPICS: Array<[string, string, string]> = [["sec", "证券", "securities fraud"], ["anti", "反垄断", "antitrust"], ["bk", "破产", "chapter 11 bankruptcy"], ["ip", "知识产权", "patent infringement"], ["emp", "劳动雇佣", "employment discrimination"], ["tax", "税务", "tax refund IRS"], ["env", "环境", "environmental protection"], ["priv", "数据隐私", "data privacy breach"], ["crypto", "加密资产", "cryptocurrency"], ["bank", "银行", "bank regulation"], ["ins", "保险", "insurance coverage dispute"], ["merg", "并购", "merger shareholder"]];

/* 1 BLAW */ export function IGBLAWPanel({ onClose }: P) {
  const [t, setT] = useState("sec");
  const [q, setQ] = useState(TOPICS[0][2]);
  const c = useCourts(q, "r", 30);
  return (
    <PanelShell code="BLAW" title="法律研究平台 · 最新案卷" onClose={onClose} tabs={TOPICS.slice(0, 8).map(([k, l]) => [k, l])} tab={t} setTab={(k) => { setT(k); setQ(TOPICS.find((x) => x[0] === k)![2]); }} right={c.data ? <span>近 30 天 {c.data.total.toLocaleString()} 件</span> : null}>
      <SearchBar value={q} onSubmit={setQ} placeholder="当事人 / 案由 / 关键词（英文）" />
      <DocList loading={c.loading} rows={courtRows(c.data)} />
    </PanelShell>
  );
}

/* 2 BTAX */ export function IGBTAXPanel({ onClose }: P) {
  const [t, setT] = useState("RULE");
  const f = useFR({ agency: "internal-revenue-service", type: t, per: 60 });
  return <PanelShell code="BTAX" title="税务法规动态" onClose={onClose} tabs={[["RULE", "最终法规"], ["PRORULE", "拟议法规"], ["NOTICE", "公告与指引"]]} tab={t} setTab={setT}><DocList loading={f.loading} rows={frRows(f.data)} /></PanelShell>;
}

/* 3 BGOV */ export function IGBGOVPanel({ onClose }: P) {
  const [t, setT] = useState("PRESDOCU");
  const f = useFR(t === "sig" ? { type: "RULE", per: 80 } : { type: t, per: 60 });
  const rows = t === "sig" ? (f.data ?? []).filter((d) => d.significant) : f.data;
  return <PanelShell code="BGOV" title="政府行动" onClose={onClose} tabs={[["PRESDOCU", "总统文件"], ["sig", "重大法规"], ["PRORULE", "拟议法规"]]} tab={t} setTab={setT}><DocList loading={f.loading} rows={frRows(rows ?? null)} empty="暂无" /></PanelShell>;
}

/* 4 INDG */ export function IGINDGPanel({ onClose }: P) {
  const G: Array<[string, string, string]> = [["SOXX", "半导体", "科技"], ["IGV", "软件", "科技"], ["IYZ", "电信服务", "通信"], ["PBS", "传媒娱乐", "通信"], ["KBE", "银行", "金融"], ["KRE", "地区银行", "金融"], ["KIE", "保险", "金融"], ["KCE", "资本市场", "金融"], ["IHE", "制药", "医疗"], ["XBI", "生物科技", "医疗"], ["IHI", "医疗器械", "医疗"], ["IHF", "医疗服务", "医疗"], ["XRT", "零售", "消费"], ["ITB", "住宅建筑", "消费"], ["CARZ", "汽车", "消费"], ["PBJ", "食品饮料", "必需消费"], ["ITA", "航空航天国防", "工业"], ["IYT", "交通运输", "工业"], ["JETS", "航空公司", "工业"], ["XOP", "油气开采", "能源"], ["OIH", "油服", "能源"], ["XME", "金属采矿", "材料"], ["VNQ", "房地产信托", "地产"], ["XLU", "公用事业", "公用事业"]];
  const pack = useCloses(G.map(([s]) => s), 400);
  const t = useTicks(G.map(([s]) => s));
  const { pick } = useHub();
  const [sort, setSort] = useState("m1");
  const rows = G.map(([s, l, g]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); return { s, l, g, d1: t[s]?.changePct ?? null, w1: perf(c, 5), m1: perf(c, 21), m3: perf(c, 63), y1: perf(c, 252), vol: annVol(c, 63) }; }).sort((a, b) => ((b as any)[sort] ?? -1e9) - ((a as any)[sort] ?? -1e9));
  return (
    <PanelShell code="INDG" title="行业分组（24 个细分行业）" onClose={onClose} right={<Seg value={sort} onChange={setSort} options={[["d1", "今日"], ["w1", "1周"], ["m1", "1月"], ["m3", "3月"], ["y1", "1年"]]} />}>
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">行业分组</th><th className="text-left">大类</th><th className="text-right">今日</th><th className="text-right">1周</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="px-2 text-right">波动</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]"><td className="px-2 py-0.5 text-slate-100">{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className="text-[10px] text-slate-500">{r.g}</td>{[[r.d1, 3], [r.w1, 5], [r.m1, 10], [r.m3, 15], [r.y1, 35]].map(([v, sc], i) => <td key={i} className="text-right font-mono" style={{ background: heat(v as number | null, sc as number), color: "#f1f5f9" }}>{sgn(v as number | null, 1)}</td>)}<td className="px-2 text-right font-mono text-slate-400">{f2(r.vol, 1)}</td></tr>)}</tbody>
      </table>
    </PanelShell>
  );
}

/* 5 CL */ export function IGCLPanel({ onClose }: P) {
  const [q, setQ] = useState("Tesla");
  const c = useCourts(`"${q}"`, "r", 365);
  const f = usePolled<{ total: number; rows: Filing[] }>("ucHubs.edgar", { q: `"${q}" lawsuit OR litigation OR complaint`, forms: ["8-K", "10-Q", "10-K"], days: 180 }, 1800_000);
  return (
    <PanelShell code="CL" title="公司诉讼" onClose={onClose} right={c.data ? <span>一年内 {c.data.total} 件案卷</span> : null}>
      <SearchBar value={q} onSubmit={setQ} placeholder="公司名称（英文），如 Apple、Boeing" />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="法院案卷（一年内）" /><DocList loading={c.loading} rows={courtRows(c.data)} /></div>
        <div className="bg-[#03070c]"><SectionHead title="公司披露中涉及诉讼的文件（半年）" sub={f.data ? `${f.data.total} 份` : undefined} /><DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: r.company, sub: r.form, date: r.date, url: r.url, tag: r.form }))} /></div>
      </div>
    </PanelShell>
  );
}

/* 6 BCY */ export function IGBCYPanel({ onClose }: P) {
  const f = usePolled<{ total: number; rows: Filing[] }>("ucHubs.edgar", { q: '"Item 1.03"', forms: ["8-K"], days: 120 }, 1800_000);
  const c = useCourts('"chapter 11"', "r", 30);
  const byMonth = (f.data?.rows ?? []).reduce<Record<string, number>>((a, r) => { a[r.date.slice(0, 7)] = (a[r.date.slice(0, 7)] ?? 0) + 1; return a; }, {});
  return (
    <PanelShell code="BCY" title="破产控制面板" onClose={onClose}>
      <Kpis items={[["上市公司破产公告（120 天）", f.data?.rows.length ?? "—", "第 1.03 项：破产或接管"], ["破产相关案卷（30 天）", c.data?.total.toLocaleString() ?? "—"], ["本月公告", byMonth[new Date().toISOString().slice(0, 7)] ?? 0], ["上月公告", byMonth[new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 7)] ?? 0]]} />
      <Bars data={Object.entries(byMonth).sort().map(([k, v]) => ({ k, v }))} fmt={(v) => v.toFixed(0)} height={90} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="上市公司破产公告" /><DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: `${r.company}${r.ticker ? `（${r.ticker}）` : ""}`, sub: `事项 ${r.items.join(", ")}`, date: r.date, url: r.url, tag: "破产" }))} /></div>
        <div className="bg-[#03070c]"><SectionHead title="破产重整案卷" /><DocList loading={c.loading} rows={courtRows(c.data)} /></div>
      </div>
    </PanelShell>
  );
}

function useList(key: string, init: string[]) {
  const s = useSaved<string[]>(key);
  const [list, setList] = useState<string[] | null>(null);
  useEffect(() => { if (s.data !== undefined && list == null && !s.loading) setList(s.data ?? init); }, [s.data, s.loading]);
  const cur = list ?? init;
  const update = (next: string[]) => { setList(next); void saveItem(key, next); };
  return [cur, update] as const;
}

/* 7 DCKM */ export function IGDCKMPanel({ onClose }: P) {
  const [list, setList] = useList("dckm", ["OpenAI", "Google antitrust", "FTX"]);
  const [sel, setSel] = useState(0);
  const cur = list[Math.min(sel, list.length - 1)];
  const c = useCourts(cur ? `"${cur}"` : "", "r", 365);
  const [add, setAdd] = useState("");
  return (
    <PanelShell code="DCKM" title="案卷关注管理" onClose={onClose} right={<span>关注列表永久保存在平台数据库</span>}>
      <form onSubmit={(e) => { e.preventDefault(); if (add.trim()) { setList([...list, add.trim()].slice(-20)); setAdd(""); } }} className="flex items-center gap-2 px-2 py-1"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="添加关注的当事人 / 案件关键词" className="w-60 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" /><button className="border border-cyan-700 px-2 text-[11px] text-cyan-200">添加</button></form>
      <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="bg-[#03070c]">{list.map((x, i) => <div key={x} className={`flex items-center border-b border-[#0f1b29] ${i === sel ? "bg-[#0d2236]" : ""}`}><button type="button" onClick={() => setSel(i)} className="flex-1 px-2 py-1 text-left text-[11px] text-slate-200">{x}</button><button type="button" onClick={() => setList(list.filter((y) => y !== x))} className="px-2 text-[10px] text-slate-500 hover:text-red-300">移除</button></div>)}</div>
        <div className="bg-[#03070c]"><SectionHead title={cur ? `「${cur}」一年内案卷` : "请先添加关注"} sub={c.data ? `${c.data.total} 件` : undefined} /><DocList loading={c.loading} rows={courtRows(c.data)} /></div>
      </div>
    </PanelShell>
  );
}

/* 8 BBLS */ export function IGBBLSPanel({ onClose }: P) {
  const [q, setQ] = useState("insider trading");
  const [days, setDays] = useState("365");
  const c = useCourts(q, "o", Number(days));
  return (
    <PanelShell code="BBLS" title="判决文书检索" onClose={onClose} right={c.data ? <span>{c.data.total.toLocaleString()} 份判决</span> : null}>
      <SearchBar value={q} onSubmit={setQ} placeholder="法律问题 / 当事人 / 法条（英文）" extra={<Seg value={days} onChange={setDays} options={[["30", "1月"], ["365", "1年"], ["1825", "5年"]]} />} />
      <DocList loading={c.loading} rows={courtRows(c.data)} />
    </PanelShell>
  );
}

/* 9 BLSS */ export function IGBLSSPanel({ onClose }: P) {
  const [list, setList] = useList("blss", ["securities class action", "SEC enforcement", "merger appraisal"]);
  const counts = usePolled<Array<{ key: string; count: number | null }>>("ucHubs.courtCounts", list.length ? { topics: list.map((q) => [q.slice(0, 40), q] as [string, string]), days: 30 } : null, 3600_000);
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel ?? list[0];
  const c = useCourts(cur ?? "", "r", 30);
  const [add, setAdd] = useState("");
  return (
    <PanelShell code="BLSS" title="已保存检索" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (add.trim()) { setList([...list, add.trim()].slice(-16)); setAdd(""); } }} className="flex items-center gap-2 px-2 py-1"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="保存新的检索条件" className="w-60 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" /><button className="border border-cyan-700 px-2 text-[11px] text-cyan-200">保存</button></form>
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">检索条件</th><th className="text-right">近 30 天命中</th><th className="px-2" /></tr></thead><tbody>{list.map((q) => <tr key={q} onClick={() => setSel(q)} className={`cursor-pointer border-t border-[#0f1b29] ${cur === q ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 text-slate-200">{q}</td><td className="text-right font-mono text-white">{counts.data?.find((x) => x.key === q.slice(0, 40))?.count?.toLocaleString() ?? "…"}</td><td className="px-2 text-right"><button type="button" onClick={(e) => { e.stopPropagation(); setList(list.filter((x) => x !== q)); }} className="text-[10px] text-slate-500 hover:text-red-300">删除</button></td></tr>)}</tbody></table>
      <SectionHead title={cur ? `「${cur}」最新结果` : ""} />
      <DocList loading={c.loading} rows={courtRows(c.data)} />
    </PanelShell>
  );
}

/* 10 BLDA */ export function IGBLDAPanel({ onClose }: P) {
  const [list] = useList("blss", ["securities class action", "SEC enforcement", "merger appraisal"]);
  const seen = useSaved<Record<string, string>>("blda");
  const [since, setSince] = useState<Record<string, string> | null>(null);
  useEffect(() => { if (!seen.loading && since == null) setSince(seen.data ?? {}); }, [seen.loading, seen.data]);
  const q0 = list[0] ?? "";
  const res = list.slice(0, 6).map((q) => ({ q }));
  return (
    <PanelShell code="BLDA" title="法律文件提醒" onClose={onClose} right={<button type="button" onClick={() => { const now = new Date().toISOString().slice(0, 10); const next = Object.fromEntries(list.map((q) => [q, now])); setSince(next); void saveItem("blda", next); }} className="border border-cyan-700 px-2 text-cyan-200">全部标为已读</button>}>
      <div className="px-2 py-1 text-[10px] text-slate-500">提醒基于「已保存检索」中的条件：显示上次标记已读之后新出现的案卷{q0 ? "" : "（请先在 BLSS 保存检索）"}。</div>
      {res.map(({ q }) => <AlertBlock key={q} q={q} since={since?.[q] ?? null} />)}
    </PanelShell>
  );
}
function AlertBlock({ q, since }: { q: string; since: string | null }) {
  const c = useCourts(q, "r", 14);
  const fresh = (c.data?.rows ?? []).filter((r) => !since || r.date > since);
  return <div><SectionHead title={`「${q}」`} sub={c.data ? `${fresh.length} 条新案卷${since ? `（${since} 之后）` : "（两周内）"}` : "读取中…"} /><DocList loading={c.loading} rows={courtRows({ total: fresh.length, rows: fresh.slice(0, 8) })} empty="没有新的案卷" /></div>;
}

/* 11 BIP */ export function IGBIP_LITIGATIONPanel({ onClose }: P) {
  const topics = TOPICS.map(([k, , q]) => [k, q] as [string, string]);
  const d30 = usePolled<Array<{ key: string; count: number | null }>>("ucHubs.courtCounts", { topics, days: 30 }, 3600_000);
  const d365 = usePolled<Array<{ key: string; count: number | null }>>("ucHubs.courtCounts", { topics, days: 365 }, 6 * 3600_000);
  const label = Object.fromEntries(TOPICS.map(([k, l]) => [k, l]));
  return (
    <PanelShell code="BIP" title="诉讼概况" onClose={onClose}>
      <SectionHead title="各领域新立案件数量：近 30 天 vs 近一年月均" />
      <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">领域</th><th className="text-right">近 30 天</th><th className="text-right">一年月均</th><th className="px-2 text-right">热度</th></tr></thead>
        <tbody>{TOPICS.map(([k]) => { const a = d30.data?.find((x) => x.key === k)?.count ?? null; const y = d365.data?.find((x) => x.key === k)?.count ?? null; const r = a != null && y ? a / (y / 12) : null; return <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{label[k]}</td><td className="text-right font-mono text-white">{a?.toLocaleString() ?? "…"}</td><td className="text-right font-mono text-slate-400">{y != null ? Math.round(y / 12).toLocaleString() : "…"}</td><td className="px-2 text-right font-mono" style={{ color: r == null ? undefined : r > 1.15 ? "#f2495c" : r < 0.85 ? "#1fbf75" : "#94a3b8" }}>{r == null ? "—" : `${r.toFixed(2)} 倍`}</td></tr>; })}</tbody>
      </table>
      <Bars data={TOPICS.map(([k, l]) => ({ k: l, v: d30.data?.find((x) => x.key === k)?.count ?? 0 }))} fmt={(v) => v.toFixed(0)} height={130} />
    </PanelShell>
  );
}

/* 12 TOP_LAW */ export function IGTOP_LAWPanel({ onClose }: P) {
  const p = usePolled<Press>("ucHubs.press", { keys: ["sec", "fedenf", "cfpb"] }, 900_000);
  const c = useCourts("SEC v.", "r", 14);
  return (
    <PanelShell code="TOP_LAW" title="法律与执法要闻" onClose={onClose}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]"><SectionHead title="监管执法与新闻稿" /><DocList loading={p.loading} rows={(p.data ?? []).map((x) => ({ id: x.id, title: x.title, sub: x.label, date: x.date, url: x.link, summary: x.desc }))} /></div>
        <div className="bg-[#03070c]"><SectionHead title="证监会作为原告的新立案件（两周）" sub={c.data ? `${c.data.total} 件` : undefined} /><DocList loading={c.loading} rows={courtRows(c.data)} /></div>
      </div>
    </PanelShell>
  );
}

/* 13 HELP */ export function IGHELPPanel({ onClose }: P) {
  const st = usePolled<{ types: Array<{ name: string; count: number }> }>("ucHubs.fedRegisterStats", { days: 30 }, 6 * 3600_000);
  const ag = usePolled<Array<{ name: string }>>("ucHubs.spendAgencies", {}, 12 * 3600_000);
  const GUIDE: Array<[string, string]> = [["BLAW / BBLS / CL", "按主题、关键词或公司检索法院案卷与判决，点击条目在终端内阅读全文"], ["DCKM / BLSS / BLDA", "关注当事人、保存检索条件、查看新出现的案卷提醒；保存内容永久写入平台数据库"], ["BCY / BIP / PRAC", "破产公告与案卷、各领域诉讼热度统计"], ["BTAX / BGOV / BILL / BIP_GOVT / GNR", "税务法规、总统文件、拟议法规与意见截止日、各机构发文统计与趋势"], ["SPEN / BGS / BI_BUDG / MAP_VOTE", "联邦机构预算与执行、大额合同与补助、各州联邦支出地图"], ["TOP_LAW / NH_BGV", "监管执法新闻稿与政府新闻"]];
  return (
    <PanelShell code="HELP" title="法律与政府功能指南" onClose={onClose}>
      <Kpis items={[["近 30 天联邦公报文件", st.data ? st.data.types.reduce((a, t) => a + t.count, 0).toLocaleString() : "…"], ["覆盖联邦机构（预算）", ag.data?.length ?? "…"], ["法院数据", "全美联邦法院"], ["更新频率", "每 15–30 分钟"]]} />
      <SectionHead title="功能导航" />
      <table className="w-full text-[11px]"><tbody>{GUIDE.map(([k, v]) => <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-1 font-mono text-amber-300">{k}</td><td className="px-2 text-slate-300">{v}</td></tr>)}</tbody></table>
    </PanelShell>
  );
}

/* 14 PRAC */ export function IGPRACPanel({ onClose }: P) {
  const topics = TOPICS.map(([k, , q]) => [k, q] as [string, string]);
  const d = usePolled<Array<{ key: string; count: number | null }>>("ucHubs.courtCounts", { topics, days: 7 }, 3600_000);
  const [sel, setSel] = useState("sec");
  const q = TOPICS.find((x) => x[0] === sel)![2];
  const c = useCourts(q, "r", 7);
  return (
    <PanelShell code="PRAC" title="实践领域" onClose={onClose}>
      <SectionHead title="各实践领域近 7 天新立案件（点击查看）" />
      <div className="grid grid-cols-3 gap-px bg-[#1a2a3c] sm:grid-cols-4 lg:grid-cols-6">{TOPICS.map(([k, l]) => <button key={k} type="button" onClick={() => setSel(k)} className={`px-2 py-1.5 text-left ${sel === k ? "bg-[#0d2236]" : "bg-[#050b13] hover:bg-[#0a1726]"}`}><div className="text-[11px] text-slate-200">{l}</div><div className="font-mono text-[14px] text-white">{d.data?.find((x) => x.key === k)?.count?.toLocaleString() ?? "…"}</div></button>)}</div>
      <SectionHead title={`${TOPICS.find((x) => x[0] === sel)![1]}：最新案卷`} />
      <DocList loading={c.loading} rows={courtRows(c.data)} />
    </PanelShell>
  );
}

/* 15 BILL */ export function IGBILLPanel({ onClose }: P) {
  const f = useFR({ type: "PRORULE", per: 100 });
  const today = new Date().toISOString().slice(0, 10);
  const open = (f.data ?? []).filter((d) => d.commentsClose && d.commentsClose >= today).sort((a, b) => a.commentsClose!.localeCompare(b.commentsClose!));
  return (
    <PanelShell code="BILL" title="联邦法规制定进程（拟议法规与公众意见期）" onClose={onClose} right={<span>{open.length} 项仍在征求意见</span>}>
      <SectionHead title="即将截止的公众意见期" />
      <DocList loading={f.loading} rows={frRows(open)} empty="暂无开放征求意见的拟议法规" />
      <SectionHead title="最新发布的拟议法规" />
      <DocList rows={frRows((f.data ?? []).slice(0, 30))} />
    </PanelShell>
  );
}

type Agency = { code: string; name: string; abbr: string; fy: string; budget: number; obligated: number; outlay: number; share: number };
/* 16 SPEN */ export function IGSPENPanel({ onClose }: P) {
  const a = usePolled<Agency[]>("ucHubs.spendAgencies", {}, 12 * 3600_000);
  const [code, setCode] = useState<string | null>(null);
  const cur = a.data?.find((x) => x.code === code) ?? a.data?.[0];
  const tr = usePolled<Array<{ fy: number; resources: number | null; obligated: number | null; outlayed: number | null; periods: Array<{ p: number; v: number | null }> }>>("ucHubs.spendTrend", cur ? { code: cur.code } : null, 12 * 3600_000);
  return (
    <PanelShell code="SPEN" title="联邦政府支出" onClose={onClose} right={cur ? <span>财年 {cur.fy}</span> : null}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]"><SectionHead title="各机构预算授权与执行（美元）" /><table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">机构</th><th className="text-right">预算授权</th><th className="text-right">已承诺</th><th className="px-2 text-right">已支出</th></tr></thead><tbody>{(a.data ?? []).slice(0, 40).map((x) => <tr key={x.code} onClick={() => setCode(x.code)} className={`cursor-pointer border-t border-[#0f1b29] ${cur?.code === x.code ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 text-slate-200">{x.name}</td><td className="text-right font-mono text-white">{fmtCompact(x.budget)}</td><td className="text-right font-mono text-slate-300">{fmtCompact(x.obligated)}</td><td className="px-2 text-right font-mono text-slate-400">{fmtCompact(x.outlay)}</td></tr>)}{!a.data && <tr><td colSpan={4}><Empty loading={a.loading} /></td></tr>}</tbody></table></div>
        <div className="bg-[#03070c]"><SectionHead title={cur ? `${cur.name}：各财年预算与执行` : ""} /><Bars data={(tr.data ?? []).map((y) => ({ k: `FY${y.fy}`, v: y.resources ?? 0, v2: y.outlayed ?? 0 }))} label={["预算资源", "已支出"]} height={150} /><SectionHead title="本财年逐期累计承诺额" /><Lines series={(tr.data ?? []).slice(-3).map((y, i) => ({ name: `FY${y.fy}`, color: ["#64748b", "#fbbf24", "#38bdf8"][i + (3 - Math.min(3, (tr.data ?? []).length))] ?? "#38bdf8", values: y.periods.map((p) => p.v) }))} height={150} fmt={(v) => fmtCompact(v)} /></div>
      </div>
    </PanelShell>
  );
}

type Award = { id: string; recipient: string; amount: number; agency: string; sub: string; start: string; end: string; desc: string; naics: string | null };
/* 17 BGS */ export function IGBGSPanel({ onClose }: P) {
  const [days, setDays] = useState("30");
  const a = usePolled<Award[]>("ucHubs.spendAwards", { days: Number(days), kind: "contracts" }, 6 * 3600_000);
  const byAgency = (a.data ?? []).reduce<Record<string, number>>((m, x) => { m[x.agency] = (m[x.agency] ?? 0) + x.amount; return m; }, {});
  return (
    <PanelShell code="BGS" title="联邦合同授予（金额最大）" onClose={onClose} right={<Seg value={days} onChange={setDays} options={[["7", "1周"], ["30", "1月"], ["90", "3月"]]} />}>
      <Bars data={Object.entries(byAgency).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => ({ k: k.replace(/Department of (the )?/, ""), v }))} height={110} />
      <DocList loading={a.loading} rows={(a.data ?? []).map((x) => ({ id: x.id, title: `${x.recipient} · ${fmtCompact(x.amount)} 美元`, sub: [x.agency, x.sub, x.naics, `${x.start} ~ ${x.end}`].filter(Boolean).join(" · "), date: x.start, summary: x.desc, tag: "合同" }))} />
    </PanelShell>
  );
}

/* 18 BI_BUDG */ export function IGBI_BUDGPanel({ onClose }: P) {
  const a = usePolled<Agency[]>("ucHubs.spendAgencies", {}, 12 * 3600_000);
  const g = usePolled<Award[]>("ucHubs.spendAwards", { days: 30, kind: "grants" }, 6 * 3600_000);
  const list = (a.data ?? []).slice(0, 15);
  return (
    <PanelShell code="BI_BUDG" title="预算结构与执行率" onClose={onClose}>
      <SectionHead title="预算占比（前 15 个机构，%）" />
      <Bars data={list.map((x) => ({ k: x.abbr || x.name.slice(0, 6), v: x.share }))} fmt={(v) => `${v.toFixed(2)}%`} height={130} />
      <SectionHead title="预算执行率（已支出 / 预算授权）" />
      <table className="w-full text-[11px]"><tbody>{[...list].sort((x, y) => x.outlay / x.budget - y.outlay / y.budget).map((x) => <tr key={x.code} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{x.name}</td><td className="px-2"><div className="h-2 w-40 bg-[#0f1b29]"><div className="h-2 bg-cyan-500/70" style={{ width: `${Math.min(100, (x.outlay / x.budget) * 100)}%` }} /></div></td><td className="px-2 text-right font-mono text-white">{((x.outlay / x.budget) * 100).toFixed(1)}%</td></tr>)}</tbody></table>
      <SectionHead title="近 30 天金额最大的联邦补助" />
      <DocList loading={g.loading} rows={(g.data ?? []).slice(0, 25).map((x) => ({ id: x.id, title: `${x.recipient} · ${fmtCompact(x.amount)} 美元`, sub: [x.agency, x.sub].filter(Boolean).join(" · "), date: x.start, summary: x.desc, tag: "补助" }))} />
    </PanelShell>
  );
}

type FRStats = { types: Array<{ key: string; name: string; count: number }>; agencies: Array<{ key: string; name: string; count: number }>; weekly: { rule: Array<{ d: string; n: number }>; proposed: Array<{ d: string; n: number }>; presidential: Array<{ d: string; n: number }> } };
/* 19 BIP_GOVT */ export function IGBIP_GOVTPanel({ onClose }: P) {
  const [days, setDays] = useState("30");
  const s = usePolled<FRStats>("ucHubs.fedRegisterStats", { days: Number(days) }, 6 * 3600_000);
  const [ag, setAg] = useState<string | null>(null);
  const f = useFR(ag ? { agency: ag, per: 40 } : null);
  return (
    <PanelShell code="BIP_GOVT" title="政府机构发文概况" onClose={onClose} right={<Seg value={days} onChange={setDays} options={[["7", "1周"], ["30", "1月"], ["90", "3月"]]} />}>
      <Kpis items={(s.data?.types ?? []).map((t) => [t.name, t.count.toLocaleString()] as [string, string])} />
      <SectionHead title="发文最多的机构（点击查看该机构文件）" />
      <Bars data={(s.data?.agencies ?? []).slice(0, 15).map((x) => ({ k: x.name.replace(/ Department$/, ""), v: x.count }))} fmt={(v) => v.toFixed(0)} height={120} />
      <div className="flex flex-wrap gap-1 px-2 py-1">{(s.data?.agencies ?? []).slice(0, 24).map((x) => <button key={x.key} type="button" onClick={() => setAg(x.key)} className={`border px-1.5 text-[10px] ${ag === x.key ? "border-cyan-500 text-cyan-200" : "border-[#1d3047] text-slate-400"}`}>{x.name} {x.count}</button>)}</div>
      {ag && <DocList loading={f.loading} rows={frRows(f.data)} />}
    </PanelShell>
  );
}

/* 20 NH_BGV */ export function IGNH_BGVPanel({ onClose }: P) {
  const [t, setT] = useState("fed");
  const p = usePolled<Press>("ucHubs.press", { keys: t === "fed" ? ["fed", "fedmon"] : t === "bank" ? ["fedbank"] : ["cfpb"] }, 900_000);
  return <PanelShell code="NH_BGV" title="政府新闻" onClose={onClose} tabs={[["fed", "美联储"], ["bank", "银行监管"], ["cfpb", "消费金融"]]} tab={t} setTab={setT}><DocList loading={p.loading} rows={(p.data ?? []).map((x) => ({ id: x.id, title: x.title, sub: x.label, date: x.date, url: x.link, summary: x.desc }))} /></PanelShell>;
}

/* 21 GNR */ export function IGGNRPanel({ onClose }: P) {
  const s = usePolled<FRStats>("ucHubs.fedRegisterStats", { days: 182 }, 6 * 3600_000);
  const w = s.data?.weekly;
  const avg = (a?: Array<{ n: number }>) => (a?.length ? a.reduce((x, y) => x + y.n, 0) / a.length : null);
  const last4 = (a?: Array<{ n: number }>) => (a?.length ? a.slice(-5, -1).reduce((x, y) => x + y.n, 0) / Math.min(4, a.length) : null);
  const ratio = (a?: Array<{ n: number }>) => (avg(a) && last4(a) != null ? last4(a)! / avg(a)! : null);
  return (
    <PanelShell code="GNR" title="监管活跃度分析" onClose={onClose}>
      <Kpis items={[["最终法规：近 4 周 / 半年均值", ratio(w?.rule) != null ? `${ratio(w?.rule)!.toFixed(2)} 倍` : "—"], ["拟议法规：近 4 周 / 均值", ratio(w?.proposed) != null ? `${ratio(w?.proposed)!.toFixed(2)} 倍` : "—"], ["总统文件：近 4 周 / 均值", ratio(w?.presidential) != null ? `${ratio(w?.presidential)!.toFixed(2)} 倍` : "—"], ["统计区间", "近 26 周"]]} />
      <SectionHead title="每周发布数量" />
      <Lines series={[{ name: "最终法规", color: "#38bdf8", values: (w?.rule ?? []).map((x) => x.n) }, { name: "拟议法规", color: "#fbbf24", values: (w?.proposed ?? []).map((x) => x.n) }, { name: "总统文件", color: "#f472b6", values: (w?.presidential ?? []).map((x) => x.n) }]} xLabels={(w?.rule ?? []).map((x) => x.d.slice(5))} height={200} fmt={(v) => v.toFixed(0)} />
      <div className="px-2 py-1 text-[10px] text-slate-500">拟议法规增多通常领先最终法规 2–6 个月；总统文件密集期往往伴随政策方向调整，可对照 BGOV 查看具体文件。</div>
    </PanelShell>
  );
}

/* 22 MAP_VOTE → 联邦支出地图 */
const TILE: Record<string, [number, number]> = { AK: [0, 0], ME: [11, 0], VT: [10, 1], NH: [11, 1], WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2], OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3], CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4], AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5], OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6], HI: [0, 7], TX: [4, 7], FL: [9, 7], PR: [11, 7] };
export function IGMAP_VOTEPanel({ onClose }: P) {
  const [days, setDays] = useState("365");
  const s = usePolled<Array<{ code: string; name: string; amount: number; population: number | null; perCapita: number | null }>>("ucHubs.spendStates", { days: Number(days) }, 12 * 3600_000);
  const [mode, setMode] = useState("pc");
  const list = s.data ?? [];
  const val = (x: (typeof list)[number]) => (mode === "pc" ? x.perCapita ?? 0 : x.amount);
  const max = Math.max(1, ...list.map(val));
  const [hover, setHover] = useState<string | null>(null);
  const h = list.find((x) => x.code === hover);
  return (
    <PanelShell code="MAP_VOTE" title="联邦支出地图（按州）" onClose={onClose} right={<span className="flex gap-2"><Seg value={mode} onChange={setMode} options={[["pc", "人均"], ["total", "总额"]]} /><Seg value={days} onChange={setDays} options={[["90", "3月"], ["365", "1年"]]} /></span>}>
      <div className="px-2 py-1 text-[10px] text-slate-500">投票与选区数据没有可再分发的公开接口，本窗口以各州联邦资金流向反映政策资源分布。</div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c] p-2">
          <svg viewBox="0 0 600 400" className="w-full">
            {list.map((x) => { const p = TILE[x.code]; if (!p) return null; const a = val(x) / max; return <g key={x.code} onMouseEnter={() => setHover(x.code)}><rect x={p[0] * 50 + 2} y={p[1] * 50 + 2} width={46} height={46} fill={`rgba(56,189,248,${0.1 + a * 0.85})`} stroke={hover === x.code ? "#fff" : "#0f1b29"} /><text x={p[0] * 50 + 25} y={p[1] * 50 + 22} fontSize={11} textAnchor="middle" fill="#fff">{x.code}</text><text x={p[0] * 50 + 25} y={p[1] * 50 + 37} fontSize={8} textAnchor="middle" fill="#cbd5e1">{mode === "pc" ? `${Math.round(x.perCapita ?? 0).toLocaleString()}` : fmtCompact(x.amount)}</text></g>; })}
          </svg>
          <div className="text-[11px] text-slate-300">{h ? `${h.name}：总额 ${fmtCompact(h.amount)} 美元 · 人均 ${Math.round(h.perCapita ?? 0).toLocaleString()} 美元` : "将鼠标移到州上查看"}</div>
        </div>
        <div className="bg-[#03070c]"><SectionHead title={mode === "pc" ? "人均联邦支出排名（美元）" : "联邦支出总额排名"} /><table className="w-full text-[11px]"><tbody>{[...list].sort((a, b) => val(b) - val(a)).slice(0, 25).map((x, i) => <tr key={x.code} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-500">{i + 1}</td><td className="text-slate-200">{x.name}</td><td className="px-2 text-right font-mono text-white">{mode === "pc" ? Math.round(x.perCapita ?? 0).toLocaleString() : fmtCompact(x.amount)}</td></tr>)}{!list.length && <tr><td><Empty loading={s.loading} /></td></tr>}</tbody></table></div>
      </div>
    </PanelShell>
  );
}
