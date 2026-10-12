import { refreshPanelData } from '@/components/PanelActionButton';
import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  ComposedChart,
  Bar as RechartsBar,
  Scatter
} from 'recharts';
import { 
  Activity, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Calculator, 
  TrendingUp, 
  AlertCircle,
  Settings,
  Layers,
  FileText,
  RefreshCw,
  BarChart2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Types
interface TimeSeriesData {
  date: string;
  value: number | null;
}

interface TimeSeries {
  id: string;
  name: string;
  source: string;
  frequency: string;
  startDate: string;
  latestValue: number;
  status: 'Active' | 'Inactive' | 'Error';
  data: TimeSeriesData[];
  color: string;
}

interface EventAnnotation {
  id: string;
  date: string;
  label: string;
  seriesId?: string;
}

// Mock Data Generator
const generateMockSeries = (): TimeSeries[] => {
  const generateData = (startVal: number, volatility: number, trend: number, missingRate: number = 0) => {
    let currentVal = startVal;
    const data: TimeSeriesData[] = [];
    const startDate = new Date(2020, 0, 1);
    
    for (let i = 0; i < 100; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i * 7); // Weekly data
      
      currentVal = currentVal * (1 + trend + (Math.random() - 0.5) * volatility);
      
      // Introduce missing values
      const isMissing = Math.random() < missingRate;
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: isMissing ? null : parseFloat(currentVal.toFixed(4))
      });
    }
    return data;
  };

  return [
    {
      id: 'ts1',
      name: 'Global Tech Index',
      source: 'Ucheer',
      frequency: 'Weekly',
      startDate: '2020-01-01',
      latestValue: 1452.34,
      status: 'Active',
      data: generateData(1000, 0.05, 0.002),
      color: '#8b5cf6' // Purple
    },
    {
      id: 'ts2',
      name: 'US Treasury 10Y',
      source: 'Federal Reserve',
      frequency: 'Weekly',
      startDate: '2020-01-01',
      latestValue: 4.25,
      status: 'Active',
      data: generateData(2.5, 0.1, 0.005),
      color: '#c4b5fd' // Light Purple
    },
    {
      id: 'ts3',
      name: 'Emerging Markets FX',
      source: 'Reuters',
      frequency: 'Weekly',
      startDate: '2020-01-01',
      latestValue: 98.45,
      status: 'Active',
      data: generateData(100, 0.03, -0.001, 0.1), // 10% missing data
      color: '#4c1d95' // Dark Purple
    },
    {
      id: 'ts4',
      name: 'Commodity Basket',
      source: 'Internal',
      frequency: 'Weekly',
      startDate: '2020-01-01',
      latestValue: 210.5,
      status: 'Inactive',
      data: generateData(150, 0.08, 0.003),
      color: '#a78bfa'
    }
  ];
};

const mockAnnotations: EventAnnotation[] = [
  { id: 'a1', date: '2020-03-18', label: 'Pandemic Crash' },
  { id: 'a2', date: '2021-11-03', label: 'Tapering Announced' },
  { id: 'a3', date: '2022-03-16', label: 'First Rate Hike' }
];

