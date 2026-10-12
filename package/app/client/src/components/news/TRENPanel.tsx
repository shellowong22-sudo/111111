import React, { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { trpc } from '@/lib/trpc';
import { analyzeNewsSources } from '@shared/newsTopicAnalytics';

export default function TRENPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('trending');
  const [institution, setInstitution] = useState('all');
  const query = trpc.newsResearch.getGlobalFeed.useQuery({ language:'all', region:'all', keyword:'', limit:200 }, { staleTime:30_000, refetchInterval:60_000 });
  const rows = query.data?.rows ?? [];
  const data = useMemo(() => analyzeNewsSources((query.data?.rows ?? []).filter(row => institution === 'all' || row.institution === institution), query.dataUpdatedAt || Date.now()), [query.data, institution, query.dataUpdatedAt]);
  return <div className="flex h-full min-h-[550px] flex-col bg-[#080a0c] font-mono text-xs text-slate-200" data-news-tren-live="true">
    <header className="flex items-center gap-3 border-b border-slate-700 p-2"><strong className="text-pink-300">TREN</strong><span>新闻趋势 · 话题热度 · 趋势预测 · 关联标的</span>{onClose && <button onClick={onClose} className="ml-auto" aria-label="关闭新闻趋势">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
      <TabsList className="h-8 justify-start rounded-none bg-slate-950">{[{id:'trending',label:'热门趋势'},{id:'series',label:'热度时序'},{id:'stocks',label:'关联标的'},{id:'forecast',label:'趋势预测'}].map(t => <TabsTrigger key={t.id} value={t.id} className="rounded-none text-xs">{t.label}</TabsTrigger>)}</TabsList>
      <div className="flex flex-wrap items-center gap-3 border-y border-slate-800 p-2"><select aria-label="趋势来源" value={institution} onChange={e => setInstitution(e.target.value)} className="max-w-[400px] border border-slate-700 bg-slate-950 p-1"><option value="all">全部官方机构</option>{[...new Set(rows.map(row => row.institution))].sort().map(name => <option key={name} value={name}>{name}</option>)}</select><button onClick={() => void query.refetch()} disabled={query.isFetching} className="border border-slate-700 px-2 py-1">{query.isFetching ? '读取中' : '刷新'}</button><span>有效样本 {data.total} · 排除窗口外或无效日期 {data.excluded}</span></div>
      <p className="border-b border-slate-800 p-2 text-slate-500">以各机构当前返回的公告样本比较最近 7 个 UTC 日历日与此前 7 日。今日未结束，RSS 截断会影响比较；不等于完整历史发稿量或市场关注度。每 60 秒检查来源。</p>
      {query.error && <p role="alert" className="p-2 text-red-300">{query.error.message}</p>}
      {query.isLoading && <p role="status" className="p-2">正在读取官方来源…</p>}
      <TabsContent value="trending" className="m-0 overflow-auto">
        <p className="p-2">主题热度排行 (今日) · 使用来源发布频率作为可验证观察量，未提供主观热度分</p>
        <table className="w-full min-w-[650px] text-left"><thead className="bg-slate-900"><tr><th className="p-2">机构</th><th>最近7日</th><th>此前7日</th><th>条数变化</th><th>相对变化</th><th>最近公告 (UTC)</th></tr></thead><tbody>{data.sources.map(source => <tr key={source.institution} className="border-t border-slate-800"><td className="p-2"><button onClick={() => {setInstitution(source.institution);setTab('series');}} className="text-cyan-200 underline">{source.institution}</button></td><td>{source.current}</td><td>{source.previous}</td><td>{source.delta > 0 ? '+' : ''}{source.delta}</td><td>{source.change === null ? '前期零样本，无法计算' : source.change.toFixed(1) + '%'}</td><td>{source.latest.replace('T',' ').replace('.000Z','')}</td></tr>)}</tbody></table>
        {!query.isLoading && !data.sources.length && <p className="p-3">当前来源在比较窗口内没有已获取公告；不生成趋势榜。</p>}
      </TabsContent>
      <TabsContent value="series" className="m-0 p-3"><p>主题热度趋势 (近 30 天) · 当前可验证样本覆盖近 14 日；按实际发布时间每日计数</p><ResponsiveContainer width="100%" height={300}><AreaChart data={data.daily}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Area type="stepAfter" dataKey="count" name="当前样本公告数" stroke="#f472b6" fill="#500724" /></AreaChart></ResponsiveContainer><p className="text-slate-500">零值表示当前返回样本没有该日公告，不代表当日全源没有发布。</p></TabsContent>
      <TabsContent value="stocks" className="m-0 p-3"><p>趋势话题关联标的表现</p><table className="mt-3 w-full text-left"><thead><tr><th>标的</th><th>7日收益</th><th>30日收益</th><th>相关性</th></tr></thead><tbody><tr className="border-t border-slate-800"><td colSpan={4} className="py-3 text-amber-200">未配置经核验的新闻—证券实体关联与对应时点价格序列；不把机构名称或主题关键词推断为股票信号。</td></tr></tbody></table></TabsContent>
      <TabsContent value="forecast" className="m-0 p-3"><p>趋势预测（未来7日热度预测）</p><p role="status" className="my-3 text-amber-200">暂无训练范围、回测结果和模型版本可核验的预测服务，不绘制固定未来曲线。</p><table className="w-full text-left"><tbody><tr className="border-t border-slate-800"><td className="py-2">实际观察窗口</td><td>14 个 UTC 日历日</td></tr><tr><td>有效观察样本</td><td>{data.total}</td></tr><tr><td>预测输出</td><td>未提供</td></tr></tbody></table></TabsContent>
    </Tabs>
    <footer className="border-t border-slate-800 p-2 text-[10px] text-slate-500">{query.data?.sources.map(s => s.name + '：' + (s.status === 'available' ? s.fetchedAt : s.error)).join(' · ') || '来源状态待返回'}</footer>
  </div>;
}
