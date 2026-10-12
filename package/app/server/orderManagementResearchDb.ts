import { and, desc, eq, inArray } from 'drizzle-orm';
import { orderManagementResearchBatches, orderManagementResearchBatchTags, orderManagementResearchEvents } from '../drizzle/schema';
import { getDb } from './db';

export const ORDER_EVENT_TYPES = ['new', 'route', 'modify', 'cancel', 'partial_fill', 'fill', 'reject'] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];
export type ImportedOrderEvent = { eventId: string; orderId: string; parentOrderId?: string | null; eventType: OrderEventType; instrument: string; assetClass?: string | null; side: 'buy' | 'sell'; orderQty?: number | null; eventQty?: number | null; limitPrice?: number | null; executionPrice?: number | null; venue?: string | null; broker?: string | null; eventAt: Date };
type StoredEvent = ImportedOrderEvent & { id?: number };
const numeric = (value: unknown) => value == null ? null : Number(value);

export function summarizeImportedOrderEvents(input: StoredEvent[]) {
  const events = [...input].sort((left, right) => left.eventAt.getTime() - right.eventAt.getTime());
  const orders = new Map<string, StoredEvent[]>(); events.forEach((event) => orders.set(event.orderId, [...(orders.get(event.orderId) ?? []), event]));
  let submittedQty = 0; let filledQty = 0; let completed = 0; let cancelled = 0; let rejected = 0; const lifecycleMs: number[] = [];
  const venues = new Map<string, { eventCount: number; fillQty: number }>(); const daily = new Map<string, { date: string; events: number; fillQty: number; submittedQty: number }>();
  for (const rows of orders.values()) {
    const first = rows.find((row) => row.eventType === 'new'); const completedEvent = rows.find((row) => row.eventType === 'fill' || row.eventType === 'partial_fill'); const final = rows.at(-1);
    if (first?.orderQty != null) submittedQty += first.orderQty;
    if (completedEvent) { completed += 1; if (first) lifecycleMs.push(completedEvent.eventAt.getTime() - first.eventAt.getTime()); }
    if (final?.eventType === 'cancel') cancelled += 1; if (final?.eventType === 'reject') rejected += 1;
  }
  for (const event of events) {
    const key = event.venue?.trim() || '未提供场所'; const venue = venues.get(key) ?? { eventCount: 0, fillQty: 0 }; venue.eventCount += 1; if (event.eventType === 'fill' || event.eventType === 'partial_fill') { const qty = event.eventQty ?? 0; venue.fillQty += qty; filledQty += qty; } venues.set(key, venue);
    const date = event.eventAt.toISOString().slice(0, 10); const point = daily.get(date) ?? { date, events: 0, fillQty: 0, submittedQty: 0 }; point.events += 1; if (event.eventType === 'new') point.submittedQty += event.orderQty ?? 0; if (event.eventType === 'fill' || event.eventType === 'partial_fill') point.fillQty += event.eventQty ?? 0; daily.set(date, point);
  }
  return { eventCount: events.length, orderCount: orders.size, submittedQty, filledQty, fillRatioPct: submittedQty > 0 ? (filledQty / submittedQty) * 100 : null, completedOrders: completed, cancelledOrders: cancelled, rejectedOrders: rejected, averageLifecycleMs: lifecycleMs.length ? lifecycleMs.reduce((sum, value) => sum + value, 0) / lifecycleMs.length : null, venueBreakdown: [...venues.entries()].map(([venue, value]) => ({ venue, ...value })).sort((left, right) => right.eventCount - left.eventCount), daily: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)), lifecycle: [...orders.entries()].map(([orderId, rows]) => ({ orderId, instrument: rows[0]?.instrument ?? '', side: rows[0]?.side ?? 'buy', firstEventAt: rows[0]?.eventAt ?? null, latestEventAt: rows.at(-1)?.eventAt ?? null, latestEventType: rows.at(-1)?.eventType ?? null, orderQty: rows.find((row) => row.eventType === 'new')?.orderQty ?? null, filledQty: rows.filter((row) => row.eventType === 'fill' || row.eventType === 'partial_fill').reduce((sum, row) => sum + (row.eventQty ?? 0), 0) })).sort((left, right) => String(right.latestEventAt).localeCompare(String(left.latestEventAt))) };
}

