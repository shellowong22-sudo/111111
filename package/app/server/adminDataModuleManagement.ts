import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  adminDataModuleAutomationRunItems,
  adminDataModuleAutomationRuns,
  adminDataModuleContentItems,
  adminDataModuleDeliveryEvents,
  adminDataModuleDeliveryOperations,
  adminDataModuleEvents,
  adminDataModuleExecutionLocks,
  adminDataModuleProfiles,
  adminDataModuleRequestCache,
  adminDataModuleRuntimeControls,
  adminDataModuleSettings,
  adminDataModuleSystemSettings,
} from '../drizzle/schema';
import { ADMIN_DATA_MODULE_IDS, ADMIN_DATA_MODULES, type AdminDataModuleStatus } from '../shared/adminDataModules';
import { getDb } from './db';
import { ensureAdminDataModuleProfiles, type ModuleProfilePatch } from './adminDataModuleProfiles';

export type ModuleDirectoryFilter = {
  query?: string;
  domain?: string;
  deliveryGroup?: string;
  status?: AdminDataModuleStatus;
  sourceKind?: 'real' | 'simulated' | 'mixed' | 'none';
  runtimeStatus?: ModuleProfilePatch['runtimeStatus'];
  page?: number;
  pageSize?: number;
};

function knownModuleIds(moduleIds: string[]) {
  const ids = [...new Set(moduleIds)];
  if (!ids.length) throw new Error('ADMIN_DATA_MODULE_SELECTION_EMPTY');
  if (ids.some((id) => !ADMIN_DATA_MODULE_IDS.includes(id))) throw new Error('ADMIN_DATA_MODULE_ID_INVALID');
  return ids;
}

const SYSTEM_SETTING_DEFAULTS = [
  { settingKey: 'queue.execution', category: 'task_queue', value: { maxConcurrentItems: 8, itemTimeoutMs: 100000, retryBackoffSeconds: 30 }, description: '后台持久队列并发、超时与重试退避参数；前端不读取此设置。' },
  { settingKey: 'cache.source_refresh', category: 'cache', value: { ttlSeconds: 60, mergeDuplicateRequests: true }, description: '后台来源刷新缓存与同键请求合并参数；不改变前端缓存。' },
  { settingKey: 'retention.automation', category: 'retention', value: { completedRunDays: 30, contentAuditDays: 180 }, description: '后台任务与审计数据保留建议；实际清理由管理员触发。' },
  { settingKey: 'simulation.governance', category: 'simulation', value: { allowExplicitSimulatedData: true, requireSourceKindLabel: true }, description: '模拟数据仅允许在后台明确标识并经过审核推送回滚链路。' },
  { settingKey: 'backup.restore', category: 'backup', value: { requireVersionSnapshot: true, rollbackEnabled: true }, description: '推送前版本快照和回滚操作的后台治理要求。' },
] as const;

const SYSTEM_SETTING_KEYS = SYSTEM_SETTING_DEFAULTS.map((setting) => setting.settingKey);

async function ensureAdminDataModuleSystemSettings(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  await db.insert(adminDataModuleSystemSettings).values(SYSTEM_SETTING_DEFAULTS.map((setting) => ({ ...setting, updatedByUserId: actorUserId, createdAt: now, updatedAt: now }))).onDuplicateKeyUpdate({ set: { settingKey: sql`setting_key` } });
}

export async function listAdminDataModuleSystemSettings(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleSystemSettings(actorUserId);
  return db.select().from(adminDataModuleSystemSettings).orderBy(desc(adminDataModuleSystemSettings.category), desc(adminDataModuleSystemSettings.updatedAt));
}

