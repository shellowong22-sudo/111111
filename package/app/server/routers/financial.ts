import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getFinancialMetrics,
  getFinancialMetricsByCategory,
  getFinancialDataBySecurityAndYear,
  getFinancialDataBySecurityAndMetric,
  getFinancialDataHistorical,
  getCreditRatingsBySecurityId,
  getCreditRatingHistory,
  getLatestCreditRating,
  getModelPredictionsBySecurityId,
  getModelPredictionsByModel,
  getLatestModelPredictions,
  getModelMetricsByName,
  getLatestModelMetrics,
  getRatingAgencies,
  getRatingAgencyByCode,
} from "../financial-db";

export const financialRouter = router({
  // Financial Metrics endpoints
  getMetrics: publicProcedure.query(() => getFinancialMetrics()),

  getMetricsByCategory: publicProcedure
    .input(z.object({ category: z.string() }))
    .query(({ input }) => getFinancialMetricsByCategory(input.category)),

  // Financial Data endpoints
  getFinancialDataByYear: publicProcedure
    .input(z.object({ securityId: z.number(), year: z.number() }))
    .query(({ input }) => getFinancialDataBySecurityAndYear(input.securityId, input.year)),

  getFinancialDataByMetric: publicProcedure
    .input(z.object({ securityId: z.number(), metricId: z.number() }))
    .query(({ input }) => getFinancialDataBySecurityAndMetric(input.securityId, input.metricId)),

  getFinancialDataHistorical: publicProcedure
    .input(z.object({ securityId: z.number(), years: z.number().optional() }))
    .query(({ input }) => getFinancialDataHistorical(input.securityId, input.years)),

  // Credit Ratings endpoints
  getCreditRatings: publicProcedure
    .input(z.object({ securityId: z.number() }))
    .query(({ input }) => getCreditRatingsBySecurityId(input.securityId)),

  getCreditRatingHistory: publicProcedure
    .input(z.object({ securityId: z.number(), ratingAgency: z.string() }))
    .query(({ input }) => getCreditRatingHistory(input.securityId, input.ratingAgency)),

  getLatestCreditRating: publicProcedure
    .input(z.object({ securityId: z.number() }))
    .query(({ input }) => getLatestCreditRating(input.securityId)),

  // Model Predictions endpoints
  getModelPredictions: publicProcedure
    .input(z.object({ securityId: z.number() }))
    .query(({ input }) => getModelPredictionsBySecurityId(input.securityId)),

  getModelPredictionsByModel: publicProcedure
    .input(z.object({ modelName: z.string() }))
    .query(({ input }) => getModelPredictionsByModel(input.modelName)),

  getLatestModelPredictions: publicProcedure
    .input(z.object({ securityId: z.number(), modelName: z.string() }))
    .query(({ input }) => getLatestModelPredictions(input.securityId, input.modelName)),

  // Model Metrics endpoints
  getModelMetrics: publicProcedure
    .input(z.object({ modelName: z.string() }))
    .query(({ input }) => getModelMetricsByName(input.modelName)),

  getLatestModelMetrics: publicProcedure
    .input(z.object({ modelName: z.string() }))
    .query(({ input }) => getLatestModelMetrics(input.modelName)),

  // Rating Agencies endpoints
  getRatingAgencies: publicProcedure.query(() => getRatingAgencies()),

  getRatingAgencyByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ input }) => getRatingAgencyByCode(input.code)),
});
