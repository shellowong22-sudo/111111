import { afterEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents } from '../drizzle/schema';
import { getDb } from './db';
import { processAdminDataModuleQueue } from './adminDataModuleQueue';
import { listAdminDataModuleSystemSettings, updateAdminDataModuleSystemSetting } from './adminDataModuleManagement';

let runId: number | null = null;
let originalQueueSetting: { value: Record<string, unknown>; description: string | null } | null = null;

afterEach(async () => {
  const db = await getDb();
  if (db && runId !== null) {
    await db.delete(adminDataModuleAutomationStepEvents).where(eq(adminDataModuleAutomationStepEvents.runId, runId));
    await db.delete(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, runId));
    await db.delete(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.id, runId));
  }
  if (originalQueueSetting) await updateAdminDataModuleSystemSetting(1, { settingKey: 'queue.execution', value: originalQueueSetting.value, description: originalQueueSetting.description ?? undefined });
  runId = null;
  originalQueueSetting = null;
});

describe('adminDataModuleQueue configured limits integration', () => {
  it('使用持久化的并发上限限制本次领取数量，其余任务保留在数据库队列中等待续跑', async () => {
    const initialSettings = await listAdminDataModuleSystemSettings(1);
    const current = initialSettings.find((setting) => setting.settingKey === 'queue.execution');
    if (!current?.value || typeof current.value !== 'object' || Array.isArray(current.value)) throw new Error('QUEUE_SETTING_NOT_MATERIALIZED');
    originalQueueSetting = { value: current.value as Record<string, unknown>, description: current.description };
    await updateAdminDataModuleSystemSetting(1, { settingKey: 'queue.execution', value: { maxConcurrentItems: 1, itemTimeoutMs: 100000, retryBackoffSeconds: 30 } });
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const runKey = `modrun_${randomUUID().replaceAll('-', '')}`;
    await db.insert(adminDataModuleAutomationRuns).values({ runKey, scope: 'site', trigger: 'manual', mode: 'fast_draft', status: 'queued', currentStep: 'settings_test_queued', requestedCount: 2, queuedCount: 2, actorUserId: 1 });
    const run = (await db.select().from(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.runKey, runKey)).limit(1))[0];
    if (!run) throw new Error('QUEUE_SETTINGS_TEST_RUN_NOT_CREATED');
    runId = run.id;
    await db.insert(adminDataModuleAutomationRunItems).values(['market', 'equity-market'].map((moduleId) => ({ itemKey: `settings-test-${moduleId}-${randomUUID()}`, runId: run.id, moduleId, status: 'queued' as const, currentStep: 'settings_test_queued', priority: 100, maxAttempts: 1, idempotencyKey: `settings-test:${runKey}:${moduleId}` })));
    const outcome = await processAdminDataModuleQueue({ runKey, actorUserId: 1, maxItems: 8, handler: async () => ({ status: 'skipped', step: 'settings_limit_verified', detail: '仅测试持久化后台并发上限；未写入任何前端读取数据。' }) });
    expect(outcome.processed).toBe(1);
    const items = await db.select().from(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, run.id));
    expect(items.filter((item) => item.status === 'queued')).toHaveLength(1);
    expect(items.filter((item) => item.status === 'skipped')).toHaveLength(1);
  });
});
