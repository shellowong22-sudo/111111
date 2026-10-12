import { mkdirSync, writeFileSync } from 'node:fs';
import { adminNewsIngestionRouter } from '../../server/routers/adminNewsIngestion';
import { GLOBAL_NEWS_SOURCES } from '../../shared/globalNewsSources';
import { getGlobalNewsFeed } from '../../server/globalNewsFeed';
import { getDb } from '../../server/db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const [user] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
  if (!user) throw new Error('ADMIN_ACCOUNT_REQUIRED');
  const caller = adminNewsIngestionRouter.createCaller({ user, req: {} as any, res: {} as any });
  const configured = [];
  // Idempotent existing admin operations preserve any previously configured source.
  for (const source of GLOBAL_NEWS_SOURCES) {
    const record = await caller.createSource({ name: source.name, websiteUrl: source.websiteUrl, feedUrl: source.feedUrl, maxItemsPerRun: 50, processingMode: 'queued', isActive: true });
    const sync = await caller.syncSource({ sourceId: record.sourceId, maxItemsPerRun: 50 });
    configured.push({ source: source.id, ...record, sync });
    console.log(source.id, JSON.stringify({ sourceId: record.sourceId, sync }));
  }
  const live = await getGlobalNewsFeed({ limit: 200 });
  const report = { checkedAt: new Date().toISOString(), configured, live };
  mkdirSync('recovery-evidence/news-20260919', { recursive: true });
  writeFileSync('recovery-evidence/news-20260919/global-source-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ sources: live.sources, totalRows: live.rows.length }, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
