import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, AreaChart, Area, Cell, ReferenceLine
} from 'recharts';
import { Sunrise, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

const OVERNIGHT_SUMMARY = [
  { asset: 'S&P 500 Futures', ticker: 'ES1', price: 5628.5, change: 0.42, volume: '1.2M', region: 'US' },
  { asset: 'Nasdaq 100 Futures', ticker: 'NQ1', price: 20184.0, change: 0.68, volume: '0.8M', region: 'US' },
  { asset: 'Nikkei 225', ticker: 'NKY', price: 39842.0, change: -0.28, volume: '2.1B', region: 'JP' },
  { asset: 'Hang Seng', ticker: 'HSI', price: 18256.0, change: 1.24, volume: '85B', region: 'HK' },
  { asset: 'Euro Stoxx 50', ticker: 'SX5E', price: 4892.0, change: 0.18, volume: '1.8B', region: 'EU' },
  { asset: '10Y Treasury', ticker: 'TY1', price: 4.285, change: -0.032, volume: '—', region: 'US' },
  { asset: 'WTI Crude', ticker: 'CL1', price: 82.45, change: 0.85, volume: '420K', region: 'CMDTY' },
  { asset: 'Gold', ticker: 'GC1', price: 2348.0, change: 0.22, volume: '180K', region: 'CMDTY' },
  { asset: 'EUR/USD', ticker: 'EURUSD', price: 1.0842, change: 0.12, volume: '—', region: 'FX' },
  { asset: 'USD/JPY', ticker: 'USDJPY', price: 161.25, change: 0.38, volume: '—', region: 'FX' },
];

const SECTOR_PREMARKET = [
  { sector: '科技', change: 0.85, color: '#22c55e' },
  { sector: '医疗', change: 0.42, color: '#22c55e' },
  { sector: '金融', change: 0.28, color: '#22c55e' },
  { sector: '工业', change: 0.15, color: '#22c55e' },
  { sector: '消费', change: -0.12, color: '#ef4444' },
  { sector: '能源', change: 0.62, color: '#22c55e' },
  { sector: '公用', change: -0.28, color: '#ef4444' },
  { sector: '材料', change: 0.18, color: '#22c55e' },
];

const TODAY_EVENTS = [
  { time: '08:30', event: '美国非农就业（6月）', importance: 'CRITICAL', consensus: '+185K', prev: '+272K' },
  { time: '08:30', event: '美国失业率（6月）', importance: 'HIGH', consensus: '4.0%', prev: '4.0%' },
  { time: '10:00', event: '密歇根大学消费者信心（7月初）', importance: 'MEDIUM', consensus: '68.5', prev: '68.2' },
  { time: '13:00', event: '美国3年期国债拍卖', importance: 'MEDIUM', consensus: '—', prev: '4.52%' },
  { time: '15:00', event: '美联储官员Waller发言', importance: 'HIGH', consensus: '—', prev: '—' },
];

const OVERNIGHT_RETURNS = Array.from({ length: 5 }, (_, i) => ({
  session: ['亚盘','欧盘','美盘','盘后','当前'][i],
  spx: [0.12, 0.28, -0.08, 0.18, 0.42][i],
  ndx: [0.22, 0.35, -0.05, 0.28, 0.68][i],
  bonds: [-0.05, -0.12, 0.08, -0.02, -0.032][i],
}));

export default function MREPPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('overnight');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#070a0e] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/40 bg-[#0b0d16] shrink-0">
        <div className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-bold text-sm">MREP</span>
          <span className="text-gray-500">Morning Report · 隔夜行情 · 盘前板块 · 今日事件</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0b0d16] border-b border-amber-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'overnight',label:'隔夜行情'},
            {id:'sectors',label:'盘前板块'},
            {id:'events',label:'今日事件'},
            {id:'sessions',label:'分时收益'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overnight" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">全球主要资产隔夜表现（截至 07:00 ET）</div>
          <div className="space-y-1">
            {OVERNIGHT_SUMMARY.map((a, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-1.5 flex items-center gap-3">
                <span className="text-gray-500 w-4 text-right">{i+1}</span>
                <div className="flex-1">
                  <span className="text-white">{a.asset}</span>
                  <span className="text-gray-600 ml-2">{a.ticker}</span>
                </div>
                <span className="text-gray-300 w-20 text-right font-mono">{a.price.toLocaleString()}</span>
                <span className="font-bold w-14 text-right" style={{ color: a.change >= 0 ? '#22c55e' : '#ef4444' }}>
                  {a.change >= 0 ? '+' : ''}{a.change}%
                </span>
                <Badge className="text-xs border-0 px-1 w-12 text-center" style={{
                  backgroundColor: a.region === 'US' ? '#1e3a5f' : a.region === 'JP' ? '#1a2e1a' : a.region === 'HK' ? '#2d1a00' : '#1a1a2e',
                  color: a.region === 'US' ? '#60a5fa' : a.region === 'JP' ? '#86efac' : a.region === 'HK' ? '#fcd34d' : '#c4b5fd'
                }}>{a.region}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sectors" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">标普500各板块盘前涨跌幅</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={SECTOR_PREMARKET} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v=>`${v}%`} />
                <YAxis type="category" dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 9 }} width={35} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <ReferenceLine x={0} stroke="#374151" />
                <Bar dataKey="change" name="涨跌幅%">
                  {SECTOR_PREMARKET.map((e, i) => <Cell key={i} fill={e.change >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="events" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">今日重要经济事件（ET时区）</div>
          <div className="space-y-2">
            {TODAY_EVENTS.map((e, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border border-gray-800/50">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <div className="text-amber-400 font-bold">{e.time}</div>
                    <Badge className="text-xs border-0 mt-0.5 px-1" style={{
                      backgroundColor: e.importance === 'CRITICAL' ? '#4c1d95' : e.importance === 'HIGH' ? '#7f1d1d' : '#78350f',
                      color: e.importance === 'CRITICAL' ? '#c4b5fd' : e.importance === 'HIGH' ? '#fca5a5' : '#fcd34d',
                    }}>{e.importance}</Badge>
                  </div>
                  <div className="flex-1">
                    <div className="text-white">{e.event}</div>
                    <div className="flex gap-4 mt-0.5 text-xs">
                      <span className="text-gray-500">预期: <span className="text-blue-400">{e.consensus}</span></span>
                      <span className="text-gray-500">前值: <span className="text-gray-400">{e.prev}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">各交易时段累计收益贡献（SPX / NDX / 10Y债券）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={OVERNIGHT_RETURNS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="session" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v=>`${v}%`} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <ReferenceLine y={0} stroke="#374151" />
                <Bar dataKey="spx" name="SPX" fill="#3b82f6" fillOpacity={0.8} />
                <Bar dataKey="ndx" name="NDX" fill="#22c55e" fillOpacity={0.8} />
                <Bar dataKey="bonds" name="10Y债券" fill="#f59e0b" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
