import { and, desc, eq } from 'drizzle-orm';
import { commodityWatchlistAlertEvents, commodityWatchlistGroups, commodityWatchlists, notifications } from '../drizzle/schema';
import { getDb } from './db';

export type CommodityWatchSnapshot = { id: string; label: string; status: 'available' | 'unavailable'; observationDate: string | null; latest: number | null };
export type CommodityWatchlistInput = { id?: number; name: string; groupId: number | null; tags: string[]; seriesIds: string[]; alertThresholdPercent: number; isActive: boolean };

export function compareCommodityWatchSnapshots(previous: CommodityWatchSnapshot[], current: CommodityWatchSnapshot[], thresholdPercent: number) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  return current.flatMap((item) => {
    const prior = previousById.get(item.id);
    if (!prior) return [];
    const valueChanged = prior.latest != null && item.latest != null && prior.latest !== 0 ? ((item.latest - prior.latest) / Math.abs(prior.latest)) * 100 : null;
    const changedState = prior.status !== item.status;
    const changedObservation = prior.observationDate !== item.observationDate;
    const meetsThreshold = thresholdPercent <= 0 || valueChanged == null || Math.abs(valueChanged) >= thresholdPercent;
    if (!changedState && (!changedObservation || !meetsThreshold)) return [];
    return [{ id: item.id, label: item.label, previousDate: prior.observationDate, currentDate: item.observationDate, previousValue: prior.latest, currentValue: item.latest, changePercent: valueChanged == null ? null : Number(valueChanged.toFixed(3)) }];
  });
}

export async function listCommodityWatchlists(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(commodityWatchlists).where(eq(commodityWatchlists.userId, userId)).orderBy(desc(commodityWatchlists.updatedAt));
}

export async function listCommodityWatchlistGroups(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(commodityWatchlistGroups).where(eq(commodityWatchlistGroups.userId, userId)).orderBy(desc(commodityWatchlistGroups.updatedAt));
}

