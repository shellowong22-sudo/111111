import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BrainCircuit, CheckCircle2, ClipboardList, Eye, FileText, Globe2, Loader2, Play, Search, Sparkles, Trash2, Workflow, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAdminAiGenerationTemplate, type AdminAiGenerationCatalogCode } from '@shared/adminAiGenerationCatalog';
import { toast } from 'sonner';
import AdminNewsReviewBatchPanel from './AdminNewsReviewBatchPanel';
import AdminLayout from '@/components/AdminLayout';
import AdminCrawlerWorkbench from './AdminCrawlerWorkbench';

type Tab = 'crawler' | 'generate' | 'review' | 'models' | 'tasks' | 'memory';
type GenerationType = 'news' | 'report' | 'course';
type CatalogGroup = '新闻资讯' | '研究与宏观' | '评论与分析' | '个性化与设置';
type CatalogStatus = 'enabled' | 'disabled' | 'deleted';
type CatalogEntry = { code: string; label: string; route: string; mode: '代码模块' | '工作区分类'; group: CatalogGroup };
type GenerationStage = 'idle' | 'validating' | 'generating' | 'completed' | 'empty' | 'failed';

const generationLabels: Record<GenerationType, string> = { news: '金融资讯文章', report: '研报摘要', course: '金融课程草稿' };
const catalogGroups: CatalogGroup[] = ['新闻资讯', '研究与宏观', '评论与分析', '个性化与设置'];
const catalogStatusLabels: Record<CatalogStatus, string> = { enabled: '已启用', disabled: '已禁用', deleted: '已从目录删除' };
const catalogStatusStyles: Record<CatalogStatus, string> = { enabled: 'border-emerald-200 bg-emerald-50 text-emerald-700', disabled: 'border-amber-200 bg-amber-50 text-amber-700', deleted: 'border-rose-200 bg-rose-50 text-rose-700' };

// 与保留的新闻与研究中心保持相同的功能代码、名称与顺序；文件与资料仍为原资源库入口，未列为生成类型。
const catalog: CatalogEntry[] = [
  { code: 'TOP', label: '要闻精选', route: '/menu-item/TOP', mode: '代码模块', group: '新闻资讯' },
  { code: 'BTDY', label: 'Bloomberg Today', route: '/menu-item/BTDY', mode: '代码模块', group: '新闻资讯' },
  { code: 'FRNT', label: '首页', route: '/menu-item/FRNT', mode: '代码模块', group: '新闻资讯' },
  { code: 'CN', label: '公司新闻', route: '/menu-item/CN', mode: '代码模块', group: '新闻资讯' },
  { code: 'READ', label: '最热门报道', route: '/menu-item/READ', mode: '代码模块', group: '新闻资讯' },
  { code: 'NI', label: '新闻主题', route: '/menu-item/NI', mode: '代码模块', group: '新闻资讯' },
  { code: 'NH', label: '滚动新闻', route: '/menu-item/NH', mode: '代码模块', group: '新闻资讯' },
  { code: 'FIRS', label: '彭博率先报道', route: '/menu-item/FIRS', mode: '代码模块', group: '新闻资讯' },
  { code: 'BI', label: '彭博行业研究', route: '/menu-item/BI', mode: '代码模块', group: '研究与宏观' },
  { code: 'BECO', label: '彭博经浏', route: '/menu-item/BECO', mode: '代码模块', group: '研究与宏观' },
  { code: 'DAYB', label: '彭博早间新闻', route: '/menu-item/DAYB', mode: '代码模块', group: '新闻资讯' },
  { code: 'MAG', label: '彭博杂志', route: '/menu-item/MAG', mode: '代码模块', group: '新闻资讯' },
  { code: 'MDIA', label: '多媒体', route: '/news-hub?tab=media', mode: '工作区分类', group: '新闻资讯' },
  { code: 'MEDI', label: '彭博媒体', route: '/menu-item/MEDI', mode: '代码模块', group: '新闻资讯' },
  { code: '3RD', label: '第三方优质新闻', route: '/news-hub?tab=third', mode: '工作区分类', group: '新闻资讯' },
  { code: 'INTL', label: '非英语新闻', route: '/news-hub?tab=intl', mode: '工作区分类', group: '新闻资讯' },
  { code: 'CMNT', label: '评论与分析', route: '/news-hub?tab=commentary', mode: '工作区分类', group: '评论与分析' },
  { code: 'OPIN', label: '彭博观点', route: '/menu-item/OPIN', mode: '代码模块', group: '评论与分析' },
  { code: 'BNEF', label: '彭博新能源财经研究报告', route: '/menu-item/BNEF', mode: '代码模块', group: '研究与宏观' },
  { code: 'PERS', label: '个性化新闻', route: '/news-hub?tab=personal', mode: '工作区分类', group: '个性化与设置' },
  { code: 'MYN', label: '我的新闻', route: '/menu-item/MYN', mode: '代码模块', group: '个性化与设置' },
  { code: 'NLRT', label: '新闻检索与提醒', route: '/menu-item/NLRT', mode: '代码模块', group: '个性化与设置' },
  { code: 'NSUB', label: '新闻订阅', route: '/menu-item/NSUB', mode: '代码模块', group: '个性化与设置' },
  { code: 'MREP', label: 'Morning Report', route: '/menu-item/MREP', mode: '代码模块', group: '研究与宏观' },
  { code: 'NZPD', label: '新闻设定', route: '/menu-item/NZPD', mode: '代码模块', group: '个性化与设置' },
  { code: 'SOCL', label: '社交媒体与分析', route: '/news-hub?tab=social', mode: '工作区分类', group: '评论与分析' },
  { code: 'SOCI', label: '社交监测', route: '/menu-item/SOCI', mode: '代码模块', group: '评论与分析' },
  { code: 'TREN', label: '新闻趋势', route: '/menu-item/TREN', mode: '代码模块', group: '评论与分析' },
];

