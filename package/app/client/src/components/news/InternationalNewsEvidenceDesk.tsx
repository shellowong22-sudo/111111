import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import InlineNewsDocument from './InlineNewsDocument';

const dateText = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '时间未提供';
export default function InternationalNewsEvidenceDesk() {
  const [language, setLanguage] = useState<'ja' | 'fr'>('ja');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const query = trpc.newsResearch.getGlobalFeed.useQuery({ language, region: 'all', keyword: '', limit: 200 }, { refetchInterval: 60_000, staleTime: 30_000, refetchOnWindowFocus: true });
  const rows = (query.data?.rows ?? []).filter(row => (row.title + ' ' + row.summary).toLowerCase().includes(keyword.toLowerCase()));
  const detail = rows.find(row => row.key === selected);
  const source = query.data?.sources.find(row => row.language === language);
  return <section className="border-y border-slate-700 bg-slate-950 text-xs text-slate-200" data-international-news-evidence="true">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-2 py-2">
      <h3 className="mr-auto font-semibold text-teal-200">INTL · 多语言新闻证据状态</h3>
      <label>原始语言 <select aria-label="原始语言" value={language} onChange={e => { setLanguage(e.target.value as 'ja' | 'fr'); setSelected(null); }} className="border border-slate-600 bg-slate-900 p-1"><option value="ja">日本語</option><option value="fr">Français</option></select></label>
      <input aria-label="检索原文" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="检索原文标题 / 摘要" className="border border-slate-600 bg-slate-900 px-2 py-1" />
      <button disabled={query.isFetching} onClick={() => void query.refetch()} className="border border-slate-600 px-2 py-1 disabled:opacity-40">{query.isFetching ? '读取中' : '刷新'}</button>
    </div>
    <div className="flex flex-wrap gap-4 border-b border-slate-800 px-2 py-1 text-[10px] text-slate-400"><span>每 60 秒检查更新</span><span>数据状态：{source?.status === 'available' ? '可读取' : '读取中或不可用'}</span><span>同步 {dateText(source?.fetchedAt ?? null)}</span><span>{rows.length} 条</span><span>未启用自动翻译</span></div>
    {query.error && <p role="alert" className="p-2 text-red-300">{query.error.message}</p>}
    {source?.error && <p role="alert" className="p-2 text-amber-300">数据同步暂不可用，请稍后重试。</p>}
    <div className="max-h-[480px] overflow-auto"><table className="w-full min-w-[650px] text-left"><thead className="sticky top-0 bg-slate-900 text-slate-400"><tr><th className="p-2">发布时间</th><th>原文标题</th><th>地区</th><th>语言</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} className="border-t border-slate-800 hover:bg-slate-900"><td className="whitespace-nowrap p-2 font-mono text-[10px]">{dateText(row.publishedAt)}</td><td className="p-2"><button onClick={() => setSelected(selected === row.key ? null : row.key)} aria-expanded={selected === row.key} className="text-left text-teal-100 hover:underline">{row.title}</button></td><td className="whitespace-nowrap p-2">{row.region}</td><td className="p-2">{row.language}</td></tr>)}</tbody></table>{!query.isLoading && !rows.length && <p role="status" className="p-3">当前筛选没有已取得的原文记录。</p>}</div>
    {detail && <div className="border-t border-teal-900 p-3"><p className="font-semibold">{detail.title}</p><p className="my-2 text-slate-400">{detail.summary || '当前记录未提供摘要。'}</p><InlineNewsDocument key={detail.key} sourceId={detail.sourceId} articleKey={detail.key} label="读取正文" /></div>}
  </section>;
}
