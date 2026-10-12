import React, { useEffect, useMemo, useState } from 'react';
import { buildDynamicSimulationSeries, calculateMacd, calculateRsi, type DynamicTimeframe } from '@/lib/dynamicFxSimulation';
import { trpc } from '@/lib/trpc';
import { DynamicFxInstrumentChart } from './DynamicFxInstrumentChart';

type ResearchTrack = { id: string; title: string; focus: string; pair: string; base: number; amplitude: number; metric: string };
const RES_TRACKS: ResearchTrack[] = [
  { id: 'usd', title: '美元条件脉冲', focus: '关注相对强度、波动带宽与模拟动量是否同步。', pair: 'EUR/USD', base: 1.08, amplitude: 0.004, metric: '相对强度' },
  { id: 'carry', title: '利差与套息敏感度', focus: '观察利差方向与风险情绪的模拟联动，不构成交易建议。', pair: 'USD/JPY', base: 149.8, amplitude: 0.002, metric: '利差敏感度' },
  { id: 'risk', title: '风险切片观察', focus: '用波动通道和 KDJ 超买超卖区间组织风险假设。', pair: 'GBP/USD', base: 1.26, amplitude: 0.0045, metric: '波动带宽' },
];
const MARS_TRACKS: ResearchTrack[] = [
  { id: 'monitor', title: '模拟报价监测', focus: '显示模拟路径与短窗动量；不是双边报价、不可用于成交。', pair: 'EUR/USD', base: 1.08, amplitude: 0.004, metric: '监测中点' },
  { id: 'liquidity', title: '流动性压力切片', focus: '以模拟波动幅度呈现流动性压力假设，不表示真实深度或点差。', pair: 'USD/JPY', base: 149.8, amplitude: 0.0025, metric: '压力刻度' },
  { id: 'guardrail', title: '风险护栏检查', focus: '以 RSI、MACD 和 KDJ 组织模拟风险提示，不能提交或路由订单。', pair: 'USD/BRL', base: 5.38, amplitude: 0.005, metric: '护栏阈值' },
];

export function ForexDynamicResearchDesk({ code }: { code: 'RES' | 'MARS FX' }) {
  const tracks = code === 'RES' ? RES_TRACKS : MARS_TRACKS;
  const [trackId, setTrackId] = useState(tracks[0].id); const [frame, setFrame] = useState<DynamicTimeframe>('1h'); const [tick, setTick] = useState(0);
  const publicReference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  useEffect(() => { const timer = window.setInterval(() => setTick((current) => current + 1), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!tracks.some((track) => track.id === trackId)) setTrackId(tracks[0].id); }, [trackId, tracks]);
  const selected = tracks.find((track) => track.id === trackId) ?? tracks[0];
  const summary = useMemo(() => { const series = buildDynamicSimulationSeries(`research-${selected.id}`, selected.base, selected.amplitude, frame, tick); const values = series.map((point) => point.value); const rsi = calculateRsi(values).at(-1); const macd = calculateMacd(values).at(-1)?.histogram; return { rsi, macd, latest: values.at(-1) ?? selected.base }; }, [selected, frame, tick]);
  const heading = code === 'RES' ? '动态模拟研究监测' : '动态市场监测沙盘';
  const boundary = code === 'RES' ? '动态模拟资料 · 非真实市场数据 · 非投资建议' : '动态模拟监测 · 非真实市场数据 · 非实时 · 不可执行、不路由订单';
  const sourceStatus = publicReference.isLoading ? '公开日频来源读取中' : publicReference.error ? '公开日频来源暂不可读取；模拟研究区仍明确独立显示' : publicReference.data?.readings?.length ? `公开日频来源可用 · ${publicReference.data.asOf ?? '日期待定'} · 仅日频参考` : '公开日频来源未返回可读序列；模拟研究区仍明确独立显示';
  return <section className="m-4 rounded border border-indigo-900/80 bg-[#06091a] text-xs text-slate-100"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-950 p-3"><div><h3 className="font-semibold text-indigo-200">{code} · {heading}</h3><p className="mt-1 text-amber-200">{boundary}</p><p className="mt-1 text-slate-400">{sourceStatus}</p></div><div className="flex flex-wrap gap-1">{(['1s', '1m', '1h', '1d', '1M', '1Y'] as DynamicTimeframe[]).map((option) => <button type="button" key={option} onClick={() => setFrame(option)} className={`rounded px-2 py-1 ${frame === option ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{option}</button>)}</div></header><div className="grid gap-3 p-3 lg:grid-cols-[13rem_minmax(0,1fr)]"><aside className="space-y-2">{tracks.map((track) => <button type="button" key={track.id} onClick={() => setTrackId(track.id)} className={`w-full rounded border p-3 text-left ${track.id === selected.id ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-800 hover:border-slate-600'}`}><strong className="text-indigo-200">{track.title}</strong><p className="mt-1 text-slate-400">{track.focus}</p></button>)}</aside><div><div className="mb-3 grid gap-2 sm:grid-cols-3"><div className="rounded bg-slate-900 p-2"><small className="text-slate-500">{selected.metric}</small><p className="font-mono text-cyan-200">{summary.latest.toFixed(selected.base > 10 ? 3 : 5)}</p></div><div className="rounded bg-slate-900 p-2"><small className="text-slate-500">RSI (模拟)</small><p className="font-mono text-violet-200">{summary.rsi?.toFixed(2) ?? '计算中'}</p></div><div className="rounded bg-slate-900 p-2"><small className="text-slate-500">{code === 'RES' ? 'MACD 柱 (模拟)' : '执行状态'}</small><p className="font-mono text-amber-200">{code === 'RES' ? (summary.macd?.toFixed(5) ?? '计算中') : '不可执行'}</p></div></div><DynamicFxInstrumentChart instrument={`${code.toLowerCase()}-${selected.pair}`} title={`${code} · ${selected.title}`} baseValue={selected.base} amplitude={selected.amplitude} kind="path" accent="#818cf8" /></div></div></section>;
}
