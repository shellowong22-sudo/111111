import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import { adminDataModuleAutomationRunItems, adminDataModuleAutomationRuns, adminDataModuleAutomationStepEvents, adminDataModuleContentItems, adminDataModuleProfiles } from '../drizzle/schema';
import { getDb } from './db';
import { enqueueAdminDataModuleAutomation, processAdminDataModuleAutomationRun } from './adminDataModuleAutomation';

const groups = ['no_server_contract', 'request_time_read', 'simulation_control'] as const;
const moduleIds = groups.map((group) => ADMIN_DATA_MODULES.find((module) => module.delivery.group === group)?.id).filter((id): id is string => Boolean(id));
const originalProfiles: Array<typeof adminDataModuleProfiles.$inferSelect> = [];
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
  await Promise.all(originalProfiles.map((profile) => db.update(adminDataModuleProfiles).set({ sourceKind: profile.sourceKind, automationEnabled: profile.automationEnabled, runtimeStatus: profile.runtimeStatus, updatedByUserId: profile.updatedByUserId, updatedAt: profile.updatedAt }).where(eq(adminDataModuleProfiles.moduleId, profile.moduleId))));
  originalProfiles.length = 0;
  runIds.length = 0;
});

describe('adminDataModuleAutomation restricted contract integration', () => {
  it('对未识别可写前端位置的模块明确跳过并记录审计，不创建内容或修改任何前端读取目标', async () => {
    expect(moduleIds).toHaveLength(3);
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    for (const moduleId of moduleIds) {
      const profile = (await db.select().from(adminDataModuleProfiles).where(eq(adminDataModuleProfiles.moduleId, moduleId)).limit(1))[0];
      if (!profile) throw new Error(`PROFILE_NOT_MATERIALIZED:${moduleId}`);
      originalProfiles.push(profile);
      await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', automationEnabled: true, runtimeStatus: 'enabled', updatedAt: new Date() }).where(eq(adminDataModuleProfiles.moduleId, moduleId));
      const queued = await enqueueAdminDataModuleAutomation({ scope: 'single', moduleId, mode: 'fast_draft', actorUserId: 1 });
      runIds.push(queued.runId);
      const processed = await processAdminDataModuleAutomationRun(queued.runKey, 1, 1);
      expect(processed).toMatchObject({ processed: 1, skipped: 1, status: 'partial' });
      const item = (await db.select().from(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, queued.runId)).limit(1))[0];
      expect(item).toMatchObject({ moduleId, status: 'skipped', currentStep: 'no_writable_frontend_contract' });
      expect(await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, queued.runId))).toHaveLength(0);
    }
  });
});
