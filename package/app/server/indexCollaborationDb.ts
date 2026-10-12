import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, like, or } from 'drizzle-orm';
import { getDb } from './db';
import { indexConstituentArchiveEvents, indexResearchBasketAuditEvents, indexResearchBaskets, indexResearchBasketShares, users } from '../drizzle/schema';

export type IndexBasketPermission = 'owner' | 'editor' | 'viewer' | 'none';
export type IndexBasketComponent = { ticker: string; name: string; weight: number };

type BasketInput = { basketId?: number; moduleId: string; name: string; description?: string | null; components: IndexBasketComponent[] };
const NASDAQ_ARCHIVE_SOURCES = [
  { url: 'https://ir.nasdaq.com/news-releases/news-release-details/nasdaq-100-indexr-june-2026-quarterly-changes', announcementDate: '2026-06-11', eventType: 'quarterly_reconstitution' },
  { url: 'https://ir.nasdaq.com/news-releases/news-release-details/annual-changes-nasdaq-100-indexr-2', announcementDate: '2025-12-12', eventType: 'annual_reconstitution' },
] as const;
let archiveRefresh: Promise<void> | null = null;
let archiveRefreshedAt = 0;

function cleanText(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function parseCompanyList(value: string) {
  return [...value.matchAll(/([\s\S]+?)\s*\(Nasdaq:\s*([A-Z][A-Z0-9.\-]{0,9})\)/g)].map((match) => ({ name: match[1].replace(/^\s*(?:and\s+)?[,;]?\s*/, '').trim(), ticker: match[2] })).filter((item) => item.name && item.ticker);
}

export function parseNasdaqConstituentChange(html: string, source: typeof NASDAQ_ARCHIVE_SOURCES[number]) {
  const text = cleanText(html);
  const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? text.match(/(Nasdaq-100 Index[^.]{0,160})/i)?.[1]?.trim() ?? 'Nasdaq-100 成分调整公告';
  const addedBlock = text.match(/following\s+(?:\w+\s+)?companies\s+will\s+be\s+added\s+to\s+the\s+Index\s*:\s*([\s\S]{0,3500}?)(?=\s+(?:The Nasdaq-100|As a result of|The following|About Nasdaq|Information))/i)?.[1] ?? '';
  const removedBlock = text.match(/(?:As a result of the reconstitution,\s*)?the following\s+(?:\w+\s+)?companies\s+will\s+be\s+removed\s+from\s+the\s+Index\s*:\s*([\s\S]{0,3500}?)(?=\s+(?:Information|About Nasdaq|For information))/i)?.[1] ?? '';
  const added = parseCompanyList(addedBlock); const removed = parseCompanyList(removedBlock);
  const effective = text.match(/effective[^.]{0,150}?(?:on|Monday,?|Tuesday,?|Wednesday,?|Thursday,?|Friday,?)\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/i)?.[1];
  const effectiveDate = effective ? new Date(`${effective} UTC`).toISOString().slice(0, 10) : null;
  if (!added.length && !removed.length) return null;
  const sourceFingerprint = createHash('sha256').update(JSON.stringify({ sourceUrl: source.url, indexId: 'NASDAQ-100', announcementDate: source.announcementDate, effectiveDate, eventType: source.eventType, addedTickers: added.map((item) => item.ticker).sort(), removedTickers: removed.map((item) => item.ticker).sort() })).digest('hex');
  return { sourceFingerprint, sourceInstitution: 'Nasdaq Global Indexes', sourceUrl: source.url, indexId: 'NASDAQ-100', headline: title.slice(0, 320), announcementDate: source.announcementDate, effectiveDate, eventType: source.eventType, added, removed, retrievedAt: new Date() };
}

export function validateIndexBasketComponents(components: IndexBasketComponent[]) {
  const cleaned = components.map((row) => ({ ticker: row.ticker.trim().toUpperCase(), name: row.name.trim().slice(0, 240), weight: Number(row.weight) })).filter((row) => row.ticker || row.name || Number.isFinite(row.weight));
  if (!cleaned.length || cleaned.length > 80) throw new Error('INDEX_BASKET_COMPONENTS_INVALID');
  if (cleaned.some((row) => !/^[A-Z0-9.\-]{1,20}$/.test(row.ticker) || !row.name || !Number.isFinite(row.weight) || row.weight <= 0 || row.weight > 100)) throw new Error('INDEX_BASKET_COMPONENTS_INVALID');
  if (new Set(cleaned.map((row) => row.ticker)).size !== cleaned.length) throw new Error('INDEX_BASKET_COMPONENT_DUPLICATE');
  const total = cleaned.reduce((sum, row) => sum + row.weight, 0);
  if (Math.abs(total - 100) > 0.001) throw new Error('INDEX_BASKET_WEIGHTS_NOT_100');
  return cleaned.map((row) => ({ ...row, weight: Number(row.weight.toFixed(4)) }));
}

async function basketPermission(basketId: number, userId: number): Promise<IndexBasketPermission> {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const basket = (await db.select({ userId: indexResearchBaskets.userId }).from(indexResearchBaskets).where(eq(indexResearchBaskets.id, basketId)).limit(1))[0];
  if (!basket) return 'none'; if (basket.userId === userId) return 'owner';
  const share = (await db.select({ permission: indexResearchBasketShares.permission }).from(indexResearchBasketShares).where(and(eq(indexResearchBasketShares.basketId, basketId), eq(indexResearchBasketShares.sharedWithUserId, userId))).limit(1))[0];
  return share?.permission ?? 'none';
}

function requireBasketPermission(permission: IndexBasketPermission, mode: 'view' | 'edit' | 'share') {
  const allowed = mode === 'view' ? permission !== 'none' : mode === 'edit' ? permission === 'owner' || permission === 'editor' : permission === 'owner';
  if (!allowed) throw new Error(`FORBIDDEN_INDEX_BASKET_${mode.toUpperCase()}`);
}

async function basketById(basketId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const row = (await db.select().from(indexResearchBaskets).where(eq(indexResearchBaskets.id, basketId)).limit(1))[0];
  if (!row) throw new Error('INDEX_BASKET_NOT_FOUND'); return row;
}

export async function listIndexBaskets(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const shares = await db.select({ basketId: indexResearchBasketShares.basketId, permission: indexResearchBasketShares.permission }).from(indexResearchBasketShares).where(eq(indexResearchBasketShares.sharedWithUserId, userId));
  const sharedIds = shares.map((row) => row.basketId); const permissionByBasket = new Map(shares.map((row) => [row.basketId, row.permission]));
  const rows = await db.select({ id: indexResearchBaskets.id, userId: indexResearchBaskets.userId, moduleId: indexResearchBaskets.moduleId, name: indexResearchBaskets.name, description: indexResearchBaskets.description, components: indexResearchBaskets.components, createdAt: indexResearchBaskets.createdAt, updatedAt: indexResearchBaskets.updatedAt, ownerName: users.name }).from(indexResearchBaskets).innerJoin(users, eq(indexResearchBaskets.userId, users.id)).where(or(eq(indexResearchBaskets.userId, userId), ...(sharedIds.length ? [inArray(indexResearchBaskets.id, sharedIds)] : []))).orderBy(desc(indexResearchBaskets.updatedAt), indexResearchBaskets.name);
  return rows.map((row) => ({ ...row, permission: row.userId === userId ? 'owner' as const : permissionByBasket.get(row.id) ?? 'viewer' }));
}

export async function saveIndexBasket(userId: number, input: BasketInput) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const components = validateIndexBasketComponents(input.components); const values = { moduleId: input.moduleId.trim().slice(0, 32), name: input.name.trim().slice(0, 160), description: input.description?.trim().slice(0, 1000) || null, components, updatedAt: new Date() };
  if (!values.name) throw new Error('INDEX_BASKET_NAME_REQUIRED');
  if (!input.basketId) {
    const insert = await db.insert(indexResearchBaskets).values({ userId, ...values }); const id = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
    await db.insert(indexResearchBasketAuditEvents).values({ basketId: id, actorUserId: userId, action: 'created', note: `创建指数篮子：${values.name}` }); return basketById(id);
  }
  requireBasketPermission(await basketPermission(input.basketId, userId), 'edit'); await db.update(indexResearchBaskets).set(values).where(eq(indexResearchBaskets.id, input.basketId));
  await db.insert(indexResearchBasketAuditEvents).values({ basketId: input.basketId, actorUserId: userId, action: 'updated', note: `更新指数篮子：${values.name}` }); return basketById(input.basketId);
}

