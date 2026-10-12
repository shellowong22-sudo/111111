import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  FileClock,
  FileSearch,
  GitBranch,
  Globe2,
  Link2,
  ListFilter,
  Loader2,
  Network,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  ADMIN_DATA_MODULES,
  recommendAdminDataModuleIdsForType,
} from "@shared/adminDataModules";

type PanelKey =
  | "tasks"
  | "seeds"
  | "dashboard"
  | "dataset"
  | "tools"
  | "scan"
  | "failures"
  | "snapshots"
  | "graph"
  | "lineage";
type SelectedData = {
  uuid: string;
  collection: "finance_world_dataset" | "finance_tool_union_set";
  label: string;
  contentType: string;
  candidatePushModuleIds?: string[];
};
type DeliveryReceipt = {
  contentKey: string;
  receiptId?: string;
  moduleId: string;
  moduleName: string;
  frontPath: string;
  status: string;
  sourceKind: string;
  modulePath?: string;
  sourceReference?: string | null;
  publishedAt?: string | Date | null;
  title?: string;
  body?: string;
  visibleItemCount?: number;
  frontReadConfirmed?: boolean;
  duplicateBlocked?: boolean;
  deliveryAction?: "inserted" | "duplicate_blocked";
  verifiedAt?: string | Date | null;
  sentAt?: string | Date | null;
  targetScope?: string;
  sentCount?: number;
  successCount?: number;
  failureCount?: number;
  currentStatus?: string;
  frontAckAt?: string | Date | null;
  latestFrontAckAt?: string | Date | null;
  failureReason?: string | null;
  retryStatus?: string;
  acknowledgedClientCount?: number;
  sourceDataUuid?: string | null;
  sourceCollection?: "finance_world_dataset" | "finance_tool_union_set" | null;
};

const PANELS: Array<{
  key: PanelKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "tasks", label: "爬虫任务管理", icon: Activity },
  { key: "seeds", label: "种子库管理", icon: Globe2 },
  { key: "dashboard", label: "集合大盘", icon: Database },
  { key: "dataset", label: "集合数据浏览", icon: FileSearch },
  { key: "tools", label: "金融工具多维筛选", icon: Wrench },
  { key: "scan", label: "巡检配置面板", icon: Settings2 },
  { key: "failures", label: "失败监控面板", icon: CircleAlert },
  { key: "snapshots", label: "快照归档", icon: Archive },
  { key: "graph", label: "实体关联图谱", icon: Network },
  { key: "lineage", label: "数据血缘溯源", icon: GitBranch },
];

