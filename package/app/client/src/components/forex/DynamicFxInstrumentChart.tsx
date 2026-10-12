import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildDynamicSimulationSeries, calculateBollingerBands, calculateKdj, calculateMacd, calculateRsi, dynamicTimeframeLabel, type DynamicTimeframe } from '@/lib/dynamicFxSimulation';

type InstrumentKind = 'spot' | 'volatility' | 'basis' | 'path';
type Indicator = 'price' | 'macd' | 'rsi' | 'bollinger' | 'kdj';

export function DynamicFxInstrumentChart({ instrument, title, baseValue, amplitude, kind = 'spot', accent = '#22d3ee' }: { instrument: string; title: string; baseValue: number; amplitude: number; kind?: InstrumentKind; accent?: string }) {
  const [timeframe, setTimeframe] = useState<DynamicTimeframe>('1m');
  const [indicator, setIndicator] = useState<Indicator>('price');
  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => { setTick((current) => current + 1); setUpdatedAt(new Date()); }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const series = useMemo(() => buildDynamicSimulationSeries(`${instrument}-${kind}`, baseValue, amplitude, timeframe, tick), [instrument, baseValue, amplitude, timeframe, tick, kind]);
  const indicatorData = useMemo(() => {
    const values = series.map((point) => point.value);
    const macd = calculateMacd(values);
    const rsi = calculateRsi(values);
    const bollinger = calculateBollingerBands(values);
    const kdj = calculateKdj(values);
    return series.map((point, index) => ({ ...point, macd: macd[index]?.macd, signal: macd[index]?.signal, histogram: macd[index]?.histogram, rsi: rsi[index], upper: bollinger[index]?.upper, middle: bollinger[index]?.middle, lower: bollinger[index]?.lower, k: kdj[index]?.k, d: kdj[index]?.d, j: kdj[index]?.j }));
  }, [series]);
  const latest = series.at(-1)?.value ?? baseValue;
  const previous = series.at(-2)?.value ?? latest;
  const change = previous === 0 ? 0 : ((latest / previous) - 1) * 100;

  const exportSeries = () => {
    const csv = ['timestamp,label,value', ...series.map((point) => `${new Date(point.timestamp).toISOString()},${point.label},${point.value}`)].join('\n');
    const anchor = document.createElement('a');
    anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    anchor.download = `${instrument.replace(/\W/g, '_')}-${timeframe}-dynamic-simulation.csv`;
    anchor.click();
  };

  return <section className="rounded border border-cyan-900/80 bg-[#050b1a] p-3 text-xs">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div><div className="font-semibold text-cyan-200">{title}</div><div className="mt-1 text-amber-200">动态模拟行情 · 非真实市场数据 · 非实时 · 不可执行</div></div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>每秒动态更新 · {updatedAt.toLocaleTimeString('zh-CN', { hour12: false })}</span><button type="button" onClick={() => { setTick((current) => current + 1); setUpdatedAt(new Date()); }} aria-label="刷新动态模拟行情" className="rounded border border-slate-600 p-1 text-cyan-200 hover:border-cyan-300"><RefreshCw className="h-3 w-3" /></button><button type="button" onClick={exportSeries} aria-label="导出动态模拟行情" className="rounded border border-slate-600 p-1 text-cyan-200 hover:border-cyan-300"><Download className="h-3 w-3" /></button></div>
    </div>
    <div className="mb-3 flex flex-wrap gap-1">
      {(['1s', '1m', '1h', '1d', '1M', '1Y'] as DynamicTimeframe[]).map((frame) => <button key={frame} type="button" onClick={() => setTimeframe(frame)} className={`rounded px-2 py-1 ${timeframe === frame ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{dynamicTimeframeLabel(frame)}</button>)}
      {(['price', 'macd', 'rsi', 'bollinger', 'kdj'] as Indicator[]).map((option) => <button key={option} type="button" onClick={() => setIndicator(option)} className={`rounded px-2 py-1 ${indicator === option ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{option === 'price' ? '主序列' : option === 'bollinger' ? '布林带' : option.toUpperCase()}</button>)}
    </div>
    <div className="mb-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3"><div><span className="text-slate-500">当前模拟值</span><p className="font-mono text-cyan-200">{latest.toFixed(baseValue >= 100 ? 3 : baseValue >= 10 ? 4 : 6)}</p></div><div><span className="text-slate-500">相邻点变化</span><p className={change >= 0 ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>{change >= 0 ? '+' : ''}{change.toFixed(3)}%</p></div><div><span className="text-slate-500">窗口</span><p className="font-mono text-slate-200">{dynamicTimeframeLabel(timeframe)}</p></div></div>
    <div className="h-48 min-h-[12rem] sm:h-56 md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        {indicator === 'price' ? <AreaChart data={indicatorData}><defs><linearGradient id={`fill-${instrument.replace(/\W/g, '')}-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity={0.4} /><stop offset="100%" stopColor={accent} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#203047" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#8492a6', fontSize: 9 }} minTickGap={22} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#8492a6', fontSize: 9 }} width={52} /><Tooltip contentStyle={{ background: '#07101f', border: '1px solid #1f446d', fontSize: 11 }} /><Area type="monotone" dataKey="value" stroke={accent} fill={`url(#fill-${instrument.replace(/\W/g, '')}-${kind})`} strokeWidth={2} isAnimationActive={false} /></AreaChart> : indicator === 'macd' ? <LineChart data={indicatorData}><CartesianGrid stroke="#203047" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#8492a6', fontSize: 9 }} minTickGap={22} /><YAxis tick={{ fill: '#8492a6', fontSize: 9 }} width={52} /><Tooltip contentStyle={{ background: '#07101f', border: '1px solid #1f446d', fontSize: 11 }} /><ReferenceLine y={0} stroke="#64748b" /><Line type="monotone" dataKey="macd" stroke="#22d3ee" dot={false} strokeWidth={2} isAnimationActive={false} /><Line type="monotone" dataKey="signal" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart> : indicator === 'rsi' ? <LineChart data={indicatorData}><CartesianGrid stroke="#203047" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#8492a6', fontSize: 9 }} minTickGap={22} /><YAxis domain={[0, 100]} tick={{ fill: '#8492a6', fontSize: 9 }} width={36} /><Tooltip contentStyle={{ background: '#07101f', border: '1px solid #1f446d', fontSize: 11 }} /><ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" /><ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" /><Line type="monotone" dataKey="rsi" stroke="#a78bfa" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart> : indicator === 'bollinger' ? <LineChart data={indicatorData}><CartesianGrid stroke="#203047" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#8492a6', fontSize: 9 }} minTickGap={22} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#8492a6', fontSize: 9 }} width={52} /><Tooltip contentStyle={{ background: '#07101f', border: '1px solid #1f446d', fontSize: 11 }} /><Line type="monotone" dataKey="upper" stroke="#f59e0b" dot={false} strokeWidth={1.3} isAnimationActive={false} /><Line type="monotone" dataKey="middle" stroke="#94a3b8" dot={false} strokeWidth={1.3} isAnimationActive={false} /><Line type="monotone" dataKey="lower" stroke="#f59e0b" dot={false} strokeWidth={1.3} isAnimationActive={false} /><Line type="monotone" dataKey="value" stroke={accent} dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart> : <LineChart data={indicatorData}><CartesianGrid stroke="#203047" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#8492a6', fontSize: 9 }} minTickGap={22} /><YAxis domain={[-20, 120]} tick={{ fill: '#8492a6', fontSize: 9 }} width={36} /><Tooltip contentStyle={{ background: '#07101f', border: '1px solid #1f446d', fontSize: 11 }} /><ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" /><ReferenceLine y={20} stroke="#22c55e" strokeDasharray="4 4" /><Line type="monotone" dataKey="k" stroke="#22d3ee" dot={false} strokeWidth={2} isAnimationActive={false} /><Line type="monotone" dataKey="d" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} /><Line type="monotone" dataKey="j" stroke="#f472b6" dot={false} strokeWidth={1.5} isAnimationActive={false} /></LineChart>}
      </ResponsiveContainer>
    </div>
  </section>;
}
