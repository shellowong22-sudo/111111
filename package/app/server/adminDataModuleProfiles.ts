import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { adminDataModuleEvents, adminDataModuleProfiles, adminDataModuleRuntimeControls, adminDataModuleSettings } from '../drizzle/schema';
import { ADMIN_DATA_MODULE_IDS, ADMIN_DATA_MODULES, type AdminDataModule } from '../shared/adminDataModules';
import { ADMIN_CRAWLER_STRATEGY_BY_MODULE } from '../shared/adminCrawlerStrategies';
import { getDb } from './db';

export type ModuleProfilePatch = {
  moduleIds: string[];
  sourceKind: 'real' | 'simulated' | 'mixed' | 'none';
  sourceReference?: string;
  theme?: string;
  keywords: string[];
  tags: string[];
  contentLimit: number;
  updateFrequencyMinutes: number;
  sortWeight: number;
  automationEnabled: boolean;
  taskTemplate: string;
  executionPriority: number;
  reviewPolicy: 'manual' | 'auto_approved' | 'disabled';
  pushPolicy: 'manual' | 'after_approval' | 'disabled';
  publishSchedule?: string;
  recommendationRule?: Record<string, unknown>;
  dedupeScope?: 'module' | 'global' | 'pushed';
  retryLimit: number;
  runtimeStatus: 'enabled' | 'paused' | 'pending_generation' | 'pending_review' | 'pending_delivery' | 'delivering' | 'delivered' | 'failed';
};

const MARKET_FIELD_MAPPING = [
  { field: 'symbol', type: 'string', source: 'symbol', required: true },
  { field: 'name', type: 'string', source: 'name', required: true },
  { field: 'market', type: 'enum', source: 'market', required: true },
  { field: 'price', type: 'string', source: 'price', required: true },
  { field: 'changeVal', type: 'string', source: 'change_val', required: true },
  { field: 'changePct', type: 'string', source: 'change_pct', required: true },
  { field: 'volume', type: 'string', source: 'volume', required: true },
  { field: 'updatedAt', type: 'timestamp', source: 'updated_at', required: false },
] as const;

const NEWS_FIELD_MAPPING = [
  { field: 'id', type: 'number', source: 'id', required: true },
  { field: 'title', type: 'string', source: 'title', required: true },
  { field: 'summary', type: 'string', source: 'summary', required: false },
  { field: 'sourceUrl', type: 'url', source: 'source_url', required: true },
  { field: 'sourceName', type: 'string', source: 'source_name', required: true },
  { field: 'publishedAt', type: 'timestamp', source: 'published_at', required: false },
  { field: 'status', type: 'enum', source: 'status', required: true },
] as const;

const ANNOUNCEMENT_FIELD_MAPPING = [
  { field: 'id', type: 'number', source: 'id', required: true },
  { field: 'title', type: 'string', source: 'title', required: true },
  { field: 'content', type: 'html_safe_text', source: 'content', required: true },
  { field: 'type', type: 'enum', source: 'type', required: true },
  { field: 'priority', type: 'number', source: 'priority', required: true },
  { field: 'publishedAt', type: 'timestamp', source: 'published_at', required: true },
  { field: 'expiresAt', type: 'timestamp|null', source: 'expires_at', required: false },
] as const;

const MODULE_FEED_FIELD_MAPPING = [
  { field: 'moduleId', type: 'string', source: 'module_id', required: true },
  { field: 'title', type: 'string', source: 'title', required: true },
  { field: 'body', type: 'string', source: 'body', required: true },
  { field: 'sourceType', type: 'enum', source: 'target_payload.sourceType', required: true },
  { field: 'sourceLabel', type: 'string', source: 'target_payload.sourceLabel', required: true },
  { field: 'strategyKey', type: 'string', source: 'target_payload.strategyKey', required: true },
  { field: 'targetPath', type: 'string', source: 'target_payload.targetPath', required: true },
  { field: 'publishedAt', type: 'timestamp', source: 'published_at', required: true },
] as const;

function moduleGroup(module: AdminDataModule) {
  if (module.delivery.group === 'news_review_pipeline') return '新闻内容';
  if (module.delivery.group === 'market_snapshot') return '市场快照';
  if (module.delivery.group === 'announcement_publication') return '公告内容';
  if (module.delivery.group === 'simulation_control') return '模拟与模型';
  if (module.delivery.group === 'request_time_read') return '按请求研究';
  return '系统与工作流';
}

function defaultSourceKind(module: AdminDataModule): ModuleProfilePatch['sourceKind'] {
  return 'mixed';
}

