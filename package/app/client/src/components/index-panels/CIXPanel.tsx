
import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AreaChart as RechartsAreaChart, 
  BarChart as RechartsBarChart, 
  ScatterChart as RechartsScatterChart, 
  RadarChart as RechartsRadarChart, 
  ComposedChart as RechartsComposedChart, 
  PieChart as RechartsPieChart, 
  LineChart as RechartsLineChart, 
  Area, Bar, Scatter, Radar, Line, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Search, Filter, Plus, ChevronDown, TrendingUp, 
  PieChart, BarChart, LineChart, 
  Settings, Trash2, Edit, Play, Pause, AlertCircle 
} from 'lucide-react';

interface IndexData {
  id: string;
  name: string;
  code: string;
  type: '股票' | '债券' | '混合';
  components: number;
  createdDate: string;
  latestValue: number;
  ytdReturn: number;
  sharpeRatio: number;
  status: '活跃' | '暂停' | '草稿';
}

interface IndexDetail {
  id: string;
  netValueHistory: { date: string; value: number }[];
  componentWeights: { name: string; weight: number }[];
  performanceAttribution: { factor: string; contribution: number }[];
  riskMetrics: { metric: string; value: number }[];
}

interface BacktestResult {
  id: string;
  name: string;
  netValueHistory: { date: string; value: number }[];
}

interface RiskAnalysisData {
  id: string;
  name: string;
  volatility: number;
  maxDrawdown: number;
  var: number;
  return: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  action: '创建' | '修改' | '删除';
  indexName: string;
}

