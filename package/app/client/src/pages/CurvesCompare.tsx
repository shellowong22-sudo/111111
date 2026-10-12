import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface CurveComparison {
  curveId: string;
  name: string;
  country: string;
  type: string;
  currentValue: number | null;
  change: number | null;
  changePercent: number | null;
  volatility: number | null;
  correlation: number | null;
}

const CURVE_DEFINITIONS: CurveComparison[] = [
  {
    curveId: '1',
    name: '美国政府债券曲线',
    country: '美国',
    type: '政府债券',
    currentValue: null, change: null, changePercent: null, volatility: null, correlation: null,
  },
  {
    curveId: '2',
    name: '德国政府债券曲线',
    country: '德国',
    type: '政府债券',
    currentValue: null, change: null, changePercent: null, volatility: null, correlation: null,
  },
  {
    curveId: '3',
    name: '日本政府债券曲线',
    country: '日本',
    type: '政府债券',
    currentValue: null, change: null, changePercent: null, volatility: null, correlation: null,
  },
];

const display = (value: number | null) => value === null ? '—' : value.toFixed(2);

export default function CurvesCompare() {
  const [selectedCurves, setSelectedCurves] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('curve-comparison-selection') ?? 'null');
      if (Array.isArray(saved)) return saved.filter(id => ['1', '2', '3'].includes(id));
    } catch { /* Retain defaults when browser storage is unavailable. */ }
    return ['1', '2', '3'];
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const archive = trpc.freeMarketData.archivedPublicDatasetsForPath.useQuery({ path: '/curves-compare' }, { refetchInterval: 60_000, retry: 2 });
  const history = (archive.data?.[0]?.dataset.rows ?? []).flatMap(row => typeof row['2 年期收益率'] === 'number' ? [{ date: String(row['观察期']), value: row['2 年期收益率'] }] : []);
  const current = history.at(-1)?.value ?? null;
  const prior = history.at(-2)?.value ?? null;
  const change = current !== null && prior !== null ? current - prior : null;
  const curves = CURVE_DEFINITIONS.map(curve => curve.curveId === '1' ? { ...curve, currentValue: current, change, changePercent: change !== null && prior ? change / Math.abs(prior) * 100 : null } : curve);
  const comparison = ['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '30Y'].map(period => ({ period, US: period === '2Y' && selectedCurves.includes('1') ? current : null, Germany: null, Japan: null }));
  const exportReport = () => {
    const csv = ['country,tenor,date,yield_percent', ...(selectedCurves.includes('1') ? history.map(row => `US,2Y,${row.date},${row.value}`) : [])].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'curve-comparison.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCurveToggle = (curveId: string) => {
    setSelectedCurves(prev =>
      prev.includes(curveId)
        ? prev.filter(id => id !== curveId)
        : [...prev, curveId]
    );
  };

  const filteredCurves = curves.filter(c => selectedCurves.includes(c.curveId));

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">曲线对比分析</h1>
        <p className="text-muted-foreground">
          对比多条收益率曲线的表现、相关性和点差
        </p>
      </div>

      {/* 曲线选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择对比曲线</CardTitle>
          <CardDescription>选择 2-5 条曲线进行对比分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {curves.map(curve => (
              <div
                key={curve.curveId}
                onClick={() => handleCurveToggle(curve.curveId)}
                className={`p-4 border rounded-lg cursor-pointer transition ${
                  selectedCurves.includes(curve.curveId)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{curve.name}</p>
                    <p className="text-sm text-muted-foreground">{curve.country}</p>
                  </div>
                  <Badge variant={selectedCurves.includes(curve.curveId) ? 'default' : 'outline'}>
                    {selectedCurves.includes(curve.curveId) ? '已选' : '未选'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 对比数据表格 */}
      <Card>
        <CardHeader>
          <CardTitle>对比指标</CardTitle>
          <CardDescription>已选曲线的关键指标对比</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>曲线名称</TableHead>
                  <TableHead className="text-right">当前值</TableHead>
                  <TableHead className="text-right">变动</TableHead>
                  <TableHead className="text-right">变动率</TableHead>
                  <TableHead className="text-right">波动率</TableHead>
                  <TableHead className="text-right">相关性</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCurves.map(curve => (
                  <TableRow key={curve.curveId}>
                    <TableCell className="font-medium"><button onClick={() => setHistoryOpen(open => !open)} disabled={curve.curveId !== '1' || !history.length}>{curve.name}</button>{curve.curveId === '1' && <p className="text-xs text-muted-foreground">2Y · {history.at(-1)?.date ?? '未接入'}</p>}</TableCell>
                    <TableCell className="text-right">{display(curve.currentValue)}{curve.currentValue !== null ? '%' : ''}</TableCell>
                    <TableCell className={`text-right ${(curve.change ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {display(curve.change)}
                    </TableCell>
                    <TableCell className={`text-right ${(curve.changePercent ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {display(curve.changePercent)}{curve.changePercent !== null ? '%' : ''}
                    </TableCell>
                    <TableCell className="text-right">{display(curve.volatility)}</TableCell>
                    <TableCell className="text-right">{display(curve.correlation)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {historyOpen && <div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-sm"><thead><tr><th>观察期</th><th>美国 2Y 收益率 (%)</th></tr></thead><tbody>{history.slice().reverse().map(row => <tr key={row.date}><td>{row.date}</td><td>{row.value.toFixed(2)}</td></tr>)}</tbody></table></div>}
            {archive.isError && <p role="alert">历史读取失败，等待重试</p>}
          </div>
        </CardContent>
      </Card>

      {/* 图表分析 */}
      <Tabs defaultValue="yields" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="yields">收益率对比</TabsTrigger>
          <TabsTrigger value="spreads">点差分析</TabsTrigger>
          <TabsTrigger value="correlation">相关性矩阵</TabsTrigger>
        </TabsList>

        <TabsContent value="yields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>收益率曲线对比</CardTitle>
              <CardDescription>不同期限的收益率对比</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="US" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="Germany" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="Japan" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spreads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>点差分析</CardTitle>
              <CardDescription>曲线之间的收益率点差</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">尚未接入同一观察期、相同期限的跨国收益率，暂无法计算点差。</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={[]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="US-DE" fill="#3b82f6" />
                  <Bar dataKey="US-JP" fill="#10b981" />
                  <Bar dataKey="DE-JP" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>相关性矩阵</CardTitle>
              <CardDescription>曲线之间的相关性分析</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">尚未接入可按日期对齐的跨国历史序列，暂无法计算相关性。</p>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">US-DE</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">US-JP</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">DE-JP</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">平均</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <Button variant="outline" className="flex-1" onClick={exportReport} disabled={!history.length || !selectedCurves.includes('1')}>
          导出对比报告
        </Button>
        <Button className="flex-1" onClick={() => { try { localStorage.setItem('curve-comparison-selection', JSON.stringify(selectedCurves)); toast.success('对比方案已保存'); } catch { toast.error('浏览器存储不可用，方案未保存'); } }}>
          保存对比方案
        </Button>
      </div>
    </div>
  );
}
