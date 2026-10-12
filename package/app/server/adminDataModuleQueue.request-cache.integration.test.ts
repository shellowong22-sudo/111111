import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminDataModuleRequestCache } from '../drizzle/schema';
import { getDb } from './db';
import { cleanupAdminDataModuleAutomationQueue, withAdminDataModuleRequestCache } from './adminDataModuleQueue';

let cacheKey: string | null = null;

afterEach(async () => {
  if (!cacheKey) return;
  const db = await getDb();
  if (db) await db.delete(adminDataModuleRequestCache).where(eq(adminDataModuleRequestCache.cacheKey, cacheKey));
  cacheKey = null;
});

describe('adminDataModuleQueue request cache integration', () => {
  it('持久化首个来源请求结果并让相同键后续请求命中缓存，避免重复执行', async () => {
    cacheKey = `test-cache-${randomUUID()}`;
    let executions = 0;
    const concurrent = await Promise.all([
      withAdminDataModuleRequestCache({ cacheKey, ttlMs: 60_000, operation: async () => { executions += 1; await new Promise((resolve) => setTimeout(resolve, 220)); return { executions, source: 'simulated-test' }; } }),
      withAdminDataModuleRequestCache({ cacheKey, ttlMs: 60_000, operation: async () => ({ executions: ++executions, source: 'should-not-run' }) }),
    ]);
    expect(concurrent.map((entry) => entry.cache).sort()).toEqual(['joined', 'miss']);
    expect(concurrent.every((entry) => entry.value.executions === 1)).toBe(true);
    expect(concurrent[0].value.source).toBe(concurrent[1].value.source);
    expect(executions).toBe(1);
    const hit = await withAdminDataModuleRequestCache({ cacheKey, ttlMs: 60_000, operation: async () => ({ executions: ++executions, source: 'should-not-run' }) });
    expect(hit).toEqual({ value: concurrent[0].value, cache: 'hit' });
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    await db.update(adminDataModuleRequestCache).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(adminDataModuleRequestCache.cacheKey, cacheKey));
    const cleanup = await cleanupAdminDataModuleAutomationQueue({ before: new Date(0), actorUserId: 1 });
    expect(cleanup.cleanedRequestCacheEntries).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(adminDataModuleRequestCache).where(eq(adminDataModuleRequestCache.cacheKey, cacheKey))).toHaveLength(0);
    cacheKey = null;
  });
});
