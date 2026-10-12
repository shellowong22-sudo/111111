import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminDataModuleContentItems, adminDataModuleProfiles } from '../drizzle/schema';
import { getDb } from './db';
import { ADMIN_DATA_MODULE_QUALITY_THRESHOLD, assessAdminDataModuleContentQuality, generateAdminDataModuleContentDraft } from './adminDataModuleDelivery';

let originalProfile: typeof adminDataModuleProfiles.$inferSelect | null = null;
let createdContentKey: string | null = null;

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (createdContentKey) await db.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, createdContentKey));
  if (originalProfile) await db.update(adminDataModuleProfiles).set({ sourceKind: originalProfile.sourceKind, runtimeStatus: originalProfile.runtimeStatus, updatedByUserId: originalProfile.updatedByUserId, updatedAt: originalProfile.updatedAt }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
  originalProfile = null;
  createdContentKey = null;
});

describe('adminDataModuleDelivery quality integration', () => {
  it('对低质量输入给出非固定评分与明确拒绝原因，并将合格模拟候选的评分报告持久化', async () => {
    const rejected = assessAdminDataModuleContentQuality({ title: '短', body: '短', topic: '', category: '', keywords: [], tags: [], sourceKind: 'simulated', payload: { symbol: '', name: '', market: 'stock', price: '', changeVal: '', changePct: '', volume: '', updatedAt: '' } });
    expect(rejected).toMatchObject({ passed: false, threshold: ADMIN_DATA_MODULE_QUALITY_THRESHOLD });
    expect(rejected.score).toBeLessThan(ADMIN_DATA_MODULE_QUALITY_THRESHOLD);
    expect(rejected.rejectionReasons.length).toBeGreaterThan(0);
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    originalProfile = (await db.select().from(adminDataModuleProfiles).where(eq(adminDataModuleProfiles.moduleId, 'market')).limit(1))[0] ?? null;
    if (!originalProfile) throw new Error('MARKET_PROFILE_NOT_MATERIALIZED');
    await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', runtimeStatus: 'enabled', updatedAt: new Date() }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
    const generated = await generateAdminDataModuleContentDraft({ moduleId: 'market', runKey: `modrun_${randomUUID().replaceAll('-', '')}`, actorUserId: 1, mode: 'rich_content' });
    createdContentKey = generated.contentKey;
    expect(generated).toMatchObject({ duplicate: false, status: 'pending_review', qualityPassed: true });
    expect(generated.qualityScore).toBeGreaterThanOrEqual(ADMIN_DATA_MODULE_QUALITY_THRESHOLD);
    const stored = (await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, generated.contentKey)).limit(1))[0];
    expect(stored).toMatchObject({ qualityScore: generated.qualityScore, status: 'pending_review' });
    expect(stored?.qualityReport).toMatchObject({ passed: true, score: generated.qualityScore, threshold: ADMIN_DATA_MODULE_QUALITY_THRESHOLD });
  });
});
