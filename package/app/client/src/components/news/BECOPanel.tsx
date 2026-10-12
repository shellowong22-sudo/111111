import { useMemo, useState } from 'react';
import { Activity, Database, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';

type BecoPoint = {
  period: string;
  value: number | null;
  unit: string;
  label: string;
};

type BecoSlice = 'growth' | 'inflation' | 'employment' | 'rates' | 'cycle';
type ChartRow = Record<string, string | number | null> & { period: string };

const COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa'];
const TABS: Array<{ id: string; label: string }> = [
  { id: 'gdp', label: 'GDP增速' },
  { id: 'inflation', label: '通胀走势' },
  { id: 'employment', label: '就业数据' },
  { id: 'rates', label: '利率路径' },
  { id: 'cycle', label: '经济周期' },
];

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value);
}

function formatCheckedAt(value?: string): string {
  if (!value) return '未接入';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? '未接入' : parsed.toLocaleString('zh-CN', { hour12: false });
}

function labelsFor(points: BecoPoint[]): string[] {
  return Array.from(new Set(points.map((point) => point.label)));
}

function pivotPoints(points: BecoPoint[]): ChartRow[] {
  const byPeriod = new Map<string, ChartRow>();
  for (const point of points) {
    const row = byPeriod.get(point.period) ?? { period: point.period };
    row[point.label] = point.value;
    byPeriod.set(point.period, row);
  }
  return Array.from(byPeriod.values()).sort((left, right) => left.period.localeCompare(right.period));
}

function latestByLabel(points: BecoPoint[]): BecoPoint[] {
  const latest = new Map<string, BecoPoint>();
  for (const point of [...points].sort((left, right) => left.period.localeCompare(right.period))) {
    latest.set(point.label, point);
  }
  return Array.from(latest.values());
}

function EmptySlice({ message }: { message: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950/30 p-6 text-center text-xs leading-5 text-slate-500">
      {message}；不使用固定样例、随机数或其他功能的数据替代。
    </div>
  );
}

function LatestCards({ points }: { points: BecoPoint[] }) {
  const rows = latestByLabel(points);
  return (
    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {rows.map((point, index) => (
        <div key={`${point.label}-${point.period}`} className="rounded border border-slate-800 bg-slate-900/60 p-2">
          <div className="truncate text-[10px] text-slate-400">{point.label}</div>
          <div className="mt-1 font-bold" style={{ color: COLORS[index % COLORS.length] }}>
            {formatNumber(point.value)} <span className="text-[9px] font-normal text-slate-500">{point.unit}</span>
          </div>
          <div className="mt-1 text-[9px] text-slate-600">观察期 {point.period}</div>
        </div>
      ))}
    </div>
  );
}

function GrowthPanel({ points }: { points: BecoPoint[] }) {
  const data = useMemo(() => pivotPoints(points), [points]);
  const labels = useMemo(() => labelsFor(points), [points]);
  if (data.length === 0) return <EmptySlice message="GDP 官方实际观察当前未接入" />;
  return (
    <>
      <div className="mb-2 text-slate-400">GDP 官方实际观察（按原始单位与观察期）</div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data.slice(-16)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 9 }} minTickGap={24} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
            <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <ReferenceLine y={0} stroke="#475569" />
            {labels.map((label, index) => <Bar key={label} dataKey={label} fill={COLORS[index % COLORS.length]} fillOpacity={0.82} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <LatestCards points={points} />
    </>
  );
}

