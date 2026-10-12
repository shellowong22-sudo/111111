import { describe, expect, it } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function anonymousContext(): TrpcContext {
  return { user: null, req: { protocol: 'https', headers: {} } as TrpcContext['req'], res: {} as TrpcContext['res'] };
}

describe('forex same-day timeline preset access boundary', () => {
  it('rejects unauthenticated preset reads and writes before any account data access', async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.forexResearch.listSameDayTimelinePresets()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.forexResearch.saveSameDayTimelinePreset({ name: '个人常用条件', centralBankIds: ['FED', 'BOE'], pairIds: ['USD', 'GBPUSD'], actions: ['hold'] })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
