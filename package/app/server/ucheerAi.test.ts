import { describe, expect, it } from "vitest";
import {
  chatWithUcheerAi,
  ChatInput,
  containsAssistantDraft,
  getUcheerAiStatus,
  NewsInput,
  parseAnswerLength,
  parseAnswerStyle,
  sanitizeAssistantReply,
  UCHEER_AI_CAPABILITIES,
} from "./ucheerAi";

describe("Ucheer AI controlled runtime", () => {
  it("exposes a fixed capability allowlist", () => {
    expect(UCHEER_AI_CAPABILITIES.map((item) => item.id)).toEqual([
      "conversation",
      "persistent_memory",
      "progressive_recall",
      "news_sentiment",
      "headline_direction",
      "research_summary",
    ]);
  });

  it("rejects arbitrary model or function fields from the input contract", () => {
    const parsed = NewsInput.safeParse({
      capability: "news_sentiment",
      title: "央行公布利率决定",
      model: "arbitrary-model",
      functionName: "run-anything",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("model");
      expect(parsed.data).not.toHaveProperty("functionName");
    }
  });

  it("returns a sanitized runtime status without credentials or internal addresses", () => {
    const status = getUcheerAiStatus();
    expect(status.brand).toBe("Ucheer AI");
    expect(status.capabilities).toHaveLength(6);
    expect(JSON.stringify(status)).not.toMatch(/token|secret|password|localhost|127\.0\.0\.1/i);
  });

  it("keeps the primary interface as a multi-turn conversation contract", async () => {
    const parsed = ChatInput.safeParse({
      messages: [
        { role: "user", content: "解释今天的利率变化" },
        { role: "assistant", content: "请提供市场或标的上下文。" },
        { role: "user", content: "当前标的是 US10Y" },
      ],
      context: { module: "Ucheer AI", symbol: "US10Y", market: "利率", page: "/ucheer-ai" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const result = await chatWithUcheerAi(parsed.data);
      expect(result.brand).toBe("Ucheer AI");
      expect(["unavailable", "error", "available"]).toContain(result.status);
      if (result.status === "available") expect(result.reply).toEqual(expect.any(String));
      else expect(result.reply).toBeNull();
    }
  });

  it("does not display the model's intermediate task analysis as a final answer", () => {
    expect(containsAssistantDraft("用户要求最新新闻，我需要梳理资料。")).toBe(true);
    expect(containsAssistantDraft("让我先分析一下资料。\n资料1：利率变化")).toBe(true);
    expect(containsAssistantDraft("根据本次可核验的正文，利率决定已公布。")).toBe(false);
  });

  it("honors natural-language answer length controls", () => {
    expect(parseAnswerLength([{ role: "user", content: "请用500字左右解释收益率曲线倒挂" }])).toMatchObject({
      requestedChars: 500,
      mode: "standard",
      source: "explicit",
    });
    expect(parseAnswerLength([{ role: "user", content: "只要结论，简短一点" }])).toMatchObject({
      requestedChars: null,
      mode: "brief",
      source: "explicit",
    });
    expect(parseAnswerLength([{ role: "user", content: "请展开分析并说明风险" }])).toMatchObject({
      requestedChars: null,
      mode: "detailed",
      source: "explicit",
    });
    expect(parseAnswerLength([{ role: "user", content: "请用一万字左右写一份完整研判" }])).toMatchObject({
      requestedChars: 10_000,
      constraint: "around",
      mode: "detailed",
    });
    expect(parseAnswerLength([{ role: "user", content: "不超过500字，先给结论" }])).toMatchObject({
      requestedChars: 500,
      constraint: "max",
      label: "不超过 500 字",
    });
  });

  it("honors natural-language answer style controls", () => {
    expect(parseAnswerStyle([{ role: "user", content: "用大白话、口语化一点解释" }])).toMatchObject({
      mode: "plain",
      label: "大白话口语化",
    });
    expect(parseAnswerStyle([{ role: "user", content: "请用表格对比两个方案" }])).toMatchObject({
      mode: "structured",
      label: "结构化对比",
    });
    expect(parseAnswerStyle([{ role: "user", content: "请用投资委员会口吻回答" }])).toMatchObject({
      mode: "custom",
      label: "自定义回答要求",
    });
  });

  it("removes hidden drafts and decorative leading bullets without breaking links", () => {
    const cleaned = sanitizeAssistantReply("思考过程：先整理资料\n• 结论：利率上行\n\n\n[资料](https://example.com)");
    expect(cleaned).toBe("结论：利率上行\n\n[资料](https://example.com)");
    expect(cleaned).not.toMatch(/思考过程|•/);
  });
});
