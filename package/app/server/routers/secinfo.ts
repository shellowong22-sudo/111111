import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { fetchFredSeries } from "../realDataService";

type FredPoint = { date: string; value: number };

function latest(points: FredPoint[]): FredPoint | null {
  return points.length ? points[points.length - 1] : null;
}

function percentile(points: FredPoint[], value: number | null): number | null {
  if (value === null || !points.length) return null;
  const sorted = points
    .map(point => point.value)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const belowOrEqual = sorted.filter(item => item <= value).length;
  return Math.round((belowOrEqual / sorted.length) * 100);
}

function joinRiskSeries(
  highYield: FredPoint[],
  volatility: FredPoint[],
  curve: FredPoint[]
) {
  const byDate = new Map<
    string,
    {
      date: string;
      highYieldSpread?: number;
      volatility?: number;
      curveSlope?: number;
    }
  >();
  for (const point of highYield)
    byDate.set(point.date, {
      ...(byDate.get(point.date) ?? { date: point.date }),
      highYieldSpread: point.value,
    });
  for (const point of volatility)
    byDate.set(point.date, {
      ...(byDate.get(point.date) ?? { date: point.date }),
      volatility: point.value,
    });
  for (const point of curve)
    byDate.set(point.date, {
      ...(byDate.get(point.date) ?? { date: point.date }),
      curveSlope: point.value,
    });
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-120);
}

function joinYieldHistory(twoYear: FredPoint[], tenYear: FredPoint[]) {
  const rows = new Map<
    string,
    { date: string; twoYear?: number; tenYear?: number }
  >();
  for (const point of twoYear) {
    rows.set(point.date, {
      ...(rows.get(point.date) ?? { date: point.date }),
      twoYear: point.value,
    });
  }
  for (const point of tenYear) {
    rows.set(point.date, {
      ...(rows.get(point.date) ?? { date: point.date }),
      tenYear: point.value,
    });
  }
  return [...rows.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);
}

function readContextValue(question: string, label: string): string | null {
  const match = question.match(new RegExp(`${label}：([^；\\n]+)`));
  return match?.[1]?.trim() || null;
}

async function buildVerifiedAssistantAnswer(question: string) {
  const [twoYear, tenYear, realTenYear] = await Promise.all([
    fetchFredSeries("DGS2", 45),
    fetchFredSeries("DGS10", 45),
    fetchFredSeries("DFII10", 45),
  ]);
  const two = latest(twoYear);
  const ten = latest(tenYear);
  const realTen = latest(realTenYear);
  const objectName = readContextValue(question, "研究对象") ?? "当前研究对象";
  const identifier = readContextValue(question, "识别码");
  const maturity = readContextValue(question, "期限");
  const observedPrice = readContextValue(question, "当前价格");
  const slopeBps =
    two && ten ? Number(((ten.value - two.value) * 100).toFixed(1)) : null;
  const curveDescription =
    slopeBps === null
      ? "期限利差暂不可复算"
      : slopeBps > 25
        ? `10Y–2Y 为 ${slopeBps}bp，曲线明显正斜率`
        : slopeBps >= 0
          ? `10Y–2Y 为 ${slopeBps}bp，曲线轻度正斜率`
          : `10Y–2Y 为 ${slopeBps}bp，曲线仍处倒挂`;
  const questionFocus = /条款|现金流|到期|赎回|回售/.test(question)
    ? "条款判断必须回到发行文件和现金流表；当前上下文只能核对发行主体、识别码、到期口径与市场利率，不能推断未提供的赎回、回售或递延安排。"
    : /价格|收益率|估值/.test(question)
      ? "价格与收益率方向通常相反；要把利率变化换算为价格影响，还需要该证券同一观测日的有效久期、凸性、现金流和估值曲线。"
      : "主要风险来自基准曲线平移、期限结构变化和真实利率重定价；具体价格敏感度仍需同一观测日的有效久期与凸性。";
  const facts = [
    two ? `美国 2Y ${two.value.toFixed(2)}%（${two.date}）` : null,
    ten ? `美国 10Y ${ten.value.toFixed(2)}%（${ten.date}）` : null,
    realTen
      ? `10Y 实际利率 ${realTen.value.toFixed(2)}%（${realTen.date}）`
      : null,
  ]
    .filter(Boolean)
    .join("；");
  const objectDetails = [
    identifier ? `识别码 ${identifier}` : null,
    maturity ? `期限 ${maturity}` : null,
    observedPrice && observedPrice !== "未取得"
      ? `页面观测值 ${observedPrice}`
      : null,
  ]
    .filter(Boolean)
    .join("；");

  return [
    `结论：${objectName}应先按利率曲线风险审阅。${curveDescription}。`,
    `市场事实：${facts || "本次未取得完整利率观测，不能给出数值结论。"}`,
    `对象信息：${objectDetails || "当前只有对象名称，缺少可复算证券字段。"}`,
    `分析：${questionFocus}`,
    "待补证据：有效久期、凸性、完整现金流、估值曲线和同一时点可核验价格。上述字段未齐全前，不输出可成交报价或确定性价格目标。",
  ].join("\n");
}

