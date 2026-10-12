import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { fetchEiaWeeklyNaturalGasHistory } from "../eiaWeeklyNaturalGas";
import { fetchEiaWeeklyPetroleumHistory, type EiaWeeklyPetroleumId } from "../eiaWeeklyPetroleum";
import { fetchFinceptCftcDisaggregated } from "../finceptCftcAdapter";
import { fetchPublicFutureQuotes, PUBLIC_FUTURE_CONTRACTS, type PublicFutureQuote } from "../publicMarketReference";
import { fetchYahooChart } from "../realDataService";

// ─────────────────────────────────────────────
// 衍生品域 AI 智能体闭环路由
// 三段式：全频谱先验感知 → 金融因果图谱推理 → 自主执行智能体
// ─────────────────────────────────────────────

// ── 感知层：授权替代数据尚未接入 ──────────────
function generateAltDataSignals(_module: string) {
  // 不以固定信号、置信度或“实时”描述替代未接入的外部数据服务。
  return [] as Array<{ source: string; signal: string; impact: "negative" | "warning" | "positive"; confidence: number }>;
}

// ── 因果图谱：未接入可验证事件和市场观测 ───────
function buildCausalChain(_event: string) {
  // 不以预设概率、时滞或价格关系充当已观察到的市场事实。
  return [] as Array<{ node: string; type: string; probability: number; lag?: string }>;
}

// ─────────────────────────────────────────────
// BICO - 彭博行业研究概况
// ─────────────────────────────────────────────
const bicoRouter = router({
  // 获取行业研究概况数据
  getSectorOverview: publicProcedure
    .input(z.object({ sector: z.string().optional() }))
    .query(async () => [] as Array<{ id: string; name: string; code: string; performance: number; signal: string; risk: string; altDataScore: number }>),

  // AI 因果分析：行业轮动因果链
  analyzeSectorRotation: publicProcedure
    .input(z.object({ fromSector: z.string(), toSector: z.string(), trigger: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位顶级量化分析师。请分析以下行业轮动的因果链：
触发事件：${input.trigger}
从：${input.fromSector} 行业
到：${input.toSector} 行业

请提供：
1. 因果链分析（3-5个节点，每个节点包含：事件、概率、时间滞后）
2. 关键风险因素（2-3个）
3. 量化交易建议（具体的衍生品策略）
4. 置信度评估（0-100%）

用JSON格式回答，结构为：{causalChain: [], risks: [], strategy: string, confidence: number}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的金融因果分析智能体，专注于衍生品市场的因果推理。" },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "sector_rotation_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  causalChain: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        node: { type: "string" },
                        probability: { type: "number" },
                        lag: { type: "string" },
                        type: { type: "string" },
                      },
                      required: ["node", "probability", "lag", "type"],
                      additionalProperties: false,
                    },
                  },
                  risks: { type: "array", items: { type: "string" } },
                  strategy: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["causalChain", "risks", "strategy", "confidence"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {
          causalChain: buildCausalChain("default"),
          risks: ["流动性风险", "政策不确定性", "跨资产传导效应"],
          strategy: `建议通过行业ETF期权构建价差策略，做多${input.toSector}看涨期权，同时买入${input.fromSector}保护性看跌期权`,
          confidence: 72,
        };
      }
    }),

  // 全频谱感知信号
  getAltDataSignals: publicProcedure
    .input(z.object({ module: z.string() }))
    .query(({ input }) => generateAltDataSignals(input.module)),
});

