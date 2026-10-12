import { useMemo, useState } from "react";
import { Brain, CheckCircle2, Database, ExternalLink, FileInput, Globe2, KeyRound, Loader2, Play, RefreshCw, Search, Send, ShieldCheck, Terminal, XCircle } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import AgentReachWorkbench from "./AgentReachWorkbench";

const statusLabel: Record<string, string> = {
  available: "可用",
  needs_configuration: "需配置",
  unavailable: "不可用",
  error: "异常",
  not_checked: "未检查",
};

const statusClass: Record<string, string> = {
  available: "text-emerald-300",
  needs_configuration: "text-amber-300",
  unavailable: "text-rose-300",
  error: "text-rose-300",
  not_checked: "text-slate-400",
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value;
}

export default function AdminAgentReach() {
  const utils = trpc.useUtils();
  const dashboard = trpc.agentReachAdmin.dashboard.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const [filter, setFilter] = useState("");
  const [readMode, setReadMode] = useState<"web" | "rss">("web");
  const [readUrl, setReadUrl] = useState("");
  const [readResult, setReadResult] = useState<any>(null);
  const [cliResult, setCliResult] = useState<any>(null);
  const [companyTitle, setCompanyTitle] = useState("");
  const [companyContent, setCompanyContent] = useState("");
  const [companySource, setCompanySource] = useState("");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [adminPrompt, setAdminPrompt] = useState("");
  const [adminReply, setAdminReply] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const refresh = trpc.agentReachAdmin.refresh.useMutation({
    onSuccess: () => {
      toast.success("Agent Reach 渠道诊断完成");
      void utils.agentReachAdmin.dashboard.invalidate();
    },
    onError: (error) => toast.error(`诊断失败：${error.message}`),
  });
  const probe = trpc.agentReachAdmin.refresh.useMutation({
    onSuccess: () => {
      toast.success("该渠道已重新检查");
      void utils.agentReachAdmin.dashboard.invalidate();
    },
    onError: (error) => toast.error(`检查失败：${error.message}`),
  });
  const runOperation = trpc.agentReachAdmin.runOperation.useMutation({
    onSuccess: (result) => {
      setCliResult(result);
      toast.success(result.ok ? "ZIP CLI 执行完成" : "ZIP CLI 已执行，但返回了真实异常");
      void utils.agentReachAdmin.dashboard.invalidate();
    },
    onError: (error) => toast.error(`ZIP CLI 执行失败：${error.message}`),
  });
  const readPublic = trpc.agentReachAdmin.readPublic.useMutation({
    onSuccess: (result) => {
      setReadResult(result);
      toast.success("已取得真实公开数据");
      void utils.agentReachAdmin.dashboard.invalidate();
    },
    onError: (error) => toast.error(`读取失败：${error.message}`),
  });
  const ingestCompanyInput = trpc.agentReachAdmin.ingestCompanyInput.useMutation({
    onSuccess: (result) => {
      toast.success(`已写入公司库：新增 ${result.stored} 条，去重 ${result.deduplicated} 条`);
      setCompanyTitle("");
      setCompanyContent("");
      void utils.agentReachAdmin.dashboard.invalidate();
    },
    onError: (error) => toast.error(`公司资料写入失败：${error.message}`),
  });
  const knowledgeSearch = trpc.agentReachAdmin.searchKnowledge.useQuery(
    { query: knowledgeQuery.trim() || "—", limit: 8 },
    { enabled: false, retry: false },
  );
  const adminChat = trpc.ucheerAi.chat.useMutation({
    onSuccess: (result) => setAdminReply(result),
    onError: (error) => toast.error(`Ucheer AI 调用失败：${error.message}`),
  });

  const channels = useMemo(
    () => (dashboard.data?.channels ?? []).filter((channel) => {
      const haystack = `${channel.name} ${channel.id} ${channel.description} ${channel.backends.join(" ")}`.toLowerCase();
      return !filter.trim() || haystack.includes(filter.trim().toLowerCase());
    }),
    [dashboard.data?.channels, filter],
  );

  return (
    <AdminLayout>
      <div className="space-y-5 text-slate-100" data-testid="admin-agent-reach">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Globe2 className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.2em]">Agent Reach capability layer</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold">研究与知识工作台</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
              在后台运行已接通的技能、查看真实结果、管理公司资料，并验证 Ucheer AI 输出。ZIP 中尚未接通的渠道提供配置和诊断入口，不伪造执行结果。
            </p>
          </div>
          <button type="button" aria-expanded={showDiagnostics} onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/60 px-3 py-2 text-sm text-cyan-100">
            <Terminal className="h-4 w-4" />{showDiagnostics ? "返回工作台" : "诊断与高级配置"}
          </button>
        </header>

        {dashboard.isError && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200">后台能力加载失败：{dashboard.error.message}</div>}
        {!showDiagnostics && (
          dashboard.isPending ? <div className="flex min-h-72 items-center justify-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />正在加载技能和数据库状态…</div> :
          <AgentReachWorkbench channels={dashboard.data?.channels ?? []} databaseConfigured={dashboard.data?.knowledge.databaseConfigured ?? false} opencliInstalled={dashboard.data?.runtime.opencli.available ?? false} opencliBridgeConnected={dashboard.data?.runtime.opencliBridge.available ?? false} xhsMcpAvailable={dashboard.data?.runtime.xhsMcp.available ?? false} />
        )}
        {showDiagnostics && <>
        <button
          type="button"
          className="inline-flex items-center gap-2 border border-cyan-700/60 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
          disabled={refresh.isPending || dashboard.isPending}
          onClick={() => refresh.mutate({})}
        >
          {refresh.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {refresh.isPending ? "逐渠道检查中…" : "检查全部渠道"}
        </button>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["渠道总数", dashboard.data?.summary.totalChannels ?? "—", "text-cyan-200"],
            ["真实可用", dashboard.data?.summary.availableCount ?? "—", "text-emerald-300"],
            ["需配置", dashboard.data?.summary.needsConfigurationCount ?? "—", "text-amber-300"],
            ["不可用", dashboard.data?.summary.unavailableCount ?? "—", "text-rose-300"],
            ["最近诊断", formatDate(dashboard.data?.summary.lastRefreshAt), "text-slate-200"],
          ].map(([label, value, tone]) => (
            <div key={label} className="border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs text-slate-500">{label}</div>
              <div className={`mt-2 text-xl font-semibold ${tone}`}>{value}</div>
            </div>
          ))}
        </section>

        <section className="border border-cyan-900/60 bg-cyan-950/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-cyan-100"><ShieldCheck className="h-4 w-4" />原始压缩包与安全边界</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">源码与 ZIP 已保存在项目 `vendor/Agent-Reach`，以下信息由真实文件读取，不是静态占位。</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              {dashboard.data?.archive.present ? "ZIP 已归档" : "ZIP 缺失"} · {formatBytes(dashboard.data?.archive.sizeBytes ?? 0)} · 源码文件 {dashboard.data?.archive.sourceFileCount ?? "—"}
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-4 text-xs">
            <div className="border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500">SHA-256</div><div className="mt-1 break-all font-mono text-cyan-200">{dashboard.data?.archive.sha256 ?? "—"}</div></div>
            <div className="border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500">归档路径</div><div className="mt-1 break-all font-mono text-slate-300">{dashboard.data?.archive.path ?? "—"}</div></div>
            <div className="border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500">凭据返回前端</div><div className="mt-1 text-emerald-300">禁止</div></div>
            <div className="border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500">任意命令执行</div><div className="mt-1 text-emerald-300">禁止（仅固定探测命令）</div></div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <div className="border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="flex items-center gap-2 font-semibold"><Terminal className="h-4 w-4 text-cyan-300" />运行时与 MCP 实际状态</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(dashboard.data?.runtime ?? {}).map(([name, item]) => {
                const value = item as { available: boolean; version: string | null };
                return <div key={name} className="border border-slate-800 bg-slate-950/50 p-3 text-xs"><div className="text-slate-500">{name}</div><div className={value.available ? "mt-1 text-emerald-300" : "mt-1 text-slate-600"}>{value.available ? "可执行" : "未检测到"}</div>{value.version && <div className="mt-1 truncate font-mono text-[10px] text-slate-500">{value.version}</div>}</div>;
              })}
            </div>
            <div className="mt-3 border border-slate-800 bg-slate-950/50 p-3 text-xs"><div className="text-slate-500">MCP 配置文件</div><div className={dashboard.data?.mcp.present ? "mt-1 text-emerald-300" : "mt-1 text-amber-300"}>{dashboard.data?.mcp.present ? `已读取 · ${dashboard.data.mcp.servers.length} 个服务` : "未找到或无法解析"}</div><div className="mt-1 break-all font-mono text-[10px] text-slate-600">{dashboard.data?.mcp.path}</div>{dashboard.data?.mcp.servers.length ? <div className="mt-2 text-slate-400">{dashboard.data.mcp.servers.join(" · ")}</div> : dashboard.data?.mcp.error && <div className="mt-1 text-rose-300">{dashboard.data.mcp.error}</div>}</div>
          </div>
          <div className="border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="flex items-center gap-2 font-semibold"><ExternalLink className="h-4 w-4 text-cyan-300" />原始文档摘录</h2>
            <details className="mt-3 border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm text-cyan-200">README.md（原文前 5,000 字符）</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-400">{dashboard.data?.docs.readmeExcerpt || "—"}</pre></details>
            <details className="mt-2 border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm text-cyan-200">SKILL.md（原文前 5,000 字符）</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-400">{dashboard.data?.docs.skillExcerpt || "—"}</pre></details>
          </div>
        </section>

        <section className="border border-cyan-900/60 bg-cyan-950/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-cyan-100"><Terminal className="h-4 w-4" />ZIP 原生 CLI 实际执行</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                下列操作调用归档 ZIP 自带的 Agent-Reach CLI，不是前端模拟。doctor 会写入每个渠道的原始 JSON；install-check 仅做安全检查，永远不会执行系统安装。
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              {dashboard.data?.cli?.installed ? "项目私有 CLI 已安装" : "项目私有 CLI 未安装"}
              {dashboard.data?.cli?.version && <div className="mt-1 font-mono text-[10px] text-cyan-300">{dashboard.data.cli.version}</div>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["doctor", "运行 doctor（JSON）"],
              ["watch", "运行 watch"],
              ["version", "读取版本"],
              ["check-update", "检查更新"],
              ["install-check", "安全安装检查"],
            ] as const).map(([operation, label]) => (
              <button
                key={operation}
                type="button"
                disabled={runOperation.isPending}
                onClick={() => runOperation.mutate({ operation })}
                className="inline-flex items-center gap-2 border border-slate-700 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-50"
              >
                {runOperation.isPending && runOperation.variables?.operation === operation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border border-slate-800 bg-slate-950/60 p-3 text-xs">
              <div className="text-slate-500">最近执行</div>
              <div className="mt-1 text-slate-200">{dashboard.data?.cli?.lastOperation ?? "尚未执行"}</div>
              <div className="mt-1 text-slate-500">{formatDate(dashboard.data?.cli?.lastRunAt)} · {dashboard.data?.cli?.lastDurationMs ?? "—"} ms · exit {dashboard.data?.cli?.lastExitCode ?? "—"}</div>
              {dashboard.data?.cli?.executable && <div className="mt-2 break-all font-mono text-[10px] text-slate-600">{dashboard.data.cli.executable}</div>}
            </div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-5 text-slate-300">
              {(cliResult?.stdout ?? dashboard.data?.cli?.lastStdout ?? "") || dashboard.data?.cli?.lastStderr || "运行后显示原始 CLI 输出；没有生成替代数据。"}
              {(cliResult?.stderr ?? dashboard.data?.cli?.lastStderr) ? `\n\n[stderr]\n${cliResult?.stderr ?? dashboard.data?.cli?.lastStderr}` : ""}
            </pre>
          </div>
        </section>

        <section className="border border-slate-800 bg-slate-950/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="font-semibold">全部渠道与后端路由</h2>
              <p className="mt-1 text-xs text-slate-500">“可用”只来自成功探测；“需配置”不会被当成可用。</p>
            </div>
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索渠道、后端或能力" className="h-9 w-full max-w-xs border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-600" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-500">
                <tr><th className="px-4 py-2">渠道</th><th>层级 / 状态</th><th>当前后端</th><th>支持能力</th><th>凭据</th><th>最近检查</th><th>操作</th></tr>
              </thead>
              <tbody>
                {channels.map((channel) => {
                  const state = channel.state;
                  const status = state.status;
                  return (
                    <tr key={channel.id} className="border-b border-slate-900/80 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">{channel.name}</div>
                        <div className="mt-1 font-mono text-[10px] text-cyan-300">{channel.id}</div>
                        <div className="mt-1 max-w-[280px] leading-5 text-slate-500">{channel.description}</div>
                        <div className="mt-1 font-mono text-[10px] text-slate-600">{channel.sourceFile}</div>
                      </td>
                      <td>
                        <div className={statusClass[status] ?? "text-slate-300"}>{statusLabel[status] ?? status}</div>
                        <div className="mt-1 text-[10px] text-slate-500">Tier {channel.tier}</div>
                        <div className="mt-1 max-w-[190px] text-[10px] leading-4 text-slate-500">{state.message}</div>
                      </td>
                      <td>
                        <div className="text-cyan-200">{state.activeBackend ?? "未激活"}</div>
                        <div className="mt-1 max-w-[170px] text-[10px] leading-4 text-slate-500">候选：{channel.backends.join(" · ")}</div>
                      </td>
                      <td><div className="max-w-[220px] leading-5 text-slate-400">{channel.capabilities.join(" · ")}</div></td>
                      <td>
                        {channel.credentials.length ? channel.credentials.map((credential) => (
                          <div key={credential.key} className={credential.configured ? "text-emerald-300" : "text-amber-300"}><KeyRound className="mr-1 inline h-3 w-3" />{credential.key}：{credential.configured ? "已配置" : "未配置"}</div>
                        )) : <span className="text-slate-600">无需 Key</span>}
                      </td>
                      <td className="text-slate-500">{formatDate(state.checkedAt)}{state.latencyMs !== null && <div>{state.latencyMs} ms</div>}</td>
                      <td>
                        <button type="button" className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1.5 text-[11px] text-cyan-200 disabled:opacity-50" disabled={probe.isPending} onClick={() => probe.mutate({ channelId: channel.id })}><Play className="h-3 w-3" />检查</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="flex items-center gap-2 font-semibold"><Terminal className="h-4 w-4 text-cyan-300" />公开内容读取测试</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">只允许公开 HTTP/HTTPS 地址；禁止 localhost、内网地址、账号密码和私人 Cookie。结果来自真实读取，失败会明确显示。</p>
            <div className="mt-3 flex gap-2">
              {(["web", "rss"] as const).map((mode) => <button key={mode} type="button" onClick={() => { setReadMode(mode); setReadResult(null); }} className={`border px-3 py-1.5 text-xs ${readMode === mode ? "border-cyan-500 bg-cyan-500/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>{mode === "web" ? "网页（Jina Reader）" : "RSS / Atom"}</button>)}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={readUrl} onChange={(event) => setReadUrl(event.target.value)} placeholder={readMode === "web" ? "https://example.com/article" : "https://example.com/feed.xml"} className="h-10 min-w-0 flex-1 border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-600" />
              <button type="button" disabled={!readUrl.trim() || readPublic.isPending} onClick={() => readPublic.mutate({ mode: readMode, url: readUrl.trim() })} className="inline-flex items-center gap-2 bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{readPublic.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}读取</button>
            </div>
            {readResult && <div className="mt-3 border border-slate-800 bg-slate-950 p-3 text-xs"><div className="flex flex-wrap gap-3 text-slate-400"><span>来源：{readResult.source}</span><span>耗时：{readResult.latencyMs} ms</span><span>时间：{formatDate(readResult.observedAt)}</span></div>{readResult.storage && <div className={`mt-2 border px-2 py-1 ${readResult.storage.status === "stored" || readResult.storage.status === "partial" ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300"}`}>公司库：{readResult.storage.status} · 新增 {readResult.storage.stored} · 去重 {readResult.storage.deduplicated} · 拒收 {readResult.storage.rejected}</div>}{readResult.title && <div className="mt-2 font-semibold text-cyan-200">{readResult.title}</div>}{readResult.items ? <div className="mt-2 max-h-64 space-y-2 overflow-auto">{readResult.items.map((item: any, index: number) => <div key={`${item.link}-${index}`} className="border-b border-slate-800 pb-2"><div className="text-slate-200">{item.title || "无标题"}</div><div className="mt-1 text-slate-500">{item.published || "—"} · {item.link || "无链接"}</div><div className="mt-1 text-slate-400">{item.summary || "无摘要"}</div></div>)}</div> : <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap leading-5 text-slate-300">{readResult.content}</pre>}</div>}
          </div>
          <div className="border border-slate-800 bg-slate-950/70 p-4">
            <h2 className="font-semibold">ZIP 中登记的全部运维能力</h2>
            <p className="mt-1 text-xs text-slate-500">这里复刻能力清单与安全边界；安装/卸载不会在后台静默执行。</p>
            <div className="mt-3 space-y-2">{(dashboard.data?.operations ?? []).map((operation) => <div key={operation.id} className="border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center gap-2 text-sm text-slate-200"><CheckCircle2 className="h-4 w-4 text-cyan-300" />{operation.name}</div><div className="mt-1 text-xs leading-5 text-slate-500">{operation.detail}</div></div>)}</div>
          </div>
        </section>

        <section className="border border-cyan-800/70 bg-cyan-950/10 p-4" data-testid="agent-reach-company-knowledge">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-cyan-100"><Database className="h-4 w-4" />公司知识库工作台（仅管理后台）</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">这里是 Agent Reach 与 Ucheer AI 的受控输入/输出层。原始资料、清洗结果、质量校验、去重指纹和数据血缘只留在服务端数据库；普通前端不读取这些表。</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
              {[
                ["原始", dashboard.data?.knowledge?.rawCount ?? "—"],
                ["清洗", dashboard.data?.knowledge?.cleanCount ?? "—"],
                ["结构化", dashboard.data?.knowledge?.structuredCount ?? "—"],
                ["血缘", dashboard.data?.knowledge?.lineageCount ?? "—"],
              ].map(([label, value]) => <div key={label} className="border border-slate-800 bg-slate-950/70 px-3 py-2"><div className="text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-cyan-200">{value}</div></div>)}
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="border border-slate-800 bg-slate-950/70 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><FileInput className="h-4 w-4 text-cyan-300" />输入公司资料</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">写入后自动执行去 HTML、空白规范化、内容哈希去重、质量分级和血缘登记。空内容、短内容不会伪装成成功。</p>
              <input value={companyTitle} onChange={(event) => setCompanyTitle(event.target.value)} placeholder="资料标题" className="mt-3 h-9 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-600" />
              <input value={companySource} onChange={(event) => setCompanySource(event.target.value)} placeholder="来源名称（可选，例如研究部、内部知识库）" className="mt-2 h-9 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-600" />
              <textarea value={companyContent} onChange={(event) => setCompanyContent(event.target.value)} placeholder="粘贴公司允许 Ucheer 使用的资料内容（至少 20 字）" className="mt-2 min-h-36 w-full resize-y border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-white outline-none focus:border-cyan-600" />
              <button type="button" disabled={ingestCompanyInput.isPending || companyContent.trim().length < 20 || !companyTitle.trim()} onClick={() => ingestCompanyInput.mutate({ title: companyTitle.trim(), content: companyContent.trim(), sourceName: companySource.trim() || undefined })} className="mt-3 inline-flex items-center gap-2 bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"><Send className="h-4 w-4" />{ingestCompanyInput.isPending ? "清洗并入库中…" : "清洗后写入公司库"}</button>
            </div>
            <div className="border border-slate-800 bg-slate-950/70 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Search className="h-4 w-4 text-cyan-300" />检索已清洗资料</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">管理员可验证 Ucheer 将使用的资料命中；返回的是清洗文本片段，不显示数据库主键、原始请求或凭据。</p>
              <div className="mt-3 flex gap-2"><input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} placeholder="输入关键词检索公司库" className="h-9 min-w-0 flex-1 border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-600" /><button type="button" disabled={!knowledgeQuery.trim() || knowledgeSearch.isFetching} onClick={() => void knowledgeSearch.refetch()} className="inline-flex items-center gap-2 border border-cyan-700 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40">{knowledgeSearch.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}查询</button></div>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">{knowledgeSearch.data?.length ? knowledgeSearch.data.map((hit) => <article key={`${hit.sourceUrl}-${hit.capturedAt}`} className="border border-slate-800 bg-slate-950/60 p-3 text-xs"><div className="font-semibold text-cyan-100">{hit.title}</div><div className="mt-1 text-[10px] text-slate-600">{hit.internal ? "管理后台内部资料" : hit.sourceName} · 质量 {hit.qualityLevel} · {formatDate(hit.capturedAt.toString())}</div><p className="mt-2 line-clamp-4 leading-5 text-slate-300">{hit.content}</p></article>) : <div className="border border-dashed border-slate-800 p-5 text-center text-xs text-slate-600">查询后显示真实命中结果</div>}</div>
            </div>
          </div>
          <div className="mt-4 border border-slate-800 bg-slate-950/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Brain className="h-4 w-4 text-cyan-300" />Ucheer AI 管理员验证输出</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">这里调用与用户前端相同的 Ucheer AI 服务端契约，但仅管理员页面可操作；系统会自动带入命中的公司知识库，不把知识库接口暴露给公开前端。</p>
            <div className="mt-3 flex gap-2"><textarea value={adminPrompt} onChange={(event) => setAdminPrompt(event.target.value)} placeholder="输入要验证的问题，例如：根据公司资料总结当前研究重点" className="min-h-20 min-w-0 flex-1 resize-y border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-white outline-none focus:border-cyan-600" /><button type="button" disabled={!adminPrompt.trim() || adminChat.isPending} onClick={() => { setAdminReply(null); adminChat.mutate({ messages: [{ role: "user", content: adminPrompt.trim() }], context: { module: "Agent Reach 公司知识库", symbol: "", market: "", page: "/admin/agent-reach" }, thinkingDepth: "expert" }); }} className="self-end inline-flex items-center gap-2 bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{adminChat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}调用 Ucheer</button></div>
            {adminReply && <div className={`mt-3 border p-3 text-sm leading-7 ${adminReply.status === "available" ? "border-emerald-800 bg-emerald-950/20 text-slate-200" : "border-amber-800 bg-amber-950/20 text-amber-200"}`}><div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-500"><span>状态：{adminReply.status}</span><span>模式：{adminReply.thinkingDepth}</span><span>公司库命中：{adminReply.plan?.knowledgeCount ?? "由服务端判定"}</span></div>{adminReply.reply || adminReply.message || "暂无输出"}</div>}
          </div>
        </section>

        <section className="border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="flex items-center gap-2 font-semibold"><ExternalLink className="h-4 w-4 text-cyan-300" />最近读取与诊断说明</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="max-h-52 overflow-auto text-xs">{(dashboard.data?.recentReads ?? []).length ? dashboard.data?.recentReads.map((item) => <div key={item.id} className="flex items-start gap-2 border-b border-slate-900 py-2"><span className={item.status === "success" ? "text-emerald-300" : "text-rose-300"}>{item.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}</span><div className="min-w-0"><div className="truncate text-slate-300">{item.url}</div><div className="text-slate-600">{item.source} · {formatDate(item.observedAt)}{item.error ? ` · ${item.error}` : ""}</div></div></div>) : <div className="text-slate-600">尚无读取记录</div>}</div>
            <div className="text-xs leading-6 text-slate-400">
              <p>该模块完整保留 Agent-Reach 的渠道概念、优先后端和诊断职责，但不会把“绕过 API”理解成绕过登录、验证码、付费墙或访问控制。</p>
              <p className="mt-2">后台只运行固定的版本检查命令；不会接受前端传入的任意 shell 命令，也不会把 Cookie、Token、API Key 返回浏览器。</p>
              <p className="mt-2 text-amber-200">需要账号的渠道必须由管理员在本机按上游项目说明配置；未配置时显示“需配置”，不会生成假数据。</p>
            </div>
          </div>
        </section>
        </>}
      </div>
    </AdminLayout>
  );
}