export async function updateAdminDataModuleSystemSetting(actorUserId: number, input: { settingKey: string; value: Record<string, unknown>; description?: string }) {
  if (!SYSTEM_SETTING_KEYS.includes(input.settingKey as typeof SYSTEM_SETTING_KEYS[number])) throw new Error('ADMIN_MODULE_SYSTEM_SETTING_KEY_INVALID');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleSystemSettings(actorUserId);
  const current = (await db.select().from(adminDataModuleSystemSettings).where(eq(adminDataModuleSystemSettings.settingKey, input.settingKey)).limit(1))[0];
  if (!current) throw new Error('ADMIN_MODULE_SYSTEM_SETTING_NOT_FOUND');
  await db.update(adminDataModuleSystemSettings).set({ value: input.value, description: input.description?.trim() || current.description, updatedByUserId: actorUserId, updatedAt: new Date() }).where(eq(adminDataModuleSystemSettings.settingKey, input.settingKey));
  return { settingKey: input.settingKey, category: current.category, updated: true };
}

export async function listAdminDataModuleDirectory(actorUserId: number, filter: ModuleDirectoryFilter = {}) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const [settings, profiles, controls] = await Promise.all([
    db.select().from(adminDataModuleSettings),
    db.select().from(adminDataModuleProfiles),
    db.select().from(adminDataModuleRuntimeControls),
  ]);
  const settingsById = new Map(settings.map((row) => [row.moduleId, row]));
  const profilesById = new Map(profiles.map((row) => [row.moduleId, row]));
  const controlsById = new Map(controls.map((row) => [row.moduleId, row]));
  const normalized = (filter.query ?? '').trim().toLocaleLowerCase('zh-CN');
  const rows = ADMIN_DATA_MODULES.map((module) => {
    const setting = settingsById.get(module.id);
    const profile = profilesById.get(module.id) ?? null;
    const control = controlsById.get(module.id) ?? null;
    return {
      ...module,
      status: setting?.status ?? 'managed',
      adminNote: setting?.adminNote ?? null,
      profile,
      runtimeControl: control,
      updatedAt: setting?.updatedAt ?? profile?.updatedAt ?? control?.updatedAt ?? null,
    };
  }).filter((row) => {
    const queryMatch = !normalized || [row.id, row.name, row.path, row.domain, row.adminNote ?? '', row.profile?.theme ?? ''].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized));
    const domainMatch = !filter.domain || row.domain === filter.domain;
    const deliveryMatch = !filter.deliveryGroup || row.delivery.group === filter.deliveryGroup;
    const statusMatch = !filter.status || row.status === filter.status;
    const sourceMatch = !filter.sourceKind || row.profile?.sourceKind === filter.sourceKind;
    const runtimeMatch = !filter.runtimeStatus || row.profile?.runtimeStatus === filter.runtimeStatus;
    return queryMatch && domainMatch && deliveryMatch && statusMatch && sourceMatch && runtimeMatch;
  });
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(160, Math.max(1, filter.pageSize ?? 40));
  return { page, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) };
}

export async function getAdminDataModuleDetail(actorUserId: number, moduleId: string) {
  if (!ADMIN_DATA_MODULE_IDS.includes(moduleId)) throw new Error('ADMIN_DATA_MODULE_ID_INVALID');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const module = ADMIN_DATA_MODULES.find((item) => item.id === moduleId);
  if (!module) throw new Error('ADMIN_DATA_MODULE_ID_INVALID');
  const [setting, profile, control, events, deliveryEvents] = await Promise.all([
    db.select().from(adminDataModuleSettings).where(eq(adminDataModuleSettings.moduleId, moduleId)).limit(1),
    db.select().from(adminDataModuleProfiles).where(eq(adminDataModuleProfiles.moduleId, moduleId)).limit(1),
    db.select().from(adminDataModuleRuntimeControls).where(eq(adminDataModuleRuntimeControls.moduleId, moduleId)).limit(1),
    db.select().from(adminDataModuleEvents).where(eq(adminDataModuleEvents.moduleId, moduleId)).orderBy(desc(adminDataModuleEvents.createdAt)).limit(100),
    db.select().from(adminDataModuleDeliveryEvents).where(eq(adminDataModuleDeliveryEvents.moduleId, moduleId)).orderBy(desc(adminDataModuleDeliveryEvents.createdAt)).limit(100),
  ]);
  return { module, setting: setting[0] ?? null, profile: profile[0] ?? null, runtimeControl: control[0] ?? null, events, deliveryEvents };
}

