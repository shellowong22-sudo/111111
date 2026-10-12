import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

type Props = { moduleId: string; moduleName: string };

const splitTerms = (value: string) => [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30);

export function AdminDataModuleProfileControls({ moduleId, moduleName }: Props) {
  const utils = trpc.useUtils();
  const profilesQuery = trpc.adminDataModules.listProfiles.useQuery();
  const profile = useMemo(() => (profilesQuery.data ?? []).find((item: any) => item.moduleId === moduleId), [profilesQuery.data, moduleId]);
  const [sourceKind, setSourceKind] = useState<'real' | 'simulated' | 'mixed' | 'none'>('none');
  const [sourceReference, setSourceReference] = useState('');
  const [theme, setTheme] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tags, setTags] = useState('');
  const [contentLimit, setContentLimit] = useState(10);
  const [frequency, setFrequency] = useState(1440);
  const [sortWeight, setSortWeight] = useState(100);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [taskTemplate, setTaskTemplate] = useState('ingest-review-deliver');
  const [priority, setPriority] = useState(100);
  const [reviewPolicy, setReviewPolicy] = useState<'manual' | 'auto_approved' | 'disabled'>('manual');
  const [pushPolicy, setPushPolicy] = useState<'manual' | 'after_approval' | 'disabled'>('after_approval');
  const [retryLimit, setRetryLimit] = useState(3);
  const [runtimeStatus, setRuntimeStatus] = useState<'enabled' | 'paused' | 'pending_generation' | 'pending_review' | 'pending_delivery' | 'delivering' | 'delivered' | 'failed'>('enabled');

  useEffect(() => {
    if (!profile) return;
    setSourceKind(profile.sourceKind);
    setSourceReference(profile.sourceReference ?? '');
    setTheme(profile.theme ?? '');
    setKeywords((Array.isArray(profile.keywords) ? profile.keywords : []).join(', '));
    setTags((Array.isArray(profile.tags) ? profile.tags : []).join(', '));
    setContentLimit(profile.contentLimit ?? 10);
    setFrequency(profile.updateFrequencyMinutes ?? 1440);
    setSortWeight(profile.sortWeight ?? 100);
    setAutomationEnabled(Boolean(profile.automationEnabled));
    setTaskTemplate(profile.taskTemplate ?? 'ingest-review-deliver');
    setPriority(profile.executionPriority ?? 100);
    setReviewPolicy(profile.reviewPolicy ?? 'manual');
    setPushPolicy(profile.pushPolicy ?? 'after_approval');
    setRetryLimit(profile.retryLimit ?? 3);
    setRuntimeStatus(profile.runtimeStatus ?? 'enabled');
  }, [profile]);

  const update = trpc.adminDataModules.updateProfiles.useMutation({
    onSuccess: () => {
      toast.success(`已保存 ${moduleName} 的后台数据与自动化规则。`);
      void utils.adminDataModules.listProfiles.invalidate();
    },
    onError: (error) => toast.error(`模块配置未保存：${error.message}`),
  });

  const number = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : min));
  if (profilesQuery.isLoading || !profile) return <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />正在读取后台模块配置…</div>;

  return <fieldset className="space-y-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4"><legend className="px-1 text-sm font-semibold text-cyan-100">数据规则、自动化与推送规则（仅后台）</legend><p className="text-xs leading-5 text-slate-400">现有读取契约：{profile.frontendInterface}。目标：{profile.targetCollection ?? '无安全共享写入目标'}。此处不向前端返回配置字段。</p><div className="grid gap-3 md:grid-cols-2"><label className="text-xs text-slate-300">数据模式<select aria-label="模块配置数据模式" value={sourceKind} onChange={(e) => setSourceKind(e.target.value as typeof sourceKind)} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="real">真实来源</option><option value="simulated">模拟数据</option><option value="mixed">真实与模拟混合</option><option value="none">未配置来源</option></select></label><label className="text-xs text-slate-300">来源说明<input aria-label="模块配置来源说明" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} maxLength={500} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">独立主题<input aria-label="模块配置主题" value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={200} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">关键词（逗号分隔）<input aria-label="模块配置关键词" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">标签（逗号分隔）<input aria-label="模块配置标签" value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">任务模板<input aria-label="模块任务模板" value={taskTemplate} onChange={(e) => setTaskTemplate(e.target.value)} maxLength={120} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">内容数量<input aria-label="模块内容数量" type="number" value={contentLimit} onChange={(e) => setContentLimit(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">更新频率（分钟）<input aria-label="模块更新频率" type="number" value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">排序权重<input aria-label="模块排序权重" type="number" value={sortWeight} onChange={(e) => setSortWeight(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">执行优先级<input aria-label="模块执行优先级" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">审核规则<select aria-label="模块审核规则" value={reviewPolicy} onChange={(e) => setReviewPolicy(e.target.value as typeof reviewPolicy)} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="manual">人工审核</option><option value="auto_approved">自动通过</option><option value="disabled">不进入审核</option></select></label><label className="text-xs text-slate-300">推送规则<select aria-label="模块推送规则" value={pushPolicy} onChange={(e) => setPushPolicy(e.target.value as typeof pushPolicy)} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="manual">手动推送</option><option value="after_approval">审核后推送</option><option value="disabled">禁止推送</option></select></label><label className="text-xs text-slate-300">失败重试次数<input aria-label="模块失败重试次数" type="number" value={retryLimit} onChange={(e) => setRetryLimit(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></label><label className="text-xs text-slate-300">运行状态<select aria-label="模块自动化运行状态" value={runtimeStatus} onChange={(e) => setRuntimeStatus(e.target.value as typeof runtimeStatus)} className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="enabled">启用</option><option value="paused">暂停</option><option value="pending_generation">待生成</option><option value="pending_review">待审核</option><option value="pending_delivery">待推送</option><option value="delivering">推送中</option><option value="delivered">已推送</option><option value="failed">失败</option></select></label></div><label className="inline-flex items-center gap-2 text-sm text-slate-200"><input aria-label="启用模块自动化" type="checkbox" checked={automationEnabled} onChange={(e) => setAutomationEnabled(e.target.checked)} />启用本模块自动化</label><button type="button" disabled={update.isPending} onClick={() => update.mutate({ moduleIds: [moduleId], sourceKind, sourceReference, theme, keywords: splitTerms(keywords), tags: splitTerms(tags), contentLimit: number(contentLimit, 1, 200), updateFrequencyMinutes: number(frequency, 1, 10080), sortWeight: number(sortWeight, 0, 100000), automationEnabled, taskTemplate: taskTemplate.trim() || 'manual-module-control', executionPriority: number(priority, 0, 100000), reviewPolicy, pushPolicy, retryLimit: number(retryLimit, 0, 10), runtimeStatus })} className="inline-flex items-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"><Save className="h-4 w-4" />保存模块数据规则</button></fieldset>;
}
