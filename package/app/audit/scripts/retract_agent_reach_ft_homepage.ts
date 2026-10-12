/**
 * One-off, exact-key repair of the FT Chinese homepage accidentally delivered
 * as a news article. Dry-run by default; --apply only changes its delivery
 * status and disables its direct grant. The raw/processed dataset is retained.
 */
import { and, eq } from "drizzle-orm";
import { agentReachModuleGrants, adminDataModuleContentItems, financeWorldDataset } from "../../drizzle/schema";
import { getDb } from "../../server/db";
import { getPublicModuleFeed } from "../../server/adminModulePublicFeed";
import { listAgentReachModuleGrants } from "../../server/agentReachDelivery";

const id = 732798;
const uuid = "ard_df8e9ff85f0a475b8cafe787f15c765d";
const key = `ar:${uuid}:news-top`;
const db = await getDb();
if (!db) throw new Error("DATABASE_UNAVAILABLE");
const [row] = await db.select().from(adminDataModuleContentItems)
  .where(and(eq(adminDataModuleContentItems.id, id), eq(adminDataModuleContentItems.contentKey, key))).limit(1);
const [record] = await db.select({
  sourceUrl: financeWorldDataset.sourceUrl, dataSubType: financeWorldDataset.dataSubType,
}).from(financeWorldDataset).where(eq(financeWorldDataset.uuid, uuid)).limit(1);
const [grant] = await db.select().from(agentReachModuleGrants)
  .where(and(eq(agentReachModuleGrants.recordUuid, uuid), eq(agentReachModuleGrants.moduleId, "news-top"))).limit(1);
if (!row || !record || !grant ||
  row.moduleId !== "news-top" || row.targetPayload?.source !== "agent-reach" ||
  record.sourceUrl !== "https://www.ftchinese.com/" || record.dataSubType !== "web" ||
  !/^Title:\s*FT中文网/i.test(row.title) || !/Markdown Content:|URL Source:/.test(row.body ?? ""))
  throw new Error("EXACT_HISTORIC_DELIVERY_MISMATCH; NOTHING_CHANGED");
if (!process.argv.includes("--apply")) {
  const publicFeed = await getPublicModuleFeed("news-top");
  console.log(JSON.stringify({
    id, key, status: row.status, grantEnabled: grant.isEnabled,
    visibleInNewsTop: publicFeed.items.some(item => item.deliveryKey === key),
    action: "dry-run; append --apply to retract this exact delivery",
  }));
} else {
  await db.transaction(async tx => {
    await tx.update(adminDataModuleContentItems).set({
      status: "reverted", errorDetail: "AGENT_REACH_WEB_HOMEPAGE_IS_NOT_A_NEWS_ARTICLE",
    }).where(and(eq(adminDataModuleContentItems.id, id), eq(adminDataModuleContentItems.contentKey, key)));
    await tx.update(agentReachModuleGrants).set({ isEnabled: false, followRss: false, rssUrl: null })
      .where(eq(agentReachModuleGrants.id, grant.id));
  });
  const publicFeed = await getPublicModuleFeed("news-top");
  console.log(JSON.stringify({
    id, key, status: "reverted", grantEnabled: false,
    visibleInNewsTop: publicFeed.items.some(item => item.deliveryKey === key),
    rawRecordRetained: true,
  }));
}
const delivery = await listAgentReachModuleGrants();
console.log(JSON.stringify({
  dailyScheduleEnabled: delivery.schedule?.isEnabled ?? false,
  dailyScheduleStatus: delivery.schedule?.lastStatus ?? null,
  activeRssSubscriptions: delivery.grants.filter(item => item.isEnabled && item.followRss && item.rssUrl).length,
}));
await db.$client.end();
