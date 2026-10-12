import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ViewType =
  | 'gdpCpiScatter'
  | 'forecastAccuracy'
  | 'revisionHistory'
  | 'disagreementIndex'
  | 'deviationHeatmap'
  | 'economicSurprise'
  | 'forecastRange';

type ForecastRow = {
  economy: string;
  year: number;
  gdpGrowthPct: number | null;
  inflationPct: number | null;
  periodKind: 'historical_or_estimate' | 'estimate_or_forecast' | 'forecast';
};

const ECONOMIES = ['WEOWORLD', 'USA', 'CHN', 'DEU', 'JPN', 'GBR', 'IND', 'BRA'] as const;
const ECONOMY_LABELS: Record<string, string> = {
  WEOWORLD: '全球', USA: '美国', CHN: '中国', DEU: '德国', JPN: '日本',
  GBR: '英国', IND: '印度', BRA: '巴西',
};

const VIEW_LABELS: Record<ViewType, string> = {
  gdpCpiScatter: 'GDP/CPI预测散点图',
  forecastAccuracy: '预测精度排行榜',
  revisionHistory: '预测修正历史追踪',
  disagreementIndex: '预测分歧指数',
  deviationHeatmap: '预测vs实际偏差热力矩阵',
  economicSurprise: '经济意外指数',
  forecastRange: '预测区间可视化',
};

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values: number[]) {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function valueText(value: number | null, suffix = '%') {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}${suffix}`;
}

function BoundaryState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-[400px] place-items-center rounded border border-dashed border-slate-700 bg-slate-950/35 p-8 text-center">
      <div className="max-w-2xl">
        <h3 className="text-base font-semibold text-slate-200">{title}</h3>
        <p className="mt-2 text-xs leading-6 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

const ECFCTab: React.FC = () => {
  const currentYear = new Date().getUTCFullYear();
  const [currentView, setCurrentView] = useState<ViewType>('gdpCpiScatter');
  const [selectedDateRange, setSelectedDateRange] = useState<[number, number]>([0, 0]);
  const [selectedEconomy, setSelectedEconomy] = useState('ALL');
  const forecast = trpc.freeMarketData.imfForecastMatrix.useQuery(
    { economies: [...ECONOMIES] },
    { staleTime: 15 * 60_000, refetchInterval: 15 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  );

  const rows = useMemo(
    () => ((forecast.data?.rows ?? []) as ForecastRow[])
      .filter(row => row.year >= currentYear - 5 && row.year <= currentYear + 5),
    [forecast.data?.rows, currentYear],
  );
  const allYears = useMemo(
    () => [...new Set(rows.map(row => row.year))].sort((left, right) => left - right),
    [rows],
  );
  const presentEconomies = useMemo(
    () => ECONOMIES.filter(economy => rows.some(row => row.economy === economy)),
    [rows],
  );

  useEffect(() => {
    if (!allYears.length) return;
    setSelectedDateRange([0, allYears.length - 1]);
  }, [allYears.length]);

  const filteredRows = useMemo(() => rows.filter(row => {
    const yearIndex = allYears.indexOf(row.year);
    return yearIndex >= selectedDateRange[0]
      && yearIndex <= selectedDateRange[1]
      && (selectedEconomy === 'ALL' || row.economy === selectedEconomy);
  }), [allYears, rows, selectedDateRange, selectedEconomy]);

  const scatterRows = useMemo(() => filteredRows.flatMap(row =>
    row.gdpGrowthPct === null || row.inflationPct === null ? [] : [{
      economy: ECONOMY_LABELS[row.economy] ?? row.economy,
      year: row.year,
      gdpForecast: row.gdpGrowthPct,
      cpiForecast: row.inflationPct,
      periodKind: row.periodKind,
    }]), [filteredRows]);

  const dispersionRows = useMemo(() => allYears.map(year => {
    const yearRows = rows.filter(row => row.year === year);
    const gdpValues = yearRows.flatMap(row => row.gdpGrowthPct === null ? [] : [row.gdpGrowthPct]);
    const cpiValues = yearRows.flatMap(row => row.inflationPct === null ? [] : [row.inflationPct]);
    return { year, gdpStdDev: standardDeviation(gdpValues), cpiStdDev: standardDeviation(cpiValues) };
  }).filter(row => row.gdpStdDev !== null || row.cpiStdDev !== null), [allYears, rows]);

  const pathEconomy = selectedEconomy === 'ALL' ? 'WEOWORLD' : selectedEconomy;
  const pathRows = useMemo(() => filteredRows
    .filter(row => row.economy === pathEconomy)
    .map(row => ({ year: row.year, gdpGrowthPct: row.gdpGrowthPct, inflationPct: row.inflationPct })),
  [filteredRows, pathEconomy]);

  const referenceYear = allYears.find(year => year > currentYear) ?? allYears.at(-1) ?? null;
  const referenceRows = referenceYear === null ? [] : rows.filter(row => row.year === referenceYear);
  const averageGdp = mean(referenceRows.flatMap(row => row.gdpGrowthPct === null ? [] : [row.gdpGrowthPct]));
  const averageInflation = mean(referenceRows.flatMap(row => row.inflationPct === null ? [] : [row.inflationPct]));
  const crossEconomyDispersion = standardDeviation(referenceRows.flatMap(row => row.gdpGrowthPct === null ? [] : [row.gdpGrowthPct]));

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    toast.info(`切换到视图: ${VIEW_LABELS[view]}`);
  };

  const handleSliderChange = (value: number[]) => {
    const start = value[0] ?? selectedDateRange[0];
    const end = value[1] ?? start;
    setSelectedDateRange([start, end]);
    const startDate = allYears[start];
    const endDate = allYears[end];
    if (!startDate || !endDate) {
      toast.error('日期范围缺少可读端点，未应用变更。');
      return;
    }
    toast.info(`日期范围已调整: ${startDate} - ${endDate}`);
  };

  const renderView = () => {
    if (forecast.isLoading)
      return <BoundaryState title="正在读取预测数据" detail="读取完成前不显示静态样例、历史缓存或随机数。" />;
    if (forecast.error || !forecast.data?.available || !rows.length)
      return <BoundaryState title="预测数据当前未接入" detail="上游本次没有返回可验证记录；页面保留原功能入口，但不会用同质化数据填充。" />;
    if (currentView === 'forecastAccuracy')
      return <BoundaryState title="预测精度排行榜等待历史版本" detail="当前接口只提供最新预测版本。没有逐期归档的历史预测快照与同口径实际值，不能计算机构排名。" />;
    if (currentView === 'revisionHistory')
      return <BoundaryState title="预测修正历史等待版本归档" detail="首次接入后将按发布时间保存新版本；积累至少两个可核验版本前，不伪造前次预测或修正幅度。" />;
    if (currentView === 'deviationHeatmap')
      return <BoundaryState title="预测与实际偏差尚不可计算" detail="预测值和最终实际发布值必须按经济体、指标、年份和版本一一对齐；当前没有足够的同口径终值。" />;
    if (currentView === 'economicSurprise')
      return <BoundaryState title="经济意外指数未获授权" detail="该指数需要有许可的预期调查与实际发布数据。当前不使用 GDP、CPI 或其他公开序列冒充。" />;
    if (currentView === 'disagreementIndex')
      return (
        <div className="p-4">
          <h3 className="mb-2 text-lg font-semibold text-gray-300">预测分歧指数</h3>
          <p className="mb-4 text-xs text-slate-500">当前仅计算所选八个经济体的横截面标准差，不表示机构间分歧，也不复用其他页面数据。</p>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dispersionRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
              <XAxis dataKey="year" stroke="#CBD5E0" />
              <YAxis stroke="#CBD5E0" />
              <Tooltip contentStyle={{ backgroundColor: '#2D3748', border: 'none', color: '#CBD5E0' }} />
              <Legend />
              <Line type="monotone" dataKey="gdpStdDev" stroke="#FFBB28" name="GDP 增速横截面标准差" connectNulls />
              <Line type="monotone" dataKey="cpiStdDev" stroke="#FF8042" name="CPI 通胀横截面标准差" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    if (currentView === 'forecastRange')
      return (
        <div className="p-4">
          <h3 className="mb-2 text-lg font-semibold text-gray-300">预测区间可视化</h3>
          <p className="mb-4 text-xs text-slate-500">当前公开版本只提供点预测，因此仅显示{ECONOMY_LABELS[pathEconomy] ?? pathEconomy}年度路径；上下限与分位数保持为空。</p>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={pathRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
              <XAxis dataKey="year" stroke="#CBD5E0" />
              <YAxis stroke="#CBD5E0" unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#2D3748', border: 'none', color: '#CBD5E0' }} />
              <Legend />
              <Line type="monotone" dataKey="gdpGrowthPct" stroke="#60A5FA" name="GDP 增速" connectNulls />
              <Line type="monotone" dataKey="inflationPct" stroke="#F59E0B" name="CPI 通胀" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    return (
      <div className="p-4">
        <p className="mb-3 text-xs text-slate-500">每个点对应一个经济体和年度；未来年度为预测，当年为估计或预测，过去年度可能包含修订估计。</p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
            <XAxis type="number" dataKey="gdpForecast" name="GDP预测" unit="%" stroke="#CBD5E0" />
            <YAxis type="number" dataKey="cpiForecast" name="CPI预测" unit="%" stroke="#CBD5E0" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#2D3748', border: 'none', color: '#CBD5E0' }} />
            <Scatter name="GDP/CPI预测" data={scatterRows} fill="#8884d8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const kpis = [
    { label: '平均GDP预测', value: valueText(averageGdp), detail: referenceYear ? `${referenceYear} · 经济体样本均值` : '未接入' },
    { label: '平均CPI预测', value: valueText(averageInflation), detail: referenceYear ? `${referenceYear} · 经济体样本均值` : '未接入' },
    { label: '预测分歧指数', value: valueText(crossEconomyDispersion, ''), detail: referenceYear ? `${referenceYear} · GDP 横截面标准差` : '未接入' },
    { label: '经济意外指数', value: '—', detail: '授权预期调查未接入' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-6 font-sans text-gray-300">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-gray-100">经济预测分析 (ECFC)</h1><p className="mt-1 text-xs text-slate-500">后端清洗的当前公开预测版本 · 15 分钟检查 · 无外部跳转</p></div>
        <Button variant="outline" onClick={() => forecast.refetch()} disabled={forecast.isFetching}>{forecast.isFetching ? '读取中…' : '刷新当前版本'}</Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => <Card key={kpi.label} className="border-gray-700 bg-gray-800 text-gray-300"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-400">{kpi.label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-gray-100">{kpi.value}</div><p className="mt-1 text-xs text-slate-500">{kpi.detail}</p></CardContent></Card>)}
      </div>

      <Card className="mb-6 border-gray-700 bg-gray-800 text-gray-300">
        <CardHeader><CardTitle className="text-gray-100">视图和筛选</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4">
            {(Object.entries(VIEW_LABELS) as Array<[ViewType, string]>).map(([view, label]) => <Button key={view} onClick={() => handleViewChange(view)} variant={currentView === view ? 'default' : 'outline'} className="border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600">{label}</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2"><span className="text-gray-400">日期范围:</span><Slider min={0} max={Math.max(allYears.length - 1, 0)} step={1} value={selectedDateRange} onValueChange={handleSliderChange} disabled={!allYears.length} className="w-[200px]" /><span className="text-gray-400">{allYears[selectedDateRange[0]] ?? '未选日期'} - {allYears[selectedDateRange[1]] ?? '未选日期'}</span></div>
            <div className="flex items-center gap-2"><span className="text-gray-400">机构/经济体:</span><Select onValueChange={value => { setSelectedEconomy(value); toast.info(`筛选: ${value === 'ALL' ? '所有经济体' : ECONOMY_LABELS[value] ?? value}`); }} value={selectedEconomy}><SelectTrigger className="w-[180px] border-gray-600 bg-gray-700 text-gray-200"><SelectValue placeholder="选择经济体" /></SelectTrigger><SelectContent className="border-gray-700 bg-gray-800 text-gray-300"><SelectItem value="ALL">所有经济体</SelectItem>{presentEconomies.map(economy => <SelectItem key={economy} value={economy}>{ECONOMY_LABELS[economy] ?? economy}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-700 bg-gray-800 text-gray-300"><CardContent className="p-4">{renderView()}</CardContent></Card>

      <Card className="mt-6 border-gray-700 bg-gray-800 text-gray-300">
        <CardHeader><CardTitle className="text-gray-100">专业分析</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-7 text-gray-400">当前版本只在 GDP/CPI 年度预测、经济体横截面离散度和单一经济体年度路径中使用已验证返回值。预测精度、修正历史、预测与实际偏差、经济意外指数及概率区间各自需要不同的数据契约；在相应授权数据和历史版本尚未形成前保持“未接入”，不会把同一批 GDP/CPI 数据换标题重复展示。</p></CardContent>
      </Card>
    </div>
  );
};

export default ECFCTab;
