import { and, desc, eq, inArray, like, or } from 'drizzle-orm';
import { crossModuleResearchPathFavorites, crossModuleResearchPathNotes, crossModuleResearchPathShares, users } from '../drizzle/schema';
import { getDb } from './db';

export const RESEARCH_PATH_IDS = ['energy-fx-policy', 'fx-index-macro', 'commodity-seasonality-index'] as const;
export type ResearchPathId = typeof RESEARCH_PATH_IDS[number];
function requirePath(pathId: string): asserts pathId is ResearchPathId { if (!(RESEARCH_PATH_IDS as readonly string[]).includes(pathId)) throw new Error('RESEARCH_PATH_NOT_FOUND'); }

export async function getResearchPathAccess(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const [favorites, received] = await Promise.all([db.select().from(crossModuleResearchPathFavorites).where(eq(crossModuleResearchPathFavorites.userId, userId)), db.select().from(crossModuleResearchPathShares).where(eq(crossModuleResearchPathShares.sharedWithUserId, userId))]);
  return { favoritePathIds: favorites.map((row) => row.pathId), sharedPathIds: [...new Set(received.map((row) => row.pathId))], sharedGroups: received.map((row) => ({ pathId: row.pathId, ownerUserId: row.ownerUserId })) };
}
export async function toggleResearchPathFavorite(userId: number, pathId: string) {
  requirePath(pathId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const existing = (await db.select().from(crossModuleResearchPathFavorites).where(and(eq(crossModuleResearchPathFavorites.userId, userId), eq(crossModuleResearchPathFavorites.pathId, pathId))).limit(1))[0];
  if (existing) { await db.delete(crossModuleResearchPathFavorites).where(eq(crossModuleResearchPathFavorites.id, existing.id)); return { pathId, isFavorite: false }; }
  await db.insert(crossModuleResearchPathFavorites).values({ userId, pathId }); return { pathId, isFavorite: true };
}
export async function listResearchPathMembers(userId: number, query: string, limit: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const term = query.trim();
  const filter = term ? or(like(users.name, `%${term}%`), like(users.email, `%${term}%`)) : undefined;
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(filter).orderBy(desc(users.lastSignedIn)).limit(limit);
  return rows.filter((row) => row.id !== userId);
}
export async function listResearchPathShares(ownerUserId: number, pathId: string) {
  requirePath(pathId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select({ id: crossModuleResearchPathShares.id, sharedWithUserId: crossModuleResearchPathShares.sharedWithUserId, name: users.name, email: users.email, role: users.role, updatedAt: crossModuleResearchPathShares.updatedAt }).from(crossModuleResearchPathShares).innerJoin(users, eq(crossModuleResearchPathShares.sharedWithUserId, users.id)).where(and(eq(crossModuleResearchPathShares.ownerUserId, ownerUserId), eq(crossModuleResearchPathShares.pathId, pathId))).orderBy(desc(crossModuleResearchPathShares.updatedAt));
}
export async function shareResearchPath(ownerUserId: number, input: { pathId: string; sharedWithUserId: number }) {
  requirePath(input.pathId); if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_RESEARCH_PATH_WITH_OWNER'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const member = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0]; if (!member) throw new Error('RESEARCH_PATH_MEMBER_NOT_FOUND');
  await db.insert(crossModuleResearchPathShares).values({ ownerUserId, pathId: input.pathId, sharedWithUserId: input.sharedWithUserId }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } }); return { pathId: input.pathId, sharedWithUserId: input.sharedWithUserId };
}
export async function revokeResearchPathShare(ownerUserId: number, input: { pathId: string; sharedWithUserId: number }) {
  requirePath(input.pathId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.delete(crossModuleResearchPathShares).where(and(eq(crossModuleResearchPathShares.ownerUserId, ownerUserId), eq(crossModuleResearchPathShares.pathId, input.pathId), eq(crossModuleResearchPathShares.sharedWithUserId, input.sharedWithUserId))); return { ...input, revoked: true };
}

async function resolvePathGroupAccess(userId: number, ownerUserId: number, pathId: string) {
  requirePath(pathId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (ownerUserId === userId) return { isOwner: true };
  const share = (await db.select({ id: crossModuleResearchPathShares.id }).from(crossModuleResearchPathShares).where(and(eq(crossModuleResearchPathShares.ownerUserId, ownerUserId), eq(crossModuleResearchPathShares.pathId, pathId), eq(crossModuleResearchPathShares.sharedWithUserId, userId))).limit(1))[0];
  if (!share) throw new Error('RESEARCH_PATH_GROUP_FORBIDDEN'); return { isOwner: false };
}
export async function listResearchPathNotes(userId: number, input: { ownerUserId: number; pathId: string }) {
  await resolvePathGroupAccess(userId, input.ownerUserId, input.pathId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const notes = await db.select().from(crossModuleResearchPathNotes).where(and(eq(crossModuleResearchPathNotes.ownerUserId, input.ownerUserId), eq(crossModuleResearchPathNotes.pathId, input.pathId))).orderBy(desc(crossModuleResearchPathNotes.updatedAt)).limit(300); const personIds = [...new Set(notes.flatMap((note) => [note.authorUserId, ...(note.reviewedByUserId ? [note.reviewedByUserId] : [])]))]; const people = personIds.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, personIds)) : []; const names = new Map(people.map((person) => [person.id, person.name || person.email || `账户 ${person.id}`])); return { isOwner: input.ownerUserId === userId, notes: notes.map((note) => ({ ...note, authorName: names.get(note.authorUserId) ?? `账户 ${note.authorUserId}`, reviewerName: note.reviewedByUserId ? names.get(note.reviewedByUserId) ?? `账户 ${note.reviewedByUserId}` : null })) };
}
export async function createResearchPathNote(userId: number, input: { ownerUserId: number; pathId: string; body: string }) {
  await resolvePathGroupAccess(userId, input.ownerUserId, input.pathId); const body = input.body.trim(); if (!body) throw new Error('RESEARCH_PATH_NOTE_EMPTY'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const result = await db.insert(crossModuleResearchPathNotes).values({ ownerUserId: input.ownerUserId, pathId: input.pathId, authorUserId: userId, body }); const id = Number(result[0].insertId); if (!Number.isInteger(id) || id <= 0) throw new Error('RESEARCH_PATH_NOTE_CREATE_FAILED'); return { id, reviewStatus: 'pending' as const };
}
export async function reviewResearchPathNote(ownerUserId: number, input: { noteId: number; status: 'confirmed' | 'changes_requested'; reviewNote?: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const note = (await db.select().from(crossModuleResearchPathNotes).where(eq(crossModuleResearchPathNotes.id, input.noteId)).limit(1))[0]; if (!note) throw new Error('RESEARCH_PATH_NOTE_NOT_FOUND'); if (note.ownerUserId !== ownerUserId) throw new Error('RESEARCH_PATH_NOTE_REVIEW_FORBIDDEN'); if (note.authorUserId === ownerUserId) throw new Error('RESEARCH_PATH_OWNER_CANNOT_SELF_REVIEW'); await db.update(crossModuleResearchPathNotes).set({ reviewStatus: input.status, reviewNote: input.reviewNote?.trim() || null, reviewedByUserId: ownerUserId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(crossModuleResearchPathNotes.id, input.noteId)); return { noteId: note.id, status: input.status };
}
