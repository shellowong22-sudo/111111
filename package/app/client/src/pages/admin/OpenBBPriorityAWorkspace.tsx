import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Database,
  Eye,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const statusText: Record<string, string> = {
  running: "运行中",
  succeeded: "成功",
  empty: "空结果",
  failed: "失败",
  not_configured: "未配置",
  waiting_front_ack: "等待 ACK",
  front_acknowledged: "前端已确认",
  duplicate_blocked: "重复拦截",
};
const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";
const PAGE_SIZE = 50;
const API_PAGE_SIZE = 40;
const displayValue = (value: unknown) =>
  typeof value === "number" && !Number.isInteger(value)
    ? value.toLocaleString("en-US", {
        useGrouping: false,
        maximumFractionDigits: 8,
      })
    : String(value ?? "—");
const apiStateText: Record<string, string> = {
  controlled_ready: "受控代理可执行",
  contract_only: "合同已发现",
  restricted_write: "写操作受限",
  restricted_system: "系统接口受限",
};
const apiStateClass: Record<string, string> = {
  controlled_ready: "text-emerald-300",
  contract_only: "text-amber-300",
  restricted_write: "text-rose-300",
  restricted_system: "text-rose-300",
};
const finceptStatusText: Record<string, string> = {
  connected: "已直接接入",
  mixed_persistent_adapter: "直接与既有混合",
  existing_persistent_adapter: "已有持久适配",
  partial_persistent_adapter: "部分持久化",
  live_volatile_adapter: "实时读取·未归档",
  module_database_only: "页面库数据·未验证刷新",
  dependency_blocked: "依赖未满足",
};
const frontendUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
};
const copyFrontendUrl = async (path: string) => {
  const url = frontendUrl(path);
  try {
    await navigator.clipboard.writeText(url);
    toast.success(`入口地址已复制：${url}`);
  } catch {
    toast.error(`无法自动复制，请手动使用：${url}`);
  }
};

