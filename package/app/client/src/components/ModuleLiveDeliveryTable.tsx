import React, { useEffect, useMemo, useState } from "react";
import type { ModuleLiveFeedItem } from "@/hooks/useModuleLiveFeed";

type Props = {
  items: ModuleLiveFeedItem[];
  connection: "connecting" | "live" | "fallback";
  receivedAt: string | null;
  title?: string;
};

function displayTime(value: string | Date | null | undefined) {
  if (!value) return "未提供";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "未提供" : date.toLocaleString();
}

type Dataset = NonNullable<ModuleLiveFeedItem["dataset"]>;

function compareDatasetValues(left: unknown, right: unknown) {
  const leftNumber = typeof left === "number" ? left : Number.NaN;
  const rightNumber = typeof right === "number" ? right : Number.NaN;
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function StructuredDatasetView({ dataset }: { dataset: Dataset }) {
  const [query, setQuery] = useState("");
  const [sortColumn, setSortColumn] = useState(dataset.columns[0] ?? "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    setQuery("");
    setSortColumn(dataset.columns[0] ?? "");
    setSortDirection("asc");
    setPage(0);
  }, [dataset.metadata.checksum]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? dataset.rows.filter(row => dataset.columns.some(column => String(row[column] ?? "").toLocaleLowerCase().includes(normalizedQuery)))
      : dataset.rows;
    if (!sortColumn) return filtered;
    return filtered.slice().sort((left, right) => {
      const comparison = compareDatasetValues(left[sortColumn], right[sortColumn]);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [dataset.columns, dataset.rows, query, sortColumn, sortDirection]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const toggleSort = (column: string) => {
    setPage(0);
    if (sortColumn === column) setSortDirection(direction => direction === "asc" ? "desc" : "asc");
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  return <div className="mt-1 text-[10px]">
    <p className="text-slate-400">当前功能已接收 {dataset.metadata.rowCount} 条清洗后的业务数据。</p>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-slate-800 bg-black px-2 py-1 font-mono text-slate-500">
      <span className="text-cyan-300">已清洗数据</span>
      <span>数据集 {dataset.metadata.rowCount} 行</span>
      <span>载入 {dataset.metadata.displayedRowCount} 行</span>
      <span>观测 {dataset.metadata.observedAt ?? "未提供"}</span>
      <span>读取 {dataset.metadata.queriedAt ?? "未提供"}</span>
      <span>时区 {['provider-defined', 'source-defined'].includes(dataset.metadata.timezone) ? '按观测口径' : dataset.metadata.timezone}</span>
      <span>质量 {dataset.metadata.quality === 'provider_response' ? '已返回数据' : dataset.metadata.quality === 'empty_response' ? '暂无数据' : dataset.metadata.quality}</span>
      <span className={dataset.metadata.realtimeStatus === "realtime" ? "text-emerald-300" : "text-amber-300"}>时效 {dataset.metadata.realtimeStatus === 'provider_defined' ? '按发布频率' : dataset.metadata.realtimeStatus === 'realtime' ? '实时' : dataset.metadata.realtimeStatus}</span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#050b10] px-2 py-1">
      <input aria-label="筛选投递数据" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="筛选当前数据集" className="h-6 min-w-52 border border-slate-700 bg-black px-2 text-[10px] text-slate-200 outline-none focus:border-cyan-700" />
      <span className="font-mono text-slate-500">命中 {rows.length} · 第 {safePage + 1}/{pageCount} 页</span>
    </div>
    <div className="max-h-52 overflow-auto">
      <table className="min-w-full whitespace-nowrap text-left font-mono text-[10px]">
        <thead className="sticky top-0 z-10 bg-slate-950 text-slate-500"><tr>{dataset.columns.map(column => <th key={column} className="border-b border-r border-slate-800 px-2 py-1"><button type="button" onClick={() => toggleSort(column)} className="hover:text-cyan-200">{column}{sortColumn === column ? sortDirection === "asc" ? " ↑" : " ↓" : ""}</button></th>)}</tr></thead>
        <tbody>{visibleRows.map((row, index) => <tr key={`${safePage}-${index}`} className="border-b border-slate-900 hover:bg-cyan-950/20">{dataset.columns.map(column => <td key={column} title={String(row[column] ?? "")} className="max-w-56 overflow-hidden text-ellipsis border-r border-slate-900 px-2 py-1 text-slate-300">{String(row[column] ?? "—")}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-between border-t border-slate-800 px-2 py-1">
      <span className="font-mono text-slate-600">{dataset.metadata.truncated ? "数据集已按显示上限截断" : "当前数据集完整显示"}</span>
      <span className="flex gap-1"><button type="button" disabled={safePage === 0} onClick={() => setPage(value => Math.max(0, value - 1))} className="border border-slate-700 px-2 py-0.5 text-slate-300 disabled:opacity-30">上一页</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} className="border border-slate-700 px-2 py-0.5 text-slate-300 disabled:opacity-30">下一页</button></span>
    </div>
    <details className="border-t border-slate-900 px-2 py-1 text-slate-500"><summary className="cursor-pointer text-slate-400">查看数据说明</summary><p className="mt-1 leading-4">仅显示清洗后的业务字段；管理标识不会进入终端。</p></details>
  </div>;
}

export default function ModuleLiveDeliveryTable({
  items,
  connection,
  title = "后台定向内容",
}: Props) {
  const [selectedKey, setSelectedKey] = useState("");
  const selected = items.find(item => item.itemKey === selectedKey) ?? items[0] ?? null;
  const structuredItems = items.filter(item => Boolean(item.dataset));
  const openBBRows = structuredItems.reduce((total, item) => total + (item.dataset?.metadata.rowCount ?? 0), 0);
  // Do not call every structured observation “OpenBB”. FinMind and the
  // public reference adapters have their own contracts; the schema version is
  // the server-side, non-sensitive discriminator that lets the terminal show
  // which API actually supplied the visible rows.
  const openBBConnected = structuredItems.some(item => item.dataset?.metadata.schemaVersion === "openbb-query-v1");
  const finMindConnected = structuredItems.some(item => item.dataset?.metadata.schemaVersion === "module-observation-history-v1");
  const apiConnected = openBBConnected || finMindConnected || openBBRows > 0;
  // 终端不展示数据来源与接入方式（用户要求），标题中的来源字样一并去掉
  const cleanTitle = title.replace(/OpenBB\s*\/?\s*(API)?\s*/gi, "").replace(/FinMind\s*/gi, "").replace(/数据投递|投递/g, "数据").trim() || "数据";

  useEffect(() => {
    if (!items.length) setSelectedKey("");
    else if (!items.some(item => item.itemKey === selectedKey)) setSelectedKey(items[0].itemKey);
  }, [items, selectedKey]);

  return (
    <section className="border-b border-slate-800 bg-[#03090e]" aria-label={title} data-live-delivery-state={connection} data-openbb-status={openBBConnected ? "connected" : "unavailable"} data-api-status={apiConnected ? "connected" : "unavailable"}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-2 py-1.5 text-[10px]">
        <b className="font-mono text-cyan-300">{cleanTitle}</b>
        <span className={apiConnected ? "text-emerald-300" : "text-amber-300"}>
          {apiConnected ? "数据已更新" : "暂无可用数据"} · {items.length} 条
        </span>
      </header>
      {items.length ? (
        <div className="grid min-h-0 lg:grid-cols-[minmax(360px,0.9fr)_minmax(360px,1.1fr)]">
          <div className="max-h-[28rem] overflow-auto border-r border-slate-800">
            <table className="w-full min-w-[560px] text-left text-[10px]">
              <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">时间</th><th>类别</th><th>内容</th><th className="pr-2">数据状态</th></tr></thead>
              <tbody>{items.map(item => (
                <tr key={item.itemKey} className={`cursor-pointer border-t border-slate-800 ${selected?.itemKey === item.itemKey ? "bg-cyan-950/30" : "hover:bg-slate-900"}`} onClick={() => setSelectedKey(item.itemKey)}>
                  <td className="whitespace-nowrap p-2 font-mono text-slate-500">{displayTime(item.publishedAt ?? item.updatedAt)}</td>
                  <td className="whitespace-nowrap text-cyan-300">{item.category || item.topic}</td>
                  <td className="max-w-72 truncate text-slate-200">{item.title}</td>
                  <td className="pr-2 text-slate-500">{item.dataset ? "已清洗" : "可用"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <article className="max-h-[28rem] overflow-auto px-3 py-2 text-[11px] leading-5">
            <h4 className="font-semibold text-slate-100">{selected?.title}</h4>
            {selected?.dataset
              ? <StructuredDatasetView dataset={selected.dataset} />
              : <p className="mt-1 whitespace-pre-wrap text-slate-300">{selected?.body}</p>}
          </article>
        </div>
      ) : (
        <div role="status" className="px-3 py-3 text-[11px] text-slate-500">当前功能尚无已校验的定向内容。系统不会从其他功能复制数据填充。</div>
      )}
    </section>
  );
}