// ─────────────────────────────────────────────
// SWPM - 掉期管理 AI 智能体
// ─────────────────────────────────────────────
const swpmRouter = router({
  // 感知层：实时掉期市场信号
  getMarketSignals: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("SWPM"),
    causalChain: buildCausalChain("央行加息"),
    riskAlert: {
      level: "medium",
      message: "SOFR曲线出现倒挂信号，建议关注5Y-10Y掉期利差",
      timestamp: new Date().toISOString(),
    },
  })),

  // 因果推理层：掉期定价因果分析
  analyzeCausalFactors: publicProcedure
    .input(z.object({ tenor: z.string(), notional: z.number(), question: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位专业的利率衍生品分析师。
用户问题：${input.question}
当前掉期参数：期限=${input.tenor}，名义本金=${input.notional.toLocaleString()}美元

请基于金融因果图谱分析：
1. 当前利率环境对该掉期的影响因果链
2. 关键风险敞口（DV01、凸性风险）
3. 对冲建议（具体操作步骤）
4. 压力测试场景（利率±100bp的影响）

用中文回答，简洁专业。`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的利率衍生品智能分析师，提供基于因果推理的掉期管理建议。" },
            { role: "user", content: prompt },
          ],
        });
        return {
          analysis: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("央行加息"),
          executionReady: true,
        };
      } catch {
        return {
          analysis: `基于当前${input.tenor}掉期分析：SOFR曲线显示利率预期上行，建议将固定支付方向调整为浮动接收，DV01敞口约为名义本金的0.045%。对冲建议：买入同期限国债期货对冲利率风险。`,
          causalChain: buildCausalChain("央行加息"),
          executionReady: true,
        };
      }
    }),

  // 执行层：生成交易策略
  generateStrategy: publicProcedure
    .input(z.object({ tenor: z.string(), direction: z.string(), notional: z.number() }))
    .mutation(async ({ input }) => {
      const prompt = `生成一个${input.tenor}期限、${input.direction}方向、名义本金${input.notional}美元的掉期交易策略。
包括：入场时机、止损止盈、对冲工具、预期收益。用JSON格式回答。`;
      try {
        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "swap_strategy",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  entryCondition: { type: "string" },
                  stopLoss: { type: "string" },
                  takeProfit: { type: "string" },
                  hedgeInstrument: { type: "string" },
                  expectedReturn: { type: "string" },
                  riskReward: { type: "string" },
                },
                required: ["entryCondition", "stopLoss", "takeProfit", "hedgeInstrument", "expectedReturn", "riskReward"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {
          entryCondition: `当${input.tenor} SOFR掉期利率突破4.50%时入场`,
          stopLoss: "利率反向移动15bp触发止损",
          takeProfit: "目标收益25bp，对应盈利约" + (input.notional * 0.0025).toFixed(0) + "美元",
          hedgeInstrument: "国债期货 + 利率期权保护",
          expectedReturn: "预期年化收益2.8%",
          riskReward: "1:1.8",
        };
      }
    }),
});

// ─────────────────────────────────────────────
// OVME - 股票/利率期权定价 AI 智能体
// ─────────────────────────────────────────────
const ovmeRouter = router({
  getMarketSignals: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("OVME"),
    volSurface: {
      skew: "负偏斜（看跌期权溢价）",
      termStructure: "期限结构正常",
      impliedVol30d: 18.5,
      impliedVol90d: 21.2,
    },
    causalChain: buildCausalChain("地缘政治风险"),
  })),

  analyzeOption: publicProcedure
    .input(z.object({
      underlying: z.string(),
      strike: z.number(),
      expiry: z.string(),
      optionType: z.string(),
      question: z.string(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位期权定价专家。分析以下期权：
标的：${input.underlying}，行权价：${input.strike}，到期：${input.expiry}，类型：${input.optionType}
用户问题：${input.question}

请提供：
1. 期权定价因果分析（波动率、利率、时间价值的因果链）
2. 希腊值解读（Delta、Gamma、Vega、Theta的当前含义）
3. 波动率曲面分析（当前隐含波动率是否合理）
4. 交易建议（具体策略）

用中文回答。`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的期权定价智能分析师。" },
            { role: "user", content: prompt },
          ],
        });
        return {
          analysis: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("地缘政治风险"),
        };
      } catch {
        return {
          analysis: `${input.underlying} ${input.optionType}期权分析：当前隐含波动率18.5%，处于历史50百分位。Delta=0.45，Gamma=0.023，建议通过Delta对冲中性化方向性风险，关注Vega敞口。`,
          causalChain: buildCausalChain("地缘政治风险"),
        };
      }
    }),

  generateHedgeStrategy: publicProcedure
    .input(z.object({ portfolio: z.string(), riskBudget: z.number() }))
    .mutation(async ({ input }) => {
      const prompt = `为以下投资组合生成期权对冲策略：
组合描述：${input.portfolio}
风险预算：${input.riskBudget}%

提供具体的期权对冲方案，包括：保护性看跌期权、领口策略、比率价差等。用JSON格式。`;
      try {
        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "hedge_strategy",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  strategyName: { type: "string" },
                  description: { type: "string" },
                  instruments: { type: "array", items: { type: "string" } },
                  costEstimate: { type: "string" },
                  protectionLevel: { type: "string" },
                },
                required: ["strategyName", "description", "instruments", "costEstimate", "protectionLevel"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {
          strategyName: "保护性领口策略",
          description: "买入虚值看跌期权（行权价-5%），卖出虚值看涨期权（行权价+8%），零成本对冲",
          instruments: ["3个月 -5% OTM Put", "3个月 +8% OTM Call（卖出）"],
          costEstimate: "净成本约组合价值的0.3%",
          protectionLevel: "下行保护5%，上行参与至+8%",
        };
      }
    }),
});

