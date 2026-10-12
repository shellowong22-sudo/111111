import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_DATA_MODULES } from '@shared/adminDataModules';

const mocks = vi.hoisted(() => ({ inserts: [] as { table: unknown; values: unknown }[] }));

const profileMocks = vi.hoisted(() => ({
  list: vi.fn(async () => [{ moduleId: 'market', moduleGroup: '市场快照', targetContract: 'market_snapshot', targetCollection: 'market_data' }]),
  update: vi.fn(async (_actorUserId: number, input: { moduleIds: string[] }) => ({ changed: input.moduleIds.length, moduleIds: input.moduleIds })),
}));

const managementMocks = vi.hoisted(() => ({
  dashboard: vi.fn(async () => ({ modules: { total: 139 }, queue: { activeRuns: 0 }, system: { activeLeases: 0 } })),
  listSystemSettings: vi.fn(async () => [{ settingKey: 'queue.execution', category: 'task_queue' }]),
  updateSystemSetting: vi.fn(async () => ({ settingKey: 'queue.execution', category: 'task_queue', updated: true })),
  directory: vi.fn(async () => ({ page: 1, pageSize: 40, total: 1, rows: [{ id: 'market' }] })),
  detail: vi.fn(async () => ({ module: { id: 'market' }, profile: { moduleId: 'market' } })),
  exportConfiguration: vi.fn(async () => ({ version: 1, moduleIds: ['market'], settings: [], profiles: [], runtimeControls: [] })),
  importConfiguration: vi.fn(async () => ({ settingsImported: 1, profilesImported: 0, runtimeControlsImported: 0 })),
  archive: vi.fn(async (_actorUserId: number, moduleIds: string[]) => ({ moduleIds, archived: moduleIds.length })),
  bulkUpdate: vi.fn(async (_actorUserId: number, input: { moduleIds: string[] }) => ({ moduleIds: input.moduleIds, updated: input.moduleIds.length })),
}));

const yfinanceMocks = vi.hoisted(() => ({
  refresh: vi.fn(async () => ({
    symbol: 'SPY', history: [{ date: '2026-09-21', value: 680, close: 680 }],
    source: 'yfinance community wrapper / Yahoo Finance public data', meta: { live: true, persistentFallback: false },
  })),
  status: vi.fn(async () => ({
    providerId: 'yfinance-community', available: true, lastStatus: 'succeeded',
    persistedObservationCount: 1, dataContractId: 'market.ohlcv.daily.v1',
  })),
}));

vi.mock('../realDataService', () => ({ refreshYahooChart: yfinanceMocks.refresh }));
vi.mock('../yahooFinancePersistence', () => ({ getYahooFinanceProviderStatus: yfinanceMocks.status }));

vi.mock('../adminDataModuleRefresh', () => ({
  listAdminDataModuleControls: async () => [{ moduleId: 'market', state: 'available', actionable: true }],
  refreshAdminDataModuleSources: async (moduleIds: string[], actorUserId: number) => ({ requested: moduleIds.length, actorUserId, refreshedGroups: [], restricted: [], audited: moduleIds.length }),
}));

vi.mock('../db', () => ({
  getDb: async () => ({
    select: () => ({ from: async () => [] }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        mocks.inserts.push({ table, values });
        return { onDuplicateKeyUpdate: async () => undefined };
      },
    }),
  }),
}));

vi.mock('../adminDataModuleProfiles', () => ({
  listAdminDataModuleProfiles: profileMocks.list,
  updateAdminDataModuleProfiles: profileMocks.update,
}));

vi.mock('../adminDataModuleManagement', () => ({
  getAdminDataModuleDashboard: managementMocks.dashboard,
  listAdminDataModuleSystemSettings: managementMocks.listSystemSettings,
  updateAdminDataModuleSystemSetting: managementMocks.updateSystemSetting,
  listAdminDataModuleDirectory: managementMocks.directory,
  getAdminDataModuleDetail: managementMocks.detail,
  exportAdminDataModuleConfiguration: managementMocks.exportConfiguration,
  importAdminDataModuleConfiguration: managementMocks.importConfiguration,
  archiveAdminDataModules: managementMocks.archive,
  bulkUpdateAdminDataModules: managementMocks.bulkUpdate,
}));

