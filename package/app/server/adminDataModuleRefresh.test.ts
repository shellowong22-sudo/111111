import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inserts: [] as unknown[],
  marketTargets: [{ id: 11, symbol: 'SPY', isActive: true, historyRange: '1mo' }] as any[],
  newsSources: [{ id: 21, name: '许可 RSS', isActive: true, maxItemsPerRun: 10 }] as any[],
  syncMarket: vi.fn(),
  syncNews: vi.fn(),
}));

vi.mock('./db', () => ({
  getDb: async () => ({
    select: () => ({ from: (table: any) => ({ where: () => table?.[Symbol.for('drizzle:Name')] === 'admin_data_module_runtime_controls' ? [] : ({ limit: async () => table?.[Symbol.for('drizzle:Name')] === 'admin_market_ingestion_targets' ? mocks.marketTargets : mocks.newsSources }) }) }),
    insert: () => ({ values: async (values: unknown) => { mocks.inserts.push(values); } }),
  }),
}));
vi.mock('./adminMarketIngestion', () => ({ syncAdminMarketTarget: (...args: unknown[]) => mocks.syncMarket(...args) }));
vi.mock('./adminNewsIngestion', () => ({ syncAdminNewsSource: (...args: unknown[]) => mocks.syncNews(...args) }));
vi.mock('./adminDataModuleQueue', () => ({
  getAdminDataModuleSystemSettingValue: async () => ({ ttlSeconds: 60 }),
  withAdminDataModuleRequestCache: async <T>(input: { operation: () => Promise<T> }) => ({ cache: 'miss', value: await input.operation() }),
}));

describe('refreshAdminDataModuleSources', () => {
  beforeEach(() => {
    mocks.inserts.length = 0;
    mocks.marketTargets = [{ id: 11, symbol: 'SPY', isActive: true, historyRange: '1mo' }];
    mocks.newsSources = [{ id: 21, name: '许可 RSS', isActive: true, maxItemsPerRun: 10 }];
    mocks.syncMarket.mockReset().mockResolvedValue({ status: 'available', symbol: 'SPY' });
    mocks.syncNews.mockReset().mockResolvedValue({ status: 'available', sourceId: 21 });
  });

  it('仅刷新选中模块已有的市场与许可新闻来源，并对不支持模块只写入受限审计', async () => {
    const { refreshAdminDataModuleSources } = await import('./adminDataModuleRefresh');
    const result = await refreshAdminDataModuleSources(['market', 'news-top', 'swpm'], 7);
    expect(mocks.syncMarket).toHaveBeenCalledWith(11, 7);
    expect(mocks.syncNews).toHaveBeenCalledWith(21, 7, 10);
    expect(result).toMatchObject({ requested: 3, audited: 3, restricted: ['swpm'] });
    const serialized = JSON.stringify(mocks.inserts);
    expect(serialized).toContain('market_ingestion');
    expect(serialized).toContain('news_ingestion');
    expect(serialized).toContain('restricted');
    expect(serialized).not.toContain('Math.random');
    expect(serialized).not.toContain('price');
  });

  it('没有启用配置时准确记录未配置状态且不发起外部来源刷新', async () => {
    mocks.marketTargets = [];
    const { refreshAdminDataModuleSources } = await import('./adminDataModuleRefresh');
    const result = await refreshAdminDataModuleSources(['market'], 7);
    expect(mocks.syncMarket).not.toHaveBeenCalled();
    expect(result.refreshedGroups).toEqual([expect.objectContaining({ group: 'market_ingestion', status: 'not_configured' })]);
  });
});
