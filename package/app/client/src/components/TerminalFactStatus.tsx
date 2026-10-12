import { useState } from 'react';
import { BarChart3, Database, ShieldAlert, X } from 'lucide-react';
import FieldSourceCoveragePanel from './FieldSourceCoveragePanel';
import LegacyMarketDataWorkspace from './LegacyMarketDataWorkspace';

/**
 * 终端级事实状态层。
 * 仅追加于主终端，不改写任何原菜单或原面板；用于将尚未接入可核验来源的历史展示与实际公开研究层明确隔离。
 */
export default function TerminalFactStatus({ fixed = false }: { fixed?: boolean }) {
  const [view, setView] = useState<'observations' | 'coverage' | null>(null);
  return (
    <><div className={`${fixed ? 'fixed inset-x-0 bottom-8 z-50 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.25)]' : 'border-b'} flex flex-wrap items-center gap-x-3 gap-y-1 border-amber-900/60 bg-amber-950/95 px-4 py-1.5 text-[10px] text-amber-100`}>
      <span className="inline-flex items-center gap-1 font-mono text-amber-300"><ShieldAlert className="h-3.5 w-3.5" />事实状态</span>
      <span>全局行情带、市场动态与未标注来源的历史展示不构成实时市场、报价、成交、新闻或投资依据。</span>
      <span className="text-amber-300/90">实际公开观察、来源、观测日和真实空状态请以各模块追加研究层为准。</span>
      <button type="button" onClick={() => setView('observations')} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-0.5 text-cyan-200 hover:bg-cyan-950/50"><Database className="h-3 w-3" />公开观察</button>
      <button type="button" onClick={() => setView('coverage')} className="inline-flex items-center gap-1 rounded border border-violet-800 px-2 py-0.5 text-violet-200 hover:bg-violet-950/50"><BarChart3 className="h-3 w-3" />字段覆盖率</button>
    </div>{view && <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16"><div className="relative w-full max-w-6xl"><button type="button" onClick={() => setView(null)} className="absolute -top-9 right-0 inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"><X className="h-3.5 w-3.5" />关闭</button>{view === 'observations' ? <LegacyMarketDataWorkspace /> : <FieldSourceCoveragePanel />}</div></div>}</>
  );
}
