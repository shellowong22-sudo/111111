/**
 * sovereignBonds.ts — 主权债券与利率市场 Router
 * 真实数据来源：Yahoo Finance（内置 API）、FRED（公开 CSV）、World Bank REST API
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { assessMarketFreshness } from "../marketFreshness";
import { readArchivedPublicDataset } from "../archivedPublicDataset";
import { archiveCanonicalObservationSeries } from "../adminMarketIngestion";
import { archivePublicDatasetObservations } from "../publicDatasetPersistence";
import {
  fetchUSTreasuryCurve,
  fetchMultipleFred,
  fetchYahooChart,
  fetchNasdaqHistorical,
  fetchFredSeries,
  fetchMultipleYahoo,
  fetchSovereignMacroData,
  fetchYieldSpreads,
  fetchTreasuryAuctions,
  fetchOfficialFinancingCalendar,
  YIELD_TICKERS,
  INTL_BOND_ETFS,
  CDS_PROXY_ETFS,
} from "../realDataService";
import {
  deleteFinancingCalendarReminderRule,
  getLatestSovereignDailyFactSnapshots,
  getSovereignDailyFactSnapshotHistory,
  listFinancingCalendarReminderNotificationHistory,
  listFinancingCalendarReminderRules,
  setFinancingCalendarReminderRuleActive,
  setFinancingCalendarReminderRulesActive,
  upsertFinancingCalendarReminderRule,
} from "../db";

// 主权国家列表（World Bank ISO2）
const SOVEREIGN_COUNTRIES = [
  "US",
  "DE",
  "JP",
  "GB",
  "FR",
  "IT",
  "ES",
  "CN",
  "BR",
  "IN",
  "MX",
  "AU",
  "CA",
  "KR",
];

function quoteFreshness(observed: Awaited<ReturnType<typeof fetchYahooChart>>) {
  const observedAt = typeof observed?.meta.observedAt === "string"
    ? observed.meta.observedAt
    : observed?.history.at(-1)?.date ?? null;
  const assessment = assessMarketFreshness({
    status: typeof observed?.meta.realtimeStatus === "string" ? observed.meta.realtimeStatus : null,
    observedAt,
  });
  return {
    observedAt,
    usable: Boolean(observed && observed.meta.persistentFallback !== true &&
      (assessment.currentAvailable || assessment.dailyAvailable)),
  };
}

export const sovereignBondsRouter = router({
  // ── 融资日历账户提醒规则：仅当前登录账户可读取和调整自己的配置 ────────────
  listFinancingCalendarReminderRules: protectedProcedure.query(
    async ({ ctx }) => ({
      success: true,
      data: await listFinancingCalendarReminderRules(ctx.user.id),
    })
  ),

  saveFinancingCalendarReminderRule: protectedProcedure
    .input(
      z.object({
        eventType: z.enum(["announcement", "auction", "settlement"]),
        countryCode: z
          .enum(["ALL", "US", "DE", "GB", "JP", "FR", "IT"])
          .default("ALL"),
        daysBeforeEvent: z.number().int().min(1).max(90),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => ({
      success: true,
      data: await upsertFinancingCalendarReminderRule({
        ...input,
        userId: ctx.user.id,
      }),
    })),

  deleteFinancingCalendarReminderRule: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => ({
      success: true,
      ...(await deleteFinancingCalendarReminderRule(ctx.user.id, input.id)),
    })),

  setFinancingCalendarReminderRuleActive: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => ({
      success: true,
      data: await setFinancingCalendarReminderRuleActive(
        ctx.user.id,
        input.id,
        input.isActive
      ),
    })),

  setFinancingCalendarReminderRulesActive: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number().int().positive()).min(1).max(50),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => ({
      success: true,
      data: await setFinancingCalendarReminderRulesActive(
        ctx.user.id,
        input.ids,
        input.isActive
      ),
    })),

  listFinancingCalendarReminderNotificationHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(500).default(30),
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          countryCode: z
            .enum(["ALL", "US", "DE", "GB", "JP", "FR", "IT"])
            .default("ALL"),
          status: z.enum(["active", "paused", "all"]).default("all"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => ({
      success: true,
      data: await listFinancingCalendarReminderNotificationHistory({
        userId: ctx.user.id,
        ...input,
      }),
    })),

  // ── 每日原始事实同步状态（仅来源、观测期、时效、覆盖模块和真实空状态）────────
  getDailyFactStatus: publicProcedure.query(async () => ({
    success: true,
    data: await getLatestSovereignDailyFactSnapshots(),
    timestamp: new Date().toISOString(),
  })),

  // ── 日度事实快照趋势：只比较连续抓取的真实快照；没有两日记录时不制造曲线 ──
  getDailyFactTrend: publicProcedure
    .input(
      z.object({
        sourceKey: z
          .enum([
            "fred-rates",
            "treasury-auctions",
            "fred-oecd-10y",
            "world-bank-macro",
          ])
          .default("fred-rates"),
        days: z.number().int().min(2).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const rows = await getSovereignDailyFactSnapshotHistory(
        input.sourceKey,
        input.days
      );
      const definitions =
        input.sourceKey === "fred-rates"
          ? [
              { key: "dgs10", label: "美国 10Y", unit: "%" },
              { key: "dgs2", label: "美国 2Y", unit: "%" },
              { key: "spread10y2y", label: "10Y–2Y 利差", unit: "%" },
            ]
          : input.sourceKey === "treasury-auctions"
            ? [
                { key: "auctionCount", label: "官方记录数", unit: "笔" },
                { key: "offeringAmount", label: "发行规模合计", unit: "USD" },
              ]
            : input.sourceKey === "fred-oecd-10y"
              ? [
                  { key: "countryCount", label: "可用国家数", unit: "个" },
                  { key: "average10y", label: "可用国家 10Y 均值", unit: "%" },
                ]
              : [{ key: "countryCount", label: "可用国家数", unit: "个" }];
      const points = rows.map(row => {
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        const series = (payload.series ?? {}) as Record<
          string,
          { value?: number } | null
        >;
        const auctions = Array.isArray(payload.auctions)
          ? (payload.auctions as Array<{ offeringAmount?: number | null }>)
          : [];
        const countries = (payload.countries ?? {}) as Record<
          string,
          { value?: number | null; gdpUsd?: number | null } | null
        >;
        const oecdValues = Object.values(countries)
          .map(item => item?.value)
          .filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value)
          );
        const macroCount = Object.values(countries).filter(
          item =>
            item &&
            Object.values(item).some(
              value => typeof value === "number" && Number.isFinite(value)
            )
        ).length;
        const metrics =
          input.sourceKey === "fred-rates"
            ? {
                dgs10: series.DGS10?.value ?? null,
                dgs2: series.DGS2?.value ?? null,
                spread10y2y: series.T10Y2Y?.value ?? null,
              }
            : input.sourceKey === "treasury-auctions"
              ? {
                  auctionCount: auctions.length,
                  offeringAmount: auctions.reduce(
                    (sum, item) => sum + (item.offeringAmount ?? 0),
                    0
                  ),
                }
              : input.sourceKey === "fred-oecd-10y"
                ? {
                    countryCount: oecdValues.length,
                    average10y: oecdValues.length
                      ? oecdValues.reduce((sum, value) => sum + value, 0) /
                        oecdValues.length
                      : null,
                  }
                : { countryCount: macroCount };
        return {
          snapshotDate: row.syncedAt.toISOString().slice(0, 10),
          observationDate: row.observationDate,
          status: row.status,
          metrics,
        };
      });
      const changes = points.map((point, index) => {
        const previous = points[index - 1];
        const difference = Object.fromEntries(
          definitions.map(({ key }) => {
            const current = point.metrics[key as keyof typeof point.metrics];
            const prior =
              previous?.metrics[key as keyof typeof previous.metrics];
            return [
              key,
              typeof current === "number" && typeof prior === "number"
                ? current - prior
                : null,
            ];
          })
        );
        return { ...point, difference };
      });
      return {
        success: true,
        sourceKey: input.sourceKey,
        definitions,
        points: changes,
        available: changes.length >= 2,
        limitation:
          changes.length >= 2
            ? "变化仅比较已保存的连续日度原始快照；不同来源的发布频率不同。"
            : "当前仅有一日或无已保存快照；系统不会构造历史曲线。每日同步形成至少两日快照后再显示跨日变化。",
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 0. 美国财政部官方拍卖结果（免费公开数据；不是二级市场实时价格）──────────
  getTreasuryAuctions: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(12) }))
    .query(async ({ input }) => {
      const data = await fetchTreasuryAuctions(input.limit);
      return {
        success: true,
        data,
        available: data.length > 0,
        source: "U.S. Treasury Fiscal Data",
        sourceUrl:
          "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/",
        timestamp: new Date().toISOString(),
        classification: "official_primary_market_auction_reference",
        limitation: data.length
          ? "官方一级市场拍卖参考，不是经授权的二级市场实时 bid/ask 或可交易报价。"
          : "官方拍卖数据本次不可用；系统未使用静态或模拟数据替代。",
      };
    }),

  // ── 多国官方融资日历：仅返回来源已发布的事件，其余国家保留来源索引/空状态 ──
  getOfficialFinancingCalendar: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(150).default(100) }))
    .query(async ({ input }) => {
      const data = await fetchOfficialFinancingCalendar(input.limit);
      return {
        success: true,
        ...data,
        timestamp: new Date().toISOString(),
        classification: "official_primary_market_financing_calendar",
      };
    }),

  // ── 1. 美国国债收益率曲线（FRED 真实数据）────────────────────────────────────
  getUSTreasuryCurve: publicProcedure.query(async () => {
    const curve = await fetchUSTreasuryCurve();
    return {
      success: true,
      data: curve,
      source: "FRED",
      timestamp: new Date().toISOString(),
    };
  }),

  // ── 2. 美国国债历史收益率（FRED 真实数据）──────────────────────────────────
  getUSTreasuryHistory: publicProcedure
    .input(
      z.object({
        series: z
          .enum([
            "DGS10",
            "DGS2",
            "DGS5",
            "DGS30",
            "DGS1MO",
            "DGS3MO",
            "T10Y2Y",
            "T10Y3M",
            "FEDFUNDS",
            "DFII10",
          ])
          .default("DGS10"),
        limit: z.number().min(20).max(1000).default(252),
      })
    )
    .query(async ({ input }) => {
      const { fetchFredSeries } = await import("../realDataService");
      const data = await fetchFredSeries(input.series, input.limit);
      const seriesNames: Record<string, string> = {
        DGS10: "US 10Y Treasury Yield",
        DGS2: "US 2Y Treasury Yield",
        DGS5: "US 5Y Treasury Yield",
        DGS30: "US 30Y Treasury Yield",
        DGS1MO: "US 1M Treasury Yield",
        DGS3MO: "US 3M Treasury Yield",
        T10Y2Y: "10Y-2Y Yield Spread",
        T10Y3M: "10Y-3M Yield Spread",
        FEDFUNDS: "Fed Funds Rate",
        DFII10: "US 10Y Real Yield (TIPS)",
      };
      return {
        success: true,
        series: input.series,
        name: seriesNames[input.series] ?? input.series,
        data,
        latest: data[data.length - 1] ?? null,
        source: "FRED",
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 3. 多系列利率对比（FRED 真实数据）──────────────────────────────────────
  getMultipleRateSeries: publicProcedure
    .input(
      z.object({
        series: z.array(z.string()).default(["DGS10", "DGS2", "FEDFUNDS"]),
      })
    )
    .query(async ({ input }) => {
      const data = await fetchMultipleFred(input.series);
      const result: Record<
        string,
        {
          name: string;
          latest: number | null;
          data: { date: string; value: number }[];
        }
      > = {};
      const seriesNames: Record<string, string> = {
        DGS10: "US 10Y",
        DGS2: "US 2Y",
        DGS5: "US 5Y",
        DGS30: "US 30Y",
        DGS1MO: "US 1M",
        DGS3MO: "US 3M",
        T10Y2Y: "10Y-2Y Spread",
        T10Y3M: "10Y-3M Spread",
        FEDFUNDS: "Fed Funds",
        DFII10: "Real 10Y",
      };
      for (const [id, pts] of Object.entries(data)) {
        result[id] = {
          name: seriesNames[id] ?? id,
          latest: pts[pts.length - 1]?.value ?? null,
          data: pts.slice(-252),
        };
      }
      return {
        success: true,
        data: result,
        source: "FRED",
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 4. 利差数据（FRED 真实数据）────────────────────────────────────────────
  getYieldSpreads: publicProcedure.query(async () => {
    const spreads = await fetchYieldSpreads();
    return {
      success: true,
      ...spreads,
      source: "FRED",
      timestamp: new Date().toISOString(),
    };
  }),

  // ── 5. 国债期货观察；不可用时保留原功能但不生成替代报价 ──────────────────
  getTreasuryFutures: publicProcedure.query(async () => {
    const symbols = ["ZN=F", "ZB=F", "ZT=F"];
    const data = await fetchMultipleYahoo(symbols, "5d", true);
    const names: Record<string, string> = {
      "ZN=F": "US 10Y T-Note Futures",
      "ZB=F": "US 30Y T-Bond Futures",
      "ZT=F": "US 2Y T-Note Futures",
    };
    let observedCount = 0;
    const result = symbols.map(s => {
      const observed = data[s];
      const validHistory = (observed?.history ?? []).filter((point) => Number.isFinite(point.value));
      const freshness = quoteFreshness(observed);
      if (freshness.usable && Number.isFinite(observed?.price) && (observed?.price ?? 0) > 0 && validHistory.length >= 2) {
        observedCount += 1;
        return { symbol: s, name: names[s], price: observed!.price, change: observed?.change ?? null, changePct: observed?.changePct ?? null, observedAt: freshness.observedAt, history: validHistory, dataMode: "OBSERVED" as const };
      }
      return { symbol: s, name: names[s], price: null, change: null, changePct: null, observedAt: freshness.observedAt, history: validHistory, dataMode: freshness.observedAt ? "ARCHIVED" as const : "UNAVAILABLE" as const };
    });
    const dataMode = observedCount === symbols.length ? "OBSERVED" : observedCount === 0 ? "UNAVAILABLE" : "MIXED";
    return {
      success: true,
      data: result,
      dataMode,
      source: dataMode === "OBSERVED" ? "日频公开观察" : dataMode === "MIXED" ? "部分日频公开观察；缺口未填值" : "当前无可用报价；可查看已有历史观测",
      timestamp: new Date().toISOString(),
    };
  }),

  // ── 6. 全球国债 ETF 观察；不可用时不生成替代报价 ─────────────────────────
  getGlobalBondETFs: publicProcedure
    .input(
      z.object({
        range: z.enum(["5d", "1mo", "3mo", "6mo", "1y"]).default("1y"),
      })
    )
    .query(async ({ input }) => {
      const etfSymbols = Object.values(INTL_BOND_ETFS).map(e => e.symbol);
      const data = await fetchMultipleYahoo(etfSymbols, input.range, true);
      const missingSymbols = etfSymbols.filter(symbol => !quoteFreshness(data[symbol]).usable);
      const nasdaqEntries = await Promise.all(missingSymbols.map(async symbol => {
        const chart = await fetchNasdaqHistorical(symbol, input.range, "etf");
        return [symbol, chart] as const;
      }));
      const nasdaq = new Map(nasdaqEntries);
      const archive = missingSymbols.length
        ? await readArchivedPublicDataset("bond.global.etf.nasdaq.daily.v1", 5000).catch(() => null)
        : null;
      const archivedValues = new Map((archive?.observations ?? [])
        .filter(row => typeof row.payload.symbol === "string")
        .map(row => [`${row.payload.symbol}|${row.date}`, row.payload.value]));
      const newObservations = nasdaqEntries.flatMap(([symbol, chart]) => {
        if (!chart || !quoteFreshness(chart).usable) return [];
        const etf = Object.values(INTL_BOND_ETFS).find(item => item.symbol === symbol);
        if (!etf) return [];
        return chart.history.filter(point => archivedValues.get(`${symbol}|${point.date}`) !== point.value)
          .map(point => ({
            date: point.date,
            symbol,
            payload: {
              value: point.value, symbol, name: etf.name, close: point.close,
              volume: point.volume, currency: chart.currency,
              frequency: "business_day", delayStatus: "end_of_day",
            },
          }));
      });
      if (newObservations.length) {
        const input = {
          moduleId: "sov-04-wb",
          dataContractId: "bond.global.etf.nasdaq.daily.v1",
          symbol: "GLOBAL_BOND_ETF_BASKET",
          fetchedAt: new Date(),
          history: newObservations,
        };
        try {
          await archiveCanonicalObservationSeries({
            ...input,
            source: "Nasdaq historical market data",
            sourceReference: "backend:nasdaq-global-bond-etfs",
            schemaVersion: "public-observation-v1",
          });
        } catch (error) {
          try {
            await archivePublicDatasetObservations(input);
          } catch (fallbackError) {
            console.warn("[WB ETF] Verified observations could not be archived", {
              reason: fallbackError instanceof Error ? fallbackError.message : "PERSISTENCE_FAILED",
            });
          }
        }
      }
      let observedCount = 0;
      const result = Object.entries(INTL_BOND_ETFS).map(([key, etf]) => {
        const yahoo = data[etf.symbol];
        const observed = quoteFreshness(yahoo).usable ? yahoo : nasdaq.get(etf.symbol) ?? null;
        const archiveHistory = (archive?.observations ?? [])
          .filter(row => row.payload.symbol === etf.symbol && typeof row.payload.value === "number" && row.payload.value > 0)
          .map(row => ({
            date: row.date,
            value: row.payload.value as number,
            close: typeof row.payload.close === "number" ? row.payload.close : row.payload.value as number,
            volume: typeof row.payload.volume === "number" ? row.payload.volume : null,
            open: null, high: null, low: null,
          }));
        const observedHistory = observed?.history ?? [];
        const freshness = quoteFreshness(observed);
        const validHistory = (freshness.usable ? observedHistory :
          archiveHistory.at(-1)?.date && archiveHistory.at(-1)!.date > (observedHistory.at(-1)?.date ?? "")
          ? archiveHistory : observedHistory.length ? observedHistory : archiveHistory)
          .filter(point => Number.isFinite(point.value));
        if (freshness.usable && Number.isFinite(observed?.price) && (observed?.price ?? 0) > 0 && validHistory.length >= 2) {
          observedCount += 1;
          return { key, symbol: etf.symbol, name: etf.name, flag: etf.flag, region: etf.region, price: observed!.price, change: observed?.change ?? null, changePct: observed?.changePct ?? null, observedAt: freshness.observedAt, history: validHistory, dataMode: "OBSERVED" as const };
        }
        const observedAt = validHistory.at(-1)?.date ?? freshness.observedAt;
        return { key, symbol: etf.symbol, name: etf.name, flag: etf.flag, region: etf.region, price: null, change: null, changePct: null, observedAt, history: validHistory, dataMode: observedAt ? "ARCHIVED" as const : "UNAVAILABLE" as const };
      });
      const dataMode = observedCount === result.length ? "OBSERVED" : observedCount === 0 ? "UNAVAILABLE" : "MIXED";
      return {
        success: true,
        data: result,
        dataMode,
        source: dataMode === "OBSERVED" ? "日频公开观察" : dataMode === "MIXED" ? "部分日频公开观察；缺口未填值" : "当前无可用报价；可查看已有历史观测",
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 7. 信用利差代理 ETF（Yahoo Finance 真实数据）────────────────────────────
  getCreditSpreadETFs: publicProcedure
    .input(
      z.object({
        range: z.enum(["5d", "1mo", "3mo", "6mo", "1y"]).default("1y"),
      })
    )
    .query(async ({ input }) => {
      const symbols = Object.values(CDS_PROXY_ETFS).map(e => e.symbol);
      const data = await fetchMultipleYahoo(symbols, input.range, true);
      const result = Object.entries(CDS_PROXY_ETFS).map(([key, etf]) => ({
        key,
        symbol: etf.symbol,
        name: etf.name,
        category: etf.category,
        price: data[etf.symbol]?.price ?? null,
        change: data[etf.symbol]?.change ?? null,
        changePct: data[etf.symbol]?.changePct ?? null,
        history: data[etf.symbol]?.history ?? [],
      }));
      return {
        success: true,
        data: result,
        source: "Yahoo Finance",
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 8. 主权国家宏观数据（World Bank 真实数据）──────────────────────────────
  getSovereignMacro: publicProcedure
    .input(
      z.object({ countries: z.array(z.string()).default(SOVEREIGN_COUNTRIES) })
    )
    .query(async ({ input }) => {
      const data = await fetchSovereignMacroData(input.countries);
      const available = Object.values(data).some(
        row =>
          row.gdpUsd !== null ||
          row.debtGdpPct !== null ||
          row.inflationPct !== null ||
          row.currentAccountPct !== null
      );
      return {
        success: true,
        data,
        available,
        source: "World Bank",
        timestamp: new Date().toISOString(),
        limitation: available
          ? null
          : "World Bank 本次请求未返回可用观测值；系统不会以静态示例或预测数据替代。",
      };
    }),

  // ── 9. 单个 ticker 详细行情（Yahoo Finance 真实数据）──────────────────────
  getTickerDetail: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        range: z.enum(["5d", "1mo", "3mo", "6mo", "1y", "2y"]).default("1y"),
      })
    )
    .query(async ({ input }) => {
      const normalized = input.symbol.trim().toUpperCase();
      if (normalized === "^TNX") {
        const rangeLimits: Record<typeof input.range, number> = {
          "5d": 10,
          "1mo": 32,
          "3mo": 90,
          "6mo": 180,
          "1y": 370,
          "2y": 740,
        };
        const points = await fetchFredSeries("DGS10", rangeLimits[input.range]);
        const latest = points.at(-1);
        const previous = points.at(-2);
        if (!latest)
          return {
            success: false,
            data: null,
            source: "FRED DGS10",
            timestamp: new Date().toISOString(),
          };
        const change = Number(
          (latest.value - (previous?.value ?? latest.value)).toFixed(4)
        );
        return {
          success: true,
          data: {
            symbol: normalized,
            price: latest.value,
            change,
            changePct: previous?.value
              ? Number(((change / previous.value) * 100).toFixed(3))
              : 0,
            currency: "%",
            history: points.map(point => ({
              ...point,
              volume: null,
              open: null,
              high: null,
              low: null,
              close: point.value,
            })),
            meta: { seriesId: "DGS10", observedAt: latest.date },
            source: "FRED DGS10",
          },
          source: "FRED DGS10",
          timestamp: new Date().toISOString(),
        };
      }

      const data = ["TLT", "IEF", "SHY"].includes(normalized)
        ? await fetchNasdaqHistorical(normalized, input.range, "etf")
        : await fetchYahooChart(normalized, input.range);
      if (!data)
        return {
          success: false,
          data: null,
          source: null,
          timestamp: new Date().toISOString(),
        };
      return {
        success: true,
        data,
        source: data.source,
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 10. 央行基准利率（FRED 真实数据）──────────────────────────────────────
  getCentralBankRates: publicProcedure.query(async () => {
    // FRED 系列：美联储利率；其他央行用 Yahoo Finance ETF 代理
    const [fredData, etfData] = await Promise.all([
      fetchMultipleFred(["FEDFUNDS", "SOFR"]),
      fetchMultipleYahoo(["^TNX", "^TYX", "^FVX", "^IRX"], "5d", true),
    ]);
    const fedRate = fredData["FEDFUNDS"]?.slice(-1)[0]?.value ?? 0;
    const sofr = fredData["SOFR"]?.slice(-1)[0]?.value ?? 0;
    const us10y = etfData["^TNX"]?.price ?? 0;
    const us30y = etfData["^TYX"]?.price ?? 0;
    const us5y = etfData["^FVX"]?.price ?? 0;
    const us3m = etfData["^IRX"]?.price ?? 0;
    return {
      success: true,
      data: {
        fedFundsRate: fedRate,
        sofr,
        us10yYield: us10y,
        us30yYield: us30y,
        us5yYield: us5y,
        us3mYield: us3m,
        // 利差
        termSpread10y2y: us10y - (etfData["^FVX"]?.price ?? 0),
      },
      source: "FRED + Yahoo Finance",
      timestamp: new Date().toISOString(),
    };
  }),

  // ── 11. AI 利率分析报告（基于真实数据）────────────────────────────────────
  generateRateAnalysis: publicProcedure
    .input(z.object({ context: z.string().optional() }))
    .mutation(async ({ input }) => {
      // 先获取真实数据
      const [curve, spreads] = await Promise.all([
        fetchUSTreasuryCurve(),
        fetchYieldSpreads(),
      ]);
      const curveStr =
        curve
          .filter((p): p is typeof p & { yield: number } => p.yield !== null)
          .map(p => `${p.tenor}: ${p.yield.toFixed(2)}%`)
          .join(", ") || "官方曲线暂无可用期限点";
      const spreadStr = `10Y-2Y: ${spreads.spread10y2y === null ? "未提供" : spreads.spread10y2y.toFixed(2)}%，10Y-3M: ${spreads.spread10y3m === null ? "未提供" : spreads.spread10y3m.toFixed(2)}%`;
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "你是专业的固定收益分析师，基于真实市场数据提供简洁的利率市场分析。",
            },
            {
              role: "user",
              content: `基于以下真实市场数据生成利率市场分析报告（300字以内）：\n收益率曲线：${curveStr}\n利差：${spreadStr}\n${input.context ? `补充背景：${input.context}` : ""}`,
            },
          ],
        });
        return {
          success: true,
          report: result.choices?.[0]?.message?.content ?? "分析报告已生成",
          dataUsed: { curve, spreads },
        };
      } catch {
        return { success: false, report: "报告生成失败", dataUsed: null };
      }
    }),
});
