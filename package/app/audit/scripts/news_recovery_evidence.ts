import { mkdirSync, writeFileSync } from 'node:fs';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../server/db';
import { adminDataModuleContentItems } from '../../drizzle/schema';
import { getPublicFeedsForPath, publicContentFingerprint } from '../../server/adminModulePublicFeed';
import { getGlobalNewsFeed } from '../../server/globalNewsFeed';
import { resolveAdminDataModulesForPath } from '../../shared/adminDataModules';

async function main() {
  const tabs = ['top','btdy','frnt','cn','read','ni','nh','firs','bi','beco','dayb','mag','media','medi','third','intl','commentary','opin','bnef','personal','myn','nlrt','nsub','mrep','nzpd','social','soci','tren','docs'];
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const moduleRows = [];
  const owners = new Map<string, string>();
  const duplicateBodies: Array<{ first: string; second: string }> = [];
  for (const tab of tabs) {
    const path = '/news-hub?tab=' + tab;
    const feeds = await getPublicFeedsForPath(path, { id: 4110001, role: 'admin' });
    const items = feeds.flatMap(feed => feed.items);
    for (const item of items) {
      if (item.dataset) continue;
      const fingerprint = publicContentFingerprint(item.body);
      const owner = owners.get(fingerprint);
      if (owner && owner !== tab) duplicateBodies.push({ first: owner, second: tab });
      owners.set(fingerprint, tab);
    }
    moduleRows.push({ tab, path, mappedModules: resolveAdminDataModulesForPath(path).map(module => module.id), deliveryCount: items.length, titles: items.map(item => item.title) });
  }
  const receipts = await db.select({ id: adminDataModuleContentItems.id, moduleId: adminDataModuleContentItems.moduleId, payload: adminDataModuleContentItems.targetPayload }).from(adminDataModuleContentItems).where(and(eq(adminDataModuleContentItems.status, 'delivered'), inArray(adminDataModuleContentItems.moduleId, ['news-top', 'news-ni', 'econ-hub']))).limit(300);
  const ackEvidence = receipts.flatMap(row => {
    const payload = row.payload as Record<string, any> | null;
    const receipt = payload?.deliveryReceipt;
    if (!receipt?.frontAckAt || payload?.simulatedFields?.length) return [];
    return [{ contentId: row.id, moduleId: row.moduleId, receiptId: receipt.receiptId, status: receipt.currentStatus, sentAt: receipt.sentAt, firstAckAt: receipt.frontAckAt, latestAckAt: receipt.latestFrontAckAt, successCount: receipt.successCount, pendingCount: receipt.pendingCount }];
  });
  const global = await getGlobalNewsFeed({ limit: 200 });
  const evidence = { checkedAt: new Date().toISOString(), moduleRows, duplicateBodies, ackEvidence, sources: global.sources, retrievedRows: global.rows.length, boundary: 'Delivery audit covers the current per-module feed windows; source polling is not exchange realtime. Empty delivery feeds are not proof that all functional data sources are configured.' };
  mkdirSync('recovery-evidence/news-20260919', { recursive: true });
  writeFileSync('recovery-evidence/news-20260919/runtime-evidence.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ tabs: moduleRows.length, duplicateBodies, acknowledgedDeliveries: ackEvidence.length, availableSources: global.sources.filter(source => source.status === 'available').length, retrievedRows: global.rows.length }));
}
main().then(() => process.exit(0)).catch(error => { console.error(error instanceof Error ? error.message : 'AUDIT_FAILED'); process.exit(1); });
