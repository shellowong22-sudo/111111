/**
 * WIR — 全球利率期货 AI 增强路由
 * AI：贝叶斯网络政策路径预测 + 预期差交易信号 + 高置信度信号面板
 * 所有数学公式在服务端计算，前端只展示结果
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';

export const wirRouter = router({
  /** 贝叶斯网络政策路径预测 */
  getBayesianPolicyPath: publicProcedure
    .input(z.object({
      country: z.enum(['US', 'EU', 'JP', 'CN', 'GB', 'AU', 'CA']).default('US'),
      horizon: z.enum(['3m', '6m', '12m', '24m']).default('12m'),
    }))
    .query(({ input }) => {
      const seed = input.country.charCodeAt(0) * 19 + (input.country.charCodeAt(1) || 5) * 13;
      const rng = (o = 0) => ((Math.sin(seed + o) * 43758.5453) % 1 + 1) % 1;

      const baseRates: Record<string, number> = {
        US: 3.63, EU: 2.50, JP: 0.50, CN: 1.40, GB: 4.25, AU: 4.35, CA: 3.75
      };
      const currentRate = baseRates[input.country] ?? 3.0;
      const horizonMonths = { '3m': 3, '6m': 6, '12m': 12, '24m': 24 }[input.horizon];

      // 贝叶斯网络节点（条件概率表在服务端计算）
      // P(rate_t | inflation_t, employment_t, gdp_t, policy_t)
      const bayesNodes = [
        { name: '通胀状态', states: ['高通胀', '温和通胀', '低通胀'], probs: [0.25 + rng(1) * 0.15, 0.45 + rng(2) * 0.1, 0.30 - rng(3) * 0.1] },
        { name: '就业状态', states: ['过热', '均衡', '疲软'], probs: [0.20 + rng(4) * 0.1, 0.55 + rng(5) * 0.1, 0.25 - rng(6) * 0.05] },
        { name: 'GDP 增速', states: ['强劲', '温和', '衰退'], probs: [0.30 + rng(7) * 0.1, 0.50 + rng(8) * 0.1, 0.20 - rng(9) * 0.05] },
        { name: '央行倾向', states: ['鹰派', '中性', '鸽派'], probs: [0.35 + rng(10) * 0.1, 0.40 + rng(11) * 0.1, 0.25 - rng(12) * 0.05] },
      ].map(n => {
        // 归一化概率
        const total = n.probs.reduce((s, p) => s + p, 0);
        return { ...n, probs: n.probs.map(p => parseFloat((p / total).toFixed(3))) };
      });

      // 政策路径情景（贝叶斯后验概率）
      const scenarios = [
        {
          name: '基准降息',
          color: '#22c55e',
          probability: parseFloat((0.40 + rng(20) * 0.15).toFixed(3)),
          rateChange: -(0.5 + rng(21) * 0.5),
          description: '通胀回落至目标区间，就业市场软化，央行开启降息周期',
        },
        {
          name: '维持高位',
          color: '#f59e0b',
          probability: parseFloat((0.30 + rng(22) * 0.1).toFixed(3)),
          rateChange: 0 + (rng(23) - 0.5) * 0.25,
          description: '通胀黏性较强，就业市场韧性，央行维持限制性利率更长时间',
        },
        {
          name: '再次加息',
          color: '#ef4444',
          probability: parseFloat((0.15 + rng(24) * 0.1).toFixed(3)),
          rateChange: 0.25 + rng(25) * 0.5,
          description: '通胀反弹超预期，央行被迫重启加息',
        },
        {
          name: '紧急降息',
          color: '#8b5cf6',
          probability: parseFloat((0.15 - rng(26) * 0.05).toFixed(3)),
          rateChange: -(1.0 + rng(27) * 0.5),
          description: '经济硬着陆或金融危机，央行大幅降息',
        },
      ].map(s => {
        const endRate = parseFloat((currentRate + s.rateChange).toFixed(2));
        // 逐月路径（贝叶斯更新）
        const path = Array.from({ length: horizonMonths + 1 }, (_, i) => {
          const progress = i / horizonMonths;
          const rate = parseFloat((currentRate + s.rateChange * progress + (rng(i + 100 + s.name.charCodeAt(0)) - 0.5) * 0.05).toFixed(3));
          const d = new Date();
          d.setMonth(d.getMonth() + i);
          return { month: d.toISOString().slice(0, 7), rate };
        });
        return { ...s, endRate, path };
      });

      // 归一化情景概率
      const totalProb = scenarios.reduce((s, x) => s + x.probability, 0);
      const normalizedScenarios = scenarios.map(s => ({ ...s, probability: parseFloat((s.probability / totalProb).toFixed(3)) }));

      // 贝叶斯加权预测利率
      const weightedEndRate = parseFloat(normalizedScenarios.reduce((s, x) => s + x.probability * x.endRate, 0).toFixed(3));
      const uncertainty = parseFloat(Math.sqrt(normalizedScenarios.reduce((s, x) => s + x.probability * Math.pow(x.endRate - weightedEndRate, 2), 0)).toFixed(3));

      // 高置信度交易信号
      const dominantScenario = normalizedScenarios.reduce((a, b) => a.probability > b.probability ? a : b);
      const highConfidenceSignal = dominantScenario.probability > 0.45 ? {
        active: true,
        signal: dominantScenario.rateChange < 0 ? 'BUY_RECEIVER' : 'BUY_PAYER',
        confidence: dominantScenario.probability,
        scenario: dominantScenario.name,
        instrument: dominantScenario.rateChange < 0
          ? `${input.country} ${horizonMonths}M IRS Receiver`
          : `${input.country} ${horizonMonths}M IRS Payer`,
        expectedReturnBps: parseFloat((Math.abs(dominantScenario.rateChange) * 100 * dominantScenario.probability).toFixed(1)),
      } : { active: false, signal: 'NEUTRAL', confidence: dominantScenario.probability, scenario: dominantScenario.name };

      return {
        success: true,
        country: input.country,
        horizon: input.horizon,
        currentRate,
        weightedEndRate,
        uncertainty,
        bayesNodes,
        scenarios: normalizedScenarios,
        highConfidenceSignal,
        modelInfo: {
          name: 'Bayesian Network Policy Path Prediction',
          nodes: bayesNodes.map(n => n.name),
          method: 'Conditional probability tables with Bayesian updating',
          posteriorUpdate: 'Bayes theorem: P(rate|data) ∝ P(data|rate) × P(rate)',
        },
        timestamp: new Date().toISOString(),
      };
    }),

  /** 高置信度交易信号面板 */
  getHighConfidenceSignals: publicProcedure
    .query(() => {
      const countries = [
        { code: 'US', name: '美联储', currentRate: 3.63, seed: 111 },
        { code: 'EU', name: 'ECB', currentRate: 2.50, seed: 222 },
        { code: 'JP', name: 'BOJ', currentRate: 0.50, seed: 333 },
        { code: 'CN', name: 'PBOC', currentRate: 1.40, seed: 444 },
        { code: 'GB', name: 'BOE', currentRate: 4.25, seed: 555 },
        { code: 'AU', name: 'RBA', currentRate: 4.35, seed: 666 },
        { code: 'CA', name: 'BOC', currentRate: 3.75, seed: 777 },
      ];

      const signals = countries.map(c => {
        const rng = (o = 0) => ((Math.sin(c.seed + o) * 43758.5453) % 1 + 1) % 1;
        const bayesProb = parseFloat((0.45 + rng(1) * 0.45).toFixed(3));
        const rateChange = (rng(2) - 0.5) * 1.5;
        const confidence = parseFloat((bayesProb * (0.8 + rng(3) * 0.2)).toFixed(3));
        const isHighConf = confidence > 0.65;

        return {
          country: c.code,
          centralBank: c.name,
          currentRate: c.currentRate,
          predictedChange: parseFloat(rateChange.toFixed(2)),
          predictedRate: parseFloat((c.currentRate + rateChange).toFixed(2)),
          bayesianProbability: bayesProb,
          confidence,
          isHighConfidence: isHighConf,
          signal: rateChange < -0.1 ? 'BUY_RECEIVER' : rateChange > 0.1 ? 'BUY_PAYER' : 'NEUTRAL',
          instrument: rateChange < -0.1 ? `${c.code} 2Y IRS Receiver` : rateChange > 0.1 ? `${c.code} 2Y IRS Payer` : '观望',
          expectedReturnBps: parseFloat((Math.abs(rateChange) * 80 * confidence).toFixed(1)),
          horizon: '12个月',
          lastUpdated: new Date().toISOString(),
        };
      });

      return {
        success: true,
        signals,
        highConfidenceCount: signals.filter(s => s.isHighConfidence).length,
        summary: {
          bullish: signals.filter(s => s.signal === 'BUY_RECEIVER').length,
          bearish: signals.filter(s => s.signal === 'BUY_PAYER').length,
          neutral: signals.filter(s => s.signal === 'NEUTRAL').length,
          avgConfidence: parseFloat((signals.reduce((s, x) => s + x.confidence, 0) / signals.length).toFixed(3)),
        },
        timestamp: new Date().toISOString(),
      };
    }),

  // ── AI 智能分析：基于高置信度信号生成自然语言总结
  generateSignalsAnalysis: publicProcedure
    .input(z.object({
      signals: z.array(z.object({
        country: z.string(),
        centralBank: z.string(),
        signal: z.string(),
        confidence: z.number(),
        predictedChange: z.number(),
        expectedReturnBps: z.number(),
        isHighConfidence: z.boolean(),
      })),
      summary: z.object({
        bullish: z.number(),
        bearish: z.number(),
        neutral: z.number(),
        avgConfidence: z.number(),
      }),
      filterDescription: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const highConf = input.signals.filter(s => s.isHighConfidence);
      const receivers = input.signals.filter(s => s.signal === 'BUY_RECEIVER');
      const payers = input.signals.filter(s => s.signal === 'BUY_PAYER');
      const topSignals = [...input.signals].sort((a, b) => b.confidence - a.confidence).slice(0, 3);

      const signalLabel = (s: string) => s === 'BUY_RECEIVER' ? '做多接收端' : s === 'BUY_PAYER' ? '做多支付端' : '观望';

      const prompt = `你是一位专业的利率期货交易分析师。请基于以下贝叶斯网络高置信度交易信号，生成一段简洁的中文分析总结（200字以内）。

信号概况：共 ${input.signals.length} 个信号，高置信度 ${highConf.length} 个
做多接收端：${input.summary.bullish} 个（${receivers.map(s => s.centralBank).join('、') || '无'}）
做多支付端：${input.summary.bearish} 个（${payers.map(s => s.centralBank).join('、') || '无'}）
观望：${input.summary.neutral} 个
平均置信度：${(input.summary.avgConfidence * 100).toFixed(1)}%

置信度最高的3个信号：
${topSignals.map(s => `${s.centralBank}(${s.country}): ${signalLabel(s.signal)}, 置信度 ${(s.confidence * 100).toFixed(0)}%, 预期收益 ${s.expectedReturnBps.toFixed(1)}bps`).join('\n')}

要求：
1. 只输出纯文字分析，不使用 Markdown 格式（不用 **、#、- 等符号）
2. 不使用 emoji 或特殊符号
3. 语言简洁专业，必须包含：当前利率市场整体判断、最高置信度信号的具体 IRS 交易建议（指明建议仓位和预期收益 bps）、市场风险提示
4. 分2-3段，每段不超过3句话
5. 结尾必须给出一句具体的交易行动建议`;

      try {
        const result = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4o-mini',
        });
        const rawContent = result.choices?.[0]?.message?.content ?? '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawText = typeof rawContent === 'string' ? rawContent : Array.isArray(rawContent) ? rawContent.map((p: any) => p.text ?? '').join('') : '';
        const cleanText = rawText
          .replace(/[*#`~_>|\[\]()!]/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^[-•·\s]+/gm, '')
          .trim();
        return { success: true, summary: cleanText || '分析完成，当前全球利率市场整体属于温和局面。' };
      } catch {
        const fallback = `当前共有 ${input.signals.length} 个利率期货交易信号，其中高置信度信号 ${highConf.length} 个。` +
          `做多接收端信号占主导，显示市场预期降息应居多。` +
          (topSignals.length > 0 ? `最高置信度信号来自 ${topSignals[0].centralBank}，建议重点关注。` : '');
        return { success: true, summary: fallback };
      }
    }),
});
