import React, { FormEvent, useMemo, useState } from "react";
import { KeyRound, Loader2, Pause, Play, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const statuses: Record<string, string> = {
  key_missing: "等待密钥",
  adapter_pending: "等待字段适配",
  available: "可用",
  unavailable: "不可用",
  not_configured: "未配置",
};
const adapterStatuses: Record<string, string> = {
  implemented: "适配器已实现",
  catalog_only: "合同已登记 / 待适配",
};
const emptyForm = {
  providerCode: "",
  providerName: "",
  apiBaseUrl: "",
  apiKeyEnvName: "",
  marketCoverage: "",
  capabilities: "",
  delayLevel: "unknown" as "unknown" | "realtime" | "delayed" | "end_of_day",
};

export function MarketApiProviderConfig({
  onCompleted,
}: {
  onCompleted?: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [managedSyncing, setManagedSyncing] = useState<string | null>(null);
  const [managedScheduleInterval, setManagedScheduleInterval] = useState<1 | 5 | 10 | 30 | 60>(1);
  const catalog = trpc.adminMarketIngestion.providerCatalog.useQuery();
  const configs = trpc.adminMarketIngestion.listProviderConfigs.useQuery();
  const testIfind = trpc.adminMarketIngestion.testIfindConnection.useMutation({
    onSuccess: data =>
      data.connectionStatus === "available"
        ? toast.success("同花顺 iFinD SDK 登录验证通过。")
        : toast.error(data.reason),
    onError: error => toast.error(error.message),
  });
  const save = trpc.adminMarketIngestion.saveProviderConfig.useMutation({
    onSuccess: data => {
      toast.success(
        data.connectionStatus === "key_missing"
          ? "提供方已保存：请在安全配置中填写同名密钥后再启用。"
          : "提供方已保存：已检测到密钥名称，等待专用字段适配。"
      );
      setForm(emptyForm);
      onCompleted?.();
    },
    onError: error => toast.error(error.message),
  });
  const syncManaged =
    trpc.adminMarketIngestion.syncManagedPublicDataset.useMutation({
      onSuccess: data => {
        setManagedSyncing(null);
        data.status === "available"
          ? toast.success(
              `归档完成：新增 ${data.archive.inserted}、修订 ${data.archive.revisions}、重复拦截 ${data.archive.duplicate}。`
            )
          : toast.error(data.reason);
        onCompleted?.();
      },
      onError: error => {
        setManagedSyncing(null);
        toast.error(error.message);
      },
    });
  const syncAllManaged =
    trpc.adminMarketIngestion.syncAllManagedPublicDatasets.useMutation({
      onSuccess: results => {
        const available = results.filter(item => item.status === "available").length;
        const unavailable = results.filter(item => item.status === "unavailable").length;
        const failed = results.filter(item => item.status === "failed").length;
        const inserted = results.reduce(
          (sum, item) => sum + (item.archive?.inserted ?? 0),
          0
        );
        const duplicate = results.reduce(
          (sum, item) => sum + (item.archive?.duplicate ?? 0),
          0
        );
        toast.success(
          `批量检查完成：可用 ${available}、不可用 ${unavailable}、失败 ${failed}；新增 ${inserted}、重复拦截 ${duplicate}。`
        );
        void catalog.refetch();
        onCompleted?.();
      },
      onError: error => toast.error(error.message),
    });
  const enableManagedSchedule =
    trpc.adminMarketIngestion.enableManagedPublicDatasetSchedule.useMutation({
      onSuccess: () => {
        toast.success("公开数据契约自动采集计划已启用。");
        onCompleted?.();
      },
      onError: error => toast.error(error.message),
    });
  const pauseManagedSchedule =
    trpc.adminMarketIngestion.pauseManagedPublicDatasetSchedule.useMutation({
      onSuccess: () => {
        toast.success("公开数据契约自动采集计划已暂停。");
        onCompleted?.();
      },
      onError: error => toast.error(error.message),
    });
  const rows = useMemo(() => configs.data ?? [], [configs.data]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({
      providerCode: form.providerCode.trim().toUpperCase() || undefined,
      providerName: form.providerName,
      apiBaseUrl: form.apiBaseUrl,
      apiKeyEnvName: form.apiKeyEnvName.trim().toUpperCase(),
      marketCoverage: form.marketCoverage
        .split(/[,，]/)
        .map(item => item.trim())
        .filter(Boolean),
      capabilities: form.capabilities
        .split(/[,，]/)
        .map(item => item.trim())
        .filter(Boolean),
      delayLevel: form.delayLevel,
    });
  };
  return (
    <section className="rounded-lg border border-emerald-400/20 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <KeyRound className="h-4 w-4 text-emerald-300" />
            行情 API 接入准备
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            先保存提供方与接口契约。密钥不会写入数据库或前端：请在项目安全配置中设置同名环境变量。保存后只检测变量是否存在，并如实显示待适配状态，不会假装已经取得行情。
          </p>
        </div>
        <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200">
          不连接下单
        </span>
      </div>
      <div className="mt-4 overflow-x-auto rounded border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-950/40 px-3 py-2 text-[10px] text-slate-400">
          <span className="font-semibold text-cyan-200">全球候选接口目录：</span>
          {catalog.data?.globalProviderSummary?.total ?? 0} 个去重登记项，公开免密 {catalog.data?.globalProviderSummary?.publicNoKey ?? 0}，需密钥 {catalog.data?.globalProviderSummary?.requiresKey ?? 0}，商业许可 {catalog.data?.globalProviderSummary?.licensed ?? 0}。
          <span className="ml-2 text-slate-300">用户清单：{catalog.data?.userCatalogSummary?.sourceRecordCount ?? 0} 条记录 / {catalog.data?.userCatalogSummary?.uniqueCandidateCount ?? 0} 个去重候选，重复 {catalog.data?.userCatalogSummary?.duplicateRecordCount ?? 0}。</span>
          <span className="ml-2 text-amber-300">目录登记不等于已授权或已查询；只有真实凭据、字段适配和成功观察才会进入已配置统计。</span>
        </div>
        <div className="max-h-40 overflow-auto border-b border-slate-800">
          <table className="w-full min-w-[880px] text-left text-[10px] text-slate-400">
            <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="px-3 py-1.5">新增候选接口</th><th className="px-3 py-1.5">地区 / 资产</th><th className="px-3 py-1.5">访问级别</th><th className="px-3 py-1.5">连接状态</th><th className="px-3 py-1.5">边界</th></tr></thead>
            <tbody>{(catalog.data?.globalProviderSources ?? []).filter((source: any) => !['fred-public','world-bank','eurostat','eia-open','bls-public','sec-edgar'].includes(source.id)).slice(0, 36).map((source: any) => <tr key={source.id} className="border-t border-slate-800/70"><td className="px-3 py-1.5 font-medium text-slate-200">{source.name}</td><td className="px-3 py-1.5">{source.region} · {source.assetClasses.join('、')}</td><td className="px-3 py-1.5">{source.access}</td><td className="px-3 py-1.5 text-amber-300">{source.configured ? '已配置待验证' : '未配置'}</td><td className="px-3 py-1.5">{source.legalBoundary}</td></tr>)}</tbody>
          </table>
        </div>
        <table className="w-full min-w-[880px] text-left text-[11px] text-slate-300">
          <caption className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-200">
            可发现的数据服务（免密公开源与需密钥免费额度分开）
          </caption>
          <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">提供方</th>
              <th className="px-3 py-2">访问方式</th>
              <th className="px-3 py-2">配置状态</th>
              <th className="px-3 py-2">覆盖</th>
              <th className="px-3 py-2">时效边界</th>
              <th className="px-3 py-2">限制</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {catalog.isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  正在读取公开服务目录…
                </td>
              </tr>
            ) : (
              [
                ...(catalog.data?.freeSources ?? []),
                ...(catalog.data?.optionalSources ?? []),
                ...(catalog.data?.localSdkSources ?? []),
              ].map((source: any) => (
                <tr key={source.id}>
                  <td className="px-3 py-2 font-medium text-slate-100">
                    {source.provider}
                  </td>
                  <td className="px-3 py-2">
                    {source.access === "public_no_key"
                      ? "公开免密"
                      : source.access === "local_licensed_sdk"
                        ? "本机授权 SDK"
                        : "免费额度 + 密钥"}
                  </td>
                  <td className="px-3 py-2">
                    {source.access === "public_no_key" ? (
                      <span className="text-emerald-300">无需密钥</span>
                    ) : source.access === "local_licensed_sdk" ? (
                      <span
                        className={
                          source.configured
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                      >
                        {source.configured
                          ? "SDK 与凭据已检测"
                          : source.sdkInstalled
                            ? "SDK 已安装 / 等待凭据"
                            : "未检测到 SDK"}
                      </span>
                    ) : (
                      <span
                        className={
                          source.configured
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                      >
                        {source.configured
                          ? source.adapterStatus === "implemented"
                            ? "密钥已检测"
                            : "密钥已检测 / 待适配"
                          : `未配置 ${source.apiKeyEnvName}`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {source.assetClasses.join("、")}
                  </td>
                  <td className="px-3 py-2">{source.updateBoundary}</td>
                  <td className="max-w-[420px] px-3 py-2 text-slate-400">
                    {source.adapterStatus && (
                      <span className="mr-1 font-semibold text-cyan-300">
                        {adapterStatuses[source.adapterStatus] ??
                          source.adapterStatus}
                        。
                      </span>
                    )}
                    {source.mosoCompatible && (
                      <span className="mr-1 font-semibold text-fuchsia-300">
                        MOSO 期权候选。
                      </span>
                    )}
                    {source.limitation}
                    {source.access === "local_licensed_sdk" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!source.configured || testIfind.isPending}
                        onClick={() => testIfind.mutate()}
                        className="ml-2 h-7 border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                      >
                        {testIfind.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        验证连接
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 overflow-x-auto rounded border border-slate-800">
        <table className="w-full min-w-[980px] text-left text-[11px] text-slate-300">
          <caption className="border-b border-slate-800 bg-slate-950/40 px-3 py-2 text-left text-[10px] font-normal text-slate-400">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              唯一功能归属的公开 API 归档任务
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2">自动采集：</span>
            {catalog.data?.managedDatasetSchedule?.isEnabled ? (
              <span className="text-emerald-300">
                已启用（{catalog.data.managedDatasetSchedule.cronExpression}）
              </span>
            ) : (
              <span className="text-amber-300">未启用</span>
            )}
            <select
              aria-label="公开数据自动采集频率"
              value={managedScheduleInterval}
              onChange={event =>
                setManagedScheduleInterval(Number(event.target.value) as 1 | 5 | 10 | 30 | 60)
              }
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] text-slate-200"
            >
              <option value={1}>每 1 分钟</option>
              <option value={5}>每 5 分钟</option>
              <option value={10}>每 10 分钟</option>
              <option value={30}>每 30 分钟</option>
              <option value={60}>每 60 分钟</option>
            </select>
            <span className="text-[10px] text-slate-500">
              总调度按分钟检查；每个数据集仍按其发布频率与退避状态决定是否访问上游。
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enableManagedSchedule.isPending || syncAllManaged.isPending}
              onClick={() => enableManagedSchedule.mutate({ intervalMinutes: managedScheduleInterval })}
              className="h-7 border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
            >
              {enableManagedSchedule.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
              启用自动采集
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncAllManaged.isPending}
              onClick={() => syncAllManaged.mutate()}
              className="h-7 border-cyan-700/70 bg-cyan-950/30 px-2 text-[10px] text-cyan-200"
            >
              {syncAllManaged.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              批量检查并永久归档
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!catalog.data?.managedDatasetSchedule?.isEnabled || pauseManagedSchedule.isPending}
              onClick={() => pauseManagedSchedule.mutate()}
              className="h-7 border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-400"
            >
              {pauseManagedSchedule.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Pause className="mr-1 h-3 w-3" />}
              暂停自动采集
            </Button>
            </div>
          </caption>
          <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">数据集</th>
              <th className="px-3 py-2">唯一归属</th>
              <th className="px-3 py-2">数据契约</th>
              <th className="px-3 py-2">频率</th>
              <th className="px-3 py-2">采集与观测</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(catalog.data?.managedDatasets ?? []).map(dataset => (
              <tr key={dataset.id}>
                <td className="px-3 py-2 font-medium text-slate-100">
                  {dataset.label}
                  <span className="block font-mono text-[10px] text-slate-500">
                    {dataset.symbol}
                  </span>
                </td>
                <td className="px-3 py-2 text-cyan-200">{dataset.moduleId}</td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  {dataset.dataContractId}
                </td>
                <td className="px-3 py-2">
                  {dataset.frequency}
                  <span className="block text-[10px] text-slate-500">
                    每 {dataset.pollMinutes} 分钟检查
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px]">
                  <span className={dataset.state?.lastStatus === "available" ? "text-emerald-300" : dataset.state?.lastStatus === "unavailable" || dataset.state?.lastStatus === "failed" ? "text-amber-300" : "text-slate-500"}>
                    {dataset.state?.lastStatus === "available" ? "最近抓取成功" : dataset.state?.lastStatus === "unavailable" || dataset.state?.lastStatus === "failed" ? "最近抓取失败" : "尚未验证"}
                  </span>
                  <span className="block text-slate-400">
                    抓取：{dataset.state?.lastSuccessAt ? new Date(dataset.state.lastSuccessAt).toLocaleString("zh-CN") : "尚无成功记录"}
                  </span>
                  <span className="block text-slate-400">
                    最近观测：{dataset.archive === null ? "数据库暂不可读" : dataset.archive.latestObservationDate ?? "尚无入库观测"}
                    {dataset.archive && ` · ${dataset.archive.storedVersions} 个版本`}
                  </span>
                  <span className="block text-slate-500">
                    下次：{dataset.state?.nextAttemptAt ? new Date(dataset.state.nextAttemptAt).toLocaleString("zh-CN") : "待首次检查"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncManaged.isPending}
                    onClick={() => {
                      setManagedSyncing(dataset.id);
                      syncManaged.mutate({ id: dataset.id });
                    }}
                    className="h-7 border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200"
                  >
                    {managedSyncing === dataset.id && syncManaged.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    采集并永久归档
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <label className="grid gap-1 text-xs text-slate-400">
          <span>
            提供方名称 <b className="text-emerald-300">必填</b>
          </span>
          <Input
            required
            value={form.providerName}
            onChange={event =>
              setForm({ ...form, providerName: event.target.value })
            }
            placeholder="例如：授权行情提供方"
            className="border-slate-700 bg-slate-950 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          <span>
            HTTPS API 地址 <b className="text-emerald-300">必填</b>
          </span>
          <Input
            required
            type="url"
            value={form.apiBaseUrl}
            onChange={event =>
              setForm({ ...form, apiBaseUrl: event.target.value })
            }
            placeholder="https://api.example.com"
            className="border-slate-700 bg-slate-950 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          <span>
            密钥环境变量名 <b className="text-emerald-300">必填</b>
          </span>
          <Input
            required
            value={form.apiKeyEnvName}
            onChange={event =>
              setForm({
                ...form,
                apiKeyEnvName: event.target.value.toUpperCase(),
              })
            }
            placeholder="例如：PROVIDER_API_KEY"
            className="border-slate-700 bg-slate-950 text-slate-100"
          />
        </label>
        <details className="md:col-span-2 xl:col-span-3 rounded border border-slate-800 bg-slate-950/45 p-3">
          <summary className="cursor-pointer text-xs text-slate-300">
            高级配置 <span className="text-slate-500">（全部选填）</span>
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-xs text-slate-400">
              <span>提供方代码（选填，留空自动生成）</span>
              <Input
                value={form.providerCode}
                onChange={event =>
                  setForm({
                    ...form,
                    providerCode: event.target.value.toUpperCase(),
                  })
                }
                placeholder="例如：MY_DATA_API"
                className="border-slate-700 bg-slate-950 text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              <span>覆盖市场（选填，逗号分隔）</span>
              <Input
                value={form.marketCoverage}
                onChange={event =>
                  setForm({ ...form, marketCoverage: event.target.value })
                }
                placeholder="例如：CN_STOCK, HK_STOCK"
                className="border-slate-700 bg-slate-950 text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              <span>字段能力（选填，逗号分隔）</span>
              <Input
                value={form.capabilities}
                onChange={event =>
                  setForm({ ...form, capabilities: event.target.value })
                }
                placeholder="例如：OHLCV, NEWS"
                className="border-slate-700 bg-slate-950 text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-400">
              <span>延迟等级（选填）</span>
              <select
                aria-label="API 行情延迟等级"
                value={form.delayLevel}
                onChange={event =>
                  setForm({
                    ...form,
                    delayLevel: event.target.value as typeof form.delayLevel,
                  })
                }
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option value="unknown">未声明</option>
                <option value="realtime">实时（须授权核验）</option>
                <option value="delayed">延迟</option>
                <option value="end_of_day">日终</option>
              </select>
            </label>
          </div>
        </details>
        <div className="md:col-span-2 xl:col-span-3">
          <Button
            type="submit"
            disabled={save.isPending}
            className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存提供方配置
          </Button>
        </div>
      </form>
      <div className="mt-4 space-y-2">
        {configs.isLoading ? (
          <div className="text-xs text-slate-500">
            正在读取已保存的 API 提供方…
          </div>
        ) : !rows.length ? (
          <div className="rounded border border-dashed border-slate-700 p-3 text-xs text-slate-500">
            暂无 API 提供方配置。添加后会显示密钥检测与字段适配状态。
          </div>
        ) : (
          rows.map(row => (
            <div
              key={row.id}
              className="rounded border border-slate-800 bg-slate-950/60 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-100">
                  {row.providerName}{" "}
                  <span className="font-mono text-xs text-slate-500">
                    {row.providerCode}
                  </span>
                </div>
                <span
                  className={`rounded px-2 py-1 text-[10px] ${row.connectionStatus === "available" ? "bg-emerald-950 text-emerald-200" : row.connectionStatus === "key_missing" ? "bg-amber-950 text-amber-200" : "bg-slate-800 text-slate-300"}`}
                >
                  {statuses[row.connectionStatus] ?? row.connectionStatus}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-[10px] text-slate-400 sm:grid-cols-2">
                <div>
                  密钥变量：
                  <span className="font-mono text-cyan-200">
                    {row.apiKeyEnvName}
                  </span>{" "}
                  · {row.hasConfiguredKey ? "已检测到（不显示值）" : "尚未配置"}
                </div>
                <div>
                  覆盖：
                  {row.marketCoverage.length
                    ? row.marketCoverage.join("、")
                    : "未声明"}{" "}
                  · {row.delayLevel}
                </div>
                <div className="sm:col-span-2">
                  能力：
                  {row.capabilities.length
                    ? row.capabilities.join("、")
                    : "未声明"}
                  ；状态：{row.lastError ?? "等待状态核验。"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
        提供方必须完成专用字段适配与实际响应验证，才会显示为“可用”并启用数据读取。
      </div>
    </section>
  );
}
