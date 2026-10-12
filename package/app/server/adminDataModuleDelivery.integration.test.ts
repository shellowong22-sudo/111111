import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminDataModuleContentItems, adminDataModuleDeliveryEvents, adminDataModuleDeliveryOperations, adminDataModuleDeliveryVersions, adminDataModuleProfiles, marketData } from '../drizzle/schema';
import { getDb } from './db';
import { approveAdminDataModuleContent, deliverApprovedAdminDataModuleContent, generateAdminDataModuleContentDraft, rollbackAdminDataModuleDeliveryVersion } from './adminDataModuleDelivery';

let originalProfile: typeof adminDataModuleProfiles.$inferSelect | null = null;
let contentKey: string | null = null;
let versionId: number | null = null;
let simulatedSymbol: string | null = null;

beforeEach(async () => {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  originalProfile = (await db.select().from(adminDataModuleProfiles).where(eq(adminDataModuleProfiles.moduleId, 'market')).limit(1))[0] ?? null;
  if (!originalProfile) throw new Error('MARKET_PROFILE_NOT_MATERIALIZED');
  await db.update(adminDataModuleProfiles).set({ sourceKind: 'simulated', runtimeStatus: 'enabled', updatedAt: new Date() }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
});

afterEach(async () => {
  const db = await getDb();
  if (!db) return;
  if (simulatedSymbol) await db.delete(marketData).where(eq(marketData.symbol, simulatedSymbol));
  if (versionId) {
    await db.delete(adminDataModuleDeliveryEvents).where(eq(adminDataModuleDeliveryEvents.deliveryVersionId, versionId));
    await db.delete(adminDataModuleDeliveryOperations).where(eq(adminDataModuleDeliveryOperations.deliveryVersionId, versionId));
    await db.delete(adminDataModuleDeliveryVersions).where(eq(adminDataModuleDeliveryVersions.id, versionId));
  }
  if (contentKey) await db.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, contentKey));
  if (originalProfile) {
    await db.update(adminDataModuleProfiles).set({
      sourceKind: originalProfile.sourceKind,
      runtimeStatus: originalProfile.runtimeStatus,
      currentVersion: originalProfile.currentVersion,
      rollbackVersion: originalProfile.rollbackVersion,
      lastPushedAt: originalProfile.lastPushedAt,
      updatedByUserId: originalProfile.updatedByUserId,
      updatedAt: originalProfile.updatedAt,
    }).where(eq(adminDataModuleProfiles.moduleId, 'market'));
  }
  contentKey = null;
  versionId = null;
  simulatedSymbol = null;
  originalProfile = null;
});

describe('adminDataModuleDelivery persistent integration', () => {
  it('将模拟候选内容通过真实审核和版本推送写入既有 market_data 字段，并可从快照回滚', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const runKey = `modrun_${randomUUID().replaceAll('-', '')}`;
    const draft = await generateAdminDataModuleContentDraft({ moduleId: 'market', runKey, actorUserId: 1 });
    contentKey = draft.contentKey;
    expect(draft).toMatchObject({ sourceKind: 'simulated', status: 'pending_review', targetContract: 'market_snapshot' });

    const approved = await approveAdminDataModuleContent(contentKey, 1);
    versionId = approved.versionId;
    expect(approved).toMatchObject({ status: 'approved', repeated: false });

    const beforeDelivery = (await db.select().from(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.contentKey, contentKey)).limit(1))[0];
    const payload = beforeDelivery?.targetPayload as { symbol?: string } | null;
    simulatedSymbol = payload?.symbol ?? null;
    expect(simulatedSymbol).toMatch(/^SIM-MARKET-/);

    await expect(deliverApprovedAdminDataModuleContent(contentKey, 1)).resolves.toMatchObject({ status: 'delivered' });
    const pushed = (await db.select().from(marketData).where(eq(marketData.symbol, simulatedSymbol!)).limit(1))[0];
    expect(pushed).toMatchObject({ symbol: simulatedSymbol });
    expect(typeof pushed?.price).toBe('string');
    expect(typeof pushed?.changePct).toBe('string');

    await expect(rollbackAdminDataModuleDeliveryVersion(versionId, 1)).resolves.toMatchObject({ status: 'reverted' });
    const rolledBack = await db.select().from(marketData).where(eq(marketData.symbol, simulatedSymbol!)).limit(1);
    expect(rolledBack).toHaveLength(0);

    const operation = (await db.select().from(adminDataModuleDeliveryOperations).where(eq(adminDataModuleDeliveryOperations.deliveryVersionId, versionId)).limit(1))[0];
    expect(operation).toMatchObject({ status: 'reverted', targetContract: 'market_snapshot' });
  });
});
