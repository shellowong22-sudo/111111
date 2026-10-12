import { desc, eq, inArray } from 'drizzle-orm';
import { adminDataModuleRefreshEvents, adminDataModuleRuntimeControls, adminMarketIngestionTargets, adminNewsIngestionSources } from '../drizzle/schema';
import { ADMIN_DATA_MODULES } from '@shared/adminDataModules';
import { getDb } from './db';
import { syncAdminMarketTarget } from './adminMarketIngestion';
import { syncAdminNewsSource } from './adminNewsIngestion';
import { getAdminDataModuleSystemSettingValue, withAdminDataModuleRequestCache } from './adminDataModuleQueue';

export type RefreshSourceGroup = 'market_ingestion' | 'news_ingestion' | 'request_time' | 'restricted' | 'simulation';
export type RefreshState = 'available' | 'partial' | 'unavailable' | 'not_configured' | 'restricted' | 'simulated' | 'paused';
type RuntimeMode = 'inherit' | 'real' | 'simulated' | 'paused';

function controlForModule(module: typeof ADMIN_DATA_MODULES[number]): { sourceGroup: RefreshSourceGroup; state: RefreshState; label: string; detail: string; actionable: boolean } {
  if (module.domain === '行情与市场') return { sourceGroup: 'market_ingestion', state: 'not_configured', label: '公共日频市场来源', detail: '仅刷新管理员已配置的具体标的；不代表实时或可执行报价。', actionable: true };
  if (module.domain === '新闻与研究') return { sourceGroup: 'news_ingestion', state: 'not_configured', label: '许可新闻来源', detail: '仅同步已启用 RSS/Atom 元数据；不抓取全文或自动发布。', actionable: true };
  if (module.domain === '宏观与研究' || module.domain === '利率与曲线') return { sourceGroup: 'request_time', state: 'restricted', label: '按请求公开观察', detail: '现有模块在用户请求时读取各自公开来源；尚无可复用的统一后台写入刷新契约。', actionable: false };
  return { sourceGroup: 'restricted', state: 'restricted', label: '来源或权限受限', detail: '该模块缺少经验证的通用真实来源刷新契约；后台不会以模拟、模型或交易数据替代。', actionable: false };
}