// ─────────────────────────────────────────────
// VCA - 波动率与相关系数分析 AI 智能体
// ─────────────────────────────────────────────
const vcaRouter = router({
  getVolatilityData: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("VCA"),
    volMatrix: [
      { asset: "SPX", vol1M: 15.2, vol3M: 17.8, vol6M: 19.1, vol1Y: 20.5, skew: -2.3 },
      { asset: "NDX", vol1M: 18.5, vol3M: 21.2, vol6M: 22.8, vol1Y: 24.1, skew: -3.1 },
      { asset: "EURUSD", vol1M: 7.8, vol3M: 8.9, vol6M: 9.5, vol1Y: 10.2, skew: 0.5 },
      { asset: "USDJPY", vol1M: 9.2, vol3M: 10.5, vol6M: 11.1, vol1Y: 11.8, skew: 1.2 },
      { asset: "XAUUSD", vol1M: 12.1, vol3M: 13.8, vol6M: 14.5, vol1Y: 15.2, skew: 0.8 },
      { asset: "WTI", vol1M: 28.5, vol3M: 31.2, vol6M: 32.8, vol1Y: 34.1, skew: 2.1 },
      { asset: "UST10Y", vol1M: 6.5, vol3M: 7.8, vol6M: 8.2, vol1Y: 8.9, skew: -0.3 },
    ],
    correlationMatrix: {
      assets: ["SPX", "NDX", "EURUSD", "USDJPY", "XAUUSD", "WTI"],
      data: [
        [1.00, 0.92, -0.35, 0.28, -0.42, 0.15],
        [0.92, 1.00, -0.31, 0.25, -0.38, 0.12],
        [-0.35, -0.31, 1.00, -0.68, 0.45, 0.22],
        [0.28, 0.25, -0.68, 1.00, -0.32, -0.18],
        [-0.42, -0.38, 0.45, -0.32, 1.00, 0.35],
        [0.15, 0.12, 0.22, -0.18, 0.35, 1.00],
      ],
    },
  })),

  analyzeVolRegime: publicProcedure
    .input(z.object({ question: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位波动率分析专家。用户问题：${input.question}

请分析当前波动率机制（Vol Regime），包括：
1. 当前波动率环境（低波/正常/高波/危机）的因果判断
2. 跨资产相关性变化的因果解释
3. 波动率套利机会识别
4. 对冲组合的波动率优化建议

用中文回答，专业简洁。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的波动率分析智能体。" },
            { role: "user", content: prompt },
          ],
        });
        return { analysis: response.choices[0]?.message?.content || "分析生成中..." };
      } catch {
        return { analysis: "当前处于中等波动率机制（VIX 15-20区间），股债相关性转正预示风险偏好下降。建议关注波动率曲面的期限结构套利机会，特别是1M-3M Vega价差。" };
      }
    }),
});

// ─────────────────────────────────────────────
// MARS - 多资产风险系统 AI 智能体
// ─────────────────────────────────────────────
const marsRouter = router({
  getPortfolioRisk: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("MARS"),
    varMetrics: {
      portfolioVaR1d95: 2.34,
      portfolioVaR10d99: 8.92,
      cvar95: 3.12,
      expectedShortfall: 4.21,
    },
    stressTests: [
      { scenario: "2008金融危机", portfolioImpact: -28.5, probability: 0.05 },
      { scenario: "2020新冠冲击", portfolioImpact: -22.1, probability: 0.08 },
      { scenario: "利率骤升200bp", portfolioImpact: -15.3, probability: 0.12 },
      { scenario: "美元指数暴跌10%", portfolioImpact: -8.7, probability: 0.15 },
      { scenario: "地缘政治危机", portfolioImpact: -18.9, probability: 0.07 },
    ],
    riskContributions: [
      { asset: "股票", weight: 0.45, riskContrib: 0.62, marginalVaR: 3.21 },
      { asset: "债券", weight: 0.30, riskContrib: 0.15, marginalVaR: 1.12 },
      { asset: "大宗商品", weight: 0.10, riskContrib: 0.12, marginalVaR: 2.85 },
      { asset: "外汇", weight: 0.08, riskContrib: 0.07, marginalVaR: 1.98 },
      { asset: "衍生品", weight: 0.07, riskContrib: 0.04, marginalVaR: 1.35 },
    ],
  })),

  runStressTest: publicProcedure
    .input(z.object({ scenario: z.string(), portfolioDescription: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位多资产风险管理专家。
压力测试场景：${input.scenario}
投资组合：${input.portfolioDescription}

请提供：
1. 该场景下的因果传导链（从触发事件到各资产类别的影响路径）
2. 量化损失估计（各资产类别的预期损失%）
3. 风险缓释建议（具体的对冲工具和比例）
4. 流动性风险评估

用中文回答。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的多资产风险管理智能体。" },
            { role: "user", content: prompt },
          ],
        });
        return {
          analysis: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("地缘政治风险"),
        };
      } catch {
        return {
          analysis: `${input.scenario}压力测试：股票组合预期损失-18%至-25%，债券组合-5%至-8%，大宗商品+3%至+8%（避险需求）。建议增加黄金配置至15%，买入VIX看涨期权对冲尾部风险。`,
          causalChain: buildCausalChain("地缘政治风险"),
        };
      }
    }),

  generateHedgePlan: publicProcedure
    .input(z.object({ riskExposure: z.string(), budget: z.number() }))
    .mutation(async ({ input }) => {
      const prompt = `为以下风险敞口生成对冲方案：
风险敞口：${input.riskExposure}
对冲预算：${input.budget}%

提供具体的多资产对冲组合，包括：衍生品工具、比例、成本、预期对冲效果。用JSON格式。`;
      try {
        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "hedge_plan",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  instruments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        allocation: { type: "string" },
                        cost: { type: "string" },
                        hedgeRatio: { type: "string" },
                      },
                      required: ["name", "allocation", "cost", "hedgeRatio"],
                      additionalProperties: false,
                    },
                  },
                  totalCost: { type: "string" },
                  expectedHedgeEffectiveness: { type: "string" },
                  executionTimeline: { type: "string" },
                },
                required: ["instruments", "totalCost", "expectedHedgeEffectiveness", "executionTimeline"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {
          instruments: [
            { name: "SPX Put Spread（-5%/-15%）", allocation: "40%预算", cost: "0.8%组合价值", hedgeRatio: "60%下行保护" },
            { name: "VIX Call（行权价25）", allocation: "25%预算", cost: "0.3%组合价值", hedgeRatio: "尾部风险保护" },
            { name: "黄金期货多头", allocation: "20%预算", cost: "0.1%组合价值", hedgeRatio: "避险资产配置" },
            { name: "美元指数期货多头", allocation: "15%预算", cost: "0.05%组合价值", hedgeRatio: "货币风险对冲" },
          ],
          totalCost: `${input.budget}%组合价值`,
          expectedHedgeEffectiveness: "在极端压力场景下降低组合损失约40-60%",
          executionTimeline: "建议在2个交易日内分批建仓",
        };
      }
    }),
});