export default function CIXIPanel() {
  const [series, setSeries] = useState<TimeSeries[]>(generateMockSeries());
  const [annotations, setAnnotations] = useState<EventAnnotation[]>(mockAnnotations);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>(['ts1', 'ts2']);
  const [activeTab, setActiveTab] = useState('manager');
  
  // Chart Settings
  const [normalize, setNormalize] = useState(false);
  const [useLogScale, setUseLogScale] = useState(false);
  
  // Interpolation State
  const [interpTarget, setInterpTarget] = useState<string>('ts3');
  const [interpMethod, setInterpMethod] = useState<string>('linear');
  
  // Operation State
  const [opSeries1, setOpSeries1] = useState<string>('ts1');
  const [opSeries2, setOpSeries2] = useState<string>('ts2');
  const [operation, setOperation] = useState<string>('add');
  
  // Export State
  const [exportFormat, setExportFormat] = useState<string>('csv');

  // Derived Data for Multi-Series Chart
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    
    const baseDates = series[0].data.map(d => d.date);
    return baseDates.map((date, index) => {
      const row: any = { date };
      series.forEach(s => {
        if (selectedSeriesIds.includes(s.id)) {
          let val = s.data[index]?.value;
          if (val !== null && val !== undefined) {
            if (normalize) {
              const firstValid = s.data.find(d => d.value !== null)?.value || 1;
              val = parseFloat(((val / firstValid) * 100).toFixed(4));
            }
            row[s.id] = val;
          }
        }
      });
      return row;
    });
  }, [series, selectedSeriesIds, normalize]);

  // Interpolation Logic
  const interpolatedData = useMemo(() => {
    const targetSeries = series.find(s => s.id === interpTarget);
    if (!targetSeries) return [];

    const data = [...targetSeries.data];
    const result = [];
    
    let lastValidIdx = -1;
    let lastValidVal = 0;

    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      if (current.value !== null) {
        lastValidIdx = i;
        lastValidVal = current.value;
        result.push({ date: current.date, original: current.value, interpolated: current.value, isInterpolated: false });
      } else {
        let newVal = 0;
        if (interpMethod === 'forward' && lastValidIdx !== -1) {
          newVal = lastValidVal;
        } else if (interpMethod === 'linear') {
          // Find next valid
          let nextValidIdx = -1;
          let nextValidVal = 0;
          for (let j = i + 1; j < data.length; j++) {
            if (data[j].value !== null) {
              nextValidIdx = j;
              nextValidVal = data[j].value as number;
              break;
            }
          }
          
          if (lastValidIdx !== -1 && nextValidIdx !== -1) {
            const ratio = (i - lastValidIdx) / (nextValidIdx - lastValidIdx);
            newVal = lastValidVal + ratio * (nextValidVal - lastValidVal);
          } else if (lastValidIdx !== -1) {
            newVal = lastValidVal;
          } else if (nextValidIdx !== -1) {
            newVal = nextValidVal;
          }
        } else {
          // Default to 0 for simplicity if no valid bounds
          newVal = lastValidVal;
        }
        
        result.push({ 
          date: current.date, 
          original: null, 
          interpolated: parseFloat(newVal.toFixed(4)), 
          isInterpolated: true 
        });
      }
    }
    return result;
  }, [series, interpTarget, interpMethod]);

  // Operation Logic
  const operationData = useMemo(() => {
    const s1 = series.find(s => s.id === opSeries1);
    const s2 = series.find(s => s.id === opSeries2);
    if (!s1 || !s2) return [];

    return s1.data.map((d1, i) => {
      const d2 = s2.data[i];
      let result = null;
      
      if (d1.value !== null && d2 && d2.value !== null) {
        switch (operation) {
          case 'add': result = d1.value + d2.value; break;
          case 'subtract': result = d1.value - d2.value; break;
          case 'multiply': result = d1.value * d2.value; break;
          case 'divide': result = d2.value !== 0 ? d1.value / d2.value : null; break;
          case 'spread': result = d1.value - d2.value; break;
          case 'ratio': result = d2.value !== 0 ? d1.value / d2.value : null; break;
        }
      }
      
      return {
        date: d1.date,
        s1: d1.value,
        s2: d2?.value || null,
        result: result !== null ? parseFloat(result.toFixed(4)) : null
      };
    });
  }, [series, opSeries1, opSeries2, operation]);

  // Statistics Logic
  const statistics = useMemo(() => {
    const stats: Record<string, any> = {};
    
    selectedSeriesIds.forEach(id => {
      const s = series.find(x => x.id === id);
      if (!s) return;
      
      const values = s.data.filter(d => d.value !== null).map(d => d.value as number);
      if (values.length === 0) return;
      
      const n = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      
      const sorted = [...values].sort((a, b) => a - b);
      const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
      
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      
      // Skewness
      const skewness = values.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / (n * Math.pow(stdDev, 3));
      
      // Kurtosis
      const kurtosis = values.reduce((a, b) => a + Math.pow(b - mean, 4), 0) / (n * Math.pow(stdDev, 4)) - 3;
      
      // Historical VaR (95%)
      const returns = [];
      for (let i = 1; i < values.length; i++) {
        returns.push((values[i] - values[i-1]) / values[i-1]);
      }
      returns.sort((a, b) => a - b);
      const varIndex = Math.floor(returns.length * 0.05);
      const var95 = returns[varIndex] * 100; // as percentage

      stats[s.name] = {
        mean: parseFloat(mean.toFixed(4)),
        median: parseFloat(median.toFixed(4)),
        stdDev: parseFloat(stdDev.toFixed(4)),
        skewness: parseFloat(skewness.toFixed(4)),
        kurtosis: parseFloat(kurtosis.toFixed(4)),
        var95: parseFloat(var95.toFixed(4))
      };
    });
    
    return stats;
  }, [series, selectedSeriesIds]);

  // Export Preview
  const exportPreview = useMemo(() => {
    if (exportFormat === 'csv') {
      let csv = 'Date';
      selectedSeriesIds.forEach(id => {
        const s = series.find(x => x.id === id);
        if (s) csv += `,${s.name}`;
      });
      csv += '\n';
      
      chartData.slice(0, 5).forEach(row => {
        csv += row.date;
        selectedSeriesIds.forEach(id => {
          csv += `,${row[id] !== undefined ? row[id] : ''}`;
        });
        csv += '\n';
      });
      return csv + '...';
    } else {
      return JSON.stringify(chartData.slice(0, 3), null, 2) + '\n...';
    }
  }, [chartData, selectedSeriesIds, series, exportFormat]);

  const toggleSeriesSelection = (id: string) => {
    if (selectedSeriesIds.includes(id)) {
      setSelectedSeriesIds(selectedSeriesIds.filter(x => x !== id));
    } else {
      setSelectedSeriesIds([...selectedSeriesIds, id]);
    }
  };

  const deleteSeries = (id: string) => {
    setSeries(series.filter(s => s.id !== id));
    setSelectedSeriesIds(selectedSeriesIds.filter(x => x !== id));
  };

  return (
    <div className="w-full h-full bg-gray-950 text-gray-100 p-4 flex flex-col font-sans">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-6 h-6 text-purple-500" />
          <h1 className="text-xl font-bold text-purple-100">CIXI <span className="text-gray-400 text-sm font-normal">Custom Index & Time Series Editor</span></h1>
        </div>
        <div className="flex space-x-2">
          <Button type="button" onClick={() => void refreshPanelData()} variant="outline" size="sm" className="bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-purple-400">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh Data
          </Button>
          <Button variant="outline" size="sm" className="bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-purple-400">
            <Settings className="w-4 h-4 mr-2" /> Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-gray-900 border-b border-gray-800 w-full justify-start rounded-none h-12">
          <TabsTrigger value="manager" className="data-[state=active]:bg-gray-800 data-[state=active]:text-purple-400"><Layers className="w-4 h-4 mr-2"/> Series Manager</TabsTrigger>
          <TabsTrigger value="chart" className="data-[state=active]:bg-gray-800 data-[state=active]:text-purple-400"><TrendingUp className="w-4 h-4 mr-2"/> Multi-Series Chart</TabsTrigger>
          <TabsTrigger value="interpolate" className="data-[state=active]:bg-gray-800 data-[state=active]:text-purple-400"><Activity className="w-4 h-4 mr-2"/> Interpolation</TabsTrigger>
          <TabsTrigger value="operations" className="data-[state=active]:bg-gray-800 data-[state=active]:text-purple-400"><Calculator className="w-4 h-4 mr-2"/> Operations</TabsTrigger>
          <TabsTrigger value="statistics" className="data-[state=active]:bg-gray-800 data-[state=active]:text-purple-400"><BarChart2 className="w-4 h-4 mr-2"/> Statistics</TabsTrigger>
          <TabsTrigger value="export" className="data-[state=active]:bg-gray-800 data-[state=active]:text-purple-400"><Download className="w-4 h-4 mr-2"/> Export</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          {/* Manager Tab */}
          <TabsContent value="manager" className="h-full m-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-purple-200">Time Series Repository</h2>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" /> Create New Series
              </Button>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-950 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Select</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Start Date</th>
                    <th className="px-4 py-3">Latest Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedSeriesIds.includes(s.id)}
                          onChange={() => toggleSeriesSelection(s.id)}
                          className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-purple-300 flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }}></div>
                        {s.name}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{s.source}</td>
                      <td className="px-4 py-3 text-gray-300">{s.frequency}</td>
                      <td className="px-4 py-3 text-gray-400">{s.startDate}</td>
                      <td className="px-4 py-3 font-mono text-gray-200">{s.latestValue.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          s.status === 'Active' ? 'border-green-500 text-green-400' : 
                          s.status === 'Inactive' ? 'border-gray-500 text-gray-400' : 
                          'border-red-500 text-red-400'
                        }>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-purple-400 h-8 w-8">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-400 h-8 w-8" onClick={() => deleteSeries(s.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Chart Tab */}
          <TabsContent value="chart" className="h-full m-0 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Normalize (Base 100):</span>
                  <button 
                    className={`w-10 h-5 rounded-full transition-colors ${normalize ? 'bg-purple-600' : 'bg-gray-700'}`}
                    onClick={() => setNormalize(!normalize)}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${normalize ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Log Scale:</span>
                  <button 
                    className={`w-10 h-5 rounded-full transition-colors ${useLogScale ? 'bg-purple-600' : 'bg-gray-700'}`}
                    onClick={() => setUseLogScale(!useLogScale)}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${useLogScale ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="bg-gray-900 border-gray-700 text-gray-300">
                  <Plus className="w-4 h-4 mr-2" /> Add Annotation
                </Button>
              </div>
            </div>
            
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-4 min-h-[400px]">
              {selectedSeriesIds.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} minTickGap={30} />
                    <YAxis 
                      stroke="#9ca3af" 
                      tick={{ fill: '#9ca3af', fontSize: 12 }} 
                      scale={useLogScale ? 'log' : 'auto'} 
                      domain={['auto', 'auto']}
                      tickFormatter={(val) => val.toLocaleString()}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                      itemStyle={{ color: '#e5e7eb' }}
                      labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    {selectedSeriesIds.map(id => {
                      const s = series.find(x => x.id === id);
                      if (!s) return null;
                      return (
                        <Line 
                          key={id}
                          type="monotone" 
                          dataKey={id} 
                          name={s.name} 
                          stroke={s.color} 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, fill: s.color, stroke: '#111827', strokeWidth: 2 }}
                          connectNulls={false}
                        />
                      );
                    })}
                    
                    {annotations.map((ann, i) => (
                      <ReferenceLine 
                        key={ann.id} 
                        x={ann.date} 
                        stroke="#6b7280" 
                        strokeDasharray="3 3"
                        label={{ position: 'top', value: ann.label, fill: '#9ca3af', fontSize: 10 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col">
                  <AlertCircle className="w-12 h-12 mb-4 text-gray-600" />
                  <p>Select at least one series from the Manager tab to view chart.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Interpolate Tab */}
          <TabsContent value="interpolate" className="h-full m-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Target Series</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={interpTarget} onValueChange={setInterpTarget}>
                    <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                      <SelectValue placeholder="Select series" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                      {series.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={interpMethod} onValueChange={setInterpMethod}>
                    <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                      <SelectItem value="linear">Linear Interpolation</SelectItem>
                      <SelectItem value="forward">Forward Fill (Last Observation Carried Forward)</SelectItem>
                      <SelectItem value="zero">Fill with Zero</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800 flex items-center justify-center">
                <CardContent className="p-6 w-full">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    Apply Interpolation
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-4 min-h-[350px]">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Interpolation Preview</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={interpolatedData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} minTickGap={30} />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} domain={['auto', 'auto']} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="original" name="Original Data" stroke="#8b5cf6" strokeWidth={2} connectNulls={false} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="interpolated" name="Interpolated" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Scatter dataKey="interpolated" name="Filled Points" fill="#f59e0b" shape="circle" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="h-full m-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Series A</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={opSeries1} onValueChange={setOpSeries1}>
                    <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                      <SelectValue placeholder="Select series" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                      {series.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Operation</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={operation} onValueChange={setOperation}>
                    <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                      <SelectItem value="add">A + B (Addition)</SelectItem>
                      <SelectItem value="subtract">A - B (Subtraction)</SelectItem>
                      <SelectItem value="multiply">A × B (Multiplication)</SelectItem>
                      <SelectItem value="divide">A ÷ B (Division)</SelectItem>
                      <SelectItem value="spread">Spread (A - B)</SelectItem>
                      <SelectItem value="ratio">Ratio (A / B)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">Series B</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={opSeries2} onValueChange={setOpSeries2}>
                    <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                      <SelectValue placeholder="Select series" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                      {series.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800 flex items-center justify-center">
                <CardContent className="p-6 w-full">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    Save as New Series
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-4 min-h-[350px]">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Operation Result Preview</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={operationData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorResult" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} minTickGap={30} />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} domain={['auto', 'auto']} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="result" name="Result" stroke="#10b981" fillOpacity={1} fill="url(#colorResult)" />
                  <Line type="monotone" dataKey="s1" name="Series A" stroke="#6b7280" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="s2" name="Series B" stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="h-full m-0">
            <div className="mb-4">
              <p className="text-sm text-gray-400">Descriptive statistics for currently selected series in the Manager tab.</p>
            </div>
            
            {selectedSeriesIds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(statistics).map(([name, stats]) => (
                  <Card key={name} className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-2 border-b border-gray-800">
                      <CardTitle className="text-md font-semibold text-purple-300">{name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Mean</span>
                          <span className="font-mono text-gray-200">{stats.mean}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Median</span>
                          <span className="font-mono text-gray-200">{stats.median}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Std Deviation</span>
                          <span className="font-mono text-gray-200">{stats.stdDev}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Skewness</span>
                          <span className="font-mono text-gray-200">{stats.skewness}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Kurtosis</span>
                          <span className="font-mono text-gray-200">{stats.kurtosis}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                          <span className="text-sm font-medium text-purple-400">Historical VaR (95%)</span>
                          <span className="font-mono font-medium text-red-400">{stats.var95}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-500 flex-col bg-gray-900 border border-gray-800 rounded-lg">
                <BarChart2 className="w-12 h-12 mb-4 text-gray-600" />
                <p>Select at least one series to view statistics.</p>
              </div>
            )}
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="h-full m-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="bg-gray-900 border-gray-800 col-span-2">
                <CardHeader>
                  <CardTitle className="text-md font-semibold text-purple-200">Export Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Format</label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                          <SelectItem value="csv">CSV (Comma Separated Values)</SelectItem>
                          <SelectItem value="json">JSON (JavaScript Object Notation)</SelectItem>
                          <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Frequency Aggregation</label>
                      <Select defaultValue="native">
                        <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-200">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                          <SelectItem value="native">Native (No aggregation)</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Selected Series to Export</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-950 border border-gray-800 rounded-md min-h-[60px]">
                      {selectedSeriesIds.length > 0 ? (
                        selectedSeriesIds.map(id => {
                          const s = series.find(x => x.id === id);
                          return s ? (
                            <Badge key={id} variant="secondary" className="bg-purple-900/50 text-purple-200 border border-purple-800">
                              {s.name}
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-sm text-gray-500">No series selected</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800 flex flex-col justify-center items-center p-6">
                <FileText className="w-16 h-16 text-purple-500 mb-4 opacity-80" />
                <h3 className="text-lg font-medium text-gray-200 mb-2">Ready to Export</h3>
                <p className="text-sm text-gray-400 text-center mb-6">
                  Exporting {selectedSeriesIds.length} series with {chartData.length} data points.
                </p>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg" disabled={selectedSeriesIds.length === 0}>
                  <Download className="w-5 h-5 mr-2" /> Download File
                </Button>
              </Card>
            </div>
            
            <div className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-hidden flex flex-col">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Data Preview</h3>
              <pre className="flex-1 overflow-auto text-xs font-mono text-gray-300 bg-gray-900 p-4 rounded border border-gray-800">
                {exportPreview}
              </pre>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
