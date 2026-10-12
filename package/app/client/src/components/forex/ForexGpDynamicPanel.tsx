import { useMemo, useState } from 'react';
import { DynamicFxInstrumentChart } from './DynamicFxInstrumentChart';

const GP_INSTRUMENTS = [
  { pair: 'EUR/USD', label: '欧元 / 美元', base: 1.08, amplitude: 0.004 },
  { pair: 'USD/JPY', label: '美元 / 日元', base: 149.8, amplitude: 0.002 },
  { pair: 'GBP/USD', label: '英镑 / 美元', base: 1.26, amplitude: 0.0045 },
  { pair: 'USD/CNY', label: '美元 / 人民币', base: 7.23, amplitude: 0.0015 },
  { pair: 'USD/MXN', label: '美元 / 墨西哥比索', base: 17.2, amplitude: 0.005 },
];

export function ForexGpDynamicPanel() {
  const [pair, setPair] = useState(GP_INSTRUMENTS[0].pair);
  const selected = useMemo(() => GP_INSTRUMENTS.find((instrument) => instrument.pair === pair) ?? GP_INSTRUMENTS[0], [pair]);
  return <section className="m-4 rounded border border-blue-900/80 bg-[#050b1a] p-3 text-xs">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-blue-200">GP · 单序列动态路径</p><p className="mt-1 text-amber-200">动态模拟行情 · 非真实市场数据 · 非实时 · 不可执行</p></div><label className="flex items-center gap-2 text-slate-300">货币对<select value={pair} onChange={(event) => setPair(event.target.value)} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-cyan-100">{GP_INSTRUMENTS.map((instrument) => <option key={instrument.pair} value={instrument.pair}>{instrument.pair} · {instrument.label}</option>)}</select></label></div>
    <p className="mb-3 text-slate-400">单序列路径专注于单一货币对的秒级动态模拟、MACD 与 RSI；它与 WCR 的地区横截面、WVOL 的期限风险切片和 XCCY 的基差曲线保持不同业务语义。</p>
    <DynamicFxInstrumentChart instrument={`GP-${selected.pair}`} title={`GP · ${selected.pair} 单序列路径`} baseValue={selected.base} amplitude={selected.amplitude} kind="path" accent="#60a5fa" />
  </section>;
}