const shockInput = z.enum([
  "RATE_UP_100BP",
  "EQUITY_CRASH",
  "CREDIT_WIDEN",
  "INFLATION_SPIKE",
]);

const SHOCK_PARAMETERS: Record<
  z.infer<typeof shockInput>,
  { label: string; twoYearBps: number; tenYearBps: number; creditBps: number }
> = {
  RATE_UP_100BP: {
    label: "收益率曲线平行上移",
    twoYearBps: 100,
    tenYearBps: 100,
    creditBps: 0,
  },
  EQUITY_CRASH: {
    label: "风险资产快速回撤",
    twoYearBps: -35,
    tenYearBps: -20,
    creditBps: 85,
  },
  CREDIT_WIDEN: {
    label: "信用风险溢价扩张",
    twoYearBps: -15,
    tenYearBps: -10,
    creditBps: 120,
  },
  INFLATION_SPIKE: {
    label: "通胀预期意外上行",
    twoYearBps: 80,
    tenYearBps: 60,
    creditBps: 20,
  },
};

export const secinfoRouter = router({
  getDigitalTwin: publicProcedure.query(async () => {
    const [twoYear, tenYear] = await Promise.all([
      fetchFredSeries("DGS2", 30),
      fetchFredSeries("DGS10", 30),
    ]);
    const two = latest(twoYear);
    const ten = latest(tenYear);
    return {
      success: true,
      available: false,
      profile: [] as Array<{ dimension: string; value: number }>,
      decisionPath: [] as Array<{
        step: number;
        action: string;
        emotionIndex: number;
      }>,
      requiredSignals: [
        {
          field: "研究对象访问记录",
          status: "未授权",
          purpose: "识别实际研究覆盖范围",
        },
        {
          field: "组合久期与币种暴露",
          status: "未接入",
          purpose: "计算账户级利率敏感度",
        },
        {
          field: "订单与成交回报",
          status: "未接入",
          purpose: "核验决策到执行的偏差",
        },
        {
          field: "风险限额与授权层级",
          status: "未配置",
          purpose: "约束建议的可执行边界",
        },
      ],
      limitation:
        "当前没有经授权的用户行为、持仓、订单或风险限额样本，因此不生成个人画像或决策轨迹。",
      marketContext: {
        twoYear: two?.value ?? null,
        twoYearDate: two?.date ?? null,
        tenYear: ten?.value ?? null,
        tenYearDate: ten?.date ?? null,
        source: "Federal Reserve Economic Data",
      },
      history: joinYieldHistory(twoYear, tenYear),
      timestamp: new Date().toISOString(),
    };
  }),

  getEmotionResonance: publicProcedure.query(async () => {
    const [highYield, volatility, curve] = await Promise.all([
      fetchFredSeries("BAMLH0A0HYM2", 756),
      fetchFredSeries("VIXCLS", 756),
      fetchFredSeries("T10Y2Y", 756),
    ]);
    const hyLatest = latest(highYield);
    const vixLatest = latest(volatility);
    const curveLatest = latest(curve);
    const hyPct = percentile(highYield, hyLatest?.value ?? null);
    const vixPct = percentile(volatility, vixLatest?.value ?? null);
    const inversionPct = percentile(
      curve.map(point => ({ ...point, value: -point.value })),
      curveLatest ? -curveLatest.value : null
    );
    const components = [hyPct, vixPct, inversionPct].filter(
      (value): value is number => value !== null
    );
    const riskTemperature = components.length
      ? Math.round(
          components.reduce((sum, value) => sum + value, 0) / components.length
        )
      : null;
    return {
      success: true,
      available: components.length > 0,
      riskTemperature,
      regime:
        riskTemperature === null
          ? "数据不足"
          : riskTemperature >= 75
            ? "高压"
            : riskTemperature >= 50
              ? "偏紧"
              : riskTemperature >= 25
                ? "常态"
                : "宽松",
      components: [
        {
          id: "credit",
          label: "高收益债利差分位",
          value: hyLatest?.value ?? null,
          unit: "%",
          percentile: hyPct,
          date: hyLatest?.date ?? null,
          seriesId: "BAMLH0A0HYM2",
        },
        {
          id: "volatility",
          label: "VIX 分位",
          value: vixLatest?.value ?? null,
          unit: "",
          percentile: vixPct,
          date: vixLatest?.date ?? null,
          seriesId: "VIXCLS",
        },
        {
          id: "curve",
          label: "曲线倒挂压力分位",
          value: curveLatest?.value ?? null,
          unit: "%",
          percentile: inversionPct,
          date: curveLatest?.date ?? null,
          seriesId: "T10Y2Y",
        },
      ],
      series: joinRiskSeries(
        highYield.slice(-180),
        volatility.slice(-180),
        curve.slice(-180)
      ),
      methodology:
        "风险温度为三个公开市场序列在近三年样本内的等权历史分位；它衡量市场压力，不代表投资者生理或群体情绪。",
      source: "Federal Reserve Economic Data",
      timestamp: new Date().toISOString(),
    };
  }),

  counterfactual: publicProcedure
    .input(z.object({ shock: shockInput.default("RATE_UP_100BP") }))
    .query(async ({ input }) => {
      const [twoYear, tenYear] = await Promise.all([
        fetchFredSeries("DGS2", 30),
        fetchFredSeries("DGS10", 30),
      ]);
      const two = latest(twoYear);
      const ten = latest(tenYear);
      const parameters = SHOCK_PARAMETERS[input.shock];
      const durationYears = 8.17;
      const convexity = 0.72;
      const durationImpact = -(durationYears * parameters.tenYearBps) / 100;
      const convexityImpact =
        0.5 * convexity * Math.pow(parameters.tenYearBps / 100, 2);
      const estimatedPriceImpactPct = Number(
        (durationImpact + convexityImpact).toFixed(3)
      );
      const available = two !== null && ten !== null;
      return {
        success: true,
        available,
        shock: input.shock,
        scenarioLabel: parameters.label,
        assumptions: { ...parameters, durationYears, convexity },
        baseline: {
          twoYear: two?.value ?? null,
          twoYearDate: two?.date ?? null,
          tenYear: ten?.value ?? null,
          tenYearDate: ten?.date ?? null,
          slopeBps:
            two && ten
              ? Number(((ten.value - two.value) * 100).toFixed(1))
              : null,
        },
        shocked: {
          twoYear: two
            ? Number((two.value + parameters.twoYearBps / 100).toFixed(3))
            : null,
          tenYear: ten
            ? Number((ten.value + parameters.tenYearBps / 100).toFixed(3))
            : null,
          slopeBps:
            two && ten
              ? Number(
                  (
                    (ten.value +
                      parameters.tenYearBps / 100 -
                      (two.value + parameters.twoYearBps / 100)) *
                    100
                  ).toFixed(1)
                )
              : null,
          estimatedPriceImpactPct: available ? estimatedPriceImpactPct : null,
        },
        attribution: [
          {
            factor: "久期一阶项",
            impactPct: available ? Number(durationImpact.toFixed(3)) : null,
            impactBps: null,
          },
          {
            factor: "凸性修正项",
            impactPct: available ? Number(convexityImpact.toFixed(3)) : null,
            impactBps: null,
          },
          {
            factor: "信用利差假设",
            impactPct: null,
            impactBps: parameters.creditBps,
          },
        ],
        methodology:
          "以最新 DGS2/DGS10 为基线，按所选冲击参数进行确定性敏感性重估；结果不是预测、可成交报价或个人行为判断。",
        source:
          "Federal Reserve Economic Data + transparent scenario parameters",
        timestamp: new Date().toISOString(),
      };
    }),

  getStrategySwarm: publicProcedure.query(async () => {
    const tenYearSeries = await fetchFredSeries("DGS10", 90);
    const tenYear = latest(tenYearSeries);
    return {
      success: true,
      available: false,
      strategies: [] as Array<{
        id: string;
        name: string;
        generation: number;
        fitness: number;
        sharpe: number;
        allocation: number;
        status: string;
      }>,
      readiness: [
        {
          gate: "标的与基准价格历史",
          state: "部分可用",
          evidence: tenYear
            ? `DGS10 更新至 ${tenYear.date}`
            : "尚未取得 DGS10 观测",
        },
        {
          gate: "组合持仓与现金流",
          state: "缺失",
          evidence: "未接入账户级头寸",
        },
        {
          gate: "成交成本与滑点",
          state: "缺失",
          evidence: "未接入经授权的成交回报",
        },
        {
          gate: "样本外回测与版本冻结",
          state: "未运行",
          evidence: "无可审计回测批次",
        },
        { gate: "风险限额与审批", state: "未配置", evidence: "无账户级约束集" },
      ],
      limitation:
        "策略名称、适应度、Sharpe、配置比例和进化代数必须来自可审计回测；当前条件不满足，因此不生成数值。",
      marketContext: {
        tenYear: tenYear?.value ?? null,
        date: tenYear?.date ?? null,
        source: "Federal Reserve Economic Data",
      },
      history: tenYearSeries.slice(-60),
      timestamp: new Date().toISOString(),
    };
  }),

  askAssistant: publicProcedure
    .input(z.object({ question: z.string().min(1).max(4000) }))
    .mutation(async ({ input }) => {
      const verifiedFallback = await buildVerifiedAssistantAnswer(
        input.question
      );
      if (!ENV.llmBaseUrl || !ENV.llmApiKey) {
        return {
          success: true,
          answer: verifiedFallback,
          timestamp: new Date().toISOString(),
        };
      }
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "你是主权债研究助理。只依据用户提供的研究对象上下文回答；缺少数据时明确指出缺口，不编造报价、持仓、评级、成交或新闻。回答使用简洁中文，并区分事实、计算结果与情景假设。",
            },
            { role: "user", content: input.question },
          ],
          maxTokens: 700,
        });
        const content = response?.choices?.[0]?.message?.content;
        const answer =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .filter((item: any) => item?.type === "text")
                  .map((item: any) => item.text)
                  .join("")
              : "";
        return {
          success: Boolean(answer),
          answer: answer || verifiedFallback,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          success: true,
          answer: verifiedFallback,
          timestamp: new Date().toISOString(),
        };
      }
    }),
});
