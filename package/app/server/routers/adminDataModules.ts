import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_DATA_MODULE_IDS, ADMIN_DATA_MODULES, ADMIN_DATA_MODULE_STATUSES } from '@shared/adminDataModules';
import { adminDataModuleEvents, adminDataModuleRuntimeControls, adminDataModuleSettings } from '../../drizzle/schema';
import { getDb } from '../db';
import { adminProcedure, protectedProcedure, router } from '../_core/trpc';
import { listAdminDataModuleControls, refreshAdminDataModuleSources } from '../adminDataModuleRefresh';
import { listAdminDataModuleProfiles, updateAdminDataModuleProfiles } from '../adminDataModuleProfiles';
import { archiveAdminDataModules, bulkUpdateAdminDataModules, exportAdminDataModuleConfiguration, getAdminDataModuleDashboard, getAdminDataModuleDetail, importAdminDataModuleConfiguration, listAdminDataModuleDirectory, listAdminDataModuleSystemSettings, updateAdminDataModuleSystemSetting } from '../adminDataModuleManagement';
import { acknowledgePublicFeeds, getPublicFeedsForPath, getPublicModuleFeed } from '../adminModulePublicFeed';
import { refreshYahooChart } from '../realDataService';
import { getYahooFinanceProviderStatus } from '../yahooFinancePersistence';

export { resolveAdminDataModulesForPath } from '@shared/adminDataModules';

const statusText = { managed: '已纳入后台管理', attention: '需要关注', restricted: '来源或权限受限', archived: '后台归档' } as const;

function requireKnownModules(moduleIds: string[]) {
  const ids = [...new Set(moduleIds)];
  if (!ids.length) throw new Error('ADMIN_DATA_MODULE_SELECTION_EMPTY');
  if (ids.some((id) => !ADMIN_DATA_MODULE_IDS.includes(id))) throw new Error('ADMIN_DATA_MODULE_ID_INVALID');
  return ids;
}

