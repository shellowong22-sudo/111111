import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FilterX, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, LoadingState, PanelShell, chartTooltipStyle } from './sovereign/PanelKit';

type Props = { onClose?: () => void; onOpenPanel?: (code: string, name: string) => void };
type Point = { date: string; value: number };
type StructurePoint = { label: string; value: number; observedAt: string };
type SecurityRow = {
  id: string;
  symbol: string;
  name: string;
  issuer: string;
  country: string;
  countryCode: string;
  market: string;
  currency: string;
  tenor: string;
  tenorYears: number | null;
  rating: string | null;
  ratingState: string;
  kind: 'benchmark' | 'auction';
  value: number | null;
  valueLabel: string;
  unit: string;
  change: number | null;
  changeUnit: string;
  observedAt: string;
  retrievedAt: string;
  frequency: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceState: 'current' | 'review' | 'unknown';
  ageDays: number | null;
  history: Point[];
  changeHistory: Point[];
  structureLabel: string;
  structure: StructurePoint[];
  demandHistory: Point[];
  sizeHistory: Point[];
  auction: null | {
    issueDate: string | null;
    maturityDate: string | null;
    offeringAmount: number | null;
    bidToCoverRatio: number | null;
    couponRate: number | null;
    securityType: string;
  };
};
type AnalysisView = 'history' | 'change' | 'structure' | 'demand' | 'quality';

function tenorBucket(row: SecurityRow) {
  if (row.tenorYears === null) return '未标期限';
  if (row.tenorYears <= 3) return '短端 ≤3Y';
  if (row.tenorYears <= 10) return '中段 3–10Y';
  return '长端 >10Y';
}

