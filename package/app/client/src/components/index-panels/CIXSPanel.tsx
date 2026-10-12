import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart, Line, AreaChart, Area, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Plus, Minus, TrendingUp, TrendingDown, Percent, Scale, Zap, BarChart as LucideBarChart, Search } from 'lucide-react';

// Helper for generating random-like data without external libs
const pseudoRandom = (seed: number) => {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};

interface Instrument {
  id: string;
  name: string;
  type: 'Rate' | 'Credit';
  currentValue: number;
}

interface SpreadDataPoint {
  date: string;
  value: number;
  zScore?: number;
  componentA?: number;
  componentB?: number;
  event?: string;
}

interface ZScoreDataPoint {
  date: string;
  zScore: number;
  isHighlight: boolean;
}

interface DecompositionDataPoint {
  date: string;
  oas: number;
  treasury: number;
  creditSpread: number;
}

interface SignalStats {
  totalSignals: number;
  winRate: number;
}

const CIXSPanel: React.FC = () => {
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>([]);
  const [spreadFormula, setSpreadFormula] = useState<string>('A - B');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const allInstruments: Instrument[] = useMemo(() => [
    { id: 'USGG10YR', name: 'US 10-Year Treasury', type: 'Rate', currentValue: 4.25 },
    { id: 'USGG02YR', name: 'US 2-Year Treasury', type: 'Rate', currentValue: 4.90 },
    { id: 'USGG30YR', name: 'US 30-Year Treasury', type: 'Rate', currentValue: 4.40 },
    { id: 'CDXIG', name: 'CDX IG Index', type: 'Credit', currentValue: 65 },
    { id: 'CDXHY', name: 'CDX HY Index', type: 'Credit', currentValue: 380 },
    { id: 'EURIBOR3M', name: 'Euribor 3M', type: 'Rate', currentValue: 3.80 },
    { id: 'LIBOR3M', name: 'LIBOR 3M', type: 'Rate', currentValue: 5.30 },
    { id: 'JPMEMBI', name: 'JPM EMBI Global', type: 'Credit', currentValue: 320 },
    { id: 'BAMLHY', name: 'BofA ML High Yield', type: 'Credit', currentValue: 450 },
    { id: 'SOFR', name: 'SOFR', type: 'Rate', currentValue: 5.35 },
    { id: 'GBP_SWAP5Y', name: 'GBP 5Y Swap', type: 'Rate', currentValue: 4.10 },
    { id: 'CDS_AAPL', name: 'Apple CDS 5Y', type: 'Credit', currentValue: 35 },
  ], []);

  const filteredInstruments = useMemo(() => {
    if (!searchTerm) return allInstruments;
    return allInstruments.filter(inst =>
      inst.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allInstruments, searchTerm]);

  const handleAddInstrument = useCallback((instrumentId: string) => {
    const instrumentToAdd = allInstruments.find(inst => inst.id === instrumentId);
    if (instrumentToAdd && !selectedInstruments.some(inst => inst.id === instrumentId)) {
      setSelectedInstruments(prev => [...prev, instrumentToAdd]);
    }
  }, [allInstruments, selectedInstruments]);

  const handleRemoveInstrument = useCallback((instrumentId: string) => {
    setSelectedInstruments(prev => prev.filter(inst => inst.id !== instrumentId));
  }, []);

  const calculateSpread = useCallback((insts: Instrument[], formula: string): number => {
    if (insts.length < 2) return 0;
    const values = insts.map(i => i.currentValue);

    switch (formula) {
      case 'A - B':
        return parseFloat((values[0] - values[1]).toFixed(2));
      case 'A - B - C':
        return parseFloat((values[0] - values[1] - (values[2] || 0)).toFixed(2));
      case 'Weighted': // Example: (A*0.6 + B*0.4) - C
        if (insts.length < 3) return parseFloat((values[0] * 0.6 + values[1] * 0.4).toFixed(2));
        return parseFloat(((values[0] * 0.6 + values[1] * 0.4) - values[2]).toFixed(2));
      default:
        return parseFloat((values[0] - values[1]).toFixed(2));
    }
  }, []);

  const currentSpreadValue = useMemo(() => {
    return calculateSpread(selectedInstruments, spreadFormula);
  }, [selectedInstruments, spreadFormula, calculateSpread]);

  const generateHistoricalData = useCallback((baseValue: number, days: number, seed: number): SpreadDataPoint[] => {
    const data: SpreadDataPoint[] = [];
    const rand = pseudoRandom(seed);
    let currentValue = baseValue;
    const events = [
      { date: '2024-03-15', description: '央行会议' },
      { date: '2025-01-20', description: '市场危机' },
      { date: '2026-02-01', description: '政策调整' },
    ];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      currentValue += (rand() - 0.5) * 0.2; // Small daily fluctuation
      if (currentValue < 0) currentValue = 0.01; // Prevent negative spreads

      const event = events.find(e => e.date === dateString);

      data.push({
        date: dateString,
        value: parseFloat(currentValue.toFixed(2)),
        event: event ? event.description : undefined,
      });
    }
    return data;
  }, []);

  const historicalSpreadData = useMemo(() => {
    if (selectedInstruments.length < 2) return [];
    const base = calculateSpread(selectedInstruments, spreadFormula);
    return generateHistoricalData(base + 0.5, 3 * 365, selectedInstruments[0].currentValue * 100 + selectedInstruments[1].currentValue * 10);
  }, [selectedInstruments, spreadFormula, calculateSpread, generateHistoricalData]);

  const calculateZScore = useCallback((data: SpreadDataPoint[]): ZScoreDataPoint[] => {
    if (data.length < 30) return []; // Need enough data for meaningful Z-score
    const zScoreData: ZScoreDataPoint[] = [];
    const windowSize = 60; // 60-day rolling window

    for (let i = windowSize - 1; i < data.length; i++) {
      const windowValues = data.slice(i - windowSize + 1, i + 1).map(d => d.value);
      const mean = windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;
      const stdDev = Math.sqrt(windowValues.map(val => (val - mean) ** 2).reduce((sum, sqDiff) => sum + sqDiff, 0) / windowValues.length);

      const currentZScore = stdDev === 0 ? 0 : (data[i].value - mean) / stdDev;
      zScoreData.push({
        date: data[i].date,
        zScore: parseFloat(currentZScore.toFixed(2)),
        isHighlight: Math.abs(currentZScore) >= 2,
      });
    }
    return zScoreData;
  }, []);

  const zScoreAnalysisData = useMemo(() => {
    return calculateZScore(historicalSpreadData);
  }, [historicalSpreadData, calculateZScore]);

  const currentZScore = useMemo(() => {
    if (zScoreAnalysisData.length === 0) return 0;
    return zScoreAnalysisData[zScoreAnalysisData.length - 1].zScore;
  }, [zScoreAnalysisData]);

  const meanReversionSignal = useMemo(() => {
    if (currentZScore > 2) return '做空 (Sell)';
    if (currentZScore < -2) return '做多 (Buy)';
    return '中性 (Neutral)';
  }, [currentZScore]);

  const signalWinRate: SignalStats = useMemo(() => {
    // Simplified simulation for win rate
    const rand = pseudoRandom(currentZScore * 100);
    const total = 100;
    const wins = Math.floor(rand() * 60) + 30; // 30-90% win rate
    return { totalSignals: total, winRate: parseFloat((wins / total * 100).toFixed(2)) };
  }, [currentZScore]);

  const spreadDecompositionData = useMemo(() => {
    const data: DecompositionDataPoint[] = [];
    const rand = pseudoRandom(12345);
    let baseOAS = 100;
    let baseTreasury = 50;

    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      baseOAS += (rand() - 0.5) * 2;
      baseTreasury += (rand() - 0.5) * 1;

      const oas = parseFloat(Math.max(10, baseOAS).toFixed(2));
      const treasury = parseFloat(Math.max(1, baseTreasury).toFixed(2));
      const creditSpread = parseFloat((oas - treasury).toFixed(2));

      data.push({
        date: dateString,
        oas: oas,
        treasury: treasury,
        creditSpread: creditSpread,
      });
    }
    return data.reverse(); // Ensure chronological order
  }, []);

  const relatedSpreads = useMemo(() => [
    { id: 'IG_HY_Spread', name: 'IG vs HY Spread', value: 315, dailyChange: -5, weeklyChange: 10 },
    { id: 'EM_DM_Spread', name: 'EM vs DM Spread', value: 280, dailyChange: 2, weeklyChange: -8 },
    { id: 'Corp_Gov_Spread', name: 'Corporate vs Govt Spread', value: 150, dailyChange: 1, weeklyChange: 3 },
  ], []);

  const dailyChange = useMemo(() => {
    if (historicalSpreadData.length < 2) return 0;
    const latest = historicalSpreadData[historicalSpreadData.length - 1].value;
    const prev = historicalSpreadData[historicalSpreadData.length - 2].value;
    return parseFloat((latest - prev).toFixed(2));
  }, [historicalSpreadData]);

  const weeklyChange = useMemo(() => {
    if (historicalSpreadData.length < 7) return 0;
    const latest = historicalSpreadData[historicalSpreadData.length - 1].value;
    const prevWeek = historicalSpreadData[historicalSpreadData.length - 7].value;
    return parseFloat((latest - prevWeek).toFixed(2));
  }, [historicalSpreadData]);

  const monthlyChange = useMemo(() => {
    if (historicalSpreadData.length < 30) return 0;
    const latest = historicalSpreadData[historicalSpreadData.length - 1].value;
    const prevMonth = historicalSpreadData[historicalSpreadData.length - 30].value;
    return parseFloat((latest - prevMonth).toFixed(2));
  }, [historicalSpreadData]);

  const historicalPercentile = useMemo(() => {
    if (historicalSpreadData.length === 0) return 0;
    const current = currentSpreadValue;
    const sortedValues = [...historicalSpreadData].map(d => d.value).sort((a, b) => a - b);
    const rank = sortedValues.findIndex(val => val >= current);
    return parseFloat(((rank / sortedValues.length) * 100).toFixed(2));
  }, [historicalSpreadData, currentSpreadValue]);

  const formatChange = (value: number) => {
    const sign = value > 0 ? '+' : '';
    const color = value > 0 ? 'text-orange-500' : value < 0 ? 'text-green-500' : 'text-gray-400';
    return <span className={color}>{sign}{value}</span>;
  };

  return (
    <div className="p-4 bg-gray-950 text-gray-100 min-h-screen font-mono">
      <Card className="bg-gray-900 border-gray-800 shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center">
            <Scale className="mr-2" size={20} /> 自设利差编辑器 (CIXSPanel)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-1">
              <h3 className="text-lg font-semibold mb-2 text-gray-200">利差构建器</h3>
              <div className="flex items-center space-x-2 mb-4">
                <Input
                  placeholder="搜索工具..."
                  className="flex-grow bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={18} className="text-gray-400" />
              </div>
              <div className="max-h-40 overflow-y-auto pr-2 mb-4 border border-gray-700 rounded-md p-2">
                {filteredInstruments.map(inst => (
                  <div key={inst.id} className="flex justify-between items-center py-1 text-sm">
                    <span className="text-gray-300">{inst.name} ({inst.type})</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddInstrument(inst.id)}
                      className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-orange-300 hover:text-orange-200"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                ))}
              </div>

              <h4 className="text-md font-medium mb-2 text-gray-300">已选工具:</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedInstruments.map(inst => (
                  <Badge
                    key={inst.id}
                    variant="secondary"
                    className="bg-orange-600 hover:bg-orange-700 text-white cursor-pointer flex items-center"
                    onClick={() => handleRemoveInstrument(inst.id)}
                  >
                    {inst.name} <Minus size={12} className="ml-1" />
                  </Badge>
                ))}
              </div>

              <h4 className="text-md font-medium mb-2 text-gray-300">利差计算方式:</h4>
              <Select value={spreadFormula} onValueChange={setSpreadFormula}>
                <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-gray-100">
                  <SelectValue placeholder="选择公式" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                  <SelectItem value="A - B">A - B</SelectItem>
                  <SelectItem value="A - B - C">A - B - C</SelectItem>
                  <SelectItem value="Weighted">加权利差 (Weighted)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <h3 className="text-lg font-semibold mb-2 text-gray-200">当前利差仪表盘</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <Card className="bg-gray-800 border-gray-700 p-4">
                  <CardTitle className="text-sm text-gray-400">当前利差值</CardTitle>
                  <p className="text-3xl font-bold text-orange-400">{currentSpreadValue.toFixed(2)}</p>
                </Card>
                <Card className="bg-gray-800 border-gray-700 p-4">
                  <CardTitle className="text-sm text-gray-400">日变化</CardTitle>
                  <p className="text-2xl font-bold">{formatChange(dailyChange)}</p>
                </Card>
                <Card className="bg-gray-800 border-gray-700 p-4">
                  <CardTitle className="text-sm text-gray-400">1周变化</CardTitle>
                  <p className="text-2xl font-bold">{formatChange(weeklyChange)}</p>
                </Card>
                <Card className="bg-gray-800 border-gray-700 p-4">
                  <CardTitle className="text-sm text-gray-400">1月变化</CardTitle>
                  <p className="text-2xl font-bold">{formatChange(monthlyChange)}</p>
                </Card>
                <Card className="bg-gray-800 border-gray-700 p-4 col-span-2">
                  <CardTitle className="text-sm text-gray-400">历史分位数百分比</CardTitle>
                  <p className="text-2xl font-bold text-orange-400 flex items-center justify-center">
                    <Percent size={20} className="mr-2" /> {historicalPercentile.toFixed(2)}%
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-300">历史走势</TabsTrigger>
          <TabsTrigger value="zscore" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-300">Z-score 分析</TabsTrigger>
          <TabsTrigger value="decomposition" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-300">利差分解</TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-300">相关利差对比</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <Card className="bg-gray-900 border-gray-800 shadow-lg">
            <CardHeader><CardTitle className="text-gray-200">近3年利差历史走势图</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalSpreadData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="date" stroke="#888" tickFormatter={(tick) => new Date(tick).getFullYear().toString()} />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }}
                    labelStyle={{ color: '#orange-400' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(2)} ${props.payload.event ? `(${props.payload.event})` : ''}`,
                      name
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} name="利差" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zscore" className="mt-4">
          <Card className="bg-gray-900 border-gray-800 shadow-lg">
            <CardHeader><CardTitle className="text-gray-200">利差滚动Z-score分析</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 text-gray-300">
                当前Z-score: <span className="font-bold text-orange-400">{currentZScore.toFixed(2)}</span>
                <span className="ml-4">均值回归信号: <Badge className="bg-orange-600 text-white">{meanReversionSignal}</Badge></span>
                <span className="ml-4">历史信号胜率: <Badge className="bg-gray-700 text-gray-200">{signalWinRate.winRate}% ({signalWinRate.totalSignals} 信号)</Badge></span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={zScoreAnalysisData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="date" stroke="#888" tickFormatter={(tick) => new Date(tick).getFullYear().toString()} />
                  <YAxis stroke="#888" domain={[-3, 3]} />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }} />
                  <Legend />
                  <Line type="monotone" dataKey="zScore" stroke="#f97316" strokeWidth={2} dot={false} name="Z-score" />
                  <Line type="monotone" dataKey="isHighlight" stroke="transparent" dot={({ cx, cy, payload }) => (
                    payload.isHighlight ? <circle cx={cx} cy={cy} r={4} fill="#ef4444" /> : <g/>
                  )} name="高亮 (±2 StdDev)" />
                  <Line dataKey="upperBound" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="+2 StdDev" activeDot={false} />
                  <Line dataKey="lowerBound" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="-2 StdDev" activeDot={false} />
                  <Line dataKey="zeroLine" stroke="#888" strokeDasharray="5 5" dot={false} name="Zero" activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decomposition" className="mt-4">
          <Card className="bg-gray-900 border-gray-800 shadow-lg">
            <CardHeader><CardTitle className="text-gray-200">利差分解图 (信用利差 = OAS - 国债利差)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={spreadDecompositionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="date" stroke="#888" tickFormatter={(tick) => new Date(tick).getFullYear().toString()} />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }} />
                  <Legend />
                  <Area type="monotone" dataKey="oas" stackId="1" stroke="#f97316" fill="#f97316" name="OAS" />
                  <Area type="monotone" dataKey="treasury" stackId="1" stroke="#8884d8" fill="#8884d8" name="国债利差" />
                  <Line type="monotone" dataKey="creditSpread" stroke="#3b82f6" strokeWidth={2} name="信用利差" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <Card className="bg-gray-900 border-gray-800 shadow-lg">
            <CardHeader><CardTitle className="text-gray-200">相关利差对比</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedSpreads.map(spread => (
                  <Card key={spread.id} className="bg-gray-800 border-gray-700 p-4">
                    <CardTitle className="text-md text-gray-300 mb-2">{spread.name}</CardTitle>
                    <p className="text-2xl font-bold text-orange-400 mb-1">{spread.value.toFixed(2)}</p>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>日变化: {formatChange(spread.dailyChange)}</span>
                      <span>周变化: {formatChange(spread.weeklyChange)}</span>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-2 text-gray-200">相对价值机会</h4>
                <p className="text-gray-300">
                  通过比较不同利差的当前水平、历史分位数和变化趋势，可以识别出相对被低估或高估的利差，从而发现潜在的交易机会。
                  例如，如果某个利差相对于其历史水平和同类利差显得异常高，可能预示着做空机会；反之，则可能存在做多机会。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CIXSPanel;
