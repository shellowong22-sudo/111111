import React, { FormEvent, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  FileText,
  Globe2,
  History,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MarketApiProviderConfig } from "@/components/admin/MarketApiProviderConfig";

const intervals = [1, 5, 10, 30, 60] as const;
type Interval = (typeof intervals)[number];
type Tab = "monitor" | "control" | "sources" | "logs" | "tools";
const intervalLabel = (minutes: Interval) =>
  ({
    1: "1 分钟",
    5: "5 分钟",
    10: "10 分钟",
    30: "30 分钟",
    60: "1 小时",
  })[minutes];
const cronIntervalLabel = (cron?: string | null) =>
  ({
    "0 * * * * *": "每 1 分钟",
    "0 */5 * * * *": "每 5 分钟",
    "0 */10 * * * *": "每 10 分钟",
    "0 */30 * * * *": "每 30 分钟",
    "0 0 * * * *": "每 1 小时",
  })[cron ?? ""] ?? (cron ? `计划 ${cron}` : "未配置计划");
const formatDate = (value?: Date | string | null) =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "从未";
const sourceStatus = (status: string) =>
  status === "available"
    ? "在线"
    : status === "unavailable"
      ? "不可用"
      : "待验证";
const sourceTone = (status: string) =>
  status === "available"
    ? "bg-emerald-50 text-emerald-600"
    : status === "unavailable"
      ? "bg-rose-50 text-rose-600"
      : "bg-slate-100 text-slate-500";

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  accent = "text-slate-900",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[20px] bg-[#f6f9fc] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,.85)]">
      <div className="flex items-center gap-3 text-[18px] font-semibold text-slate-700">
        <Icon className="h-5 w-5 text-slate-600" />
        {label}
      </div>
      <div
        className={`mt-3 text-[30px] font-bold leading-none tracking-tight ${accent}`}
      >
        {value}
      </div>
      <p className="mt-2 text-[16px] font-medium text-slate-600">{detail}</p>
    </div>
  );
}