function formatValue(value: number | null, unit: string, digits = 3) {
  if (value === null) return '尚未发布';
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(2, digits) })}${unit ? ` ${unit}` : ''}`;
}

function formatAmount(value: number | null) {
  if (value === null) return '未披露';
  return `${(value / 1_000_000_000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 十亿 USD`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadSelection(row: SecurityRow) {
  const records: Array<Array<string | number | null>> = [
    ['record_type', 'symbol', 'name', 'date_or_label', 'value', 'unit', 'source', 'source_url'],
    ['latest', row.symbol, row.name, row.observedAt, row.value, row.unit, row.sourceLabel, row.sourceUrl],
    ...row.history.map(point => ['level_history', row.symbol, row.name, point.date, point.value, row.unit, row.sourceLabel, row.sourceUrl]),
    ...row.changeHistory.map(point => ['change_history', row.symbol, row.name, point.date, point.value, row.changeUnit, row.sourceLabel, row.sourceUrl]),
    ...row.structure.map(point => ['cross_section', row.symbol, row.name, `${point.label} · ${point.observedAt}`, point.value, '%', row.sourceLabel, row.sourceUrl]),
    ...row.sizeHistory.map(point => ['offering_size', row.symbol, row.name, point.date, point.value, '十亿 USD', row.sourceLabel, row.sourceUrl]),
    ...row.demandHistory.map(point => ['bid_to_cover', row.symbol, row.name, point.date, point.value, '倍', row.sourceLabel, row.sourceUrl]),
  ];
  const csv = `\uFEFF${records.map(record => record.map(csvCell).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `secf-${row.symbol}-${row.observedAt}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return records.length - 1;
}

function InsightMetric({ label, value, active, onClick, enabled = true, tone = 'text-cyan-300' }: { label: string; value: string; active: boolean; onClick: () => void; enabled?: boolean; tone?: string }) {
  const content = <><span className="text-[9px] uppercase tracking-wide text-slate-500">{label}</span><strong className={`mt-1 block truncate font-mono text-sm ${tone}`}>{value}</strong></>;
  return enabled
    ? <button type="button" aria-pressed={active} onClick={onClick} className={`rounded border p-2 text-left transition ${active ? 'border-cyan-700 bg-cyan-950/35' : 'border-slate-800 bg-slate-950/25 hover:border-slate-600'}`}>{content}</button>
    : <div className="rounded border border-slate-800 bg-slate-950/20 p-2 opacity-70">{content}</div>;
}

export default function SovereignSearchPanel({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState('全部币种');
  const [maturity, setMaturity] = useState('全部期限');
  const [rating, setRating] = useState('全部评级状态');
  const [selectedId, setSelectedId] = useState('');
  const [analysisView, setAnalysisView] = useState<AnalysisView>('history');
  const [exportStatus, setExportStatus] = useState('');
  const [manualSync, setManualSync] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const universe = trpc.secf.sovereignUniverse.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const rows = (universe.data?.rows ?? []) as SecurityRow[];
  const currencies = useMemo(() => ['全部币种', ...Array.from(new Set(rows.map(row => row.currency))).sort()], [rows]);
  const ratingValues = useMemo(() => Array.from(new Set(rows.flatMap(row => row.rating ? [row.rating] : []))).sort(), [rows]);
  const ratingFilterAvailable = ratingValues.length > 0;
  const maturities = useMemo(() => ['全部期限', '短端 ≤3Y', '中段 3–10Y', '长端 >10Y', ...(rows.some(row => row.tenorYears === null) ? ['未标期限'] : [])], [rows]);

  const filterResult = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const textRows = rows.filter(row => !needle || [row.symbol, row.name, row.issuer, row.country, row.countryCode, row.market, row.currency, row.tenor, row.valueLabel, row.sourceLabel, row.rating ?? row.ratingState].join(' ').toLowerCase().includes(needle));
    const currencyRows = textRows.filter(row => currency === '全部币种' || row.currency === currency);
    const maturityRows = currencyRows.filter(row => maturity === '全部期限' || tenorBucket(row) === maturity);
    const ratingRows = maturityRows.filter(row => rating === '全部评级状态' || (row.rating ?? row.ratingState) === rating);
    return {
      rows: ratingRows,
      eliminated: {
        text: rows.length - textRows.length,
        currency: textRows.length - currencyRows.length,
        maturity: currencyRows.length - maturityRows.length,
        rating: maturityRows.length - ratingRows.length,
      },
    };
  }, [currency, maturity, query, rating, rows]);
  const filtered = filterResult.rows;

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId('');
      return;
    }
    if (!filtered.some(row => row.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find(row => row.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setExportStatus('');
    setAnalysisView(selected.history.length ? 'history' : selected.sizeHistory.length ? 'structure' : selected.demandHistory.length ? 'demand' : 'quality');
  }, [selected?.id]);

  const resetFilters = () => {
    setQuery('');
    setCurrency('全部币种');
    setMaturity('全部期限');
    setRating('全部评级状态');
  };

  const sources = universe.data?.sources ?? [];
  const sourceStatus = selected?.sourceState === 'current' ? '有效' : selected?.sourceState === 'review' ? '待复核' : '未知';
  const selectedStructure = selected?.kind === 'auction' ? selected.sizeHistory : selected?.structure ?? [];
  const refresh = async () => {
    setManualSync('syncing');
    const result = await universe.refetch();
    setManualSync(result.error ? 'error' : 'done');
  };
  const connectionLabel = universe.data?.degraded ? '断线降级 · 最近有效数据' : manualSync === 'syncing' ? '正在同步数据源' : manualSync === 'done' ? '同步完成' : manualSync === 'error' ? '同步失败' : universe.isFetching ? '自动同步中' : '数据链路已连接';
  const connectionTone = universe.data?.degraded || manualSync === 'error' ? 'text-amber-300' : manualSync === 'syncing' || universe.isFetching ? 'text-cyan-300' : 'text-emerald-300';

  return <PanelShell ticker="SECF" title="证券查找" subtitle="官方标识检索、筛选淘汰解释与单一证据链联动" onClose={onClose} onRefresh={() => { void refresh(); }}>
    {universe.isLoading ? <LoadingState text="正在读取官方收益率与拍卖证券主表…" /> : universe.error || !universe.data?.success ? <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-xs text-rose-300"><span>证券主表读取失败，当前没有使用静态补位数据。</span><button type="button" onClick={() => void universe.refetch()} className="rounded border border-rose-800 px-3 py-1.5 text-rose-200">重新连接</button></div> : <div className="flex min-h-full flex-col gap-3">
      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_120px_140px_145px_auto]">
          <label className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="代码、CUSIP、发行人、国家或数据口径" className="input-terminal w-full pl-8 text-xs" /></label>
          <select aria-label="币种筛选" value={currency} onChange={event => setCurrency(event.target.value)} className="input-terminal text-xs">{currencies.map(item => <option key={item}>{item}</option>)}</select>
          <select aria-label="期限筛选" value={maturity} onChange={event => setMaturity(event.target.value)} className="input-terminal text-xs">{maturities.map(item => <option key={item}>{item}</option>)}</select>
          <select aria-label="评级覆盖筛选" title={ratingFilterAvailable ? '按已接入评级筛选' : '当前来源未提供可授权评级字段'} value={rating} onChange={event => setRating(event.target.value)} disabled={!ratingFilterAvailable} className="input-terminal text-xs disabled:cursor-not-allowed disabled:opacity-60"><option value="全部评级状态">{ratingFilterAvailable ? '全部评级状态' : `评级字段未覆盖 · ${rows.length} 条`}</option>{ratingValues.map(item => <option key={item}>{item}</option>)}</select>
          <button type="button" onClick={resetFilters} className="inline-flex items-center justify-center gap-1 rounded border border-slate-700 px-2 py-1.5 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-200"><FilterX className="h-3.5 w-3.5" />清除</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 pt-2 text-[9px] text-slate-500">
          <span role="status" className={connectionTone}>{connectionLabel}</span><span className="text-slate-300">检索漏斗</span><span>全量 {rows.length}</span><span>文本淘汰 {filterResult.eliminated.text}</span><span>币种淘汰 {filterResult.eliminated.currency}</span><span>期限淘汰 {filterResult.eliminated.maturity}</span><span>{ratingFilterAvailable ? `评级淘汰 ${filterResult.eliminated.rating}` : '评级字段未覆盖'}</span><b className="text-cyan-300">保留 {filtered.length}</b>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2 text-[9px]">{sources.map(source => <span key={source.label}  className={source.status === 'available' ? 'text-emerald-400 hover:text-emerald-200' : 'text-rose-400'}>{source.label} · {source.rows} 条</span>)}</div>
      </Card>

      <div className="grid min-h-[600px] gap-3 xl:grid-cols-[1.2fr_.8fr]">
        <Card title={`匹配证券 · ${filtered.length}`} className="min-h-0 overflow-hidden p-0 [&>div:first-child]:px-3 [&>div:first-child]:pt-3">
          <div className="h-[330px] overflow-auto xl:h-[590px]">
            <table className="w-full min-w-[690px] text-[10px]">
              <thead className="sticky top-0 z-10 border-b border-slate-700 bg-[#0b111c] text-left text-slate-500"><tr><th className="p-2">标识 / 证券</th><th>国家 / 币种</th><th>类别 / 期限</th><th>观测口径</th><th className="text-right">最新 / 变化</th><th className="pr-2 text-right">观测日</th></tr></thead>
              <tbody>{filtered.map(row => <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-b border-slate-800/70 align-top transition hover:bg-cyan-950/20 ${selectedId === row.id ? 'bg-cyan-950/35' : ''}`}><td className="p-2"><b className="font-mono text-cyan-200">{row.symbol}</b><span className="ml-2 text-slate-300">{row.name}</span><span className="mt-0.5 block text-[9px] text-slate-600">{row.issuer}</span></td><td><span className="text-slate-300">{row.country}</span><span className="block font-mono text-slate-500">{row.currency}</span></td><td><span className="text-slate-400">{row.market}</span><span className="block font-mono text-amber-300">{row.tenor}</span></td><td><span className="text-slate-300">{row.valueLabel}</span></td><td className="text-right"><span className="block font-mono text-slate-100">{formatValue(row.value, row.unit)}</span><span className={`block font-mono ${row.change === null ? 'text-slate-600' : row.change >= 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{row.change === null ? '—' : `${row.change >= 0 ? '+' : ''}${row.change.toFixed(2)} ${row.changeUnit}`}</span></td><td className="pr-2 text-right font-mono text-slate-400">{row.observedAt}</td></tr>)}</tbody>
            </table>
            {!filtered.length && <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-500"><Search className="h-6 w-6" /><span className="text-xs">当前组合条件没有匹配证券，右侧旧快照已清除。</span><button type="button" onClick={resetFilters} className="text-[10px] text-cyan-300">清除全部条件</button></div>}
          </div>
        </Card>

        <div className="min-w-0 space-y-3">
          {selected ? <>
            <Card title={`${selected.symbol} · 联动核验`} action={<div className="flex items-center gap-2">{exportStatus && <span role="status" className="text-[9px] text-emerald-400">{exportStatus}</span>}<button type="button" onClick={() => { try { const count = downloadSelection(selected); setExportStatus(`CSV 已生成 · ${count} 条`); } catch { setExportStatus('CSV 生成失败'); } }} className="inline-flex items-center gap-1 text-[10px] text-cyan-300"><Download className="h-3.5 w-3.5" />导出</button></div>}>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <InsightMetric label={selected.valueLabel} value={formatValue(selected.value, selected.unit)} active={analysisView === 'history'} onClick={() => setAnalysisView('history')} enabled={selected.history.length > 0} />
                {selected.kind === 'auction'
                  ? <InsightMetric label="发行规模" value={formatAmount(selected.auction?.offeringAmount ?? null)} active={analysisView === 'structure'} onClick={() => setAnalysisView('structure')} enabled={selected.sizeHistory.length > 0} tone="text-violet-300" />
                  : <InsightMetric label="最近变化" value={selected.change === null ? '缺少相邻观测' : `${selected.change >= 0 ? '+' : ''}${selected.change.toFixed(2)} ${selected.changeUnit}`} active={analysisView === 'change'} onClick={() => setAnalysisView('change')} enabled={selected.changeHistory.length > 0} tone={selected.change !== null && selected.change >= 0 ? 'text-rose-300' : 'text-emerald-300'} />}
                {selected.kind === 'auction'
                  ? <InsightMetric label="投标覆盖" value={selected.auction?.bidToCoverRatio === null || selected.auction?.bidToCoverRatio === undefined ? '未披露' : `${selected.auction.bidToCoverRatio.toFixed(2)} 倍`} active={analysisView === 'demand'} onClick={() => setAnalysisView('demand')} enabled={selected.demandHistory.length > 0} tone="text-amber-300" />
                  : <InsightMetric label={selected.structureLabel} value={`${selected.structure.length} 个截面点`} active={analysisView === 'structure'} onClick={() => setAnalysisView('structure')} enabled={selected.structure.length > 0} tone="text-amber-300" />}
                <InsightMetric label="数据时效" value={`${sourceStatus}${selected.ageDays === null ? '' : ` · ${selected.ageDays} 天`}`} active={analysisView === 'quality'} onClick={() => setAnalysisView('quality')} tone={selected.sourceState === 'current' ? 'text-emerald-300' : 'text-amber-300'} />
              </div>
              <div className="mt-2 grid gap-1 border-t border-slate-800 pt-2 text-[9px] text-slate-500 sm:grid-cols-2"><span>频率：{selected.frequency} · 观测：{selected.observedAt}</span>{selected.auction && <><span>发行：{selected.auction.issueDate ?? '未披露'} · 到期：{selected.auction.maturityDate ?? '未披露'}</span><span>证券类型：{selected.auction.securityType} · 评级：{selected.ratingState}</span></>}</div>
            </Card>

            <Card title={analysisView === 'history' ? `${selected.valueLabel} · 原始历史` : analysisView === 'change' ? `${selected.valueLabel} · 相邻观测变化` : analysisView === 'structure' ? selected.structureLabel : analysisView === 'demand' ? '同期限投标覆盖轨迹' : '数据时效与接收链路'}>
              {analysisView === 'history' && (selected.history.length ? <ResponsiveContainer width="100%" height={245}><LineChart data={selected.history}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={34} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} /><Tooltip {...chartTooltipStyle()} /><Line type="monotone" dataKey="value" name={`${selected.valueLabel} ${selected.unit}`} stroke="#22d3ee" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer> : <p className="py-20 text-center text-[11px] text-slate-500">该口径没有可核验的历史观测，因此不生成替代曲线。</p>)}
              {analysisView === 'change' && (selected.changeHistory.length ? <ResponsiveContainer width="100%" height={245}><BarChart data={selected.changeHistory}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={24} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip {...chartTooltipStyle()} /><Bar dataKey="value" name={`相邻变化 ${selected.changeUnit}`}>{selected.changeHistory.map((point, index) => <Cell key={`${point.date}-${index}`} fill={point.value >= 0 ? '#fb7185' : '#34d399'} />)}</Bar></BarChart></ResponsiveContainer> : <p className="py-20 text-center text-[11px] text-slate-500">相邻有效观测不足，暂不能计算变化分布。</p>)}
              {analysisView === 'structure' && (selectedStructure.length ? <ResponsiveContainer width="100%" height={245}><BarChart data={selectedStructure}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey={selected.kind === 'auction' ? 'date' : 'label'} tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={18} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} /><Tooltip {...chartTooltipStyle()} /><Bar dataKey="value" name={selected.kind === 'auction' ? '发行规模 十亿 USD' : '收益率 %'} fill="#a78bfa" /></BarChart></ResponsiveContainer> : <p className="py-20 text-center text-[11px] text-slate-500">当前来源没有返回可核验的截面数据。</p>)}
              {analysisView === 'demand' && (selected.demandHistory.length ? <ResponsiveContainer width="100%" height={245}><LineChart data={selected.demandHistory}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={24} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} /><Tooltip {...chartTooltipStyle()} /><Line type="monotone" dataKey="value" name="投标覆盖倍数" stroke="#f59e0b" dot={{ r: 2 }} strokeWidth={2} /></LineChart></ResponsiveContainer> : <p className="py-20 text-center text-[11px] text-slate-500">同期限拍卖没有足够的投标覆盖观测。</p>)}
              {analysisView === 'quality' && <div className="py-6">
                <div className="relative mx-6 h-1 rounded bg-slate-800"><span className="absolute -left-1 -top-1.5 h-4 w-4 rounded-full border-2 border-cyan-400 bg-slate-950" /><span className="absolute left-1/2 -top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-amber-400 bg-slate-950" /><span className="absolute -right-1 -top-1.5 h-4 w-4 rounded-full border-2 border-emerald-400 bg-slate-950" /></div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[10px]"><div><b className="block text-cyan-300">原始观测</b><span className="font-mono text-slate-500">{selected.observedAt}</span></div><div><b className="block text-amber-300">来源发布</b><span className="text-slate-500">{selected.frequency}</span></div><div><b className="block text-emerald-300">终端接收</b><span className="font-mono text-slate-500">{new Date(selected.retrievedAt).toLocaleString('zh-CN')}</span></div></div>
                <div className="mt-6 flex items-start gap-2 rounded border border-slate-800 bg-slate-950/30 p-3 text-[10px] text-slate-400"><BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" /><span>当前值、历史、变化与截面均来自上方同一标识的证据链；终端不会用随机跳数填补缺失观测。来源进入复核状态时保留最后有效值并明确标记。</span></div>
              </div>}
            </Card>
          </> : <Card title="证券联动分析"><p className="py-20 text-center text-[11px] text-slate-500">筛选结果为空，未保留任何不属于当前结果集的旧证券数据。</p></Card>}
        </div>
      </div>
    </div>}
  </PanelShell>;
}
