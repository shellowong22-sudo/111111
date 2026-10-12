import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BrainCircuit, Loader2, Plus, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

type ChatMessage = { id?: number; role: "user" | "assistant"; content: string; feedback?: "helpful" | "unhelpful" | null };

const THINKING_MODE_LABELS = {
  instant: "即时回答",
  balanced: "均衡分析",
  deep: "深度推演",
  expert: "专家研判",
} as const;

const THINKING_MODE_DESCRIPTIONS = {
  instant: "速度优先，先给结论",
  balanced: "结论与依据保持平衡",
  deep: "展开因果链与风险情景",
  expert: "完整研判、反例与边界",
} as const;

const THINKING_STAGES = {
  instant: ["正在快速整理答案"],
  balanced: ["正在理解问题", "正在组织分析"],
  deep: ["正在梳理因果关系", "正在核验关键假设", "正在整理风险边界"],
  expert: ["正在建立专家研判框架", "正在检查证据与反例", "正在整理可执行结论"],
} as const;

function cleanAssistantDisplay(content: string, preserveMarkdownLists = false) {
  const cleaned = content
    // Older persisted replies may contain standalone decorative bullets from
    // a gateway's typing/draft formatter. Hide those artifacts without
    // altering ordinary Markdown lists.
    .replace(/^\s*(?:[•●▪·◦○∙‣⁃▸►◆◇★☆※]\s*)+$/gm, "")
    .replace(/^\s*(?:[•●▪·◦○∙‣⁃▸►◆◇★☆※])\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return preserveMarkdownLists ? cleaned : cleaned.replace(/^\s*[-*+]\s+/gm, "");
}

function userRequestedList(messages: ChatMessage[], assistantIndex: number) {
  const previousUser = [...messages.slice(0, assistantIndex)]
    .reverse()
    .find((message) => message.role === "user")?.content ?? "";
  return /列表|清单|步骤|表格|逐条|要点|对比|分点/.test(previousUser);
}

const initialMessage: ChatMessage = {
  role: "assistant",
  content: "你好，我是 Ucheer AI，终端平台的金融对话式 AI。你可以直接提出市场、新闻、宏观、标的、风险或研究工作流问题；如果需要实时数据，我会先检查当前终端是否提供了对应观察。",
};

export default function UcheerAi() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const initialHistoryLoaded = useRef(false);
  const [thinkingDepth, setThinkingDepth] = useState<"instant" | "balanced" | "deep" | "expert">("balanced");
  const [thinkingStage, setThinkingStage] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<{
    attempted: boolean;
    query: string | null;
    resultCount: number;
    documentCount: number;
    observedAt: string | null;
    results: Array<{ title: string; url: string }>;
  } | null>(null);
  const status = trpc.ucheerAi.status.useQuery(undefined, { refetchInterval: 60_000 });
  const workspace = trpc.ucheerAi.workspace.useQuery();
  const signedIn = workspace.data?.authenticated === true;
  const utils = trpc.useUtils();
  const conversations = trpc.ucheerAi.conversations.useQuery(undefined, { enabled: signedIn });
  const history = trpc.ucheerAi.conversation.useQuery({ id: conversationId ?? "" }, { enabled: signedIn && Boolean(conversationId) });
  const memories = trpc.ucheerAi.memories.useQuery(undefined, { enabled: signedIn });
  const removeConversation = trpc.ucheerAi.deleteConversation.useMutation({
    onSuccess: () => { setConversationId(null); setMessages([initialMessage]); void utils.ucheerAi.conversations.invalidate(); },
  });
  const removeMemory = trpc.ucheerAi.deleteMemory.useMutation({
    onSuccess: () => void utils.ucheerAi.memories.invalidate(),
  });
  const rateAnswer = trpc.ucheerAi.rateAnswer.useMutation({
    onSuccess: () => { if (conversationId) void utils.ucheerAi.conversation.invalidate({ id: conversationId }); },
  });
  useEffect(() => {
    if (signedIn && conversations.isSuccess && !initialHistoryLoaded.current) {
      initialHistoryLoaded.current = true;
      if (conversations.data?.[0]) setConversationId(conversations.data[0].id);
    }
  }, [signedIn, conversations.isSuccess, conversations.data]);
  useEffect(() => {
    if (history.data?.id === conversationId && !chat.isPending) {
      setMessages([initialMessage, ...history.data.messages.map(item => ({
        id: item.id, role: item.role, content: item.role === "assistant" ? cleanAssistantDisplay(item.content, true) : item.content, feedback: item.feedback,
      }))]);
    }
  // chat is declared below; only observe its pending flag, not its mutable identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data, conversationId]);
  const chat = trpc.ucheerAi.chat.useMutation({
    onSuccess: (result) => {
      setSearchInfo(result.search);
      if (result.status === "available" && result.reply) {
        setMessages(current => [...current, { role: "assistant", content: cleanAssistantDisplay(result.reply!, true), id: result.assistantMessageId ?? undefined }]);
        if (result.conversationId) {
          setConversationId(result.conversationId);
          void utils.ucheerAi.conversations.invalidate();
          void utils.ucheerAi.conversation.invalidate({ id: result.conversationId });
          void utils.ucheerAi.memories.invalidate();
        }
      }
    },
  });
  useEffect(() => {
    if (!chat.isPending) {
      setThinkingStage(null);
      return;
    }
    const stages = THINKING_STAGES[thinkingDepth];
    let stageIndex = 0;
    setThinkingStage(stages[stageIndex]);
    const timer = window.setInterval(() => {
      stageIndex = (stageIndex + 1) % stages.length;
      setThinkingStage(stages[stageIndex]);
    }, thinkingDepth === "instant" ? 1_600 : 2_200);
    return () => window.clearInterval(timer);
  }, [chat.isPending, thinkingDepth]);
  const conversation = useMemo(() => messages.filter((message) => message !== initialMessage), [messages]);

  const submit = () => {
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const nextMessages: ChatMessage[] = [...conversation, { role: "user", content }];
    setMessages([...nextMessages]);
    setDraft("");
    chat.mutate({
      messages: signedIn ? [{ role: "user", content }] : nextMessages.slice(-32).map(({ role, content: text }) => ({ role, content: text })),
      ...(signedIn && conversationId ? { conversationId } : {}),
      context: { module: "Ucheer AI", page: "/ucheer-ai" },
      thinkingDepth,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100" data-ucheer-ai-module="true">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm lg:w-64">
      <button type="button" onClick={() => { setConversationId(null); setMessages([initialMessage]); setSearchInfo(null); chat.reset(); }} className="flex w-full items-center gap-2 rounded-lg border border-violet-500/50 px-3 py-2 text-violet-200 hover:bg-violet-500/10"><Plus className="h-4 w-4" />新建对话</button>
          <h2 className="mt-5 text-xs font-semibold text-slate-400">历史对话</h2>
          {!signedIn && <p className="mt-2 text-xs leading-5 text-amber-300">登录后自动保存输入、回答和长期记忆；匿名对话不会持久化。</p>}
          {conversations.error && signedIn && <p className="mt-2 text-xs text-rose-300">历史记录暂不可用，请检查后台存储。</p>}
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {conversations.data?.map(item => <div key={item.id} className={`group flex items-center gap-1 rounded px-2 py-1.5 ${item.id === conversationId ? "bg-violet-800/40" : "hover:bg-slate-800"}`}>
              <button type="button" title={item.title} onClick={() => setConversationId(item.id)} className="min-w-0 flex-1 truncate text-left text-xs text-slate-200">{item.title}</button>
              <button type="button" aria-label={`删除对话 ${item.title}`} disabled={removeConversation.isPending} onClick={() => { if (window.confirm("删除这段对话及全部消息？")) removeConversation.mutate({ id: item.id }); }} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
            </div>)}
          </div>
          <h2 className="mt-5 text-xs font-semibold text-slate-400">长期记忆</h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">系统会从你的自然表达中自动识别长期偏好、持续目标和研究主题；实时行情、凭据和助手推测不会写入记忆。</p>
          {memories.error && signedIn && <p className="mt-2 text-xs text-rose-300">记忆存储暂不可用。</p>}
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {memories.data?.map(item => <div key={item.id} className="flex items-start gap-2 rounded border border-slate-800 p-2 text-xs">
              <div className="min-w-0 flex-1 break-words text-slate-300"><span className="mr-1 text-violet-300">{item.kind === "core" ? "偏好" : "摘要"}</span>{item.content}</div>
              <button type="button" aria-label="删除这条记忆" disabled={removeMemory.isPending} onClick={() => removeMemory.mutate({ id: item.id })} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
            </div>)}
          </div>
        </aside>
        <main className="flex min-h-[calc(100vh-2.5rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-violet-900/60 bg-slate-900/70">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 bg-gradient-to-r from-violet-950/60 to-slate-900 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-500/15 p-2.5"><BrainCircuit className="h-6 w-6 text-violet-300" /></div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-violet-300">Terminal Intelligence</p>
                <h1 className="mt-1 text-2xl font-semibold text-white">Ucheer AI</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">终端平台专属金融对话式 AI，支持连续上下文和受控终端环境，不是固定问答卡片。</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-right text-xs">
              <p className="text-slate-500">运行状态</p>
              <p className={status.data?.runtime === "configured" ? "mt-1 text-emerald-300" : "mt-1 text-amber-300"}>
                {status.isLoading ? "读取中…" : status.error ? "接口未连接" : status.data?.runtime === "configured" ? "已配置，生成时实时验证" : "未配置模型"}
              </p>
            </div>
          </header>

          <section className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <div className="mt-1 rounded-full bg-violet-500/15 p-2"><Sparkles className="h-4 w-4 text-violet-300" /></div>}
                <div className={`max-w-[min(780px,90%)] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-violet-600 text-white" : "border border-slate-700 bg-slate-950/70 text-slate-200"}`}>
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-3 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-a:text-violet-300 prose-a:underline">
                      <Streamdown>{cleanAssistantDisplay(message.content, userRequestedList(messages, index))}</Streamdown>
                    </div>
                  ) : message.content}
                  {message.role === "assistant" && message.id && signedIn && <div className="mt-2 flex justify-end gap-2 border-t border-slate-800 pt-2">
                    <button type="button" aria-label="回答有帮助" title="回答有帮助" disabled={rateAnswer.isPending} onClick={() => rateAnswer.mutate({ messageId: message.id!, feedback: "helpful" })} className={message.feedback === "helpful" ? "text-emerald-300" : "text-slate-500 hover:text-emerald-300"}><ThumbsUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="回答需要改进" title="回答需要改进" disabled={rateAnswer.isPending} onClick={() => rateAnswer.mutate({ messageId: message.id!, feedback: "unhelpful" })} className={message.feedback === "unhelpful" ? "text-rose-300" : "text-slate-500 hover:text-rose-300"}><ThumbsDown className="h-3.5 w-3.5" /></button>
                  </div>}
                </div>
                {message.role === "user" && <div className="mt-1 rounded-full bg-slate-800 p-2"><UserRound className="h-4 w-4 text-slate-300" /></div>}
              </div>
            ))}
            {chat.isPending && (
              <div className="flex items-center gap-2 text-sm text-violet-200" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{thinkingStage ?? "正在分析问题"}</span>
                <span className="inline-flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:300ms]" />
                </span>
              </div>
            )}
            {chat.data?.status === "unavailable" && <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-200"><AlertCircle className="mr-2 inline h-4 w-4" />{chat.data.message}</div>}
            {chat.data?.status === "error" && <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3 text-sm text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />{chat.data.message}</div>}
            {chat.error && <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3 text-sm text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />Ucheer AI 接口调用失败：{chat.error.message}</div>}
            {searchInfo?.attempted && (
              <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-3 text-xs text-cyan-100">
                <p>本次找到 {searchInfo.resultCount} 条检索结果，其中读取正文 {searchInfo.documentCount} 条{searchInfo.query ? `：${searchInfo.query}` : ""}。{searchInfo.observedAt ? `正文读取时间：${new Date(searchInfo.observedAt).toLocaleString()}。` : ""}仅标题与摘要不能证明实时事实。</p>
                {searchInfo.results.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {searchInfo.results.slice(0, 4).map((item) => (
                      <span key={item.url}  className="block truncate text-cyan-300 hover:text-cyan-100 hover:underline">
                        {item.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="border-t border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label htmlFor="ucheer-thinking-depth" className="text-xs font-medium text-slate-400">回答方式</label>
              <select
                id="ucheer-thinking-depth"
                value={thinkingDepth}
                onChange={(event) => setThinkingDepth(event.target.value as typeof thinkingDepth)}
                className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 outline-none focus:border-violet-500"
              >
                <option value="instant">即时回答</option>
                <option value="balanced">均衡分析</option>
                <option value="deep">深度推演</option>
                <option value="expert">专家研判</option>
              </select>
              <span className="text-[11px] text-slate-500" title={THINKING_MODE_DESCRIPTIONS[thinkingDepth]}>{THINKING_MODE_DESCRIPTIONS[thinkingDepth]}</span>
              {chat.data?.thinkingDepth && <span className="text-[11px] text-violet-300">本次已使用：{THINKING_MODE_LABELS[chat.data.thinkingDepth]}</span>}
              {chat.data?.answerLength && <span className="text-[11px] text-slate-500">篇幅：{chat.data.answerLength.label}</span>}
              {chat.data?.answerStyle && <span className="text-[11px] text-slate-500">风格：{chat.data.answerStyle.label}</span>}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
                placeholder="输入问题、回答字数或风格要求；例如“用1000字大白话分析，并列出风险”"
                className="min-h-16 flex-1 resize-none border-slate-700 bg-slate-900 text-sm"
                maxLength={6_000}
              />
              <Button type="button" onClick={submit} disabled={!draft.trim() || chat.isPending} className="h-auto self-stretch bg-violet-600 px-4 text-white hover:bg-violet-500"><Send className="h-4 w-4" /></Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">可以直接在问题里指定字数、语气、格式和受众；例如“约一万字”“不超过500字”“用报告格式”“先给结论”。</p>
          </section>
        </main>
      </div>
    </div>
  );
}
