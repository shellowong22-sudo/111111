import React, { useEffect, useMemo, useState } from 'react';
import { Cell, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { changeCorrelation } from './stockRiskAnalytics';
import { normalizeObservationHistory } from './stockObservationModel';

export type FactorSeries = {
  id: string; label: string; group: string; unit: string; source: string;
  history: unknown; observationDate: string | null; status: string;
};
type Transform = 'change' | 'relative';
type RegressionOptions = { xTransform: Transform; yTransform: Transform; lag: number; sampleWindow: number | null };
type FactorSample = { id: string; xStart: string; xEnd: string; yStart: string; yEnd: string; xPrevious: number; xCurrent: number; yPrevious: number; yCurrent: number; x: number; y: number; fitted: number | null; residual: number | null };
const control = 'input-terminal h-8 min-w-0 px-2 text-xs';
const button = 'border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40';
const number = (value: number | null | undefined, digits = 4) => value == null || !Number.isFinite(value) ? '—' : (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toFixed(digits);
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '未提供';

export function factorChangeUnit(series: FactorSeries, transform: Transform) {
  if (transform === 'relative') return '%';
  if (series.group === 'rates' || series.group === 'credit') return 'bp';
  return series.unit === 'index_points' ? '指数点' : series.unit === '%' ? '百分点' : series.unit;
}

/** Regression is built from the same adjacent-date interval pairs as the shared
 * risk library. Missing source dates are never forward-filled or reindexed. */
export function buildFactorRegression(xSeries: FactorSeries, ySeries: FactorSeries, options: RegressionOptions) {
  const empty = (reason: string) => ({ reason, samples: [] as FactorSample[], count: 0, beta: null as number | null,
    alpha: null as number | null, rSquared: null as number | null, rmse: null as number | null,
    candidateCount: 0, missingLagIntervals: 0, xUnit: factorChangeUnit(xSeries, options.xTransform), yUnit: factorChangeUnit(ySeries, options.yTransform) });
  if (xSeries.id === ySeries.id) return empty('请选择不同的因变量与解释变量，避免同序列自我回归。');
  if (xSeries.status !== 'available' || ySeries.status !== 'available') return empty('选中序列暂不可读，不能用旧样本或其他因子替代。');
  if ([xSeries, ySeries].some(series => (series.group === 'rates' || series.group === 'credit') && series.unit !== '%')) return empty('利率或信用利差的原单位未明确为百分比，停止基点换算以避免混用单位。');
  if (!Number.isInteger(options.lag) || options.lag < 0 || options.lag > 10) return empty('滞后必须为 0–10 个共同观测区间。');
  if (options.sampleWindow !== null && (!Number.isInteger(options.sampleWindow) || options.sampleWindow < 3)) return empty('样本窗口至少需要三个区间。');
  const left = new Map(normalizeObservationHistory(xSeries.history).map(point => [point.date, point.value]));
  const right = new Map(normalizeObservationHistory(ySeries.history).map(point => [point.date, point.value]));
  const aligned = changeCorrelation(xSeries.history, ySeries.history).pairs;
  const transform = (change: number, previous: number, series: FactorSeries, method: Transform) => {
    if (method === 'relative') return previous > 0 ? change / previous * 100 : null;
    return change * (series.group === 'rates' || series.group === 'credit' ? 100 : 1);
  };
  let missingLagIntervals = 0;
  const candidateSamples: FactorSample[] = aligned.flatMap((dependent, index) => {
    if (index < options.lag) return [];
    const explanatory = aligned[index - options.lag];
    const [xStart, xEnd] = explanatory.period.split('/'), [yStart, yEnd] = dependent.period.split('/');
    for (let cursor = index - options.lag + 1; cursor <= index; cursor += 1) {
      if (aligned[cursor - 1].period.split('/')[1] !== aligned[cursor].period.split('/')[0]) { missingLagIntervals += 1; return []; }
    }
    const xPrevious = left.get(xStart)!, yPrevious = right.get(yStart)!;
    const x = transform(explanatory.x, xPrevious, xSeries, options.xTransform);
    const y = transform(dependent.y, yPrevious, ySeries, options.yTransform);
    if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ id: explanatory.period + ':' + dependent.period, xStart, xEnd, yStart, yEnd,
      xPrevious, xCurrent: left.get(xEnd)!, yPrevious, yCurrent: right.get(yEnd)!, x, y, fitted: null, residual: null }];
  });
  const samples = options.sampleWindow ? candidateSamples.slice(-options.sampleWindow) : candidateSamples;
  const result = { ...empty(''), samples, count: samples.length, candidateCount: aligned.length, missingLagIntervals };
  if (samples.length < 3) return { ...result, reason: '共同有效样本不足三个，仅展示已对齐明细，不输出回归结论。' };
  const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
  const meanY = samples.reduce((sum, sample) => sum + sample.y, 0) / samples.length;
  const ssX = samples.reduce((sum, sample) => sum + (sample.x - meanX) ** 2, 0);
  const ssY = samples.reduce((sum, sample) => sum + (sample.y - meanY) ** 2, 0);
  if (ssX <= Number.EPSILON * Math.max(1, samples.reduce((sum, sample) => sum + sample.x ** 2, 0))) return { ...result, reason: '解释变量变化没有可辨识的方差，回归斜率不可估计。' };
  const beta = samples.reduce((sum, sample) => sum + (sample.x - meanX) * (sample.y - meanY), 0) / ssX;
  const alpha = meanY - beta * meanX;
  const residualSamples = samples.map(sample => ({ ...sample, fitted: alpha + beta * sample.x, residual: sample.y - (alpha + beta * sample.x) }));
  const sse = residualSamples.reduce((sum, sample) => sum + sample.residual ** 2, 0);
  return { ...result, samples: residualSamples, beta, alpha, rSquared: ssY > 0 ? Math.min(1, Math.max(0, 1 - sse / ssY)) : null,
    rmse: Math.sqrt(sse / samples.length), reason: ssY > 0 ? '' : '因变量变化恒定，R² 无定义；拟合截距与斜率仅描述该样本。' };
}

