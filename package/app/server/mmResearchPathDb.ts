import { desc, eq, sql } from 'drizzle-orm';
import { mmResearchPathFavorites } from '../drizzle/schema';
import { getDb } from './db';

export type ResearchPathInput = { fromModuleId: string; toModuleId: string };

export async function listMmResearchPathFavorites(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(mmResearchPathFavorites)
    .where(eq(mmResearchPathFavorites.userId, userId))
    .orderBy(desc(mmResearchPathFavorites.isFavorited), desc(mmResearchPathFavorites.usageCount), desc(mmResearchPathFavorites.lastUsedAt));
}

export async function toggleMmResearchPathFavorite(userId: number, input: ResearchPathInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const current = (await db.select().from(mmResearchPathFavorites).where(eq(mmResearchPathFavorites.userId, userId))).find((item) => item.fromModuleId === input.fromModuleId && item.toModuleId === input.toModuleId);
  if (!current) {
    await db.insert(mmResearchPathFavorites).values({ userId, ...input, isFavorited: true });
  } else {
    await db.update(mmResearchPathFavorites).set({ isFavorited: !current.isFavorited, updatedAt: new Date() }).where(eq(mmResearchPathFavorites.id, current.id));
  }
  return (await db.select().from(mmResearchPathFavorites).where(eq(mmResearchPathFavorites.userId, userId))).find((item) => item.fromModuleId === input.fromModuleId && item.toModuleId === input.toModuleId);
}

export async function recordMmResearchPathUsage(userId: number, input: ResearchPathInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  await db.insert(mmResearchPathFavorites).values({ userId, ...input, usageCount: 1, lastUsedAt: now, isFavorited: false }).onDuplicateKeyUpdate({
    set: { usageCount: sql`${mmResearchPathFavorites.usageCount} + 1`, lastUsedAt: now, updatedAt: now },
  });
  return (await db.select().from(mmResearchPathFavorites).where(eq(mmResearchPathFavorites.userId, userId))).find((item) => item.fromModuleId === input.fromModuleId && item.toModuleId === input.toModuleId);
}
