import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, AreaChart, Area, ReferenceLine, Cell
} from 'recharts';
import { Sunrise, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

// 盘前期货数据
const PRE_MARKET = [
  { name: 'ES (S&P 500)', price: 5485.25, change: 12.50, pct: 0.23, color: '#22c55e' },
  { name: 'NQ (Nasdaq)', price: 19842.50, change: 85.25, pct: 0.43, color: '#22c55e' },
  { name: 'YM (Dow)', price: 39285.00, change: -45.00, pct: -0.11, color: '#ef4444' },
  { name: 'RTY (Russell)', price: 2045.80, change: 8.20, pct: 0.40, color: '#22c55e' },
  { name: 'VIX', price: 13.42, change: -0.38, pct: -2.75, color: '#22c55e' },
  { name: 'DXY', price: 104.82, change: 0.15, pct: 0.14, color: '#ef4444' },
  { name: 'Gold', price: 2348.50, change: 5.20, pct: 0.22, color: '#22c55e' },
  { name: 'WTI Oil', price: 83.45, change: 0.85, pct: 1.03, color: '#22c55e' },
];

// 今日关键事件时间线
const TODAY_EVENTS = [
  { time: '08:30', event: '美国6月非农就业报告', importance: 'CRITICAL', consensus: '预期+185K', prior: '+272K', impact: '美元/债券/股市' },
  { time: '08:30', event: '美国6月失业率', importance: 'HIGH', consensus: '预期3.9%', prior: '4.0%', impact: '美元/债券' },
  { time: '10:00', event: '美国6月ISM非制造业PMI', importance: 'HIGH', consensus: '预期53.0', prior: '53.8', impact: '股市/债券' },
  { time: '11:00', event: '美联储理事沃勒发言', importance: 'HIGH', consensus: '关注降息信号', prior: '', impact: '美元/债券' },
  { time: '13:00', event: '美国财政部3年期国债拍卖', importance: 'MEDIUM', consensus: '580亿美元', prior: '需求强劲', impact: '债券' },
  { time: '15:00', event: '美联储消费信贷数据', importance: 'LOW', consensus: '预期+100亿', prior: '+62亿', impact: '消费板块' },
];

// 近5日盘前 vs 实际收盘对比
const PREMARKET_VS_CLOSE = [
  { day: '6/28', premarket: 0.35, close: 0.28, diff: -0.07 },
  { day: '6/29', premarket: -0.22, close: -0.18, diff: 0.04 },
  { day: '6/30', premarket: 0.48, close: 0.52, diff: 0.04 },
  { day: '7/1', premarket: 0.15, close: 0.22, diff: 0.07 },
  { day: '7/2', premarket: 0.62, close: 0.58, diff: -0.04 },
];

// 今日开盘预测（分析师预测）
const OPEN_FORECAST = [
  { analyst: 'Goldman Sachs', spy_target: 5490, confidence: 72, rationale: '非农数据超预期将推动上涨' },
  { analyst: 'JPMorgan', spy_target: 5475, confidence: 65, rationale: '关注失业率数据，谨慎乐观' },
  { analyst: 'Morgan Stanley', spy_target: 5465, confidence: 58, rationale: '技术面阻力位5500，谨慎' },
];

// 盘前个股异动
const PRE_MOVERS = [
  { ticker: 'NVDA', name: 'NVIDIA', pct: 4.2, reason: '分析师上调目标价至1350', volume_ratio: 3.8 },
  { ticker: 'TSLA', name: 'Tesla', pct: -3.1, reason: 'Q2交付量低于预期', volume_ratio: 5.2 },
  { ticker: 'AAPL', name: 'Apple', pct: 1.8, reason: 'iPhone 16预订量超预期', volume_ratio: 2.1 },
  { ticker: 'META', name: 'Meta', pct: 2.4, reason: 'Llama 4发布，AI广告收入预期上调', volume_ratio: 2.8 },
  { ticker: 'INTC', name: 'Intel', pct: -5.6, reason: '下调Q3营收指引', volume_ratio: 6.4 },
];

export default function DAYBPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('premarket');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#06080f] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/40 bg-[#090b18] shrink-0">
        <div className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-bold text-sm">DAYB</span>
          <span className="text-gray-500">佑诚早间新闻 · 盘前概览 · 今日事件 · 开盘预测</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#090b18] border-b border-amber-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'premarket',label:'盘前期货'},
            {id:'events',label:'今日事件'},
            {id:'movers',label:'盘前异动'},
            {id:'forecast',label:'开盘预测'},
            {id:'accuracy',label:'盘前准确率'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="premarket" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">今日盘前期货行情（美东时间 07:30）</div>
          <div className="grid grid-cols-2 gap-2">
            {PRE_MARKET.map((f, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 flex items-center justify-between border border-gray-800/50">
                <div>
                  <div className="text-white font-medium">{f.name}</div>
                  <div className="text-gray-400">{f.price.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: f.color }}>
                    {f.pct >= 0 ? '+' : ''}{f.pct.toFixed(2)}%
                  </div>
                  <div className="text-xs" style={{ color: f.color }}>
                    {f.change >= 0 ? '+' : ''}{f.change.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="events" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">今日关键经济事件时间线</div>
          <div className="space-y-2">
            {TODAY_EVENTS.map((e, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border-l-2"
                style={{ borderLeftColor: e.importance === 'CRITICAL' ? '#7c3aed' : e.importance === 'HIGH' ? '#ef4444' : e.importance === 'MEDIUM' ? '#f59e0b' : '#374151' }}>
                <div className="flex items-start gap-3">
                  <div className="shrink-0 text-center w-12">
                    <div className="text-amber-400 font-bold">{e.time}</div>
                    <Badge className="text-xs border-0 px-1 mt-0.5" style={{
                      backgroundColor: e.importance === 'CRITICAL' ? '#4c1d95' : e.importance === 'HIGH' ? '#7f1d1d' : e.importance === 'MEDIUM' ? '#78350f' : '#1f2937',
                      color: e.importance === 'CRITICAL' ? '#c4b5fd' : e.importance === 'HIGH' ? '#fca5a5' : e.importance === 'MEDIUM' ? '#fcd34d' : '#9ca3af',
                      fontSize: '9px'
                    }}>{e.importance}</Badge>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{e.event}</div>
                    <div className="flex gap-3 mt-0.5 text-gray-500">
                      <span>{e.consensus}</span>
                      {e.prior && <span>前值: {e.prior}</span>}
                    </div>
                    <div className="text-xs text-blue-400 mt-0.5">影响: {e.impact}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="movers" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">盘前个股异动（成交量倍数 vs 20日均量）</div>
          <div className="space-y-2">
            {PRE_MOVERS.map((m, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-14">
                    <div className="text-amber-400 font-bold">{m.ticker}</div>
                    <div className="text-gray-500 text-xs">{m.name}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-300">{m.reason}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs">成交量: {m.volume_ratio}x均量</span>
                    </div>
                  </div>
                  <div className="font-bold text-base" style={{ color: m.pct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {m.pct >= 0 ? '+' : ''}{m.pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">主要机构开盘预测（SPY目标点位）</div>
          <div className="space-y-3">
            {OPEN_FORECAST.map((f, i) => (
              <div key={i} className="bg-gray-900/60 rounded p-3 border border-amber-900/30">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-amber-400 font-bold">{f.analyst}</span>
                  <span className="text-white font-bold text-base">SPY {f.spy_target}</span>
                  <Badge className="bg-blue-900/40 text-blue-300 border-0 text-xs">置信度 {f.confidence}%</Badge>
                </div>
                <p className="text-gray-400">{f.rationale}</p>
                <div className="mt-1.5 bg-gray-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${f.confidence}%` }} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="accuracy" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">近5日盘前预测 vs 实际收盘涨跌幅（%）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={PREMARKET_VS_CLOSE}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <ReferenceLine y={0} stroke="#374151" />
                <Bar dataKey="premarket" name="盘前预测%" fill="#f59e0b" fillOpacity={0.7} />
                <Bar dataKey="close" name="实际收盘%" fill="#3b82f6" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
