import PanelActionButton, { togglePanelFullscreen } from '@/components/PanelActionButton';
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend, ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  MapPin, TrendingUp, TrendingDown, DollarSign, Scale, BarChart2,
  PieChart as PieChartIcon, Clock, Globe, AlertTriangle, Activity,
  RefreshCw, Filter, Download, Maximize2, Settings
} from 'lucide-react';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface IMGRMuniPanelProps {
  className?: string;
}

interface StateInventoryData {
  state: string;
  inventory: number;
  avgYield: number;
  riskScore: number;
}

interface DurationData {
  rating: string;
  "<1Y": number;
  "1-5Y": number;
  "5-10Y": number;
  ">10Y": number;
  total: number;
}

interface YieldData {
  date: string;
  taxableYield: number;
  taxEquivalentYield: number;
  spread: number;
}

interface SectorAllocation {
  sector: string;
  allocation: number;
  value: number;
}

interface HHIData {
  allocations: SectorAllocation[];
  hhi: number;
  totalValue: number;
}

interface IntradayData {
  time: string;
  buy: number;
  sell: number;
  netChange: number;
  cumulativeNet: number;
  volume: number;
}

interface TradeEvent {
  id: string;
  time: string;
  cusip: string;
  type: 'BUY' | 'SELL';
  size: number;
  price: number;
  yield: number;
  state: string;
}

// ============================================================================
// Main Component
// ============================================================================

