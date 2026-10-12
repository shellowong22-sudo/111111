import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Download, Activity, Database, CalendarDays, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useMarketWebSocket } from '@/hooks/useMarketWebSocket';
import TreasuryDailyYieldEvidenceDesk from '@/components/curves/TreasuryDailyYieldEvidenceDesk';
import TreasuryHistoricalCurveAssetDesk from '@/components/curves/TreasuryHistoricalCurveAssetDesk';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import ModuleLiveDeliveryTable from '@/components/ModuleLiveDeliveryTable';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a78bfa', '#f472b6'];
const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type CurvePoint = { tenor: string; rate: number; spread: number; dataDate?: string };
type TrendAnalysis = { label: string; tone: string; description: string; slope: number | null; twoTen: number | null };

export function analyzeCurveShape(curveData: CurvePoint[]): TrendAnalysis {
  if (curveData.length < 2) return { label: '数据不足', tone: 'text-slate-400', description: '至少需要两个期限才能判断曲线形态。', slope: null, twoTen: null };
  const rates = curveData.map((point) => point.rate);
  const slope = rates[rates.length - 1] - rates[0];
  const short = curveData.find((point) => ['3M', '3m', '6M', '6m'].includes(point.tenor));
  const two = curveData.find((point) => ['2Y', '2y'].includes(point.tenor));
  const ten = curveData.find((point) => ['10Y', '10y'].includes(point.tenor));
  const twoTen = two && ten ? ten.rate - two.rate : null;
  if (slope < -0.15) return { label: '倒挂 / 防御', tone: 'text-red-400', description: '长端收益率低于短端，通常反映增长预期走弱或避险需求上升。', slope, twoTen };
  if (slope > 0.15 && (twoTen ?? 0) > 0.05) return { label: '陡峭上行', tone: 'text-emerald-400', description: '期限溢价为正且中长端利差扩张，市场定价更偏向增长或通胀风险。', slope, twoTen };
  if (short && ten && ten.rate - short.rate > 0.15) return { label: '温和上行', tone: 'text-blue-400', description: '曲线保持正斜率，长端收益率高于短端，适合继续关注期限溢价变化。', slope, twoTen };
  return { label: '平坦 / 混合', tone: 'text-amber-400', description: '各期限收益率差异有限，单一斜率信号较弱，应结合波动率和信用利差判断。', slope, twoTen };
}

function CurveTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: CurvePoint }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-600 bg-slate-800/95 p-3 text-xs shadow-xl">
      <div className="mb-2 font-semibold text-slate-100">期限：{label}</div>
      {payload.map((item, index) => <div key={`${item.name}-${index}`} className="flex min-w-[190px] justify-between gap-5 py-0.5"><span style={{ color: item.color ?? '#cbd5e1' }}>{item.name}</span><span className="font-mono text-slate-100">{Number(item.value ?? 0).toFixed(4)}%</span></div>)}
    </div>
  );
}

