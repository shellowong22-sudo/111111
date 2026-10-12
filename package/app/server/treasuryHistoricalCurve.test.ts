import { describe, expect, it } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

const context = (): TrpcContext => ({ user: null, req: { protocol: 'https', headers: {} } as TrpcContext['req'], res: { clearCookie: () => {} } as TrpcContext['res'] });

describe('美国财政部真实历史曲线资产', () => {
  it('从数据库返回可审计的官方月末资产，不回落至 ZIP 测试曲线', async () => {
    const result = await appRouter.createCaller(context()).treasuryHistoricalCurve.getImported();
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.audit.sourceUrl).toContain('home.treasury.gov');
    expect(result.audit.sourceFirstDate).toBe('1990-01-31');
    expect(result.audit.sourceLastDate).toBe('2023-12-29');
    expect(result.audit.selectedObservationCount).toBe(408);
    expect(result.audit.importedPointCount).toBe(4257);
    expect(result.audit.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.latestObservations[0]?.date).toBe('2023-12-29');
  });
});