export async function getAdminDataModuleDashboard(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const [profiles, contents, runs, items, deliveryOperations, requestCache, locks, recentEvents] = await Promise.all([
    db.select().from(adminDataModuleProfiles),
    db.select().from(adminDataModuleContentItems),
    db.select().from(adminDataModuleAutomationRuns),
    db.select().from(adminDataModuleAutomationRunItems),
    db.select().from(adminDataModuleDeliveryOperations),
    db.select().from(adminDataModuleRequestCache),
    db.select().from(adminDataModuleExecutionLocks),
    db.select().from(adminDataModuleDeliveryEvents).orderBy(desc(adminDataModuleDeliveryEvents.createdAt)).limit(30),
  ]);
  const pushed = deliveryOperations.filter((operation) => operation.status === 'applied').length;
  const failedPushes = deliveryOperations.filter((operation) => operation.status === 'failed').length;
  const deliveryDurations = recentEvents.map((event) => event.durationMs).filter((value): value is number => typeof value === 'number');
  const averageDeliveryDurationMs = deliveryDurations.length ? Math.round(deliveryDurations.reduce((sum, value) => sum + value, 0) / deliveryDurations.length) : null;
  return {
    modules: {
      total: profiles.length,
      enabled: profiles.filter((profile) => profile.runtimeStatus === 'enabled').length,
      paused: profiles.filter((profile) => profile.runtimeStatus === 'paused').length,
      pendingReview: profiles.filter((profile) => profile.runtimeStatus === 'pending_review').length,
      pendingDelivery: profiles.filter((profile) => profile.runtimeStatus === 'pending_delivery' || profile.runtimeStatus === 'delivering').length,
      failed: profiles.filter((profile) => profile.runtimeStatus === 'failed').length,
    },
    content: {
      total: contents.length,
      pendingReview: contents.filter((content) => content.status === 'pending_review').length,
      approved: contents.filter((content) => content.status === 'approved' || content.status === 'queued_for_delivery').length,
      delivered: contents.filter((content) => content.status === 'delivered').length,
      rejected: contents.filter((content) => content.status === 'rejected').length,
      failed: contents.filter((content) => content.status === 'failed').length,
    },
    queue: {
      totalRuns: runs.length,
      activeRuns: runs.filter((run) => run.status === 'queued' || run.status === 'running').length,
      failedRuns: runs.filter((run) => run.status === 'failed').length,
      queuedItems: items.filter((item) => item.status === 'queued' || item.status === 'claimed' || item.status === 'running').length,
      pendingReviewItems: items.filter((item) => item.status === 'pending_review').length,
      failedItems: items.filter((item) => item.status === 'failed').length,
    },
    delivery: {
      applied: pushed,
      failed: failedPushes,
      successRate: pushed + failedPushes ? Number((pushed / (pushed + failedPushes)).toFixed(4)) : null,
      averageDurationMs: averageDeliveryDurationMs,
    },
    system: {
      activeLeases: locks.length,
      requestCacheReady: requestCache.filter((entry) => entry.status === 'ready').length,
      requestCachePending: requestCache.filter((entry) => entry.status === 'pending').length,
      requestCacheFailed: requestCache.filter((entry) => entry.status === 'failed').length,
      processUptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
    },
    recentEvents,
  };
}

export async function exportAdminDataModuleConfiguration(actorUserId: number, moduleIds?: string[]) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const ids = moduleIds?.length ? knownModuleIds(moduleIds) : [...ADMIN_DATA_MODULE_IDS];
  const [settings, profiles, controls] = await Promise.all([
    db.select().from(adminDataModuleSettings).where(inArray(adminDataModuleSettings.moduleId, ids)),
    db.select().from(adminDataModuleProfiles).where(inArray(adminDataModuleProfiles.moduleId, ids)),
    db.select().from(adminDataModuleRuntimeControls).where(inArray(adminDataModuleRuntimeControls.moduleId, ids)),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    moduleIds: ids,
    settings: settings.map(({ createdAt, updatedAt, updatedByUserId, ...row }) => row),
    profiles: profiles.map(({ createdAt, updatedAt, updatedByUserId, ownerUserId, lastExecutedAt, lastPushedAt, ...row }) => row),
    runtimeControls: controls.map(({ createdAt, updatedAt, updatedByUserId, ...row }) => row),
  };
}

