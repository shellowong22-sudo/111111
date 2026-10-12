import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents } from '../drizzle/schema';
import { getDb } from './db';
import { processAdminDataModuleQueue } from './adminDataModuleQueue';

const runIds: number[] = [];
const moduleIds = ['market', 'news-top', 'news-btdy', 'news-frnt', 'news-cn', 'news-read', 'news-ni', 'news-nh'];

afterEach(async () => {
  const db = await getDb();
  if (!db || !runIds.length) return;
  await db.delete(adminDataModuleAutomationStepEvents).where(inArray(adminDataModuleAutomationStepEvents.runId, runIds));
  await db.delete(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.runId, runIds));
  await db.delete(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.id, runIds));
  runIds.length = 0;
});

async function createQueuedRun(count: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const runKey = `modrun_${randomUUID().replaceAll('-', '')}`;
  await db.insert(adminDataModuleAutomationRuns).values({ runKey, scope: 'site', trigger: 'manual', mode: 'fast_draft', status: 'queued', currentStep: 'performance_test_queued', requestedCount: count, queuedCount: count, actorUserId: 1 });
  const run = (await db.select().from(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.runKey, runKey)).limit(1))[0];
  if (!run) throw new Error('PERFORMANCE_TEST_RUN_CREATE_FAILED');
  runIds.push(run.id);
  await db.insert(adminDataModuleAutomationRunItems).values(moduleIds.slice(0, count).map((moduleId, index) => ({
    itemKey: `perf-${runKey}-${moduleId}`,
    runId: run.id,
    moduleId,
    status: 'queued' as const,
    currentStep: 'performance_test_queued',
    priority: 100 - index,
    maxAttempts: 1,
    idempotencyKey: `performance:${runKey}:${moduleId}`,
  })));
  return { run, runKey };
}

describe('adminDataModuleQueue concurrency performance integration', () => {
  it('分别处理 1、5、8 项并记录耗时，且任一项失败不会阻断同批其他项', async () => {
    const measurements: Array<{ itemCount: number; elapsedMs: number; outcome: Record<string, unknown> }> = [];
    for (const itemCount of [1, 5, 8]) {
      const { runKey } = await createQueuedRun(itemCount);
      const started = Date.now();
      const outcome = await processAdminDataModuleQueue({
        runKey,
        actorUserId: 1,
        maxItems: itemCount,
        handler: async (item) => {
          await new Promise((resolve) => setTimeout(resolve, 35));
          if (itemCount === 5 && item.moduleId === 'news-top') throw new Error('PERFORMANCE_TEST_INTENTIONAL_ITEM_FAILURE');
          return { status: 'completed' as const, step: 'performance_test_completed', detail: '仅验证数据库持久队列的并发、耗时与隔离；未访问外部数据或写入前端读取表。', resultSummary: { testOnly: true } };
        },
      });
      measurements.push({ itemCount, elapsedMs: Date.now() - started, outcome: outcome as unknown as Record<string, unknown> });
      expect(outcome.processed).toBe(itemCount);
      expect(outcome.total).toBe(itemCount);
      expect(Date.now() - started).toBeLessThan(8_000);
      if (itemCount === 5) expect(outcome).toMatchObject({ completed: 4, failed: 1, status: 'partial' });
      else expect(outcome).toMatchObject({ completed: itemCount, failed: 0, status: 'completed' });
    }
    expect(measurements.map((measurement) => measurement.itemCount)).toEqual([1, 5, 8]);
    console.info('ADMIN_MODULE_QUEUE_PERFORMANCE', JSON.stringify(measurements.map(({ itemCount, elapsedMs, outcome }) => ({ itemCount, elapsedMs, status: outcome.status, completed: outcome.completed, failed: outcome.failed }))));
  });
});
