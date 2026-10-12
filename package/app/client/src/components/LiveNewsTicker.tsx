import { useState } from 'react';
import { Link } from 'wouter';
import KlineChart from '@/uc/market/KlineChart';
import { fmtPct, fmtPrice, toneOf, useLiveKline, useTicks, type Period } from '@/uc/market/live';

/** 终端右侧“市场观察”：主要市场实时报价，点击查看 K 线。 */
const LIST: Array<[string, string]> = [
  ['000001.SH', '上证指数'], ['399001.SZ', '深证成指'], ['399006.SZ', '创业板指'], ['^HSI', '恒生指数'],
  ['^GSPC', '标普 500'], ['^IXIC', '纳斯达克'], ['^DJI', '道琼斯'], ['^N225', '日经 225'],
  ['DXY', '美元指数'], ['USDCNH', '美元/离岸人民币'], ['^TNX', '10 年美债收益率'], ['GC', '黄金'], ['CL', '原油'],
];

export default function LiveNewsTicker() {
  const [symbol, setSymbol] = useState('^GSPC');
  const [period, setPeriod] = useState<Period>('1d');
  const t = useTicks(LIST.map(([s]) => s));
  const k = useLiveKline(symbol, period, period === '1d' ? 120 : 160);
  const label = LIST.find(([s]) => s === symbol)?.[1] ?? symbol;
  return (
    <section className="flex h-full min-w-0 flex-col border-l border-border text-[11px]" aria-label="市场观察">
      <header className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
        <h2 className="font-semibold">市场观察</h2>
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />实时</span>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-left tabular-nums">
          <thead><tr className="border-b border-border text-slate-500"><th className="p-1 font-normal">品种</th><th className="p-1 text-right font-normal">最新</th><th className="p-1 text-right font-normal">涨跌幅</th></tr></thead>
          <tbody>{LIST.map(([s, l]) => { const q = t[s]; return (
            <tr key={s} onClick={() => setSymbol(s)} className={`cursor-pointer border-b border-border/50 ${s === symbol ? 'bg-accent/10' : 'hover:bg-accent/5'}`}>
              <td className="p-1">{l}</td>
              <td className="p-1 text-right font-mono" style={{ color: toneOf(q?.changePct) }}>{fmtPrice(q?.price)}</td>
              <td className="p-1 text-right font-mono" style={{ color: toneOf(q?.changePct) }}>{fmtPct(q?.changePct)}</td>
            </tr>
          ); })}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-y border-border px-2 py-1">
        <span className="font-semibold">{label}</span>
        <span className="flex border border-border text-[10px]">{(['5m', '60m', '1d'] as Period[]).map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} className={`px-1.5 ${period === p ? 'bg-cyan-700/40 text-cyan-50' : 'text-slate-400'}`}>{({ '5m': '5分', '60m': '60分', '1d': '日K' } as Record<string, string>)[p]}</button>)}</span>
      </div>
      <div className="min-h-[220px] shrink-0">{k.candles.length ? <KlineChart candles={k.candles} period={period} height={220} live subs={['VOL']} /> : <p className="px-2 py-6 text-center text-slate-500">{k.loading ? 'K 线读取中…' : '暂无 K 线'}</p>}</div>
      <Link href={`/market?symbol=${encodeURIComponent(symbol)}`} className="px-2 py-1 text-accent underline">打开证券行情与明细</Link>
    </section>
  );
}