describe('adminDataModulesRouter', () => {
  beforeEach(() => { mocks.inserts.length = 0; yfinanceMocks.refresh.mockClear(); yfinanceMocks.status.mockClear(); });

  it('reports yfinance as available only from a successful provider probe and exposes the canonical contract', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.yfinanceProviderStatus()).resolves.toMatchObject({
      providerId: 'yfinance-community', available: true, dataContractId: 'market.ohlcv.daily.v1', persistedObservationCount: 1,
    });
    await expect(caller.probeYfinanceProvider({ symbol: 'spy' })).resolves.toMatchObject({
      probe: { symbol: 'SPY', live: true, available: true, observationCount: 1, servedFromPersistentArchive: false },
    });
    expect(yfinanceMocks.refresh).toHaveBeenCalledWith('SPY', '5d', '1d', 'US');
  });

  it('将实际前端路径和新闻子页签解析为具体定向模块', async () => {
    const { resolveAdminDataModulesForPath } = await import('./adminDataModules');
    expect(resolveAdminDataModulesForPath('/menu-item/NI').map((module) => module.id)).toContain('news-ni');
    expect(resolveAdminDataModulesForPath('/news-hub?tab=ni').map((module) => module.id)).toEqual(['news-ni']);
    expect(resolveAdminDataModulesForPath('/curve-detail/US10Y').map((module) => module.id)).toContain('curve-detail');
  });

  it('将主权债 24 个原功能路径严格解析到各自独立内容槽', async () => {
    const { resolveAdminDataModulesForPath } = await import('./adminDataModules');
    for (let index = 1; index <= 24; index += 1) {
      const expectedPrefix = `sov-${String(index).padStart(2, '0')}-`;
      const matches = resolveAdminDataModulesForPath(`/terminal?open=${index}&module=sovereign-bonds`)
        .filter((module) => module.id.startsWith('sov-'));
      expect(matches).toHaveLength(1);
      expect(matches[0].id.startsWith(expectedPrefix)).toBe(true);
    }
  });

  it('智能内容分类只推荐注册表中真实存在的具体模块', async () => {
    const { recommendAdminDataModuleIdsForType } = await import('@shared/adminDataModules');
    const knownIds = new Set(ADMIN_DATA_MODULES.map((module) => module.id));
    const categories = ['监管新闻', '央行与宏观', '主权债拍卖', '信用评级与 CDS', '全球股票清单', '量化工具论文', '期权与互换', '资金持仓'];
    const recommended = categories.flatMap(recommendAdminDataModuleIdsForType);
    expect(recommended.length).toBeGreaterThan(20);
    expect(recommended.every((id) => knownIds.has(id))).toBe(true);
    expect(recommended).not.toEqual(expect.arrayContaining(['top-news', 'news-research', 'economic-analysis']));
  });

  it('返回全量前端数据模块映射并以后台托管状态为默认值', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    const modules = await caller.list();
    expect(modules).toHaveLength(ADMIN_DATA_MODULES.length);
    expect(modules.find((module) => module.id === 'market')).toMatchObject({ path: '/market', status: 'managed' });
    expect(modules.find((module) => module.id === 'news-top')).toMatchObject({ path: '/menu-item/TOP', managementCapability: '来源与审核后台' });
  });

  it('仅向管理员返回基于持久任务、内容、推送、缓存与锁记录的后台仪表盘统计', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.dashboard()).resolves.toMatchObject({ modules: { total: 139 }, queue: { activeRuns: 0 } });
    expect(managementMocks.dashboard).toHaveBeenCalledWith(7);
  });

  it('仅允许管理员查看和更新受限的后台系统设置键', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.listSystemSettings()).resolves.toEqual([{ settingKey: 'queue.execution', category: 'task_queue' }]);
    await expect(caller.updateSystemSetting({ settingKey: 'queue.execution', value: { maxConcurrentItems: 8 } })).resolves.toMatchObject({ updated: true });
    expect(managementMocks.updateSystemSetting).toHaveBeenCalledWith(7, { settingKey: 'queue.execution', value: { maxConcurrentItems: 8 } });
  });

  it('仅对已知模块写入后台设置与审计事件，不携带或修改前端数据字段', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.update({ moduleIds: ['market', 'news-top'], status: 'attention', adminNote: '核对公开来源' })).resolves.toMatchObject({ changed: 2, status: 'attention' });
    expect(mocks.inserts).toHaveLength(2);
    expect(mocks.inserts[0].values).toEqual(expect.arrayContaining([expect.objectContaining({ moduleId: 'market', status: 'attention', adminNote: '核对公开来源', updatedByUserId: 7 })]));
    const writtenRows = JSON.stringify(mocks.inserts.map((entry) => entry.values));
    expect(writtenRows).not.toContain('price');
    expect(writtenRows).not.toContain('sourceHeadline');
  });

  it('拒绝未知前端模块 ID，防止后台目录操作越界', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.update({ moduleIds: ['not-a-module'], status: 'managed' })).rejects.toThrow('ADMIN_DATA_MODULE_ID_INVALID');
    expect(mocks.inserts).toHaveLength(0);
  });

  it('仅允许管理员按已知模块 ID 调用既有真实来源刷新控制', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.refreshSources({ moduleIds: ['market'] })).resolves.toMatchObject({ requested: 1, actorUserId: 7 });
    await expect(caller.refreshSources({ moduleIds: ['not-a-module'] })).rejects.toThrow('ADMIN_DATA_MODULE_ID_INVALID');
  });

  it('仅以模块标识写入后台真实/模拟运行控制及审计，不携带前端内容字段', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.updateRuntimeControls({ moduleIds: ['swpm'], dataMode: 'simulated', isEnabled: true, adminDetail: '仅后台模拟状态' })).resolves.toMatchObject({ changed: 1, dataMode: 'simulated' });
    expect(mocks.inserts).toHaveLength(2);
    expect(JSON.stringify(mocks.inserts.map((entry) => entry.values))).not.toContain('sourceHeadline');
    expect(JSON.stringify(mocks.inserts.map((entry) => entry.values))).not.toContain('frontEndContent');
  });

  it('返回全量模块的后台配置台账，并只允许已知模块批量更新自动化与推送规则', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.listProfiles()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ moduleId: 'market', targetContract: 'market_snapshot', targetCollection: 'market_data' }),
    ]));
    await expect(caller.updateProfiles({
      moduleIds: ['market', 'news-top'], sourceKind: 'real', sourceReference: '已许可来源', theme: '独立主题', keywords: ['市场'], tags: ['快照'], contentLimit: 10, updateFrequencyMinutes: 30, sortWeight: 80, automationEnabled: true, taskTemplate: 'market-snapshot-sync', executionPriority: 10, reviewPolicy: 'manual', pushPolicy: 'after_approval', retryLimit: 3, runtimeStatus: 'enabled',
    })).resolves.toMatchObject({ changed: 2, moduleIds: ['market', 'news-top'] });
    expect(profileMocks.update).toHaveBeenCalledWith(7, expect.objectContaining({ moduleIds: ['market', 'news-top'], sourceKind: 'real' }));
    await expect(caller.updateProfiles({
      moduleIds: ['unknown'], sourceKind: 'none', keywords: [], tags: [], contentLimit: 1, updateFrequencyMinutes: 60, sortWeight: 0, automationEnabled: false, taskTemplate: 'manual-module-control', executionPriority: 0, reviewPolicy: 'disabled', pushPolicy: 'disabled', retryLimit: 0, runtimeStatus: 'paused',
    })).rejects.toThrow('ADMIN_DATA_MODULE_ID_INVALID');
  });

  it('bulkUpdate procedure 拒绝未知模块 ID 且不调用服务或写入数据库', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.bulkUpdate({ moduleIds: ['not-a-module'], isEnabled: false })).rejects.toThrow();
    expect(managementMocks.bulkUpdate).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0);
  });

  it('支持后台分页筛选、详情、配置导入导出和逻辑归档，且不改变前端模块注册表', async () => {
    const { adminDataModulesRouter } = await import('./adminDataModules');
    const caller = adminDataModulesRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.listPage({ query: '市场', deliveryGroup: 'market_snapshot', page: 1, pageSize: 20 })).resolves.toMatchObject({ total: 1 });
    await expect(caller.getDetail({ moduleId: 'market' })).resolves.toMatchObject({ module: { id: 'market' } });
    await expect(caller.exportConfiguration({ moduleIds: ['market'] })).resolves.toMatchObject({ version: 1, moduleIds: ['market'] });
    await expect(caller.importConfiguration({ version: 1, settings: [{ moduleId: 'market', status: 'attention', adminNote: '核验' }] })).resolves.toMatchObject({ settingsImported: 1 });
    await expect(caller.archive({ moduleIds: ['market'], adminNote: '逻辑归档' })).resolves.toMatchObject({ archived: 1 });
    expect(managementMocks.directory).toHaveBeenCalledWith(7, expect.objectContaining({ query: '市场', deliveryGroup: 'market_snapshot' }));
    expect(managementMocks.archive).toHaveBeenCalledWith(7, ['market'], '逻辑归档');
    expect(ADMIN_DATA_MODULES.find((module) => module.id === 'market')).toMatchObject({ path: '/market' });
  });
});
