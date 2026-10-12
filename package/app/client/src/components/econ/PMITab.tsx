import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Gauge, TrendingUp, Globe, BarChart2, LineChart, PieChart, ChevronDown } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Area,
  ComposedChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

type PmiValue = number | null;

const displayPmi = (value: PmiValue) => value === null ? '—' : value.toFixed(1);
const regime = (value: PmiValue) => value === null ? '未接入' : value >= 50 ? '扩张' : '收缩';
const EmptyObservation = ({ label }: { label: string }) => (
  <div className="flex h-44 items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900/40 px-4 text-center text-xs text-slate-400">
    {label}：暂无可验证的公开观测，不以模拟数据填充。
  </div>
);

// 仅将后端已验证的公开观测映射到原有视图；未覆盖字段保持空值。
const buildPmiData = (release?: {
  available: boolean;
  value: number | null;
  previousValue: number | null;
  observationPeriod: string | null;
}) => {
  const countries = ['USA', 'CHN', 'JPN', 'DEU', 'GBR', 'FRA', 'IND', 'CAN'];
  const pmiCategories = ['New Orders', 'Output', 'Employment', 'Supplier Deliveries', 'Inventories'];
  const manufacturingPMI = release?.available && release.value !== null ? release.value : null;

  const kpiData = {
    manufacturingPMI,
    servicesPMI: null,
    compositePMI: null,
    globalPMIAvg: null,
  };

  const gaugeData = [
    { name: '制造业PMI', value: kpiData.manufacturingPMI, color: '#a855f7' },
    { name: '服务业PMI', value: kpiData.servicesPMI, color: '#a855f7' },
    { name: '综合PMI', value: kpiData.compositePMI, color: '#a855f7' },
  ];

  const heatmapData = countries.flatMap(country =>
    pmiCategories.map(category => ({
      country,
      category,
      value: country === 'USA' && category === 'Output' ? manufacturingPMI : null,
    }))
  );

  const historicalPMIData = manufacturingPMI === null ? [] : [{
    yearMonth: release?.observationPeriod ?? '当期',
    pmi: manufacturingPMI,
    month: release?.observationPeriod ?? '当期',
  }];

  const globalPMIRankingData = manufacturingPMI === null ? [] : [{ country: 'USA', manufacturingPMI }];

  const pmiGdpCorrelationData: Array<{ yearMonth: string; pmi: number; gdpGrowth: number }> = [];
  const contributionData: Array<{ name: string; value: number }> = [];

  return {
    kpiData,
    gaugeData,
    heatmapData,
    historicalPMIData,
    globalPMIRankingData,
    pmiGdpCorrelationData,
    contributionData,
  };
};

