import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FOREX_PAIRS } from '@/lib/globalCurvesData';
import { Search } from 'lucide-react';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

type FxQuote = { key: string; pair: string; last: number | null; change: number | null; changePercent: number | null; open: number | null; high: number | null; low: number | null; volume: number | null; volatility: number | null; date: string; provider: string; observedAt: string | null; quality: string; realtimeStatus: string };

function normalizePair(value: string) {
  const compact = value.toLocaleUpperCase().replace(/[^A-Z]/g, '');
  return compact.length === 6 ? `${compact.slice(0, 3)}/${compact.slice(3)}` : value.toLocaleUpperCase();
}

function mapQuotes(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map(row => ({
    key: row.key,
    pair: normalizePair(readDatasetText(row.values, ['symbol', 'pair', 'currency_pair', 'ticker', 'instrument'], '')),
    last: readDatasetNumber(row.values, ['last', 'price', 'rate', 'close', 'value']),
    change: readDatasetNumber(row.values, ['change', 'change_value', 'price_change']),
    changePercent: readDatasetNumber(row.values, ['change_percent', 'change_pct', 'percent_change']),
    open: readDatasetNumber(row.values, ['open', 'open_price']),
    high: readDatasetNumber(row.values, ['high', 'high_price']),
    low: readDatasetNumber(row.values, ['low', 'low_price']),
    volume: readDatasetNumber(row.values, ['volume', 'turnover']),
    volatility: readDatasetNumber(row.values, ['volatility', 'implied_volatility', 'iv']),
    date: readDatasetText(row.values, ['date', 'timestamp', 'datetime', 'period_ending', 'as_of_date'], ''),
    provider: row.provider,
    observedAt: row.observedAt,
    quality: row.quality,
    realtimeStatus: row.realtimeStatus,
  } satisfies FxQuote));
}

function ForexWorkspace({ items, connection, receivedAt, isLoading }: { items: ModuleLiveFeedItem[]; connection: 'connecting' | 'live' | 'fallback'; receivedAt: string | null; isLoading: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const quotes = useMemo(() => mapQuotes(items), [items]);
  const byPair = useMemo(() => {
    const map = new Map<string, FxQuote>();
    quotes.forEach(row => { if (row.pair) map.set(row.pair, row); });
    return map;
  }, [quotes]);
  const filteredPairs = FOREX_PAIRS.filter(pair => pair.toLowerCase().includes(searchTerm.toLowerCase()));
  const selected = byPair.get(normalizePair(selectedPair));
  const status = connection === 'live' ? '实时连接' : connection === 'connecting' ? '正在连接' : '轮询补收';
  const emptyText = isLoading ? '正在加载真实外汇数据…' : '外汇曲线数据源未配置或暂无可验证报价；未使用静态数字填充。';

  return <div className="min-h-screen bg-slate-950 text-slate-100 p-6"><div className="max-w-7xl mx-auto">
    <div className="mb-8 flex items-start justify-between gap-4"><div><h1 className="text-4xl font-bold text-slate-50 mb-2">外汇曲线行情</h1><p className="text-slate-400">货币对报价、历史序列与期限数据</p></div><div className="text-right text-xs font-mono text-slate-500"><div className={connection === 'live' ? 'text-emerald-300' : 'text-amber-300'}>{status}</div><div>{receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</div></div></div>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-4"><div className="relative mb-4"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input placeholder="搜索货币对 (e.g., EUR/USD, USD/JPY)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500" /></div><div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">{filteredPairs.slice(0, 24).map(pair => <button key={pair} onClick={() => setSelectedPair(pair)} className={`px-3 py-2 rounded text-sm font-mono transition-colors ${selectedPair === pair ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{pair}</button>)}</div></Card>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-6"><div className="flex items-center justify-between mb-6"><div><h2 className="text-2xl font-bold text-slate-50">{selectedPair}</h2><p className="text-slate-400 text-sm">{selected ? `${selected.observedAt ?? '观测时间未提供'} · ${selected.realtimeStatus}` : emptyText}</p></div><div className="text-right"><div className="text-3xl font-bold text-slate-100">{formatDatasetNumber(selected?.last ?? null, 6)}</div><div className={selected?.change !== null && (selected?.change ?? 0) >= 0 ? 'text-[#f2495c] text-sm' : 'text-[#1fbf75] text-sm'}>{selected?.change === null || selected?.change === undefined ? '—' : `${selected.change >= 0 ? '+' : ''}${formatDatasetNumber(selected.change, 6)} (${formatDatasetNumber(selected.changePercent, 4)}%)`}</div></div></div><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[['开盘', selected?.open], ['最高', selected?.high], ['最低', selected?.low], ['成交量', selected?.volume], ['波动率', selected?.volatility]].map(([label, value]) => <div key={String(label)}><div className="text-slate-400 text-sm">{label}</div><div className="text-lg font-semibold text-slate-100">{typeof value === 'number' ? formatDatasetNumber(value, 6) : '—'}</div></div>)}</div></Card>
    <Card className="bg-slate-900 border-slate-700 p-6"><h3 className="text-lg font-semibold text-slate-50 mb-4">所有货币对</h3><div className="overflow-x-auto"><table className="w-full text-sm text-slate-300"><thead><tr className="border-b border-slate-700"><th className="px-4 py-3 text-left text-slate-400">货币对</th><th className="px-4 py-3 text-right text-slate-400">汇率</th><th className="px-4 py-3 text-right text-slate-400">涨跌</th><th className="px-4 py-3 text-right text-slate-400">涨跌%</th><th className="px-4 py-3 text-right text-slate-400">成交量</th><th className="px-4 py-3 text-right text-slate-400">波动率</th></tr></thead><tbody>{filteredPairs.map(pair => { const row = byPair.get(normalizePair(pair)); const change = row?.change ?? null; return <tr key={pair} onClick={() => setSelectedPair(pair)} className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"><td className="px-4 py-3 font-mono text-blue-400">{pair}</td><td className="px-4 py-3 text-right">{formatDatasetNumber(row?.last ?? null, 6)}</td><td className={`px-4 py-3 text-right ${change !== null && change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change === null ? '—' : `${change >= 0 ? '+' : ''}${formatDatasetNumber(change, 6)}`}</td><td className="px-4 py-3 text-right">{row?.changePercent === null || row?.changePercent === undefined ? '—' : `${formatDatasetNumber(row.changePercent, 4)}%`}</td><td className="px-4 py-3 text-right">{formatDatasetNumber(row?.volume ?? null, 2)}</td><td className="px-4 py-3 text-right">{row?.volatility === null || row?.volatility === undefined ? '—' : `${formatDatasetNumber(row.volatility, 4)}%`}</td></tr>; })}</tbody></table></div></Card>
  </div></div>;
}

export default function ForexCurvesHub() {
  return <OpenBBModuleDataBand path="/forex-curves" title="外汇曲线数据">{delivery => <ForexWorkspace {...delivery} />}</OpenBBModuleDataBand>;
}
