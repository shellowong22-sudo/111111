import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MarketData } from '@/lib/dataEngine';
import { cn } from '@/lib/utils';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { useSovereignStream } from '@/hooks/useSovereignStream';
import { trpc } from '@/lib/trpc';

interface MarketDataPanelProps {
  title: string;
  data: MarketData[];
  columns?: Array<keyof MarketData | 'changePercent'>;
  referenceState?: 'verified' | 'legacy-unverified';
  feedPath?: string;
}

type FixedIncomeClass = 'sovereign' | 'credit';
type FixedIncomeView = 'term' | 'history' | 'slope' | 'change';
type FixedIncomePoint = {
  seriesId: string;
  tenor: string;
  years: number;
  yield: number;
  previous: number;
  spread: number;
  duration: number;
  changeBp: number;
  observedAt: string | null;
  history: Array<{ date: string; value: number }>;
};

const FIXED_INCOME_TENORS = [
  { seriesId: 'DGS3MO', tenor: '3M', years: 0.25 },
  { seriesId: 'DGS6MO', tenor: '6M', years: 0.5 },
  { seriesId: 'DGS2', tenor: '2Y', years: 2 },
  { seriesId: 'DGS5', tenor: '5Y', years: 5 },
  { seriesId: 'DGS7', tenor: '7Y', years: 7 },
  { seriesId: 'DGS10', tenor: '10Y', years: 10 },
  { seriesId: 'DGS20', tenor: '20Y', years: 20 },
  { seriesId: 'DGS30', tenor: '30Y', years: 30 },
];

