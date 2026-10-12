import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";
import { agentReachModuleGrants, agentReachPublicSources, adminDataModuleContentItems, financeWorldDataset, standaloneSchedules } from "../drizzle/schema";
import { ADMIN_DATA_MODULES, resolveAdminDataModulesForPath } from "../shared/adminDataModules";
import { getDb } from "./db";
import { getPublicModuleFeed, isNearDuplicatePublicContent, publicContentFingerprint, toPublicFeedItem } from "./adminModulePublicFeed";
import { readAgentReachPublic } from "./agentReachService";
import { discoverAdminNewsFeedUrl, validateAdminNewsRssEndpoint } from "./adminNewsIngestion";
import { agentReachNewsRejectionReason } from "./agentReachNewsPublication";

// Only functions with an existing client-side content-feed reader are eligible.
// A catalog entry alone does not prove that its screen consumes these items.
const feedPaths = new Set([
  "/macro-dashboard", "/interest-rates",
]);
export const agentReachDeliveryModules = ADMIN_DATA_MODULES.filter(module =>
  (feedPaths.has(module.path.split("?")[0]) || ["news-top", "news-cn"].includes(module.id)) &&
  resolveAdminDataModulesForPath(module.path).some(item => item.id === module.id),
).map(({ id, name, path, domain }) => ({
  id, name, path: id === "news-top" ? "/news-hub?tab=top" : id === "news-cn" ? "/news-hub?tab=cn" : path, domain,
}));

const keyFor = (recordUuid: string, moduleId: string) => `ar:${recordUuid}:${moduleId}`;
const allowedModule = (id: string) => agentReachDeliveryModules.find(module => module.id === id);
const feedUrlOf = (metadata: Record<string, unknown> | null) =>
  typeof metadata?.rssFeedUrl === "string" ? metadata.rssFeedUrl : null;
const hasVerifiedOfficialFullText = (metadata: Record<string, unknown> | null) => {
  const fields = metadata?.fields;
  return Boolean(fields && typeof fields === "object" && !Array.isArray(fields) &&
    (fields as Record<string, unknown>).verifiedOfficialFullText === true);
};
const cleanHash = (moduleId: string, text: string) =>
  createHash("sha256").update(`${moduleId}|${publicContentFingerprint(text)}`).digest("hex");
const FEDERAL_RESERVE_PRESS_FEED = "https://www.federalreserve.gov/feeds/press_all.xml";
const sourceHash = (url: string) => createHash("sha256").update(url).digest("hex");
const sourceError = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 600);

export async function listAgentReachPublicSources() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(agentReachPublicSources)
    .orderBy(desc(agentReachPublicSources.updatedAt)).limit(100);
  return rows.map(row => ({
    ...row, mode: row.urlHash === sourceHash(`web:${row.websiteUrl}`) ? "web_once" as const : "feed" as const,
  }));
}

/** Admin-visible durable TOP push archive, independent of live-source health. */
export async function listDeliveredTopNewsArchive() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const condition = and(eq(adminDataModuleContentItems.moduleId, "news-top"),
    eq(adminDataModuleContentItems.status, "delivered"),
    eq(adminDataModuleContentItems.sourceKind, "real"));
  const [totals, items] = await Promise.all([
    db.select({ total: count() }).from(adminDataModuleContentItems).where(condition),
    db.select({
      id: adminDataModuleContentItems.id, title: adminDataModuleContentItems.title,
      category: adminDataModuleContentItems.category, publishedAt: adminDataModuleContentItems.publishedAt,
      createdAt: adminDataModuleContentItems.createdAt,
    }).from(adminDataModuleContentItems).where(condition)
      .orderBy(desc(adminDataModuleContentItems.publishedAt), desc(adminDataModuleContentItems.id)).limit(30),
  ]);
  return { total: Number(totals[0]?.total ?? 0), items };
}

