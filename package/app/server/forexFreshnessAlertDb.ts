import { and, eq } from 'drizzle-orm';
import { forexFreshnessAlertRules } from '../drizzle/schema';
import { getDb } from './db';

export const FX_FRESHNESS_SERIES_IDS = ['DEXUSEU', 'DEXUSUK', 'DEXJPUS', 'DEXCAUS', 'DEXSZUS'] as const;
export type ForexFreshnessSeriesId = typeof FX_FRESHNESS_SERIES_IDS[number];
export type ForexFreshnessRuleInput = { seriesId: ForexFreshnessSeriesId; thresholdHours: number; isActive: boolean };

export async function listForexFreshnessAlertRules(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(forexFreshnessAlertRules).where(eq(forexFreshnessAlertRules.userId, userId));
}

export async function saveForexFreshnessAlertRule(userId: number, input: ForexFreshnessRuleInput) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(forexFreshnessAlertRules).values({ userId, ...input }).onDuplicateKeyUpdate({ set: { thresholdHours: input.thresholdHours, isActive: input.isActive, updatedAt: new Date() } });
  return (await db.select().from(forexFreshnessAlertRules).where(and(eq(forexFreshnessAlertRules.userId, userId), eq(forexFreshnessAlertRules.seriesId, input.seriesId))).limit(1))[0];
}

export async function deleteForexFreshnessAlertRule(userId: number, seriesId: ForexFreshnessSeriesId) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.delete(forexFreshnessAlertRules).where(and(eq(forexFreshnessAlertRules.userId, userId), eq(forexFreshnessAlertRules.seriesId, seriesId)));
  return { seriesId, deleted: true };
}