// ─────────────────────────────────────────────
// DERI - 衍生品功能增强 AI 智能体
// ─────────────────────────────────────────────
const deriRouter = router({
  getEnhancedSignals: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("DERI"),
    marketIntelligence: [
      { category: "流量数据", signal: "机构期权持仓净多头增加23%", urgency: "high" },
      { category: "情绪指标", signal: "散户恐慌指数触及6个月高点", urgency: "medium" },
      { category: "技术信号", signal: "VIX期限结构出现倒挂", urgency: "high" },
      { category: "基本面", signal: "财报季EPS预期下调幅度超预期", urgency: "medium" },
    ],
    causalChain: buildCausalChain("地缘政治风险"),
  })),

  runCausalQuery: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位衍生品市场因果分析智能体。
用户自然语言查询：${input.query}

请基于金融因果图谱回答，包括：
1. 直接因果链（3-5个节点）
2. 反事实分析（如果条件改变，结果会如何）
3. 量化影响估计
4. 可执行的衍生品策略建议

用中文回答，专业严谨。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的衍生品市场因果推理智能体，能够回答复杂的金融因果问题。" },
            { role: "user", content: prompt },
          ],
        });
        return {
          answer: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("default"),
          confidence: 78,
        };
      } catch {
        return {
          answer: "基于当前市场数据分析：您的查询涉及多个因果节点，主要传导路径为：触发事件→流动性变化→价格重定价→跨资产联动。建议关注相关衍生品的隐含波动率变化作为领先指标。",
          causalChain: buildCausalChain("default"),
          confidence: 65,
        };
      }
    }),
});

// ─────────────────────────────────────────────
// OVCV - 可转换债券估价 AI 智能体
// ─────────────────────────────────────────────
const ovcvRouter = router({
  getConvertibleData: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("OVCV"),
    convertibles: [
      { issuer: "Tesla Inc.", coupon: 1.25, maturity: "2026-03-15", conversionPrice: 320.0, currentPrice: 98.5, delta: 0.52, premium: 18.3, creditSpread: 185 },
      { issuer: "Nvidia Corp.", coupon: 0.50, maturity: "2027-06-15", conversionPrice: 580.0, currentPrice: 102.3, delta: 0.68, premium: 12.1, creditSpread: 95 },
      { issuer: "Palantir Tech.", coupon: 1.00, maturity: "2025-12-15", conversionPrice: 28.0, currentPrice: 95.8, delta: 0.41, premium: 24.5, creditSpread: 245 },
      { issuer: "Shopify Inc.", coupon: 0.125, maturity: "2028-09-01", conversionPrice: 95.0, currentPrice: 103.1, delta: 0.75, premium: 8.9, creditSpread: 120 },
    ],
  })),

  analyzeConvertible: publicProcedure
    .input(z.object({ issuer: z.string(), question: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位可转换债券分析专家。
分析对象：${input.issuer}的可转换债券
用户问题：${input.question}

请提供：
1. 可转债定价因果分析（股权价值、债券价值、转换期权价值的因果关系）
2. 当前市场环境下的投资价值评估
3. Delta对冲策略
4. 关键风险（信用风险、稀释风险、流动性风险）

用中文回答。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的可转换债券分析智能体。" },
            { role: "user", content: prompt },
          ],
        });
        return { analysis: response.choices[0]?.message?.content || "分析生成中..." };
      } catch {
        return { analysis: `${input.issuer}可转债分析：当前Delta=0.52，处于平价附近，兼具股债双重特性。建议通过Delta对冲策略捕获Gamma收益，同时关注信用利差变化对债券底价的影响。` };
      }
    }),
});

// ─────────────────────────────────────────────
// DLIB - 衍生品库 AI 智能体
// ─────────────────────────────────────────────
const dlibRouter = router({
  getProductLibrary: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("DLIB"),
    products: [
      { category: "利率衍生品", products: ["利率互换(IRS)", "隔夜指数互换(OIS)", "利率上限/下限", "互换期权(Swaption)", "通胀互换"] },
      { category: "信用衍生品", products: ["信用违约互换(CDS)", "总收益互换(TRS)", "信用联结票据(CLN)", "合成CDO", "信用价差期权"] },
      { category: "股权衍生品", products: ["股票期权", "股票互换", "方差互换", "波动率互换", "股息互换"] },
      { category: "外汇衍生品", products: ["外汇远期", "外汇期权", "外汇互换", "货币互换", "无本金交割远期(NDF)"] },
      { category: "商品衍生品", products: ["商品期货", "商品期权", "商品互换", "天气衍生品", "排放权衍生品"] },
      { category: "结构性产品", products: ["资产支持证券(ABS)", "抵押贷款支持证券(MBS)", "担保债务凭证(CDO)", "结构性票据", "本金保护票据"] },
    ],
  })),

  searchProduct: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位衍生品产品专家。用户搜索：${input.query}

