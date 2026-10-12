import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { readArchivedFxReference } from "../archivedFxReference";
import { readArchivedPublicDataset } from "../archivedPublicDataset";
import { MANAGED_PUBLIC_DATASETS } from "../adminPublicDatasetIngestion";
import { readArchivedModuleDatasets } from "../archivedModuleDatasets";
import { readArchivedFundDetail, searchArchivedFunds } from "../archivedFundSearch";
import { readFundHoldingsDisclosure } from "../fundHoldingsData";
import {
  fetchAlphaVantageDailySeries,
  fetchBlsPublicSeries,
  fetchEcbReferenceRate,
  fetchEiaWeeklyNaturalGasStorage,
  fetchEurostatEu27Unemployment,
  fetchHkmaDailyExchangeRates,
  fetchBankOfCanadaFx,
  fetchFredPublicSeries,
  fetchImfDataMapperSeries,
  fetchNyFedLatest,
  fetchNormalizedImfForecastMatrix,
  fetchNormalizedMoneyMarketSnapshot,
  fetchPublicFxPair,
  fetchSecCompanyFacts,
  fetchStooqDailySeries,
  fetchTwelveDataDailySeries,
  fetchTreasuryTotalPublicDebt,
  fetchWorldBankIndicator,
  listFreeMarketDataSources,
  listOptionalMarketDataSources,
} from "../freeMarketData";

/**
 * Read-only public-data endpoints. Terminal archive responses expose only
 * cleaned observations and availability. Provider, collection and ingestion
 * audit metadata remain on authenticated administration surfaces.
 */
