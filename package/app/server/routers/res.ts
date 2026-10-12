/**
 * RES Router — 研究报告主页
 *
 * getAnalystRatings:   获取分析师评级变更列表（Yahoo Finance 真实数据 + 本地丰富化）
 * getConsensus:        获取指定股票的一致预期数据（目标价区间、评级分布）
 * getRatingDistribution: 全市场评级分布统计
 * summarizeReport:     AI 总结报告核心投资逻辑、目标价预测、风险点（结构化 JSON）
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import { callDataApi } from "../_core/dataApi";
import { getDb } from "../db";
import { eq, sql } from "drizzle-orm";
import { adminAiGenerationTasks } from "../../drizzle/schema";
import { type YahooChartPoint } from "../realDataService";
import { fetchStooqDailySeries } from "../freeMarketData";
import { fetchPublicTicker } from "../stockTickerObservation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalystRating = {
  id: string;
  ticker: string;
  name: string;
  analyst: string;
  firm: string;
  date: string;
  type: string;
  rating: string;
  prevRating: string | null;
  target: number;
  prevTarget: number | null;
  chg:
    | "upgrade"
    | "downgrade"
    | "target_up"
    | "target_down"
    | "maintain"
    | "initiate";
  upside: number | null;
  currentPrice: number | null;
};

export type EquityCoverageObservation = {
  ticker: string;
  name: string;
  available: boolean;
  source: string;
  retrievedAt: string;
  marketTimestamp: string | null;
  freshness: "delayed_or_eod" | "unavailable";
  currency: string | null;
  price: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  averageVolume20d: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  return5d: number | null;
  return20d: number | null;
  return60d: number | null;
  realizedVolatility20d: number | null;
  maxDrawdown: number | null;
  history: YahooChartPoint[];
  limitation: string;
};

export type ConsensusData = {
  ticker: string;
  name: string;
  available: boolean;
  source: string;
  retrievedAt: string;
  limitation: string;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongBuy: number | null;
  strongSell: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  targetMean: number | null;
  targetMedian: number | null;
  currentPrice: number | null;
  numAnalysts: number | null;
  upside: number | null;
};

export type AiReportSummary = {
  ticker: string;
  investmentThesis: string[];
  targetPriceRationale: string;
  targetPrice: number | null;
  catalysts: string[];
  risks: string[];
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  timeHorizon: string;
  keyMetrics: Array<{ label: string; value: string }>;
  conclusion: string;
  generatedAt: number;
  taskId: number;
  model: string;
};

const RES_AI_MODEL = "local-equity-editor-v1";

async function beginResAiTask(actorUserId: number, detail: string) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "AI 任务账本不可用",
    });
  const inserted = await db.insert(adminAiGenerationTasks).values({
    generationType: "report",
    status: "running",
    requestedCount: 1,
    processedCount: 0,
    generatedCount: 0,
    catalogCode: "RES",
    model: RES_AI_MODEL,
    detail,
    createdByUserId: actorUserId,
    startedAt: new Date(),
  });
  const taskId = Number(
    (inserted as any)[0]?.insertId ?? (inserted as any).insertId
  );
  if (!taskId)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI 任务账本写入失败",
    });
  return taskId;
}

async function finishResAiTask(taskId: number, error?: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(adminAiGenerationTasks)
    .set({
      status: error ? "failed" : "completed",
      processedCount: 1,
      generatedCount: error ? 0 : 1,
      detail: error
        ? "RES 分析任务失败；未保存或展示替代结论。"
        : "RES 分析任务已由本地权益研究编排器完成。",
      error: error?.slice(0, 1_000) ?? null,
      completedAt: new Date(),
    })
    .where(eq(adminAiGenerationTasks.id, taskId));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STOCK_NAMES: Record<string, string> = {
  AAPL: "苹果",
  MSFT: "微软",
  NVDA: "英伟达",
  GOOGL: "谷歌",
  AMZN: "亚马逊",
  META: "Meta",
  TSLA: "特斯拉",
  BABA: "阿里巴巴",
  BIDU: "百度",
  JD: "京东",
  INTC: "英特尔",
  AMD: "AMD",
  NFLX: "奈飞",
  CRM: "Salesforce",
  ORCL: "甲骨文",
  TSM: "台积电",
  ASML: "ASML",
  QCOM: "高通",
  AVGO: "博通",
  MU: "美光科技",
};

function trailingReturn(history: YahooChartPoint[], sessions: number) {
  const points = history.filter(point => Number.isFinite(point.close));
  if (points.length <= sessions) return null;
  const latest = Number(points[points.length - 1]?.close);
  const base = Number(points[points.length - 1 - sessions]?.close);
  return base > 0 ? ((latest - base) / base) * 100 : null;
}

function realizedVolatility(history: YahooChartPoint[], sessions: number) {
  const closes = history
    .slice(-(sessions + 1))
    .map(point => Number(point.close))
    .filter(value => Number.isFinite(value) && value > 0);
  if (closes.length < 3) return null;
  const returns = closes
    .slice(1)
    .map((value, index) => Math.log(value / closes[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function maximumDrawdown(history: YahooChartPoint[]) {
  const closes = history
    .map(point => Number(point.close))
    .filter(value => Number.isFinite(value) && value > 0);
  if (closes.length < 2) return null;
  let peak = closes[0];
  let drawdown = 0;
  for (const value of closes) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, ((value - peak) / peak) * 100);
  }
  return drawdown;
}

async function fetchEquityCoverage(
  ticker: string
): Promise<EquityCoverageObservation> {
  const retrievedAt = new Date().toISOString();
  const chart = await fetchPublicTicker(ticker, "6mo", "stocks");
  if (!chart) {
    const stooq = await fetchStooqDailySeries(`${ticker}.us`, 130);
    if (stooq.available && stooq.history.length) {
      const history: YahooChartPoint[] = stooq.history.map(point => ({
        date: point.date,
        value: point.value,
        open: point.open ?? null,
        high: point.high ?? null,
        low: point.low ?? null,
        close: point.close ?? null,
        volume: point.volume ?? null,
      }));
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const latestClose = Number(latest?.close);
      const previousClose = Number(previous?.close);
      const change =
        Number.isFinite(latestClose) && Number.isFinite(previousClose)
          ? latestClose - previousClose
          : null;
      const highs = history
        .map(point => Number(point.high))
        .filter(Number.isFinite);
      const lows = history
        .map(point => Number(point.low))
        .filter(Number.isFinite);
      const recentVolumes = history
        .slice(-20)
        .map(point => Number(point.volume))
        .filter(value => Number.isFinite(value) && value >= 0);
      return {
        ticker,
        name: STOCK_NAMES[ticker] || ticker,
        available: true,
        source: stooq.source,
        retrievedAt: stooq.retrievedAt,
        marketTimestamp: stooq.observedAt
          ? `${stooq.observedAt}T00:00:00.000Z`
          : null,
        freshness: "delayed_or_eod",
        currency: "USD",
        price: Number.isFinite(latestClose) ? latestClose : null,
        change,
        changePct:
          change !== null && previousClose > 0
            ? (change / previousClose) * 100
            : null,
        open: latest?.open ?? null,
        high: latest?.high ?? null,
        low: latest?.low ?? null,
        volume: latest?.volume ?? null,
        averageVolume20d: recentVolumes.length
          ? Math.round(
              recentVolumes.reduce((sum, value) => sum + value, 0) /
                recentVolumes.length
            )
          : null,
        rangeHigh: highs.length ? Math.max(...highs) : null,
        rangeLow: lows.length ? Math.min(...lows) : null,
        return5d: trailingReturn(history, 5),
        return20d: trailingReturn(history, 20),
        return60d: trailingReturn(history, 60),
        realizedVolatility20d: realizedVolatility(history, 20),
        maxDrawdown: maximumDrawdown(history),
        history,
        limitation: stooq.limitation,
      };
    }
    return {
      ticker,
      name: STOCK_NAMES[ticker] || ticker,
      available: false,
      source: "Yahoo Finance public chart / Stooq public CSV",
      retrievedAt,
      marketTimestamp: null,
      freshness: "unavailable",
      currency: null,
      price: null,
      change: null,
      changePct: null,
      open: null,
      high: null,
      low: null,
      volume: null,
      averageVolume20d: null,
      rangeHigh: null,
      rangeLow: null,
      return5d: null,
      return20d: null,
      return60d: null,
      realizedVolatility20d: null,
      maxDrawdown: null,
      history: [],
      limitation: `公开行情源本次不可用；Yahoo 与 Stooq 均未返回可核验序列。未使用静态价格、随机数或替代证券填充。Stooq：${stooq.limitation}`,
    };
  }

  const history = chart.history
    .filter(point => Number.isFinite(point.close))
    .slice(-130);
  const latest = history[history.length - 1];
  const highs = history
    .map(point => Number(point.high))
    .filter(Number.isFinite);
  const lows = history.map(point => Number(point.low)).filter(Number.isFinite);
  const recentVolumes = history
    .slice(-20)
    .map(point => Number(point.volume))
    .filter(value => Number.isFinite(value) && value >= 0);
  const marketEpoch = Number(chart.meta.regularMarketTime);
  const marketTimestamp = Number.isFinite(marketEpoch)
    ? new Date(marketEpoch * 1000).toISOString()
    : latest?.date
      ? `${latest.date}T00:00:00.000Z`
      : null;

  return {
    ticker,
    name: STOCK_NAMES[ticker] || ticker,
    available: true,
    source: chart.source,
    retrievedAt,
    marketTimestamp,
    freshness: "delayed_or_eod",
    currency: chart.currency,
    price: chart.price,
    change: chart.change,
    changePct: chart.changePct,
    open: latest?.open ?? null,
    high: latest?.high ?? null,
    low: latest?.low ?? null,
    volume: latest?.volume ?? null,
    averageVolume20d: recentVolumes.length
      ? Math.round(
          recentVolumes.reduce((sum, value) => sum + value, 0) /
            recentVolumes.length
        )
      : null,
    rangeHigh: highs.length ? Math.max(...highs) : null,
    rangeLow: lows.length ? Math.min(...lows) : null,
    return5d: trailingReturn(history, 5),
    return20d: trailingReturn(history, 20),
    return60d: trailingReturn(history, 60),
    realizedVolatility20d: realizedVolatility(history, 20),
    maxDrawdown: maximumDrawdown(history),
    history,
    limitation:
      "公开行情用于市场背景与历史研究，可能延迟或为最近收盘值；分析师评级仍需单独授权来源。",
  };
}

/**
 * The recommendation endpoint is never used to invent an analyst-event tape.
 * The same response also carries verified market observations for the original
 * eight-name coverage universe so a missing ratings licence does not blank the
 * entire research workspace.
 */
