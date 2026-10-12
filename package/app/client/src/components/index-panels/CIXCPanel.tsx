import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart as RechartsBarChart, Bar } from 'recharts';
import { Settings, SlidersHorizontal, TrendingUp, Table, AlertTriangle, Workflow } from 'lucide-react';

interface TimeSeriesData {
  date: string;
  value: number;
}

interface ConversionStep {
  id: string;
  type: string;
  params: Record<string, any>;
}

interface Statistics {
  mean: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  adf: string;
}

// Helper functions for statistical calculations (simplified)
const calculateMean = (data: number[]): number => {
  if (data.length === 0) return 0;
  return data.reduce((sum, val) => sum + val, 0) / data.length;
};

const calculateStdDev = (data: number[], mean: number): number => {
  if (data.length < 2) return 0;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - 1);
  return Math.sqrt(variance);
};

const calculateSkewness = (data: number[], mean: number, stdDev: number): number => {
  if (data.length < 3 || stdDev === 0) return 0;
  const n = data.length;
  const m3 = data.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / n;
  return m3 / Math.pow(stdDev, 3);
};

const calculateKurtosis = (data: number[], mean: number, stdDev: number): number => {
  if (data.length < 4 || stdDev === 0) return 0;
  const n = data.length;
  const m4 = data.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / n;
  return m4 / Math.pow(stdDev, 4) - 3;
};

// Simplified ADF test placeholder
const runADFTest = (data: number[]): string => {
  if (data.length < 10) return '数据不足';
  // In a real scenario, this would involve a complex statistical test.
  // For this component, we'll return a placeholder based on simple observation.
  const mean = calculateMean(data);
  const stdDev = calculateStdDev(data, mean);
  if (stdDev < 0.1) return '可能平稳'; // Very low variance might indicate stationarity
  if (data[data.length - 1] > data[0] * 1.5 || data[data.length - 1] < data[0] * 0.5) return '可能不平稳'; // Significant trend
  return '需进一步分析';
};

const calculateACF = (data: number[], lags: number): { lag: number; acf: number }[] => {
  const mean = calculateMean(data);
  const n = data.length;
  const result: { lag: number; acf: number }[] = [];

  for (let k = 0; k <= lags; k++) {
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n - k; i++) {
      numerator += (data[i + k] - mean) * (data[i] - mean);
    }
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(data[i] - mean, 2);
    }
    result.push({ lag: k, acf: denominator === 0 ? 0 : parseFloat((numerator / denominator).toFixed(4)) });
  }
  return result;
};

const calculatePACF = (data: number[], lags: number): { lag: number; pacf: number }[] => {
  // PACF calculation is significantly more complex and typically involves solving Yule-Walker equations.
  // For this simplified component, we'll use a basic approximation or placeholder.
  // A common simplification for PACF is that PACF(k) is approximately ACF(k) for small k, and then drops off.
  // This is not statistically rigorous but serves as a visual placeholder.
  const acfValues = calculateACF(data, lags);
  const result: { lag: number; pacf: number }[] = [];

  for (let k = 0; k <= lags; k++) {
    if (k === 0) {
      result.push({ lag: k, pacf: 1 });
    } else if (k === 1) {
      result.push({ lag: k, pacf: acfValues[1].acf });
    } else {
      // This is a very rough approximation. A proper PACF requires more complex math.
      // For demonstration, let's just make it decay.
      result.push({ lag: k, pacf: parseFloat((acfValues[k].acf * Math.pow(0.8, k - 1)).toFixed(4)) });
    }
  }
  return result;
};