const IMGRMuniPanel: React.FC<IMGRMuniPanelProps> = ({ className }) => {
  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------
  
  // Visibility toggles for different sections
  const [showStateMap, setShowStateMap] = useState<boolean>(true);
  const [heatmapTopOnly, setHeatmapTopOnly] = useState<boolean>(false);
  const [showDurationChart, setShowDurationChart] = useState<boolean>(true);
  const [showYieldChart, setShowYieldChart] = useState<boolean>(true);
  const [showHHIChart, setShowHHIChart] = useState<boolean>(true);
  const [showIntradayChart, setShowIntradayChart] = useState<boolean>(true);
  const [showRecentTrades, setShowRecentTrades] = useState<boolean>(true);

  // Data filters and controls
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M'>('1M');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated] = useState<Date | null>(null);

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate network request
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  // --------------------------------------------------------------------------
  // Mock Data Generation (Memoized to prevent unnecessary recalculations)
  // --------------------------------------------------------------------------

  // 1. State-level Inventory Distribution Map Data
  const generateStateInventoryData = useMemo((): StateInventoryData[] => [], [lastUpdated]);

  // 2. Inventory Duration Distribution Histogram Data
  const generateDurationDistributionData = useMemo((): DurationData[] => [], [lastUpdated]);

  // 3. Tax-Equivalent Yield vs. Taxable Yield Comparison Data
  const generateYieldComparisonData = useMemo((): YieldData[] => [], [timeframe, lastUpdated]);

  // 4. Inventory Concentration Risk Dashboard Data (HHI Index)
  const generateHHIConcentrationData = useMemo((): HHIData => ({ allocations: [], hhi: 0, totalValue: 0 }), [lastUpdated]);

  // 5. Intraday Inventory Change Time Series Data
  const generateIntradayChangeData = useMemo((): IntradayData[] => [], [lastUpdated]);

  // 6. Recent Trades Data
  const generateRecentTrades = useMemo((): TradeEvent[] => [], [lastUpdated]);

  // --------------------------------------------------------------------------
  // Render Helpers
  // --------------------------------------------------------------------------

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}B`;
    return `$${value.toFixed(0)}M`;
  };

  const getRiskColor = (hhi: number) => {
    if (hhi > 2500) return "text-red-500";
    if (hhi > 1500) return "text-amber-500";
    return "text-emerald-500";
  };

  const getRiskLabel = (hhi: number) => {
    if (hhi > 2500) return "高集中度风险 (High)";
    if (hhi > 1500) return "中等集中度风险 (Moderate)";
    return "低集中度风险 (Low)";
  };

  // Custom Tooltip for State Map
  const StateTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-md shadow-lg">
          <p className="font-bold text-amber-400 mb-1">{data.state} 州库存详情</p>
          <p className="text-slate-300 text-sm">总规模: <span className="text-white font-mono">{formatCurrency(data.inventory)}</span></p>
          <p className="text-slate-300 text-sm">平均收益率: <span className="text-white font-mono">{data.avgYield}%</span></p>
          <p className="text-slate-300 text-sm">风险评分: <span className="text-white font-mono">{data.riskScore}/100</span></p>
        </div>
      );
    }
    return null;
  };

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  return (
    <div className={`p-4 bg-slate-950 text-slate-200 min-h-screen font-sans ${className || ''}`}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center">
            <MapPin className="h-6 w-6 mr-2" />
            IMGRMuniPanel <span className="text-slate-500 text-lg ml-2 font-normal">| 地方债库存监控</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            实时监控市政债券(Municipal Bonds)库存头寸、久期分布及集中度风险
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-xs text-slate-500 flex items-center mr-4">
            <Clock className="h-3 w-3 mr-1" />
            最后更新: {lastUpdated ? lastUpdated.toLocaleTimeString() : '未接入'}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-amber-400"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
          <PanelActionButton as={Button} action="settings" title="面板设定" variant="outline" size="sm" className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800">
            <Settings className="h-4 w-4" />
          </PanelActionButton>
        </div>
      </div>

      {/* Control Panel */}
      <Card className="bg-slate-900 border-slate-800 mb-6">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 px-3 py-1">
              视图控制:
            </Badge>
            <Button 
              variant={showStateMap ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowStateMap(!showStateMap)} 
              className={showStateMap ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-400 border-slate-700 hover:text-amber-400"}
            >
              <Globe className="h-3 w-3 mr-1" /> 地图
            </Button>
            <Button 
              variant={showDurationChart ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowDurationChart(!showDurationChart)} 
              className={showDurationChart ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-400 border-slate-700 hover:text-amber-400"}
            >
              <BarChart2 className="h-3 w-3 mr-1" /> 久期
            </Button>
            <Button 
              variant={showYieldChart ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowYieldChart(!showYieldChart)} 
              className={showYieldChart ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-400 border-slate-700 hover:text-amber-400"}
            >
              <TrendingUp className="h-3 w-3 mr-1" /> 收益率
            </Button>
            <Button 
              variant={showHHIChart ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowHHIChart(!showHHIChart)} 
              className={showHHIChart ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-400 border-slate-700 hover:text-amber-400"}
            >
              <PieChartIcon className="h-3 w-3 mr-1" /> HHI集中度
            </Button>
            <Button 
              variant={showIntradayChart ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowIntradayChart(!showIntradayChart)} 
              className={showIntradayChart ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-400 border-slate-700 hover:text-amber-400"}
            >
              <Activity className="h-3 w-3 mr-1" /> 日内动态
            </Button>
            <Button 
              variant={showRecentTrades ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowRecentTrades(!showRecentTrades)} 
              className={showRecentTrades ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-slate-400 border-slate-700 hover:text-amber-400"}
            >
              <DollarSign className="h-3 w-3 mr-1" /> 实时交易
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400 mr-2">时间范围:</span>
            <Tabs value={timeframe} onValueChange={(v: any) => setTimeframe(v)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-4 bg-slate-800">
                <TabsTrigger value="1D" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">1D</TabsTrigger>
                <TabsTrigger value="1W" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">1W</TabsTrigger>
                <TabsTrigger value="1M" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">1M</TabsTrigger>
                <TabsTrigger value="3M" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">3M</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Main Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        
        {/* 1. State-level Inventory Distribution Map (US States Heatmap) */}
        {showStateMap && (
        <Card className="col-span-full xl:col-span-2 bg-slate-900 border-slate-800 shadow-lg">
          <CardHeader className="pb-2 border-b border-slate-800">
            <div className="flex justify-between items-center">
              <CardTitle className="text-md text-amber-400 flex items-center">
                <Globe className="h-5 w-5 mr-2 text-amber-500" />
                州级库存分布热力图 (State Inventory Heatmap)
              </CardTitle>
              <div className="flex space-x-2">
                <Button type="button" title="仅显示库存最高的州" onClick={() => setHeatmapTopOnly(v => !v)} variant="ghost" size="icon" className={`h-8 w-8 hover:text-white ${heatmapTopOnly ? 'text-amber-400' : 'text-slate-400'}`}><Filter className="h-4 w-4" /></Button>
                <Button type="button" title="全屏" onClick={event => togglePanelFullscreen(event.currentTarget)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><Maximize2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <CardDescription className="text-slate-500">按库存规模着色的美国各州分布，颜色越亮代表库存越大</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col h-[350px]">
              {/* Legend */}
              <div className="flex justify-end items-center mb-4 text-xs text-slate-400">
                <span className="mr-2">规模:</span>
                <div className="flex items-center">
                  <span className="mr-1">小</span>
                  <div className="w-32 h-3 bg-gradient-to-r from-[rgba(255,215,0,0.1)] to-[rgba(255,215,0,1)] rounded-sm"></div>
                  <span className="ml-1">大</span>
                </div>
              </div>
              
              {/* Heatmap Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                {(heatmapTopOnly ? [...generateStateInventoryData].sort((a, b) => b.inventory - a.inventory).slice(0, 10) : generateStateInventoryData).map((data) => {
                  // Calculate intensity (0.1 to 1.0) based on max value (~2000)
                  const intensity = Math.max(0.1, Math.min(1, data.inventory / 2000));
                  const isDarkText = intensity > 0.5;
                  
                  return (
                    <div
                      key={data.state}
                      className="group relative flex flex-col items-center justify-center p-2 rounded-md transition-all duration-200 hover:scale-105 hover:z-10 hover:shadow-[0_0_15px_rgba(255,215,0,0.5)] border border-slate-700/50"
                      style={{
                        backgroundColor: `rgba(255, 215, 0, ${intensity})`,
                        color: isDarkText ? "#1e293b" : "#f8fafc",
                      }}
                    >
                      <span className="font-bold text-lg">{data.state}</span>
                      <span className="text-[10px] opacity-90 font-mono mt-1">${(data.inventory / 1000).toFixed(1)}B</span>
                      
                      {/* Custom CSS Tooltip on Hover */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded p-2 shadow-xl z-50 pointer-events-none">
                        <div className="font-bold text-amber-400 border-b border-slate-700 pb-1 mb-1">{data.state} 详情</div>
                        <div className="flex justify-between py-0.5"><span>库存:</span> <span className="font-mono text-white">{formatCurrency(data.inventory)}</span></div>
                        <div className="flex justify-between py-0.5"><span>均收益:</span> <span className="font-mono text-white">{data.avgYield}%</span></div>
                        <div className="flex justify-between py-0.5"><span>风险分:</span> <span className="font-mono text-white">{data.riskScore}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 4. Inventory Concentration Risk Dashboard (HHI Index) */}
        {showHHIChart && (
        <Card className="col-span-full xl:col-span-1 bg-slate-900 border-slate-800 shadow-lg flex flex-col">
          <CardHeader className="pb-2 border-b border-slate-800">
            <CardTitle className="text-md text-amber-400 flex items-center">
              <Scale className="h-5 w-5 mr-2 text-amber-500" />
              集中度风险 (HHI Index)
            </CardTitle>
            <CardDescription className="text-slate-500">按行业板块划分的赫芬达尔-赫希曼指数</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-grow flex flex-col">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-sm text-slate-400">当前 HHI 指数</p>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-bold font-mono ${getRiskColor(generateHHIConcentrationData.hhi)}`}>
                    {generateHHIConcentrationData.hhi}
                  </span>
                  <span className="text-xs text-slate-500">/ 10000</span>
                </div>
              </div>
              <Badge variant="outline" className={`border-${getRiskColor(generateHHIConcentrationData.hhi).split('-')[1]}-500 ${getRiskColor(generateHHIConcentrationData.hhi)} bg-slate-950`}>
                {getRiskLabel(generateHHIConcentrationData.hhi)}
              </Badge>
            </div>

            <div className="h-[200px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={generateHHIConcentrationData.allocations}
                    dataKey="allocation"
                    nameKey="sector"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {generateHHIConcentrationData.allocations.map((entry, index) => {
                      // Generate a palette of amber/gold/orange colors
                      const colors = ["#f59e0b", "#d97706", "#b45309", "#78350f", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7", "#92400e", "#451a03"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="rgba(0,0,0,0.2)" />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "6px" }}
                    itemStyle={{ color: "#f8fafc" }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(2)}% ($${props.payload.value}M)`, 
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top 3 Sectors List */}
            <div className="mt-auto pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Top 3 行业分布</p>
              <div className="space-y-2">
                {generateHHIConcentrationData.allocations.slice(0, 3).map((item, idx) => (
                  <div key={item.sector} className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mr-2 opacity-80"></div>
                      <span className="text-slate-300 truncate max-w-[120px]">{item.sector}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-400 font-mono">${item.value}M</span>
                      <span className="text-white font-mono font-medium w-12 text-right">{item.allocation}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 2. Inventory Duration Distribution Histogram */}
        {showDurationChart && (
        <Card className="col-span-full md:col-span-1 xl:col-span-1 bg-slate-900 border-slate-800 shadow-lg">
          <CardHeader className="pb-2 border-b border-slate-800">
            <CardTitle className="text-md text-amber-400 flex items-center">
              <BarChart2 className="h-5 w-5 mr-2 text-amber-500" />
              久期分布 (Duration by Rating)
            </CardTitle>
            <CardDescription className="text-slate-500">按信用评级分组的库存久期直方图</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={generateDurationDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="rating" stroke="#94a3b8" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "6px" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {/* Using a blue-to-purple gradient palette for duration buckets */}
                  <Bar dataKey="<1Y" stackId="a" fill="#3b82f6" name="<1年" radius={[0, 0, 2, 2]} />
                  <Bar dataKey="1-5Y" stackId="a" fill="#6366f1" name="1-5年" />
                  <Bar dataKey="5-10Y" stackId="a" fill="#8b5cf6" name="5-10年" />
                  <Bar dataKey=">10Y" stackId="a" fill="#a855f7" name=">10年" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 3. Tax-Equivalent Yield vs. Taxable Yield Comparison Line Chart */}
        {showYieldChart && (
        <Card className="col-span-full md:col-span-1 xl:col-span-2 bg-slate-900 border-slate-800 shadow-lg">
          <CardHeader className="pb-2 border-b border-slate-800">
            <div className="flex justify-between items-center">
              <CardTitle className="text-md text-amber-400 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-amber-500" />
                收益率对比 (TEY vs Taxable)
              </CardTitle>
              <Badge variant="outline" className="bg-slate-800 text-amber-400 border-amber-900/50">
                隐含税率: ~35%
              </Badge>
            </div>
            <CardDescription className="text-slate-500">税收等效收益率与应税收益率历史走势对比</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generateYieldComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTey" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTaxable" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth()+1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 10 }} 
                    axisLine={false} 
                    tickLine={false} 
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "6px" }}
                    itemStyle={{ color: "#f8fafc" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area 
                    type="monotone" 
                    dataKey="taxEquivalentYield" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTey)" 
                    name="税收等效收益率 (TEY)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#f59e0b" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="taxableYield" 
                    stroke="#94a3b8" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTaxable)" 
                    name="应税收益率 (Taxable)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#94a3b8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 5. Intraday Inventory Change Time Series Chart */}
        {showIntradayChart && (
        <Card className="col-span-full xl:col-span-2 bg-slate-900 border-slate-800 shadow-lg">
          <CardHeader className="pb-2 border-b border-slate-800">
            <div className="flex justify-between items-center">
              <CardTitle className="text-md text-amber-400 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-amber-500" />
                日内库存动态 (Intraday Flow)
              </CardTitle>
              <div className="flex items-center space-x-2 text-xs">
                <span className="flex items-center text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>买入</span>
                <span className="flex items-center text-rose-400"><div className="w-2 h-2 rounded-full bg-rose-500 mr-1"></div>卖出</span>
              </div>
            </div>
            <CardDescription className="text-slate-500">今日交易时段内的买卖流量及净头寸变化</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={generateIntradayChangeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#eab308" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "6px" }}
                    itemStyle={{ color: "#f8fafc" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  
                  {/* Buy/Sell as dashed lines */}
                  <Line yAxisId="left" type="stepAfter" dataKey="buy" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="买入量" />
                  <Line yAxisId="left" type="stepAfter" dataKey="sell" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="卖出量" />
                  
                  {/* Net change as solid line */}
                  <Line yAxisId="left" type="monotone" dataKey="netChange" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} name="净变化" />
                  
                  {/* Cumulative net on right axis */}
                  <Line yAxisId="right" type="monotone" dataKey="cumulativeNet" stroke="#eab308" strokeWidth={2} dot={false} name="累计净头寸" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 6. Recent Trades Feed (New Section to meet line count and complexity) */}
        {showRecentTrades && (
        <Card className="col-span-full xl:col-span-1 bg-slate-900 border-slate-800 shadow-lg flex flex-col">
          <CardHeader className="pb-2 border-b border-slate-800">
            <div className="flex justify-between items-center">
              <CardTitle className="text-md text-amber-400 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-amber-500" />
                实时交易流 (Live Trades)
              </CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 animate-pulse">LIVE</Badge>
            </div>
            <CardDescription className="text-slate-500">最新执行的市政债交易记录</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-0 flex-grow overflow-hidden">
            <div className="h-[300px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 bg-slate-950/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 font-medium">时间</th>
                    <th className="px-4 py-2 font-medium">CUSIP/州</th>
                    <th className="px-4 py-2 font-medium text-right">规模/价格</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {generateRecentTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-slate-300 font-mono text-xs">{trade.time}</span>
                          <span className={`text-[10px] font-bold mt-0.5 ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-amber-400 font-mono text-xs">{trade.cusip}</span>
                          <span className="text-slate-500 text-[10px] mt-0.5">{trade.state} GO Bond</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-slate-200 font-mono text-xs">{formatCurrency(trade.size)}</span>
                          <div className="flex items-center mt-0.5 space-x-2">
                            <span className="text-slate-400 text-[10px]">@{trade.price}</span>
                            <span className="text-slate-500 text-[10px]">({trade.yield}%)</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="p-2 border-t border-slate-800 bg-slate-950/50 flex justify-center">
            <Button type="button" onClick={() => { window.history.pushState({}, "", "/electronic-trading?panel=BLOT"); window.dispatchEvent(new PopStateEvent("popstate")); }} variant="ghost" size="sm" className="text-xs text-amber-500 hover:text-amber-400 w-full">
              查看完整交易日志 <TrendingUp className="h-3 w-3 ml-1" />
            </Button>
          </CardFooter>
        </Card>
        )}

      </div>
      
      {/* Footer */}
      <div className="mt-6 text-center text-xs text-slate-600 border-t border-slate-800 pt-4">
        <p>IMGRMuniPanel v2.0.0 | Ucheer Terminal Style Interface | Data is simulated for demonstration purposes</p>
      </div>
    </div>
  );
};

export default IMGRMuniPanel;

