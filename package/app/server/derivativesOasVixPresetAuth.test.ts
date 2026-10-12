import { describe, expect, it } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function anonymousContext(): TrpcContext {
  return { user: null, req: { protocol: 'https', headers: {} } as TrpcContext['req'], res: {} as TrpcContext['res'] };
}

describe('derivatives OAS/VIX date preset access boundary', () => {
  it('rejects anonymous reads and writes before any account-private preset data access', async () => {
    const caller = appRouter.createCaller(anonymousContext());
    const dates = { name: '一季度与二季度', rangeAStart: '2026-01-01', rangeAEnd: '2026-03-31', rangeBStart: '2026-04-01', rangeBEnd: '2026-06-30' };
    await expect(caller.derivativesResearch.listOasVixDatePresets()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.derivativesResearch.saveOasVixDatePreset(dates)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.derivativesResearch.deleteOasVixDatePreset({ id: 1 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