export async function listIndexBasketShares(userId: number, basketId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); requireBasketPermission(await basketPermission(basketId, userId), 'share');
  return db.select({ id: indexResearchBasketShares.id, sharedWithUserId: indexResearchBasketShares.sharedWithUserId, permission: indexResearchBasketShares.permission, userName: users.name, userRole: users.role }).from(indexResearchBasketShares).innerJoin(users, eq(indexResearchBasketShares.sharedWithUserId, users.id)).where(eq(indexResearchBasketShares.basketId, basketId));
}

export async function saveIndexBasketShare(userId: number, input: { basketId: number; sharedWithUserId: number; permission: 'viewer' | 'editor' }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); requireBasketPermission(await basketPermission(input.basketId, userId), 'share');
  if (input.sharedWithUserId === userId) throw new Error('CANNOT_SHARE_INDEX_BASKET_WITH_OWNER'); const member = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0]; if (!member) throw new Error('INDEX_BASKET_MEMBER_NOT_FOUND');
  await db.insert(indexResearchBasketShares).values(input).onDuplicateKeyUpdate({ set: { permission: input.permission, updatedAt: new Date() } }); await db.insert(indexResearchBasketAuditEvents).values({ basketId: input.basketId, actorUserId: userId, action: 'shared', targetUserId: input.sharedWithUserId, note: `授予成员 ${input.permission} 权限` }); return input;
}

