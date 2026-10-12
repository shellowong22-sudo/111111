import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  adminDataModuleAutomationStepEvents,
  adminDataModuleContentItems,
  adminDataModuleDeliveryEvents,
  adminDataModuleDeliveryOperations,
} from '../drizzle/schema';
import { getDb } from './db';
import { getAdminDataModuleDeliveryStats } from './adminDataModuleDelivery';

const token = randomUUID().replaceAll('-', '');
const runId = Number(token.slice(0, 8)) || 1;
const moduleId = 'market';
const key = (prefix: string) => `${prefix}_${token}`;

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  await db.delete(adminDataModuleAutomationStepEvents).where(eq(adminDataModuleAutomationStepEvents.runId, runId));
  await db.delete(adminDataModuleDeliveryEvents).where(eq(adminDataModuleDeliveryEvents.runId, runId));
  await db.delete(adminDataModuleDeliveryOperations).where(eq(adminDataModuleDeliveryOperations.runId, runId));
  await db.delete(adminDataModuleContentItems).where(eq(adminDataModuleContentItems.runId, runId));
}

describe('admin data module delivery stats persistent integration', () => {
  it('aggregates persisted content, operations, delivery events and step events separately', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    await cleanup();
    try {
      await db.insert(adminDataModuleContentItems).values([
        { contentKey: key('modcontent'), moduleId, runId, contentType: 'market_snapshot', sourceKind: 'simulated', status: 'delivered', title: 'pushed', keywords: [], tags: [], contentHash: key('hash'), dedupeScope: key('scope') },
        { contentKey: key('modcontent2'), moduleId, runId, contentType: 'market_snapshot', sourceKind: 'simulated', status: 'approved', title: 'new', keywords: [], tags: [], contentHash: key('hash2'), dedupeScope: key('scope') },
        { contentKey: key('modcontent3'), moduleId, runId, contentType: 'market_snapshot', sourceKind: 'simulated', status: 'skipped_duplicate', title: 'duplicate', keywords: [], tags: [], contentHash: key('hash3'), dedupeScope: key('scope') },
        { contentKey: key('modcontent4'), moduleId, runId, contentType: 'market_snapshot', sourceKind: 'simulated', status: 'failed', title: 'failed', keywords: [], tags: [], contentHash: key('hash4'), dedupeScope: key('scope'), errorDetail: 'SOURCE_TIMEOUT' },
      ]);
      await db.insert(adminDataModuleDeliveryOperations).values([
        { operationKey: key('operation'), idempotencyKey: key('idem'), moduleId, runId, status: 'applied', targetContract: 'market_snapshot', targetReference: key('target'), payloadHash: key('payload'), candidatePayload: {}, previousTargetSnapshot: { symbol: 'OLD' }, itemCount: 1 },
        { operationKey: key('operation2'), idempotencyKey: key('idem2'), moduleId, runId, status: 'failed', targetContract: 'market_snapshot', targetReference: key('target2'), payloadHash: key('payload2'), candidatePayload: {}, errorDetail: 'SOURCE_TIMEOUT' },
      ]);
      await db.insert(adminDataModuleDeliveryEvents).values([
        { moduleId, runId, action: 'pushed', status: 'success', targetContract: 'market_snapshot', targetDetail: 'target', itemCount: 1, detail: 'published', actorUserId: 1 },
        { moduleId, runId, action: 'cancelled', status: 'skipped', targetContract: 'market_snapshot', targetDetail: 'target', itemCount: 1, detail: 'MODULE_DISABLED', actorUserId: 1 },
        { moduleId, runId, action: 'push_failed', status: 'failed', targetContract: 'market_snapshot', targetDetail: 'target', itemCount: 0, detail: 'DELIVERY_TIMEOUT', actorUserId: 1 },
      ]);
      await db.insert(adminDataModuleAutomationStepEvents).values({ runId, moduleId, step: 'quality_check', action: 'quality_check_rejected', status: 'failed', detail: 'QUALITY_BELOW_THRESHOLD' });

      await expect(getAdminDataModuleDeliveryStats({ moduleId, runId })).resolves.toEqual({
        newCount: 2,
        updatedCount: 1,
        skippedCount: 2,
        duplicateCount: 1,
        otherSkippedCount: 1,
        failedCount: 3,
        pushedCount: 1,
        failureReasons: ['SOURCE_TIMEOUT', 'DELIVERY_TIMEOUT', 'QUALITY_BELOW_THRESHOLD'],
        skipReasons: ['MODULE_DISABLED'],
      });
    } finally {
      await cleanup();
    }
  });
});