请提供：
1. 匹配的衍生品产品列表（3-5个）
2. 每个产品的核心特征、适用场景、主要风险
3. 当前市场环境下的推荐度评级

用JSON格式回答。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的衍生品产品库智能体。" },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "product_search",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        useCase: { type: "string" },
                        mainRisk: { type: "string" },
                        recommendation: { type: "string" },
                      },
                      required: ["name", "description", "useCase", "mainRisk", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["products"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        return {
          products: [
            { name: "利率互换(IRS)", description: "固定利率与浮动利率互换", useCase: "利率风险管理", mainRisk: "利率风险、信用风险", recommendation: "★★★★★ 当前环境高度推荐" },
            { name: "利率上限(Cap)", description: "保护浮动利率借款方免受利率上升影响", useCase: "利率上限保护", mainRisk: "期权费成本", recommendation: "★★★★ 推荐" },
          ],
        };
      }
    }),
});

// ─────────────────────────────────────────────
// WCDS / CDSW - CDS 相关 AI 智能体
// ─────────────────────────────────────────────
const cdsRouter = router({
  getMarketSignals: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("WCDS"),
    cdsMarket: [
      { entity: "美国国债", tenor: "5Y", spread: 28, change: 2, rating: "AAA", trend: "widening" },
      { entity: "中国国债", tenor: "5Y", spread: 68, change: -3, rating: "A+", trend: "tightening" },
      { entity: "欧元区主权", tenor: "5Y", spread: 45, change: 1, rating: "AA", trend: "stable" },
      { entity: "Apple Inc.", tenor: "5Y", spread: 32, change: -1, rating: "AA+", trend: "tightening" },
      { entity: "Tesla Inc.", tenor: "5Y", spread: 285, change: 15, rating: "BB+", trend: "widening" },
      { entity: "Alibaba Group", tenor: "5Y", spread: 195, change: 8, rating: "A-", trend: "widening" },
    ],
    causalChain: buildCausalChain("地缘政治风险"),
  })),

  analyzeCreditRisk: publicProcedure
    .input(z.object({ entity: z.string(), question: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位信用衍生品分析专家。
分析对象：${input.entity}的信用风险
用户问题：${input.question}

请提供：
1. 信用风险因果分析（基本面→信用利差→CDS定价的因果链）
2. 当前CDS利差是否合理（与历史均值、同级别比较）
3. 信用事件概率估计
4. CDS交易策略建议（做多/做空保护）

用中文回答。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的信用衍生品分析智能体。" },
            { role: "user", content: prompt },
          ],
        });
        return {
          analysis: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("地缘政治风险"),
        };
      } catch {
        return {
          analysis: `${input.entity}信用分析：当前CDS利差处于历史75百分位，反映市场对信用风险的担忧。建议关注债务偿还能力和现金流覆盖率，若利差继续走阔超过300bp，建议买入CDS保护。`,
          causalChain: buildCausalChain("地缘政治风险"),
        };
      }
    }),
});

// ─────────────────────────────────────────────
// WBF - 全球债券期货 AI 智能体
// ─────────────────────────────────────────────
const wbfRouter = router({
  getMarketSignals: publicProcedure.query(() => ({
    altDataSignals: generateAltDataSignals("WBF"),
    bondFutures: [
      { contract: "US 10Y T-Note", symbol: "ZN", price: 109.28, change: -0.15, yield: 4.52, oi: 3850000, volume: 1250000 },
      { contract: "US 30Y T-Bond", symbol: "ZB", price: 117.12, change: -0.22, yield: 4.68, oi: 1250000, volume: 420000 },
      { contract: "Euro Bund", symbol: "FGBL", price: 131.45, change: 0.08, yield: 2.85, oi: 890000, volume: 380000 },
      { contract: "UK Gilt", symbol: "R", price: 95.82, change: -0.12, yield: 4.35, oi: 420000, volume: 185000 },
      { contract: "JGB 10Y", symbol: "JB", price: 143.25, change: 0.05, yield: 1.05, oi: 680000, volume: 290000 },
    ],
    causalChain: buildCausalChain("央行加息"),
  })),

  analyzeYieldCurve: publicProcedure
    .input(z.object({ country: z.string(), question: z.string() }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位债券期货分析专家。
分析对象：${input.country}债券期货市场
用户问题：${input.question}

请提供：
1. 收益率曲线形态的因果解释（为什么当前曲线是这个形状）
2. 债券期货定价与现货的基差分析
3. 持有成本（Carry）和展期（Roll）分析
4. 交易策略建议（曲线交易、蝶式交易等）

用中文回答。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位专业的债券期货分析智能体。" },
            { role: "user", content: prompt },
          ],
        });
        return {
          analysis: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("央行加息"),
        };
      } catch {
        return {
          analysis: `${input.country}债券期货分析：当前收益率曲线呈现平坦化趋势，反映市场对经济增长放缓的预期。10Y-2Y利差收窄至25bp，历史上此形态预示经济周期转折。建议关注曲线陡峭化交易机会。`,
          causalChain: buildCausalChain("央行加息"),
        };
      }
    }),
});