export type ModuleConfigurationImport = {
  version: 1;
  settings?: Array<{ moduleId: string; status: AdminDataModuleStatus; adminNote?: string | null }>;
  profiles?: Array<Omit<ModuleProfilePatch, 'moduleIds'> & { moduleId: string }>;
  runtimeControls?: Array<{ moduleId: string; dataMode: 'inherit' | 'real' | 'simulated' | 'paused'; isEnabled: boolean; adminDetail?: string | null }>;
};

export async function importAdminDataModuleConfiguration(actorUserId: number, input: ModuleConfigurationImport) {
  if (input.version !== 1) throw new Error('ADMIN_DATA_MODULE_IMPORT_VERSION_UNSUPPORTED');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const settings = input.settings ?? [];
  const profiles = input.profiles ?? [];
  const runtimeControls = input.runtimeControls ?? [];
  knownModuleIds([...settings.map((row) => row.moduleId), ...profiles.map((row) => row.moduleId), ...runtimeControls.map((row) => row.moduleId)]);
  const now = new Date();
  return db.transaction(async (tx) => {
    if (settings.length) {
      for (const setting of settings) {
        await tx.insert(adminDataModuleSettings).values({ moduleId: setting.moduleId, status: setting.status, adminNote: setting.adminNote?.trim() || null, updatedByUserId: actorUserId, updatedAt: now }).onDuplicateKeyUpdate({ set: { status: setting.status, adminNote: setting.adminNote?.trim() || null, updatedByUserId: actorUserId, updatedAt: now } });
      }
    }
    for (const profile of profiles) {
      const { moduleId, ...patch } = profile;
      await tx.update(adminDataModuleProfiles).set({ ...patch, updatedByUserId: actorUserId, updatedAt: now }).where(eq(adminDataModuleProfiles.moduleId, moduleId));
    }
    if (runtimeControls.length) {
      for (const control of runtimeControls) {
        await tx.insert(adminDataModuleRuntimeControls).values({ moduleId: control.moduleId, dataMode: control.dataMode, isEnabled: control.isEnabled, adminDetail: control.adminDetail?.trim() || null, updatedByUserId: actorUserId, updatedAt: now }).onDuplicateKeyUpdate({ set: { dataMode: control.dataMode, isEnabled: control.isEnabled, adminDetail: control.adminDetail?.trim() || null, updatedByUserId: actorUserId, updatedAt: now } });
      }
    }
    if (settings.length) await tx.insert(adminDataModuleEvents).values(settings.map((row) => ({ moduleId: row.moduleId, action: row.status, actorUserId, detail: '管理员通过配置导入更新了后台模块目录；未导入或改写任何前端代码、路由、接口或数据缓存。' })));
    return { settingsImported: settings.length, profilesImported: profiles.length, runtimeControlsImported: runtimeControls.length };
  });
}

