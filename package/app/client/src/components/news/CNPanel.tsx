import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, ComposedChart,
  ScatterChart, Scatter, Cell, ReferenceLine
} from 'recharts';
import { Building2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

const COMPANY_NEWS = [
  { ticker: 'NVDA', name: 'NVIDIA', title: 'Blackwell GPU出货量超预期，Q3营收指引上调至350亿', time: '09:15', sentiment: 'bullish', change: 4.2, volume: 'HIGH', category: '财报' },
  { ticker: 'AAPL', name: 'Apple', title: 'iPhone 16需求超预期，服务收入创历史新高', time: '10:30', sentiment: 'bullish', change: 1.8, volume: 'HIGH', category: '财报' },
  { ticker: 'TSLA', name: 'Tesla', title: 'Q2交付量环比下滑8%，FSD订阅收入增长抵消部分压力', time: '11:00', sentiment: 'bearish', change: -3.5, volume: 'HIGH', category: '财报' },
  { ticker: 'JPM', name: 'JPMorgan', title: 'Q2净利润188亿，但贷款损失拨备增加30%', time: '11:45', sentiment: 'neutral', change: 1.2, volume: 'MEDIUM', category: '财报' },
  { ticker: 'MSFT', name: 'Microsoft', title: 'Azure云收入增长29%，AI Copilot付费用户突破100万', time: '14:00', sentiment: 'bullish', change: 2.1, volume: 'HIGH', category: '业绩' },
  { ticker: 'META', name: 'Meta', title: 'Threads月活突破2亿，广告收入Q3指引超预期', time: '15:30', sentiment: 'bullish', change: 3.8, volume: 'HIGH', category: '业绩' },
];

// 分析师评级变化（近30日）
const RATING_CHANGES = [
  { ticker: 'NVDA', from: 'Buy', to: 'Strong Buy', firm: 'Goldman Sachs', target: 1350, prevTarget: 1100, date: '7/4' },
  { ticker: 'AAPL', from: 'Neutral', to: 'Buy', firm: 'UBS', target: 220, prevTarget: 195, date: '7/3' },
  { ticker: 'TSLA', from: 'Buy', to: 'Hold', firm: 'Morgan Stanley', target: 200, prevTarget: 250, date: '7/2' },
  { ticker: 'META', from: 'Hold', to: 'Buy', firm: 'JPMorgan', target: 580, prevTarget: 480, date: '7/1' },
  { ticker: 'AMZN', from: 'Buy', to: 'Strong Buy', firm: 'Citi', target: 230, prevTarget: 200, date: '6/30' },
  { ticker: 'GOOGL', from: 'Neutral', to: 'Buy', firm: 'Barclays', target: 195, prevTarget: 170, date: '6/28' },
];

// 财报日历（未来2周）
const EARNINGS_CALENDAR = [
  { date: '7/8', ticker: 'PEP', name: '百事可乐', eps_est: 2.16, rev_est: '22.5B', importance: 2 },
  { date: '7/9', ticker: 'DAL', name: '达美航空', eps_est: 2.35, rev_est: '15.4B', importance: 2 },
  { date: '7/11', ticker: 'JPM', name: '摩根大通', eps_est: 4.19, rev_est: '42.1B', importance: 3 },
  { date: '7/12', ticker: 'C', name: '花旗集团', eps_est: 1.39, rev_est: '20.1B', importance: 3 },
  { date: '7/12', ticker: 'WFC', name: '富国银行', eps_est: 1.29, rev_est: '20.8B', importance: 3 },
  { date: '7/15', ticker: 'GS', name: '高盛', eps_est: 8.73, rev_est: '12.4B', importance: 3 },
  { date: '7/16', ticker: 'NFLX', name: '奈飞', eps_est: 4.74, rev_est: '9.5B', importance: 3 },
  { date: '7/17', ticker: 'TSLA', name: '特斯拉', eps_est: 0.62, rev_est: '24.8B', importance: 3 },
];

// 内部人交易（近7日）
const INSIDER_TRADES = [
  { ticker: 'NVDA', name: '黄仁勋', role: 'CEO', type: 'sell', shares: 120000, value: 145.2, date: '7/3' },
  { ticker: 'MSFT', name: 'Satya Nadella', role: 'CEO', type: 'sell', shares: 50000, value: 21.4, date: '7/2' },
  { ticker: 'META', name: 'Mark Zuckerberg', role: 'CEO', type: 'sell', shares: 200000, value: 95.8, date: '7/1' },
  { ticker: 'AMZN', name: 'Andy Jassy', role: 'CEO', type: 'buy', shares: 10000, value: 1.9, date: '6/30' },
  { ticker: 'AAPL', name: 'Tim Cook', role: 'CEO', type: 'sell', shares: 80000, value: 14.2, date: '6/28' },
];

// 板块情绪分布
const SECTOR_SENTIMENT = [
  { sector: '科技', bullish: 68, neutral: 22, bearish: 10 },
  { sector: '金融', bullish: 45, neutral: 35, bearish: 20 },
  { sector: '能源', bullish: 52, neutral: 28, bearish: 20 },
  { sector: '医疗', bullish: 58, neutral: 30, bearish: 12 },
  { sector: '消费', bullish: 42, neutral: 38, bearish: 20 },
  { sector: '工业', bullish: 48, neutral: 32, bearish: 20 },
];

export default function CNPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('news');
  const loading = useChartLoading(600);
  const [filter, setFilter] = useState('全部');
  const categories = ['全部', '财报', '业绩', '并购', '评级', '内部人'];

  return (
    <div className="h-full flex flex-col bg-[#080c10] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/40 bg-[#0a1014] shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-bold text-sm">CN</span>
          <span className="text-gray-500">公司新闻 · 财报 · 评级变化 · 内部人交易</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0a1014] border-b border-green-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'news',label:'公司新闻'},
            {id:'ratings',label:'评级变化'},
            {id:'earnings',label:'财报日历'},
            {id:'insider',label:'内部人交易'},
            {id:'sentiment',label:'板块情绪'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-green-900/40 data-[state=active]:text-green-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="news" className="flex-1 overflow-hidden m-0 p-0 flex flex-col">
          <div className="flex gap-1 px-2 py-1.5 border-b border-green-900/20 flex-wrap shrink-0">
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`px-2 py-0.5 rounded text-xs ${filter === c ? 'bg-green-900/60 text-green-300' : 'text-gray-500 hover:text-gray-300'}`}>{c}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {COMPANY_NEWS.map((n, i) => (
              <div key={i} className="px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-900/40">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 text-center w-12">
                    <div className="text-green-400 font-bold">{n.ticker}</div>
                    <div className="text-gray-600 text-xs">{n.time}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className="text-xs border-0 px-1.5 bg-gray-800/60 text-gray-400">{n.category}</Badge>
                      <span className="text-gray-500">{n.name}</span>
                    </div>
                    <p className="text-gray-200">{n.title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold" style={{ color: n.change >= 0 ? '#22c55e' : '#ef4444' }}>
                      {n.change >= 0 ? '+' : ''}{n.change}%
                    </div>
                    <div className="text-gray-600 text-xs">{n.volume}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ratings" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">近30日分析师评级变化</div>
          <div className="space-y-2">
            {RATING_CHANGES.map((r, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 border border-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-bold w-12">{r.ticker}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-gray-400">{r.from}</span>
                    <span className="text-gray-600">→</span>
                    <span className="font-bold" style={{ color: r.to.includes('Buy') ? '#22c55e' : r.to === 'Hold' ? '#f59e0b' : '#ef4444' }}>{r.to}</span>
                    <span className="text-gray-500 text-xs">by {r.firm}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">目标价</div>
                    <div className="font-bold text-white">${r.target}</div>
                    <div className="text-xs" style={{ color: r.target > r.prevTarget ? '#22c55e' : '#ef4444' }}>
                      {r.target > r.prevTarget ? '↑' : '↓'} ${Math.abs(r.target - r.prevTarget)}
                    </div>
                  </div>
                  <span className="text-gray-600 text-xs">{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="earnings" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">未来2周财报日历</div>
          <div className="space-y-1.5">
            {EARNINGS_CALENDAR.map((e, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 border border-gray-800/50 hover:border-green-900/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-14">
                    <div className="text-blue-400 font-bold text-xs">{e.date}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-bold">{e.ticker}</span>
                      <span className="text-gray-400">{e.name}</span>
                    </div>
                    <div className="flex gap-4 mt-0.5 text-xs text-gray-500">
                      <span>EPS预期: <span className="text-gray-300">${e.eps_est}</span></span>
                      <span>营收预期: <span className="text-gray-300">{e.rev_est}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: 3 }, (_, j) => (
                      <div key={j} className="w-2 h-2 rounded-full" style={{ backgroundColor: j < e.importance ? '#ef4444' : '#374151' }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insider" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-3 h-3 text-orange-400" />
            <span className="text-gray-400">近7日高管内部人交易（SEC Form 4）</span>
          </div>
          <div className="space-y-2">
            {INSIDER_TRADES.map((t, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 border border-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-bold w-12">{t.ticker}</span>
                  <div className="flex-1">
                    <div className="text-white">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold" style={{ color: t.type === 'buy' ? '#22c55e' : '#ef4444' }}>
                      {t.type === 'buy' ? '买入' : '卖出'} {t.shares.toLocaleString()}股
                    </div>
                    <div className="text-gray-400 text-xs">${t.value}M</div>
                  </div>
                  <span className="text-gray-600 text-xs">{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">各板块公司新闻情绪分布（%）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={SECTOR_SENTIMENT} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <YAxis dataKey="sector" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={35} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Bar dataKey="bullish" name="利多%" stackId="a" fill="#22c55e" fillOpacity={0.8} />
                <Bar dataKey="neutral" name="中性%" stackId="a" fill="#6b7280" fillOpacity={0.8} />
                <Bar dataKey="bearish" name="利空%" stackId="a" fill="#ef4444" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