export default function AdminDataIngestion() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("monitor");
  const [interval, setInterval] = useState<Interval>(5);
  const [manualCount, setManualCount] = useState(5);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [logMode, setLogMode] = useState<"audit" | "articles">("audit");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(
    "尚未发起采集操作。所有状态均来自已保存的站内记录。"
  );
  const [form, setForm] = useState({
    name: "",
    websiteUrl: "",
    feedUrl: "",
    maxItemsPerRun: 5,
    processingMode: "queued" as "queued" | "immediate",
    isActive: true,
  });
  const scheduleRequiresPublish = import.meta.env.MODE !== "production";
  const sourcesQuery = trpc.adminNewsIngestion.listSources.useQuery();
  const analyticsQuery = trpc.adminNewsIngestion.getAnalytics.useQuery();
  const auditQuery = trpc.adminNewsIngestion.listAuditEvents.useQuery({
    limit: 50,
  });
  const articlesQuery = trpc.adminNewsIngestion.listArticles.useQuery({
    status: "all",
    limit: 50,
  });
  const targetsQuery = trpc.adminMarketIngestion.listTargets.useQuery();
  const marketEventsQuery = trpc.adminMarketIngestion.listEvents.useQuery({
    limit: 16,
  });
  // Keep the existing admin page test harness and older preview bundles usable
  // while the new endpoint rolls out; production always exposes this query.
  const marketHistoryQuery =
    trpc.adminMarketIngestion.listObservationHistory?.useQuery?.({
      limit: 20,
    }) ?? { data: [], isLoading: false };
  const sources = sourcesQuery.data ?? [];
  const audits = auditQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const analytics = analyticsQuery.data as
    | { totalDrafts?: number; totalPublished?: number }
    | undefined;
  const activeSources = sources.filter(source => source.isActive);
  const onlineSources = sources.filter(
    source => source.lastStatus === "available"
  );
  const lastFetchedAt = sources
    .map(source => source.lastFetchedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
  const syncActions = audits.filter(event => event.action === "sync_completed");
  const sourceName = (id: number | null | undefined) =>
    sources.find(source => source.id === id)?.name ??
    (id ? `来源 #${id}` : "系统");
  const filteredAudits = audits.filter(
    event =>
      (sourceFilter === "all" || String(event.sourceId) === sourceFilter) &&
      (statusFilter === "all" ||
        (statusFilter === "success"
          ? event.action !== "draft_failed"
          : event.action === "draft_failed"))
  );
  const refresh = () =>
    Promise.all([
      utils.adminNewsIngestion.listSources.invalidate(),
      utils.adminNewsIngestion.getAnalytics.invalidate(),
      utils.adminNewsIngestion.listAuditEvents.invalidate(),
      utils.adminNewsIngestion.listArticles.invalidate(),
      utils.adminMarketIngestion.listTargets.invalidate(),
      utils.adminMarketIngestion.listEvents.invalidate(),
      utils.adminMarketIngestion.providerCatalog?.invalidate?.() ??
        Promise.resolve(),
      utils.adminMarketIngestion.listProviderConfigs?.invalidate?.() ??
        Promise.resolve(),
      utils.adminMarketIngestion.listObservationHistory?.invalidate?.() ??
        Promise.resolve(),
    ]);
  const pending =
    sourcesQuery.isLoading || auditQuery.isLoading || articlesQuery.isLoading;
  const syncNews = trpc.adminNewsIngestion.syncSource.useMutation({
    onSuccess: data => {
      const text =
        data.status === "available"
          ? `采集完成：新增 ${data.queued} 条，已处理 ${data.processed} 条，草稿 ${data.drafted} 条，待处理 ${data.waiting} 条。`
          : `采集未完成：${data.reason ?? "未返回可验证公开订阅数据"}`;
      setFeedback(text);
      data.status === "available" ? toast.success(text) : toast.error(text);
      void refresh();
    },
    onError: error => {
      setFeedback(`采集请求失败：${error.message}`);
      toast.error(error.message);
    },
  });
  const setActive = trpc.adminNewsIngestion.setSourceActive.useMutation({
    onSuccess: data => {
      const text = data.isActive ? "来源已启用。" : "来源已暂停。";
      setFeedback(text);
      toast.success(text);
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const deleteSource = trpc.adminNewsIngestion.deleteSource.useMutation({
    onSuccess: () => {
      setFeedback("来源配置已删除；历史审计记录仍保留。");
      setConfirmDeleteId(null);
      toast.success("来源配置已删除。");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const createSource = trpc.adminNewsIngestion.createSource.useMutation({
    onSuccess: ({ sourceId, existed }) => {
      const text = existed
        ? "该公开来源已存在，已保留原配置。"
        : "爬取源已添加，等待首次按需采集。";
      setFeedback(text);
      toast.success(text);
      setFormOpen(false);
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const updateSource = trpc.adminNewsIngestion.updateSource.useMutation({
    onSuccess: () => {
      setFeedback("爬取源配置已更新。");
      setFormOpen(false);
      setEditing(null);
      toast.success("爬取源配置已更新。");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const enableSchedule = trpc.adminNewsIngestion.enableSchedule.useMutation({
    onSuccess: () => {
      setFeedback(`定时任务已启用：每 ${intervalLabel(interval)}。`);
      toast.success("定时任务已启用。");
      void refresh();
    },
    onError: () => {
      const text =
        "计划未启动：该操作只能在成功发布后的生产部署中执行。开发预览可使用“立即爬取”。";
      setFeedback(text);
      toast.error(text);
    },
  });
  const pauseSchedule = trpc.adminNewsIngestion.pauseSchedule.useMutation({
    onSuccess: () => {
      setFeedback("定时任务已暂停。");
      toast.success("定时任务已暂停。");
      void refresh();
    },
    onError: error => toast.error(error.message),
  });
  const busy =
    syncNews.isPending ||
    setActive.isPending ||
    deleteSource.isPending ||
    createSource.isPending ||
    updateSource.isPending ||
    enableSchedule.isPending ||
    pauseSchedule.isPending;
  const scheduleBusy = enableSchedule.isPending || pauseSchedule.isPending;
  const openAdd = (preset?: {
    name: string;
    websiteUrl: string;
    feedUrl?: string;
  }) => {
    setEditing(null);
    setForm({
      name: preset?.name ?? "",
      websiteUrl: preset?.websiteUrl ?? "",
      feedUrl: preset?.feedUrl ?? "",
      maxItemsPerRun: 5,
      processingMode: "queued",
      isActive: true,
    });
    setFormOpen(true);
  };
  const openEdit = (source: any) => {
    setEditing(source);
    setForm({
      name: source.name,
      websiteUrl: source.sourceUrl,
      feedUrl: source.feedUrl,
      maxItemsPerRun: source.maxItemsPerRun,
      processingMode: source.processingMode,
      isActive: source.isActive,
    });
    setFormOpen(true);
  };
  const submitSource = (event: FormEvent) => {
    event.preventDefault();
    if (editing)
      updateSource.mutate({
        id: editing.id,
        name: form.name,
        provider: form.name,
        feedUrl: form.feedUrl || editing.feedUrl,
        sourceUrl: form.websiteUrl,
        maxItemsPerRun: form.maxItemsPerRun,
        processingMode: form.processingMode,
        isActive: form.isActive,
      });
    else
      createSource.mutate({
        name: form.name,
        websiteUrl: form.websiteUrl,
        feedUrl: form.feedUrl || undefined,
        maxItemsPerRun: form.maxItemsPerRun,
        processingMode: form.processingMode,
        isActive: form.isActive,
      });
  };
  const runSelected = () => {
    const source = activeSources[0];
    if (!source) {
      const text = "没有已启用的爬取源；请先在“爬取源管理”中添加或启用来源。";
      setFeedback(text);
      toast.error(text);
      return;
    }
    syncNews.mutate({ sourceId: source.id, maxItemsPerRun: manualCount });
  };
  const nav = [
    { id: "monitor", label: "数据源监控", icon: Activity },
    { id: "control", label: "采集控制", icon: Clock },
    { id: "sources", label: "爬取源管理", icon: SlidersHorizontal },
    { id: "logs", label: "爬取日志", icon: History },
    { id: "tools", label: "工具箱", icon: Zap },
  ] as const;
  const panel =
    "rounded-[27px] border border-slate-200/90 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.14)]";

  return (
    <main className="min-h-screen bg-[#02081d] px-3 py-5 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1510px]">
        <header className="mb-11">
          <p className="text-sm font-medium tracking-wide text-slate-400">
            按需采集公开金融资讯，经 AI
            改写后可进入人工审核，支持多源配置与采集记录审阅
          </p>
        </header>
        <nav
          aria-label="AI 数据采集功能导航"
          className="mb-11 grid grid-cols-2 gap-1 rounded-[23px] bg-[#edf2f8] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,.22)] sm:grid-cols-5"
        >
          {nav.map(item => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-[16px] px-3 text-[17px] font-bold transition-all ${active ? "bg-white text-slate-950 shadow-[0_2px_8px_rgba(15,23,42,.16)]" : "text-slate-900 hover:bg-white/55"}`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div
          aria-live="polite"
          className="mb-5 flex items-start gap-2 rounded-2xl border border-sky-200/30 bg-sky-100/10 px-4 py-3 text-sm text-sky-100"
        >
          <Activity
            className={`mt-0.5 h-4 w-4 shrink-0 ${busy ? "animate-pulse" : ""}`}
          />
          <span>
            {busy
              ? "请求处理中：正在读取或提交站内采集记录，请勿重复操作。"
              : feedback}
          </span>
        </div>

        {tab === "monitor" && (
          <section className={panel}>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-sky-500" />
                <h1 className="text-[25px] font-bold tracking-tight">
                  数据源可视化监控
                </h1>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                  读取保存状态
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => void refresh()}
                disabled={busy}
                className="text-base font-bold hover:bg-slate-100"
              >
                <RefreshCw
                  className={`mr-2 h-5 w-5 ${busy ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Activity}
                label="定时任务"
                value={
                  sources.some(source => source.scheduleEnabled)
                    ? "已启用"
                    : "已停止"
                }
                detail={
                  sources.some(source => source.scheduleEnabled)
                    ? Array.from(
                        new Set(
                          sources
                            .filter(source => source.scheduleEnabled)
                            .map(source => cronIntervalLabel(source.scheduleCronExpression))
                        )
                      ).join("、")
                    : "没有运行中的计划"
                }
                accent={
                  sources.some(source => source.scheduleEnabled)
                    ? "text-emerald-600"
                    : "text-slate-950"
                }
              />
              <StatCard
                icon={Activity}
                label="今日采集"
                value={`${syncActions.length} 次`}
                detail={`${onlineSources.length}/${sources.length || 0} 源在线`}
              />
              <StatCard
                icon={CheckCircle2}
                label="近期成功率"
                value={
                  sources.length
                    ? `${Math.round((onlineSources.length / sources.length) * 100)}%`
                    : "—"
                }
                detail={`近 ${syncActions.length} 次可查同步`}
                accent="text-emerald-500"
              />
              <StatCard
                icon={Clock}
                label="上次更新"
                value={formatDate(lastFetchedAt)}
                detail={lastFetchedAt ? "来自已保存来源记录" : "暂无记录"}
              />
            </div>
            <div className="mt-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe2 className="h-7 w-7 text-sky-500" />
                <h2 className="text-[23px] font-bold">数据源维度监控</h2>
              </div>
              <Button
                variant="ghost"
                onClick={() => void refresh()}
                disabled={busy}
                className="text-base font-bold"
              >
                <RefreshCw
                  className={`mr-2 h-5 w-5 ${busy ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              {sourcesQuery.isLoading ? (
                <div className="col-span-full flex items-center gap-2 py-10 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  读取数据源状态…
                </div>
              ) : !sources.length ? (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                  暂无配置数据源。请前往“爬取源管理”添加许可的公开来源。
                </div>
              ) : (
                sources.slice(0, 6).map(source => (
                  <article
                    key={source.id}
                    className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[21px] font-bold">
                          {source.name}
                        </h3>
                        <p className="mt-2 truncate text-sm text-slate-600">
                          {source.provider}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-bold ${sourceTone(source.lastStatus)}`}
                      >
                        <i className="h-2.5 w-2.5 rounded-full bg-current" />
                        {sourceStatus(source.lastStatus)}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 px-2 py-3">
                        <strong className="block text-xl">
                          {source.maxItemsPerRun}
                        </strong>
                        <span className="text-xs text-slate-600">每次上限</span>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-3">
                        <strong className="block text-xl">
                          {source.scheduleEnabled
                            ? "已启用"
                            : source.scheduleCronTaskUid
                              ? "已暂停"
                              : "—"}
                        </strong>
                        <span className="text-xs text-slate-600">计划</span>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-3">
                        <strong className="block text-xl">
                          {source.lastFetchedAt
                            ? formatDate(source.lastFetchedAt)
                            : "—"}
                        </strong>
                        <span className="text-xs text-slate-600">更新</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-300 font-semibold"
                        disabled={busy}
                        onClick={() =>
                          setActive.mutate({
                            id: source.id,
                            isActive: !source.isActive,
                          })
                        }
                      >
                        {source.isActive ? (
                          <Pause className="mr-2 h-4 w-4" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {source.isActive ? "暂停来源" : "启用来源"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-300 font-semibold"
                        disabled={busy}
                        onClick={() => syncNews.mutate({ sourceId: source.id })}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重新抓取
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-300 font-semibold"
                        disabled={busy || scheduleRequiresPublish}
                        onClick={() =>
                          source.scheduleEnabled
                            ? pauseSchedule.mutate({ sourceId: source.id })
                            : enableSchedule.mutate({
                                sourceId: source.id,
                                intervalMinutes: interval,
                              })
                        }
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {source.scheduleEnabled
                          ? "暂停计划"
                          : `启用${intervalLabel(interval)}计划`}
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {tab === "control" && (
          <section className={panel}>
            <div className="mb-8 flex items-center gap-3">
              <Clock className="h-8 w-8 text-sky-500" />
              <h1 className="text-[25px] font-bold">手动采集控制</h1>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                请求驱动模式
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <StatCard
                icon={Clock}
                label="爬取间隔"
                value={
                  sources.some(source => source.scheduleCronTaskUid)
                    ? `每 ${intervalLabel(interval)}`
                    : "按需执行"
                }
                detail={
                  scheduleRequiresPublish
                    ? "预览环境不能启动计划"
                    : "发布后可启用计划"
                }
              />
              <StatCard
                icon={History}
                label="上次爬取"
                value={formatDate(lastFetchedAt)}
                detail={`${syncActions.length} 次可查同步`}
              />
              <StatCard
                icon={FileText}
                label="累计采集"
                value={`${analytics?.totalDrafts ?? 0} 篇`}
                detail="待审核草稿"
              />
            </div>
            <p className="mt-8 text-base font-semibold text-slate-700">
              当前预览环境不会维持进程内定时任务；发布后可使用托管计划任务配置周期采集。
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 border-l-2 border-slate-200 pl-5">
              <label className="flex items-center gap-3 text-xl font-bold">
                手动爬取数量：
                <Input
                  aria-label="手动爬取数量"
                  type="number"
                  min={1}
                  max={50}
                  value={manualCount}
                  onChange={event =>
                    setManualCount(
                      Math.max(1, Math.min(50, Number(event.target.value) || 1))
                    )
                  }
                  className="h-14 w-32 border-slate-300 text-center text-xl"
                />
              </label>
              <button
                type="button"
                disabled
                className="flex items-center gap-2 text-lg font-bold text-slate-500"
              >
                <span className="relative h-8 w-14 rounded-full bg-slate-300">
                  <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow" />
                </span>
                人工审核发布
              </button>
              <Button
                disabled={busy}
                onClick={runSelected}
                className="h-14 rounded-xl bg-sky-500 px-7 text-lg font-bold text-white hover:bg-sky-600"
              >
                <Globe2 className="mr-2 h-5 w-5" />
                立即爬取
              </Button>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              “立即爬取”对首个已启用来源执行一次真实公开订阅同步。自动发布不可用：所有文章均须经人工审核后才可在本站发布。
            </p>
          </section>
        )}

        {tab === "sources" && (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-base font-medium text-slate-300">
                管理多个金融资讯来源；仅允许公开 HTTPS
                订阅或经允许的接口元数据。
              </p>
              <Button
                onClick={() => openAdd()}
                className="h-12 rounded-xl bg-sky-500 px-5 text-base font-bold text-white hover:bg-sky-600"
              >
                <Plus className="mr-2 h-5 w-5" />
                添加爬取源
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {sourcesQuery.isLoading ? (
                <div className="col-span-full rounded-3xl bg-white p-10 text-slate-500">
                  <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                  读取爬取源…
                </div>
              ) : !sources.length ? (
                <div className="col-span-full rounded-3xl bg-white p-10 text-center text-slate-500">
                  暂无爬取源。请添加许可的公开网站或 RSS/Atom 地址。
                </div>
              ) : (
                sources.map(source => (
                  <article
                    key={source.id}
                    className="rounded-[23px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,.12)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-500">
                            {source.provider}
                          </span>
                          <h2 className="text-[21px] font-bold">
                            {source.name}
                          </h2>
                        </div>
                        <p className="mt-4 truncate text-sm font-medium text-slate-600">
                          ↗ {source.feedUrl}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          间隔：
                          {source.scheduleEnabled
                            ? cronIntervalLabel(source.scheduleCronExpression)
                            : source.scheduleCronTaskUid
                              ? "计划已暂停"
                              : "按需"}
                          　每次：{source.maxItemsPerRun} 篇　
                          {source.processingMode === "immediate"
                            ? "全量即时处理"
                            : "稳定队列"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`${source.name} 启停`}
                        disabled={busy}
                        onClick={() =>
                          setActive.mutate({
                            id: source.id,
                            isActive: !source.isActive,
                          })
                        }
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${source.isActive ? "bg-sky-500" : "bg-slate-300"}`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${source.isActive ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        disabled={scheduleBusy || scheduleRequiresPublish}
                        onClick={() =>
                          source.scheduleEnabled
                            ? pauseSchedule.mutate({ sourceId: source.id })
                            : enableSchedule.mutate({
                                sourceId: source.id,
                                intervalMinutes: interval,
                              })
                        }
                        className="border-sky-300 font-bold text-sky-700"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {source.scheduleEnabled
                          ? `暂停${cronIntervalLabel(source.scheduleCronExpression)}`
                          : `启用${intervalLabel(interval)}计划`}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openEdit(source)}
                        className="border-slate-300 font-bold"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                      {confirmDeleteId === source.id ? (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => deleteSource.mutate({ id: source.id })}
                          className="border-rose-300 bg-rose-50 font-bold text-rose-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          确认删除
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setConfirmDeleteId(source.id)}
                          className="border-rose-200 font-bold text-rose-500"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => syncNews.mutate({ sourceId: source.id })}
                        className="border-slate-300 font-bold"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重新抓取
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <section className="mt-6 rounded-[22px] bg-white p-6">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-bold">快速添加预设源</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    openAdd({
                      name: "新浪财经",
                      websiteUrl: "https://finance.sina.com.cn/",
                      feedUrl:
                        "https://rss.sina.com.cn/roll/finance/hot_roll.xml",
                    })
                  }
                >
                  新浪财经
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    openAdd({ name: "自定义公开来源", websiteUrl: "" })
                  }
                >
                  自定义来源
                </Button>
              </div>
            </section>
          </section>
        )}

        {tab === "logs" && (
          <section>
            <div className="mb-6 inline-flex rounded-2xl bg-[#edf2f8] p-1.5 shadow">
              <button
                type="button"
                onClick={() => setLogMode("audit")}
                className={`rounded-xl px-5 py-3 text-xl font-bold ${logMode === "audit" ? "bg-white shadow" : "text-slate-600"}`}
              >
                <History className="mr-2 inline h-5 w-5" />
                爬取日志
              </button>
              <button
                type="button"
                onClick={() => setLogMode("articles")}
                className={`rounded-xl px-5 py-3 text-xl font-bold ${logMode === "articles" ? "bg-white shadow" : "text-slate-600"}`}
              >
                <FileText className="mr-2 inline h-5 w-5" />
                已抓取文章 · AI审核
              </button>
            </div>
            {logMode === "audit" ? (
              <>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    icon={History}
                    label="总爬取次数"
                    value={syncActions.length}
                    detail="已保存的同步完成事件"
                  />
                  <StatCard
                    icon={CheckCircle2}
                    label="成功次数"
                    value={
                      syncActions.filter(
                        event => event.action !== "draft_failed"
                      ).length
                    }
                    detail="不含草稿失败"
                    accent="text-emerald-500"
                  />
                  <StatCard
                    icon={CircleAlert}
                    label="失败次数"
                    value={
                      audits.filter(event => event.action === "draft_failed")
                        .length
                    }
                    detail="已记录的草稿失败"
                    accent="text-rose-500"
                  />
                  <StatCard
                    icon={FileText}
                    label="总导入文章"
                    value={analytics?.totalDrafts ?? 0}
                    detail="当前待审核草稿"
                    accent="text-sky-500"
                  />
                </div>
                <div className={`${panel} mt-7`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="text-xl font-bold">
                      爬取源：
                      <select
                        aria-label="爬取源筛选"
                        value={sourceFilter}
                        onChange={event => setSourceFilter(event.target.value)}
                        className="ml-2 h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold"
                      >
                        <option value="all">全部</option>
                        {sources.map(source => (
                          <option key={source.id} value={String(source.id)}>
                            {source.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xl font-bold">
                      状态：
                      <select
                        aria-label="状态筛选"
                        value={statusFilter}
                        onChange={event => setStatusFilter(event.target.value)}
                        className="ml-2 h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold"
                      >
                        <option value="all">全部</option>
                        <option value="success">成功</option>
                        <option value="failed">失败</option>
                      </select>
                    </label>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSourceFilter("all");
                        setStatusFilter("all");
                      }}
                      className="h-12 border-slate-300 text-lg font-bold"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      重置
                    </Button>
                  </div>
                </div>
                <div className={`${panel} mt-7 overflow-x-auto p-0`}>
                  <table className="min-w-[960px] w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50 text-lg">
                      <tr>
                        <th className="px-5 py-5">时间</th>
                        <th className="px-5 py-5">爬取源</th>
                        <th className="px-5 py-5">状态</th>
                        <th className="px-5 py-5">发现</th>
                        <th className="px-5 py-5">导入</th>
                        <th className="px-5 py-5">耗时</th>
                        <th className="px-5 py-5">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditQuery.isLoading ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-5 py-10 text-center text-slate-500"
                          >
                            正在读取真实爬取日志…
                          </td>
                        </tr>
                      ) : (
                        filteredAudits.map(event => {
                          const failed = event.action === "draft_failed";
                          return (
                            <tr
                              key={event.id}
                              className="border-b border-slate-200 text-base"
                            >
                              <td className="px-5 py-5 text-slate-600">
                                {formatDate(event.createdAt)}
                              </td>
                              <td className="px-5 py-5">
                                <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold">
                                  {sourceName(event.sourceId)}
                                </span>
                              </td>
                              <td className="px-5 py-5">
                                <span
                                  className={`rounded-md px-2.5 py-1 font-bold ${failed ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"}`}
                                >
                                  {failed ? "失败" : "成功"}
                                </span>
                              </td>
                              <td className="px-5 py-5">—</td>
                              <td className="px-5 py-5">—</td>
                              <td className="px-5 py-5">—</td>
                              <td className="px-5 py-5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFeedback(
                                      event.detail ?? "该日志无附加详情。"
                                    );
                                    toast.info(
                                      event.detail ?? "该日志无附加详情。"
                                    );
                                  }}
                                  className="font-bold text-slate-700"
                                >
                                  ⓘ 详情
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {!auditQuery.isLoading && !filteredAudits.length && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-5 py-12 text-center text-slate-500"
                          >
                            暂无匹配的真实爬取日志。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <section className={panel}>
                <h1 className="text-2xl font-bold">已抓取文章 · AI审核</h1>
                <p className="mt-2 text-slate-600">
                  仅展示已保存的标题、有限摘要与审核状态；不复制来源网页全文。
                </p>
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-[850px] w-full text-left">
                    <thead className="border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-3 py-3">来源</th>
                        <th className="px-3 py-3">标题</th>
                        <th className="px-3 py-3">状态</th>
                        <th className="px-3 py-3">更新时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articlesQuery.data?.map(article => (
                        <tr
                          key={article.id}
                          className="border-b border-slate-100"
                        >
                          <td className="px-3 py-4">
                            {sourceName(article.sourceId)}
                          </td>
                          <td className="max-w-xl truncate px-3 py-4">
                            {article.aiTitle ?? article.sourceHeadline}
                          </td>
                          <td className="px-3 py-4">{article.status}</td>
                          <td className="px-3 py-4">
                            {formatDate(article.updatedAt)}
                          </td>
                        </tr>
                      ))}
                      {!articlesQuery.isLoading &&
                        !articlesQuery.data?.length && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-10 text-center text-slate-500"
                            >
                              暂无已抓取文章。
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>
        )}

        {tab === "tools" && (
          <section>
            <div className="grid gap-6 xl:grid-cols-2">
              <section className={panel}>
                <div className="flex items-center gap-3">
                  <Globe2 className="h-8 w-8 text-sky-500" />
                  <h1 className="text-[25px] font-bold">手动文章爬取</h1>
                </div>
                <div className="mt-10 rounded-2xl bg-sky-50 p-6 text-sky-700">
                  <strong className="text-xl">
                    数据来源：{activeSources[0]?.name ?? "未选择来源"}
                  </strong>
                  <p className="mt-4 text-xl font-medium">
                    只读取公开订阅元数据，经 AI 改写后进入人工审核。
                  </p>
                </div>
                <label className="mt-7 block text-xl font-bold">
                  采集数量：{manualCount} 篇
                  <input
                    aria-label="工具箱采集数量"
                    className="mt-3 block w-full accent-sky-500"
                    type="range"
                    min={1}
                    max={50}
                    value={manualCount}
                    onChange={event =>
                      setManualCount(Number(event.target.value))
                    }
                  />
                </label>
                <Button
                  disabled={busy}
                  onClick={runSelected}
                  className="mt-10 h-16 w-full rounded-xl bg-sky-500 text-xl font-bold hover:bg-sky-600"
                >
                  <Globe2 className="mr-3 h-6 w-6" />
                  开始采集
                </Button>
              </section>
              <section className={panel}>
                <div className="flex items-center gap-3">
                  <Zap className="h-8 w-8 text-amber-500" />
                  <h1 className="text-[25px] font-bold">AI 草稿生成</h1>
                </div>
                <div className="mt-10 rounded-2xl bg-amber-50 p-6 text-amber-700">
                  <strong className="text-xl">基于已许可的来源元数据</strong>
                  <p className="mt-4 text-xl font-medium">
                    AI
                    仅生成待审核草稿，不会虚构文章、研报、课程或实时金融事实。
                  </p>
                </div>
                <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                  <StatCard
                    icon={FileText}
                    label="文章草稿"
                    value={analytics?.totalDrafts ?? 0}
                    detail="当前记录"
                  />
                  <StatCard
                    icon={Bot}
                    label="待审核"
                    value={analytics?.totalDrafts ?? 0}
                    detail="须人工处理"
                  />
                  <StatCard
                    icon={CheckCircle2}
                    label="已发布"
                    value={analytics?.totalPublished ?? 0}
                    detail="站内发布"
                  />
                </div>
                <Button
                  disabled={busy}
                  onClick={runSelected}
                  className="mt-10 h-16 w-full rounded-xl bg-amber-500 text-xl font-bold text-white hover:bg-amber-600"
                >
                  <Zap className="mr-3 h-6 w-6" />
                  生成待审核草稿
                </Button>
              </section>
            </div>
            <section className={`${panel} mt-7`}>
              <div className="flex items-center gap-3">
                <Database className="h-7 w-7 text-slate-700" />
                <h2 className="text-2xl font-bold">数据库状态</h2>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={FileText}
                  label="文章数据"
                  value={analytics?.totalDrafts ?? 0}
                  detail="包含草稿、审核与发布状态"
                />
                <StatCard
                  icon={Globe2}
                  label="数据源数据"
                  value={sources.length}
                  detail="已配置公开来源"
                />
                <StatCard
                  icon={Settings2}
                  label="投资标的数据"
                  value={targets.length}
                  detail="公共日频目标"
                />
                <StatCard
                  icon={Database}
                  label="采集审计"
                  value={(marketEventsQuery.data?.length ?? 0) + audits.length}
                  detail="保留真实操作记录"
                />
              </div>
            </section>
            <section className={`${panel} mt-7`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">永久行情观测账本</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    后端清洗后的日频 OHLCV
                    版本记录；同一模块、契约、标的、观察日和指纹不会重复写入。
                  </p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  {marketHistoryQuery.data?.length ?? 0} 条最近记录
                </span>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-[850px] w-full text-left">
                  <thead className="border-b border-slate-200 text-sm text-slate-500">
                    <tr>
                      <th className="px-3 py-3">标的</th>
                      <th className="px-3 py-3">观察日</th>
                      <th className="px-3 py-3">抓取时间</th>
                      <th className="px-3 py-3">收盘</th>
                      <th className="px-3 py-3">修订</th>
                      <th className="px-3 py-3">内容指纹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketHistoryQuery.data?.map(row => {
                      const payload = row.payload as Record<string, unknown>;
                      return (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-3 py-3 font-semibold">
                            {row.symbol}
                          </td>
                          <td className="px-3 py-3">{row.observationDate}</td>
                          <td className="px-3 py-3">
                            {formatDate(row.fetchedAt)}
                          </td>
                          <td className="px-3 py-3">
                            {payload.close == null
                              ? "—"
                              : String(payload.close)}
                          </td>
                          <td className="px-3 py-3">
                            {row.isRevision ? "是" : "否"}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-500">
                            {row.contentHash.slice(0, 16)}…
                          </td>
                        </tr>
                      );
                    })}
                    {!marketHistoryQuery.isLoading &&
                      !marketHistoryQuery.data?.length && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            暂无永久历史观测；完成一次真实同步后在此显示。
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="mt-7">
              <MarketApiProviderConfig onCompleted={() => void refresh()} />
            </section>
          </section>
        )}
        {formOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"
            role="presentation"
          >
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="source-dialog-title"
              onSubmit={submitSource}
              className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[24px] bg-[#f6f9fd] p-7 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 id="source-dialog-title" className="text-3xl font-bold">
                  {editing ? "编辑爬取源" : "添加爬取源"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                  className="rounded-lg p-2 hover:bg-slate-200"
                  aria-label="关闭"
                >
                  <X className="h-7 w-7" />
                </button>
              </div>
              <div className="mt-7 grid gap-6 md:grid-cols-2">
                <label className="grid gap-2 text-xl font-bold">
                  源名称
                  <Input
                    required
                    value={form.name}
                    onChange={event =>
                      setForm({ ...form, name: event.target.value })
                    }
                    placeholder="如：新浪财经"
                    className="h-16 border-slate-300 bg-white text-xl"
                  />
                </label>
                <label className="grid gap-2 text-xl font-bold">
                  网站网址
                  <Input
                    required
                    type="url"
                    value={form.websiteUrl}
                    onChange={event =>
                      setForm({ ...form, websiteUrl: event.target.value })
                    }
                    placeholder="https://example.com"
                    className="h-16 border-slate-300 bg-white text-xl"
                  />
                </label>
                <label className="grid gap-2 text-xl font-bold md:col-span-2">
                  API 地址 / RSS/Atom 地址{" "}
                  <span className="text-sm font-normal text-slate-500">
                    （创建时选填；若留空将只发现网站公开声明的订阅）
                  </span>
                  <Input
                    value={form.feedUrl}
                    onChange={event =>
                      setForm({ ...form, feedUrl: event.target.value })
                    }
                    placeholder="https://rss.example.com/feed.xml"
                    className="h-16 border-slate-300 bg-white text-xl"
                  />
                </label>
                <label className="grid gap-2 text-xl font-bold">
                  爬取间隔：{intervalLabel(interval)}
                  <input
                    className="accent-sky-500"
                    type="range"
                    min={0}
                    max={intervals.length - 1}
                    value={intervals.indexOf(interval)}
                    onChange={event =>
                      setInterval(intervals[Number(event.target.value)]!)
                    }
                  />
                </label>
                <label className="grid gap-2 text-xl font-bold">
                  每次爬取：{form.maxItemsPerRun} 篇
                  <input
                    className="accent-sky-500"
                    type="range"
                    min={1}
                    max={50}
                    value={form.maxItemsPerRun}
                    onChange={event =>
                      setForm({
                        ...form,
                        maxItemsPerRun: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-3 text-xl font-bold">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={event =>
                      setForm({ ...form, isActive: event.target.checked })
                    }
                  />
                  保存后启用来源
                </label>
                <label className="grid gap-2 text-xl font-bold">
                  处理模式
                  <select
                    value={form.processingMode}
                    onChange={event =>
                      setForm({
                        ...form,
                        processingMode: event.target
                          .value as typeof form.processingMode,
                      })
                    }
                    className="h-14 rounded-xl border border-slate-300 bg-white px-4"
                  >
                    <option value="queued">稳定队列</option>
                    <option value="immediate">全量即时</option>
                  </select>
                </label>
              </div>
              <div className="mt-10 flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                  className="h-14 border-slate-300 px-7 text-xl"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-14 bg-sky-500 px-7 text-xl font-bold text-white hover:bg-sky-600"
                >
                  {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {editing ? "确认保存" : "确认添加"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