function CatalogBadge({ status }: { status: CatalogStatus }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${catalogStatusStyles[status]}`}>{catalogStatusLabels[status]}</span>;
}

function catalogEffect(item: CatalogEntry) {
  const template = getAdminAiGenerationTemplate(item.code as AdminAiGenerationCatalogCode);
  return `该目录使用“${generationLabels[template]}”审核模板；仅从已许可 RSS／Atom 的排队新闻元数据整理草稿，并写入既有审核队列。`;
}

function formatTime(value?: Date | string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function AdminAiManagement({ surface = 'management' }: { surface?: 'management' | 'crawler' }) {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [memorySuspended, setMemorySuspended] = useState(false);
  const [tab, setTab] = useState<Tab>('crawler');
  const [generationType, setGenerationType] = useState<GenerationType>('news');
  const [catalogCode, setCatalogCode] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested === 'crawler' || requested === 'generate' || requested === 'review' || requested === 'models' || requested === 'tasks' || requested === 'memory') setTab(requested);
  }, []);

  useEffect(() => {
    const isCrawlerQuery = (query: { queryKey: readonly unknown[] }) => JSON.stringify(query.queryKey).includes('adminNewsIngestion');
    const purgeTransientData = () => {
      setMemorySuspended(true);
      setCatalogCode(null);
      setGenerationStage('idle');
      queueMicrotask(() => {
        void queryClient.cancelQueries({ predicate: isCrawlerQuery });
        queryClient.removeQueries({ predicate: isCrawlerQuery });
      });
    };
    const handleVisibility = () => document.visibilityState === 'hidden' ? purgeTransientData() : setMemorySuspended(false);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', purgeTransientData);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', purgeTransientData);
    };
  }, [queryClient]);

  const queryOptions = { enabled: !memorySuspended, refetchOnWindowFocus: false } as const;
  const sourcesQuery = trpc.adminNewsIngestion.listSources.useQuery(undefined, queryOptions);
  const articlesQuery = trpc.adminNewsIngestion.listArticles.useQuery({ status: 'all', limit: 100 }, queryOptions);
  const readinessQuery = trpc.adminNewsIngestion.getGenerationReadiness.useQuery(undefined, queryOptions);
  const tasksQuery = trpc.adminNewsIngestion.listGenerationTasks.useQuery({ limit: 60 }, queryOptions);
  const modelsQuery = trpc.adminNewsIngestion.listModelStatus.useQuery(undefined, queryOptions);
  const memoryOverview = trpc.ucheerAi.adminOverview.useQuery(undefined, { enabled: !memorySuspended && tab === 'memory', refetchInterval: 60_000 });
  const settingsQuery = trpc.adminNewsIngestion.listGenerationCatalogSettings.useQuery(undefined, queryOptions);
  const runGeneration = trpc.adminNewsIngestion.runGeneration.useMutation({
    onMutate: () => setGenerationStage('generating'),
    onSuccess: (result) => {
      setGenerationStage(result.generated > 0 ? 'completed' : 'empty');
      toast.success(result.detail);
      void Promise.all([utils.adminNewsIngestion.listArticles.invalidate(), utils.adminNewsIngestion.listGenerationTasks.invalidate(), utils.adminNewsIngestion.listAuditEvents.invalidate()]);
      setTab('tasks');
    },
    onError: (error) => { setGenerationStage('failed'); toast.error(`AI 生成未完成：${error.message}`); },
  });
  const syncSource = trpc.adminNewsIngestion.syncSource.useMutation({
    onSuccess: (result) => {
      toast.success(result.status === 'available' ? `来源同步完成：新增 ${result.queued} 条排队元数据，可立即生成审核草稿。` : `来源同步未完成：${result.reason ?? result.status}`);
      void Promise.all([utils.adminNewsIngestion.listSources.invalidate(), utils.adminNewsIngestion.listArticles.invalidate(), utils.adminNewsIngestion.listAuditEvents.invalidate()]);
    },
    onError: (error) => toast.error(`来源同步未完成：${error.message}`),
  });
  const addHkexNewsSource = trpc.adminNewsIngestion.addHkexNewsReleasesRss.useMutation({
    onSuccess: (result) => {
      toast.success(result.existed ? 'HKEX 官方新闻来源已存在，正在手动同步。' : '已添加 HKEX 官方新闻来源，正在手动同步。');
      syncSource.mutate({ sourceId: result.sourceId });
      void Promise.all([utils.adminNewsIngestion.listSources.invalidate(), utils.adminNewsIngestion.getGenerationReadiness.invalidate(), utils.adminNewsIngestion.listAuditEvents.invalidate()]);
    },
    onError: (error) => toast.error(`无法添加官方新闻来源：${error.message}`),
  });
  const enableSourceSchedule = trpc.adminNewsIngestion.enableSchedule.useMutation({
    onSuccess: (result) => {
      toast.success(`已启用 ${result.intervalMinutes} 分钟新闻自动采集计划。`);
      void Promise.all([utils.adminNewsIngestion.listSources.invalidate(), utils.adminNewsIngestion.listAuditEvents.invalidate()]);
    },
    onError: (error) => toast.error(error.message === 'NEWS_SCHEDULE_REQUIRES_PUBLISHED_DEPLOYMENT' ? '自动采集仅可在发布后的生产站点启用；开发预览不会运行计划。' : `自动采集计划未启用：${error.message}`),
  });

  const articles = articlesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const sources = sourcesQuery.data ?? [];
  const directSyncSource = sources.find((source: any) => source.isActive && source.processingMode === 'queued' && source.lastStatus === 'available') ?? sources.find((source: any) => source.isActive && source.processingMode === 'queued') ?? null;
  const hkexSource = sources.find((source: any) => source.feedUrl === 'https://www.hkex.com.hk/Services/RSS-Feeds/News-Releases?sc_lang=en') ?? null;
  const settings = settingsQuery.data ?? [];
  const statusByCode = useMemo(() => new Map(settings.map((setting) => [setting.catalogCode, setting.status as CatalogStatus])), [settings]);
  const selectedCatalog = useMemo(() => catalog.find((item) => item.code === catalogCode) ?? null, [catalogCode]);
  const selectedStatus = selectedCatalog ? (statusByCode.get(selectedCatalog.code) ?? 'enabled') : 'enabled';
  const enabledCatalog = catalog.filter((item) => (statusByCode.get(item.code) ?? 'enabled') === 'enabled');
  const queuedCount = readinessQuery.data?.queuedCount ?? articles.filter((article) => article.status === 'queued').length;
  const generatedCount = tasks.reduce((total, task) => total + task.generatedCount, 0);
  const completedTaskCount = tasks.filter((task) => task.status === 'completed').length;

  const normalizeCount = (value: number) => Math.min(10, Math.max(1, value || 1));
  const refresh = () => void Promise.all([utils.adminNewsIngestion.listSources.invalidate(), utils.adminNewsIngestion.listArticles.invalidate(), utils.adminNewsIngestion.getGenerationReadiness.invalidate(), utils.adminNewsIngestion.listGenerationTasks.invalidate(), utils.adminNewsIngestion.listModelStatus.invalidate(), utils.adminNewsIngestion.listGenerationCatalogSettings.invalidate()]);
  const startGenericGeneration = (type = generationType, requested = count) => { setGenerationStage('validating'); runGeneration.mutate({ generationType: type, count: normalizeCount(requested) }); };
  const startCatalogGeneration = () => {
    if (!selectedCatalog || selectedStatus !== 'enabled') return;
    const code = selectedCatalog.code as AdminAiGenerationCatalogCode;
    setGenerationStage('validating');
    runGeneration.mutate({ generationType: getAdminAiGenerationTemplate(code), count: normalizeCount(count), catalogCode: code });
  };
  const changeType = (value: string) => {
    if (value.startsWith('catalog:')) setCatalogCode(value.slice('catalog:'.length));
    else { setCatalogCode(null); setGenerationType(value.slice('template:'.length) as GenerationType); }
  };

  if (memorySuspended) return <AdminLayout><section className="grid min-h-[60vh] place-items-center rounded-2xl border border-cyan-900/50 bg-slate-950 p-8 text-center"><div><BrainCircuit className="mx-auto h-12 w-12 text-cyan-400" /><h1 className="mt-4 text-xl font-bold text-white">敏感视图已清空</h1><p className="mt-2 text-sm text-slate-400">页面离开前台后，爬虫查询缓存与临时选择已从浏览器内存移除；返回页面时将重新鉴权读取。</p></div></section></AdminLayout>;

  return <AdminLayout><div className="min-h-screen bg-[#02081c] px-3 py-7 text-slate-950 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-[1560px]">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg"><BrainCircuit className="h-7 w-7" /></div><div><h1 className="text-2xl font-bold text-white">{surface === 'crawler' ? '专属 AI 爬虫' : 'AI 管理工作台'}</h1><p className="mt-1 text-sm text-slate-400">{surface === 'crawler' ? '统一采集许可公开来源与站内证券主数据，按全部已登记功能执行独立主题加工、去重、审核和定向推送；模拟分析会明确标识。' : '管理已许可新闻元数据、待审核草稿、可用模型与生成任务；所有结果均留在站内审核链路。'}</p></div></div>
        <Link href="/admin/data-ingestion" className="rounded-xl border border-sky-300/45 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/25">进入数据采集工作台</Link>
      </header>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="实测可用对话模型" value={modelsQuery.isLoading ? '—' : modelsQuery.data?.activeModelCount ?? 0} detail={modelsQuery.data?.activeModelCount ? '已通过实际对话请求' : '目前没有通过验证的模型'} icon={BrainCircuit} />
        <Metric label="已保存新闻" value={articlesQuery.isLoading ? '—' : articles.length} detail="当前已加载的站内文章记录" icon={Globe2} />
        <Metric label="已生成草稿" value={tasksQuery.isLoading ? '—' : generatedCount} detail="近期任务的实际生成总数" icon={Sparkles} accent="text-amber-500" />
        <Metric label="质量评估" value="—" detail="尚未建立可验证评测基线" icon={CheckCircle2} accent="text-slate-500" />
      </section>
      <nav className="mt-8 inline-flex max-w-full overflow-x-auto rounded-[20px] bg-[#eef3f9] p-1.5 shadow-[0_8px_26px_rgba(0,0,0,.17)]" aria-label="AI 管理功能">
        <TabButton active={tab === 'crawler'} icon={Globe2} label="爬虫管理" onClick={() => setTab('crawler')} />
        <TabButton active={tab === 'generate'} icon={Sparkles} label="AI生成" onClick={() => setTab('generate')} />
        <TabButton active={tab === 'review'} icon={CheckCircle2} label="审核与导出" onClick={() => setTab('review')} />
        <TabButton active={tab === 'models'} icon={BrainCircuit} label="模型状态" onClick={() => setTab('models')} />
        <TabButton active={tab === 'memory'} icon={BrainCircuit} label="Ucheer AI 记忆" onClick={() => setTab('memory')} />
        <TabButton active={tab === 'tasks'} icon={ClipboardList} label="任务日志" onClick={() => setTab('tasks')} />
      </nav>
      {tab === 'generate' && <GenerationProgress stage={generationStage} />}
      {tab === 'crawler' && <AdminCrawlerWorkbench sources={sources} onSyncSource={(sourceId) => syncSource.mutate({ sourceId })} onEnableSchedule={(sourceId) => enableSourceSchedule.mutate({ sourceId, intervalMinutes: 30 })} syncPending={syncSource.isPending} schedulePending={enableSourceSchedule.isPending} />}
      {tab === 'generate' && <><section className="mt-5 grid gap-5 xl:grid-cols-2"><GenerationPanel selectedCatalog={selectedCatalog} selectedStatus={selectedStatus} generationType={generationType} count={count} queuedCount={queuedCount} pending={runGeneration.isPending} enabledCatalog={enabledCatalog} onChangeCount={(value) => setCount(normalizeCount(value))} onChangeType={changeType} onStartGeneric={startGenericGeneration} onStartCatalog={startCatalogGeneration} onClearCatalog={() => setCatalogCode(null)} /><CatalogManager settings={settings} draftCount={articles.filter((article) => article.status === 'draft').length} onSelect={(item) => setCatalogCode(item.code)} /></section>{queuedCount === 0 && <section className="mt-5"><Panel title="先同步来源，再生成草稿" icon={Workflow}><div className="space-y-4"><div className="rounded-2xl border border-sky-200 bg-[#edf6ff] p-5"><div className="font-semibold text-slate-900">{directSyncSource ? `当前可同步来源：${directSyncSource.name}` : '当前没有已启用的 queued 来源'}</div><p className="mt-2 text-sm leading-6 text-slate-600">同步只保存该来源的新 RSS／Atom 标题、链接和有限摘要为 queued。同步完成后，请在上方直接选择目录模板生成 draft；不会自动调用模型，也不会发布文章。</p>{directSyncSource && <button type="button" disabled={syncSource.isPending || addHkexNewsSource.isPending} onClick={() => syncSource.mutate({ sourceId: directSyncSource.id })} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3d93df] px-5 py-3 font-semibold text-white hover:bg-[#287fcc] disabled:opacity-55">{syncSource.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Workflow className="h-5 w-5" />}{syncSource.isPending ? '正在同步许可来源' : '同步当前来源'}</button>}</div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="font-semibold text-emerald-950">官方备用来源：HKEX 新闻发布</div><p className="mt-2 text-sm leading-6 text-emerald-800">当前的新浪 RSS 已确认返回空频道。可由管理员在此手动添加并同步香港交易所公开新闻发布 RSS；该来源实际返回条目，仍只保存有限元数据并进入审核链路。</p><button type="button" disabled={syncSource.isPending || addHkexNewsSource.isPending} onClick={() => hkexSource ? syncSource.mutate({ sourceId: hkexSource.id }) : addHkexNewsSource.mutate()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-55">{(syncSource.isPending || addHkexNewsSource.isPending) ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe2 className="h-5 w-5" />}{(syncSource.isPending || addHkexNewsSource.isPending) ? '正在添加或同步官方来源' : hkexSource ? '同步 HKEX 官方新闻来源' : '添加并同步 HKEX 官方新闻来源'}</button></div></div></Panel></section>}<section className="mt-5"><Panel title="快速操作" icon={Workflow}><div className="grid gap-4 md:grid-cols-3"><QuickAction icon={FileText} label="生成 5 篇金融资讯草稿" pending={runGeneration.isPending} disabled={queuedCount === 0} onClick={() => startGenericGeneration('news', 5)} /><QuickAction icon={FileText} label="生成 3 份研报摘要草稿" pending={runGeneration.isPending} disabled={queuedCount === 0} onClick={() => startGenericGeneration('report', 3)} /><QuickAction icon={BrainCircuit} label="生成 3 门金融课程草稿" pending={runGeneration.isPending} disabled={queuedCount === 0} onClick={() => startGenericGeneration('course', 3)} /></div><p className="mt-7 rounded-xl bg-[#f5f8fc] p-5 text-base leading-7 text-slate-600">生成完成后自动进入任务日志和原始数据采集工作台的文章审核队列。只有管理员批准后，既有发布功能才可以将内容写入站内新闻流。</p></Panel></section></>}
      {tab === 'review' && <div className="mt-5"><AdminNewsReviewBatchPanel /></div>}
      {tab === 'models' && <ModelPanel models={modelsQuery.data} loading={modelsQuery.isLoading} />}
      {tab === 'memory' && <section className="mt-5"><Panel title="Ucheer AI · 持久记忆与自适应" icon={BrainCircuit}>
        {memoryOverview.isLoading ? <Loading /> : memoryOverview.error || !memoryOverview.data?.available
          ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">记忆数据库未连接或建表失败；当前不能宣称对话已持久保存。请检查服务端数据库连接与建表权限。</p>
          : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="已保存对话" value={memoryOverview.data.conversations} />
              <MiniMetric label="输入 / 输出记录" value={memoryOverview.data.messages} />
              <MiniMetric label="长期记忆" value={memoryOverview.data.memories} />
              <MiniMetric label="自动提炼摘要" value={memoryOverview.data.automaticSummaries} />
              <MiniMetric label="待改进反馈" value={memoryOverview.data.correctionsNeeded} />
              <MiniMetric label="自动捕获记忆" value={memoryOverview.data.automaticCaptured} tone="text-violet-600" />
              <MiniMetric label="已完成整理" value={memoryOverview.data.distillationCompleted} tone="text-emerald-600" />
              <MiniMetric label="进化失败任务" value={memoryOverview.data.evolutionFailures} tone={memoryOverview.data.evolutionFailures ? "text-rose-600" : "text-slate-950"} />
            </div>}
        {!memoryOverview.isLoading && memoryOverview.data?.available && <p className="mt-5 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-slate-700">自动记忆状态：{memoryOverview.data.pendingDistillation > 0 ? `有 ${memoryOverview.data.pendingDistillation} 个对话等待整理` : "当前没有积压任务"}；失败任务 {memoryOverview.data.failedDistillation} 个；最近进化时间：{memoryOverview.data.lastEvolutionAt ? new Date(memoryOverview.data.lastEvolutionAt).toLocaleString() : "暂无"}。</p>}
        {memoryOverview.data?.available && <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Ucheer AI 后台自动整理</p>
          <p className="mt-1">定时任务：{!memoryOverview.data.schedule ? "未登记（自动执行未确认）" : memoryOverview.data.schedule.enabled ? "已启用" : "已停用"}；最近执行：{formatTime(memoryOverview.data.schedule?.lastExecutedAt)}；执行状态：{memoryOverview.data.schedule?.lastStatus ?? "无记录"}。</p>
          <p className="mt-1 text-xs text-slate-500">已接入现有 AI 对话：历史持久保存、仅用户原话的长期记忆、重复合并、后台整理、反馈记录、网页搜索与引用链接核对。搜索标题和摘要不等于已核验正文；此处的任务计数只显示实际数据库记录。</p>
          <div className="mt-3 space-y-1" aria-label="Ucheer AI 最近任务">
            {memoryOverview.data.recentJobs.length ? memoryOverview.data.recentJobs.map((job, index) =>
              <div key={`${job.createdAt}-${index}`} className="flex justify-between gap-2 border-t border-slate-100 py-1 text-xs">
                <span>{({ memory_captured: "记忆捕获", distillation_completed: "对话整理", distillation_failed: "整理失败", feedback_recorded: "反馈记录" } as const)[job.eventType]} · {({ completed: "完成", failed: "失败", skipped: "安全跳过" } as const)[job.status]}</span>
                <span>{formatTime(job.createdAt)}</span>
              </div>) : <p className="mt-2 text-xs text-slate-500">暂无执行记录。</p>}
          </div>
        </div>}
        <p className="mt-5 text-sm leading-6 text-slate-600">仅登录用户拥有自己的对话和记忆；后台只显示汇总，不展示个人消息。系统在每次成功回答后自动捕获安全的长期偏好，并在对话达到整理阈值后自动提炼历史主题；不会自动交易、改写后台代码或训练基础模型权重。</p>
        <Link href="/ucheer-ai" className="mt-4 inline-block text-sm font-semibold text-blue-600 underline">打开 Ucheer AI 对话与记忆管理</Link>
      </Panel></section>}
      {tab === 'tasks' && <TaskPanel tasks={tasks} loading={tasksQuery.isLoading} completed={completedTaskCount} generated={generatedCount} onRefresh={refresh} />}
    </div>
  </div></AdminLayout>;
}

function GenerationPanel({ selectedCatalog, selectedStatus, generationType, count, queuedCount, pending, enabledCatalog, onChangeCount, onChangeType, onStartGeneric, onStartCatalog, onClearCatalog }: { selectedCatalog: CatalogEntry | null; selectedStatus: CatalogStatus; generationType: GenerationType; count: number; queuedCount: number; pending: boolean; enabledCatalog: CatalogEntry[]; onChangeCount: (value: number) => void; onChangeType: (value: string) => void; onStartGeneric: () => void; onStartCatalog: () => void; onClearCatalog: () => void }) {
  const selectedValue = selectedCatalog ? `catalog:${selectedCatalog.code}` : `template:${generationType}`;
  const start = selectedCatalog ? onStartCatalog : onStartGeneric;
  const isDisabled = pending || queuedCount === 0 || (selectedCatalog ? selectedStatus !== 'enabled' : false);
  return <Panel title="AI 批量数据生成" icon={Sparkles}><div className="rounded-2xl border border-amber-200 bg-[#fff9e9] p-5 text-lg font-semibold leading-8 text-amber-700">AI 仅会使用处于“等待生成”的已保存新闻元数据创建待审核草稿。不会生成来源之外的金融事实，不会自动发布。</div><label className="mt-7 block text-xl font-semibold">生成类型</label><select aria-label="生成类型" value={selectedValue} onChange={(event) => onChangeType(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-lg font-semibold outline-none focus:border-blue-500"><optgroup label="通用可审核生成模板">{(Object.keys(generationLabels) as GenerationType[]).map((type) => <option key={type} value={`template:${type}`}>{generationLabels[type]}</option>)}</optgroup><optgroup label="新闻与研究报告 · 可审核目录模板">{enabledCatalog.map((item) => <option key={item.code} value={`catalog:${item.code}`}>{item.code} · {item.label}</option>)}</optgroup></select>{selectedCatalog && <div className="mt-6 rounded-2xl border border-sky-200 bg-[#edf6ff] p-5"><div className="flex flex-wrap items-center gap-3 text-lg font-bold text-slate-900">当前目录：<span className="text-sky-600">{selectedCatalog.code} · {selectedCatalog.label}</span><CatalogBadge status={selectedStatus} /></div><p className="mt-3 leading-7 text-slate-600">{catalogEffect(selectedCatalog)} 该目录与通用模板使用同一个直接生成按钮；管理员点击后才会调用模型，结果只进入站内审核队列。</p></div>}<CountControl ariaLabel={selectedCatalog ? '目录生成数量' : '生成数量'} count={count} onChange={onChangeCount} queuedCount={queuedCount} /><button type="button" disabled={isDisabled} onClick={() => start()} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-[#3d93df] px-5 py-4 text-xl font-semibold text-white hover:bg-[#287fcc] disabled:cursor-not-allowed disabled:opacity-60">{pending ? <Loader2 className="h-6 w-6 animate-spin" /> : <BrainCircuit className="h-6 w-6" />}{pending ? '正在生成待审核草稿' : '开始 AI 生成'}</button>{selectedCatalog && <div className="mt-5 flex flex-wrap gap-3"><Link href={selectedCatalog.route} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50">打开 {selectedCatalog.code} 原功能</Link><button type="button" onClick={() => onClearCatalog()} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700"><span>返回通用模板</span></button></div>}</Panel>;
}

function GenerationProgress({ stage }: { stage: GenerationStage }) {
  if (stage === 'idle') return null;
  const detail: Record<Exclude<GenerationStage, 'idle'>, { label: string; tone: string; spinning?: boolean }> = {
    validating: { label: '正在校验目录模板与排队来源…', tone: 'border-sky-200 bg-sky-50 text-sky-800', spinning: true },
    generating: { label: '正在调用模型并写入待审核草稿…', tone: 'border-violet-200 bg-violet-50 text-violet-800', spinning: true },
    completed: { label: '任务已完成，草稿已进入审核队列。', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    empty: { label: '没有可处理的排队元数据；未调用模型，未创建草稿。', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
    failed: { label: '任务未完成；请查看任务日志中的真实错误，系统未写入替代文章。', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
  };
  const item = detail[stage];
  return <div role="status" className={`mt-5 flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold ${item.tone}`}>{item.spinning ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{item.label}</div>;
}

function CountControl({ ariaLabel, count, onChange, queuedCount }: { ariaLabel: string; count: number; onChange: (value: number) => void; queuedCount: number }) { return <><label className="mt-6 block text-xl font-semibold">生成数量</label><input aria-label={ariaLabel} type="number" min={1} max={10} value={count} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-xl font-semibold outline-none focus:border-blue-500" />{queuedCount > 0 ? <p className="mt-3 text-sm text-slate-500">待生成新闻：{queuedCount} 条；每次任务最多生成 10 条草稿。</p> : <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-slate-700"><div className="font-semibold text-slate-900">暂无可生成的排队来源元数据</div><p className="mt-1">同步采用 queued 模式的许可 RSS／Atom 来源后，条目将留在此处供当前模板直接生成审核草稿；同步不会自动调用模型。</p><Link href="/admin/data-ingestion" className="mt-2 inline-flex font-semibold text-sky-700 hover:underline">前往数据采集并同步来源</Link></div>}</>; }

function CatalogManager({ settings, draftCount, onSelect }: { settings: { catalogCode: string; status: CatalogStatus }[]; draftCount: number; onSelect: (item: CatalogEntry) => void }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<'all' | CatalogGroup>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | CatalogStatus>('all');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [preview, setPreview] = useState<CatalogEntry | null>(null);
  const statusByCode = useMemo(() => new Map(settings.map((setting) => [setting.catalogCode, setting.status])), [settings]);
  const statusFor = (code: string): CatalogStatus => (statusByCode.get(code) ?? 'enabled') as CatalogStatus;
  const entries = useMemo(() => catalog.filter((item) => { const current = statusFor(item.code); const words = `${item.code} ${item.label}`.toLowerCase(); return (!search.trim() || words.includes(search.trim().toLowerCase())) && (group === 'all' || item.group === group) && (filterStatus === 'all' ? current !== 'deleted' : current === filterStatus); }), [search, group, filterStatus, settings]);
  const update = trpc.adminNewsIngestion.updateGenerationCatalogSettings.useMutation({ onSuccess: (result) => { toast.success(`已${catalogStatusLabels[result.status as CatalogStatus]} ${result.updatedCodes.length} 项目录配置；原新闻、研究、来源和审核记录未被删除。`); setSelectedCodes([]); void Promise.all([utils.adminNewsIngestion.listGenerationCatalogSettings.invalidate(), utils.adminNewsIngestion.listGenerationCatalogEvents.invalidate()]); }, onError: (error) => toast.error(`目录批量操作未完成：${error.message}`) });
  const allSelected = entries.length > 0 && entries.every((item) => selectedCodes.includes(item.code));
  const chooseAll = () => setSelectedCodes((current) => allSelected ? current.filter((code) => !entries.some((item) => item.code === code)) : [...new Set([...current, ...entries.map((item) => item.code)])]);
  const toggle = (code: string) => setSelectedCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  const bulk = (status: CatalogStatus) => { if (selectedCodes.length) update.mutate({ codes: selectedCodes as AdminAiGenerationCatalogCode[], status }); };
  return <Panel title="新闻与研究报告功能目录" icon={Workflow} action={<span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">{entries.length} / 28 项</span>}><div className="rounded-2xl bg-[#f5f8fc] p-4 leading-7 text-slate-600">已启用目录均可作为审核生成模板。批量“删除”只会从 AI生成目录隐藏该项；不会删除原新闻与研究模块、文章、来源或任务。</div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_170px_160px]"><label className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input aria-label="搜索生成类型" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索代码或名称，例如 BNEF、新闻" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:border-sky-500" /></label><select aria-label="生成类型分类筛选" value={group} onChange={(event) => setGroup(event.target.value as 'all' | CatalogGroup)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-sky-500"><option value="all">全部业务分类</option>{catalogGroups.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="生成类型状态筛选" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as 'all' | CatalogStatus)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-sky-500"><option value="all">全部可用项</option><option value="enabled">已启用</option><option value="disabled">已禁用</option><option value="deleted">已从目录删除</option></select></div><div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input aria-label="全选当前筛选结果" type="checkbox" checked={allSelected} onChange={chooseAll} className="h-4 w-4" />全选当前结果</label><span className="text-sm text-slate-500">已选 {selectedCodes.length} 项</span><button type="button" disabled={!selectedCodes.length} onClick={() => setSelectedCodes([])} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">清除选择</button><div className="ml-auto flex flex-wrap gap-2"><button type="button" disabled={!selectedCodes.length || update.isPending} onClick={() => bulk('enabled')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-45">批量启用</button><button type="button" disabled={!selectedCodes.length || update.isPending} onClick={() => bulk('disabled')} className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-45">批量禁用</button><button type="button" disabled={!selectedCodes.length || update.isPending} onClick={() => bulk('deleted')} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-45"><Trash2 className="h-4 w-4" />从目录删除</button></div></div>{!entries.length ? <Empty text="没有符合当前搜索与筛选条件的生成类型。可清空关键词，或切换至“已从目录删除”筛选以恢复被隐藏目录项。" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{entries.map((item) => { const itemStatus = statusFor(item.code); return <div key={item.code} data-testid="news-research-catalog-item" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-200"><div className="flex items-start gap-3"><input aria-label={`选择 ${item.code} ${item.label}`} type="checkbox" checked={selectedCodes.includes(item.code)} onChange={() => toggle(item.code)} className="mt-1 h-4 w-4" /><button type="button" onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap gap-x-2"><span className="font-mono text-lg font-bold text-amber-500">{item.code}</span><span className="font-semibold text-slate-800">{item.label}</span></div><div className="mt-1 text-xs text-slate-500">{item.group} · {item.mode}</div></button><CatalogBadge status={itemStatus} /></div><div className="mt-4 flex justify-end border-t border-slate-100 pt-3"><button type="button" aria-label={`预览 ${item.code}`} onClick={() => setPreview(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold"><Eye className="h-4 w-4 text-sky-500" />预览</button></div></div>; })}</div>}<div className="mt-5 border-t border-slate-200 pt-5 text-sm text-slate-500">“文件与资料”保留为原资源库入口，不计入本次 28 项生成类型目录。<Link href="/news-hub?tab=docs" className="ml-2 font-semibold text-sky-600 hover:underline">打开文件与资料</Link></div><CatalogPreview entry={preview} status={preview ? statusFor(preview.code) : 'enabled'} draftCount={draftCount} onOpenChange={(open) => { if (!open) setPreview(null); }} /></Panel>;
}

function CatalogPreview({ entry, status, draftCount, onOpenChange }: { entry: CatalogEntry | null; status: CatalogStatus; draftCount: number; onOpenChange: (open: boolean) => void }) { return <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-slate-200 bg-white text-slate-900"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-3 pr-8 text-2xl"><span className="font-mono text-amber-500">{entry?.code ?? '—'}</span><span>{entry?.label ?? '生成类型预览'}</span>{entry && <CatalogBadge status={status} />}</DialogTitle><DialogDescription className="pt-2 text-base leading-7 text-slate-600">此处展示后台目录配置与真实生成边界，不展示或预填充未经来源支持的新闻、研究、订阅或社交内容。</DialogDescription></DialogHeader>{entry && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><PreviewField label="目录分类" value={entry.group} /><PreviewField label="原模块形态" value={entry.mode} /><PreviewField label="AI 目录状态" value={catalogStatusLabels[status]} /><PreviewField label="可审核生成模板" value={generationLabels[getAdminAiGenerationTemplate(entry.code as AdminAiGenerationCatalogCode)]} /></div><div className="rounded-2xl border border-sky-100 bg-sky-50 p-5"><div className="text-sm font-bold text-sky-700">配置参数与生成效果</div><p className="mt-2 leading-7 text-slate-700">{catalogEffect(entry)}</p><p className="mt-3 text-sm leading-6 text-slate-600">当前站内审核队列共有 {draftCount} 条草稿，但未按该目录项预置或伪造生成效果示例。实际执行后，来源标题、有限摘要、分类、情绪与代码只会保存为待审核草稿，且不会自动发布。</p></div><div className="flex flex-wrap justify-end gap-3"><Link href={entry.route} className="rounded-xl bg-[#3d93df] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#287fcc]">打开 {entry.code} 原功能</Link><button type="button" onClick={() => onOpenChange(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"><X className="h-4 w-4" />关闭</button></div></div>}</DialogContent></Dialog>; }

function ModelPanel({ models, loading }: { models: any; loading: boolean }) {
  const utils = trpc.useUtils();
  const selectModel = trpc.adminNewsIngestion.setPreferredAiModel.useMutation({
    onSuccess: () => { toast.success('首选模型已保存；故障时将尝试其他实测可用模型。'); void utils.adminNewsIngestion.listModelStatus.invalidate(); },
    onError: (error) => toast.error(`模型设置未保存：${error.message}`),
  });
  const gatewayLabel: Record<string, string> = {
    connected: '模型目录已连接；生成能力以实际调用为准',
    unavailable: '已配置，但当前未连接成功',
    overridden: '已配置，但由现有 LLM_BASE_URL 优先接管',
    not_configured: '未配置',
  };
  const omni = models?.omniRoute;
  const omniLabel = omni?.status === 'connected'
    ? '已连接，模型目录已核验'
    : omni?.status === 'overridden'
      ? '已连接，但当前聊天路由由其他网关接管'
    : omni?.status === 'unavailable'
      ? '已配置，但当前不可达'
      : omni?.status === 'invalid_config'
        ? '配置格式无效'
        : omni?.status === 'missing_key'
          ? '缺少访问凭据'
          : '未配置';
  const quotaLabel = omni?.quotaStatus === 'available' ? '网关已返回可用状态' : omni?.quotaStatus === 'unknown' ? '额度由网关实时返回，当前未提供可核验数值' : '当前不可用';
  return <section className="mt-5"><Panel title="AI 模型运行状态" icon={BrainCircuit}>
    <div className="mb-5 grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-violet-700">OmniRoute 路由网关</div>
        <div className="mt-2 text-lg font-semibold text-slate-900">{omniLabel}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">默认优先网关：{models?.route === 'omniroute' ? 'OmniRoute' : models?.route === 'freellmapi' ? 'FreeLLMAPI' : models?.route === 'llm' ? '已配置模型网关' : '本地兼容接口'}；实际聊天会使用下方实测成功的模型路由，失败时切换备用。</p>
        <p className="mt-2 text-xs text-slate-500">实际生成验证通过：{models?.activeModelCount ?? 0} 个；目录条目不计入可用模型。深度参数透传：{omni?.supportsReasoningPassthrough ? '支持' : '待配置'}</p>
      </div>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-sky-700">可用额度状态</div>
        <div className="mt-2 text-lg font-semibold text-slate-900">{quotaLabel}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">系统不会伪造额度数字；只有网关返回可核验数据时才显示具体值。路由成功后，Ucheer AI 可使用网关实际提供的模型与回退能力。</p>
      </div>
    </div>
    <p className="mb-4 text-sm text-slate-600">当前 AI 网关：{gatewayLabel[models?.gateway ?? 'not_configured'] ?? '状态待核验'}。仅用于已有 AI 功能，不作为行情数据。</p>
    <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      本机独立模型：检测到 {models?.localRuntime?.detectedModelCount ?? 0} 个已安装模型；
      其中实际对话验证通过 {models?.localRuntime?.verifiedModelCount ?? 0} 个。
      {models?.localRuntime?.detectedModelCount ? '本地模型通过验证后，可在下方设为首选，故障时仍可切换其他验证通过的路由。' : '当前尚未检测到本地 Ollama 模型；无需伪装为自主 AI，安装并启动本地模型服务后自动验证。'}
    </p>
    {loading ? <Loading /> : !models?.models?.length ? <Empty text="没有通过实际对话验证的模型。请检查网关、密钥或额度；候选目录不会冒充可用模型。" /> : <div className="space-y-4">{models.models.map((model: any) => {
      const online = model.state === 'online';
      const statusLabel = online ? '在线' : model.state === 'needs_key' ? '需要 API Key' : model.state === 'needs_oauth' ? '需要 OAuth' : model.state === 'candidate' ? '候选，未核验' : '待配置';
      const statusClass = online ? 'bg-emerald-50 text-emerald-600' : model.state === 'needs_key' || model.state === 'needs_oauth' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500';
      return <div key={`${model.provider ?? 'model'}:${model.id}`} className="grid gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-3"><span className={`h-3.5 w-3.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} /><h3 className="text-xl font-semibold text-slate-800">{model.id}</h3><span className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600">{model.provider}</span>{model.tier && <span className="rounded-lg border-violet-200 bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">{model.tier}</span>}{model.modality && <span className="rounded-lg border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-semibold text-cyan-700">{model.modality}</span>}</div><p className="mt-2 text-slate-600">{model.note} {model.verifiedAt ? `验证时间：${new Date(model.verifiedAt).toLocaleString()}` : ''}</p></div><button type="button" disabled={selectModel.isPending || models.preferredModel === model.id} onClick={() => selectModel.mutate({ model: model.id })} className={`self-center rounded-lg px-3 py-1.5 font-semibold ${statusClass} disabled:opacity-60`}>{models.preferredModel === model.id ? '当前首选' : `${statusLabel} · 设为首选`}</button></div>;
    })}</div>}
  </Panel></section>;
}

