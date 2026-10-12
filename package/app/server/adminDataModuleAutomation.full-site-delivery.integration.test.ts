import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents, adminDataModuleContentItems, adminDataModuleDeliveryEvents, adminDataModuleDeliveryOperations, adminDataModuleDeliveryVersions, adminDataModuleProfiles, adminNewsIngestionArticles, adminNewsIngestionAuditEvents, adminNewsIngestionSources, announcementAcceptanceEvents, announcements, marketData } from '../drizzle/schema';
import { getDb } from './db';
import { enqueueAdminDataModuleAutomation, processAdminDataModuleAutomationRun } from './adminDataModuleAutomation';
import { rollbackAdminDataModuleDeliveryVersion } from './adminDataModuleDelivery';
import { ensureAdminDataModuleProfiles } from './adminDataModuleProfiles';

type ProfileSnapshot = Pick<typeof adminDataModuleProfiles.$inferSelect, 'moduleId' | 'sourceKind' | 'automationEnabled' | 'reviewPolicy' | 'pushPolicy' | 'runtimeStatus' | 'currentVersion' | 'rollbackVersion' | 'lastExecutedAt' | 'lastPushedAt' | 'updatedByUserId' | 'updatedAt'>;

let originalProfiles: ProfileSnapshot[] = [];
let runId: number | null = null;
let existingSimulationSourceId: number | null = null;
const simulatedSymbols: string[] = [];
const simulatedAnnouncementIds: number[] = [];

beforeEach(async () => {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(1);
  originalProfiles = (await db.select().from(adminDataModuleProfiles)).map((profile) => ({
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
  const writableIds = originalProfiles.filter((profile) => {
    const current = profile as typeof adminDataModuleProfiles.$inferSelect;
    return current.moduleId.length > 0;
  }).map((profile) => profile.moduleId);
  await db.update(adminDataModuleProfiles).set({ automationEnabled: false, runtimeStatus: 'enabled', updatedAt: new Date() });
  const writableProfiles = (await db.select().from(adminDataModuleProfiles)).filter((profile) => profile.targetContract === 'market_snapshot' || profile.targetContract === 'news_review_pipeline' || profile.targetContract === 'announcement_publication');
  expect(writableProfiles.length).toBe(46);
  await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', automationEnabled: true, reviewPolicy: 'auto_approved', pushPolicy: 'after_approval', runtimeStatus: 'enabled', updatedAt: new Date() }).where(inArray(adminDataModuleProfiles.moduleId, writableProfiles.map((profile) => profile.moduleId)));
  void writableIds;
});

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (runId !== null) {
    const contents = await db.select({ deliveryVersionId: adminDataModuleContentItems.deliveryVersionId }).from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, runId));
    const versionIds = contents.flatMap((content) => content.deliveryVersionId ? [content.deliveryVersionId] : []);
    for (const versionId of versionIds) await rollbackAdminDataModuleDeliveryVersion(versionId, 1);
    for (const symbol of simulatedSymbols) await db.delete(marketData).where(eq(marketData.symbol, symbol));
    if (simulatedAnnouncementIds.length) {
      await db.delete(announcementAcceptanceEvents).where(inArray(announcementAcceptanceEvents.announcementId, simulatedAnnouncementIds));
      await db.delete(announcements).where(inArray(announcements.id, simulatedAnnouncementIds));
    }
    if (versionIds.length) {
      await db.delete(adminDataModuleDeliveryEvents).where(inArray(adminDataModuleDeliveryEvents.deliveryVersionId, versionIds));
      await db.delete(adminDataModuleDeliveryOperations).where(inArray(adminDataModuleDeliveryOperations.deliveryVersionId, versionIds));
      await db.delete(adminDataModuleDeliveryVersions).where(inArray(adminDataModuleDeliveryVersions.id, versionIds));
    }
    await db.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, runId));
    await db.delete(adminDataModuleDeliveryEvents).where(eq(adminDataModuleDeliveryEvents.runId, runId));
    await db.delete(adminDataModuleAutomationStepEvents).where(eq(adminDataModuleAutomationStepEvents.runId, runId));
    await db.delete(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, runId));
    await db.delete(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.id, runId));
  }
  if (existingSimulationSourceId === null) {
    const source = (await db.select().from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.provider, 'finance_hub_simulated')).limit(1))[0] ?? null;
    if (source) {
      const articles = await db.select({ id: adminNewsIngestionArticles.id }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.sourceId, source.id));
      if (articles.length) await db.delete(adminNewsIngestionAuditEvents).where(inArray(adminNewsIngestionAuditEvents.articleId, articles.map((article) => article.id)));
      await db.delete(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.sourceId, source.id));
      await db.delete(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.id, source.id));
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
  runId = null;
  existingSimulationSourceId = null;
  simulatedSymbols.length = 0;
  simulatedAnnouncementIds.length = 0;
});

