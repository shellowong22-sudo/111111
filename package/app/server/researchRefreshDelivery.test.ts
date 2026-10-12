import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('research refresh delivery contract', () => {
  it('adds source-refresh hints to the existing content SSE without exposing payload data', () => {
    const source = read('server/uploadAndSse.ts');
    expect(source).toContain('getPublicRefreshSignalsForPath(path)');
    expect(source).toContain('refreshes');
    expect(source).toContain('refreshSignature');
    expect(source).toContain('lastRefreshSignature');
    expect(source).not.toContain('res.write(`data: ${JSON.stringify({ ...refreshes');
  });

  it('maps refresh hints to the existing module paths and retains one latest event per module', () => {
    const source = read('server/adminModulePublicFeed.ts');
    expect(source).toContain('export async function getPublicRefreshSignalsForPath');
    expect(source).toContain('resolveAdminDataModulesForPath(path)');
    expect(source).toContain('adminDataModuleRefreshEvents');
    expect(source).toContain('if (!latest.has(row.moduleId))');
  });

  it('invalidates verified research queries only on a matching stock/preferred path', () => {
    const source = read('client/src/hooks/useModuleLiveFeed.ts');
    expect(source).toContain('stockMarketResearch.getEnvironment.invalidate()');
    expect(source).toContain('preferredStockResearch.getMarketEnvironment.invalidate()');
    expect(source).toContain('/module=(?:stock|preferred|equity)/i');
    expect(source).toContain('Typed research');
  });

  it('does not invalidate on failed, malformed or future-dated refresh hints', async () => {
    const source = read('client/src/hooks/useModuleLiveFeed.ts');
    expect(source).toContain("['available', 'partial'].includes(item.status ?? '')");
    expect(source).toContain('at <= now');
  });

  it('releases a failed SSE socket, falls back, and schedules bounded recovery', () => {
    const source = read('client/src/hooks/useModuleLiveFeed.ts');
    expect(source).toContain('nextStream.onerror = scheduleReconnect');
    expect(source).toContain("setConnection('fallback')");
    expect(source).toContain('moduleLiveFeedRetryDelay(retryAttempt)');
    expect(source).toContain('acquireContentStreamLease(lifetime.signal)');
    expect(source).toContain("window.addEventListener('online', reconnectImmediately)");
    expect(source).toContain("window.addEventListener('focus', reconnectImmediately)");
  });

  it('instructs native EventSource clients to reconnect without duplicate data frames', () => {
    const source = read('server/uploadAndSse.ts');
    expect(source).toContain("res.write('retry: 3000\\n:connected\\n\\n')");
    expect(source).toContain('if (signature === lastSignature && refreshSignature === lastRefreshSignature) return');
  });

  it('uses exponential SSE retry delays with a hard ceiling', async () => {
    const { moduleLiveFeedRetryDelay } = await import('../client/src/hooks/useModuleLiveFeed');
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(moduleLiveFeedRetryDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ]);
  });
});
