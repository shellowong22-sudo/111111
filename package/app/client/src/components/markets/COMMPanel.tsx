import { useCallback, useMemo, useState } from 'react';
import { Activity, Brain, Database, RefreshCw, Zap } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Streamdown } from 'streamdown';
import { NewsShell, SectionTitle, StatCard } from '@/components/news/NewsKit';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { isCommodityCurrentObservation } from '@/lib/commodityObservationFreshness';
import { trpc } from '@/lib/trpc';
import { CommodityWatchlistWorkspace } from '@/components/commodity/CommodityResearchLayer';
import { CommodityWatchlistTaxonomyPanel } from '@/components/commodity/CommodityRegionalInventoryTools';

const ACCENT = '#f59e0b';

type CommodityObservation = {
  key: string;
  code: string;
  name: string;
  category: string;
  date: string;
  value: number;
  unit: string;
  quality: string;
  freshness: string;
};

type CommoditySnapshot = CommodityObservation & {
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  historyCount: number;
};

function categoryFor(label: string) {
  if (/黄金|金价/i.test(label)) return '贵金属';
  if (/库存|炼厂|原油|天然气/i.test(label)) return '能源';
  return '综合';
}

function codeFor(label: string) {
  if (/西德州|WTI/i.test(label)) return 'DCOILWTICO';
  if (/黄金/i.test(label)) return 'GOLD';
  if (/天然气库存/i.test(label)) return 'NGSTORAGE';
  if (/商业原油库存/i.test(label)) return 'WCESTUS1';
  if (/炼厂/i.test(label)) return 'WPULEUS3';
  return label.replace(/[^A-Za-z0-9]/g, '').slice(0, 18).toUpperCase() || 'COMM';
}

