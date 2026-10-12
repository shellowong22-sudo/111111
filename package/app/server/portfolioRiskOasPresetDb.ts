import { and, desc, eq } from 'drizzle-orm';
import { portfolioRiskOasViewPresets } from '../drizzle/schema';
import { getDb } from './db';

export type OasViewPresetInput = { id?: number; userId: number; name: string; selectedBuckets: string[]; startDate?: string | null; endDate?: string | null };
const normalizeBuckets = (buckets: string[]) => [...new Set(buckets.map((bucket) => bucket.trim()).filter(Boolean))].slice(0, 8);

export async function listPortfolioRiskOasViewPresets(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(portfolioRiskOasViewPresets).where(eq(portfolioRiskOasViewPresets.userId, userId)).orderBy(desc(portfolioRiskOasViewPresets.updatedAt));
}

export async function savePortfolioRiskOasViewPreset(input: OasViewPresetInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const selectedBuckets = normalizeBuckets(input.selectedBuckets);
  if (!selectedBuckets.length) throw new Error('OAS_BUCKET_SELECTION_REQUIRED');
  const values = { name: input.name.trim(), selectedBuckets, startDate: input.startDate || null, endDate: input.endDate || null };
  if (input.id) {
    const existing = (await db.select({ id: portfolioRiskOasViewPresets.id }).from(portfolioRiskOasViewPresets).where(and(eq(portfolioRiskOasViewPresets.id, input.id), eq(portfolioRiskOasViewPresets.userId, input.userId))).limit(1))[0];
    if (!existing) throw new Error('OAS_VIEW_PRESET_NOT_FOUND');
    await db.update(portfolioRiskOasViewPresets).set({ ...values, updatedAt: new Date() }).where(and(eq(portfolioRiskOasViewPresets.id, input.id), eq(portfolioRiskOasViewPresets.userId, input.userId)));
    return (await db.select().from(portfolioRiskOasViewPresets).where(and(eq(portfolioRiskOasViewPresets.id, input.id), eq(portfolioRiskOasViewPresets.userId, input.userId))).limit(1))[0];
  }
  await db.insert(portfolioRiskOasViewPresets).values({ userId: input.userId, ...values });
  return (await db.select().from(portfolioRiskOasViewPresets).where(and(eq(portfolioRiskOasViewPresets.userId, input.userId), eq(portfolioRiskOasViewPresets.name, values.name))).limit(1))[0];
}

export async function deletePortfolioRiskOasViewPreset(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.delete(portfolioRiskOasViewPresets).where(and(eq(portfolioRiskOasViewPresets.id, id), eq(portfolioRiskOasViewPresets.userId, userId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
