import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { importOrderManagementResearchEvents, listOrderManagementResearchBatches, setOrderManagementResearchBatchArchived, updateOrderManagementResearchBatchTags } from './orderManagementResearchDb';

const ownerId = 987654371;
const otherUserId = 987654372;
const event = (id: string, orderId: string) => ({ eventId: id, orderId, eventType: 'new' as const, instrument: 'TEST', side: 'buy' as const, orderQty: 1, eventAt: new Date('2026-08-22T09:00:00Z') });

afterEach(async () => { const db = await getDb(); await db?.execute(sql`DELETE FROM order_management_research_batch_tags WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_research_events WHERE user_id IN (${ownerId}, ${otherUserId})`); await db?.execute(sql`DELETE FROM order_management_research_batches WHERE user_id IN (${ownerId}, ${otherUserId})`); });

describe('账户私有交易批次标签、归档与检索', () => {
  it('stores tags, archives and searches only the owning account batch', async () => {
    const owner = await importOrderManagementResearchEvents(ownerId, { name: '流动性复盘', sourceLabel: '内部 OMS', asOfAt: new Date('2026-08-22T12:00:00Z'), events: [event('O-1', 'ORDER-1')] });
    const other = await importOrderManagementResearchEvents(otherUserId, { name: '其他账户', sourceLabel: '内部 OMS', asOfAt: new Date('2026-08-22T12:00:00Z'), events: [event('X-1', 'ORDER-X')] });
    expect((await updateOrderManagementResearchBatchTags(ownerId, owner.batchId, ['月末', ' 流动性 ', '月末']))?.tags).toEqual(['月末', '流动性']);
    expect(await updateOrderManagementResearchBatchTags(otherUserId, owner.batchId, ['越权'])).toBeNull();
    expect((await listOrderManagementResearchBatches(ownerId, { query: '流动性' })).map((batch) => batch.id)).toEqual([owner.batchId]);
    expect(await listOrderManagementResearchBatches(otherUserId, { query: '流动性' })).toEqual([]);
    expect(await setOrderManagementResearchBatchArchived(otherUserId, owner.batchId, true)).toBeNull();
    expect((await setOrderManagementResearchBatchArchived(ownerId, owner.batchId, true))?.isArchived).toBe(true);
    expect((await listOrderManagementResearchBatches(ownerId, { includeArchived: 'archived' })).map((batch) => batch.id)).toEqual([owner.batchId]);
    expect((await listOrderManagementResearchBatches(otherUserId, { includeArchived: 'active' })).map((batch) => batch.id)).toEqual([other.batchId]);
  });
});
