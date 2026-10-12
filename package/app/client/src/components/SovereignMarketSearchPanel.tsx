import { useEffect, useMemo, useState } from 'react';
import { Database, FilterX, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, LoadingState, PanelShell, chartTooltipStyle } from './sovereign/PanelKit';

type Props = { onClose?: () => void; onOpenPanel?: (code: string, name: string) => void };
type HistoryPoint = { date: string; value: number };
type UniverseRow = {
  id: string;
  symbol: string;
  name: string;
  country: string;
  countryCode: string;
  currency: string;
  tenor: string;
  kind: 'benchmark' | 'auction';
  observedAt: string;
  retrievedAt: string;
  frequency: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceState: 'current' | 'review' | 'unknown';
  ageDays: number | null;
  history: HistoryPoint[];
  changeHistory: HistoryPoint[];
  structure: Array<{ label: string; value: number; observedAt: string }>;
  demandHistory: HistoryPoint[];
  sizeHistory: HistoryPoint[];
  auction: null | {
    issueDate: string | null;
    maturityDate: string | null;
    offeringAmount: number | null;
    bidToCoverRatio: number | null;
    couponRate: number | null;
    securityType: string;
  };
};
type Dataset = {
  id: string;
  key: string;
  title: string;
  layer: '期限曲线' | '跨国基准' | '一级发行';
  country: string;
  currency: string;
  tenor: string;
  frequency: string;
  observedAt: string;
  retrievedAt: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceState: 'current' | 'review' | 'unknown';
  ageDays: number | null;
  dates: string[];
  fieldCoverage: Array<{ field: string; score: number }>;
  destination: { code: string; name: string };
};
type DrillView = 'density' | 'freshness' | 'fields' | 'intervals';

function monthDensity(dates: string[]) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const month = date.slice(0, 7);
    if (month) counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count }));
}

function intervalBuckets(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  const buckets = [
    { label: '0–2天', min: 0, max: 2, count: 0 },
    { label: '3–7天', min: 3, max: 7, count: 0 },
    { label: '8–31天', min: 8, max: 31, count: 0 },
    { label: '32天以上', min: 32, max: Number.POSITIVE_INFINITY, count: 0 },
  ];
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = Math.max(0, Math.round((new Date(sorted[index]!).getTime() - new Date(sorted[index - 1]!).getTime()) / 86_400_000));
    const bucket = buckets.find(item => gap >= item.min && gap <= item.max);
    if (bucket) bucket.count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

function createDatasets(rows: UniverseRow[]): Dataset[] {
  const benchmarks = rows.filter(row => row.kind === 'benchmark').map(row => ({
    id: `series:${row.symbol}`,
    key: row.symbol,
    title: row.countryCode === 'US' ? `${row.country}国债 ${row.tenor} 历史序列` : `${row.country}政府债 ${row.tenor} 月度序列`,
    layer: row.countryCode === 'US' ? '期限曲线' as const : '跨国基准' as const,
    country: row.country,
    currency: row.currency,
    tenor: row.tenor,
    frequency: row.frequency,
    observedAt: row.observedAt,
    retrievedAt: row.retrievedAt,
    sourceLabel: row.sourceLabel,
    sourceUrl: row.sourceUrl,
    sourceState: row.sourceState,
    ageDays: row.ageDays,
    dates: row.history.map(point => point.date),
    fieldCoverage: [
      { field: '历史观测', score: row.history.length ? 100 : 0 },
      { field: '相邻变化', score: row.changeHistory.length ? 100 : 0 },
      { field: '横向结构', score: row.structure.length ? 100 : 0 },
      { field: '来源定位', score: row.sourceUrl ? 100 : 0 },
    ],
    destination: { code: '4', name: 'WB 全球债券市场' },
  }));

  const auctions = rows.filter(row => row.kind === 'auction');
  const byTenor = new Map<string, UniverseRow[]>();
  for (const row of auctions) byTenor.set(row.tenor, [...(byTenor.get(row.tenor) ?? []), row]);
  const auctionDatasets = [...byTenor.entries()].map(([tenor, peers]) => {
    const latest = [...peers].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]!;
    const dates = peers.map(row => row.observedAt);
    return {
      id: `auction-term:${tenor}`,
      key: `UST-${tenor.toUpperCase().replaceAll(' ', '-')}`,
      title: `美国国债 ${tenor} 拍卖事件集`,
      layer: '一级发行' as const,
      country: '美国',
      currency: 'USD',
      tenor,
      frequency: '事件',
      observedAt: latest.observedAt,
      retrievedAt: latest.retrievedAt,
      sourceLabel: latest.sourceLabel,
      sourceUrl: latest.sourceUrl,
      sourceState: latest.sourceState,
      ageDays: latest.ageDays,
      dates,
      fieldCoverage: [
        { field: '发行日期', score: peers.some(row => row.auction?.issueDate) ? 100 : 0 },
        { field: '发行规模', score: peers.some(row => row.auction?.offeringAmount !== null) ? 100 : 0 },
        { field: '投标覆盖', score: peers.some(row => row.auction?.bidToCoverRatio !== null) ? 100 : 0 },
        { field: '到期日期', score: peers.some(row => row.auction?.maturityDate) ? 100 : 0 },
      ],
      destination: { code: '23', name: '新发行、公司大事、评级' },
    };
  });
  return [...benchmarks, ...auctionDatasets].sort((a, b) => a.layer.localeCompare(b.layer) || a.key.localeCompare(b.key));
}

