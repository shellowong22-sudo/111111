import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap, RefreshCw, TrendingUp, TrendingDown, BarChart3, Globe,
  ArrowUpDown, Star, Clock, CheckCircle2, Send, ChevronUp, ChevronDown,
  Activity, Target, Shield, Layers
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealerQuote {
  dealerId: string;
  dealerName: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  spread: number;
  spreadBps: number;
  timestamp: number;
  isNBBO: boolean;
  fillRate: number;
  responseTimeMs: number;
  quoteQuality: number;
  currency: string;
  side: string;
}

interface NBBO {
  bestBid: number;
  bestAsk: number;
  bestBidDealer: string;
  bestAskDealer: string;
  midPrice: number;
  spreadBps: number;
  dealerCount: number;
  timestamp: number;
}

// ─── Price Flash Hook ─────────────────────────────────────────────────────────

function usePriceFlash(value: number) {
  const prevRef = useRef<number>(value);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (prevRef.current !== value) {
      const cls = value > prevRef.current ? 'text-emerald-400' : 'text-red-400';
      setFlashClass(cls);
      const timer = setTimeout(() => setFlashClass(''), 600);
      prevRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return flashClass;
}

// ─── Dealer Quote Row ─────────────────────────────────────────────────────────

function DealerQuoteRow({ quote, onHit, isSelected, onSelect }: {
  quote: DealerQuote;
  onHit: (quote: DealerQuote, side: 'BUY' | 'SELL') => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const bidFlash = usePriceFlash(quote.bid);
  const askFlash = usePriceFlash(quote.ask);

  const tierColor = quote.spreadBps < 1 ? 'text-emerald-400' : quote.spreadBps < 2 ? 'text-amber-400' : 'text-red-400';
  const qualityColor = quote.quoteQuality >= 85 ? 'text-emerald-400' : quote.quoteQuality >= 70 ? 'text-amber-400' : 'text-red-400';

  return (
    <tr
      className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-all cursor-pointer ${isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
      onClick={onSelect}
    >
      {/* NBBO indicator */}
      <td className="p-2 text-center w-8">
        {quote.isNBBO && <Star className="w-3 h-3 text-amber-400 fill-amber-400 mx-auto" />}
      </td>

      {/* Dealer */}
      <td className="p-2">
        <div className="text-xs font-medium text-slate-200">{quote.dealerName}</div>
        <div className="text-xs text-slate-500">{quote.dealerId}</div>
      </td>

      {/* Bid */}
      <td className="p-2 text-right">
        <div className={`text-sm font-bold font-mono transition-colors duration-300 ${bidFlash || 'text-emerald-400'}`}>
          {quote.bid.toFixed(5)}
        </div>
        <div className="text-xs text-slate-500">{(quote.bidSize / 1000000).toFixed(1)}M</div>
      </td>

      {/* Ask */}
      <td className="p-2 text-right">
        <div className={`text-sm font-bold font-mono transition-colors duration-300 ${askFlash || 'text-red-400'}`}>
          {quote.ask.toFixed(5)}
        </div>
        <div className="text-xs text-slate-500">{(quote.askSize / 1000000).toFixed(1)}M</div>
      </td>

      {/* Spread */}
      <td className="p-2 text-center">
        <span className={`text-xs font-medium ${tierColor}`}>{quote.spreadBps.toFixed(1)} bps</span>
      </td>

      {/* Fill rate */}
      <td className="p-2 text-center">
        <span className="text-xs text-slate-400">{quote.fillRate.toFixed(1)}%</span>
      </td>

      {/* Response time */}
      <td className="p-2 text-center">
        <span className="text-xs text-slate-400">{quote.responseTimeMs}ms</span>
      </td>

      {/* Quality */}
      <td className="p-2 text-center">
        <span className={`text-xs font-medium ${qualityColor}`}>{quote.quoteQuality}</span>
      </td>

      {/* Actions */}
      <td className="p-2 text-center">
        <div className="flex items-center gap-1 justify-center">
          <Button
            size="sm"
            className="bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs h-5 px-2"
            onClick={e => { e.stopPropagation(); onHit(quote, 'BUY'); }}
          >
            买
          </Button>
          <Button
            size="sm"
            className="bg-red-600/80 hover:bg-red-600 text-white text-xs h-5 px-2"
            onClick={e => { e.stopPropagation(); onHit(quote, 'SELL'); }}
          >
            卖
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Market Depth Visualization ───────────────────────────────────────────────

function MarketDepthChart({ bids, asks }: {
  bids: Array<{ price: number; size: number; dealerCount: number }>;
  asks: Array<{ price: number; size: number; dealerCount: number }>;
}) {
  // Build cumulative depth
  const bidDepth = bids.map((b, i) => ({
    price: b.price,
    cumSize: bids.slice(0, i + 1).reduce((s, x) => s + x.size, 0) / 1000000,
    side: 'bid',
  }));

  const askDepth = asks.map((a, i) => ({
    price: a.price,
    cumSize: asks.slice(0, i + 1).reduce((s, x) => s + x.size, 0) / 1000000,
    side: 'ask',
  }));

  const combined = [
    ...bidDepth.reverse().map(b => ({ price: b.price, bid: b.cumSize, ask: undefined })),
    ...askDepth.map(a => ({ price: a.price, bid: undefined, ask: a.cumSize })),
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={combined} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="price"
          tick={{ fill: '#64748b', fontSize: 9 }}
          tickFormatter={v => v.toFixed(4)}
        />
        <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => `${v}M`} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '10px' }}
          formatter={(v: number, name: string) => [`${v?.toFixed(2)}M`, name === 'bid' ? '买方深度' : '卖方深度']}
        />
        <Area type="stepAfter" dataKey="bid" stroke="#10b981" fill="#10b981" fillOpacity={0.25} connectNulls={false} />
        <Area type="stepAfter" dataKey="ask" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── RFQ Dialog ───────────────────────────────────────────────────────────────

function RFQPanel({ instrument, onExecute }: {
  instrument: string;
  onExecute: (params: { direction: 'BUY' | 'SELL'; quantity: number; dealerId: string; price: number }) => void;
}) {
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('1000000');
  const [rfqResult, setRfqResult] = useState<{
    rfqId: string;
    quotes: DealerQuote[];
    bestBid: number;
    bestAsk: number;
    bestDealer: string;
    expiresAt: number;
  } | null>(null);
  const [countdown, setCountdown] = useState(0);

  const submitRFQ = trpc.allq.submitRFQ.useMutation({
    onSuccess: (data) => {
      if (!data.success || !data.rfq) {
        toast.error('RFQ 未发送', { description: data.limitation });
        return;
      }
      setRfqResult(data.rfq);
      setCountdown(30);
      toast.success('RFQ 已发送', { description: `已向 ${data.rfq.quotes.length} 家交易商询价` });
    },
    onError: () => toast.error('RFQ 发送失败'),
  });

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && rfqResult) {
      setRfqResult(null);
    }
  }, [countdown, rfqResult]);

  const handleSendRFQ = () => {
    submitRFQ.mutate({
      instrument,
      direction,
      quantity: parseFloat(quantity) || 1000000,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Send className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-slate-300">询价请求 (RFQ)</span>
      </div>

      {/* RFQ form */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className={`text-xs ${direction === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}
            onClick={() => setDirection('BUY')}
          >
            买入
          </Button>
          <Button
            size="sm"
            className={`text-xs ${direction === 'SELL' ? 'bg-red-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}
            onClick={() => setDirection('SELL')}
          >
            卖出
          </Button>
        </div>

        <Input
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="交易数量"
          className="bg-slate-800/60 border-slate-700 text-slate-200 text-xs h-8"
        />

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
          size="sm"
          onClick={handleSendRFQ}
          disabled={submitRFQ.isPending}
        >
          {submitRFQ.isPending ? '发送中...' : '发送询价'}
        </Button>
      </div>

      {/* RFQ results */}
      {rfqResult && (
        <div className="space-y-2 p-3 bg-slate-800/60 rounded-lg border border-blue-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-400 font-medium">询价结果</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-400">{countdown}s</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {rfqResult.quotes.slice(0, 5).map((q, i) => (
              <div
                key={q.dealerId}
                className={`flex items-center justify-between p-2 rounded text-xs ${i === 0 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-700/30'}`}
              >
                <div className="flex items-center gap-2">
                  {i === 0 && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                  <span className="text-slate-300">{q.dealerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-mono">{q.bid.toFixed(5)}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-red-400 font-mono">{q.ask.toFixed(5)}</span>
                  <Button
                    size="sm"
                    className={`text-xs h-5 px-2 ${direction === 'BUY' ? 'bg-emerald-600/80 hover:bg-emerald-600' : 'bg-red-600/80 hover:bg-red-600'} text-white`}
                    onClick={() => {
                      onExecute({
                        direction,
                        quantity: parseFloat(quantity),
                        dealerId: q.dealerId,
                        price: direction === 'BUY' ? q.ask : q.bid,
                      });
                      setRfqResult(null);
                    }}
                  >
                    成交
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dealer Metrics Panel ─────────────────────────────────────────────────────

function DealerMetricsPanel({ metrics }: {
  metrics: Array<{
    dealerId: string; dealerName: string; avgSpreadBps: number;
    fillRate: number; avgResponseMs: number; quoteCount: number;
    hitRate: number; reliability: number; rank: number;
    tier: 'TIER1' | 'TIER2' | 'TIER3';
  }>;
}) {
  const TIER_COLORS = {
    TIER1: 'text-amber-400 bg-amber-400/10',
    TIER2: 'text-blue-400 bg-blue-400/10',
    TIER3: 'text-slate-400 bg-slate-400/10',
  };

  // Scatter data for spread vs fill rate
  const scatterData = metrics.map(m => ({
    x: m.avgSpreadBps,
    y: m.fillRate,
    z: m.quoteCount,
    name: m.dealerName,
  }));

  return (
    <div className="space-y-4">
      {/* Scatter chart */}
      <Card className="bg-slate-800/40 border-slate-700/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm text-slate-300">交易商综合评估：价差 vs 成交率</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="x"
                name="平均价差(bps)"
                tick={{ fill: '#64748b', fontSize: 10 }}
                label={{ value: '平均价差 (bps)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                dataKey="y"
                name="成交率(%)"
                tick={{ fill: '#64748b', fontSize: 10 }}
                label={{ value: '成交率 (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              />
              <ZAxis dataKey="z" range={[40, 200]} name="报价数量" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '10px' }}
                formatter={(v: number, name: string) => [
                  name === '平均价差(bps)' ? `${v.toFixed(2)} bps` : name === '成交率(%)' ? `${v.toFixed(1)}%` : v,
                  name
                ]}
              />
              <Scatter data={scatterData} fill="#3b82f6" fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Metrics table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700/50">
              <th className="p-3 text-center text-slate-400 font-medium">排名</th>
              <th className="p-3 text-left text-slate-400 font-medium">交易商</th>
              <th className="p-3 text-center text-slate-400 font-medium">级别</th>
              <th className="p-3 text-right text-slate-400 font-medium">平均价差</th>
              <th className="p-3 text-right text-slate-400 font-medium">成交率</th>
              <th className="p-3 text-right text-slate-400 font-medium">响应时间</th>
              <th className="p-3 text-right text-slate-400 font-medium">报价数量</th>
              <th className="p-3 text-right text-slate-400 font-medium">命中率</th>
              <th className="p-3 text-right text-slate-400 font-medium">可靠性</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={m.dealerId}
                className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i % 2 === 0 ? 'bg-slate-800/20' : ''}`}
              >
                <td className="p-3 text-center">
                  <span className={`text-sm font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'}`}>
                    #{m.rank}
                  </span>
                </td>
                <td className="p-3">
                  <div className="font-medium text-slate-200">{m.dealerName}</div>
                  <div className="text-slate-500">{m.dealerId}</div>
                </td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[m.tier]}`}>
                    {m.tier}
                  </span>
                </td>
                <td className={`p-3 text-right font-bold ${m.avgSpreadBps < 1 ? 'text-emerald-400' : m.avgSpreadBps < 2 ? 'text-amber-400' : 'text-red-400'}`}>
                  {m.avgSpreadBps.toFixed(2)} bps
                </td>
                <td className={`p-3 text-right ${m.fillRate >= 95 ? 'text-emerald-400' : m.fillRate >= 90 ? 'text-amber-400' : 'text-red-400'}`}>
                  {m.fillRate.toFixed(1)}%
                </td>
                <td className={`p-3 text-right ${m.avgResponseMs < 50 ? 'text-emerald-400' : m.avgResponseMs < 100 ? 'text-amber-400' : 'text-red-400'}`}>
                  {m.avgResponseMs}ms
                </td>
                <td className="p-3 text-right text-slate-400">{m.quoteCount.toLocaleString()}</td>
                <td className="p-3 text-right text-slate-400">{m.hitRate.toFixed(1)}%</td>
                <td className={`p-3 text-right ${m.reliability >= 97 ? 'text-emerald-400' : m.reliability >= 93 ? 'text-amber-400' : 'text-red-400'}`}>
                  {m.reliability.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ALLQ() {
  const [selectedInstrument, setSelectedInstrument] = useState('EUR/USD');
  const [activeTab, setActiveTab] = useState('quotes');
  const [selectedQuote, setSelectedQuote] = useState<DealerQuote | null>(null);
  const [dealerSortBy, setDealerSortBy] = useState<'spread' | 'fillRate' | 'responseTime' | 'reliability'>('spread');
  const [spreadPeriod, setSpreadPeriod] = useState<'1D' | '1W' | '1M'>('1D');
  const [historyPeriod, setHistoryPeriod] = useState<'1H' | '4H' | '1D' | '1W'>('1H');

  // Data queries
  const { data: quotesData, refetch: refetchQuotes } = trpc.allq.getQuotes.useQuery(
    { instrument: selectedInstrument, dealerCount: 10 },
    { refetchInterval: 3000 }
  );

  const { data: depthData } = trpc.allq.getMarketDepth.useQuery(
    { instrument: selectedInstrument },
    { refetchInterval: 5000 }
  );

  const { data: historyData } = trpc.allq.getQuoteHistory.useQuery(
    { instrument: selectedInstrument, period: historyPeriod },
    { staleTime: 30000 }
  );

  const { data: metricsData } = trpc.allq.getDealerMetrics.useQuery(
    { sortBy: dealerSortBy },
    { staleTime: 30000 }
  );

  const { data: spreadData } = trpc.allq.getSpreadAnalysis.useQuery(
    { instrument: selectedInstrument, period: spreadPeriod },
    { staleTime: 30000 }
  );

  const { data: instrumentsData } = trpc.allq.getInstruments.useQuery(undefined, { staleTime: 60000 });

  // 真实汇率数据（Yahoo Finance）
  const { data: realFXData } = trpc.allq.getRealFXRates.useQuery(
    { pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'USD/CAD', 'NZD/USD', 'EUR/GBP'] },
    { refetchInterval: 15000, staleTime: 10000 }
  );

  // Execute quote mutation
  const executeQuote = trpc.allq.executeQuote.useMutation({
    onSuccess: (data) => {
      if (!data.success || data.executedPrice == null) {
        toast.error('执行通道未配置', {
          description: data.message ?? '未收到真实成交回执，系统未创建订单。',
        });
        return;
      }
      toast.success('订单已发送至执行通道', {
        description: `${data.instrument} ${data.direction === 'BUY' ? '买入' : '卖出'} ${data.quantity.toLocaleString()} @ ${data.executedPrice.toFixed(5)} · ${data.dealer}`,
      });
    },
    onError: () => toast.error('执行失败，请重试'),
  });

  const handleHitQuote = useCallback((quote: DealerQuote, side: 'BUY' | 'SELL') => {
    executeQuote.mutate({
      rfqId: `RFQ-${Date.now()}`,
      dealerId: quote.dealerId,
      instrument: selectedInstrument,
      direction: side,
      quantity: 1000000,
      price: side === 'BUY' ? quote.ask : quote.bid,
      currency: quote.currency,
    });
  }, [executeQuote, selectedInstrument]);

  const handleRFQExecute = useCallback((params: { direction: 'BUY' | 'SELL'; quantity: number; dealerId: string; price: number }) => {
    executeQuote.mutate({
      rfqId: `RFQ-${Date.now()}`,
      dealerId: params.dealerId,
      instrument: selectedInstrument,
      direction: params.direction,
      quantity: params.quantity,
      price: params.price,
      currency: 'USD',
    });
  }, [executeQuote, selectedInstrument]);

  const nbbo = quotesData?.nbbo;
  const spreadStats = spreadData?.stats;
  const quotes = quotesData?.quotes || [];

  // Group instruments by asset class
  const instrumentsByClass = instrumentsData?.instruments.reduce((acc, inst) => {
    if (!acc[inst.assetClass]) acc[inst.assetClass] = [];
    acc[inst.assetClass].push(inst);
    return acc;
  }, {} as Record<string, typeof instrumentsData.instruments>) || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Real FX Ticker Bar */}
      {realFXData && realFXData.rates.length > 0 && (
        <div className="bg-slate-950/90 border-b border-slate-800/40 overflow-hidden">
          <div className="flex items-center gap-6 px-4 py-1.5 overflow-x-auto scrollbar-none">
            {realFXData.rates.map(rate => (
              <div key={rate.pair} className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-medium text-slate-400">{rate.pair}</span>
                <span className="text-xs font-bold font-mono text-slate-100">
                  {rate.price < 10 ? rate.price.toFixed(5) : rate.price.toFixed(3)}
                </span>
                {rate.changePct == null ? (
                  <span className="text-xs text-slate-500">涨跌：—</span>
                ) : (
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${
                    rate.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {rate.changePct >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {Math.abs(rate.changePct).toFixed(3)}%
                  </span>
                )}
                {rate.isReal && (
                  <span className="text-xs text-emerald-500/60 font-medium">公开观察</span>
                )}
                {!rate.isReal && <span className="text-xs text-amber-500/70">延迟参考</span>}
              </div>
            ))}
            <div className="flex-shrink-0 text-xs text-slate-600 ml-2">
              更新: {new Date(realFXData.fetchedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/15 rounded-lg border border-purple-500/25">
              <Globe className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">ALLQ 全市场报价聚合</h1>
              <p className="text-xs text-slate-400">多交易商报价聚合 · 最优执行 · NBBO 实时追踪</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* NBBO display */}
            {nbbo && (
              <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-0.5">最优买价</div>
                  <div className="text-sm font-bold font-mono text-emerald-400">{nbbo.bestBid.toFixed(5)}</div>
                  <div className="text-xs text-slate-500">{nbbo.bestBidDealer.split(' ')[0]}</div>
                </div>
                <div className="text-center px-3 border-x border-slate-700">
                  <div className="text-xs text-slate-500 mb-0.5">价差</div>
                  <div className="text-sm font-bold text-amber-400">{nbbo.spreadBps.toFixed(2)} bps</div>
                  <div className="text-xs text-slate-500">{nbbo.dealerCount} 家报价</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-0.5">最优卖价</div>
                  <div className="text-sm font-bold font-mono text-red-400">{nbbo.bestAsk.toFixed(5)}</div>
                  <div className="text-xs text-slate-500">{nbbo.bestAskDealer.split(' ')[0]}</div>
                </div>
              </div>
            )}

            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className={`text-xs font-medium ${nbbo ? 'text-emerald-400' : 'text-slate-400'}`}>{nbbo ? '实时报价' : '未接入交易商报价'}</span>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1 text-xs"
              onClick={() => void refetchQuotes()}
            >
              <RefreshCw className="w-3 h-3" />
              刷新
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 flex gap-4">
        {/* Left sidebar: instrument selector */}
        <div className="w-48 flex-shrink-0 space-y-2">
          <div className="text-xs text-slate-400 font-medium px-1 mb-2">交易品种</div>
          {Object.entries(instrumentsByClass).map(([cls, insts]) => (
            <div key={cls} className="space-y-1">
              <div className="text-xs text-slate-500 px-2 py-1 font-medium">{cls}</div>
              {insts.map(inst => (
                <button
                  key={inst.symbol}
                  onClick={() => setSelectedInstrument(inst.symbol)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                    selectedInstrument === inst.symbol
                      ? 'bg-purple-600/20 border border-purple-500/40 text-purple-300'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-medium">{inst.symbol}</div>
                  <div className="text-slate-500 text-xs">{inst.dealerCount == null ? '待接入' : `${inst.dealerCount} 家`}</div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          {/* Instrument header */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">{selectedInstrument}</h2>
              <p className="text-xs text-slate-400">{quotesData?.assetClass} · {quotesData?.currency}</p>
            </div>
            {nbbo && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-3xl font-bold font-mono text-slate-100">{nbbo.midPrice.toFixed(5)}</span>
                <div className="flex flex-col">
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <ChevronUp className="w-3 h-3" />
                    {(nbbo.midPrice * 0.001).toFixed(5)}
                  </span>
                  <span className="text-xs text-slate-500">+0.10%</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800/60 border border-slate-700/50 p-1 gap-1">
              {[
                { value: 'quotes', label: '报价聚合', icon: <Layers className="w-3.5 h-3.5" /> },
                { value: 'depth', label: '市场深度', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                { value: 'history', label: '报价历史', icon: <Activity className="w-3.5 h-3.5" /> },
                { value: 'spread', label: '价差分析', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { value: 'dealers', label: '交易商评估', icon: <Star className="w-3.5 h-3.5" /> },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab: Quotes */}
            <TabsContent value="quotes" className="mt-4">
              <div className="grid grid-cols-4 gap-4">
                {/* Quote table */}
                <div className="col-span-3">
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-800/80 border-b border-slate-700/50">
                              <th className="p-2 text-center w-8 text-slate-500">NBBO</th>
                              <th className="p-2 text-left text-slate-400 font-medium">交易商</th>
                              <th className="p-2 text-right text-slate-400 font-medium">买价 (Bid)</th>
                              <th className="p-2 text-right text-slate-400 font-medium">卖价 (Ask)</th>
                              <th className="p-2 text-center text-slate-400 font-medium">价差</th>
                              <th className="p-2 text-center text-slate-400 font-medium">成交率</th>
                              <th className="p-2 text-center text-slate-400 font-medium">响应</th>
                              <th className="p-2 text-center text-slate-400 font-medium">质量</th>
                              <th className="p-2 text-center text-slate-400 font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotes.map(quote => (
                              <DealerQuoteRow
                                key={quote.dealerId}
                                quote={quote}
                                onHit={handleHitQuote}
                                isSelected={selectedQuote?.dealerId === quote.dealerId}
                                onSelect={() => setSelectedQuote(quote)}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RFQ panel */}
                <div className="space-y-3">
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardContent className="p-4">
                      <RFQPanel instrument={selectedInstrument} onExecute={handleRFQExecute} />
                    </CardContent>
                  </Card>

                  {/* Selected quote detail */}
                  {selectedQuote && (
                    <Card className="bg-slate-800/40 border-slate-700/50">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs text-slate-300">报价详情</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">交易商</span>
                          <span className="text-slate-200 font-medium">{selectedQuote.dealerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">买价</span>
                          <span className="text-emerald-400 font-mono">{selectedQuote.bid.toFixed(5)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">卖价</span>
                          <span className="text-red-400 font-mono">{selectedQuote.ask.toFixed(5)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">价差</span>
                          <span className="text-amber-400">{selectedQuote.spreadBps.toFixed(2)} bps</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">买盘规模</span>
                          <span className="text-slate-300">{(selectedQuote.bidSize / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">卖盘规模</span>
                          <span className="text-slate-300">{(selectedQuote.askSize / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">报价时间</span>
                          <span className="text-slate-400">{new Date(selectedQuote.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            onClick={() => handleHitQuote(selectedQuote, 'BUY')}
                          >
                            买入 @ Ask
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white text-xs"
                            onClick={() => handleHitQuote(selectedQuote, 'SELL')}
                          >
                            卖出 @ Bid
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Market Depth */}
            <TabsContent value="depth" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-800/40 border-slate-700/50">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm text-slate-300">市场深度图</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {depthData && (
                      <MarketDepthChart bids={depthData.depth.bids} asks={depthData.depth.asks} />
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-rows-2 gap-4">
                  {/* Bid ladder */}
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs text-emerald-400 flex items-center gap-1">
                        <ChevronUp className="w-3 h-3" />
                        买盘 (Bid)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-1">
                        {depthData?.depth.bids.slice(0, 5).map((bid, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-400 font-mono w-20">{bid.price.toFixed(5)}</span>
                            <div className="flex-1 bg-slate-700/30 rounded overflow-hidden h-3">
                              <div
                                className="h-full bg-emerald-500/30 rounded"
                                style={{ width: `${(bid.size / 2000000) * 100}%` }}
                              />
                            </div>
                            <span className="text-slate-400 w-12 text-right">{(bid.size / 1000000).toFixed(1)}M</span>
                            <span className="text-slate-500 w-8 text-right">{bid.dealerCount}家</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Ask ladder */}
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs text-red-400 flex items-center gap-1">
                        <ChevronDown className="w-3 h-3" />
                        卖盘 (Ask)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-1">
                        {depthData?.depth.asks.slice(0, 5).map((ask, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-red-400 font-mono w-20">{ask.price.toFixed(5)}</span>
                            <div className="flex-1 bg-slate-700/30 rounded overflow-hidden h-3">
                              <div
                                className="h-full bg-red-500/30 rounded"
                                style={{ width: `${(ask.size / 2000000) * 100}%` }}
                              />
                            </div>
                            <span className="text-slate-400 w-12 text-right">{(ask.size / 1000000).toFixed(1)}M</span>
                            <span className="text-slate-500 w-8 text-right">{ask.dealerCount}家</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Quote History */}
            <TabsContent value="history" className="mt-4">
              <Card className="bg-slate-800/40 border-slate-700/50">
                <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-slate-300">报价历史</CardTitle>
                  <div className="flex gap-1">
                    {(['1H', '4H', '1D', '1W'] as const).map(p => (
                      <Button
                        key={p}
                        size="sm"
                        variant={historyPeriod === p ? 'default' : 'ghost'}
                        className={`text-xs h-6 px-2 ${historyPeriod === p ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
                        onClick={() => setHistoryPeriod(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={historyData?.history || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickFormatter={v => new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickFormatter={v => v.toFixed(4)}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '10px' }}
                        labelFormatter={v => new Date(v).toLocaleString('zh-CN')}
                        formatter={(v: number, name: string) => [
                          v.toFixed(5),
                          name === 'bid' ? '买价' : name === 'ask' ? '卖价' : '中间价'
                        ]}
                      />
                      <Area type="monotone" dataKey="bid" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="bid" />
                      <Area type="monotone" dataKey="ask" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="ask" />
                      <Line type="monotone" dataKey="midPrice" stroke="#8b5cf6" strokeWidth={2} dot={false} name="midPrice" />
                      <Legend
                        formatter={(v) => v === 'bid' ? '买价' : v === 'ask' ? '卖价' : '中间价'}
                        wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Spread Analysis */}
            <TabsContent value="spread" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                {/* Spread stats */}
                {spreadStats && (
                  <div className="space-y-3">
                    <Card className="bg-slate-800/40 border-slate-700/50">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm text-slate-300">价差统计</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        {[
                           { label: '当前价差', value: `${spreadStats.currentSpreadBps.toFixed(2)} bps`, color: 'text-amber-400' },
                           { label: '平均价差', value: `${spreadStats.avgSpreadBps.toFixed(2)} bps`, color: 'text-slate-300' },
                           { label: '最小价差', value: `${spreadStats.minSpreadBps.toFixed(2)} bps`, color: 'text-emerald-400' },
                           { label: '最大价差', value: `${spreadStats.maxSpreadBps.toFixed(2)} bps`, color: 'text-red-400' },
                           { label: '25 百分位', value: `${spreadStats.percentile25.toFixed(2)} bps`, color: 'text-blue-400' },
                           { label: '75 百分位', value: `${spreadStats.percentile75.toFixed(2)} bps`, color: 'text-purple-400' },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{item.label}</span>
                            <span className={`font-bold ${item.color}`}>{item.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <div className="flex gap-1">
                      {(['1D', '1W', '1M'] as const).map(p => (
                        <Button
                          key={p}
                          size="sm"
                          variant={spreadPeriod === p ? 'default' : 'outline'}
                          className={`flex-1 text-xs ${spreadPeriod === p ? 'bg-purple-600 text-white' : 'border-slate-700 text-slate-400'}`}
                          onClick={() => setSpreadPeriod(p)}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spread chart */}
                <div className="col-span-2">
                  <Card className="bg-slate-800/40 border-slate-700/50">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm text-slate-300">价差历史趋势</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={spreadData?.spreadHistory || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            tickFormatter={v => new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${v} bps`} />
                          <Tooltip
                            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '10px' }}
                            labelFormatter={v => new Date(v).toLocaleString('zh-CN')}
                            formatter={(v: number, name: string) => [
                              name === 'spreadBps' ? `${v.toFixed(2)} bps` : `${(v / 1000000).toFixed(0)}M`,
                              name === 'spreadBps' ? '价差' : '成交量'
                            ]}
                          />
                          <Area type="monotone" dataKey="spreadBps" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} name="spreadBps" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Dealer Metrics */}
            <TabsContent value="dealers" className="mt-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs text-slate-400">排序方式：</span>
                {[
                  { value: 'spread', label: '价差' },
                  { value: 'fillRate', label: '成交率' },
                  { value: 'responseTime', label: '响应速度' },
                  { value: 'reliability', label: '可靠性' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={dealerSortBy === opt.value ? 'default' : 'outline'}
                    className={`text-xs ${dealerSortBy === opt.value ? 'bg-purple-600 text-white' : 'border-slate-700 text-slate-400'}`}
                    onClick={() => setDealerSortBy(opt.value as typeof dealerSortBy)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {metricsData && <DealerMetricsPanel metrics={metricsData.metrics} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
