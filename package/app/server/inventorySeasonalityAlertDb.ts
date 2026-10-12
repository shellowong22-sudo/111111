import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { inventorySeasonalityAlertEvents, inventorySeasonalityAlertRules, notificationPreferences, notifications } from '../drizzle/schema';
import { getDb } from './db';

export const INVENTORY_SEASONALITY_PRODUCTS = ['WCESTUS1', 'WGTSTUS1', 'WDISTUS1'] as const;
export type InventorySeasonalityProduct = typeof INVENTORY_SEASONALITY_PRODUCTS[number];

type SeasonalityRow = {
  date: string;
  crude: number; gasoline: number; distillate: number;
  crudePriorYear: number | null; gasolinePriorYear: number | null; distillatePriorYear: number | null;
  crudeYoy: number | null; gasolineYoy: number | null; distillateYoy: number | null;
};
type Emitted = { id: number; userId: number; title: string; content: string; type: 'alert' };

const productMeta: Record<InventorySeasonalityProduct, { label: string; current: keyof SeasonalityRow; prior: keyof SeasonalityRow; difference: keyof SeasonalityRow }> = {
  WCESTUS1: { label: 'EIA 商业原油库存', current: 'crude', prior: 'crudePriorYear', difference: 'crudeYoy' },
  WGTSTUS1: { label: 'EIA 成品汽油库存', current: 'gasoline', prior: 'gasolinePriorYear', difference: 'gasolineYoy' },
  WDISTUS1: { label: 'EIA 馏分燃料油库存', current: 'distillate', prior: 'distillatePriorYear', difference: 'distillateYoy' },
};

function numeric(row: SeasonalityRow, key: keyof SeasonalityRow) { const value = row[key]; return typeof value === 'number' && Number.isFinite(value) ? value : null; }

export async function listInventorySeasonalityAlertRules(userId: number) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); return db.select().from(inventorySeasonalityAlertRules).where(eq(inventorySeasonalityAlertRules.userId, userId)); }

export async function saveInventorySeasonalityAlertRule(userId: number, input: { productId: InventorySeasonalityProduct; thresholdKbbL: number; isActive: boolean }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(inventorySeasonalityAlertRules).values({ userId, productId: input.productId, thresholdKbbL: String(input.thresholdKbbL), isActive: input.isActive }).onDuplicateKeyUpdate({ set: { thresholdKbbL: String(input.thresholdKbbL), isActive: input.isActive, updatedAt: new Date() } });
  return (await db.select().from(inventorySeasonalityAlertRules).where(and(eq(inventorySeasonalityAlertRules.userId, userId), eq(inventorySeasonalityAlertRules.productId, input.productId))).limit(1))[0];
}

export async function deleteInventorySeasonalityAlertRule(userId: number, productId: InventorySeasonalityProduct) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.delete(inventorySeasonalityAlertRules).where(and(eq(inventorySeasonalityAlertRules.userId, userId), eq(inventorySeasonalityAlertRules.productId, productId))); return { productId, deleted: true }; }

export async function listInventorySeasonalityAlertEvents(userId: number, input: { productId?: InventorySeasonalityProduct; startDate?: string; endDate?: string; deliveryStatus?: 'all' | 'read' | 'unread' | 'unlinked' }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const filters = [eq(inventorySeasonalityAlertEvents.userId, userId)];
  if (input.productId) filters.push(eq(inventorySeasonalityAlertEvents.productId, input.productId)); if (input.startDate) filters.push(gte(inventorySeasonalityAlertEvents.observationDate, input.startDate)); if (input.endDate) filters.push(lte(inventorySeasonalityAlertEvents.observationDate, input.endDate));
  if (input.deliveryStatus === 'read') filters.push(eq(notifications.isRead, true)); else if (input.deliveryStatus === 'unread') filters.push(eq(notifications.isRead, false)); else if (input.deliveryStatus === 'unlinked') filters.push(isNull(notifications.id));
  const rows = await db.select({ id: inventorySeasonalityAlertEvents.id, ruleId: inventorySeasonalityAlertEvents.ruleId, productId: inventorySeasonalityAlertEvents.productId, observationDate: inventorySeasonalityAlertEvents.observationDate, currentValueKbbL: inventorySeasonalityAlertEvents.currentValueKbbL, priorYearValueKbbL: inventorySeasonalityAlertEvents.priorYearValueKbbL, differenceKbbL: inventorySeasonalityAlertEvents.differenceKbbL, thresholdKbbL: inventorySeasonalityAlertEvents.thresholdKbbL, notificationId: inventorySeasonalityAlertEvents.notificationId, createdAt: inventorySeasonalityAlertEvents.createdAt, notificationIsRead: notifications.isRead }).from(inventorySeasonalityAlertEvents).leftJoin(notifications, and(eq(inventorySeasonalityAlertEvents.notificationId, notifications.id), eq(notifications.userId, userId))).where(and(...filters)).orderBy(desc(inventorySeasonalityAlertEvents.observationDate), desc(inventorySeasonalityAlertEvents.createdAt)).limit(500);
  return rows.map((row) => ({ ...row, deliveryStatus: row.notificationId === null ? 'unlinked' as const : row.notificationIsRead ? 'read' as const : 'unread' as const }));
}