export async function listAdminDataModuleControls() {
  const db = await getDb();
  const [marketTargets, newsSources, events, runtimeControls] = db ? await Promise.all([
    db.select().from(adminMarketIngestionTargets),
    db.select().from(adminNewsIngestionSources),
    db.select().from(adminDataModuleRefreshEvents).orderBy(desc(adminDataModuleRefreshEvents.createdAt)).limit(400),
    db.select().from(adminDataModuleRuntimeControls),
  ]) : [[], [], [], []] as const;
  const latestByModule = new Map<string, typeof events[number]>();
  events.forEach((event) => { if (!latestByModule.has(event.moduleId)) latestByModule.set(event.moduleId, event); });
  const runtimeByModule = new Map(runtimeControls.map((control) => [control.moduleId, control]));
  const marketActive = marketTargets.filter((target) => target.isActive);
  const newsActive = newsSources.filter((source) => source.isActive);
  return ADMIN_DATA_MODULES.map((module) => {
    const base = controlForModule(module);
    const latest = latestByModule.get(module.id) ?? null;
    const runtime = runtimeByModule.get(module.id);
    const applyRuntime = <T extends Record<string, unknown>>(control: T) => {
      const dataMode = (runtime?.dataMode ?? 'inherit') as RuntimeMode;
      const isEnabled = runtime?.isEnabled ?? true;
      const detail = runtime?.adminDetail ?? null;
      if (!isEnabled || dataMode === 'paused') return { ...control, sourceGroup: 'restricted' as const, state: 'paused' as const, label: '后台数据操作已暂停', detail: detail || '管理员已暂停该模块的后台数据操作；前端模块不接收后台实现细节。', actionable: false, dataMode, isEnabled, runtimeDetail: detail, runtimeUpdatedAt: runtime?.updatedAt ?? null };
      if (dataMode === 'simulated') return { ...control, sourceGroup: 'simulation' as const, state: 'simulated' as const, label: '明确模拟数据模式', detail: detail || '后台已登记为模拟数据模式；不得称为实时或可执行市场数据。', actionable: false, dataMode, isEnabled, runtimeDetail: detail, runtimeUpdatedAt: runtime?.updatedAt ?? null };
      return { ...control, dataMode, isEnabled, runtimeDetail: detail, runtimeUpdatedAt: runtime?.updatedAt ?? null };
    };
    if (base.sourceGroup === 'market_ingestion') {
      const available = marketActive.filter((target) => target.lastStatus === 'available').length;
      const sourceState: RefreshState = !marketActive.length ? 'not_configured' : available === marketActive.length ? 'available' : available ? 'partial' : marketActive.some((target) => target.lastStatus === 'unavailable') ? 'unavailable' : 'not_configured';
      return applyRuntime({ moduleId: module.id, ...base, state: sourceState, configuredSourceCount: marketActive.length, availableSourceCount: available, lastRefreshedAt: latest?.createdAt ?? null, lastDetail: latest?.detail ?? null, lastRefreshState: latest?.status ?? null });
    }
    if (base.sourceGroup === 'news_ingestion') {
      const available = newsActive.filter((source) => source.lastStatus === 'available').length;
      const sourceState: RefreshState = !newsActive.length ? 'not_configured' : available === newsActive.length ? 'available' : available ? 'partial' : newsActive.some((source) => source.lastStatus === 'unavailable') ? 'unavailable' : 'not_configured';
      return applyRuntime({ moduleId: module.id, ...base, state: sourceState, configuredSourceCount: newsActive.length, availableSourceCount: available, lastRefreshedAt: latest?.createdAt ?? null, lastDetail: latest?.detail ?? null, lastRefreshState: latest?.status ?? null });
    }
    return applyRuntime({ moduleId: module.id, ...base, configuredSourceCount: 0, availableSourceCount: 0, lastRefreshedAt: latest?.createdAt ?? null, lastDetail: latest?.detail ?? null, lastRefreshState: latest?.status ?? null });
  });
}

