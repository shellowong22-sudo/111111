import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, CalendarClock, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import UcheerAiNewsAnalysis from '@/components/news/UcheerAiNewsAnalysis';

const SOURCE_FILTERS = {
  all: '全部内容',
  sec_press: '监管公告',
  fed_monetary: '美联储货币政策',
  fed_research: '美联储研究',
} as const;

type SourceFilter = keyof typeof SOURCE_FILTERS;
type OfficialRow = {
  sourceKind: Exclude<SourceFilter, 'all'>;
  sourceId: string;
  sourceLabel: string;
  institution: string;
  headline: string;
  excerpt: string | null;
  publishedAt: Date | string | null;
  sourceUrl: string | null;
};

function stamp(value: Date | string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '发布时间未提供';
}

export default function OfficialTopNewsDesk({ deliveredItems = [] }: { deliveredItems?: ModuleLiveFeedItem[] }) {
  const [source, setSource] = useState<SourceFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const input = useMemo(() => ({ source, keyword: keyword.trim(), limit: 36 }), [source, keyword]);
  const feed = trpc.newsResearch.getOfficialFeed.useQuery(input, { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const supplied = deliveredItems.filter(item => !item.dataset && (!keyword.trim() || `${item.title} ${item.body}`.toLowerCase().includes(keyword.trim().toLowerCase()))).map(item => ({
    sourceKind: 'published', sourceId: item.itemKey, sourceLabel: item.category, institution: '',
    headline: item.title, excerpt: item.body, publishedAt: item.publishedAt ?? null, sourceUrl: null,
  }));
  const rows = [...(source === 'all' ? supplied : []), ...((feed.data?.rows ?? []) as OfficialRow[])]
    .filter((row, index, all) => all.findIndex(other => other.headline === row.headline) === index);
  const failedSources = feed.data?.sources.filter(item => item.status === 'unavailable') ?? [];
  const selected = rows.find((row) => `${row.sourceKind}|${row.sourceId}` === selectedKey) ?? rows[0] ?? null;
  const coverage = Object.entries(SOURCE_FILTERS).slice(1).map(([key, label]) => ({
    source: label,
    count: rows.filter((row) => row.sourceKind === key).length,
  }));
  const timeline = Object.entries(rows.reduce<Record<string, number>>((acc, row) => {
    const day = row.publishedAt ? new Date(row.publishedAt).toISOString().slice(0, 10) : '未披露日期';
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {})).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);

  return <div className="flex h-full min-h-0 flex-col bg-[#0a0a0f] text-gray-100 font-mono text-xs overflow-hidden" data-top-official-news-desk="true">
    <header className="flex flex-wrap items-start justify-between gap-2 border-b border-cyan-900/50 bg-[#0d1118] px-3 py-2">
      <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-cyan-300" /><div><p className="text-sm font-bold text-cyan-200">TOP · 官方事实阅读</p><p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-gray-500">展示已保存的官方标题、日期与公开摘要及已交付内容；历史归档不代表上游实时可用，摘要不冒充新闻全文。</p></div></div>
      <button type="button" onClick={() => void feed.refetch()} disabled={feed.isFetching} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${feed.isFetching ? 'animate-spin' : ''}`} />重新读取</button>
    </header>
    <div className="flex flex-wrap gap-1 border-b border-gray-800 px-3 py-2"><span className="self-center text-[9px] text-gray-600">内容类别</span>{(Object.keys(SOURCE_FILTERS) as SourceFilter[]).map((item) => <button key={item} type="button" aria-pressed={source === item} onClick={() => setSource(item)} className={`rounded border px-2 py-1 text-[9px] ${source === item ? 'border-cyan-600 bg-cyan-950/50 text-cyan-100' : 'border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}>{SOURCE_FILTERS[item].replaceAll('官方来源', '内容')}</button>)}<input value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={160} placeholder="检索已保存的标题和摘要" className="ml-auto min-w-48 flex-1 rounded border border-gray-800 bg-gray-950 px-2 py-1 text-[10px] text-gray-100 outline-none placeholder:text-gray-700 focus:border-cyan-800" /></div>
    {feed.data && <div role="status" className="flex flex-wrap gap-x-3 gap-y-1 border-b border-gray-800 px-3 py-2 text-[9px] text-gray-400">
      <span>{feed.data.archiveAvailable ? `数据库归档 ${feed.data.archiveTotal ?? 0} 条（按当前筛选）` : '新闻归档数据库不可用；不保证持久保存'}</span>
      {feed.data.sources.map(item => <span key={item.id} className={item.status === 'available' ? 'text-emerald-300' : 'text-amber-300'}>{SOURCE_FILTERS[item.id]}：{item.status === 'available' ? '本次读取成功' : '本次读取失败，以下仅为已归档历史'} · 检查 {stamp(item.cachedAt)}</span>)}
      {failedSources.length > 0 && <span className="text-amber-200">来源故障不代表已保存资料丢失；新内容需待来源恢复。</span>}
    </div>}
    {feed.isLoading && !supplied.length ? <div className="grid flex-1 grid-cols-3 gap-2 p-3"><div className="animate-pulse rounded bg-gray-900" /><div className="animate-pulse rounded bg-gray-900" /><div className="animate-pulse rounded bg-gray-900" /></div> : feed.error && !supplied.length ? <div className="m-3 rounded border border-rose-900/60 bg-rose-950/20 p-3 text-rose-200">公开要闻当前不可读取；系统不会以演示头条、随机图表或缓存样例替代。</div> : <div className="grid min-h-0 flex-1 gap-2 p-3 xl:grid-cols-[0.85fr_1.15fr_0.8fr]">
      <section className="min-h-0 overflow-y-auto rounded border border-gray-800 bg-gray-950/45 p-2"><div className="mb-2 flex items-center gap-1 text-[10px] text-cyan-200"><Building2 className="h-3.5 w-3.5" />公开要闻 {rows.length} 条</div>{rows.length ? rows.map((row) => <button key={`${row.sourceKind}|${row.sourceId}`} type="button" onClick={() => setSelectedKey(`${row.sourceKind}|${row.sourceId}`)} className={`mb-1 w-full rounded border p-2 text-left ${selected?.sourceId === row.sourceId && selected?.sourceKind === row.sourceKind ? 'border-cyan-700 bg-cyan-950/35' : 'border-gray-800 bg-[#0d1118] hover:border-gray-600'}`}><p className="line-clamp-2 text-[10px] leading-4 text-gray-200">{row.headline}</p><p className="mt-1 text-[8px] text-cyan-300">{row.sourceLabel}</p><p className="mt-0.5 text-[8px] text-gray-600">{stamp(row.publishedAt)}</p></button>) : <p className="rounded border border-dashed border-gray-800 p-3 text-[10px] leading-4 text-gray-500">当前筛选没有已保存的可核验条目；如果来源读取失败，新的新闻暂无法补充。</p>}</section>
      <article className="min-h-0 overflow-y-auto rounded border border-gray-800 bg-[#0d1118] p-3">{selected ? <><div className="flex flex-wrap justify-between gap-2"><span className="text-[10px] text-cyan-200">{selected.institution} · {selected.sourceLabel}</span><time className="text-[9px] text-gray-600">发布 {stamp(selected.publishedAt)}</time></div><h3 className="mt-3 text-sm font-semibold leading-5 text-gray-100">{selected.headline}</h3><p className="mt-3 whitespace-pre-wrap text-[11px] leading-5 text-gray-300">{selected.excerpt ?? '正文摘要暂未返回；当前仅展示标题与发布时间。'}</p><div className="mt-4 border-t border-gray-800 pt-2"><p className="text-[9px] text-gray-500">文章编号：{selected.sourceId}</p><p className="mt-1 text-[8px] text-gray-700">内容定位已留档</p><p className="mt-2 rounded border border-cyan-950 bg-cyan-950/15 p-2 text-[9px] leading-4 text-cyan-100">事实边界：官方来源条目可能来自永久归档，仅包含其真实标题、公开摘要和日期；已交付全文与官方摘要必须分开理解。不据此推断市场影响。</p></div><UcheerAiNewsAnalysis title={selected.headline} excerpt={selected.excerpt} category={selected.sourceLabel} /></> : <div className="flex h-full items-center justify-center text-[10px] text-gray-600">从左侧选择一条公开要闻查看详情。</div>}</article>
      <aside className="min-h-0 space-y-2 overflow-y-auto"><section className="rounded border border-gray-800 bg-gray-950/45 p-2"><p className="text-[10px] text-cyan-200">内容类别分布</p><div className="mt-2 space-y-1">{coverage.map((item) => <div key={item.source} className="flex items-center justify-between rounded border border-gray-800 bg-[#0d1118] px-2 py-1.5"><span className="text-[9px] text-gray-400">{item.source}</span><span className="font-mono text-[11px] text-cyan-100">{item.count}</span></div>)}</div><p className="mt-2 text-[8px] leading-4 text-gray-600">计数仅针对本次返回的可读条目，不代表全网新闻量。</p></section><section className="rounded border border-gray-800 bg-gray-950/45 p-2"><div className="flex items-center gap-1 text-[10px] text-cyan-200"><CalendarClock className="h-3.5 w-3.5" />发布日分布</div>{timeline.length ? <ResponsiveContainer width="100%" height={152}><BarChart data={timeline}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={(value) => String(value).slice(5)} /><YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 8 }} /><Tooltip contentStyle={{ background: '#030712', border: '1px solid #164e63', fontSize: 10 }} /><Bar dataKey="count" name="实际条目数" fill="#06b6d4" /></BarChart></ResponsiveContainer> : <p className="mt-2 text-[9px] text-gray-600">没有带发布时间的实际条目，无法绘制分布。</p>}<p className="mt-1 text-[8px] leading-4 text-gray-600">图表是已返回条目的发布时间计数，不表达热度或影响力。</p></section><section className="rounded border border-gray-800 bg-gray-950/45 p-2"><div className="flex items-center gap-1 text-[10px] text-cyan-200"><FileText className="h-3.5 w-3.5" />内容说明</div><p className="mt-2 text-[9px] leading-4 text-gray-500">仅显示当前可验证条目；不可读取时保持真实空状态。</p></section></aside>
    </div>}
  </div>;
}
