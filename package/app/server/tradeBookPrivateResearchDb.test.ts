import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { exportTradeBookPrivateBatches, getTradeBookPrivateDossier, importTradeBookPrivateBatch } from './tradeBookPrivateResearchDb';

const ownerId = 987654471;
const otherUserId = 987654472;

afterEach(async () => {
  const db = await getDb();
  await db?.execute(sql`DELETE FROM trade_book_private_cash_flows WHERE user_id IN (${ownerId}, ${otherUserId})`);
  await db?.execute(sql`DELETE FROM trade_book_private_position_snapshots WHERE user_id IN (${ownerId}, ${otherUserId})`);
  await db?.execute(sql`DELETE FROM trade_book_private_batches WHERE user_id IN (${ownerId}, ${otherUserId})`);
});

describe('交易账簿账户私有数据层', () => {
  it('keeps private batches, positions, cash flows, dossiers and exports isolated by account', async () => {
    const mine = await importTradeBookPrivateBatch(ownerId, {
      name: '我的私有快照', sourceLabel: '自有账簿导出', asOfAt: new Date('2026-08-22T00:00:00Z'),
      positions: [{ snapshotId: 'owner-position', accountLabel: 'OWNER-ACCOUNT', instrument: 'OWNER-BOND', quantity: 10, marketPrice: 12, costBasis: 100, currency: 'USD', snapshotAt: new Date('2026-08-22T00:00:00Z') }],
      cashFlows: [{ flowId: 'owner-flow', accountLabel: 'OWNER-ACCOUNT', flowType: 'trade_settlement', amount: -120, currency: 'USD', instrument: 'OWNER-BOND', occurredAt: new Date('2026-08-22T00:00:00Z') }],
    });
    await importTradeBookPrivateBatch(otherUserId, {
      name: '其他账户快照', sourceLabel: '其他账簿', asOfAt: new Date('2026-08-22T00:00:00Z'),
      positions: [{ snapshotId: 'other-position', accountLabel: 'OTHER-ACCOUNT', instrument: 'OTHER-BOND', quantity: 1, marketPrice: 1, costBasis: 1, currency: 'EUR', snapshotAt: new Date('2026-08-22T00:00:00Z') }],
      cashFlows: [],
    });

    expect(await getTradeBookPrivateDossier(otherUserId, mine.batchId)).toBeNull();
    expect(await getTradeBookPrivateDossier(ownerId, mine.batchId)).toMatchObject({ currentPositionCount: 1, cashFlowCount: 1, currentPositions: [{ instrument: 'OWNER-BOND', marketValue: 120, unrealizedPnl: 20 }] });
    const exported = await exportTradeBookPrivateBatches(ownerId);
    expect(exported.batches).toHaveLength(1);
    expect(exported.batches[0]).toMatchObject({ id: mine.batchId, name: '我的私有快照' });
    expect(exported.batches[0]?.positions.map((position) => position.instrument)).toEqual(['OWNER-BOND']);
    expect(exported.batches[0]?.cashFlows.map((flow) => flow.flowId)).toEqual(['owner-flow']);
    expect(JSON.stringify(exported)).not.toContain('其他账户快照');
    expect(JSON.stringify(exported)).not.toContain('raw');
  });
});