export default function YieldCurveAnalysis() {
  const openBBDelivery = useModuleLiveFeed('/yield-curve', true);
  const [selectedCurves, setSelectedCurves] = useState(['rate', 'spread']);
  const [selectedCurveId, setSelectedCurveId] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const { lastMessageAt, lastLatencyMs, reconnectCount } = useMarketWebSocket();

  const curvesQuery = trpc.curves.getAll.useQuery(undefined, { refetchInterval: 60_000 });
  const snapshotQuery = trpc.curves.getLatestSnapshot.useQuery({ curveId: selectedCurveId ?? 0 }, { enabled: selectedCurveId !== null, refetchInterval: 60_000 });
  const historyQuery = trpc.curves.getHistoricalYields.useQuery({ curveId: selectedCurveId ?? 0 }, { enabled: selectedCurveId !== null, refetchInterval: 60_000 });

  useEffect(() => {
    if (selectedCurveId === null && curvesQuery.data?.[0]) setSelectedCurveId(curvesQuery.data[0].id);
  }, [curvesQuery.data, selectedCurveId]);

  const historyDates = useMemo(() => Array.from(new Set((historyQuery.data ?? []).map((row) => row.dataDate))).sort(), [historyQuery.data]);

  useEffect(() => {
    if (!historyDates.length) return;
    setSelectedDates((current) => current.length ? current.filter((date) => historyDates.includes(date)) : historyDates.slice(-3));
    setDateRange((current) => ({ start: current.start || historyDates[0], end: current.end || historyDates[historyDates.length - 1] }));
  }, [historyDates]);

  const curveData = useMemo<CurvePoint[]>(() => {
    const rows = snapshotQuery.data ?? [];
    const base = toNumber(rows.find((row) => row.period.toLowerCase() === '3m')?.value);
    return rows.map((row) => {
      const rate = toNumber(row.value) ?? 0;
      return { tenor: row.period, rate, spread: base === null ? 0 : rate - base, dataDate: row.dataDate };
    });
  }, [snapshotQuery.data]);

  const historicalData = useMemo(() => {
    const grouped = new Map<string, Record<string, string | number>>();
    for (const row of historyQuery.data ?? []) {
      const current = grouped.get(row.dataDate) ?? { date: row.dataDate };
      const period = row.period.toLowerCase();
      const value = toNumber(row.value);
      if (value === null) continue;
      if (period === '3m') current.y3m = value;
      if (period === '10y') current.y10y = value;
      if (period === '30y') current.y30y = value;
      grouped.set(row.dataDate, current);
    }
    return Array.from(grouped.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [historyQuery.data]);

  const comparisonData = useMemo(() => {
    const rows = historyQuery.data ?? [];
    const periodSet = new Set(rows.filter((row) => selectedDates.includes(row.dataDate)).map((row) => row.period));
    return Array.from(periodSet).map((tenor) => {
      const point: Record<string, string | number> = { tenor };
      for (const date of selectedDates) {
        const row = rows.find((item) => item.dataDate === date && item.period === tenor);
        const value = toNumber(row?.value);
        if (value !== null) point[date] = value;
      }
      return point;
    });
  }, [historyQuery.data, selectedDates]);

  const filteredHistoricalData = useMemo(() => historicalData.filter((row) => {
    const date = String(row.date);
    return (!dateRange.start || date >= dateRange.start) && (!dateRange.end || date <= dateRange.end);
  }), [dateRange, historicalData]);

  const trend = useMemo(() => analyzeCurveShape(curveData), [curveData]);

  const toggleCurve = (curve: string) => setSelectedCurves((prev) => prev.includes(curve) ? prev.filter((item) => item !== curve) : [...prev, curve]);
  const toggleDate = (date: string) => setSelectedDates((prev) => prev.includes(date) ? prev.filter((item) => item !== date) : [...prev, date].slice(-5));
  const dataDate = snapshotQuery.data?.[0]?.dataDate;
  const streamAgeMs = lastMessageAt ? Math.max(0, Date.now() - lastMessageAt) : null;
  const streamHealthy = streamAgeMs !== null && streamAgeMs < 30_000;
  const isRefreshing = (curvesQuery.isFetching || snapshotQuery.isFetching || historyQuery.isFetching) && !(curvesQuery.isLoading || snapshotQuery.isLoading || historyQuery.isLoading);
  const latestQueryUpdateAt = Math.max(curvesQuery.dataUpdatedAt || 0, snapshotQuery.dataUpdatedAt || 0, historyQuery.dataUpdatedAt || 0);
  const handleRefresh = async () => {
    await Promise.all([
      curvesQuery.refetch(),
      selectedCurveId === null ? Promise.resolve() : snapshotQuery.refetch(),
      selectedCurveId === null ? Promise.resolve() : historyQuery.refetch(),
    ]);
  };

  const handleExport = () => {
    const lines = ['date,tenor,rate'];
    for (const date of selectedDates) for (const row of comparisonData) if (row[date] !== undefined) lines.push(`${date},${row.tenor},${row[date]}`);
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `yield-curve-comparison-${dataDate ?? 'latest'}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-50"><div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="mb-2 text-3xl font-bold">收益率曲线分析</h1><p className="text-slate-400">基于真实曲线快照与历史数据，分析不同日期的期限结构变化</p></div><div className="flex flex-wrap items-center gap-2 text-xs"><div className={`flex items-center gap-2 rounded border px-3 py-2 ${streamHealthy ? 'border-emerald-700/60 text-emerald-300' : 'border-amber-700/60 text-amber-300'}`}><Activity className="h-3.5 w-3.5" />行情流 {lastLatencyMs !== null ? `${lastLatencyMs}ms` : '等待数据'} · 重连 {reconnectCount}</div><div className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-slate-300"><Database className="h-3.5 w-3.5" />曲线日期 {dataDate ?? '读取中'}</div><div className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-slate-400" role="status" aria-live="polite">{isRefreshing ? <><RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />正在重新读取已落库曲线</> : <><Clock className="h-3.5 w-3.5" />更新 {latestQueryUpdateAt ? new Date(latestQueryUpdateAt).toLocaleTimeString('zh-CN', { hour12: false }) : '待载入'}</>}</div><Button size="sm" variant="outline" onClick={() => { void handleRefresh(); }} disabled={curvesQuery.isLoading || isRefreshing} className="border-slate-700 text-slate-200 hover:bg-slate-800" aria-label="刷新收益率曲线数据"><RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />刷新</Button></div></div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4"><div className="md:col-span-2"><label className="mb-2 block text-sm text-slate-400">曲线品种</label><select value={selectedCurveId ?? ''} onChange={(event) => { setSelectedCurveId(Number(event.target.value)); setSelectedDates([]); }} className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" disabled={curvesQuery.isLoading || !curvesQuery.data?.length}>{curvesQuery.data?.map((curve) => <option key={curve.id} value={curve.id}>{curve.name} · {curve.currency ?? 'N/A'}</option>)}</select></div><div><label className="mb-2 block text-sm text-slate-400">开始日期</label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))} className="border-slate-700 bg-slate-900" /></div><div><label className="mb-2 block text-sm text-slate-400">结束日期</label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))} className="border-slate-700 bg-slate-900" /></div></div>

      <div className="mb-6 flex flex-wrap gap-2"><Button onClick={() => toggleCurve('rate')} variant={selectedCurves.includes('rate') ? 'default' : 'outline'} className={selectedCurves.includes('rate') ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-700'}>最新收益率曲线</Button><Button onClick={() => toggleCurve('spread')} variant={selectedCurves.includes('spread') ? 'default' : 'outline'} className={selectedCurves.includes('spread') ? 'bg-green-600 hover:bg-green-700' : 'border-slate-700'}>相对3M利差</Button><Button onClick={handleExport} variant="outline" disabled={!comparisonData.length} className="border-slate-700"><Download className="mr-2 h-4 w-4" />导出对比 CSV</Button></div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><Card className="relative border-slate-700 bg-slate-900 p-4"><h2 className="mb-4 text-lg font-semibold">最新期限结构曲线</h2>{isRefreshing && !snapshotQuery.isLoading && <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded bg-slate-800/95 px-2 py-1 text-xs text-blue-300 shadow" role="status"><RefreshCw className="h-3 w-3 animate-spin" />后台更新中</div>}{snapshotQuery.isLoading ? <Skeleton className="h-[300px] w-full bg-slate-800" /> : curveData.length === 0 ? <div className="flex h-[300px] items-center justify-center text-slate-500">暂无曲线快照数据</div> : <ResponsiveContainer width="100%" height={300}><LineChart data={curveData}><CartesianGrid strokeDasharray="3 3" stroke="#475569" /><XAxis dataKey="tenor" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip content={<CurveTooltip />} /><Legend />{selectedCurves.includes('rate') && <Line type="monotone" dataKey="rate" stroke="#3b82f6" name="收益率 (%)" dot={{ fill: '#3b82f6' }} strokeWidth={2} isAnimationActive={false} />}{selectedCurves.includes('spread') && <Line type="monotone" dataKey="spread" stroke="#10b981" name="相对3M利差 (%)" dot={{ fill: '#10b981' }} strokeWidth={2} isAnimationActive={false} />}</LineChart></ResponsiveContainer>}</Card></div><div><Card className="sticky top-6 border-slate-700 bg-slate-900 p-4"><h2 className="mb-4 text-lg font-semibold">期限数据</h2>{snapshotQuery.isLoading ? <div className="space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 w-full bg-slate-800" />)}</div> : <div className="max-h-96 space-y-2 overflow-y-auto">{curveData.map((item) => <div key={item.tenor} className="rounded border border-slate-700 bg-slate-800 p-2"><div className="mb-1 flex items-center justify-between"><span className="font-mono text-sm text-blue-400">{item.tenor}</span><TrendingUp className="h-4 w-4 text-green-400" /></div><div className="flex justify-between text-xs"><span className="text-slate-400">收益率:</span><span>{item.rate.toFixed(4)}%</span></div><div className="flex justify-between text-xs"><span className="text-slate-400">相对3M利差:</span><span>{item.spread.toFixed(4)}%</span></div></div>)}</div>}</Card></div></div>

      <Card className="mt-6 border-slate-700 bg-slate-900 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">多日期曲线对比</h2><p className="text-xs text-slate-400">最多选择 5 个日期，叠加查看期限结构如何移动。</p></div><CalendarDays className="h-5 w-5 text-blue-400" /></div><div className="mb-4 flex flex-wrap gap-2">{historyDates.slice(-14).map((date) => <button key={date} type="button" onClick={() => toggleDate(date)} className={`rounded border px-2.5 py-1.5 text-xs transition-colors ${selectedDates.includes(date) ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{date}</button>)}</div>{historyQuery.isLoading ? <Skeleton className="h-[320px] w-full bg-slate-800" /> : comparisonData.length === 0 ? <div className="flex h-[320px] items-center justify-center text-slate-500">请选择至少一个历史日期</div> : <ResponsiveContainer width="100%" height={320}><LineChart data={comparisonData}><CartesianGrid strokeDasharray="3 3" stroke="#475569" /><XAxis dataKey="tenor" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip content={<CurveTooltip />} /><Legend />{selectedDates.map((date, index) => <Line key={date} type="monotone" dataKey={date} name={date} stroke={COLORS[index % COLORS.length]} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />)}</LineChart></ResponsiveContainer>}</Card>

      <Card className="mt-6 border-slate-700 bg-slate-900 p-4"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-400" /><h2 className="text-lg font-semibold">市场趋势分析</h2><span className="text-xs text-slate-500">基于当前曲线形态</span></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div className="rounded border border-slate-700 bg-slate-800/70 p-4"><div className="mb-1 text-xs text-slate-400">形态判断</div><div className={`text-xl font-semibold ${trend.tone}`}>{trend.label}</div><p className="mt-2 text-xs leading-5 text-slate-300">{trend.description}</p></div><div className="rounded border border-slate-700 bg-slate-800/70 p-4"><div className="mb-1 text-xs text-slate-400">首尾期限斜率</div><div className="text-xl font-semibold text-slate-100">{trend.slope === null ? '—' : `${trend.slope >= 0 ? '+' : ''}${trend.slope.toFixed(3)}%`}</div><p className="mt-2 text-xs text-slate-400">最长期限收益率减最短期限收益率</p></div><div className="rounded border border-slate-700 bg-slate-800/70 p-4"><div className="mb-1 text-xs text-slate-400">2Y–10Y 利差</div><div className="text-xl font-semibold text-slate-100">{trend.twoTen === null ? '—' : `${trend.twoTen >= 0 ? '+' : ''}${trend.twoTen.toFixed(3)}%`}</div><p className="mt-2 text-xs text-slate-400">用于观察中端与长端定价分化</p></div></div></Card>

      <Card className="mt-6 border-slate-700 bg-slate-900 p-4"><h2 className="mb-4 text-lg font-semibold">历史收益率演变</h2>{historyQuery.isLoading ? <Skeleton className="h-[300px] w-full bg-slate-800" /> : filteredHistoricalData.length === 0 ? <div className="flex h-[300px] items-center justify-center text-slate-500">当前日期范围暂无历史数据</div> : <ResponsiveContainer width="100%" height={300}><LineChart data={filteredHistoricalData}><CartesianGrid strokeDasharray="3 3" stroke="#475569" /><XAxis dataKey="date" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip content={<CurveTooltip />} /><Legend /><Line type="monotone" dataKey="y3m" stroke="#3b82f6" name="3个月" strokeWidth={2} isAnimationActive={false} connectNulls /><Line type="monotone" dataKey="y10y" stroke="#10b981" name="10年" strokeWidth={2} isAnimationActive={false} connectNulls /><Line type="monotone" dataKey="y30y" stroke="#f59e0b" name="30年" strokeWidth={2} isAnimationActive={false} connectNulls /></LineChart></ResponsiveContainer>}</Card>
      <ModuleLiveDeliveryTable {...openBBDelivery} title="OpenBB 收益率曲线数据投递" />
      <TreasuryDailyYieldEvidenceDesk />
      <TreasuryHistoricalCurveAssetDesk />
    </div></div>
  );
}