/** An arbitrary public page is a one-off, admin-only capture, never a subscription or publication grant. */
export async function captureAgentReachPublicWebSource(websiteUrl: string, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const requested = websiteUrl.trim();
  let failure: string | null = null;
  let sourceItems = 0;
  let newlyStored = 0;
  let deduplicated = 0;
  let rejected = 0;
  let qualityAverage: number | null = null;
  let preview = "";
  let title = "";
  let checkedAt = new Date();
  try {
    const result = await readAgentReachPublic({ mode: "web", url: requested });
    checkedAt = new Date(result.observedAt);
    title = result.title ?? "";
    preview = String(result.content ?? "").slice(0, 800);
    sourceItems = String(result.content ?? "").trim() ? 1 : 0;
    newlyStored = result.storage.stored;
    deduplicated = result.storage.deduplicated;
    rejected = result.storage.rejected;
    qualityAverage = result.storage.qualityAverage;
    if (!sourceItems || result.storage.status === "unavailable")
      failure = result.storage.error ?? "PUBLIC_WEB_READ_OR_STORAGE_FAILED";
  } catch (error) {
    failure = sourceError(error);
  }
  await db.insert(agentReachPublicSources).values({
    urlHash: sourceHash(`web:${requested}`), websiteUrl: requested, feedUrl: null,
    status: failure ? "unavailable" : "available", lastError: failure,
    lastCheckedAt: checkedAt, sourceItems, storedCount: newlyStored,
    deduplicatedCount: deduplicated, createdByUserId: actorUserId,
  }).onDuplicateKeyUpdate({ set: {
    feedUrl: null, status: failure ? "unavailable" : "available", lastError: failure,
    lastCheckedAt: checkedAt, sourceItems,
    storedCount: sql`${agentReachPublicSources.storedCount} + ${newlyStored}`,
    deduplicatedCount: sql`${agentReachPublicSources.deduplicatedCount} + ${deduplicated}`,
  } });
  return {
    websiteUrl: requested, mode: "web_once" as const,
    status: failure ? "unavailable" as const : "available" as const,
    error: failure, sourceItems, newlyStored, deduplicated, rejected, qualityAverage,
    checkedAt, title, preview,
    boundary: "仅管理员单次采集并保存原始与清洗资料；网页可读不等于 RSS/Atom 自动订阅，也不等于取得新闻再分发许可。未自动向前端推送。",
  };
}

/**
 * An admin registers a source, not a publication. Record even failed probes,
 * but never grant a frontend module or infer republication rights from access.
 */
