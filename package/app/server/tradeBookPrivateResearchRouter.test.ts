import { describe, expect, it } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

const user = { id: 987654499, openId: 'trade-book-router-test', name: 'Trade Book Test', email: null, loginMethod: 'local', role: 'user' as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const ctx = { user, req: { protocol: 'https', headers: {} }, res: {} } as unknown as TrpcContext;

describe('交易账簿账户私有导入接口', () => {
  it('rejects duplicate snapshot and cash-flow keys before any private batch is written', async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tradeBookPrivateResearch.importBatch({
      name: '重复键测试', sourceLabel: '测试', asOfAt: new Date('2026-08-22T00:00:00Z'),
      positions: [
        { snapshotId: 'position-duplicate', accountLabel: 'ACCOUNT', instrument: 'INSTRUMENT-A', quantity: 1, snapshotAt: new Date('2026-08-22T00:00:00Z') },
        { snapshotId: 'position-duplicate', accountLabel: 'ACCOUNT', instrument: 'INSTRUMENT-B', quantity: 1, snapshotAt: new Date('2026-08-22T00:00:00Z') },
      ],
      cashFlows: [{ flowId: 'flow-duplicate', accountLabel: 'ACCOUNT', flowType: 'fee', amount: -1, occurredAt: new Date('2026-08-22T00:00:00Z') }, { flowId: 'flow-duplicate', accountLabel: 'ACCOUNT', flowType: 'fee', amount: -2, occurredAt: new Date('2026-08-22T00:00:00Z') }],
    })).rejects.toThrow(/snapshotId|flowId/);
  });
});
