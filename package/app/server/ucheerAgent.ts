import type { UcheerAiChatInput } from "./ucheerAi";
import type { UcheerSearchDecision } from "./ucheerAiSearch";

export type UcheerAgentRole =
  | "conversation"
  | "research"
  | "market_analysis"
  | "comparison"
  | "workflow";

export type UcheerAgentStepStatus = "completed" | "skipped" | "pending" | "blocked";

export type UcheerAgentStep = {
  id: "context" | "memory" | "research" | "synthesis" | "verification";
  label: string;
  status: UcheerAgentStepStatus;
  detail: string | null;
};

export type UcheerAgentPlan = {
  role: UcheerAgentRole;
  confidence: number;
  requiresFreshEvidence: boolean;
  steps: UcheerAgentStep[];
  completedAt: string | null;
};

function latestUserText(input: UcheerAiChatInput) {
  return [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function roleFor(text: string): UcheerAgentRole {
  if (/比较|对比|区别|优劣|哪个更|排名|筛选/i.test(text)) return "comparison";
  if (/最新|实时|今天|新闻|公告|报告|资料|研究|搜索|查询|查找|全球|国际|央行|财报/i.test(text)) return "research";
  if (/价格|行情|指数|股票|债券|基金|ETF|期权|期货|外汇|商品|波动|收益率|估值|风险/i.test(text)) return "market_analysis";
  if (/执行|创建|整理|导出|保存|监控|跟踪|计划|工作流/i.test(text)) return "workflow";
  return "conversation";
}

function step(
  id: UcheerAgentStep["id"],
  label: string,
  status: UcheerAgentStepStatus,
  detail: string | null = null,
): UcheerAgentStep {
  return { id, label, status, detail };
}

/**
 * AgenticSeek's useful shape is a router + planner + bounded tools. This
 * implementation keeps that shape but limits tools to the existing financial
 * search, memory, terminal context and citation checks; it never exposes a
 * shell, browser profile or arbitrary file writer to a chat request.
 */
export function createUcheerAgentPlan(
  input: UcheerAiChatInput,
  searchDecision: UcheerSearchDecision,
  memories: string[],
): UcheerAgentPlan {
  const text = latestUserText(input);
  const hasContext = Boolean(input.context.module || input.context.symbol || input.context.market || input.context.page);
  const role = roleFor(text);
  const confidence = role === "conversation" ? 0.66 : 0.86;
  return {
    role,
    confidence,
    requiresFreshEvidence: searchDecision.shouldSearch,
    steps: [
      step("context", "绑定终端上下文", hasContext ? "completed" : "skipped", hasContext ? "已读取当前模块、标的或市场上下文。" : "本轮没有额外终端上下文。"),
      step("memory", "读取长期记忆", memories.length ? "completed" : "skipped", memories.length ? `已读取 ${Math.min(memories.length, 10)} 条相关记忆。` : "本轮没有命中长期记忆。"),
      step("research", "检索公开资料", searchDecision.shouldSearch ? "pending" : "skipped", searchDecision.shouldSearch ? "将只使用本轮读取到的正文作为动态事实依据。" : "本轮问题不需要外部资料。"),
      step("synthesis", "组织金融回答", "pending", "按事实、分析和不确定性分层生成。"),
      step("verification", "核验引用与输出", "pending", "检查成品文本、重复内容和引用边界。"),
    ],
    completedAt: null,
  };
}

const ROLE_INSTRUCTIONS: Record<UcheerAgentRole, string> = {
  conversation: "先直接回应问题，再说明必要的背景。不要为简单概念问题强行编造工作流。",
  research: "优先基于本轮已读取的正文列明事实、时间、来源；证据不足就点明具体缺口。",
  market_analysis: "区分市场观察、分析假设与风险，不能把历史材料当作当前行情。",
  comparison: "用同一口径、时间范围与维度比较各对象；缺少可比数据时分别注明，不做虚假排名。",
  workflow: "将问题分成有限的可操作步骤；当前没有授权执行工具，只能提出建议，不能声称已经修改文件、设置提醒或下单。",
};

export function agentAnswerInstruction(plan: UcheerAgentPlan): string {
  return ROLE_INSTRUCTIONS[plan.role];
}

export function finishUcheerAgentPlan(
  plan: UcheerAgentPlan,
  outcome: "available" | "unavailable" | "error",
  hasEvidence: boolean,
): UcheerAgentPlan {
  const steps = plan.steps.map((current) => {
    if (current.id === "research") {
      if (current.status === "skipped") return current;
      return hasEvidence
        ? { ...current, status: "completed" as const, detail: "已读取可核验正文。" }
        : { ...current, status: "blocked" as const, detail: "没有读取到可核验正文，已阻止动态事实输出。" };
    }
    if (current.id === "synthesis") {
      return outcome === "available"
        ? { ...current, status: "completed" as const, detail: "回答已生成。" }
        : { ...current, status: "blocked" as const, detail: "未生成未经核验的替代文本。" };
    }
    if (current.id === "verification") {
      return outcome === "available"
        ? { ...current, status: "completed" as const, detail: "已通过成品文本与引用边界检查。" }
        : { ...current, status: "blocked" as const, detail: "本轮没有可展示的成品回答。" };
    }
    return current;
  });
  return { ...plan, steps, completedAt: new Date().toISOString() };
}
