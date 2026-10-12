import { and, desc, eq } from 'drizzle-orm';
import { forexSameDayTimelinePresets } from '../drizzle/schema';
import { getDb } from './db';

export type TimelinePresetFilters = { centralBankIds: string[]; pairIds: string[]; actions: string[] };
export type TimelinePresetInput = TimelinePresetFilters & { id?: number; name: string };

function unique(values: readonly string[]) { return [...new Set(values)]; }
function decode(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? unique(parsed) : []; } catch { return []; } }
function encode(values: readonly string[]) { return JSON.stringify(unique(values)); }
function serialize(row: typeof forexSameDayTimelinePresets.$inferSelect) { return { ...row, centralBankIds: decode(row.centralBankIds), pairIds: decode(row.pairIds), actions: decode(row.actions) }; }

export async function listForexSameDayTimelinePresets(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return (await db.select().from(forexSameDayTimelinePresets).where(eq(forexSameDayTimelinePresets.userId, userId)).orderBy(desc(forexSameDayTimelinePresets.updatedAt))).map(serialize);
}

export async function saveForexSameDayTimelinePreset(userId: number, input: TimelinePresetInput) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const name = input.name.trim(); if (!name) throw new Error('FOREX_TIMELINE_PRESET_NAME_REQUIRED');
  const values = { name, centralBankIds: encode(input.centralBankIds), pairIds: encode(input.pairIds), actions: encode(input.actions) };
  if (input.id) {
    const existing = (await db.select().from(forexSameDayTimelinePresets).where(and(eq(forexSameDayTimelinePresets.id, input.id), eq(forexSameDayTimelinePresets.userId, userId))).limit(1))[0];
    if (!existing) throw new Error('FOREX_TIMELINE_PRESET_NOT_FOUND');
    await db.update(forexSameDayTimelinePresets).set({ ...values, updatedAt: new Date() }).where(and(eq(forexSameDayTimelinePresets.id, input.id), eq(forexSameDayTimelinePresets.userId, userId)));
    return serialize({ ...existing, ...values, updatedAt: new Date() });
  }
  const inserted = await db.insert(forexSameDayTimelinePresets).values({ userId, ...values }); const id = Number(inserted[0].insertId);
  const created = (await db.select().from(forexSameDayTimelinePresets).where(and(eq(forexSameDayTimelinePresets.id, id), eq(forexSameDayTimelinePresets.userId, userId))).limit(1))[0];
  if (!created) throw new Error('FOREX_TIMELINE_PRESET_CREATE_FAILED'); return serialize(created);
}

export async function deleteForexSameDayTimelinePreset(userId: number, id: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const existing = (await db.select().from(forexSameDayTimelinePresets).where(and(eq(forexSameDayTimelinePresets.id, id), eq(forexSameDayTimelinePresets.userId, userId))).limit(1))[0];
  if (!existing) throw new Error('FOREX_TIMELINE_PRESET_NOT_FOUND');
  await db.delete(forexSameDayTimelinePresets).where(and(eq(forexSameDayTimelinePresets.id, id), eq(forexSameDayTimelinePresets.userId, userId)));
  return { id, deleted: true };
}

export const forexTimelinePresetCodec = { decode, encode };
