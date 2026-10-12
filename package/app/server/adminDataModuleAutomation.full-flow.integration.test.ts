import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents, adminDataModuleContentItems, adminDataModuleDeliveryEvents, adminDataModuleDeliveryOperations, adminDataModuleDeliveryVersions, adminDataModuleProfiles, adminNewsIngestionArticles, adminNewsIngestionAuditEvents, adminNewsIngestionSources, marketData } from '../drizzle/schema';
import { getDb } from './db';
import { enqueueAdminDataModuleAutomation, processAdminDataModuleAutomationRun } from './adminDataModuleAutomation';
import { rollbackAdminDataModuleDeliveryVersion } from './adminDataModuleDelivery';

type ProfileSnapshot = Pick<typeof adminDataModuleProfiles.$inferSelect, 'moduleId' | 'sourceKind' | 'automationEnabled' | 'reviewPolicy' | 'pushPolicy' | 'runtimeStatus' | 'currentVersion' | 'rollbackVersion' | 'lastExecutedAt' | 'lastPushedAt' | 'updatedByUserId' | 'updatedAt'>;

let originalProfiles: ProfileSnapshot[] = [];
const runIds: number[] = [];
const versionIds: number[] = [];
const contentIds: number[] = [];
const simulatedSymbols: string[] = [];
let existingSimulationSourceId: number | null = null;

beforeEach(async () => {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const profileRows = await db.select().from(adminDataModuleProfiles);
  originalProfiles = profileRows.map((profile) => ({
    moduleId: profile.moduleId,
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
  }));
  const existingSource = (await db.select().from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.provider, 'finance_hub_simulated')).limit(1))[0] ?? null;
  existingSimulationSourceId = existingSource?.id ?? null;
  await db.update(adminDataModuleProfiles).set({ automationEnabled: false, runtimeStatus: 'enabled', updatedAt: new Date() });
  await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', automationEnabled: true, reviewPolicy: 'auto_approved', pushPolicy: 'after_approval', runtimeStatus: 'enabled', updatedAt: new Date() }).where(inArray(adminDataModuleProfiles.moduleId, ['market', 'news-top']));
});

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  for (const symbol of simulatedSymbols) await db.delete(marketData).where(eq(marketData.symbol, symbol));
  if (runIds.length) {
    const contents = await db.select({ id: adminDataModuleContentItems.id, deliveryVersionId: adminDataModuleContentItems.deliveryVersionId }).from(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.runId, runIds));
    const versions = contents.flatMap((content) => content.deliveryVersionId ? [content.deliveryVersionId] : []);
    if (versions.length) {
      await db.delete(adminDataModuleDeliveryEvents).where(inArray(adminDataModuleDeliveryEvents.deliveryVersionId, versions));
      await db.delete(adminDataModuleDeliveryOperations).where(inArray(adminDataModuleDeliveryOperations.deliveryVersionId, versions));
      await db.delete(adminDataModuleDeliveryVersions).where(inArray(adminDataModuleDeliveryVersions.id, versions));
    }
    await db.delete(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.runId, runIds));
    await db.delete(adminDataModuleDeliveryEvents).where(inArray(adminDataModuleDeliveryEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationStepEvents).where(inArray(adminDataModuleAutomationStepEvents.runId, runIds));
    await db.delete(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.runId, runIds));
    await db.delete(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.id, runIds));
  }
  if (existingSimulationSourceId === null) {
    const testSource = (await db.select().from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.provider, 'finance_hub_simulated')).limit(1))[0] ?? null;
    if (testSource) {
      const articles = await db.select({ id: adminNewsIngestionArticles.id }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.sourceId, testSource.id));
      if (articles.length) await db.delete(adminNewsIngestionAuditEvents).where(inArray(adminNewsIngestionAuditEvents.articleId, articles.map((article) => article.id)));
      await db.delete(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.sourceId, testSource.id));
      await db.delete(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.id, testSource.id));
    }
  }
  await Promise.all(originalProfiles.map((profile) => db.update(adminDataModuleProfiles).set({
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
  }).where(eq(adminDataModuleProfiles.moduleId, profile.moduleId))));
  originalProfiles = [];
  runIds.length = 0;
  versionIds.length = 0;
  contentIds.length = 0;
  simulatedSymbols.length = 0;
  existingSimulationSourceId = null;
});