export function analyzeOrderExecutionDeviation(input: StoredEvent[]) {
  const grouped = new Map<string, StoredEvent[]>(); input.forEach((event) => grouped.set(event.orderId, [...(grouped.get(event.orderId) ?? []), event]));
  const trend: Array<{ orderId: string; instrument: string; eventAt: Date; side: 'buy' | 'sell'; referencePrice: number; executionPrice: number; executionQty: number; adverseDeviationBps: number; adverseDeviationAmount: number }> = []; const orders: Array<{ orderId: string; instrument: string; side: 'buy' | 'sell'; executionCount: number; eligibleExecutionCount: number; weightedAdverseDeviationBps: number | null; adverseDeviationAmount: number | null; latestEventAt: Date | null }> = [];
  let eligibleExecutions = 0; let unavailableExecutions = 0; let weightedBpsNumerator = 0; let weightedQty = 0; let totalAdverseAmount = 0;
  for (const [orderId, events] of grouped.entries()) {
    const sorted = [...events].sort((left, right) => left.eventAt.getTime() - right.eventAt.getTime()); let referencePrice: number | null = null; let executionCount = 0; let eligibleCount = 0; let orderBpsNumerator = 0; let orderQty = 0; let orderAmount = 0;
    for (const event of sorted) {
      if (event.limitPrice != null) referencePrice = event.limitPrice;
      if (event.eventType !== 'fill' && event.eventType !== 'partial_fill') continue;
      executionCount += 1;
      if (referencePrice == null || event.executionPrice == null || event.eventQty == null || event.eventQty <= 0) { unavailableExecutions += 1; continue; }
      const adversePriceDifference = event.side === 'buy' ? event.executionPrice - referencePrice : referencePrice - event.executionPrice;
      const adverseDeviationBps = (adversePriceDifference / referencePrice) * 10_000; const adverseDeviationAmount = adversePriceDifference * event.eventQty;
      trend.push({ orderId, instrument: event.instrument, eventAt: event.eventAt, side: event.side, referencePrice, executionPrice: event.executionPrice, executionQty: event.eventQty, adverseDeviationBps, adverseDeviationAmount }); eligibleExecutions += 1; eligibleCount += 1; orderBpsNumerator += adverseDeviationBps * event.eventQty; orderQty += event.eventQty; orderAmount += adverseDeviationAmount; weightedBpsNumerator += adverseDeviationBps * event.eventQty; weightedQty += event.eventQty; totalAdverseAmount += adverseDeviationAmount;
    }
    if (executionCount > 0) orders.push({ orderId, instrument: sorted[0]?.instrument ?? '', side: sorted[0]?.side ?? 'buy', executionCount, eligibleExecutionCount: eligibleCount, weightedAdverseDeviationBps: orderQty ? orderBpsNumerator / orderQty : null, adverseDeviationAmount: orderQty ? orderAmount : null, latestEventAt: sorted.at(-1)?.eventAt ?? null });
  }
  return { eligibleExecutions, unavailableExecutions, weightedAdverseDeviationBps: weightedQty ? weightedBpsNumerator / weightedQty : null, totalAdverseDeviationAmount: weightedQty ? totalAdverseAmount : null, trend: trend.sort((left, right) => left.eventAt.getTime() - right.eventAt.getTime()), orders: orders.sort((left, right) => String(right.latestEventAt).localeCompare(String(left.latestEventAt))) };
}