export async function registerAgentReachPublicSource(websiteUrl: string, actorUserId: number, rightsConfirmed: boolean) {
  if (!rightsConfirmed) throw new Error("PUBLIC_SOURCE_RIGHTS_NOT_CONFIRMED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const requested = websiteUrl.trim();
  let feedUrl: string | null = null;
  let sourceItems = 0;
  let newlyStored = 0;
  let deduplicated = 0;
  let failure: string | null = null;
  const parsed = validateAdminNewsRssEndpoint(requested);
  if (!parsed.valid) failure = parsed.reason;
  else {
    const host = parsed.url.hostname.toLowerCase();
    if (host === "ft.com" || host.endsWith(".ft.com") ||
      host === "ftchinese.com" || host.endsWith(".ftchinese.com")) {
      failure = "FT_NEEDS_LICENSED_REPUBLISHING_FEED";
    } else try {
      feedUrl = host === "www.federalreserve.gov" &&
        (parsed.url.pathname === "/" || parsed.url.pathname === "/feeds/press_all.xml") &&
        !parsed.url.search && !parsed.url.hash
        ? FEDERAL_RESERVE_PRESS_FEED : await discoverAdminNewsFeedUrl(requested);
      const feedHost = new URL(feedUrl).hostname.toLowerCase();
      if (feedHost === "ft.com" || feedHost.endsWith(".ft.com") ||
        feedHost === "ftchinese.com" || feedHost.endsWith(".ftchinese.com"))
        throw new Error("FT_NEEDS_LICENSED_REPUBLISHING_FEED");
      const read = await readAgentReachPublic({ mode: "rss", url: feedUrl });
      if (read.mode !== "rss" || read.storage.status === "unavailable" || !read.items.length)
        throw new Error(read.storage.error ?? "PUBLIC_FEED_READ_OR_STORAGE_FAILED");
      sourceItems = read.items.length;
      newlyStored = read.storage.stored;
      deduplicated = read.storage.deduplicated;
    } catch (error) { failure = sourceError(error); }
  }
  await db.insert(agentReachPublicSources).values({
    urlHash: sourceHash(requested), websiteUrl: requested, feedUrl,
    status: failure ? "unavailable" : "available", lastError: failure,
    lastCheckedAt: new Date(), sourceItems, storedCount: newlyStored,
    deduplicatedCount: deduplicated, createdByUserId: actorUserId,
  }).onDuplicateKeyUpdate({ set: {
    feedUrl, status: failure ? "unavailable" : "available", lastError: failure,
    lastCheckedAt: new Date(), sourceItems,
    storedCount: sql`${agentReachPublicSources.storedCount} + ${newlyStored}`,
    deduplicatedCount: sql`${agentReachPublicSources.deduplicatedCount} + ${deduplicated}`,
  } });
  return {
    websiteUrl: requested, feedUrl, status: failure ? "unavailable" as const : "available" as const,
    error: failure, sourceItems, newlyStored, deduplicated,
  };
}

export async function authorizeAgentReachPublicSource(sourceId: number, moduleId: string, actorUserId: number) {
  if (!allowedModule(moduleId)) throw new Error("MODULE_HAS_NO_VERIFIED_FRONTEND_FEED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [source] = await db.select().from(agentReachPublicSources)
    .where(eq(agentReachPublicSources.id, sourceId)).limit(1);
  if (!source || source.status !== "available" || !source.feedUrl)
    throw new Error("SOURCE_NOT_VERIFIED_AVAILABLE");
  const records = await db.select().from(financeWorldDataset).where(and(
    eq(financeWorldDataset.dataTopType, "agent_reach"),
    eq(financeWorldDataset.dataSubType, "rss"),
    sql`JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.rssFeedUrl')) = ${source.feedUrl}`,
  )).orderBy(desc(financeWorldDataset.crawlTime)).limit(50);
  const candidate = records.find(record => {
    if (!["L1", "L2"].includes(record.dataQualityLevel)) return false;
    if (source.feedUrl === FEDERAL_RESERVE_PRESS_FEED && !hasVerifiedOfficialFullText(record.financeArrayJson))
      return false;
    if (!moduleId.startsWith("news-")) return typeof record.financeArrayJson?.summary === "string" &&
      record.financeArrayJson.summary.length >= 24;
    return !agentReachNewsRejectionReason({
      subType: record.dataSubType, title: String(record.financeArrayJson?.title ?? ""),
      body: String(record.aiProcessContent ?? ""), summary: record.financeArrayJson?.summary as string | null,
      sourceUrl: record.sourceUrl, rssFeedUrl: source.feedUrl,
      verifiedOfficialFullText: hasVerifiedOfficialFullText(record.financeArrayJson),
    });
  });
  if (!candidate) throw new Error("SOURCE_HAS_NO_DELIVERABLE_CLEANED_RECORD");
  const [existing] = await db.select({ recordUuid: agentReachModuleGrants.recordUuid })
    .from(agentReachModuleGrants).where(and(
      eq(agentReachModuleGrants.moduleId, moduleId),
      eq(agentReachModuleGrants.rssUrl, source.feedUrl),
      eq(agentReachModuleGrants.isEnabled, true),
      eq(agentReachModuleGrants.followRss, true),
    )).limit(1);
  const result = existing
    ? { delivered: await deliverAgentReachRecord(candidate.uuid, moduleId) }
    : await setAgentReachModuleGrant({
      recordUuid: candidate.uuid, moduleId, enabled: true, followRss: true, actorUserId,
    });
  // A source grant is a manual choice. Ingested entries with a different
  // fingerprint are still delivered individually and deduped by destination.
  let deliveredCount = result.delivered === "delivered" ? 1 : 0;
  for (const record of records.filter(row => row.uuid !== candidate.uuid)) {
    if (source.feedUrl === FEDERAL_RESERVE_PRESS_FEED && !hasVerifiedOfficialFullText(record.financeArrayJson))
      continue;
    if (await deliverAgentReachRecord(record.uuid, moduleId) === "delivered") deliveredCount++;
  }
  return { sourceId, moduleId, recordUuid: existing?.recordUuid ?? candidate.uuid, deliveredCount, status: result.delivered };
}

/**
 * One administrator-approved, continuously refreshed source for the existing
 * TOP news reader. A website without a discoverable public feed is NOT a
 * connector; a one-off web extraction cannot become a daily subscription.
 */
export async function connectAgentReachPublicNewsSource(websiteUrl: string, actorUserId: number, rightsConfirmed: boolean) {
  if (!rightsConfirmed) throw new Error("PUBLIC_NEWS_REDISTRIBUTION_RIGHTS_NOT_CONFIRMED");
  const hostname = new URL(websiteUrl).hostname.toLowerCase();
  if (hostname === "ft.com" || hostname.endsWith(".ft.com") ||
    hostname === "ftchinese.com" || hostname.endsWith(".ftchinese.com"))
    throw new Error("FT_NEEDS_LICENSED_REPUBLISHING_FEED; PUBLIC_WEB_ACCESS_IS_NOT_REDISTRIBUTION_PERMISSION");
  // Verified official source: both the publisher's homepage and its exact
  // published RSS endpoint map to the same read-only feed. Other websites
  // still require normal alternate-link discovery and source verification.
  const requested = new URL(websiteUrl);
  const feedUrl = requested.hostname === "www.federalreserve.gov" &&
    (requested.pathname === "/" || requested.pathname === "/feeds/press_all.xml") &&
    !requested.search && !requested.hash
    ? FEDERAL_RESERVE_PRESS_FEED : await discoverAdminNewsFeedUrl(websiteUrl);
  const feedHost = new URL(feedUrl).hostname.toLowerCase();
  if (feedHost === "ft.com" || feedHost.endsWith(".ft.com") ||
    feedHost === "ftchinese.com" || feedHost.endsWith(".ftchinese.com"))
    throw new Error("FT_NEEDS_LICENSED_REPUBLISHING_FEED");
  const read = await readAgentReachPublic({ mode: "rss", url: feedUrl });
  if (read.mode !== "rss") throw new Error("PUBLIC_FEED_IS_NOT_RSS");
  if (read.storage.status === "unavailable" || !read.items.length)
    throw new Error(read.storage.error ?? "PUBLIC_FEED_READ_OR_STORAGE_FAILED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const records = await db.select({
    uuid: financeWorldDataset.uuid, quality: financeWorldDataset.dataQualityLevel,
    metadata: financeWorldDataset.financeArrayJson,
  }).from(financeWorldDataset).where(and(
    eq(financeWorldDataset.dataTopType, "agent_reach"),
    eq(financeWorldDataset.dataSubType, "rss"),
    sql`JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.rssFeedUrl')) = ${feedUrl}`,
  )).orderBy(desc(financeWorldDataset.crawlTime), desc(financeWorldDataset.id)).limit(50);
  const candidates = records.filter(record => ["L1", "L2"].includes(record.quality) &&
    typeof record.metadata?.summary === "string" && record.metadata.summary.length >= 24 &&
    (feedUrl !== FEDERAL_RESERVE_PRESS_FEED || hasVerifiedOfficialFullText(record.metadata)));
  const candidate = candidates[0];
  if (!candidate) throw new Error(feedUrl === FEDERAL_RESERVE_PRESS_FEED
    ? "PUBLIC_FEED_HAS_NO_VERIFIED_FULL_ARTICLE" : "PUBLIC_FEED_HAS_NO_QUALITY_APPROVED_EXCERPT");
  const [existingGrant] = await db.select({ recordUuid: agentReachModuleGrants.recordUuid })
    .from(agentReachModuleGrants).where(and(
      eq(agentReachModuleGrants.moduleId, "news-top"),
      eq(agentReachModuleGrants.rssUrl, feedUrl),
      eq(agentReachModuleGrants.isEnabled, true),
      eq(agentReachModuleGrants.followRss, true),
    )).limit(1);
  const result = existingGrant
    ? { delivered: await deliverAgentReachRecord(candidate.uuid, "news-top") }
    : await setAgentReachModuleGrant({
      recordUuid: candidate.uuid, moduleId: "news-top", followRss: true,
      enabled: true, actorUserId,
    });
  if (result.delivered === "front_feed_rejected" || result.delivered === "quality_rejected") {
    if (!existingGrant) await setAgentReachModuleGrant({
      recordUuid: candidate.uuid, moduleId: "news-top", followRss: false,
      enabled: false, actorUserId,
    });
    throw new Error(`PUBLIC_FEED_FRONTEND_REJECTED:${result.delivered}`);
  }
  const results = [result.delivered];
  for (const record of candidates.filter(item => item.uuid !== candidate.uuid).slice(0, 29)) {
    results.push(await deliverAgentReachRecord(record.uuid, "news-top"));
  }
  return {
    websiteUrl, feedUrl, target: "/news-hub?tab=top",
    checkedAt: read.observedAt,
    sourceItems: read.items.length,
    newlyStored: read.storage.stored,
    deduplicated: read.storage.deduplicated,
    rejected: read.storage.rejected,
    authorization: existingGrant ? "already_subscribed" as const : "subscribed" as const,
    delivery: result.delivered,
    deliveredCount: results.filter(status => status === "delivered").length,
    alreadyVisibleCount: results.filter(status => status === "already_delivered").length,
    duplicateCount: results.filter(status => status === "duplicate").length,
    rejectedCount: results.filter(status => status === "quality_rejected" || status === "front_feed_rejected").length,
  };
}

export async function listAgentReachModuleGrants() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(agentReachModuleGrants).orderBy(desc(agentReachModuleGrants.updatedAt)).limit(300);
  const [schedule] = await db.select({
    isEnabled: standaloneSchedules.isEnabled,
    lastExecutedAt: standaloneSchedules.lastExecutedAt,
    lastStatus: standaloneSchedules.lastStatus,
    lastError: standaloneSchedules.lastError,
  }).from(standaloneSchedules)
    .where(eq(standaloneSchedules.name, "Agent Reach 每日授权数据交付")).limit(1);
  const grantId = sql<number>`CAST(JSON_UNQUOTE(JSON_EXTRACT(${adminDataModuleContentItems.targetPayload}, '$.grantId')) AS UNSIGNED)`;
  const counts = await db.select({
    grantId, deliveredCount: sql<number>`COUNT(*)`,
    lastDeliveredAt: sql<Date | null>`MAX(${adminDataModuleContentItems.publishedAt})`,
  }).from(adminDataModuleContentItems).where(and(
    eq(adminDataModuleContentItems.status, "delivered"),
    sql`JSON_UNQUOTE(JSON_EXTRACT(${adminDataModuleContentItems.targetPayload}, '$.source')) = 'agent-reach'`,
  )).groupBy(grantId);
  const byGrant = new Map(counts.map(item => [Number(item.grantId), item]));
  return {
    modules: agentReachDeliveryModules,
    catalog: ADMIN_DATA_MODULES.map(({ id, name, path, domain }) => ({
      id, name, path, domain,
      deliverable: Boolean(allowedModule(id)),
      reason: allowedModule(id) ? null : "当前功能尚无经过验证的 Agent Reach 前端资料读取入口，不能授权为已接通",
    })),
    schedule: schedule ?? null, grants: rows.map(row => {
    return {
      ...row, deliveredCount: Number(byGrant.get(row.id)?.deliveredCount ?? 0),
      lastDeliveredAt: byGrant.get(row.id)?.lastDeliveredAt ?? null,
    };
  }) };
}

