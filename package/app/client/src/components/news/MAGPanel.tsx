import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, Cell
} from 'recharts';
import { BookOpen, Star, TrendingUp, Award } from 'lucide-react';

// 封面故事列表
const COVER_STORIES = [
  {
    issue: '2024年7月刊', cover: 'AI的泡沫与现实',
    subtitle: '当估值超越想象，谁在为未来买单？',
    authors: ['Ashlee Vance', 'Tom Giles'],
    reads: 485000, rating: 4.8, category: '科技',
    stocks_mentioned: ['NVDA', 'MSFT', 'GOOG', 'META'],
    market_impact: '发布后NVDA单日下跌3.2%'
  },
  {
    issue: '2024年6月刊', cover: '私募信贷的崛起',
    subtitle: '银行撤退后，谁在填补万亿美元的融资缺口？',
    authors: ['Sridhar Natarajan', 'Kat Hidalgo'],
    reads: 312000, rating: 4.6, category: '金融',
    stocks_mentioned: ['BX', 'APO', 'KKR', 'ARES'],
    market_impact: '另类资管股普涨2-5%'
  },
  {
    issue: '2024年5月刊', cover: '中国经济的新常态',
    subtitle: '增速放缓背后的结构性转型',
    authors: ['Tom Mackenzie', 'Ucheer Economics'],
    reads: 268000, rating: 4.4, category: '宏观',
    stocks_mentioned: ['FXI', 'BABA', 'JD', 'MCHI'],
    market_impact: '中概股短暂上涨后回落'
  },
];

// 月度阅读量趋势
const READING_TREND = [
  { month: '1月', reads: 2.8, digital: 1.9, print: 0.9 },
  { month: '2月', reads: 2.5, digital: 1.7, print: 0.8 },
  { month: '3月', reads: 3.2, digital: 2.3, print: 0.9 },
  { month: '4月', reads: 2.9, digital: 2.1, print: 0.8 },
  { month: '5月', reads: 3.5, digital: 2.6, print: 0.9 },
  { month: '6月', reads: 4.1, digital: 3.2, print: 0.9 },
];

// 文章类别分布
const CATEGORY_DIST = [
  { cat: '科技', count: 48, avg_reads: 285, color: '#3b82f6' },
  { cat: '宏观', count: 35, avg_reads: 220, color: '#f59e0b' },
  { cat: '金融', count: 42, avg_reads: 195, color: '#22c55e' },
  { cat: '地缘', count: 28, avg_reads: 245, color: '#ef4444' },
  { cat: '能源', count: 22, avg_reads: 168, color: '#8b5cf6' },
  { cat: '人物', count: 18, avg_reads: 312, color: '#06b6d4' },
];

// 封面故事市场影响（发布后5日SPY表现）
const COVER_IMPACT = [
  { story: 'AI泡沫', d1: -0.8, d2: -0.3, d3: 0.5, d4: 0.9, d5: 1.2 },
  { story: '私募信贷', d1: 0.4, d2: 0.8, d3: 0.6, d4: 0.3, d5: 0.5 },
  { story: '中国经济', d1: -0.2, d2: 0.1, d3: -0.4, d4: 0.2, d5: 0.3 },
];

export default function MAGPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('covers');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#07090f] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-rose-900/40 bg-[#0a0c18] shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-rose-400" />
          <span className="text-rose-400 font-bold text-sm">MAG</span>
          <span className="text-gray-500">佑诚杂志 · 封面故事 · 深度报道 · 市场影响</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0a0c18] border-b border-rose-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'covers',label:'封面故事'},
            {id:'reading',label:'阅读趋势'},
            {id:'categories',label:'文章分类'},
            {id:'impact',label:'市场影响'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-rose-900/40 data-[state=active]:text-rose-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="covers" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="space-y-4">
            {COVER_STORIES.map((s, i) => (
              <div key={i} className="bg-gray-900/60 rounded p-3 border border-rose-900/30">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-20 bg-gradient-to-br from-rose-900/60 to-gray-900 rounded flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-rose-900/40 text-rose-300 border-0 text-xs">{s.issue}</Badge>
                      <Badge className="bg-gray-800 text-gray-400 border-0 text-xs">{s.category}</Badge>
                    </div>
                    <div className="text-white font-bold text-sm">《{s.cover}》</div>
                    <div className="text-gray-400 text-xs mt-0.5">{s.subtitle}</div>
                    <div className="text-gray-500 text-xs mt-1">作者: {s.authors.join(', ')}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-gray-400">{(s.reads/1000).toFixed(0)}K阅读</span>
                      <span className="flex items-center gap-0.5 text-yellow-400">
                        <Star className="w-3 h-3 fill-current" />{s.rating}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {s.stocks_mentioned.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-blue-400">{t}</span>
                      ))}
                    </div>
                    <div className="text-xs text-amber-400 mt-1">市场反应: {s.market_impact}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reading" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">月度阅读量趋势（百万次）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={READING_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} unit="M" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Bar dataKey="digital" name="数字版" stackId="a" fill="#3b82f6" fillOpacity={0.8} />
                <Bar dataKey="print" name="印刷版" stackId="a" fill="#6b7280" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">文章类别分布（文章数 & 平均阅读量K）</div>
          <div className="space-y-2">
            {CATEGORY_DIST.map((c, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 flex items-center gap-3">
                <span className="font-bold w-12" style={{ color: c.color }}>{c.cat}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: `${(c.count / 48) * 100}%`, backgroundColor: c.color }} />
                </div>
                <span className="text-gray-300 w-10 text-right">{c.count}篇</span>
                <span className="text-gray-500 w-16 text-right">{c.avg_reads}K均读</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="impact" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">封面故事发布后5日SPY累计涨跌幅（%）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" type="category" allowDuplicatedCategory={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                {COVER_IMPACT.map((s, i) => {
                  const data = [
                    { day: 'D+1', v: s.d1 }, { day: 'D+2', v: s.d2 },
                    { day: 'D+3', v: s.d3 }, { day: 'D+4', v: s.d4 }, { day: 'D+5', v: s.d5 }
                  ];
                  return <Line key={i} data={data} type="monotone" dataKey="v" name={s.story}
                    stroke={['#ef4444','#22c55e','#f59e0b'][i]} strokeWidth={2} dot={{ r: 3 }} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
