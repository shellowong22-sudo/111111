import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Globe, RefreshCw, Search } from 'lucide-react';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import EcbReferenceEvidenceDesk from '@/components/forex/EcbReferenceEvidenceDesk';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { trpc } from '@/lib/trpc';

type FxRow = {
  key: string;
  pair: string;
  base: string;
  quote: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  tenor: string;
  volatility: number | null;
  rate: number | null;
  forecast: number | null;
  date: string;
  provider: string;
  observedAt: string | null;
  realtimeStatus: string;
  quality: string;
  datasetLabel: string;
};

function normalizePair(raw: string, base: string, quote: string) {
  const compact = raw.toLocaleUpperCase().replace(/[^A-Z]/g, '');
  if (compact.length === 6) return `${compact.slice(0, 3)}/${compact.slice(3)}`;
  if (base.length === 3 && quote.length === 3) return `${base}/${quote}`;
  return raw || '未提供';
}

function mapFx(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map(row => {
    const base = readDatasetText(row.values, ['base', 'base_currency', 'from_currency'], '');
    const quote = readDatasetText(row.values, ['quote', 'quote_currency', 'to_currency'], '');
    const pair = normalizePair(readDatasetText(row.values, ['symbol', 'pair', 'currency_pair', 'ticker'], ''), base, quote);
    return {
      key: row.key,
      pair,
      base: base || pair.split('/')[0] || '',
      quote: quote || pair.split('/')[1] || '',
      last: readDatasetNumber(row.values, ['last', 'price', 'rate', 'close', 'value']),
      bid: readDatasetNumber(row.values, ['bid', 'bid_price']),
      ask: readDatasetNumber(row.values, ['ask', 'ask_price']),
      change: readDatasetNumber(row.values, ['change', 'change_value', 'price_change']),
      changePercent: readDatasetNumber(row.values, ['change_percent', 'change_pct', 'percent_change']),
      high: readDatasetNumber(row.values, ['high', 'high_price']),
      low: readDatasetNumber(row.values, ['low', 'low_price']),
      volume: readDatasetNumber(row.values, ['volume', 'turnover']),
      tenor: readDatasetText(row.values, ['tenor', 'maturity', 'expiration', 'period'], ''),
      volatility: readDatasetNumber(row.values, ['implied_volatility', 'volatility', 'iv', 'atm']),
      rate: readDatasetNumber(row.values, ['interest_rate', 'policy_rate', 'rate']),
      forecast: readDatasetNumber(row.values, ['forecast', 'consensus', 'estimate', 'expected']),
      date: readDatasetText(row.values, ['date', 'timestamp', 'datetime', 'period_ending', 'as_of_date'], ''),
      provider: row.provider,
      observedAt: row.observedAt,
      realtimeStatus: row.realtimeStatus,
      quality: row.quality,
      datasetLabel: row.datasetLabel,
    } satisfies FxRow;
  });
}

