import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents, adminDataModuleContentItems, adminDataModuleDeliveryEvents, adminDataModuleProfiles } from '../drizzle/schema';
import { getDb } from './db';
import { enqueueAdminDataModuleAutomation, processAdminDataModuleAutomationRun } from './adminDataModuleAutomation';
import { ensureAdminDataModuleProfiles } from './adminDataModuleProfiles';

type ProfileSnapshot = Pick<typeof adminDataModuleProfiles.$inferSelect, 'moduleId' | 'sourceKind' | 'automationEnabled' | 'reviewPolicy' | 'pushPolicy' | 'runtimeStatus' | 'lastExecutedAt' | 'lastPushedAt' | 'updatedByUserId' | 'updatedAt'>;

const writableContracts = ['market_snapshot', 'news_review_pipeline', 'announcement_publication'] as const;
let originalProfiles: ProfileSnapshot[] = [];
const runIds: number[] = [];

beforeEach(async () => {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(1);
  originalProfiles = (await db.select().from(adminDataModuleProfiles)).filter((profile) => writableContracts.includes(profile.targetContract as typeof writableContracts[number])).map((profile) => ({
    moduleId: profile.moduleId,
    sourceKind: profile.sourceKind,
    automationEnabled: profile.automationEnabled,
    reviewPolicy: profile.reviewPolicy,
    pushPolicy: profile.pushPolicy,
    runtimeStatus: profile.runtimeStatus,
    lastExecutedAt: profile.lastExecutedAt,
    lastPushedAt: profile.lastPushedAt,
    updatedByUserId: profile.updatedByUserId,
    updatedAt: profile.updatedAt,
  }));
  await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', automationEnabled: true, reviewPolicy: 'manual', pushPolicy: 'after_approval', runtimeStatus: 'enabled', updatedAt: new Date() }).where(inArray(adminDataModuleProfiles.moduleId, originalProfiles.map((profile) => profile.moduleId)));
});

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (runIds.length) {
    await db.delete(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.runId, runIds));
    await db.delete(adminDataModuleDeliveryEvents).where(inArray(adminDataModuleDeliveryEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationStepEvents).where(inArray(adminDataModuleAutomationStepEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.runId, runIds));
    await db.delete(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.id, runIds));
  }
  await Promise.all(originalProfiles.map((profile) => db.update(adminDataModuleProfiles).set({
    sourceKind: profile.sourceKind,
    automationEnabled: profile.automationEnabled,
    reviewPolicy: profile.reviewPolicy,
    pushPolicy: profile.pushPolicy,
    runtimeStatus: profile.runtimeStatus,
    lastExecutedAt: profile.lastExecutedAt,
    lastPushedAt: profile.lastPushedAt,
    updatedByUserId: profile.updatedByUserId,
    updatedAt: profile.updatedAt,
  }).where(eq(adminDataModuleProfiles.moduleId, profile.moduleId))));
  originalProfiles = [];
  runIds.length = 0;
});

async function finishRun(runKey: string) {
  let result: Awaited<ReturnType<typeof processAdminDataModuleAutomationRun>> | null = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    result = await processAdminDataModuleAutomationRun(runKey, 1, 8);
    if (result.status !== 'running') return result;
  }
  throw new Error('AUTOMATION_SCOPE_TEST_DID_NOT_FINISH');
}

describe('adminDataModuleAutomation scope persistent integration', () => {
  it('完成市场分组以及三次全站运行，并对每个可写模块保留不同的待审核模拟内容', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    expect(originalProfiles.length).toBe(46);
    const grouped = await enqueueAdminDataModuleAutomation({ scope: 'group', moduleGroup: '市场快照', mode: 'rich_content', actorUserId: 1 });
    runIds.push(grouped.runId);
    const groupedResult = await finishRun(grouped.runKey);
    expect(groupedResult).toMatchObject({ total: 16, completed: 16, failed: 0, status: 'completed' });

    const siteRunKeys: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const site = await enqueueAdminDataModuleAutomation({ scope: 'site', mode: 'rich_content', actorUserId: 1 });
      runIds.push(site.runId);
      siteRunKeys.push(site.runKey);
      const siteResult = await finishRun(site.runKey);
      expect(siteResult).toMatchObject({ total: 46, completed: 46, skipped: 0, failed: 0, status: 'completed' });
    }

    const content = await db.select().from(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.runId, runIds));
    const siteRuns = await db.select().from(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.runKey, siteRunKeys));
    const siteRunIds = siteRuns.map((run) => run.id);
    const threeRunContent = content.filter((row) => siteRunIds.includes(row.runId ?? -1));
    expect(threeRunContent).toHaveLength(138);
    expect(new Set(threeRunContent.map((row) => row.title)).size).toBe(138);
    expect(threeRunContent.every((row) => row.sourceKind === 'simulated' && row.status === 'pending_review' && row.assetUrl === null)).toBe(true);
    console.info('ADMIN_MODULE_AUTOMATION_SCOPE', JSON.stringify({ groupedRequested: grouped.requestedCount, groupedCompleted: groupedResult.completed, siteRunCount: siteRunKeys.length, siteModulesPerRun: 46, simulatedDraftsAcrossThreeRuns: threeRunContent.length, distinctTitles: new Set(threeRunContent.map((row) => row.title)).size }));
  });
});
