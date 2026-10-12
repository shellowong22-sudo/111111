import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  adminDataModuleAutomationRunItems,
  adminDataModuleAutomationRuns,
  adminDataModuleAutomationSchedules,
  adminDataModuleContentItems,
  adminDataModuleDeliveryEvents,
  adminDataModuleProfiles,
  adminNewsIngestionArticles,
  adminNewsIngestionSources,
  equityListings,
  spiderMissingScanLog,
  spiderTasks,
} from "../drizzle/schema";
import { getDb } from "./db";
import { refreshAdminDataModuleSources } from "./adminDataModuleRefresh";
import { ensureAdminDataModuleProfiles } from "./adminDataModuleProfiles";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import {
  ADMIN_DATA_MODULE_IDS,
  ADMIN_DATA_MODULES,
} from "../shared/adminDataModules";
import {
  ADMIN_CRAWLER_CAPABILITY_CATALOG,
  ADMIN_CRAWLER_STRATEGIES,
  ADMIN_CRAWLER_STRATEGY_VERSION,
  validateAdminCrawlerStrategies,
} from "../shared/adminCrawlerStrategies";
import {
  approveAdminDataModuleContent,
  deliverApprovedAdminDataModuleContent,
  generateAdminDataModuleContentDraft,
} from "./adminDataModuleDelivery";
import {
  appendAdminDataModuleRunControlEvent,
  createAdminDataModuleRunItems,
  listAdminDataModuleRunItems,
  pauseAdminDataModuleAutomationRun,
  processAdminDataModuleQueue,
  resumeAdminDataModuleAutomationRun,
  retryFailedAdminDataModuleRunItems,
} from "./adminDataModuleQueue";

export type AutomationScope = "single" | "group" | "site" | "batch";
export type AutomationMode = "fast_draft" | "rich_content";

type StartInput = {
  scope: AutomationScope;
  moduleId?: string;
  moduleIds?: string[];
  moduleGroup?: string;
  mode: AutomationMode;
  actorUserId: number;
  trigger?: "manual" | "scheduled" | "retry";
};
type ProfileRow = typeof adminDataModuleProfiles.$inferSelect;

/**
 * Contracts with a persisted delivery adapter.  A profile can be enabled in
 * the catalogue without having a writable target (for example the legacy
 * module_content_feed route).  Site/group automation must not enqueue those
 * profiles implicitly: doing so creates work items that cannot be delivered
 * and makes the requested count differ from the actual writable baseline.
 * Single/batch runs still allow an operator to address any explicitly named
 * enabled profile, preserving the existing module capability.
 */
export const WRITABLE_AUTOMATION_TARGET_CONTRACTS = [
  "market_snapshot",
  "news_review_pipeline",
  "announcement_publication",
] as const;

function hasWritableAutomationContract(profile: ProfileRow) {
  return (WRITABLE_AUTOMATION_TARGET_CONTRACTS as readonly string[]).includes(
    profile.targetContract
  );
}

const MODULE_AUTOMATION_SCHEDULE_KEY = "module-automation-queue";

function runKey() {
  return `modrun_${randomUUID().replaceAll("-", "")}`;
}

function affectedRows(result: unknown): number {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== "object") return 0;
  const value = Reflect.get(candidate, "affectedRows");
  return typeof value === "number" ? value : 0;
}

async function targetProfiles(input: StartInput) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await ensureAdminDataModuleProfiles(input.actorUserId);
  const enabled = await db
    .select()
    .from(adminDataModuleProfiles)
    .where(
      and(
        eq(adminDataModuleProfiles.automationEnabled, true),
        inArray(adminDataModuleProfiles.runtimeStatus, ["enabled", "delivered"])
      )
    );
  if (input.scope === "single")
    return enabled.filter(item => item.moduleId === input.moduleId);
  if (input.scope === "batch") {
    const selected = new Set(input.moduleIds ?? []);
    return enabled.filter(item => selected.has(item.moduleId));
  }
  if (input.scope === "group")
    return enabled.filter(
      item =>
        item.moduleGroup === input.moduleGroup &&
        hasWritableAutomationContract(item)
    );
  // A site run is an implicit delivery operation.  Restrict it to contracts
  // backed by real persistence adapters; otherwise enabled catalogue-only
  // profiles (module_content_feed) would be silently counted and queued.
  return enabled.filter(hasWritableAutomationContract);
}

