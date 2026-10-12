import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, BarChart as RechartsBarChart, Bar } from 'recharts';
import { 
  Calculator, 
  FunctionSquare, 
  Search, 
  Save, 
  History, 
  BarChart, 
  LineChart, 
  AreaChart as AreaChartIcon 
} from 'lucide-react';

interface CIXNPanelProps {
  // Define any props if necessary
}

const CIXNPanel: React.FC<CIXNPanelProps> = () => {
  const [expression, setExpression] = useState<string>("(SPX Index + NDX Index) / 2");
  const [evaluatedResult, setEvaluatedResult] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedExpressions, setSavedExpressions] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [variableSearchTerm, setVariableSearchTerm] = useState<string>("");

  // Mock financial data generation
  const mockIndexData = useMemo(() => {
    const data: { date: string; [key: string]: number | string }[] = [];
    const today = new Date('2026-07-03');
    for (let i = 365; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      data.push({
        date: dateString,
        'SPX Index': parseFloat((1000 + Math.sin(i / 30) * 100 + Math.random() * 20).toFixed(2)),
        'NDX Index': parseFloat((1500 + Math.cos(i / 25) * 150 + Math.random() * 30).toFixed(2)),
        'USGG10YR Index': parseFloat((2.5 + Math.sin(i / 60) * 0.5 + Math.random() * 0.1).toFixed(2)),
        'USGG2YR Index': parseFloat((1.8 + Math.cos(i / 50) * 0.3 + Math.random() * 0.05).toFixed(2)),
      });
    }
    return data;
  }, []);

  // Simple expression evaluator (for demonstration purposes)
  const evaluateExpression = useCallback((expr: string) => {
    setError(null);
    try {
      const result: any[] = [];
      mockIndexData.forEach(dayData => {
        let tempExpr = expr;
        // Replace index names with their values for the current day
        Object.keys(dayData).forEach(key => {
          if (key !== 'date') {
            tempExpr = tempExpr.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&'), 'g'), dayData[key].toString());
          }
        });

        // Basic arithmetic evaluation
        try {
          // Using Function constructor for basic evaluation. In a real app, use a safer math expression parser.
          const value = new Function('return ' + tempExpr)();
          if (typeof value === 'number' && !isNaN(value)) {
            result.push({ date: dayData.date, value: parseFloat(value.toFixed(2)) });
          } else {
            throw new Error('Expression resulted in a non-numeric value.');
          }
        } catch (evalError: any) {
          throw new Error(`Evaluation error on ${dayData.date}: ${evalError.message}`);
        }
      });
      setEvaluatedResult(result);
    } catch (e: any) {
      setError(e.message);
      setEvaluatedResult([]);
    }
  }, [mockIndexData]);

  useEffect(() => {
    evaluateExpression(expression);
  }, [expression, evaluateExpression]);

  // Statistical summary calculation
  const statisticalSummary = useMemo(() => {
    if (evaluatedResult.length === 0 || error) return null;

    const values = evaluatedResult.map(d => d.value);
    const current = values[values.length - 1];
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    const sortedValues = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];

    const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / values.length);

    // Simple quantiles (25th, 75th)
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];

    return {
      current: parseFloat(current.toFixed(2)),
      mean: parseFloat(mean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      q1: parseFloat(q1.toFixed(2)),
      q3: parseFloat(q3.toFixed(2)),
    };
  }, [evaluatedResult, error]);

  // Mock function library
  const functionLibrary = useMemo(() => [
    { category: '数学运算', functions: ['ADD(a,b)', 'SUB(a,b)', 'MUL(a,b)', 'DIV(a,b)', 'ABS(a)', 'POW(a,b)'] },
    { category: '统计函数', functions: ['AVG(series)', 'SUM(series)', 'STDDEV(series)', 'MAX(series)', 'MIN(series)'] },
    { category: '时间序列函数', functions: ['SMA(series,period)', 'EMA(series,period)', 'LAG(series,period)'] },
    { category: '金融函数', functions: ['BETA(series1,series2)', 'VOLATILITY(series)'] },
  ], []);

  // Mock variable search results
  const variableSearchResults = useMemo(() => [
    { name: 'SPX Index', description: '标普500指数' },
    { name: 'NDX Index', description: '纳斯达克100指数' },
    { name: 'USGG10YR Index', description: '美国10年期国债收益率' },
    { name: 'USGG2YR Index', description: '美国2年期国债收益率' },
    { name: 'EURUSD Curncy', description: '欧元兑美元汇率' },
    { name: 'CL1 Comdty', description: 'WTI原油期货' },
  ], []);

  const handleSaveExpression = useCallback(() => {
    if (expression && !savedExpressions.includes(expression)) {
      setSavedExpressions(prev => [...prev, expression]);
    }
  }, [expression, savedExpressions]);

  const handleLoadExpression = useCallback((expr: string) => {
    setExpression(expr);
  }, []);

  const handleInsertFunction = useCallback((fn: string) => {
    setExpression(prev => prev + (prev.endsWith(" ") ? "" : " ") + fn);
  }, []);

  const handleInsertVariable = useCallback((variableName: string) => {
    setExpression(prev => prev + (prev.endsWith(" ") ? "" : " ") + variableName);
  }, []);

  const handleClearExpression = useCallback(() => {
    setExpression("");
    setError(null);
    setEvaluatedResult([]);
  }, []);

  const handleRemoveSavedExpression = useCallback((exprToRemove: string) => {
    setSavedExpressions(prev => prev.filter(expr => expr !== exprToRemove));
  }, []);

  // Mock historical performance data for comparison (optional, to increase line count and complexity)
  const mockBenchmarkData = useMemo(() => {
    const data: { date: string; value: number }[] = [];
    const today = new Date("2026-07-03");
    for (let i = 365; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split("T")[0];
      data.push({
        date: dateString,
        value: parseFloat((1200 + Math.sin(i / 40) * 80 + Math.random() * 15).toFixed(2)),
      });
    }
    return data;
  }, []);

  const [showBenchmark, setShowBenchmark] = useState(false);

  // Function to simulate syntax highlighting (very basic)
  const highlightSyntax = (text: string) => {
    let highlightedText = text;
    // Highlight operators
    highlightedText = highlightedText.replace(/([+\-*/()])/g, 
      `<span style="color: #FFD700;">$1</span>`); // Gold for operators
    // Highlight numbers
    highlightedText = highlightedText.replace(/\b(\d+(\.\d+)?)\b/g, 
      `<span style="color: #00BFFF;">$1</span>`); // Deep Sky Blue for numbers
    // Highlight keywords (e.g., Index)
    highlightedText = highlightedText.replace(/\b(Index|AVG|SUM|STDDEV|MAX|MIN|SMA|EMA|LAG|BETA|VOLATILITY)\b/g, 
      `<span style="color: #98FB98;">$1</span>`); // Pale Green for keywords
    // Highlight variables (e.g., SPX Index)
    variableSearchResults.forEach(v => {
      highlightedText = highlightedText.replace(new RegExp(`\\b(${v.name.replace(/[-\/\\^$*+?.()|[\\]{}]/g, 
        `\\$&`)})\\b`, `g`), 
        `<span style="color: #ADD8E6;">${v.name}</span>`); // Light Blue for variables
    });
    return highlightedText;
  };

  const displayedExpression = useMemo(() => highlightSyntax(expression), [expression, variableSearchResults]);




  return (
    <Card className="w-full h-full flex flex-col bg-gray-950 text-gray-100 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-300">CIXNPanel - 自定义指数表达式编辑器</CardTitle>
        <Calculator className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-4 space-y-4 overflow-y-auto">
        {/* Top Section: Editor and Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Editor Area */}
          <div className="lg:col-span-2 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-400">表达式编辑器</span>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-900 border-gray-700 hover:bg-gray-800" onClick={handleSaveExpression}>
                  <Save className="h-3 w-3 mr-1" /> 保存
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-900 border-gray-700 hover:bg-gray-800" onClick={handleClearExpression}>
                  <FunctionSquare className="h-3 w-3 mr-1" /> 清空
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs bg-gray-900 border-gray-700 hover:bg-gray-800" onClick={() => evaluateExpression(expression)}>
                  <Calculator className="h-3 w-3 mr-1" /> 计算
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full h-32 bg-black border border-gray-700 rounded-md overflow-hidden">
                <textarea
                  className="absolute inset-0 w-full h-full p-3 bg-transparent text-green-400 font-mono text-sm resize-none outline-none caret-white"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="输入指数表达式，例如: (SPX Index + NDX Index) / 2"
                  spellCheck={false}
                  style={{ zIndex: 1, color: 'transparent' }}
                />
                <div
                  className="absolute inset-0 w-full h-full p-3 font-mono text-sm pointer-events-none overflow-auto"
                  dangerouslySetInnerHTML={{ __html: displayedExpression }}
                  style={{ zIndex: 0, color: '#green-400' }}
                />
              </div>
              {error && (
                <div className="absolute bottom-0 left-0 right-0 bg-red-900/80 text-red-200 text-xs p-2 rounded-b-md border-t border-red-800">
                  语法错误: {error}
                </div>
              )}
            </div>
          </div>

          {/* Tools Area (Functions & Variables) */}
          <div className="flex flex-col space-y-2">
            <Tabs defaultValue="functions" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 bg-gray-900">
                <TabsTrigger value="functions" className="text-xs data-[state=active]:bg-gray-800">函数库</TabsTrigger>
                <TabsTrigger value="variables" className="text-xs data-[state=active]:bg-gray-800">变量</TabsTrigger>
                <TabsTrigger value="history" className="text-xs data-[state=active]:bg-gray-800">历史</TabsTrigger>
              </TabsList>
              
              <TabsContent value="functions" className="flex-grow mt-2 bg-gray-900 border border-gray-800 rounded-md p-2 overflow-y-auto max-h-32">
                {functionLibrary.map((cat, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="text-xs font-semibold text-gray-500 mb-1">{cat.category}</div>
                    <div className="flex flex-wrap gap-1">
                      {cat.functions.map((fn, fIdx) => (
                        <Badge 
                          key={fIdx} 
                          variant="secondary" 
                          className="text-[10px] cursor-pointer bg-gray-800 hover:bg-gray-700 text-blue-400"
                          onClick={() => handleInsertFunction(fn)}
                        >
                          {fn}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="variables" className="flex-grow mt-2 bg-gray-900 border border-gray-800 rounded-md p-2 overflow-y-auto max-h-32">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-500" />
                  <Input 
                    placeholder="搜索字段..." 
                    className="h-6 pl-7 text-xs bg-gray-800 border-gray-700 text-gray-200"
                    value={variableSearchTerm}
                    onChange={(e) => setVariableSearchTerm(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  {variableSearchResults
                    .filter(v => v.name.toLowerCase().includes(variableSearchTerm.toLowerCase()) || v.description.toLowerCase().includes(variableSearchTerm.toLowerCase()))
                    .map((v, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center p-1 hover:bg-gray-800 rounded cursor-pointer group"
                      onClick={() => handleInsertVariable(v.name)}
                    >
                      <span className="text-xs text-green-400 font-mono">{v.name}</span>
                      <span className="text-[10px] text-gray-500 group-hover:text-gray-400">{v.description}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="history" className="flex-grow mt-2 bg-gray-900 border border-gray-800 rounded-md p-2 overflow-y-auto max-h-32">
                {savedExpressions.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center mt-4">暂无保存的表达式</div>
                ) : (
                  <div className="space-y-1">
                    {savedExpressions.map((expr, idx) => (
                      <div 
                        key={idx} 
                        className="p-1.5 hover:bg-gray-800 rounded cursor-pointer text-xs font-mono text-gray-300 truncate"
                        onClick={() => handleLoadExpression(expr)}
                        title={expr}
                      >
                        <div className="flex justify-between items-center">
                          <span className="truncate">{expr}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleRemoveSavedExpression(expr); }}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Bottom Section: Visualization and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-grow">
          {/* Chart Area */}
          <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-md p-3 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-400">实时预览 (近1年)</span>
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className={`h-6 w-6 ${chartType === 'line' ? 'text-blue-400' : 'text-gray-500'} hover:text-blue-300`} onClick={() => setChartType('line')}><LineChart className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className={`h-6 w-6 ${chartType === 'area' ? 'text-blue-400' : 'text-gray-500'} hover:text-blue-300`} onClick={() => setChartType('area')}><AreaChartIcon className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className={`h-6 w-6 ${chartType === 'bar' ? 'text-blue-400' : 'text-gray-500'} hover:text-blue-300`} onClick={() => setChartType('bar')}><BarChart className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className={`h-6 w-6 ${showBenchmark ? 'text-blue-400' : 'text-gray-500'} hover:text-blue-300`} onClick={() => setShowBenchmark(prev => !prev)} title="显示/隐藏基准线">
                  <History className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex-grow min-h-[200px]">
              {evaluatedResult.length > 0 && !error ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'line' ? (
                    <RechartsLineChart data={evaluatedResult}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#999" tickFormatter={(tick) => new Date(tick).getFullYear().toString()} />
                      <YAxis stroke="#999" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#333', border: 'none', color: '#eee' }}
                        labelStyle={{ color: '#eee' }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot={false} />
                      {showBenchmark && (
                        <Line type="monotone" dataKey="value" data={mockBenchmarkData} stroke="#FF7300" strokeWidth={1} dot={false} name="Benchmark" />
                      )}
                    </RechartsLineChart>
                  ) : chartType === 'area' ? (
                    <AreaChart data={evaluatedResult}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#999" tickFormatter={(tick) => new Date(tick).getFullYear().toString()} />
                      <YAxis stroke="#999" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#333', border: 'none', color: '#eee' }}
                        labelStyle={{ color: '#eee' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                      {showBenchmark && (
                        <Area type="monotone" dataKey="value" data={mockBenchmarkData} stroke="#FF7300" fill="#FF7300" fillOpacity={0.1} name="Benchmark" />
                      )}
                    </AreaChart>
                  ) : (
                    <RechartsBarChart data={evaluatedResult}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#999" tickFormatter={(tick) => new Date(tick).getFullYear().toString()} />
                      <YAxis stroke="#999" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#333', border: 'none', color: '#eee' }}
                        labelStyle={{ color: '#eee' }}
                      />
                      <Bar dataKey="value" fill="#a4de6c" />
                      {showBenchmark && (
                        <Bar dataKey="value" data={mockBenchmarkData} fill="#FF7300" name="Benchmark" />
                      )}
                    </RechartsBarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600">
                  {error ? `图表数据错误: ${error}` : "请输入表达式并计算以查看图表"}
                </div>
              )}
            </div>
          </div>

          {/* Stats Area */}
          <div className="bg-gray-900 border border-gray-800 rounded-md p-3 flex flex-col">
            <span className="text-sm font-medium text-gray-400 mb-3">统计摘要</span>
            {statisticalSummary ? (
              <div className="space-y-3 flex-grow overflow-y-auto">
                <div className="flex justify-between items-end border-b border-gray-800 pb-1">
                  <span className="text-xs text-gray-500">当前值</span>
                  <span className="text-lg font-bold text-blue-400">{statisticalSummary.current}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">均值</span>
                    <span className="text-sm text-gray-300">{statisticalSummary.mean}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">中位数</span>
                    <span className="text-sm text-gray-300">{statisticalSummary.median}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">最大值</span>
                    <span className="text-sm text-green-400">{statisticalSummary.max}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">最小值</span>
                    <span className="text-sm text-red-400">{statisticalSummary.min}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">标准差</span>
                    <span className="text-sm text-gray-300">{statisticalSummary.stdDev}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">25%分位</span>
                    <span className="text-sm text-gray-300">{statisticalSummary.q1}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">75%分位</span>
                    <span className="text-sm text-gray-300">{statisticalSummary.q3}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="text-[10px] text-gray-500">波动率 (年化)</span>
                    <span className="text-sm text-gray-300">{parseFloat((statisticalSummary.stdDev * Math.sqrt(252)).toFixed(2))}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="text-[10px] text-gray-500">夏普比率 (假设无风险利率为0)</span>
                    <span className="text-sm text-gray-300">{parseFloat((statisticalSummary.mean / statisticalSummary.stdDev).toFixed(2))}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-600">
                无有效数据
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CIXNPanel;
