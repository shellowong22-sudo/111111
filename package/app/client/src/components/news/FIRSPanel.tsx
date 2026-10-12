import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, ScatterChart, Scatter, Cell
} from 'recharts';
import { Zap, Trophy, TrendingUp, Clock } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

// 独家报道列表
const EXCLUSIVE_STORIES = [
  {
    id: 1, time: '06:42', title: '美联储内部讨论：9月降息25bp已基本确定',
    lead_time: 142, // 分钟领先
    market_reaction: { spy: 0.82, tlt: 1.24, gld: 0.45 },
    views: 284000, shares: 12400, category: '央行政策', confirmed: true
  },
  {
    id: 2, time: '08:15', title: 'NVIDIA与沙特阿美签署AI基础设施合作协议',
    lead_time: 87,
    market_reaction: { nvda: 3.8, amd: 1.2, smci: 2.4 },
    views: 198000, shares: 8900, category: '科技', confirmed: true
  },
  {
    id: 3, time: '09:30', title: '中国央行考虑下调存款准备金率50bp',
    lead_time: 65,
    market_reaction: { fxi: 2.1, cny: -0.3, eem: 0.8 },
    views: 156000, shares: 6700, category: '央行政策', confirmed: false
  },
  {
    id: 4, time: '11:00', title: '微软计划以650亿美元收购Activision补充协议',
    lead_time: 210,
    market_reaction: { msft: 1.5, atvi: 4.2 },
    views: 134000, shares: 5800, category: '并购', confirmed: true
  },
  {
    id: 5, time: '13:45', title: 'OPEC+紧急会议：讨论延长减产至2025年底',
    lead_time: 55,
    market_reaction: { cl: 2.8, xle: 1.9, uso: 2.2 },
    views: 112000, shares: 4900, category: '能源', confirmed: false
  },
];

// 独家报道领先时间 vs 市场反应散点
const LEAD_REACTION = [
  { lead: 210, reaction: 4.2, story: 'MSFT收购', size: 134 },
  { lead: 142, reaction: 1.24, story: '美联储降息', size: 284 },
  { lead: 87, reaction: 3.8, story: 'NVDA合作', size: 198 },
  { lead: 65, reaction: 2.1, story: '中国降准', size: 156 },
  { lead: 55, reaction: 2.8, story: 'OPEC+', size: 112 },
  { lead: 38, reaction: 0.9, story: '欧央行', size: 89 },
  { lead: 25, reaction: 1.5, story: '非农数据', size: 245 },
  { lead: 18, reaction: 0.6, story: '零售销售', size: 78 },
];

// 月度独家报道数量
const MONTHLY_EXCLUSIVES = [
  { month: '1月', count: 42, confirmed: 38, views_avg: 145 },
  { month: '2月', count: 38, confirmed: 35, views_avg: 132 },
  { month: '3月', count: 51, confirmed: 44, views_avg: 168 },
  { month: '4月', count: 45, confirmed: 40, views_avg: 155 },
  { month: '5月', count: 48, confirmed: 43, views_avg: 172 },
  { month: '6月', count: 56, confirmed: 49, views_avg: 189 },
];

// 记者影响力排行
const REPORTER_RANKING = [
  { name: 'Nick Timiraos', beat: '美联储', exclusives: 28, avg_lead: 145, accuracy: 96 },
  { name: 'Saleha Mohsin', beat: '财政部', exclusives: 22, avg_lead: 98, accuracy: 91 },
  { name: 'Jennifer Jacobs', beat: '白宫', exclusives: 19, avg_lead: 112, accuracy: 88 },
  { name: 'Tom Mackenzie', beat: '中国', exclusives: 17, avg_lead: 85, accuracy: 85 },
  { name: 'Javier Blas', beat: '能源', exclusives: 15, avg_lead: 72, accuracy: 89 },
];

export default function FIRSPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('stories');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#07080e] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-900/40 bg-[#0a0c14] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">FIRS</span>
          <span className="text-gray-500">佑诚率先报道 · 独家新闻 · 市场反应 · 记者影响力</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0a0c14] border-b border-yellow-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'stories',label:'独家报道'},
            {id:'scatter',label:'领先vs反应'},
            {id:'monthly',label:'月度统计'},
            {id:'reporters',label:'记者排行'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-yellow-900/40 data-[state=active]:text-yellow-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stories" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="space-y-3">
            {EXCLUSIVE_STORIES.map(s => (
              <div key={s.id} className="bg-gray-900/60 rounded p-3 border border-yellow-900/30">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 text-center">
                    <div className="text-yellow-400 font-bold">{s.time}</div>
                    <div className="text-gray-500 text-xs">+{s.lead_time}min</div>
                    <div className="text-xs mt-0.5" style={{ color: s.confirmed ? '#22c55e' : '#f59e0b' }}>
                      {s.confirmed ? '已证实' : '待证实'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-xs border-0 px-1.5 bg-yellow-900/40 text-yellow-300">{s.category}</Badge>
                      <Badge className="text-xs border-0 px-1.5 bg-purple-900/40 text-purple-300">EXCLUSIVE</Badge>
                    </div>
                    <p className="text-white font-medium">{s.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-gray-500">
                      <span>{(s.views/1000).toFixed(0)}K阅读</span>
                      <span>{s.shares.toLocaleString()}分享</span>
                    </div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {Object.entries(s.market_reaction).map(([ticker, chg]) => (
                        <span key={ticker} className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: (chg as number) >= 0 ? '#14532d' : '#7f1d1d', color: (chg as number) >= 0 ? '#86efac' : '#fca5a5' }}>
                          {ticker.toUpperCase()} {(chg as number) >= 0 ? '+' : ''}{chg}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scatter" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">独家报道领先时间 vs 市场反应幅度（气泡大小=阅读量K）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="lead" name="领先时间(分)" type="number" tick={{ fill: '#6b7280', fontSize: 9 }} label={{ value: '领先时间（分钟）', fill: '#6b7280', fontSize: 9, position: 'insideBottom', offset: -2 }} />
                <YAxis dataKey="reaction" name="市场反应%" type="number" tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Scatter data={LEAD_REACTION} fill="#f59e0b" fillOpacity={0.7} name="独家报道" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">月度独家报道数量 & 证实率</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_EXCLUSIVES}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Bar dataKey="count" name="总数" fill="#374151" fillOpacity={0.8} />
                <Bar dataKey="confirmed" name="已证实" fill="#22c55e" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="reporters" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span className="text-gray-400">记者影响力排行（独家数 / 平均领先时间 / 准确率）</span>
          </div>
          <div className="space-y-2">
            {REPORTER_RANKING.map((r, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border border-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold text-lg w-6">{i+1}</span>
                  <div className="flex-1">
                    <div className="text-white font-bold">{r.name}</div>
                    <div className="text-gray-500 text-xs">{r.beat}线记者</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-yellow-400 font-bold">{r.exclusives}</div>
                      <div className="text-gray-600 text-xs">独家数</div>
                    </div>
                    <div>
                      <div className="text-blue-400 font-bold">{r.avg_lead}m</div>
                      <div className="text-gray-600 text-xs">平均领先</div>
                    </div>
                    <div>
                      <div className="text-green-400 font-bold">{r.accuracy}%</div>
                      <div className="text-gray-600 text-xs">准确率</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
