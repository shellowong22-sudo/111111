import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Line, Area, BarChart, Bar, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, Layers } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface TechnicalAnalysisPanelProps {
  title: string;
}

export default function TechnicalAnalysisPanel({ title }: TechnicalAnalysisPanelProps) {
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1D');
  const [showSMA, setShowSMA] = useState({ sma5: true, sma10: true, sma20: true, sma60: false });

  // The equity endpoint currently serves verified daily OHLCV observations.
  // Keep the existing range selector, but do not present unsupported intraday
  // intervals as if minute/hour candles were available.
  const days = timeframe === '365D' ? 365 : timeframe === '90D' ? 90 : 180;
  const candlesQuery = trpc.equity.getCandlestickData.useQuery(
    { symbol, days },
    { refetchInterval: 60_000 }
  );
  const chartData = useMemo(
    () =>
      (candlesQuery.data?.candles ?? []).map((candle, index) => ({
        date: candle.date.slice(5),
        open: candle.open,
        close: candle.close,
        high: candle.high,
        low: candle.low,
        volume: candle.volume ?? 0,
        sma5: candlesQuery.data?.ma5[index]?.value ?? null,
        sma10: index >= 9
          ? Math.round((candlesQuery.data?.candles.slice(index - 9, index + 1).reduce((sum, item) => sum + item.close, 0) ?? 0) * 10) / 100
          : null,
        sma20: candlesQuery.data?.ma20[index]?.value ?? null,
        sma60: candlesQuery.data?.ma60[index]?.value ?? null,
        bb_upper: candlesQuery.data?.bollinger[index]?.upper ?? null,
        bb_mid: candlesQuery.data?.bollinger[index]?.middle ?? null,
        bb_lower: candlesQuery.data?.bollinger[index]?.lower ?? null,
        rsi: candlesQuery.data?.rsi[index]?.value ?? null,
        macd: candlesQuery.data?.macd[index]?.macd ?? null,
        signal: candlesQuery.data?.macd[index]?.signal ?? null,
        histogram: candlesQuery.data?.macd[index]?.histogram ?? null,
        isUp: candle.close >= candle.open,
      })),
    [candlesQuery.data]
  );
  const lastPrice = chartData.at(-1);
  const prevPrice = chartData.at(-2);
  const priceChange = lastPrice && prevPrice ? lastPrice.close - prevPrice.close : null;
  const priceChangePct = priceChange !== null && prevPrice ? (priceChange / prevPrice.close) * 100 : null;

  const signals = useMemo(() => {
    const last = chartData.at(-1);
    const bullish: string[] = [];
    const bearish: string[] = [];
    const neutral: string[] = [];

    if (!last) return { bullish, bearish, neutral: ['暂无可验证 OHLCV 数据'] };
    if (last.sma20 === null) neutral.push('MA20 数据不足');
    else if (last.close > last.sma20) bullish.push('价格在MA20上方');
    else bearish.push('价格在MA20下方');

    if (last.sma5 !== null && last.sma20 !== null && last.close > last.sma5 && last.sma5 > last.sma20) bullish.push('短期均线多头排列');
    else if (last.sma5 !== null && last.sma20 !== null && last.close < last.sma5 && last.sma5 < last.sma20) bearish.push('短期均线空头排列');
    else neutral.push('均线交织');

    if (last.rsi === null) neutral.push('RSI 数据不足');
    else if (last.rsi > 70) bearish.push(`RSI超买(${last.rsi.toFixed(0)})`);
    else if (last.rsi < 30) bullish.push(`RSI超卖(${last.rsi.toFixed(0)})`);
    else neutral.push(`RSI中性(${last.rsi.toFixed(0)})`);

    if (last.macd === null || last.signal === null) neutral.push('MACD 数据不足');
    else if (last.macd > last.signal) bullish.push('MACD金叉');
    else bearish.push('MACD死叉');

    if (last.bb_upper === null || last.bb_lower === null) neutral.push('布林带数据不足');
    else if (last.close > last.bb_upper) bearish.push('突破布林带上轨');
    else if (last.close < last.bb_lower) bullish.push('触及布林带下轨');
    else neutral.push('在布林带内运行');

    return { bullish, bearish, neutral };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-1">{label}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">开盘:</span><span className="font-mono">${d.open}</span>
          <span className="text-muted-foreground">收盘:</span><span className={`font-mono ${d.close >= d.open ? 'text-green-500' : 'text-red-500'}`}>${d.close}</span>
          <span className="text-muted-foreground">最高:</span><span className="font-mono">${d.high}</span>
          <span className="text-muted-foreground">最低:</span><span className="font-mono">${d.low}</span>
          <span className="text-muted-foreground">成交量:</span><span className="font-mono">{(d.volume / 1000000).toFixed(1)}M</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">{title}</h1>
            <div className="flex items-center gap-3">
              <span className="text-xl font-mono font-semibold">{symbol}</span>
              <span className="text-2xl font-mono">{lastPrice ? `$${lastPrice.close.toFixed(2)}` : '—'}</span>
              <Badge variant={priceChange === null || priceChange >= 0 ? 'default' : 'destructive'} className={priceChange !== null && priceChange >= 0 ? 'bg-green-600' : ''}>
                {priceChange === null || priceChangePct === null ? '暂无可验证变化' : `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePct.toFixed(2)}%)`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {candlesQuery.isLoading
                ? '正在读取日频行情…'
                : candlesQuery.isError
                  ? '行情读取失败，请稍后重试'
                  : candlesQuery.data?.observedAt
                    ? `日频观察日：${candlesQuery.data.observedAt} · ${candlesQuery.data.freshness}`
                    : '暂无可验证日频行情'}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AAPL">AAPL</SelectItem>
                <SelectItem value="MSFT">MSFT</SelectItem>
                <SelectItem value="GOOGL">GOOGL</SelectItem>
                <SelectItem value="TSLA">TSLA</SelectItem>
                <SelectItem value="NVDA">NVDA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="90D">日线（近90个交易日）</SelectItem>
                <SelectItem value="1D">日线（近180个交易日）</SelectItem>
                <SelectItem value="365D">日线（近365个交易日）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="kline" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="kline">K线+均线</TabsTrigger>
            <TabsTrigger value="bollinger">布林带</TabsTrigger>
            <TabsTrigger value="rsi">RSI</TabsTrigger>
            <TabsTrigger value="macd">MACD</TabsTrigger>
            <TabsTrigger value="volume">成交量</TabsTrigger>
          </TabsList>

          <TabsContent value="kline" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    K线图 + 移动平均线叠加
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant={showSMA.sma5 ? 'default' : 'outline'} onClick={() => setShowSMA(s => ({ ...s, sma5: !s.sma5 }))}>
                      <span className="w-3 h-0.5 bg-yellow-400 mr-1 inline-block"></span>MA5
                    </Button>
                    <Button size="sm" variant={showSMA.sma10 ? 'default' : 'outline'} onClick={() => setShowSMA(s => ({ ...s, sma10: !s.sma10 }))}>
                      <span className="w-3 h-0.5 bg-blue-400 mr-1 inline-block"></span>MA10
                    </Button>
                    <Button size="sm" variant={showSMA.sma20 ? 'default' : 'outline'} onClick={() => setShowSMA(s => ({ ...s, sma20: !s.sma20 }))}>
                      <span className="w-3 h-0.5 bg-purple-400 mr-1 inline-block"></span>MA20
                    </Button>
                    <Button size="sm" variant={showSMA.sma60 ? 'default' : 'outline'} onClick={() => setShowSMA(s => ({ ...s, sma60: !s.sma60 }))}>
                      <span className="w-3 h-0.5 bg-green-400 mr-1 inline-block"></span>MA60
                    </Button>
                  </div>
                </div>
                <CardDescription>K线图叠加多条移动平均线，观察趋势和支撑/阻力位</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={450}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="close" stroke="#e2e8f0" strokeWidth={2} dot={false} name="收盘价" />
                    <Line type="monotone" dataKey="open" stroke="#94a3b8" strokeWidth={1} dot={false} name="开盘价" strokeDasharray="2 2" />
                    {showSMA.sma5 && <Line type="monotone" dataKey="sma5" stroke="#eab308" strokeWidth={1.5} dot={false} name="MA5" />}
                    {showSMA.sma10 && <Line type="monotone" dataKey="sma10" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MA10" />}
                    {showSMA.sma20 && <Line type="monotone" dataKey="sma20" stroke="#a855f7" strokeWidth={1.5} dot={false} name="MA20" />}
                    {showSMA.sma60 && <Line type="monotone" dataKey="sma60" stroke="#22c55e" strokeWidth={1.5} dot={false} name="MA60" />}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bollinger" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>布林带 (Bollinger Bands)</CardTitle>
                <CardDescription>基于20日均线和2倍标准差，显示价格波动通道</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={450}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="bb_upper" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} name="上轨" />
                    <Area type="monotone" dataKey="bb_lower" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} name="下轨" />
                    <Line type="monotone" dataKey="bb_mid" stroke="#64748b" strokeWidth={1} dot={false} name="中轨(MA20)" strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={2} dot={false} name="收盘价" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rsi" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>RSI (相对强弱指数)</CardTitle>
                <CardDescription>衡量价格变动速度和幅度，超过70为超买，低于30为超卖</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '超买 70', fill: '#ef4444', fontSize: 11 }} />
                    <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '超卖 30', fill: '#22c55e', fontSize: 11 }} />
                    <ReferenceLine y={50} stroke="#64748b" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="rsi" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} name="RSI(14)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="macd" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>MACD (移动平均收敛散度)</CardTitle>
                <CardDescription>趋势跟踪动量指标，MACD线穿越信号线时产生交易信号</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={0} stroke="#64748b" />
                    <Bar dataKey="histogram" name="柱状图">
                      {chartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.histogram === null ? '#64748b' : entry.histogram >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="macd" stroke="#ef4444" strokeWidth={2} dot={false} name="MACD" />
                    <Line type="monotone" dataKey="signal" stroke="#3b82f6" strokeWidth={2} dot={false} name="Signal" strokeDasharray="5 5" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="volume" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  成交量分析
                </CardTitle>
                <CardDescription>显示每日成交量变化，红色为下跌日，绿色为上涨日</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                    <Tooltip formatter={(value: any) => `${(value / 1000000).toFixed(2)}M`} />
                    <Bar dataKey="volume" name="成交量">
                      {chartData.map((entry, index) => (
                        <Cell key={`vol-${index}`} fill={entry.isUp ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 交易信号汇总 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              交易信号汇总
            </CardTitle>
            <CardDescription>基于当前技术指标的综合判断</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-700">看涨信号 ({signals.bullish.length})</p>
                </div>
                <ul className="space-y-1">
                  {signals.bullish.map((s, i) => (
                    <li key={i} className="text-sm text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{s}
                    </li>
                  ))}
                  {signals.bullish.length === 0 && <li className="text-sm text-muted-foreground">暂无看涨信号</li>}
                </ul>
              </div>
              <div className="p-4 bg-gray-500/10 rounded-lg border border-gray-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-gray-600" />
                  <p className="font-semibold text-gray-700">中性信号 ({signals.neutral.length})</p>
                </div>
                <ul className="space-y-1">
                  {signals.neutral.map((s, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  <p className="font-semibold text-red-700">看跌信号 ({signals.bearish.length})</p>
                </div>
                <ul className="space-y-1">
                  {signals.bearish.map((s, i) => (
                    <li key={i} className="text-sm text-red-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{s}
                    </li>
                  ))}
                  {signals.bearish.length === 0 && <li className="text-sm text-muted-foreground">暂无看跌信号</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
