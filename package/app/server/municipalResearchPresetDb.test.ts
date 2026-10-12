import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { deleteMunicipalResearchViewPreset, exportMunicipalResearchViewPresets, importMunicipalResearchViewPresets, listMunicipalResearchViewPresets, markMunicipalResearchViewPresetUsed, saveMunicipalResearchViewPreset, setMunicipalResearchViewPresetDefault } from './municipalResearchPresetDb';

const ownerId = 987654361;
const otherUserId = 987654362;

afterEach(async () => {
  const db = await getDb();
  await db?.execute(sql`DELETE FROM municipal_research_view_presets WHERE user_id IN (${ownerId}, ${otherUserId})`);
});

describe('账户私有地方债研究筛选配置', () => {
  it('persists, updates, restores module-scoped settings and deletes only the owner preset', async () => {
    const created = await saveMunicipalResearchViewPreset({ userId: ownerId, moduleId: 'AAA', name: 'AAA 十期观察', windowSize: 10, bucketId: '5-10y' });
    expect(created?.windowSize).toBe(10);
    expect(created?.bucketId).toBe('5-10y');
    const updated = await saveMunicipalResearchViewPreset({ id: created!.id, userId: ownerId, moduleId: 'AAA', name: 'AAA 十期观察', windowSize: 30, bucketId: '10y+' });
    expect(updated?.windowSize).toBe(30);
    expect(updated?.bucketId).toBe('10y+');
    const defaultPreset = await setMunicipalResearchViewPresetDefault(ownerId, created!.id);
    expect(defaultPreset?.isDefault).toBe(1);
    expect(await markMunicipalResearchViewPresetUsed(otherUserId, created!.id)).toBe(false);
    expect(await markMunicipalResearchViewPresetUsed(ownerId, created!.id)).toBe(true);
    expect((await listMunicipalResearchViewPresets(ownerId, 'AAA'))[0]?.id).toBe(created!.id);
    expect(await listMunicipalResearchViewPresets(otherUserId, 'AAA')).toEqual([]);
    expect(await deleteMunicipalResearchViewPreset(otherUserId, created!.id)).toBe(false);
    expect(await deleteMunicipalResearchViewPreset(ownerId, created!.id)).toBe(true);
  });

  it('exports only portable filter settings and imports them into another account without exporting data or account identity', async () => {
    await saveMunicipalResearchViewPreset({ userId: ownerId, moduleId: 'SLGS', name: '近五日活动', windowSize: 5, bucketId: null });
    const exchange = await exportMunicipalResearchViewPresets(ownerId);
    expect(exchange.format).toBe('finance-hub/municipal-research-presets');
    expect(JSON.stringify(exchange)).not.toContain(String(ownerId));
    expect(exchange.presets[0]).toMatchObject({ moduleId: 'SLGS', windowSize: 5, bucketId: null });
    const result = await importMunicipalResearchViewPresets(otherUserId, exchange, 'skip');
    expect(result.imported).toBe(1);
    expect((await listMunicipalResearchViewPresets(otherUserId, 'SLGS'))[0]?.name).toBe('近五日活动');
  });
});
