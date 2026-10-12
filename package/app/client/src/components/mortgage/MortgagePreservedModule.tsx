import { useRef, type ReactNode } from 'react';
import { Activity, Layers3, ShieldCheck } from 'lucide-react';
import ExportMenu from '@/components/ExportMenu';
import { MortgageFieldSourceLabel } from './MortgageFieldSourceLabel';
import MortgageWorkspaceFieldSources from './MortgageWorkspaceFieldSources';

export default function MortgagePreservedModule({ moduleId, original, enhancement }: { moduleId: string; original: ReactNode; enhancement: ReactNode }) {
  const exportRef = useRef<HTMLDivElement>(null);
  return (
    <div className="space-y-3 bg-slate-950/30 p-1">
      <div className="flex items-center justify-between gap-2 rounded border border-cyan-950/70 bg-[#0d1625] px-3 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 shrink-0 text-cyan-300" /><span className="font-mono font-semibold text-cyan-200">MBS-{moduleId} 工作台</span><Activity className="h-3 w-3 animate-pulse text-emerald-400" /><div className="hidden flex-wrap gap-1 sm:flex"><MortgageFieldSourceLabel kind="workspace" /><MortgageFieldSourceLabel kind="input" /></div></div>
        <ExportMenu filename={`mbs-${moduleId}-research-view`} targetRef={exportRef} variant="ghost" size="sm" className="h-7 shrink-0 border border-cyan-900/70 px-2 text-xs text-cyan-200" />
      </div>
      <div ref={exportRef} className="space-y-3 rounded bg-slate-950/30 p-1">
        <section aria-label={`MBS-${moduleId} 原有工作区`} className="rounded border border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs">
            <Layers3 className="h-3.5 w-3.5 text-cyan-300" />
            <span className="font-mono text-cyan-200">原有工作区</span>
            <span className="text-slate-500">行情、结构与交互区</span>
          </div>
          <MortgageWorkspaceFieldSources moduleId={moduleId}>{original}</MortgageWorkspaceFieldSources>
        </section>
        <section aria-label={`MBS-${moduleId} 终端内深化层`} className="rounded border border-slate-800 bg-slate-950/40 p-2">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-800 px-1 pb-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
            <span className="font-mono text-cyan-200">终端内深化层</span>
            <span className="text-slate-500">可视化分析与计算区</span>
          </div>
          {enhancement}
        </section>
      </div>
    </div>
  );
}
