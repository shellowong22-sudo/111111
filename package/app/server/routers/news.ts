/**
 * news router — AI 财经新闻摘要提取
 *
 * summarize: 接收新闻标题 + 正文，调用 LLM 生成结构化摘要
 *   - 核心观点（3 条）
 *   - 市场影响（多空判断 + 说明）
 *   - 关键数据点
 *   - 一句话结论
 *
 * summarizeBatch: 批量摘要（最多 5 条，用于列表页快速预览）
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { TRPCError } from '@trpc/server';

// ─── Schema ───────────────────────────────────────────────────────────────────
const NewsItemInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).default(''),
  category: z.string().default(''),
  symbol: z.string().default(''),
  source: z.string().default(''),
  sentiment: z.string().default('neutral'),
  changePct: z.number().default(0),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `你是一位资深金融分析师，专注于财经新闻的快速解读。
请用简洁、专业的中文分析新闻内容，输出严格遵循 JSON Schema 的结构化摘要。
要求：
- 语言简洁，每条观点不超过 50 字
- 市场影响判断需有逻辑依据
- 关键数据点直接引用原文数字（若无则留空数组）
- 一句话结论不超过 30 字，直接点明交易含义`;
}

function buildUserPrompt(item: z.infer<typeof NewsItemInput>): string {
  const lines = [
    `【标题】${item.title}`,
    item.summary ? `【摘要】${item.summary}` : '',
    item.category ? `【板块】${item.category}` : '',
    item.symbol ? `【代码】${item.symbol}` : '',
    item.source ? `【来源】${item.source}` : '',
    item.changePct !== 0 ? `【涨跌幅】${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

const SUMMARY_SCHEMA = {
  name: 'news_summary',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      keyPoints: {
        type: 'array' as const,
        description: '3 条核心观点，每条不超过 50 字',
        items: { type: 'string' as const },
      },
      marketImpact: {
        type: 'object' as const,
        description: '市场影响判断',
        properties: {
          direction: {
            type: 'string' as const,
            enum: ['bullish', 'bearish', 'neutral'] as const,
            description: '多头/空头/中性',
          },
          strength: {
            type: 'string' as const,
            enum: ['strong', 'moderate', 'weak'] as const,
            description: '影响强度',
          },
          reason: {
            type: 'string' as const,
            description: '判断依据，不超过 60 字',
          },
        },
        required: ['direction', 'strength', 'reason'] as const,
        additionalProperties: false,
      },
      dataPoints: {
        type: 'array' as const,
        description: '新闻中的关键数据点（数字/百分比/金额等），最多 4 条',
        items: {
          type: 'object' as const,
          properties: {
            label: { type: 'string' as const, description: '数据标签' },
            value: { type: 'string' as const, description: '数据值' },
          },
          required: ['label', 'value'] as const,
          additionalProperties: false,
        },
      },
      conclusion: {
        type: 'string' as const,
        description: '一句话交易结论，不超过 30 字',
      },
      relatedTopics: {
        type: 'array' as const,
        description: '相关主题标签，最多 4 个',
        items: { type: 'string' as const },
      },
    },
    required: ['keyPoints', 'marketImpact', 'dataPoints', 'conclusion', 'relatedTopics'] as const,
    additionalProperties: false,
  },
};

export type NewsSummaryResult = {
  id: string;
  keyPoints: string[];
  marketImpact: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    reason: string;
  };
  dataPoints: Array<{ label: string; value: string }>;
  conclusion: string;
  relatedTopics: string[];
  generatedAt: number;
};

function buildFallbackSummary(item: z.infer<typeof NewsItemInput>): NewsSummaryResult {
  const direction: NewsSummaryResult['marketImpact']['direction'] = item.changePct > 0.1 ? 'bullish' : item.changePct < -0.1 ? 'bearish' : 'neutral';
  const numbers = `${item.title} ${item.summary}`.match(/[-+]?\d+(?:\.\d+)?\s*%?|[$€¥]?\s*\d+(?:\.\d+)?/g) ?? [];
  const sourceLead = item.summary.trim() || item.title.trim();
  return {
    id: item.id,
    keyPoints: [item.title.trim(), sourceLead.slice(0, 50), item.category ? `所属板块：${item.category}` : '等待正文与正式来源核验'].filter((value, index, values) => value && values.indexOf(value) === index).slice(0, 3),
    marketImpact: { direction, strength: Math.abs(item.changePct) >= 1 ? 'moderate' : 'weak', reason: item.changePct ? `关联行情日变动 ${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%。` : '当前输入未提供可量化的市场变动。' },
    dataPoints: numbers.slice(0, 4).map((value, index) => ({ label: `原文数据 ${index + 1}`, value: value.trim() })),
    conclusion: sourceLead ? `先核对原文，再结合${item.symbol || '相关品种'}行情观察。` : '等待可核验正文后再作判断。',
    relatedTopics: [item.category, item.symbol].filter(Boolean).slice(0, 4),
    generatedAt: Date.now(),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const newsRouter = router({
  /**
   * 单条新闻 AI 摘要
   */
  summarize: publicProcedure
    .input(NewsItemInput)
    .mutation(async ({ input }): Promise<NewsSummaryResult> => {
      try {
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(input) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: SUMMARY_SCHEMA,
          },
          max_tokens: 800,
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM 返回空内容' });
        }

        const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

        return {
          id: input.id,
          keyPoints: (parsed.keyPoints ?? []).slice(0, 3),
          marketImpact: parsed.marketImpact ?? { direction: 'neutral', strength: 'weak', reason: '无法判断' },
          dataPoints: (parsed.dataPoints ?? []).slice(0, 4),
          conclusion: parsed.conclusion ?? '',
          relatedTopics: (parsed.relatedTopics ?? []).slice(0, 4),
          generatedAt: Date.now(),
        };
      } catch {
        // 没有 LLM 配置或服务暂不可用时，按输入标题/摘要生成可复核的基础结果。
        return buildFallbackSummary(input);
      }
    }),

  /**
   * 批量新闻摘要（最多 5 条，并行调用）
   */
  summarizeBatch: publicProcedure
    .input(z.object({
      items: z.array(NewsItemInput).min(1).max(5),
    }))
    .mutation(async ({ input }): Promise<NewsSummaryResult[]> => {
      const results = await Promise.allSettled(
        input.items.map(item =>
          invokeLLM({
            messages: [
              { role: 'system', content: buildSystemPrompt() },
              { role: 'user', content: buildUserPrompt(item) },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: SUMMARY_SCHEMA,
            },
            max_tokens: 600,
          }).then(response => {
            const content = response.choices?.[0]?.message?.content;
            const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
            return {
              id: item.id,
              keyPoints: (parsed.keyPoints ?? []).slice(0, 3),
              marketImpact: parsed.marketImpact ?? { direction: 'neutral' as const, strength: 'weak' as const, reason: '无法判断' },
              dataPoints: (parsed.dataPoints ?? []).slice(0, 4),
              conclusion: parsed.conclusion ?? '',
              relatedTopics: (parsed.relatedTopics ?? []).slice(0, 4),
              generatedAt: Date.now(),
            } as NewsSummaryResult;
          })
        )
      );

      return results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return buildFallbackSummary(input.items[i]);
      });
    }),
});