const CIXCPanel: React.FC = () => {
  const [selectedDataSource, setSelectedDataSource] = useState<string>('price');
  const [conversionSteps, setConversionSteps] = useState<ConversionStep[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Dummy data generation based on selected data source
  const rawData: TimeSeriesData[] = useMemo(() => {
    const data: TimeSeriesData[] = [];
    let value = 100;
    const startDate = new Date('2023-01-01');

    for (let i = 0; i < 100; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const date = currentDate.toISOString().split('T')[0];

      if (selectedDataSource === 'price') {
        value += Math.random() * 2 - 1; // Random walk for price
      } else if (selectedDataSource === 'yield') {
        value = 2 + Math.sin(i / 10) * 0.5 + Math.random() * 0.1; // Sinusoidal with noise for yield
      } else if (selectedDataSource === 'macro') {
        value = 50 + i * 0.5 + Math.random() * 5; // Upward trend with noise for macro
      }
      data.push({ date, value: parseFloat(value.toFixed(2)) });
    }
    return data;
  }, [selectedDataSource]);

  // Conversion functions
  const applyConversion = useCallback((data: TimeSeriesData[], step: ConversionStep): TimeSeriesData[] => {
    let transformedData = [...data];
    const values = data.map(d => d.value);

    switch (step.type) {
      case 'log':
        transformedData = data.map(d => ({ ...d, value: parseFloat(Math.log(d.value > 0 ? d.value : 0.01).toFixed(4)) }));
        break;
      case 'diff':
        transformedData = data.slice(1).map((d, i) => ({
          ...d,
          value: parseFloat((d.value - data[i].value).toFixed(4)),
        }));
        break;
      case 'percent_change':
        transformedData = data.slice(1).map((d, i) => ({
          ...d,
          value: parseFloat((((d.value - data[i].value) / data[i].value) * 100).toFixed(4)),
        }));
        break;
      case 'standardize':
        const mean = calculateMean(values);
        const stdDev = calculateStdDev(values, mean);
        transformedData = data.map(d => ({
          ...d,
          value: stdDev === 0 ? 0 : parseFloat(((d.value - mean) / stdDev).toFixed(4)),
        }));
        break;
      case 'seasonal_adjust':
        // Simplified seasonal adjustment: subtract a moving average of a fixed period
        const period = parseInt(step.params.period || '7');
        if (data.length > period) {
          transformedData = data.map((d, i) => {
            if (i < period - 1) return { ...d, value: 0 }; // Not enough data for initial period
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.value, 0);
            const movingAvg = sum / period;
            return { ...d, value: parseFloat((d.value - movingAvg).toFixed(4)) };
          });
        }
        break;
      case 'hp_filter':
        // HP Filter is complex. Placeholder: simple smoothing with moving average.
        const hpLambda = parseFloat(step.params.lambda || '1600'); // Common for quarterly data
        const hpPeriod = Math.floor(Math.sqrt(hpLambda / 100)); // Very rough approximation for period
        if (data.length > hpPeriod) {
          transformedData = data.map((d, i) => {
            if (i < hpPeriod || i >= data.length - hpPeriod) return { ...d, value: d.value }; // Edge cases
            const sum = data.slice(i - hpPeriod, i + hpPeriod + 1).reduce((acc, val) => acc + val.value, 0);
            const smoothedValue = sum / (2 * hpPeriod + 1);
            return { ...d, value: parseFloat(smoothedValue.toFixed(4)) }; // Returning trend component
          });
        }
        break;
      case 'moving_average':
        const maPeriod = parseInt(step.params.period || '5');
        if (data.length > maPeriod) {
          transformedData = data.map((d, i) => {
            if (i < maPeriod - 1) return { ...d, value: 0 };
            const sum = data.slice(i - maPeriod + 1, i + 1).reduce((acc, val) => acc + val.value, 0);
            return { ...d, value: parseFloat((sum / maPeriod).toFixed(4)) };
          });
        }
        break;
      case 'cumulative_sum':
        let cumulativeSum = 0;
        transformedData = data.map(d => {
          cumulativeSum += d.value;
          return { ...d, value: parseFloat(cumulativeSum.toFixed(4)) };
        });
        break;
      default:
        break;
    }
    return transformedData;
  }, []);

  // Memoized converted data and statistics calculation
  const { convertedData, statistics, acfPacfData, anomalies } = useMemo(() => {
    let currentData = rawData;

    // Apply conversion steps sequentially
    for (const step of conversionSteps) {
      currentData = applyConversion(currentData, step);
    }

    const rawValues = rawData.map(d => d.value);
    const convertedValues = currentData.map(d => d.value);

    // Calculate statistics for raw data
    const rawMean = calculateMean(rawValues);
    const rawStdDev = calculateStdDev(rawValues, rawMean);
    const rawSkewness = calculateSkewness(rawValues, rawMean, rawStdDev);
    const rawKurtosis = calculateKurtosis(rawValues, rawMean, rawStdDev);
    const rawAdf = runADFTest(rawValues);

    // Calculate statistics for converted data
    const convertedMean = calculateMean(convertedValues);
    const convertedStdDev = calculateStdDev(convertedValues, convertedMean);
    const convertedSkewness = calculateSkewness(convertedValues, convertedMean, convertedStdDev);
    const convertedKurtosis = calculateKurtosis(convertedValues, convertedMean, convertedStdDev);
    const convertedAdf = runADFTest(convertedValues);

    const stats = {
      raw: { mean: rawMean, stdDev: rawStdDev, skewness: rawSkewness, kurtosis: rawKurtosis, adf: rawAdf },
      converted: { mean: convertedMean, stdDev: convertedStdDev, skewness: convertedSkewness, kurtosis: convertedKurtosis, adf: convertedAdf },
    };

    // Calculate ACF/PACF for converted data
    const lags = Math.min(20, convertedValues.length - 1);
    const acf = calculateACF(convertedValues, lags);
    const pacf = calculatePACF(convertedValues, lags);
    const combinedAcfPacfData = acf.map((a, index) => ({ ...a, pacf: pacf[index]?.pacf || 0 }));

    // Simple Anomaly Detection (e.g., values outside 3 standard deviations)
    const detectedAnomalies: TimeSeriesData[] = [];
    if (convertedStdDev > 0) {
      for (let i = 0; i < convertedValues.length; i++) {
        if (Math.abs(convertedValues[i] - convertedMean) > 3 * convertedStdDev) {
          detectedAnomalies.push(currentData[i]);
        }
      }
    }

    return {
      convertedData: currentData,
      statistics: stats,
      acfPacfData: combinedAcfPacfData,
      anomalies: detectedAnomalies,
    };
  }, [rawData, conversionSteps, applyConversion]);

  const addConversionStep = useCallback(() => {
    setConversionSteps(prev => [...prev, { id: `step-${prev.length + 1}`, type: 'log', params: {} }]);
  }, []);

  const removeConversionStep = useCallback((id: string) => {
    setConversionSteps(prev => prev.filter(step => step.id !== id));
  }, []);

  const updateConversionStep = useCallback((id: string, key: string, value: any) => {
    setConversionSteps(prev =>
      prev.map(step => (step.id === id ? { ...step, [key]: value } : step))
    );
  }, []);

  const updateConversionStepParams = useCallback((id: string, newParams: Record<string, any>) => {
    setConversionSteps(prev =>
      prev.map(step => (step.id === id ? { ...step, params: newParams } : step))
    );
  }, []);

  const getConversionFormula = (type: string): string => {
    switch (type) {
      case 'log': return 'Y_t = ln(X_t)';
      case 'diff': return 'Y_t = X_t - X_{t-1}';
      case 'percent_change': return 'Y_t = ((X_t - X_{t-1}) / X_{t-1}) * 100';
      case 'standardize': return 'Y_t = (X_t - μ) / σ';
      case 'seasonal_adjust': return 'Y_t = X_t - MA(X_t, period)';
      case 'hp_filter': return 'Y_t = Trend Component (λ)';
      case 'moving_average': return 'Y_t = MA(X_t, period)';
      case 'cumulative_sum': return 'Y_t = Σ X_i';
      default: return '';
    }
  };

  return (
    <div className="p-4 bg-gray-950 text-gray-100 min-h-screen font-sans">
      <Card className="bg-gray-900 border-gray-700 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold text-cyan-400">CIXCPanel - 自设转换编辑器</CardTitle>
          <Badge variant="outline" className="text-cyan-400 border-cyan-400">时间序列分析</Badge>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-gray-800">
              <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-300"><TrendingUp className="h-4 w-4 mr-2" />总览</TabsTrigger>
              <TabsTrigger value="editor" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-300"><SlidersHorizontal className="h-4 w-4 mr-2" />转换编辑器</TabsTrigger>
              <TabsTrigger value="comparison" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-300"><Table className="h-4 w-4 mr-2" />统计对比</TabsTrigger>
              <TabsTrigger value="acf_pacf" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-300">ACF/PACF</TabsTrigger>
              <TabsTrigger value="anomalies" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-300"><AlertTriangle className="h-4 w-4 mr-2" />异常值</TabsTrigger>
              <TabsTrigger value="workflow" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-300"><Workflow className="h-4 w-4 mr-2" />转换流程</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">数据源选择与转换预览</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="dataSource" className="text-gray-300">数据源:</label>
                    <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                      <SelectTrigger className="w-[180px] bg-gray-700 text-gray-100 border-gray-600 focus:ring-cyan-500">
                        <SelectValue placeholder="选择数据源" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 text-gray-100 border-gray-600">
                        <SelectItem value="price">价格数据</SelectItem>
                        <SelectItem value="yield">收益率数据</SelectItem>
                        <SelectItem value="macro">宏观数据</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rawData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                        <Area type="monotone" dataKey="value" stroke="#06B6D4" fillOpacity={1} fill="url(#colorUv)" name="原始序列" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="editor" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-cyan-400">转换步骤</CardTitle>
                  <Button onClick={addConversionStep} className="bg-cyan-600 hover:bg-cyan-700 text-white">添加转换</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {conversionSteps.length === 0 && <p className="text-gray-400">点击“添加转换”开始构建转换链。</p>}
                  {conversionSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center space-x-2 p-2 border border-gray-700 rounded-md bg-gray-900">
                      <span className="text-gray-300 font-semibold">步骤 {index + 1}:</span>
                      <Select value={step.type} onValueChange={(value) => updateConversionStep(step.id, 'type', value)}>
                        <SelectTrigger className="w-[200px] bg-gray-700 text-gray-100 border-gray-600 focus:ring-cyan-500">
                          <SelectValue placeholder="选择转换类型" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 text-gray-100 border-gray-600">
                          <SelectItem value="log">对数变换</SelectItem>
                          <SelectItem value="diff">一阶差分</SelectItem>
                          <SelectItem value="percent_change">百分比变化</SelectItem>
                          <SelectItem value="standardize">标准化</SelectItem>
                          <SelectItem value="seasonal_adjust">季节调整</SelectItem>
                          <SelectItem value="hp_filter">HP滤波</SelectItem>
                          <SelectItem value="moving_average">移动平均</SelectItem>
                          <SelectItem value="cumulative_sum">累积和</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="参数 (e.g., period=12)"
                        className="flex-grow bg-gray-700 text-gray-100 border-gray-600 focus:ring-cyan-500"
                        value={Object.entries(step.params).map(([k, v]) => `${k}=${v}`).join(', ')}
                        onChange={(e) => {
                          const newParams = e.target.value.split(',').reduce((acc, param) => {
                            const [key, val] = param.split('=');
                            if (key && val) acc[key.trim()] = val.trim();
                            return acc;
                          }, {} as Record<string, string>);
                          updateConversionStepParams(step.id, newParams);
                        }}
                      />
                      <span className="text-gray-400 text-sm">{getConversionFormula(step.type)}</span>
                      <Button variant="destructive" onClick={() => removeConversionStep(step.id)} className="bg-red-600 hover:bg-red-700 text-white">移除</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">转换前后对比图</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={convertedData.map((d, i) => ({
                        date: d.date,
                        rawValue: rawData[i]?.value || 0,
                        convertedValue: d.value,
                      }))}
                      margin={{
                        top: 5, right: 30, left: 20, bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis yAxisId="left" stroke="#06B6D4" />
                      <YAxis yAxisId="right" orientation="right" stroke="#F87171" />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="rawValue" stroke="#06B6D4" activeDot={{ r: 8 }} name="原始序列" />
                      <Line yAxisId="right" type="monotone" dataKey="convertedValue" stroke="#F87171" activeDot={{ r: 8 }} name="转换后序列" />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">统计特性对比表</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-gray-300">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-4">特性</th>
                          <th className="text-left py-2 px-4">原始序列</th>
                          <th className="text-left py-2 px-4">转换后序列</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-4">均值</td>
                          <td className="py-2 px-4">{statistics.raw.mean.toFixed(4)}</td>
                          <td className="py-2 px-4">{statistics.converted.mean.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-4">标准差</td>
                          <td className="py-2 px-4">{statistics.raw.stdDev.toFixed(4)}</td>
                          <td className="py-2 px-4">{statistics.converted.stdDev.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-4">偏度</td>
                          <td className="py-2 px-4">{statistics.raw.skewness.toFixed(4)}</td>
                          <td className="py-2 px-4">{statistics.converted.skewness.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-4">峰度</td>
                          <td className="py-2 px-4">{statistics.raw.kurtosis.toFixed(4)}</td>
                          <td className="py-2 px-4">{statistics.converted.kurtosis.toFixed(4)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-4">ADF检验</td>
                          <td className="py-2 px-4">{statistics.raw.adf}</td>
                          <td className="py-2 px-4">{statistics.converted.adf}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="acf_pacf" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">ACF/PACF 图</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={acfPacfData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                      <XAxis dataKey="lag" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                      <Legend />
                      <Bar dataKey="acf" fill="#06B6D4" name="ACF" />
                      <Bar dataKey="pacf" fill="#F87171" name="PACF" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anomalies" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">异常值检测</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {anomalies.length === 0 ? (
                    <p className="text-gray-400">未检测到异常值。</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300">
                      {anomalies.map((anomaly, index) => (
                        <li key={index}>日期: {anomaly.date}, 值: {anomaly.value.toFixed(4)}</li>
                      ))}
                    </ul>
                  )}
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={convertedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#06B6D4" name="转换后序列" />
                        {anomalies.map((anomaly, index) => (
                          <Line
                            key={`anomaly-${index}`}
                            dataKey="value"
                            data={[{ date: anomaly.date, value: anomaly.value }]}
                            stroke="#EF4444"
                            dot={{ r: 6, fill: '#EF4444' }}
                            activeDot={false}
                            name="异常值"
                          />
                        ))}
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workflow" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">多步转换链流程图</CardTitle>
                </CardHeader>
                <CardContent>
                  {conversionSteps.length === 0 ? (
                    <p className="text-gray-400">请在“转换编辑器”中添加转换步骤以查看流程图。</p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center space-x-4 text-gray-300">
                      <Badge variant="secondary" className="bg-gray-700 text-cyan-400">原始数据</Badge>
                      {conversionSteps.map((step, index) => (
                        <React.Fragment key={step.id}>
                          <span className="text-cyan-400 text-2xl">→</span>
                          <Badge variant="secondary" className="bg-gray-700 text-cyan-400">步骤 {index + 1}: {step.type} ({getConversionFormula(step.type)})</Badge>
                        </React.Fragment>
                      ))}
                      <span className="text-cyan-400 text-2xl">→</span>
                      <Badge variant="secondary" className="bg-gray-700 text-cyan-400">转换后数据</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CIXCPanel;