export function FixedIncomeWorkspace({ assetClass, feedPath }: { assetClass: FixedIncomeClass; feedPath?: string }) {
  const [view, setView] = useState<FixedIncomeView>('term');
  const [selectedTenor, setSelectedTenor] = useState('10Y');
  const query = trpc.sovereignBonds.getMultipleRateSeries.useQuery(
    { series: [...FIXED_INCOME_TENORS.map((item) => item.seriesId), 'SOFR'] },
    { refetchInterval: 60_000, refetchOnWindowFocus: false }
  );
  const stream = useSovereignStream(3, 5);
  const sourceRows = query.data?.data ?? {};
  const sofr = Number(stream.latest?.rates?.SOFR ?? sourceRows.SOFR?.latest);
  const points = useMemo<FixedIncomePoint[]>(() => FIXED_INCOME_TENORS.flatMap(({ seriesId, tenor, years }) => {
    const history = (sourceRows[seriesId]?.data ?? []).filter((row) => Number.isFinite(row.value));
    const streamed = stream.latest?.rates?.[seriesId];
    const latest = typeof streamed === 'number' && Number.isFinite(streamed) ? streamed : sourceRows[seriesId]?.latest;
    if (typeof latest !== 'number' || !Number.isFinite(latest)) return [];
    const previous = history.at(-2)?.value ?? latest;
    return [{
      seriesId,
      tenor,
      years,
      yield: latest,
      previous,
      spread: Number.isFinite(sofr) ? (latest - sofr) * 100 : 0,
      duration: years / (1 + latest / 100),
      changeBp: (latest - previous) * 100,
      observedAt: history.at(-1)?.date ?? null,
      history,
    }];
  }), [sofr, sourceRows, stream.latest]);
  const selected = points.find((point) => point.tenor === selectedTenor) ?? points.find((point) => point.tenor === '10Y') ?? points[0];
  const twoYear = points.find((point) => point.tenor === '2Y');
  const tenYear = points.find((point) => point.tenor === '10Y');
  const curveSlope = twoYear && tenYear ? (tenYear.yield - twoYear.yield) * 100 : null;
  const slopeHistory = useMemo(() => {
    const twoMap = new Map((sourceRows.DGS2?.data ?? []).map((row) => [row.date, row.value]));
    return (sourceRows.DGS10?.data ?? []).flatMap((row) => {
      const two = twoMap.get(row.date);
      return typeof two === 'number' && Number.isFinite(two) ? [{ date: row.date, value: (row.value - two) * 100 }] : [];
    }).slice(-120);
  }, [sourceRows]);
  const assetLabel = assetClass === 'sovereign' ? '主权债' : '信用债';
  const accent = assetClass === 'sovereign' ? '#22d3ee' : '#fbbf24';
  const contentFeed = useModuleLiveFeed(feedPath ?? '/', Boolean(feedPath));
  const latestEvent = contentFeed.items[0];

  const exportCurve = () => {
    const header = ['asset_class', 'series_id', 'tenor', 'yield_pct', 'previous_pct', 'change_bp', 'sofr_spread_bp', 'duration_proxy', 'observation_date'];
    const rows = points.map((point) => [assetLabel, point.seriesId, point.tenor, point.yield, point.previous, point.changeBp.toFixed(1), point.spread.toFixed(1), point.duration.toFixed(2), point.observedAt ?? '']);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${assetClass}-curve-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080b13] text-slate-100">
    <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-[#101827] px-3 py-2"><div className="flex items-center gap-2"><Activity className="h-4 w-4" style={{ color: accent }} /><span className="text-sm font-semibold" style={{ color: accent }}>{assetLabel} · 当前市场</span><span className={cn('rounded px-1.5 py-0.5 text-[9px]', stream.connected ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300')}>{stream.connected ? '数据通道已连接' : '保留最近观测'}</span></div><div className="flex items-center gap-2"><button type="button" aria-label={`刷新${assetLabel}期限数据`} onClick={() => query.refetch()} disabled={query.isFetching} className="text-slate-400 hover:text-white disabled:opacity-40"><RefreshCw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')} /></button><button type="button" aria-label={`导出${assetLabel}曲线数据`} onClick={exportCurve} disabled={!points.length} className="text-slate-400 hover:text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" /></button></div></div>
    <div className="flex-1 space-y-3 overflow-y-auto p-3 pb-16">
      {!points.length ? <section className="grid min-h-64 place-items-center rounded border border-slate-800 bg-[#0d1220] text-sm text-slate-500">{query.isLoading ? '正在读取期限观测…' : <button type="button" onClick={() => query.refetch()} className="rounded border border-amber-700 px-3 py-2 text-amber-200">期限数据暂不可用，重新读取</button>}</section> : <>
      <section className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] uppercase tracking-widest text-slate-500">固定收益观测矩阵</div><h2 className="mt-1 text-lg font-semibold text-slate-100">{assetLabel}期限、历史与变动联动</h2></div><div className="flex flex-wrap gap-1">{(['term', 'history', 'slope', 'change'] as FixedIncomeView[]).map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`rounded border px-2 py-1 text-[10px] ${view === item ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100' : 'border-slate-700 text-slate-400 hover:text-slate-100'}`}>{item === 'term' ? '期限曲线' : item === 'history' ? '单期限历史' : item === 'slope' ? '曲线斜率' : '节点变动'}</button>)}</div></div>
        {latestEvent && <button type="button" onClick={() => { setView('history'); setSelectedTenor('10Y'); }} className="mt-3 grid w-full gap-1 rounded border border-cyan-900/70 bg-cyan-950/15 px-3 py-2 text-left hover:border-cyan-700 md:grid-cols-[160px_1fr_auto]"><b className="truncate text-[10px] text-cyan-200">{latestEvent.title}</b><span className="line-clamp-1 text-[10px] text-slate-400">{latestEvent.body}</span><span className="text-[9px] text-slate-600">{latestEvent.publishedAt ? new Date(latestEvent.publishedAt).toLocaleDateString('zh-CN') : '最新'}</span></button>}
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4"><button type="button" onClick={() => { setView('history'); setSelectedTenor('10Y'); }} className="rounded border border-cyan-900/70 bg-cyan-950/20 p-2 text-left hover:border-cyan-500"><div className="text-[9px] text-slate-500">10Y 收益率</div><div className="mt-1 font-mono text-xl text-cyan-100">{tenYear?.yield.toFixed(3) ?? '—'}%</div><div className="text-[9px] text-cyan-300">进入最近 120 期</div></button><button type="button" onClick={() => setView('slope')} className="rounded border border-violet-900/70 bg-violet-950/20 p-2 text-left hover:border-violet-500"><div className="text-[9px] text-slate-500">2Y–10Y 曲线斜率</div><div className="mt-1 font-mono text-xl text-violet-100">{curveSlope === null ? '—' : `${curveSlope >= 0 ? '+' : ''}${curveSlope.toFixed(1)}`} bp</div><div className="text-[9px] text-violet-300">进入斜率历史</div></button><button type="button" onClick={() => setView('term')} className="rounded border border-amber-900/70 bg-amber-950/20 p-2 text-left hover:border-amber-500"><div className="text-[9px] text-slate-500">10Y 相对 SOFR</div><div className="mt-1 font-mono text-xl text-amber-100">{tenYear && Number.isFinite(sofr) ? tenYear.spread.toFixed(1) : '—'} bp</div><div className="text-[9px] text-amber-300">进入双轴期限图</div></button><button type="button" onClick={() => setView('change')} className="rounded border border-emerald-900/70 bg-emerald-950/20 p-2 text-left hover:border-emerald-500"><div className="text-[9px] text-slate-500">可用期限节点</div><div className="mt-1 font-mono text-xl text-emerald-100">{points.length}</div><div className="text-[9px] text-emerald-300">进入节点变动分布</div></button></div>
      </section>
      <section className="grid gap-3 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-200">{view === 'term' ? '收益率与 SOFR 利差期限图' : view === 'history' ? `${selected?.tenor ?? ''} 历史收益率` : view === 'slope' ? '2Y–10Y 斜率历史' : '各期限最近变动'}</h3><span className="text-[10px] text-slate-500">{query.data?.source ?? 'FRED'} 原始观测</span></div><div className="mt-2 h-[260px]"><ResponsiveContainer width="100%" height="100%">{view === 'change' ? <BarChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="tenor" tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis tick={{ fontSize: 9, fill: '#64748b' }} /><Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number) => [`${value.toFixed(1)} bp`, '变动']} /><Bar dataKey="changeBp" name="变动(bp)" fill="#34d399" radius={[3, 3, 0, 0]} /></BarChart> : view === 'slope' ? <AreaChart data={slopeHistory}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} minTickGap={30} /><YAxis tick={{ fontSize: 9, fill: '#64748b' }} /><Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number) => [`${value.toFixed(1)} bp`, '2s10s']} /><Area type="monotone" dataKey="value" stroke="#a78bfa" fill="#a78bfa22" strokeWidth={2} /></AreaChart> : view === 'term' ? <LineChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="tenor" tick={{ fontSize: 9, fill: '#64748b' }} /><YAxis yAxisId="yield" tick={{ fontSize: 9, fill: '#22d3ee' }} domain={['auto', 'auto']} tickFormatter={(value) => `${value}%`} /><YAxis yAxisId="spread" orientation="right" tick={{ fontSize: 9, fill: '#fbbf24' }} domain={['auto', 'auto']} tickFormatter={(value) => `${value}bp`} /><Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number, name: string) => [name === 'SOFR 利差' ? `${value.toFixed(1)} bp` : `${value.toFixed(3)}%`, name]} /><Line yAxisId="yield" type="monotone" dataKey="yield" name="收益率" stroke={accent} strokeWidth={2.5} dot activeDot={{ r: 5 }} /><Line yAxisId="spread" type="monotone" dataKey="spread" name="SOFR 利差" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 4" dot activeDot={{ r: 4 }} /></LineChart> : <LineChart data={(selected?.history ?? []).slice(-120)}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} minTickGap={30} /><YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number) => [`${value.toFixed(3)}%`, '收益率']} /><Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} /></LineChart>}</ResponsiveContainer></div></div>
        <div className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-200">期限选择</h3><span className="font-mono text-[10px] text-cyan-300">{selected?.tenor}</span></div><div className="mt-2 grid grid-cols-4 gap-1">{points.map((point) => <button key={point.tenor} type="button" onClick={() => { setSelectedTenor(point.tenor); setView('history'); }} className={`rounded border px-1 py-1.5 font-mono text-[10px] ${selectedTenor === point.tenor ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100' : 'border-slate-700 text-slate-500 hover:text-slate-100'}`}>{point.tenor}</button>)}</div>{selected && <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">收益率</div><div className="mt-1 font-mono text-slate-100">{selected.yield.toFixed(3)}%</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">最近变动</div><div className={cn('mt-1 font-mono', selected.changeBp >= 0 ? 'text-rose-300' : 'text-emerald-300')}>{selected.changeBp.toFixed(1)} bp</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">久期近似</div><div className="mt-1 font-mono text-slate-100">{selected.duration.toFixed(2)} 年</div></div><div className="rounded bg-[#080b13] p-2"><div className="text-slate-500">历史样本</div><div className="mt-1 font-mono text-slate-100">{selected.history.length}</div></div></div>}<div className="mt-3 rounded border border-slate-800 p-2 text-[10px] leading-4 text-slate-400"><span className="text-slate-500">序列：</span><span className="font-mono text-slate-200">{selected?.seriesId}</span><br /><span className="text-slate-500">观测日：</span><span className="font-mono text-slate-200">{selected?.observedAt ?? '未返回'}</span></div></div></section>
      <section className="rounded border border-slate-800 bg-[#0d1220] p-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-200">期限观测明细</h3><span className="text-[10px] text-slate-500">点击行进入该期限历史</span></div><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[680px] text-[10px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-2">期限</th><th>收益率</th><th>前值</th><th>变动</th><th>相对 SOFR</th><th>久期近似</th><th>观测日</th></tr></thead><tbody>{points.map((point) => <tr key={point.tenor} onClick={() => { setSelectedTenor(point.tenor); setView('history'); }} className={`cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/40 ${selectedTenor === point.tenor ? 'bg-cyan-950/25' : ''}`}><td className="p-2 font-mono font-semibold text-cyan-200">{point.tenor}</td><td className="font-mono text-slate-100">{point.yield.toFixed(3)}%</td><td className="font-mono text-slate-400">{point.previous.toFixed(3)}%</td><td className={cn('font-mono', point.changeBp >= 0 ? 'text-rose-300' : 'text-emerald-300')}>{point.changeBp.toFixed(1)} bp</td><td className="font-mono text-violet-200">{Number.isFinite(sofr) ? `${point.spread.toFixed(1)} bp` : '—'}</td><td className="font-mono text-slate-300">{point.duration.toFixed(2)}</td><td className="font-mono text-slate-400">{point.observedAt ?? '—'}</td></tr>)}</tbody></table></div></section>
      </>}
    </div>
  </div>;
}

