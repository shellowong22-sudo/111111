import { and, desc, eq } from 'drizzle-orm';
import { stockFsrcWatchlists, stockResearchLayouts, stockResearchPreferences, stockSecSummaryAudits } from '../drizzle/schema';
import { getDb } from './db';

export type StockLayoutItem = { id: string; visible: boolean };
export type StockSecSummary = {
  headline: string;
  headlineEvidence: string;
  keyPoints: Array<{ point: string; evidence: string }>;
  financialFacts: Array<{ label: string; period: string; value: string; evidence: string }>;
  riskAlerts: Array<{ category: string; evidence: string }>;
  sourceLimitations: string;
};
export type StockEvtsFormPreference = { forms: string[] };
export type StockCoverageSnapshot = { ticker: string; status: 'available' | 'unavailable'; points: number; latestDate: string | null };

export async function getStockResearchLayout(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(stockResearchLayouts).where(and(eq(stockResearchLayouts.userId, userId), eq(stockResearchLayouts.workspaceId, 'stock-research'))).limit(1);
  return rows[0] ?? null;
}

export async function saveStockResearchLayout(userId: number, layout: StockLayoutItem[]) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(stockResearchLayouts).values({ userId, workspaceId: 'stock-research', layout }).onDuplicateKeyUpdate({ set: { layout, updatedAt: new Date() } });
  return getStockResearchLayout(userId);
}

export async function getStockSecSummaryAudit(input: { userId: number; cik: string; accessionNumber: string; primaryDocument: string; sourceFingerprint: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(stockSecSummaryAudits).where(and(eq(stockSecSummaryAudits.userId, input.userId), eq(stockSecSummaryAudits.cik, input.cik), eq(stockSecSummaryAudits.accessionNumber, input.accessionNumber), eq(stockSecSummaryAudits.primaryDocument, input.primaryDocument), eq(stockSecSummaryAudits.sourceFingerprint, input.sourceFingerprint))).orderBy(desc(stockSecSummaryAudits.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function saveStockSecSummaryAudit(input: { userId: number; cik: string; accessionNumber: string; primaryDocument: string; sourceFingerprint: string; model: string; summary: StockSecSummary; retrievedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(stockSecSummaryAudits).values(input).onDuplicateKeyUpdate({ set: { model: input.model, summary: input.summary, retrievedAt: input.retrievedAt } });
  return getStockSecSummaryAudit(input);
}

export async function getStockEvtsFormPreference(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(stockResearchPreferences).where(and(eq(stockResearchPreferences.userId, userId), eq(stockResearchPreferences.preferenceKey, 'evts-form-filter'))).limit(1);
  return rows[0] ?? null;
}

export async function saveStockEvtsFormPreference(userId: number, preferenceValue: StockEvtsFormPreference) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(stockResearchPreferences).values({ userId, preferenceKey: 'evts-form-filter', preferenceValue }).onDuplicateKeyUpdate({ set: { preferenceValue, updatedAt: new Date() } });
  return getStockEvtsFormPreference(userId);
}

export async function getStockFsrcWatchlist(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(stockFsrcWatchlists).where(eq(stockFsrcWatchlists.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function saveStockFsrcWatchlist(input: { userId: number; tickers: string[]; coverageSnapshot: StockCoverageSnapshot[] }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(stockFsrcWatchlists).values(input).onDuplicateKeyUpdate({ set: { tickers: input.tickers, coverageSnapshot: input.coverageSnapshot, updatedAt: new Date() } });
  return getStockFsrcWatchlist(input.userId);
}
