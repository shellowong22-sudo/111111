import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, ScatterChart, Scatter, ZAxis,
  AreaChart, Area, Tooltip, Legend, ReferenceLine, Cell
} from 'recharts';
import { TrendingUp, Zap, Activity, Target, BarChart2 } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';
import OfficialTopNewsDesk from './OfficialTopNewsDesk';
import PublishedAdminNewsFeed from './PublishedAdminNewsFeed';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { decodePublicText, distinctPublicItems } from '@/lib/contentDedupe';

type TopNewsItem = { id: string | number; tag: string; title: string; time: string; heat: number | null; sentiment: 'unknown' | 'neutral' | 'bullish' | 'bearish'; tickers: string[]; impact: 'unknown' | 'high' | 'medium'; priceMove: Record<string, number>; summary?: string };

const SENTIMENT_MAP: Record<string, { label: string; color: string }> = {
  unknown: { label: '情绪未评估', color: '#6b7280' },
  bullish: { label: '利多', color: '#22c55e' },
  bearish: { label: '利空', color: '#ef4444' },
  neutral: { label: '中性', color: '#6b7280' },
};

export default function TOPPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState('headlines');
  const loading = useChartLoading(600);
  const [filter, setFilter] = useState('全部');
  const [selectedNews, setSelectedNews] = useState<TopNewsItem | null>(null);
  const liveFeed = useModuleLiveFeed('/menu-item/TOP', true, { publicOnly: true });
  const deliveredNews = useMemo<TopNewsItem[]>(() => distinctPublicItems(liveFeed.items.map((item) => ({ ...item, title: decodePublicText(item.title), body: decodePublicText(item.body) }))).map((item) => {
    const published = item.publishedAt ? new Date(item.publishedAt) : null;
    return { id: item.itemKey, tag: item.category || item.topic || '快讯', title: item.title, summary: decodePublicText(item.body), time: published && !Number.isNaN(published.getTime()) ? published.toLocaleString('zh-CN', { hour12: false }) : '发布时间未提供', heat: null, sentiment: 'unknown', tickers: [], impact: 'unknown', priceMove: {} };
  }), [liveFeed.items]);
  const newsRows = deliveredNews;
  const tags = useMemo(() => ['全部', ...new Set(newsRows.map((item) => item.tag))], [newsRows]);
  const filtered = filter === '全部' ? newsRows : newsRows.filter(n => n.tag === filter);
  const heatTrend = useMemo(() => {
    const byTime = new Map<string, TopNewsItem[]>();
    newsRows.filter(item => item.heat !== null).forEach((item) => byTime.set(item.time, [...(byTime.get(item.time) ?? []), item]));
    return [...byTime.entries()].map(([hour, rows]) => ({ hour, ...Object.fromEntries(tags.slice(1).map((tag) => [tag, rows.filter((row) => row.tag === tag).reduce((sum, row) => sum + (row.heat ?? 0), 0)])) }));
  }, [newsRows, tags]);
  const sentimentRadar: Array<{ subject: string; score: number }> = [];
  const tickerMentions = useMemo(() => { const counts = new Map<string, number>(); newsRows.forEach((row) => row.tickers.forEach((ticker) => counts.set(ticker, (counts.get(ticker) ?? 0) + 1))); return [...counts.entries()].map(([ticker, count]) => ({ ticker, count, change: 0 })); }, [newsRows]);
  const impactMatrix: Array<{ name: string; heat: number; priceImpact: number; sentiment: string; title: string }> = [];
  const impactCounts = { high: '未提供', medium: '未提供', low: '未提供' };
  const reactionRows = useMemo(() => newsRows.flatMap((row) => Object.entries(row.priceMove).map(([ticker, value]) => ({ ticker, t5: value, t15: value, t30: value, color: value >= 0 ? '#22c55e' : '#ef4444' }))), [newsRows]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-900/40 bg-[#0d0d14] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">TOP</span>
          <span className="text-gray-500">要闻精选 · 热度追踪 · 情绪分析 · 价格联动</span>
          <Badge className="bg-slate-900 text-slate-300 border-0 text-xs">{liveFeed.connection === 'live' ? '推送通道已连接' : '轮询 / 连接中'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">已发布 <span className="text-yellow-400 font-bold">{deliveredNews.length}</span> 条</span>
          {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0d0d14] border-b border-yellow-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            { id: 'official', label: '官方事实阅读' },
            { id: 'curated', label: '审核发布' },
            { id: 'headlines', label: '头条新闻' },
            { id: 'heat', label: '热度趋势' },
            { id: 'sentiment', label: '情绪雷达' },
            { id: 'tickers', label: '标的热词' },
            { id: 'reaction', label: '价格反应' },
            { id: 'matrix', label: '影响力矩阵' },
            { id: 'crossasset', label: '跨资产联动' },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-yellow-900/40 data-[state=active]:text-yellow-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="official" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <OfficialTopNewsDesk deliveredItems={liveFeed.items} />
        </TabsContent>

        <TabsContent value="curated" className="flex-1 min-h-0 overflow-hidden m-0 p-0">
          <PublishedAdminNewsFeed />
        </TabsContent>

        {/* 原有标签页 */}
        <TabsContent value="headlines" className="flex-1 overflow-hidden m-0 p-0 flex flex-col">
          <div className="flex gap-1 px-2 py-1.5 border-b border-yellow-900/20 flex-wrap shrink-0">
            {tags.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${filter === t ? 'bg-yellow-900/60 text-yellow-300' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(news => (
              <div key={news.id} onClick={() => setSelectedNews(selectedNews?.id === news.id ? null : news)}
                className={`px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-900/40 cursor-pointer group transition-colors ${selectedNews?.id === news.id ? 'bg-yellow-900/10 border-l-2 border-l-yellow-500' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-xs border-0 px-1.5 py-0" style={{ backgroundColor: news.impact === 'high' ? '#7f1d1d' : '#78350f', color: news.impact === 'high' ? '#fca5a5' : '#fcd34d' }}>{news.tag}</Badge>
                      <span className="text-gray-500">{news.time}</span>
                      <span className="text-xs" style={{ color: SENTIMENT_MAP[news.sentiment].color }}>● {SENTIMENT_MAP[news.sentiment].label}</span>
                    </div>
                    <p className="text-gray-200 leading-relaxed group-hover:text-white transition-colors">{news.title}</p>
                    {selectedNews?.id === news.id && news.summary && <p data-top-news-body className="mt-1.5 whitespace-pre-wrap text-[10px] leading-5 text-gray-300">{news.summary}</p>}
                    <div className="flex items-center gap-1 mt-1.5">
                      {news.tickers.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{t}</span>
                      ))}
                    </div>
                    {/* 展开：价格变动 */}
                    {selectedNews?.id === news.id && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {Object.entries(news.priceMove).map(([ticker, chg]) => (
                          <div key={ticker} className="bg-gray-800/60 rounded px-2 py-1">
                            <span className="text-gray-400">{ticker} </span>
                            <span className="font-bold" style={{ color: (chg as number) >= 0 ? '#22c55e' : '#ef4444' }}>
                              {(chg as number) >= 0 ? '+' : ''}{chg}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-orange-400" />
                      <span className="text-orange-400 font-bold">{news.heat ?? '热度未提供'}</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-800 rounded-full">
                      <div className="h-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${news.heat ?? 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="heat" className="flex-1 overflow-y-auto m-0 p-3">
          <p role="status" className="mb-2 text-amber-300">当前新闻源未提供热度及影响评级；不以发布时间或条目顺序生成评分。</p>
          <div className="mb-2 text-gray-400">今日各主题新闻热度分布（按小时）</div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={heatTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 9 }} interval={3} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="央行" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="科技" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="地缘" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="宏观" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* 新增：新闻发布时间线（堆叠柱状图） */}
          <div className="mb-2 text-gray-400">新闻发布时间线（按影响级别）</div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={heatTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} />
                <Bar dataKey="高影响" stackId="a" fill="#ef4444" fillOpacity={0.9} />
                <Bar dataKey="中影响" stackId="a" fill="#f59e0b" fillOpacity={0.8} />
                <Bar dataKey="低影响" stackId="a" fill="#374151" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ name: '高影响', count: impactCounts.high, color: '#ef4444' }, { name: '中影响', count: impactCounts.medium, color: '#f59e0b' }, { name: '低影响', count: impactCounts.low, color: '#6b7280' }].map(d => (
              <div key={d.name} className="bg-gray-900/60 rounded p-2 text-center">
                <div className="text-2xl font-bold" style={{ color: d.color }}>{d.count}</div>
                <div className="text-gray-500 text-xs">{d.name}新闻</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="flex-1 overflow-y-auto m-0 p-3">
          <p role="status" className="mb-2 text-amber-300">尚无带模型版本、计算时间和依据的情绪结果；不把关键词匹配当作金融判断。</p>
          <div className="mb-2 text-gray-400">板块新闻情绪综合评分（0-100，越高越乐观）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={sentimentRadar}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Radar name="情绪评分" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                <Tooltip content={<EnhancedTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {sentimentRadar.map(d => (
              <div key={d.subject} className="bg-gray-900/60 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">{d.subject}</div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full">
                    <div className="h-1.5 rounded-full" style={{ width: `${d.score}%`, backgroundColor: d.score > 70 ? '#22c55e' : d.score > 50 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: d.score > 70 ? '#22c55e' : d.score > 50 ? '#f59e0b' : '#ef4444' }}>{d.score}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tickers" className="flex-1 overflow-y-auto m-0 p-3">
          {!tickerMentions.length && <p role="status" className="mb-2 text-amber-300">当前条目没有经过核验的证券实体关联。</p>}
          <div className="mb-2 text-gray-400">今日新闻中出现频次最高的投资标的</div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tickerMentions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} />
                <YAxis dataKey="ticker" type="category" tick={{ fill: '#fbbf24', fontSize: 10 }} width={40} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Bar dataKey="count" name="提及次数" fill="#f59e0b" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tickerMentions.map(t => (
              <div key={t.ticker} className="bg-gray-900/60 rounded p-2 text-center">
                <div className="text-yellow-400 font-bold">{t.ticker}</div>
                <div className="text-gray-500 text-xs">{t.count}次</div>
                <div className="text-xs font-bold" style={{ color: t.change >= 0 ? '#22c55e' : '#ef4444' }}>
                  {t.change >= 0 ? '+' : ''}{t.change}%
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* 新增：价格反应标签页 */}
        <TabsContent value="reaction" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3 h-3 text-green-400" />
            <span className="text-gray-400">新闻发布后30分钟内主要标的价格反应（%）</span>
          </div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={[] as Array<{ min: string; [key: string]: string | number }> }>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="min" tick={{ fill: '#6b7280', fontSize: 9 }} interval={4} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="NVDA" stroke="#22c55e" strokeWidth={2} dot={false} name="NVDA" />
                <Line type="monotone" dataKey="SPY" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SPY" />
                <Line type="monotone" dataKey="TLT" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="TLT" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-gray-400 mb-2">新闻事件后各标的累计收益对比</div>
          <div className="space-y-2">
            {reactionRows.length ? reactionRows.map(row => (
              <div key={row.ticker} className="bg-gray-900/60 rounded px-3 py-2 flex items-center gap-4">
                <span className="text-yellow-400 font-bold w-12">{row.ticker}</span>
                <div className="flex gap-4 flex-1">
                  {[{ label: 'T+5m', val: row.t5 }, { label: 'T+15m', val: row.t15 }, { label: 'T+30m', val: row.t30 }].map(d => (
                    <div key={d.label} className="text-center">
                      <div className="text-gray-500 text-xs">{d.label}</div>
                      <div className="font-bold" style={{ color: row.color }}>{`${row[d.label === 'T+5m' ? 't5' : d.label === 'T+15m' ? 't15' : 't30'] >= 0 ? '+' : ''}${row[d.label === 'T+5m' ? 't5' : d.label === 'T+15m' ? 't15' : 't30']}%`}</div>
                    </div>
                  ))}
                </div>
              </div>
            )) : <div className="rounded border border-dashed border-gray-700 p-6 text-center text-gray-500">暂无与实时新闻绑定的价格时间序列</div>}
          </div>
        </TabsContent>

        {/* 新增：影响力矩阵标签页 */}
        <TabsContent value="matrix" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3 h-3 text-purple-400" />
            <span className="text-gray-400">新闻影响力矩阵（热度 × 价格冲击）</span>
          </div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" dataKey="heat" name="新闻热度" domain={[60, 105]} tick={{ fill: '#6b7280', fontSize: 9 }} label={{ value: '热度', position: 'insideBottom', fill: '#6b7280', fontSize: 9 }} />
                <YAxis type="number" dataKey="priceImpact" name="价格冲击%" domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 9 }} label={{ value: '价格冲击%', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 9 }} />
                <ZAxis range={[60, 200]} />
                <Tooltip content={<EnhancedTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={impactMatrix.filter((entry) => entry.priceImpact > 0)} name="新闻事件">
                  {impactMatrix.map((entry, index) => (
                    <Cell key={index} fill={entry.sentiment === 'bullish' ? '#22c55e' : entry.sentiment === 'bearish' ? '#ef4444' : '#f59e0b'} fillOpacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 mb-2">
            {[{ label: '利多', color: '#22c55e' }, { label: '利空', color: '#ef4444' }, { label: '中性', color: '#f59e0b' }].map(d => (
              <div key={d.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-gray-400 text-xs">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {impactMatrix.filter((item) => item.priceImpact > 0).map((item, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-1.5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.sentiment === 'bullish' ? '#22c55e' : item.sentiment === 'bearish' ? '#ef4444' : '#f59e0b' }} />
                <span className="text-gray-300 flex-1 truncate">{item.title}</span>
                <span className="text-orange-400 text-xs">热度{item.heat}</span>
                <span className="font-bold text-xs" style={{ color: item.sentiment === 'bullish' ? '#22c55e' : item.sentiment === 'bearish' ? '#ef4444' : '#f59e0b' }}>
                  冲击{item.priceImpact.toFixed(1)}%
                </span>
              </div>
            ))}
            </div>
            {!impactMatrix.some((item) => item.priceImpact > 0) && <div className="rounded border border-dashed border-gray-700 p-6 text-center text-gray-500">暂无实时价格冲击数据，收到绑定行情后自动生成矩阵</div>}
        </TabsContent>

        {/* 新增：跨资产联动标签页 */}
        <TabsContent value="crossasset" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-3 h-3 text-blue-400" />
            <span className="text-gray-400">新闻事件后跨资产相关性分析</span>
          </div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[] as Array<{ asset: string; corr: number }> } layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" domain={[-1, 1]} tick={{ fill: '#6b7280', fontSize: 9 }} />
                <YAxis dataKey="asset" type="category" tick={{ fill: '#fbbf24', fontSize: 10 }} width={35} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <ReferenceLine x={0} stroke="#374151" />
                <Bar dataKey="corr" name="相关系数" radius={[0, 3, 3, 0]}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-gray-400 mb-2">各资产 Beta 系数 & 隐含波动率</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-1.5 text-gray-500 font-normal">资产</th>
                  <th className="text-right py-1.5 text-gray-500 font-normal">相关系数</th>
                  <th className="text-right py-1.5 text-gray-500 font-normal">Beta</th>
                  <th className="text-right py-1.5 text-gray-500 font-normal">隐含波动率</th>
                  <th className="text-right py-1.5 text-gray-500 font-normal">信号</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={5} className="py-6 text-center text-gray-500">暂无实时跨资产相关性观测</td></tr>
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
