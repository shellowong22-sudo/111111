import { and, desc, eq } from 'drizzle-orm';
import { municipalResearchViewPresets } from '../drizzle/schema';
import { getDb } from './db';

export const MUNICIPAL_RESEARCH_MODULE_IDS = ['1', 'MSRC', 'SMUN', 'AAA', 'BTMM', 'PICK', 'MBWD', 'CDRN', 'CDRC', 'CDRA', 'CNDS', 'CDRV', 'DEAL', 'CACT', 'MCAL', 'MBIX', 'VRDN', 'BMA', 'BOOM', 'MSRB', 'SLGS'] as const;
export type MunicipalResearchModuleId = (typeof MUNICIPAL_RESEARCH_MODULE_IDS)[number];
export type MunicipalResearchPresetInput = { id?: number; userId: number; moduleId: MunicipalResearchModuleId; name: string; windowSize: 5 | 10 | 30; bucketId?: string | null };

export async function listMunicipalResearchViewPresets(userId: number, moduleId: MunicipalResearchModuleId) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.userId, userId), eq(municipalResearchViewPresets.moduleId, moduleId))).orderBy(desc(municipalResearchViewPresets.isDefault), desc(municipalResearchViewPresets.lastUsedAt), desc(municipalResearchViewPresets.updatedAt));
}

export async function saveMunicipalResearchViewPreset(input: MunicipalResearchPresetInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const values = { moduleId: input.moduleId, name: input.name.trim(), windowSize: input.windowSize, bucketId: input.bucketId?.trim() || null, lastUsedAt: new Date() };
  if (input.id) {
    const existing = (await db.select({ id: municipalResearchViewPresets.id }).from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.id, input.id), eq(municipalResearchViewPresets.userId, input.userId))).limit(1))[0];
    if (!existing) throw new Error('MUNICIPAL_RESEARCH_PRESET_NOT_FOUND');
    await db.update(municipalResearchViewPresets).set({ ...values, updatedAt: new Date() }).where(and(eq(municipalResearchViewPresets.id, input.id), eq(municipalResearchViewPresets.userId, input.userId)));
    return (await db.select().from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.id, input.id), eq(municipalResearchViewPresets.userId, input.userId))).limit(1))[0];
  }
  await db.insert(municipalResearchViewPresets).values({ userId: input.userId, ...values });
  return (await db.select().from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.userId, input.userId), eq(municipalResearchViewPresets.moduleId, input.moduleId), eq(municipalResearchViewPresets.name, values.name))).limit(1))[0];
}

export async function setMunicipalResearchViewPresetDefault(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const existing = (await db.select({ id: municipalResearchViewPresets.id, moduleId: municipalResearchViewPresets.moduleId }).from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.id, id), eq(municipalResearchViewPresets.userId, userId))).limit(1))[0];
  if (!existing) throw new Error('MUNICIPAL_RESEARCH_PRESET_NOT_FOUND');
  await db.transaction(async (tx) => {
    await tx.update(municipalResearchViewPresets).set({ isDefault: 0 }).where(and(eq(municipalResearchViewPresets.userId, userId), eq(municipalResearchViewPresets.moduleId, existing.moduleId)));
    await tx.update(municipalResearchViewPresets).set({ isDefault: 1, lastUsedAt: new Date(), updatedAt: new Date() }).where(and(eq(municipalResearchViewPresets.id, id), eq(municipalResearchViewPresets.userId, userId)));
  });
  return (await db.select().from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.id, id), eq(municipalResearchViewPresets.userId, userId))).limit(1))[0];
}

export async function markMunicipalResearchViewPresetUsed(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.update(municipalResearchViewPresets).set({ lastUsedAt: new Date(), updatedAt: new Date() }).where(and(eq(municipalResearchViewPresets.id, id), eq(municipalResearchViewPresets.userId, userId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function deleteMunicipalResearchViewPreset(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.delete(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.id, id), eq(municipalResearchViewPresets.userId, userId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export type MunicipalResearchPresetExchange = { format: 'finance-hub/municipal-research-presets'; version: 1; exportedAt: string; presets: Array<{ moduleId: MunicipalResearchModuleId; name: string; windowSize: 5 | 10 | 30; bucketId: string | null; isDefault: boolean }> };

export async function exportMunicipalResearchViewPresets(userId: number): Promise<MunicipalResearchPresetExchange> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(municipalResearchViewPresets).where(eq(municipalResearchViewPresets.userId, userId)).orderBy(municipalResearchViewPresets.moduleId, municipalResearchViewPresets.name);
  return { format: 'finance-hub/municipal-research-presets', version: 1, exportedAt: new Date().toISOString(), presets: rows.map((row) => ({ moduleId: row.moduleId as MunicipalResearchModuleId, name: row.name, windowSize: row.windowSize as 5 | 10 | 30, bucketId: row.bucketId, isDefault: Number(row.isDefault) === 1 })) };
}

export async function importMunicipalResearchViewPresets(userId: number, exchange: MunicipalResearchPresetExchange, onConflict: 'skip' | 'replace') {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (exchange.format !== 'finance-hub/municipal-research-presets' || exchange.version !== 1) throw new Error('MUNICIPAL_RESEARCH_PRESET_IMPORT_FORMAT_INVALID');
  let imported = 0; let skipped = 0;
  const defaults = new Map<MunicipalResearchModuleId, number>();
  for (const item of exchange.presets.slice(0, 200)) {
    const existing = (await db.select({ id: municipalResearchViewPresets.id }).from(municipalResearchViewPresets).where(and(eq(municipalResearchViewPresets.userId, userId), eq(municipalResearchViewPresets.moduleId, item.moduleId), eq(municipalResearchViewPresets.name, item.name))).limit(1))[0];
    if (existing && onConflict === 'skip') { skipped += 1; continue; }
    const values = { moduleId: item.moduleId, name: item.name.trim(), windowSize: item.windowSize, bucketId: item.bucketId?.trim() || null, isDefault: 0, lastUsedAt: new Date(), updatedAt: new Date() };
    let id: number;
    if (existing) { await db.update(municipalResearchViewPresets).set(values).where(and(eq(municipalResearchViewPresets.id, existing.id), eq(municipalResearchViewPresets.userId, userId))); id = existing.id; } else { const result = await db.insert(municipalResearchViewPresets).values({ userId, ...values }); id = Number((result as any)[0]?.insertId ?? (result as any).insertId); }
    if (item.isDefault) defaults.set(item.moduleId, id);
    imported += 1;
  }
  for (const [moduleId, id] of defaults) await setMunicipalResearchViewPresetDefault(userId, id);
  return { imported, skipped, defaultModules: [...defaults.keys()] };
}
