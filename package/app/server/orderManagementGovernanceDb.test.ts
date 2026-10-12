import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { importOrderManagementResearchEvents } from './orderManagementResearchDb';
import { exportArchivedOrderManagementResearch, getOrderManagementDeviationAlertSettings, listOrderManagementOrderReviewAudits, runOrderManagementArchiveRule, saveOrderManagementArchiveRule, saveOrderManagementDeviationAlertSettings, saveOrderManagementOrderReview } from './orderManagementGovernanceDb';

const ownerId = 987654381;
const otherUserId = 987654382;
const buildEvent = (id: string, orderId: string, eventType: 'new' | 'fill', at: Date) => ({ eventId: id, orderId, eventType, instrument: 'TEST-BOND', side: 'buy' as const, orderQty: eventType === 'new' ? 10 : null, eventQty: eventType === 'fill' ? 10 : null, limitPrice: 100, executionPrice: eventType === 'fill' ? 101 : null, eventAt: at });

afterEach(async () => { const db = await getDb(); await db?.execute(sql`DELETE FROM order_management_order_review_audits WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_order_reviews WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_deviation_alert_settings WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_archive_rules WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_research_batch_tags WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_research_events WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_research_batches WHERE user_id IN (${ownerId}, ${otherUserId})`); });

describe('账户私有交易订单处置、阈值与归档治理', () => {
  it('keeps review notes and alert thresholds isolated while preserving an immutable review audit', async () => {
    const imported = await importOrderManagementResearchEvents(ownerId, { name: '异常批次', sourceLabel: 'OMS', asOfAt: new Date('2026-08-01T00:00:00Z'), events: [buildEvent('R-1', 'ORDER-R', 'new', new Date('2026-08-01T00:00:00Z'))] });
    expect(await saveOrderManagementOrderReview(otherUserId, { batchId: imported.batchId, orderId: 'ORDER-R', status: 'resolved', note: '越权' })).toBeNull();
    const review = await saveOrderManagementOrderReview(ownerId, { batchId: imported.batchId, orderId: 'ORDER-R', status: 'investigating', note: '核对限价' });
    expect(review).toMatchObject({ status: 'investigating', note: '核对限价' });
    expect(await saveOrderManagementOrderReview(ownerId, { batchId: imported.batchId, orderId: 'ORDER-R', status: 'resolved', note: '已确认' })).toMatchObject({ status: 'resolved' });
    expect((await listOrderManagementOrderReviewAudits(ownerId, imported.batchId, 'ORDER-R')).map((audit) => audit.action)).toEqual(['updated', 'created']);
    expect((await saveOrderManagementDeviationAlertSettings(ownerId, 42.5)).thresholdBps).toBe(42.5);
    expect(await getOrderManagementDeviationAlertSettings(otherUserId)).toMatchObject({ thresholdBps: 25, persisted: false });
  });

  it('archives only batches matched by the owner rule and exports only archived normalized records', async () => {
    const old = await importOrderManagementResearchEvents(ownerId, { name: '历史批次', sourceLabel: 'OMS', asOfAt: new Date('2026-07-01T00:00:00Z'), events: [buildEvent('A-1', 'ORDER-A', 'new', new Date('2026-07-01T00:00:00Z'))] });
    const fresh = await importOrderManagementResearchEvents(ownerId, { name: '近期批次', sourceLabel: 'OMS', asOfAt: new Date('2026-08-21T00:00:00Z'), events: [buildEvent('B-1', 'ORDER-B', 'new', new Date('2026-08-21T00:00:00Z'))] });
    await importOrderManagementResearchEvents(otherUserId, { name: '其他账户', sourceLabel: 'OMS', asOfAt: new Date('2026-07-01T00:00:00Z'), events: [buildEvent('X-1', 'ORDER-X', 'new', new Date('2026-07-01T00:00:00Z'))] });
    const rule = await saveOrderManagementArchiveRule(ownerId, { name: '30 天历史归档', conditionType: 'age', ageDays: 30, cronExpression: '0 0 2 * * *', isEnabled: true });
    expect(await runOrderManagementArchiveRule(ownerId, rule!.id)).toMatchObject({ archived: 1, skipped: null });
    const exported = await exportArchivedOrderManagementResearch(ownerId);
    expect(exported.batches).toHaveLength(1);
    expect(exported.batches[0]).toMatchObject({ id: old.batchId, name: '历史批次' });
    expect(exported.batches[0]?.events.map((event) => event.orderId)).toEqual(['ORDER-A']);
    expect(exported.batches.some((batch) => batch.id === fresh.batchId)).toBe(false);
    expect(JSON.stringify(exported)).not.toContain(String(ownerId));
  });

  it('does not auto-archive a batch when an order has conflicting latest-time event states', async () => {
    const at = new Date('2026-08-01T00:00:00Z');
    const ambiguous = await importOrderManagementResearchEvents(ownerId, { name: '时间冲突批次', sourceLabel: 'OMS', asOfAt: at, events: [buildEvent('C-1', 'ORDER-C', 'new', at), buildEvent('C-2', 'ORDER-C', 'fill', at)] });
    const final = await importOrderManagementResearchEvents(ownerId, { name: '终态批次', sourceLabel: 'OMS', asOfAt: at, events: [buildEvent('D-1', 'ORDER-D', 'new', new Date('2026-08-01T00:00:00Z')), buildEvent('D-2', 'ORDER-D', 'fill', new Date('2026-08-01T00:00:01Z'))] });
    const rule = await saveOrderManagementArchiveRule(ownerId, { name: '仅终态', conditionType: 'terminal', cronExpression: '0 0 2 * * *', isEnabled: true });
    expect(await runOrderManagementArchiveRule(ownerId, rule!.id)).toMatchObject({ archived: 1 });
    const exported = await exportArchivedOrderManagementResearch(ownerId);
    expect(exported.batches.map((batch) => batch.id)).toEqual([final.batchId]);
    expect(exported.batches.some((batch) => batch.id === ambiguous.batchId)).toBe(false);
  });
});