/** A grant is a distinct, persisted human choice for ONE existing frontend function. */
export async function setAgentReachModuleGrant(input: {
  recordUuid: string; moduleId: string; enabled: boolean; followRss: boolean; actorUserId: number;
}) {
  const module = allowedModule(input.moduleId);
  if (!module) throw new Error("MODULE_HAS_NO_VERIFIED_FRONTEND_FEED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [record] = await db.select().from(financeWorldDataset).where(and(
    eq(financeWorldDataset.uuid, input.recordUuid), eq(financeWorldDataset.dataTopType, "agent_reach"),
  )).limit(1);
  if (!record) throw new Error("KNOWLEDGE_NOT_FOUND");
  const rssUrl = feedUrlOf(record.financeArrayJson);
  if (input.enabled && module.id.startsWith("news-")) {
    const rejection = agentReachNewsRejectionReason({
      subType: record.dataSubType, title: String(record.financeArrayJson?.title ?? ""),
      body: String(record.aiProcessContent ?? ""), summary: record.financeArrayJson?.summary as string | null,
      sourceUrl: record.sourceUrl, rssFeedUrl: rssUrl,
      verifiedOfficialFullText: hasVerifiedOfficialFullText(record.financeArrayJson),
    });
    if (rejection) throw new Error(rejection);
  }
  if (input.enabled && input.followRss && (
    !rssUrl || !/^https:\/\/[^/@]+/i.test(rssUrl) || record.sourceUrl.startsWith("https://company.internal/")
  )) throw new Error("RSS_FOLLOW_REQUIRES_PUBLIC_FEED");
  if (input.enabled && input.followRss) {
    const [source] = await db.select({ status: agentReachPublicSources.status })
      .from(agentReachPublicSources).where(and(
        eq(agentReachPublicSources.feedUrl, rssUrl!),
        eq(agentReachPublicSources.status, "unavailable"),
      )).limit(1);
    if (source) throw new Error("SOURCE_HEALTH_UNAVAILABLE_RECHECK_BEFORE_AUTHORIZATION");
  }
  await db.insert(agentReachModuleGrants).values({
    recordUuid: record.uuid, moduleId: module.id, followRss: input.enabled && input.followRss,
    rssUrl: input.enabled && input.followRss ? rssUrl : null,
    isEnabled: input.enabled, approvedByUserId: input.actorUserId,
  }).onDuplicateKeyUpdate({ set: {
    followRss: input.enabled && input.followRss, rssUrl: input.enabled && input.followRss ? rssUrl : null,
    isEnabled: input.enabled, approvedByUserId: input.actorUserId, approvedAt: new Date(),
  } });
  if (!input.enabled) await retractUnapprovedModuleDeliveries(module.id);
  // The grant is durable even if upstream delivery fails; the daily job retries
  // and the admin UI shows the persisted state, never a fabricated receipt.
  return { recordUuid: record.uuid, moduleId: module.id, enabled: input.enabled,
    followRss: input.enabled && input.followRss, delivered: input.enabled
      ? await deliverAgentReachRecord(record.uuid, module.id) : "revoked" };
}

