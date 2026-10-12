import React, { useEffect, useId, useMemo, useState } from "react";
import { Brush, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { ResearchSplit } from "./StockObservationDesk";
import { formatObservation as number } from "./stockObservationModel";
import { compareIndexBenchmarks, equityPriceBenchmarks, indexBenchmarkCsv, type BenchmarkSeries } from "./indexBenchmarkAnalytics";

const input = "input-terminal h-7 px-2 text-[11px]";
const button = "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40 hover:bg-slate-800";
const tooltip = { contentStyle: { background: "#070d18", border: "1px solid #334155", color: "#e2e8f0", fontSize: 11 } };
const tabs = [["base", "共同基准100"], ["relative", "相对价格比率"], ["excess", "累计回报差"]] as const;
type View = typeof tabs[number][0];

export default function IndexBenchmarkWorkbench() {
  const id = useId();
  const [leftId, setLeftId] = useState("SP500");
  const [rightId, setRightId] = useState("NASDAQCOM");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [view, setView] = useState<View>("base");
  const [selectedDate, setSelectedDate] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const query = trpc.stockMarketResearch.getEnvironment.useQuery(undefined, {
    staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true, refetchOnReconnect: true,
  });
  const candidates = useMemo(() => equityPriceBenchmarks((query.data?.series ?? []) as BenchmarkSeries[]), [query.data?.series]);
  const left = candidates.find(row => row.id === leftId);
  const right = candidates.find(row => row.id === rightId);
  const result = useMemo(() => compareIndexBenchmarks(left, right, start, end), [left, right, start, end]);
  const current = result.rows.find(row => row.date === selectedDate) ?? result.rows.at(-1);
  const retrievedAt = query.data?.retrievedAt ?? query.data?.asOf ?? "";
  const fetchedAge = retrievedAt ? Math.max(0, Date.now() - Date.parse(retrievedAt)) : Infinity;
  const observationAge = result.end ? Math.max(0, Math.floor((Date.now() - Date.parse(result.end)) / 86_400_000)) : null;
  const available = !query.isError && !query.isLoading && !result.reason;
  const resetSelection = () => setSelectedDate("");
  const exportRows = () => {
    if (!available || !left || !right) return;
    const blob = new Blob([indexBenchmarkCsv(result, left, right, retrievedAt)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `IN-${left.id}-${right.id}-${result.start}-${result.end}.csv`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const sourceRows = ([left, right] as const).map((row, index) => ({ role: index === 0 ? "研究指数" : "参考指数", row }));

  return <section aria-label="IN 指数基准比较工作台" className="min-w-0 text-slate-300">
    <div role="toolbar" aria-label="指数基准比较条件" className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2">
      <label className="text-[10px] text-slate-400">研究指数 <select aria-label="IN 研究指数" className={input} value={leftId} onChange={event => { setLeftId(event.target.value); resetSelection(); }}>
        {!left && <option value={leftId}>{leftId} · 数据源未配置</option>}
        {candidates.map(row => <option key={row.id} value={row.id}>{row.label} · {row.id}</option>)}
      </select></label>
      <label className="text-[10px] text-slate-400">参考指数 <select aria-label="IN 参考指数" className={input} value={rightId} onChange={event => { setRightId(event.target.value); resetSelection(); }}>
        {!right && <option value={rightId}>{rightId} · 数据源未配置</option>}
        {candidates.map(row => <option key={row.id} value={row.id}>{row.label} · {row.id}</option>)}
      </select></label>
      <label className="text-[10px] text-slate-400">开始 <input type="date" aria-label="IN 开始日期" className={input} value={start} max={end || undefined} onChange={event => { setStart(event.target.value); resetSelection(); }} /></label>
      <label className="text-[10px] text-slate-400">结束 <input type="date" aria-label="IN 结束日期" className={input} value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); resetSelection(); }} /></label>
      <button type="button" className={button} onClick={() => { setStart(""); setEnd(""); resetSelection(); }}>全部已接入历史</button>
      <button type="button" className={button} disabled={query.isFetching || !online} onClick={() => void query.refetch()}>重新读取指数</button>
      <button type="button" className={button} disabled={!available} onClick={exportRows}>导出比较样本</button>
    </div>
    <div role="status" className="flex flex-wrap gap-x-4 border-b border-slate-800 px-2 py-1 text-[10px] text-amber-100">
      <span>{!online ? "断线 · 保留已读取历史，非实时" : query.isError ? "接口失败 · 已停止输出比较结果" : query.isFetching ? "正在核验实际来源" : fetchedAge > 180_000 ? "采集快照过期 · 等待来源更新" : "日频历史 · 非实时行情"}</span>
      {observationAge != null && <span>共同观察距今 {observationAge} 自然日{observationAge > 7 ? " · 观察滞后，请核对源发布时间" : " · 不等同交易日延迟"}</span>}
    </div>
    <p className="border-b border-slate-800 px-2 py-2 text-[10px] leading-5 text-slate-400">本页只研究两个股票价格指数的相对表现，不复刻 WEI 环境报价矩阵。共同首日归一为100，不插值、不前填。价格变化不含股息再投资，不是总回报；不推断指数成分、权重、估值或可交易价格。</p>
    {query.isLoading ? <p role="status" className="p-5 text-xs">正在读取 FRED 实际指数历史…</p> : query.isError ? <p role="alert" className="p-5 text-xs text-red-200">FRED 环境接口读取失败。保留选择条件，停止输出比较结果；请使用“重新读取指数”恢复。</p> : result.reason ? <p role="alert" className="p-5 text-xs text-amber-200">{result.reason}</p> : <>
      <div className="overflow-auto border-b border-slate-800"><table aria-label="IN 比较区间结果" className="w-full whitespace-nowrap text-right text-[11px]">
        <thead className="text-slate-500"><tr>{["共同起止", "共同观察数", `${left?.label}价格变化 %`, `${right?.label}价格变化 %`, "期末回报差 pp", "期末相对比率 %"].map(label => <th key={label} className="px-3 py-2 font-normal">{label}</th>)}</tr></thead>
        <tbody><tr><td className="px-3 py-2 font-mono">{result.start} → {result.end}</td><td aria-label="IN 共同样本数" className="px-3 py-2 font-mono">{result.count}</td><td className="px-3 py-2 font-mono">{number(result.leftReturnPct, 4)}</td><td className="px-3 py-2 font-mono">{number(result.rightReturnPct, 4)}</td><td className="px-3 py-2 font-mono">{number(result.rows.at(-1)?.excessReturnPp, 4)}</td><td className="px-3 py-2 font-mono">{number(result.rows.at(-1)?.relativePerformancePct, 4)}</td></tr></tbody>
      </table></div>
      <ResearchSplit label="IN 曲线与共同观察" left={<div className="flex min-w-0 flex-col">
        <header className="border-b border-slate-800 px-2 py-2 text-xs">共同观察证据 · 选择行联动曲线</header>
        <div className="max-h-[420px] overflow-auto"><table aria-label="IN 共同观察明细" className="w-full min-w-[690px] text-right text-[10px]">
          <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400"><tr>{["观察日", `${left?.id} 点`, `${right?.id} 点`, "研究/100", "参考/100", "相对比率 %", "回报差 pp", "间隔自然日"].map(label => <th key={label} className="whitespace-nowrap px-2 py-2">{label}</th>)}</tr></thead>
          <tbody>{result.rows.map((row, index) => <tr key={row.date} tabIndex={0} aria-selected={current?.date === row.date} onClick={() => setSelectedDate(row.date)} onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDate(row.date); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const offset = event.key === "ArrowDown" ? 1 : -1; const next = Math.min(result.rows.length - 1, Math.max(0, index + offset)); setSelectedDate(result.rows[next].date); (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus(); }
          }} className={`cursor-pointer border-b border-slate-800 hover:bg-slate-900 focus:bg-slate-900 ${current?.date === row.date ? "bg-cyan-950/30" : ""}`}>
            <td className="whitespace-nowrap px-2 py-2 font-mono text-cyan-200">{row.date}</td>{[row.left, row.right, row.leftIndex, row.rightIndex, row.relativePerformancePct, row.excessReturnPp, row.calendarDays].map((value, column) => <td key={column} className="px-2 py-2 font-mono">{number(value, 4)}</td>)}
          </tr>)}</tbody>
        </table></div>
      </div>} right={<div className="min-w-0">
        <div role="tablist" aria-label="IN 基准图层" className="flex flex-wrap border-b border-slate-800">{tabs.map(([key, label], index) => <button type="button" key={key} id={`${id}-${key}`} role="tab" aria-selected={view === key} aria-controls={`${id}-chart`} tabIndex={view === key ? 0 : -1} onClick={() => setView(key)} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setView(tabs[next][0]); (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus(); } }} className={`border-b-2 px-3 py-2 text-[11px] ${view === key ? "border-cyan-400 text-cyan-200" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>
        <div role="tabpanel" id={`${id}-chart`} aria-labelledby={`${id}-${view}`} className="h-[310px] min-w-0 px-1 pt-3">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={result.rows} onClick={event => { if (typeof event?.activeLabel === "string") setSelectedDate(event.activeLabel); }} margin={{ top: 10, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={36} tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis width={58} domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} tickFormatter={value => number(value, 2)} /><Tooltip {...tooltip} formatter={value => number(Number(value), 4)} /><Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={view === "base" ? 100 : 0} stroke="#64748b" strokeDasharray="3 3" />{current && <ReferenceLine x={current.date} stroke="#f59e0b" />}
            {view === "base" ? <><Line name={`${left?.label} · 基准100`} dataKey="leftIndex" stroke="#22d3ee" dot={false} isAnimationActive={false} connectNulls={false} /><Line name={`${right?.label} · 基准100`} dataKey="rightIndex" stroke="#c4b5fd" dot={false} isAnimationActive={false} connectNulls={false} /></> : <Line name={view === "relative" ? "研究/参考相对价格比率 %" : "研究−参考累计价格回报差 pp"} dataKey={view === "relative" ? "relativePerformancePct" : "excessReturnPp"} stroke="#22d3ee" dot={false} isAnimationActive={false} connectNulls={false} />}
            <Brush dataKey="date" height={18} stroke="#475569" fill="#0f172a" travellerWidth={7} />
          </LineChart></ResponsiveContainer>
        </div>
        <div aria-label="IN 已选观察说明" className="border-t border-slate-800 px-3 py-2 text-[10px] leading-5 text-slate-400">{current ? <>
          已选 {current.date}；{current.intervalStart ? <>上一个共同观察 {current.intervalStart}，间隔 {current.calendarDays} 自然日；该区间 {left?.id} {number(current.leftIntervalReturnPct, 4)}%，{right?.id} {number(current.rightIntervalReturnPct, 4)}%。</> : <>这是共同基准日，未计算首日区间回报。</>}
        </> : "没有可选择的共同观察。"} 曲线底部滑块仅缩放显示；要改变计算基准与导出范围，请使用开始/结束日期。</div>
      </div>} />
    </>}
    <details className="border-b border-slate-800"><summary className="cursor-pointer px-2 py-2 text-[11px]">来源、对齐和计算口径</summary>
      <div className="overflow-auto"><table aria-label="IN 指数来源定义" className="w-full whitespace-nowrap text-left text-[10px]"><thead className="text-slate-500"><tr>{["职责", "指标ID", "来源", "原单位", "最近观察", "区间有效点", "未配对点"].map(label => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{sourceRows.map(({ role, row }, index) => <tr key={role} className="border-t border-slate-800"><td className="px-2 py-2">{role}</td><td className="px-2 py-2">{row ? `fred:${row.id}` : "数据源未配置"}</td><td className="px-2 py-2">{row?.source ?? "—"}</td><td className="px-2 py-2">{row?.unit === "index_points" ? "指数点" : "—"}</td><td className="px-2 py-2">{row?.observationDate ?? "—"}</td><td className="px-2 py-2">{index === 0 ? result.leftCount : result.rightCount}</td><td className="px-2 py-2">{index === 0 ? result.unmatchedLeft : result.unmatchedRight}</td></tr>)}</tbody></table></div>
      
    </details>
    <footer className="flex flex-wrap justify-between gap-2 px-2 py-2 text-[10px] text-slate-500"><span>来源：FRED · 读取 {retrievedAt || "未读取"} · 价格指数，不含分红</span><span>每60秒核验、聚焦/重连刷新；仅在真实历史变化时重算</span></footer>
  </section>;
}