async function profilesForRun(
  run: typeof adminDataModuleAutomationRuns.$inferSelect
) {
  return targetProfiles({
    scope: run.scope,
    moduleId: run.moduleId ?? undefined,
    moduleIds: run.moduleIdsJson
      ? (JSON.parse(run.moduleIdsJson) as string[])
      : undefined,
    moduleGroup: run.moduleGroup ?? undefined,
    mode: run.mode,
    actorUserId: run.actorUserId,
    trigger: run.trigger,
  });
}

async function appendSourceRefreshEvents(
  runId: number,
  profiles: ProfileRow[],
  handled: Set<string>,
  actorUserId: number,
  durationMs: number
) {
  const db = await getDb();
  if (!db || !handled.size) return;
  const completedProfiles = profiles.filter(profile =>
    handled.has(profile.moduleId)
  );
  if (!completedProfiles.length) return;
  await db.insert(adminDataModuleDeliveryEvents).values(
    completedProfiles.map(profile => ({
      moduleId: profile.moduleId,
      runId,
      deliveryVersionId: null,
      action: "generated" as const,
      status: "success" as const,
      targetContract: profile.targetContract,
      targetDetail: profile.targetCollection ?? profile.frontendInterface,
      itemCount: 1,
      dataVersion: profile.currentVersion || null,
      durationMs,
      detail:
        "持久队列已处理该模块的候选内容链路；是否推送由该模块的审核和推送策略决定，前端仍按原读取逻辑和缓存策略取得后续更新。",
      actorUserId,
    }))
  );
}

