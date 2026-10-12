import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { ArrowRight, Database, ExternalLink, Globe2, Loader2, MessageCircle, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AgentReachKnowledgeDesk from "./AgentReachKnowledgeDesk";

type ChannelId = "web" | "rss" | "github" | "bilibili" | "youtube" | "v2ex" | "xueqiu" | "xiaohongshu";
const runnable = new Set<string>(["web", "rss", "github", "bilibili", "youtube", "v2ex", "xueqiu", "xiaohongshu"]);
const inputHints: Record<ChannelId, string> = {
  web: "输入公开网页网址，例如 https://example.com/article",
  rss: "输入 RSS / Atom 订阅地址",
  github: "输入要查找的仓库关键词",
  bilibili: "输入要搜索的 B 站视频关键词",
  youtube: "输入 YouTube 公开视频搜索关键词",
  v2ex: "热门主题不需要关键词，点击运行即可",
  xueqiu: "请输入股票名称或代码；热榜与热帖无需输入",
  xiaohongshu: "输入要搜索的笔记关键词（需要已有合法登录态）",
};
const adapterNames: Record<ChannelId, string> = {
  web: "Jina Reader 公开网页读取",
  rss: "公开 RSS / Atom 读取",
  github: "GitHub 公开仓库搜索",
  bilibili: "Bilibili 公开搜索",
  youtube: "ZIP 配套 yt-dlp 公开视频搜索",
  v2ex: "V2EX 公开热门主题",
  xueqiu: "ZIP 自带雪球渠道：股票搜索、行情、热帖和热股",
  xiaohongshu: "ZIP 自带小红书清洗器 + 已登录 OpenCLI 搜索",
};

type Props = {
  channels: Array<{
    id: string; name: string; description: string; capabilities: string[]; backends: string[];
    state: { status: string; activeBackend: string | null; message: string };
    backendOverride?: string | null;
    credentials?: Array<{ key: string; configured: boolean }>;
  }>;
  databaseConfigured: boolean;
  opencliInstalled: boolean;
  opencliBridgeConnected: boolean;
  xhsMcpAvailable: boolean;
};

export default function AgentReachWorkbench({ channels, databaseConfigured, opencliInstalled, opencliBridgeConnected, xhsMcpAvailable }: Props) {
  const searchParams = useSearch();
  const utils = trpc.useUtils();
  const [activeChannel, setActiveChannel] = useState("web");
  const [xueqiuAction, setXueqiuAction] = useState<"search" | "quote" | "hot-posts" | "hot-stocks">("search");
  const [tab, setTab] = useState<"skills" | "knowledge" | "chat">(
    () => new URLSearchParams(window.location.search).get("desk") === "skills" ? "skills" : "knowledge",
  );
  useEffect(() => {
    if (new URLSearchParams(searchParams).get("desk") === "knowledge") setTab("knowledge");
  }, [searchParams]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const probe = trpc.agentReachAdmin.refresh.useMutation({
    onSuccess: () => { toast.success("已更新真实渠道诊断"); void utils.agentReachAdmin.dashboard.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const execute = trpc.agentReachAdmin.runSkill.useMutation({
    onSuccess: (value) => {
      setResult(value);
      void utils.agentReachAdmin.dashboard.invalidate();
      void utils.agentReachAdmin.browseKnowledge.invalidate();
      toast.success(value.storage?.stored ? `已取得真实结果并入库 ${value.storage.stored} 条` : "已取得真实结果；查看入库状态");
    },
    onError: (error) => { setResult(null); toast.error(error.message); },
  });
  const chat = trpc.ucheerAi.chat.useMutation({
    onSuccess: (response) => {
      if (response.conversationId) setConversationId(response.conversationId);
      setMessages((previous) => [...previous, { role: "assistant", content: response.reply || response.message || "本次没有可用回答。" }]);
    },
    onError: (error) => {
      setMessages((previous) => [...previous, { role: "assistant", content: `调用失败：${error.message}` }]);
    },
  });
  const active = channels.find((channel) => channel.id === activeChannel);
  // V2EX currently returns 403 in this runtime. Permit an explicit retry
  // only after a new public-endpoint probe actually succeeds.
  const canRun = runnable.has(activeChannel) &&
    (activeChannel !== "v2ex" || active?.state.status === "available") &&
    (activeChannel !== "xueqiu" || active?.state.status === "available") &&
    (activeChannel !== "xiaohongshu" || opencliBridgeConnected || xhsMcpAvailable);
  const inputRequired = !(activeChannel === "v2ex" || activeChannel === "xueqiu" && ["hot-posts", "hot-stocks"].includes(xueqiuAction));
  function run() {
    setResult(null);
    const value = input.trim();
    if (activeChannel === "web" || activeChannel === "rss") {
      execute.mutate({ channelId: activeChannel, input: value });
    } else if (activeChannel === "github" || activeChannel === "bilibili" || activeChannel === "youtube") {
      execute.mutate({ channelId: activeChannel, input: value });
    } else if (activeChannel === "v2ex") {
      execute.mutate({ channelId: "v2ex", input: value });
    } else if (activeChannel === "xueqiu") {
      execute.mutate({ channelId: "xueqiu", action: xueqiuAction, input: value });
    } else if (activeChannel === "xiaohongshu") {
      execute.mutate({ channelId: "xiaohongshu", input: value });
    }
  }
  function ask() {
    const question = prompt.trim();
    if (!question) return;
    const next = [...messages, { role: "user" as const, content: question }].slice(-30);
    setMessages(next);
    setPrompt("");
    chat.mutate({
      messages: next,
      conversationId,
      context: { module: "后台知识工作台", symbol: "", market: "", page: "/admin/agent-reach" },
      thinkingDepth: "balanced",
    });
  }
  return (
    <section className="min-h-[680px] overflow-hidden rounded-2xl border border-slate-700 bg-[#09111e] shadow-[0_18px_60px_rgba(0,0,0,.25)]" data-testid="agent-reach-workbench">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/75 px-5 py-4">
        <div><div className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-400">Private research desk</div><h2 className="mt-1 text-xl font-semibold text-white">Agent Reach · 研究工作台</h2></div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${databaseConfigured ? "border-emerald-700/70 text-emerald-300" : "border-amber-700/70 text-amber-300"}`}>
          <Database className="h-3.5 w-3.5" />公司数据库{databaseConfigured ? "已连接" : "未连接 · 不会假报入库"}
        </div>
      </header>
      <nav className="flex gap-1 border-b border-slate-800 px-4 pt-3">
        {([["skills", "技能执行", Globe2], ["knowledge", "资料与交付", Database], ["chat", "Ucheer AI 输出", MessageCircle]] as const).map(([id, label, Icon]) =>
          <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${tab === id ? "border-cyan-400 text-cyan-100" : "border-transparent text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>
        )}
      </nav>
      {tab === "skills" && <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="max-h-[740px] overflow-y-auto border-b border-slate-800 bg-[#0c1726] p-3 lg:border-b-0 lg:border-r">
          <div className="px-2 pb-2 text-xs text-slate-500">ZIP 映射技能 · {channels.length} 个渠道</div>
          {channels.map((channel) => <button type="button" key={channel.id} onClick={() => { setActiveChannel(channel.id); setInput(""); setResult(null); }}
            className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left ${activeChannel === channel.id ? "border-cyan-700 bg-cyan-950/35" : "border-transparent hover:bg-slate-800/60"}`}>
            <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-100">{channel.name}</span><span className={`h-2 w-2 rounded-full ${channel.state.status === "available" ? "bg-emerald-400" : channel.state.status === "needs_configuration" ? "bg-amber-400" : "bg-slate-600"}`} /></span>
            <span className="mt-1 block text-[11px] text-slate-500">{channel.id === "v2ex" && channel.state.status !== "available" || channel.id === "xueqiu" && channel.state.status !== "available" ? "需重新验证真实可用性" : channel.id === "xiaohongshu" && !opencliBridgeConnected && !xhsMcpAvailable ? opencliInstalled ? "OpenCLI 已安装，但浏览器扩展未连接" : "需配置 OpenCLI 或小红书 MCP" : runnable.has(channel.id) ? "已连接只读执行适配器" : "尚无已验收的执行适配器"}</span>
          </button>)}
        </aside>
        <div className="min-w-0 p-5">
          <div className="flex items-center gap-2 text-xs text-cyan-300"><ShieldCheck className="h-4 w-4" />仅管理员执行 · 公开资料只读</div>
          <h3 className="mt-2 text-2xl font-semibold text-white">{active?.name ?? "选择渠道"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{active?.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">{active?.capabilities.map((ability) => <span key={ability} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{ability}</span>)}</div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/65 p-4 text-xs leading-5 text-slate-400">
            <div>ZIP 后端：{active?.backends.join(" → ") || "—"}</div>
            {canRun && <div className="mt-1 text-cyan-200">当前执行：{adapterNames[activeChannel as ChannelId]}（不等同于 ZIP 命令行后端）</div>}
            <div className="mt-1">最近诊断：{active?.state.status ?? "未检查"} · {active?.state.activeBackend || "未激活"}</div>
            {Boolean(active?.credentials?.length) && <div className="mt-1">配置要求：{active?.credentials?.map((credential) => `${credential.key} ${credential.configured ? "已配置" : "未配置"}`).join(" · ")}</div>}
            <p className="mt-1 text-slate-500">{active?.state.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={probe.isPending || !active} onClick={() => active && probe.mutate({ channelId: active.id })}
                className="inline-flex items-center gap-1.5 rounded border border-slate-600 px-2.5 py-1.5 text-cyan-200 disabled:opacity-40">
                <RefreshCw className={`h-3.5 w-3.5 ${probe.isPending ? "animate-spin" : ""}`} />检查当前渠道
              </button>
            </div>
            {!canRun && <div className="mt-3 text-amber-300">
              {activeChannel === "v2ex" ? "公开端点尚未通过本机检测；检查成功后才能运行。" :
                activeChannel === "xueqiu" ? "ZIP 的雪球行情接口当前无法取回数据。请在本机按 ZIP 指南自行配置合法雪球 Cookie，然后点击「检查当前渠道」；不会自动读取浏览器 Cookie。" :
                  activeChannel === "xiaohongshu" ? opencliInstalled ? "OpenCLI 已安装，但浏览器扩展尚未连通。请自行安装并连接其 Chrome 扩展，在浏览器登录小红书；不会代为读取 Cookie。连通后刷新此页再测试。" : "当前未检测到 OpenCLI 或本机小红书 MCP。需由管理员自行配置已登录的工具；不会替你登录或读取 Cookie。配置后刷新本页再执行真实搜索。" :
                    "此渠道仍需合法账号/工具配置及实际执行验收；目前不提供假搜索按钮。具体安装与配置说明见「诊断与高级配置」。"}
            </div>}
          </div>
          {canRun && <div className="mt-5 rounded-xl border border-cyan-900/70 bg-slate-900/60 p-4">
            {activeChannel === "xueqiu" && <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="雪球技能">
              {([["search", "股票搜索"], ["quote", "股票行情"], ["hot-posts", "热门帖子"], ["hot-stocks", "热门股票"]] as const).map(([id, label]) =>
                <button key={id} type="button" onClick={() => { setXueqiuAction(id); setInput(""); setResult(null); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${xueqiuAction === id ? "border-cyan-500 bg-cyan-950/60 text-cyan-100" : "border-slate-700 text-slate-400"}`}>{label}</button>
              )}
            </div>}
            <label htmlFor="reach-skill-input" className="text-sm font-semibold text-white">任务输入</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input id="reach-skill-input" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !execute.isPending) run(); }}
                placeholder={inputRequired ? inputHints[activeChannel as ChannelId] : "无需输入，点击运行即可"} disabled={!inputRequired}
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-500 disabled:opacity-50" />
              <button type="button" onClick={run} disabled={execute.isPending || (inputRequired && !input.trim())} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 disabled:opacity-40">
                {execute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{execute.isPending ? "执行中" : "运行技能"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">搜索词会发送到相应的外部公开平台，不要输入内部机密。执行后显示真实来源、时间及入库回执；不可访问时明确报错。</p>
          </div>}
          {execute.isError && <div role="alert" className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">本次技能执行失败：{execute.error.message}</div>}
          {result && <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-white">真实返回 · {result.items.length} 条</h4><span className={`text-xs ${result.storage?.status === "stored" ? "text-emerald-300" : "text-amber-300"}`}>清洗入库：{result.storage?.status} / 新增 {result.storage?.stored} / 去重 {result.storage?.deduplicated} / 拒收 {result.storage?.rejected} / 平均质量 {result.storage?.qualityAverage ?? "—"}</span></div>
            {result.items.map((item: { title: string; url: string; summary: string; published: string; content?: string; fields?: Record<string, unknown> }, index: number) =>
              <article key={`${item.url}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="font-medium text-slate-100">{item.title}</div><p className="mt-1 line-clamp-4 text-xs leading-5 text-slate-400">{item.summary}</p>
                {item.fields && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(item.fields).filter(([, value]) => value !== null && value !== undefined && !Array.isArray(value)).slice(0, 8).map(([key, value]) => <span key={key} className="rounded border border-slate-800 px-2 py-1 text-[11px] text-slate-300">{key}: {String(value).slice(0, 100)}</span>)}</div>}
                {item.content && <details className="mt-3 rounded border border-slate-800 px-3 py-2 text-xs text-slate-400"><summary className="cursor-pointer text-cyan-200">查看提取与清洗后的正文</summary><p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap leading-6">{item.content}</p></details>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>{item.published || result.observedAt}</span><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline">打开原始来源<ExternalLink className="h-3 w-3" /></a></div></article>
            )}
            <button type="button" onClick={() => setTab("knowledge")} className="inline-flex items-center gap-2 text-sm text-cyan-300">查看入库与批准状态 <ArrowRight className="h-4 w-4" /></button>
          </div>}
        </div>
      </div>}
      {tab === "knowledge" && <AgentReachKnowledgeDesk databaseConfigured={databaseConfigured} />}
      {tab === "chat" && <div className="mx-auto flex min-h-[610px] max-w-3xl flex-col p-5">
        <div className="border-b border-slate-800 pb-4"><h3 className="text-lg font-semibold text-white">Ucheer AI · 后台验证对话</h3><p className="mt-1 text-xs text-slate-400">与普通 Ucheer 共用真实模型调用；仅批准资料可以成为对话背景。这里不能改变模型额度，也不会自动训练模型权重。</p></div>
        <div className="flex-1 space-y-3 overflow-y-auto py-5">{messages.map((message, index) => <div key={index} className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${message.role === "user" ? "ml-auto bg-cyan-900/40 text-white" : "border border-slate-800 bg-slate-900 text-slate-200"}`}>{message.content}</div>)}{!messages.length && <div className="py-28 text-center text-sm text-slate-500">输入问题，检查批准后的公司资料是否真正帮助 Ucheer 作答。</div>}</div>
        <div className="flex gap-2 border-t border-slate-800 pt-4"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!chat.isPending) ask(); } }} placeholder="向 Ucheer AI 提问；Enter 发送，Shift+Enter 换行" className="min-h-20 min-w-0 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /><button type="button" disabled={chat.isPending || !prompt.trim()} onClick={ask} className="self-end rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{chat.isPending ? "思考中…" : "发送"}</button></div>
      </div>}
    </section>
  );
}
