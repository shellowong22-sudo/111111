import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Braces,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  Database,
  Download,
  FileSearch,
  Globe2,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/AdminLayout";
import { blockedReasonForContent, partitionScraplingPushContent } from "@/lib/scraplingPushLedger";
import { trpc } from "@/lib/trpc";

type Panel = "runs" | "result" | "parser" | "capabilities" | "push" | "audit";
type RunMode = "static" | "dynamic" | "stealth";
type TaskKind = "fetch" | "crawl";

const PANELS: Array<{ id: Panel; label: string; icon: typeof Activity }> = [
  { id: "runs", label: "采集与 Spider", icon: Play },
  { id: "result", label: "结果与原始快照", icon: Database },
  { id: "parser", label: "自适应解析", icon: Braces },
  { id: "capabilities", label: "完整能力清单", icon: Network },
  { id: "push", label: "前端推送与 ACK", icon: Send },
  { id: "audit", label: "日志与合规", icon: ShieldCheck },
];

function statusTone(status: string) {
  if (["ready", "completed", "front_acknowledged", "allowed", "enforced", "installed"].includes(status)) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (["running", "queued", "waiting_front_ack", "available", "environment"].includes(status)) return "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
  if (["failed", "cancelled", "blocked"].includes(status)) return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  return "border-amber-500/40 bg-amber-500/10 text-amber-200";
}

function Status({ value }: { value: string }) {
  return <span className={`inline-flex border px-2 py-0.5 text-[11px] font-semibold ${statusTone(value)}`}>{value}</span>;
}

function dateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function downloadPayload(fileName: string, mime: string, content: string) {
  const href = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

export default function AdminScrapling() {
  const utils = trpc.useUtils();
  const dashboard = trpc.adminScrapling.dashboard.useQuery(undefined, {
    retry: false,
    refetchInterval: query => {
      const rows = (query.state.data as any)?.runs ?? [];
      return rows.some((run: any) => run.status === "queued" || run.status === "running") ? 1200 : 5000;
    },
  });
  const [panel, setPanel] = useState<Panel>("runs");
  const [taskKind, setTaskKind] = useState<TaskKind>("fetch");
  const [mode, setMode] = useState<RunMode>("static");
  const [urlsText, setUrlsText] = useState("https://example.com/");
  const [selectorType, setSelectorType] = useState<"css" | "xpath">("css");
  const [selector, setSelector] = useState("h1::text");
  const [adaptive, setAdaptive] = useState(true);
  const [networkIdle, setNetworkIdle] = useState(true);
  const [disableResources, setDisableResources] = useState(true);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [maxPages, setMaxPages] = useState(10);
  const [concurrency, setConcurrency] = useState(2);
  const [delayMs, setDelayMs] = useState(750);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [parseSelector, setParseSelector] = useState("title::text");
  const [parseType, setParseType] = useState<"css" | "xpath">("css");
  const [parseAdaptive, setParseAdaptive] = useState(true);
  const [parseResult, setParseResult] = useState<any>(null);
  const [moduleQuery, setModuleQuery] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
  const [audienceInitialized, setAudienceInitialized] = useState(false);
  const [sourceInspection, setSourceInspection] = useState<any>(null);

  const runs = (dashboard.data as any)?.runs ?? [];
  useEffect(() => {
    if (!selectedRunId && runs[0]?.runId) setSelectedRunId(runs[0].runId);
  }, [runs, selectedRunId]);
  const selectedRun = runs.find((run: any) => run.runId === selectedRunId) ?? null;
  const selectedItem = selectedRun?.result?.items?.[selectedItemIndex] ?? null;
  const selectedResultItems = selectedRun?.result?.items ?? [];
  const deliverableResultItems = selectedResultItems.filter((item: any) => !item.duplicateOfContentHash && !item.qualityRejectionReason && item.status >= 200 && item.status < 300 && (item.markdown || item.text || "").length >= 80);
  const blockedResultItemCount = selectedResultItems.length - deliverableResultItems.length;
  const urls = useMemo(() => urlsText.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean), [urlsText]);
  const modules = ((dashboard.data as any)?.modules ?? []).filter((module: any) => {
    const key = moduleQuery.trim().toLowerCase();
    return !key || `${module.id} ${module.name} ${module.path} ${module.domain}`.toLowerCase().includes(key);
  });
  const allModules = (dashboard.data as any)?.modules ?? [];
  const selectedTargets = allModules.filter((module: any) => selectedModules.includes(module.id));
  const deliveryAudience: any = (dashboard.data as any)?.deliveryAudience;
  const selectedRecipients = (deliveryAudience?.recipients ?? []).filter((recipient: any) => selectedRecipientIds.includes(recipient.userId));
  useEffect(() => {
    if (audienceInitialized || !deliveryAudience?.currentUserId) return;
    setSelectedRecipientIds([deliveryAudience.currentUserId]);
    setAudienceInitialized(true);
  }, [audienceInitialized, deliveryAudience?.currentUserId]);

  const refresh = async () => {
    await utils.adminScrapling.dashboard.invalidate();
    await dashboard.refetch();
  };
  const inspect = trpc.adminScrapling.inspectSource.useMutation({
    onSuccess: result => {
      setSourceInspection(result);
      toast.success("来源地址、DNS 边界与 robots.txt 检查完成");
    },
    onError: error => toast.error(`来源检查失败：${error.message}`),
  });
  const start = trpc.adminScrapling.start.useMutation({
    onSuccess: async run => {
      setSelectedRunId(run.runId);
      setSelectedItemIndex(0);
      setPanel("result");
      toast.success(`已启动真实运行 ${run.runId}`);
      await refresh();
    },
    onError: error => toast.error(`运行未启动：${error.message}`),
  });
  const pause = trpc.adminScrapling.pause.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const resume = trpc.adminScrapling.resume.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const cancel = trpc.adminScrapling.cancel.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const parse = trpc.adminScrapling.parse.useMutation({
    onSuccess: result => {
      setParseResult(result);
      toast.success(`真实快照解析完成：${(result as any).values?.length ?? 0} 条`);
    },
    onError: error => toast.error(`解析失败：${error.message}`),
  });
  const exportRun = trpc.adminScrapling.export.useMutation({
    onSuccess: result => downloadPayload(result.fileName, result.mime, result.content),
    onError: error => toast.error(`导出失败：${error.message}`),
  });
  const push = trpc.adminScrapling.push.useMutation({
    onSuccess: async record => {
      toast.success(record.status === "duplicate_blocked" ? "重复内容已拦截，没有再次展示" : "已进入指定前端，等待页面应用 ACK");
      await refresh();
    },
    onError: error => toast.error(`推送未完成：${error.message}`),
  });

  const submit = () => {
    if (!urls.length) return toast.error("请输入至少一个公开来源地址");
    if (taskKind === "crawl" && urls.length !== 1) return toast.error("Spider 只能使用一个入口地址");
    start.mutate({ taskKind, mode, urls, selectorType, selector, adaptive, networkIdle, disableResources, timeoutMs, maxPages, concurrency, delayMs });
  };

  const health: any = (dashboard.data as any)?.health;
  const counts: any = (dashboard.data as any)?.counts;
  const mutationBusy = start.isPending || inspect.isPending || pause.isPending || resume.isPending || cancel.isPending;

  return (
    <AdminLayout>
      <div data-admin-scrapling className="min-h-[calc(100vh-3.5rem)] bg-slate-950 text-slate-100">
        <header className="border-b border-slate-700 bg-slate-900 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-cyan-300" />
              <div>
                <div className="flex items-center gap-2"><h1 className="text-lg font-bold">Scrapling 采集引擎</h1><Status value={health?.ok ? "ready" : "failed"} /></div>
                <p className="text-xs text-slate-400">独立后台模块 · vendored 0.4.15 · 公共来源只读采集 · 强制 robots 与 SSRF 边界</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>运行 <b className="text-white">{counts?.total ?? "—"}</b></span>
              <span>执行中 <b className="text-cyan-300">{counts?.running ?? "—"}</b></span>
              <span>完成 <b className="text-emerald-300">{counts?.completed ?? "—"}</b></span>
              <span>去重 <b className="text-amber-300">{counts?.duplicate ?? "—"}</b></span>
              <button type="button" onClick={refresh} disabled={dashboard.isFetching} className="inline-flex items-center gap-1 border border-slate-600 px-3 py-1.5 text-slate-200 disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${dashboard.isFetching ? "animate-spin" : ""}`} />刷新</button>
            </div>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-7.5rem)] lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="border-r border-slate-700 bg-slate-900/70 p-2">
            {PANELS.map(item => <button key={item.id} type="button" onClick={() => setPanel(item.id)} className={`flex w-full items-center gap-2 border-b border-slate-800 px-3 py-3 text-left text-sm ${panel === item.id ? "bg-cyan-950 text-cyan-200" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}><item.icon className="h-4 w-4" /><span className="flex-1">{item.label}</span><ChevronRight className="h-3.5 w-3.5" /></button>)}
            <div className="mt-4 border border-slate-700 p-3 text-[11px] leading-5 text-slate-400">
              <b className="text-slate-200">运行边界</b><br />禁止内网地址、非标准端口、凭据 URL、验证码、挑战绕过、访问控制和付费墙绕过。StealthyFetcher 源码保留但默认不开放规避模式。
            </div>
          </aside>

          <main className="min-w-0 p-3 lg:p-4">
            {dashboard.isLoading ? <div className="border border-slate-700 p-6 text-sm text-slate-400">正在读取 Scrapling 运行环境…</div> : dashboard.error ? <div className="border border-rose-700 bg-rose-950/30 p-6 text-sm text-rose-200">后台读取失败：{dashboard.error.message}</div> : null}

            {panel === "runs" && <div className="grid gap-3 xl:grid-cols-[minmax(460px,0.9fr)_minmax(560px,1.4fr)]">
              <section className="border border-slate-700 bg-slate-900/50">
                <div className="border-b border-slate-700 px-4 py-2 text-sm font-semibold">运行参数</div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">任务类型<select aria-label="Scrapling任务类型" value={taskKind} onChange={event => setTaskKind(event.target.value as TaskKind)} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm text-white"><option value="fetch">Fetcher 单页/批量</option><option value="crawl">Spider 站内爬取</option></select></label>
                  <label className="text-xs text-slate-400">引擎<select aria-label="Scrapling引擎" value={mode} onChange={event => setMode(event.target.value as RunMode)} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm text-white"><option value="static">Fetcher 静态请求</option><option value="dynamic">DynamicFetcher 动态浏览器</option><option value="stealth">StealthyFetcher（策略限制）</option></select></label>
                  <label className="sm:col-span-2 text-xs text-slate-400">公开来源地址（每行一个）<textarea aria-label="Scrapling公开来源地址" value={urlsText} onChange={event => setUrlsText(event.target.value)} rows={4} className="mt-1 w-full border border-slate-600 bg-slate-950 p-2 font-mono text-xs text-white" /></label>
                  <label className="text-xs text-slate-400">选择器类型<select aria-label="Scrapling选择器类型" value={selectorType} onChange={event => setSelectorType(event.target.value as "css" | "xpath")} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm text-white"><option value="css">CSS</option><option value="xpath">XPath</option></select></label>
                  <label className="text-xs text-slate-400">选择器<input aria-label="Scrapling选择器" value={selector} onChange={event => setSelector(event.target.value)} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 font-mono text-xs text-white" /></label>
                  <label className="text-xs text-slate-400">超时毫秒<input aria-label="Scrapling超时" type="number" min={3000} max={120000} value={timeoutMs} onChange={event => setTimeoutMs(Number(event.target.value))} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm" /></label>
                  <label className="text-xs text-slate-400">最大页面<input aria-label="Scrapling最大页面" type="number" min={1} max={100} value={maxPages} disabled={taskKind !== "crawl"} onChange={event => setMaxPages(Number(event.target.value))} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm disabled:opacity-40" /></label>
                  <label className="text-xs text-slate-400">并发数<input aria-label="Scrapling并发数" type="number" min={1} max={8} value={concurrency} disabled={taskKind !== "crawl"} onChange={event => setConcurrency(Number(event.target.value))} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm disabled:opacity-40" /></label>
                  <label className="text-xs text-slate-400">请求间隔毫秒<input aria-label="Scrapling请求间隔" type="number" min={250} max={60000} value={delayMs} disabled={taskKind !== "crawl"} onChange={event => setDelayMs(Number(event.target.value))} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm disabled:opacity-40" /></label>
                  <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-700 pt-3 text-xs text-slate-300">
                    <label><input type="checkbox" checked={adaptive} onChange={event => setAdaptive(event.target.checked)} className="mr-1" />自适应元素定位</label>
                    <label><input type="checkbox" checked={networkIdle} disabled={mode === "static"} onChange={event => setNetworkIdle(event.target.checked)} className="mr-1" />等待网络空闲</label>
                    <label><input type="checkbox" checked={disableResources} disabled={mode === "static"} onChange={event => setDisableResources(event.target.checked)} className="mr-1" />屏蔽媒体资源</label>
                    <span className="text-emerald-300">robots.txt 强制开启</span>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => inspect.mutate({ url: urls[0] ?? "" })} disabled={!urls[0] || mutationBusy} className="inline-flex items-center gap-1 border border-slate-600 px-3 py-2 text-sm disabled:opacity-40"><FileSearch className="h-4 w-4" />检查来源</button>
                    <button type="button" onClick={submit} disabled={mutationBusy || mode === "stealth"} className="inline-flex items-center gap-1 border border-cyan-500 bg-cyan-950 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40"><Play className="h-4 w-4" />{start.isPending ? "启动中…" : "启动真实采集"}</button>
                    {mode === "stealth" && <span className="self-center text-xs text-amber-300">默认禁止规避检测模式；源码和状态仍完整登记。</span>}
                  </div>
                  {sourceInspection && <pre className="sm:col-span-2 max-h-40 overflow-auto border border-slate-700 bg-slate-950 p-2 text-[11px] text-slate-300">{JSON.stringify(sourceInspection, null, 2)}</pre>}
                </div>
              </section>
              <RunLedger rows={runs} selectedRunId={selectedRunId} onSelect={setSelectedRunId} busy={mutationBusy} onPause={runId => pause.mutate({ runId })} onResume={runId => resume.mutate({ runId })} onCancel={runId => cancel.mutate({ runId })} />
            </div>}

            {panel === "result" && <ResultPanel run={selectedRun} itemIndex={selectedItemIndex} onItemIndex={setSelectedItemIndex} onOpenParser={() => setPanel("parser")} onExport={(format: "json" | "jsonl" | "csv" | "xml") => selectedRun && exportRun.mutate({ runId: selectedRun.runId, format })} />}

            {panel === "parser" && <section className="border border-slate-700 bg-slate-900/50">
              <div className="border-b border-slate-700 px-4 py-2 text-sm font-semibold">保存快照上的 CSS / XPath / Adaptive 重解析</div>
              {!selectedItem ? <div className="p-6 text-sm text-slate-400">先选择一个已完成且包含原始快照的运行结果。</div> : <div className="grid gap-3 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="border border-slate-700 p-3 text-xs text-slate-300"><b className="block text-white">{selectedItem.title || "无标题"}</b><span className="break-all">{selectedItem.url}</span><br />SHA-256 {selectedItem.contentHash}</div>
                  <label className="block text-xs text-slate-400">类型<select value={parseType} onChange={event => setParseType(event.target.value as "css" | "xpath")} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 text-sm"><option value="css">CSS</option><option value="xpath">XPath</option></select></label>
                  <label className="block text-xs text-slate-400">表达式<input aria-label="快照解析表达式" value={parseSelector} onChange={event => setParseSelector(event.target.value)} className="mt-1 h-9 w-full border border-slate-600 bg-slate-950 px-2 font-mono text-xs" /></label>
                  <label className="block text-xs text-slate-300"><input type="checkbox" checked={parseAdaptive} onChange={event => setParseAdaptive(event.target.checked)} className="mr-1" />使用自适应存储尝试重定位</label>
                  <button type="button" onClick={() => parse.mutate({ runId: selectedRun.runId, itemIndex: selectedItemIndex, selectorType: parseType, selector: parseSelector, adaptive: parseAdaptive })} disabled={!parseSelector.trim() || parse.isPending} className="inline-flex items-center gap-1 border border-cyan-500 px-3 py-2 text-sm text-cyan-200 disabled:opacity-40"><Braces className="h-4 w-4" />{parse.isPending ? "解析中…" : "解析真实快照"}</button>
                </div>
                <pre className="min-h-80 overflow-auto border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">{parseResult ? JSON.stringify(parseResult, null, 2) : "尚未执行重解析。结果只来自已保存原始 HTML，不会补造字段。"}</pre>
              </div>}
            </section>}

            {panel === "capabilities" && <CapabilityTable health={health} />}

            {panel === "push" && <section className="grid gap-3 2xl:grid-cols-[minmax(390px,0.72fr)_minmax(720px,1.55fr)]">
              <div className="border border-slate-700 bg-slate-900/50">
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-sm font-semibold"><span>现有前端模块目录</span><span className="text-xs font-normal text-cyan-300">已选 {selectedModules.length} / {allModules.length}</span></div>
                <div className="p-3"><input aria-label="筛选前端模块" value={moduleQuery} onChange={event => setModuleQuery(event.target.value)} placeholder="模块名、ID、路径或业务域" className="h-9 w-full border border-slate-600 bg-slate-950 px-3 text-sm" />
                  <div className="mt-2 max-h-[520px] overflow-auto border border-slate-700"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-slate-400"><tr><th className="p-2">选</th><th>ID / 名称</th><th>路径</th></tr></thead><tbody>{modules.map((module: any) => <tr key={module.id} className="border-t border-slate-800"><td className="p-2"><input aria-label={`选择模块 ${module.name}`} type="checkbox" checked={selectedModules.includes(module.id)} onChange={() => setSelectedModules(current => current.includes(module.id) ? current.filter(id => id !== module.id) : [...current, module.id])} /></td><td><b className="text-slate-200">{module.id}</b><div className="text-slate-400">{module.name}</div></td><td className="max-w-64 break-all pr-2 text-slate-500">{module.path}</td></tr>)}</tbody></table></div>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <section className="border border-slate-700 bg-slate-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-4 py-2"><span className="text-sm font-semibold">投递控制台 · 内容、去向与接收者</span><div className="flex items-center gap-2 text-xs"><span>数据库</span><Status value={health?.databaseConfigured ? "ready" : "not_configured"} /><span>前端实例</span><b className="font-mono text-cyan-200">{deliveryAudience?.frontendId ?? "—"}</b></div></div>
                  {!selectedRun ? <div className="p-6 text-sm text-slate-400">请先从运行账簿选择一个已完成采集任务。</div> : <div className="divide-y divide-slate-700 text-xs">
                    <div className="grid gap-px bg-slate-700 sm:grid-cols-4"><div className="bg-slate-950 p-3">运行 ID<br /><b className="font-mono text-white">{selectedRun.runId}</b></div><div className="bg-slate-950 p-3">内容状态<br /><b>{selectedResultItems.length} 页 · {deliverableResultItems.length} 条可投递{blockedResultItemCount ? ` · ${blockedResultItemCount} 条拦截` : ""}</b></div><div className="bg-slate-950 p-3">模块目标<br /><b className="text-cyan-200">{selectedTargets.length} 个具体页面</b></div><div className="bg-slate-950 p-3">接收对象<br /><b className="text-emerald-300">已选 {selectedRecipients.length} / {deliveryAudience?.recipientCount ?? 0} 名用户</b></div></div>

                    <div className="grid min-h-0 lg:grid-cols-2">
                      <div className="border-b border-slate-700 lg:border-b-0 lg:border-r">
                        <div className="bg-slate-900 px-3 py-2 font-semibold text-slate-200">待推送内容（完整快照预览）</div>
                        <div className="max-h-72 overflow-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">标题 / 清洗后正文</th><th>来源与指纹</th><th>质量 / 去重</th></tr></thead><tbody>{selectedResultItems.map((item: any, index: number) => <tr key={`${item.contentHash}-${index}`} className="border-t border-slate-800 align-top"><td className="p-2"><b className="text-slate-100">{item.title || "无标题"}</b><p className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap leading-5 text-slate-400">{item.markdown || item.text || "正文为空"}</p></td><td className="max-w-56 break-all py-2 pr-2 text-slate-500"><div>{item.url}</div><div className="mt-1 font-mono">SHA-256 {item.contentHash}</div><div>{dateTime(selectedRun.completedAt)}</div></td><td className="py-2 pr-2"><Status value={item.duplicateOfContentHash ? "duplicate_blocked" : item.qualityRejectionReason ? "quality_blocked" : item.status >= 200 && item.status < 300 && (item.markdown || item.text || "").length >= 80 ? "L2" : "L4"} /><div className="mt-1 text-slate-500">HTTP {item.status}</div>{item.duplicateOfContentHash && <div className="mt-1 max-w-40 text-amber-300">相似正文已保留唯一版本<br /><span className="font-mono">{item.duplicateOfContentHash.slice(0, 16)}…</span></div>}{item.qualityRejectionReason && <div className="mt-1 max-w-44 text-rose-300">{item.qualityRejectionReason}</div>}</td></tr>)}</tbody></table></div>
                      </div>
                      <div>
                        <div className="bg-slate-900 px-3 py-2 font-semibold text-slate-200">精确投递链路</div>
                        <div className="max-h-36 overflow-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">模块 ID / 名称</th><th>前端页面</th></tr></thead><tbody>{selectedTargets.length ? selectedTargets.map((target: any) => <tr key={target.id} className="border-t border-slate-800"><td className="p-2"><b className="font-mono text-cyan-200">{target.id}</b><div>{target.name}</div></td><td className="break-all pr-2 text-slate-400">{target.path}</td></tr>) : <tr><td colSpan={2} className="p-4 text-center text-amber-300">尚未选择目标模块。</td></tr>}</tbody></table></div>
                        <div className="flex items-center justify-between border-t border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-slate-200"><span>前端推送给谁</span><div className="flex gap-1 font-normal"><button type="button" onClick={() => setSelectedRecipientIds((deliveryAudience?.recipients ?? []).map((recipient: any) => recipient.userId))} className="border border-slate-600 px-2 py-0.5 text-[11px] text-cyan-200">全选</button><button type="button" onClick={() => setSelectedRecipientIds(deliveryAudience?.currentUserId ? [deliveryAudience.currentUserId] : [])} className="border border-slate-600 px-2 py-0.5 text-[11px] text-cyan-200">仅当前用户</button></div></div>
                        <div className="border-b border-slate-800 px-3 py-2 text-slate-400">当前唯一前端实例 → 选中的具体模块与页面 → 下列指定用户 → 浏览器实际渲染后返回用户与终端 ACK</div>
                        <div className="max-h-40 overflow-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">选</th><th>用户</th><th>角色</th><th>最近登录</th></tr></thead><tbody>{deliveryAudience?.recipients?.length ? deliveryAudience.recipients.map((recipient: any) => <tr key={recipient.userId} className="border-t border-slate-800"><td className="p-2"><input aria-label={`选择接收用户 ${recipient.name}`} type="checkbox" checked={selectedRecipientIds.includes(recipient.userId)} onChange={() => setSelectedRecipientIds(current => current.includes(recipient.userId) ? current.filter(id => id !== recipient.userId) : [...current, recipient.userId])} /></td><td><b className="text-slate-200">{recipient.name}</b><div className="text-slate-500">ID {recipient.userId}{recipient.email ? ` · ${recipient.email}` : ""}</div></td><td>{recipient.role}</td><td className="pr-2 text-slate-500">{dateTime(recipient.lastSignedIn)}</td></tr>) : <tr><td colSpan={4} className="p-4 text-center text-amber-300">没有可投递的已登记用户。</td></tr>}</tbody></table></div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 p-3"><button type="button" onClick={() => push.mutate({ runId: selectedRun.runId, moduleIds: selectedModules as any, recipientUserIds: selectedRecipientIds })} disabled={selectedRun.status !== "completed" || !deliverableResultItems.length || !selectedModules.length || !health?.databaseConfigured || !selectedRecipientIds.length || push.isPending} className="inline-flex items-center gap-1 border border-cyan-500 bg-cyan-950 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40"><Send className="h-4 w-4" />{push.isPending ? "幂等写入并等待终端回执…" : "向上述模块与用户推送"}</button><span className="text-slate-400">预计投递槽：<b className="text-white">{deliverableResultItems.length * selectedTargets.length * selectedRecipients.length}</b>（合格唯一内容 × 页面 × 用户）；{blockedResultItemCount ? `${blockedResultItemCount} 条在发送前拦截；` : ""}同内容同模块再次发送将被指纹拦截。</span></div>
                    {!health?.databaseConfigured && <p className="m-3 border border-amber-700 bg-amber-950/30 p-3 text-amber-200">数据库连接未配置。推送被明确禁用，不会显示假成功；连接恢复后才允许进入幂等写入、实时投递与 ACK 链路。</p>}
                  </div>}
                </section>
                <section className="border border-slate-700 bg-slate-900/50"><div className="border-b border-slate-700 px-4 py-2 text-sm font-semibold">推送任务、实际应用与终端 ACK 账簿</div><PushLedger rows={selectedRun?.pushRecords ?? []} busy={push.isPending} onRetry={(row: any) => push.mutate({ runId: row.runId, moduleIds: row.moduleIds as any, recipientUserIds: row.audience?.recipients?.map((recipient: any) => recipient.userId) ?? selectedRecipientIds })} /></section>
              </div>
            </section>}

            {panel === "audit" && <section className="border border-slate-700 bg-slate-900/50">
              <div className="border-b border-slate-700 px-4 py-2 text-sm font-semibold">运行日志、许可证与边界证据</div>
              <div className="grid gap-3 p-4 lg:grid-cols-2">
                <div className="border border-slate-700 p-3 text-xs leading-6 text-slate-300"><b className="text-white">BSD 3-Clause 源码保留</b><br />版本：{health?.version ?? "未读取"}<br />许可证文件：{health?.vendorLicenseExists ? "已验证" : "缺失"}<br />Python：{health?.python ?? "未读取"}<br />动态运行时：{health?.dynamicRuntime ?? "未读取"}<br />代理池：{health?.proxyConfigured ? "由服务器环境配置" : "未配置"}<br />Stealth 绕过能力暴露：{health?.stealthBypassExposed ? "是" : "否"}</div>
                <div className="border border-slate-700 p-3 text-xs leading-6 text-slate-300"><b className="text-white">强制控制</b><br />公共 http/https 与标准端口<br />DNS 解析后阻断私有/回环/保留地址<br />robots.txt 检查与 Spider 二次校验<br />内容 SHA-256、运行集指纹与重复运行标记<br />前端写入沿用唯一模块 ID、内容哈希与 ACK<br />不执行任意 JavaScript、验证码或权限绕过</div>
                <pre className="lg:col-span-2 max-h-[460px] overflow-auto border border-slate-700 bg-slate-950 p-3 text-[11px] text-slate-300">{selectedRun?.stderr || "请选择运行；没有日志时保持空状态，不填充示例日志。"}</pre>
              </div>
            </section>}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}

function RunLedger({ rows, selectedRunId, onSelect, busy, onPause, onResume, onCancel }: { rows: any[]; selectedRunId: string; onSelect: (id: string) => void; busy: boolean; onPause: (id: string) => void; onResume: (id: string) => void; onCancel: (id: string) => void }) {
  return <section className="min-w-0 border border-slate-700 bg-slate-900/50"><div className="border-b border-slate-700 px-4 py-2 text-sm font-semibold">运行账簿</div><div className="overflow-auto"><table className="min-w-[880px] w-full text-left text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-2">运行 ID</th><th>状态</th><th>引擎</th><th>来源/页面</th><th>时间</th><th>去重</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.map(run => <tr key={run.runId} onClick={() => onSelect(run.runId)} className={`cursor-pointer border-t border-slate-800 ${run.runId === selectedRunId ? "bg-cyan-950/40" : "hover:bg-slate-800/60"}`}><td className="p-2 font-mono text-cyan-200">{run.runId}</td><td><Status value={run.status} /></td><td>{run.input.taskKind} / {run.input.mode}</td><td className="max-w-72"><div className="truncate">{run.input.urls[0]}</div><span className="text-slate-500">{run.result?.items?.length ?? 0} 页</span></td><td>{dateTime(run.startedAt || run.createdAt)}</td><td>{run.duplicateOf ? <span className="text-amber-300">{run.duplicateOf}</span> : "—"}</td><td><div className="flex gap-1">{run.status === "running" && <><button aria-label={`暂停 ${run.runId}`} type="button" onClick={event => { event.stopPropagation(); onPause(run.runId); }} disabled={busy} className="border border-amber-600 p-1 text-amber-200 disabled:opacity-40"><CirclePause className="h-3.5 w-3.5" /></button><button aria-label={`取消 ${run.runId}`} type="button" onClick={event => { event.stopPropagation(); onCancel(run.runId); }} disabled={busy} className="border border-rose-600 p-1 text-rose-200 disabled:opacity-40"><Square className="h-3.5 w-3.5" /></button></>}{(run.status === "paused" || run.status === "failed") && <button aria-label={`恢复 ${run.runId}`} type="button" onClick={event => { event.stopPropagation(); onResume(run.runId); }} disabled={busy} className="border border-cyan-600 p-1 text-cyan-200 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /></button>}</div></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">尚无运行记录。启动后这里显示真实状态，不预置演示任务。</td></tr>}</tbody></table></div></section>;
}

function ResultPanel({ run, itemIndex, onItemIndex, onOpenParser, onExport }: { run: any; itemIndex: number; onItemIndex: (index: number) => void; onOpenParser: () => void; onExport: (format: "json" | "jsonl" | "csv" | "xml") => void }) {
  const items = run?.result?.items ?? [];
  const item = items[itemIndex];
  return <section className="border border-slate-700 bg-slate-900/50"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-4 py-2"><span className="text-sm font-semibold">结果与原始快照</span><div className="flex gap-1">{(["json", "jsonl", "csv", "xml"] as const).map(format => <button key={format} type="button" disabled={!items.length} onClick={() => onExport(format)} className="inline-flex items-center gap-1 border border-slate-600 px-2 py-1 text-xs uppercase disabled:opacity-40"><Download className="h-3 w-3" />{format}</button>)}</div></div>{!run ? <div className="p-8 text-center text-slate-500">请从运行账簿选择任务。</div> : run.status === "running" || run.status === "queued" ? <div className="p-8 text-center text-cyan-300"><Activity className="mx-auto mb-2 h-5 w-5 animate-pulse" />真实采集正在执行，页面会自动刷新。</div> : run.status === "failed" ? <div className="border-l-4 border-rose-500 bg-rose-950/20 p-5 text-sm text-rose-200">{run.error}<pre className="mt-3 max-h-80 overflow-auto text-[11px] text-slate-400">{run.stderr}</pre></div> : !items.length ? <div className="p-8 text-center text-slate-500">运行完成但没有可读取内容；系统未生成替代数据。</div> : <div className="grid min-h-[620px] lg:grid-cols-[260px_minmax(0,1fr)]"><div className="border-r border-slate-700">{items.map((row: any, index: number) => <button key={`${row.contentHash}-${index}`} type="button" onClick={() => onItemIndex(index)} className={`block w-full border-b border-slate-800 p-3 text-left text-xs ${index === itemIndex ? "bg-cyan-950/40" : "hover:bg-slate-800"}`}><div className="truncate font-semibold text-white">{row.title || "无标题"}</div><div className="mt-1 truncate text-slate-500">HTTP {row.status} · {row.bytes?.toLocaleString?.()} bytes</div></button>)}</div>{item && <div className="min-w-0"><div className="grid gap-px border-b border-slate-700 bg-slate-700 text-xs sm:grid-cols-4"><div className="bg-slate-900 p-3">HTTP<br /><b>{item.status} {item.reason}</b></div><div className="bg-slate-900 p-3">体积<br /><b>{item.bytes?.toLocaleString?.()} bytes</b></div><div className="bg-slate-900 p-3">链接<br /><b>{item.linkCount}</b></div><div className="bg-slate-900 p-3">内容指纹<br /><b className="font-mono">{item.contentHash?.slice(0, 16)}…</b></div></div><div className="flex border-b border-slate-700"><button type="button" onClick={onOpenParser} className="inline-flex items-center gap-1 border-r border-slate-700 px-3 py-2 text-xs text-cyan-200"><TerminalSquare className="h-3.5 w-3.5" />打开解析台</button><span className="min-w-0 truncate px-3 py-2 text-xs text-slate-500">{item.url}</span></div><div className="grid gap-3 p-3 xl:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold text-slate-300">选择器结果（{item.selected?.length ?? 0}）</h3><pre className="h-52 overflow-auto border border-slate-700 bg-slate-950 p-2 text-[11px] text-emerald-200">{JSON.stringify(item.selected, null, 2)}</pre></div><div><h3 className="mb-2 text-xs font-semibold text-slate-300">链接样本</h3><pre className="h-52 overflow-auto border border-slate-700 bg-slate-950 p-2 text-[11px] text-cyan-200">{JSON.stringify(item.links, null, 2)}</pre></div><div className="xl:col-span-2"><h3 className="mb-2 text-xs font-semibold text-slate-300">LLM-ready Markdown / 正文</h3><pre className="h-80 whitespace-pre-wrap overflow-auto border border-slate-700 bg-slate-950 p-3 text-xs leading-5 text-slate-300">{item.markdown || item.text || "内容为空"}</pre></div></div></div>}</div>}</section>;
}

function CapabilityTable({ health }: { health: any }) {
  const rows = health?.capabilities ?? [];
  return <section className="border border-slate-700 bg-slate-900/50"><div className="border-b border-slate-700 px-4 py-2 text-sm font-semibold">压缩包能力逐项登记</div><div className="overflow-auto"><table className="min-w-[860px] w-full text-left text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-2">唯一 ID</th><th>分类</th><th>原能力名称</th><th>运行状态</th><th>后台实现与边界</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.id} className="border-t border-slate-800"><td className="p-2 font-mono text-cyan-200">{row.id}</td><td>{row.group}</td><td className="font-semibold text-white">{row.name}</td><td><Status value={row.state} /></td><td className="max-w-xl py-2 pr-3 text-slate-400">{row.detail}</td></tr>)}</tbody></table></div><div className="border-t border-slate-700 p-3 text-xs text-slate-400">能力名称和源码来自 vendored Scrapling 0.4.15；`policy_limited` 不是死按钮，而是明确禁止规避网站安全控制。运行入口只开放可审计、只读、合规的子集。</div></section>;
}

function PushLedger({ rows, busy, onRetry }: { rows: any[]; busy: boolean; onRetry: (row: any) => void }) {
  return <div className="overflow-auto"><table className="min-w-[1280px] w-full text-left text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-2">pushId / 时间</th><th>实际推送内容</th><th>目标模块与页面</th><th>接收用户</th><th>发送 / ACK / 重复拦截 / 待确认 / 失败</th><th>状态与失败原因</th><th>终端实例回执</th></tr></thead><tbody>{rows.length ? rows.map(row => {
    const receipts = Array.isArray(row.receipts) ? row.receipts : [];
    const sent = receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.sentCount ?? 0), 0);
    const success = receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.successCount ?? 0), 0);
    const pending = receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.pendingCount ?? Math.max(0, Number(receipt.sentCount ?? 0) - Number(receipt.successCount ?? 0))), 0);
    const failed = receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.failureCount ?? 0), 0);
    const blocked = receipts.filter((receipt: any) => receipt.currentStatus === "duplicate_blocked" || receipt.duplicateBlocked).length;
    const terminals = [...new Map(receipts.flatMap((receipt: any) => Array.isArray(receipt.acknowledgedTerminals) ? receipt.acknowledgedTerminals : []).map((terminal: any) => [`${terminal.terminalId}:${terminal.userId}`, terminal])).values()] as any[];
    const failureReasons = [...new Set(receipts.map((receipt: any) => receipt.currentStatus !== "duplicate_blocked" ? receipt.failureReason : null).filter(Boolean))] as string[];
    const blockedReasons = [...new Set(receipts.map((receipt: any) => receipt.currentStatus === "duplicate_blocked" ? receipt.failureReason : null).filter(Boolean))] as string[];
    const { deliveredItems, blockedItems, attemptedItems } = partitionScraplingPushContent(row);
    return <tr key={`${row.pushId}:${row.createdAt}`} className="border-t border-slate-800 align-top"><td className="p-2"><b className="font-mono text-cyan-200">{row.pushId}</b>{row.idempotencyKey && <div className="mt-1 break-all font-mono text-[10px] text-amber-200">幂等键 {row.idempotencyKey}</div>}<div className="mt-1 text-slate-500">创建 {dateTime(row.createdAt)}</div><div className="text-slate-500">发送 {dateTime(row.sentAt)}</div></td><td className="max-w-80 py-2 pr-3"><b className="text-slate-200">实际投递 {deliveredItems.length} 条</b>{blockedItems.length > 0 && <div className="mt-1 text-amber-300">发送前拦截 {blockedItems.length} 条</div>}{attemptedItems.length > 0 && <div className="mt-1 text-rose-300">尝试写入但未投递 {attemptedItems.length} 条</div>}{deliveredItems.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-cyan-300">查看 {deliveredItems.length} 条实际投递标题与正文</summary><div className="mt-1 max-h-48 overflow-auto border border-slate-700 bg-slate-950 p-2">{deliveredItems.map((item: any) => <div key={item.contentId} className="border-b border-slate-800 py-2 last:border-0"><b className="text-white">{item.title}</b><p className="mt-1 whitespace-pre-wrap leading-5 text-slate-400">{item.body}</p><div className="mt-1 break-all font-mono text-slate-600">{item.sourceName} · {item.contentHash}</div></div>)}</div></details>}{blockedItems.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-amber-300">查看 {blockedItems.length} 条发送前拦截项</summary><div className="mt-1 max-h-40 overflow-auto border border-amber-900 bg-slate-950 p-2">{blockedItems.map((item: any) => <div key={item.contentId} className="border-b border-slate-800 py-2 last:border-0"><b className="text-white">{item.title}</b><p className="mt-1 text-amber-200">{blockedReasonForContent(receipts, item.contentId)}</p></div>)}</div></details>}{attemptedItems.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-rose-300">查看 {attemptedItems.length} 条失败尝试快照</summary><div className="mt-1 max-h-40 overflow-auto border border-rose-900 bg-slate-950 p-2">{attemptedItems.map((item: any) => <div key={item.contentId} className="border-b border-slate-800 py-2 last:border-0"><b className="text-white">{item.title}</b><p className="mt-1 whitespace-pre-wrap leading-5 text-slate-400">{item.body}</p></div>)}</div></details>}{!row.contentItems?.length && <span className="mt-1 block text-slate-500">旧推送记录没有内容快照；回执仍保留。</span>}</td><td className="max-w-72 py-2 pr-3">{row.moduleTargets?.length ? row.moduleTargets.map((target: any) => <div key={target.moduleId} className="mb-1 border-b border-slate-800 pb-1 last:border-0"><b className="font-mono text-cyan-200">{target.moduleId}</b> · {target.name}<div className="break-all text-slate-500">{target.path}</div></div>) : <span>{row.moduleIds?.length ?? 0} 个模块</span>}</td><td className="max-w-64 py-2 pr-3"><b className="text-emerald-300">{row.audience?.label ?? "旧记录未保存接收者快照"}</b><div className="mt-1 text-slate-400">计划用户 {row.expectedRecipientCount ?? row.audience?.recipientCount ?? 0} 名</div>{row.audience?.recipients?.map((recipient: any) => <div key={recipient.userId} className="text-slate-500">{recipient.name} · {recipient.role} · ID {recipient.userId}</div>)}</td><td className="py-2 pr-3 font-mono"><span className="text-white">{sent}</span> / <span className="text-emerald-300">{success}</span> / <span className="text-amber-200">{blocked}</span> / <span className="text-amber-300">{pending}</span> / <span className="text-rose-300">{failed}</span><div className="mt-1 font-sans text-slate-500">有效计划投递槽 {row.expectedDeliveryCount ?? "—"}</div></td><td className="py-2 pr-3"><Status value={row.status} />{row.error && <div className="mt-2 max-w-72 whitespace-pre-wrap text-rose-300">{row.error}</div>}{failureReasons.length > 0 && <div className="mt-1 text-rose-300">{failureReasons.join("；")}</div>}{blockedReasons.length > 0 && <div className="mt-1 max-w-72 text-amber-300">{blockedReasons.join("；")}</div>}{row.status === "failed" && <button type="button" disabled={busy} onClick={() => onRetry(row)} className="mt-2 border border-amber-600 px-2 py-1 text-amber-200 disabled:opacity-40">按原目标重试</button>}</td><td className="py-2 pr-3">{terminals.length ? terminals.map((terminal: any) => <div key={`${terminal.terminalId}:${terminal.userId}`} className="mb-1 font-mono text-emerald-300"><div>{terminal.terminalId}</div><div className="font-sans text-slate-500">用户 {terminal.userId} · {dateTime(terminal.acknowledgedAt)}</div></div>) : blocked === receipts.length && receipts.length ? <span className="text-amber-300">全部内容在发送前去重，无需前端 ACK</span> : <span className="text-amber-300">等待前端实际渲染 ACK</span>}</td></tr>;
  }) : <tr><td colSpan={7} className="p-6 text-center text-slate-500">尚无推送。数据库插入不算成功；只有指定页面完成渲染并由接收用户返回 ACK，状态才会变为 front_acknowledged。</td></tr>}</tbody></table></div>;
}