async function fetchRealRatings(tickers: string[]) {
  const retrievedAt = new Date().toISOString();
  const universe = tickers.slice(0, 8);
  const coveragePromise = Promise.all(universe.map(fetchEquityCoverage));
  let ratingLimitation =
    "已配置端点不提供可核验的分析师评级事件、机构、日期和目标价；终端未生成替代记录。";
  try {
    await Promise.all(
      universe.map(ticker =>
        callDataApi("YahooFinance/get_stock_recommendations", {
          query: { symbol: ticker },
        })
      )
    );
  } catch (error) {
    ratingLimitation = `评级事件源不可用（${error instanceof Error ? error.message : "UNKNOWN"}）；终端未生成替代记录。`;
  }
  const coverage = await coveragePromise;
  return {
    ratings: [] as AnalystRating[],
    coverage,
    available: false,
    marketDataAvailable: coverage.filter(row => row.available).length,
    source: "Configured Yahoo Finance recommendations API",
    retrievedAt,
    limitation: ratingLimitation,
  };
}

function finiteNumber(value: unknown): number | null {
  const candidate =
    value && typeof value === "object" && "raw" in value
      ? (value as { raw?: unknown }).raw
      : value;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function unavailableConsensus(
  ticker: string,
  retrievedAt: string,
  reason: string
): ConsensusData {
  return {
    ticker,
    name: STOCK_NAMES[ticker] || ticker,
    available: false,
    source: "Configured Yahoo Finance analyst targets API",
    retrievedAt,
    limitation: `${reason}；终端未以零值、静态值或随机值替代。`,
    buy: null,
    hold: null,
    sell: null,
    strongBuy: null,
    strongSell: null,
    targetHigh: null,
    targetLow: null,
    targetMean: null,
    targetMedian: null,
    currentPrice: null,
    numAnalysts: null,
    upside: null,
  };
}

/** 从 Yahoo Finance 获取一致预期数据 */
async function fetchConsensus(ticker: string): Promise<ConsensusData> {
  const retrievedAt = new Date().toISOString();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await callDataApi(
      "YahooFinance/get_analyst_price_targets",
      {
        query: { symbol: ticker },
      }
    );

    const root =
      data?.quoteSummary?.result?.[0] ?? data?.finance?.result?.[0] ?? data;
    const pt = root?.financialData;
    const rec = root?.recommendationTrend?.trend?.[0];

    if (pt && rec) {
      const strongBuy = finiteNumber(rec.strongBuy);
      const regularBuy = finiteNumber(rec.buy);
      const hold = finiteNumber(rec.hold);
      const regularSell = finiteNumber(rec.sell);
      const strongSell = finiteNumber(rec.strongSell);
      const targetHigh = finiteNumber(pt.targetHighPrice);
      const targetLow = finiteNumber(pt.targetLowPrice);
      const targetMean = finiteNumber(pt.targetMeanPrice);
      const targetMedian = finiteNumber(pt.targetMedianPrice);
      const currentPrice = finiteNumber(pt.currentPrice);
      if (
        [
          strongBuy,
          regularBuy,
          hold,
          regularSell,
          strongSell,
          targetHigh,
          targetLow,
          targetMean,
          currentPrice,
        ].some(value => value === null)
      ) {
        return unavailableConsensus(
          ticker,
          retrievedAt,
          "分析师目标价端点返回字段不完整"
        );
      }
      const buy = strongBuy! + regularBuy!;
      const sell = regularSell! + strongSell!;
      const numAnalysts = buy + hold! + sell;
      if (numAnalysts <= 0 || currentPrice! <= 0) {
        return unavailableConsensus(
          ticker,
          retrievedAt,
          "分析师覆盖数或当前价无有效观察"
        );
      }
      return {
        ticker,
        name: STOCK_NAMES[ticker] || ticker,
        available: true,
        source: "Configured Yahoo Finance analyst targets API",
        retrievedAt,
        limitation:
          "一致预期为外部端点本次实际返回；不是交易所实时行情或投资建议。",
        buy,
        hold: hold!,
        sell,
        strongBuy: strongBuy!,
        strongSell: strongSell!,
        targetHigh: targetHigh!,
        targetLow: targetLow!,
        targetMean: targetMean!,
        targetMedian,
        currentPrice: currentPrice!,
        numAnalysts,
        upside: ((targetMean! - currentPrice!) / currentPrice!) * 100,
      };
    }
    return unavailableConsensus(
      ticker,
      retrievedAt,
      "分析师目标价端点未返回可核验数据"
    );
  } catch (error) {
    return unavailableConsensus(
      ticker,
      retrievedAt,
      `分析师目标价源不可用（${error instanceof Error ? error.message : "UNKNOWN"}）`
    );
  }
}

