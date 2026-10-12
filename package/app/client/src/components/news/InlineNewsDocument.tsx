import { useState } from 'react';
import { trpc } from '@/lib/trpc';

/** Shared transport, rendered within each existing article detail. No new route. */
export default function InlineNewsDocument({ sourceId, articleKey, label = '读取正文' }: { sourceId: string; articleKey: string; label?: string }) {
  const [enabled, setEnabled] = useState(true);
  const query = trpc.newsResearch.getGlobalDocument.useQuery({ sourceId, key: articleKey }, { enabled, retry: false, staleTime: 300_000 });
  return <div className="mt-2" data-inline-news-document="true">
    <button type="button" disabled={query.isFetching} onClick={() => { if (enabled) void query.refetch(); else setEnabled(true); }} className="border border-slate-600 px-2 py-1 text-cyan-200 disabled:opacity-40">{query.isFetching ? '正在清洗正文' : query.data ? '刷新正文' : label}</button>
    {query.error && <p role="alert" className="mt-2 text-amber-200">{query.error.message}</p>}
    {query.data && <div aria-label="终端新闻正文" className="mt-2 max-h-[440px] overflow-auto border-t border-slate-800 pt-2"><p className="mb-2 text-[10px] text-slate-500">读取 {new Date(query.data.retrievedAt).toLocaleString('zh-CN')} · 内容编号 {query.data.fingerprint.slice(0, 12)}</p><div className="whitespace-pre-wrap leading-6 text-slate-200">{query.data.text}</div></div>}
  </div>;
}
