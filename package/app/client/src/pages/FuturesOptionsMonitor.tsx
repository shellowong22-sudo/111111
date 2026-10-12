import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
/**
 * MOSO/FOM - 期货与期权行情监控 (Futures & Options Monitor)
 * AI增强：二阶希腊字母实时分析 + cGAN波动率曲面预测 + 跨市场套利信号
 * 超越彭博：Vanna/Charm/Speed/Vomma/Zomma/Color/Ultima 全套二阶导数
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, TrendingUp, TrendingDown, Zap, AlertTriangle, Brain, BarChart2, Activity, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip as ShadTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';

// --- 颜色工具 -----------------------------------------------------------------
const clr = (v: number | null | undefined, pos = '#22c55e', neg = '#ef4444') => v == null ? '#a1a1aa' : v >= 0 ? pos : neg;
const ivColor = (iv: number | null | undefined) => iv == null ? '#a1a1aa' : iv > 40 ? '#ef4444' : iv > 25 ? '#f59e0b' : iv > 15 ? '#22c55e' : '#3b82f6';
const signalBadge = (s: string) => {
  if (s === 'BUY' || s === 'BUY_VOL') return 'bg-green-900/60 text-green-300 border-green-700';
  if (s === 'SELL' || s === 'SELL_VOL') return 'bg-red-900/60 text-red-300 border-red-700';
  if (s === 'UNDERWEIGHT') return 'bg-orange-900/60 text-orange-300 border-orange-700';
  return 'bg-zinc-800 text-zinc-300 border-zinc-600';
};

// --- 格式化工具 ---------------------------------------------------------------
const fmt = (v: number | null | undefined, d = 2) => v?.toFixed(d) ?? '—';
const fmtK = (v: number | null | undefined) => v == null ? '—' : v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);
const fmtSignedPct = (v: number | null | undefined) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// --- 二阶希腊字母说明（含BSM参数解析）-----------------------------------------
const SECOND_ORDER_DEFS = [
  {
    key: 'Vanna', formula: '∂²C/∂S∂σ = -e^(-qT)·φ(d₁)·d₂/σ',
    desc: 'Delta对波动率的敏感度，波动率交易者核心指标',
    color: '#8b5cf6',
    bsmDetail: [
      { param: 'C', meaning: '期权价格 (Call Price)' },
      { param: 'S', meaning: '标的资产现价 (Spot Price)' },
      { param: 'σ', meaning: '隐含波动率 (Implied Volatility)' },
      { param: 'T', meaning: '到期时间（年化）' },
      { param: 'q', meaning: '股息率 (Dividend Yield)' },
      { param: 'φ(d₁)', meaning: '标准正态PDF，d₁=(ln(S/K)+(r-q+σ²/2)T)/(σ√T)' },
      { param: 'd₂', meaning: 'd₁ - σ√T' },
    ],
    usage: '高Vanna期权在波动率变化时Delta快速变化，适合波动率方向性交易与精准对冲。',
  },
  {
    key: 'Charm', formula: '∂²C/∂S∂T = -φ(d₁)·[2(r-q)T - d₂σ√T] / (2Tσ√T)',
    desc: 'Delta对时间流逝的敏感度，每日Delta衰减量',
    color: '#06b6d4',
    bsmDetail: [
      { param: 'T', meaning: '到期时间（年化），每日减少1/252' },
      { param: 'r', meaning: '无风险利率 (Risk-free Rate)' },
      { param: 'q', meaning: '股息率 (Dividend Yield)' },
      { param: 'σ', meaning: '隐含波动率' },
      { param: 'd₂', meaning: 'd₁ - σ√T' },
    ],
    usage: 'Charm用于预测Delta随时间的漂移，对冲者需每日调整Delta对冲比率。',
  },
  {
    key: 'Speed', formula: '∂³C/∂S³ = -Γ/S · (d₁/(σ√T) + 1)',
    desc: 'Gamma对标的价格的敏感度，Gamma对冲调整量',
    color: '#f59e0b',
    bsmDetail: [
      { param: 'Γ', meaning: 'Gamma = ∂²C/∂S² = φ(d₁)/(S·σ·√T)' },
      { param: 'S', meaning: '标的资产现价' },
      { param: 'd₁', meaning: '(ln(S/K)+(r-q+σ²/2)T)/(σ√T)' },
      { param: 'σ√T', meaning: '波动率×时间平方根' },
    ],
    usage: '高Speed意味着Gamma对冲需要更频繁调整，价格大幅波动时对冲成本急剧上升。',
  },
  {
    key: 'Vomma', formula: '∂²C/∂σ² = Vega · d₁·d₂/σ',
    desc: 'Vega对波动率的敏感度，波动率凸性',
    color: '#22c55e',
    bsmDetail: [
      { param: 'Vega', meaning: '∂C/∂σ = S·e^(-qT)·φ(d₁)·√T' },
      { param: 'd₁', meaning: 'BSM标准参数d₁' },
      { param: 'd₂', meaning: 'd₁ - σ√T' },
      { param: 'σ', meaning: '隐含波动率' },
    ],
    usage: '正Vomma表示期权具有波动率凸性，波动率上升时Vega加速增大，适合做多波动率。',
  },
  {
    key: 'Zomma', formula: '∂Γ/∂σ = Γ · (d₁d₂ - 1)/σ',
    desc: 'Gamma对波动率的敏感度',
    color: '#ec4899',
    bsmDetail: [
      { param: 'Γ', meaning: 'Gamma值' },
      { param: 'd₁, d₂', meaning: 'BSM标准参数' },
      { param: 'σ', meaning: '隐含波动率' },
    ],
    usage: 'Zomma衡量波动率变化对Gamma对冲效果的影响，波动率交易者需监控此值。',
  },
  {
    key: 'Color', formula: '∂Γ/∂T = -φ(d₁)/(2S·σ·T·√T) · [2qT + 1 + d₁(2(r-q)T-d₂σ√T)/(σ√T)]',
    desc: 'Gamma对时间的敏感度，每日Gamma衰减',
    color: '#f97316',
    bsmDetail: [
      { param: 'Γ', meaning: 'Gamma值' },
      { param: 'T', meaning: '到期时间（年化）' },
      { param: 'q', meaning: '股息率' },
      { param: 'r', meaning: '无风险利率' },
    ],
    usage: 'Color预测Gamma随时间的变化速率，临近到期时Color绝对值急剧增大。',
  },
  {
    key: 'Ultima', formula: '∂³C/∂σ³ = -Vomma/σ · (d₁d₂(1-d₁d₂) + d₁²+d₂²)',
    desc: 'Vomma对波动率的三阶导数',
    color: '#a78bfa',
    bsmDetail: [
      { param: 'Vomma', meaning: '∂²C/∂σ²' },
      { param: 'd₁, d₂', meaning: 'BSM标准参数' },
      { param: 'σ', meaning: '隐含波动率' },
    ],
    usage: 'Ultima是最高阶的波动率敏感度指标，用于极端波动率情景下的风险评估。',
  },
];

// --- 二阶希腊字母悬浮提示框组件 ----------------------------------------------
function GreekTooltip({ def, value }: { def: typeof SECOND_ORDER_DEFS[0]; value?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <ShadTooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help inline-flex items-center gap-0.5 border-b border-dashed" style={{ borderColor: def.color, color: def.color }}>
            {def.key}
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-sm bg-zinc-950 border border-zinc-700 p-3 text-xs shadow-2xl z-50"
        >
          <div className="space-y-2">
            <div className="font-bold" style={{ color: def.color }}>{def.key}</div>
            <div className="font-mono text-zinc-300 bg-zinc-900 rounded px-2 py-1 text-xs">{def.formula}</div>
            <div className="text-zinc-400">{def.desc}</div>
            {value && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">当前值:</span>
                <span className="font-mono font-bold" style={{ color: def.color }}>{value}</span>
              </div>
            )}
            <div className="border-t border-zinc-800 pt-2">
              <div className="text-zinc-500 text-xs mb-1">BSM 参数说明</div>
              {def.bsmDetail.map(p => (
                <div key={p.param} className="flex gap-1 text-xs">
                  <span className="font-mono text-yellow-400 w-16 shrink-0">{p.param}</span>
                  <span className="text-zinc-400">{p.meaning}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-800 pt-2 text-zinc-300 text-xs">
              <span className="text-zinc-500">交易应用: </span>{def.usage}
            </div>
          </div>
        </TooltipContent>
      </ShadTooltip>
    </TooltipProvider>
  );
}

// --- 主组件 -------------------------------------------------------------------
export default function FuturesOptionsMonitor() {

  const [fomTimeframe, setFomTimeframe] = useState<'1W'|'1M'|'3M'|'1Y'>('1M');
  const [, setLocation] = useLocation();
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [selectedExpiry, setSelectedExpiry] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');
  const [showSecondOrder, setShowSecondOrder] = useState(true);

  const { data: underlyings } = trpc.futuresOptions.getUnderlyings.useQuery();
  const { data: chainData, isLoading: chainLoading } = trpc.futuresOptions.getOptionChain.useQuery(
    { symbol: selectedSymbol, expiryDays: selectedExpiry }
  );
  const { data: ivSurface } = trpc.futuresOptions.getIVSurface.useQuery({ symbol: selectedSymbol });
  const { data: globalFutures } = trpc.futuresOptions.getGlobalFutures.useQuery();
  const { data: arbitrageSignals } = trpc.futuresOptions.scanArbitrageSignals.useQuery({ minScore: 0.01 });
  const { data: marketStats } = trpc.futuresOptions.getMarketStats.useQuery({ symbol: selectedSymbol });

  const greeksData = useMemo(() => (chainData?.chain ?? [])
    .filter(row => Number.isFinite(row.strike) && Number.isFinite(row.callDelta) && Number.isFinite(row.putDelta))
    .map(row => ({
      strike: String(row.strike),
      callDelta: row.callDelta,
      putDelta: row.putDelta,
    })), [chainData]);
  // This slot remains in the existing workspace, but no OI curve is drawn until
  // an authorised futures open-interest history reaches the backend contract.
  const oiData: Array<{ date: string; es: number; nq: number; cl: number }> = [];

  // ATM row for quick display
  const atmRow = useMemo(() => {
    if (!chainData?.chain || !chainData.underlying) return null;
    const S = chainData.underlying.price;
    return chainData.chain.reduce((prev, curr) =>
      Math.abs(curr.strike - S) < Math.abs(prev.strike - S) ? curr : prev
    );
  }, [chainData]);

  // Volatility smile data for chart
  const smileData = useMemo(() => {
    if (!chainData?.chain) return [];
    return chainData.chain.map(r => ({
      strike: r.strike,
      callIV: r.callIV,
      putIV: r.putIV,
      delta: r.callDelta,
    }));
  }, [chainData]);

  // IVS heatmap data
  const ivHeatmap = useMemo(() => {
    if (!ivSurface?.surface) return [];
    const expiries = [7, 14, 30, 60, 90, 180, 360];
    return expiries.map(exp => {
      const row: Record<string, number | string> = { expiry: `${exp}D` };
      ivSurface.surface
        .filter(s => s.expiry === exp)
        .forEach(s => { row[`m${(s.moneyness * 100).toFixed(0)}`] = s.currentIV; });
      return row;
    });
  }, [ivSurface]);

  // Radar data for second-order greeks
  const radarData = useMemo(() => {
    if (!atmRow) return [];
    return [
      { subject: 'Vanna', value: Math.abs(atmRow.callVanna) * 1000, fullMark: 5 },
      { subject: 'Charm', value: Math.abs(atmRow.callCharm) * 10000, fullMark: 5 },
      { subject: 'Speed', value: Math.abs(atmRow.callSpeed) * 1e6, fullMark: 5 },
      { subject: 'Vomma', value: Math.abs(atmRow.callVomma) * 100, fullMark: 5 },
      { subject: 'Zomma', value: Math.abs(atmRow.callZomma) * 1000, fullMark: 5 },
      { subject: 'Color', value: Math.abs(atmRow.callColor) * 1e6, fullMark: 5 },
    ];
  }, [atmRow]);

  return (
    <OpenBBModuleDataBand path="/fom" title="期货期权快照数据">
    {() => <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-zinc-400 hover:text-zinc-100 p-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-lg">MOSO</span>
          <span className="text-zinc-400 text-sm">期货与期权行情监控</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-green-900/60 text-green-400 border-green-700 text-xs">AI ENHANCED</Badge>
          <Badge className="bg-purple-900/60 text-purple-400 border-purple-700 text-xs">2nd ORDER GREEKS</Badge>
          <Badge className="bg-blue-900/60 text-blue-400 border-blue-700 text-xs">cGAN IVS PREDICT</Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Underlying Selector */}
        <div className="flex flex-wrap gap-2">
          {underlyings?.map(u => (
            <button
              key={u.symbol}
              onClick={() => setSelectedSymbol(u.symbol)}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                selectedSymbol === u.symbol
                  ? 'bg-yellow-500 text-black border-yellow-400'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-yellow-500'
              }`}
            >
              <span>{u.symbol}</span>
              <span className={`ml-2 ${u.changePct == null ? 'text-zinc-500' : u.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtSignedPct(u.changePct)}
              </span>
              <span className="ml-1 text-zinc-500">IV:{fmt(u.iv30)}{u.iv30 == null ? '' : '%'}</span>
            </button>
          ))}
        </div>

        {/* Market Stats Bar */}
        {marketStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { label: 'Price', value: marketStats.price == null ? '—' : `$${fmt(marketStats.price)}`, color: clr(marketStats.change) },
              { label: 'Chg%', value: fmtSignedPct(marketStats.changePct), color: clr(marketStats.changePct) },
              { label: 'IV30', value: marketStats.iv30 == null ? '—' : `${fmt(marketStats.iv30)}%`, color: ivColor(marketStats.iv30) },
              { label: 'HVol30', value: marketStats.hvol30 == null ? '—' : `${fmt(marketStats.hvol30)}%`, color: '#a1a1aa' },
              { label: 'IV Rank', value: marketStats.ivRank == null ? '—' : `${marketStats.ivRank}%ile`, color: marketStats.ivRank != null && marketStats.ivRank > 50 ? '#ef4444' : '#22c55e' },
              { label: 'P/C Vol', value: fmt(marketStats.pcRatio, 3), color: marketStats.pcRatio != null && marketStats.pcRatio > 1 ? '#ef4444' : '#22c55e' },
              { label: 'Net Vanna', value: fmt(marketStats.netVanna, 0), color: '#8b5cf6' },
              { label: 'Arb Signals', value: marketStats.arbitrageCount == null ? '—' : String(marketStats.arbitrageCount), color: marketStats.arbitrageCount != null && marketStats.arbitrageCount > 0 ? '#f59e0b' : '#a1a1aa' },
            ].map(item => (
              <Card key={item.label} className="bg-zinc-900 border-zinc-800 p-2 text-center">
                <div className="text-zinc-500 text-xs">{item.label}</div>
                <div className="font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
              </Card>
            ))}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-yellow-500 data-[state=active]:text-black">期权链</TabsTrigger>
            <TabsTrigger value="greeks2nd" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white">二阶希腊字母</TabsTrigger>
            <TabsTrigger value="ivs" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">波动率曲面</TabsTrigger>
            <TabsTrigger value="futures" className="text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white">全球期货</TabsTrigger>
            <TabsTrigger value="arbitrage" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white">套利信号</TabsTrigger>
          </TabsList>

          {/* -- 期权链 --------------------------------------------------- */}
          <TabsContent value="overview" className="space-y-4">
            {/* Expiry Selector */}
            <div className="flex gap-2 flex-wrap">
              {chainData?.expiryOptions?.map(exp => (
                <button
                  key={exp.days}
                  onClick={() => setSelectedExpiry(exp.days)}
                  className={`px-3 py-1 rounded text-xs border transition-all ${
                    selectedExpiry === exp.days
                      ? 'bg-yellow-500 text-black border-yellow-400'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-yellow-500'
                  }`}
                >
                  {exp.label} ({exp.days}D)
                </button>
              ))}
            </div>

            {/* Volatility Smile Chart */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-yellow-400" />
                波动率微笑 (Volatility Smile) — {selectedSymbol} {selectedExpiry}D
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={smileData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="strike" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} domain={['auto', 'auto']} />
                  <ChartTooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }}
                    formatter={(v: number) => [`${v?.toFixed(2)}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={chainData?.underlying?.price} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'ATM', fill: '#f59e0b', fontSize: 10 }} />
                  <Line type="monotone" dataKey="callIV" stroke="#22c55e" dot={false} name="Call IV%" strokeWidth={2} />
                  <Line type="monotone" dataKey="putIV" stroke="#ef4444" dot={false} name="Put IV%" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Option Chain Table */}
            {chainLoading ? (
              <div className="text-center text-zinc-500 py-8">计算中...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th colSpan={7} className="text-green-400 text-center py-1 bg-green-950/20">— CALL —</th>
                      <th className="text-yellow-400 text-center py-2 bg-yellow-950/30 font-bold">STRIKE</th>
                      <th colSpan={7} className="text-red-400 text-center py-1 bg-red-950/20">— PUT —</th>
                    </tr>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-right">Bid</th>
                      <th className="px-2 py-1 text-right">Ask</th>
                      <th className="px-2 py-1 text-right">IV%</th>
                      <th className="px-2 py-1 text-right">Δ</th>
                      <th className="px-2 py-1 text-right">Γ</th>
                      <th className="px-2 py-1 text-right">Vol</th>
                      <th className="px-2 py-1 text-right">OI</th>
                      <th className="px-2 py-1 text-center font-bold text-yellow-400">Strike</th>
                      <th className="px-2 py-1 text-left">Bid</th>
                      <th className="px-2 py-1 text-left">Ask</th>
                      <th className="px-2 py-1 text-left">IV%</th>
                      <th className="px-2 py-1 text-left">Δ</th>
                      <th className="px-2 py-1 text-left">Γ</th>
                      <th className="px-2 py-1 text-left">Vol</th>
                      <th className="px-2 py-1 text-left">OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainData?.chain?.map((row, i) => {
                      const isATM = chainData.underlying && Math.abs(row.strike - chainData.underlying.price) < chainData.underlying.price * 0.015;
                      return (
                        <tr key={i} className={`border-b border-zinc-900 hover:bg-zinc-800/50 ${isATM ? 'bg-yellow-950/20' : ''}`}>
                          <td className="px-2 py-1 text-right text-green-400">{fmt(row.callBid)}</td>
                          <td className="px-2 py-1 text-right text-green-300">{fmt(row.callAsk)}</td>
                          <td className="px-2 py-1 text-right" style={{ color: ivColor(row.callIV) }}>{fmt(row.callIV)}%</td>
                          <td className="px-2 py-1 text-right text-zinc-300">{fmt(row.callDelta, 3)}</td>
                          <td className="px-2 py-1 text-right text-zinc-400">{row.callGamma.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right text-zinc-400">{fmtK(row.callVol)}</td>
                          <td className="px-2 py-1 text-right text-zinc-500">{fmtK(row.callOI)}</td>
                          <td className={`px-3 py-1 text-center font-bold ${isATM ? 'text-yellow-400 bg-yellow-950/40' : 'text-zinc-200'}`}>
                            {row.strike}
                            {row.arbitrageSignal && <span className="ml-1 text-orange-400">⚡</span>}
                          </td>
                          <td className="px-2 py-1 text-left text-red-400">{fmt(row.putBid)}</td>
                          <td className="px-2 py-1 text-left text-red-300">{fmt(row.putAsk)}</td>
                          <td className="px-2 py-1 text-left" style={{ color: ivColor(row.putIV) }}>{fmt(row.putIV)}%</td>
                          <td className="px-2 py-1 text-left text-zinc-300">{fmt(row.putDelta, 3)}</td>
                          <td className="px-2 py-1 text-left text-zinc-400">{row.putGamma.toFixed(5)}</td>
                          <td className="px-2 py-1 text-left text-zinc-400">{fmtK(row.putVol)}</td>
                          <td className="px-2 py-1 text-left text-zinc-500">{fmtK(row.putOI)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {chainData?.chain.length === 0 && (
                  <div className="border-t border-zinc-800 px-3 py-6 text-center text-xs text-amber-300">
                    {chainData.reason}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* -- 二阶希腊字母 -------------------------------------------- */}
          <TabsContent value="greeks2nd" className="space-y-4">
            {/* AI Model Info */}
            <Card className="bg-purple-950/20 border-purple-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-bold text-sm">二阶导数希腊字母实时分析引擎</span>
                <Badge className="bg-purple-900/60 text-purple-300 border-purple-700 text-xs ml-auto">BSM + Monte Carlo</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {SECOND_ORDER_DEFS.map(def => (
                  <div key={def.key} className="bg-zinc-900/60 rounded p-2">
                    <div className="font-bold" style={{ color: def.color }}>{def.key}</div>
                    <div className="text-zinc-500 font-mono text-xs mt-0.5">{def.formula}</div>
                    <div className="text-zinc-400 mt-1">{def.desc}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ATM Greeks Summary */}
            {atmRow && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-zinc-900 border-zinc-800 p-4">
                  <h3 className="text-sm font-bold text-green-400 mb-3">ATM CALL — Strike {atmRow.strike}</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Delta (Δ)', value: fmt(atmRow.callDelta, 4), color: '#22c55e' },
                      { label: 'Gamma (Γ)', value: atmRow.callGamma.toFixed(6), color: '#3b82f6' },
                      { label: 'Vega (ν)', value: fmt(atmRow.callVega, 4), color: '#8b5cf6' },
                      { label: 'Theta (Θ)', value: fmt(atmRow.callTheta, 4), color: '#ef4444' },
                      { label: 'Rho (ρ)', value: fmt(atmRow.callRho, 4), color: '#f59e0b' },
                      { label: '—— 二阶 ——', value: '', color: '#71717a' },
                      { label: 'Vanna', value: atmRow.callVanna.toFixed(6), color: '#8b5cf6' },
                      { label: 'Charm', value: atmRow.callCharm.toFixed(6), color: '#06b6d4' },
                      { label: 'Speed', value: atmRow.callSpeed.toFixed(8), color: '#f59e0b' },
                      { label: 'Vomma', value: atmRow.callVomma.toFixed(6), color: '#22c55e' },
                      { label: 'Zomma', value: atmRow.callZomma.toFixed(6), color: '#ec4899' },
                      { label: 'Color', value: atmRow.callColor.toFixed(8), color: '#f97316' },
                      { label: 'Ultima', value: atmRow.callUltima.toFixed(6), color: '#a78bfa' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-zinc-500">{item.label}</span>
                        <span className="font-mono" style={{ color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Radar Chart */}
                <Card className="bg-zinc-900 border-zinc-800 p-4">
                  <h3 className="text-sm font-bold text-zinc-300 mb-3">二阶希腊字母雷达图 (ATM)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#3f3f46" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                      <PolarRadiusAxis tick={{ fill: '#71717a', fontSize: 9 }} />
                      <Radar name="二阶希腊字母" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* Full Chain Second-Order Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">全链二阶希腊字母 — {selectedSymbol} {selectedExpiry}D</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">Strike</th>
                      <th className="px-2 py-1 text-right">Δ</th>
                      <th className="px-2 py-1 text-right">Γ</th>
                      <th className="px-2 py-1 text-right text-purple-400">Vanna</th>
                      <th className="px-2 py-1 text-right text-cyan-400">Charm</th>
                      <th className="px-2 py-1 text-right text-yellow-400">Speed</th>
                      <th className="px-2 py-1 text-right text-green-400">Vomma</th>
                      <th className="px-2 py-1 text-right text-pink-400">Zomma</th>
                      <th className="px-2 py-1 text-right text-orange-400">Color</th>
                      <th className="px-2 py-1 text-right text-violet-400">Ultima</th>
                      <th className="px-2 py-1 text-right">IV%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainData?.chain?.map((row, i) => {
                      const isATM = chainData.underlying && Math.abs(row.strike - chainData.underlying.price) < chainData.underlying.price * 0.015;
                      return (
                        <tr key={i} className={`border-b border-zinc-900 hover:bg-zinc-800/30 ${isATM ? 'bg-purple-950/20' : ''}`}>
                          <td className={`px-2 py-1 font-bold ${isATM ? 'text-yellow-400' : 'text-zinc-200'}`}>{row.strike}</td>
                          <td className="px-2 py-1 text-right text-zinc-300">{fmt(row.callDelta, 3)}</td>
                          <td className="px-2 py-1 text-right text-zinc-400">{row.callGamma.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right text-purple-400">{row.callVanna.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right text-cyan-400">{row.callCharm.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right text-yellow-400">{row.callSpeed.toFixed(7)}</td>
                          <td className="px-2 py-1 text-right text-green-400">{row.callVomma.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right text-pink-400">{row.callZomma.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right text-orange-400">{row.callColor.toFixed(7)}</td>
                          <td className="px-2 py-1 text-right text-violet-400">{row.callUltima.toFixed(5)}</td>
                          <td className="px-2 py-1 text-right" style={{ color: ivColor(row.callIV) }}>{fmt(row.callIV)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* -- 波动率曲面数据状态 -------------------------------------- */}
          <TabsContent value="ivs" className="space-y-4">
            {/* 数据源状态 */}
            <Card className="bg-blue-950/20 border-blue-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300 font-bold text-sm">隐含波动率曲面数据状态</span>
                <Badge className="bg-blue-900/60 text-blue-300 border-blue-700 text-xs ml-auto">
                  {ivSurface?.available ? '数据可用' : '数据源未配置'}
                </Badge>
              </div>
              <div className="text-xs text-zinc-400 grid grid-cols-2 md:grid-cols-3 gap-2">
                <div><span className="text-zinc-500">数据质量: </span>{ivSurface?.quality ?? '加载中'}</div>
                <div><span className="text-zinc-500">实时状态: </span>{ivSurface?.realtimeStatus ?? '加载中'}</div>
                <div><span className="text-zinc-500">套利信号: </span>{ivSurface?.arbitrageSignals?.length || 0} 个</div>
              </div>
              {ivSurface && !ivSurface.available && <div className="mt-2 text-xs text-amber-300">{ivSurface.reason}</div>}
            </Card>

            {/* IVS Scatter Plot */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">当前 vs 预测波动率曲面 — {selectedSymbol}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="moneyness" name="Moneyness" tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: 'Moneyness (%)', fill: '#71717a', fontSize: 10, position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="currentIV" name="IV%" tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: 'IV%', fill: '#71717a', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }}
                    formatter={(v: number, name: string) => [`${v?.toFixed(2)}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Scatter
                    name="当前IV (30D)"
                    data={ivSurface?.surface?.filter(s => s.expiry === 30).map(s => ({ moneyness: s.moneyness * 100, currentIV: s.currentIV }))}
                    fill="#3b82f6"
                  />
                  <Scatter
                    name="AI预测IV (30D)"
                    data={ivSurface?.surface?.filter(s => s.expiry === 30).map(s => ({ moneyness: s.moneyness * 100, currentIV: s.predictedIV }))}
                    fill="#f59e0b"
                    shape="triangle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
              {ivSurface?.surface.length === 0 && <div className="py-3 text-center text-xs text-zinc-500">{ivSurface.reason}</div>}
            </Card>

            {/* IVS Arbitrage Signals */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                波动率套利机会
              </h3>
              <div className="space-y-2">
                {ivSurface?.arbitrageSignals?.slice(0, 10).map((sig, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-800/50 rounded p-2 text-xs">
                    <Badge className={signalBadge(sig.signal)}>{sig.signal}</Badge>
                    <span className="text-zinc-400">到期: {sig.expiry}D</span>
                    <span className="text-zinc-400">行权价: ${sig.strike?.toFixed(2)}</span>
                    <span className="text-zinc-300">当前IV: <span className="text-blue-400">{sig.currentIV?.toFixed(2)}%</span></span>
                    <span className="text-zinc-300">预测IV: <span className="text-yellow-400">{sig.predictedIV?.toFixed(2)}%</span></span>
                    <span className={`ml-auto font-bold ${sig.ivDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {sig.ivDiff > 0 ? '+' : ''}{sig.ivDiff?.toFixed(3)}%
                    </span>
                  </div>
                ))}
                {(!ivSurface?.arbitrageSignals || ivSurface.arbitrageSignals.length === 0) && (
                  <div className="text-zinc-500 text-center py-4">{ivSurface?.reason ?? '当前无可验证的套利信号'}</div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* -- 全球期货 ------------------------------------------------ */}
          <TabsContent value="futures" className="space-y-4">
            {globalFutures?.map(category => (
              <Card key={category.category} className="bg-zinc-900 border-zinc-800 p-4">
                <h3 className="text-sm font-bold text-zinc-300 mb-3">{category.category}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="px-2 py-1 text-left">代码</th>
                        <th className="px-2 py-1 text-left">名称</th>
                        <th className="px-2 py-1 text-right">最新</th>
                        <th className="px-2 py-1 text-right">涨跌</th>
                        <th className="px-2 py-1 text-right">涨跌%</th>
                        <th className="px-2 py-1 text-right">成交量</th>
                        <th className="px-2 py-1 text-right">持仓量</th>
                        <th className="px-2 py-1 text-right">最高</th>
                        <th className="px-2 py-1 text-right">最低</th>
                        <th className="px-2 py-1 text-right">结算价</th>
                        <th className="px-2 py-1 text-left">交易所</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item, i) => (
                        <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-800/40">
                          <td className="px-2 py-1 font-bold text-yellow-400">{item.ticker}</td>
                          <td className="px-2 py-1 text-zinc-300">{item.name}</td>
                          <td className="px-2 py-1 text-right font-bold text-zinc-100">{item.last?.toFixed(item.last > 100 ? 2 : 4)}</td>
                          <td className={`px-2 py-1 text-right font-bold ${clr(item.chg)}`}>{item.chg >= 0 ? '+' : ''}{item.chg?.toFixed(item.last > 100 ? 2 : 4)}</td>
                          <td className={`px-2 py-1 text-right ${clr(item.chgPct)}`}>{item.chgPct >= 0 ? '+' : ''}{item.chgPct?.toFixed(2)}%</td>
                          <td className="px-2 py-1 text-right text-zinc-400">{fmtK(item.vol)}</td>
                          <td className="px-2 py-1 text-right text-zinc-500">{fmtK(item.oi)}</td>
                          <td className="px-2 py-1 text-right text-green-400">{item.high?.toFixed(item.last > 100 ? 2 : 4)}</td>
                          <td className="px-2 py-1 text-right text-red-400">{item.low?.toFixed(item.last > 100 ? 2 : 4)}</td>
                          <td className="px-2 py-1 text-right text-zinc-400">{item.settle?.toFixed(item.last > 100 ? 2 : 4)}</td>
                          <td className="px-2 py-1 text-left text-zinc-500">{item.exchange}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
            {globalFutures?.length === 0 && (
              <div className="border border-zinc-800 bg-zinc-900 px-4 py-8 text-center text-xs text-amber-300">
                全球期货授权行情源未配置；不展示写死或随机报价。
              </div>
            )}
          </TabsContent>

          {/* -- 套利信号扫描 -------------------------------------------- */}
          <TabsContent value="arbitrage" className="space-y-4">
            <Card className="bg-orange-950/20 border-orange-800/40 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 font-bold text-sm">跨市场套利信号扫描引擎</span>
                <span className="text-zinc-500 text-xs ml-2">基于Put-Call平价偏差 + 波动率曲面异常</span>
                <Badge className="ml-auto bg-orange-900/60 text-orange-300 border-orange-700 text-xs">
                  {arbitrageSignals?.length || 0} 信号
                </Badge>
              </div>
            </Card>

            <div className="space-y-2">
              {arbitrageSignals?.map((sig, i) => (
                <Card key={i} className={`border p-3 ${sig.score > 0.02 ? 'bg-orange-950/20 border-orange-800/40' : 'bg-zinc-900 border-zinc-800'}`}>
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="font-bold text-yellow-400 text-sm">{sig.symbol}</span>
                    <Badge className={signalBadge(sig.signal)}>{sig.signal}</Badge>
                    <span className="text-zinc-400">行权价: <span className="text-zinc-200">${sig.strike}</span></span>
                    <span className="text-zinc-400">到期: <span className="text-zinc-200">{sig.expiry}</span></span>
                    <span className="text-zinc-400">套利分数: <span className={sig.score > 0.02 ? 'text-orange-400 font-bold' : 'text-zinc-300'}>{(sig.score * 100).toFixed(2)}%</span></span>
                    <span className="text-zinc-500 flex-1 min-w-0">{sig.description}</span>
                  </div>
                </Card>
              ))}
              {(!arbitrageSignals || arbitrageSignals.length === 0) && (
                <div className="text-center text-zinc-500 py-8">授权期权链未配置，当前没有可验证的套利信号。</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== 深度可视化升级：期权Greeks热力图 & 持仓量 ===== */}
      <div className="mt-4 border-t border-zinc-800 space-y-4 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">期权Greeks分布 & 期货持仓量变化</h3>
          <div className="flex gap-1">
            {(['1W','1M','3M','1Y'] as const).map(t => (
              <button key={t} onClick={() => setFomTimeframe(t)}
                className={`px-2 py-0.5 text-xs rounded ${fomTimeframe===t?'bg-orange-600 text-white':'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}>{t}</button>
            ))}
            <button disabled={greeksData.length === 0} onClick={() => {
              if (!greeksData.length) return;
              const rows = greeksData.map(d => `${d.strike},${d.callDelta},${d.putDelta}`).join('\n');
              const blob = new Blob([`Strike,CallDelta,PutDelta\n${rows}`], {type:'text/csv'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'greeks.csv'; a.click();
              URL.revokeObjectURL(url);
            }} className="px-2 py-0.5 text-xs rounded bg-green-800 text-green-300 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 ml-1">↓CSV</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 rounded p-3">
            <p className="text-xs text-zinc-400 mb-2">期权Delta分布（Call vs Put，按执行价）</p>
            {greeksData.length ? <ResponsiveContainer width="100%" height={190}>
              <BarChart data={greeksData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="strike" tick={{fill:'#9ca3af',fontSize:9}} />
                <YAxis tick={{fill:'#9ca3af',fontSize:10}} domain={[-1,1]} />
                <ChartTooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',color:'#fff',fontSize:11}} />
                <Legend wrapperStyle={{fontSize:10}} />
                <ReferenceLine y={0} stroke="#6b7280" />
                <Bar dataKey="callDelta" fill="#22c55e" name="Call Delta" radius={[2,2,0,0]} />
                <Bar dataKey="putDelta" fill="#ef4444" name="Put Delta" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer> : <div className="flex h-[190px] items-center justify-center border border-zinc-800 px-4 text-center text-xs text-amber-300">
              {chainLoading ? '正在读取期权链…' : chainData?.reason ?? '期权链数据源未配置；未生成替代 Delta。'}
            </div>}
          </div>
          <div className="bg-zinc-900 rounded p-3">
            <p className="text-xs text-zinc-400 mb-2">主力期货合约持仓量变化（万手）</p>
            {oiData.length ? <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={oiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:9}} />
                <YAxis tick={{fill:'#9ca3af',fontSize:10}} unit="万" />
                <ChartTooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',color:'#fff',fontSize:11}} />
                <Legend wrapperStyle={{fontSize:10}} />
                <Area type="monotone" dataKey="es" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} name="ES(标普)" />
                <Area type="monotone" dataKey="nq" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.3} name="NQ(纳指)" />
                <Area type="monotone" dataKey="cl" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="CL(原油)" />
              </AreaChart>
            </ResponsiveContainer> : <div className="flex h-[190px] flex-col items-center justify-center border border-zinc-800 px-4 text-center text-xs text-amber-300">
              <span>未配置授权期货持仓量数据源</span>
              <span className="mt-2 text-zinc-500">状态 unavailable · 观测时间未提供 · 当前未生成 ES、NQ、CL 替代曲线</span>
            </div>}
          </div>
        </div>
      </div>
    </div>}
    </OpenBBModuleDataBand>
  );
}