function InflationPanel({ points }: { points: BecoPoint[] }) {
  const data = useMemo(() => pivotPoints(points), [points]);
  const labels = useMemo(() => labelsFor(points), [points]);
  if (data.length === 0) return <EmptySlice message="通胀官方实际观察当前未接入" />;
  return (
    <>
      <div className="mb-2 text-slate-400">通胀指标历史观察（各序列保留原始单位）</div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={data.slice(-36)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={28} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
            <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            {labels.map((label, index) => <Line key={label} type="monotone" dataKey={label} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <LatestCards points={points} />
    </>
  );
}

function EmploymentPanel({ points }: { points: BecoPoint[] }) {
  const groups = useMemo(() => labelsFor(points).map((label) => ({ label, points: points.filter((point) => point.label === label) })), [points]);
  if (groups.length === 0) return <EmptySlice message="就业官方实际观察当前未接入" />;
  return (
    <>
      <div className="mb-2 text-slate-400">就业数据独立序列（不同单位不合并量纲）</div>
      <div className="grid gap-2 xl:grid-cols-3">
        {groups.map((group, index) => (
          <section key={group.label} className="rounded border border-slate-800 bg-slate-900/60 p-2">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="truncate text-slate-300">{group.label}</span>
              <span className="shrink-0 text-slate-500">{group.points[0]?.unit ?? '—'}</span>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={group.points.slice().sort((a, b) => a.period.localeCompare(b.period)).slice(-24)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={32} />
                <YAxis tick={{ fill: '#64748b', fontSize: 8 }} width={38} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Line type="monotone" dataKey="value" name={group.label} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        ))}
      </div>
      <LatestCards points={points} />
    </>
  );
}

function RatesPanel({ points }: { points: BecoPoint[] }) {
  const data = useMemo(() => pivotPoints(points), [points]);
  const labels = useMemo(() => labelsFor(points), [points]);
  if (data.length === 0) return <EmptySlice message="央行利率官方实际观察当前未接入" />;
  return (
    <>
      <div className="mb-2 text-slate-400">央行政策利率实际观察（不生成未来利率路径或概率）</div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={data.slice(-36)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={28} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
            <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <ReferenceLine y={0} stroke="#475569" />
            {labels.map((label, index) => <Line key={label} type="stepAfter" dataKey={label} stroke={COLORS[index % COLORS.length]} strokeWidth={2.4} dot={false} connectNulls={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <LatestCards points={points} />
    </>
  );
}

function CyclePanel({ points }: { points: BecoPoint[] }) {
  const groups = useMemo(() => labelsFor(points).map((label) => ({ label, points: points.filter((point) => point.label === label).sort((a, b) => a.period.localeCompare(b.period)) })), [points]);
  if (groups.length === 0) return <EmptySlice message="经济周期官方实际观察当前未接入" />;
  return (
    <>
      <div className="mb-2 text-slate-400">经济周期观察板（仅展示原始指标，不推断扩张、收缩或交易信号）</div>
      <div className="space-y-2">
        {groups.map((group, index) => {
          const latest = group.points[group.points.length - 1];
          return (
            <section key={group.label} className="grid min-h-28 grid-cols-[minmax(180px,0.35fr)_1fr] items-center gap-3 rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
              <div>
                <div className="text-slate-100">{group.label}</div>
                <div className="mt-2 text-lg font-bold" style={{ color: COLORS[index % COLORS.length] }}>{formatNumber(latest?.value ?? null)}</div>
                <div className="text-[9px] text-slate-500">{latest?.unit ?? '—'} · 观察期 {latest?.period ?? '—'}</div>
              </div>
              <ResponsiveContainer width="100%" height={88}>
                <LineChart data={group.points.slice(-24)}>
                  <XAxis dataKey="period" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  <Line type="monotone" dataKey="value" name={group.label} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function BECOPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('gdp');
  const query = trpc.newsResearch.getBecoOfficialMacroStatus.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const snapshot = query.data;
  const slices: Record<BecoSlice, BecoPoint[]> = {
    growth: (snapshot?.growth ?? []) as BecoPoint[],
    inflation: (snapshot?.inflation ?? []) as BecoPoint[],
    employment: (snapshot?.employment ?? []) as BecoPoint[],
    rates: (snapshot?.rates ?? []) as BecoPoint[],
    cycle: (snapshot?.cycle ?? []) as BecoPoint[],
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#060a0e] font-mono text-xs text-slate-100" data-beco-contract={snapshot?.dataContractId ?? 'news-beco-official-macro'}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-teal-900/40 bg-[#080c14] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-teal-400" />
          <span className="font-bold text-teal-400">BECO</span>
          <span className="truncate text-slate-500">全球宏观经济 · GDP · 通胀 · 就业 · 利率路径</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[9px] ${snapshot?.dataStatus === 'available' ? 'border-emerald-900 text-emerald-300' : 'border-amber-900 text-amber-300'}`}>
            {query.isLoading ? '读取中' : snapshot?.dataStatus === 'available' ? '已接入' : '未接入'}
          </span>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-300 hover:border-teal-700 hover:text-teal-200 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${query.isFetching ? 'animate-spin' : ''}`} />刷新
          </button>
          {onClose && <button type="button" onClick={onClose} className="ml-1 text-slate-600 hover:text-slate-300">✕</button>}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-900 bg-slate-950/50 px-3 py-1.5 text-[9px] text-slate-500">
        <Database className="h-3 w-3 text-teal-600" />
        <span>服务端清洗数据</span><span>·</span><span>查询时间 {formatCheckedAt(snapshot?.checkedAt)}</span><span>·</span><span className="truncate">{snapshot?.limitation ?? '仅显示可验证的官方实际观察。'}</span>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="h-8 shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-teal-900/30 bg-[#080c14] px-2">
          {TABS.map((item) => <TabsTrigger key={item.id} value={item.id} className="h-6 shrink-0 rounded px-3 text-xs text-slate-500 data-[state=active]:bg-teal-900/40 data-[state=active]:text-teal-300">{item.label}</TabsTrigger>)}
        </TabsList>

        {query.isLoading ? (
          <div className="m-3 h-64 animate-pulse rounded border border-slate-800 bg-slate-900/60" />
        ) : query.isError ? (
          <div className="m-3 flex min-h-64 items-center justify-center rounded border border-red-900/60 bg-red-950/20 p-5 text-center text-red-200">官方宏观数据当前无法读取；不显示静态或模拟替代值。</div>
        ) : (
          <>
            <TabsContent value="gdp" className="m-0 flex-1 overflow-y-auto p-3"><GrowthPanel points={slices.growth} /></TabsContent>
            <TabsContent value="inflation" className="m-0 flex-1 overflow-y-auto p-3"><InflationPanel points={slices.inflation} /></TabsContent>
            <TabsContent value="employment" className="m-0 flex-1 overflow-y-auto p-3"><EmploymentPanel points={slices.employment} /></TabsContent>
            <TabsContent value="rates" className="m-0 flex-1 overflow-y-auto p-3"><RatesPanel points={slices.rates} /></TabsContent>
            <TabsContent value="cycle" className="m-0 flex-1 overflow-y-auto p-3"><CyclePanel points={slices.cycle} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