function mapCommodityObservations(items: ReturnType<typeof useModuleLiveFeed>['items']) {
  const unique = new Map<string, CommodityObservation>();
  for (const row of collectOpenBBDatasetRows(items)) {
    const value = readDatasetNumber(row.values, ['value', 'price', 'close', '现货价格', '参考价格', '库存量', '利用率']);
    const date = readDatasetText(row.values, ['date', '观察期', 'timestamp'], '');
    const explicitCode = readDatasetText(row.values, ['symbol', 'ticker', '标的'], '');
    const code = explicitCode || codeFor(row.datasetLabel);
    if (!date || value === null) continue;
    const observation: CommodityObservation = {
      key: `${code}:${date}`,
      code,
      name: row.datasetLabel,
      category: categoryFor(row.datasetLabel),
      date,
      value,
      unit: readDatasetText(row.values, ['unit', '单位'], ''),
      quality: row.quality,
      freshness: row.realtimeStatus,
    };
    unique.set(observation.key, observation);
  }
  return [...unique.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function latestSnapshots(rows: CommodityObservation[]) {
  const groups = new Map<string, CommodityObservation[]>();
  rows.forEach(row => groups.set(row.code, [...(groups.get(row.code) ?? []), row]));
  return [...groups.values()].flatMap(history => {
    const ordered = history.slice().sort((left, right) => left.date.localeCompare(right.date));
    const latest = ordered.at(-1);
    if (!latest) return [];
    const previous = ordered.at(-2)?.value ?? null;
    const change = previous === null ? null : latest.value - previous;
    return [{
      ...latest,
      previous,
      change,
      changePercent: previous && change !== null ? (change / previous) * 100 : null,
      historyCount: ordered.length,
    } satisfies CommoditySnapshot];
  });
}

function heatClass(changePercent: number | null) {
  if (changePercent === null) return 'border-slate-700 bg-slate-900 text-slate-300';
  if (changePercent >= 1) return 'border-emerald-700 bg-emerald-950/60 text-emerald-100';
  if (changePercent > 0) return 'border-emerald-900 bg-emerald-950/30 text-emerald-200';
  if (changePercent <= -1) return 'border-rose-700 bg-rose-950/60 text-rose-100';
  if (changePercent < 0) return 'border-rose-900 bg-rose-950/30 text-rose-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export default function COMMPanel({ onClose }: { onClose?: () => void }) {
  const delivery = useModuleLiveFeed('/menu-item/COMM', true);
  const observations = useMemo(() => mapCommodityObservations(delivery.items), [delivery.items]);
  const snapshots = useMemo(() => latestSnapshots(observations), [observations]);
  const currentSnapshots = snapshots.filter(row => isCommodityCurrentObservation(row.date));
  const [category, setCategory] = useState('全部');
  const [tab, setTab] = useState<'heatmap' | 'table' | 'signals' | 'ai'>('heatmap');
  const [signalView, setSignalView] = useState<'series' | 'watchlist'>('series');
  const [selectedCode, setSelectedCode] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const analyzeMarket = trpc.derivatives.commodity.analyzeMarket.useMutation();
  const categories = useMemo(() => ['全部', ...new Set(snapshots.map(row => row.category))], [snapshots]);
  const filtered = snapshots.filter(row => category === '全部' || row.category === category);
  const currentFiltered = currentSnapshots.filter(row => category === '全部' || row.category === category);
  const selected = snapshots.find(row => row.code === selectedCode) ?? currentFiltered[0] ?? filtered[0] ?? null;
  const history = useMemo(() => selected ? observations.filter(row => row.code === selected.code).sort((left, right) => left.date.localeCompare(right.date)) : [], [observations, selected]);
  const latestDate = currentSnapshots.map(row => row.date).sort().at(-1) ?? '—';
  const archiveSaved = delivery.items.some(item => Boolean(item.dataset?.metadata.observationIdentity));

  const choose = (code: string, nextTab: typeof tab = 'signals') => {
    setSelectedCode(code);
    setSignalView('series');
    setTab(nextTab);
  };

  const handleAI = useCallback(async () => {
    if (!aiQuery.trim() || !selected) return;
    setAiLoading(true);
    try {
      const response = await analyzeMarket.mutateAsync({
        commodity: selected.name,
        question: aiQuery,
        context: `${selected.name}${isCommodityCurrentObservation(selected.date) ? '近期观察' : '历史归档末期观察'}为 ${selected.value} ${selected.unit || ''}，观察期 ${selected.date}，相对上一期变动 ${selected.change === null ? '未提供' : selected.change}。仅允许基于这些已归档业务字段回答。`,
      });
      setAiResult(typeof response.analysis === 'string' ? response.analysis : '当前没有可展示的分析结果。');
    } catch {
      setAiResult('分析服务暂时不可用；已归档观察仍可在行情表和历史轨迹中查看。');
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery, analyzeMarket, selected]);

  return (
    <NewsShell code="COMM" title="商品目录" subtitle="真实商品观察与永久历史" accent={ACCENT} icon={<Activity className="h-4 w-4" style={{ color: ACCENT }} />} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-950 bg-slate-950/60 px-3 py-2 text-[10px] text-slate-400">
        <span className={observations.length ? 'text-emerald-300' : 'text-amber-300'}>{delivery.connection === 'live' ? '自动更新已连接' : delivery.connection === 'connecting' ? '正在连接更新通道' : '定时补收已启用'}</span>
        <span>{archiveSaved ? '永久归档已保存' : '等待可验证观察'} · 最新观察期 {latestDate}</span>
        <button type="button" onClick={() => void delivery.refetch()} disabled={delivery.isLoading} className="inline-flex items-center rounded border border-slate-700 px-2 py-1 text-slate-300 disabled:opacity-50"><RefreshCw className={`mr-1 h-3 w-3 ${delivery.isLoading ? 'animate-spin' : ''}`} />刷新</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="近期可读序列" value={currentSnapshots.length} />
        <StatCard label="永久观察" value={observations.length.toLocaleString()} />
        <StatCard label="最新观察期" value={<span className="text-xs">{latestDate}</span>} />
        <StatCard label="可用状态" value={<span className={currentSnapshots.length ? 'text-emerald-400' : 'text-amber-400'}>{currentSnapshots.length ? '近期观察可读' : '仅历史归档'}</span>} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">{categories.map(item => <button type="button" key={item} onClick={() => setCategory(item)} className={`rounded-full border px-3 py-1 text-xs ${category === item ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>{item}</button>)}</div>

      <div className="mb-4 flex gap-1 border-b border-slate-800">{[
        ['heatmap', '观察热力图'],
        ['table', '行情表'],
        ['signals', '多维信号'],
        ['ai', 'AI 分析'],
      ].map(([id, label]) => <button type="button" key={id} onClick={() => setTab(id as typeof tab)} className={`px-3 py-2 text-xs ${tab === id ? 'border-b-2 border-amber-400 text-amber-300' : 'text-slate-500 hover:text-slate-200'}`}>{label}</button>)}</div>

      {tab === 'heatmap' && !currentFiltered.length && <div className="rounded border border-amber-900/70 bg-amber-950/20 px-4 py-12 text-center text-xs text-amber-200">{delivery.isLoading ? '正在读取永久商品观察…' : '当前分类没有近期发布观察；旧记录仍保留在行情表中，不冒充当前行情。'}</div>}
      {tab === 'table' && !filtered.length && <div className="rounded border border-amber-900/70 bg-amber-950/20 px-4 py-12 text-center text-xs text-amber-200">当前分类没有可验证历史观察。</div>}

      {tab === 'heatmap' && currentFiltered.length > 0 && <div className="space-y-4">
        <SectionTitle accent={ACCENT}>最新已归档观察</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{currentFiltered.map(row => <button type="button" key={row.code} onClick={() => choose(row.code)} className={`rounded border p-3 text-left transition-colors ${heatClass(row.changePercent)}`}><div className="flex items-center justify-between gap-2"><b className="font-mono text-xs">{row.code}</b><span className="text-[10px] opacity-70">{row.category}</span></div><p className="mt-1 truncate text-[11px]">{row.name}</p><p className="mt-3 font-mono text-lg font-semibold">{formatDatasetNumber(row.value, 4)}</p><div className="mt-1 flex justify-between text-[10px] opacity-80"><span>{row.unit}</span><span>{row.changePercent === null ? '—' : `${row.changePercent >= 0 ? '+' : ''}${row.changePercent.toFixed(3)}%`}</span></div><p className="mt-1 text-[10px] opacity-60">{row.date}</p></button>)}</div>
      </div>}

      {tab === 'table' && filtered.length > 0 && <div className="overflow-auto rounded border border-slate-800"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="px-3 py-2">代码 / 名称</th><th>类别</th><th className="text-right">观察值</th><th>单位</th><th className="text-right">本期变动</th><th className="text-right">变动率</th><th>观察期</th><th>时效</th><th className="pr-3 text-right">历史数</th></tr></thead><tbody>{filtered.map(row => <tr key={row.code} onClick={() => choose(row.code)} className="cursor-pointer border-t border-slate-800 hover:bg-slate-900"><td className="px-3 py-2"><b className="font-mono text-amber-300">{row.code}</b><span className="ml-2 text-slate-300">{row.name}</span></td><td>{row.category}</td><td className="text-right font-mono">{formatDatasetNumber(row.value, 4)}</td><td>{row.unit || '—'}</td><td className="text-right font-mono">{formatDatasetNumber(row.change, 4)}</td><td className={`text-right font-mono ${(row.changePercent ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{row.changePercent === null ? '—' : `${row.changePercent.toFixed(3)}%`}</td><td>{row.date}</td><td className={isCommodityCurrentObservation(row.date) ? 'text-emerald-300' : 'text-amber-300'}>{isCommodityCurrentObservation(row.date) ? '近期观察' : '历史归档'}</td><td className="pr-3 text-right">{row.historyCount}</td></tr>)}</tbody></table></div>}

      {tab === 'signals' && <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setSignalView('series')} className={`rounded border px-3 py-1 text-xs ${signalView === 'series' ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400'}`}>单品种明细</button>
        <button type="button" onClick={() => setSignalView('watchlist')} className={`rounded border px-3 py-1 text-xs ${signalView === 'watchlist' ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400'}`}>账户观察组合</button>
      </div>}
      {tab === 'signals' && signalView === 'watchlist' && <div className="space-y-3">
        <CommodityWatchlistWorkspace />
        <details className="rounded border border-slate-800 p-3">
          <summary className="cursor-pointer text-xs text-slate-300">组合分组与标签</summary>
          <div className="mt-3"><CommodityWatchlistTaxonomyPanel /></div>
        </details>
      </div>}
      {tab === 'signals' && signalView === 'series' && !selected && <p className="rounded border border-slate-800 p-4 text-xs text-amber-200">当前没有可验证的商品观察，无法生成单品种明细。</p>}
      {tab === 'signals' && signalView === 'series' && selected && <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded border border-slate-800 bg-slate-950/50 p-3"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-amber-200">{selected.name}</h3><p className="text-[10px] text-slate-500">{selected.code} · {selected.date} · {isCommodityCurrentObservation(selected.date) ? '近期观察' : '历史归档，非当前行情'}</p></div><Database className="h-4 w-4 text-cyan-300" /></div><div className="grid grid-cols-2 gap-2"><StatCard label={isCommodityCurrentObservation(selected.date) ? '近期观察' : '历史末期观察'} value={formatDatasetNumber(selected.value, 4)} /><StatCard label="本期变动" value={formatDatasetNumber(selected.change, 4)} /><StatCard label="变动率" value={selected.changePercent === null ? '—' : `${selected.changePercent.toFixed(3)}%`} /><StatCard label="历史覆盖" value={`${selected.historyCount} 期`} /></div><p className="mt-3 text-[10px] leading-4 text-slate-500">信号仅由该序列相邻实际观察计算；不拼接其他商品、不生成供需预测，也不标记为实时交易信号。</p></section>
        <section className="rounded border border-slate-800 bg-slate-950/50 p-3"><h3 className="text-sm font-semibold text-amber-200">历史轨迹</h3><div className="mt-2 h-72">{history.length >= 2 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} minTickGap={24} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', fontSize: 11 }} /><Line type="monotone" dataKey="value" name={selected.unit || '观察值'} stroke="#f59e0b" dot={false} connectNulls /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-500">真实历史观察不足，未生成替代曲线。</div>}</div></section>
      </div>}

      {tab === 'ai' && <div className="space-y-3 rounded border border-slate-800 bg-slate-950/50 p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">分析序列</span><select value={selected?.code ?? ''} onChange={event => setSelectedCode(event.target.value)} className="h-8 border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200">{snapshots.map(row => <option key={row.code} value={row.code}>{row.code} · {row.name}</option>)}</select></div><SectionTitle accent={ACCENT}>基于永久观察的分析</SectionTitle><div className="flex gap-2"><input value={aiQuery} onChange={event => setAiQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && void handleAI()} placeholder={selected ? `输入关于 ${selected.name} 的问题` : '等待可验证商品观察'} disabled={!selected} className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 disabled:opacity-50" /><button type="button" onClick={() => void handleAI()} disabled={!selected || !aiQuery.trim() || aiLoading} className="inline-flex items-center rounded border border-amber-700 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 disabled:opacity-40">{aiLoading ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Brain className="mr-1 h-3 w-3" />}{aiLoading ? '分析中' : '分析'}</button></div>{aiResult ? <div className="rounded border border-amber-950 bg-amber-950/15 p-3"><div className="mb-2 flex items-center gap-1 text-xs text-amber-300"><Zap className="h-3 w-3" />分析结果</div><div className="text-xs leading-5 text-slate-300"><Streamdown>{aiResult}</Streamdown></div></div> : <p className="py-6 text-center text-xs text-slate-500">分析只接收当前序列的已归档业务字段，不读取其他功能内容。</p>}</div>}
    </NewsShell>
  );
}