const DEFAULT_COLUMNS: Array<keyof MarketData | 'changePercent'> = [
  'symbol',
  'price',
  'change',
  'changePercent',
  'bid',
  'ask',
  'volume',
];

/** 单个价格单元格，带闪烁动画 */
function FlashCell({
  value,
  prevValue,
  formatter,
}: {
  value: number;
  prevValue: number | undefined;
  formatter: (v: number) => string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<number | undefined>(prevValue);

  useEffect(() => {
    if (prevRef.current !== undefined && prevRef.current !== value && spanRef.current) {
      const dir = value > prevRef.current ? 'price-flash-up' : 'price-flash-down';
      spanRef.current.classList.remove('price-flash-up', 'price-flash-down');
      void spanRef.current.offsetWidth;
      spanRef.current.classList.add(dir);
    }
    prevRef.current = value;
  }, [value]);

  return <span ref={spanRef} className="px-0.5 rounded">{formatter(value)}</span>;
}

export default function MarketDataPanel({
  title,
  data,
  columns = DEFAULT_COLUMNS,
  referenceState = 'verified',
  feedPath,
}: MarketDataPanelProps) {
  // 顶层固定收益入口原本传入空数组，改为在原窗口内渲染可操作的期限结构工作台。
  // 不改变任何菜单或路由，只让主权债/信用债默认窗口具备数据层与可视化内容。
  if (data.length === 0 && referenceState === 'legacy-unverified' && (title.startsWith('主权债') || title.startsWith('信用债'))) {
    return <FixedIncomeWorkspace assetClass={title.startsWith('信用债') ? 'credit' : 'sovereign'} feedPath={feedPath} />;
  }

  // 保存上一帧数据用于闪烁比较
  const prevDataRef = useRef<Map<string, MarketData>>(new Map());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const next = new Map<string, MarketData>();
    data.forEach(item => next.set(item.symbol, item));
    const id = requestAnimationFrame(() => {
      prevDataRef.current = next;
      forceUpdate(n => n + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [data]);

  const formatValue = (value: any, key: string): string => {
    if (typeof value === 'number') {
      if (key.includes('volume')) {
        return (value / 1000000).toFixed(1) + 'M';
      }
      if (key.includes('price') || key.includes('bid') || key.includes('ask')) {
        return value.toFixed(2);
      }
      if (key.includes('change')) {
        return value > 0 ? '+' + value.toFixed(2) : value.toFixed(2);
      }
      if (key.includes('Percent')) {
        return (value > 0 ? '+' : '') + value.toFixed(2) + '%';
      }
      return value.toFixed(2);
    }
    return String(value);
  };

  const getColumnLabel = (col: string): string => {
    const labels: Record<string, string> = {
      symbol: 'Symbol',
      name: 'Name',
      price: 'Price',
      change: 'Change',
      changePercent: 'Change %',
      bid: 'Bid',
      ask: 'Ask',
      volume: 'Volume',
      yield: 'Yield',
      maturity: 'Maturity',
      duration: 'Duration',
      rating: 'Rating',
    };
    return labels[col] || col;
  };

  const isPositive = (value: number): boolean => value > 0;
  const isNegative = (value: number): boolean => value < 0;

  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
        <div className="flex items-center gap-1.5">
          {referenceState === 'legacy-unverified' ? <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-300 font-mono">历史展示</span>
            <span className="text-xs text-muted-foreground ml-1">未接入可核验实时来源</span>
          </> : <>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
            <span className="text-xs text-green-400 font-mono">已标注来源</span>
            <span className="text-xs text-muted-foreground ml-1">{data.length} items</span>
          </>}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {referenceState === 'legacy-unverified' && (
          <div className="m-2 rounded border border-dashed border-amber-900/70 bg-amber-950/20 px-3 py-2 text-[10px] leading-4 text-amber-100">
            原有行情表结构完整保留；当前没有已接入的免费或授权实时来源，因此不显示随机价格、买卖价、成交量、评级或收益率。请使用模块后的公开研究层、用户核验输入或真实空状态。
          </div>
        )}
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-muted/20 border-b border-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col)}
                  className="px-2 py-1 text-left font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50 last:border-r-0"
                >
                  {getColumnLabel(String(col))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const prev = prevDataRef.current.get(item.symbol);
              return (
                <tr
                  key={`${item.symbol}-${idx}`}
                  className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                >
                  {columns.map((col) => {
                    const rawValue = col === 'changePercent' ? item.changePercent : item[col as keyof MarketData];
                    const prevRaw = prev ? (col === 'changePercent' ? prev.changePercent : prev[col as keyof MarketData]) : undefined;
                    const isChange = col === 'change' || col === 'changePercent';
                    const isChangeValue = isChange && typeof rawValue === 'number';
                    const shouldFlash = (col === 'price' || col === 'bid' || col === 'ask') && typeof rawValue === 'number';

                    return (
                      <td
                        key={String(col)}
                        className={cn(
                          'px-2 py-1 font-mono border-r border-border/30 last:border-r-0',
                          col === 'symbol' && 'font-semibold text-accent',
                          isChangeValue && isPositive(rawValue as number) && 'text-green-400',
                          isChangeValue && isNegative(rawValue as number) && 'text-red-400',
                          isChangeValue && (rawValue as number) === 0 && 'text-muted-foreground'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          {isChangeValue && (
                            <>
                              {isPositive(rawValue as number) && <TrendingUp className="w-3 h-3 text-green-400" />}
                              {isNegative(rawValue as number) && <TrendingDown className="w-3 h-3 text-red-400" />}
                            </>
                          )}
                          {shouldFlash ? (
                            <FlashCell
                              value={rawValue as number}
                              prevValue={prevRaw as number | undefined}
                              formatter={(v) => formatValue(v, String(col))}
                            />
                          ) : (
                            <span>{formatValue(rawValue, String(col))}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p className="text-xs font-mono">{referenceState === 'legacy-unverified' ? '无已核验实时市场数据' : 'No data available'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
