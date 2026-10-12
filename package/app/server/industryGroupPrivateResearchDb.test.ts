import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { industryGroupPrivateBatches, industryGroupPrivateObservations } from '../drizzle/schema';
import { getDb } from './db';
import { exportPrivateIndustryBatches, getPrivateIndustryDossier, importPrivateIndustryBatch } from './industryGroupPrivateResearchDb';

const userA = 960000341;
const userB = 960000342;
const cleanup = async () => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const batches = await db.select({ id: industryGroupPrivateBatches.id }).from(industryGroupPrivateBatches).where(inArray(industryGroupPrivateBatches.userId, [userA, userB])); if (batches.length) await db.delete(industryGroupPrivateObservations).where(inArray(industryGroupPrivateObservations.batchId, batches.map((batch) => batch.id))); await db.delete(industryGroupPrivateBatches).where(inArray(industryGroupPrivateBatches.userId, [userA, userB])); };

describe('行业研究账户隔离', () => {
  beforeAll(cleanup); afterAll(cleanup);
  it('does not expose another account batch through dossier or export', async () => {
    const asOfAt = new Date('2026-08-23T00:00:00Z');
    const first = await importPrivateIndustryBatch(userA, { name: 'A batch', classification: 'GICS', sourceLabel: 'A source', asOfAt, observations: [{ recordId: 'a-1', industryGroup: '半导体', metric: '毛利率', value: 55, unit: '%', observedAt: asOfAt, sourceReference: 'A-1' }] });
    await importPrivateIndustryBatch(userB, { name: 'B batch', classification: 'GICS', sourceLabel: 'B source', asOfAt, observations: [{ recordId: 'b-1', industryGroup: '软件', metric: '毛利率', value: 65, unit: '%', observedAt: asOfAt, sourceReference: 'B-1' }] });
    const hidden = await getPrivateIndustryDossier(userB, first.batchId);
    const dossier = await getPrivateIndustryDossier(userA, first.batchId);
    const exported = await exportPrivateIndustryBatches(userA);
    expect(hidden).toBeNull();
    expect(dossier?.batch).toMatchObject({ classification: 'GICS', sourceLabel: 'A source', recordCount: 1 });
    expect(dossier?.observations[0]).toMatchObject({ recordId: 'a-1', industryGroup: '半导体', metric: '毛利率', sourceReference: 'A-1' });
    expect(exported.batches).toHaveLength(1);
    expect((exported.batches[0] as any).name).toBe('A batch');
  });
});