// ─── AI Summary Schema ────────────────────────────────────────────────────────

const AI_SUMMARY_SCHEMA = {
  name: "report_summary",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      investmentThesis: {
        type: "array" as const,
        description: "核心投资逻辑，3-4 条，每条不超过 60 字",
        items: { type: "string" as const },
      },
      targetPriceRationale: {
        type: "string" as const,
        description: "目标价测算依据，不超过 80 字，说明估值方法和假设",
      },
      targetPrice: {
        type: "number" as const,
        description: "目标价（数字，若无则为 0）",
      },
      catalysts: {
        type: "array" as const,
        description: "未来 3-6 个月的关键催化剂，2-3 条",
        items: { type: "string" as const },
      },
      risks: {
        type: "array" as const,
        description: "主要下行风险，2-3 条",
        items: { type: "string" as const },
      },
      recommendation: {
        type: "string" as const,
        enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"] as const,
        description: "投资建议",
      },
      timeHorizon: {
        type: "string" as const,
        description: '投资时间窗口，如"12个月"、"6-12个月"',
      },
      keyMetrics: {
        type: "array" as const,
        description: "关键估值指标，最多 4 条",
        items: {
          type: "object" as const,
          properties: {
            label: { type: "string" as const },
            value: { type: "string" as const },
          },
          required: ["label", "value"] as const,
          additionalProperties: false,
        },
      },
      conclusion: {
        type: "string" as const,
        description: "一句话投资结论，不超过 40 字",
      },
    },
    required: [
      "investmentThesis",
      "targetPriceRationale",
      "targetPrice",
      "catalysts",
      "risks",
      "recommendation",
      "timeHorizon",
      "keyMetrics",
      "conclusion",
    ] as const,
    additionalProperties: false,
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────

