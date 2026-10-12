/**
 * 前端挂载点：根据当前页面路径读取后台已推送到该位置的佑诚数据模块。
 * 有模块时在页面右下角出现“佑诚数据”入口，点开为侧边面板；
 * 后台发布 / 推送后通过 /api/uc/stream 实时刷新，无需刷新页面。
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Layers3, Maximize2, Minimize2, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ModuleRenderer } from './ModuleRenderer';

export default function UcRouteDock() {
  const [location] = useLocation();
  const path = location.split('?')[0] || '/';
  const utils = trpc.useUtils();
  const { data } = trpc.ucModules.forPath.useQuery({ path }, { staleTime: 30_000, refetchOnWindowFocus: false, retry: false });
  const track = trpc.ucModules.track.useMutation();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const viewed = useRef(new Set<string>());
  const modules = data?.modules ?? [];

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/uc/stream');
    const onUpdate = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as { slots: string[] };
        void utils.ucModules.forPath.invalidate();
        if (payload.slots?.length) viewed.current.clear();
      } catch { /* ignore */ }
    };
    es.addEventListener('uc-update', onUpdate as EventListener);
    return () => es.close();
  }, [utils]);

  useEffect(() => {
    if (!open) return;
    for (const m of modules) {
      if (viewed.current.has(m.code)) continue;
      viewed.current.add(m.code);
      track.mutate({ code: m.code, event: 'view' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modules]);

  if (!modules.length) return null;

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="fixed bottom-14 right-4 z-[60] inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-[#071012]/95 px-3.5 py-2 text-xs font-medium text-teal-100 shadow-lg shadow-teal-900/30 backdrop-blur hover:border-teal-300">
          <Layers3 className="h-4 w-4 text-teal-300" />佑诚数据
          <span className="rounded-full bg-teal-400/20 px-1.5 text-[10px] text-teal-200">{modules.length}</span>
        </button>
      )}
      {open && (
        <aside className={`fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-teal-500/20 bg-[#060d0f]/98 shadow-2xl backdrop-blur ${wide ? 'sm:w-[min(1100px,92vw)]' : 'sm:w-[620px]'}`}>
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Layers3 className="h-4 w-4 text-teal-300" />佑诚数据<span className="text-xs font-normal text-slate-500">{modules.length} 个模块</span></div>
            <div className="flex items-center gap-1">
              <button type="button" title={wide ? '收窄' : '加宽'} onClick={() => setWide((w) => !w)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-teal-200">{wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
              <button type="button" title="关闭" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-teal-200"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {modules.map((m) => (
              <ModuleRenderer key={m.code} module={m} mode="frontend" onInteract={(event) => track.mutate({ code: m.code, event })} />
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