async function grantsFor(record: typeof financeWorldDataset.$inferSelect, moduleId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const grants = await db.select().from(agentReachModuleGrants).where(and(
    eq(agentReachModuleGrants.moduleId, moduleId), eq(agentReachModuleGrants.isEnabled, true),
  ));
  return grants.some(grant => grant.recordUuid === record.uuid ||
    (grant.followRss && grant.rssUrl && grant.rssUrl === feedUrlOf(record.financeArrayJson)
      && !record.sourceUrl.startsWith("https://company.internal/")));
}

export async function deliverAgentReachRecord(recordUuid: string, moduleId: string) {
  if (!allowedModule(moduleId)) throw new Error("MODULE_HAS_NO_VERIFIED_FRONTEND_FEED");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [record] = await db.select().from(financeWorldDataset).where(and(
    eq(financeWorldDataset.uuid, recordUuid), eq(financeWorldDataset.dataTopType, "agent_reach"),
  )).limit(1);
  if (!record) throw new Error("KNOWLEDGE_NOT_FOUND");
  if (!await grantsFor(record, moduleId)) return "not_authorized" as const;
  if (!["L1", "L2"].includes(record.dataQualityLevel)) return "quality_rejected" as const;
  const title = String(record.financeArrayJson?.title ?? "").slice(0, 700);
  const officialFullText = record.dataSubType === "rss" &&
    hasVerifiedOfficialFullText(record.financeArrayJson);
  if (moduleId.startsWith("news-") && agentReachNewsRejectionReason({
    subType: record.dataSubType, title, body: String(record.aiProcessContent ?? ""),
    summary: record.financeArrayJson?.summary as string | null,
    sourceUrl: record.sourceUrl, rssFeedUrl: feedUrlOf(record.financeArrayJson),
    verifiedOfficialFullText: officialFullText,
  })) return "quality_rejected" as const;
  // Other publishers only deliver their public excerpt. A verified Board
  // press release is a narrowly permitted full-text exception.
  const body = record.dataSubType === "rss"
    ? officialFullText
      ? `美国联邦储备委员会官方公告\n\n${String(record.aiProcessContent ?? "")}`
      : String(record.financeArrayJson?.summary ?? "")
    : String(record.aiProcessContent ?? "");
  const newsCategory = officialFullText ? "新闻全文" : "新闻摘要";
  const newsTopic = officialFullText ? "金融政策" : record.sourceName;
  const sourceReference = record.sourceUrl.startsWith("https://company.internal/") ? null : record.sourceUrl.slice(0, 1200);
  const now = new Date();
  const upstreamPublished = record.financeArrayJson?.published;
  const upstreamTime = typeof upstreamPublished === "string" ? new Date(upstreamPublished) : null;
  const publishedAt = upstreamTime && !Number.isNaN(upstreamTime.getTime()) &&
    upstreamTime.getTime() <= now.getTime() + 5 * 60_000
    ? upstreamTime : record.crawlTime;
  const projected = toPublicFeedItem({
    moduleId, title, body,
    topic: record.dataSubType === "rss" ? newsTopic : "研究资料",
    category: record.dataSubType === "rss" ? newsCategory : "市场研究",
    sourceKind: "real", sourceReference, publishedAt, updatedAt: now, payload: {},
  });
  if (!projected || !title || publicContentFingerprint(projected.body).length < 24) return "quality_rejected" as const;
  const contentHash = cleanHash(moduleId, projected.body);
  const contentKey = keyFor(record.uuid, moduleId);
  const existing = await db.select().from(adminDataModuleContentItems)
    .where(eq(adminDataModuleContentItems.contentKey, contentKey)).limit(1);
  if (existing[0]?.status === "delivered") return "already_delivered" as const;
  const recent = await db.select().from(adminDataModuleContentItems)
    .where(and(eq(adminDataModuleContentItems.moduleId, moduleId), eq(adminDataModuleContentItems.status, "delivered")))
    .orderBy(desc(adminDataModuleContentItems.publishedAt)).limit(100);
  if (recent.some(item => item.contentHash === contentHash ||
    isNearDuplicatePublicContent(projected.body, toPublicFeedItem({ ...item, payload: item.targetPayload })?.body ?? ""))) {
    return "duplicate" as const;
  }
  // Fail closed if authorization changed during preparation. Both grant and
  // delivery are rechecked in the same transaction before the public write.
  const result = await db.transaction(async tx => {
    const [direct] = await tx.select().from(agentReachModuleGrants).where(and(
      eq(agentReachModuleGrants.recordUuid, record.uuid),
      eq(agentReachModuleGrants.moduleId, moduleId),
      eq(agentReachModuleGrants.isEnabled, true),
    )).limit(1);
    const [feedGrant] = !direct && feedUrlOf(record.financeArrayJson)
      ? await tx.select().from(agentReachModuleGrants).where(and(
        eq(agentReachModuleGrants.moduleId, moduleId), eq(agentReachModuleGrants.isEnabled, true),
        eq(agentReachModuleGrants.followRss, true),
        eq(agentReachModuleGrants.rssUrl, feedUrlOf(record.financeArrayJson)!),
      )).limit(1) : [];
    if (!direct && !feedGrant) return "not_authorized" as const;
    const [duplicate] = await tx.select({ contentKey: adminDataModuleContentItems.contentKey })
      .from(adminDataModuleContentItems).where(and(
        eq(adminDataModuleContentItems.dedupeScope, `agent-reach:${moduleId}`),
        eq(adminDataModuleContentItems.contentHash, contentHash),
      )).limit(1);
    if (duplicate && duplicate.contentKey !== contentKey) return "duplicate" as const;
    if (existing[0]) {
      await tx.update(adminDataModuleContentItems).set({
        status: "delivered", publishedAt,
        deliveryAttempts: sql`${adminDataModuleContentItems.deliveryAttempts} + 1`,
      }).where(eq(adminDataModuleContentItems.contentKey, contentKey));
      return "delivered" as const;
    }
    try {
      await tx.insert(adminDataModuleContentItems).values({
      contentKey, moduleId, sourceKind: "real", status: "delivered", contentType: "generic",
      title, body: projected.body,
      topic: record.dataSubType === "rss" ? newsTopic : "研究资料",
      category: record.dataSubType === "rss" ? newsCategory : "市场研究",
      sourceReference, keywords: [], tags: ["agent-reach"],
      contentHash, dedupeScope: `agent-reach:${moduleId}`, qualityScore: record.dataQualityLevel === "L1" ? 90 : 70,
      qualityReport: { qualityLevel: record.dataQualityLevel, dataBloodId: record.dataBloodId },
      reviewedByUserId: (direct ?? feedGrant)!.approvedByUserId,
      reviewedAt: (direct ?? feedGrant)!.approvedAt,
      publishedAt, deliveryAttempts: 1,
      targetPayload: {
        source: "agent-reach", recordUuid: record.uuid, grantId: (direct ?? feedGrant)!.id,
        rssFeedUrl: record.dataSubType === "rss" ? feedUrlOf(record.financeArrayJson) : null,
        verifiedOfficialFullText: officialFullText,
      },
      });
    } catch (error) {
      // A concurrent writer may have inserted this record/content while the
      // transaction was preparing. Do not update a different record's row.
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") return "duplicate" as const;
      throw error;
    }
    return "delivered" as const;
  });
  if (result !== "delivered") return result;
  const feed = await getPublicModuleFeed(moduleId);
  if (!feed.items.some(item => item.deliveryKey === contentKey)) {
    await db.update(adminDataModuleContentItems).set({
      status: "failed",
      errorDetail: "EXISTING_FRONTEND_FEED_REJECTED_ITEM",
    }).where(and(
      eq(adminDataModuleContentItems.contentKey, contentKey),
      eq(adminDataModuleContentItems.status, "delivered"),
    ));
    return "front_feed_rejected" as const;
  }
  return result;
}

