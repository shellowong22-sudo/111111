/**
 * /api/curve-compare-analysis — 双曲线对比 AI 分析 SSE 流式接口
 *
 * POST body:
 *   curveA / curveB: { name, curveId, type, country, currency, y2, y10, slope, snapshot }
 *   analysisStyle: "professional" | "plain" | "strategy"
 */
import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";

function resolveApiUrl() {
  return ENV.llmBaseUrl && ENV.llmBaseUrl.trim().length > 0
    ? `${ENV.llmBaseUrl.replace(/\/$/, "")}/chat/completions`
    : "http://localhost:4000/v1/chat/completions";
}

type CurvePayload = {
  name: string;
  curveId: string;
  type: string;
  country: string;
  currency: string;
  y2: number | null;
  y10: number | null;
  slope: number | null;
  snapshot: Array<{ period: string; value: string }>;
};

function slopeDesc(slope: number | null): string {
  if (slope == null) return "无法计算";
  if (slope > 0.5)  return `正斜率 +${slope.toFixed(4)}%（陡峭）`;
  if (slope > 0)    return `轻微正斜率 +${slope.toFixed(4)}%（趋平）`;
  if (slope === 0)  return "完全平坦";
  if (slope > -0.5) return `轻微倒挂 ${slope.toFixed(4)}%`;
  return `深度倒挂 ${slope.toFixed(4)}%`;
}

function buildComparePrompt(
  a: CurvePayload,
  b: CurvePayload,
  analysisStyle: string
): string {
  const styleInstruction =
    analysisStyle === "plain"
      ? "请用通俗易懂的日常语言解读，避免专业术语，让普通投资者也能理解。"
      : analysisStyle === "strategy"
      ? "请聚焦于两条曲线的相对价值和套利机会，给出明确的操作方向建议，适合策略研究人员。"
      : "请使用固定收益专业术语（久期、凸性、利差、倒挂、陡峭化等），适合机构投资者阅读。";

  const fmtSnapshot = (s: Array<{ period: string; value: string }>) =>
    s.map(r => `  ${r.period}: ${parseFloat(r.value).toFixed(4)}%`).join("\n") || "  暂无数据";

  return `你是一位专业的固定收益分析师，请对以下两条收益率曲线进行**对比分析**，用中文生成一段 200-300 字的市场解读。

## 曲线 A：${a.name}（${a.curveId}）
- 类型：${a.type} | 国家：${a.country} | 货币：${a.currency}
- 2Y 收益率：${a.y2 != null ? a.y2.toFixed(4) + "%" : "N/A"}
- 10Y 收益率：${a.y10 != null ? a.y10.toFixed(4) + "%" : "N/A"}
- 2Y-10Y 利差：${slopeDesc(a.slope)}
- 期限结构截面：
${fmtSnapshot(a.snapshot)}

## 曲线 B：${b.name}（${b.curveId}）
- 类型：${b.type} | 国家：${b.country} | 货币：${b.currency}
- 2Y 收益率：${b.y2 != null ? b.y2.toFixed(4) + "%" : "N/A"}
- 10Y 收益率：${b.y10 != null ? b.y10.toFixed(4) + "%" : "N/A"}
- 2Y-10Y 利差：${slopeDesc(b.slope)}
- 期限结构截面：
${fmtSnapshot(b.snapshot)}

## 分析要求
1. 对比两条曲线的整体形态差异（陡峭程度、倒挂程度、绝对收益率水平）
2. 分析形态差异背后可能的宏观驱动因素（货币政策、通胀预期、经济周期差异等）
3. 指出两条曲线之间的相对价值关系（哪条更具吸引力，或存在何种套利空间）
4. 给出 1-2 条前瞻性风险提示或操作建议
5. 语言简洁专业，不重复列举数字，输出纯 Markdown 格式（可用加粗、分段，不用 # 标题）
6. 风格要求：${styleInstruction}`;
}

export function registerCurveCompareAnalysis(app: Express) {
  app.post("/api/curve-compare-analysis", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let finished = false;
    res.on("close", () => { finished = true; });

    try {
      const { curveA, curveB, analysisStyle = "professional" } = req.body as {
        curveA: CurvePayload;
        curveB: CurvePayload;
        analysisStyle?: string;
      };

      if (!curveA || !curveB) {
        res.write(`data: ${JSON.stringify({ error: "需要提供两条曲线数据" })}\n\n`);
        res.end();
        return;
      }

      const apiUrl = resolveApiUrl();
      const apiKey = ENV.llmApiKey;
      if (!apiKey) {
        res.write(`data: ${JSON.stringify({ error: "API key not configured" })}\n\n`);
        res.end();
        return;
      }

      const prompt = buildComparePrompt(curveA, curveB, analysisStyle);

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
              content: "你是一位专业的固定收益市场分析师，擅长跨市场收益率曲线对比分析，语言简洁专业。",
            },
            { role: "user", content: prompt },
          ],
          stream: true,
          max_tokens: 640,
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
              if (typeof (res as any).flush === "function") (res as any).flush();
            }
          } catch { /* skip */ }
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
