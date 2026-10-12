import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { TERM_DIMENSIONS, SPLINE_INDICES, TIME_RANGES, Y_AXIS_INDICATORS, INSTRUMENTS, type TermDimension } from '@/lib/termRateTraderData';

type RateObservation = { key: string; series: string; code: string; term: string; date: string; spread: number | null; provider: string; observedAt: string | null; quality: string; realtimeStatus: string };
type RateSeriesRow = RateObservation & { dailyChange: number | null; zScore: number | null; percentile: number | null; minValue: number | null; maxValue: number | null };
const TERM_LABELS: Record<TermDimension, string> = { '0-1y': '0-1 年', '1-3y': '1-3 年', '3-5y': '3-5 年', '5-7y': '5-7 年', '7-10y': '7-10 年', '10-20y': '10-20 年', '20y+': '20 年+' };
const TERM_LIMITS: Record<TermDimension, [number, number]> = { '0-1y': [0, 1], '1-3y': [1, 3], '3-5y': [3, 5], '5-7y': [5, 7], '7-10y': [7, 10], '10-20y': [10, 20], '20y+': [20, Number.POSITIVE_INFINITY] };

function termYears(value: string) {
  const match = value.trim().toLocaleLowerCase().match(/(\d+(?:\.\d+)?)\s*(d|w|m|y|day|week|month|year)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  if (match[2].startsWith('d')) return amount / 365;
  if (match[2].startsWith('w')) return amount / 52;
  if (match[2].startsWith('m')) return amount / 12;
  return amount;
}
function matchesTerm(value: string, selected: TermDimension) {
  const years = termYears(value);
  if (years === null) return true;
  const [minimum, maximum] = TERM_LIMITS[selected];
  return years >= minimum && (Number.isFinite(maximum) ? years <= maximum : true);
}
function rowDate(value: string, fallback: string | null) {
  const timestamp = Date.parse(value || fallback || '');
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}
function mapObservations(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map(row => {
    const series = readDatasetText(row.values, ['series', 'series_id', 'name', 'label'], row.datasetLabel);
    const term = readDatasetText(row.values, ['maturity', 'term', 'tenor', 'duration'], '未标注期限');
    return { key: row.key, series, code: readDatasetText(row.values, ['symbol', 'ticker', 'instrument', 'security'], series), term, date: rowDate(readDatasetText(row.values, ['date', 'timestamp', 'datetime', 'period_ending', 'as_of_date'], ''), row.observedAt), spread: readDatasetNumber(row.values, ['spread', 'spread_rate', 'rate', 'value', 'close', 'yield', 'yield_rate']), provider: row.provider, observedAt: row.observedAt, quality: row.quality, realtimeStatus: row.realtimeStatus } satisfies RateObservation;
  }).filter(row => row.spread !== null);
}
function withinRange(rows: RateObservation[], range: string) {
  const days = { '1M': 31, '3M': 93, '6M': 186, '1Y': 366 }[range] ?? 31;
  const dated = rows.map(row => Date.parse(row.date)).filter(Number.isFinite);
  if (!dated.length) return rows;
  const cutoff = Math.max(...dated) - days * 86_400_000;
  return rows.filter(row => { const at = Date.parse(row.date); return !Number.isFinite(at) || at >= cutoff; });
}
function buildSeriesRows(observations: RateObservation[]) {
  const groups = new Map<string, RateObservation[]>();
  observations.forEach(row => { const groupKey = `${row.series}|${row.term}|${row.code}`; groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]); });
  return [...groups.values()].map(group => {
    const sorted = [...group].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const latest = sorted.at(-1)!;
    const values = sorted.map(row => row.spread).filter((value): value is number => value !== null);
    const current = latest.spread;
    const previous = sorted.at(-2)?.spread ?? null;
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const variance = mean === null ? null : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const deviation = variance === null ? null : Math.sqrt(variance);
    return { ...latest, dailyChange: current === null || previous === null ? null : current - previous, zScore: current === null || mean === null || !deviation ? null : (current - mean) / deviation, percentile: current === null || !values.length ? null : (values.filter(value => value <= current).length / values.length) * 100, minValue: values.length ? Math.min(...values) : null, maxValue: values.length ? Math.max(...values) : null } satisfies RateSeriesRow;
  }).sort((a, b) => a.code.localeCompare(b.code));
}