describe('adminDataModuleAutomation full writable-site delivery integration', () => {
  it('对全站全部 46 个可写模块完成模拟生成、质量校验、自动审核、兼容推送、版本记录和回滚', async () => {
    const queued = await enqueueAdminDataModuleAutomation({ scope: 'site', mode: 'rich_content', actorUserId: 1 });
    runId = queued.runId;
    expect(queued.requestedCount).toBe(46);
    let result = await processAdminDataModuleAutomationRun(queued.runKey, 1, 8);
    for (let attempt = 0; result.status === 'running' && attempt < 8; attempt += 1) result = await processAdminDataModuleAutomationRun(queued.runKey, 1, 8);
    expect(result).toMatchObject({ total: 46, completed: 46, failed: 0, status: 'completed' });
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const contents = await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, queued.runId));
    expect(contents).toHaveLength(46);
    expect(contents.every((content) => content.status === 'delivered' && content.deliveryVersionId && content.qualityScore >= 75)).toBe(true);
    expect(contents.every((content) => (content.qualityReport as { passed?: boolean } | null)?.passed === true)).toBe(true);
    const marketContents = contents.filter((content) => content.contentType === 'market_snapshot');
    const newsContents = contents.filter((content) => content.contentType === 'news_article');
    const announcementContents = contents.filter((content) => content.contentType === 'announcement');
    expect(marketContents.length).toBeGreaterThan(0);
    expect(newsContents.length).toBeGreaterThan(0);
    expect(announcementContents).toHaveLength(1);
    for (const content of marketContents) {
      const symbol = (content.targetPayload as { symbol?: string } | null)?.symbol;
      if (!symbol) throw new Error('FULL_SITE_MARKET_SIMULATION_SYMBOL_MISSING');
      simulatedSymbols.push(symbol);
      expect(await db.select().from(marketData).where(eq(marketData.symbol, symbol)).limit(1)).toHaveLength(1);
    }
    const operations = await db.select().from(adminDataModuleDeliveryOperations).where(eq(adminDataModuleDeliveryOperations.runId, queued.runId));
    expect(operations).toHaveLength(46);
    const announcementOperation = operations.find((operation) => operation.targetContract === 'announcement_publication');
    const announcementId = (announcementOperation?.resultSnapshot as { announcementId?: number } | null)?.announcementId;
    expect(typeof announcementId).toBe('number');
    if (typeof announcementId !== 'number') throw new Error('FULL_SITE_SIMULATED_ANNOUNCEMENT_ID_MISSING');
    simulatedAnnouncementIds.push(announcementId);
    const publishedAnnouncement = (await db.select().from(announcements).where(eq(announcements.id, announcementId)).limit(1))[0];
    expect(publishedAnnouncement).toMatchObject({ status: 'published', title: expect.stringContaining('模拟公告'), content: expect.stringContaining('模拟公告') });
    expect(publishedAnnouncement?.publishedAt).toBeInstanceOf(Date);
    expect(await db.select().from(announcementAcceptanceEvents).where(eq(announcementAcceptanceEvents.announcementId, announcementId))).toHaveLength(1);
    console.info('ADMIN_MODULE_AUTOMATION_FULL_WRITABLE_SITE', JSON.stringify({ modules: contents.length, marketModules: marketContents.length, newsModules: newsContents.length, announcementModules: announcementContents.length, versions: contents.filter((content) => content.deliveryVersionId).length }));
  });
});