function readSeries(input: unknown): FactorSeries[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.flatMap(row => {
    if (!row || typeof row.id !== 'string' || typeof row.label !== 'string' || typeof row.unit !== 'string' || typeof row.source !== 'string' || seen.has(row.id)) return [];
    seen.add(row.id);
    return [{ id: row.id, label: row.label, group: typeof row.group === 'string' ? row.group : '', unit: row.unit, source: row.source,
      history: row.history, observationDate: typeof row.observationDate === 'string' ? row.observationDate : null, status: row.status }];
  });
}

function exportSamples(samples: FactorSample[], x: FactorSeries, y: FactorSeries, xUnit: string, yUnit: string, lag: number) {
  const cell = (value: unknown) => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const rows = [['X序列', 'X来源', 'Y序列', 'Y来源', 'X区间起', 'X区间止', 'Y区间起', 'Y区间止', 'X前值', 'X当值', 'Y前值', 'Y当值', 'X变化 ' + xUnit, 'Y变化 ' + yUnit, '样本拟合 ' + yUnit, '残差 ' + yUnit, '滞后观测区间数'],
    ...samples.map(sample => [x.id, x.source, y.id, y.source, sample.xStart, sample.xEnd, sample.yStart, sample.yEnd, sample.xPrevious, sample.xCurrent, sample.yPrevious, sample.yCurrent, sample.x, sample.y, sample.fitted, sample.residual, lag])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'factor-lab-common-observation-regression.csv'; link.click(); URL.revokeObjectURL(url);
}

export default function StockFactorLabWorkspace() {
  const query = trpc.stockMarketResearch.getEnvironment.useQuery(undefined, { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const series = useMemo(() => readSeries(query.data?.series), [query.data?.series]);
  const [xId, setXId] = useState('DGS10'), [yId, setYId] = useState('SP500');
  const [xTransform, setXTransform] = useState<Transform>('change'), [yTransform, setYTransform] = useState<Transform>('relative');
  const [lag, setLag] = useState(0), [windowSize, setWindowSize] = useState('all'), [chart, setChart] = useState<'scatter' | 'residual'>('scatter');
  const [selectedSample, setSelectedSample] = useState<string | null>(null), [wide, setWide] = useState(true);
  useEffect(() => { const media = window.matchMedia('(min-width: 1000px)'); const update = () => setWide(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => setSelectedSample(null), [xId, yId, xTransform, yTransform, lag, windowSize]);
  const xSeries = series.find(row => row.id === xId), ySeries = series.find(row => row.id === yId);
  const regression = useMemo(() => !query.isError && xSeries && ySeries ? buildFactorRegression(xSeries, ySeries,
    { xTransform, yTransform, lag, sampleWindow: windowSize === 'all' ? null : Number(windowSize) }) : null,
  [query.isError, xSeries, ySeries, xTransform, yTransform, lag, windowSize]);
  const fitLine = regression?.beta != null && regression.alpha != null && regression.samples.length ? [Math.min(...regression.samples.map(sample => sample.x)), Math.max(...regression.samples.map(sample => sample.x))].map(value => ({ x: value, y: regression.alpha! + regression.beta! * value })) : [];
  const chosen = regression?.samples.find(sample => sample.id === selectedSample);
  const axis = { fill: '#94a3b8', fontSize: 10 };
  return <section className="min-w-0 border-y border-slate-800 bg-slate-950/30" aria-label="FACTOR LAB 变化敏感度工作台">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
      <div><h3 className="text-sm font-semibold text-cyan-200">FACTOR LAB · 单因子变化敏感度</h3><p className="text-[10px] text-slate-400">公共历史序列 · 含截距 OLS · 样本内关联，不是因果证明或交易信号</p></div>
      <button type="button" className={button} disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={'mr-1 inline h-3 w-3 ' + (query.isFetching ? 'animate-spin' : '')} />重新读取</button>
    </header>
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-800 px-3 py-2">
      <label className="text-[10px] text-slate-400">因变量 Y<select aria-label="FACTOR LAB 因变量" value={yId} onChange={event => setYId(event.target.value)} className={control + ' ml-2'}>{!series.length && <option value="SP500">标普 500（待读取）</option>}{series.map(row => <option key={row.id} value={row.id}>{row.label} · {row.id}{row.status === 'available' ? '' : ' · 暂不可读'}</option>)}</select></label>
      <label className="text-[10px] text-slate-400">Y 变换<select aria-label="FACTOR LAB Y变换" className={control + ' ml-2'} value={yTransform} onChange={event => setYTransform(event.target.value as Transform)}><option value="relative">相对变化 %</option><option value="change">原单位差分</option></select></label>
      <label className="text-[10px] text-slate-400">解释变量 X<select aria-label="FACTOR LAB 解释变量" value={xId} onChange={event => setXId(event.target.value)} className={control + ' ml-2'}>{!series.length && <option value="DGS10">10 年期国债（待读取）</option>}{series.map(row => <option key={row.id} value={row.id}>{row.label} · {row.id}{row.status === 'available' ? '' : ' · 暂不可读'}</option>)}</select></label>
      <label className="text-[10px] text-slate-400">X 变换<select aria-label="FACTOR LAB X变换" className={control + ' ml-2'} value={xTransform} onChange={event => setXTransform(event.target.value as Transform)}><option value="change">原单位差分</option><option value="relative">相对变化 %</option></select></label>
      <label className="text-[10px] text-slate-400">X 领先 Y<select aria-label="FACTOR LAB 滞后区间" className={control + ' ml-2'} value={lag} onChange={event => setLag(Number(event.target.value))}>{[0, 1, 2, 3, 5, 10].map(value => <option key={value} value={value}>{value} 个观测区间</option>)}</select></label>
      <label className="text-[10px] text-slate-400">样本窗<select aria-label="FACTOR LAB 样本窗口" className={control + ' ml-2'} value={windowSize} onChange={event => setWindowSize(event.target.value)}><option value="all">全部共同区间</option>{[20, 60, 120].map(value => <option key={value} value={value}>最近 {value} 个样本</option>)}</select></label>
    </div>
    {query.isLoading ? <p role="status" className="p-4 text-xs text-slate-400">正在读取真实历史观察…</p> : query.isError ? <p role="alert" className="p-4 text-xs text-amber-200">数据读取失败，停止输出回归结果；请使用顶部按钮重试，旧数据不标记为最新。</p> : !regression ? <p role="status" className="p-4 text-xs text-slate-400">未取得所选序列及明确的来源和单位，不能计算变化敏感度。</p> : <>
      <div className="overflow-x-auto border-b border-slate-800"><table aria-label="单因子回归统计" className="w-full text-left text-xs"><thead className="text-[10px] text-slate-500"><tr>{['有效样本', 'Beta · ' + regression.yUnit + '/' + regression.xUnit, '截距 · ' + regression.yUnit, 'R²', 'RMSE · ' + regression.yUnit, '共同观察区间'].map(label => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody><tr className="font-mono text-cyan-200"><td aria-label="FACTOR LAB 有效样本" className="px-3 pb-2">{regression.count}</td><td aria-label="FACTOR LAB Beta" className="px-3 pb-2">{number(regression.beta)}</td><td aria-label="FACTOR LAB 截距" className="px-3 pb-2">{number(regression.alpha)}</td><td aria-label="FACTOR LAB R平方" className="px-3 pb-2">{number(regression.rSquared)}</td><td className="px-3 pb-2">{number(regression.rmse)}</td><td className="px-3 pb-2 text-[10px] text-slate-400">{regression.samples[0]?.yStart ?? '—'} → {regression.samples.at(-1)?.yEnd ?? '—'}</td></tr></tbody></table></div>
      {regression.reason && <p role="status" className="border-b border-amber-900 px-3 py-2 text-xs text-amber-200">{regression.reason}</p>}
      {regression.samples.length > 0 && <div className="h-[580px]"><ResizablePanelGroup direction={wide ? 'horizontal' : 'vertical'} aria-label="因子回归图表与样本分栏">
        <ResizablePanel defaultSize={57} minSize={30}><div className="flex h-full min-w-0 flex-col">
          <div role="tablist" aria-label="FACTOR LAB 图表" className="flex border-b border-slate-800">{([['scatter', '散点拟合'], ['residual', '残差诊断']] as const).map(([id, label]) => <button role="tab" type="button" aria-selected={chart === id} key={id} onClick={() => setChart(id)} className={'border-r border-slate-800 px-3 py-2 text-xs ' + (chart === id ? 'text-cyan-200' : 'text-slate-400')}>{label}</button>)}</div>
          <div role="tabpanel" aria-label={chart === 'scatter' ? '共同区间变化散点拟合' : '按观测日期残差诊断'} className="min-h-0 flex-1 px-2 pt-3">
            {chart === 'scatter' ? <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ left: 12, right: 18, top: 5, bottom: 28 }}><CartesianGrid stroke="#233246" /><XAxis type="number" dataKey="x" name={xSeries?.id} unit={' ' + regression.xUnit} tick={axis} label={{ value: xSeries?.label + '变化 (' + regression.xUnit + ')', position: 'bottom', fill: '#94a3b8', fontSize: 10 }} /><YAxis type="number" dataKey="y" name={ySeries?.id} unit={' ' + regression.yUnit} tick={axis} /><ReferenceLine x={0} stroke="#475569" /><ReferenceLine y={0} stroke="#475569" /><Tooltip content={({ active, payload }) => {
              const row = payload?.[0]?.payload as FactorSample | undefined;
              return active && row ? <div className="border border-slate-700 bg-slate-950 p-2 text-[10px] text-slate-200">{row.yEnd && <p>Y {row.yStart} → {row.yEnd}</p>}{row.xEnd && <p>X {row.xStart} → {row.xEnd}</p>}<p>X {number(row.x)} {regression.xUnit} · Y {number(row.y)} {regression.yUnit}</p>{row.fitted != null && <p>样本拟合 {number(row.fitted)} · 残差 {number(row.residual)}</p>}</div> : null;
            }} /><Scatter name="共同区间真实变化" data={regression.samples} fill="#22d3ee" onClick={(sample: any) => { if (typeof sample?.id === 'string') setSelectedSample(sample.id); }}>{regression.samples.map(sample => <Cell key={sample.id} fill={sample.id === selectedSample ? '#fbbf24' : '#22d3ee'} />)}</Scatter>{fitLine.length === 2 && <Scatter name="样本内 OLS 拟合" data={fitLine} line={{ stroke: '#fbbf24', strokeWidth: 2 }} shape={() => <></>} fill="#fbbf24" />}<Legend wrapperStyle={{ fontSize: 10 }} /></ScatterChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><LineChart data={regression.samples} margin={{ left: 8, right: 18, bottom: 8 }}><CartesianGrid stroke="#233246" /><XAxis dataKey="yEnd" tick={axis} minTickGap={32} /><YAxis tick={axis} unit={' ' + regression.yUnit} /><ReferenceLine y={0} stroke="#475569" /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#cbd5e1', fontSize: 11 }} /><Line dataKey="residual" name={'残差 ' + regression.yUnit} stroke="#c4b5fd" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer>}
          </div>
          <p className="shrink-0 border-t border-slate-800 px-3 py-2 text-[10px] text-slate-400">{chosen ? '已选样本 Y ' + chosen.yStart + ' → ' + chosen.yEnd + '；X ' + chosen.xStart + ' → ' + chosen.xEnd : '选择明细行可高亮对应散点。拟合值仅为样本内解释，不是未来预测。'}</p>
        </div></ResizablePanel>
        <ResizableHandle withHandle aria-label="调整因子图表与样本宽度" />
        <ResizablePanel defaultSize={43} minSize={25}><div className="flex h-full min-w-0 flex-col"><header className="flex items-center justify-between gap-2 border-b border-slate-800 px-2 py-2"><h4 className="text-xs text-slate-300">共同区间样本明细</h4><button type="button" className={button} onClick={() => xSeries && ySeries && exportSamples(regression.samples, xSeries, ySeries, regression.xUnit, regression.yUnit, lag)}><Download className="mr-1 inline h-3 w-3" />导出样本</button></header>
          <div className="min-h-0 flex-1 overflow-auto"><table aria-label="FACTOR LAB 样本明细" className="w-full min-w-[740px] text-right text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr>{['Y观测区间', 'X观测区间', 'X前值', 'X当值', 'Y前值', 'Y当值', 'X变化 ' + regression.xUnit, 'Y变化 ' + regression.yUnit, '拟合 ' + regression.yUnit, '残差 ' + regression.yUnit].map(label => <th key={label} className="whitespace-nowrap px-2 py-2">{label}</th>)}</tr></thead><tbody>{regression.samples.map(sample => <tr key={sample.id} tabIndex={0} aria-selected={selectedSample === sample.id} onClick={() => setSelectedSample(sample.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedSample(sample.id); } }} className={'cursor-pointer border-b border-slate-800 hover:bg-slate-900 focus:bg-slate-900 ' + (selectedSample === sample.id ? 'bg-cyan-950/40' : '')}><td className="whitespace-nowrap px-2 py-2 text-sky-200">{sample.yStart} → {sample.yEnd}</td><td className="whitespace-nowrap px-2 py-2 text-slate-400">{sample.xStart} → {sample.xEnd}</td>{[sample.xPrevious, sample.xCurrent, sample.yPrevious, sample.yCurrent, sample.x, sample.y, sample.fitted, sample.residual].map((value, index) => <td className="px-2 py-2 font-mono text-slate-300" key={index}>{number(value)}</td>)}</tr>)}</tbody></table></div>
        </div></ResizablePanel>
      </ResizablePanelGroup></div>}
    </>}
    <details className="border-t border-slate-800"><summary className="cursor-pointer px-3 py-2 text-[11px] text-slate-300">变量口径、来源与回归方法</summary>
      <div className="overflow-auto"><table aria-label="FACTOR LAB 变量定义" className="w-full text-left text-[11px]"><thead className="text-slate-500"><tr>{['变量', '官方序列', '原单位', '变化单位', '来源', '最近观测'].map(label => <th className="px-3 py-2" key={label}>{label}</th>)}</tr></thead><tbody>{([['X', xSeries, xTransform], ['Y', ySeries, yTransform]] as const).map(([name, row, transform]) => <tr key={name} className="border-t border-slate-800"><td className="px-3 py-2">{name}</td><td className="px-3 py-2">{row?.id ?? '—'}</td><td className="px-3 py-2">{row?.unit === 'index_points' ? '指数点' : row?.unit ?? '—'}</td><td className="px-3 py-2">{row ? factorChangeUnit(row, transform) : '—'}</td><td className="px-3 py-2">{row?.source ?? '未提供'}</td><td className="px-3 py-2">{row?.observationDate ?? '—'}</td></tr>)}</tbody></table></div>
      <p className="px-3 py-2 text-[10px] leading-6 text-slate-400">Y(t) = α + β·X(t−k) + ε。先使用共享风险分析的相同起止观测区间，再应用单位变换与滞后；不前填缺口。利率/利差原单位 % 的差分乘 100 转为 bp；相对变化为（当值/前值−1）×100%，前值须为正。非交易日跨越仍按真实相邻观察区间处理，不宣称固定 24 小时收益。滞后是连续共同观测区间数，不是自然日；跨缺失区间不配对。当前端采用样本内 OLS，未做异方差、自相关修正或样本外验证，不给出显著性、因果关系和投资建议。相同数据源和指标在本页用于回归解释，不复刻环境概览。</p>
    </details>
    <footer role="status" className="flex flex-wrap justify-between gap-2 border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500"><span>来源：FRED · 官方日频历史观察 · 非实时行情 · 读取 {time(query.data?.retrievedAt ?? query.data?.asOf)}</span><span>{query.isError ? '接口失败，分析已停止' : query.isFetching ? '正在重新读取，当前结果来自上次成功观察' : '每 60 秒查询，按实际源数据变化重算'}{regression ? ' · 缺失滞后链剔除 ' + regression.missingLagIntervals : ''}</span></footer>
  </section>;
}
