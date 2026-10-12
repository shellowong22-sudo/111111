import React, { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { trpc } from '@/lib/trpc';
import { analyzeNewsTopics, NEWS_TOPICS } from '@shared/newsTopicAnalytics';
import InlineNewsDocument from './InlineNewsDocument';

const COLORS = ['#22d3ee', '#fbbf24', '#a78bfa', '#4ade80', '#fb7185'];
export default function NIPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('bubble');
  const [region, setRegion] = useState('all');
  const [topic, setTopic] = useState<string>('policy');
  const [keyword, setKeyword] = useState('');
  const [articleKey, setArticleKey] = useState<string | null>(null);
  const query = trpc.newsResearch.getGlobalFeed.useQuery({ language: 'all', region: 'all', keyword: '', limit: 200 }, { staleTime: 30_000, refetchInterval: 60_000 });
  const rows = useMemo(() => (query.data?.rows ?? []).filter(row => (region === 'all' || row.region === region) && (row.title + ' ' + row.summary).toLowerCase().includes(keyword.toLowerCase())), [query.data, region, keyword]);
  const data = useMemo(() => analyzeNewsTopics(rows, query.dataUpdatedAt || Date.now()), [rows, query.dataUpdatedAt]);
  const selected = data.topics.find(item => item.id === topic)!;
  return <div className="flex h-full min-h-[550px] flex-col bg-[#060810] font-mono text-xs text-slate-200" data-news-ni-live="true">
    <header className="flex items-center gap-3 border-b border-slate-700 p-2"><strong className="text-purple-300">NI</strong><span>新闻主题 · 热度矩阵 · 情绪时序 · 主题关联</span>{onClose && <button onClick={onClose} className="ml-auto" aria-label="关闭新闻主题">✕</button>}</header>
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="h-8 justify-start rounded-none bg-slate-950">
        {[{id:'bubble',label:'热度气泡'},{id:'trend',label:'主题趋势'},{id:'sentiment',label:'情绪时序'},{id:'tags',label:'热门标签'},{id:'corr',label:'主题关联'}].map(t => <TabsTrigger key={t.id} value={t.id} className="rounded-none text-xs">{t.label}</TabsTrigger>)}
      </TabsList>
      <div className="flex flex-wrap items-center gap-2 border-y border-slate-800 p-2">
        <select aria-label="主题区域" value={region} onChange={e => setRegion(e.target.value)} className="border border-slate-700 bg-slate-950 p-1">{['all','欧洲','美洲','亚太','全球'].map(r => <option key={r} value={r}>{r === 'all' ? '全部区域' : r}</option>)}</select>
        <input aria-label="主题检索" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="筛选实际标题与摘要" className="border border-slate-700 bg-slate-950 p-1" />
        <button onClick={() => void query.refetch()} disabled={query.isFetching} className="border border-slate-700 px-2 py-1">{query.isFetching ? '读取中' : '刷新'}</button>
        <span>{data.rows.length} 条样本 · 未分类 {data.unmatched} · 排除过期/未来/无日期 {data.excluded}</span>
      </div>
      <p className="border-b border-slate-800 p-2 text-slate-500">最近 14 个 UTC 日历日（今日未结束）；按标题与摘要词组匹配，允许多主题命中。数量仅代表当前样本，不是全网热度或情绪评分。每 60 秒检查更新。</p>
      {query.error && <p role="alert" className="p-2 text-red-300">{query.error.message}</p>}
      {query.isLoading && <p role="status" className="p-2">正在读取官方来源…</p>}
      <TabsContent value="bubble" className="m-0 flex-1 overflow-auto">
        <div className="flex flex-wrap border-b border-slate-800">
          <div className="min-w-[280px] flex-1 p-2"><p>热门主题 (今日) · 当前展示近 14 日样本计数</p><ResponsiveContainer width="100%" height={210}><BarChart data={data.topics.map(t => ({name:t.label,count:t.rows.length}))}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="实际匹配条目" fill="#a78bfa" /></BarChart></ResponsiveContainer></div>
          <table className="min-w-[280px] flex-1 text-left"><thead><tr><th className="p-2">主题</th><th>新闻数量</th><th>情绪分</th></tr></thead><tbody>{data.topics.map(t => <tr key={t.id} className="border-t border-slate-800"><td className="p-2"><button aria-pressed={topic === t.id} onClick={() => setTopic(t.id)} className={topic === t.id ? 'text-cyan-300 underline' : ''}>{t.label}</button></td><td>{t.rows.length}</td><td>未提供</td></tr>)}</tbody></table>
        </div>
        <div className="p-2 text-cyan-200">{selected.label} · 可追溯原文</div>
        <table className="w-full text-left"><thead><tr><th className="p-2">发布时间 (UTC)</th><th>机构</th><th>实际标题</th></tr></thead><tbody>{selected.rows.map(row => <React.Fragment key={row.key}><tr className="border-t border-slate-800"><td className="whitespace-nowrap p-2">{row.publishedAt?.replace('T',' ').replace('.000Z','')}</td><td className="p-2">{row.institution}</td><td className="p-2"><button type="button" aria-expanded={articleKey === row.key} onClick={() => setArticleKey(articleKey === row.key ? null : row.key)} className="text-left text-cyan-200 underline">{row.title}</button></td></tr>{articleKey === row.key && <tr><td colSpan={3} className="p-3"><p>{row.summary || '当前条目未提供摘要。'}</p><InlineNewsDocument key={row.key} sourceId={row.sourceId} articleKey={row.key} /></td></tr>}</React.Fragment>)}</tbody></table>
        {!selected.rows.length && <p className="p-3">当前样本没有匹配该主题的公告。</p>}
      </TabsContent>
      <TabsContent value="trend" className="m-0 p-3"><p>主题热度走势（近30天） · 当前接口可验证窗口为近 14 日，未取得的更早历史不补值。</p><ResponsiveContainer width="100%" height={300}><LineChart data={data.daily}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend />{NEWS_TOPICS.map((t,i) => <Line key={t.id} type="linear" dataKey={t.id} name={t.label} stroke={COLORS[i]} dot={false} />)}</LineChart></ResponsiveContainer></TabsContent>
      <TabsContent value="sentiment" className="m-0 p-3"><p>主题情绪时序</p><p role="status" className="mt-3 text-amber-200">来源未提供情绪评分；尚无带模型版本、输入证据和校验记录的分析结果。主题计数不转换成情绪分，不绘制合成曲线。</p></TabsContent>
      <TabsContent value="tags" className="m-0 p-3"><p>热门话题标签 · 当前使用可审计主题词组，不冒充社交标签趋势</p><table className="mt-3 w-full text-left"><thead><tr><th>标签</th><th>匹配规则</th><th>样本命中</th></tr></thead><tbody>{NEWS_TOPICS.map((t,i) => <tr key={t.id} className="border-t border-slate-800"><td className="py-2">{t.label}</td><td className="break-all px-2">{t.pattern.source}</td><td>{data.topics[i].rows.length}</td></tr>)}</tbody></table></TabsContent>
      <TabsContent value="corr" className="m-0 overflow-auto p-3"><p>主题关联强度矩阵 · 单元格为同一公告同时命中两个主题的条数，不是价格相关系数</p><table className="mt-3 w-full text-center"><thead><tr><th>主题</th>{data.topics.map(t => <th key={t.id}>{t.label}</th>)}</tr></thead><tbody>{data.topics.map((t,i) => <tr key={t.id} className="border-t border-slate-800"><th className="py-3">{t.label}</th>{data.matrix[i].map((count,j) => <td key={j} className={count ? 'bg-cyan-950 text-cyan-200' : 'text-slate-600'}>{count}</td>)}</tr>)}</tbody></table></TabsContent>
    </Tabs>
    <footer className="border-t border-slate-800 p-2 text-[10px] text-slate-500">同步状态 {query.data?.sources.filter(source => source.status === 'available').length ?? 0}/{query.data?.sources.length ?? 0} · 最近检查 {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString('zh-CN') : '等待返回'}</footer>
  </div>;
}