export async function enqueueAdminDataModuleAutomation(input: StartInput) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const profiles = await targetProfiles(input);
  if (input.scope === "single" && !profiles.length)
    throw new Error("AUTOMATION_MODULE_NOT_ENABLED_OR_UNKNOWN");
  if ((input.scope === "group" || input.scope === "batch") && !profiles.length)
    throw new Error(
      input.scope === "batch"
        ? "AUTOMATION_BATCH_EMPTY_OR_DISABLED"
        : "AUTOMATION_GROUP_EMPTY_OR_DISABLED"
    );
  const now = new Date();
  const key = runKey();
  await db.insert(adminDataModuleAutomationRuns).values({
    runKey: key,
    scope: input.scope,
    moduleId: input.scope === "single" ? (input.moduleId ?? null) : null,
    moduleIdsJson:
      input.scope === "batch" ? JSON.stringify(input.moduleIds ?? []) : null,
    moduleGroup: input.scope === "group" ? (input.moduleGroup ?? null) : null,
    trigger: input.trigger ?? "manual",
    mode: input.mode,
    status: "queued",
    currentStep: profiles.length
      ? "queued_for_persistent_worker"
      : "no_enabled_module",
    requestedCount: profiles.length,
    queuedCount: profiles.length,
    actorUserId: input.actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  const run = (
    await db
      .select()
      .from(adminDataModuleAutomationRuns)
      .where(eq(adminDataModuleAutomationRuns.runKey, key))
      .limit(1)
  )[0];
  if (!run) throw new Error("AUTOMATION_RUN_CREATE_FAILED");
  await createAdminDataModuleRunItems({ run, profiles });
  return {
    runId: run.id,
    runKey: run.runKey,
    requestedCount: profiles.length,
    queuedCount: profiles.length,
    status: "queued" as const,
  };
}

export async function getAdminCrawlerUpgradeReadiness(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await ensureAdminDataModuleProfiles(actorUserId);
  const [profiles, sources, articles, listings] = await Promise.all([
    db
      .select()
      .from(adminDataModuleProfiles)
      .where(inArray(adminDataModuleProfiles.moduleId, ADMIN_DATA_MODULE_IDS)),
    db.select().from(adminNewsIngestionSources),
    db
      .select({ id: adminNewsIngestionArticles.id })
      .from(adminNewsIngestionArticles),
    db.select({ id: equityListings.id }).from(equityListings),
  ]);
  const strategyAudit = validateAdminCrawlerStrategies();
  return {
    ...strategyAudit,
    enabledCount: profiles.filter(
      profile => profile.automationEnabled && profile.runtimeStatus !== "paused"
    ).length,
    routedCount: profiles.filter(
      profile => profile.targetContract === "module_content_feed"
    ).length,
    sourceCount: sources.length,
    activeSourceCount: sources.filter(source => source.isActive).length,
    articleCount: articles.length,
    securityCount: listings.length,
    crawlerVersion: ADMIN_CRAWLER_STRATEGY_VERSION,
  };
}

export async function getAdminCrawlerWorkspace(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await ensureAdminDataModuleProfiles(actorUserId);
  const [profiles, contentRows, readiness] = await Promise.all([
    db
      .select()
      .from(adminDataModuleProfiles)
      .where(inArray(adminDataModuleProfiles.moduleId, ADMIN_DATA_MODULE_IDS)),
    db
      .select()
      .from(adminDataModuleContentItems)
      .orderBy(desc(adminDataModuleContentItems.updatedAt))
      .limit(5000),
    getAdminCrawlerUpgradeReadiness(actorUserId),
  ]);
  const profileById = new Map(
    profiles.map(profile => [profile.moduleId, profile])
  );
  const latestById = new Map<string, (typeof contentRows)[number]>();
  for (const row of contentRows)
    if (!latestById.has(row.moduleId)) latestById.set(row.moduleId, row);
  const now = Date.now();
  const modules = ADMIN_CRAWLER_STRATEGIES.map(strategy => {
    const profile = profileById.get(strategy.moduleId);
    const latest = latestById.get(strategy.moduleId) ?? null;
    const lastContentAt =
      latest?.publishedAt ?? latest?.updatedAt ?? profile?.lastPushedAt ?? null;
    const freshnessMinutes = Math.min(
      1440,
      Math.max(30, profile?.updateFrequencyMinutes ?? 60)
    );
    const ageMinutes = lastContentAt
      ? Math.max(0, Math.floor((now - lastContentAt.getTime()) / 60_000))
      : null;
    const gapStatus =
      profile?.runtimeStatus === "paused"
        ? "paused"
        : !latest
          ? "missing"
          : latest.status === "failed" || profile?.runtimeStatus === "failed"
            ? "failed"
            : latest.status !== "delivered"
              ? "not_delivered"
              : ageMinutes !== null && ageMinutes > freshnessMinutes
                ? "stale"
                : "current";
    const payload =
      latest?.targetPayload && typeof latest.targetPayload === "object"
        ? (latest.targetPayload as Record<string, unknown>)
        : {};
    return {
      moduleId: strategy.moduleId,
      moduleName: strategy.moduleName,
      targetPath: strategy.targetPath,
      targetLabel: strategy.targetLabel,
      moduleGroup: profile?.moduleGroup ?? "未分组",
      sourceType: strategy.sourceType,
      contentLabel: strategy.contentLabel,
      contentDescription: strategy.contentDescription,
      assetCoverage: strategy.assetCoverage,
      processingSteps: strategy.processingSteps,
      focus: strategy.focus,
      queryTerms: strategy.queryTerms,
      automationEnabled: profile?.automationEnabled ?? false,
      updateFrequencyMinutes: profile?.updateFrequencyMinutes ?? 60,
      targetContract: profile?.targetContract ?? "module_content_feed",
      sourceKind: profile?.sourceKind ?? "none",
      gapStatus,
      needsUpdate:
        gapStatus === "missing" ||
        gapStatus === "stale" ||
        gapStatus === "failed" ||
        gapStatus === "not_delivered",
      ageMinutes,
      lastContent: latest
        ? {
            contentKey: latest.contentKey,
            title: latest.title,
            body: latest.body,
            status: latest.status,
            sourceKind: latest.sourceKind,
            sourceReference: latest.sourceReference,
            contentType: latest.contentType,
            qualityScore: latest.qualityScore,
            rewriteStyle:
              typeof payload.rewriteStyle === "string"
                ? payload.rewriteStyle
                : "source_faithful",
            rewriteEngine:
              typeof payload.rewriteEngine === "string"
                ? payload.rewriteEngine
                : "未记录",
            updatedAt: latest.updatedAt,
            publishedAt: latest.publishedAt,
          }
        : null,
    };
  });
  const recentContent = contentRows.slice(0, 120).map(row => {
    const strategy = ADMIN_CRAWLER_STRATEGIES.find(
      item => item.moduleId === row.moduleId
    );
    const module = ADMIN_DATA_MODULES.find(item => item.id === row.moduleId);
    const payload =
      row.targetPayload && typeof row.targetPayload === "object"
        ? (row.targetPayload as Record<string, unknown>)
        : {};
    return {
      contentKey: row.contentKey,
      moduleId: row.moduleId,
      moduleName: module?.name ?? row.moduleId,
      targetPath: strategy?.targetPath ?? module?.path ?? "/",
      contentLabel: strategy?.contentLabel ?? row.category ?? "金融内容",
      title: row.title,
      body: row.body,
      sourceKind: row.sourceKind,
      sourceReference: row.sourceReference,
      status: row.status,
      qualityScore: row.qualityScore,
      rewriteStyle:
        typeof payload.rewriteStyle === "string"
          ? payload.rewriteStyle
          : "source_faithful",
      rewriteEngine:
        typeof payload.rewriteEngine === "string"
          ? payload.rewriteEngine
          : "未记录",
      updatedAt: row.updatedAt,
    };
  });
  const gapCounts = modules.reduce(
    (counts, module) => {
      counts[module.gapStatus] = (counts[module.gapStatus] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );
  return {
    readiness,
    capabilities: ADMIN_CRAWLER_CAPABILITY_CATALOG,
    modules,
    recentContent,
    scan: {
      scannedAt: new Date(),
      total: modules.length,
      needUpdate: modules.filter(module => module.needsUpdate).length,
      current: modules.filter(module => module.gapStatus === "current").length,
      counts: gapCounts,
    },
  };
}

export async function enqueueAdminCrawlerGapUpdate(actorUserId: number) {
  const workspace = await getAdminCrawlerWorkspace(actorUserId);
  const moduleIds = workspace.modules
    .filter(module => module.needsUpdate && module.gapStatus !== "paused")
    .map(module => module.moduleId);
  if (!moduleIds.length) return null;
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const pendingGapTasks = await db
    .select({ checkpointJson: spiderTasks.checkpointJson })
    .from(spiderTasks)
    .where(
      and(
        eq(spiderTasks.taskType, "frontend_gap_collection"),
        inArray(spiderTasks.status, ["queued", "running"])
      )
    );
  const pendingModuleIds = new Set(
    pendingGapTasks
      .map(task => {
        const checkpoint =
          task.checkpointJson && typeof task.checkpointJson === "object"
            ? (task.checkpointJson as Record<string, unknown>)
            : {};
        return typeof checkpoint.moduleId === "string"
          ? checkpoint.moduleId
          : "";
      })
      .filter(Boolean)
  );
  const taskModuleIds = moduleIds.filter(
    moduleId => !pendingModuleIds.has(moduleId)
  );
  const previousScan = (
    await db
      .select()
      .from(spiderMissingScanLog)
      .where(eq(spiderMissingScanLog.scanType, "frontend_gap"))
      .orderBy(desc(spiderMissingScanLog.startedAt))
      .limit(1)
  )[0];
  const previousKeys = [...(previousScan?.missingKeys ?? [])].sort();
  const currentKeys = [...moduleIds].sort();
  if (
    previousScan &&
    Date.now() - new Date(previousScan.startedAt).getTime() < 300_000 &&
    JSON.stringify(previousKeys) === JSON.stringify(currentKeys)
  ) {
    return {
      scanUuid: previousScan.scanUuid,
      generatedTaskUuids: previousScan.generatedTaskUuids ?? [],
      moduleIds,
      skippedExistingTaskCount: moduleIds.length,
      duplicateBlocked: true as const,
      automaticPush: false as const,
    };
  }
  const scanUuid = `scan_${randomUUID().replaceAll("-", "")}`;
  const taskUuids = taskModuleIds.map(
    () => `task_${randomUUID().replaceAll("-", "")}`
  );
  const now = new Date();
  await db.transaction(async tx => {
    await tx.insert(spiderMissingScanLog).values({
      scanUuid,
      scanType: "frontend_gap",
      sourceScope: "finance_world_dataset,finance_tool_union_set",
      targetScope: "全部已登记前端业务模块",
      missingType: "missing_stale_failed_or_unpushed",
      missingKeys: moduleIds,
      missingCount: moduleIds.length,
      thresholdJson: {
        automaticCollectionOnly: true,
        automaticPushForbidden: true,
      },
      generatedTaskUuids: taskUuids,
      scanStatus: "completed",
      detail:
        "自动巡检仅创建后台采集任务；未批准内容、未写前端业务表、未创建 spider_push_relation。",
      startedAt: now,
      completedAt: now,
    });
    if (taskModuleIds.length)
      await tx.insert(spiderTasks).values(
        taskModuleIds.map((moduleId, index) => ({
          taskUuid: taskUuids[index],
          taskName: `前端缺口采集：${moduleId}`,
          taskType: "frontend_gap_collection",
          carrierType: "multi_source",
          priorityLevel: "high",
          region: "global",
          proxyStrategy: {
            mode: "direct_or_configured_pool",
            compliance: "robots_and_source_terms_required",
          },
          fingerprintProfile: {
            mode: "standard_browser_compatibility",
            evasionDisabled: true,
          },
          rateLimitPolicy: {
            tokenBucket: true,
            leakyBucket: true,
            perDomain: true,
          },
          aiEnabled: true,
          retryPolicy: {
            network: 3,
            blocked: "pause_and_review",
            notFound: "archive_marker",
          },
          backfillEnabled: true,
          checkpointJson: {
            moduleId,
            scanUuid,
            phase: "queued_for_collection",
            pushAllowed: false,
          },
          scheduleLevel: "gap_scan",
          status: "queued",
          createdByUserId: actorUserId,
          createdAt: now,
          updatedAt: now,
        }))
      );
  });
  return {
    scanUuid,
    generatedTaskUuids: taskUuids,
    moduleIds,
    skippedExistingTaskCount: moduleIds.length - taskModuleIds.length,
    duplicateBlocked: false as const,
    automaticPush: false as const,
  };
}

export async function processAdminDataModuleAutomationRun(
  runKeyValue: string,
  actorUserId?: number,
  maxItems = 160
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const run = (
    await db
      .select()
      .from(adminDataModuleAutomationRuns)
      .where(eq(adminDataModuleAutomationRuns.runKey, runKeyValue))
      .limit(1)
  )[0];
  if (!run) throw new Error("AUTOMATION_RUN_NOT_FOUND");
  const profiles = await profilesForRun(run);
  const profileByModuleId = new Map(
    profiles.map(profile => [profile.moduleId, profile])
  );
  const handled = new Set<string>();
  const started = Date.now();
  const actor = actorUserId ?? run.actorUserId;
  const result = await processAdminDataModuleQueue({
    runKey: runKeyValue,
    actorUserId: actor,
    maxItems,
    handler: async item => {
      const profile = profileByModuleId.get(item.moduleId);
      if (!profile) {
        return {
          status: "skipped" as const,
          step: "profile_no_longer_enabled",
          detail:
            "任务项对应模块已被停用或不属于当前范围；没有访问数据源或前端数据目标。",
          resultSummary: { reason: "profile_no_longer_enabled" },
        };
      }
      if (
        profile.targetContract !== "market_snapshot" &&
        profile.targetContract !== "news_review_pipeline" &&
        profile.targetContract !== "announcement_publication" &&
        profile.targetContract !== "module_content_feed"
      ) {
        return {
          status: "skipped" as const,
          step: "no_writable_frontend_contract",
          detail: `模块属于 ${profile.targetContract}，未识别到可安全写入的既有前端读取位置；只保留后台审计。`,
          resultSummary: {
            targetContract: profile.targetContract,
            action: "not_pushed",
          },
        };
      }
      if (
        profile.sourceKind !== "simulated" &&
        profile.targetContract !== "module_content_feed"
      )
        await refreshAdminDataModuleSources([profile.moduleId], actor);
      const draft = await generateAdminDataModuleContentDraft({
        moduleId: profile.moduleId,
        runKey: runKeyValue,
        runId: run.id,
        jobItemId: item.id,
        actorUserId: actor,
        mode: run.mode,
      });
      if (draft.duplicate) {
        return {
          status: "skipped" as const,
          step: "content_deduplicated",
          detail:
            "候选内容与既有已生成或已推送内容的全局去重键匹配；已跳过，不覆盖旧版本。",
          resultSummary: {
            targetContract: profile.targetContract,
            duplicate: true,
            contentKey: draft.contentKey,
          },
        };
      }
      const qualityDetail = `质量评分 ${draft.qualityScore}/100，审核门槛 ${draft.qualityThreshold}。${draft.qualityPassed ? "已通过质量检查。" : `未通过质量检查；拒绝原因：${draft.qualityRejectionReasons.join("；") || "未满足质量规则"}。`}`;
      await appendAdminDataModuleRunControlEvent({
        runId: run.id,
        jobItemId: item.id,
        moduleId: item.moduleId,
        step: draft.qualityPassed
          ? "quality_check_passed"
          : "quality_check_rejected",
        action: "quality_check",
        status: draft.qualityPassed ? "success" : "failed",
        detail: qualityDetail,
        actorUserId: actor,
      });
      if (!draft.qualityPassed) {
        return {
          status: "skipped" as const,
          step: "quality_check_rejected",
          detail: `${qualityDetail}不进入审核或前端推送。`,
          resultSummary: {
            targetContract: profile.targetContract,
            contentKey: draft.contentKey,
            qualityScore: draft.qualityScore,
            qualityThreshold: draft.qualityThreshold,
            qualityPassed: false,
            qualityRejectionReasons: draft.qualityRejectionReasons,
            deliveryStatus: "quality_rejected",
          },
        };
      }
      let deliveryStatus: "pending_review" | "approved" | "delivered" =
        "pending_review";
      let versionId: number | null = null;
      if (profile.reviewPolicy === "auto_approved") {
        const approval = await approveAdminDataModuleContent(
          draft.contentKey,
          actor
        );
        versionId = approval.versionId;
        deliveryStatus = "approved";
        if (profile.pushPolicy === "after_approval") {
          await deliverApprovedAdminDataModuleContent(draft.contentKey, actor);
          deliveryStatus = "delivered";
        }
      }
      handled.add(profile.moduleId);
      return {
        status: "completed" as const,
        step:
          deliveryStatus === "delivered"
            ? "approved_content_delivered"
            : deliveryStatus === "approved"
              ? "content_auto_approved"
              : "content_pending_manual_review",
        detail: `已创建${draft.sourceKind === "simulated" ? "明确标识的模拟" : "可追溯来源"}候选内容，质量评分 ${draft.qualityScore}，并应用模块审核/推送策略；前端接口、字段、路由和缓存保持不变。`,
        resultSummary: {
          targetContract: profile.targetContract,
          targetCollection: profile.targetCollection,
          sourceKind: draft.sourceKind,
          contentKey: draft.contentKey,
          qualityScore: draft.qualityScore,
          qualityPassed: true,
          deliveryStatus,
          versionId,
        },
      };
    },
  });
  await appendSourceRefreshEvents(
    run.id,
    profiles,
    handled,
    actor,
    Date.now() - started
  );
  if (handled.size) {
    await db
      .update(adminDataModuleProfiles)
      .set({ lastExecutedAt: new Date(), updatedAt: new Date() })
      .where(inArray(adminDataModuleProfiles.moduleId, [...handled]));
  }
  if (
    "queued" in result &&
    result.processed > 0 &&
    result.queued > 0 &&
    maxItems > result.processed
  ) {
    return processAdminDataModuleAutomationRun(
      runKeyValue,
      actor,
      maxItems - result.processed
    );
  }
  return { ...result, durationMs: Date.now() - started };
}

export async function listAdminDataModuleAutomationRuns(limit = 60) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adminDataModuleAutomationRuns)
    .orderBy(desc(adminDataModuleAutomationRuns.createdAt))
    .limit(Math.min(120, Math.max(1, limit)));
}

export async function listAdminDataModuleDeliveryEvents(limit = 80) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adminDataModuleDeliveryEvents)
    .orderBy(desc(adminDataModuleDeliveryEvents.createdAt))
    .limit(Math.min(160, Math.max(1, limit)));
}