export default function OpenBBPriorityAWorkspace() {
  const utils = trpc.useUtils();
  const workspace = trpc.openbbAdmin.priorityA.useQuery(undefined, {
    retry: false,
    refetchInterval: 3000,
  });
  const data = workspace.data as any;
  const placeholderBindings = (data?.finceptTerminal?.placeholderBindings ?? []) as any[];
  const [endpointId, setEndpointId] = useState("equity_price_historical");
  const [params, setParams] = useState<Record<string, string>>({});
  const [selectedRunId, setSelectedRunId] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [recipientIds, setRecipientIds] = useState<number[]>([]);
  const [moduleFilter, setModuleFilter] = useState("");
  const [rowFilter, setRowFilter] = useState("");
  const [page, setPage] = useState(0);
  const [apiSearch, setApiSearch] = useState("");
  const [apiTag, setApiTag] = useState("");
  const [apiMethod, setApiMethod] = useState("");
  const [apiState, setApiState] = useState("");
  const [apiPage, setApiPage] = useState(0);
  const [coverageFilter,setCoverageFilter]=useState('');
  const [coverageMissing,setCoverageMissing]=useState(false);
  const [selectedApiId, setSelectedApiId] = useState("");
  const [catalogParams, setCatalogParams] = useState<Record<string, string>>({});
  const [catalogBody, setCatalogBody] = useState("");
  const endpoints = data?.endpoints ?? [];
  const definition =
    endpoints.find((item: any) => item.id === endpointId) ?? endpoints[0];
  const runs = data?.runs ?? [];
  const apiCatalog = data?.apiCatalog;
  const apiOperations = (apiCatalog?.operations ?? []) as any[];
  const filteredApiOperations = useMemo(() => {
    const query = apiSearch.trim().toLowerCase();
    return apiOperations.filter(
      (item: any) =>
        (!apiTag || item.tags.includes(apiTag)) &&
        (!apiMethod || item.method === apiMethod) &&
        (!apiState || item.executionState === apiState) &&
        (!query ||
          `${item.path} ${item.operationId} ${item.summary} ${item.description ?? ""} ${item.tags.join(" ")}`
            .toLowerCase()
            .includes(query))
    );
  }, [
    apiCatalog?.checksum,
    apiOperations,
    apiSearch,
    apiTag,
    apiMethod,
    apiState,
  ]);
  const apiPageCount = Math.max(
    1,
    Math.ceil(filteredApiOperations.length / API_PAGE_SIZE)
  );
  const currentApiPage = Math.min(apiPage, apiPageCount - 1);
  const visibleApiOperations = filteredApiOperations.slice(
    currentApiPage * API_PAGE_SIZE,
    (currentApiPage + 1) * API_PAGE_SIZE
  );
  const selectedApi =
    filteredApiOperations.find((item: any) => item.id === selectedApiId) ??
    visibleApiOperations[0] ??
    null;
  const run =
    runs.find((item: any) => item.runId === selectedRunId) ?? runs[0] ?? null;
  const result = run?.result;
  const pushOwner=run?.primaryModuleId??endpoints.find((item:any)=>item.id===run?.endpointId)?.suggestedModuleIds?.[0]??null;
  const pushTarget = ((data?.modules ?? []) as any[]).find((item: any) => item.id === pushOwner) ?? null;
  const modules = useMemo(
    () =>
      ((data?.modules ?? []) as any[]).filter((item: any) =>
        `${item.name} ${item.id} ${item.domain}`
          .toLowerCase()
          .includes(moduleFilter.toLowerCase())
      ),
    [data?.modules, moduleFilter]
  );
  const filteredRows = useMemo(() => {
    const rows = (result?.rows ?? []) as Array<Record<string, unknown>>;
    const query = rowFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row =>
      (result?.columns ?? []).some((column: string) =>
        String(row[column] ?? "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [result?.metadata?.checksum, result?.rows, result?.columns, rowFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  useEffect(() => {
    if (!definition) return;
    setParams(
      Object.fromEntries(
        Object.entries(definition.defaults ?? {}).map(([key, value]) => [
          key,
          String(value),
        ])
      )
    );
    setModuleIds((definition.suggestedModuleIds ?? []).slice(0,1));
  }, [definition?.id]);
  useEffect(() => {
    if (!selectedRunId && runs[0]?.runId) {
      setSelectedRunId(runs[0].runId);
      if (endpoints.some((item: any) => item.id === runs[0].endpointId))
        setEndpointId(runs[0].endpointId);
    }
  }, [endpoints, runs, selectedRunId]);
  useEffect(() => {
    if (!recipientIds.length && data?.audience?.recipients?.length)
      setRecipientIds([
        data.audience.currentUserId ?? data.audience.recipients[0].id,
      ]);
  }, [
    data?.audience?.currentUserId,
    data?.audience?.recipients,
    recipientIds.length,
  ]);
  useEffect(() => {
    setPage(0);
  }, [result?.metadata?.checksum, rowFilter]);
  useEffect(() => {
    setApiPage(0);
  }, [apiSearch, apiTag, apiMethod, apiState, apiCatalog?.checksum]);
  useEffect(() => {
    if (!selectedApi) return;
    setCatalogParams(
      Object.fromEntries(
        selectedApi.parameters
          .filter((parameter: any) =>
            ["query", "path"].includes(parameter.location)
          )
          .map((parameter: any) => [
            parameter.name,
            parameter.defaultValue === null || parameter.defaultValue === undefined
              ? ""
              : String(parameter.defaultValue),
          ])
      )
    );
    setCatalogBody(
      selectedApi.requestBodyExample == null
        ? ""
        : JSON.stringify(selectedApi.requestBodyExample, null, 2)
    );
  }, [selectedApi?.id]);
  const refreshRuntime = trpc.openbbAdmin.refreshRuntime.useMutation({
    onSuccess: () => {
      toast.success("OpenBB 运行时已重新探测");
      void utils.openbbAdmin.priorityA.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const syncFincept = trpc.openbbAdmin.finceptSyncAll.useMutation({
    onSuccess: (value: any) => {
      toast[
        value.failed || value.unavailable ? "error" : "success"
      ](
        `ZIP 连接器批量刷新完成：${value.available}/${value.requested} 可用，` +
          `${value.inserted ?? 0} 条新增，${value.duplicate ?? 0} 条重复已拦截`,
      );
      void utils.openbbAdmin.priorityA.invalidate();
    },
    onError: error => toast.error(`ZIP 批量刷新失败：${error.message}`),
  });
  const query = trpc.openbbAdmin.query.useMutation({
    onSuccess: (value: any) => {
      setSelectedRunId(value.runId);
      toast[value.status === "succeeded" ? "success" : "error"](
        value.status === "succeeded"
          ? `查询完成：${value.result?.metadata?.rowCount ?? 0} 行`
          : `查询未完成：${value.error ?? value.status}`
      );
      void utils.openbbAdmin.priorityA.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const retry = trpc.openbbAdmin.retryQuery.useMutation({
    onSuccess: (value: any) => {
      setSelectedRunId(value.runId);
      toast.info("已按原端点和参数重试");
      void utils.openbbAdmin.priorityA.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const push = trpc.openbbAdmin.pushResult.useMutation({
    onSuccess: (value: any) => {
      toast[value.status === "duplicate_blocked" ? "info" : "success"](
        value.status === "duplicate_blocked"
          ? "相同内容已被指纹去重拦截"
          : `已向 ${value.sentCount} 个模块投递，等待前端 ACK`
      );
      void utils.openbbAdmin.priorityA.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const execute = () => {
    if (!definition) return;
    const parsed = Object.fromEntries(
      Object.entries(params)
        .map(([key, value]) => {
          const trimmed = value.trim();
          return [
            key,
            /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed,
          ];
        })
        .filter(([, value]) => value !== "")
    );
    query.mutate({ endpointId: definition.id, params: parsed });
  };
  const executeCatalog = () => {
    if (!selectedApi || selectedApi.executionState !== "controlled_ready") return;
    const parsed = Object.fromEntries(
      Object.entries(catalogParams)
        .map(([key, value]) => {
          const trimmed = value.trim();
          return [key, /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed];
        })
        .filter(([, value]) => value !== "")
    );
    if (selectedApi.primaryModuleId) setModuleIds([selectedApi.primaryModuleId]);
    let requestBody: unknown = undefined;
    if (selectedApi.method === "POST") {
      if (!catalogBody.trim()) {
        toast.error("POST 接口需要填写 JSON 请求体");
        return;
      }
      try {
        requestBody = JSON.parse(catalogBody);
      } catch {
        toast.error("请求体不是有效 JSON；未发起请求");
        return;
      }
    }
    query.mutate({
      endpointId: `catalog_${selectedApi.operationId}`,
      catalogOperationId: selectedApi.operationId,
      params: parsed,
      requestBody,
    });
  };
  const runtime = data?.runtime;
  const runtimeLoading = workspace.isPending && !workspace.data;
  const reachable = Boolean(runtime?.api?.reachable);
  const canPush = Boolean(
    run?.status === "succeeded" &&
    result?.rows?.length &&
    moduleIds.length===1 && (!pushOwner||moduleIds[0]===pushOwner) &&
    recipientIds.length
  );
  return (
    <section
      className="border border-cyan-900/70 bg-slate-950"
      data-testid="openbb-priority-a-workspace"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#06131c] px-4 py-3">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-cyan-300" />
          <div>
            <h2 className="font-semibold text-white">
              优先级 A · OpenBB 数据工作台
            </h2>
            <p className="text-xs text-slate-400">
              完整 OpenAPI 合同 → 受控执行适配 → 结构化数据层 → 既有前端模块 →
              实际渲染 ACK
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`border px-2 py-1 ${runtimeLoading ? "border-slate-700 text-slate-300" : reachable ? "border-emerald-700 text-emerald-300" : "border-amber-700 text-amber-300"}`}
          >
            {runtimeLoading
              ? "正在探测"
              : reachable
                ? "API 已连接"
                : "API 未连接"}
          </span>
          <span className="font-mono text-slate-400">
            {runtime?.api?.latencyMs ?? "—"} ms
          </span>
          <span className="text-slate-500">
            探测 {dateTime(runtime?.checkedAt)}
          </span>
          <button
            onClick={() => refreshRuntime.mutate()}
            disabled={runtimeLoading || refreshRuntime.isPending}
            className="border border-slate-700 px-2 py-1 text-slate-300 disabled:opacity-40"
          >
            <RefreshCw className="inline h-3 w-3" /> 重新探测
          </button>
        </div>
      </div>
      <div className="grid gap-px border-b border-slate-700 bg-slate-800 sm:grid-cols-3 xl:grid-cols-6" data-testid="openbb-runtime-coverage-summary">
        {[
          ["运行接口合同", data?.coverage?.runtimeInterfaceCount ?? 0, `OpenBB ${data?.coverage?.openbbOperationCount ?? 0} · 官方适配 ${data?.coverage?.officialInterfaceCount ?? 0}`, "text-cyan-200"],
          ["已绑定前端接口", data?.coverage?.boundInterfaceCount ?? 0, "存在唯一功能归属", "text-emerald-300"],
          ["成功取数接口", data?.coverage?.successfulInterfaceCount ?? 0, "至少一次真实成功或永久观察", "text-emerald-300"],
          ["未绑定运行接口", data?.coverage?.unboundInterfaceCount ?? 0, "不会跨功能填充", "text-amber-300"],
          ["已绑定前端功能", `${data?.coverage?.assignedModules ?? 0}/${data?.coverage?.totalModules ?? 0}`, "绑定运行合同", "text-cyan-200"],
          ["已有成功数据功能", `${data?.coverage?.verifiedModules ?? 0}/${data?.coverage?.totalModules ?? 0}`, "真实查询或永久观察", "text-emerald-300"],
        ].map(([label, value, detail, valueClass]) => (
          <div key={String(label)} className="bg-slate-950 px-3 py-2">
            <div className="text-[10px] text-slate-500">{label}</div>
            <div className={`mt-0.5 font-mono text-lg font-semibold ${valueClass}`}>{value}</div>
            <div className="text-[9px] text-slate-600">{detail}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-slate-800 bg-black/40 px-3 py-2 text-[10px]" data-testid="openbb-automatic-pipeline">
        <span className={data?.automation?.enabled ? "text-emerald-300" : "text-amber-300"}>
          自动数据链路：{data?.automation?.enabled ? "运行中" : "未启用"}
        </span>
        <span className="text-slate-400">已登记 {data?.automation?.registeredDatasetCount ?? 0}</span>
        <span className="text-emerald-300">最近成功 {data?.automation?.successfulDatasetCount ?? 0}</span>
        <span className="text-rose-300">失败/不可用 {data?.automation?.failedDatasetCount ?? 0}</span>
        <span className="text-slate-500">等待首次执行 {data?.automation?.waitingDatasetCount ?? 0}</span>
        <span className="text-slate-500">最近入库 {dateTime(data?.automation?.lastSuccessAt)}</span>
        <span className="text-slate-600">{(data?.automation?.pipeline ?? []).join(" → ")}</span>
        {data?.automation?.runtime?.mode && (
          <span className="text-cyan-300">
            {data.automation.runtime.mode === "standalone_scheduler"
              ? "持久化调度器"
              : "服务内到期轮询"}
          </span>
        )}
        <button
          type="button"
          onClick={() => syncFincept.mutate({ scope: "archive_backed" })}
          disabled={syncFincept.isPending}
          className="ml-auto inline-flex items-center gap-1 border border-cyan-800 px-2 py-1 text-cyan-200 disabled:opacity-40"
          title="批量读取已有 Fincept/AKShare 连接器并写入唯一数据合同"
        >
          <RefreshCw className={`h-3 w-3 ${syncFincept.isPending ? "animate-spin" : ""}`} />
          {syncFincept.isPending ? "批量刷新中…" : "批量刷新 ZIP 数据"}
        </button>
      </div>
      <details className="border-b border-slate-800 bg-[#030a0f]" data-testid="fincept-capability-coverage">
        <summary className="cursor-pointer px-3 py-2 text-xs text-cyan-300">
          Fincept 能力归属：直接数据接口 {data?.finceptTerminal?.directDatasetVerifiedCount ?? 0}/{data?.finceptTerminal?.directDatasetCount ?? 0}；混合类别 {data?.finceptTerminal?.mixedVerifiedCount ?? 0}/{data?.finceptTerminal?.mixedBindingCount ?? 0}；既有平台类别 {data?.finceptTerminal?.existingPlatformVerifiedCount ?? 0}/{data?.finceptTerminal?.existingPlatformBindingCount ?? 0}
        </summary>
        <div className="overflow-auto px-3 pb-3">
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="fincept-archive-audit-summary">
            {[
              ["API 连接器脚本", data?.finceptTerminal?.archive?.pythonScriptCount ?? "—"],
              ["Python 脚本总数", data?.finceptTerminal?.archive?.pythonScriptTotalCount ?? "—"],
              ["Qt 前端源文件", data?.finceptTerminal?.archive?.qtScreenFileCount ?? "—"],
              ["Qt 服务源文件", data?.finceptTerminal?.archive?.qtServiceFileCount ?? "—"],
              ["Python 函数", data?.finceptTerminal?.archive?.pythonFunctionCount ?? "—"],
              ["HTTP 引用", data?.finceptTerminal?.archive?.httpReferenceCount ?? "—"],
              ["已绑定", `${data?.finceptTerminal?.boundCount ?? 0}/${data?.finceptTerminal?.bindings?.length ?? 0}`],
              ["真实验证成功", `${data?.finceptTerminal?.verifiedCount ?? 0}/${data?.finceptTerminal?.bindings?.length ?? 0}`],
              ["压缩包直接接入", `${data?.finceptTerminal?.directVerifiedCount ?? 0}/${data?.finceptTerminal?.directBindingCount ?? 0}`],
              ["直接数据接口", `${data?.finceptTerminal?.directDatasetVerifiedCount ?? 0}/${data?.finceptTerminal?.directDatasetCount ?? 0}`],
              ["既有平台合同", `${data?.finceptTerminal?.existingPlatformVerifiedCount ?? 0}/${data?.finceptTerminal?.existingPlatformBindingCount ?? 0}`],
              ["直接+既有混合", `${data?.finceptTerminal?.mixedVerifiedCount ?? 0}/${data?.finceptTerminal?.mixedBindingCount ?? 0}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="border border-slate-800 bg-black/30 px-2 py-1.5">
                <div className="text-[10px] text-slate-500">{label}</div>
                <div className="font-mono text-cyan-200">{value}</div>
              </div>
            ))}
          </div>
          <div className="mb-3 border border-amber-900/50 bg-amber-950/10 p-2 text-[10px] text-amber-200">
            压缩包包含 {data?.finceptTerminal?.archive?.qtScreenFileCount ?? "—"} 个 Qt 前端源文件、{data?.finceptTerminal?.archive?.qtServiceFileCount ?? "—"} 个服务源文件和 {data?.finceptTerminal?.archive?.pythonScriptTotalCount ?? "—"} 个 Python 脚本，其中根目录 API 连接器为 {data?.finceptTerminal?.archive?.pythonScriptCount ?? "—"} 个。以上是压缩包事实；只有“真实验证成功”才代表当前后台确实取得并归档过数据，不能把源码数量冒充已接入数量。
          </div>
          <div
            className="mb-3 border border-slate-800 bg-black/30 p-2"
            data-testid="fincept-placeholder-slot-audit"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                旧编号占位槽位：{data?.finceptTerminal?.placeholderSlotCount ?? 0} 个
              </span>
              <span className="text-[10px] text-emerald-300">
                已映射并有真实归档：{data?.finceptTerminal?.replacedPlaceholderSlotCount ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              以下编号只承载 ZIP 中盘点出的前端页面能力，并映射到现有功能入口；它们不是“专业应用”API。每个卡槽显示唯一数据范围、来源和核验状态；没有真实观察的卡槽只显示“待验证”，不会填充样例或假数据。
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.finceptTerminal?.placeholderSlots ?? []).map((group: any) => (
                <div key={group.category} className="border border-slate-800 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-300">{group.category}</div>
                    <span className="font-mono text-[9px] text-emerald-300">
                      {placeholderBindings.filter(item => item.category === group.category && item.status === "verified").length}/{group.positions?.length ?? 0} 已核验
                    </span>
                  </div>
                  <div className="mt-1 grid gap-1">
                    {placeholderBindings.filter(item => item.category === group.category).map((item: any) => (
                      <a
                        key={`${item.category}-${item.position}`}
                        href={frontendUrl(item.frontendPath)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start justify-between gap-2 border-t border-slate-900 pt-1 text-[9px] hover:bg-slate-900/50"
                        title={`${item.dataContractId ?? "未建立合同"} · ${item.source ?? "来源待验证"} · 读取 ${dateTime(item.retrievedAt)}`}
                      >
                        <span className="min-w-0">
                          <span className="mr-1 font-mono text-cyan-300">#{item.position}</span>
                          <span className="text-slate-300">{item.functionCode} · {item.label}</span>
                          <span className="block truncate font-mono text-slate-600">{item.dataScopeKey} · {item.viewKey}</span>
                        </span>
                        <span className={item.status === "verified" ? "shrink-0 text-emerald-300" : "shrink-0 text-amber-300"}>
                          {item.status === "verified" ? "已验证" : "待验证"}
                        </span>
                      </a>
                    ))}
                  </div>
                  <div className="mt-1 text-[9px] leading-4 text-slate-600">{group.reason}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            className="mb-3 border border-amber-900/60 bg-amber-950/10"
            data-testid="fincept-professional-api-coverage"
          >
            <div className="border-b border-amber-900/60 px-2 py-2">
              <div className="text-xs font-semibold text-amber-200">专业应用 API 覆盖（独立于 ZIP 编号卡槽）</div>
              <div className="mt-1 text-[10px] leading-4 text-amber-100/70">
                这里单独列出组合、定价风险、订单、电子交易、STP、交易账簿和行业分组的真实 API 边界。已有路由/接口不等于已有实时数据；只有账户、经纪商、交易所或研究批次被验证后才会改为可用。
              </div>
            </div>
            <div className="max-h-[26rem] overflow-auto">
              <table className="w-full min-w-[1180px] text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-950 text-slate-500">
                  <tr>
                    {["专业应用", "唯一前端入口", "API 归属", "已有过程", "数据边界", "当前状态", "不能标记实时的原因"].map(label => (
                      <th key={label} className="border-b border-slate-700 p-2">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.finceptTerminal?.professionalApplications ?? []).map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-900 align-top">
                      <td className="p-2 text-amber-100">
                        {item.label}
                        <div className="text-[9px] text-slate-600">{item.id}</div>
                      </td>
                      <td className="p-2">
                        <a href={frontendUrl(item.frontendPath)} target="_blank" rel="noreferrer" className="break-all font-mono text-cyan-300">
                          {frontendUrl(item.frontendPath)}
                        </a>
                      </td>
                      <td className="p-2 font-mono text-cyan-200">{item.apiOwner}</td>
                      <td className="p-2">
                        <div className="max-w-[22rem] break-words font-mono text-[9px] text-slate-400">{(item.procedureIds ?? []).join(" · ")}</div>
                      </td>
                      <td className="p-2 text-slate-400">{item.dataBoundary}</td>
                      <td className={`p-2 font-semibold ${item.liveData ? "text-emerald-300" : "text-amber-300"}`}>
                        {item.liveData ? "已验证实时" : item.status === "calculation_only" ? "仅计算/待数据源" : "接口存在·数据未验证"}
                      </td>
                      <td className="p-2 text-slate-500">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mb-3 border border-slate-800 bg-black/30" data-testid="fincept-frontend-surface-inventory">
            <div className="border-b border-slate-800 px-2 py-2">
              <div className="text-xs font-semibold text-slate-200">压缩包前端功能盘点（Qt/C++）</div>
              <div className="mt-1 text-[10px] text-slate-500">
                这里显示压缩包里实际存在的界面域、服务文件和当前唯一入口。标为“仅盘点”的功能没有对应既有 React 数据合同，不会被伪造为前端已接入，也不会因此新增页面。
              </div>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[1040px] text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-950 text-slate-500">
                  <tr>
                    {["Qt 功能域", "前端源文件", "服务源文件", "现有唯一入口", "落地状态", "归属边界"].map(label => (
                      <th key={label} className="border-b border-slate-700 p-2">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.finceptTerminal?.frontendSurfaces ?? []).map((surface: any) => (
                    <tr key={`surface-${surface.id}`} className="border-b border-slate-900 align-top">
                      <td className="p-2 text-cyan-200">{surface.label}<div className="text-[9px] text-slate-600">{surface.id}</div></td>
                      <td className="p-2 font-mono text-slate-300">{surface.screenFileCount}</td>
                      <td className="p-2 font-mono text-slate-300">{surface.serviceFileCount}</td>
                      <td className="p-2">
                        {surface.frontendPath ? (
                          <a href={frontendUrl(surface.frontendPath)} target="_blank" rel="noreferrer" className="break-all font-mono text-cyan-300">
                            {frontendUrl(surface.frontendPath)}
                          </a>
                        ) : "—"}
                      </td>
                      <td className={`p-2 ${surface.integration === "existing_route_verified" ? "text-emerald-300" : surface.integration === "existing_route_partial" ? "text-amber-300" : "text-slate-500"}`}>
                        {surface.integration === "existing_route_verified" ? "已有入口·已验证合同" : surface.integration === "existing_route_partial" ? "已有入口·部分能力" : "仅盘点·未接入"}
                      </td>
                      <td className="p-2 text-slate-500">{surface.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <table className="mb-3 w-full min-w-[980px] text-left text-[11px]" data-testid="fincept-runtime-binding-table">
            <thead className="text-slate-500">
              <tr>
                {["实际绑定类别", "绑定来源", "唯一前端入口", "数据合同", "验证状态", "最近成功", "失败说明"].map(label => <th key={label} className="border-b border-slate-700 p-2">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(data?.finceptTerminal?.bindings ?? []).map((item: any) => (
                <tr key={`runtime-${item.id}`} className="border-b border-slate-900 align-top">
                  <td className="p-2 text-cyan-200">{item.category}</td>
                  <td className={`p-2 ${item.origin === "archive_direct" ? "text-emerald-300" : "text-amber-300"}`}>{item.origin === "archive_direct" ? "压缩包直接适配" : item.origin === "mixed" ? "直接适配 + 既有平台" : "既有平台适配器"}</td>
                  <td className="p-2"><a href={frontendUrl(item.frontendPath)} target="_blank" rel="noreferrer" className="break-all font-mono text-cyan-300">{frontendUrl(item.frontendPath)}</a><div className="text-[9px] text-slate-500">{item.moduleId}</div></td>
                  <td className="p-2 font-mono text-[9px] text-slate-400">{(item.dataContractIds ?? []).join(" · ") || "未建立唯一合同"}</td>
                  <td className={`p-2 ${item.status === "verified" ? "text-emerald-300" : item.status === "configured_unverified" ? "text-amber-300" : "text-rose-300"}`}>{item.status === "verified" ? "已验证并可归档" : item.status === "configured_unverified" ? "已登记，尚未验证" : "未接入/被阻断"}</td>
                  <td className="p-2 text-slate-400">{item.observedAt ? dateTime(item.observedAt) : "—"}</td>
                  <td className="p-2 text-slate-500">{item.lastError || item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mb-3 border border-slate-800 bg-black/30 p-2 text-[11px]" data-testid="fincept-direct-dataset-checks">
            <div className="mb-2 text-cyan-200">直接适配接口逐项核验（成功需已归档真实观察）</div>
            {(data?.finceptTerminal?.directDatasetChecks ?? []).map((item: any) => (
              <div key={item.id} className="grid gap-1 border-t border-slate-800 py-1 sm:grid-cols-[1fr_1.5fr_5rem_9rem]">
                <span>{item.label}</span>
                <span className="font-mono text-slate-500">{item.dataContractId}</span>
                <span className={item.status === "verified" ? "text-emerald-300" : "text-amber-300"}>{item.status === "verified" ? "已验证" : "未验证"}</span>
                <span className="text-slate-400">{item.observedAt ?? "—"}</span>
              </div>
            ))}
          </div>
          <div
            className="mb-3 border border-cyan-900/60 bg-cyan-950/10 p-3"
            data-testid="fincept-frontend-entry-guide"
          >
            <div className="text-xs font-semibold text-cyan-200">前端查看入口（完整地址）</div>
            <div className="mt-1 text-[10px] text-slate-500">
              点击“打开”直接进入对应既有功能；“复制”会复制当前站点的完整地址，不需要手动拼接路径。
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {(data?.finceptCapabilities ?? []).map((item: any) => {
                const url = frontendUrl(item.frontendPath);
                return (
                  <div
                    key={`entry-${item.id}`}
                    className="flex flex-wrap items-center gap-2 border border-slate-800 bg-black/30 px-2 py-2"
                  >
                    <span className="min-w-16 text-xs text-slate-300">{item.category}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-cyan-300" title={url}>
                      {url}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-cyan-700/70 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-950/50"
                    >
                      打开
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyFrontendUrl(item.frontendPath)}
                      className="border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-900"
                    >
                      复制
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <table className="w-full min-w-[960px] text-left text-[11px]">
            <thead className="text-slate-500">
              <tr>
                {["类别", "压缩包能力", "状态", "唯一功能", "前端入口", "真实数据边界"].map(label => <th key={label} className="border-b border-slate-700 p-2">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(data?.finceptCapabilities ?? []).map((item: any) => (
                <tr key={item.id} className="border-b border-slate-900 align-top">
                  <td className="p-2 text-cyan-200">{item.category}<div className="text-[9px] text-slate-600">{item.label}</div></td>
                  <td className="p-2 font-mono">{item.zipCapabilityCount} 项</td>
                  <td className={`p-2 ${item.status === "connected" || item.status === "existing_persistent_adapter" ? "text-emerald-300" : item.status === "partial_persistent_adapter" || item.status === "live_volatile_adapter" || item.status === "module_database_only" ? "text-amber-300" : "text-rose-300"}`}>
                    {finceptStatusText[item.status] ?? item.status}
                  </td>
                  <td className="p-2"><span className="text-cyan-100">{item.moduleId}</span><div className="text-[9px] text-slate-500">{(item.dataContractIds ?? []).join(" · ") || "现有页面接口"}</div></td>
                  <td className="p-2">
                    <a
                      href={frontendUrl(item.frontendPath)}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-mono text-cyan-300"
                    >
                      {frontendUrl(item.frontendPath)}
                    </a>
                  </td>
                  <td className="p-2 text-slate-400">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {!runtimeLoading && !reachable && (
        <div className="border-b border-amber-900/70 bg-amber-950/20 px-4 py-2 text-xs text-amber-200">
          当前没有可访问的 OpenBB
          API。{apiCatalog?.contractSource === "cached_contract"
            ? `下方仅展示本机已校验缓存中的 ${apiCatalog.operationCount} 个真实 OpenAPI 合同；全部为只读目录且不可执行。`
            : "当前也没有可读取的本地合同目录。"}
          OpenBB合同查询需恢复连接；官方直连经济适配独立运行，按各自真实请求结果显示状态。
        </div>
      )}
      <details className="border-b border-slate-700 text-xs" data-testid="api-frontend-coverage">
        <summary className="cursor-pointer px-3 py-2 text-cyan-300">API → 既有前端功能覆盖：{data?.coverage?.allocatedModules??0}/{data?.coverage?.totalModules??0} 已建立唯一分配 · {data?.coverage?.assignedModules??0} 已绑定运行接口 · {data?.coverage?.unassignedModules??0} 未绑定运行接口 · {data?.coverage?.verifiedModules??0} 有成功查询</summary>
        <div className="grid gap-2 border-y border-slate-800 px-3 py-2 sm:grid-cols-3 lg:grid-cols-6">
          {[['唯一分配',data?.coverage?.allocatedModules??0],['公开无密适配器',data?.coverage?.publicNoKeyModules??0],['需要 Key',data?.coverage?.requiresKeyModules??0],['需要授权',data?.coverage?.requiresLicenseModules??0],['需要用户数据',data?.coverage?.requiresUserDataModules??0],['未配置',data?.coverage?.notConfiguredModules??0]].map(([label,value])=><div key={String(label)} className="border border-slate-800 bg-black/30 px-2 py-1.5"><div className="text-[10px] text-slate-500">{label}</div><div className="font-mono text-cyan-200">{value}</div></div>)}
        </div>
        <div className="flex flex-wrap gap-3 border-b border-slate-800 px-3 py-2"><input aria-label="筛选API前端覆盖" placeholder="功能、路径、合同或适配器" value={coverageFilter} onChange={e=>setCoverageFilter(e.target.value)} className="border border-slate-600 bg-black px-2"/><label><input type="checkbox" checked={coverageMissing} onChange={e=>setCoverageMissing(e.target.checked)}/> 只看未绑定运行接口</label><span>官方直连适配 {data?.coverage?.officialAdapterCount??0} · 候选 API 目录只代表已登记能力，不代表授权、密钥或查询成功</span></div>
        <p className="px-3 py-2 text-amber-300">{data?.coverage?.boundary}</p>
        <div className="max-h-80 overflow-auto"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-slate-950"><tr>{['既有功能','路径','唯一适配器','运行接口','查询验证','永久观察','接口合同 / 字段边界'].map(label=><th key={label} className="border-b border-slate-700 p-2">{label}</th>)}</tr></thead><tbody>{(data?.coverage?.rows??[]).filter((row:any)=>(!coverageMissing||row.status==='unassigned')&&JSON.stringify([row.name,row.path,row.dataContractId,row.adapterKind,row.provider,row.ownedFields]).toLowerCase().includes(coverageFilter.toLowerCase())).map((row:any)=><tr key={row.id} className="border-b border-slate-800 align-top"><td className="p-2">{row.name}<div className="mt-1 text-[9px] text-slate-600">{row.domain}</div></td><td className="p-2"><a href={row.path} className="text-cyan-400">{row.path}</a></td><td className="p-2"><div className="text-cyan-200">{row.adapterKind}</div><div className="text-[9px] text-slate-500">{row.provider}</div><div className="text-[9px] text-amber-300">{row.allocationStatus} · {row.refreshBoundary}</div></td><td className="p-2">{row.operationCount} / {row.officialCount}<div className="text-[9px] text-slate-500">{row.status==='unassigned'?'未绑定运行接口':'已绑定'}</div></td><td className="p-2">{row.verifiedOperationCount} 成功<br/>{row.status==='unassigned'?'未分配':row.status==='assigned_unverified'?'待实查':'有成功查询'}</td><td className="p-2 font-mono">{row.persistedObservationCount ?? 0}</td><td className="p-2"><div className="font-mono text-cyan-100">{row.dataContractId}</div><div className="mt-1 text-[9px] text-slate-500">所有权 {row.ownershipKey}</div><div className="mt-1 text-[9px] text-slate-400">字段 {row.ownedFields?.join(' · ')||'—'}</div><div className="mt-1 text-[9px] text-amber-300">{row.limitation}</div><div className="mt-1 text-[9px] text-slate-600">运行合同 {row.contracts.map((contract:any)=>contract.id).join(' · ')||'尚无'}</div></td></tr>)}</tbody></table></div>
      </details>
      <div
        className="border-b border-slate-800 bg-[#030a0f]"
        data-testid="openbb-full-api-catalog"
      >
        <div className="border-b border-slate-800 px-3 py-2" data-testid="openbb-asset-class-coverage">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-cyan-200">OpenBB 资产类别 API 覆盖</span>
            <span className="text-[10px] text-slate-500">“基金”单独统计；公司基本面不计作基金行情</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {(apiCatalog?.assetClassSummary ?? []).filter((item: any) =>
              ["news", "indices", "crypto", "commodities", "bonds", "forex", "etf", "funds", "futures", "options"].includes(item.id)
            ).map((item: any) => (
              <div key={item.id} className={`border px-2 py-1.5 ${item.runtimeExposure === "available" ? "border-slate-700 bg-black/30" : "border-amber-900/70 bg-amber-950/10"}`}>
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-300">{item.label}</span>
                  <span className={item.runtimeExposure === "available" ? "text-emerald-300" : "text-amber-300"}>
                    {item.runtimeExposure === "available" ? "已暴露" : "未暴露"}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-sm text-cyan-100">
                  {item.operationCount} <span className="text-[10px] text-slate-500">路由</span>
                </div>
                <div className="text-[9px] text-slate-500">
                  绑定 {item.controlledOperationCount} · 成功 {item.verifiedOperationCount}
                </div>
                {item.note && <div className="mt-1 text-[9px] leading-4 text-amber-300">{item.note}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="grid border-b border-slate-800 text-[11px] sm:grid-cols-2 xl:grid-cols-6">
          <div className="border-r border-slate-800 px-3 py-2">
            <span className="text-slate-500">OpenAPI 路径</span>
            <b className="ml-2 font-mono text-cyan-200">
              {apiCatalog?.pathCount ?? "—"}
            </b>
          </div>
          <div className="border-r border-slate-800 px-3 py-2">
            <span className="text-slate-500">HTTP 操作</span>
            <b className="ml-2 font-mono text-cyan-200">
              {apiCatalog?.operationCount ?? "—"}
            </b>
          </div>
          <div className="border-r border-slate-800 px-3 py-2">
            <span className="text-slate-500">目录分类</span>
            <b className="ml-2 font-mono text-cyan-200">
              {apiCatalog?.tagCount ?? "—"}
            </b>
            <span className="ml-2 text-[10px] text-slate-600">
              OpenAPI 声明 {apiCatalog?.declaredTagCount ?? "—"}
            </span>
          </div>
          <div className="border-r border-slate-800 px-3 py-2">
            <span className="text-slate-500">受控代理可执行</span>
            <b className="ml-2 font-mono text-emerald-300">
              {apiCatalog?.controlledProxyOperationCount ?? apiCatalog?.controlledOperationCount ?? "—"}
            </b>
          </div>
          <div className="border-r border-slate-800 px-3 py-2">
            <span className="text-slate-500">合同覆盖</span>
            <b className="ml-2 font-mono text-white">
              {apiCatalog?.contractCoveragePercent ?? (apiCatalog?.operationCount ? 100 : 0)}%
            </b>
          </div>
          <div className="px-3 py-2">
            <span className="text-slate-500">专用字段适配</span>
            <b className="ml-2 font-mono text-amber-300">
              {endpoints.length}
            </b>
            <span className="ml-2 text-[10px] text-slate-600">
              含官方直连 {data?.coverage?.officialAdapterCount??0}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-600" />
            <input
              aria-label="搜索完整 OpenBB API"
              value={apiSearch}
              onChange={event => setApiSearch(event.target.value)}
              placeholder="搜索路径、operationId、摘要或说明"
              className="h-8 w-full border border-slate-700 bg-black pl-8 pr-2 text-xs text-slate-200"
            />
          </div>
          <select
            aria-label="OpenBB API 目录分类筛选"
            value={apiTag}
            onChange={event => setApiTag(event.target.value)}
            className="h-8 border border-slate-700 bg-black px-2 text-xs"
          >
            <option value="">全部分类 · {apiCatalog?.tagCount ?? 0}</option>
            {(apiCatalog?.tags ?? []).map((tag: string) => (
              <option key={tag} value={tag}>
                {tag} · {apiCatalog?.tagCounts?.[tag] ?? 0}
              </option>
            ))}
          </select>
          <select
            aria-label="OpenBB API 方法筛选"
            value={apiMethod}
            onChange={event => setApiMethod(event.target.value)}
            className="h-8 border border-slate-700 bg-black px-2 text-xs"
          >
            <option value="">全部方法</option>
            {Object.entries(apiCatalog?.methods ?? {}).map(
              ([method, count]) => (
                <option key={method} value={method}>
                  {method} · {String(count)}
                </option>
              )
            )}
          </select>
          <select
            aria-label="OpenBB API 状态筛选"
            value={apiState}
            onChange={event => setApiState(event.target.value)}
            className="h-8 border border-slate-700 bg-black px-2 text-xs"
          >
            <option value="">全部状态</option>
            {Object.entries(apiStateText).map(([state, label]) => (
              <option key={state} value={state}>
                {label} · {apiCatalog?.stateCounts?.[state] ?? 0}
              </option>
            ))}
          </select>
          <span className="font-mono text-[11px] text-slate-500">
            匹配 {filteredApiOperations.length}/
            {apiCatalog?.operationCount ?? 0}
          </span>
        </div>
        <div className="grid min-h-[300px] xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]">
          <div className="min-w-0 border-r border-slate-800">
            <div className="max-h-[360px] overflow-auto">
              <table className="min-w-full whitespace-nowrap text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400">
                  <tr>
                    <th className="border-b border-r border-slate-800 px-2 py-2">
                      方法
                    </th>
                    <th className="border-b border-r border-slate-800 px-2 py-2">
                      路径 / operationId
                    </th>
                    <th className="border-b border-r border-slate-800 px-2 py-2">
                      标签
                    </th>
                    <th className="border-b border-slate-800 px-2 py-2">
                      执行状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleApiOperations.map((item: any) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedApiId(item.id)}
                      className={`cursor-pointer border-b border-slate-900 ${selectedApi?.id === item.id ? "bg-cyan-950/40" : "hover:bg-slate-900"}`}
                    >
                      <td
                        className={`border-r border-slate-900 px-2 py-2 font-mono ${item.method === "GET" ? "text-cyan-300" : "text-rose-300"}`}
                      >
                        {item.method}
                      </td>
                      <td className="max-w-[620px] overflow-hidden text-ellipsis border-r border-slate-900 px-2 py-2">
                        <div className="font-mono text-slate-200">
                          {item.path}
                        </div>
                        <div className="mt-0.5 text-slate-600">
                          {item.operationId} · {item.summary}
                        </div>
                      </td>
                      <td className="border-r border-slate-900 px-2 py-2 text-slate-500">
                        {item.tags.join("、") || "—"}
                      </td>
                      <td
                        className={`px-2 py-2 ${apiStateClass[item.executionState] ?? "text-slate-400"}`}
                      >
                        {item.executionState === "controlled_ready" ? (
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />
                        ) : (
                          <ShieldAlert className="mr-1 inline h-3 w-3" />
                        )}
                        {apiStateText[item.executionState] ??
                          item.executionState}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleApiOperations.length && (
                <div className="flex h-40 items-center justify-center text-xs text-slate-600">
                  当前筛选没有匹配接口；完整合同仍保留{" "}
                  {apiCatalog?.operationCount ?? 0} 个操作。
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
              <span>合同校验 {apiCatalog?.checksum?.slice(0, 20) ?? "—"}</span>
              <div>
                <button
                  aria-label="OpenBB API 目录上一页"
                  onClick={() => setApiPage(value => Math.max(0, value - 1))}
                  disabled={currentApiPage === 0}
                  className="border border-slate-700 px-2 py-1 disabled:opacity-30"
                >
                  ‹
                </button>
                <span className="mx-3 font-mono">
                  {currentApiPage + 1}/{apiPageCount}
                </span>
                <button
                  aria-label="OpenBB API 目录下一页"
                  onClick={() =>
                    setApiPage(value => Math.min(apiPageCount - 1, value + 1))
                  }
                  disabled={currentApiPage >= apiPageCount - 1}
                  className="border border-slate-700 px-2 py-1 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          <div className="min-w-0 p-3 text-[11px]">
            {selectedApi ? (
              <>
                <div className="flex items-start gap-2">
                  <Eye className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <div className="min-w-0">
                    <b className="text-sm text-white">{selectedApi.summary}</b>
                    <div className="mt-1 break-all font-mono text-cyan-200">
                      {selectedApi.method} {selectedApi.path}
                    </div>
                    <div className="mt-1 break-all font-mono text-slate-600">
                      {selectedApi.operationId}
                    </div>
                  </div>
                </div>
                <p className="mt-3 max-h-16 overflow-auto whitespace-pre-wrap leading-4 text-slate-400">
                  {selectedApi.description || "OpenAPI 合同未提供说明。"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-px border border-slate-800 bg-slate-800">
                  <div className="bg-black p-2">
                    <span className="text-slate-600">参数</span>
                    <b className="ml-2 text-white">
                      {selectedApi.parameters.length}
                    </b>
                  </div>
                  <div className="bg-black p-2">
                    <span className="text-slate-600">响应模型</span>
                    <b className="ml-2 text-white">
                      {selectedApi.responseSchema || "未声明"}
                    </b>
                  </div>
                  <div className="bg-black p-2">
                    <span className="text-slate-600">请求体</span>
                    <b className="ml-2 text-white">
                      {selectedApi.requestBodyRequired ? "必填" : "无/非必填"}
                    </b>
                  </div>
                  <div className="bg-black p-2">
                    <span className="text-slate-600">鉴权声明</span>
                    <b className="ml-2 text-white">
                      {selectedApi.securityRequired ? "需要" : "合同未声明"}
                    </b>
                  </div>
                </div>
                <div className="mt-3 max-h-28 overflow-auto border border-slate-800">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-slate-500">
                      <tr>
                        <th className="px-2 py-1">参数</th>
                        <th className="px-2 py-1">位置/类型</th>
                        <th className="px-2 py-1">默认/选项</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedApi.parameters.map((parameter: any) => (
                        <tr
                          key={`${parameter.location}:${parameter.name}`}
                          className="border-t border-slate-900"
                        >
                          <td className="px-2 py-1 font-mono text-slate-300">
                            {parameter.name}
                            {parameter.required ? (
                              <span className="text-rose-300"> *</span>
                            ) : (
                              ""
                            )}
                          </td>
                          <td className="px-2 py-1 text-slate-500">
                            {parameter.location} · {parameter.type}
                            {parameter.format ? `/${parameter.format}` : ""}
                          </td>
                          <td
                            className="max-w-[180px] truncate px-2 py-1 text-slate-500"
                            title={parameter.choices.join(", ")}
                          >
                            {(parameter.defaultValue ??
                              parameter.choices.join(", ")) ||
                              "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(["GET", "POST"].includes(selectedApi.method)) && selectedApi.executionState === "controlled_ready" && (
                  <div className="mt-3 border border-cyan-900/70 bg-cyan-950/10 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <b className="text-cyan-200">合同接口执行 · {selectedApi.method}</b>
                        <span className="ml-2 text-slate-500">
                          唯一分片 {selectedApi.dataContractId} · 主落点 {selectedApi.primaryModuleId ?? "仅后台"}
                        </span>
                      </div>
                      <button
                        onClick={executeCatalog}
                        disabled={query.isPending || !selectedApi.primaryModuleId}
                        className="inline-flex items-center gap-1 border border-cyan-600 px-2 py-1 text-[11px] text-cyan-200 disabled:opacity-40"
                      >
                        <Play className="h-3 w-3" />
                        {query.isPending ? "执行中" : `运行该 ${selectedApi.method}`}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedApi.parameters
                        .filter((parameter: any) => ["query", "path"].includes(parameter.location))
                        .slice(0, 20)
                        .map((parameter: any) => (
                          <label key={`${parameter.location}:${parameter.name}`} className="min-w-[120px] flex-1">
                            <span className="block text-[10px] uppercase text-slate-500">
                              {parameter.name}{parameter.required ? " *" : ""}
                            </span>
                            <input
                              aria-label={`OpenBB 合同参数 ${parameter.name}`}
                              value={catalogParams[parameter.name] ?? ""}
                              onChange={event => setCatalogParams(current => ({ ...current, [parameter.name]: event.target.value }))}
                              placeholder={parameter.choices?.length ? parameter.choices.slice(0, 3).join(", ") : parameter.type}
                              className="mt-1 h-7 w-full border border-slate-700 bg-black px-2 font-mono text-[10px] text-cyan-100"
                            />
                          </label>
                        ))}
                    </div>
                    {selectedApi.method === "POST" && (
                      <label className="mt-3 block">
                        <span className="block text-[10px] uppercase text-slate-500">
                          JSON 请求体 {selectedApi.requestBodyRequired ? "*" : ""}
                        </span>
                        <textarea
                          aria-label="OpenBB POST JSON 请求体"
                          value={catalogBody}
                          onChange={event => setCatalogBody(event.target.value)}
                          placeholder={selectedApi.requestBodyDescription || "粘贴符合 OpenAPI 合同的 JSON"}
                          rows={6}
                          className="mt-1 w-full border border-slate-700 bg-black px-2 py-1 font-mono text-[10px] leading-4 text-cyan-100"
                        />
                        <span className="mt-1 block text-[10px] text-slate-600">
                          仅允许已登记的金融数据 POST；外部文档 URL 仅限官方来源域名，禁止任意网络地址。
                        </span>
                      </label>
                    )}
                    <div className="mt-2 text-[10px] text-slate-500">
                      只发送合同声明的 query/path 参数和白名单请求体；返回结果进入该 operation 的唯一数据分片，不复制到其他模块。
                    </div>
                  </div>
                )}
                <div
                  className={`mt-3 border-l-2 px-3 py-2 ${selectedApi.executionState === "controlled_ready" ? "border-emerald-600 bg-emerald-950/20 text-emerald-200" : "border-amber-600 bg-amber-950/20 text-amber-200"}`}
                >
                  {selectedApi.executionState === "controlled_ready"
                    ? `已映射到受控查询 ${selectedApi.controlledEndpointId}，可在下方真实执行并进入 ACK 闭环。`
                    : selectedApi.blockReason}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-600">
                OpenAPI 合同尚未加载。
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid min-h-[610px] xl:grid-cols-[250px_minmax(0,1fr)_340px]">
        <aside className="border-r border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            专用字段适配查询 · {endpoints.length}
          </div>
          <div className="max-h-[560px] overflow-auto">
            {endpoints.map((item: any) => (
              <button
                key={item.id}
                onClick={() => setEndpointId(item.id)}
                className={`block w-full border-b border-slate-900 px-3 py-3 text-left ${definition?.id === item.id ? "bg-cyan-950/50 text-cyan-100" : "text-slate-300 hover:bg-slate-900"}`}
              >
                <div className="flex justify-between gap-2">
                  <b className="text-xs">{item.label}</b>
                  <span className="text-[10px] text-slate-500">
                    {item.domain}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0 border-r border-slate-800">
          <div className="border-b border-slate-800 p-3">
            <div className="flex flex-wrap items-end gap-2">
              {(definition?.allowed ?? []).map((key: string) => (
                <label key={key} className="min-w-[130px] flex-1">
                  <span className="block text-[10px] uppercase text-slate-500">
                    {key}
                    {definition.required.includes(key) ? " *" : ""}
                  </span>
                  <input
                    aria-label={`OpenBB 参数 ${key}`}
                    value={params[key] ?? ""}
                    onChange={event =>
                      setParams(current => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 h-8 w-full border border-slate-700 bg-black px-2 font-mono text-xs text-cyan-100"
                  />
                </label>
              ))}
              <button
                onClick={execute}
                disabled={query.isPending}
                className="inline-flex h-8 items-center gap-2 border border-cyan-600 bg-cyan-950/40 px-4 text-xs font-semibold text-cyan-200 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                {query.isPending ? "查询中" : "运行真实查询"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-slate-500">
              <span>GET {definition?.path}</span>
              <span>只允许目录内参数</span>
              <span>超时 25 秒</span>
              <span>最多保存 500 行</span>
            </div>
          </div>
          <div className="border-b border-slate-800 px-3 py-2">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <b className="text-slate-200">
                {result?.label ?? "尚未返回数据"}
              </b>
              {run?.status === "succeeded" && run.primaryModuleId && (
                <div className="flex flex-wrap items-center gap-2" data-testid="openbb-auto-publish-status" aria-live="polite">
                  <span
                    className={
                      run.push?.status === "front_acknowledged"
                        ? "border border-emerald-800 px-2 py-0.5 text-emerald-300"
                        : run.push?.status === "waiting_front_ack"
                          ? "border border-amber-800 px-2 py-0.5 text-amber-300"
                          : "border border-cyan-800 px-2 py-0.5 text-cyan-300"
                    }
                  >
                    {run.push?.status === "front_acknowledged"
                      ? `自动投递已完成 · 前端已确认 · ${run.primaryModuleId}`
                      : run.push?.status === "waiting_front_ack"
                        ? `查询已完成 · 自动投递 ${run.primaryModuleId} · 等待前端确认`
                        : `查询已完成 · 自动投递目标 ${run.primaryModuleId}`}
                  </span>
                  {pushTarget?.path && <a href={pushTarget.path} className="border border-slate-700 px-2 py-0.5 text-cyan-300 hover:border-cyan-600">前端入口：{pushTarget.path}</a>}
                </div>
              )}
              <span className="text-slate-500">
                Provider {result?.metadata?.provider ?? "—"}
              </span>
              <span className="text-slate-500">
                行 {result?.metadata?.rowCount ?? "—"}
              </span>
              <span className="text-slate-500">
                字段 {result?.columns?.length ?? "—"} / 数值{" "}
                {result?.metadata?.numericFieldCount ?? "—"}
              </span>
              <span className="text-slate-500">
                范围 {result?.metadata?.rangeStart ?? "—"} →{" "}
                {result?.metadata?.rangeEnd ?? "—"}
              </span>
              <span className="text-slate-500">
                查询 {dateTime(result?.metadata?.queriedAt)}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <input
                  aria-label="筛选 OpenBB 返回行"
                  value={rowFilter}
                  onChange={event => setRowFilter(event.target.value)}
                  placeholder="筛选全部字段"
                  className="h-7 w-36 border border-slate-700 bg-black px-2 text-[11px] text-slate-200"
                />
                <button
                  aria-label="上一页"
                  onClick={() => setPage(value => Math.max(0, value - 1))}
                  disabled={!result?.rows?.length || currentPage === 0}
                  className="h-7 border border-slate-700 px-2 disabled:opacity-30"
                >
                  ‹
                </button>
                <span className="min-w-20 text-center font-mono text-[10px] text-slate-500">
                  {result?.rows?.length
                    ? `${currentPage + 1}/${pageCount} · ${filteredRows.length}`
                    : "—"}
                </span>
                <button
                  aria-label="下一页"
                  onClick={() =>
                    setPage(value => Math.min(pageCount - 1, value + 1))
                  }
                  disabled={
                    !result?.rows?.length || currentPage >= pageCount - 1
                  }
                  className="h-7 border border-slate-700 px-2 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-[405px] overflow-auto">
            {result?.rows?.length ? (
              visibleRows.length ? (
                <table className="min-w-full whitespace-nowrap text-left font-mono text-[11px]">
                  <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="border-b border-r border-slate-800 px-2 py-2">
                        #
                      </th>
                      {result.columns.map((column: string) => (
                        <th
                          key={column}
                          className="border-b border-r border-slate-800 px-2 py-2"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row: any, index: number) => (
                      <tr
                        key={currentPage * PAGE_SIZE + index}
                        className="border-b border-slate-900 hover:bg-cyan-950/20"
                      >
                        <td className="border-r border-slate-800 px-2 py-1.5 text-slate-600">
                          {currentPage * PAGE_SIZE + index + 1}
                        </td>
                        {result.columns.map((column: string) => (
                          <td
                            key={column}
                            title={String(row[column] ?? "")}
                            className="max-w-[260px] overflow-hidden text-ellipsis border-r border-slate-900 px-2 py-1.5 text-slate-300"
                          >
                            {displayValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-slate-600">
                  当前筛选没有匹配行；原始结果仍保留 {result.rows.length} 行。
                </div>
              )
            ) : (
              <div className="flex h-56 items-center justify-center text-sm text-slate-600">
                {run?.error ? (
                  <span className="max-w-xl border-l-2 border-amber-600 px-3 text-amber-200">
                    {run.error}
                  </span>
                ) : (
                  "选择端点、核对参数并运行查询；这里仅展示真实响应。"
                )}
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 bg-black px-3 py-2 text-[11px] text-slate-500">
            <span className="mr-4">
              质量 {result?.metadata?.quality ?? "—"}
            </span>
            <span className="mr-4">
              时效 {result?.metadata?.realtimeStatus ?? "—"}
            </span>
            <span className="mr-4">
              时区 {result?.metadata?.timezone ?? "—"}
            </span>
            <span className="mr-4">
              空值{" "}
              {result?.metadata
                ? `${(Number(result.metadata.nullRate ?? 0) * 100).toFixed(2)}%`
                : "—"}
            </span>
            <span className="mr-4">
              字段字典 {result?.fields?.length ?? "—"}
            </span>
            <span className="font-mono">
              校验 {result?.metadata?.checksum?.slice(0, 20) ?? "—"}
            </span>
          </div>
        </main>
        <aside className="min-w-0">
          <div className="border-b border-slate-800 p-3">
            <div className="flex items-center justify-between">
              <b className="text-sm">运行记录</b>
              {run &&
                ["failed", "not_configured", "empty"].includes(run.status) && (
                  <button
                    onClick={() => retry.mutate({ runId: run.runId })}
                    className="border border-slate-700 px-2 py-1 text-[11px]"
                  >
                    <RotateCcw className="inline h-3 w-3" /> 重试
                  </button>
                )}
            </div>
            <select
              value={run?.runId ?? ""}
              onChange={event => {
                const runId = event.target.value;
                setSelectedRunId(runId);
                const selected = runs.find((item: any) => item.runId === runId);
                if (
                  selected &&
                  endpoints.some((item: any) => item.id === selected.endpointId)
                )
                  setEndpointId(selected.endpointId);
              }}
              className="mt-2 h-8 w-full border border-slate-700 bg-black px-2 font-mono text-[11px]"
            >
              {runs.map((item: any) => (
                <option key={item.runId} value={item.runId}>
                  {statusText[item.status] ?? item.status} · {item.endpointId} ·{" "}
                  {dateTime(item.createdAt)}
                </option>
              ))}
            </select>
            {run && (
              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                <div className="flex justify-between">
                  <span>状态</span>
                  <b
                    className={
                      run.status === "succeeded"
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    {statusText[run.status] ?? run.status}
                  </b>
                </div>
                <div className="font-mono">{run.runId}</div>
                <div className="max-h-16 overflow-auto whitespace-pre-wrap">
                  {run.logs?.join("\n") || "暂无日志"}
                </div>
                {run.error && <div className="text-rose-300">{run.error}</div>}
              </div>
            )}
          </div>
          <div className="border-b border-slate-800 p-3">
            <b className="text-sm">精准投递</b>
            <p className="mt-1 text-[11px] text-slate-500">
              写入已有模块的数据流，不新增前端页面。相同内容按模块指纹拦截。
            </p>
            <input
              value={moduleFilter}
              onChange={event => setModuleFilter(event.target.value)}
              placeholder="筛选既有模块"
              className="mt-2 h-8 w-full border border-slate-700 bg-black px-2 text-xs"
            />
            <select
              aria-label="唯一投递模块"
              size={5}
              value={moduleIds[0]??''}
              onChange={event =>
                setModuleIds(
                  [event.target.value]
                )
              }
              className="mt-2 h-28 w-full border border-slate-700 bg-black p-1 text-[11px]"
            >
              {modules.map((item: any) => (
                <option key={item.id} value={item.id} disabled={Boolean(pushOwner&&pushOwner!==item.id)}>
                  {item.name} · {item.id}
                </option>
              ))}
            </select>
            <div className="mt-2 max-h-20 overflow-auto border border-slate-800 p-2 text-[11px]">
              {(data?.audience?.recipients ?? []).map((user: any) => (
                <label
                  key={user.id}
                  className="mr-2 inline-flex items-center gap-1"
                >
                  <input
                    type="checkbox"
                    checked={recipientIds.includes(user.id)}
                    onChange={event =>
                      setRecipientIds(current =>
                        event.target.checked
                          ? uniqueNumber([...current, user.id])
                          : current.filter(id => id !== user.id)
                      )
                    }
                  />
                  {user.name || user.email || `用户 ${user.id}`}
                  {user.id === data?.audience?.currentUserId
                    ? "（当前操作者）"
                    : ""}
                </label>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              前端接收人：
              {(data?.audience?.recipients ?? [])
                .filter((user: any) => recipientIds.includes(user.id))
                .map(
                  (user: any) =>
                    `${user.name || user.email || "用户"} · ID ${user.id}`
                )
                .join("；") || "未选择"}
            </div>
            <button
              onClick={() =>
                push.mutate({
                  runId: run.runId,
                  moduleIds,
                  recipientUserIds: recipientIds,
                })
              }
              disabled={!canPush || push.isPending}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-cyan-700 py-2 text-xs text-cyan-200 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              投递所选数据并等待 ACK
            </button>
          </div>
          <div className="p-3 text-[11px]">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-300" />
              <b>推送生命周期</b>
            </div>
            {run?.push ? (
              <div className="mt-2 space-y-1 text-slate-400">
                <div className="font-mono text-cyan-200">{run.push.pushId}</div>
                <div>{run.push.contentPreview}</div>
                <div>
                  目标槽 {run.push.targetCount} · 已确认 {run.push.successCount}{" "}
                  · 待确认 {run.push.pendingCount} · 失败{" "}
                  {run.push.failureCount}
                </div>
                <div>
                  重复拦截 {run.push.duplicateBlockedCount} · 重试{" "}
                  {run.push.retryCount}
                </div>
                <div>发送 {dateTime(run.push.sentAt)}</div>
                <div>
                  接收 {dateTime(run.push.receivedAt)} · 应用{" "}
                  {dateTime(run.push.appliedAt)}
                </div>
                <div
                  className={
                    run.push.status === "front_acknowledged"
                      ? "text-emerald-300"
                      : "text-amber-300"
                  }
                >
                  {statusText[run.push.status] ?? run.push.status} ·{" "}
                  {run.push.acknowledgement}
                </div>
                <div className="break-all font-mono text-slate-600">
                  traceId {run.push.traceId}
                </div>
                {run.lastPushAttempt &&
                  run.lastPushAttempt.pushId !== run.push.pushId && (
                    <div className="mt-2 border-t border-slate-800 pt-2 text-amber-300">
                      最近尝试：
                      {statusText[run.lastPushAttempt.status] ??
                        run.lastPushAttempt.status}{" "}
                      · 原推送{" "}
                      {run.lastPushAttempt.duplicateOfPushIds?.join("、") ||
                        run.push.pushId}
                      <div className="break-all font-mono text-slate-600">
                        traceId {run.lastPushAttempt.traceId}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <p className="mt-2 text-slate-600">
                没有推送。数据库写入不计成功，只有指定前端真实渲染后才更新 ACK。
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function uniqueNumber(values: number[]) {
  return [...new Set(values)];
}
