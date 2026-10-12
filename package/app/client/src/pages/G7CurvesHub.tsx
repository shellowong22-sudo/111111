import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { G7_COUNTRIES, MATURITY_TERMS } from '@/lib/globalCurvesData';
import { ChevronDown, ChevronUp } from 'lucide-react';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

type CurveRow = { key: string; country: string; term: string; yieldValue: number | null; change: number | null; volatility: number | null; spread: number | null; date: string; provider: string; observedAt: string | null; realtimeStatus: string; };

function mapCurves(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map(row => ({
    key: row.key,
    country: readDatasetText(row.values, ['country', 'country_code', 'market', 'region', 'issuer'], ''),
    term: readDatasetText(row.values, ['maturity', 'term', 'tenor', 'duration', 'label'], ''),
    yieldValue: readDatasetNumber(row.values, ['yield', 'yield_rate', 'ytm', 'rate', 'value', 'close']),
    change: readDatasetNumber(row.values, ['change', 'change_value', 'daily_change', 'change_bps']),
    volatility: readDatasetNumber(row.values, ['volatility', 'implied_volatility', 'vol']),
    spread: readDatasetNumber(row.values, ['spread', 'curve_spread', 'spread_bps']),
    date: readDatasetText(row.values, ['date', 'timestamp', 'datetime', 'period_ending', 'as_of_date'], ''),
    provider: row.provider,
    observedAt: row.observedAt,
    realtimeStatus: row.realtimeStatus,
  } satisfies CurveRow));
}

