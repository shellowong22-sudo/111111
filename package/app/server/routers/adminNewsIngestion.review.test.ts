import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as any[], updates: [] as any[], audits: [] as any[], runGeneration: vi.fn(async () => ({ generated: 0 })) }));

vi.mock('../db', () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: () => { const chain: any = { limit: async () => mocks.rows }; chain.then = (resolve: (value: any[]) => unknown) => Promise.resolve(mocks.rows).then(resolve); return chain; } }) }),
    update: () => ({ set: (values: unknown) => ({ where: async () => { mocks.updates.push(values); } }) }),
  }),
}));
vi.mock('../adminNewsIngestion', () => ({
  auditAdminNewsIngestion: async (input: unknown) => { mocks.audits.push(input); },
  discoverAdminNewsFeedUrl: async () => 'https://example.test/feed.xml',
  listAdminNewsAnalytics: async () => ({}),
  listPublishedAdminNews: async () => [],
  syncAdminNewsSource: async () => ({}),
  validateAdminNewsRssEndpoint: () => ({ valid: true }),
}));
vi.mock('../adminAiManagement', () => ({ AI_GENERATION_TYPES: ['news', 'report', 'course'], listAdminAiGenerationTasks: async () => [], listAdminAiModelStatus: async () => [], runAdminAiGeneration: (...args: unknown[]) => mocks.runGeneration(...args as any) }));
vi.mock('../adminAiGenerationCatalog', () => ({ listAdminAiGenerationCatalogEvents: async () => [], listAdminAiGenerationCatalogSettings: async () => [], updateAdminAiGenerationCatalogSettings: async () => ({}) }));
vi.mock('../notification', () => ({ createNotificationForAllUsers: async () => ({ recipientCount: 0 }) }));
vi.mock('../_core/heartbeat', () => ({ createHeartbeatJob: async () => ({ taskUid: 'task' }), updateHeartbeatJob: async () => ({}) }));

describe('adminNewsIngestionRouter 批量审核与导出边界', () => {
  beforeEach(() => { mocks.rows = []; mocks.updates = []; mocks.audits = []; mocks.runGeneration.mockReset(); mocks.runGeneration.mockResolvedValue({ generated: 0 }); });

  it('批量审核只更新 draft 文章，跳过已批准记录并逐篇留下审计', async () => {
    mocks.rows = [{ id: 11, status: 'draft' }, { id: 12, status: 'approved' }];
    const { adminNewsIngestionRouter } = await import('./adminNewsIngestion');
    const caller = adminNewsIngestionRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.batchReview({ ids: [11, 12], decision: 'approved' })).resolves.toEqual({ decision: 'approved', reviewed: 1, skipped: 1 });
    expect(mocks.updates).toEqual([expect.objectContaining({ status: 'approved', reviewedByUserId: 7 })]);
    expect(mocks.audits).toEqual([expect.objectContaining({ articleId: 11, actorUserId: 7, action: 'approved' })]);
  });

  it('批量发布只更新 approved 文章，跳过草稿并逐篇留下 published 审计', async () => {
    mocks.rows = [{ id: 21, status: 'approved' }, { id: 22, status: 'draft' }];
    const { adminNewsIngestionRouter } = await import('./adminNewsIngestion');
    const caller = adminNewsIngestionRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.batchPublish({ ids: [21, 22] })).resolves.toEqual({ published: 1, skipped: 1 });
    expect(mocks.updates).toEqual([expect.objectContaining({ status: 'published', publishedByUserId: 7 })]);
    expect(mocks.audits).toEqual([expect.objectContaining({ articleId: 21, actorUserId: 7, action: 'published' })]);
  });

  it('只为 approved 文章准备导出载荷并记录 exported 审计', async () => {
    mocks.rows = [{ id: 31, status: 'approved', aiTitle: '已批准文章', aiSummary: '已保存的审核摘要', sourceHeadline: '来源标题', sourceUrl: 'https://source.example.test/article', sourcePublishedAt: null, category: '市场', sentiment: 'neutral', tickers: null, aiModel: 'gpt-5-mini', aiGeneratedAt: null, reviewedAt: null, aiGenerationCatalogCode: 'TOP' }];
    const { adminNewsIngestionRouter } = await import('./adminNewsIngestion');
    const caller = adminNewsIngestionRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.prepareApprovedExport({ id: 31, format: 'pdf' })).resolves.toMatchObject({ id: 31, aiTitle: '已批准文章' });
    expect(mocks.audits).toEqual([expect.objectContaining({ articleId: 31, actorUserId: 7, action: 'exported' })]);
    expect(mocks.updates).toEqual([]);
  });

  it('拒绝未批准草稿的导出请求，且不记录导出审计', async () => {
    mocks.rows = [{ id: 32, status: 'draft' }];
    const { adminNewsIngestionRouter } = await import('./adminNewsIngestion');
    const caller = adminNewsIngestionRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.prepareApprovedExport({ id: 32, format: 'doc' })).rejects.toThrow('NEWS_EXPORT_REQUIRES_APPROVAL');
    expect(mocks.audits).toEqual([]);
  });

  it('通过管理员 caller 传播受控模型错误，不吞掉 runGeneration 失败原因', async () => {
    mocks.runGeneration.mockRejectedValueOnce(new Error('LLM_REQUEST_TIMEOUT'));
    const { adminNewsIngestionRouter } = await import('./adminNewsIngestion');
    const caller = adminNewsIngestionRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.runGeneration({ generationType: 'news', count: 1, catalogCode: 'TOP' })).rejects.toThrow('LLM_REQUEST_TIMEOUT');
    expect(mocks.runGeneration).toHaveBeenCalledWith({ generationType: 'news', count: 1, catalogCode: 'TOP', actorUserId: 7 });
  });
});
