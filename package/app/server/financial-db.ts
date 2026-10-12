import { eq, and, gte, lte } from "drizzle-orm";
import { getDb } from "./db";
import { financialMetrics, financialData, creditRatings, modelPredictions, modelMetrics, ratingAgencies } from "../drizzle/schema";

// Financial Metrics Queries
export async function getFinancialMetrics() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialMetrics);
}

export async function getFinancialMetricsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialMetrics).where(eq(financialMetrics.category, category));
}

// Financial Data Queries
export async function getFinancialDataBySecurityAndYear(securityId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialData)
    .where(and(eq(financialData.securityId, securityId), eq(financialData.year, year)));
}

export async function getFinancialDataBySecurityAndMetric(securityId: number, metricId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialData)
    .where(and(eq(financialData.securityId, securityId), eq(financialData.metricId, metricId)))
    .orderBy(financialData.year);
}

export async function getFinancialDataHistorical(securityId: number, years: number = 10) {
  const db = await getDb();
  if (!db) return [];
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - years;
  return db.select().from(financialData)
    .where(and(eq(financialData.securityId, securityId), gte(financialData.year, startYear)))
    .orderBy(financialData.year);
}

// Credit Ratings Queries
export async function getCreditRatingsBySecurityId(securityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditRatings)
    .where(eq(creditRatings.securityId, securityId))
    .orderBy(creditRatings.ratingDate);
}

export async function getCreditRatingHistory(securityId: number, ratingAgency: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditRatings)
    .where(and(eq(creditRatings.securityId, securityId), eq(creditRatings.ratingAgency, ratingAgency)))
    .orderBy(creditRatings.ratingDate);
}

export async function getLatestCreditRating(securityId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(creditRatings)
    .where(eq(creditRatings.securityId, securityId))
    .orderBy(creditRatings.ratingDate)
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// Model Predictions Queries
export async function getModelPredictionsBySecurityId(securityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelPredictions)
    .where(eq(modelPredictions.securityId, securityId))
    .orderBy(modelPredictions.predictionDate);
}

export async function getModelPredictionsByModel(modelName: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelPredictions)
    .where(eq(modelPredictions.modelName, modelName))
    .orderBy(modelPredictions.predictionDate);
}

export async function getLatestModelPredictions(securityId: number, modelName: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelPredictions)
    .where(and(eq(modelPredictions.securityId, securityId), eq(modelPredictions.modelName, modelName)))
    .orderBy(modelPredictions.predictionDate)
    .limit(10);
}

// Model Metrics Queries
export async function getModelMetricsByName(modelName: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelMetrics)
    .where(eq(modelMetrics.modelName, modelName))
    .orderBy(modelMetrics.metricDate);
}

export async function getLatestModelMetrics(modelName: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(modelMetrics)
    .where(eq(modelMetrics.modelName, modelName))
    .orderBy(modelMetrics.metricDate)
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// Rating Agencies Queries
export async function getRatingAgencies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ratingAgencies);
}

export async function getRatingAgencyByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ratingAgencies)
    .where(eq(ratingAgencies.agencyCode, code));
  return result.length > 0 ? result[0] : null;
}
