import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { exportElectronicTradingResearchBatches, getElectronicTradingQualitySettings, importElectronicTradingResearchEvents, listElectronicTradingExecutionReviewAudits, saveElectronicTradingExecutionReview, saveElectronicTradingQualitySettings } from './electronicTradingResearchDb';

const ownerId = 987654391;
const otherUserId = 987654392;
const event = (eventId: string, orderId: string, eventType: 'new' | 'fill', eventAt: Date) => ({ eventId, orderId, eventType, instrument: 'TEST-EXEC', side: 'buy' as const, orderQty: eventType === 'new' ? 10 : null, eventQty: eventType === 'fill' ? 10 : null, referencePrice: 100, executionPrice: eventType === 'fill' ? 101 : null, venue: 'OWNER-VENUE', eventAt });

afterEach(async () => { const db = await getDb(); await db?.execute(sql`DELETE FROM electronic_trading_execution_review_audits WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM electronic_trading_execution_reviews WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM electronic_trading_quality_settings WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM electronic_trading_research_events WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM electronic_trading_research_batches WHERE user_id IN (${ownerId}, ${otherUserId})`); });

describe('电子交易账户私有研究数据层', () => {
  it('isolates execution reviews and quality settings while appending audit records', async () => {
    const imported = await importElectronicTradingResearchEvents(ownerId, { name: '自有执行批次', sourceLabel: '授权 OMS 导出', asOfAt: new Date('2026-08-22T00:00:00Z'), events: [event('ET-1', 'ORDER-ET', 'new', new Date('2026-08-22T00:00:00Z'))] });
    expect(await saveElectronicTradingExecutionReview(otherUserId, { batchId: imported.batchId, orderId: 'ORDER-ET', status: 'resolved', note: '越权' })).toBeNull();
    expect(await saveElectronicTradingExecutionReview(ownerId, { batchId: imported.batchId, orderId: 'ORDER-ET', status: 'investigating', note: '核对场所回执' })).toMatchObject({ status: 'investigating', note: '核对场所回执' });
    expect(await saveElectronicTradingExecutionReview(ownerId, { batchId: imported.batchId, orderId: 'ORDER-ET', status: 'resolved', note: '已复核' })).toMatchObject({ status: 'resolved' });
    expect((await listElectronicTradingExecutionReviewAudits(ownerId, imported.batchId, 'ORDER-ET')).map((audit) => audit.status)).toEqual(['resolved', 'investigating']);
    expect(await saveElectronicTradingQualitySettings(ownerId, { adverseDeviationThresholdBps: 31.25, latencyThresholdSeconds: 120 })).toEqual({ adverseDeviationThresholdBps: 31.25, latencyThresholdSeconds: 120 });
    expect(await getElectronicTradingQualitySettings(otherUserId)).toEqual({ adverseDeviationThresholdBps: 25, latencyThresholdSeconds: 300 });
  });

  it('exports only the current account normalized batches without raw uploads or another account records', async () => {
    const mine = await importElectronicTradingResearchEvents(ownerId, { name: '我的批次', sourceLabel: '自有执行日志', asOfAt: new Date('2026-08-22T00:00:00Z'), events: [event('ET-2', 'ORDER-MINE', 'new', new Date('2026-08-22T00:00:00Z')), event('ET-3', 'ORDER-MINE', 'fill', new Date('2026-08-22T00:00:05Z'))] });
    await importElectronicTradingResearchEvents(otherUserId, { name: '其他账户批次', sourceLabel: '其他日志', asOfAt: new Date('2026-08-22T00:00:00Z'), events: [event('ET-X', 'ORDER-OTHER', 'new', new Date('2026-08-22T00:00:00Z'))] });
    const exported = await exportElectronicTradingResearchBatches(ownerId);
    expect(exported.batches).toHaveLength(1);
    expect(exported.batches[0]).toMatchObject({ id: mine.batchId, name: '我的批次' });
    expect(exported.batches[0]?.events.map((item) => item.orderId)).toEqual(['ORDER-MINE', 'ORDER-MINE']);
    expect(JSON.stringify(exported)).not.toContain('其他账户批次');
    expect(JSON.stringify(exported)).not.toContain('raw');
  });
});
