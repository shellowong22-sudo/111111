import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { User, Heart, Clock, TrendingUp } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

// 个性化推荐新闻
const PERSONALIZED_NEWS = [
  {
    title: 'NVIDIA数据中心营收Q2预计达220亿美元，超市场预期',
    match: 98, category: 'AI/半导体', tickers: ['NVDA'], time: '2小时前',
    reason: '基于您对NVDA的高关注度和AI主题偏好'
  },
  {
    title: '美联储会议纪要：多数官员支持9月降息',
    match: 95, category: '宏观政策', tickers: ['SPY','TLT'], time: '3小时前',
    reason: '基于您对美联储政策的持续关注'
  },
  {
    title: '苹果Vision Pro销量超预期，AR/VR市场重新定价',
    match: 88, category: '科技', tickers: ['AAPL','META'], time: '5小时前',
    reason: '基于您的科技板块持仓偏好'
  },
  {
    title: '黄金突破2400美元，避险需求推动创历史新高',
    match: 82, category: '大宗商品', tickers: ['GLD','GDX'], time: '6小时前',
    reason: '基于您对通胀对冲资产的关注'
  },
  {
    title: '私募信贷市场规模突破2万亿，银行监管收紧加速转移',
    match: 78, category: '另类投资', tickers: ['BX','APO'], time: '8小时前',
    reason: '基于您对另类资产的研究历史'
  },
];

// 关注标的新闻量（近7日）
const WATCHLIST_NEWS = [
  { ticker: 'NVDA', news_count: 48, sentiment: 82, price_chg: 3.8 },
  { ticker: 'AAPL', news_count: 35, sentiment: 68, price_chg: 1.2 },
  { ticker: 'MSFT', news_count: 28, sentiment: 75, price_chg: 0.8 },
  { ticker: 'TSLA', news_count: 52, sentiment: 38, price_chg: -3.1 },
  { ticker: 'META', news_count: 22, sentiment: 72, price_chg: 2.4 },
  { ticker: 'AMZN', news_count: 18, sentiment: 65, price_chg: 1.5 },
];

// 阅读习惯分析（按时间段）
const READING_HABIT = [
  { hour: '06:00', reads: 12 }, { hour: '07:00', reads: 28 },
  { hour: '08:00', reads: 45 }, { hour: '09:00', reads: 62 },
  { hour: '10:00', reads: 38 }, { hour: '11:00', reads: 25 },
  { hour: '12:00', reads: 32 }, { hour: '13:00', reads: 18 },
  { hour: '14:00', reads: 22 }, { hour: '15:00', reads: 35 },
  { hour: '16:00', reads: 48 }, { hour: '17:00', reads: 42 },
  { hour: '18:00', reads: 28 }, { hour: '19:00', reads: 15 },
];

// 阅读偏好分类
const PREF_DATA = [
  { name: 'AI/科技', value: 35, color: '#3b82f6' },
  { name: '宏观政策', value: 28, color: '#f59e0b' },
  { name: '股票分析', value: 18, color: '#22c55e' },
  { name: '大宗商品', value: 10, color: '#ef4444' },
  { name: '其他', value: 9, color: '#6b7280' },
];

export default function MYNPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('recommend');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#080a10] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-violet-900/40 bg-[#0b0d18] shrink-0">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-violet-400" />
          <span className="text-violet-400 font-bold text-sm">MYN</span>
          <span className="text-gray-500">我的新闻 · AI推荐 · 关注列表 · 阅读分析</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0b0d18] border-b border-violet-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'recommend',label:'AI推荐'},
            {id:'watchlist',label:'关注列表'},
            {id:'habit',label:'阅读习惯'},
            {id:'preference',label:'偏好分析'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-violet-900/40 data-[state=active]:text-violet-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="recommend" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">基于您的阅读偏好和持仓，AI推荐以下新闻</div>
          <div className="space-y-2">
            {PERSONALIZED_NEWS.map((n, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border border-violet-900/20 hover:border-violet-700/40">
                <div className="flex items-start gap-2">
                  <div className="shrink-0 text-center">
                    <div className="text-violet-400 font-bold text-sm">{n.match}%</div>
                    <div className="text-gray-600 text-xs">匹配</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className="bg-violet-900/40 text-violet-300 border-0 text-xs px-1.5">{n.category}</Badge>
                      <span className="text-gray-500 text-xs">{n.time}</span>
                    </div>
                    <p className="text-white">{n.title}</p>
                    <div className="flex gap-1 mt-1">
                      {n.tickers.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-blue-400">{t}</span>
                      ))}
                    </div>
                    <div className="text-gray-600 text-xs mt-0.5">{n.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="watchlist" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">关注标的近7日新闻量 & 情绪分 & 涨跌幅</div>
          <div className="space-y-2">
            {WATCHLIST_NEWS.map((w, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 border border-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-violet-400 font-bold w-12">{w.ticker}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-gray-400 text-xs">{w.news_count}条新闻</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${w.sentiment}%`, backgroundColor: w.sentiment >= 60 ? '#22c55e' : w.sentiment >= 40 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span className="text-gray-500 text-xs w-14">情绪{w.sentiment}</span>
                    </div>
                  </div>
                  <div className="font-bold" style={{ color: w.price_chg >= 0 ? '#22c55e' : '#ef4444' }}>
                    {w.price_chg >= 0 ? '+' : ''}{w.price_chg}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="habit" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">今日阅读时间分布（按小时）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={READING_HABIT}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 8 }} interval={1} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Bar dataKey="reads" name="阅读量" radius={[2,2,0,0]}>
                  {READING_HABIT.map((e, i) => (
                    <Cell key={i} fill={e.reads >= 40 ? '#8b5cf6' : e.reads >= 25 ? '#6d28d9' : '#4c1d95'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="preference" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">您的阅读偏好分布（近30日）</div>
          <div className="flex gap-4">
            <div className="bg-gray-900/60 rounded p-2 flex-1">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={PREF_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {PREF_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<EnhancedTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {PREF_DATA.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-gray-400 flex-1">{p.name}</span>
                  <span className="font-bold" style={{ color: p.color }}>{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
