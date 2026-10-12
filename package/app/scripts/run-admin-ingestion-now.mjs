import { eq } from 'drizzle-orm';
import { adminNewsIngestionSources, adminMarketIngestionTargets } from '../drizzle/schema.ts';
import { syncAdminNewsSource } from '../server/adminNewsIngestion.ts';
import { syncAdminMarketTarget } from '../server/adminMarketIngestion.ts';
import { getDb } from '../server/db.ts';

const db = await getDb();
if (!db) throw new Error('DATABASE_UNAVAILABLE');

const sources = await db.select({ id: adminNewsIngestionSources.id, name: adminNewsIngestionSources.name })
  .from(adminNewsIngestionSources)
  .where(eq(adminNewsIngestionSources.isActive, true))
  .limit(1);
const targets = await db.select({ id: adminMarketIngestionTargets.id, symbol: adminMarketIngestionTargets.symbol })
  .from(adminMarketIngestionTargets)
  .where(eq(adminMarketIngestionTargets.isActive, true))
  .limit(5);

const news = sources[0] ? await syncAdminNewsSource(sources[0].id, 1) : { status: 'skipped', reason: 'NO_ACTIVE_SOURCE' };
const markets = [];
for (const target of targets) markets.push(await syncAdminMarketTarget(target.id, 1));

console.log(JSON.stringify({ news, markets }, null, 2));
process.exit(0);