export async function listAdminDataModuleAutomationRunItems(
  runKey: string,
  page?: number,
  pageSize?: number,
  status?: Parameters<typeof listAdminDataModuleRunItems>[0]["status"]
) {
  return listAdminDataModuleRunItems({ runKey, page, pageSize, status });
}

export async function cancelAdminDataModuleAutomationRun(
  runKeyValue: string,
  actorUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const run = (
    await db
      .select()
      .from(adminDataModuleAutomationRuns)
      .where(eq(adminDataModuleAutomationRuns.runKey, runKeyValue))
      .limit(1)
  )[0];
  if (!run) throw new Error("AUTOMATION_RUN_NOT_FOUND");
  if (
    run.status === "completed" ||
    run.status === "partial" ||
    run.status === "failed" ||
    run.status === "cancelled"
  )
    throw new Error("AUTOMATION_RUN_CANNOT_CANCEL");
  const now = new Date();
  await db
    .update(adminDataModuleAutomationRuns)
    .set({
      status: "cancelled",
      currentStep: "cancelled_by_admin",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(adminDataModuleAutomationRuns.id, run.id));
  const cancelled = await db
    .update(adminDataModuleAutomationRunItems)
    .set({
      status: "cancelled",
      currentStep: "cancelled_by_admin",
      completedAt: now,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(adminDataModuleAutomationRunItems.runId, run.id),
        inArray(adminDataModuleAutomationRunItems.status, [
          "queued",
          "claimed",
          "running",
          "pending_review",
          "pending_delivery",
        ])
      )
    );
  await appendAdminDataModuleRunControlEvent({
    runId: run.id,
    step: "cancel",
    action: "cancel",
    status: "success",
    detail: `管理员已取消任务；${affectedRows(cancelled)} 个未完成任务项已标记为取消。`,
    actorUserId,
  });
  return {
    runKey: run.runKey,
    actorUserId,
    status: "cancelled" as const,
    cancelledItems: affectedRows(cancelled),
  };
}

export async function pauseAdminDataModuleAutomation(
  runKey: string,
  actorUserId: number
) {
  return pauseAdminDataModuleAutomationRun(runKey, actorUserId);
}

export async function resumeAdminDataModuleAutomation(
  runKey: string,
  actorUserId: number
) {
  return resumeAdminDataModuleAutomationRun(runKey, actorUserId);
}

export async function retryFailedAdminDataModuleAutomationItems(
  runKey: string,
  actorUserId: number
) {
  return retryFailedAdminDataModuleRunItems(runKey, actorUserId);
}

export async function nextQueuedAdminDataModuleAutomationRun() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(adminDataModuleAutomationRuns)
    .where(
      or(
        eq(adminDataModuleAutomationRuns.status, "queued"),
        eq(adminDataModuleAutomationRuns.status, "running")
      )
    )
    .orderBy(asc(adminDataModuleAutomationRuns.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAdminDataModuleAutomationSchedule() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(adminDataModuleAutomationSchedules)
    .where(
      eq(
        adminDataModuleAutomationSchedules.scheduleKey,
        MODULE_AUTOMATION_SCHEDULE_KEY
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function enableAdminDataModuleAutomationSchedule(
  actorUserId: number,
  cron: string,
  userSession: string
) {
  if (process.env.NODE_ENV !== "production")
    throw new Error("AUTOMATION_SCHEDULE_PRODUCTION_ONLY");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await getAdminDataModuleAutomationSchedule();
  let taskUid = existing?.scheduleCronTaskUid ?? null;
  if (taskUid && !taskUid.startsWith("standalone:")) taskUid = null;
  if (taskUid) {
    await updateHeartbeatJob(
      taskUid,
      {
        cron,
        path: "/api/scheduled/adminDataModuleAutomation",
        description:
          "Scan module content gaps and process only missing, stale, failed, or undelivered crawler targets",
        enable: true,
      },
      userSession
    );
  } else {
    const created = await createHeartbeatJob(
      {
        name: "finance-hub-admin-module-automation-queue",
        cron,
        path: "/api/scheduled/adminDataModuleAutomation",
        payload: {},
        description:
          "Scan module content gaps and process only missing, stale, failed, or undelivered crawler targets",
      },
      userSession
    );
    taskUid = created.taskUid;
  }
  const now = new Date();
  await db
    .insert(adminDataModuleAutomationSchedules)
    .values({
      scheduleKey: MODULE_AUTOMATION_SCHEDULE_KEY,
      cronExpression: cron,
      scheduleCronTaskUid: taskUid,
      isEnabled: true,
      ownerUserId: actorUserId,
      lastScheduledAt: now,
      lastError: null,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        cronExpression: cron,
        scheduleCronTaskUid: taskUid,
        isEnabled: true,
        ownerUserId: actorUserId,
        lastScheduledAt: now,
        lastError: null,
        updatedAt: now,
      },
    });
  return {
    scheduleKey: MODULE_AUTOMATION_SCHEDULE_KEY,
    taskUid,
    cron,
    isEnabled: true,
  };
}

export async function setAdminDataModuleAutomationScheduleEnabled(
  actorUserId: number,
  enabled: boolean,
  userSession: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const schedule = await getAdminDataModuleAutomationSchedule();
  if (!schedule?.scheduleCronTaskUid)
    throw new Error("AUTOMATION_SCHEDULE_NOT_CONFIGURED");
  if (!schedule.scheduleCronTaskUid.startsWith("standalone:")) {
    if (enabled)
      return enableAdminDataModuleAutomationSchedule(
        actorUserId,
        schedule.cronExpression,
        userSession
      );
    await db
      .update(adminDataModuleAutomationSchedules)
      .set({
        isEnabled: false,
        ownerUserId: actorUserId,
        updatedAt: new Date(),
      })
      .where(
        eq(
          adminDataModuleAutomationSchedules.scheduleKey,
          MODULE_AUTOMATION_SCHEDULE_KEY
        )
      );
    return {
      scheduleKey: schedule.scheduleKey,
      taskUid: schedule.scheduleCronTaskUid,
      isEnabled: false,
    };
  }
  await updateHeartbeatJob(
    schedule.scheduleCronTaskUid,
    { enable: enabled },
    userSession
  );
  await db
    .update(adminDataModuleAutomationSchedules)
    .set({
      isEnabled: enabled,
      ownerUserId: actorUserId,
      updatedAt: new Date(),
    })
    .where(
      eq(
        adminDataModuleAutomationSchedules.scheduleKey,
        MODULE_AUTOMATION_SCHEDULE_KEY
      )
    );
  return {
    scheduleKey: schedule.scheduleKey,
    taskUid: schedule.scheduleCronTaskUid,
    isEnabled: enabled,
  };
}

export async function processAdminDataModuleAutomationSchedule(
  taskUid: string
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const schedule = (
    await db
      .select()
      .from(adminDataModuleAutomationSchedules)
      .where(
        and(
          eq(
            adminDataModuleAutomationSchedules.scheduleKey,
            MODULE_AUTOMATION_SCHEDULE_KEY
          ),
          eq(adminDataModuleAutomationSchedules.scheduleCronTaskUid, taskUid),
          eq(adminDataModuleAutomationSchedules.isEnabled, true)
        )
      )
      .limit(1)
  )[0];
  if (!schedule) return { skipped: "orphan_or_disabled" as const };
  let queued = await nextQueuedAdminDataModuleAutomationRun();
  if (!queued) {
    const last = schedule.lastScheduledAt?.getTime() ?? 0;
    if (Date.now() - last < 30 * 60_000) {
      await db
        .update(adminDataModuleAutomationSchedules)
        .set({ lastRunAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(
          eq(
            adminDataModuleAutomationSchedules.scheduleKey,
            MODULE_AUTOMATION_SCHEDULE_KEY
          )
        );
      return { skipped: "crawler_refresh_not_due" as const };
    }
    const created = await enqueueAdminCrawlerGapUpdate(schedule.ownerUserId);
    if (!created) {
      const now = new Date();
      await db
        .update(adminDataModuleAutomationSchedules)
        .set({
          lastScheduledAt: now,
          lastRunAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(
          eq(
            adminDataModuleAutomationSchedules.scheduleKey,
            MODULE_AUTOMATION_SCHEDULE_KEY
          )
        );
      return { skipped: "crawler_no_gap_detected" as const };
    }
    const deliveryRun = await enqueueAdminDataModuleAutomation({
      scope: created.moduleIds.length === 1 ? "single" : "batch",
      moduleId:
        created.moduleIds.length === 1 ? created.moduleIds[0] : undefined,
      moduleIds: created.moduleIds.length > 1 ? created.moduleIds : undefined,
      mode: "rich_content",
      actorUserId: schedule.ownerUserId,
      trigger: "scheduled",
    });
    const processed = await processAdminDataModuleAutomationRun(
      deliveryRun.runKey,
      schedule.ownerUserId,
      160
    );
    const now = new Date();
    await db
      .update(adminDataModuleAutomationSchedules)
      .set({
        lastScheduledAt: now,
        lastRunAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(
        eq(
          adminDataModuleAutomationSchedules.scheduleKey,
          MODULE_AUTOMATION_SCHEDULE_KEY
        )
      );
    return {
      collected: created,
      deliveryRun,
      processed,
      automaticDelivery: true as const,
      dedupePolicy: "content_fingerprint_and_module_version" as const,
    };
  }
  try {
    const result = await processAdminDataModuleAutomationRun(
      queued.runKey,
      schedule.ownerUserId,
      160
    );
    await db
      .update(adminDataModuleAutomationSchedules)
      .set({ lastRunAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(
        eq(
          adminDataModuleAutomationSchedules.scheduleKey,
          MODULE_AUTOMATION_SCHEDULE_KEY
        )
      );
    return { processed: result };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1800)
        : "AUTOMATION_SCHEDULE_EXECUTION_FAILED";
    await db
      .update(adminDataModuleAutomationSchedules)
      .set({ lastRunAt: new Date(), lastError: message, updatedAt: new Date() })
      .where(
        eq(
          adminDataModuleAutomationSchedules.scheduleKey,
          MODULE_AUTOMATION_SCHEDULE_KEY
        )
      );
    throw error;
  }
}
