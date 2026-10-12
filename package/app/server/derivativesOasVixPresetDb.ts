import { and, desc, eq } from 'drizzle-orm';
import { derivativesOasVixDatePresets } from '../drizzle/schema';
import { getDb } from './db';

export type DerivativesOasVixDatePresetInput = { id?: number; name: string; rangeAStart: string; rangeAEnd: string; rangeBStart: string; rangeBEnd: string };

export async function listDerivativesOasVixDatePresets(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(derivativesOasVixDatePresets).where(eq(derivativesOasVixDatePresets.userId, userId)).orderBy(desc(derivativesOasVixDatePresets.updatedAt));
}

export async function saveDerivativesOasVixDatePreset(userId: number, input: DerivativesOasVixDatePresetInput) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const name = input.name.trim(); if (!name) throw new Error('DERIVATIVES_OAS_VIX_PRESET_NAME_REQUIRED');
  const values = { name, rangeAStart: input.rangeAStart, rangeAEnd: input.rangeAEnd, rangeBStart: input.rangeBStart, rangeBEnd: input.rangeBEnd };
  if (input.id) {
    const existing = (await db.select().from(derivativesOasVixDatePresets).where(and(eq(derivativesOasVixDatePresets.id, input.id), eq(derivativesOasVixDatePresets.userId, userId))).limit(1))[0];
    if (!existing) throw new Error('DERIVATIVES_OAS_VIX_PRESET_NOT_FOUND');
    await db.update(derivativesOasVixDatePresets).set({ ...values, updatedAt: new Date() }).where(and(eq(derivativesOasVixDatePresets.id, input.id), eq(derivativesOasVixDatePresets.userId, userId)));
    return { ...existing, ...values, updatedAt: new Date() };
  }
  const inserted = await db.insert(derivativesOasVixDatePresets).values({ userId, ...values }); const id = Number(inserted[0].insertId);
  const created = (await db.select().from(derivativesOasVixDatePresets).where(and(eq(derivativesOasVixDatePresets.id, id), eq(derivativesOasVixDatePresets.userId, userId))).limit(1))[0];
  if (!created) throw new Error('DERIVATIVES_OAS_VIX_PRESET_CREATE_FAILED'); return created;
}

export async function deleteDerivativesOasVixDatePreset(userId: number, id: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const existing = (await db.select().from(derivativesOasVixDatePresets).where(and(eq(derivativesOasVixDatePresets.id, id), eq(derivativesOasVixDatePresets.userId, userId))).limit(1))[0];
  if (!existing) throw new Error('DERIVATIVES_OAS_VIX_PRESET_NOT_FOUND');
  await db.delete(derivativesOasVixDatePresets).where(and(eq(derivativesOasVixDatePresets.id, id), eq(derivativesOasVixDatePresets.userId, userId)));
  return { id, deleted: true };
}
