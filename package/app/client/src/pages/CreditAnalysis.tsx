import { useMemo, useState } from 'react';
import { AlertCircle, Activity, RefreshCw, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

type IssuerRow = {
  key: string;
  id: string;
  name: string;
  rating: string;
  spread: number | null;
  outlook: string;
  sector: string;
  probabilityOfDefault: number | null;
  date: string;
  provider: string;
  observedAt: string | null;
  quality: string;
  realtimeStatus: string;
};

const CREDIT_RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'];

function ratingBucket(value: string) {
  const normalized = value.trim().toLocaleUpperCase().replace(/[^A-Z]/g, '');
  return CREDIT_RATINGS.find(rating => normalized.startsWith(rating)) ?? (value || '未评级');
}

function ratingColor(rating: string) {
  if (rating === 'AAA') return 'border-emerald-700 bg-emerald-950 text-emerald-300';
  if (rating === 'AA') return 'border-green-700 bg-green-950 text-green-300';
  if (rating === 'A') return 'border-teal-700 bg-teal-950 text-teal-300';
  if (rating === 'BBB') return 'border-yellow-700 bg-yellow-950 text-yellow-300';
  if (rating === 'BB') return 'border-orange-700 bg-orange-950 text-orange-300';
  if (rating === 'B' || rating === 'CCC') return 'border-red-700 bg-red-950 text-red-300';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

function mapIssuers(items: ModuleLiveFeedItem[]) {
  const rows = collectOpenBBDatasetRows(items).map(row => {
    const id = readDatasetText(row.values, ['issuer_id', 'lei', 'cusip', 'isin', 'symbol', 'ticker', 'id'], row.key);
    const name = readDatasetText(row.values, ['issuer_name', 'issuer', 'company_name', 'name', 'entity_name'], id);
    return {
      key: row.key,
      id,
      name,
      rating: ratingBucket(readDatasetText(row.values, ['rating', 'credit_rating', 'issuer_rating', 'grade'], '未评级')),
      spread: readDatasetNumber(row.values, ['spread', 'credit_spread', 'option_adjusted_spread', 'oas', 'z_spread', 'spread_bps']),
      outlook: readDatasetText(row.values, ['outlook', 'rating_outlook', 'credit_outlook']),
      sector: readDatasetText(row.values, ['sector', 'industry', 'industry_group']),
      probabilityOfDefault: readDatasetNumber(row.values, ['probability_of_default', 'default_probability', 'pd', 'pd_percent']),
      date: readDatasetText(row.values, ['date', 'timestamp', 'as_of_date', 'period_ending'], ''),
      provider: row.provider,
      observedAt: row.observedAt,
      quality: row.quality,
      realtimeStatus: row.realtimeStatus,
    } satisfies IssuerRow;
  });
  const current = new Map<string, IssuerRow>();
  rows.forEach(row => {
    const identity = row.id.toLocaleUpperCase();
    const previous = current.get(identity);
    if (!previous || (row.date && Date.parse(row.date) >= Date.parse(previous.date || '1970-01-01'))) current.set(identity, row);
  });
  return { all: rows, current: [...current.values()] };
}

function CreditWorkspace({ items, connection, receivedAt, refetch, isLoading }: {
  items: ModuleLiveFeedItem[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
  refetch: () => unknown;
  isLoading: boolean;
}) {
  const mapped = useMemo(() => mapIssuers(items), [items]);
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState('issuers');
  const counts = useMemo(() => mapped.current.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.rating]: (acc[row.rating] ?? 0) + 1 }), {}), [mapped.current]);
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return mapped.current.filter(row => (!selectedRating || row.rating === selectedRating) && (!query || `${row.name} ${row.sector} ${row.id}`.toLocaleLowerCase().includes(query)));
  }, [mapped.current, selectedRating, searchQuery]);
  const selected = mapped.current.find(row => row.id === selectedId) ?? filtered[0] ?? null;
  const history = useMemo(() => selected ? mapped.all.filter(row => row.id === selected.id && row.date && row.spread !== null).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)) : [], [mapped.all, selected]);
  const distribution = useMemo(() => Object.entries(counts).map(([rating, count]) => {
    const spreads = mapped.current.filter(row => row.rating === rating && row.spread !== null).map(row => row.spread as number);
    return { rating, count, avgSpread: spreads.length ? spreads.reduce((sum, value) => sum + value, 0) / spreads.length : null };
  }).sort((a, b) => CREDIT_RATINGS.indexOf(a.rating) - CREDIT_RATINGS.indexOf(b.rating)), [counts, mapped.current]);
  const emptyText = isLoading ? '正在加载信用数据…' : items.length ? '当前已接收数据不符合发行人信用字段合同。' : '信用数据源未配置或暂不可用；系统未使用静态评级或伪造利差填充。';

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><div><h1 className="text-lg font-bold">信用分析</h1><p className="text-xs text-slate-400">发行人信用评级、利差走势与违约风险评估</p></div><div className="flex items-center gap-3 font-mono text-[10px] text-slate-500"><span className={connection === 'live' ? 'text-emerald-300' : connection === 'connecting' ? 'text-amber-300' : 'text-rose-300'}>{connection === 'live' ? '实时连接' : connection === 'connecting' ? '正在连接' : '轮询补收'}</span><span>接收 {receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</span><Button type="button" variant="outline" size="sm" onClick={() => void refetch()} className="h-7 border-slate-700 bg-transparent text-xs"><RefreshCw className="mr-1 h-3 w-3" />刷新</Button></div></header>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2"><span className="text-xs text-slate-500">评级筛选：</span><Button type="button" size="sm" onClick={() => setSelectedRating(null)} className={`h-7 text-[10px] ${!selectedRating ? 'bg-blue-700' : 'bg-slate-900'}`}>全部 ({mapped.current.length})</Button>{[...new Set([...CREDIT_RATINGS, ...Object.keys(counts)])].map(rating => <Button key={rating} type="button" size="sm" onClick={() => setSelectedRating(selectedRating === rating ? null : rating)} disabled={!counts[rating]} className={`h-7 border text-[10px] ${selectedRating === rating ? ratingColor(rating) : 'border-slate-800 bg-slate-900 text-slate-400'}`}>{rating} ({counts[rating] ?? 0})</Button>)}<div className="relative ml-auto min-w-56"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="搜索发行人或行业..." className="h-7 border-slate-700 bg-black pl-8 text-xs" /></div></div>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="p-3"><TabsList className="mb-3 border border-slate-800 bg-slate-900"><TabsTrigger value="issuers">发行人列表</TabsTrigger><TabsTrigger value="distribution">评级分布</TabsTrigger><TabsTrigger value="spread">利差走势</TabsTrigger></TabsList>
      <TabsContent value="issuers"><div className="overflow-auto border border-slate-800"><table className="w-full min-w-[1050px] text-left text-[11px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="px-2 py-1.5">发行人</th><th>行业</th><th>评级</th><th className="text-right">利差(bps)</th><th className="text-right">违约概率</th><th>展望</th><th>观测</th><th>质量 / 时效</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} onClick={() => { setSelectedId(row.id); setActiveTab('spread'); }} className={`cursor-pointer border-t border-slate-900 ${selected?.id === row.id ? 'bg-blue-950/30' : 'hover:bg-slate-900'}`}><td className="px-2 py-1.5"><b>{row.name}</b><span className="ml-2 font-mono text-[9px] text-slate-600">{row.id}</span></td><td>{row.sector}</td><td><span className={`border px-1.5 py-0.5 font-bold ${ratingColor(row.rating)}`}>{row.rating}</span></td><td className="text-right font-mono">{formatDatasetNumber(row.spread)}</td><td className="text-right font-mono">{row.probabilityOfDefault === null ? '—' : `${formatDatasetNumber(row.probabilityOfDefault)}%`}</td><td>{row.outlook}</td><td>{row.observedAt ?? '未提供'}</td><td>{row.quality}<br />{row.realtimeStatus}</td></tr>)}{!filtered.length && <tr><td colSpan={8} className="py-14 text-center text-slate-500">{emptyText}</td></tr>}</tbody></table></div>{selectedRating && ['BB', 'B', 'CCC'].includes(selectedRating) && <div className="mt-2 flex items-start gap-2 border border-red-900 bg-red-950/30 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{selectedRating} 及以下评级属于高收益债，存在较高违约风险，建议投资者谨慎评估。</div>}</TabsContent>
      <TabsContent value="distribution">{distribution.length ? <div className="grid grid-cols-1 border border-slate-800 lg:grid-cols-2"><div className="overflow-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="px-3 py-2">评级</th><th className="text-right">发行人数</th><th className="pr-3 text-right">占比</th></tr></thead><tbody>{distribution.map(row => <tr key={row.rating} className="border-t border-slate-900"><td className="px-3 py-2"><button type="button" onClick={() => setSelectedRating(row.rating)} className={`border px-2 py-0.5 font-bold ${ratingColor(row.rating)}`}>{row.rating}</button></td><td className="text-right font-mono">{row.count}</td><td className="pr-3 text-right font-mono">{formatDatasetNumber(row.count / mapped.current.length * 100)}%</td></tr>)}</tbody></table></div><div className="h-80 border-l border-slate-800 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="rating" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} /><Tooltip /><Bar dataKey="avgSpread" name="平均利差(bps)" fill="#3b82f6" /></BarChart></ResponsiveContainer></div></div> : <div className="border border-slate-800 py-14 text-center text-xs text-slate-500">{emptyText}</div>}</TabsContent>
      <TabsContent value="spread"><div className="border border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2"><h3 className="flex items-center gap-2 text-xs font-semibold"><Activity className="h-4 w-4 text-blue-400" />{selected ? `${selected.name} — 利差走势` : '利差走势'}</h3>{selected && <div className="font-mono text-[10px] text-slate-500">当前 {formatDatasetNumber(selected.spread)} bps · PD {selected.probabilityOfDefault === null ? '—' : `${formatDatasetNumber(selected.probabilityOfDefault)}%`} · {selected.sector}</div>}</div><div className="h-[420px] p-3">{history.length >= 2 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="spreadLive" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.35} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} /><Tooltip /><Area type="monotone" dataKey="spread" stroke="#f97316" fill="url(#spreadLive)" dot={false} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-500">{selected ? '该发行人真实利差历史不足，未生成替代走势。' : emptyText}</div>}</div><p className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-600">点击发行人列表中的任意行可切换查看其利差走势图。</p></div></TabsContent>
    </Tabs>
  </div>;
}

export default function CreditAnalysis() {
  return <OpenBBModuleDataBand path="/credit-analysis" title="信用分析数据">{delivery => <CreditWorkspace {...delivery} />}</OpenBBModuleDataBand>;
}