export const resRouter = router({
  getRatingHistorySummary: publicProcedure
    .input(
      z.object({ tickers: z.array(z.string().min(1).max(10)).min(1).max(20) })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return {
          total: 0,
          tickerCount: input.tickers.length,
          available: false,
          source: "analyst_ratings",
        };
      try {
        const counts = await Promise.all(
          input.tickers.map(async ticker => {
            const rows = await db.execute(
              sql`SELECT COUNT(*) AS total FROM analyst_ratings WHERE ticker = ${ticker}`
            );
            const raw = ((rows as unknown[][])[0] ?? []) as Array<
              Record<string, unknown>
            >;
            return Number(raw[0]?.total ?? 0);
          })
        );
        const total = counts.reduce((sum, count) => sum + count, 0);
        return {
          total,
          tickerCount: input.tickers.length,
          available: total > 0,
          source: "analyst_ratings",
        };
      } catch {
        return {
          total: 0,
          tickerCount: input.tickers.length,
          available: false,
          source: "analyst_ratings",
        };
      }
    }),

  /**
   * 获取分析师评级历史（从数据库 analyst_ratings 表）
   */
  getRatingHistory: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(10),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [] };
      try {
        const rows = await db.execute(
          sql`SELECT ticker, name, analyst, firm, rating, prev_rating as prevRating,
              target, prev_target as prevTarget, chg, rating_type as ratingType,
              current_price as currentPrice, upside,
              DATE_FORMAT(rated_at, '%Y-%m-%d') as date
              FROM analyst_ratings
              WHERE ticker = ${input.ticker}
              ORDER BY rated_at DESC
              LIMIT ${input.limit}`
        );
        const raw = ((rows as unknown[][])[0] ?? []) as Array<
          Record<string, unknown>
        >;
        const history = raw.map(r => ({
          ...r,
          target: r.target != null ? Number(r.target) : null,
          prevTarget: r.prevTarget != null ? Number(r.prevTarget) : null,
          currentPrice: r.currentPrice != null ? Number(r.currentPrice) : null,
          upside: r.upside != null ? Number(r.upside) : null,
        }));
        return { history };
      } catch {
        return { history: [] };
      }
    }),

  /**
   * 保存 AI 总结到数据库（持久化）
   */
  saveSummary: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(10),
        name: z.string().default(""),
        analyst: z.string().default(""),
        rating: z.string().default(""),
        target: z.number().optional(),
        investmentThesis: z.array(z.string()),
        targetPriceRationale: z.string(),
        targetPrice: z.number().optional(),
        catalysts: z.array(z.string()),
        risks: z.array(z.string()),
        recommendation: z.string(),
        timeHorizon: z.string(),
        keyMetrics: z.array(z.object({ label: z.string(), value: z.string() })),
        conclusion: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { id: null, saved: false };
      try {
        await db.execute(
          sql`INSERT INTO ai_report_summaries
              (ticker, name, analyst, rating, target,
               investment_thesis, target_price_rationale, target_price,
               catalysts, risks, recommendation, time_horizon,
               key_metrics, conclusion)
              VALUES (
                ${input.ticker}, ${input.name}, ${input.analyst}, ${input.rating},
                ${input.target ?? null},
                ${JSON.stringify(input.investmentThesis)},
                ${input.targetPriceRationale},
                ${input.targetPrice ?? null},
                ${JSON.stringify(input.catalysts)},
                ${JSON.stringify(input.risks)},
                ${input.recommendation},
                ${input.timeHorizon},
                ${JSON.stringify(input.keyMetrics)},
                ${input.conclusion}
              )`
        );
        return { saved: true };
      } catch (err) {
        console.error("[saveSummary] DB error:", err);
        return { saved: false };
      }
    }),

  /**
   * 获取历史 AI 总结列表（按 ticker 或全部）
   */
  getSummaryHistory: publicProcedure
    .input(
      z.object({
        ticker: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { summaries: [] };
      try {
        const rows = await db.execute(
          input.ticker
            ? sql`SELECT id, ticker, name, analyst, rating, target,
                  investment_thesis as investmentThesis, target_price_rationale as targetPriceRationale,
                  target_price as targetPrice, catalysts, risks, recommendation,
                  time_horizon as timeHorizon, key_metrics as keyMetrics, conclusion,
                  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as createdAt
                  FROM ai_report_summaries
                  WHERE ticker = ${input.ticker}
                  ORDER BY created_at DESC LIMIT ${input.limit}`
            : sql`SELECT id, ticker, name, analyst, rating, target,
                  investment_thesis as investmentThesis, target_price_rationale as targetPriceRationale,
                  target_price as targetPrice, catalysts, risks, recommendation,
                  time_horizon as timeHorizon, key_metrics as keyMetrics, conclusion,
                  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as createdAt
                  FROM ai_report_summaries
                  ORDER BY created_at DESC LIMIT ${input.limit}`
        );
        // 解析 JSON 字段
        const summaries = ((rows as unknown[][])[0] ?? []).map((r: unknown) => {
          const row = r as Record<string, unknown>;
          const parse = (v: unknown) => {
            if (typeof v === "string") {
              try {
                return JSON.parse(v);
              } catch {
                return [];
              }
            }
            return v ?? [];
          };
          return {
            ...row,
            investmentThesis: parse(row.investmentThesis),
            catalysts: parse(row.catalysts),
            risks: parse(row.risks),
            keyMetrics: parse(row.keyMetrics),
          };
        });
        return { summaries };
      } catch {
        return { summaries: [] };
      }
    }),

  /**
   * AI 多股横向对比：对比 2-5 只股票的投资价值，生成对比报告
   */
  compareStocks: publicProcedure
    .input(
      z.object({
        tickers: z.array(z.string().min(1).max(10)).min(2).max(5),
        consensusData: z
          .array(
            z.object({
              ticker: z.string(),
              name: z.string().default(""),
              buy: z.number().default(0),
              hold: z.number().default(0),
              sell: z.number().default(0),
              targetMean: z.number().default(0),
              targetHigh: z.number().default(0),
              targetLow: z.number().default(0),
              currentPrice: z.number().default(0),
              upside: z.number().default(0),
              numAnalysts: z.number().default(0),
            })
          )
          .default([]),
      })
    )
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<{
        comparisons: Array<{
          ticker: string;
          name: string;
          score: number;
          rank: number;
          strengths: string[];
          weaknesses: string[];
          verdict: string;
        }>;
        winner: string;
        winnerReason: string;
        summary: string;
        radarData: Array<{ metric: string; [key: string]: number | string }>;
      }> => {
        const taskId = await beginResAiTask(
          Number(ctx.user?.id ?? 0),
          `RES 多股横向对比：${input.tickers.join(", ")}`
        );
        try {
          if (
            input.consensusData.length !== input.tickers.length ||
            input.consensusData.some(
              row =>
                row.numAnalysts <= 0 ||
                row.currentPrice <= 0 ||
                row.targetMean <= 0
            )
          ) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "所选标的缺少完整、可核验的一致预期，已阻止 AI 生成替代结论",
            });
          }
          const consensusMap = Object.fromEntries(
            input.consensusData.map(c => [c.ticker, c])
          );

          const stockLines = input.tickers
            .map(t => {
              const c = consensusMap[t];
              if (!c) return `${t}: 无数据`;
              const total = c.buy + c.hold + c.sell;
              const buyPct =
                total > 0 ? ((c.buy / total) * 100).toFixed(0) : "?";
              const upside =
                c.currentPrice > 0
                  ? (
                      ((c.targetMean - c.currentPrice) / c.currentPrice) *
                      100
                    ).toFixed(1)
                  : "?";
              return `${t}(${c.name || t}): 买入${buyPct}% | 目标价均值$${c.targetMean} | 当前价$${c.currentPrice} | 潜在涨幅${upside}% | 分析师${c.numAnalysts}人`;
            })
            .join("\n");

          const COMPARE_SCHEMA = {
            name: "stock_comparison",
            strict: true,
            schema: {
              type: "object" as const,
              properties: {
                comparisons: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      ticker: { type: "string" as const },
                      name: { type: "string" as const },
                      score: {
                        type: "number" as const,
                        description: "综合评分 0-100",
                      },
                      rank: {
                        type: "number" as const,
                        description: "排名，1 最优",
                      },
                      strengths: {
                        type: "array" as const,
                        items: { type: "string" as const },
                        description: "2-3 条核心优势",
                      },
                      weaknesses: {
                        type: "array" as const,
                        items: { type: "string" as const },
                        description: "1-2 条主要劣势",
                      },
                      verdict: {
                        type: "string" as const,
                        description: "一句话投资结论",
                      },
                    },
                    required: [
                      "ticker",
                      "name",
                      "score",
                      "rank",
                      "strengths",
                      "weaknesses",
                      "verdict",
                    ] as const,
                    additionalProperties: false,
                  },
                },
                winner: {
                  type: "string" as const,
                  description: "最优股票代码",
                },
                winnerReason: {
                  type: "string" as const,
                  description: "推荐理由，不超过 60 字",
                },
                summary: {
                  type: "string" as const,
                  description: "整体市场判断，不超过 80 字",
                },
                radarData: {
                  type: "array" as const,
                  description: "雷达图数据，5 个维度",
                  items: {
                    type: "object" as const,
                    properties: {
                      metric: { type: "string" as const },
                    },
                    required: ["metric"] as const,
                    additionalProperties: true,
                  },
                },
              },
              required: [
                "comparisons",
                "winner",
                "winnerReason",
                "summary",
                "radarData",
              ] as const,
              additionalProperties: false,
            },
          };

          const response = await invokeLLM({
            model: RES_AI_MODEL,
            messages: [
              {
                role: "system",
                content: `你是顶级卖方研究分析师，擅长横向对比同类股票的投资价值。
请基于提供的一致预期数据，对多只股票进行系统性横向对比分析。
评分维度（各 20 分）：买入比例、目标价上行空间、分析师覆盖广度、估值合理性、风险收益比。
输出必须严格遵循 JSON Schema，radarData 中每个对象必须包含 metric 字段和每只股票代码对应的数值字段（0-100）。`,
              },
              {
                role: "user",
                content: `请对比以下 ${input.tickers.length} 只股票的投资价值：\n\n${stockLines}\n\n请生成完整的横向对比分析报告。`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: COMPARE_SCHEMA,
            },
            max_tokens: 2000,
          });

          const content = response.choices?.[0]?.message?.content;
          if (!content)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "LLM 返回空内容",
            });
          const parsed = JSON.parse(
            typeof content === "string" ? content : JSON.stringify(content)
          );
          await finishResAiTask(taskId);
          return { ...parsed, taskId, model: RES_AI_MODEL };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await finishResAiTask(taskId, msg);
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `多股对比分析失败: ${msg}`,
          });
        }
      }
    ),

  /**
   * 获取分析师评级变更列表（真实数据 + 确定性丰富化）
   */
  getRatings: publicProcedure
    .input(
      z.object({
        tickers: z
          .array(z.string())
          .min(1)
          .max(15)
          .default([
            "NVDA",
            "AAPL",
            "MSFT",
            "TSLA",
            "META",
            "AMZN",
            "GOOGL",
            "BABA",
          ]),
      })
    )
    .query(async ({ input }) => {
      const snapshot = await fetchRealRatings(input.tickers);
      return { ...snapshot, updatedAt: Date.now() };
    }),

  /**
   * 获取单只股票一致预期数据
   */
  getConsensus: publicProcedure
    .input(z.object({ ticker: z.string().min(1).max(10) }))
    .query(async ({ input }) => {
      return fetchConsensus(input.ticker);
    }),

  /**
   * 批量获取多只股票一致预期（用于对比视图）
   */
  getConsensusBatch: publicProcedure
    .input(
      z.object({
        tickers: z
          .array(z.string())
          .min(1)
          .max(8)
          .default(["NVDA", "AAPL", "MSFT", "TSLA", "META"]),
      })
    )
    .query(async ({ input }) => {
      const results = await Promise.allSettled(
        input.tickers.map(fetchConsensus)
      );
      return results
        .filter(
          (r): r is PromiseFulfilledResult<ConsensusData> =>
            r.status === "fulfilled"
        )
        .map(r => r.value);
    }),

  /**
   * AI 总结：提取核心投资逻辑、目标价预测、催化剂、风险
   */
  summarizeReport: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(10),
        name: z.string().default(""),
        rating: z.string().default(""),
        target: z.number().optional(),
        prevTarget: z.number().optional(),
        analyst: z.string().default(""),
        currentPrice: z.number().optional(),
        consensusBuy: z.number().optional(),
        consensusHold: z.number().optional(),
        consensusSell: z.number().optional(),
        targetMean: z.number().optional(),
        targetHigh: z.number().optional(),
        targetLow: z.number().optional(),
        marketChangePct: z.number().optional(),
        sessionOpen: z.number().optional(),
        sessionHigh: z.number().optional(),
        sessionLow: z.number().optional(),
        volume: z.number().optional(),
        averageVolume20d: z.number().optional(),
        return5d: z.number().optional(),
        return20d: z.number().optional(),
        return60d: z.number().optional(),
        realizedVolatility20d: z.number().optional(),
        rangeHigh: z.number().optional(),
        rangeLow: z.number().optional(),
        maxDrawdown: z.number().optional(),
        marketTimestamp: z.string().max(64).optional(),
        source: z.string().max(160).optional(),
        extraContext: z.string().max(500).default(""),
      })
    )
    .mutation(async ({ input, ctx }): Promise<AiReportSummary> => {
      const taskId = await beginResAiTask(
        Number(ctx.user?.id ?? 0),
        `RES 一致预期投资总结：${input.ticker}`
      );
      const upside =
        input.currentPrice && input.target
          ? (
              ((input.target - input.currentPrice) / input.currentPrice) *
              100
            ).toFixed(1)
          : null;

      const consensusTotal =
        (input.consensusBuy || 0) +
        (input.consensusHold || 0) +
        (input.consensusSell || 0);
      const buyPct =
        consensusTotal > 0
          ? (((input.consensusBuy || 0) / consensusTotal) * 100).toFixed(0)
          : null;

      const userPrompt = [
        `【股票代码】${input.ticker}${input.name ? ` (${input.name})` : ""}`,
        `【分析师机构】${input.analyst || "未知"}`,
        `【最新评级】${input.rating || "未知"}`,
        input.target
          ? `【目标价】$${input.target}${input.prevTarget ? `（前值 $${input.prevTarget}）` : ""}`
          : "",
        input.currentPrice ? `【当前价】$${input.currentPrice}` : "",
        upside ? `【潜在涨幅】${upside}%` : "",
        consensusTotal > 0
          ? `【市场一致预期】买入 ${buyPct}%，共 ${consensusTotal} 位分析师覆盖`
          : "",
        input.targetMean
          ? `【一致目标价均值】$${input.targetMean}（区间 $${input.targetLow || "?"} - $${input.targetHigh || "?"}）`
          : "",
        input.marketChangePct !== undefined
          ? `【当期涨跌幅】${input.marketChangePct}%`
          : "",
        input.sessionOpen !== undefined &&
        input.sessionHigh !== undefined &&
        input.sessionLow !== undefined
          ? `【OHLC】开 ${input.sessionOpen} / 高 ${input.sessionHigh} / 低 ${input.sessionLow} / 收 ${input.currentPrice ?? "?"}`
          : "",
        input.volume !== undefined ? `【成交量】${input.volume}` : "",
        input.averageVolume20d !== undefined
          ? `【20日均量】${input.averageVolume20d}`
          : "",
        input.return5d !== undefined ? `【5日收益】${input.return5d}%` : "",
        input.return20d !== undefined ? `【20日收益】${input.return20d}%` : "",
        input.return60d !== undefined ? `【60日收益】${input.return60d}%` : "",
        input.realizedVolatility20d !== undefined
          ? `【20日年化波动率】${input.realizedVolatility20d}%`
          : "",
        input.rangeHigh !== undefined && input.rangeLow !== undefined
          ? `【六个月区间】${input.rangeLow} - ${input.rangeHigh}`
          : "",
        input.maxDrawdown !== undefined
          ? `【六个月最大回撤】${input.maxDrawdown}%`
          : "",
        input.marketTimestamp ? `【市场时间】${input.marketTimestamp}` : "",
        input.source ? `【数据来源】${input.source}` : "",
        input.extraContext ? `【补充信息】${input.extraContext}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const response = await invokeLLM({
          model: RES_AI_MODEL,
          messages: [
            {
              role: "system",
              content: `你是权益研究证据编排器，只能从用户提供的评级、目标价和行情字段中提炼摘要。
请基于已提供字段生成专业的研究证据摘要。
要求：
- 不得补写输入中不存在的公司事件、财务预测、估值倍数或分析师观点
- 没有目标价时明确说明未接入，不得自行计算目标价
- 区分公开行情观察与分析师评级数据
- 明确数据来源、市场时间以及延迟或收盘数据边界
- 所有输出严格遵循 JSON Schema`,
            },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: AI_SUMMARY_SCHEMA,
          },
          max_tokens: 1200,
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "LLM 返回空内容",
          });

        const parsed = JSON.parse(
          typeof content === "string" ? content : JSON.stringify(content)
        );

        const result = {
          ticker: input.ticker,
          investmentThesis: (parsed.investmentThesis ?? []).slice(0, 4),
          targetPriceRationale: parsed.targetPriceRationale ?? "",
          targetPrice: parsed.targetPrice || input.target || null,
          catalysts: (parsed.catalysts ?? []).slice(0, 3),
          risks: (parsed.risks ?? []).slice(0, 3),
          recommendation: parsed.recommendation ?? "hold",
          timeHorizon: parsed.timeHorizon ?? "12个月",
          keyMetrics: (parsed.keyMetrics ?? []).slice(0, 4),
          conclusion: parsed.conclusion ?? "",
          generatedAt: Date.now(),
          taskId,
          model: RES_AI_MODEL,
        };
        await finishResAiTask(taskId);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await finishResAiTask(taskId, msg);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI 总结生成失败: ${msg}`,
        });
      }
    }),

  /**
   * 按月评级分布聚合：返回指定股票过去 N 个月的买/持/卖数量
   */
  getMonthlyRatingDistribution: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(10),
        months: z.number().min(3).max(24).default(12),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [] };
      try {
        const rows = await db.execute(
          sql`SELECT
              DATE_FORMAT(rated_at, '%Y-%m') as month,
              SUM(CASE WHEN rating IN ('Buy','Strong Buy','Outperform','Overweight','Positive','买入','增持') THEN 1 ELSE 0 END) as buy,
              SUM(CASE WHEN rating IN ('Hold','Neutral','Market Perform','Equal Weight','Sector Perform','中性','持有') THEN 1 ELSE 0 END) as hold,
              SUM(CASE WHEN rating IN ('Sell','Strong Sell','Underperform','Underweight','Negative','减持','卖出') THEN 1 ELSE 0 END) as sell,
              COUNT(*) as total
            FROM analyst_ratings
            WHERE ticker = ${input.ticker}
              AND rated_at >= DATE_SUB(NOW(), INTERVAL ${input.months} MONTH)
            GROUP BY DATE_FORMAT(rated_at, '%Y-%m')
            ORDER BY month ASC`
        );
        const data =
          ((rows as unknown[][])[0] as Array<{
            month: string;
            buy: string | number;
            hold: string | number;
            sell: string | number;
            total: string | number;
          }>) ?? [];
        return {
          data: data.map(r => ({
            month: r.month,
            buy: Number(r.buy),
            hold: Number(r.hold),
            sell: Number(r.sell),
            total: Number(r.total),
          })),
        };
      } catch {
        return { data: [] };
      }
    }),

  /**
   * 目标价历史走势：返回每条评级的目标价和日期
   */
  getTargetPriceTrend: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(10),
        limit: z.number().min(10).max(200).default(60),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [] };
      try {
        const rows = await db.execute(
          sql`SELECT
              DATE_FORMAT(rated_at, '%Y-%m-%d') as date,
              target,
              current_price as currentPrice,
              rating,
              firm,
              analyst
            FROM analyst_ratings
            WHERE ticker = ${input.ticker}
              AND target IS NOT NULL
            ORDER BY rated_at ASC
            LIMIT ${input.limit}`
        );
        const data =
          ((rows as unknown[][])[0] as Array<{
            date: string;
            target: string | number;
            currentPrice: string | number | null;
            rating: string;
            firm: string;
            analyst: string;
          }>) ?? [];
        return {
          data: data.map(r => ({
            date: r.date,
            target: Number(r.target),
            currentPrice:
              r.currentPrice != null ? Number(r.currentPrice) : null,
            rating: r.rating,
            firm: r.firm,
            analyst: r.analyst,
          })),
        };
      } catch {
        return { data: [] };
      }
    }),

  /**
   * 评级变动明细：返回升级/降级/首次覆盖的明细列表
   */
  getRatingChanges: publicProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(10),
        limit: z.number().min(5).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [] };
      try {
        const rows = await db.execute(
          sql`SELECT
              id,
              DATE_FORMAT(rated_at, '%Y-%m-%d') as date,
              analyst,
              firm,
              rating,
              prev_rating as prevRating,
              target,
              prev_target as prevTarget,
              chg,
              current_price as currentPrice,
              upside
            FROM analyst_ratings
            WHERE ticker = ${input.ticker}
              AND chg IN ('upgrade','downgrade','initiate','reiterate')
            ORDER BY rated_at DESC
            LIMIT ${input.limit}`
        );
        const data =
          ((rows as unknown[][])[0] as Array<{
            id: number;
            date: string;
            analyst: string;
            firm: string;
            rating: string;
            prevRating: string | null;
            target: string | number | null;
            prevTarget: string | number | null;
            chg: string;
            currentPrice: string | number | null;
            upside: string | number | null;
          }>) ?? [];
        return {
          data: data.map(r => ({
            id: r.id,
            date: r.date,
            analyst: r.analyst,
            firm: r.firm,
            rating: r.rating,
            prevRating: r.prevRating,
            target: r.target != null ? Number(r.target) : null,
            prevTarget: r.prevTarget != null ? Number(r.prevTarget) : null,
            chg: r.chg,
            currentPrice:
              r.currentPrice != null ? Number(r.currentPrice) : null,
            upside: r.upside != null ? Number(r.upside) : null,
          })),
        };
      } catch {
        return { data: [] };
      }
    }),
});