async function finish(runKey: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await processAdminDataModuleAutomationRun(runKey, 1, 8);
    if (result.status !== 'running') return result;
  }
  throw new Error('FULL_FLOW_RUN_DID_NOT_FINISH');
}

async function assertAndRollbackRun(runId: number, expectedModules: string[]) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const contents = await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, runId));
  expect(contents).toHaveLength(expectedModules.length);
  expect(contents.every((content) => content.status === 'delivered' && content.deliveryVersionId && content.sourceKind === 'simulated')).toBe(true);
  for (const content of contents) {
    contentIds.push(content.id);
    versionIds.push(content.deliveryVersionId!);
    if (content.moduleId === 'market') {
      const payload = content.targetPayload as { symbol?: string };
      if (!payload.symbol) throw new Error('SIMULATED_MARKET_PAYLOAD_MISSING_SYMBOL');
      simulatedSymbols.push(payload.symbol);
      expect((await db.select().from(marketData).where(eq(marketData.symbol, payload.symbol)).limit(1))).toHaveLength(1);
    }
    if (content.moduleId === 'news-top') {
      const delivery = (await db.select().from(adminDataModuleDeliveryOperations).where(eq(adminDataModuleDeliveryOperations.deliveryVersionId, content.deliveryVersionId!)).limit(1))[0];
      const articleId = (delivery?.resultSnapshot as { articleId?: number } | null)?.articleId;
      expect(typeof articleId).toBe('number');
    }
    await expect(rollbackAdminDataModuleDeliveryVersion(content.deliveryVersionId!, 1)).resolves.toMatchObject({ status: 'reverted' });
  }
}

describe('adminDataModuleAutomation complete scope flow integration', () => {
  it('在单模块、分组和全站范围中完成模拟内容的生成、自动审核、兼容推送、版本记录与回滚', async () => {
    const single = await enqueueAdminDataModuleAutomation({ scope: 'single', moduleId: 'market', mode: 'rich_content', actorUserId: 1 });
    runIds.push(single.runId);
    await expect(finish(single.runKey)).resolves.toMatchObject({ total: 1, completed: 1, failed: 0, status: 'completed' });
    await assertAndRollbackRun(single.runId, ['market']);

    const singleNews = await enqueueAdminDataModuleAutomation({ scope: 'single', moduleId: 'news-top', mode: 'rich_content', actorUserId: 1 });
    runIds.push(singleNews.runId);
    await expect(finish(singleNews.runKey)).resolves.toMatchObject({ total: 1, completed: 1, failed: 0, status: 'completed' });
    await assertAndRollbackRun(singleNews.runId, ['news-top']);

    const grouped = await enqueueAdminDataModuleAutomation({ scope: 'group', moduleGroup: '新闻内容', mode: 'rich_content', actorUserId: 1 });
    runIds.push(grouped.runId);
    await expect(finish(grouped.runKey)).resolves.toMatchObject({ total: 1, completed: 1, failed: 0, status: 'completed' });
    await assertAndRollbackRun(grouped.runId, ['news-top']);

    const site = await enqueueAdminDataModuleAutomation({ scope: 'site', mode: 'rich_content', actorUserId: 1 });
    runIds.push(site.runId);
    await expect(finish(site.runKey)).resolves.toMatchObject({ total: 2, completed: 2, failed: 0, status: 'completed' });
    await assertAndRollbackRun(site.runId, ['market', 'news-top']);
    console.info('ADMIN_MODULE_AUTOMATION_FULL_FLOW', JSON.stringify({ singleModules: 2, groupModules: 1, siteModules: 2, rollbackVersions: versionIds.length }));
  });
});