export const freeMarketDataRouter = router({
  archivedFxReference: publicProcedure.query(() => readArchivedFxReference()),
  searchFundArchive: publicProcedure
    .input(z.object({
      query: z.string().trim().max(80).default(""),
      page: z.number().int().min(0).max(1_000).default(0),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(({ input }) => searchArchivedFunds(input.query, input.page, input.limit)),
  fundArchiveDetail: publicProcedure
    .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
    .query(({ input }) => readArchivedFundDetail(input.code)),
  fundHoldingsDisclosure: publicProcedure
    .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
    .query(({ input }) => readFundHoldingsDisclosure(input.code)),
  compareFundArchive: publicProcedure
    .input(z.object({ codes: z.array(z.string().regex(/^\d{6}$/)).min(1).max(4) }))
    .query(async ({ input }) => Promise.all([...new Set(input.codes)].map(async code => ({
      code,
      observations: await readArchivedFundDetail(code),
    })))),
  archivedPublicDataset: publicProcedure
    .input(z.object({
      dataContractId: z.enum(MANAGED_PUBLIC_DATASETS.map(item => item.dataContractId) as [string, ...string[]]),
      limit: z.number().int().min(1).max(5000).default(240),
    }))
    .query(({ input }) => readArchivedPublicDataset(input.dataContractId, input.limit)),
  archivedPublicDatasetsForPath: publicProcedure
    .input(z.object({ path: z.string().trim().startsWith("/").max(300), limit: z.number().int().min(1).max(5000).default(2500) }))
    .query(({ input }) => readArchivedModuleDatasets(input.path, input.limit)),
  catalog: publicProcedure.query(() => ({
    retrievedAt: new Date().toISOString(),
    sources: listFreeMarketDataSources(),
    optionalSources: listOptionalMarketDataSources().map(source => ({
      ...source,
      configured: Boolean(process.env[source.apiKeyEnvName]?.trim()),
    })),
    limitation:
      "目录只描述公开数据源和时效边界，不代表当前每个来源均可用；请以各适配器返回的 available、observedAt 和 limitation 为准。",
  })),
  stooqHistory: publicProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1).max(32),
        limit: z.number().int().min(1).max(5000).default(252),
      })
    )
    .query(({ input }) => fetchStooqDailySeries(input.symbol, input.limit)),
  fredSeries: publicProcedure
    .input(
      z.object({
        seriesId: z.string().trim().min(1).max(32),
        limit: z.number().int().min(1).max(5000).default(252),
      })
    )
    .query(({ input }) => fetchFredPublicSeries(input.seriesId, input.limit)),
  secCompanyFacts: publicProcedure
    .input(
      z.object({
        cik: z.string().trim().min(1).max(14),
        tags: z.array(z.string().trim().min(2).max(128)).max(24).optional(),
        limit: z.number().int().min(1).max(2000).default(120),
      })
    )
    .query(({ input }) =>
      fetchSecCompanyFacts(input.cik, input.tags, input.limit)
    ),
  ecbReferenceRate: publicProcedure
    .input(
      z.object({
        pair: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{3}\/[A-Za-z]{3}$/),
        days: z.number().int().min(7).max(365).default(30),
      })
    )
    .query(({ input }) => fetchEcbReferenceRate(input.pair, input.days)),
  publicFxPair: publicProcedure
    .input(
      z.object({
        pair: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{3}\/[A-Za-z]{3}$/),
      })
    )
    .query(({ input }) => fetchPublicFxPair(input.pair)),
  nyFedLatest: publicProcedure.query(() => fetchNyFedLatest()),
  moneyMarketSnapshot: publicProcedure.query(() =>
    fetchNormalizedMoneyMarketSnapshot()
  ),
  worldBankIndicator: publicProcedure
    .input(
      z.object({
        country: z.string().trim().min(2).max(3),
        indicator: z.string().trim().min(2).max(80),
        limit: z.number().int().min(1).max(1000).default(60),
      })
    )
    .query(({ input }) =>
      fetchWorldBankIndicator(input.country, input.indicator, input.limit)
    ),
  blsSeries: publicProcedure
    .input(z.object({
      seriesId: z.string().trim().min(4).max(32),
      startYear: z.number().int().min(1900).max(2200).optional(),
      endYear: z.number().int().min(1900).max(2200).optional(),
      limit: z.number().int().min(1).max(5000).default(240),
    }))
    .query(({ input }) => fetchBlsPublicSeries(input.seriesId, input.startYear, input.endYear, input.limit)),
  eiaNaturalGasStorage: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(5000).default(260) }).optional())
    .query(({ input }) => fetchEiaWeeklyNaturalGasStorage(input?.limit ?? 260)),
  treasuryTotalPublicDebt: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(10_000).default(1_000) }).optional())
    .query(({ input }) => fetchTreasuryTotalPublicDebt(input?.limit ?? 1_000)),
  imfSeries: publicProcedure
    .input(z.object({
      indicator: z.enum(["NGDP_RPCH", "PCPIPCH"]),
      economy: z.string().trim().min(2).max(16).default("WEOWORLD"),
      limit: z.number().int().min(1).max(200).default(80),
    }))
    .query(({ input }) => fetchImfDataMapperSeries(input.indicator, input.economy, input.limit)),
  imfForecastMatrix: publicProcedure
    .input(z.object({
      economies: z.array(z.string().trim().min(2).max(16)).min(1).max(24).optional(),
    }).optional())
    .query(({ input }) => fetchNormalizedImfForecastMatrix(input?.economies)),
  eurostatEu27Unemployment: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(1_000).default(120) }).optional())
    .query(({ input }) => fetchEurostatEu27Unemployment(input?.limit ?? 120)),
  hkmaDailyExchangeRates: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(1_000).default(100) }).optional())
    .query(({ input }) => fetchHkmaDailyExchangeRates(input?.limit ?? 100)),
  bankOfCanadaFx: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(1_000).default(100) }).optional())
    .query(({ input }) => fetchBankOfCanadaFx(input?.limit ?? 100)),
  twelveDataDaily: publicProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1).max(64),
        limit: z.number().int().min(1).max(5000).default(252),
      })
    )
    .query(({ input }) =>
      fetchTwelveDataDailySeries(input.symbol, input.limit)
    ),
  alphaVantageDaily: publicProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1).max(32),
        limit: z.number().int().min(1).max(5000).default(100),
      })
    )
    .query(({ input }) =>
      fetchAlphaVantageDailySeries(input.symbol, input.limit)
    ),
});
