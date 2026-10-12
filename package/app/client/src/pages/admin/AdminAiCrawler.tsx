import { useEffect, useState } from 'react';
import { Bot, Database, FileSearch, Play, Send, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import AdminLayout from '@/components/AdminLayout';
import { trpc } from '@/lib/trpc';
import AdminCrawlerWorkbench from './AdminCrawlerWorkbench';

export default function AdminAiCrawler() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [memorySuspended, setMemorySuspended] = useState(false);
  const sources = trpc.adminNewsIngestion.listSources.useQuery(undefined, { enabled: !memorySuspended, refetchOnWindowFocus: false });
  const syncSource = trpc.adminNewsIngestion.syncSource.useMutation({
    onSuccess: (result) => { toast.success(`公开来源同步完成：新增 ${result.queued} 条待处理元数据。`); void utils.adminNewsIngestion.listSources.invalidate(); },
    onError: (error) => toast.error(`来源同步未完成：${error.message}`),
  });
  const enableSchedule = trpc.adminNewsIngestion.enableSchedule.useMutation({
    onSuccess: (result) => { toast.success(`已启用 ${result.intervalMinutes} 分钟公开来源采集计划。`); void utils.adminNewsIngestion.listSources.invalidate(); },
    onError: (error) => toast.error(`自动采集计划未启用：${error.message}`),
  });

  useEffect(() => {
    const isSpiderQuery = (query: { queryKey: readonly unknown[] }) => /adminSpider|adminNewsIngestion/.test(JSON.stringify(query.queryKey));
    const clearTransientState = () => {
      setMemorySuspended(true);
      queueMicrotask(() => {
        void queryClient.cancelQueries({ predicate: isSpiderQuery });
        queryClient.removeQueries({ predicate: isSpiderQuery });
      });
    };
    const onVisibility = () => document.visibilityState === 'hidden' ? clearTransientState() : setMemorySuspended(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', clearTransientState);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', clearTransientState); };
  }, [queryClient]);

  if (memorySuspended) return <AdminLayout><section className="grid min-h-[60vh] place-items-center rounded-2xl border border-cyan-900/50 bg-slate-950 p-8 text-center"><div><ShieldCheck className="mx-auto h-12 w-12 text-cyan-400" /><h1 className="mt-4 text-xl font-bold text-white">爬虫工作台已清空临时视图</h1><p className="mt-2 text-sm text-slate-400">返回页面后会重新鉴权并读取任务、来源和采集结果。</p></div></section></AdminLayout>;

  return <AdminLayout><div data-spider-admin className="min-h-screen bg-[#02081c] px-3 py-5 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1680px]">
      <header className="rounded-[26px] border border-cyan-400/20 bg-gradient-to-r from-slate-950 via-[#071a36] to-[#092e43] p-5 text-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-4xl"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><Bot className="h-7 w-7" /></div><div><div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">SPIDER OPERATIONS CENTER</div><h1 className="mt-1 text-3xl font-black">专属 AI 爬虫控制台</h1></div></div><p className="mt-4 text-sm leading-6 text-slate-300">从来源健康、原始快照、解析改写、质量校验、内容去重到前端实收回执逐步留痕。定时任务自动完成清洗、去重与映射输送；人工可在异常或失败时复核、重试和追踪。</p></div>
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"><div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" />实时输送闭环</div><div className="mt-1 text-xs text-emerald-200/80">内容指纹去重 · 前端实收回执</div></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {[['新建采集任务','选择来源后自动匹配数据类别与载体',Play],['查看原始采集','核验响应、正文与原始快照',Database],['审核加工结果','查看自然改写、结构化字段与质量',FileSearch],['核验前端送达','查看目标功能、实收数量与确认时间',Send]].map(([title,detail,Icon]) => <div key={String(title)} className="rounded-xl border border-white/10 bg-white/[0.06] p-3"><Icon className="h-4 w-4 text-cyan-300" /><div className="mt-1.5 text-sm font-bold">{String(title)}</div><div className="mt-1 text-[11px] text-slate-400">{String(detail)}</div></div>)}
        </div>
      </header>
      <AdminCrawlerWorkbench sources={sources.data ?? []} onSyncSource={(sourceId) => syncSource.mutate({ sourceId })} onEnableSchedule={(sourceId) => enableSchedule.mutate({ sourceId, intervalMinutes: 30 })} syncPending={syncSource.isPending} schedulePending={enableSchedule.isPending} />
    </div>
  </div></AdminLayout>;
}