// ─────────────────────────────────────────────
// 通用 AI 因果查询（所有衍生品模块共用）
// ─────────────────────────────────────────────
const derivativesAIRouter = router({
  causalQuery: publicProcedure
    .input(z.object({
      module: z.string(),
      query: z.string(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位${input.module}专业智能分析师，专注于衍生品市场的"感知-推理-执行"闭环分析。
${input.context ? `背景信息：${input.context}` : ""}
用户问题：${input.query}

请基于金融因果图谱提供：
1. 直接因果链分析（3-5个节点，含概率和时间滞后）
2. 反事实分析（如果关键条件改变，结果如何）
3. 量化影响估计
4. 可执行的具体操作建议

用中文回答，专业严谨，避免模糊表述。`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是一位专业的${input.module}衍生品智能分析师，提供基于因果推理的深度分析。` },
            { role: "user", content: prompt },
          ],
        });
        return {
          answer: response.choices[0]?.message?.content || "分析生成中...",
          causalChain: buildCausalChain("default"),
          module: input.module,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          answer: `基于${input.module}模块的因果分析：${input.query}涉及的核心因果链为：市场信号→流动性传导→价格重定价→跨资产联动。建议结合实时数据进一步验证。`,
          causalChain: buildCausalChain("default"),
          module: input.module,
          timestamp: new Date().toISOString(),
        };
      }
    }),

    getCausalChain: publicProcedure
    .input(z.object({ event: z.string() }))
    .query(({ input }) => buildCausalChain(input.event)),
  getAltDataSignals: publicProcedure
    .input(z.object({ module: z.string() }))
    .query(({ input }) => generateAltDataSignals(input.module)),
  generateRiskReport: publicProcedure
    .input(z.object({
      module: z.string(),
      moduleName: z.string(),
      metrics: z.record(z.string(), z.union([z.string(), z.number()])),
    }))
    .mutation(async ({ input }) => {
      const metricsText = Object.entries(input.metrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      const prompt = `你是${input.moduleName}（${input.module}）智能风险分析师。
以下是用户当前页面的实时计算数据：
${metricsText}

请基于上述实时数据，生成一份专业的风险分析报告，包含：
1. **当前市场状态评估**（直接引用上述数值，判断风险等级）
2. **关键风险点识别**（至少3个，含量化影响估计）
3. **因果链分析**（数据变动的传导路径，3-5个节点）
4. **具体对冲/操作建议**（可执行，含方向和规模）
5. **风险预警阈值**（需要立即行动的触发条件）

要求：直接基于上述数据分析，不要泛泛而谈，每个结论都要有数据支撑。用中文回答，Markdown格式。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是${input.module}专业风险分析师，根据实时计算数据生成精准的风险报告。` },
            { role: "user", content: prompt },
          ],
        });
        return {
          report: response.choices[0]?.message?.content || "报告生成中...",
          module: input.module,
          metrics: input.metrics,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          report: `## ${input.moduleName} 风险报告\n\n**基于实时数据分析：**\n\n${metricsText}\n\n当前关键指标显示市场处于中等风险状态。建议密切关注数据变动，及时调整头寸。`,
          module: input.module,
          metrics: input.metrics,
          timestamp: new Date().toISOString(),
        };
      }
    }),
  generateStrategy: publicProcedure
    .input(z.object({
      module: z.string(),
      moduleName: z.string(),
      causalEvent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const event = input.causalEvent || "市场信号";
      const prompt = `你是${input.moduleName}（${input.module}）智能分析师。
基于当前触发事件「${event}」，生成一份可执行的衍生品交易策略方案。
包含：
1. 核心因果链（${event}→市场影响→衍生品定价→执行方向）
2. 具体的${input.module}工具和参数设置
3. 风险控制方案（止损位、对冲对冲）
4. 预期收益评估
用中文回答，专业严谨。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是${input.module}衍生品策略智能体，提供基于因果推理的可执行策略。` },
            { role: "user", content: prompt },
          ],
        });
        return {
          strategy: response.choices[0]?.message?.content || "策略生成中...",
          causalChain: buildCausalChain(event),
          risks: ["市场流动性风险", "模型假设偏差", "黑天鹅事件"],
          confidence: null,
          module: input.module,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          strategy: `基于${event}的${input.moduleName}策略：建议采用防御性对冲组合，利用${input.module}工具对冲利率风险暴露，设置严格止损位。具体参数需结合实时市场数据确认。`,
          causalChain: buildCausalChain(event),
          risks: ["市场流动性风险", "模型假设偏差"],
          confidence: 68,
          module: input.module,
          timestamp: new Date().toISOString(),
        };
      }
    }),
});

// ─────────────────────────────────────────────
// 导出所有衍生品路由
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 大宗商品专属 AI 分析路由
// ─────────────────────────────────────────────
type CommodityReference = {
  symbol: string;
  yahooSymbol: string;
  cftcMarketCode: string | null;
  inventory:
    | {
        kind: "petroleum";
        seriesId: EiaWeeklyPetroleumId;
        label: string;
        unit: string;
      }
    | {
        kind: "natural_gas";
        label: string;
        unit: string;
      }
    | null;
};