function defaultProfile(module: AdminDataModule, actorUserId: number): typeof adminDataModuleProfiles.$inferInsert {
  const isMarket = module.delivery.group === 'market_snapshot';
  const isNews = module.delivery.group === 'news_review_pipeline';
  const isAnnouncement = module.delivery.group === 'announcement_publication';
  const strategy = ADMIN_CRAWLER_STRATEGY_BY_MODULE.get(module.id)!;
  const sourceKind = defaultSourceKind(module);
  const targetContract = isMarket
    ? 'market_snapshot'
    : isNews
      ? 'news_review_pipeline'
      : isAnnouncement
        ? 'announcement_publication'
        : 'module_content_feed';
  const targetCollection = isMarket
    ? 'market_data'
    : isNews
      ? 'admin_news_ingestion_articles'
      : isAnnouncement
        ? 'announcements'
        : 'admin_data_module_content_items';
  const fieldMapping = isMarket
    ? MARKET_FIELD_MAPPING
    : isNews
      ? NEWS_FIELD_MAPPING
      : isAnnouncement
        ? ANNOUNCEMENT_FIELD_MAPPING
        : MODULE_FEED_FIELD_MAPPING;
  return {
    moduleId: module.id,
    moduleGroup: moduleGroup(module),
    moduleCategory: module.domain,
    ownerUserId: null,
    displayArea: `${module.path} · ${module.name}`,
    frontendInterface: `${module.path} · 专属模块内容流`,
    targetContract,
    targetCollection,
    fieldMapping,
    sourceKind,
    sourceReference: `许可公开来源 + 站内证券主数据 + 明确标识的本地分析；${strategy.sourceType}`,
    theme: strategy.focus,
    keywords: strategy.queryTerms,
    tags: [module.id, module.delivery.group, strategy.sourceType, strategy.transformationVersion],
    contentLimit: 10,
    updateFrequencyMinutes: isMarket || isNews ? 30 : 60,
    sortWeight: 100,
    automationEnabled: true,
    taskTemplate: strategy.promptKey,
    executionPriority: 1000 - Number(strategy.strategyKey.split(':')[1]),
    reviewPolicy: 'auto_approved' as const,
    pushPolicy: 'after_approval' as const,
    publishSchedule: 'global_queue_on_demand',
    recommendationRule: { strategy: 'differentiated_module_feed', sourceType: strategy.sourceType, viewType: strategy.viewType, targetPath: strategy.targetPath, transformationVersion: strategy.transformationVersion },
    dedupeScope: 'module' as const,
    retryLimit: 3,
    runtimeStatus: 'enabled' as const,
    updatedByUserId: actorUserId,
  };
}

let profileInitialization: Promise<number> | null = null;

function isDeadlock(error: unknown) {
  const candidate = error as { code?: string; errno?: number; message?: string };
  return candidate?.code === 'ER_LOCK_DEADLOCK'
    || candidate?.errno === 1213
    || candidate?.message?.includes('Deadlock found') === true;
}

