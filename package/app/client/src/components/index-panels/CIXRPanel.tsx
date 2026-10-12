import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
  BarChart as RechartsBarChart, Bar, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Ratio, TrendingUp, TrendingDown, Scale, Percent, CalendarDays, GitFork, Search, Filter } from 'lucide-react';

interface RatioDataPoint {
  date: string;
  value: number;
  ma20?: number;
  ma50?: number;
  stdDev1Upper?: number;
  stdDev1Lower?: number;
  stdDev2Upper?: number;
  stdDev2Lower?: number;
  signal?: 'buy' | 'sell' | null;
}

interface DistributionDataPoint {
  range: string;
  count: number;
}

interface SeasonalityDataPoint {
  month: string;
  avgChange: number;
}

interface CorrelationDataPoint {
  ratioChange: number;
  macroIndicator: number;
  label: string;
}

const CIXRPanel: React.FC = () => {
  const [numeratorAsset, setNumeratorAsset] = useState<string>('AAPL');
  const [denominatorAsset, setDenominatorAsset] = useState<string>('MSFT');
  const [ratioType, setRatioType] = useState<string>('price');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const generateMockData = useCallback((numPoints: number): RatioDataPoint[] => {
    const data: RatioDataPoint[] = [];
    let currentValue = 100;
    const startDate = new Date('2021-01-01');

    for (let i = 0; i < numPoints; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i * 7); // Weekly data for simplicity
      currentValue += (Math.random() - 0.5) * 5;
      currentValue = Math.max(50, Math.min(150, currentValue)); // Keep value within a reasonable range
      data.push({ date: date.toISOString().split('T')[0], value: parseFloat(currentValue.toFixed(2)) });
    }

    // Calculate MAs and Standard Deviations
    const calculateMA = (arr: RatioDataPoint[], period: number, key: 'ma20' | 'ma50') => {
      for (let i = period - 1; i < arr.length; i++) {
        const sum = arr.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.value, 0);
        arr[i][key] = parseFloat((sum / period).toFixed(2));
      }
    };

    const calculateStdDev = (arr: RatioDataPoint[], period: number) => {
      for (let i = period - 1; i < arr.length; i++) {
        const values = arr.slice(i - period + 1, i + 1).map(d => d.value);
        const mean = values.reduce((acc, val) => acc + val, 0) / period;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        arr[i].stdDev1Upper = parseFloat((mean + stdDev).toFixed(2));
        arr[i].stdDev1Lower = parseFloat((mean - stdDev).toFixed(2));
        arr[i].stdDev2Upper = parseFloat((mean + 2 * stdDev).toFixed(2));
        arr[i].stdDev2Lower = parseFloat((mean - 2 * stdDev).toFixed(2));
      }
    };

    calculateMA(data, 20, 'ma20');
    calculateMA(data, 50, 'ma50');
    calculateStdDev(data, 50); // Use 50-period for std dev

    // Generate signals
    for (let i = 50; i < data.length; i++) {
      const prevValue = data[i - 1].value;
      const currentValue = data[i].value;
      const prevMA20 = data[i - 1].ma20;
      const currentMA20 = data[i].ma20;
      const prevMA50 = data[i - 1].ma50;
      const currentMA50 = data[i].ma50;

      if (currentMA20 && currentMA50 && prevMA20 && prevMA50) {
        // MA20 crosses above MA50 (Golden Cross)
        if (prevMA20 < prevMA50 && currentMA20 >= currentMA50) {
          data[i].signal = 'buy';
        }
        // MA20 crosses below MA50 (Death Cross)
        else if (prevMA20 > prevMA50 && currentMA20 <= currentMA50) {
          data[i].signal = 'sell';
        }
      }
    }

    return data.filter(d => d.ma50 !== undefined); // Filter out initial points without full MA/StdDev data
  }, []);

  const ratioHistoryData = useMemo<RatioDataPoint[]>(() => {
    return generateMockData(260); // Approx 5 years of weekly data
  }, [generateMockData]);

  const currentRatioValue = useMemo(() => ratioHistoryData[ratioHistoryData.length - 1]?.value || 0, [ratioHistoryData]);

  const historicalStats = useMemo(() => {
    if (ratioHistoryData.length === 0) return { avg: 0, stdDev: 0, percentile: 0, deviation: 0 };
    const values = ratioHistoryData.map(d => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const sortedValues = [...values].sort((a, b) => a - b);
    const rank = sortedValues.indexOf(currentRatioValue);
    const percentile = parseFloat(((rank / (values.length - 1)) * 100).toFixed(2));
    const deviation = parseFloat(((currentRatioValue - avg) / stdDev).toFixed(2));

    return {
      avg: parseFloat(avg.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      percentile,
      deviation,
    };
  }, [ratioHistoryData, currentRatioValue]);

  const ratioDistributionData = useMemo<DistributionDataPoint[]>(() => {
    if (ratioHistoryData.length === 0) return [];
    const values = ratioHistoryData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const numBins = 10;
    const binWidth = (maxVal - minVal) / numBins;
    const bins: number[] = Array(numBins).fill(0);

    values.forEach(val => {
      let binIndex = Math.floor((val - minVal) / binWidth);
      if (binIndex === numBins) binIndex--; // Handle max value falling into the last bin
      bins[binIndex]++;
    });

    return bins.map((count, i) => ({
      range: `${parseFloat((minVal + i * binWidth).toFixed(2))} - ${parseFloat((minVal + (i + 1) * binWidth).toFixed(2))}`,
      count,
    }));
  }, [ratioHistoryData]);

  const seasonalityData = useMemo<SeasonalityDataPoint[]>(() => {
    if (ratioHistoryData.length === 0) return [];
    const monthlyChanges: { [key: string]: number[] } = {};

    for (let i = 1; i < ratioHistoryData.length; i++) {
      const prev = ratioHistoryData[i - 1];
      const curr = ratioHistoryData[i];
      const month = new Date(curr.date).toLocaleString('en-US', { month: 'short' });
      const change = (curr.value - prev.value) / prev.value;

      if (!monthlyChanges[month]) {
        monthlyChanges[month] = [];
      }
      monthlyChanges[month].push(change);
    }

    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthsOrder.map(month => {
      const changes = monthlyChanges[month] || [];
      const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
      return { month, avgChange: parseFloat((avgChange * 100).toFixed(2)) }; // Percentage
    });
  }, [ratioHistoryData]);

  const correlationData = useMemo<CorrelationDataPoint[]>(() => {
    if (ratioHistoryData.length < 2) return [];
    const data: CorrelationDataPoint[] = [];
    const macroIndicators = Array.from({ length: ratioHistoryData.length }, (_, i) => parseFloat((Math.random() * 100).toFixed(2)));

    for (let i = 1; i < ratioHistoryData.length; i++) {
      const ratioChange = parseFloat(((ratioHistoryData[i].value - ratioHistoryData[i - 1].value) / ratioHistoryData[i - 1].value * 100).toFixed(2));
      const macroIndicator = macroIndicators[i];
      data.push({ ratioChange, macroIndicator, label: ratioHistoryData[i].date });
    }
    return data;
  }, [ratioHistoryData]);

  const filteredRatioHistoryData = useMemo(() => {
    if (!searchTerm) return ratioHistoryData;
    return ratioHistoryData.filter(point =>
      point.date.includes(searchTerm)
    );
  }, [ratioHistoryData, searchTerm]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="p-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg text-sm text-gray-100">
          <p className="font-bold text-blue-300">{`日期: ${label}`}</p>
          <p>{`比率值: ${parseFloat(dataPoint.value).toFixed(2)}`}</p>
          {dataPoint.ma20 && <p>{`MA20: ${parseFloat(dataPoint.ma20).toFixed(2)}`}</p>}
          {dataPoint.ma50 && <p>{`MA50: ${parseFloat(dataPoint.ma50).toFixed(2)}`}</p>}
          {dataPoint.signal && (
            <p className={`font-bold ${dataPoint.signal === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
              {`信号: ${dataPoint.signal === 'buy' ? '买入' : '卖出'}`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const DistributionTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg text-sm text-gray-100">
          <p className="font-bold text-blue-300">{`范围: ${label}`}</p>
          <p>{`频率: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const SeasonalityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg text-sm text-gray-100">
          <p className="font-bold text-blue-300">{`月份: ${label}`}</p>
          <p>{`平均涨跌幅: ${parseFloat(payload[0].value).toFixed(2)}%`}</p>
        </div>
      );
    }
    return null;
  };

  const CorrelationTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="p-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg text-sm text-gray-100">
          <p className="font-bold text-blue-300">{`日期: ${dataPoint.label}`}</p>
          <p>{`比率变化: ${parseFloat(dataPoint.ratioChange).toFixed(2)}%`}</p>
          <p>{`宏观指标: ${parseFloat(dataPoint.macroIndicator).toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 bg-gray-950 min-h-screen text-gray-100 font-mono">
      <Card className="bg-gray-900 border-gray-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-2xl font-bold text-blue-400 flex items-center gap-2">
            <Ratio className="h-6 w-6 text-blue-400" />
            CIXRPanel - 自设比率编辑器
          </CardTitle>
          <Badge variant="secondary" className="bg-blue-900 text-blue-200 hover:bg-blue-800">
            金融分析
          </Badge>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="builder" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800 text-gray-300">
              <TabsTrigger value="builder" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">比率构建</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">历史分析</TabsTrigger>
              <TabsTrigger value="distribution" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">分布与季节性</TabsTrigger>
              <TabsTrigger value="correlation" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">相关资产</TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="mt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="分子资产 (e.g., AAPL)"
                  value={numeratorAsset}
                  onChange={(e) => setNumeratorAsset(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400 focus:border-blue-500"
                />
                <span className="text-gray-300 text-lg">/</span>
                <Input
                  placeholder="分母资产 (e.g., MSFT)"
                  value={denominatorAsset}
                  onChange={(e) => setDenominatorAsset(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400 focus:border-blue-500"
                />
                <Select value={ratioType} onValueChange={setRatioType}>
                  <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500">
                    <SelectValue placeholder="选择比率类型" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                    <SelectItem value="price">价格比率</SelectItem>
                    <SelectItem value="market_cap">市值比率</SelectItem>
                    <SelectItem value="yield">收益率比率</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <GitFork className="h-4 w-4 mr-2" />
                  构建比率
                </Button>
              </div>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                    <Scale className="h-5 w-5 text-blue-300" />
                    实时比率显示
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-gray-200">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-sm">当前比率值</span>
                    <span className="text-3xl font-bold text-blue-400">{currentRatioValue.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-sm">历史均值</span>
                    <span className="text-2xl text-purple-300">{historicalStats.avg.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-sm">偏离度 (StdDev)</span>
                    <span className={`text-2xl ${historicalStats.deviation > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {historicalStats.deviation.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-sm">历史分位数</span>
                    <span className="text-2xl text-yellow-300">{historicalStats.percentile.toFixed(2)}%</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="搜索日期 (YYYY-MM-DD)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400 focus:border-blue-500"
                />
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Search className="h-4 w-4 mr-2" />
                  搜索
                </Button>
              </div>
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-300" />
                    比率历史图 (近5年)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredRatioHistoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
                      <XAxis dataKey="date" stroke="#9ca3af" tickFormatter={(tick) => tick.slice(0, 7)} />
                      <YAxis stroke="#9ca3af" domain={['auto', 'auto']} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot={false} name="比率值" />
                      <Line type="monotone" dataKey="ma20" stroke="#82ca9d" strokeWidth={1} dot={false} name="MA20" />
                      <Line type="monotone" dataKey="ma50" stroke="#ffc658" strokeWidth={1} dot={false} name="MA50" />
                      <Line type="monotone" dataKey="stdDev1Upper" stroke="#a3a3a3" strokeDasharray="5 5" strokeWidth={0.5} dot={false} name="+1 StdDev" />
                      <Line type="monotone" dataKey="stdDev1Lower" stroke="#a3a3a3" strokeDasharray="5 5" strokeWidth={0.5} dot={false} name="-1 StdDev" />
                      <Line type="monotone" dataKey="stdDev2Upper" stroke="#6b7280" strokeDasharray="5 5" strokeWidth={0.5} dot={false} name="+2 StdDev" />
                      <Line type="monotone" dataKey="stdDev2Lower" stroke="#6b7280" strokeDasharray="5 5" strokeWidth={0.5} dot={false} name="-2 StdDev" />
                      {filteredRatioHistoryData.map((entry, index) => (
                        entry.signal === 'buy' ? (
                          <Scatter key={`buy-${index}`} data={[{ x: entry.date, y: entry.value }]} fill="#4ade80" shape="triangle" />
                        ) : entry.signal === 'sell' ? (
                          <Scatter key={`sell-${index}`} data={[{ x: entry.date, y: entry.value }]} fill="#ef4444" shape="triangle" />
                        ) : null
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distribution" className="mt-4 space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                    <Percent className="h-5 w-5 text-blue-300" />
                    比率分布直方图
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={ratioDistributionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
                      <XAxis dataKey="range" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <RechartsTooltip content={<DistributionTooltip />} />
                      <Bar dataKey="count" fill="#8884d8" />
                      {/* Mark current position */}
                      <Line dataKey="currentPosition" stroke="#ff7300" strokeDasharray="3 3" dot={false} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-300" />
                    季节性分析 (月度平均涨跌幅)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={seasonalityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
                      <XAxis dataKey="month" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip content={<SeasonalityTooltip />} />
                      <Bar dataKey="avgChange" fill="#82ca9d" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="correlation" className="mt-4 space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-300 flex items-center gap-2">
                    <GitFork className="h-5 w-5 text-blue-300" />
                    相关资产联动 (比率变化 vs 宏观指标)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
                      <XAxis type="number" dataKey="ratioChange" name="比率变化 (%)" stroke="#9ca3af" />
                      <YAxis type="number" dataKey="macroIndicator" name="宏观指标" stroke="#9ca3af" />
                      <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={<CorrelationTooltip />} />
                      <Scatter name="比率变化 vs 宏观指标" data={correlationData} fill="#8884d8" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CIXRPanel;
