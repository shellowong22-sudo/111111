import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { deleteBondPortfolioScenarioSnapshot, listBondPortfolioScenarioSnapshots, saveBondPortfolioScenarioSnapshot } from './bondPortfolioScenarioDb';
import { getDb } from './db';

const ownerId = 987654321;
const otherUserId = 987654322;
const positions = [{ identifier: 'BOND-5Y', faceValue: 1_000_000, couponRate: 4.1, maturityYears: 5, yieldToMaturity: 4.25, frequency: 2 as const }];

afterEach(async () => {
  const db = await getDb();
  await db?.execute(sql`DELETE FROM bond_portfolio_scenario_snapshots WHERE user_id IN (${ownerId}, ${otherUserId})`);
});

describe('bond portfolio scenario snapshots', () => {
  it('saves, updates, lists and deletes only the owner’s normalized scenario input', async () => {
    const created = await saveBondPortfolioScenarioSnapshot({ userId: ownerId, name: 'Base shock', positions, magnitudeBp: 50 });

    expect(created?.positions).toEqual(positions);
    expect(created?.magnitudeBp).toBe(50);
    expect((await listBondPortfolioScenarioSnapshots(otherUserId)).some((item) => item.id === created?.id)).toBe(false);

    const updated = await saveBondPortfolioScenarioSnapshot({ id: created!.id, userId: ownerId, name: 'Base shock updated', positions, magnitudeBp: 75 });
    expect(updated?.id).toBe(created?.id);
    expect(updated?.magnitudeBp).toBe(75);
    expect(await deleteBondPortfolioScenarioSnapshot(otherUserId, created!.id)).toBe(false);
    expect(await deleteBondPortfolioScenarioSnapshot(ownerId, created!.id)).toBe(true);
    expect((await listBondPortfolioScenarioSnapshots(ownerId)).some((item) => item.id === created?.id)).toBe(false);
  });
});
