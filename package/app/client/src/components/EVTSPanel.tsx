import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Brush, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { ResearchSplit } from "./stock/StockObservationDesk";
import { eventCsv, eventStudy, expectationDifference } from "./stock/stockEventStudy";
import OpenBBModuleDataBand from "@/components/OpenBBModuleDataBand";

const control = "border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 disabled:cursor-not-allowed disabled:opacity-40";
const tooltip = { contentStyle: { background: "#0f172a", border: "1px solid #475569", color: "#e2e8f0", fontSize: 11 } };
const tabs = [
  // Keep the original analysis capabilities and names; the data source and
  // calculation behind each tab are now explicit and non-synthetic.
  ["calendar", "事件日历"],
  ["expectation", "预期差量化"],
  ["historical", "历史相似回测"],
  ["chain", "事件链式反应"],
] as const;
const display = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });

/** SEC filings plus a public daily close. No synthetic events, probabilities or trading signals. */
export default function EVTSPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("calendar");
  const [draft, setDraft] = useState("AAPL");
  const [cikDraft, setCikDraft] = useState("");
  const [ticker, setTicker] = useState("");
  const [cik, setCik] = useState("");
  const [form, setForm] = useState("8-K");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const issuerQuery = trpc.stockMarketResearch.searchIssuers.useQuery({ query: draft || "A", limit: 8 }, { enabled: draft.trim().length >= 2, staleTime: 60_000, retry: false });
  const sourceOptions = { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false } as const;
  const filingsQuery = trpc.stockMarketResearch.getIssuerFilings.useQuery({ cik: cik || "0" }, { ...sourceOptions, enabled: Boolean(cik) });
  const quoteQuery = trpc.stockMarketResearch.getTickerObservation.useQuery({ ticker, range: "1y", assetClass: "stocks" }, { ...sourceOptions, enabled: Boolean(cik && ticker) });
  const issuer = filingsQuery.data?.issuer;
  const sameIssuer = Boolean(issuer && ticker && issuer.tickers?.some((value: string) => value.toUpperCase() === ticker.toUpperCase()));
  const study = useMemo(() => eventStudy(filingsQuery.data?.filings ?? [], sameIssuer ? quoteQuery.data?.observation?.history ?? [] : [], form), [filingsQuery.data?.filings, quoteQuery.data?.observation?.history, sameIssuer, form]);
  const rows = useMemo(() => study.rows.filter(row => `${row.filingDate ?? ""} ${row.form} ${row.accessionNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())), [study.rows, search]);
  const selected = rows.find(row => row.accessionNumber === selection) ?? rows[0];
  const difference = expectationDifference(expected, actual, unit, source);
  const choose = (newTicker: string, newCik: string) => { setTicker(newTicker.toUpperCase()); setCik(newCik); setCikDraft(newCik); setSelection(""); setExpected(""); setActual(""); setUnit(""); setSource(""); };
  const readCik = () => { if (/^[A-Za-z0-9.^=-]{1,15}$/.test(draft.trim()) && /^\d{1,10}$/.test(cikDraft.trim())) choose(draft.trim(), cikDraft.trim()); };
  const exportRows = () => {
    if (!rows.length) return;
    const csv = eventCsv([["accession", "form", "filingDate", "baseDate", "return1Pct", "return5Pct", "return20Pct", "priceSource", "priceObservationDate", "priceRetrievedAt"], ...rows.map(row => [row.accessionNumber, row.form, row.filingDate, row.baseDate, row.one?.value ?? null, row.five?.value ?? null, row.twenty?.value ?? null, quoteQuery.data?.observation?.source ?? "", quoteQuery.data?.observation?.observationDate ?? "", quoteQuery.data?.observation?.retrievedAt ?? ""])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `EVTS-${ticker || "unselected"}-event-windows.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const table = <div className="h-full overflow-auto"><table className="w-full min-w-[560px] text-left text-[11px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr>{["申报日 / 类型", "基准观察日", "后1观察收益%", "后5观察收益%", "后20观察收益%"].map(label => <th key={label} className="p-2 font-normal">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.accessionNumber} className={`border-t border-slate-800 ${selected?.accessionNumber === row.accessionNumber ? "bg-cyan-950/40" : ""}`}><td className="p-2"><button type="button" className="text-left text-cyan-200" onClick={() => setSelection(row.accessionNumber ?? "")}>{row.filingDate} · {row.form}<span className="block text-[9px] text-slate-500">{row.accessionNumber}</span></button></td><td>{row.baseDate ?? "历史不足"}</td><td>{display(row.one?.value)}</td><td>{display(row.five?.value)}</td><td>{display(row.twenty?.value)}</td></tr>)}</tbody></table>{!rows.length && <p role="status" className="p-4 text-slate-400">{!cik ? "请选择 SEC 主体或输入真实 CIK 后读取。" : "没有匹配申报或完整事件窗口；不使用示例数据。"}</p>}</div>;
  return <section aria-label="EVTS 事件证据分析" className="min-w-0 bg-slate-950 text-slate-300 text-xs">
    <OpenBBModuleDataBand path="/terminal?open=evts&module=stocks" title="EVTS 事件日历数据" />
    <div className="flex flex-wrap items-end gap-2 border-b border-slate-700 p-2">
      <label className="text-[10px] text-slate-400">SEC 主体检索<input aria-label="EVTS 主体检索" className={`${control} mt-1 block`} value={draft} onChange={event => setDraft(event.target.value)} /></label>
      <label className="text-[10px] text-slate-400">真实 CIK<input aria-label="EVTS CIK" className={`${control} mt-1 block w-32`} value={cikDraft} onChange={event => setCikDraft(event.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
      <button type="button" className={control} disabled={!/^\d{1,10}$/.test(cikDraft.trim()) || !draft.trim()} onClick={readCik}>按 CIK 读取</button>
      <label className="text-[10px] text-slate-400">表单<select aria-label="EVTS 表单" className={`${control} mt-1 block`} value={form} onChange={event => { setForm(event.target.value); setSelection(""); }}><option value="all">全部支持表单</option>{["8-K", "10-K", "10-Q", "S-1", "S-1/A", "S-3", "S-4", "424B2", "424B3", "424B5", "DEFM14A"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button type="button" className={control} disabled={!cik || filingsQuery.isFetching || quoteQuery.isFetching} onClick={() => { void filingsQuery.refetch(); void quoteQuery.refetch(); }}>刷新来源</button>
      <button type="button" className={control} disabled={!rows.length} onClick={exportRows}>导出当前筛选</button>
      {onClose && <button type="button" className={control} onClick={onClose}>关闭</button>}
    </div>
    <div className="flex flex-wrap gap-2 border-b border-slate-800 p-2">{issuerQuery.data?.results?.map(row => <button type="button" key={`${row.cik}-${row.ticker}`} className={`${control} text-cyan-200`} onClick={() => choose(row.ticker, row.cik)}>{row.ticker} · {row.name}</button>)}{issuerQuery.isLoading && <span role="status">读取 SEC 主体目录…</span>}{(issuerQuery.error || issuerQuery.data?.status === "unavailable") && <span role="alert" className="text-amber-200">SEC 主体目录暂不可读，可输入已知真实 CIK；系统不会猜测主体。</span>}</div>
    <div role="status" className="border-b border-slate-800 p-2 text-[10px]">{!online ? "已断线 · 历史数据不代表实时" : filingsQuery.isFetching || quoteQuery.isFetching ? "正在重新读取公开来源…" : "SEC 申报 + 公共日频收盘 · 每60秒核验 · 非实时行情"} · {issuer?.name ?? "未选择主体"} {ticker && `· ${ticker}`} {study.conflicts > 0 && `· 已隔离 ${study.conflicts} 个冲突记录`}</div>
    {cik && !sameIssuer && <p role="alert" className="border-b border-amber-900 p-2 text-amber-200">SEC 主体代码与价格代码未匹配，事件收益已阻断；请选择主体目录中的同一代码。</p>}
    <nav role="tablist" aria-label="EVTS 证据工具" className="flex overflow-x-auto border-b border-slate-700">{tabs.map(([id, label], index) => <button type="button" role="tab" key={id} aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1} className={`shrink-0 border-r border-slate-700 px-3 py-2 ${activeTab === id ? "border-b-2 border-b-cyan-400 text-cyan-200" : "text-slate-500"}`} onClick={() => setActiveTab(id)} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setActiveTab(tabs[next][0]); (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus(); }}>{label}</button>)}</nav>
    <div role="tabpanel" aria-label={`${tabs.find(row => row[0] === activeTab)?.[1] ?? "EVTS"} 内容`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><input aria-label="检索事件证据" className={control} placeholder="日期 / 表单 / 申报编号" value={search} onChange={event => setSearch(event.target.value)} /><span>{rows.length} 份申报 · {study.distribution.length} 个唯一基准日</span></div>
      {activeTab === "calendar" && <ResearchSplit label="EVTS事件证据" left={table} right={<div className="min-w-0 p-2">{selected ? <><p className="mb-2 text-cyan-200">{selected.form} · {selected.filingDate} · {selected.accessionNumber}</p>{selected.path.length ? <><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.path}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="offset" tick={{ fontSize: 10 }} /><YAxis unit="%" tick={{ fontSize: 10 }} /><Tooltip {...tooltip} /><ReferenceLine y={0} stroke="#64748b" /><ReferenceLine x={0} stroke="#f59e0b" /><Line dataKey="returnPct" name="相对基准收盘变化" stroke="#22d3ee" dot={false} isAnimationActive={false} /><Brush dataKey="date" height={18} /></LineChart></ResponsiveContainer></div><table className="w-full text-left text-[11px]"><thead><tr><th>观察日</th><th>偏移</th><th>收盘 {quoteQuery.data?.observation?.currency ?? ""}</th><th>变化%</th></tr></thead><tbody>{selected.path.map(point => <tr key={point.date} className="border-t border-slate-800"><td className="py-1">{point.date}</td><td>{point.offset}</td><td>{display(point.value)}</td><td>{display(point.returnPct)}</td></tr>)}</tbody></table></> : <p role="status" className="py-10 text-slate-400">{selected.unavailable ?? "没有可用事件窗口。"}</p>}</> : <p role="status" className="py-10 text-slate-400">选择主体并点击左侧申报记录。</p>}</div>} />}
      {activeTab === "expectation" && <div className="p-2"><p className="border-b border-slate-800 pb-2">没有已配置的授权一致预期源。以下只核验用户输入的同一指标，不生成 EPS、IV、情绪或概率。</p><div className="flex flex-wrap gap-2 py-3">{[["预期值", expected, setExpected], ["实际值", actual, setActual], ["共同单位", unit, setUnit], ["来源及报告期", source, setSource]].map(([label, value, update]) => <label key={String(label)} className="text-[10px] text-slate-400">{String(label)}<input aria-label={String(label)} className={`${control} mt-1 block`} value={String(value)} onChange={event => (update as (value: string) => void)(event.target.value)} /></label>)}</div>{difference ? <table className="w-full text-left text-[11px]"><tbody>{[["实际 − 预期", `${display(difference.difference)} ${difference.unit}`], ["相对差异", difference.relativePct == null ? "预期为零，不计算比例" : `${display(difference.relativePct)}%`], ["来源（用户提供，未外部核验）", difference.source]].map(([label, value]) => <tr key={String(label)} className="border-t border-slate-800"><th className="p-2 font-normal text-slate-400">{String(label)}</th><td className="p-2">{String(value)}</td></tr>)}</tbody></table> : <p role="status" className="py-4 text-slate-400">请填入两个有效数字、共同单位、来源及同一报告期；缺项不计算。</p>}</div>}
      {activeTab === "historical" && <div className="p-2"><p className="border-b border-slate-800 pb-2">同一表单的已发生事件按基准观察日去重，分别报告完整样本。仅描述历史价格变化，不代表胜率预测或因果效应。</p><table className="w-full text-left text-[11px]"><thead><tr>{["观察间隔", "完整样本", "均值%", "中位数%", "最小%", "最大%", "正变化占比%"].map(label => <th key={label} className="p-2 font-normal">{label}</th>)}</tr></thead><tbody>{study.summaries.map((row, index) => <tr key={row.horizon} className="border-t border-slate-800"><td className="p-2">{[1, 5, 20][index]} 个观察</td><td>{row.count}</td><td>{display(row.mean)}</td><td>{display(row.median)}</td><td>{display(row.min)}</td><td>{display(row.max)}</td><td>{display(row.positiveShare)}</td></tr>)}</tbody></table><div className="h-72">{study.distribution.some(row => row.five) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={study.distribution.filter(row => row.five).map(row => ({ date: row.baseDate, value: row.five!.value }))}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis unit="%" tick={{ fontSize: 10 }} /><Tooltip {...tooltip} /><ReferenceLine y={0} stroke="#64748b" /><Bar dataKey="value" name="后5观察收盘变化" fill="#38bdf8" isAnimationActive={false} /><Brush dataKey="date" height={18} /></BarChart></ResponsiveContainer> : <p role="status" className="py-8 text-slate-400">没有完整的五观察间隔样本；不显示示例分布。</p>}</div></div>}
      {activeTab === "chain" && <div className="overflow-auto p-2"><p className="border-b border-slate-800 pb-2">只按 SEC 实际申报日排列，箭头代表时间先后，不表示冲击传导；相邻窗口可能重叠，不能将变化相加。</p><table className="w-full min-w-[680px] text-left text-[11px]"><thead><tr>{["申报日", "表单", "与上一申报间隔（日历日）", "申报编号", "后5观察区间", "变化%"].map(label => <th key={label} className="p-2 font-normal">{label}</th>)}</tr></thead><tbody>{[...rows].reverse().map((row, index, ordered) => <tr key={row.accessionNumber} className="border-t border-slate-800"><td className="p-2">{row.filingDate}</td><td>{row.form}</td><td>{index ? (Date.parse(row.filingDate!) - Date.parse(ordered[index - 1].filingDate!)) / 86_400_000 : "—"}</td><td>{row.accessionNumber}</td><td>{row.five ? `${row.baseDate} → ${row.five.end}` : "未覆盖"}</td><td>{display(row.five?.value)}</td></tr>)}</tbody></table></div>}
    </div>
    <footer className="border-t border-slate-700 p-2 text-[10px] leading-5 text-slate-500">最多 80 份近期申报（非完整历史）。币种 {quoteQuery.data?.observation?.currency ?? "未返回"} · 观察日 {quoteQuery.data?.observation?.observationDate ?? "—"} · 读取UTC {quoteQuery.data?.observation?.retrievedAt ?? "—"}。SEC 只提供申报日，采用其后首个可用收盘作为偏移0；超过7日数据缺口阻断期限统计。不假设发布时点、交易成交、预期差可交易性或因果关系。</footer>
  </section>;
}
