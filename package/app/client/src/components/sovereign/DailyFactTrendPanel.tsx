import { useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, Download, LineChart as LineChartIcon } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';

type SourceKey = 'fred-rates' | 'treasury-auctions' | 'fred-oecd-10y' | 'world-bank-macro';
type MetricDefinition = { key: string; label: string; unit: string };
type ChartRow = { date: string; snapshotDate: string; observationDate: string } & Record<string, string | number | null>;
const SOURCES: Array<{ key: SourceKey; label: string }> = [{ key: 'fred-rates', label: 'FRED 利率/期限差' }, { key: 'treasury-auctions', label: '财政部拍卖' }, { key: 'fred-oecd-10y', label: 'FRED/OECD 10Y' }, { key: 'world-bank-macro', label: 'World Bank 宏观' }];
const COLORS = ['#22d3ee', '#a78bfa', '#fbbf24'];

function csvCell(value: unknown) { const text = value === null || value === undefined ? '' : String(value); return `"${text.replaceAll('"', '""')}"`; }
function numericMetrics(value: object): Record<string, number | null> { return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'number' || item === null)) as Record<string, number | null>; }

export function DailyFactTrendPanel({ initialSourceKey = 'fred-rates', title = '每日快照跨日差异（真实已存档数据）' }: { initialSourceKey?: SourceKey; title?: string }) {
  const [sourceKey, setSourceKey] = useState<SourceKey>(initialSourceKey);
  const [selectedMetricKey, setSelectedMetricKey] = useState('');
  const [threshold, setThreshold] = useState(0.05);
  const trend = trpc.sovereignBonds.getDailyFactTrend.useQuery({ sourceKey, days: 30 }, { staleTime: 60_000, refetchOnWindowFocus: false });
  const data = trend.data;
  const definitions = (data?.definitions ?? []) as MetricDefinition[];
  const selectedMetric = definitions.find((definition) => definition.key === selectedMetricKey) ?? definitions[0];
  const points = data?.points ?? [];
  const chartData: ChartRow[] = points.map((point) => ({
    date: point.snapshotDate.slice(5), snapshotDate: point.snapshotDate, observationDate: point.observationDate,
    ...numericMetrics(point.metrics),
    ...Object.fromEntries(Object.entries(numericMetrics(point.difference)).map(([key, value]) => [`delta_${key}`, value])),
  }));
  const latest = points.at(-1);
  const downloadCsv = () => {
    if (!data || !selectedMetric) return;
    const header = ['source_key', 'snapshot_date', 'observation_date', ...definitions.map((definition) => `${definition.key}_value`), ...definitions.map((definition) => `${definition.key}_day_change`)];
    const rows = points.map((point) => [sourceKey, point.snapshotDate, point.observationDate, ...definitions.map((definition) => numericMetrics(point.metrics)[definition.key]), ...definitions.map((definition) => numericMetrics(point.difference)[definition.key])]);
    const csv = [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `sovereign-daily-fact-trend-${sourceKey}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const metricValue = (value: unknown) => typeof value === 'number' ? value.toFixed(3) : '—';
  return <details className="mt-2 rounded border border-sky-900/50 bg-sky-950/10 px-2 py-1.5">
    <summary className="cursor-pointer select-none text-sky-200 marker:text-sky-400"><LineChartIcon className="mr-1 inline h-3.5 w-3.5" />{title}</summary>
    <div className="mt-2 space-y-2 text-[10px] leading-4">
      <div className="flex flex-wrap items-center gap-1.5"><CalendarDays className="h-3 w-3 text-slate-500" />{SOURCES.map((source) => <button type="button" key={source.key} onClick={() => { setSourceKey(source.key); setSelectedMetricKey(''); }} className={`rounded border px-1.5 py-0.5 ${source.key === sourceKey ? 'border-sky-500 bg-sky-950/70 text-sky-100' : 'border-slate-700 text-slate-400 hover:border-sky-800'}`}>{source.label}</button>)}</div>
      {trend.isLoading ? <div className="h-32 animate-pulse rounded bg-slate-800/70" /> : null}
      {trend.isError ? <p className="rounded border border-amber-900/60 bg-amber-950/20 p-2 text-amber-200">跨日快照暂不可读取；系统未生成替代曲线。可稍后重试。</p> : null}
      {data && !data.available ? <p className="rounded border border-slate-800 bg-slate-950/50 p-2 text-slate-400">{data.limitation}</p> : null}
      {data?.available && selectedMetric ? <><div className="flex flex-wrap items-end gap-2 rounded border border-slate-800 bg-slate-950/50 p-2"><label className="text-slate-500">高亮指标<select value={selectedMetric.key} onChange={(event) => setSelectedMetricKey(event.target.value)} className="ml-1 input-terminal"><>{definitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.label} ({definition.unit})</option>)}</></select></label><label className="text-slate-500">日差阈值<input aria-label="日差阈值" type="number" min="0" step="0.001" value={threshold} onChange={(event) => setThreshold(Math.max(0, Number(event.target.value) || 0))} className="ml-1 w-20 input-terminal" /></label><button type="button" onClick={downloadCsv} className="inline-flex h-7 items-center gap-1 rounded border border-cyan-800 px-2 text-cyan-200 hover:bg-cyan-950/60"><Download className="h-3.5 w-3.5" />导出 CSV</button></div><div className="h-40 rounded border border-slate-800 bg-slate-950/50 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={42} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 10 }} labelStyle={{ color: '#e2e8f0' }} labelFormatter={(label, payload) => `抓取日：${payload?.[0]?.payload?.snapshotDate ?? label}；观测期：${payload?.[0]?.payload?.observationDate ?? '—'}`} formatter={(value, name) => [`${metricValue(value)}`, name]} />{definitions.map((definition, index) => <Line key={definition.key} type="monotone" dataKey={definition.key} name={`${definition.label} (${definition.unit})`} stroke={COLORS[index % COLORS.length]} strokeWidth={1.8} dot={{ r: 2 }} connectNulls />)}</LineChart></ResponsiveContainer></div><div className="h-24 rounded border border-slate-800 bg-slate-950/50 p-2"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={42} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 10 }} labelFormatter={(label, payload) => `抓取日：${payload?.[0]?.payload?.snapshotDate ?? label}`} formatter={(value) => [`${metricValue(value)} ${selectedMetric.unit}`, `${selectedMetric.label} 日差`]} /><Bar dataKey={`delta_${selectedMetric.key}`} name={`${selectedMetric.label} 日差`}>{chartData.map((item, index) => { const value = item[`delta_${selectedMetric.key}`]; return <Cell key={`${item.snapshotDate}-${index}`} fill={typeof value === 'number' && Math.abs(value) >= threshold ? '#f43f5e' : '#0ea5e9'} />; })}</Bar></BarChart></ResponsiveContainer></div><div className="flex flex-wrap gap-1.5"><BarChart3 className="h-3 w-3 text-sky-400" />{definitions.map((definition) => { const difference = latest?.difference[definition.key as keyof typeof latest.difference]; const breached = definition.key === selectedMetric.key && typeof difference === 'number' && Math.abs(difference) >= threshold; return <span key={definition.key} className={`rounded border px-1.5 py-0.5 ${breached ? 'border-rose-500/80 bg-rose-950/30 text-rose-200' : typeof difference === 'number' ? difference > 0 ? 'border-emerald-900/60 text-emerald-300' : difference < 0 ? 'border-rose-900/60 text-rose-300' : 'border-slate-700 text-slate-300' : 'border-slate-700 text-slate-500'}`}>{breached ? <AlertTriangle className="mr-0.5 inline h-3 w-3" /> : null}{definition.label}：{typeof difference === 'number' ? `${difference > 0 ? '+' : ''}${difference.toFixed(3)} ${definition.unit}` : '无可比前日'}</span>; })}</div><p className="text-slate-500">阈值仅用于视觉核验提示，不构成交易信号。{data.limitation}</p></> : null}
    </div>
  </details>;
}
