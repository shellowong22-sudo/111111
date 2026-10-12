import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { fmtPct, fmtPrice, toneOf, useTicks } from '@/uc/market/live';

/** 页面底部全球行情条：实时报价，涨红跌绿。 */
const TAPE: Array<[string, string]> = [
  ['000001.SH', '上证指数'], ['000300.SH', '沪深 300'], ['399006.SZ', '创业板指'], ['^HSI', '恒生指数'],
  ['^GSPC', '标普 500'], ['^IXIC', '纳斯达克'], ['^DJI', '道琼斯'], ['^N225', '日经 225'], ['^STOXX50E', '欧洲斯托克 50'],
  ['DXY', '美元指数'], ['USDCNH', '美元/离岸人民币'], ['EURUSD', '欧元/美元'], ['USDJPY', '美元/日元'],
  ['^TNX', '10 年美债收益率'], ['GC', '黄金'], ['CL', '原油'],
];

export default function GlobalTickerTape() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const t = useTicks(TAPE.map(([s]) => s));
  const items = TAPE.filter(([s]) => t[s]?.price != null);
  return (
    <div className={cn('fixed bottom-0 left-0 right-0 z-40 border-t shadow-lg transition-colors duration-300', isDark ? 'border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950' : 'border-slate-200 bg-gradient-to-r from-slate-100 via-white to-slate-100')}>
      <div className="flex items-center gap-2 overflow-x-auto py-1.5 [scrollbar-width:thin]">
        <span className="shrink-0 border-r border-slate-700 px-3 font-mono text-[10px] text-cyan-300">全球行情</span>
        {!items.length ? <span className="shrink-0 text-[10px] text-slate-500">行情读取中…</span> : (
          <div className="ticker-tape-global flex min-w-max gap-6">
            {items.map(([s, label]) => {
              const k = t[s]!;
              const c = toneOf(k.changePct);
              return (
                <div key={s} className={cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-3 py-1', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-200/70')}>
                  <span className={cn('text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-700')}>{label}</span>
                  <span className="font-mono text-sm tabular-nums" style={{ color: c }}>{fmtPrice(k.price)}</span>
                  <span className="font-mono text-xs" style={{ color: c }}>{fmtPct(k.changePct)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
