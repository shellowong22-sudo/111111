import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { economicCalendarAnomalyEvents, portfolioRiskEventActionAudits, portfolioRiskEventActions } from '../drizzle/schema';
import { getDb } from './db';

export type PortfolioRiskEventStatus = 'open' | 'reviewing' | 'resolved';

export async function listPortfolioRiskEvents(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const events = await db.select().from(economicCalendarAnomalyEvents).where(eq(economicCalendarAnomalyEvents.userId, userId)).orderBy(desc(economicCalendarAnomalyEvents.createdAt)).limit(120);
  if (!events.length) return [];
  const actions = await db.select().from(portfolioRiskEventActions).where(and(eq(portfolioRiskEventActions.userId, userId), inArray(portfolioRiskEventActions.sourceEventId, events.map((event) => event.id))));
  const byEvent = new Map(actions.map((action) => [action.sourceEventId, action]));
  return events.map((event) => ({ ...event, action: byEvent.get(event.id) ?? null }));
}

export async function updatePortfolioRiskEventAction(userId: number, input: { sourceEventId: number; status: PortfolioRiskEventStatus; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const event = (await db.select({ id: economicCalendarAnomalyEvents.id }).from(economicCalendarAnomalyEvents).where(and(eq(economicCalendarAnomalyEvents.id, input.sourceEventId), eq(economicCalendarAnomalyEvents.userId, userId))).limit(1))[0];
  if (!event) throw new Error('PORTFOLIO_RISK_EVENT_NOT_FOUND');
  const note = input.note?.trim().slice(0, 800) || null;
  const existing = (await db.select().from(portfolioRiskEventActions).where(and(eq(portfolioRiskEventActions.userId, userId), eq(portfolioRiskEventActions.sourceEventId, event.id))).limit(1))[0];
  await db.insert(portfolioRiskEventActions).values({ userId, sourceEventId: event.id, status: input.status, note, handledByUserId: userId }).onDuplicateKeyUpdate({ set: { status: input.status, note, handledByUserId: userId, updatedAt: new Date() } });
  await db.insert(portfolioRiskEventActionAudits).values({ userId, sourceEventId: event.id, previousStatus: existing?.status ?? null, status: input.status, note, handledByUserId: userId });
  return (await db.select().from(portfolioRiskEventActions).where(and(eq(portfolioRiskEventActions.userId, userId), eq(portfolioRiskEventActions.sourceEventId, event.id))).limit(1))[0] ?? null;
}

export async function listPortfolioRiskEventActionAudits(userId: number, input: { sourceEventId?: number; status?: PortfolioRiskEventStatus; memberId?: number; dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (input.memberId !== undefined && input.memberId !== userId) return [];
  const conditions = [eq(portfolioRiskEventActionAudits.userId, userId)];
  if (input.sourceEventId) conditions.push(eq(portfolioRiskEventActionAudits.sourceEventId, input.sourceEventId));
  if (input.status) conditions.push(eq(portfolioRiskEventActionAudits.status, input.status));
  if (input.memberId) conditions.push(eq(portfolioRiskEventActionAudits.handledByUserId, input.memberId));
  if (input.dateFrom) conditions.push(gte(portfolioRiskEventActionAudits.createdAt, input.dateFrom));
  if (input.dateTo) conditions.push(lte(portfolioRiskEventActionAudits.createdAt, input.dateTo));
  return db.select().from(portfolioRiskEventActionAudits).where(and(...conditions)).orderBy(desc(portfolioRiskEventActionAudits.createdAt)).limit(180);
}