export async function importOrderManagementResearchEvents(userId: number, input: { name: string; sourceLabel: string; asOfAt: Date; events: ImportedOrderEvent[] }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.insert(orderManagementResearchBatches).values({ userId, name: input.name.trim().slice(0, 120), sourceLabel: input.sourceLabel.trim().slice(0, 160), asOfAt: input.asOfAt, recordCount: input.events.length });
  const batchId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  await db.insert(orderManagementResearchEvents).values(input.events.map((event) => ({ userId, batchId, eventId: event.eventId.trim().slice(0, 120), orderId: event.orderId.trim().slice(0, 120), parentOrderId: event.parentOrderId?.trim().slice(0, 120) || null, eventType: event.eventType, instrument: event.instrument.trim().slice(0, 120), assetClass: event.assetClass?.trim().slice(0, 80) || null, side: event.side, orderQty: event.orderQty == null ? null : String(event.orderQty), eventQty: event.eventQty == null ? null : String(event.eventQty), limitPrice: event.limitPrice == null ? null : String(event.limitPrice), executionPrice: event.executionPrice == null ? null : String(event.executionPrice), venue: event.venue?.trim().slice(0, 120) || null, broker: event.broker?.trim().slice(0, 120) || null, eventAt: event.eventAt, eventPayload: null })));
  return { batchId, imported: input.events.length };
}

type BatchFilters = { query?: string; includeArchived?: 'all' | 'active' | 'archived' };
function normalizeTags(tags: string[]) { return [...new Set(tags.map((tag) => tag.trim().replace(/\s+/g, ' ')).filter(Boolean).map((tag) => tag.slice(0, 60)))].slice(0, 12); }
async function enrichOrderManagementBatches(userId: number, batches: Array<typeof orderManagementResearchBatches.$inferSelect>) { const db = await getDb(); if (!db || batches.length === 0) return batches.map((batch) => ({ ...batch, tags: [] as string[] })); const tags = await db.select().from(orderManagementResearchBatchTags).where(and(eq(orderManagementResearchBatchTags.userId, userId), inArray(orderManagementResearchBatchTags.batchId, batches.map((batch) => batch.id)))); const byBatch = new Map<number, string[]>(); tags.forEach((item) => byBatch.set(item.batchId, [...(byBatch.get(item.batchId) ?? []), item.tag])); return batches.map((batch) => ({ ...batch, tags: (byBatch.get(batch.id) ?? []).sort((left, right) => left.localeCompare(right)) })); }
export async function listOrderManagementResearchBatches(userId: number, filters: BatchFilters = {}) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const conditions = [eq(orderManagementResearchBatches.userId, userId)]; if (filters.includeArchived === 'active') conditions.push(eq(orderManagementResearchBatches.isArchived, false)); if (filters.includeArchived === 'archived') conditions.push(eq(orderManagementResearchBatches.isArchived, true)); const enriched = await enrichOrderManagementBatches(userId, await db.select().from(orderManagementResearchBatches).where(and(...conditions)).orderBy(desc(orderManagementResearchBatches.createdAt))); const query = filters.query?.trim().toLowerCase(); return query ? enriched.filter((batch) => [batch.name, batch.sourceLabel, ...batch.tags].some((value) => value.toLowerCase().includes(query))) : enriched; }
export async function updateOrderManagementResearchBatchTags(userId: number, batchId: number, tags: string[]) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const owner = (await db.select({ id: orderManagementResearchBatches.id }).from(orderManagementResearchBatches).where(and(eq(orderManagementResearchBatches.id, batchId), eq(orderManagementResearchBatches.userId, userId))).limit(1))[0]; if (!owner) return null; const normalized = normalizeTags(tags); await db.delete(orderManagementResearchBatchTags).where(and(eq(orderManagementResearchBatchTags.userId, userId), eq(orderManagementResearchBatchTags.batchId, batchId))); if (normalized.length) await db.insert(orderManagementResearchBatchTags).values(normalized.map((tag) => ({ userId, batchId, tag }))); return (await listOrderManagementResearchBatches(userId)).find((batch) => batch.id === batchId) ?? null; }
export async function setOrderManagementResearchBatchArchived(userId: number, batchId: number, isArchived: boolean) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const result = await db.update(orderManagementResearchBatches).set({ isArchived, archivedAt: isArchived ? new Date() : null }).where(and(eq(orderManagementResearchBatches.id, batchId), eq(orderManagementResearchBatches.userId, userId))); if (Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0) === 0) return null; return (await listOrderManagementResearchBatches(userId)).find((batch) => batch.id === batchId) ?? null; }

