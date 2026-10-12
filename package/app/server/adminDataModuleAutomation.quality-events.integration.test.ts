import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents, adminDataModuleContentItems, adminDataModuleProfiles } from '../drizzle/schema';
import { getDb } from './db';
import { enqueueAdminDataModuleAutomation, processAdminDataModuleAutomationRun } from './adminDataModuleAutomation';

let originalProfile: typeof adminDataModuleProfiles.$inferSelect | null = null;
const runIds: number[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (runIds.length) {
    await db.delete(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.runId, runIds));
    await db.delete(adminDataModuleAutomationStepEvents).where(inArray(adminDataModuleAutomationStepEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.runId, runIds));
    await db.delete(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.id, runIds));
  }
  if (originalProfile) await db.update(adminDataModuleProfiles).set({ sourceKind: originalProfile.sourceKind, keywords: originalProfile.keywords, tags: originalProfile.tags, automationEnabled: originalProfile.automationEnabled, reviewPolicy: originalProfile.reviewPolicy, pushPolicy: originalProfile.pushPolicy, runtimeStatus: originalProfile.runtimeStatus, updatedByUserId: originalProfile.updatedByUserId, updatedAt: originalProfile.updatedAt }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
  originalProfile = null;
  runIds.length = 0;
});

describe('adminDataModuleAutomation quality step events integration', () => {
  it('将质量通过和质量拒绝的评分、门槛与结论分别写入持久步骤日志', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    originalProfile = (await db.select().from(adminDataModuleProfiles).where(eq(adminDataModuleProfiles.moduleId, 'market')).limit(1))[0] ?? null;
    if (!originalProfile) throw new Error('MARKET_PROFILE_NOT_MATERIALIZED');
    await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', keywords: ['质量检查'], tags: ['quality'], automationEnabled: true, reviewPolicy: 'manual', pushPolicy: 'manual', runtimeStatus: 'enabled', updatedAt: new Date() }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
    const accepted = await enqueueAdminDataModuleAutomation({ scope: 'single', moduleId: 'market', mode: 'rich_content', actorUserId: 1 });
    runIds.push(accepted.runId);
    await expect(processAdminDataModuleAutomationRun(accepted.runKey, 1, 1)).resolves.toMatchObject({ completed: 1, failed: 0 });
    const passedStep = (await db.select().from(adminDataModuleAutomationStepEvents).where(eq(adminDataModuleAutomationStepEvents.runId, accepted.runId))).find((step) => step.step === 'quality_check_passed');
    expect(passedStep).toMatchObject({ moduleId: 'market', action: 'quality_check', status: 'success' });
    expect(passedStep?.detail).toContain('质量评分');
    expect(passedStep?.detail).toContain('审核门槛 75');

    await db.update(adminDataModuleProfiles).set({ keywords: [], tags: [], updatedAt: new Date() }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
    const rejected = await enqueueAdminDataModuleAutomation({ scope: 'single', moduleId: 'market', mode: 'fast_draft', actorUserId: 1 });
    runIds.push(rejected.runId);
    await expect(processAdminDataModuleAutomationRun(rejected.runKey, 1, 1)).resolves.toMatchObject({ skipped: 1, failed: 0 });
    const rejectedStep = (await db.select().from(adminDataModuleAutomationStepEvents).where(eq(adminDataModuleAutomationStepEvents.runId, rejected.runId))).find((step) => step.step === 'quality_check_rejected');
    expect(rejectedStep).toMatchObject({ moduleId: 'market', action: 'quality_check', status: 'failed' });
    expect(rejectedStep?.detail).toContain('质量评分');
    expect(rejectedStep?.detail).toContain('审核门槛 75');
    expect(rejectedStep?.detail).toContain('至少存在一个关键词和一个标签');
    const rejectedItem = (await db.select().from(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, rejected.runId)).limit(1))[0];
    expect(rejectedItem?.resultSummary).toMatchObject({ qualityThreshold: 75, qualityRejectionReasons: expect.arrayContaining(['至少存在一个关键词和一个标签']) });
    const rejectedContent = (await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, rejected.runId)).limit(1))[0];
    expect(rejectedContent).toMatchObject({ status: 'rejected' });
    expect(rejectedContent?.errorDetail).toContain('QUALITY_CHECK_REJECTED');
  });
});
