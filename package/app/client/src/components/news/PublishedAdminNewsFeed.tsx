import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';

const sentimentText: Record<string, string> = { positive: '偏正面', neutral: '中性', negative: '偏负面', uncertain: '不确定' };

export default function PublishedAdminNewsFeed() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const query = trpc.adminNewsIngestion.getPublished.useQuery({ limit: 30 }, { retry: false });
  const articles = query.data ?? [];
  const selected = articles.find((article) => article.id === selectedId) ?? null;
  const categories = [...articles.reduce((counts, article) => {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())].map(([name, count]) => ({ name, count }));
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0f] text-gray-100 font-mono text-xs">
    <section className="shrink-0 rounded border border-gray-800 bg-gray-900/50 p-2"><div className="text-gray-300">发布分类分布</div><div className="h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={categories}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 9 }} /><Tooltip contentStyle={{ background: '#0d0d14', border: '1px solid #78350f', fontSize: 10 }} /><Bar dataKey="count" name="发布篇数" fill="#f59e0b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
    <div className="shrink-0 border-b border-yellow-900/30 bg-[#0d0d14] px-3 py-2"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-yellow-400" /><span className="font-semibold text-yellow-300">审核发布新闻</span><span className="text-gray-500">· 财经要闻摘要</span></div><p className="mt-1 text-[10px] leading-4 text-gray-500">仅显示已审核并发布的站内摘要，附类别与发布时间。内容用于信息参考，不构成投资建议。</p></div>
    <div className="flex-1 overflow-y-auto p-3">{query.isLoading ? <div className="rounded border border-dashed border-gray-700 p-4 text-gray-500">正在读取已审核发布的新闻…</div> : query.isError ? <div className="rounded border border-rose-900/60 bg-rose-950/20 p-4 text-rose-200">站内新闻流暂不可读取；系统不以静态头条替代。</div> : !articles.length ? <div className="rounded border border-dashed border-gray-700 p-4 text-gray-500">暂无已审核发布的新闻。完成审核并发布后，内容会在此出现。</div> : <div className="grid gap-3 xl:grid-cols-[.95fr_1.05fr]"><div className="space-y-2">{articles.map((article) => <button key={article.id} type="button" onClick={() => setSelectedId(article.id)} className={`w-full rounded border p-2.5 text-left ${selectedId === article.id ? 'border-yellow-600 bg-yellow-950/20' : 'border-gray-800 bg-gray-900/40 hover:border-gray-600'}`}><div className="flex items-start justify-between gap-2"><span className="leading-5 text-gray-100">{article.title}</span><span className="shrink-0 text-[9px] text-amber-200">{sentimentText[article.sentiment ?? 'uncertain']}</span></div><div className="mt-1 flex flex-wrap gap-x-2 text-[9px] text-gray-500"><span>{article.category ?? '未分类'}</span><span>{article.publishedAt ? new Date(article.publishedAt).toLocaleString('zh-CN') : '—'}</span></div></button>)}</div>{selected ? <article className="rounded border border-yellow-900/60 bg-[#0d0d14] p-3"><div className="text-[9px] text-yellow-400">{selected.category ?? '未分类'} · {sentimentText[selected.sentiment ?? 'uncertain']}</div><h3 className="mt-1 text-sm font-semibold leading-5 text-gray-100">{selected.title}</h3><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-gray-300">{selected.summary}</p><div className="mt-4 border-t border-gray-800 pt-2 text-[10px] leading-5 text-gray-500">发布时间：{selected.publishedAt ? new Date(selected.publishedAt).toLocaleString('zh-CN') : '—'}</div></article> : <div className="grid min-h-48 place-items-center rounded border border-dashed border-gray-700 text-gray-500">选择一条已发布新闻查看摘要。</div>}</div>}</div>
  </div>;
}
