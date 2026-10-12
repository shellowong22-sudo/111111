import { and, desc, eq } from 'drizzle-orm';
import { bondPortfolioScenarioSnapshots } from '../drizzle/schema';
import { getDb } from './db';

export type BondScenarioPosition = {
  identifier: string;
  faceValue: number;
  couponRate: number;
  maturityYears: number;
  yieldToMaturity: number;
  frequency: 1 | 2 | 4;
};

export async function listBondPortfolioScenarioSnapshots(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(bondPortfolioScenarioSnapshots).where(eq(bondPortfolioScenarioSnapshots.userId, userId)).orderBy(desc(bondPortfolioScenarioSnapshots.updatedAt));
}

export async function saveBondPortfolioScenarioSnapshot(input: { id?: number; userId: number; name: string; positions: BondScenarioPosition[]; magnitudeBp: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const name = input.name.trim();
  if (input.id) {
    const existing = (await db.select({ id: bondPortfolioScenarioSnapshots.id }).from(bondPortfolioScenarioSnapshots).where(and(eq(bondPortfolioScenarioSnapshots.id, input.id), eq(bondPortfolioScenarioSnapshots.userId, input.userId))).limit(1))[0];
    if (!existing) throw new Error('SCENARIO_SNAPSHOT_NOT_FOUND');
    await db.update(bondPortfolioScenarioSnapshots).set({ name, positions: input.positions, magnitudeBp: input.magnitudeBp, updatedAt: new Date() }).where(and(eq(bondPortfolioScenarioSnapshots.id, input.id), eq(bondPortfolioScenarioSnapshots.userId, input.userId)));
    return (await db.select().from(bondPortfolioScenarioSnapshots).where(eq(bondPortfolioScenarioSnapshots.id, input.id)).limit(1))[0];
  }
  await db.insert(bondPortfolioScenarioSnapshots).values({ userId: input.userId, name, positions: input.positions, magnitudeBp: input.magnitudeBp });
  return (await db.select().from(bondPortfolioScenarioSnapshots).where(and(eq(bondPortfolioScenarioSnapshots.userId, input.userId), eq(bondPortfolioScenarioSnapshots.name, name))).limit(1))[0];
}

export async function deleteBondPortfolioScenarioSnapshot(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.delete(bondPortfolioScenarioSnapshots).where(and(eq(bondPortfolioScenarioSnapshots.id, id), eq(bondPortfolioScenarioSnapshots.userId, userId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
