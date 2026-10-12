import { afterEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents } from '../drizzle/schema';
import { getDb } from './db';
import { processAdminDataModuleQueue } from './adminDataModuleQueue';

const createdRunIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db || !createdRunIds.length) return;
  await db.delete(adminDataModuleAutomationStepEvents).where(and(eq(adminDataModuleAutomationStepEvents.runId, createdRunIds[0])));
  await db.delete(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, createdRunIds[0]));
  await db.delete(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.id, createdRunIds[0]));
  createdRunIds.length = 0;
});

describe('adminDataModuleQueue persistent integration', () => {
  it('将任务项持久入库、按租约领取、记录步骤并在独立处理后汇总完成状态', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const runKey = `modrun_${randomUUID().replaceAll('-', '')}`;
    await db.insert(adminDataModuleAutomationRuns).values({
      runKey,
      scope: 'single',
      moduleId: 'market',
      trigger: 'manual',
      mode: 'fast_draft',
      status: 'queued',
      currentStep: 'test_queued',
      requestedCount: 1,
      queuedCount: 1,
      actorUserId: 1,
    });
    const run = (await db.select().from(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.runKey, runKey)).limit(1))[0];
    if (!run) throw new Error('TEST_RUN_NOT_CREATED');
    createdRunIds.push(run.id);
    await db.insert(adminDataModuleAutomationRunItems).values({
      itemKey: `test-item-${randomUUID()}`,
      runId: run.id,
      moduleId: 'market',
      status: 'queued',
      currentStep: 'test_queued',
      priority: 100,
      maxAttempts: 2,
      idempotencyKey: `test:${runKey}:market`,
    });

    const outcome = await processAdminDataModuleQueue({
      runKey,
      actorUserId: 1,
      maxItems: 1,
      handler: async (item) => ({
        status: 'skipped',
        step: 'test_safe_skip',
        detail: `集成测试已安全处理 ${item.moduleId}；未请求外部数据源、未写入前端读取表。`,
        resultSummary: { testOnly: true, deliveryAttempted: false },
      }),
    });

    expect(outcome).toMatchObject({ runKey, processed: 1, skipped: 1, status: 'partial' });
    const item = (await db.select().from(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, run.id)).limit(1))[0];
    expect(item).toMatchObject({ status: 'skipped', currentStep: 'test_safe_skip', leaseToken: null, leaseExpiresAt: null });
    const steps = await db.select().from(adminDataModuleAutomationStepEvents).where(eq(adminDataModuleAutomationStepEvents.runId, run.id));
    expect(steps.some((step) => step.step === 'handler_running' && step.status === 'started')).toBe(true);
    expect(steps.some((step) => step.step === 'test_safe_skip' && step.status === 'skipped')).toBe(true);
  });
});
