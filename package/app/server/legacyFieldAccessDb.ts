import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { legacyFieldAccessAuditEvents, legacyFieldAccessGrants, users } from '../drizzle/schema';
import { getDb } from './db';

export const LEGACY_FIELD_ACCESS_SOURCE_IDS = ['SP500', 'VIXCLS', 'DGS2', 'DGS10', 'DEXUSEU', 'DEXJPUS', 'DCOILWTICO', 'WALCL', 'WRESBAL', 'FEDFUNDS', 'ECBDFR', 'ECBMRRFR', 'BOE_BANK_RATE', 'BOJ_LOAN_GROWTH', 'GASREGW', 'GASDESW', 'WCESTUS1', 'WGTSTUS1', 'WDISTUS1'] as const;
export type LegacyFieldAccessSourceId = typeof LEGACY_FIELD_ACCESS_SOURCE_IDS[number];
export type LegacyFieldAccessStatus = 'requested' | 'authorized' | 'denied';

async function appendAudit(input: { grantId: number; subjectUserId: number; actorUserId: number; action: 'requested' | 'authorized' | 'denied'; sourceId: string; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(legacyFieldAccessAuditEvents).values({ ...input, note: input.note ?? null });
}

export async function listLegacyFieldAccess(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(legacyFieldAccessGrants).where(eq(legacyFieldAccessGrants.userId, userId)).orderBy(desc(legacyFieldAccessGrants.updatedAt));
}

export async function requestLegacyFieldAccess(userId: number, input: { sourceId: LegacyFieldAccessSourceId; reason?: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(legacyFieldAccessGrants).values({ userId, sourceId: input.sourceId, status: 'requested', reason: input.reason?.trim() || null }).onDuplicateKeyUpdate({ set: { status: 'requested', reason: input.reason?.trim() || null, requestedAt: new Date(), decidedAt: null, decidedByUserId: null, updatedAt: new Date() } });
  const grant = (await db.select().from(legacyFieldAccessGrants).where(and(eq(legacyFieldAccessGrants.userId, userId), eq(legacyFieldAccessGrants.sourceId, input.sourceId))).limit(1))[0];
  if (!grant) throw new Error('LEGACY_FIELD_ACCESS_NOT_FOUND');
  await appendAudit({ grantId: grant.id, subjectUserId: userId, actorUserId: userId, action: 'requested', sourceId: grant.sourceId, note: grant.reason });
  return grant;
}

export async function listLegacyFieldAccessRequests() {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select({ id: legacyFieldAccessGrants.id, userId: legacyFieldAccessGrants.userId, userName: users.name, userEmail: users.email, sourceId: legacyFieldAccessGrants.sourceId, status: legacyFieldAccessGrants.status, reason: legacyFieldAccessGrants.reason, requestedAt: legacyFieldAccessGrants.requestedAt, decidedAt: legacyFieldAccessGrants.decidedAt, decidedByUserId: legacyFieldAccessGrants.decidedByUserId }).from(legacyFieldAccessGrants).innerJoin(users, eq(legacyFieldAccessGrants.userId, users.id)).orderBy(desc(legacyFieldAccessGrants.updatedAt));
}

export async function decideLegacyFieldAccess(adminUserId: number, input: { grantId: number; status: Exclude<LegacyFieldAccessStatus, 'requested'> }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const current = (await db.select().from(legacyFieldAccessGrants).where(eq(legacyFieldAccessGrants.id, input.grantId)).limit(1))[0];
  if (!current) throw new Error('LEGACY_FIELD_ACCESS_NOT_FOUND');
  await db.update(legacyFieldAccessGrants).set({ status: input.status, decidedAt: new Date(), decidedByUserId: adminUserId, updatedAt: new Date() }).where(eq(legacyFieldAccessGrants.id, input.grantId));
  await appendAudit({ grantId: current.id, subjectUserId: current.userId, actorUserId: adminUserId, action: input.status, sourceId: current.sourceId, note: current.reason });
  return { grantId: input.grantId, status: input.status };
}

export async function listLegacyFieldAccessAudit(input: { sourceId?: string; action?: 'requested' | 'authorized' | 'denied'; subjectUserId?: number; startAt?: Date; endAt?: Date }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const filters = [input.sourceId ? eq(legacyFieldAccessAuditEvents.sourceId, input.sourceId) : undefined, input.action ? eq(legacyFieldAccessAuditEvents.action, input.action) : undefined, input.subjectUserId ? eq(legacyFieldAccessAuditEvents.subjectUserId, input.subjectUserId) : undefined, input.startAt ? gte(legacyFieldAccessAuditEvents.createdAt, input.startAt) : undefined, input.endAt ? lte(legacyFieldAccessAuditEvents.createdAt, input.endAt) : undefined].filter(Boolean) as any[];
  return db.select({ id: legacyFieldAccessAuditEvents.id, grantId: legacyFieldAccessAuditEvents.grantId, sourceId: legacyFieldAccessAuditEvents.sourceId, action: legacyFieldAccessAuditEvents.action, subjectUserId: legacyFieldAccessAuditEvents.subjectUserId, subjectName: users.name, subjectEmail: users.email, actorUserId: legacyFieldAccessAuditEvents.actorUserId, note: legacyFieldAccessAuditEvents.note, createdAt: legacyFieldAccessAuditEvents.createdAt }).from(legacyFieldAccessAuditEvents).leftJoin(users, eq(legacyFieldAccessAuditEvents.subjectUserId, users.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(legacyFieldAccessAuditEvents.createdAt)).limit(1000);
}
