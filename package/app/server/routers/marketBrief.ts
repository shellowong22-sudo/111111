/**
 * AI 市场资讯摘要路由
 * 自动抓取并总结当天重要金融新闻，帮助用户快速了解市场情绪
 */
import { publicProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { getAllMarketData } from '../db';

// 缓存机制：避免频繁调用 LLM
let cachedBrief: MarketBriefResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟缓存

export interface MarketBriefResult {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  sentimentScore: number; // -100 to 100
  highlights: Array<{
    title: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }>;
  sectorPerformance: Array<{
    sector: string;
    trend: 'up' | 'down' | 'flat';
    note: string;
  }>;
  tradingAdvice: string;
  generatedAt: number;
}

function buildMarketContext(marketData: any[]): string {
  // 构建市场数据上下文
  const stockData = marketData.filter(m => m.market === 'stock').slice(0, 10);
  const bondData = marketData.filter(m => m.market === 'bond').slice(0, 5);
  const commodityData = marketData.filter(m => m.market === 'commodity').slice(0, 5);
  const forexData = marketData.filter(m => m.market === 'forex').slice(0, 5);

  const formatItems = (items: any[]) =>
    items.map(m => `${m.symbol}: ${m.price} (${parseFloat(m.changePct) > 0 ? '+' : ''}${m.changePct}%)`).join(', ');

  return `
当前市场数据快照（${new Date().toLocaleDateString('zh-CN')}）：
- 股票: ${formatItems(stockData)}
- 债券: ${formatItems(bondData)}
- 商品: ${formatItems(commodityData)}
- 外汇: ${formatItems(forexData)}
`;
}

function buildFallbackBrief(marketData: any[], scope = '市场'): MarketBriefResult {
  const rows = marketData.filter((item) => Number.isFinite(Number(item?.changePct)));
  const average = rows.length ? rows.reduce((sum, item) => sum + Number(item.changePct), 0) / rows.length : 0;
  const sentiment: MarketBriefResult['sentiment'] = average > 0.35 ? 'bullish' : average < -0.35 ? 'bearish' : 'neutral';
  const highlights = [...rows]
    .sort((a, b) => Math.abs(Number(b.changePct)) - Math.abs(Number(a.changePct)))
    .slice(0, 4)
    .map((item) => ({
      title: `${item.symbol ?? '品种'} ${Number(item.changePct) >= 0 ? '走强' : '走弱'}`,
      impact: (Number(item.changePct) >= 0 ? 'positive' : 'negative') as 'positive' | 'negative',
      description: `最新${item.price ?? '—'}，日变动 ${Number(item.changePct) >= 0 ? '+' : ''}${Number(item.changePct).toFixed(2)}%。`,
    }));
  const grouped = new Map<string, number[]>();
  rows.forEach((item) => {
    const group = String(item.market ?? item.category ?? '综合市场');
    const values = grouped.get(group) ?? [];
    values.push(Number(item.changePct));
    grouped.set(group, values);
  });
  const sectorPerformance = [...grouped.entries()].slice(0, 5).map(([sector, values]) => {
    const change = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { sector, trend: (change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'flat') as 'up' | 'down' | 'flat', note: `样本均值 ${change >= 0 ? '+' : ''}${change.toFixed(2)}%` };
  });
  return {
    summary: rows.length ? `${scope}观察到 ${rows.length} 个有变动的品种，样本平均日变动 ${average >= 0 ? '+' : ''}${average.toFixed(2)}%，当前情绪偏${sentiment === 'bullish' ? '积极' : sentiment === 'bearish' ? '谨慎' : '中性'}。` : `${scope}数据正在恢复，当前没有可计算的变动样本。`,
    sentiment,
    sentimentScore: Math.max(-100, Math.min(100, Math.round(average * 20))),
    highlights,
    sectorPerformance,
    tradingAdvice: rows.length ? '先核对数据时点与流动性，再结合自身期限和风险限额评估。' : '等待数据源恢复后再进行比较。',
    generatedAt: Date.now(),
  };
}

export const marketBriefRouter = router({
  /**
   * 获取 AI 市场资讯摘要
   */
  getDailyBrief: publicProcedure.query(async (): Promise<MarketBriefResult> => {
    // 检查缓存
    if (cachedBrief && Date.now() - cacheTimestamp < CACHE_TTL) {
      return cachedBrief;
    }

    try {
      // 获取当前市场数据
      const marketData = await getAllMarketData();
      const marketContext = buildMarketContext(marketData);

      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `你是一位资深金融市场分析师，负责为投资者提供每日市场简报。
请基于提供的市场数据，生成一份简洁、专业的市场资讯摘要。
要求：
1. 总结当前市场整体走势和情绪
2. 提取 3-4 条最重要的市场动态
3. 分析各板块表现
4. 给出简洁的交易建议
语言：中文，专业但易懂
风格：Bloomberg Terminal 风格，简洁有力`,
          },
          {
            role: 'user',
            content: `请基于以下市场数据生成今日市场资讯摘要：\n${marketContext}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'market_brief',
            strict: true,
            schema: {
              type: 'object' as const,
              properties: {
                summary: {
                  type: 'string' as const,
                  description: '市场整体摘要，2-3句话概括当日市场情况',
                },
                sentiment: {
                  type: 'string' as const,
                  enum: ['bullish', 'bearish', 'neutral', 'mixed'],
                  description: '市场整体情绪',
                },
                sentimentScore: {
                  type: 'number' as const,
                  description: '情绪分数，-100到100',
                },
                highlights: {
                  type: 'array' as const,
                  description: '重要市场动态，3-4条',
                  items: {
                    type: 'object' as const,
                    properties: {
                      title: { type: 'string' as const, description: '标题，不超过15字' },
                      impact: { type: 'string' as const, enum: ['positive', 'negative', 'neutral'], description: '影响方向' },
                      description: { type: 'string' as const, description: '简要描述，不超过40字' },
                    },
                    required: ['title', 'impact', 'description'] as const,
                    additionalProperties: false,
                  },
                },
                sectorPerformance: {
                  type: 'array' as const,
                  description: '板块表现，4-5个板块',
                  items: {
                    type: 'object' as const,
                    properties: {
                      sector: { type: 'string' as const, description: '板块名称' },
                      trend: { type: 'string' as const, enum: ['up', 'down', 'flat'], description: '趋势方向' },
                      note: { type: 'string' as const, description: '简要说明，不超过20字' },
                    },
                    required: ['sector', 'trend', 'note'] as const,
                    additionalProperties: false,
                  },
                },
                tradingAdvice: {
                  type: 'string' as const,
                  description: '交易建议，一句话，不超过50字',
                },
              },
              required: ['summary', 'sentiment', 'sentimentScore', 'highlights', 'sectorPerformance', 'tradingAdvice'] as const,
              additionalProperties: false,
            },
          },
        },
        max_tokens: 1000,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM 返回空内容' });
      }

      const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

      const result: MarketBriefResult = {
        summary: parsed.summary || '市场数据加载中...',
        sentiment: parsed.sentiment || 'neutral',
        sentimentScore: parsed.sentimentScore || 0,
        highlights: (parsed.highlights || []).slice(0, 4),
        sectorPerformance: (parsed.sectorPerformance || []).slice(0, 5),
        tradingAdvice: parsed.tradingAdvice || '建议观望，等待明确信号',
        generatedAt: Date.now(),
      };

      // 更新缓存
      cachedBrief = result;
      cacheTimestamp = Date.now();

      return result;
    } catch (err) {
      // LLM 未配置、超时或返回格式异常时，仍返回基于已读取行情的可用摘要。
      // 这样前端不会陷入反复 Query Error，数据源恢复后下一次刷新会重新尝试 AI。
      const fallback = buildFallbackBrief(await getAllMarketData().catch(() => []));
      cachedBrief = fallback;
      cacheTimestamp = Date.now();
      return fallback;
    }
  }),

  /**
   * 强制刷新摘要（清除缓存）
   */
  refreshBrief: publicProcedure.mutation(async (): Promise<{ success: boolean }> => {
    cachedBrief = null;
    cacheTimestamp = 0;
    return { success: true };
  }),

  /**
   * 基于用户自选列表生成个性化市场摘要
   */
  getPersonalizedBrief: publicProcedure
    .input(z.object({ symbols: z.array(z.string()).min(1).max(20) }))
    .query(async ({ input }): Promise<MarketBriefResult> => {
      let watchedData: any[] = [];
      try {
        const allData = await getAllMarketData();
        watchedData = allData.filter(m => input.symbols.includes(m.symbol));
        if (watchedData.length === 0) {
          return {
            summary: '您的自选列表中暂无可用的市场数据，请添加品种后重试。',
            sentiment: 'neutral',
            sentimentScore: 0,
            highlights: [],
            sectorPerformance: [],
            tradingAdvice: '建议先添加关注的品种到自选列表',
            generatedAt: Date.now(),
          };
        }
        const formatItems = (items: any[]) =>
          items.map(m => `${m.symbol}(${m.name || ''}): ${m.price} (${parseFloat(m.changePct) > 0 ? '+' : ''}${m.changePct}%)`).join(', ');
        const context = `用户自选品种行情数据：\n${formatItems(watchedData)}`;

        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `你是一位资深金融市场分析师。请基于用户自选品种的行情数据，生成一份针对性的个人化市场分析。
重点分析用户关注的品种表现，给出个性化的交易建议。
语言：中文，专业但易懂。风格：Bloomberg Terminal 风格。`,
            },
            { role: 'user', content: `请基于我的自选品种数据生成个性化分析：\n${context}` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'personalized_brief',
              strict: true,
              schema: {
                type: 'object' as const,
                properties: {
                  summary: { type: 'string' as const, description: '自选品种整体表现摘要' },
                  sentiment: { type: 'string' as const, enum: ['bullish', 'bearish', 'neutral', 'mixed'] },
                  sentimentScore: { type: 'number' as const, description: '情绪分数 -100到100' },
                  highlights: {
                    type: 'array' as const,
                    items: {
                      type: 'object' as const,
                      properties: {
                        title: { type: 'string' as const },
                        impact: { type: 'string' as const, enum: ['positive', 'negative', 'neutral'] },
                        description: { type: 'string' as const },
                      },
                      required: ['title', 'impact', 'description'] as const,
                      additionalProperties: false,
                    },
                  },
                  sectorPerformance: {
                    type: 'array' as const,
                    items: {
                      type: 'object' as const,
                      properties: {
                        sector: { type: 'string' as const },
                        trend: { type: 'string' as const, enum: ['up', 'down', 'flat'] },
                        note: { type: 'string' as const },
                      },
                      required: ['sector', 'trend', 'note'] as const,
                      additionalProperties: false,
                    },
                  },
                  tradingAdvice: { type: 'string' as const },
                },
                required: ['summary', 'sentiment', 'sentimentScore', 'highlights', 'sectorPerformance', 'tradingAdvice'] as const,
                additionalProperties: false,
              },
            },
          },
          max_tokens: 1000,
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM 返回空内容' });
        const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
        return {
          summary: parsed.summary || '',
          sentiment: parsed.sentiment || 'neutral',
          sentimentScore: parsed.sentimentScore || 0,
          highlights: (parsed.highlights || []).slice(0, 4),
          sectorPerformance: (parsed.sectorPerformance || []).slice(0, 5),
          tradingAdvice: parsed.tradingAdvice || '建议观望',
          generatedAt: Date.now(),
        };
      } catch (err) {
        const fallback = buildFallbackBrief(watchedData, '自选列表');
        return fallback;
      }
    }),
});
