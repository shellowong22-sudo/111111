import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { eq, inArray, and } from 'drizzle-orm';
import { getDb } from '../../server/db';
import { adminDataModuleContentItems } from '../../drizzle/schema';
import { ECONOMIC_DATA_SCOPES } from '../../shared/economicDataScopes';
import { resolveAdminDataModulesForPath } from '../../shared/adminDataModules';
import { getPublicFeedsForPath } from '../../server/adminModulePublicFeed';
import { deliveryDatasetIdentity } from '../../shared/deliveryDatasetIdentity';
import { buildOpenBBApiCatalog } from '../../server/openbbPriorityAService';

async function main() {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const findings = [];
  const owners = new Map<string, string>();
  const repeated = [];
  for (const [tab, name] of ECONOMIC_DATA_SCOPES) {
    const path = `/econ-hub?tab=${tab}`;
    const items = (await getPublicFeedsForPath(path, { id: 4110001, role: 'admin' })).flatMap(feed => feed.items);
    for (const item of items) {
      const identity = deliveryDatasetIdentity(item.dataset) ?? item.body;
      if (owners.has(identity) && owners.get(identity) !== tab) repeated.push([owners.get(identity), tab]);
      owners.set(identity, tab);
    }
    findings.push({ tab, name, path, modules: resolveAdminDataModulesForPath(path).map(m => m.id), itemCount: items.length, titles: items.map(item => item.title) });
  }
  const legacy = await db.select({ id: adminDataModuleContentItems.id, moduleId: adminDataModuleContentItems.moduleId, title: adminDataModuleContentItems.title }).from(adminDataModuleContentItems).where(and(eq(adminDataModuleContentItems.status, 'delivered'), inArray(adminDataModuleContentItems.moduleId, ['econ-hub'])));
  const receipts = await db.select({ id: adminDataModuleContentItems.id, moduleId: adminDataModuleContentItems.moduleId, payload: adminDataModuleContentItems.targetPayload }).from(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.moduleId, ECONOMIC_DATA_SCOPES.map(([tab]) => `economic-${tab}`)));
  const ackEvidence = receipts.map(row => {
    const receipt = (row.payload as any)?.deliveryReceipt;
    return { id: row.id, moduleId: row.moduleId, status: receipt?.currentStatus, frontAckAt: receipt?.frontAckAt, successCount: receipt?.successCount, pendingCount: receipt?.pendingCount };
  });
  const api = buildOpenBBApiCatalog(JSON.parse(readFileSync('.runtime/openbb-admin/live-openapi.json', 'utf8')));
  const economicOperations = api.operations.filter(item => /\/economy\/|\/imf_utils\//.test(item.path)).map(item => ({ path: item.path, target: item.primaryModuleId }));
  const evidence = { checkedAt: new Date().toISOString(), findings, repeated, legacyRowsPreserved: legacy, economicOperations, ackEvidence, limitation: 'Audits delivery scope and visible feed data only. Empty deliveries do not prove provider configuration. Original static economic content is not accepted as realtime.' };
  mkdirSync('recovery-evidence/economics-20260919', { recursive: true });
  writeFileSync('recovery-evidence/economics-20260919/delivery-audit.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ functions: findings.length, repeated, legacyRowsPreserved: legacy.length, economicOperations: economicOperations.length, economicOperationOwners: [...new Set(economicOperations.map(item => item.target))], availableFeeds: findings.filter(f => f.itemCount > 0).length, ackEvidence }));
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
