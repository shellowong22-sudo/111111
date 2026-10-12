import { useState, useMemo } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Treemap } from 'recharts';
import { trpc } from '@/lib/trpc';
import { ArrowUp, ArrowDown, TrendingUp, BarChart3, PieChart as PieChartIcon, Download, Star, StarOff, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, fill, size } = props;
  if (!width || !height || width < 20 || height < 20) return <g />;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={fill} fillOpacity={0.75} rx={4} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={Math.min(13, width / 6)} fontWeight="600">{name}</text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize={Math.min(11, width / 7)}>{size}%</text>
        </>
      )}
    </g>
  );
}

export default function ETFDetail() {
  const [, params] = useRoute('/etf-detail/:etfId');
  const etfId = params?.etfId || '';
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('3M');
  const [isFavorite, setIsFavorite] = useState(false);

  const { data: etfData, isLoading, error: etfError, refetch } = trpc.etf.getDetail.useQuery(
    { id: etfId },
    { enabled: !!etfId }
  );

  // Parse numeric ETF id for holdings query
  const numericEtfId = useMemo(() => {
    if (!etfData) return null;
    return etfData.id;
  }, [etfData]);

  const { data: holdingsData, isLoading: holdingsLoading, error: holdingsError } = trpc.etf.getHoldings.useQuery(
    { etfId: numericEtfId! },
    { enabled: numericEtfId !== null }
  );

  const historyRange = timeRange === '1M' ? '1mo' : timeRange === '3M' ? '3mo' : timeRange === '6M' ? '6mo' : timeRange === '1Y' ? '1y' : '5y';
  const { data: historyData, isLoading: historyLoading } = trpc.market.getHistory.useQuery(
    { symbol: etfData?.symbol ?? etfId, range: historyRange },
    { enabled: !!etfData?.symbol || !!etfId, staleTime: 300000 }
  );

  const priceHistory = useMemo(() => (historyData?.history ?? []).map(point => ({
    date: point.date,
    nav: point.close ?? point.value,
    open: point.open,
    high: point.high,
    low: point.low,
  })), [historyData]);

  // Only show holdings returned by the backend; never substitute an asset-class
  // example portfolio for a missing ETF disclosure.
  const holdings = useMemo(() => {
    if (holdingsData && holdingsData.length > 0) {
      const totalWeight = holdingsData.reduce((s, h) => s + h.weight, 0) || 100;
      return holdingsData.map(h => ({
        name: h.name,
        weight: h.weight,
        value: h.weight,
        size: parseFloat((h.weight / totalWeight * 100).toFixed(2)),
      }));
    }
    return [];
  }, [holdingsData]);

  const volumeData = useMemo(() => (historyData?.history ?? [])
    .filter(point => point.volume != null)
    .map(point => ({ date: point.date, volume: point.volume as number })), [historyData]);

  const handleExportReport = () => {
    if (!etfData) return;
    const csv = ['\uFEFF指标,数值', `名称,${etfData.name}`, `代码,${etfData.symbol}`, `净值,${etfData.nav || etfData.price}`, `涨跌幅,${etfData.changePct}%`, `类型,${etfData.fundType || '-'}`, `资产,${etfData.assetClass || '-'}`, `地区,${etfData.region || '-'}`, `评级,${etfData.rating || '-'}`].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${etfData.symbol}-report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('报告已导出');
  };

  if (isLoading) {
    return (<div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-blue-400" /><span className="ml-3">加载中...</span></div>);
  }
  if (!etfData) {
    return (<div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center flex-col gap-4"><p className="text-xl text-gray-400">未找到 ETF: {etfId}</p><Button onClick={() => window.history.back()}>返回</Button></div>);
  }

  const changePct = parseFloat(etfData.changePct || '0');
  const isUp = changePct >= 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{etfData.name}</h1>
            <Badge variant="outline" className="text-xs">{etfData.symbol}</Badge>
            {etfData.rating && <Badge className="bg-green-500/20 text-green-400">{etfData.rating}</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span>类型: {etfData.fundType || '-'}</span>
            <span>资产: {etfData.assetClass || '-'}</span>
            <span>地区: {etfData.region || '-'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setIsFavorite(!isFavorite); toast.success(isFavorite ? '已取消收藏' : '已收藏'); }}>
            {isFavorite ? <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-gray-900 border-gray-800"><CardContent className="p-3"><p className="text-xs text-gray-400">净值</p><p className="text-xl font-bold">{etfData.nav || etfData.price || '-'}</p></CardContent></Card>
        <Card className="bg-gray-900 border-gray-800"><CardContent className="p-3"><p className="text-xs text-gray-400">涨跌幅</p><p className={`text-xl font-bold flex items-center ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}{etfData.changePct}%</p></CardContent></Card>
        <Card className="bg-gray-900 border-gray-800"><CardContent className="p-3"><p className="text-xs text-gray-400">涨跌额</p><p className={`text-xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{etfData.changeVal}</p></CardContent></Card>
        <Card className="bg-gray-900 border-gray-800"><CardContent className="p-3"><p className="text-xs text-gray-400">成交量</p><p className="text-xl font-bold">{parseInt(etfData.volume || '0').toLocaleString()}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="chart"><TrendingUp className="w-3 h-3 mr-1" />走势</TabsTrigger>
          <TabsTrigger value="holdings"><PieChartIcon className="w-3 h-3 mr-1" />持仓</TabsTrigger>
          <TabsTrigger value="volume"><BarChart3 className="w-3 h-3 mr-1" />成交</TabsTrigger>
          <TabsTrigger value="info"><Info className="w-3 h-3 mr-1" />信息</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">净值走势</CardTitle>
                <div className="flex gap-1">
                  {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(r => (
                    <Button key={r} size="sm" variant={timeRange === r ? 'default' : 'ghost'} className="h-6 text-xs px-2" onClick={() => setTimeRange(r)}>{r}</Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">正在读取真实历史数据…</div> : priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="nav" name="真实历史价格" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-[300px] flex items-center justify-center text-sm text-amber-300">当前没有可核验的 ETF 历史价格，未生成替代曲线。</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdings">
          <div className="space-y-4">
            {holdingsError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
                <span>⚠️ 持仓数据加载失败：{holdingsError.message || '请稍后重试'}</span>
              </div>
            )}
            {holdingsLoading && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 text-gray-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>正在加载真实持仓数据...</span>
              </div>
            )}
            {!holdingsLoading && !holdingsError && holdingsData && holdingsData.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-900/20 border border-green-800/50 text-green-400 text-xs">
                <span>✓ 已加载 {holdingsData.length} 条真实持仓数据</span>
              </div>
            )}
            {holdings.length > 0 ? <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader><CardTitle className="text-sm">持仓权重饼图</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={holdings}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={95}
                        dataKey="weight"
                        paddingAngle={2}
                        label={({ name, weight }) => `${name} ${weight}%`}
                        labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
                      >
                        {holdings.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#111827" strokeWidth={1} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, name: string) => [`${v}%`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader><CardTitle className="text-sm">持仓明细</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow className="border-gray-800"><TableHead className="text-gray-400">资产</TableHead><TableHead className="text-gray-400 text-right">权重</TableHead><TableHead className="text-gray-400 text-right">市值(万)</TableHead></TableRow></TableHeader>
                    <TableBody>{holdings.map((h, i) => (
                      <TableRow key={i} className="border-gray-800 hover:bg-gray-800">
                        <TableCell className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-sm">{h.name}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${h.weight}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="text-xs font-mono">{h.weight}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{h.value.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div> : !holdingsLoading && !holdingsError && <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-300">当前没有该 ETF 的真实持仓披露，未使用示例成分替代。</div>}
            {holdings.length > 0 && <Card className="bg-gray-900 border-gray-800">
              <CardHeader><CardTitle className="text-sm">行业分布热力图</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <Treemap
                    data={holdings.map((h, i) => ({ name: h.name, size: h.size, fill: COLORS[i % COLORS.length] }))}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    content={<CustomTreemapContent />}
                  />
                </ResponsiveContainer>
                <p className="text-gray-500 text-xs mt-2 text-center">方块大小代表持仓权重占比，颜色与饼图一致</p>
              </CardContent>
            </Card>}
          </div>
        </TabsContent>

        <TabsContent value="volume">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader><CardTitle className="text-sm">近30日成交量</CardTitle></CardHeader>
            <CardContent>
              {volumeData.length > 0 ? <ResponsiveContainer width="100%" height={300}>
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Bar dataKey="volume" name="真实成交量" fill="#3b82f680" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <div className="h-[300px] flex items-center justify-center text-sm text-amber-300">历史源未返回成交量，未生成替代数据。</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader><CardTitle className="text-sm">基本信息</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[['基金代码', etfData.symbol], ['基金名称', etfData.name], ['英文名称', etfData.nameEn || '-'], ['基金类型', etfData.fundType || '-'], ['资产类别', etfData.assetClass || '-'], ['投资地区', etfData.region || '-'], ['信用评级', etfData.rating || '-'], ['更新时间', etfData.updatedAt ? new Date(etfData.updatedAt).toLocaleString('zh-CN') : '-']].map(([label, val]) => (
                  <div key={label} className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-400">{label}</span><span>{val}</span></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleExportReport}><Download className="w-4 h-4 mr-2" />导出报告</Button>
        <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>返回列表</Button>
      </div>
    </div>
  );
}