const generateMockData = () => {
  const indices: IndexData[] = Array.from({ length: 15 }).map((_, i) => {
    const id = `idx-${i + 1}`;
    const typeOptions = ['股票', '债券', '混合'];
    const statusOptions = ['活跃', '暂停', '草稿'];
    const latestValue = parseFloat((1000 + Math.random() * 500).toFixed(2));
    const ytdReturn = parseFloat(((Math.random() * 0.4) - 0.2).toFixed(4));
    const sharpeRatio = parseFloat((Math.random() * 2).toFixed(2));

    return {
      id,
      name: `自设指数 ${i + 1}`,
      code: `CSI${1000 + i}`,
      type: typeOptions[Math.floor(Math.random() * typeOptions.length)] as any,
      components: Math.floor(Math.random() * 100) + 10,
      createdDate: `202${Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      latestValue,
      ytdReturn,
      sharpeRatio,
      status: statusOptions[Math.floor(Math.random() * statusOptions.length)] as any,
    };
  });

  const indexDetails: { [key: string]: IndexDetail } = {};
  indices.forEach(idx => {
    const netValueHistory = Array.from({ length: 30 }).map((_, j) => ({
      date: `2026-06-${String(j + 1).padStart(2, '0')}`,
      value: parseFloat((100 + Math.random() * 20 * (j / 30)).toFixed(2)),
    }));
    const componentWeights = Array.from({ length: Math.floor(Math.random() * 5) + 3 }).map((_, k) => ({
      name: `成分 ${k + 1}`,
      weight: parseFloat((Math.random() * 0.3).toFixed(2)),
    }));
    const totalWeight = componentWeights.reduce((sum, c) => sum + c.weight, 0);
    componentWeights.forEach(c => c.weight = parseFloat((c.weight / totalWeight).toFixed(2)));

    const performanceAttribution = [
      { factor: '行业轮动', contribution: parseFloat(((Math.random() * 0.1) - 0.05).toFixed(4)) },
      { factor: '风格因子', contribution: parseFloat(((Math.random() * 0.1) - 0.05).toFixed(4)) },
      { factor: '个股选择', contribution: parseFloat(((Math.random() * 0.1) - 0.05).toFixed(4)) },
      { factor: '现金管理', contribution: parseFloat(((Math.random() * 0.02) - 0.01).toFixed(4)) },
    ];

    const riskMetrics = [
      { metric: '波动率', value: parseFloat((Math.random() * 0.2).toFixed(4)) },
      { metric: '最大回撤', value: parseFloat((Math.random() * 0.3).toFixed(4)) },
      { metric: 'VaR (99%)', value: parseFloat((Math.random() * 0.05).toFixed(4)) },
    ];

    indexDetails[idx.id] = {
      id: idx.id,
      netValueHistory,
      componentWeights,
      performanceAttribution,
      riskMetrics,
    };
  });

  const backtestResults: BacktestResult[] = indices.slice(0, 5).map(idx => ({
    id: idx.id,
    name: idx.name,
    netValueHistory: Array.from({ length: 60 }).map((_, j) => ({
      date: `2026-05-${String(j + 1).padStart(2, '0')}`,
      value: parseFloat((100 + Math.random() * 30 * (j / 60)).toFixed(2)),
    })),
  }));

  const riskAnalysisData: RiskAnalysisData[] = indices.map(idx => ({
    id: idx.id,
    name: idx.name,
    volatility: parseFloat((Math.random() * 0.3).toFixed(4)),
    maxDrawdown: parseFloat((Math.random() * 0.4).toFixed(4)),
    var: parseFloat((Math.random() * 0.08).toFixed(4)),
    return: parseFloat(((Math.random() * 0.5) - 0.25).toFixed(4)),
  }));

  const logs: LogEntry[] = Array.from({ length: 20 }).map((_, i) => {
    const actionOptions = ['创建', '修改', '删除'];
    const randomIdx = indices[Math.floor(Math.random() * indices.length)];
    return {
      id: `log-${i + 1}`,
      timestamp: `2026-07-${String(Math.floor(Math.random() * 3) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      action: actionOptions[Math.floor(Math.random() * actionOptions.length)] as any,
      indexName: randomIdx.name,
    };
  });

  return { indices, indexDetails, backtestResults, riskAnalysisData, logs };
};

const CIXPanel: React.FC = () => {
  const { indices, indexDetails, backtestResults, riskAnalysisData, logs } = useMemo(generateMockData, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('所有');
  const [filterStatus, setFilterStatus] = useState('所有');
  const [sortKey, setSortKey] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(indices[0]?.id || null);
  const [activeTab, setActiveTab] = useState('list');

  const filteredAndSortedIndices = useMemo(() => {
    let filtered = indices.filter(idx =>
      idx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      idx.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterType !== '所有') {
      filtered = filtered.filter(idx => idx.type === filterType);
    }
    if (filterStatus !== '所有') {
      filtered = filtered.filter(idx => idx.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      let valA: any = a[sortKey as keyof IndexData];
      let valB: any = b[sortKey as keyof IndexData];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [indices, searchTerm, filterType, filterStatus, sortKey, sortOrder]);

  const selectedIndexDetail = useMemo(() => {
    return selectedIndexId ? indexDetails[selectedIndexId] : null;
  }, [selectedIndexId, indexDetails]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  }, [sortKey]);

  const COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#B8860B', '#DAA520', '#EEE8AA', '#BDB76B', '#F0E68C'];

  return (
    <div className="p-4 bg-gray-950 text-gray-100 min-h-screen font-mono">
      <Card className="bg-gray-900 border-gray-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-2xl font-bold text-yellow-400">自设指数库管理</CardTitle>
          <Button variant="ghost" className="text-yellow-400 hover:text-yellow-300 hover:bg-gray-800">
            <Plus className="mr-2 h-4 w-4" /> 创建新指数
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-gray-800 p-1 rounded-md">
              <TabsTrigger value="list" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-gray-950 text-gray-300 hover:text-yellow-300">指数列表</TabsTrigger>
              <TabsTrigger value="detail" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-gray-950 text-gray-300 hover:text-yellow-300" disabled={!selectedIndexId}>指数详情</TabsTrigger>
              <TabsTrigger value="create" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-gray-950 text-gray-300 hover:text-yellow-300">快速创建</TabsTrigger>
              <TabsTrigger value="backtest" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-gray-950 text-gray-300 hover:text-yellow-300">回测对比</TabsTrigger>
              <TabsTrigger value="risk" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-gray-950 text-gray-300 hover:text-yellow-300">风险分析</TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-gray-950 text-gray-300 hover:text-yellow-300">操作日志</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索指数名称或代码..."
                    className="pl-8 bg-gray-800 border-gray-700 text-gray-100 focus:ring-yellow-500 focus:border-yellow-500"
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-100">
                    <Filter className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder="筛选类型" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                    <SelectItem value="所有">所有类型</SelectItem>
                    <SelectItem value="股票">股票</SelectItem>
                    <SelectItem value="债券">债券</SelectItem>
                    <SelectItem value="混合">混合</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-100">
                    <Filter className="mr-2 h-4 w-4 text-gray-400" />
                    <SelectValue placeholder="筛选状态" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                    <SelectItem value="所有">所有状态</SelectItem>
                    <SelectItem value="活跃">活跃</SelectItem>
                    <SelectItem value="暂停">暂停</SelectItem>
                    <SelectItem value="草稿">草稿</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('name')}>名称 {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('code')}>代码 {sortKey === 'code' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('type')}>类型 {sortKey === 'type' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('components')}>成分数 {sortKey === 'components' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('createdDate')}>创建日期 {sortKey === 'createdDate' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('latestValue')}>最新值 {sortKey === 'latestValue' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('ytdReturn')}>YTD回报 {sortKey === 'ytdReturn' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('sharpeRatio')}>夏普比率 {sortKey === 'sharpeRatio' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4 cursor-pointer" onClick={() => handleSort('status')}>状态 {sortKey === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                      <th className="py-2 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedIndices.map(idx => (
                      <tr key={idx.id} className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer"
                          onClick={() => { setSelectedIndexId(idx.id); setActiveTab('detail'); }}>
                        <td className="py-2 px-4 font-medium text-yellow-400">{idx.name}</td>
                        <td className="py-2 px-4 text-gray-300">{idx.code}</td>
                        <td className="py-2 px-4"><Badge variant="outline" className="border-yellow-600 text-yellow-600">{idx.type}</Badge></td>
                        <td className="py-2 px-4 text-gray-300">{idx.components}</td>
                        <td className="py-2 px-4 text-gray-300">{idx.createdDate}</td>
                        <td className="py-2 px-4 text-gray-300">{idx.latestValue.toFixed(2)}</td>
                        <td className={`py-2 px-4 ${idx.ytdReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>{`${(idx.ytdReturn * 100).toFixed(2)}%`}</td>
                        <td className="py-2 px-4 text-gray-300">{idx.sharpeRatio.toFixed(2)}</td>
                        <td className="py-2 px-4">
                          <Badge className={{
                            '活跃': 'bg-green-600 hover:bg-green-500',
                            '暂停': 'bg-orange-600 hover:bg-orange-500',
                            '草稿': 'bg-blue-600 hover:bg-blue-500',
                          }[idx.status] || 'bg-gray-600'}>
                            {idx.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-4">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-yellow-400"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="detail" className="mt-4">
              {selectedIndexDetail ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-yellow-400">净值曲线</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={selectedIndexDetail.netValueHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
                          <XAxis dataKey="date" stroke="#999" tickFormatter={(tick) => tick.slice(5)} />
                          <YAxis stroke="#999" domain={['auto', 'auto']} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }}
                            labelStyle={{ color: '#FFD700' }}
                            formatter={(value: any) => [value !== undefined ? value.toFixed(2) : '', '净值']}
                          />
                          <Line type="monotone" dataKey="value" stroke="#FFD700" strokeWidth={2} dot={false} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-yellow-400">成分权重饼图</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={selectedIndexDetail.componentWeights}
                            dataKey="weight"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#8884d8"
                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          >
                            {selectedIndexDetail.componentWeights.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }}
                            labelStyle={{ color: '#FFD700' }}
                            formatter={(value: any, name: any) => [value !== undefined ? `${(value * 100).toFixed(2)}%` : '', String(name)]}
                          />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
                    <CardHeader><CardTitle className="text-yellow-400">绩效归因与风险指标</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-2">绩效归因</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <RechartsBarChart data={selectedIndexDetail.performanceAttribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
                            <XAxis dataKey="factor" stroke="#999" />
                            <YAxis stroke="#999" tickFormatter={(value) => `${(value * 100).toFixed(1)}%`} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }}
                              labelStyle={{ color: '#FFD700' }}
                              formatter={(value: any) => [value !== undefined ? `${(value * 100).toFixed(2)}%` : '', '贡献']}
                            />
                            <Bar dataKey="contribution" fill="#FFD700" />
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-2">风险指标</h3>
                        <div className="space-y-2">
                          {selectedIndexDetail.riskMetrics.map((metric, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-700 p-2 rounded-md">
                              <span className="text-gray-300">{metric.metric}</span>
                              <Badge className="bg-yellow-600 hover:bg-yellow-500 text-gray-950">{`${(metric.value * 100).toFixed(2)}%`}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <AlertCircle className="mx-auto h-12 w-12 mb-4 text-yellow-500" />
                  <p>请从指数列表中选择一个指数查看详情。</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader><CardTitle className="text-yellow-400">快速创建向导</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-gray-300">
                    <p className="mb-2">这是一个三步骤的创建向导：</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>选择成分</li>
                      <li>设置权重</li>
                      <li>命名保存</li>
                    </ol>
                    <Button className="mt-4 bg-yellow-600 hover:bg-yellow-500 text-gray-950">
                      <Play className="mr-2 h-4 w-4" /> 开始创建
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backtest" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader><CardTitle className="text-yellow-400">回测结果对比图</CardTitle></CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={backtestResults[0]?.netValueHistory.map((entry, i) => ({
                      date: entry.date,
                      ...Object.fromEntries(backtestResults.map(res => [res.name, res.netValueHistory[i]?.value]))
                    })) || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
                      <XAxis dataKey="date" stroke="#999" tickFormatter={(tick) => tick.slice(5)} />
                      <YAxis stroke="#999" domain={['auto', 'auto']} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }}
                        labelStyle={{ color: '#FFD700' }}
                        formatter={(value: any, name: any) => [value !== undefined ? value.toFixed(2) : '', String(name)]}
                      />
                      <Legend />
                      {backtestResults.map((res, i) => (
                        <Line key={res.id} type="monotone" dataKey={res.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                      ))}
                      <Line type="monotone" dataKey="基准" stroke="#8884d8" strokeWidth={2} dot={false} /> {/* Example for a benchmark */}
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader><CardTitle className="text-yellow-400">风险分析</CardTitle></CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
                      <XAxis type="number" dataKey="return" name="回报" unit="%" stroke="#999" tickFormatter={(value) => `${(value * 100).toFixed(1)}`} />
                      <YAxis type="number" dataKey="volatility" name="波动率" unit="%" stroke="#999" tickFormatter={(value) => `${(value * 100).toFixed(1)}`} />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: '#333', border: '1px solid #555', color: '#eee' }}
                        labelStyle={{ color: '#FFD700' }}
                        formatter={(value: any, name: any, props: any) => {
                          const formattedValue = value !== undefined ? (value * 100).toFixed(2) : '';
                          const displayValue = value !== undefined ? value.toFixed(2) : '';
                          if (name === '回报') return [`${formattedValue}%`, String(name)];
                          if (name === '波动率') return [`${formattedValue}%`, String(name)];
                          return [displayValue, String(name)];
                        }}
                      />
                      <Legend />
                      <Scatter name="自设指数风险" data={riskAnalysisData} fill="#FFD700" />
                    </RechartsScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader><CardTitle className="text-yellow-400">操作日志</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-y-auto h-[300px]">
                    <ul className="space-y-2">
                      {logs.map(log => (
                        <li key={log.id} className="flex items-center space-x-2 text-gray-300">
                          <Badge className="bg-gray-700 text-gray-100">{log.timestamp}</Badge>
                          <Badge className={{
                            '创建': 'bg-green-700 hover:bg-green-600',
                            '修改': 'bg-blue-700 hover:bg-blue-600',
                            '删除': 'bg-red-700 hover:bg-red-600',
                          }[log.action] || 'bg-gray-700'}>
                            {log.action}
                          </Badge>
                          <span>{log.indexName}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CIXPanel;
