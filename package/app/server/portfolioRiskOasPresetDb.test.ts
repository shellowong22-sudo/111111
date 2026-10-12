import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { deletePortfolioRiskOasViewPreset, listPortfolioRiskOasViewPresets, savePortfolioRiskOasViewPreset } from './portfolioRiskOasPresetDb';

const ownerId = 987654351;
const otherUserId = 987654352;

afterEach(async () => {
  const db = await getDb();
  await db?.execute(sql`DELETE FROM portfolio_risk_oas_view_presets WHERE user_id IN (${ownerId}, ${otherUserId})`);
});

describe('账户私有 OAS 视图配置', () => {
  it('persists, updates, applies account scope and deletes only the owner preset', async () => {
    const created = await savePortfolioRiskOasViewPreset({ userId: ownerId, name: '信用对比一月', selectedBuckets: ['IG', 'BBB', 'HY'], startDate: '2026-07-01', endDate: '2026-07-31' });
    expect(created?.selectedBuckets).toEqual(['IG', 'BBB', 'HY']);
    const updated = await savePortfolioRiskOasViewPreset({ id: created!.id, userId: ownerId, name: '信用对比一月', selectedBuckets: ['AAA', 'AA'], startDate: '2026-07-05', endDate: '2026-07-31' });
    expect(updated?.selectedBuckets).toEqual(['AAA', 'AA']);
    expect((await listPortfolioRiskOasViewPresets(ownerId))[0]?.id).toBe(created!.id);
    expect(await listPortfolioRiskOasViewPresets(otherUserId)).toEqual([]);
    expect(await deletePortfolioRiskOasViewPreset(otherUserId, created!.id)).toBe(false);
    expect(await deletePortfolioRiskOasViewPreset(ownerId, created!.id)).toBe(true);
  });
});
