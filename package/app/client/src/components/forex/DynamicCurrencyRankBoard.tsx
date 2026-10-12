import React, { useEffect, useMemo, useState } from 'react';
import { buildDynamicSimulationSeries, type DynamicTimeframe } from '@/lib/dynamicFxSimulation';
import { DynamicFxInstrumentChart } from './DynamicFxInstrumentChart';

const CURRENCIES = [
  { code: 'USD', label: '美元', base: 100 }, { code: 'EUR', label: '欧元', base: 98.4 }, { code: 'JPY', label: '日元', base: 93.8 }, { code: 'GBP', label: '英镑', base: 101.3 }, { code: 'CHF', label: '瑞郎', base: 99.5 }, { code: 'AUD', label: '澳元', base: 96.2 }, { code: 'CAD', label: '加元', base: 95.7 }, { code: 'CNY', label: '人民币', base: 97.1 }, { code: 'BRL', label: '巴西雷亚尔', base: 91.4 }, { code: 'MXN', label: '墨西哥比索', base: 94.6 },
];

export function DynamicCurrencyRankBoard() {
  const [frame, setFrame] = useState<DynamicTimeframe>('1m');
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState('USD');
  useEffect(() => { const timer = window.setInterval(() => setTick((current) => current + 1), 1000); return () => window.clearInterval(timer); }, []);
  const ranking = useMemo(() => CURRENCIES.map((currency, index) => {
    const path = buildDynamicSimulationSeries(`WCRS-${currency.code}`, currency.base, 0.006 + index * 0.0003, frame, tick);
    const first = path[0]?.value ?? currency.base; const latest = path.at(-1)?.value ?? currency.base;
    return { ...currency, score: latest, change: ((latest / first) - 1) * 100 };
  }).sort((left, right) => right.change - left.change), [frame, tick]);
  const current = CURRENCIES.find((currency) => currency.code === selected) ?? CURRENCIES[0];
  return <section className="m-4 rounded border border-cyan-900/80 bg-[#050b1a] text-xs text-slate-100"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-950 p-3"><div><h3 className="font-semibold text-cyan-200">WCRS · 动态模拟货币强弱排行榜</h3><p className="mt-1 text-amber-200">动态模拟行情 · 非真实市场数据 · 非实时 · 不可执行</p></div><div className="flex flex-wrap gap-1">{(['1s', '1m', '1h', '1d', '1M', '1Y'] as DynamicTimeframe[]).map((option) => <button type="button" key={option} onClick={() => setFrame(option)} className={`rounded px-2 py-1 ${option === frame ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{option}</button>)}</div></header><p className="px-3 pt-3 text-slate-400">按所选窗口内的动态模拟相对变化排序；点击货币查看单一强弱路径、布林带、MACD、RSI 和 KDJ。</p><div className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-5">{ranking.map((currency, index) => <button type="button" key={currency.code} onClick={() => setSelected(currency.code)} className={`rounded border p-3 text-left ${selected === currency.code ? 'border-cyan-400 bg-cyan-950/40' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}><div className="flex justify-between"><strong className="font-mono text-cyan-100">#{index + 1} {currency.code}</strong><span className={currency.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{currency.change >= 0 ? '+' : ''}{currency.change.toFixed(3)}%</span></div><p className="mt-1 text-slate-400">{currency.label} · 强度 {currency.score.toFixed(2)}</p></button>)}</div><div className="p-3 pt-0"><DynamicFxInstrumentChart instrument={`WCRS-${current.code}`} title={`WCRS · ${current.code} 动态模拟强弱路径`} baseValue={current.base} amplitude={0.006} kind="spot" accent="#22d3ee" /></div></section>;
}
