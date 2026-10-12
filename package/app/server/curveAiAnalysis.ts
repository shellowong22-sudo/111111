/**
 * /api/curve-ai-analysis  — SSE 流式 AI 分析接口
 *
 * POST body:
 *   curveName    string   曲线名称
 *   curveId      string   曲线代码
 *   curveType    string   曲线类型
 *   country      string   国家
 *   currency     string   货币
 *   y2           number | null   2Y 收益率
 *   y10          number | null   10Y 收益率
 *   slope        number | null   2Y-10Y 利差
 *   minYield     number   曲线最低点
 *   maxYield     number   曲线最高点
 *   spread       number   曲线利差
 *   latestDate   string   最新数据日期
 *   historyTrend string   "rising" | "falling" | "flat" | "volatile"
 *   recentValues  Array<{ period: string; value: string }>  最新截面数据
 */

import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";

function resolveApiUrl() {
  return ENV.llmBaseUrl && ENV.llmBaseUrl.trim().length > 0
    ? `${ENV.llmBaseUrl.replace(/\/$/, "")}/chat/completions`
    : "http://localhost:4000/v1/chat/completions";
}

function buildPrompt(body: Record<string, unknown>): string {
  const {
    curveName, curveId, curveType, country, currency,
    y2, y10, slope, minYield, maxYield, spread,
    latestDate, historyTrend, recentValues, analysisStyle,
  } = body as {
    curveName: string; curveId: string; curveType: string;
    country: string; currency: string;
    y2: number | null; y10: number | null; slope: number | null;
    minYield: number; maxYield: number; spread: number;
    latestDate: string; historyTrend: string;
    analysisStyle?: string;
    recentValues: Array<{ period: string; value: string }>;
  };

  const styleInstruction =
    analysisStyle === "plain"
      ? "请用通俗易懂的日常语言解读，避免专业术语，让普通投资者也能理解。"
      : analysisStyle === "strategy"
      ? "请聚焦于交易机会与风险提示，给出明确的操作方向建议（如做陡/做平/做多/做空），适合策略研究人员。"
      : "请使用固定收益专业术语（如久期、凸性、利差、倒挂、陡峭化等），适合机构投资者阅读。";

  const snapshotLines = Array.isArray(recentValues)
    ? recentValues.map(r => `  ${r.period}: ${parseFloat(r.value).toFixed(4)}%`).join("\n")
    : "  暂无数据";

  const slopeDesc =
    slope == null ? "无法计算（缺少 2Y 或 10Y 数据）"
    : slope > 0.5 ? `正斜率 +${slope.toFixed(4)}%（曲线正常陡峭，长端溢价明显）`
    : slope > 0 ? `轻微正斜率 +${slope.toFixed(4)}%（曲线趋于平坦）`
    : slope === 0 ? "完全平坦"
    : slope > -0.5 ? `轻微倒挂 ${slope.toFixed(4)}%（市场对经济前景存在担忧）`
    : `深度倒挂 ${slope.toFixed(4)}%（强烈的衰退预期信号）`;

  const trendDesc =
    historyTrend === "rising" ? "近期整体上行（收益率走高，市场预期加息或通胀压力）"
    : historyTrend === "falling" ? "近期整体下行（收益率走低，市场预期降息或避险情绪升温）"
    : historyTrend === "volatile" ? "近期波动较大（市场情绪不稳定，多空博弈激烈）"
    : "近期走势平稳（市场预期稳定）";

  return `你是一位专业的固定收益分析师，请根据以下收益率曲线数据，用中文生成一段 **简短、专业、有洞察力** 的市场趋势解读（150-250字）。

## 曲线基本信息
- 名称：${curveName}（${curveId}）
- 类型：${curveType} | 国家：${country} | 货币：${currency}
- 数据日期：${latestDate}

## 关键指标
- 2Y 收益率：${y2 != null ? y2.toFixed(4) + "%" : "N/A"}
- 10Y 收益率：${y10 != null ? y10.toFixed(4) + "%" : "N/A"}
- 2Y-10Y 利差：${slopeDesc}
- 曲线区间：${minYield.toFixed(4)}% ~ ${maxYield.toFixed(4)}%（利差 ${spread.toFixed(4)}%）

## 最新期限结构截面
${snapshotLines}

## 历史走势
${trendDesc}

## 要求
1. 先用 1-2 句话描述当前曲线形态（正常/平坦/倒挂）及其含义
2. 结合历史走势，分析近期市场情绪和可能的驱动因素
3. 给出 1 条简短的前瞻性观点或风险提示
4. 语言简洁，避免废话，不要重复列举数字
5. 输出纯 Markdown 格式（可用加粗、分段，但不要用标题符号 # ）
6. 风格要求：${styleInstruction}`;
}

export function registerCurveAiAnalysis(app: Express) {
  app.post("/api/curve-ai-analysis", async (req: Request, res: Response) => {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let finished = false;
    res.on("close", () => { finished = true; });

    try {
      const apiUrl = resolveApiUrl();
      const apiKey = ENV.llmApiKey;
      if (!apiKey) {
        res.write(`data: ${JSON.stringify({ error: "API key not configured" })}\n\n`);
        res.end();
        return;
      }

      const prompt = buildPrompt(req.body);

      const upstream = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "你是一位专业的固定收益市场分析师，擅长解读收益率曲线形态和市场信号，语言简洁专业。",
            },
            { role: "user", content: prompt },
          ],
          stream: true,
          max_tokens: 512,
        }),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        res.write(`data: ${JSON.stringify({ error: `LLM error: ${upstream.status} ${errText}` })}\n\n`);
        res.end();
        return;
      }

      const reader = upstream.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (finished) break;
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          try {
            const chunk = JSON.parse(jsonStr);
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (delta) {
              res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
              // flush if available
              if (typeof (res as any).flush === "function") {
                (res as any).flush();
              }
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      if (!finished) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err: unknown) {
      if (!finished) {
        const msg = err instanceof Error ? err.message : String(err);
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      }
    }
  });
}
