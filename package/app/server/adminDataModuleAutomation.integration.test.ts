import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents, adminDataModuleContentItems, adminDataModuleDeliveryEvents, adminDataModuleProfiles } from '../drizzle/schema';
import { getDb } from './db';
import { enqueueAdminDataModuleAutomation, processAdminDataModuleAutomationRun } from './adminDataModuleAutomation';

const originalProfiles: Array<typeof adminDataModuleProfiles.$inferSelect> = [];
const runIds: number[] = [];
const batchContentIds: number[] = [];
const contentIds: number[] = [];

beforeEach(async () => {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const profiles = await db.select().from(adminDataModuleProfiles).where(inArray(adminDataModuleProfiles.moduleId, ['market', 'news-top']));
  originalProfiles.push(...profiles);
  if (profiles.length !== 2) throw new Error('BATCH_PROFILES_NOT_MATERIALIZED');
  await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', automationEnabled: true, reviewPolicy: 'manual', pushPolicy: 'after_approval', runtimeStatus: 'enabled', updatedAt: new Date() }).where(inArray(adminDataModuleProfiles.moduleId, ['market', 'news-top']));
});

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (contentIds.length) await db.delete(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.id, contentIds));
  if (batchContentIds.length) await db.delete(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.id, batchContentIds));
  if (runIds.length) {
    await db.delete(adminDataModuleDeliveryEvents).where(inArray(adminDataModuleDeliveryEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationStepEvents).where(inArray(adminDataModuleAutomationStepEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.runId, runIds));
    await db.delete(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.id, runIds));
  }
  for (const profile of originalProfiles) {
    await db.update(adminDataModuleProfiles).set({
      sourceKind: profile.sourceKind,
      automationEnabled: profile.automationEnabled,
      reviewPolicy: profile.reviewPolicy,
      pushPolicy: profile.pushPolicy,
      runtimeStatus: profile.runtimeStatus,
      currentVersion: profile.currentVersion,
      rollbackVersion: profile.rollbackVersion,
      lastExecutedAt: profile.lastExecutedAt,
      lastPushedAt: profile.lastPushedAt,
      updatedByUserId: profile.updatedByUserId,
      updatedAt: profile.updatedAt,
    }).where(eq(adminDataModuleProfiles.moduleId, profile.moduleId));
  }
  runIds.length = 0;
  contentIds.length = 0;
  batchContentIds.length = 0;
  originalProfiles.length = 0;
});

describe('adminDataModuleAutomation persistent integration', () => {
  it('连续三次运行均持久化候选内容，并依靠全局去重与运行种子产生差异化标题', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const drafts: Array<{ title: string; topic: string | null; status: string; sourceKind: string }> = [];
    for (let index = 0; index < 3; index += 1) {
      const queued = await enqueueAdminDataModuleAutomation({ scope: 'single', moduleId: 'market', mode: 'rich_content', actorUserId: 1 });
      runIds.push(queued.runId);
      const processed = await processAdminDataModuleAutomationRun(queued.runKey, 1, 1);
      expect(processed).toMatchObject({ runKey: queued.runKey, processed: 1, completed: 1 });
      const rows = await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, queued.runId));
      expect(rows).toHaveLength(1);
      const row = rows[0];
      contentIds.push(row.id);
      drafts.push({ title: row.title, topic: row.topic, status: row.status, sourceKind: row.sourceKind });
    }
    expect(new Set(drafts.map((draft) => draft.title)).size).toBe(3);
    expect(new Set(drafts.map((draft) => draft.topic)).size).toBeGreaterThanOrEqual(1);
    expect(drafts.every((draft) => draft.status === 'pending_review' && draft.sourceKind === 'simulated')).toBe(true);
  });

  it('任意多选模块持久化 batch scope，并在重新读取运行记录后保持选择范围', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const selectedModuleIds = ['market', 'news-top'];
    const queued = await enqueueAdminDataModuleAutomation({ scope: 'batch', moduleIds: selectedModuleIds, mode: 'fast_draft', actorUserId: 1 });
    runIds.push(queued.runId);
    const persisted = (await db.select().from(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.id, queued.runId)).limit(1))[0];
    expect(persisted).toMatchObject({ scope: 'batch', moduleIdsJson: JSON.stringify(selectedModuleIds), requestedCount: 2, queuedCount: 2 });
    const processed = await processAdminDataModuleAutomationRun(queued.runKey, 1, 8);
    expect(processed).toMatchObject({ runKey: queued.runKey, processed: 2, completed: 2, failed: 0 });
    const rows = await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, queued.runId));
    batchContentIds.push(...rows.map((row) => row.id));
    expect(new Set(rows.map((row) => row.moduleId)).size).toBe(2);
    expect(new Set(rows.map((row) => row.moduleId))).toEqual(new Set(selectedModuleIds));
  });
});