async function retractUnapprovedModuleDeliveries(moduleId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  let afterId = 0;
  for (;;) {
    const rows = await db.select({
      id: adminDataModuleContentItems.id, contentKey: adminDataModuleContentItems.contentKey,
    }).from(adminDataModuleContentItems).where(and(
      eq(adminDataModuleContentItems.moduleId, moduleId),
      eq(adminDataModuleContentItems.status, "delivered"),
      sql`${adminDataModuleContentItems.contentKey} LIKE 'ar:%'`,
      gt(adminDataModuleContentItems.id, afterId),
    )).orderBy(asc(adminDataModuleContentItems.id)).limit(250);
    if (!rows.length) break;
    afterId = rows[rows.length - 1].id;
    for (const row of rows) {
      const uuid = row.contentKey.slice(3, -(moduleId.length + 1));
      if (!uuid.startsWith("ard_")) continue;
      const [record] = await db.select().from(financeWorldDataset)
        .where(eq(financeWorldDataset.uuid, uuid)).limit(1);
      if (record && !await grantsFor(record, moduleId)) await db.update(adminDataModuleContentItems)
        .set({ status: "reverted" })
        .where(eq(adminDataModuleContentItems.contentKey, row.contentKey));
    }
  }
}

/** Daily operation: re-read only explicitly followed RSS feeds; stored records survive failures. */
export async function runAgentReachDailyDelivery() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const grants = await db.select().from(agentReachModuleGrants)
    .where(eq(agentReachModuleGrants.isEnabled, true));
  const refreshed: Array<{ url: string; stored: number; error?: string }> = [];
  for (const url of [...new Set(grants.filter(grant => grant.followRss && grant.rssUrl).map(grant => grant.rssUrl!))]) {
    try {
      const result = await readAgentReachPublic({ mode: "rss", url });
      if (result.storage.status === "unavailable") throw new Error(result.storage.error ?? "DATABASE_UNAVAILABLE");
      await db.update(agentReachPublicSources).set({
        status: "available", lastError: null, lastCheckedAt: new Date(),
        sourceItems: result.items?.length ?? 0,
        storedCount: sql`${agentReachPublicSources.storedCount} + ${result.storage.stored}`,
        deduplicatedCount: sql`${agentReachPublicSources.deduplicatedCount} + ${result.storage.deduplicated}`,
      }).where(eq(agentReachPublicSources.feedUrl, url));
      refreshed.push({ url, stored: result.storage.stored });
    } catch (error) {
      await db.update(agentReachPublicSources).set({
        status: "unavailable", lastError: sourceError(error), lastCheckedAt: new Date(),
      }).where(eq(agentReachPublicSources.feedUrl, url));
      refreshed.push({ url, stored: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const receipts: Array<{ recordUuid: string; moduleId: string; result: string }> = [];
  const failedFeeds = new Set(refreshed.filter(item => item.error).map(item => item.url));
  for (const grant of grants) {
    if (!allowedModule(grant.moduleId)) continue;
    if (grant.followRss && grant.rssUrl && failedFeeds.has(grant.rssUrl)) continue;
    const records = await db.select({
      uuid: financeWorldDataset.uuid, metadata: financeWorldDataset.financeArrayJson,
    })
      .from(financeWorldDataset).where(and(
        eq(financeWorldDataset.dataTopType, "agent_reach"),
        grant.followRss && grant.rssUrl
          ? sql`JSON_UNQUOTE(JSON_EXTRACT(${financeWorldDataset.financeArrayJson}, '$.rssFeedUrl')) = ${grant.rssUrl}`
          : eq(financeWorldDataset.uuid, grant.recordUuid),
      )).orderBy(desc(financeWorldDataset.crawlTime)).limit(500);
    for (const record of records) {
      if (grant.rssUrl === FEDERAL_RESERVE_PRESS_FEED &&
        !hasVerifiedOfficialFullText(record.metadata)) continue;
      const result = await deliverAgentReachRecord(record.uuid, grant.moduleId);
      if (result !== "already_delivered") receipts.push({ recordUuid: record.uuid, moduleId: grant.moduleId, result });
    }
  }
  const failed = refreshed.filter(item => item.error);
  if (failed.length) throw new Error(`RSS_REFRESH_FAILED: ${failed.map(item => item.url).join(", ").slice(0, 500)}`);
  return { refreshed, receipts };
}