export async function getOrderManagementResearchDossier(userId: number, batchId?: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const selected = batchId ? (await db.select().from(orderManagementResearchBatches).where(and(eq(orderManagementResearchBatches.id, batchId), eq(orderManagementResearchBatches.userId, userId))).limit(1))[0] : (await db.select().from(orderManagementResearchBatches).where(eq(orderManagementResearchBatches.userId, userId)).orderBy(desc(orderManagementResearchBatches.createdAt)).limit(1))[0];
  const batch = selected ? (await enrichOrderManagementBatches(userId, [selected]))[0] : null;
  if (!batch) return null;
  const rows = await db.select().from(orderManagementResearchEvents).where(and(eq(orderManagementResearchEvents.userId, userId), eq(orderManagementResearchEvents.batchId, batch.id))).orderBy(orderManagementResearchEvents.eventAt);
  const events: StoredEvent[] = rows.map((row) => ({ eventId: row.eventId, orderId: row.orderId, parentOrderId: row.parentOrderId, eventType: row.eventType as OrderEventType, instrument: row.instrument, assetClass: row.assetClass, side: row.side as 'buy' | 'sell', orderQty: numeric(row.orderQty), eventQty: numeric(row.eventQty), limitPrice: numeric(row.limitPrice), executionPrice: numeric(row.executionPrice), venue: row.venue, broker: row.broker, eventAt: row.eventAt }));
  return { batch, ...summarizeImportedOrderEvents(events), executionDeviation: analyzeOrderExecutionDeviation(events) };
}

export function buildOrderManagementBatchComparison<T extends { batchId: number; name: string; sourceLabel: string; asOfAt: Date; recordCount: number; eventCount: number; orderCount: number; fillRatioPct: number | null; averageLifecycleMs: number | null }>(metrics: T[]) {
  const sorted = [...metrics].sort((left, right) => left.asOfAt.getTime() - right.asOfAt.getTime());
  return sorted.map((metric, index, all) => {
    const previous = all[index - 1];
    return { ...metric, previousBatchName: previous?.name ?? null, fillRatioDeltaPpt: previous && metric.fillRatioPct != null && previous.fillRatioPct != null ? metric.fillRatioPct - previous.fillRatioPct : null, lifecycleDeltaMs: previous && metric.averageLifecycleMs != null && previous.averageLifecycleMs != null ? metric.averageLifecycleMs - previous.averageLifecycleMs : null };
  });
}

export async function compareOrderManagementResearchBatches(userId: number) {
  const batches = await listOrderManagementResearchBatches(userId);
  const sorted = [...batches].sort((left, right) => left.asOfAt.getTime() - right.asOfAt.getTime());
  const metrics = await Promise.all(sorted.map(async (batch) => {
    const dossier = await getOrderManagementResearchDossier(userId, batch.id);
    if (!dossier) return null;
    return { batchId: batch.id, name: batch.name, sourceLabel: batch.sourceLabel, asOfAt: batch.asOfAt, recordCount: batch.recordCount, eventCount: dossier.eventCount, orderCount: dossier.orderCount, fillRatioPct: dossier.fillRatioPct, averageLifecycleMs: dossier.averageLifecycleMs };
  }));
  return buildOrderManagementBatchComparison(metrics.filter((metric): metric is NonNullable<typeof metric> => metric !== null));
}