function G7Workspace({ items, connection, receivedAt, isLoading }: { items: ModuleLiveFeedItem[]; connection: 'connecting' | 'live' | 'fallback'; receivedAt: string | null; isLoading: boolean }) {
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [selectedTerm, setSelectedTerm] = useState('10Y');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const rows = useMemo(() => mapCurves(items), [items]);
  const countryRows = (code: string) => rows.filter(row => row.country.toLocaleUpperCase().includes(code) || row.country.toLocaleUpperCase().includes(G7_COUNTRIES.find(country => country.code === code)?.name.toLocaleUpperCase() ?? ''));
  const selectedRows = countryRows(selectedCountry);
  const findTerm = (code: string, term: string) => countryRows(code).find(row => row.term.toLocaleUpperCase().replace(/\s/g, '').includes(term.toLocaleUpperCase().replace(/\s/g, '')));
  const current = findTerm(selectedCountry, selectedTerm);
  const status = connection === 'live' ? '实时连接' : connection === 'connecting' ? '正在连接' : '轮询补收';
  const emptyText = isLoading ? '正在加载真实收益率数据…' : 'G7 曲线数据源未配置或暂无可验证观测；未使用静态数字填充。';

  return <div className="min-h-screen bg-slate-950 text-slate-100 p-6"><div className="max-w-7xl mx-auto">
    <div className="mb-8 flex items-start justify-between gap-4"><div><h1 className="text-4xl font-bold text-slate-50 mb-2">G7 国家收益率曲线</h1><p className="text-slate-400">美国、英国、日本、德国、法国、意大利、加拿大的债券收益率数据</p></div><div className="text-right text-xs font-mono text-slate-500"><div className={connection === 'live' ? 'text-emerald-300' : 'text-amber-300'}>{status}</div><div>{receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</div></div></div>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><label className="text-sm font-medium text-slate-300 mb-2 block">选择国家</label><Select value={selectedCountry} onValueChange={setSelectedCountry}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{G7_COUNTRIES.map(country => <SelectItem key={country.code} value={country.code}>{country.flag} {country.name}</SelectItem>)}</SelectContent></Select></div><div><label className="text-sm font-medium text-slate-300 mb-2 block">期限</label><Select value={selectedTerm} onValueChange={setSelectedTerm}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{MATURITY_TERMS.map(term => <SelectItem key={term.value} value={term.value}>{term.label}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-2"><label className="text-sm font-medium text-slate-300 mb-2 block">快速选择</label><div className="flex gap-2">{G7_COUNTRIES.map(country => <Button key={country.code} onClick={() => setSelectedCountry(country.code)} className={`px-3 py-2 text-sm ${selectedCountry === country.code ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'} text-white`}>{country.flag}</Button>)}</div></div></div></Card>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-6"><h2 className="text-lg font-semibold text-slate-50 mb-4">收益率对比 ({selectedTerm})</h2><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">{G7_COUNTRIES.map(country => { const row = findTerm(country.code, selectedTerm); return <button key={country.code} onClick={() => setSelectedCountry(country.code)} className="bg-slate-800 rounded p-3 text-center hover:bg-slate-700"><div className="text-2xl mb-1">{country.flag}</div><div className="text-xs text-slate-400 mb-1">{country.code}</div><div className="text-lg font-bold text-slate-100">{formatDatasetNumber(row?.yieldValue ?? null)}%</div><div className="text-xs text-slate-400">{row?.change === null || row?.change === undefined ? '—' : `${row.change >= 0 ? '+' : ''}${formatDatasetNumber(row.change, 3)}`}</div></button>; })}</div></Card>
    <div className="space-y-3"><h2 className="text-lg font-semibold text-slate-50 mb-4">国家详情</h2>{G7_COUNTRIES.map(country => { const rowsForCountry = countryRows(country.code); const isOpen = expandedCountry === country.code; return <Card key={country.code} className="bg-slate-900 border-slate-700 overflow-hidden"><button onClick={() => setExpandedCountry(isOpen ? null : country.code)} className="w-full px-6 py-4 bg-slate-800 hover:bg-slate-700 flex items-center justify-between transition-colors"><div className="flex items-center gap-3"><span className="text-2xl">{country.flag}</span><div className="text-left"><div className="font-semibold text-slate-100">{country.name}</div><div className="text-xs text-slate-400">{country.code} · {rowsForCountry.length} 条观测</div></div></div>{isOpen ? <ChevronUp /> : <ChevronDown />}</button>{isOpen && <div className="p-6 border-t border-slate-700"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-700">{MATURITY_TERMS.map(term => { const row = findTerm(country.code, term.value); return <div key={term.value}><div className="text-slate-400 text-sm">{term.label} 收益率</div><div className="text-2xl font-bold text-slate-100">{formatDatasetNumber(row?.yieldValue ?? null)}%</div></div>; })}</div><div className="grid grid-cols-2 md:grid-cols-3 gap-4"><div><div className="text-slate-400 text-sm">波动率</div><div className="text-lg font-semibold text-slate-100">{formatDatasetNumber(rowsForCountry.find(row => row.volatility !== null)?.volatility ?? null)}%</div></div><div><div className="text-slate-400 text-sm">日涨跌</div><div className="text-lg font-semibold text-slate-100">{formatDatasetNumber(rowsForCountry.find(row => row.change !== null)?.change ?? null, 3)}</div></div><div><div className="text-slate-400 text-sm">2-10年利差</div><div className="text-lg font-semibold text-slate-100">{formatDatasetNumber(rowsForCountry.find(row => row.spread !== null)?.spread ?? null, 3)}</div></div></div>{!rowsForCountry.length && <p className="mt-4 text-xs text-slate-500">{emptyText}</p>}{rowsForCountry[0] && <p className="mt-4 text-[10px] text-slate-600">观测 {rowsForCountry[0].observedAt ?? '未提供'} · {rowsForCountry[0].realtimeStatus}</p>}</div>}</Card>; })}</div>
  </div></div>;
}

export default function G7CurvesHub() {
  return <OpenBBModuleDataBand path="/g7-curves" title="G7 曲线数据">{delivery => <G7Workspace {...delivery} />}</OpenBBModuleDataBand>;
}