function formatTime(value?: string | Date | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "尚无";
}
function revealInlineDetail(id: string) {
  window.setTimeout(
    () =>
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    60
  );
}
function jsonText(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function deliveryFingerprint(item: DeliveryReceipt) {
  return String(item.body || item.title || "")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** 后台只把相同正文展示一次，同时保留它实际命中的全部目标和汇总回执。 */
function collapseRecentDeliveries(items: DeliveryReceipt[]) {
  const groups = new Map<string, DeliveryReceipt & { targetModules?: string[]; targetPaths?: string[] }>();
  for (const item of items) {
    const key = deliveryFingerprint(item) || item.contentKey;
    const previous = groups.get(key);
    if (!previous) {
      groups.set(key, {
        ...item,
        targetModules: [item.moduleName].filter(Boolean),
        targetPaths: [item.modulePath].filter((path): path is string => Boolean(path && path !== "—")),
      });
      continue;
    }
    previous.targetModules = Array.from(new Set([...(previous.targetModules ?? []), item.moduleName].filter(Boolean)));
    previous.targetPaths = Array.from(new Set([...(previous.targetPaths ?? []), item.modulePath].filter((path): path is string => Boolean(path && path !== "—"))));
    previous.sentCount = (previous.sentCount ?? 0) + (item.sentCount ?? 0);
    previous.successCount = (previous.successCount ?? 0) + (item.successCount ?? 0);
    previous.failureCount = (previous.failureCount ?? 0) + (item.failureCount ?? 0);
    previous.visibleItemCount = Math.max(previous.visibleItemCount ?? 0, item.visibleItemCount ?? 0);
    previous.acknowledgedClientCount = Math.max(previous.acknowledgedClientCount ?? 0, item.acknowledgedClientCount ?? 0);
    previous.frontReadConfirmed = Boolean(previous.frontReadConfirmed || item.frontReadConfirmed);
    previous.frontAckAt = previous.frontAckAt || item.frontAckAt;
    previous.latestFrontAckAt = previous.latestFrontAckAt || item.latestFrontAckAt;
  }
  return Array.from(groups.values());
}
function taskTargets(type: string) {
  return recommendAdminDataModuleIdsForType(type)
    .map(id => ADMIN_DATA_MODULES.find(module => module.id === id)?.name)
    .filter(Boolean)
    .join("、");
}

const ADMIN_DATA_MODULE_ID_SET = new Set(
  ADMIN_DATA_MODULES.map(module => module.id)
);

function normalizedCandidateModuleIds(storedIds: unknown, contentType: string) {
  const storedModuleIds = Array.isArray(storedIds)
    ? storedIds.filter((id): id is string => typeof id === "string")
    : [];
  const validStoredIds = storedModuleIds.length
    ? [
        ...new Set(
          storedModuleIds.filter(id => ADMIN_DATA_MODULE_ID_SET.has(id))
        ),
      ]
    : [];
  if (
    validStoredIds.length &&
    validStoredIds.length === storedModuleIds.length
  ) {
    return validStoredIds;
  }
  return recommendAdminDataModuleIdsForType(contentType).filter(id =>
    ADMIN_DATA_MODULE_ID_SET.has(id)
  );
}

function candidateModuleNames(storedIds: unknown, contentType: string) {
  return normalizedCandidateModuleIds(storedIds, contentType)
    .map(id => ADMIN_DATA_MODULES.find(module => module.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join("、");
}

export default function AdminCrawlerWorkbench(props: {
  sources: any[];
  onSyncSource: (sourceId: number) => void;
  onEnableSchedule: (sourceId: number) => void;
  syncPending: boolean;
  schedulePending: boolean;
}) {
  const utils = trpc.useUtils();
  const [municipalScope, setMunicipalScope] = useState<'funding'|'curve'|'issuers'>('funding');
  const publishMunicipal = trpc.municipalResearch.publishOfficial.useMutation({
    onSuccess: async result => {
      toast.info(`地方债资料：新增 ${result.inserted}，重复拦截 ${result.duplicates}，失败 ${result.failed.length}。新增内容等待前端实收回执。`);
      if(result.failed.length) toast.error(result.failed.join('；').slice(0,400));
      await utils.adminSpider.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [panel, setPanel] = useState<PanelKey>("tasks");
  const [runningTaskUuid, setRunningTaskUuid] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<SelectedData[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [lastReceipts, setLastReceipts] = useState<DeliveryReceipt[]>([]);
  const dashboard = trpc.adminSpider.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 5_000,
  });
  useEffect(() => {
    const persisted = (dashboard.data?.recentDeliveries ?? [])
      .filter(
        (item: any) =>
          item.manualSelection && item.status !== "skipped_duplicate"
      )
      .slice(0, 6)
      .map((item: any) => ({
        ...item,
        frontPath: item.modulePath,
      })) as DeliveryReceipt[];
    if (!persisted.length) return;
    setLastReceipts(current => {
      if (!current.length) return persisted;
      return current.map(receipt => {
        const fresh = persisted.find(
          item => item.contentKey === receipt.contentKey
        );
        return fresh ? { ...receipt, ...fresh } : receipt;
      });
    });
  }, [dashboard.data?.recentDeliveries]);
  const refreshAll = async () => {
    await Promise.all([
      utils.adminSpider.dashboard.invalidate(),
      utils.adminSpider.listWorldData.invalidate(),
      utils.adminSpider.listTools.invalidate(),
    ]);
  };
  const action = (message: string) => ({
    onSuccess: async () => {
      toast.success(message);
      await refreshAll();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const createTask = trpc.adminSpider.createTask.useMutation({
    onSuccess: async result => {
      if (result.duplicateBlocked) {
        toast.info(
          `已存在相同来源、内容类型与调度配置，未重复创建；沿用任务 ${result.taskUuid}。`
        );
      } else {
        toast.success("爬虫任务已创建，默认保持暂停，等待管理员启用。");
      }
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });
  const updateTask = trpc.adminSpider.updateTask.useMutation(
    action("爬虫任务配置已更新。")
  );
  const deleteTask = trpc.adminSpider.deleteTask.useMutation(
    action("爬虫任务已删除。")
  );
  const executeTask = trpc.adminSpider.executeTask.useMutation({
    onSuccess: async result => {
      toast.success(
        `采集完成：${Number(result.bytes ?? 0).toLocaleString()} 字节，主集合写入或更新 ${result.structuredCount ?? 0} 条；已进入质量、去重与模块策略流程。`
      );
      await refreshAll();
    },
    onError: error => toast.error(`采集未完成：${error.message}`),
    onSettled: () => setRunningTaskUuid(null),
  });
  const createSeed = trpc.adminSpider.createSeed.useMutation(
    action("公开来源种子已加入，等待健康检查和管理员启用。")
  );
  const updateSeed = trpc.adminSpider.updateSeed.useMutation(
    action("种子状态已更新。")
  );
  const deleteSeed = trpc.adminSpider.deleteSeed.useMutation(
    action("未被任务引用的种子已删除。")
  );
  const checkSeeds = trpc.adminSpider.checkSeeds.useMutation(
    action("种子健康与死链探测已完成。")
  );
  const runGapScan = trpc.adminSpider.runGapScan.useMutation({
    onSuccess: async result => {
      toast.success(
        result?.duplicateBlocked
          ? "相同范围的巡检刚刚已经完成，本次未重复写入日志或任务。"
          : `缺口巡检完成：发现 ${result?.moduleIds?.length ?? 0} 个缺口，新建 ${result?.generatedTaskUuids?.length ?? 0} 个补采任务。`
      );
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });
  const retryFailures = trpc.adminSpider.retryFailures.useMutation(
    action("失败任务已按分级策略重试。")
  );
  const manualPush = trpc.adminSpider.manualPush.useMutation({
    onSuccess: async result => {
      const receipts = result.deliveryReceipts as DeliveryReceipt[];
      const insertedCount = receipts.filter(
        receipt => !receipt.duplicateBlocked
      ).length;
      const blockedCount = receipts.length - insertedCount;
      setLastReceipts(receipts);
      toast.success(
        insertedCount
          ? `定向写入完成：新增 ${insertedCount} 条，重复拦截 ${blockedCount} 条；正在等待对应终端返回实收回执。`
          : `没有重复写入：已拦截 ${blockedCount} 条重复内容，沿用原内容及其接收记录。`
      );
      setSelectedData([]);
      setSelectedModules([]);
      await refreshAll();
    },
    onError: error => toast.error(`人工推送未完成：${error.message}`),
  });
  const busy =
    createTask.isPending ||
    updateTask.isPending ||
    deleteTask.isPending ||
    executeTask.isPending ||
    createSeed.isPending ||
    updateSeed.isPending ||
    deleteSeed.isPending ||
    checkSeeds.isPending ||
    runGapScan.isPending ||
    retryFailures.isPending ||
    manualPush.isPending;
  const data = dashboard.data;
  const toggleData = (item: SelectedData) =>
    setSelectedData(current =>
      current.some(
        row => row.uuid === item.uuid && row.collection === item.collection
      )
        ? current.filter(
            row =>
              !(row.uuid === item.uuid && row.collection === item.collection)
          )
        : [...current, item]
    );
  const toggleModule = (moduleId: string) =>
    setSelectedModules(current =>
      current.includes(moduleId)
        ? current.filter(id => id !== moduleId)
        : [...current, moduleId]
    );
  const push = () =>
    manualPush.mutate({
      data: selectedData.map(({ uuid, collection }) => ({ uuid, collection })),
      moduleIds: selectedModules as any,
    });
  const openPanelAt = (nextPanel: PanelKey, elementId?: string) => {
    setPanel(nextPanel);
    if (elementId)
      window.setTimeout(
        () => document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80
      );
  };
  const resendReceipt = (receipt: DeliveryReceipt) => {
    if (!receipt.sourceDataUuid || !receipt.sourceCollection) {
      toast.error("当前记录缺少原数据身份，不能脱离原数据再次发送。");
      return;
    }
    manualPush.mutate({
      data: [
        { uuid: receipt.sourceDataUuid, collection: receipt.sourceCollection },
      ],
      moduleIds: [receipt.moduleId as any],
    });
  };

  return (
    <div
      data-spider-admin
      className="mt-5 grid gap-5 md:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]"
    >
      <aside className="h-fit rounded-[26px] border border-white/80 bg-[#fcfdff] p-4 shadow-[0_16px_40px_rgba(20,40,75,.13)] md:sticky md:top-5">
        <div className="px-3 pb-4 pt-2">
          <div className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Bot className="h-6 w-6 text-sky-500" />
            完整爬虫后台
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            10 个管理模块 · 12 张数据表 · 自动清洗去重输送
          </p>
        </div>
        <nav className="space-y-1">
          {PANELS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPanel(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${panel === item.key ? "bg-sky-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="h-4 w-4 opacity-70" />
            </button>
          ))}
        </nav>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
          <ShieldCheck className="mb-2 h-5 w-5" />
          <b>硬性推送规则已启用</b>
          <br />
          自动化抓取、解析、质量过滤并按稳定指纹去重后输送到已映射前端；重复内容自动拦截，失败任务进入重试队列。
        </div>
      </aside>
      <main className="min-w-0 space-y-5">
        {!dashboard.isLoading && !dashboard.isError && (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <OperationEntry
              title="任务与立即采集"
              detail={`${data?.tasks?.filter((row: any) => row.seedUuid).length ?? 0} 个已绑定公开来源的任务`}
              value={`${data?.tasks?.filter((row: any) => row.status === "completed").length ?? 0} 已完成`}
              onClick={() => openPanelAt("tasks")}
            />
            <OperationEntry
              title="来源与原始快照"
              detail={`${data?.seeds?.length ?? 0} 个公开种子，逐个健康检查`}
              value={`${data?.stats.raw ?? 0} 次真实抓取`}
              onClick={() => openPanelAt("seeds")}
            />
            <OperationEntry
              title="解析与主集合"
              detail={`原始 → 解析 → 质量 → 血缘`}
              value={`${data?.stats.processed ?? 0} 次处理`}
              onClick={() => openPanelAt("dataset", "spider-data-browser")}
            />
            <OperationEntry
              title="筛选与输送回执"
              detail="按数据指纹去重后写入既有模块，并回收前端确认"
              value={`${data?.stats.pushes ?? 0} 条推送记录`}
              onClick={() => openPanelAt("dataset", "spider-push-dock")}
            />
          </section>
        )}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/80 bg-[#fcfdff] px-6 py-5 shadow-[0_16px_40px_rgba(20,40,75,.13)]">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              {PANELS.find(item => item.key === panel)?.label}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              资料按具体功能定向写入；发送入库与前端实收分别记录，未收到确认不得标成成功。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <select aria-label="地方债官方资料范围" value={municipalScope} onChange={e => setMunicipalScope(e.target.value as typeof municipalScope)} className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900">
            <option value="funding">BTMM · 4条资金参考序列</option><option value="curve">AAA · 8条国债参照</option><option value="issuers">SMUN · 29条地区序列</option>
          </select>
          <button onClick={() => publishMunicipal.mutate({scope:municipalScope})} disabled={publishMunicipal.isPending} className="rounded bg-cyan-800 px-3 py-2 text-white disabled:opacity-50">{publishMunicipal.isPending ? '核验与定向发布中…' : '核验并推送地方债资料'}</button>
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={dashboard.isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${dashboard.isFetching ? "animate-spin" : ""}`}
            />
            刷新当前后台数据
          </button>
          </div>
        </header>
        {dashboard.isLoading ? (
          <Loading />
        ) : dashboard.isError ? (
          <Empty text={`爬虫后台读取失败：${dashboard.error.message}`} />
        ) : (
          <>
            {panel === "dashboard" && (
              <DashboardPanel
                data={data}
                pending={manualPush.isPending}
                onResend={resendReceipt}
              />
            )}
            {panel === "tasks" && (
              <TaskPanel
                rows={data?.tasks ?? []}
                seeds={data?.seeds ?? []}
                busy={busy}
                runningTaskUuid={runningTaskUuid}
                onCreate={(input: any) => createTask.mutate(input)}
                onStatus={(taskUuid: string, status: "paused" | "queued") =>
                  updateTask.mutate({ taskUuid, status })
                }
                onRun={(taskUuid: string) => {
                  setRunningTaskUuid(taskUuid);
                  executeTask.mutate({ taskUuid });
                }}
                onDelete={(taskUuid: string) => deleteTask.mutate({ taskUuid })}
              />
            )}
            {panel === "seeds" && (
              <SeedPanel
                rows={data?.seeds ?? []}
                legacySources={props.sources}
                busy={busy || props.syncPending || props.schedulePending}
                onCreate={(input: any) => createSeed.mutate(input)}
                onCheck={(seedUuids: string[]) =>
                  checkSeeds.mutate({ seedUuids: seedUuids as any })
                }
                onToggle={(seedUuid: string, isActive: boolean) =>
                  updateSeed.mutate({ seedUuid, isActive })
                }
                onDelete={(seedUuid: string) => deleteSeed.mutate({ seedUuid })}
                onSyncLegacy={props.onSyncSource}
                onScheduleLegacy={props.onEnableSchedule}
              />
            )}
            {panel === "dataset" && (
              <WorldDataPanel selected={selectedData} onToggle={toggleData} />
            )}
            {panel === "tools" && (
              <ToolPanel selected={selectedData} onToggle={toggleData} />
            )}
            {panel === "scan" && (
              <ScanPanel
                rows={data?.scans ?? []}
                busy={runGapScan.isPending}
                onRun={() => runGapScan.mutate()}
              />
            )}
            {panel === "failures" && (
              <FailurePanel
                rows={data?.failures ?? []}
                busy={retryFailures.isPending}
                onRetry={(failUuids: string[]) =>
                  retryFailures.mutate({ failUuids: failUuids as any })
                }
              />
            )}
            {panel === "snapshots" && (
              <SnapshotPanel rows={data?.snapshots ?? []} />
            )}
            {panel === "graph" && (
              <GraphPanel
                rows={data?.links ?? []}
                dataRows={data?.worldData ?? []}
                tools={data?.tools ?? []}
              />
            )}
            {panel === "lineage" && (
              <LineagePanel
                examples={[
                  ...(data?.worldData ?? []).slice(0, 3),
                  ...(data?.tools ?? []).slice(0, 2),
                ]}
              />
            )}
          </>
        )}
        {(panel === "dataset" || panel === "tools") && (
          <PushDock
            modules={data?.modules ?? []}
            selectedData={selectedData}
            selectedModules={selectedModules}
            onToggleModule={toggleModule}
            onApplyRecommended={(moduleIds: string[]) =>
              setSelectedModules(moduleIds)
            }
            onClear={() => {
              setSelectedData([]);
              setSelectedModules([]);
            }}
            onPush={push}
            pending={manualPush.isPending}
            lastReceipts={lastReceipts}
            onResend={resendReceipt}
          />
        )}
      </main>
    </div>
  );
}

function DashboardPanel({
  data,
  pending,
  onResend,
}: {
  data: any;
  pending: boolean;
  onResend: (receipt: DeliveryReceipt) => void;
}) {
  const metrics = [
    ["全球金融主集合", data?.stats.world?.toLocaleString?.() ?? 0],
    ["金融工具集合", data?.stats.tools ?? 0],
    ["原始抓取", data?.stats.raw ?? 0],
    ["AI / 规则处理", data?.stats.processed ?? 0],
    ["版本快照", data?.stats.snapshots ?? 0],
    ["实体关系", data?.stats.links ?? 0],
  ];
  const displayDeliveries = useMemo(
    () => collapseRecentDeliveries(
      (data?.recentDeliveries ?? [])
        .filter((item: any) => item.status !== "skipped_duplicate")
        .map((item: any) => ({ ...item, frontPath: item.modulePath })) as DeliveryReceipt[]
    ),
    [data?.recentDeliveries],
  );
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <Metric key={String(label)} label={String(label)} value={value} />
        ))}
      </section>
      <Card title="集合构成与质量分布（来自数据库实时聚合）" icon={Database}>
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Breakdown
            title="数据大类"
            rows={data?.breakdowns?.worldByTopType ?? []}
            total={data?.stats.world ?? 0}
          />
          <Breakdown
            title="资产类型"
            rows={data?.breakdowns?.worldByAssetType ?? []}
            total={data?.stats.world ?? 0}
          />
          <Breakdown
            title="数据质量"
            rows={data?.breakdowns?.worldByQuality ?? []}
            total={data?.stats.world ?? 0}
          />
          <Breakdown
            title="种子来源类别"
            rows={data?.breakdowns?.seedByCategory ?? []}
            total={data?.seeds?.length ?? 0}
          />
          <Breakdown
            title="任务运行状态"
            rows={data?.breakdowns?.taskByStatus ?? []}
            total={data?.tasks?.length ?? 0}
          />
          <div className="rounded-2xl border bg-emerald-50 p-4">
            <div className="text-sm font-black text-emerald-900">
              前端定向输送
            </div>
            <div className="mt-3 text-3xl font-black text-emerald-700">
              {data?.stats.pushes ?? 0}
            </div>
            <div className="mt-2 text-xs leading-5 text-emerald-800">
              每次均有数据 UUID、目标模块、管理员、来源、时间和前端内容槽回执。
            </div>
          </div>
        </div>
      </Card>
      <Card title="最近真实采集：来源 → 原始证据 → 解析结果" icon={Activity}>
        {(data?.rawData ?? []).length ? (
          <DataTable
            heads={[
              "公开来源",
              "采集结果",
              "原始证据",
              "解析与质量",
              "采集时间",
            ]}
          >
            {(data.rawData ?? []).slice(0, 12).map((raw: any) => {
              const process = (data.processedData ?? []).find(
                (row: any) => row.rawUuid === raw.rawUuid
              );
              const isErrorResponse =
                Number(raw.httpStatus ?? 0) >= 400 ||
                raw.parseStatus === "error_response";
              return (
                <tr key={raw.rawUuid} className="border-t align-top">
                  <td className="max-w-sm p-3">
                    <a
                      href={raw.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-sky-700 hover:underline"
                    >
                      {raw.sourceUrl}
                    </a>
                    <div className="mt-1 text-xs text-slate-500">
                      {raw.carrierType} · HTTP {raw.httpStatus ?? "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    <Status
                      value={
                        isErrorResponse ? "错误响应，仅供诊断" : raw.parseStatus
                      }
                    />
                    <div className="mt-1 text-xs">
                      正文 {raw.rawContent?.length?.toLocaleString?.() ?? 0}{" "}
                      字符
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold">
                      {raw.rawBinary
                        ? Math.round(
                            raw.rawBinary.length * 0.75
                          ).toLocaleString()
                        : 0}{" "}
                      字节
                    </div>
                    <code className="mt-1 block text-[10px]">
                      {raw.rawUuid}
                    </code>
                    <div className="mt-1 font-mono text-[10px] text-slate-400">
                      SHA-256 {raw.contentHash?.slice(0, 16)}…
                    </div>
                  </td>
                  <td className="p-3">
                    <b>
                      {isErrorResponse
                        ? "未进入正文加工"
                        : process?.parserType ?? "待处理"}
                    </b>
                    <div className="mt-1">
                      <Status
                        value={
                          isErrorResponse
                            ? "诊断记录"
                            : process?.qualityLevel ?? "待检查"
                        }
                      />
                    </div>
                    <code className="mt-1 block text-[10px]">
                      {process?.processUuid ?? "—"}
                    </code>
                  </td>
                  <td className="p-3 text-xs">{formatTime(raw.crawlTime)}</td>
                </tr>
              );
            })}
          </DataTable>
        ) : (
          <Empty text="尚无真实采集。请到爬虫任务管理执行已绑定公开来源的任务。" />
        )}
      </Card>
      <Card title="最近人工推送与前端读取回执" icon={Send}>
        {displayDeliveries.length ? (
          <DataTable
            heads={[
              "任务 / 前端功能",
              "推送内容",
              "发送结果",
              "前端实收",
              "失败 / 重试",
              "核验操作",
            ]}
          >
            {displayDeliveries
              .slice(0, 15)
              .map((item: any) => (
                <tr key={item.contentKey} className="border-t align-top">
                  <td className="p-3">
                    <code className="block break-all text-[10px] text-slate-500">
                      {item.receiptId}
                    </code>
                    <b>{item.targetModules?.join("、") || item.moduleName}</b>
                    <div className="font-mono text-xs text-sky-600">
                      {item.targetModules?.length > 1
                        ? `${item.targetModules.length} 个目标功能已合并显示`
                        : `${item.moduleId} · ${item.modulePath}`}
                    </div>
                  </td>
                  <td className="max-w-md p-3">
                    <b>{item.title}</b>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {item.body}
                    </p>
                    <div className="mt-1">
                      <Status
                        value={
                          item.sourceKind === "real"
                            ? "真实来源"
                            : item.sourceKind === "simulated"
                              ? "模拟数据"
                              : "混合数据"
                        }
                      />
                    </div>
                    {/^(?:https?):\/\//.test(item.sourceReference ?? "") && (
                      <a
                        href={item.sourceReference}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[10px] font-bold text-sky-600 hover:underline"
                      >
                        打开来源证据
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <b>发送 {item.sentCount ?? 0}</b>
                    <div className="mt-1 text-emerald-700">
                      成功 {item.successCount ?? 0}
                    </div>
                    <div className="text-rose-700">
                      失败 {item.failureCount ?? 0}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {formatTime(item.sentAt)}
                    </div>
                  </td>
                  <td className="p-3">
                    <Status
                      value={
                        item.frontReadConfirmed
                          ? "前端已确认接收"
                          : item.feedVisible
                            ? "已写入，等待终端确认"
                            : item.currentStatus
                      }
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      确认时间 {formatTime(item.frontAckAt)}
                    </div>
                    <div className="text-xs text-slate-500">
                      确认终端 {item.acknowledgedClientCount ?? 0} · 当前可见{" "}
                      {item.visibleItemCount ?? 0}
                    </div>
                  </td>
                  <td className="max-w-xs p-3 text-xs">
                    <div>{item.failureReason || "无失败原因"}</div>
                    <div className="mt-1 font-bold text-slate-600">
                      {item.retryStatus === "retry_available"
                        ? "可重试"
                        : item.retryStatus === "retrying"
                          ? "重试中"
                          : "无需重试"}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex min-w-24 flex-col gap-2">
                      {item.manualSelection && (
                        <button
                          type="button"
                          disabled={
                            pending ||
                            !item.sourceDataUuid ||
                            !item.sourceCollection
                          }
                          onClick={() =>
                            onResend({ ...item, frontPath: item.modulePath })
                          }
                          className="rounded border border-sky-300 px-2 py-1 text-xs font-bold text-sky-700 disabled:opacity-40"
                        >
                          再次发送
                        </button>
                      )}
                      {item.modulePath !== "—" && (
                        <a
                          href={item.modulePath}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-emerald-300 px-2 py-1 text-center text-xs font-bold text-emerald-700"
                        >
                          打开前端核验
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </DataTable>
        ) : (
          <Empty text="尚无输送回执。自动清洗去重后的内容或人工指定内容送达前端后，这里会显示目标功能、正文、来源、确认时间与重试状态。" />
        )}
      </Card>
      <Card title="采集、解析与调度能力边界" icon={Boxes}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Capability
            title="采集载体"
            items={data?.architecture.collection ?? []}
          />
          <Capability
            title="解析归一化"
            items={data?.architecture.parsing ?? []}
          />
          <Capability
            title="分级调度"
            items={data?.architecture.scheduling ?? []}
          />
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <b>部署真实性说明：</b>
          {data?.architecture.deploymentTruth}
        </div>
      </Card>
    </div>
  );
}

function TaskPanel({
  rows,
  seeds,
  busy,
  runningTaskUuid,
  onCreate,
  onStatus,
  onRun,
  onDelete,
}: any) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [seedUuid, setSeedUuid] = useState("");
  const [carrier, setCarrier] = useState("auto");
  const [priority, setPriority] = useState("normal");
  const [schedule, setSchedule] = useState("daily");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [backfillEnabled, setBackfillEnabled] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [scope, setScope] = useState<"executable" | "gap" | "all">(
    "executable"
  );
  const visibleRows = rows.filter(
    (row: any) =>
      scope === "all" ||
      (scope === "executable" ? Boolean(row.seedUuid) : !row.seedUuid)
  );
  const applySeedDefaults = (nextSeedUuid: string) => {
    setSeedUuid(nextSeedUuid);
    const seed = seeds.find((item: any) => item.seedUuid === nextSeedUuid);
    if (!seed) return;
    setName(`${seed.sourceName}·${seed.sourceCategory}采集`);
    setType(seed.sourceCategory);
    setCarrier("auto");
    const isFast = /新闻|市场状态|资金|参考利率/.test(seed.sourceCategory);
    setPriority(isFast ? "high" : "normal");
    setSchedule(isFast ? "hourly" : "daily");
  };
  useEffect(() => {
    if (!seedUuid && seeds[0]?.seedUuid) applySeedDefaults(seeds[0].seedUuid);
  }, [seedUuid, seeds]);
  return (
    <div className="space-y-5">
      <Card title="新建可执行爬虫任务" icon={Plus}>
        <div className="grid gap-3 lg:grid-cols-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            aria-label="爬虫任务名称"
            className="field"
          />
          <input
            value={type}
            onChange={e => setType(e.target.value)}
            aria-label="爬虫任务数据类型"
            className="field"
          />
          <select
            value={seedUuid}
            onChange={e => applySeedDefaults(e.target.value)}
            aria-label="选择种子"
            className="field"
          >
            <option value="">选择公开来源种子</option>
            {seeds.map((seed: any) => (
              <option key={seed.seedUuid} value={seed.seedUuid}>
                {seed.sourceName} · {seed.sourceCategory}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <select
            aria-label="采集载体"
            value={carrier}
            onChange={e => setCarrier(e.target.value)}
            className="field"
          >
            <option value="auto">自动识别采集载体</option>
            <option value="rss_atom">RSS / ATOM</option>
            <option value="html_js">HTML / JS 页面</option>
            <option value="rest">REST 公开接口</option>
            <option value="pdf_ocr">PDF / OCR</option>
            <option value="dataset">Excel / CSV / Parquet</option>
            <option value="archive">网页归档</option>
            <option value="chain_rpc">链上公开 RPC</option>
          </select>
          <select
            aria-label="任务优先级"
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="field"
          >
            <option value="high">高优先级·分钟级资讯/资金</option>
            <option value="normal">普通优先级</option>
            <option value="low">低优先级·历史归档</option>
          </select>
          <select
            aria-label="任务调度周期"
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            className="field"
          >
            <option value="minute">每分钟</option>
            <option value="hourly">每小时</option>
            <option value="daily">每日</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 text-sm">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={e => setAiEnabled(e.target.checked)}
            />
            AI 解析与质量检查
          </label>
          <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 text-sm">
            <input
              type="checkbox"
              checked={backfillEnabled}
              onChange={e => setBackfillEnabled(e.target.checked)}
            />
            历史回溯采集
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={busy || !name || !seedUuid}
            onClick={() =>
              onCreate({
                taskName: name,
                taskType: type,
                seedUuid,
                carrierType:
                  carrier === "auto"
                    ? /rss|feed|xml/i.test(
                        seeds.find((seed: any) => seed.seedUuid === seedUuid)
                          ?.seedUrl ?? ""
                      )
                      ? "rss_atom"
                      : /api\.|\/api\//i.test(
                            seeds.find((seed: any) => seed.seedUuid === seedUuid)
                              ?.seedUrl ?? ""
                          )
                        ? "rest"
                        : "html_js"
                    : carrier,
                priorityLevel: priority,
                scheduleLevel: schedule,
                aiEnabled,
                backfillEnabled,
              })
            }
            className="primary"
          >
            <Plus className="h-4 w-4" />
            创建任务
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {[
            "① 公开来源",
            "② 原始二进制",
            "③ 解析与 AI 加工",
            "④ 主集合与血缘",
            "⑤ 人工选择模块推送",
          ].map(step => (
            <div
              key={step}
              className="rounded-lg border bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-600"
            >
              {step}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          新任务默认暂停。默认遵守
          robots、公开来源条款和分域限速；不会自动写入任何前端模块。
        </p>
      </Card>
      <Card
        title={`任务清单（显示 ${visibleRows.length} / 总计 ${rows.length}）`}
        icon={Activity}
        action={
          <select
            aria-label="任务范围"
            value={scope}
            onChange={event => setScope(event.target.value as typeof scope)}
            className="field"
          >
            <option value="executable">可执行来源任务</option>
            <option value="gap">缺口巡检任务</option>
            <option value="all">全部任务</option>
          </select>
        }
      >
        <DataTable
          heads={[
            "任务 / 抓取内容",
            "公开来源",
            "载体 / 调度",
            "实际产出",
            "候选前端模块",
            "状态",
            "操作",
          ]}
        >
          {visibleRows.map((row: any) => (
            <tr key={row.taskUuid} className="border-t align-top">
              <td className="p-3">
                <b>{row.taskName}</b>
                <div className="mt-1 text-xs text-sky-600">
                  抓取：{row.taskType}
                </div>
                <code className="mt-1 block text-[10px] text-slate-400">
                  {row.taskUuid}
                </code>
                {row.duplicateTaskCount > 0 && (
                  <div className="mt-1 text-[10px] font-bold text-amber-600">
                    已归并 {row.duplicateTaskCount}{" "}
                    个同配置历史任务，产出合并统计
                  </div>
                )}
              </td>
              <td className="max-w-xs p-3 text-xs">
                {row.sourceName ? (
                  <>
                    <b>{row.sourceName}</b>
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sky-600 hover:underline"
                    >
                      {row.sourceUrl}
                    </a>
                  </>
                ) : (
                  <span className="font-bold text-amber-600">
                    缺口扫描任务 · 尚未绑定来源
                  </span>
                )}
              </td>
              <td className="p-3 text-xs">
                {row.carrierType}
                <br />
                {row.priorityLevel} · {row.scheduleLevel}
                <br />
                AI {row.aiEnabled ? "开" : "关"} · 回溯{" "}
                {row.backfillEnabled ? "开" : "关"}
              </td>
              <td className="p-3 text-xs">
                <b>原始 {row.rawCount ?? 0}</b>
                <br />
                处理 {row.processedCount ?? 0}
                <br />
                主集合新增 {row.structuredCount ?? 0}
                <br />
                {row.capturedBytes
                  ? `${Number(row.capturedBytes).toLocaleString()} 字节`
                  : "尚未执行"}
              </td>
              <td className="max-w-xs p-3 text-xs text-slate-600">
                {taskTargets(row.taskType)}
                <div className="mt-1 font-bold text-rose-600">
                  仅候选，未推送
                </div>
              </td>
              <td className="p-3">
                <Status value={row.status} />
                <div className="mt-1 text-[10px] text-slate-500">
                  {formatTime(row.lastRunAt)}
                </div>
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <SmallButton
                    disabled={busy}
                    onClick={() => {
                      setSelectedTask(row);
                      revealInlineDetail("spider-task-detail");
                    }}
                    icon={FileSearch}
                  >
                    详情
                  </SmallButton>
                  <SmallButton
                    disabled={busy}
                    onClick={() =>
                      onStatus(
                        row.taskUuid,
                        row.status === "paused" ? "queued" : "paused"
                      )
                    }
                    icon={row.status === "paused" ? Play : Pause}
                  >
                    {row.status === "paused" ? "启用" : "暂停"}
                  </SmallButton>
                  {row.seedUuid && (
                    <SmallButton
                      disabled={busy}
                      onClick={() => onRun(row.taskUuid)}
                      icon={RefreshCw}
                    >
                      {runningTaskUuid === row.taskUuid ? "采集中…" : "执行采集"}
                    </SmallButton>
                  )}
                  <SmallButton
                    disabled={busy}
                    onClick={() => onDelete(row.taskUuid)}
                    icon={Trash2}
                    danger
                  >
                    删除
                  </SmallButton>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
      {selectedTask && (
        <div id="spider-task-detail" className="scroll-mt-6">
        <Card title={`任务详情 · ${selectedTask.taskName}`} icon={FileSearch}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReadableBlock
              title="抓取定义"
              rows={[
                ["数据内容", selectedTask.taskType],
                ["采集载体", selectedTask.carrierType],
                ["调度周期", selectedTask.scheduleLevel],
                ["优先级", selectedTask.priorityLevel],
                ["AI 解析", selectedTask.aiEnabled ? "开启" : "关闭"],
                ["历史回溯", selectedTask.backfillEnabled ? "开启" : "关闭"],
              ]}
            />
            <ReadableBlock
              title="公开来源"
              rows={[
                ["来源机构", selectedTask.sourceName ?? "尚未绑定"],
                ["来源网址", selectedTask.sourceUrl ?? "—"],
                ["种子编号", selectedTask.seedUuid ?? "—"],
              ]}
              link={selectedTask.sourceUrl}
            />
            <ReadableBlock
              title="限流、指纹与重试"
              rows={[
                ["代理策略", jsonText(selectedTask.proxyStrategy)],
                ["浏览器兼容", jsonText(selectedTask.fingerprintProfile)],
                ["域名限流", jsonText(selectedTask.rateLimitPolicy)],
                ["失败重试", jsonText(selectedTask.retryPolicy)],
              ]}
            />
            <ReadableBlock
              title="实际产出与下一步"
              rows={[
                ["原始记录", `${selectedTask.rawCount ?? 0} 条`],
                ["解析记录", `${selectedTask.processedCount ?? 0} 条`],
                ["主集合新增", `${selectedTask.structuredCount ?? 0} 条`],
                [
                  "抓取字节",
                  Number(selectedTask.capturedBytes ?? 0).toLocaleString(),
                ],
                ["候选模块", taskTargets(selectedTask.taskType)],
                ["下一步", "到集合数据浏览人工勾选数据与具体模块"],
              ]}
            />
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}

function SeedPanel({
  rows,
  legacySources,
  busy,
  onCreate,
  onCheck,
  onToggle,
  onDelete,
  onSyncLegacy,
  onScheduleLegacy,
}: any) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("交易所与监管披露");
  const [selected, setSelected] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterHealth, setFilterHealth] = useState("");
  const [selectedSeed, setSelectedSeed] = useState<any>(null);
  const categories = [
    ...new Set(rows.map((row: any) => row.sourceCategory)),
  ] as string[];
  const regions = [
    ...new Set(rows.map((row: any) => row.region).filter(Boolean)),
  ] as string[];
  const visibleRows = rows.filter(
    (row: any) =>
      (!filterCategory || row.sourceCategory === filterCategory) &&
      (!filterRegion || row.region === filterRegion) &&
      (!filterHealth || row.healthStatus === filterHealth)
  );
  return (
    <div className="space-y-5">
      <Card title="添加公开种子" icon={Plus}>
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="来源名称"
            aria-label="种子来源名称"
            className="field"
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            aria-label="种子网址"
            className="field"
          />
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            aria-label="种子数据分类"
            className="field"
          />
          <button
            type="button"
            disabled={busy || !name || !url}
            onClick={() =>
              onCreate({
                seedUrl: url,
                sourceName: name,
                sourceCategory: category,
                crawlDepth: 1,
                priority: 100,
              })
            }
            className="primary"
          >
            <Plus className="h-4 w-4" />
            加入种子池
          </button>
        </div>
      </Card>
      <Card
        title={`全域种子库 spider_seed_pool（显示 ${visibleRows.length} / ${rows.length}）`}
        icon={Globe2}
        action={
          <button
            type="button"
            disabled={busy}
            onClick={() => onCheck(selected)}
            className="secondary"
          >
            <FileSearch className="h-4 w-4" />
            {selected.length
              ? `探测已选 ${selected.length} 个`
              : "探测全部活跃种子"}
          </button>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <select
            aria-label="按种子分类筛选"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="field"
          >
            <option value="">全部来源分类</option>
            {categories.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="按种子地区筛选"
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className="field"
          >
            <option value="">全部地区</option>
            {regions.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="按种子健康状态筛选"
            value={filterHealth}
            onChange={e => setFilterHealth(e.target.value)}
            className="field"
          >
            <option value="">全部健康状态</option>
            {["healthy", "unchecked", "degraded", "dead", "unreachable"].map(
              item => (
                <option key={item}>{item}</option>
              )
            )}
          </select>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            label="活跃种子"
            value={rows.filter((row: any) => row.isActive).length}
          />
          <MiniStat
            label="已健康探测"
            value={rows.filter((row: any) => row.lastCheckedAt).length}
          />
          <MiniStat label="公开来源类别" value={categories.length} />
          <MiniStat label="覆盖地区" value={regions.length} />
        </div>
        <DataTable
          heads={[
            "选",
            "公开来源 / URL",
            "分类",
            "robots",
            "健康",
            "优先级",
            "操作",
          ]}
        >
          {visibleRows.map((row: any) => (
            <tr key={row.seedUuid} className="border-t align-top">
              <td className="p-3">
                <input
                  type="checkbox"
                  aria-label={`选择种子 ${row.sourceName}`}
                  checked={selected.includes(row.seedUuid)}
                  onChange={() =>
                    setSelected(current =>
                      current.includes(row.seedUuid)
                        ? current.filter(id => id !== row.seedUuid)
                        : [...current, row.seedUuid]
                    )
                  }
                />
              </td>
              <td className="max-w-sm p-3">
                <b>{row.sourceName}</b>
                <a
                  href={row.seedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-xs text-sky-600 hover:underline"
                >
                  {row.seedUrl}
                </a>
                <div className="mt-1 text-xs text-slate-400">
                  {row.domain} · {row.language ?? "未标"} ·{" "}
                  {row.region ?? "全球"}
                </div>
              </td>
              <td className="p-3">
                {row.sourceCategory}
                {row.discoveredByAi && (
                  <div className="text-xs text-violet-600">
                    AI 发现，待人工启用
                  </div>
                )}
              </td>
              <td className="p-3 text-xs">{row.robotsPolicy}</td>
              <td className="p-3">
                <Status value={row.healthStatus} />
                <div className="mt-1 text-xs">
                  HTTP {row.lastHttpStatus ?? "—"}
                </div>
              </td>
              <td className="p-3">{row.priority}</td>
              <td className="p-3">
                <div className="flex gap-2">
                  <SmallButton
                    disabled={busy}
                    onClick={() => {
                      setSelectedSeed(row);
                      revealInlineDetail("spider-seed-detail");
                    }}
                    icon={FileSearch}
                  >
                    查看详情
                  </SmallButton>
                  <SmallButton
                    disabled={busy}
                    onClick={() => onToggle(row.seedUuid, !row.isActive)}
                    icon={row.isActive ? Pause : Play}
                  >
                    {row.isActive ? "停用" : "启用"}
                  </SmallButton>
                  <SmallButton
                    disabled={busy}
                    onClick={() => onDelete(row.seedUuid)}
                    icon={Trash2}
                    danger
                  >
                    删除
                  </SmallButton>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
      {selectedSeed && (
        <div id="spider-seed-detail" className="scroll-mt-6">
        <Card title={`种子详情 · ${selectedSeed.sourceName}`} icon={Globe2}>
          <div className="grid gap-4 lg:grid-cols-3">
            <ReadableBlock
              title="覆盖内容"
              rows={[
                ["数据分类", selectedSeed.sourceCategory],
                ["地区", selectedSeed.region ?? "全球"],
                ["语种", selectedSeed.language ?? "未标注"],
                ["抓取深度", selectedSeed.crawlDepth],
                ["优先级", selectedSeed.priority],
              ]}
            />
            <ReadableBlock
              title="合规与健康"
              rows={[
                ["robots 策略", selectedSeed.robotsPolicy],
                ["健康状态", selectedSeed.healthStatus],
                ["最近 HTTP", selectedSeed.lastHttpStatus ?? "尚未探测"],
                ["最近检查", formatTime(selectedSeed.lastCheckedAt)],
                ["启用状态", selectedSeed.isActive ? "已启用" : "已停用"],
              ]}
            />
            <ReadableBlock
              title="来源证据"
              rows={[
                ["域名", selectedSeed.domain],
                ["完整 URL", selectedSeed.seedUrl],
                [
                  "发现方式",
                  selectedSeed.discoveredByAi
                    ? "AI 发现，需人工审核"
                    : "后台内置公开来源",
                ],
                ["种子编号", selectedSeed.seedUuid],
              ]}
              link={selectedSeed.seedUrl}
            />
          </div>
        </Card>
        </div>
      )}
      {legacySources.length > 0 && (
        <Card title="既有新闻 RSS / ATOM 来源" icon={Sparkles}>
          <div className="grid gap-3 md:grid-cols-2">
            {legacySources.map((source: any) => (
              <div
                key={source.id}
                className="rounded-xl border bg-slate-50 p-4"
              >
                <b>{source.name}</b>
                <div className="mt-1 text-xs text-slate-500">
                  {source.provider} · {source.lastStatus}
                </div>
                <div className="mt-3 flex gap-2">
                  <SmallButton
                    disabled={busy}
                    onClick={() => onSyncLegacy(source.id)}
                    icon={RefreshCw}
                  >
                    立即采集
                  </SmallButton>
                  {source.scheduleCronTaskUid ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      自动采集运行中
                    </span>
                  ) : (
                    <SmallButton
                      disabled={busy}
                      onClick={() => onScheduleLegacy(source.id)}
                      icon={FileClock}
                    >
                      开启定时采集
                    </SmallButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function WorldDataPanel({
  selected,
  onToggle,
}: {
  selected: SelectedData[];
  onToggle: (item: SelectedData) => void;
}) {
  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState("");
  const [topType, setTopType] = useState("");
  const [assetType, setAssetType] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);
  const list = trpc.adminSpider.listWorldData.useQuery(
    {
      query: query || undefined,
      topType: topType || undefined,
      assetType: assetType || undefined,
      quality: quality || undefined,
      page,
      pageSize: 40,
    },
    { refetchOnWindowFocus: false }
  );
  return (
    <div id="spider-data-browser" className="scroll-mt-6 space-y-5">
      <Card title="finance_world_dataset 全球金融主集合" icon={Database}>
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
          <b>怎么用：</b>
          先按数据大类、资产类型、质量或关键词筛选；点“查看完整内容”核对来源、原文、AI
          加工、标的字段和候选模块；确认后再勾选数据。当前结果{" "}
          {list.data?.total?.toLocaleString?.() ?? 0} 条，已选{" "}
          {
            selected.filter(item => item.collection === "finance_world_dataset")
              .length
          }{" "}
          条。
        </div>
        <div className="mb-4 grid gap-3 lg:grid-cols-4">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="搜索名称、代码、交易所、来源或正文"
              className="field w-full pl-10"
            />
          </label>
          <select
            aria-label="按数据大类筛选"
            value={topType}
            onChange={e => {
              setTopType(e.target.value);
              setPage(1);
            }}
            className="field"
          >
            <option value="">全部数据大类</option>
            <option>投资标的</option>
            <option>全球金融资讯</option>
            <option>全球金融数据</option>
          </select>
          <select
            aria-label="按资产类型筛选"
            value={assetType}
            onChange={e => {
              setAssetType(e.target.value);
              setPage(1);
            }}
            className="field"
          >
            <option value="">全部资产类型</option>
            <option>股票</option>
            <option>资讯</option>
            <option>宏观数据</option>
            <option>短端资金基准</option>
          </select>
          <select
            aria-label="按质量等级筛选"
            value={quality}
            onChange={e => {
              setQuality(e.target.value);
              setPage(1);
            }}
            className="field"
          >
            <option value="">全部质量等级</option>
            {["L1", "L2", "L3", "L4"].map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        {list.isLoading ? (
          <Loading />
        ) : (
          <DataTable
            heads={[
              "选",
              "爬虫数据内容",
              "来源与标的",
              "质量 / AI 加工",
              "可推送前端模块",
              "状态 / 操作",
            ]}
          >
            {(list.data?.rows ?? []).map((row: any) => {
              const title =
                row.financeArrayJson?.title || row.assetCode || row.dataSubType;
              const contentType = `${row.dataTopType}/${row.dataSubType}`;
              const candidatePushModuleIds = normalizedCandidateModuleIds(
                row.candidatePushModuleIds,
                contentType
              );
              const item = {
                uuid: row.uuid,
                collection: "finance_world_dataset" as const,
                label: title,
                contentType,
                candidatePushModuleIds,
              };
              const checked = selected.some(
                value =>
                  value.uuid === row.uuid &&
                  value.collection === item.collection
              );
              return (
                <tr key={row.uuid} className="border-t align-top">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item)}
                      aria-label={`选择数据 ${item.label}`}
                    />
                  </td>
                  <td className="max-w-sm p-3">
                    <b>{title}</b>
                    <div className="mt-1 text-sm text-sky-600">
                      {row.dataTopType} / {row.dataSubType}
                    </div>
                    <code className="text-[10px] text-slate-400">
                      {row.uuid}
                    </code>
                  </td>
                  <td className="max-w-sm p-3">
                    <b>{row.sourceName}</b>
                    <div className="text-xs text-slate-500">
                      {row.country || row.region || "全球"} ·{" "}
                      {row.exchange || row.assetType || "综合数据"}
                    </div>
                    {/^https?:\/\//.test(row.sourceUrl) ? (
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-xs text-sky-600 hover:underline"
                      >
                        打开原始来源
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        导入来源：{row.sourceName}
                      </span>
                    )}
                  </td>
                  <td className="max-w-sm p-3">
                    <Status value={row.dataQualityLevel} />
                    {row.tagList?.includes("公开来源实采") && (
                      <span className="ml-2 rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                        公开来源实采
                      </span>
                    )}
                    <p className="mt-2 line-clamp-3 text-xs text-slate-500">
                      {row.aiProcessContent || "未执行 AI 加工；保留原始字段。"}
                    </p>
                  </td>
                  <td className="max-w-xs p-3 text-xs">
                    {candidateModuleNames(
                      row.candidatePushModuleIds,
                      contentType
                    ) || "待实体关联补全"}
                  </td>
                  <td className="p-3">
                    <Status value={row.isPush ? "已人工推送" : "未推送"} />
                    <code className="mt-2 block text-[10px] text-slate-400">
                      {row.dataBloodId}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        setDetail(row);
                        revealInlineDetail("spider-world-data-detail");
                      }}
                      className="mt-2 rounded-lg border border-sky-200 px-2.5 py-1.5 text-xs font-bold text-sky-700"
                    >
                      查看完整内容
                    </button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
        <Pager
          page={list.data?.page ?? page}
          totalPages={list.data?.totalPages ?? 1}
          total={list.data?.total ?? 0}
          onPage={setPage}
        />
      </Card>
      {detail && (
        <div id="spider-world-data-detail" className="scroll-mt-6">
        <Card
          title={`数据详情 · ${detail.financeArrayJson?.title || detail.financeArrayJson?.name || detail.assetCode || detail.dataSubType}`}
          icon={FileSearch}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <ReadableBlock
              title="数据身份"
              rows={[
                ["数据编号", detail.uuid],
                [
                  "大类 / 子类",
                  `${detail.dataTopType} / ${detail.dataSubType}`,
                ],
                ["标的代码", detail.assetCode ?? "无"],
                ["资产类型", detail.assetType ?? "综合数据"],
                ["上市状态", detail.listStatus ?? "不适用"],
                ["质量等级", detail.dataQualityLevel],
              ]}
            />
            <ReadableBlock
              title="来源与时间"
              rows={[
                ["来源机构", detail.sourceName],
                ["来源语言", detail.sourceLanguage ?? "未标"],
                [
                  "地区 / 国家",
                  `${detail.region ?? "全球"} / ${detail.country ?? "—"}`,
                ],
                ["交易所", detail.exchange ?? "—"],
                ["采集时间", formatTime(detail.crawlTime)],
                ["更新时间", formatTime(detail.updateTime)],
              ]}
              link={
                /^https?:\/\//.test(detail.sourceUrl)
                  ? detail.sourceUrl
                  : undefined
              }
            />
            <ReadableBlock
              title="推送与血缘"
              rows={[
                [
                  "候选前端功能",
                  candidateModuleNames(
                    detail.candidatePushModuleIds,
                    `${detail.dataTopType}/${detail.dataSubType}`
                  ) || "待补全",
                ],
                ["是否已推送", detail.isPush ? "是" : "否"],
                ["推送记录", detail.pushRecordId ?? "尚无"],
                ["血缘编号", detail.dataBloodId ?? "尚无"],
                ["实体关系", `${detail.entityRelationIds?.length ?? 0} 条`],
                ["标签", (detail.tagList ?? []).join("、")],
              ]}
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextEvidence
              title="原始内容（保留来源字段）"
              value={detail.rawContent || "无正文；这是结构化清单记录。"}
            />
            <TextEvidence
              title="AI / 规则加工内容"
              value={detail.aiProcessContent || "未执行 AI 改写。"}
            />
            <TextEvidence
              title="结构化金融字段"
              value={jsonText(detail.financeArrayJson)}
            />
            <TextEvidence
              title="资金与时序字段"
              value={jsonText({
                moneyFlow: detail.moneyFlowJson,
                timeSeries: detail.timeSeriesJson,
              })}
            />
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}

function ToolPanel({
  selected,
  onToggle,
}: {
  selected: SelectedData[];
  onToggle: (item: SelectedData) => void;
}) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("");
  const [category, setCategory] = useState("");
  const [market, setMarket] = useState("");
  const [assetType, setAssetType] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const list = trpc.adminSpider.listTools.useQuery(
    {
      query: query || undefined,
      risk: risk || undefined,
      category: category || undefined,
      market: market || undefined,
      assetType: assetType || undefined,
      page: 1,
      pageSize: 100,
    },
    { refetchOnWindowFocus: false }
  );
  return (
    <div className="space-y-5">
      <Card title="finance_tool_union_set 金融工具集合" icon={Wrench}>
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
          <b>工具页不是名称目录：</b>
          每项都能展开查看公式、输入参数、输出结果、适用场景、限制、样例、验证要求、公开方法来源和目标模块。当前匹配{" "}
          {list.data?.total ?? 0} 项。
        </div>
        <div className="mb-4 grid gap-3 lg:grid-cols-5">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索工具、分类、公式说明"
              className="field w-full pl-10"
            />
          </label>
          <select
            aria-label="按工具分类筛选"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="field"
          >
            <option value="">全部工具分类</option>
            {(list.data?.categories ?? []).map((item: string) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="按工具风险筛选"
            value={risk}
            onChange={e => setRisk(e.target.value)}
            className="field"
          >
            <option value="">全部风险等级</option>
            {["低", "中", "高"].map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            aria-label="按适用市场筛选"
            value={market}
            onChange={e => setMarket(e.target.value)}
            placeholder="适用市场，如 全球"
            className="field"
          />
          <input
            aria-label="按适用资产筛选"
            value={assetType}
            onChange={e => setAssetType(e.target.value)}
            placeholder="适用资产，如 期权"
            className="field"
          />
        </div>
        <DataTable
          heads={[
            "选",
            "工具 / 版本",
            "分类与公式",
            "市场 / 资产",
            "风险与限制",
            "目标模块 / 操作",
          ]}
        >
          {(list.data?.rows ?? []).map((row: any) => {
            const contentType = `${row.toolTopCategory}/${row.toolSubCategory}`;
            const candidatePushModuleIds = normalizedCandidateModuleIds(
              row.candidatePushModuleIds,
              contentType
            );
            const item = {
              uuid: row.toolUuid,
              collection: "finance_tool_union_set" as const,
              label: row.toolName,
              contentType,
              candidatePushModuleIds,
            };
            return (
              <tr key={row.toolUuid} className="border-t align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.some(
                      value => value.uuid === row.toolUuid
                    )}
                    onChange={() => onToggle(item)}
                    aria-label={`选择工具 ${row.toolName}`}
                  />
                </td>
                <td className="p-3">
                  <b>{row.toolName}</b>
                  <div className="text-xs text-violet-600">
                    {row.toolVersion}
                  </div>
                  <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                    公开方法文档已结构化
                  </span>
                </td>
                <td className="max-w-sm p-3">
                  <b>
                    {row.toolTopCategory} / {row.toolSubCategory}
                  </b>
                  <code className="mt-2 block whitespace-pre-wrap text-xs text-slate-500">
                    {row.formulaRaw ?? "无公式"}
                  </code>
                </td>
                <td className="p-3 text-xs">
                  {(row.applyMarket ?? []).join("、")}
                  <br />
                  {(row.applyAssetType ?? []).join("、")}
                </td>
                <td className="max-w-xs p-3">
                  <Status value={row.riskLevel ?? "未评级"} />
                  <p className="mt-2 line-clamp-3 text-xs text-slate-500">
                    {row.limitationDesc}
                  </p>
                </td>
                <td className="max-w-xs p-3 text-xs">
                  {candidateModuleNames(
                    row.candidatePushModuleIds,
                    contentType
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDetail(row);
                      revealInlineDetail("spider-tool-detail");
                    }}
                    className="mt-2 block rounded-lg border border-violet-200 px-2.5 py-1.5 font-bold text-violet-700"
                  >
                    查看公式与全部参数
                  </button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
      {detail && (
        <div id="spider-tool-detail" className="scroll-mt-6">
        <Card title={`金融工具详情 · ${detail.toolName}`} icon={Wrench}>
          <div className="grid gap-4 lg:grid-cols-3">
            <ReadableBlock
              title="工具身份"
              rows={[
                ["工具编号", detail.toolUuid],
                [
                  "分类",
                  `${detail.toolTopCategory} / ${detail.toolSubCategory}`,
                ],
                ["版本", detail.toolVersion],
                ["质量", detail.dataQualityLevel],
                ["风险等级", detail.riskLevel ?? "未评级"],
              ]}
            />
            <ReadableBlock
              title="适用范围"
              rows={[
                ["适用市场", (detail.applyMarket ?? []).join("、")],
                ["适用资产", (detail.applyAssetType ?? []).join("、")],
                ["依赖工具", (detail.dependToolUuids ?? []).join("、") || "无"],
                [
                  "目标前端功能",
                  candidateModuleNames(
                    detail.candidatePushModuleIds,
                    `${detail.toolTopCategory}/${detail.toolSubCategory}`
                  ),
                ],
              ]}
            />
            <ReadableBlock
              title="公开证据"
              rows={[
                ["方法来源", detail.sourceUrl],
                ["采集时间", formatTime(detail.crawlTime)],
                ["更新时间", formatTime(detail.updateTime)],
                ["血缘编号", detail.dataBloodId ?? "尚无"],
                ["标签", (detail.tagList ?? []).join("、")],
              ]}
              link={detail.sourceUrl}
            />
          </div>
          <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-5">
            <div className="text-xs font-black uppercase tracking-widest text-violet-600">
              结构化公式
            </div>
            <code className="mt-2 block text-lg font-black text-violet-950">
              {detail.formulaRaw || "无公式"}
            </code>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ParameterTable title="输入参数" rows={detail.inputParams ?? []} />
            <ParameterTable title="输出结果" rows={detail.outputParams ?? []} />
            <TextEvidence title="适用场景" value={detail.sceneDesc} />
            <TextEvidence
              title="限制与使用陷阱"
              value={detail.limitationDesc}
            />
            <TextEvidence title="样例" value={jsonText(detail.sampleCase)} />
            <TextEvidence
              title="回测与验证要求"
              value={jsonText(detail.backtestSample)}
            />
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}

function PushDock({
  modules,
  selectedData,
  selectedModules,
  onToggleModule,
  onApplyRecommended,
  onClear,
  onPush,
  pending,
  lastReceipts,
  onResend,
}: any) {
  const [search, setSearch] = useState("");
  const [concreteModuleId, setConcreteModuleId] = useState("");
  const domains = [
    ...new Set(modules.map((item: any) => item.domain)),
  ] as string[];
  const moduleIdSet = new Set(modules.map((item: any) => item.id));
  const recommendedIds = [
    ...new Set(
      selectedData.flatMap((item: SelectedData) => {
        return normalizedCandidateModuleIds(
          item.candidatePushModuleIds,
          item.contentType
        );
      })
    ),
  ].filter(id => moduleIdSet.has(id));
  const recommendedSet = new Set(recommendedIds);
  const filtered = modules
    .filter(
      (item: any) =>
        (!search ||
          `${item.id} ${item.name} ${item.path} ${item.domain}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!concreteModuleId || item.id === concreteModuleId)
    )
    .sort(
      (left: any, right: any) =>
        Number(recommendedSet.has(right.id)) -
        Number(recommendedSet.has(left.id))
    );
  const selectedTargets = modules.filter((item: any) =>
    selectedModules.includes(item.id)
  );
  return (
    <section id="spider-push-dock" className="scroll-mt-6 rounded-[26px] border-2 border-emerald-200 bg-[#fcfffd] p-6 shadow-[0_18px_50px_rgba(5,150,105,.14)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Send className="h-5 w-5 text-emerald-600" />
            人工筛选定向推送
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            已选 {selectedData.length} 条数据，目标 {selectedModules.length}{" "}
            个具体前端功能；数据与具体模块两项都必须人工勾选。
          </p>
        </div>
        <button type="button" onClick={onClear} className="secondary">
          清除全部选择
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-cyan-950">
        <b>具体化定向：</b>终端全部 {modules.length}{" "}
        个功能模块逐项列出。业务领域只作为下拉框内的视觉分段，每个选项都是一个真实功能模块，不会用“行情与市场”等大类代替目标功能。
      </div>
      {selectedData.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="flex-1">
            智能匹配找到 {recommendedIds.length}{" "}
            个现有具体功能；只辅助勾选，仍需人工确认后执行。
          </span>
          <button
            type="button"
            disabled={!recommendedIds.length}
            onClick={() => onApplyRecommended(recommendedIds)}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
          >
            勾选智能匹配结果
          </button>
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(320px,1.25fr)]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索具体功能的名称、模块 ID、路径"
            className="field w-full pl-10"
          />
        </label>
        <select
          aria-label="选择具体前端功能模块"
          value={concreteModuleId}
          onChange={e => setConcreteModuleId(e.target.value)}
          className="field"
        >
          <option value="">全部具体功能模块（{modules.length}）</option>
          {domains.map(domain => (
            <optgroup key={domain} label={domain}>
              {modules
                .filter((item: any) => item.domain === domain)
                .map((module: any) => (
                  <option key={module.id} value={module.id}>
                    {module.name} · {module.id} · {module.path}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          当前显示 {filtered.length} / {modules.length} 个具体功能
        </span>
        {concreteModuleId && (
          <button
            type="button"
            onClick={() => setConcreteModuleId("")}
            className="font-bold text-sky-700"
          >
            返回全部具体功能
          </button>
        )}
      </div>
      <div className="mt-3 grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((module: any) => (
          <label
            key={module.id}
            className={`cursor-pointer rounded-xl border p-3 ${selectedModules.includes(module.id) ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}
          >
            <div className="flex gap-2">
              <input
                type="checkbox"
                checked={selectedModules.includes(module.id)}
                onChange={() => onToggleModule(module.id)}
                aria-label={`选择具体前端功能 ${module.name} ${module.id}`}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm">{module.name}</b>
                  {recommendedSet.has(module.id) && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-700">
                      智能匹配
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">
                  模块 ID：{module.id}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">
                  前端路径：{module.path}
                </div>
                <div className="mt-1 text-[11px] text-sky-600">
                  接收内容：{module.target}
                </div>
                <div className="mt-1 text-[10px] text-emerald-700">
                  写入凭证：{module.deliveryEvidence}
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
                  读取接口：{module.feedEndpoint}
                </div>
                <div className="mt-1 text-[10px] font-bold text-violet-600">
                  所属领域：{module.domain}
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>
      {selectedTargets.length > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-black text-emerald-900">
            已选具体目标功能
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTargets.map((module: any) => (
              <button
                type="button"
                key={module.id}
                onClick={() => onToggleModule(module.id)}
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-left text-xs text-emerald-900"
              >
                <b>{module.name}</b>
                <span className="ml-1 font-mono text-emerald-700">
                  {module.id} · {module.path}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        <div className="flex-1 text-sm text-slate-600">
          {selectedData
            .slice(0, 4)
            .map((item: SelectedData) => `${item.label}（${item.contentType}）`)
            .join("；")}
          {selectedData.length > 4 ? `；另 ${selectedData.length - 4} 条` : ""}
        </div>
        <button
          type="button"
          disabled={pending || !selectedData.length || !selectedModules.length}
          onClick={onPush}
          className="primary bg-emerald-600 hover:bg-emerald-700"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {pending
            ? "正在写入已选具体功能"
            : `人工推送 ${selectedData.length} 条到 ${selectedModules.length} 个具体功能`}
        </button>
      </div>
      {lastReceipts?.length > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div className="font-black text-emerald-900">
            最近一次真实写入回执（{lastReceipts.length}）
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {lastReceipts.map((receipt: DeliveryReceipt) => (
              <div
                key={receipt.contentKey}
                className="rounded-lg border border-emerald-200 bg-white p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>{receipt.moduleName}</b>
                    <span className="ml-2 font-mono text-emerald-700">
                      {receipt.moduleId}
                    </span>
                  </div>
                  <Status
                    value={
                      receipt.duplicateBlocked ||
                      receipt.currentStatus === "duplicate_blocked"
                        ? "重复已拦截"
                        : receipt.frontReadConfirmed
                          ? "前端已确认接收"
                          : receipt.failureCount
                            ? "发送失败"
                            : "等待前端确认"
                    }
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <ReadableBlock
                    title="任务与目标"
                    rows={[
                      ["任务编号", receipt.receiptId ?? receipt.contentKey],
                      [
                        "推送时间",
                        formatTime(receipt.sentAt ?? receipt.publishedAt),
                      ],
                      [
                        "目标范围",
                        receipt.targetScope ??
                          `${receipt.moduleName} · ${receipt.frontPath}`,
                      ],
                    ]}
                  />
                  <ReadableBlock
                    title="送达核验"
                    rows={[
                      [
                        "发送数量",
                        receipt.sentCount ?? (receipt.duplicateBlocked ? 0 : 1),
                      ],
                      [
                        "成功数量",
                        receipt.successCount ??
                          (receipt.frontReadConfirmed ? 1 : 0),
                      ],
                      ["失败数量", receipt.failureCount ?? 0],
                      ["前端确认时间", formatTime(receipt.frontAckAt)],
                      ["已确认终端", receipt.acknowledgedClientCount ?? 0],
                      ["失败原因", receipt.failureReason || "无"],
                      [
                        "重试状态",
                        receipt.retryStatus === "retry_available"
                          ? "可重试"
                          : receipt.retryStatus === "retrying"
                            ? "重试中"
                            : "无需重试",
                      ],
                    ]}
                  />
                </div>
                {receipt.title && (
                  <div className="mt-2 rounded border border-emerald-100 bg-emerald-50/60 p-2">
                    <b className="text-emerald-950">{receipt.title}</b>
                    {receipt.body && (
                      <p className="mt-1 line-clamp-3 text-slate-600">
                        {receipt.body}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">
                    当前功能可见 {receipt.visibleItemCount ?? 0} 条 · 后台复核{" "}
                    {formatTime(receipt.verifiedAt)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        pending ||
                        !receipt.sourceDataUuid ||
                        !receipt.sourceCollection
                      }
                      onClick={() => onResend(receipt)}
                      className="rounded border border-sky-300 bg-white px-2 py-1 font-bold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      再次发送
                    </button>
                    <a
                      href={receipt.frontPath}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-emerald-300 bg-white px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      打开前端核验
                    </a>
                  </div>
                </div>
                <code className="mt-1 block break-all text-[10px] text-slate-400">
                  {receipt.contentKey}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ScanPanel({ rows, busy, onRun }: any) {
  const utils = trpc.useUtils();
  const schedule = trpc.adminDataModuleAutomation.getSchedule.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const enableSchedule =
    trpc.adminDataModuleAutomation.enableSchedule.useMutation({
      onSuccess: async () => {
        toast.success(
          "持续巡检已启用：后台每 30 分钟检查一次缺失、过期、失败和未覆盖模块。"
        );
        await utils.adminDataModuleAutomation.getSchedule.invalidate();
      },
      onError: error => toast.error(`持续巡检未启用：${error.message}`),
    });
  const setSchedule =
    trpc.adminDataModuleAutomation.setScheduleEnabled.useMutation({
      onSuccess: async result => {
        toast.success(
          result.isEnabled ? "持续巡检已恢复。" : "持续巡检已暂停。"
        );
        await utils.adminDataModuleAutomation.getSchedule.invalidate();
      },
      onError: error => toast.error(`巡检状态未更新：${error.message}`),
    });
  const scheduleBusy = enableSchedule.isPending || setSchedule.isPending;
  return (
    <div className="space-y-5">
      <Card title="持续闭环巡检工作器" icon={Activity}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Status
                value={
                  schedule.data?.isEnabled
                    ? "持续运行"
                    : schedule.data
                      ? "已暂停"
                      : "尚未配置"
                }
              />
              <b className="text-slate-900">检查频率：每 30 分钟</b>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              工作器持久化运行，不依赖当前页面保持打开。每次核对全部前端功能的已交付内容、更新时间、失败状态与来源覆盖；发现缺口后完成采集、质量检查、模块级去重和版本判断，符合该功能自动审批策略的内容会送达原页面，等待前端实际渲染回执。
            </p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="计划编号"
                value={schedule.data?.scheduleCronTaskUid ?? "未创建"}
              />
              <MiniStat
                label="最近运行"
                value={formatTime(schedule.data?.lastRunAt)}
              />
              <MiniStat
                label="最近排程"
                value={formatTime(schedule.data?.lastScheduledAt)}
              />
              <MiniStat
                label="最近错误"
                value={schedule.data?.lastError ?? "无"}
              />
            </div>
          </div>
          <div className="flex items-start gap-2">
            {!schedule.data ? (
              <button
                type="button"
                disabled={scheduleBusy}
                onClick={() =>
                  enableSchedule.mutate({ cron: "0 */30 * * * *" })
                }
                className="primary"
              >
                <Play className="h-4 w-4" />
                开启持续巡检
              </button>
            ) : (
              <button
                type="button"
                disabled={scheduleBusy}
                onClick={() =>
                  setSchedule.mutate({ enabled: !schedule.data?.isEnabled })
                }
                className="primary"
              >
                {schedule.data.isEnabled ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {schedule.data.isEnabled ? "暂停持续巡检" : "恢复持续巡检"}
              </button>
            )}
          </div>
        </div>
      </Card>
      <Card
        title="AI 闭环巡检规则"
        icon={FileSearch}
        action={
          <button
            type="button"
            disabled={busy}
            onClick={onRun}
            className="primary"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4" />
            )}
            执行缺口差集巡检
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            [
              "集合差集",
              "权威公开清单 vs 本地标的、财报、公告、工具与退市历史",
            ],
            [
              "前端缺口",
              "逐一检查全部已登记功能的缺失、过期、字段残缺与未交付状态",
            ],
            [
              "跨源去重",
              "内容哈希、实体代码和来源 URL 联合排重，保留全部来源证据",
            ],
            [
              "质量校验",
              "OHLC 逻辑、财务勾稽、字段完整性、时序连续性和来源可达性",
            ],
            ["实体补全", "自动补齐新标的/工具标签、代码、关联实体和候选模块"],
            [
              "版本与死链",
              "源页面变化生成新快照；种子健康探测标记降级、404 与不可达",
            ],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-xl border bg-slate-50 p-4 text-sm font-semibold"
            >
              <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-500" />
              <b>{title}</b>
              <p className="mt-1 text-xs font-normal leading-5 text-slate-500">
                {text}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
          巡检只会建立 spider_task 采集任务；禁止自动创建
          spider_push_relation，禁止自动写前端模块。
        </p>
      </Card>
      <Card title="spider_missing_scan_log 巡检日志" icon={FileClock}>
        <DataTable
          heads={[
            "时间",
            "巡检范围",
            "缺失模块",
            "生成采集任务",
            "状态",
            "检查结论",
          ]}
        >
          {rows.map((row: any) => (
            <tr key={row.scanUuid} className="border-t">
              <td className="p-3 text-xs">{formatTime(row.startedAt)}</td>
              <td className="p-3">
                {row.scanType}
                <br />
                <span className="text-xs text-sky-600">{row.missingType}</span>
              </td>
              <td className="p-3 font-bold">{row.missingCount}</td>
              <td className="p-3">
                <b>{row.generatedTaskUuids?.length ?? 0} 条</b>
                <div className="mt-1 max-w-xs text-[10px] text-slate-400">
                  {(row.generatedTaskUuids ?? []).slice(0, 3).join("、")}
                  {row.generatedTaskUuids?.length > 3 ? "…" : ""}
                </div>
              </td>
              <td className="p-3">
                <Status value={row.scanStatus} />
              </td>
              <td className="max-w-md p-3 text-xs text-slate-500">
                <b className="text-slate-700">
                  {row.sourceScope} → {row.targetScope}
                </b>
                <div className="mt-1">{row.detail}</div>
                <details className="mt-2">
                  <summary className="cursor-pointer font-bold text-sky-600">
                    查看缺失模块 ID
                  </summary>
                  <div className="mt-1 break-all">
                    {(row.missingKeys ?? []).join("、") || "本次无缺口"}
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
function FailurePanel({ rows, busy, onRetry }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Card
      title="spider_fail_log 抓取 / 解析 / AI 失败监控"
      icon={CircleAlert}
      action={
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => onRetry(selected)}
          className="primary"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          重试已选 {selected.length} 条
        </button>
      }
    >
      <DataTable
        heads={["选", "阶段 / 分类", "任务与来源", "重试", "状态", "错误详情"]}
      >
        {rows.map((row: any) => (
          <tr key={row.failUuid} className="border-t">
            <td className="p-3">
              <input
                type="checkbox"
                checked={selected.includes(row.failUuid)}
                onChange={() =>
                  setSelected(current =>
                    current.includes(row.failUuid)
                      ? current.filter(id => id !== row.failUuid)
                      : [...current, row.failUuid]
                  )
                }
              />
            </td>
            <td className="p-3">
              <b>{row.stage}</b>
              <div className="text-xs text-rose-600">{row.failType}</div>
            </td>
            <td className="max-w-xs p-3 text-xs">
              <code>{row.taskUuid}</code>
              <div className="mt-1 truncate text-sky-600">{row.sourceUrl}</div>
            </td>
            <td className="p-3">
              {row.retryCount}
              <div className="text-xs text-slate-500">{row.retryStrategy}</div>
            </td>
            <td className="p-3">
              <Status value={row.status} />
            </td>
            <td className="max-w-md p-3 text-xs text-slate-500">
              {row.errorDetail}
            </td>
          </tr>
        ))}
      </DataTable>
      {!rows.length && (
        <Empty text="当前没有失败记录。抓取、解析和 AI 失败都会在这里分类留痕。" />
      )}
    </Card>
  );
}
function SnapshotPanel({ rows }: any) {
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const utils = trpc.useUtils();
  const runAi = trpc.adminSpider.runAi.useMutation({
    onSuccess: async result => {
      setAiResult(result);
      toast.success(
        result.duplicateBlocked
          ? "相同原始内容已经完成过这项加工，本次沿用原结果，没有重复入库。"
          : "内容加工完成，结果已写入处理记录。"
      );
      await utils.adminSpider.dashboard.invalidate();
    },
    onError: error => toast.error(`内容加工未完成：${error.message}`),
  });
  const types = [
    ...new Set(rows.map((row: any) => row.entityType)),
  ] as string[];
  const visible = rows.filter((row: any) => !type || row.entityType === type);
  return (
    <div className="space-y-5">
      <Card
        title={`spider_content_snapshot 内容版本快照（${visible.length}）`}
        icon={Archive}
        action={
          <select
            aria-label="按快照类型筛选"
            value={type}
            onChange={e => setType(e.target.value)}
            className="field"
          >
            <option value="">全部快照类型</option>
            {types.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        }
      >
        <p className="mb-4 rounded-xl bg-sky-50 p-4 text-sm leading-6 text-sky-950">
          每份快照都回答四件事：
          <b>是什么数据、来自哪里、保存了多少内容、与上一版本发生了什么变化</b>
          。点击“查看快照”可直接阅读内容摘要，不再只显示 UUID 和哈希。
        </p>
        <DataTable
          heads={[
            "数据名称 / 类型",
            "版本",
            "来源",
            "保存内容",
            "变更与校验",
            "时间 / 操作",
          ]}
        >
          {visible.map((row: any) => (
            <tr key={row.snapshotUuid} className="border-t">
              <td className="max-w-sm p-3">
                <b>{row.entityName}</b>
                <div className="mt-1 text-xs text-sky-600">{row.dataType}</div>
                <code className="mt-1 block text-[10px] text-slate-400">
                  {row.entityUuid}
                </code>
              </td>
              <td className="p-3 font-bold">v{row.version}</td>
              <td className="max-w-xs p-3 text-xs">
                <b>{row.sourceName}</b>
                {/^https?:\/\//.test(row.sourceUrl ?? "") && (
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-sky-600 hover:underline"
                  >
                    打开原始来源
                  </a>
                )}
              </td>
              <td className="max-w-sm p-3 text-xs">
                <b>{Number(row.contentBytes ?? 0).toLocaleString()} 字节</b>
                <p className="mt-1 line-clamp-2 text-slate-500">
                  {row.contentPreview || "无可预览文本"}
                </p>
              </td>
              <td className="max-w-sm p-3 text-xs">
                <b>{row.changeSummary}</b>
                <div className="mt-1 font-mono text-[10px] text-slate-400">
                  SHA-256 {row.contentHash}
                </div>
              </td>
              <td className="p-3 text-xs">
                {formatTime(row.createdAt)}
                <button
                  type="button"
                  onClick={() => {
                    setSelected(row);
                    setAiResult(null);
                    revealInlineDetail("spider-snapshot-detail");
                  }}
                  className="mt-2 block rounded-lg border border-sky-200 px-2 py-1 font-bold text-sky-700"
                >
                  查看快照
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        {!rows.length && (
          <Empty text="执行公开来源采集或页面版本比对后，快照会按实体和版本显示在这里。" />
        )}
      </Card>
      {selected && (
        <div id="spider-snapshot-detail" className="scroll-mt-6">
        <Card
          title={`快照详情 · ${selected.entityName} · v${selected.version}`}
          icon={Archive}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <ReadableBlock
              title="快照身份"
              rows={[
                ["快照编号", selected.snapshotUuid],
                ["数据编号", selected.entityUuid],
                ["实体类型", selected.entityType],
                ["版本", `v${selected.version}`],
                ["保存时间", formatTime(selected.createdAt)],
              ]}
            />
            <ReadableBlock
              title="来源证据"
              rows={[
                ["来源机构", selected.sourceName],
                ["原始 URL", selected.sourceUrl ?? "—"],
                ["关联原始记录", selected.rawUuid ?? "—"],
                [
                  "内容字节",
                  Number(selected.contentBytes ?? 0).toLocaleString(),
                ],
              ]}
              link={selected.sourceUrl}
            />
            <ReadableBlock
              title="版本校验"
              rows={[
                ["变更摘要", selected.changeSummary],
                ["内容 SHA-256", selected.contentHash],
                ["用途", "版本回溯、来源举证、内容变化比对"],
              ]}
            />
          </div>
          <TextEvidence
            title="快照保存内容"
            value={selected.snapshotContent || "无文本内容"}
          />
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b className="text-slate-900">对当前原始记录执行加工</b>
                <p className="mt-1 text-xs text-slate-600">
                  {selected.processable === false
                    ? `该快照是 HTTP ${selected.httpStatus ?? "错误"} 诊断记录，只能查看，不能进入 AI 加工。`
                    : "每项操作只写入一次；相同内容与相同动作会沿用已有结果。"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["news_rewrite", "自然改写正文"],
                  ["entity_extract", "抽取实体"],
                  ["formula_parse", "解析公式"],
                  ["quality_validate", "质量检查"],
                  ["version_compare", "版本比对"],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    disabled={
                      runAi.isPending ||
                      !selected.rawUuid ||
                      selected.processable === false
                    }
                    onClick={() =>
                      runAi.mutate({
                        rawUuid: selected.rawUuid,
                        action: action as "news_rewrite" | "entity_extract" | "formula_parse" | "quality_validate" | "version_compare",
                        rewriteStyle: "plain_language",
                      })
                    }
                    className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-black text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {runAi.isPending && runAi.variables?.action === action ? "处理中…" : label}
                  </button>
                ))}
              </div>
            </div>
            {aiResult && (
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-6 text-slate-700">
                {aiResult.rewrittenContent || jsonText({
                  处理编号: aiResult.processUuid,
                  实体数量: aiResult.entityCount,
                  公式数量: aiResult.formulaCount,
                  重复拦截: Boolean(aiResult.duplicateBlocked),
                })}
              </pre>
            )}
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}
function GraphPanel({ rows, dataRows, tools }: any) {
  void dataRows;
  void tools;
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState("");
  const relations = [
    ...new Set(rows.map((row: any) => row.relationType)),
  ] as string[];
  const links = rows.filter(
    (row: any) =>
      (!relation || row.relationType === relation) &&
      (!query ||
        `${row.sourceName} ${row.targetName} ${row.sourceEntityType} ${row.targetEntityType}`
          .toLowerCase()
          .includes(query.toLowerCase()))
  );
  return (
    <Card title="标的－新闻－工具－企业实体关联图谱" icon={Network}>
      <div className="mb-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
        这里只显示数据库中已经写入的真实关系记录。每条边都显示可读实体名称、关系类型、置信度和原始证据；不再生成临时预览关系。
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <input
          aria-label="搜索图谱实体"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索数据名称、来源机构或实体类型"
          className="field"
        />
        <select
          aria-label="按关系类型筛选"
          value={relation}
          onChange={e => setRelation(e.target.value)}
          className="field"
        >
          <option value="">全部关系类型</option>
          {relations.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {links.map((row: any) => (
          <div
            key={row.linkUuid}
            className="relative rounded-2xl border bg-slate-50 p-5"
          >
            <div className="flex items-center gap-3">
              <Node
                type={row.sourceEntityType}
                id={row.sourceEntityUuid}
                name={row.sourceName}
              />
              <div className="min-w-24 text-center">
                <GitBranch className="mx-auto h-5 w-5 text-sky-500" />
                <div className="mt-1 text-xs font-bold text-sky-600">
                  {row.relationType}
                </div>
                <div className="text-[10px] text-slate-400">
                  置信 {Number(row.confidence).toFixed(2)}
                </div>
              </div>
              <Node
                type={row.targetEntityType}
                id={row.targetEntityUuid}
                name={row.targetName}
              />
            </div>
            <div className="mt-4 border-t pt-3 text-xs text-slate-500">
              <b>关系记录：</b>
              {row.linkUuid}
              <br />
              <b>原始证据：</b>
              {row.evidence?.length
                ? row.evidence.map((evidence: any) =>
                    evidence.sourceUrl ? (
                      <a
                        key={evidence.rawUuid}
                        href={evidence.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-sky-600 hover:underline"
                      >
                        {evidence.rawUuid.slice(0, 12)}…
                      </a>
                    ) : (
                      <span key={evidence.rawUuid}>{evidence.rawUuid}</span>
                    )
                  )
                : "无原始记录绑定"}
            </div>
          </div>
        ))}
      </div>
      {!links.length && (
        <Empty text="没有符合筛选条件的实体关系。执行真实公开来源采集和实体抽取后，关系会在这里建立。" />
      )}
    </Card>
  );
}
function LineagePanel({ examples }: any) {
  const [uuid, setUuid] = useState(
    examples[0]?.uuid ?? examples[0]?.toolUuid ?? ""
  );
  const lineage = trpc.adminSpider.lineage.useQuery(
    { dataUuid: uuid },
    { enabled: uuid.length >= 8, refetchOnWindowFocus: false }
  );
  return (
    <Card title="结构化数据反向定位原始源" icon={GitBranch}>
      <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        选择一条数据后，按顺序展示：
        <b>
          这是什么 → 来自哪里 → 原始抓取证据 → 做过哪些转换 → 保存过哪些版本 →
          与谁关联 → 是否推送到前端
        </b>
        。
      </p>
      <div className="flex gap-3">
        <input
          value={uuid}
          onChange={e => setUuid(e.target.value)}
          placeholder="输入数据 UUID / tool_uuid"
          className="field flex-1"
        />
        <button
          type="button"
          onClick={() => lineage.refetch()}
          disabled={uuid.length < 8}
          className="primary"
        >
          <Search className="h-4 w-4" />
          查询血缘
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((row: any) => (
          <button
            key={row.uuid ?? row.toolUuid}
            onClick={() => setUuid(row.uuid ?? row.toolUuid)}
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold"
          >
            {row.financeArrayJson?.title ??
              row.financeArrayJson?.name ??
              row.assetCode ??
              row.toolName ??
              row.dataSubType ??
              "示例数据"}
          </button>
        ))}
      </div>
      {lineage.isFetching ? (
        <Loading />
      ) : (
        lineage.data &&
        (lineage.data.found ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="数据名称" value={lineage.data.summary?.title} />
              <MiniStat
                label="集合 / 类型"
                value={`${lineage.data.summary?.collection} · ${lineage.data.summary?.dataType}`}
              />
              <MiniStat
                label="质量 / 真实性"
                value={`${lineage.data.summary?.quality} · ${lineage.data.summary?.sourceKind}`}
              />
              <MiniStat
                label="更新时间"
                value={formatTime(lineage.data.summary?.updatedAt)}
              />
            </div>
            <Card
              title={`① 来源证据（${lineage.data.sources.length}）`}
              icon={Globe2}
            >
              {lineage.data.sources.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {lineage.data.sources.map((source: any, index: number) => (
                    <div
                      key={`${source.sourceUrl}-${index}`}
                      className="rounded-xl border bg-slate-50 p-4"
                    >
                      <b>{source.sourceName}</b>
                      {source.originalAvailable ? (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all text-sm text-sky-600 hover:underline"
                        >
                          {source.sourceUrl}
                        </a>
                      ) : (
                        <div className="mt-1 break-all text-sm text-slate-500">
                          {source.sourceUrl}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span>HTTP：{source.httpStatus ?? "导入数据"}</span>
                        <span>采集：{formatTime(source.capturedAt)}</span>
                        <span className="col-span-2 font-mono text-[10px]">
                          原始记录：{source.rawUuid ?? "无独立原始抓取"}
                        </span>
                        <span className="col-span-2 font-mono text-[10px]">
                          内容哈希：{source.contentHash ?? "由导入文件哈希证明"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="该记录来自用户导入清单，来源文件信息保存在数据记录中，没有单独网页抓取记录。" />
              )}
            </Card>
            <Card
              title={`② 加工步骤（${lineage.data.steps.length}）`}
              icon={Sparkles}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {lineage.data.steps.map((step: any) => (
                  <div
                    key={`${step.bloodId}-${step.order}`}
                    className="rounded-xl border bg-white p-4"
                  >
                    <div className="text-xs font-black text-sky-600">
                      步骤 {step.order}
                    </div>
                    <b className="mt-1 block">{humanStep(step.name)}</b>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {step.detail}
                    </p>
                    <div className="mt-2 text-[10px] text-slate-400">
                      {formatTime(step.at)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card
                title={`③ 版本快照（${lineage.data.snapshots.length}）`}
                icon={Archive}
              >
                {lineage.data.snapshots.length ? (
                  lineage.data.snapshots.map((snapshot: any) => (
                    <div
                      key={snapshot.snapshotUuid}
                      className="mb-3 rounded-xl border p-4"
                    >
                      <b>
                        v{snapshot.version} · {snapshot.changeSummary}
                      </b>
                      <p className="mt-2 line-clamp-3 text-xs text-slate-500">
                        {snapshot.contentPreview}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-400">
                        {snapshot.contentBytes} 字节 · SHA-256{" "}
                        {snapshot.contentHash}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="尚无版本快照。" />
                )}
              </Card>
              <Card
                title={`④ 实体关系（${lineage.data.links.length}）`}
                icon={Network}
              >
                {lineage.data.links.length ? (
                  lineage.data.links.map((link: any) => (
                    <div
                      key={link.linkUuid}
                      className="mb-3 rounded-xl border p-4 text-sm"
                    >
                      <b>{link.sourceEntityType}</b>
                      <span className="mx-2 text-sky-600">
                        — {link.relationType} →
                      </span>
                      <b>{link.targetEntityType}</b>
                      <div className="mt-1 text-xs text-slate-500">
                        置信度 {Number(link.confidence).toFixed(2)} · 证据{" "}
                        {link.evidence?.length ?? 0} 条
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="尚无实体关系。" />
                )}
              </Card>
            </div>
            <Card
              title={`⑤ 人工推送记录（${lineage.data.pushes.length}）`}
              icon={Send}
            >
              {lineage.data.pushes.length ? (
                <DataTable
                  heads={["操作时间", "管理员", "目标前端功能", "状态", "说明"]}
                >
                  {lineage.data.pushes.map((push: any) => (
                    <tr key={push.uuid} className="border-t">
                      <td className="p-3 text-xs">
                        {formatTime(push.operateTime)}
                      </td>
                      <td className="p-3">{push.operator}</td>
                      <td className="p-3 text-xs">
                        {push.targetModules.map((module: any) => (
                          <div key={module.moduleId}>
                            <b>{module.moduleName}</b> ·{" "}
                            <span className="font-mono text-sky-600">
                              {module.moduleId} · {module.path}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="p-3">
                        <Status value={push.pushStatus} />
                      </td>
                      <td className="max-w-md p-3 text-xs">
                        {push.pushDetail}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              ) : (
                <Empty text="该数据尚未人工推送到前端功能。" />
              )}
            </Card>
          </div>
        ) : (
          <Empty text="没有找到这个数据编号。请从上方示例数据中选择，或复制集合数据浏览里的 UUID。" />
        ))
      )}
    </Card>
  );
}

function FilterBar({
  query,
  onQuery,
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
      <label className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="全文搜索名称、代码、交易所或正文"
          className="field w-full pl-10"
        />
      </label>
      {children}
    </div>
  );
}
function humanStep(value: string) {
  const labels: Record<string, string> = {
    fetch: "抓取公开来源",
    fetch_public_feed: "抓取公开信息流",
    parse_feed_entry: "解析单条信息",
    normalize: "字段归一化",
    plain_language_rewrite: "大白话改写",
    quality_check: "质量检查",
    equity_listings_import: "导入全球股票清单",
  };
  return labels[value] ?? value;
}
function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-[11px] font-bold text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-black text-slate-800">
        {value ?? "—"}
      </div>
    </div>
  );
}
function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label?: string | null; value: number | string }>;
  total: number;
}) {
  const sorted = [...rows].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <b>{title}</b>
        <span className="text-xs text-slate-400">
          合计 {Number(total).toLocaleString()}
        </span>
      </div>
      <div className="space-y-3">
        {sorted.slice(0, 8).map((row, index) => {
          const count = Number(row.value);
          const pct = total
            ? Math.max(1, Math.round((count / total) * 100))
            : 0;
          return (
            <div key={`${row.label}-${index}`}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{row.label || "未分类"}</span>
                <b>
                  {count.toLocaleString()} · {pct}%
                </b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ReadableBlock({
  title,
  rows,
  link,
}: {
  title: string;
  rows: Array<[string, React.ReactNode]>;
  link?: string;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <b>{title}</b>
        {link && /^https?:\/\//.test(link) && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-sky-600 hover:underline"
          >
            打开来源
          </a>
        )}
      </div>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 border-t border-slate-200 pt-2 text-xs"
          >
            <dt className="font-bold text-slate-400">{label}</dt>
            <dd className="break-all text-slate-700">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
function TextEvidence({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <b>{title}</b>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
        {typeof value === "string" ? value : jsonText(value)}
      </pre>
    </div>
  );
}
function ParameterTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <b>
        {title}（{rows.length}）
      </b>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="p-2">名称</th>
                <th className="p-2">类型</th>
                <th className="p-2">范围/默认</th>
                <th className="p-2">说明</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-t">
                  <td className="p-2 font-mono font-bold">
                    {String(row.name ?? "—")}
                  </td>
                  <td className="p-2">{String(row.type ?? "—")}</td>
                  <td className="p-2">
                    {String(row.range ?? row.default ?? "—")}
                  </td>
                  <td className="p-2">{String(row.desc ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">暂无参数定义。</p>
      )}
    </div>
  );
}
function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>
        共 {Number(total).toLocaleString()} 条 · 第 {page} / {totalPages} 页
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="secondary disabled:opacity-40"
        >
          上一页
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="secondary disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-white/80 bg-[#fcfdff] p-6 shadow-[0_16px_40px_rgba(20,40,75,.13)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <Icon className="h-5 w-5 text-sky-500" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-[#fcfdff] p-6 shadow-[0_16px_40px_rgba(20,40,75,.13)]">
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}
function Capability({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <b>{title}</b>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(item => (
          <span
            key={item}
            className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
function DataTable({
  heads,
  children,
}: {
  heads: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            {heads.map(head => (
              <th key={head} className="p-3">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const positive = [
    "completed",
    "healthy",
    "L1",
    "L2",
    "已人工推送",
    "resolved",
  ].includes(value);
  const negative = ["failed", "dead", "unreachable", "L4", "open"].includes(
    value
  );
  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${positive ? "bg-emerald-100 text-emerald-700" : negative ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}
    >
      {value}
    </span>
  );
}
function SmallButton({
  icon: Icon,
  children,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-40 ${danger ? "border-rose-200 text-rose-600" : "border-slate-200 bg-white text-slate-700"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
function Loading() {
  return (
    <div className="grid min-h-44 place-items-center rounded-2xl border bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
function Node({ type, id, name }: { type: string; id: string; name?: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border bg-white p-3 text-center">
      <div className="font-bold text-slate-800">{type}</div>
      <div className="mt-1 text-xs font-semibold text-slate-700">
        {name ?? "未命名实体"}
      </div>
      <div className="mt-1 truncate font-mono text-[10px] text-slate-400">
        {id}
      </div>
    </div>
  );
}
function Detail({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <b>{title}</b>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-slate-500">
        {jsonText(value)}
      </pre>
    </div>
  );
}
function OperationEntry({
  title,
  detail,
  value,
  onClick,
}: {
  title: string;
  detail: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-cyan-100 bg-white p-4 text-left shadow-[0_10px_30px_rgba(14,165,233,.10)] transition hover:-translate-y-0.5 hover:border-cyan-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black text-slate-900">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-cyan-500 transition group-hover:translate-x-1" />
      </div>
      <div className="mt-3 text-sm font-black text-cyan-700">{value}</div>
    </button>
  );
}
