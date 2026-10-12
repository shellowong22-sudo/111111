import { mkdirSync, writeFileSync } from 'node:fs';
import { getPublicFeedsForPath } from '../../server/adminModulePublicFeed';
import { resolveAdminDataModulesForPath } from '../../shared/adminDataModules';
const tabs = ['top','btdy','frnt','cn','read','ni','nh','firs','bi','beco','dayb','mag','media','medi','third','intl','commentary','opin','bnef','personal','myn','nlrt','nsub','mrep','nzpd','social','soci','tren','docs'];
async function main() {
  const rows = [];
  for (const tab of tabs) {
    const path = `/news-hub?tab=${tab}`;
    const feeds = await getPublicFeedsForPath(path, { id: 1, role: 'admin' });
    const items = feeds.flatMap(feed => feed.items);
    rows.push({ tab, path, targets: resolveAdminDataModulesForPath(path).map(m => m.id), items: items.map(item => ({ key: item.itemKey, title: item.title, publishedAt: item.publishedAt })) });
    console.log(tab, items.length, items.slice(0, 3).map(item => item.title).join(' | '));
  }
  mkdirSync('recovery-evidence/news-20260919', { recursive: true });
  writeFileSync('recovery-evidence/news-20260919/delivery-audit.json', JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