export async function bulkUpdateAdminDataModules(actorUserId: number, input: { moduleIds: string[]; status?: AdminDataModuleStatus; dataMode?: 'inherit' | 'real' | 'simulated' | 'paused'; isEnabled?: boolean; adminNote?: string | null; adminDetail?: string | null }) {
  const ids = knownModuleIds(input.moduleIds);
  if (input.status === undefined && input.dataMode === undefined && input.isEnabled === undefined && input.adminNote === undefined && input.adminDetail === undefined) throw new Error('ADMIN_DATA_MODULE_BULK_PATCH_EMPTY');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureAdminDataModuleProfiles(actorUserId);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (input.status !== undefined || input.adminNote !== undefined) {
      const existing = await tx.select({ moduleId: adminDataModuleSettings.moduleId, status: adminDataModuleSettings.status, adminNote: adminDataModuleSettings.adminNote }).from(adminDataModuleSettings).where(inArray(adminDataModuleSettings.moduleId, ids));
      const current = new Map(existing.map((row) => [row.moduleId, row]));
      for (const moduleId of ids) {
        const row = current.get(moduleId);
        const status = input.status ?? row?.status ?? 'managed';
        const adminNote = input.adminNote === undefined ? row?.adminNote ?? null : input.adminNote?.trim() || null;
        await tx.insert(adminDataModuleSettings).values({ moduleId, status, adminNote, updatedByUserId: actorUserId, updatedAt: now }).onDuplicateKeyUpdate({ set: { status, adminNote, updatedByUserId: actorUserId, updatedAt: now } });
      }
    }
    if (input.dataMode !== undefined || input.isEnabled !== undefined || input.adminDetail !== undefined) {
      const existing = await tx.select({ moduleId: adminDataModuleRuntimeControls.moduleId, dataMode: adminDataModuleRuntimeControls.dataMode, isEnabled: adminDataModuleRuntimeControls.isEnabled, adminDetail: adminDataModuleRuntimeControls.adminDetail }).from(adminDataModuleRuntimeControls).where(inArray(adminDataModuleRuntimeControls.moduleId, ids));
      const current = new Map(existing.map((row) => [row.moduleId, row]));
      for (const moduleId of ids) {
        const row = current.get(moduleId);
        const dataMode = input.dataMode ?? row?.dataMode ?? 'inherit';
        const isEnabled = input.isEnabled ?? row?.isEnabled ?? false;
        const adminDetail = input.adminDetail === undefined ? row?.adminDetail ?? null : input.adminDetail?.trim() || null;
        await tx.insert(adminDataModuleRuntimeControls).values({ moduleId, dataMode, isEnabled, adminDetail, updatedByUserId: actorUserId, updatedAt: now }).onDuplicateKeyUpdate({ set: { dataMode, isEnabled, adminDetail, updatedByUserId: actorUserId, updatedAt: now } });
      }
    }
    await tx.insert(adminDataModuleEvents).values(ids.map((moduleId) => ({ moduleId, action: 'managed' as const, actorUserId, detail: JSON.stringify({ operation: 'bulk_update', status: input.status ?? null, dataMode: input.dataMode ?? null, isEnabled: input.isEnabled ?? null, adminNote: input.adminNote ?? null, adminDetail: input.adminDetail ?? null }) })));
  });
  return { moduleIds: ids, updated: ids.length };
}

export async function archiveAdminDataModules(actorUserId: number, moduleIds: string[], note?: string) {
  const ids = knownModuleIds(moduleIds);
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(adminDataModuleSettings).values(ids.map((moduleId) => ({ moduleId, status: 'archived' as const, adminNote: note?.trim() || null, updatedByUserId: actorUserId, updatedAt: now }))).onDuplicateKeyUpdate({ set: { status: 'archived', adminNote: note?.trim() || null, updatedByUserId: actorUserId, updatedAt: now } });
    await tx.insert(adminDataModuleRuntimeControls).values(ids.map((moduleId) => ({ moduleId, dataMode: 'paused' as const, isEnabled: false, adminDetail: '模块已在后台逻辑归档，保留映射与历史记录，未删除或改写前端。', updatedByUserId: actorUserId, updatedAt: now }))).onDuplicateKeyUpdate({ set: { dataMode: 'paused', isEnabled: false, adminDetail: '模块已在后台逻辑归档，保留映射与历史记录，未删除或改写前端。', updatedByUserId: actorUserId, updatedAt: now } });
    await tx.insert(adminDataModuleEvents).values(ids.map((moduleId) => ({ moduleId, action: 'archived' as const, actorUserId, detail: '管理员逻辑归档模块配置；注册表和既有前端入口保持不变，历史数据未删除。' })));
  });
  return { moduleIds: ids, archived: ids.length };
}