export async function refreshAdminDataModuleSources(moduleIds: string[], actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const cacheSettings = await getAdminDataModuleSystemSettingValue('cache.source_refresh', { ttlSeconds: 60 });
  const cacheTtlMs = typeof cacheSettings.ttlSeconds === 'number' && Number.isFinite(cacheSettings.ttlSeconds) ? Math.min(15 * 60_000, Math.max(30_000, Math.floor(cacheSettings.ttlSeconds * 1000))) : 60_000;
  const selected = ADMIN_DATA_MODULES.filter((module) => moduleIds.includes(module.id));
  const runtimeRows = selected.length ? await db.select().from(adminDataModuleRuntimeControls).where(inArray(adminDataModuleRuntimeControls.moduleId, selected.map((module) => module.id))) : [];
  const runtimeByModule = new Map(runtimeRows.map((control) => [control.moduleId, control]));
  const isRuntimeRefreshable = (moduleId: string) => {
    const runtime = runtimeByModule.get(moduleId);
    return (runtime?.isEnabled ?? true) && runtime?.dataMode !== 'paused' && runtime?.dataMode !== 'simulated';
  };
  const refreshable = selected.filter((module) => controlForModule(module).actionable && isRuntimeRefreshable(module.id));
  const nonRefreshable = selected.filter((module) => !controlForModule(module).actionable || !isRuntimeRefreshable(module.id));
  const marketRequested = refreshable.some((module) => module.domain === '行情与市场');
  const newsRequested = refreshable.some((module) => module.domain === '新闻与研究');
  const [marketTargets, newsSources] = await Promise.all([
    marketRequested ? db.select().from(adminMarketIngestionTargets).where(eq(adminMarketIngestionTargets.isActive, true)).limit(20) : Promise.resolve([]),
    newsRequested ? db.select().from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.isActive, true)).limit(20) : Promise.resolve([]),
  ]);
  const results: Array<{ group: RefreshSourceGroup; status: RefreshState; detail: string }> = [];
  if (marketRequested) {
    if (!marketTargets.length) results.push({ group: 'market_ingestion', status: 'not_configured', detail: '没有已启用的市场采集标的；未请求外部数据。' });
    else {
      const cache = await withAdminDataModuleRequestCache({
        cacheKey: `market-refresh:${marketTargets.map((target) => target.id).sort((a, b) => a - b).join(',')}`,
        ttlMs: cacheTtlMs,
        operation: async () => {
          const rows = await Promise.all(marketTargets.map((target) => syncAdminMarketTarget(target.id, actorUserId)));
          const available = rows.filter((row) => row.status === 'available').length;
          return { total: rows.length, available };
        },
      });
      const { total, available } = cache.value;
      results.push({ group: 'market_ingestion', status: available === total ? 'available' : available ? 'partial' : 'unavailable', detail: `已${cache.cache === 'miss' ? '刷新' : '复用最近刷新结果'} ${total} 个显式配置的公共日频市场标的；成功 ${available} 个。` });
    }
  }
  if (newsRequested) {
    if (!newsSources.length) results.push({ group: 'news_ingestion', status: 'not_configured', detail: '没有已启用的许可新闻来源；未请求外部数据。' });
    else {
      const cache = await withAdminDataModuleRequestCache({
        cacheKey: `news-refresh:${newsSources.map((source) => source.id).sort((a, b) => a - b).join(',')}`,
        ttlMs: cacheTtlMs,
        operation: async () => {
          const rows = await Promise.all(newsSources.map((source) => syncAdminNewsSource(source.id, actorUserId, Math.min(50, source.maxItemsPerRun))));
          const available = rows.filter((row: any) => row.status === 'available').length;
          return { total: rows.length, available };
        },
      });
      const { total, available } = cache.value;
      results.push({ group: 'news_ingestion', status: available === total ? 'available' : available ? 'partial' : 'unavailable', detail: `已${cache.cache === 'miss' ? '同步' : '复用最近同步结果'} ${total} 个已启用许可新闻来源；可用 ${available} 个。` });
    }
  }
  const resultByGroup = new Map(results.map((result) => [result.group, result]));
  const now = new Date();
  const events = selected.map((module) => {
    const runtime = runtimeByModule.get(module.id);
    const control = controlForModule(module);
    const result = resultByGroup.get(control.sourceGroup);
    const paused = !(runtime?.isEnabled ?? true) || runtime?.dataMode === 'paused';
    const simulated = runtime?.dataMode === 'simulated';
    const state: 'available' | 'partial' | 'unavailable' | 'not_configured' | 'restricted' = paused || simulated ? 'restricted' : result?.status === 'available' || result?.status === 'partial' || result?.status === 'unavailable' || result?.status === 'not_configured' || result?.status === 'restricted' ? result.status : (control.actionable ? 'not_configured' : 'restricted');
    const detail = paused ? (runtime?.adminDetail || '后台运行控制已暂停；未请求外部数据。') : simulated ? (runtime?.adminDetail || '模块处于明确模拟数据模式；未请求外部真实来源。') : result?.detail ?? control.detail;
    const persistedSourceGroup: 'market_ingestion' | 'news_ingestion' | 'request_time' | 'restricted' = control.sourceGroup === 'simulation' ? 'restricted' : control.sourceGroup;
    return { moduleId: module.id, sourceGroup: persistedSourceGroup, status: state, actorUserId, detail, createdAt: now };
  });
  if (events.length) await db.insert(adminDataModuleRefreshEvents).values(events);
  return { requested: selected.length, refreshedGroups: results, restricted: nonRefreshable.map((module) => module.id), audited: events.length };
}
