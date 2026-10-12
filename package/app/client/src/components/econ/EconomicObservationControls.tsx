import React, { useState } from "react";
import {economicDrilldown,ECONOMIC_DRILL_FIELDS} from '@shared/economicDrilldown';
import { trpc } from "@/lib/trpc";
import type {
  EconomicGroup,
  EconomicSnapshot,
} from "@shared/economicObservations";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function useEconomicObservations(group: EconomicGroup) {
  const query = trpc.legacyMarketData.getEconomicObservations.useQuery(
    { group },
    { staleTime: 300_000, refetchInterval: 300_000, retry: false }
  );
  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  const refetch = async () => {
    setRefreshing(true); setRefreshError(null);
    try {
      await utils.legacyMarketData.getEconomicObservations.cancel({ group });
      const data = await utils.client.legacyMarketData.getEconomicObservations.query({ group, refresh: true });
      if (data.series.some(s => s.status === 'unavailable')) setRefreshError(new Error('刷新失败，保留上次有效观察'));
      utils.legacyMarketData.getEconomicObservations.setData({ group }, previous => {
        const series = data.series.map(s => {
          const prior = previous?.series.find(p => p.id === s.id);
          return s.status === 'unavailable' && !s.history.length && prior?.history.length
            ? { ...prior, status: s.status, error: s.error }
            : s;
        });
        return { ...data, series, retrievedAt: series.map(s => s.retrievedAt).sort()[0] ?? data.retrievedAt };
      });
    } catch (error) {
      setRefreshError(error instanceof Error ? error : new Error('刷新失败'));
    } finally { setRefreshing(false); }
  };
  return { ...query, refetch, isFetching: query.isFetching || refreshing, error: refreshError ?? query.error };
}
export function formatEconomic(value: unknown, digits = 3) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: digits })
    : value === null || value === undefined
      ? "—"
      : String(value);
}
export function EconomicSourceStatus({
  data,
  fetching,
  error,
  refresh,
}: {
  data?: EconomicSnapshot;
  fetching: boolean;
  error?: boolean;
  refresh: () => void;
}) {
  const available = data?.series.filter(s => s.status === "available") ?? [];
  const updateLabel = !available.length
    ? "尚无可核验更新"
    : available.some(s => s.updateState === "changed")
      ? "检测到新增、修订或撤回观察"
      : available.some(s => s.updateState === "unchanged")
        ? "与上次清洗结果一致"
        : available.some(s => s.updateState === "initial")
          ? "首次建立观察版本"
          : "更新版本待核验";
  return (
    <footer className="flex flex-wrap items-center gap-3 border-y border-slate-800 px-2 py-1 text-[11px] text-slate-400">
      <button
        type="button"
        className="border border-slate-600 px-2 py-1 disabled:opacity-40"
        disabled={fetching}
        onClick={refresh}
      >
        {fetching ? "刷新数据层…" : "刷新数据"}
      </button>
      <span role="status">
        {error || data?.series.some(s => s.status === 'unavailable')
          ? "服务请求失败；已保留的观察不代表本次更新"
          : fetching && !data
            ? "正在读取"
            : `${data?.series.filter(s => s.status === "available").length ?? 0}/${data?.series.length ?? 0} 序列可用`}
      </span>
      <span>按发布频率更新 · 5分钟检查 · 非逐笔行情</span>
      <span>
        最近数据检查{" "}
        {data?.retrievedAt ? new Date(data.retrievedAt).toLocaleString() : "—"}
      </span>
      <span>{updateLabel}</span>
    </footer>
  );
}
export function EconomicUnavailable({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="border-y border-amber-900/40 px-3 py-3 text-xs leading-6 text-amber-300"
    >
      {children}
    </div>
  );
}
export function EconomicTabs({
  tabs,
  active,
  select,
}: {
  tabs: readonly string[];
  active: number;
  select: (index: number) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="原有分析功能"
      className="flex flex-wrap border-b border-slate-700"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === index}
          tabIndex={active === index ? 0 : -1}
          onClick={() => select(index)}
          onKeyDown={event => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const next =
              (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
            select(next);
            (
              event.currentTarget.parentElement?.children[
                next
              ] as HTMLButtonElement
            )?.focus();
          }}
          className={`px-3 py-2 text-xs ${active === index ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400 hover:bg-slate-900"}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
export function EconomicTable({
  rows,
  columns,
  label,
  initialSort,
}: {
  rows: Array<Record<string, unknown>>;
  columns: Array<[string, string]>;
  label: string;
  initialSort?: string;
}) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState(initialSort ?? columns[0]?.[0] ?? "");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  const filtered = rows
    .filter(row =>
      columns.some(([key]) =>
        String(row[key] ?? "")
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
    )
    .sort((a, b) => {
      const left = a[sort];
      const right = b[sort];
      if (left == null && right != null) return 1;
      if (right == null && left != null) return -1;
      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left ?? "").localeCompare(String(right ?? ""), undefined, {
              numeric: true,
            });
      return desc ? -result : result;
    });
  const max = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const current = Math.min(page, max);
  return (
    <section aria-label={label} className="min-w-0">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 py-1">
        <input
          aria-label={`${label}筛选`}
          placeholder="筛选观察日期或字段"
          value={filter}
          onChange={event => {
            setFilter(event.target.value);
            setPage(0);
          }}
          className="w-52 border border-slate-700 bg-black px-2 py-1 text-xs"
        />
        <span className="text-xs text-slate-500">{filtered.length} 条</span>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full whitespace-nowrap text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-slate-950">
            <tr>
              {columns.map(([key, title]) => (
                <th key={key} className="border-b border-slate-700 px-2 py-2">
                  <button
                    onClick={() => {
                      setSort(key);
                      setDesc(sort === key ? !desc : true);
                      setPage(0);
                    }}
                  >
                    {title}
                    {sort === key ? (desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(current * 20, current * 20 + 20)
              .map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-slate-900 hover:bg-slate-900"
                >
                  {columns.map(([key]) => (
                    <td key={key} className="px-2 py-1.5">
                      {formatEconomic(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p role="status" className="py-3 text-xs text-slate-500">
          无匹配的真实观察。
        </p>
      )}
      <div className="flex justify-end gap-3 py-1 text-xs">
        <button
          disabled={!current}
          onClick={() => setPage(current - 1)}
          className="disabled:opacity-30"
        >
          上一页
        </button>
        <span>
          {current + 1}/{max + 1}
        </span>
        <button
          disabled={current >= max}
          onClick={() => setPage(current + 1)}
          className="disabled:opacity-30"
        >
          下一页
        </button>
      </div>
    </section>
  );
}
export function EconomicSeriesChart({
  rows,
  fields,
  label,
}: {
  rows: Array<Record<string, unknown>>;
  fields: Array<[string, string]>;
  label: string;
}) {
  if (!rows.length)
    return (
      <EconomicUnavailable>{label}：当前没有可用观测。</EconomicUnavailable>
    );
  return (
    <div aria-label={label} className="h-64 min-w-0 border-b border-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={45} />
          <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "#020617",
              border: "1px solid #334155",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {fields.map(([key, name], index) => (
            <Line
              key={key}
              name={name}
              dataKey={key}
              stroke={
                ["#22d3ee", "#fbbf24", "#a78bfa", "#34d399", "#fb7185"][
                  index % 5
                ]
              }
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function EconomicProvenance({ data, group, active=0 }: { data?: EconomicSnapshot; group?:keyof typeof ECONOMIC_DRILL_FIELDS; active?:number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const series = data?.series.find(s => s.id === selected);
  const permitted=group?ECONOMIC_DRILL_FIELDS[group][active] as readonly string[]:undefined;
  const fields=data?.series.filter(s=>!permitted||permitted.includes(s.id));
  const visibleSeries=series&&(!permitted||permitted.includes(series.id))?series:undefined;
  const drill=visibleSeries&&group&&data?economicDrilldown(group,visibleSeries.id,data):undefined;
  const rows = (series?.history ?? []).map((p, index, all) => ({
    date: p.date,
    value: p.value,
    change: index ? p.value - all[index - 1].value : null,
  }));
  return (
    <details className="border-t border-slate-700 py-2 text-[11px] text-slate-400">
      <summary className="cursor-pointer">字段、单位与观测日期</summary>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>字段</th>
            <th>单位 / 频率</th>
            <th>末次观察</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {fields?.map(s => (
            <tr key={s.id} className="border-t border-slate-900">
              <td className="py-1">
                <button
                  type="button"
                  aria-pressed={selected === s.id}
                  onClick={() => setSelected(selected === s.id ? null : s.id)}
                  className="text-cyan-400"
                >
                  {s.label}
                </button>
              </td>
              <td>
                {s.unit} / {s.frequency}
              </td>
              <td>{s.history.at(-1)?.date ?? "—"}</td>
              <td>{s.status === "available" ? "可查看明细" : "暂不可用"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fields?.length===0&&<p className="py-2">当前子功能缺少所需专属输入，不复用其他子功能数据填充。</p>}
      {visibleSeries && series && (
        <section
          aria-label={series.label + "数据明细"}
          className="border-t border-slate-600 pt-2"
        >
          <header className="flex justify-between">
            <h3>
              {series.label} · {series.unit}
            </h3>
            <button onClick={() => setSelected(null)}>收起明细</button>
          </header>
          <p className="py-1">数据检查 {new Date(series.retrievedAt).toLocaleString()} · 最近内容变更 {series.changedAt ? new Date(series.changedAt).toLocaleString() : '尚无版本记录'}</p>
          {drill ? <><h4 className="py-2">{drill.label}</h4><p className="py-1">{drill.description}</p><EconomicTable key={group+'-'+series.id} rows={drill.rows} columns={drill.columns} label={drill.label}/></> : <><EconomicSeriesChart
            rows={rows}
            fields={[["value", series.label]]}
            label={series.label + "历史曲线"}
          />
          <EconomicTable
            rows={rows}
            columns={[
              ["date", "观测期"],
              ["value", "数值"],
              ["change", "较上期变化"],
            ]}
            label={series.label + "观测明细"}
          /></>}
          {!!series.changes?.length && <EconomicTable rows={series.changes.map(change=>({...change,type:change.before===null?'新增':change.after===null?'撤回':'修订'}))} columns={[["date","观测期"],["type","变更类型"],["before","上版值"],["after","本版值"]]} label={series.label+"本次变更记录"}/>}
        </section>
      )}
    </details>
  );
}