function TaskPanel({ tasks, loading, completed, generated, onRefresh }: { tasks: any[]; loading: boolean; completed: number; generated: number; onRefresh: () => void }) { return <section className="mt-5"><Panel title="AI 任务日志" icon={ClipboardList} action={<button type="button" onClick={onRefresh} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600">刷新</button>}><div className="mb-5 grid gap-4 sm:grid-cols-3"><MiniMetric label="近期任务" value={tasks.length} /><MiniMetric label="已完成任务" value={completed} tone="text-emerald-500" /><MiniMetric label="实际草稿" value={generated} tone="text-blue-500" /></div>{loading ? <Loading /> : !tasks.length ? <Empty text="尚无 AI 生成任务。只有管理员发起且有已排队新闻元数据时，任务才会写入此处。" /> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="border-b text-sm text-slate-500"><tr><th className="px-4 py-4">时间</th><th className="px-4 py-4">目录</th><th className="px-4 py-4">生成类型</th><th className="px-4 py-4">状态</th><th className="px-4 py-4">处理 / 生成</th><th className="px-4 py-4">说明</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b border-slate-100 text-slate-700"><td className="px-4 py-4">{formatTime(task.createdAt)}</td><td className="px-4 py-4 font-mono text-sm font-semibold">{task.catalogCode ?? '通用'}</td><td className="px-4 py-4 font-semibold">{generationLabels[task.generationType as GenerationType]}</td><td className="px-4 py-4">{task.status}</td><td className="px-4 py-4">{task.processedCount} / {task.generatedCount}</td><td className="max-w-md px-4 py-4 text-sm text-slate-500">{task.error ?? task.detail ?? '—'}</td></tr>)}</tbody></table></div>}</Panel></section>; }

