import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';

const stamp = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未提供';

export default function SourceReturnDesk() {
  const [source, setSource] = useState('all');
  const feed = trpc.newsResearch.getOfficialFeed.useQuery({ source: 'all', keyword: '', limit: 60 }, { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const rows = feed.data?.rows ?? [];
  const sources = (feed.data?.sources ?? []).filter(item => source === 'all' || item.id === source);
  return <section className="border-y border-slate-700 bg-slate-950 text-xs text-slate-200" data-source-return-desk="true">
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 p-2">
      <h2 className="mr-auto font-semibold text-cyan-200">READ · 文章状态</h2>
      <label>内容类别 <select aria-label="内容类别筛选" className="border border-slate-600 bg-slate-900 p-1" value={source} onChange={e => setSource(e.target.value)}><option value="all">全部</option>{feed.data?.sources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <button className="border border-slate-600 px-2 py-1 disabled:opacity-40" disabled={feed.isFetching} onClick={() => void feed.refetch()}>{feed.isFetching ? '读取中' : '重新读取'}</button>
    </header>
    <p className="border-b border-slate-800 p-2 text-slate-400">展示可读文章数量、发布时间完整性和重复检查结果；与 NH 的逐篇发布时间序列分别展示。阅读量、热门度和阅读时长没有有效记录时不生成排行。</p>
    {feed.error && <p role="alert" className="p-2 text-red-300">{feed.error.message}</p>}
    <div className="overflow-auto"><table className="w-full min-w-[800px] text-left">
      <thead className="bg-slate-900 text-slate-400"><tr>{['内容类别','状态','可读条目','有发布时间','有内容定位','重复条目','最新发布','内容更新时间'].map(label => <th key={label} className="p-2 font-normal">{label}</th>)}</tr></thead>
      <tbody>{sources.map(item => {
        const subset = rows.filter(row => row.sourceKind === item.id);
        const unique = new Set(subset.map(row => row.sourceId));
        return <tr key={item.id} className="border-t border-slate-800"><td className="p-2">{item.label}</td><td className="p-2">{item.status === 'available' ? '可读取' : '不可读取'}</td><td className="p-2">{subset.length}</td><td className="p-2">{subset.filter(row => row.publishedAt).length}</td><td className="p-2">{subset.filter(row => row.sourceUrl).length}</td><td className="p-2">{subset.length - unique.size}</td><td className="p-2">{stamp(item.latestPublishedAt)}</td><td className="p-2">{stamp(item.cachedAt)}</td></tr>;
      })}</tbody>
    </table></div>
    {!feed.isLoading && !sources.length && <p role="status" className="p-3">没有符合筛选的文章记录。</p>}
    <footer className="border-t border-slate-800 p-2 text-[10px] text-slate-500">计数仅针对本次返回的最多 60 条，不代表全网覆盖或用户阅读量。</footer>
  </section>;
}