export async function createCommodityWatchlistGroup(userId: number, input: { name: string; color: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(commodityWatchlistGroups).values({ userId, name: input.name, color: input.color });
  return (await db.select().from(commodityWatchlistGroups).where(and(eq(commodityWatchlistGroups.userId, userId), eq(commodityWatchlistGroups.name, input.name))).limit(1))[0] ?? null;
}

export async function deleteCommodityWatchlistGroup(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.transaction(async (tx) => {
    await tx.update(commodityWatchlists).set({ groupId: null, updatedAt: new Date() }).where(and(eq(commodityWatchlists.userId, userId), eq(commodityWatchlists.groupId, id)));
    await tx.delete(commodityWatchlistGroups).where(and(eq(commodityWatchlistGroups.id, id), eq(commodityWatchlistGroups.userId, userId)));
  });
  return { id, deleted: true };
}

async function ensureOwnedGroup(userId: number, groupId: number | null) {
  if (groupId == null) return;
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const group = (await db.select({ id: commodityWatchlistGroups.id }).from(commodityWatchlistGroups).where(and(eq(commodityWatchlistGroups.id, groupId), eq(commodityWatchlistGroups.userId, userId))).limit(1))[0];
  if (!group) throw new Error('FORBIDDEN_COMMODITY_WATCHLIST_GROUP');
}

export async function saveCommodityWatchlist(userId: number, input: CommodityWatchlistInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureOwnedGroup(userId, input.groupId);
  if (input.id) {
    await db.update(commodityWatchlists).set({ name: input.name, groupId: input.groupId, tags: input.tags, seriesIds: input.seriesIds, alertThresholdPercent: String(input.alertThresholdPercent), isActive: input.isActive, updatedAt: new Date() }).where(and(eq(commodityWatchlists.id, input.id), eq(commodityWatchlists.userId, userId)));
    return (await db.select().from(commodityWatchlists).where(and(eq(commodityWatchlists.id, input.id), eq(commodityWatchlists.userId, userId))).limit(1))[0] ?? null;
  }
  await db.insert(commodityWatchlists).values({ userId, name: input.name, groupId: input.groupId, tags: input.tags, seriesIds: input.seriesIds, alertThresholdPercent: String(input.alertThresholdPercent), isActive: input.isActive, latestSnapshot: [] });
  return (await db.select().from(commodityWatchlists).where(and(eq(commodityWatchlists.userId, userId), eq(commodityWatchlists.name, input.name))).limit(1))[0] ?? null;
}

export async function deleteCommodityWatchlist(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.delete(commodityWatchlists).where(and(eq(commodityWatchlists.userId, userId), eq(commodityWatchlists.id, id)));
  return { id, deleted: true };
}

export async function listCommodityWatchlistAlerts(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(commodityWatchlistAlertEvents).where(eq(commodityWatchlistAlertEvents.userId, userId)).orderBy(desc(commodityWatchlistAlertEvents.createdAt)).limit(limit);
}

export async function processCommodityWatchlistAlerts(currentSnapshot: CommodityWatchSnapshot[], userId?: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = userId ? await db.select().from(commodityWatchlists).where(and(eq(commodityWatchlists.userId, userId), eq(commodityWatchlists.isActive, true))) : await db.select().from(commodityWatchlists).where(eq(commodityWatchlists.isActive, true));
  const byId = new Map(currentSnapshot.map((item) => [item.id, item]));
  const emitted: Array<{ id: number; userId: number; title: string; content: string; type: 'alert' }> = [];
  for (const watchlist of rows) {
    const current = (watchlist.seriesIds as string[]).flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
    if (!current.length) continue;
    const previous = (watchlist.latestSnapshot as CommodityWatchSnapshot[]) ?? [];
    const threshold = Number(watchlist.alertThresholdPercent ?? 0);
    const changes = compareCommodityWatchSnapshots(previous, current, threshold);
    await db.update(commodityWatchlists).set({ latestSnapshot: current, updatedAt: new Date() }).where(eq(commodityWatchlists.id, watchlist.id));
    if (!previous.length || !changes.length) continue;
    const eventKey = `commodity-watch:${watchlist.id}:${changes.map((item) => `${item.id}:${item.currentDate ?? item.currentValue ?? 'unavailable'}`).join('|')}`;
    const changeText = changes.map((item) => item.currentDate == null ? `${item.label} 当前不可读` : `${item.label} 新观察 ${item.currentDate}${item.changePercent == null ? '' : `，变动 ${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(3)}%`}`).join('；');
    const content = `观察组合“${watchlist.name}”检测到实际公开资料变动：${changeText}。仅基于终端当前读取的公开观察，不代表实时行情或交易信号。`;
    const created = await db.transaction(async (tx) => {
      const duplicate = await tx.select({ id: commodityWatchlistAlertEvents.id }).from(commodityWatchlistAlertEvents).where(and(eq(commodityWatchlistAlertEvents.userId, watchlist.userId), eq(commodityWatchlistAlertEvents.notificationKey, eventKey))).limit(1);
      if (duplicate[0]) return null;
      const inserted = await tx.insert(commodityWatchlistAlertEvents).values({ userId: watchlist.userId, watchlistId: watchlist.id, notificationKey: eventKey, changes });
      const eventId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
      const notification = await tx.insert(notifications).values({ userId: watchlist.userId, title: `商品观察变动：${watchlist.name}`, content, type: 'alert', relatedType: 'commodity_watchlist', relatedId: watchlist.id });
      const notificationId = Number((notification as any)[0]?.insertId ?? (notification as any).insertId);
      if (eventId && notificationId) await tx.update(commodityWatchlistAlertEvents).set({ notificationId }).where(eq(commodityWatchlistAlertEvents.id, eventId));
      return notificationId ? { id: notificationId, userId: watchlist.userId, title: `商品观察变动：${watchlist.name}`, content, type: 'alert' as const } : null;
    });
    if (created) emitted.push(created);
  }
  return emitted;
}