export const adminDataModulesRouter = router({
  yfinanceProviderStatus: adminProcedure.query(() => getYahooFinanceProviderStatus()),
  probeYfinanceProvider: adminProcedure.input(z.object({
    symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9^=.\-]+$/).default('SPY'),
  }).optional()).mutation(async ({ input }) => {
    const symbol = input?.symbol?.toUpperCase() ?? 'SPY';
    const result = await refreshYahooChart(symbol, '5d', '1d', 'US');
    const live = Boolean(result && result.meta.persistentFallback !== true && result.meta.live !== false);
    const status = await getYahooFinanceProviderStatus();
    return {
      ...status,
      probe: {
        symbol,
        live,
        available: Boolean(result),
        observationCount: result?.history.length ?? 0,
        observedAt: result?.history.at(-1)?.date ?? null,
        source: result?.source ?? null,
        servedFromPersistentArchive: result?.meta.persistentFallback === true,
      },
    };
  }),
  getModuleFeed: protectedProcedure.input(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS) })).query(async ({ input, ctx }) => {
    return getPublicModuleFeed(input.moduleId, { id: ctx.user.id, role: ctx.user.role });
  }),
  getFeedsForPath: protectedProcedure.input(z.object({ path: z.string().trim().min(1).max(300) })).query(async ({ input, ctx }) => {
    return getPublicFeedsForPath(input.path, { id: ctx.user.id, role: ctx.user.role });
  }),
  acknowledgeFeeds: protectedProcedure.input(z.object({
    path: z.string().trim().startsWith('/').max(300),
    itemKeys: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(50),
    clientKey: z.string().min(16).max(120),
  })).mutation(({ input, ctx }) => acknowledgePublicFeeds({ ...input, actorUserId: ctx.user.id, actorRole: ctx.user.role })),
  dashboard: adminProcedure.query(({ ctx }) => getAdminDataModuleDashboard(ctx.user.id)),
  listSystemSettings: adminProcedure.query(({ ctx }) => listAdminDataModuleSystemSettings(ctx.user.id)),
  updateSystemSetting: adminProcedure.input(z.object({ settingKey: z.enum(['queue.execution', 'cache.source_refresh', 'retention.automation', 'simulation.governance', 'backup.restore']), value: z.record(z.string(), z.unknown()), description: z.string().max(600).optional() })).mutation(({ ctx, input }) => updateAdminDataModuleSystemSetting(ctx.user.id, input)),
  list: adminProcedure.query(async () => {
    const db = await getDb();
    const settings = db ? await db.select().from(adminDataModuleSettings) : [];
    const byId = new Map(settings.map((setting) => [setting.moduleId, setting]));
    return ADMIN_DATA_MODULES.map((module) => {
      const setting = byId.get(module.id);
      return { ...module, status: setting?.status ?? 'managed', adminNote: setting?.adminNote ?? null, updatedAt: setting?.updatedAt ?? null };
    });
  }),
  listPage: adminProcedure.input(z.object({
    query: z.string().max(200).optional(),
    domain: z.string().max(80).optional(),
    deliveryGroup: z.enum(['market_snapshot', 'news_review_pipeline', 'announcement_publication', 'request_time_read', 'simulation_control', 'no_server_contract']).optional(),
    status: z.enum(ADMIN_DATA_MODULE_STATUSES).optional(),
    sourceKind: z.enum(['real', 'simulated', 'mixed', 'none']).optional(),
    runtimeStatus: z.enum(['enabled', 'paused', 'pending_generation', 'pending_review', 'pending_delivery', 'delivering', 'delivered', 'failed']).optional(),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(160).optional(),
  }).optional()).query(({ ctx, input }) => listAdminDataModuleDirectory(ctx.user.id, input)),
  getDetail: adminProcedure.input(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS) })).query(({ ctx, input }) => getAdminDataModuleDetail(ctx.user.id, input.moduleId)),
  listEvents: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(adminDataModuleEvents).orderBy(desc(adminDataModuleEvents.createdAt)).limit(input?.limit ?? 50);
  }),
  listControls: adminProcedure.query(() => listAdminDataModuleControls()),
  listProfiles: adminProcedure.query(({ ctx }) => listAdminDataModuleProfiles(ctx.user.id)),
  update: adminProcedure.input(z.object({ moduleIds: z.array(z.string().min(1).max(96)).min(1).max(160), status: z.enum(ADMIN_DATA_MODULE_STATUSES), adminNote: z.string().max(600).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const moduleIds = requireKnownModules(input.moduleIds);
    const now = new Date();
    await db.insert(adminDataModuleSettings).values(moduleIds.map((moduleId) => ({ moduleId, status: input.status, adminNote: input.adminNote?.trim() || null, updatedByUserId: ctx.user.id, updatedAt: now }))).onDuplicateKeyUpdate({ set: { status: input.status, adminNote: input.adminNote?.trim() || null, updatedByUserId: ctx.user.id, updatedAt: now } });
    await db.insert(adminDataModuleEvents).values(moduleIds.map((moduleId) => ({ moduleId, action: input.status, actorUserId: ctx.user.id, detail: `管理员将前端数据模块 ${moduleId} 标记为${statusText[input.status]}；此操作仅更新后台管理目录，未改写前端页面、路由、数据或接口。` })));
    return { moduleIds, status: input.status, changed: moduleIds.length };
  }),
  updateRuntimeControls: adminProcedure.input(z.object({ moduleIds: z.array(z.string().min(1).max(96)).min(1).max(160), dataMode: z.enum(['inherit', 'real', 'simulated', 'paused']), isEnabled: z.boolean(), adminDetail: z.string().max(600).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const moduleIds = requireKnownModules(input.moduleIds);
    const now = new Date();
    const detail = input.adminDetail?.trim() || null;
    await db.insert(adminDataModuleRuntimeControls).values(moduleIds.map((moduleId) => ({ moduleId, dataMode: input.dataMode, isEnabled: input.isEnabled, adminDetail: detail, updatedByUserId: ctx.user.id, updatedAt: now }))).onDuplicateKeyUpdate({ set: { dataMode: input.dataMode, isEnabled: input.isEnabled, adminDetail: detail, updatedByUserId: ctx.user.id, updatedAt: now } });
    await db.insert(adminDataModuleEvents).values(moduleIds.map((moduleId) => ({ moduleId, action: 'managed' as const, actorUserId: ctx.user.id, detail: `管理员更新后台数据运行控制：模式=${input.dataMode}，${input.isEnabled ? '已启用' : '已暂停'}；只影响后台数据操作与审计，不向前端暴露后台信息。` })));
    return { moduleIds, dataMode: input.dataMode, isEnabled: input.isEnabled, changed: moduleIds.length };
  }),
  bulkUpdate: adminProcedure.input(z.object({
    moduleIds: z.array(z.enum(ADMIN_DATA_MODULE_IDS)).min(1).max(160),
    status: z.enum(ADMIN_DATA_MODULE_STATUSES).optional(),
    dataMode: z.enum(['inherit', 'real', 'simulated', 'paused']).optional(),
    isEnabled: z.boolean().optional(),
    adminNote: z.string().max(600).nullable().optional(),
    adminDetail: z.string().max(600).nullable().optional(),
  }).refine((input) => input.status !== undefined || input.dataMode !== undefined || input.isEnabled !== undefined || input.adminNote !== undefined || input.adminDetail !== undefined, { message: 'ADMIN_DATA_MODULE_BULK_PATCH_EMPTY' })).mutation(({ ctx, input }) => bulkUpdateAdminDataModules(ctx.user.id, input)),
  updateProfiles: adminProcedure.input(z.object({
    moduleIds: z.array(z.string().min(1).max(96)).min(1).max(160),
    sourceKind: z.enum(['real', 'simulated', 'mixed', 'none']),
    sourceReference: z.string().max(500).optional(),
    theme: z.string().max(200).optional(),
    keywords: z.array(z.string().min(1).max(80)).max(30),
    tags: z.array(z.string().min(1).max(80)).max(30),
    contentLimit: z.number().int().min(1).max(200),
    updateFrequencyMinutes: z.number().int().min(1).max(10080),
    sortWeight: z.number().int().min(0).max(100000),
    automationEnabled: z.boolean(),
    taskTemplate: z.string().min(1).max(120),
    executionPriority: z.number().int().min(0).max(100000),
    reviewPolicy: z.enum(['manual', 'auto_approved', 'disabled']),
    pushPolicy: z.enum(['manual', 'after_approval', 'disabled']),
    publishSchedule: z.string().min(1).max(120).optional(),
    recommendationRule: z.record(z.string(), z.unknown()).optional(),
    dedupeScope: z.enum(['module', 'global', 'pushed']).optional(),
    retryLimit: z.number().int().min(0).max(10),
    runtimeStatus: z.enum(['enabled', 'paused', 'pending_generation', 'pending_review', 'pending_delivery', 'delivering', 'delivered', 'failed']),
  })).mutation(({ ctx, input }) => updateAdminDataModuleProfiles(ctx.user.id, { ...input, moduleIds: requireKnownModules(input.moduleIds) })),
  refreshSources: adminProcedure.input(z.object({ moduleIds: z.array(z.string().min(1).max(96)).min(1).max(160) })).mutation(({ ctx, input }) => refreshAdminDataModuleSources(requireKnownModules(input.moduleIds), ctx.user.id)),
  archive: adminProcedure.input(z.object({ moduleIds: z.array(z.enum(ADMIN_DATA_MODULE_IDS)).min(1).max(160), adminNote: z.string().max(600).optional() })).mutation(({ ctx, input }) => archiveAdminDataModules(ctx.user.id, input.moduleIds, input.adminNote)),
  exportConfiguration: adminProcedure.input(z.object({ moduleIds: z.array(z.enum(ADMIN_DATA_MODULE_IDS)).min(1).max(160).optional() }).optional()).query(({ ctx, input }) => exportAdminDataModuleConfiguration(ctx.user.id, input?.moduleIds)),
  importConfiguration: adminProcedure.input(z.object({
    version: z.literal(1),
    settings: z.array(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS), status: z.enum(ADMIN_DATA_MODULE_STATUSES), adminNote: z.string().max(600).nullable().optional() })).max(160).optional(),
    profiles: z.array(z.object({
      moduleId: z.enum(ADMIN_DATA_MODULE_IDS),
      sourceKind: z.enum(['real', 'simulated', 'mixed', 'none']),
      sourceReference: z.string().max(500).optional(),
      theme: z.string().max(200).optional(),
      keywords: z.array(z.string().min(1).max(80)).max(30),
      tags: z.array(z.string().min(1).max(80)).max(30),
      contentLimit: z.number().int().min(1).max(200),
      updateFrequencyMinutes: z.number().int().min(1).max(10080),
      sortWeight: z.number().int().min(0).max(100000),
      automationEnabled: z.boolean(),
      taskTemplate: z.string().min(1).max(120),
      executionPriority: z.number().int().min(0).max(100000),
      reviewPolicy: z.enum(['manual', 'auto_approved', 'disabled']),
      pushPolicy: z.enum(['manual', 'after_approval', 'disabled']),
      publishSchedule: z.string().min(1).max(120).optional(),
      recommendationRule: z.record(z.string(), z.unknown()).optional(),
      dedupeScope: z.enum(['module', 'global', 'pushed']).optional(),
      retryLimit: z.number().int().min(0).max(10),
      runtimeStatus: z.enum(['enabled', 'paused', 'pending_generation', 'pending_review', 'pending_delivery', 'delivering', 'delivered', 'failed']),
    })).max(160).optional(),
    runtimeControls: z.array(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS), dataMode: z.enum(['inherit', 'real', 'simulated', 'paused']), isEnabled: z.boolean(), adminDetail: z.string().max(600).nullable().optional() })).max(160).optional(),
  })).mutation(({ ctx, input }) => importAdminDataModuleConfiguration(ctx.user.id, input)),
});