async function ensureAdminDataModuleProfilesAttempt(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  // The catalog is authoritative. Older builds materialized a handful of
  // retired/duplicate module IDs (for example stock-research and
  // preferred-stock-research) into the three registry tables. They are not
  // front-end pages or content and must not remain as a second admin entry.
  // Preserve an audit trail, then remove only those stale registry rows; all
  // module content, delivery history and original front-end routes remain
  // untouched.
  const catalogIds = [...ADMIN_DATA_MODULE_IDS];
  const staleProfiles = await db.select({ moduleId: adminDataModuleProfiles.moduleId }).from(adminDataModuleProfiles).where(notInArray(adminDataModuleProfiles.moduleId, catalogIds));
  const staleSettings = await db.select({ moduleId: adminDataModuleSettings.moduleId }).from(adminDataModuleSettings).where(notInArray(adminDataModuleSettings.moduleId, catalogIds));
  const staleControls = await db.select({ moduleId: adminDataModuleRuntimeControls.moduleId }).from(adminDataModuleRuntimeControls).where(notInArray(adminDataModuleRuntimeControls.moduleId, catalogIds));
  const staleIds = [...new Set([...staleProfiles, ...staleSettings, ...staleControls].map((row) => row.moduleId))];
  if (staleIds.length) {
    await db.insert(adminDataModuleEvents).values(staleIds.map((moduleId) => ({
      moduleId,
      action: 'archived' as const,
      actorUserId,
      detail: '旧版本重复后台注册项已归档清理；未删除前端页面、原有功能、内容或推送历史。',
    })));
    await db.delete(adminDataModuleProfiles).where(inArray(adminDataModuleProfiles.moduleId, staleIds));
    await db.delete(adminDataModuleSettings).where(inArray(adminDataModuleSettings.moduleId, staleIds));
    await db.delete(adminDataModuleRuntimeControls).where(inArray(adminDataModuleRuntimeControls.moduleId, staleIds));
  }
  const rows = ADMIN_DATA_MODULES.map((module) => defaultProfile(module, actorUserId));
  await db.insert(adminDataModuleProfiles).values(rows).onDuplicateKeyUpdate({
    set: { moduleId: sql`module_id` },
  });
  for (const row of rows) {
    await db.update(adminDataModuleProfiles).set({
      targetContract: row.targetContract,
      targetCollection: row.targetCollection,
      fieldMapping: row.fieldMapping,
      updatedAt: new Date(),
    }).where(eq(adminDataModuleProfiles.moduleId, row.moduleId));
  }
  for (const row of rows) {
    await db.update(adminDataModuleProfiles).set({
      publishSchedule: row.publishSchedule,
      recommendationRule: row.recommendationRule,
      dedupeScope: row.dedupeScope,
      updatedAt: new Date(),
    }).where(and(eq(adminDataModuleProfiles.moduleId, row.moduleId), isNull(adminDataModuleProfiles.recommendationRule)));
  }
  await db.insert(adminDataModuleSettings).values(ADMIN_DATA_MODULES.map((module) => ({
    moduleId: module.id,
    status: 'managed' as const,
    adminNote: null,
    updatedByUserId: actorUserId,
    updatedAt: new Date(),
  }))).onDuplicateKeyUpdate({
    set: { moduleId: sql`module_id` },
  });
  await db.insert(adminDataModuleRuntimeControls).values(ADMIN_DATA_MODULES.map((module) => ({
    moduleId: module.id,
    dataMode: module.delivery.group === 'simulation_control' ? 'simulated' as const : 'inherit' as const,
    isEnabled: true,
    adminDetail: module.delivery.group === 'simulation_control' ? '默认明确模拟模式；仅允许使用与原前端字段兼容、可审计的模拟数据。' : null,
    updatedByUserId: actorUserId,
  }))).onDuplicateKeyUpdate({
    set: { moduleId: sql`module_id` },
  });
  return rows.length;
}

export async function ensureAdminDataModuleProfiles(actorUserId: number) {
  if (profileInitialization) return profileInitialization;
  profileInitialization = (async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await ensureAdminDataModuleProfilesAttempt(actorUserId);
      } catch (error) {
        if (!isDeadlock(error) || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
    throw new Error('ADMIN_DATA_MODULE_PROFILE_INITIALIZATION_FAILED');
  })();
  try {
    return await profileInitialization;
  } finally {
    profileInitialization = null;
  }
}

export async function listAdminDataModuleProfiles(actorUserId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureAdminDataModuleProfiles(actorUserId);
  return db.select().from(adminDataModuleProfiles);
}

export async function updateAdminDataModuleProfiles(actorUserId: number, patch: ModuleProfilePatch) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const now = new Date();
  await Promise.all(patch.moduleIds.map((moduleId) => db.update(adminDataModuleProfiles).set({
    sourceKind: patch.sourceKind,
    sourceReference: patch.sourceReference?.trim() || null,
    theme: patch.theme?.trim() || null,
    keywords: patch.keywords,
    tags: patch.tags,
    contentLimit: patch.contentLimit,
    updateFrequencyMinutes: patch.updateFrequencyMinutes,
    sortWeight: patch.sortWeight,
    automationEnabled: patch.automationEnabled,
    taskTemplate: patch.taskTemplate.trim(),
    executionPriority: patch.executionPriority,
    reviewPolicy: patch.reviewPolicy,
    pushPolicy: patch.pushPolicy,
    ...(patch.publishSchedule === undefined ? {} : { publishSchedule: patch.publishSchedule.trim().slice(0, 120) || 'manual_after_review' }),
    ...(patch.recommendationRule === undefined ? {} : { recommendationRule: patch.recommendationRule }),
    ...(patch.dedupeScope === undefined ? {} : { dedupeScope: patch.dedupeScope }),
    retryLimit: patch.retryLimit,
    runtimeStatus: patch.runtimeStatus,
    updatedByUserId: actorUserId,
    updatedAt: now,
  }).where(sql`${adminDataModuleProfiles.moduleId} = ${moduleId}`)));
  return { changed: patch.moduleIds.length, moduleIds: patch.moduleIds };
}
