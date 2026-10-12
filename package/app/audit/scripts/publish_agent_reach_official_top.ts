/**
 * One real, authorized Agent Reach -> company database -> TOP acceptance run.
 * Fixed to the Board's original press-release feed; no arbitrary third-party
 * site can be introduced by this audit command.
 */
import { and, desc, eq } from "drizzle-orm";
import { adminDataModuleContentItems, financeWorldDataset } from "../../drizzle/schema";
import { connectAgentReachPublicNewsSource, runAgentReachDailyDelivery } from "../../server/agentReachDelivery";
import { getPublicFeedsForPath, getPublicModuleFeed } from "../../server/adminModulePublicFeed";
import { isFederalReservePressReleaseUrl } from "../../server/agentReachOfficialNews";
import { getDb } from "../../server/db";

const feedUrl = "https://www.federalreserve.gov/feeds/press_all.xml";
if (!process.argv.includes("--publish")) throw new Error("EXPLICIT_--publish_REQUIRED");
const receipt = await connectAgentReachPublicNewsSource(feedUrl, 1, true);
const db = await getDb();
if (!db) throw new Error("DATABASE_UNAVAILABLE");
try {
  if (process.argv.includes("--repair-source-times")) {
    const historic = await db.select({
      id: adminDataModuleContentItems.id,
      payload: adminDataModuleContentItems.targetPayload,
      sourceReference: adminDataModuleContentItems.sourceReference,
      publishedAt: adminDataModuleContentItems.publishedAt,
    }).from(adminDataModuleContentItems).where(and(
      eq(adminDataModuleContentItems.moduleId, "news-top"),
      eq(adminDataModuleContentItems.status, "delivered"),
      eq(adminDataModuleContentItems.category, "新闻全文"),
    ));
    let corrected = 0;
    for (const row of historic) {
      if (row.payload?.source !== "agent-reach" ||
        row.payload.verifiedOfficialFullText !== true ||
        !isFederalReservePressReleaseUrl(row.sourceReference ?? "") ||
        typeof row.payload.recordUuid !== "string") continue;
      const [record] = await db.select({ metadata: financeWorldDataset.financeArrayJson })
        .from(financeWorldDataset).where(eq(financeWorldDataset.uuid, row.payload.recordUuid)).limit(1);
      const value = record?.metadata?.published;
      const timestamp = typeof value === "string" ? new Date(value) : null;
      if (!timestamp || Number.isNaN(timestamp.getTime()) ||
        timestamp.getTime() > Date.now() + 5 * 60_000 ||
        (row.publishedAt && Math.abs(timestamp.getTime() - row.publishedAt.getTime()) < 60_000)) continue;
      await db.update(adminDataModuleContentItems).set({ publishedAt: timestamp })
        .where(and(
          eq(adminDataModuleContentItems.id, row.id),
          eq(adminDataModuleContentItems.status, "delivered"),
        ));
      corrected += 1;
    }
    console.log(JSON.stringify({ officialArticlePublicationTimesCorrected: corrected }));
  }
  const rows = await db.select({
    contentKey: adminDataModuleContentItems.contentKey,
    body: adminDataModuleContentItems.body, title: adminDataModuleContentItems.title,
    category: adminDataModuleContentItems.category,
    sourceReference: adminDataModuleContentItems.sourceReference,
    payload: adminDataModuleContentItems.targetPayload,
  }).from(adminDataModuleContentItems).where(and(
    eq(adminDataModuleContentItems.moduleId, "news-top"),
    eq(adminDataModuleContentItems.status, "delivered"),
    eq(adminDataModuleContentItems.category, "新闻全文"),
  )).orderBy(desc(adminDataModuleContentItems.publishedAt)).limit(40);
  const board = rows.find(row => row.payload?.source === "agent-reach" &&
    row.payload.verifiedOfficialFullText === true &&
    isFederalReservePressReleaseUrl(row.sourceReference ?? "") &&
    row.contentKey.startsWith("ar:"));
  if (!board || !board.body || board.body.length < 500 ||
    board.body.split(/\n{2,}/).length < 4 || /Menu\s+\d|For media inquiries|URL Source:/.test(board.body))
    throw new Error("VERIFIED_COMPLETE_OFFICIAL_ARTICLE_NOT_DELIVERED");
  const publicFeed = await getPublicModuleFeed("news-top");
  const pathFeeds = await getPublicFeedsForPath("/menu-item/TOP");
  const publicItem = publicFeed.items.find(item => item.deliveryKey === board.contentKey);
  const onPath = pathFeeds.some(feed => feed.items.some(item => item.deliveryKey === board.contentKey));
  if (!publicItem || !onPath || publicItem.category !== "新闻全文" ||
    publicItem.body.length < 500 || JSON.stringify(publicItem).includes("rssFeedUrl"))
    throw new Error("TOP_FRONTEND_FULL_ARTICLE_NOT_VISIBLE");
  console.log(JSON.stringify({
    feedChecked: receipt.feedUrl, subscriber: receipt.authorization,
    newDatabaseRows: receipt.newlyStored, duplicates: receipt.deduplicated,
    deliveredInThisRun: receipt.deliveredCount, result: receipt.delivery,
    topVisible: onPath, fullArticleLength: publicItem.body.length,
    paragraphs: publicItem.body.split(/\n{2,}/).length,
    deliveryKey: board.contentKey, originalPublisherRetainedInDatabase: true,
  }));
  if (process.argv.includes("--verify-daily")) {
    const daily = await runAgentReachDailyDelivery();
    if (!daily.refreshed.some(item => item.url === feedUrl && !item.error) ||
      daily.receipts.some(item => item.moduleId === "news-top" && item.result === "front_feed_rejected"))
      throw new Error("DAILY_SOURCE_REFRESH_OR_DELIVERY_FAILED");
    const again = await getPublicModuleFeed("news-top");
    if (again.items.filter(item => item.deliveryKey === board.contentKey).length !== 1)
      throw new Error("DAILY_DELIVERY_DUPLICATED_ARTICLE");
    console.log(JSON.stringify({
      dailyRefreshSucceeded: true, refreshedSources: daily.refreshed.length,
      dailyNewDatabaseRows: daily.refreshed.find(item => item.url === feedUrl)?.stored ?? null,
      dailyAdditionalDeliveries: daily.receipts.filter(item => item.result === "delivered").length,
      stillSingleVisibleArticle: true,
    }));
  }
} finally {
  await db.$client.end();
}