function RateTraderWorkspace({ items, connection, receivedAt, isLoading }: { items: ModuleLiveFeedItem[]; connection: 'connecting' | 'live' | 'fallback'; receivedAt: string | null; isLoading: boolean }) {
  const [selectedTerm, setSelectedTerm] = useState<TermDimension>('0-1y');
  const [selectedSpline, setSelectedSpline] = useState('spline-spread');
  const [selectedTimeRange, setSelectedTimeRange] = useState('1M');
  const [selectedYAxis, setSelectedYAxis] = useState('spread');
  const [selectedInstrument, setSelectedInstrument] = useState('GOVY');
  const [expandedInstrument, setExpandedInstrument] = useState<string | null>(null);
  const allObservations = useMemo(() => mapObservations(items), [items]);
  const observations = useMemo(() => withinRange(allObservations.filter(row => matchesTerm(row.term, selectedTerm)), selectedTimeRange), [allObservations, selectedTerm, selectedTimeRange]);
  const tableRows = useMemo(() => buildSeriesRows(observations), [observations]);
  const matrixData = useMemo(() => Array.from({ length: 11 }, (_, row) => Array.from({ length: 11 }, (_, column) => observations[row * 11 + column]?.spread ?? null)), [observations]);
  const latestObserved = [...observations].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] ?? null;
  const status = connection === 'live' ? '实时连接' : connection === 'connecting' ? '正在连接' : '轮询补收';
  const emptyText = isLoading ? '正在加载真实期限利差数据…' : '期限利差数据源未配置或所选范围暂无历史观测；未使用静态或随机数填充。';
  return <div className="min-h-screen bg-slate-950 text-slate-100 p-6"><div className="max-w-7xl mx-auto">
    <div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-50 mb-2">利率交易员 - {TERM_LABELS[selectedTerm]}</h1><p className="text-slate-400">期限矩阵分析与交易数据展示</p></div><div className="text-right text-xs font-mono text-slate-500"><div className={connection === 'live' ? 'text-emerald-300' : 'text-amber-300'}>{status}</div><div>{receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</div></div></div>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-4"><div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div><label className="text-sm font-medium text-slate-300 mb-2 block">期限维度</label><Select value={selectedTerm} onValueChange={value => setSelectedTerm(value as TermDimension)}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{TERM_DIMENSIONS.map(term => <SelectItem key={term} value={term}>{TERM_LABELS[term]}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium text-slate-300 mb-2 block">样条指数</label><Select value={selectedSpline} onValueChange={setSelectedSpline}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{SPLINE_INDICES.map(index => <SelectItem key={index.value} value={index.value}>{index.label}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium text-slate-300 mb-2 block">时间范围</label><Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{TIME_RANGES.map(range => <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium text-slate-300 mb-2 block">Y-轴指标</label><Select value={selectedYAxis} onValueChange={setSelectedYAxis}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{Y_AXIS_INDICATORS.map(indicator => <SelectItem key={indicator.value} value={indicator.value}>{indicator.label}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium text-slate-300 mb-2 block">标的</label><Select value={selectedInstrument} onValueChange={setSelectedInstrument}><SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-600">{INSTRUMENTS.map(instrument => <SelectItem key={instrument.code} value={instrument.code}>{instrument.code}</SelectItem>)}</SelectContent></Select></div>
    </div><div className="mt-3 text-[11px] text-slate-500">当前指标：{SPLINE_INDICES.find(item => item.value === selectedSpline)?.label} · {TIME_RANGES.find(item => item.value === selectedTimeRange)?.label} · {Y_AXIS_INDICATORS.find(item => item.value === selectedYAxis)?.label} · {observations.length} 条真实观测</div></Card>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-4 overflow-x-auto"><h2 className="text-lg font-semibold text-slate-50 mb-1">期限矩阵 (11x11)</h2><p className="mb-4 text-xs text-slate-500">按观测时间排列的实际利差/利率；缺失单元不插值。</p><table className="w-full text-xs font-mono text-slate-300"><thead><tr className="border-b border-slate-700"><th className="px-2 py-2 text-left text-slate-400">期限</th>{Array.from({ length: 11 }, (_, index) => <th key={index} className="px-2 py-2 text-center text-slate-400">{index}</th>)}</tr></thead><tbody>{matrixData.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-800 hover:bg-slate-800/50"><td className="px-2 py-2 text-slate-400 font-semibold">{rowIndex}</td>{row.map((value, columnIndex) => <td key={columnIndex} className={`px-2 py-2 text-center ${value === null ? 'text-slate-600' : value >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatDatasetNumber(value, 3)}</td>)}</tr>)}</tbody></table>{!observations.length && <p className="mt-4 text-xs text-amber-300">{emptyText}</p>}</Card>
    <Card className="bg-slate-900 border-slate-700 mb-6 p-4 overflow-x-auto"><h2 className="text-lg font-semibold text-slate-50 mb-4">交易数据</h2><table className="w-full text-sm text-slate-300"><thead><tr className="border-b border-slate-700"><th className="px-4 py-3 text-left text-slate-400">代码</th><th className="px-4 py-3 text-right text-slate-400">利差</th><th className="px-4 py-3 text-right text-slate-400">日变动</th><th className="px-4 py-3 text-right text-slate-400">Z-评分</th><th className="px-4 py-3 text-right text-slate-400">百分位</th><th className="px-4 py-3 text-right text-slate-400">最低</th><th className="px-4 py-3 text-right text-slate-400">最高</th></tr></thead><tbody>{tableRows.map(row => <tr key={`${row.series}:${row.term}:${row.code}`} className="border-b border-slate-800 hover:bg-slate-800/50"><td className="px-4 py-3"><div className="font-mono text-blue-400">{row.code}</div><div className="text-[10px] text-slate-500">{row.term} · {row.date ? new Date(row.date).toLocaleDateString() : '日期未提供'}</div></td><td className="px-4 py-3 text-right">{formatDatasetNumber(row.spread, 3)}</td><td className={`px-4 py-3 text-right ${row.dailyChange === null ? 'text-slate-500' : row.dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatDatasetNumber(row.dailyChange, 3)}</td><td className="px-4 py-3 text-right">{formatDatasetNumber(row.zScore, 2)}</td><td className="px-4 py-3 text-right">{row.percentile === null ? '—' : `${formatDatasetNumber(row.percentile, 1)}%`}</td><td className="px-4 py-3 text-right">{formatDatasetNumber(row.minValue, 3)}</td><td className="px-4 py-3 text-right">{formatDatasetNumber(row.maxValue, 3)}</td></tr>)}</tbody></table>{!tableRows.length && <p className="py-4 text-center text-xs text-slate-500">{emptyText}</p>}</Card>
    <Card className="bg-slate-900 border-slate-700 p-4"><h2 className="text-lg font-semibold text-slate-50 mb-4">标的列表</h2><div className="space-y-2">{INSTRUMENTS.map(instrument => { const isExpanded = expandedInstrument === instrument.code; return <div key={instrument.code} className="border border-slate-700 rounded-lg overflow-hidden"><button onClick={() => { setSelectedInstrument(instrument.code); setExpandedInstrument(isExpanded ? null : instrument.code); }} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 flex items-center justify-between text-slate-100 transition-colors"><div className="flex items-center gap-3">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}<span className="font-mono font-semibold">{instrument.code}</span><span className="text-slate-400">{instrument.name}</span></div></button>{isExpanded && <div className="px-4 py-3 bg-slate-900 border-t border-slate-700"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"><div><div className="text-slate-400">当前价格</div><div className="text-lg font-semibold text-slate-100">—</div></div><div><div className="text-slate-400">涨跌</div><div className="text-lg font-semibold text-slate-100">—</div></div><div><div className="text-slate-400">成交量</div><div className="text-lg font-semibold text-slate-100">—</div></div><div><div className="text-slate-400">利差</div><div className="text-lg font-semibold text-slate-100">{formatDatasetNumber(latestObserved?.spread ?? null, 3)}</div></div></div><p className="mt-3 text-[11px] text-slate-500">{latestObserved ? `观测 ${latestObserved.observedAt ?? '未提供'} · ${latestObserved.realtimeStatus} · ${latestObserved.quality}` : emptyText}；当前分片不包含该期货标的价格、涨跌或成交量时保持为空。</p></div>}</div>; })}</div></Card>
  </div></div>;
}
export default function RateTraderByTerm() { return <OpenBBModuleDataBand path="/rate-trader-by-term" title="期限利差数据">{delivery => <RateTraderWorkspace {...delivery} />}</OpenBBModuleDataBand>; }