export async function processInventorySeasonalityAlerts(rows: SeasonalityRow[]) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const latest = rows.at(-1); if (!latest) return [] as Emitted[];
  const rules = await db.select().from(inventorySeasonalityAlertRules).where(eq(inventorySeasonalityAlertRules.isActive, true)); const emitted: Emitted[] = [];
  for (const rule of rules) {
    if (!INVENTORY_SEASONALITY_PRODUCTS.includes(rule.productId as InventorySeasonalityProduct)) continue;
    const productId = rule.productId as InventorySeasonalityProduct; const meta = productMeta[productId]; const current = numeric(latest, meta.current); const prior = numeric(latest, meta.prior); const difference = numeric(latest, meta.difference); const threshold = Number(rule.thresholdKbbL);
    if (current === null || prior === null || difference === null || !Number.isFinite(threshold) || Math.abs(difference) < threshold) continue;
    const pref = (await db.select({ marketAlerts: notificationPreferences.marketAlerts }).from(notificationPreferences).where(eq(notificationPreferences.userId, rule.userId)).limit(1))[0]; if (pref && !pref.marketAlerts) continue;
    const key = `inventory-seasonality:${productId}:${threshold}:${latest.date}:${difference}`; const direction = difference > 0 ? '高于' : '低于'; const content = `${meta.label} 最新实际观察日为 ${latest.date}，本期 ${current.toLocaleString()} 千桶，上年同 ISO 周实际值 ${prior.toLocaleString()} 千桶，差异 ${difference.toLocaleString()} 千桶，绝对差达到账户阈值 ${threshold.toLocaleString()} 千桶。`;
    const created = await db.transaction(async (tx) => { const existing = await tx.select({ id: inventorySeasonalityAlertEvents.id }).from(inventorySeasonalityAlertEvents).where(and(eq(inventorySeasonalityAlertEvents.userId, rule.userId), eq(inventorySeasonalityAlertEvents.notificationKey, key))).limit(1); if (existing[0]) return null; const inserted = await tx.insert(inventorySeasonalityAlertEvents).values({ notificationKey: key, ruleId: rule.id, userId: rule.userId, productId, observationDate: latest.date, currentValueKbbL: String(current), priorYearValueKbbL: String(prior), differenceKbbL: String(difference), thresholdKbbL: String(threshold) }); const eventId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId); const notification = await tx.insert(notifications).values({ userId: rule.userId, title: `EIA 季节性差异提醒：${meta.label}`, content: `${content} 当前值${direction}上年同周；仅比较两条实际发布观察，不作因果或交易推断。`, type: 'alert', relatedType: 'inventory_seasonality', relatedId: eventId }); const id = Number((notification as any)[0]?.insertId ?? (notification as any).insertId); await tx.update(inventorySeasonalityAlertEvents).set({ notificationId: id }).where(eq(inventorySeasonalityAlertEvents.id, eventId)); return id ? { id, userId: rule.userId, title: `EIA 季节性差异提醒：${meta.label}`, content, type: 'alert' as const } : null; });
    if (created) emitted.push(created);
  }
  return emitted;
}