function statusText(state: Dataset['sourceState']) {
  return state === 'current' ? '可用' : state === 'review' ? '待复核' : '未知';
}

function MetricButton({ label, value, active, onClick }: { label: string; value: string; active: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded border p-2 text-left ${active ? 'border-cyan-600 bg-cyan-950/35' : 'border-slate-800 bg-slate-950/25 hover:border-slate-600'}`}><span className="text-[9px] text-slate-500">{label}</span><strong className="mt-1 block font-mono text-sm text-cyan-200">{value}</strong></button>;
}

export default function SovereignMarketSearchPanel({ onClose, onOpenPanel }: Props) {
  const universe = trpc.secf.sovereignUniverse.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true, retry: 2 });
  const [query, setQuery] = useState('');
  const [layer, setLayer] = useState('全部数据层');
  const [frequency, setFrequency] = useState('全部频率');
  const [freshness, setFreshness] = useState('全部时效');
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<DrillView>('density');
  const rows = (universe.data?.rows ?? []) as UniverseRow[];
  const datasets = useMemo(() => createDatasets(rows), [rows]);
  const frequencies = useMemo(() => ['全部频率', ...new Set(datasets.map(item => item.frequency))], [datasets]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return datasets.filter(item => {
      const text = [item.key, item.title, item.layer, item.country, item.currency, item.tenor, item.sourceLabel].join(' ').toLowerCase();
      return (!needle || text.includes(needle))
        && (layer === '全部数据层' || item.layer === layer)
        && (frequency === '全部频率' || item.frequency === frequency)
        && (freshness === '全部时效' || (freshness === '当前可用' ? item.sourceState === 'current' : item.sourceState !== 'current'));
    });
  }, [datasets, frequency, freshness, layer, query]);

  useEffect(() => {
    if (!filtered.length) { setSelectedId(''); return; }
    if (!filtered.some(item => item.id === selectedId)) setSelectedId(filtered[0]!.id);
  }, [filtered, selectedId]);
  const selected = filtered.find(item => item.id === selectedId) ?? null;
  useEffect(() => setView('density'), [selected?.id]);

  const reset = () => { setQuery(''); setLayer('全部数据层'); setFrequency('全部频率'); setFreshness('全部时效'); };
  const density = selected ? monthDensity(selected.dates) : [];
  const intervals = selected ? intervalBuckets(selected.dates) : [];
  const latestDataset = [...datasets].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  const connection = universe.data?.degraded ? '数据索引降级 · 保留最近有效目录' : universe.isFetching ? '数据索引同步中' : '数据索引已连接';

  return <PanelShell ticker="SOVS" title="全局数据搜索" subtitle="检索数据覆盖与可用性，不重复证券标识检索" onClose={onClose} onRefresh={() => void universe.refetch()}>
    {universe.isLoading ? <LoadingState text="正在构建主权债数据目录…" /> : universe.error || !universe.data?.success ? <div className="grid min-h-[420px] place-items-center text-xs text-rose-300">数据目录读取失败，未使用静态目录替代。</div> : <div className="flex min-h-full flex-col gap-3">
      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(250px,1fr)_135px_120px_120px_auto]">
          <label className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} className="input-terminal w-full pl-8 text-xs" placeholder="搜索数据集、国家、币种、期限或来源" /></label>
          <select aria-label="数据层筛选" value={layer} onChange={event => setLayer(event.target.value)} className="input-terminal text-xs">{['全部数据层', '期限曲线', '跨国基准', '一级发行'].map(item => <option key={item}>{item}</option>)}</select>
          <select aria-label="更新频率筛选" value={frequency} onChange={event => setFrequency(event.target.value)} className="input-terminal text-xs">{frequencies.map(item => <option key={item}>{item}</option>)}</select>
          <select aria-label="时效筛选" value={freshness} onChange={event => setFreshness(event.target.value)} className="input-terminal text-xs"><option>全部时效</option><option>当前可用</option><option>需要复核</option></select>
          <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-1 rounded border border-slate-700 px-2 py-1.5 text-[10px] text-slate-300 hover:border-cyan-700"><FilterX className="h-3.5 w-3.5" />重置</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 pt-2 text-[9px] text-slate-500"><span role="status" className={universe.data?.degraded ? 'text-amber-300' : 'text-emerald-300'}>{connection}</span><span>目录 {datasets.length}</span><span>命中 {filtered.length}</span><span>历史观测 {datasets.reduce((sum, item) => sum + item.dates.length, 0)}</span><span>最近记录 {latestDataset?.observedAt ?? '—'}</span></div>
      </Card>

      <div className="grid min-h-[610px] gap-3 xl:grid-cols-[1.05fr_.95fr]">
        <Card title={`数据目录 · ${filtered.length}`} className="min-h-0 overflow-hidden p-0 [&>div:first-child]:px-3 [&>div:first-child]:pt-3">
          <div className="h-[330px] overflow-auto xl:h-[600px]"><table className="w-full min-w-[650px] text-[10px]"><thead className="sticky top-0 z-10 border-b border-slate-700 bg-[#0b111c] text-left text-slate-500"><tr><th className="p-2">数据键 / 名称</th><th>数据层</th><th>覆盖</th><th>频率</th><th className="text-right">历史点</th><th className="pr-2 text-right">最新观测</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-b border-slate-800/70 hover:bg-cyan-950/20 ${selectedId === item.id ? 'bg-cyan-950/35' : ''}`}><td className="p-2"><b className="font-mono text-cyan-200">{item.key}</b><span className="ml-2 text-slate-300">{item.title}</span></td><td className="text-violet-300">{item.layer}</td><td><span className="text-slate-300">{item.country}</span><span className="block font-mono text-slate-500">{item.currency} · {item.tenor}</span></td><td className="text-slate-400">{item.frequency}</td><td className="text-right font-mono text-slate-200">{item.dates.length}</td><td className="pr-2 text-right"><span className="font-mono text-slate-300">{item.observedAt}</span><span className={`block text-[9px] ${item.sourceState === 'current' ? 'text-emerald-300' : 'text-amber-300'}`}>{statusText(item.sourceState)}</span></td></tr>)}</tbody></table>{!filtered.length && <div className="flex h-52 flex-col items-center justify-center gap-2 text-xs text-slate-500"><Database className="h-6 w-6" /><span>没有符合当前目录条件的数据集。</span><button type="button" onClick={reset} className="text-cyan-300">恢复全部目录</button></div>}</div>
        </Card>

        {selected ? <div className="min-w-0 space-y-3">
          <Card title={`${selected.key} · 覆盖核验`} action={<button type="button" onClick={() => onOpenPanel?.(selected.destination.code, selected.destination.name)} className="text-[10px] text-cyan-300 hover:text-cyan-100">转到数据应用</button>}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><MetricButton label="历史观测密度" value={`${selected.dates.length} 点`} active={view === 'density'} onClick={() => setView('density')} /><MetricButton label="数据新鲜度" value={selected.ageDays === null ? '未知' : `${selected.ageDays} 天`} active={view === 'freshness'} onClick={() => setView('freshness')} /><MetricButton label="字段可用性" value={`${selected.fieldCoverage.filter(item => item.score > 0).length}/${selected.fieldCoverage.length}`} active={view === 'fields'} onClick={() => setView('fields')} /><MetricButton label="更新间隔结构" value={selected.frequency} active={view === 'intervals'} onClick={() => setView('intervals')} /></div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[9px] text-slate-500"><span>{selected.country} · {selected.currency} · {selected.tenor}</span></div>
          </Card>
          <Card title={view === 'density' ? '近十二个月观测密度' : view === 'freshness' ? '观测至接收时效链' : view === 'fields' ? '字段覆盖结构' : '相邻观测间隔分布'}>
            {view === 'density' && (density.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={density}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 8 }} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip {...chartTooltipStyle()} /><Bar dataKey="count" name="有效观测数" fill="#22d3ee" /></BarChart></ResponsiveContainer> : <p className="py-20 text-center text-xs text-slate-500">当前目录项没有历史日期，不生成密度图。</p>)}
            {view === 'freshness' && <div className="py-8"><div className="relative mx-8 h-1 rounded bg-slate-800"><span className="absolute -left-1 -top-1.5 h-4 w-4 rounded-full border-2 border-cyan-400 bg-slate-950" /><span className="absolute left-1/2 -top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-amber-400 bg-slate-950" /><span className="absolute -right-1 -top-1.5 h-4 w-4 rounded-full border-2 border-emerald-400 bg-slate-950" /></div><div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px]"><div><b className="block text-cyan-300">原始观测</b><span className="font-mono text-slate-500">{selected.observedAt}</span></div><div><b className="block text-amber-300">发布节奏</b><span className="text-slate-500">{selected.frequency}</span></div><div><b className="block text-emerald-300">目录接收</b><span className="font-mono text-slate-500">{new Date(selected.retrievedAt).toLocaleString('zh-CN')}</span></div></div><p className="mt-7 text-center text-xs text-slate-400">当前状态：{statusText(selected.sourceState)}{selected.ageDays === null ? '' : ` · 距离观测 ${selected.ageDays} 天`}</p></div>}
            {view === 'fields' && <ResponsiveContainer width="100%" height={260}><BarChart data={selected.fieldCoverage} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} /><YAxis type="category" dataKey="field" width={68} tick={{ fill: '#94a3b8', fontSize: 9 }} /><Tooltip {...chartTooltipStyle()} /><Bar dataKey="score" name="字段可用度"><Cell fill="#22d3ee" /><Cell fill="#a78bfa" /><Cell fill="#f59e0b" /><Cell fill="#34d399" /></Bar></BarChart></ResponsiveContainer>}
            {view === 'intervals' && <ResponsiveContainer width="100%" height={260}><BarChart data={intervals}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip {...chartTooltipStyle()} /><Bar dataKey="count" name="间隔次数" fill="#f59e0b" /></BarChart></ResponsiveContainer>}
          </Card>
        </div> : <Card title="数据集核验"><p className="py-20 text-center text-xs text-slate-500">筛选结果为空，没有保留旧目录项。</p></Card>}
      </div>
    </div>}
  </PanelShell>;
}