function FxWorkspace({ items, connection, receivedAt, refetch, isLoading }: {
  items: ModuleLiveFeedItem[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
  refetch: () => unknown;
  isLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState('fxc');
  const archived = trpc.freeMarketData.archivedFxReference.useQuery(undefined, { refetchInterval: 60_000, staleTime: 30_000 });
  const liveRows = useMemo(() => mapFx(items), [items]);
  const archivedRows = useMemo<FxRow[]>(() => (archived.data?.points ?? []).map(point => {
    const date = typeof point.date === 'string' ? point.date : new Date(point.date).toISOString().slice(0, 10);
    return {
    key: `archive:${point.pair}:${date}`, pair: String(point.pair),
    base: point.pair.split('/')[0] ?? '', quote: point.pair.split('/')[1] ?? '',
    last: point.value, bid: null, ask: null, change: null, changePercent: null,
    high: null, low: null, volume: null, tenor: '', volatility: null, rate: null, forecast: null,
    date, provider: '已归档参考数据', observedAt: date,
    realtimeStatus: '官方参考·非实时', quality: 'persistent_archive', datasetLabel: '外汇参考历史',
  };
  }), [archived.data]);
  const rows = useMemo(() => {
    const merged = [...liveRows, ...(activeTab === 'fxc' ? archivedRows : [])];
    const unique = new Map<string, FxRow>();
    for (const row of merged) {
      const key = `${row.pair}|${row.date}|${row.tenor}|${row.volatility !== null ? 'volatility' : row.forecast !== null ? 'forecast' : 'quote'}`;
      if (!unique.has(key)) unique.set(key, row);
    }
    return [...unique.values()];
  }, [liveRows, archivedRows, activeTab]);
  const [search, setSearch] = useState('');
  const [selectedPair, setSelectedPair] = useState('');
  const filtered = useMemo(() => rows.filter(row => !search || `${row.pair} ${row.base} ${row.quote} ${row.datasetLabel}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [rows, search]);
  const quoteRows = useMemo(() => {
    const unique = new Map<string, FxRow>();
    filtered.filter(row => row.last !== null && row.pair !== '未提供').sort((a, b) => {
      const aTime = Date.parse(a.date || a.observedAt || '') || 0;
      const bTime = Date.parse(b.date || b.observedAt || '') || 0;
      return bTime - aTime;
    }).forEach(row => { if (!unique.has(row.pair)) unique.set(row.pair, row); });
    return [...unique.values()];
  }, [filtered]);
  const chosenPair = selectedPair || quoteRows[0]?.pair || '';
  const selected = quoteRows.find(row => row.pair === chosenPair) ?? null;
  const history = useMemo(() => rows.filter(row => row.pair === chosenPair && row.datasetLabel === selected?.datasetLabel && row.date && row.last !== null).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)), [rows, chosenPair, selected?.datasetLabel]);
  const volatility = useMemo(() => filtered.filter(row => row.volatility !== null), [filtered]);
  const forwards = useMemo(() => filtered.filter(row => row.tenor && (row.forecast !== null || row.last !== null || /forward|forecast|curve|swap|basis/i.test(row.datasetLabel))), [filtered]);
  const currencies = useMemo(() => [...new Set(quoteRows.flatMap(row => [row.base, row.quote]).filter(Boolean))].sort(), [quoteRows]);
  const matrix = useMemo(() => {
    const values = new Map<string, number>();
    quoteRows.forEach(row => {
      if (row.last === null || !row.base || !row.quote) return;
      values.set(`${row.base}/${row.quote}`, row.last);
      if (row.last !== 0) values.set(`${row.quote}/${row.base}`, 1 / row.last);
    });
    return values;
  }, [quoteRows]);
  const status = connection === 'live' ? '推送连接' : connection === 'connecting' ? '正在连接' : '轮询补收';
  const empty = (label: string) => <div className="border border-slate-800 bg-black px-3 py-12 text-center text-xs text-slate-500">{isLoading ? `正在加载${label}…` : `${label}暂无可验证观察；系统不会生成或复制数值。`}</div>;

  return <div className="min-h-screen bg-gray-950 text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
      <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-400" /><div><h1 className="text-lg font-bold text-blue-400">外汇市场综合分析中心</h1><p className="text-xs text-gray-500">FXC · WVOL · XCCY · FXFC · FXSW</p></div></div>
      <div className="flex items-center gap-3 font-mono text-[10px] text-gray-500"><span className={connection === 'live' ? 'text-emerald-300' : connection === 'connecting' ? 'text-amber-300' : 'text-rose-300'}>{status}</span><span>接收 {receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</span><Button type="button" variant="outline" size="sm" onClick={() => { void refetch(); void archived.refetch(); }} className="h-7 border-gray-700 bg-transparent text-xs"><RefreshCw className="mr-1 h-3 w-3" />刷新</Button></div>
    </header>
    <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2"><Search className="h-3.5 w-3.5 text-gray-500" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索货币对、币种或数据集" className="h-7 max-w-lg border-gray-700 bg-black text-xs" /><span className="ml-auto font-mono text-[10px] text-gray-500">唯一记录 {rows.length} · 货币对 {quoteRows.length}</span></div>

    {activeTab === 'fxc' && <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-800 px-3 py-2 text-[10px] text-gray-400">
      <span>参考历史 {archivedRows.length} 条 · 每分钟读取存档</span>
      <span>观察日期 {selected?.observedAt ? String(selected.observedAt) : '—'}</span>
      <span>{archived.isError ? '存档读取失败' : archived.data?.collection.some(state => state.lastStatus !== 'available') ? '部分采集失败，保留历史' : archived.data?.available ? '已持久化 · 非实时交易报价' : '尚无已归档观察'}</span>
      {selected?.quote === 'HKD' && archived.data?.indices.at(-1) && <span>贸易加权指数 {archived.data.indices.at(-1)?.value} · {String(archived.data.indices.at(-1)?.date)} · 2020 基期</span>}
    </div>}
    <Tabs value={activeTab} onValueChange={setActiveTab} className="p-3">
      <TabsList className="mb-3 h-auto flex-wrap border border-gray-800 bg-gray-900 p-1">{[['fxc', 'FXC 汇率矩阵'], ['wvol', 'WVOL 隐含波动率'], ['xccy', 'XCCY 交叉货币基差'], ['fxfc', 'FXFC 汇率预测'], ['fxsw', 'FXSW 策略工作台']].map(([value, label]) => <TabsTrigger key={value} value={value} className="text-xs data-[state=active]:bg-blue-950 data-[state=active]:text-blue-300">{label}</TabsTrigger>)}</TabsList>

      <TabsContent value="fxc"><div className="grid min-h-[520px] grid-cols-1 border border-gray-800 lg:grid-cols-[320px_1fr]">
        <div className="overflow-auto border-r border-gray-800"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-gray-950 text-gray-500"><tr><th className="px-2 py-1.5">货币对</th><th className="text-right">参考值</th><th className="text-right">买价</th><th className="pr-2 text-right">卖价</th></tr></thead><tbody>{quoteRows.map(row => <tr key={row.pair} onClick={() => setSelectedPair(row.pair)} className={`cursor-pointer border-t border-gray-900 ${chosenPair === row.pair ? 'bg-blue-950/40' : 'hover:bg-gray-900'}`}><td className="px-2 py-1.5 font-semibold text-blue-300">{row.pair}<span className="block text-[9px] font-normal text-gray-500">{row.date || '观察日未提供'}</span></td><td className="text-right font-mono">{formatDatasetNumber(row.last, 6)}</td><td className="text-right font-mono">{formatDatasetNumber(row.bid, 6)}</td><td className="pr-2 text-right font-mono">{formatDatasetNumber(row.ask, 6)}</td></tr>)}</tbody></table>{!quoteRows.length && empty('主要货币对')}</div>
        <div className="min-w-0"><div className="grid grid-cols-2 gap-px border-b border-gray-800 bg-gray-800 text-[11px] sm:grid-cols-4 lg:grid-cols-8">{[['参考值', selected?.last], ['买价', selected?.bid], ['卖价', selected?.ask], ['涨跌', selected?.change], ['日高', selected?.high], ['日低', selected?.low], ['成交量', selected?.volume], ['时效', selected?.realtimeStatus]].map(([label, value]) => <div key={String(label)} className="bg-gray-950 px-2 py-2"><span className="block text-[9px] text-gray-600">{label}</span><b className="font-mono text-gray-200">{typeof value === 'number' ? formatDatasetNumber(value, 6) : value ?? '—'}</b></div>)}</div>
          <div className="h-64 border-b border-gray-800 p-2">{history.length >= 2 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="fxLive" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 9 }} /><Tooltip /><Area type="monotone" dataKey="last" stroke="#3b82f6" fill="url(#fxLive)" dot={false} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-gray-600">{selected ? '真实历史序列不足，未生成替代曲线。' : '请选择已载入的货币对。'}</div>}</div>
          <div className="overflow-auto p-2"><h3 className="mb-2 text-xs text-gray-400">已收录货币对与倒数换算（非可执行报价）</h3>{currencies.length ? <table className="w-full min-w-[560px] text-[10px]"><thead><tr><th className="text-left text-gray-600">↓基准 / 报价→</th>{currencies.map(currency => <th key={currency} className="px-2 text-right text-blue-400">{currency}</th>)}</tr></thead><tbody>{currencies.map(base => <tr key={base} className="border-t border-gray-900"><td className="py-1 font-bold text-blue-400">{base}</td>{currencies.map(quote => <td key={quote} className="px-2 text-right font-mono">{base === quote ? '1.000000' : formatDatasetNumber(matrix.get(`${base}/${quote}`) ?? null, 6)}</td>)}</tr>)}</tbody></table> : empty('汇率矩阵')}</div>
        </div>
      </div></TabsContent>

      <TabsContent value="wvol">{volatility.length ? <div className="grid grid-cols-1 border border-gray-800 lg:grid-cols-[1fr_420px]"><div className="h-[420px] p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={volatility}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="tenor" tick={{ fill: '#6b7280', fontSize: 10 }} /><YAxis tick={{ fill: '#6b7280', fontSize: 10 }} /><Tooltip /><Legend /><Line dataKey="volatility" name="隐含波动率" stroke="#60a5fa" dot /></LineChart></ResponsiveContainer></div><DomainTable rows={volatility} mode="volatility" /></div> : empty('隐含波动率')}</TabsContent>
      <TabsContent value="xccy">{forwards.length ? <div className="grid grid-cols-1 border border-gray-800 lg:grid-cols-[1fr_420px]"><div className="h-[420px] p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={forwards}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="tenor" tick={{ fill: '#6b7280', fontSize: 10 }} /><YAxis tick={{ fill: '#6b7280', fontSize: 10 }} /><Tooltip /><Line dataKey="last" name="基差/远期值" stroke="#f59e0b" dot /></LineChart></ResponsiveContainer></div><DomainTable rows={forwards} mode="forward" /></div> : empty('交叉货币基差')}</TabsContent>
      <TabsContent value="fxfc">{rows.some(row => row.forecast !== null) ? <DomainTable rows={rows.filter(row => row.forecast !== null)} mode="forecast" /> : empty('汇率预测')}</TabsContent>
      <TabsContent value="fxsw"><div className="grid grid-cols-1 border border-gray-800 lg:grid-cols-2"><DomainTable rows={quoteRows} mode="quote" /><section className="border-l border-gray-800 p-4 text-xs text-gray-400"><h3 className="mb-2 font-semibold text-blue-300">外汇策略工作台</h3><p>策略输入仅来自左侧已接收报价。未接收利率、基差、波动率或预测字段时，不生成交易方向、目标价或止损价。</p><dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 font-mono text-[10px]"><dt>当前标的</dt><dd>{selected?.pair ?? '未选择'}</dd><dt>数据提供方</dt><dd>{selected?.provider ?? '未提供'}</dd><dt>观测时间</dt><dd>{selected?.observedAt ? String(selected.observedAt) : '未提供'}</dd><dt>质量</dt><dd>{selected?.quality ?? '未提供'}</dd><dt>时效</dt><dd>{selected?.realtimeStatus ?? '未提供'}</dd></dl></section></div></TabsContent>
    </Tabs>
    <EcbReferenceEvidenceDesk />
  </div>;
}

function DomainTable({ rows, mode }: { rows: FxRow[]; mode: 'volatility' | 'forward' | 'forecast' | 'quote' }) {
  return <div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[560px] text-left text-[10px]"><thead className="sticky top-0 bg-gray-950 text-gray-500"><tr><th className="px-2 py-1.5">货币对</th><th>期限/日期</th><th className="text-right">{mode === 'volatility' ? '波动率' : mode === 'forecast' ? '预测值' : '数值'}</th><th>观测时间</th><th>质量/时效</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} className="border-t border-gray-900 hover:bg-gray-900"><td className="px-2 py-1.5 font-semibold text-blue-300">{row.pair}{row.quality === 'persistent_archive' && <span className="block text-[9px] font-normal text-gray-500">{row.date} · {formatDatasetNumber(row.last, 6)}</span>}</td><td>{row.tenor || row.date || '—'}</td><td className="text-right font-mono">{formatDatasetNumber(mode === 'volatility' ? row.volatility : mode === 'forecast' ? row.forecast : row.last, 6)}</td><td>{row.observedAt ?? '未提供'}</td><td>{row.quality} · {row.realtimeStatus}</td></tr>)}</tbody></table></div>;
}

export default function ForexHub() {
  return <OpenBBModuleDataBand path="/forex-hub" title="外汇中心数据" filterItems={items => items.filter(item => Boolean(item.dataset) && mapFx([item]).some(row => /^[A-Z]{3}\/[A-Z]{3}$/.test(row.pair)))}>{delivery => <FxWorkspace {...delivery} />}</OpenBBModuleDataBand>;
}