export async function revokeIndexBasketShare(userId: number, basketId: number, sharedWithUserId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); requireBasketPermission(await basketPermission(basketId, userId), 'share');
  await db.delete(indexResearchBasketShares).where(and(eq(indexResearchBasketShares.basketId, basketId), eq(indexResearchBasketShares.sharedWithUserId, sharedWithUserId))); await db.insert(indexResearchBasketAuditEvents).values({ basketId, actorUserId: userId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销成员篮子访问权限' }); return { basketId, sharedWithUserId, revoked: true };
}

export async function listIndexBasketAudit(userId: number, basketId: number, limit = 80) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); requireBasketPermission(await basketPermission(basketId, userId), 'view');
  return db.select({ id: indexResearchBasketAuditEvents.id, action: indexResearchBasketAuditEvents.action, note: indexResearchBasketAuditEvents.note, createdAt: indexResearchBasketAuditEvents.createdAt, actorName: users.name, targetUserId: indexResearchBasketAuditEvents.targetUserId }).from(indexResearchBasketAuditEvents).innerJoin(users, eq(indexResearchBasketAuditEvents.actorUserId, users.id)).where(eq(indexResearchBasketAuditEvents.basketId, basketId)).orderBy(desc(indexResearchBasketAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function searchIndexBasketMembers(userId: number, query: string, limit = 12) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const term = query.trim(); if (!term) return [];
  return db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(and(eq(users.id, users.id), or(like(users.name, `%${term}%`), like(users.email, `%${term}%`)))).limit(Math.min(Math.max(limit, 1), 30)).then((rows) => rows.filter((row) => row.id !== userId));
}

function parseIndexArchiveDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('INDEX_ARCHIVE_DATE_INVALID');
  return parsed;
}

async function refreshNasdaqArchive() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await Promise.all(NASDAQ_ARCHIVE_SOURCES.map(async (source) => {
    try { const response = await fetch(source.url, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'FinanceHub research archive/1.0' } }); if (!response.ok) return; const parsed = parseNasdaqConstituentChange(await response.text(), source); if (!parsed) return;
      const record = { ...parsed, announcementDate: parseIndexArchiveDate(parsed.announcementDate)!, effectiveDate: parseIndexArchiveDate(parsed.effectiveDate) };
      await db.insert(indexConstituentArchiveEvents).values(record).onDuplicateKeyUpdate({ set: { headline: record.headline, announcementDate: record.announcementDate, effectiveDate: record.effectiveDate, eventType: record.eventType, added: record.added, removed: record.removed, retrievedAt: record.retrievedAt, updatedAt: new Date() } });
    } catch { /* 不写入不可读或不可解析的事件样本 */ }
  }));
}

export async function listPublicIndexConstituentArchive(limit = 20) {
  const now = Date.now(); if (!archiveRefresh || now - archiveRefreshedAt > 5 * 60_000) archiveRefresh = refreshNasdaqArchive().then(() => { archiveRefreshedAt = Date.now(); }).finally(() => { archiveRefresh = null; }); await archiveRefresh;
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); return db.select().from(indexConstituentArchiveEvents).where(eq(indexConstituentArchiveEvents.indexId, 'NASDAQ-100')).orderBy(desc(indexConstituentArchiveEvents.announcementDate), desc(indexConstituentArchiveEvents.retrievedAt)).limit(Math.min(Math.max(limit, 1), 50));
}