const PMITab: React.FC = () => {
  const [activeView, setActiveView] = useState<string>('gauge');
  const pmiQuery = trpc.pmiPublic.getLatestUsManufacturing.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });
  const mockData = useMemo(() => buildPmiData(pmiQuery.data), [pmiQuery.data]);
  const { eventDotRenderer } = withEventMarkers(mockData.pmiGdpCorrelationData, {});

  const renderView = () => {
    const pmiCategories = ['New Orders', 'Output', 'Employment', 'Supplier Deliveries', 'Inventories'];
    const countries = ['USA', 'CHN', 'JPN', 'DEU', 'GBR', 'FRA', 'IND', 'CAN'];

    switch (activeView) {
      case 'gauge':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockData.gaugeData.map((item, index) => (
              <Card key={index} className="bg-gray-800 text-white border-purple-500">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-purple-300">{item.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <div className="relative w-32 h-32">
                    {/* SVG圆形仪表盘 */}
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#333" strokeWidth="10" />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={item.value !== null && item.value >= 50 ? '#a855f7' : '#64748b'}
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 45}
                        strokeDashoffset={item.value === null ? 2 * Math.PI * 45 : 2 * Math.PI * 45 * (1 - item.value / 100)}
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="55" textAnchor="middle" className="text-2xl font-bold fill-current text-purple-200">
                        {displayPmi(item.value)}
                      </text>
                      <text x="50" y="70" textAnchor="middle" className="text-xs fill-current text-gray-400">
                        荣枯线: 50
                      </text>
                    </svg>
                  </div>
                  <Badge
                    className={cn(
                      'mt-4 text-sm',
                      item.value === null ? 'bg-slate-600 hover:bg-slate-500' : item.value >= 50 ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                    )}
                    onClick={() => toast.info(`${item.name}: ${item.value}`)}
                  >
                    {regime(item.value)}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      case 'heatmap':
        return (
          <Card className="bg-gray-800 text-white border-purple-500">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-purple-300">分项热力图</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-1 text-xs text-center">
                <div className="col-span-1"></div>
                {pmiCategories.map(cat => <div key={cat} className="font-bold text-purple-200">{cat}</div>)}
                {countries.map(country => (
                  <React.Fragment key={country}>
                    <div className="font-bold text-purple-200 text-left">{country}</div>
                    {pmiCategories.map(category => {
                      const dataPoint = mockData.heatmapData.find(d => d.country === country && d.category === category);
                      const value = dataPoint?.value ?? null;
                      const color = value === null ? 'bg-slate-700' : value > 55 ? 'bg-green-700' : value > 50 ? 'bg-green-500' : value > 45 ? 'bg-red-500' : 'bg-red-700';
                      return (
                        <div
                          key={`${country}-${category}`}
                          className={cn('p-2 rounded-sm cursor-pointer', color)}
                          onClick={() => toast.info(`${country} - ${category}: ${displayPmi(value)}`)}
                        >
                          {displayPmi(value)}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      case 'historical':
        return (
          <Card className="bg-gray-800 text-white border-purple-500">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-purple-300">历史周期色块图</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1">
                {mockData.historicalPMIData.length === 0 ? <EmptyObservation label="历史周期色块图" /> : mockData.historicalPMIData.map((item, index) => {
                  const color = item.pmi >= 50 ? 'bg-green-600' : 'bg-red-600';
                  return (
                    <div
                      key={index}
                      className={cn('w-full h-8 flex items-center justify-center text-xs text-white rounded-sm cursor-pointer', color)}
                      onClick={() => toast.info(`${item.yearMonth}: ${item.pmi}`)}
                    >
                      {item.month.substring(0, 1)}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      case 'ranking':
        return (
          <Card className="bg-gray-800 text-white border-purple-500">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-purple-300">全球PMI排名</CardTitle>
            </CardHeader>
            <CardContent>
              {mockData.globalPMIRankingData.length === 0 ? <EmptyObservation label="全球PMI排名" /> : <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockData.globalPMIRankingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis type="number" stroke="#999" />
                  <YAxis type="category" dataKey="country" stroke="#999" />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
                            <p className="font-bold">{payload[0].payload.country}</p>
                            <p>PMI: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="manufacturingPMI"
                    fill="#a855f7"
                    onClick={(data) => toast.info(`${data.country} 制造业PMI: ${data.manufacturingPMI}`)}
                  />
                </BarChart>
              </ResponsiveContainer>}
            </CardContent>
          </Card>
        );
      case 'correlation':
        return (
          <Card className="bg-gray-800 text-white border-purple-500">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-purple-300">PMI领先GDP验证</CardTitle>
            </CardHeader>
            <CardContent>
              {mockData.pmiGdpCorrelationData.length === 0 ? <EmptyObservation label="PMI领先GDP验证" /> : <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={mockData.pmiGdpCorrelationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="yearMonth" stroke="#999" />
                  <YAxis yAxisId="left" stroke="#999" />
                  <YAxis yAxisId="right" orientation="right" stroke="#999" />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
                            <p className="font-bold">{payload[0].payload.yearMonth}</p>
                            <p>PMI: {payload[0].value}</p>
                            <p>GDP增长: {payload[1].value}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="pmi" fill="#a855f7" stroke="#a855f7" name="PMI" />
                  <Line yAxisId="right" type="monotone" dataKey="gdpGrowth" stroke="#82ca9d" name="GDP增长" 
              dot={eventDotRenderer}
              activeDot={{ r: 5 }}
            />
                </ComposedChart>
              </ResponsiveContainer>}
            </CardContent>
          </Card>
        );
      case 'contribution':
        return (
          <Card className="bg-gray-800 text-white border-purple-500">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-purple-300">分项贡献分解</CardTitle>
            </CardHeader>
            <CardContent>
              {mockData.contributionData.length === 0 ? <EmptyObservation label="分项贡献分解" /> : <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={mockData.contributionData}
                  margin={{
                    top: 20, right: 20, bottom: 20, left: 20,
                  }}
                >
                  <CartesianGrid stroke="#444" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#999" />
                  <YAxis stroke="#999" />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
                            <p className="font-bold">{payload[0].payload.name}</p>
                            <p>值: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="value" barSize={20}>
                    {mockData.contributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === '期初PMI' || entry.name === '期末PMI' ? '#a855f7' : entry.value >= 0 ? '#82ca9d' : '#ef4444'}
                        onClick={() => toast.info(`${entry.name}: ${entry.value}`)}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-purple-400">PMI采购经理人指数模块</h1>
        <Badge className="bg-purple-600 hover:bg-purple-700" onClick={() => toast.info(pmiQuery.isFetching ? '正在检查官方PMI发布' : pmiQuery.data?.available ? `观察期：${pmiQuery.data.observationPeriod ?? '当期'}` : '暂无可验证的官方PMI公开观测')}>
          <Gauge className="h-4 w-4 mr-2" />
          {pmiQuery.isFetching ? '检查中' : pmiQuery.data?.available ? '官方观测' : '未接入'}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gray-800 text-white border-purple-500 cursor-pointer" onClick={() => toast.info(`制造业PMI: ${displayPmi(mockData.kpiData.manufacturingPMI)}`)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-300">制造业PMI</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-200">{displayPmi(mockData.kpiData.manufacturingPMI)}</div>
            <p className="text-xs text-gray-400">{regime(mockData.kpiData.manufacturingPMI)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 text-white border-purple-500 cursor-pointer" onClick={() => toast.info(`服务业PMI: ${displayPmi(mockData.kpiData.servicesPMI)}`)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-300">服务业PMI</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-200">{displayPmi(mockData.kpiData.servicesPMI)}</div>
            <p className="text-xs text-gray-400">{regime(mockData.kpiData.servicesPMI)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 text-white border-purple-500 cursor-pointer" onClick={() => toast.info(`综合PMI: ${displayPmi(mockData.kpiData.compositePMI)}`)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-300">综合PMI</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-200">{displayPmi(mockData.kpiData.compositePMI)}</div>
            <p className="text-xs text-gray-400">{regime(mockData.kpiData.compositePMI)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 text-white border-purple-500 cursor-pointer" onClick={() => toast.info(`全球PMI均值: ${displayPmi(mockData.kpiData.globalPMIAvg)}`)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-300">全球PMI均值</CardTitle>
            <Globe className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-200">{displayPmi(mockData.kpiData.globalPMIAvg)}</div>
            <p className="text-xs text-gray-400">{regime(mockData.kpiData.globalPMIAvg)}</p>
          </CardContent>
        </Card>
      </div>

      {/* View Switcher */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="outline" className={cn("text-purple-300 border-purple-500 hover:bg-purple-900", activeView === 'gauge' && 'bg-purple-700')} onClick={() => setActiveView('gauge')}>
          <Gauge className="h-4 w-4 mr-2" />
          圆形仪表盘
        </Button>
        <Button variant="outline" className={cn("text-purple-300 border-purple-500 hover:bg-purple-900", activeView === 'heatmap' && 'bg-purple-700')} onClick={() => setActiveView('heatmap')}>
          <BarChart2 className="h-4 w-4 mr-2" />
          分项热力图
        </Button>
        <Button variant="outline" className={cn("text-purple-300 border-purple-500 hover:bg-purple-900", activeView === 'historical' && 'bg-purple-700')} onClick={() => setActiveView('historical')}>
          <LineChart className="h-4 w-4 mr-2" />
          历史周期色块图
        </Button>
        <Button variant="outline" className={cn("text-purple-300 border-purple-500 hover:bg-purple-900", activeView === 'ranking' && 'bg-purple-700')} onClick={() => setActiveView('ranking')}>
          <Globe className="h-4 w-4 mr-2" />
          全球PMI排名
        </Button>
        <Button variant="outline" className={cn("text-purple-300 border-purple-500 hover:bg-purple-900", activeView === 'correlation' && 'bg-purple-700')} onClick={() => setActiveView('correlation')}>
          <LineChart className="h-4 w-4 mr-2" />
          PMI领先GDP验证
        </Button>
        <Button variant="outline" className={cn("text-purple-300 border-purple-500 hover:bg-purple-900", activeView === 'contribution' && 'bg-purple-700')} onClick={() => setActiveView('contribution')}>
          <PieChart className="h-4 w-4 mr-2" />
          分项贡献分解
        </Button>
      </div>

      {/* Render Active View */}
      <div>{renderView()}</div>
    </div>
  );
};

export default PMITab;