function Metric({ label, value, detail, icon: Icon, accent = 'text-slate-950' }: { label: string; value: React.ReactNode; detail: string; icon: React.ElementType; accent?: string }) { return <div className="rounded-[26px] border border-white/80 bg-[#fbfdff] p-7 shadow-[0_16px_40px_rgba(20,40,75,.12)]"><div className="flex items-center gap-3 text-[20px] font-semibold text-slate-700"><Icon className="h-6 w-6 text-sky-500" />{label}</div><div className={`mt-4 text-[44px] font-bold leading-none ${accent}`}>{value}</div><p className="mt-4 text-[17px] text-slate-600">{detail}</p></div>; }
function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex shrink-0 items-center gap-3 rounded-[15px] px-7 py-3 text-lg font-bold ${active ? 'bg-white text-slate-950 shadow-[0_2px_8px_rgba(15,23,42,.16)]' : 'text-slate-800 hover:bg-white/60'}`}><Icon className="h-5 w-5" />{label}</button>; }
function Panel({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) { return <div className="rounded-[28px] border border-white/80 bg-[#fcfdff] p-7 shadow-[0_16px_40px_rgba(20,40,75,.13)]"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3 text-2xl font-bold text-slate-900"><Icon className="h-7 w-7 text-sky-500" />{title}</div>{action}</div><div className="mt-7">{children}</div></div>; }
function QuickAction({ icon: Icon, label, pending, disabled = false, onClick }: { icon: React.ElementType; label: string; pending: boolean; disabled?: boolean; onClick: () => void }) { return <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-4 text-xl font-semibold text-slate-800"><Icon className="h-6 w-6 text-blue-500" />{label}</div><button type="button" disabled={pending || disabled} onClick={onClick} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-lg font-semibold disabled:opacity-60"><Play className="h-5 w-5" />执行</button></div>; }
function PreviewField({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 font-semibold text-slate-800">{value}</div></div>; }
function MiniMetric({ label, value, tone = 'text-slate-950' }: { label: string; value: number; tone?: string }) { return <div className="rounded-xl bg-[#f4f7fb] px-5 py-4"><div className="text-sm font-semibold text-slate-500">{label}</div><div className={`mt-2 text-3xl font-bold ${tone}`}>{value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-[#f8fafc] px-5 py-10 text-center leading-7 text-slate-500">{text}</div>; }
function Loading() { return <div className="flex items-center gap-3 rounded-2xl bg-[#f8fafc] px-5 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />正在读取站内记录…</div>; }