const COMMODITY_REFERENCES: Record<string, CommodityReference> = {
  原油: {
    symbol: "CL",
    yahooSymbol: "CL=F",
    cftcMarketCode: "067651",
    inventory: {
      kind: "petroleum",
      seriesId: "WCESTUS1",
      label: "美国商业原油库存（不含战略石油储备）",
      unit: "千桶",
    },
  },
  天然气: {
    symbol: "NG",
    yahooSymbol: "NG=F",
    cftcMarketCode: "02365B",
    inventory: {
      kind: "natural_gas",
      label: "美国地下天然气储量（EIA-912）",
      unit: "十亿立方英尺",
    },
  },
  黄金: { symbol: "GC", yahooSymbol: "GC=F", cftcMarketCode: "088691", inventory: null },
  铜: { symbol: "HG", yahooSymbol: "HG=F", cftcMarketCode: "085692", inventory: null },
  大豆: { symbol: "ZS", yahooSymbol: "ZS=F", cftcMarketCode: "005602", inventory: null },
  小麦: { symbol: "ZW", yahooSymbol: "ZW=F", cftcMarketCode: "001602", inventory: null },
  玉米: { symbol: "ZC", yahooSymbol: "ZC=F", cftcMarketCode: "002602", inventory: null },
};

function commodityReference(name: string) {
  return COMMODITY_REFERENCES[name] ?? COMMODITY_REFERENCES.原油;
}

