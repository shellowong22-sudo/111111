import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type OfficialRow = { sourceKind: string; sourceId: string; sourceLabel: string; institution: string; headline: string; excerpt: string | null; publishedAt: Date | string | null; sourceUrl: string | null };

function time(value: Date | string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '时间未提供'; }

export default function OfficialMarketFactsBrief() {
  const [selectedKey, setSelectedKey] = useState('');
  const input = useMemo(() => ({ source: 'all' as const, keyword: '', limit: 8 }), []);
  const feed = trpc.newsResearch.getOfficialFeed.useQuery(input, { staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  const rows = (feed.data?.rows ?? []) as OfficialRow[];
  const selected = rows.find((row) => `${row.sourceKind}|${row.sourceId}` === selectedKey) ?? rows[0] ?? null;
  return <section className="rounded-md border border-cyan-900/50 bg-cyan-950/10 p-2" data-official-market-facts-brief="true">
    <header className="flex items-start justify-between gap-2"><div className="flex gap-1.5"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /><div><p className="text-[11px] font-bold text-cyan-200">市场简报</p><p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">只呈现当前可读取的市场条目与发布时间，不生成情绪、价格影响或交易结论。</p></div></div><button type="button" onClick={() => void feed.refetch()} disabled={feed.isFetching} className="rounded border border-cyan-800 p-1 text-cyan-200 disabled:opacity-50" aria-label="刷新市场简报"><RefreshCw className={`h-3 w-3 ${feed.isFetching ? 'animate-spin' : ''}`} /></button></header>
    {feed.isLoading ? <div className="mt-2 space-y-1.5"><div className="h-9 animate-pulse rounded bg-muted/30" /><div className="h-9 animate-pulse rounded bg-muted/30" /></div> : feed.error ? <p className="mt-2 rounded border border-amber-900/50 bg-amber-950/20 p-2 text-[10px] leading-4 text-amber-100">当前暂不可读取，恢复后会自动重试。</p> : rows.length ? <><div className="mt-2 max-h-32 space-y-1 overflow-y-auto">{rows.map((row) => <button key={`${row.sourceKind}|${row.sourceId}`} type="button" onClick={() => setSelectedKey(`${row.sourceKind}|${row.sourceId}`)} className={`w-full rounded border p-1.5 text-left ${selected?.sourceId === row.sourceId && selected?.sourceKind === row.sourceKind ? 'border-cyan-700 bg-cyan-950/35' : 'border-border/50 hover:border-cyan-800/60'}`}><p className="line-clamp-1 text-[10px] text-foreground">{row.headline}</p><p className="mt-0.5 text-[8px] text-cyan-300">{time(row.publishedAt)}</p></button>)}</div>{selected ? <div className="mt-2 rounded border border-border/40 bg-background/20 p-1.5"><p className="text-[9px] leading-4 text-foreground/85">{selected.excerpt ?? '当前条目未提供摘要。'}</p></div> : null}</> : <p className="mt-2 rounded border border-dashed border-border/50 p-2 text-[10px] text-muted-foreground">当前没有可显示条目。</p>}
  </section>;
}
