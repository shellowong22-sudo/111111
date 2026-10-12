import { Fragment, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import { trpc } from '@/lib/trpc';
import { buildNewsActivity } from '@shared/newsActivity';
import InlineNewsDocument from './InlineNewsDocument';

export default function NHPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('live');
  const [region, setRegion] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const query = trpc.newsResearch.getGlobalFeed.useQuery({ language: 'en', region: 'all', keyword: '', limit: 200 }, { staleTime: 30_000, refetchInterval: paused ? false : 60_000, refetchOnWindowFocus: !paused });
  const rows = useMemo(() => (query.data?.rows ?? []).filter(row => (region === 'all' || row.region === region) && (row.title + ' ' + row.summary).toLowerCase().includes(keyword.toLowerCase())), [query.data, region, keyword]);
  const activity = useMemo(() => buildNewsActivity(rows, query.dataUpdatedAt), [rows, query.dataUpdatedAt]);
  const stamp = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '发布时间未提供';
  return <div className="flex h-full min-h-[500px] flex-col bg-[#050810] font-mono text-xs text-gray-200" data-news-nh-live="true">
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 px-3 py-2"><strong className="text-red-300">NH</strong><span>滚动新闻 · 实时流 · 影响评分 · 新闻速度</span><span className="ml-auto text-slate-400">{paused ? '轮询已暂停' : '每 60 秒检查更新'}</span>{onClose && <button onClick={onClose} aria-label="关闭滚动新闻">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="h-8 justify-start rounded-none border-b border-slate-700 bg-slate-950">
        {[{id:'live',label:'实时新闻'},{id:'hourly',label:'每小时量'},{id:'impact',label:'影响分布'},{id:'speed',label:'新闻速度'}].map(item => <TabsTrigger key={item.id} value={item.id} className="h-7 rounded-none text-xs">{item.label}</TabsTrigger>)}
      </TabsList>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <select aria-label="滚动新闻区域" value={region} onChange={e => setRegion(e.target.value)} className="border border-slate-700 bg-slate-950 p-1"><option value="all">全部区域</option><option value="欧洲">欧洲</option><option value="亚太">亚太</option><option value="全球">全球机构</option></select>
        <input aria-label="滚动新闻检索" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="检索实际标题和摘要" className="border border-slate-700 bg-slate-950 px-2 py-1" />
        <button onClick={() => setPaused(!paused)} className="border border-slate-700 px-2 py-1">{paused ? '继续' : '暂停'}</button>
        <button onClick={() => void query.refetch()} disabled={query.isFetching} className="border border-slate-700 px-2 py-1 disabled:opacity-40">{query.isFetching ? '读取中' : '刷新'}</button>
        <span className="text-slate-500">{rows.length} 条 · 按发布时间排序</span>
      </div>
      {query.error && <p role="alert" className="p-3 text-red-300">{query.error.message}</p>}
      <TabsContent value="live" className="m-0 min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[700px] text-left"><thead className="sticky top-0 bg-slate-900 text-slate-400"><tr><th className="p-2">发布时间</th><th className="p-2">区域</th><th className="p-2">实际标题</th></tr></thead><tbody>{rows.map(row => <Fragment key={row.key}><tr className="border-t border-slate-800 hover:bg-slate-900"><td className="whitespace-nowrap p-2">{stamp(row.publishedAt)}</td><td className="p-2">{row.region}</td><td className="p-2"><button aria-expanded={selected === row.key} onClick={() => setSelected(selected === row.key ? null : row.key)} className="text-left text-cyan-100 hover:underline">{row.title}</button></td></tr>{selected === row.key && <tr><td colSpan={3} className="border-y border-cyan-900 p-3"><p className="mb-2 whitespace-pre-wrap leading-5 text-slate-400">{row.summary || '当前记录未提供摘要。'}</p><InlineNewsDocument key={row.key} sourceId={row.sourceId} articleKey={row.key} /></td></tr>}</Fragment>)}</tbody></table>
        {!query.isLoading && !rows.length && <p role="status" className="p-3">当前筛选没有已获取的官方公告。</p>}
      </TabsContent>
      <TabsContent value="hourly" className="m-0 p-3">
        <p className="mb-2">今日每小时新闻量（总量 / 高影响）</p><p className="mb-3 text-slate-500">UTC 日历日 · 仅本次取得条目的发布时间计数；来源无影响评级，高影响数据不绘制。不是全网总量。</p>
        <ResponsiveContainer width="100%" height={240}><BarChart data={activity.hourly}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="hour" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="已取得条目" fill="#06b6d4" /></BarChart></ResponsiveContainer>
      </TabsContent>
      <TabsContent value="impact" className="m-0 p-3"><p>今日新闻影响等级分布</p><p role="status" className="mt-3 text-amber-300">官方公告源没有 CRITICAL / HIGH / MEDIUM / LOW / MINIMAL 影响评级。当前未配置经过验证的影响评估服务；不按机构、标题关键词或文章位置伪造等级。</p><table className="mt-3 w-full text-left"><thead><tr><th>字段</th><th>覆盖</th></tr></thead><tbody><tr className="border-t border-slate-800"><td className="py-2">未评级条目</td><td>{rows.length}</td></tr><tr><td>带可核验评级的条目</td><td>0</td></tr></tbody></table></TabsContent>
      <TabsContent value="speed" className="m-0 p-3"><p>近60分钟新闻发布速度（条/分钟）</p><p className="my-2 text-slate-500">按当前返回样本的真实发布时间计数；RSS 不保证逐条完整性，零值仅表示样本中没有该分钟公告。</p><ResponsiveContainer width="100%" height={240}><AreaChart data={activity.minutes}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="minute" interval={9} /><YAxis allowDecimals={false} /><Tooltip /><Area dataKey="count" name="已取得条目/分钟" fill="#164e63" stroke="#06b6d4" /></AreaChart></ResponsiveContainer><div className="flex flex-wrap gap-6 border-t border-slate-800 py-2"><span>当前速度 {activity.minutes.at(-1)?.count ?? 0} 条/分</span><span>今日峰值 {activity.peak} 条/分（样本）</span><span>今日总量 {activity.today} 条（样本）</span><span>高影响占比 未提供</span></div></TabsContent>
    </Tabs>
    <footer className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">同步状态 {query.data?.sources.filter(source => source.language === 'en' && source.status === 'available').length ?? 0}/{query.data?.sources.filter(source => source.language === 'en').length ?? 0} · 最近检查 {query.dataUpdatedAt ? stamp(new Date(query.dataUpdatedAt).toISOString()) : '等待返回'}</footer>
  </div>;
}