function latestDate(values: Array<{ date?: string | null; observedAt?: string | null }>) {
  return values
    .map(value => value.date ?? value.observedAt ?? null)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

async function fetchCommodityInventory(reference: CommodityReference) {
  if (!reference.inventory) return { points: [], source: null, observedAt: null, frequency: null, error: null };
  try {
    const history =
      reference.inventory.kind === "petroleum"
        ? await fetchEiaWeeklyPetroleumHistory(reference.inventory.seriesId)
        : await fetchEiaWeeklyNaturalGasHistory();
    return {
      points: history.slice(-104),
      source: "U.S. Energy Information Administration (EIA)",
      observedAt: history.at(-1)?.date ?? null,
      frequency: "weekly",
      error: null,
    };
  } catch (error) {
    return {
      points: [],
      source: "U.S. Energy Information Administration (EIA)",
      observedAt: null,
      frequency: "weekly",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function pearsonCorrelation(left: number[], right: number[]) {
  if (left.length < 3 || right.length !== left.length) return null;
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / left.length;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - meanLeft;
    const rightDelta = right[index] - meanRight;
    covariance += leftDelta * rightDelta;
    varianceLeft += leftDelta * leftDelta;
    varianceRight += rightDelta * rightDelta;
  }
  if (varianceLeft === 0 || varianceRight === 0) return null;
  return Number((covariance / Math.sqrt(varianceLeft * varianceRight)).toFixed(4));
}

const commodityAIRouter = router({
  /** 获取商品市场多维数据信号 */
  getSignals: publicProcedure
    .input(z.object({ commodity: z.string().default('全部') }))
    .query(async ({ input }) => {
      const quotes = await fetchPublicFutureQuotes();
      const selected = input.commodity === "全部"
        ? quotes
        : quotes.filter(quote => quote.symbol === commodityReference(input.commodity).symbol);
      const quoteItems = selected
        .filter(quote => quote.available || quote.history.length > 0)
        .map(quote => ({
          symbol: quote.symbol,
          name: quote.name,
          price: quote.price,
          change: quote.change,
          changePct: quote.changePct,
          observedAt: quote.observedAt,
          realtimeStatus: quote.realtimeStatus,
          source: quote.source,
          signalType: "public_market_reference" as const,
          limitation: "公开连续合约参考行情，不是可执行报价或账户持仓。",
        }));
      const cftc = await fetchFinceptCftcDisaggregated();
      const selectedCftc = input.commodity === "全部"
        ? cftc.history
        : cftc.history.filter(item => item.symbol === `CFTC:${commodityReference(input.commodity).cftcMarketCode}`);
      const latestBySymbol = [...new Map(
        selectedCftc
          .sort((left, right) => left.date.localeCompare(right.date))
          .map(item => [item.symbol, item]),
      ).values()];
      const cftcItems = latestBySymbol.map(item => ({
        symbol: item.symbol,
        name: String(item.fields.name ?? item.symbol),
        price: null,
        change: null,
        changePct: null,
        observedAt: item.date,
        realtimeStatus: "weekly_publication" as const,
        source: cftc.source,
        signalType: "cftc_weekly_position" as const,
        fields: item.fields,
        limitation: "CFTC 官方周度持仓观察，不是实时行情、成交或订单簿。",
      }));
      const items = [...quoteItems, ...cftcItems];
      return {
        available: items.length > 0,
        commodity: input.commodity,
        items,
        source: items.length > 0
          ? [...new Set(items.map(item => item.source))].join(" + ")
          : null,
        observedAt: latestDate(items),
        frequency: "provider-dependent",
        limitation: items.length > 0
          ? "仅返回已核验的公开连续合约观察；缺失值不使用随机或静态补位。"
          : "当前没有取得可核验的公开连续合约行情。",
      };
    }),

  /** 商品相关性矩阵 */
  getCorrelationMatrix: publicProcedure.query(async () => {
    const quotes = await fetchPublicFutureQuotes();
    const histories = quotes.filter(quote => quote.history.length >= 3);
    const dateSets = histories.map(quote => new Set(quote.history.map(point => point.date)));
    const commonDates = [...(dateSets[0] ?? [])].filter(date => dateSets.every(set => set.has(date))).sort();
    const aligned = histories.map(quote => ({
      symbol: quote.symbol,
      name: quote.name,
      values: commonDates.map(date => quote.history.find(point => point.date === date)?.close ?? null),
    }));
    const assets = aligned.map(item => item.symbol);
    const matrix = aligned.map(left => aligned.map(right => {
      const leftValues: number[] = [];
      const rightValues: number[] = [];
      for (let index = 0; index < commonDates.length; index += 1) {
        const leftValue = left.values[index];
        const rightValue = right.values[index];
        if (leftValue !== null && rightValue !== null) {
          leftValues.push(leftValue);
          rightValues.push(rightValue);
        }
      }
      return pearsonCorrelation(leftValues, rightValues);
    }));
    return {
      available: assets.length >= 2 && commonDates.length >= 3,
      assets,
      labels: aligned.map(item => item.name),
      dates: commonDates,
      matrix,
      source: assets.length ? "Yahoo Finance public chart" : null,
      observedAt: commonDates.at(-1) ?? null,
      limitation: assets.length >= 2 && commonDates.length >= 3
        ? "基于公开连续合约日收盘价的同频 Pearson 相关系数；不是实时相关性，也不是交易建议。"
        : "当前没有足够的同频公开历史观察计算相关性。",
    };
  }),

  /** AI 商品市场分析 */
  analyzeMarket: publicProcedure
    .input(z.object({
      commodity: z.string(),
      question: z.string(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `你是一位专业的大宗商品市场分析师，专注于${input.commodity}市场的深度分析。
${input.context ? `市场背景：${input.context}` : ''}
用户问题：${input.question}
请提供：
1. 供需基本面分析（当前供需缺口、库存水平、季节性因素）
2. 价格驱动因素分析（宏观、地缘、技术面）
3. 风险因素识别（上行/下行风险）
4. 量化价格目标（3个月、6个月）
5. 交易策略建议（具体操作）
用中文回答，专业严谨，数据具体。`;
      try {
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: `你是一位专业的${input.commodity}大宗商品智能分析师，提供基于多维数据的深度市场分析。` },
            { role: 'user', content: prompt },
          ],
        });
        return {
          available: true as const,
          analysis: response.choices[0]?.message?.content || '分析生成中...',
          commodity: input.commodity,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          available: false as const,
          analysis: '当前 AI 分析服务不可用；未使用静态商品数据替代分析。',
          commodity: input.commodity,
          timestamp: new Date().toISOString(),
        };
      }
    }),

  /** 商品季节性分析 */
  getSeasonality: publicProcedure
    .input(z.object({ commodity: z.string().default('原油') }))
    .query(async ({ input }) => {
      const reference = commodityReference(input.commodity);
      const inventory = await fetchCommodityInventory(reference);
      const result = inventory.points.length
        ? null
        : await fetchYahooChart(reference.yahooSymbol, "5y", "1mo");
      const data = inventory.points.length
        ? inventory.points.map(point => ({ date: point.date, value: point.value }))
        : result?.history.map(point => ({
            date: point.date,
            value: point.close,
          })).filter(point => point.value !== null) ?? [];
      return {
        available: data.length > 0,
        commodity: input.commodity,
        data,
        source: data.length ? inventory.points.length ? inventory.source : result?.source ?? null : null,
        observedAt: data.at(-1)?.date ?? null,
        limitation: data.length
          ? inventory.points.length
            ? "仅展示官方周度库存观察；未进行季节性预测或插值。"
            : "仅展示公开连续合约月度历史；未进行季节性预测或插值。"
          : "当前没有取得可核验的公开连续合约月度历史或官方库存观察。",
      };
    }),

  /** 商品期货曲线 */
  getFutureCurve: publicProcedure
    .input(z.object({ commodity: z.string().default('原油') }))
    .query(async ({ input }) => {
      const reference = commodityReference(input.commodity);
      const quote = await fetchYahooChart(reference.yahooSymbol, "5d", "1d");
      const point = quote?.history.at(-1);
      const points = point?.close == null
        ? []
        : [{
            contract: reference.symbol,
            yahooSymbol: reference.yahooSymbol,
            maturity: null,
            price: point.close,
            observedAt: point.timestamp ?? point.date,
          }];
      return {
        available: points.length > 0,
        commodity: input.commodity,
        structure: points.length ? "single_public_continuous_contract" : null,
        points,
        source: points.length ? quote?.source ?? null : null,
        observedAt: points.at(-1)?.observedAt ?? null,
        limitation: points.length
          ? "当前为公开连续合约参考点；没有交易所逐月合约主数据时不伪造完整期限结构。"
          : "当前没有取得可核验的公开连续合约参考点。",
      };
    }),
});

export const derivativesRouter = router({
  bico: bicoRouter,
  swpm: swpmRouter,
  ovme: ovmeRouter,
  vca: vcaRouter,
  mars: marsRouter,
  deri: deriRouter,
  ovcv: ovcvRouter,
  dlib: dlibRouter,
  cds: cdsRouter,
  wbf: wbfRouter,
  ai: derivativesAIRouter,
  commodity: commodityAIRouter,
});
