import { publicProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { z } from 'zod';

const FactorSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  family: z.string(),
  desc: z.string(),
  formula: z.string().optional(),
});

type Factor = z.infer<typeof FactorSchema>;

export const llmRouter = router({
  analyzeModelPrediction: publicProcedure
    .input(
      z.object({
        modelName: z.string(),
        modelLabel: z.string(),
        params: z.record(z.string(), z.number()),
        metrics: z.object({
          mae: z.number(),
          rmse: z.number(),
          mape: z.number(),
          accuracy: z.number(),
        }),
        predictionSummary: z.object({
          forecastHorizon: z.number(),
          latestPredicted: z.number(),
          trend: z.string(),
          avgConfidence: z.number(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const { modelName, modelLabel, params, metrics, predictionSummary } = input;
      const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(', ');
      const systemPrompt = `你是一位专业的固定收益量化分析师，擅长债券市场预测模型解读。请根据用户提供的模型参数和预测指标，生成一份简洁、专业的中文深度解读报告。
报告结构（严格按此顺序，每部分1-2句）：
1. **模型概述**：说明该模型的核心逻辑和适用场景
2. **参数解读**：分析当前参数配置的合理性及其对预测的影响
3. **性能评估**：基于 MAE/RMSE/MAPE/准确度 评估模型表现
4. **预测洞察**：解读当前预测趋势和置信度的市场含义
5. **风险提示**：指出模型局限性和需要关注的风险点
总长度控制在 200-280 字，使用专业金融术语，保持客观中立。`;
      const userMessage = `请为以下模型预测结果生成深度解读报告：

**模型**：${modelLabel}（${modelName}）
**参数配置**：${paramStr}
**性能指标**：MAE=${metrics.mae}, RMSE=${metrics.rmse}, MAPE=${metrics.mape}%, 准确度=${metrics.accuracy}%
**预测摘要**：预测周期${predictionSummary.forecastHorizon}期，最新预测值=${predictionSummary.latestPredicted}，趋势=${predictionSummary.trend}，平均置信度=${predictionSummary.avgConfidence}%`;
      try {
        const result = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          maxTokens: 600,
        });
        const content = result?.choices?.[0]?.message?.content;
        const text = typeof content === 'string' ? content :
          Array.isArray(content) ? content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') : '';
        return { report: text || '暂时无法生成分析报告，请稍后重试。' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误';
        console.error('LLM analyzeModelPrediction error:', msg);
        return { report: `分析报告生成失败: ${msg}` };
      }
    }),

  parseInvestmentIdea: publicProcedure
    .input(
      z.object({
        idea: z.string().min(1, '投资理念不能为空'),
        availableFactors: z.array(FactorSchema),
      })
    )
    .mutation(async ({ input }) => {
      const { idea, availableFactors } = input;

      // Build factor reference for LLM
      const factorReference = availableFactors
        .map(f => `${f.code} (${f.name}): ${f.desc}${f.formula ? ` 公式: ${f.formula}` : ''}`)
        .join('\n');

      const systemPrompt = `你是一个专业的量化投资因子分析师。根据用户的投资理念，从提供的因子库中选择最合适的因子组合，并分配权重。

可用因子列表：
${factorReference}

你的任务是：
1. 理解用户的投资理念
2. 从可用因子中选择 3-7 个最相关的因子
3. 为每个因子分配权重（总和为 100%）
4. 提供简洁的投资逻辑说明（中文，不超过 100 字）

返回 JSON 格式：
{
  "factors": ["factor_id1", "factor_id2", ...],
  "weights": {"factor_id1": 25, "factor_id2": 20, ...},
  "rationale": "简洁的投资逻辑说明"
}`;

      const userMessage = `根据以下投资理念，生成因子组合：
"${idea}"

请确保返回的因子 ID 必须存在于可用因子列表中。`;

      try {
        const result = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          responseFormat: {
            type: 'json_object',
          },
          maxTokens: 500,
        });

        // Extract JSON from response
        const responseText =
          typeof result.choices[0].message.content === 'string'
            ? result.choices[0].message.content
            : Array.isArray(result.choices[0].message.content)
            ? result.choices[0].message.content
                .filter(c => c.type === 'text')
                .map(c => (c as any).text)
                .join('')
            : '';

        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            error: '无法解析 LLM 响应，请重新尝试',
            result: null,
          };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate response structure
        if (
          !parsed.factors ||
          !Array.isArray(parsed.factors) ||
          !parsed.weights ||
          typeof parsed.weights !== 'object' ||
          !parsed.rationale ||
          typeof parsed.rationale !== 'string'
        ) {
          return {
            error: 'LLM 返回格式不正确',
            result: null,
          };
        }

        // Validate factors exist and weights sum to ~100
        const validFactors = parsed.factors.filter((fid: string) =>
          availableFactors.some(f => f.id === fid)
        );

        if (validFactors.length === 0) {
          return {
            error: '生成的因子不在可用列表中，请重新描述投资理念',
            result: null,
          };
        }

        const totalWeight = Object.values(parsed.weights as Record<string, number>).reduce(
          (a: number, b: number) => a + b,
          0
        );

        if (Math.abs(totalWeight - 100) > 5) {
          return {
            error: '因子权重总和不等于 100%，请重新尝试',
            result: null,
          };
        }

        return {
          result: {
            factors: validFactors,
            weights: parsed.weights,
            rationale: parsed.rationale,
          },
          error: null,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '未知错误';
        console.error('LLM parseInvestmentIdea error:', errorMsg);

        return {
          error: `LLM 处理失败: ${errorMsg}`,
          result: null,
        };
      }
    }),
});
