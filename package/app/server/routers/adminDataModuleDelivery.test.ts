import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => ({ page: 1, pageSize: 40, rows: [] })),
  generate: vi.fn(async () => ({ contentKey: 'modcontent_1234567890abcdef1234567890abcdef', status: 'pending_review' })),
  approve: vi.fn(async () => ({ versionId: 9, status: 'approved' })),
  reject: vi.fn(async () => ({ status: 'rejected' })),
  deliver: vi.fn(async () => ({ status: 'delivered' })),
  retry: vi.fn(async () => ({ status: 'delivered', repeated: true })),
  rollback: vi.fn(async () => ({ status: 'reverted' })),
  stats: vi.fn(async () => ({ newCount: 1, updatedCount: 1, skippedCount: 2, duplicateCount: 1, otherSkippedCount: 1, failedCount: 1, pushedCount: 1, failureReasons: ['TIMEOUT'], skipReasons: ['DISABLED'] })),
}));

vi.mock('../adminDataModuleDelivery', () => ({
  listAdminDataModuleContent: mocks.list,
  generateAdminDataModuleContentDraft: mocks.generate,
  approveAdminDataModuleContent: mocks.approve,
  rejectAdminDataModuleContent: mocks.reject,
  deliverApprovedAdminDataModuleContent: mocks.deliver,
  retryAdminDataModuleDelivery: mocks.retry,
  rollbackAdminDataModuleDeliveryVersion: mocks.rollback,
  getAdminDataModuleDeliveryStats: mocks.stats,
}));

describe('adminDataModuleDeliveryRouter', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockClear()));

  it('将草稿、审核、推送、重试和回滚操作传递给后端持久服务，且不接受未知模块', async () => {
    const { adminDataModuleDeliveryRouter } = await import('./adminDataModuleDelivery');
    const caller = adminDataModuleDeliveryRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    const runKey = 'modrun_1234567890abcdef1234567890abcdef';
    const contentKey = 'modcontent_1234567890abcdef1234567890abcdef';
    await expect(caller.listContent({ moduleId: 'market', status: 'pending_review' })).resolves.toMatchObject({ page: 1 });
    await expect(caller.generateDraft({ moduleId: 'market', runKey, runId: 3, jobItemId: 4 })).resolves.toMatchObject({ status: 'pending_review' });
    await expect(caller.approve({ contentKey })).resolves.toMatchObject({ status: 'approved' });
    await expect(caller.approveBatch({ contentKeys: [contentKey, contentKey] })).resolves.toMatchObject({ requested: 1, succeeded: 1, failed: 0 });
    await expect(caller.reject({ contentKey, reason: '字段不完整' })).resolves.toMatchObject({ status: 'rejected' });
    await expect(caller.rejectBatch({ contentKeys: [contentKey], reason: '字段不完整' })).resolves.toMatchObject({ requested: 1, succeeded: 1 });
    await expect(caller.deliver({ contentKey })).resolves.toMatchObject({ status: 'delivered' });
    await expect(caller.deliverBatch({ contentKeys: [contentKey] })).resolves.toMatchObject({ requested: 1, succeeded: 1 });
    await expect(caller.retryDelivery({ contentKey })).resolves.toMatchObject({ repeated: true });
    await expect(caller.retryDeliveryBatch({ contentKeys: [contentKey] })).resolves.toMatchObject({ requested: 1, succeeded: 1 });
    await expect(caller.rollbackVersion({ versionId: 9 })).resolves.toMatchObject({ status: 'reverted' });
    await expect(caller.generateDraft({ moduleId: 'unknown', runKey })).rejects.toThrow();
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'market', actorUserId: 7 }));
    expect(mocks.deliver).toHaveBeenCalledWith(contentKey, 7);
  });

  it('按 moduleId/runId 查询六类交付统计并拒绝无效输入', async () => {
    const { adminDataModuleDeliveryRouter } = await import('./adminDataModuleDelivery');
    const caller = adminDataModuleDeliveryRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.deliveryStats({ moduleId: 'market', runId: 42 })).resolves.toMatchObject({
      newCount: 1,
      updatedCount: 1,
      skippedCount: 2,
      duplicateCount: 1,
      otherSkippedCount: 1,
      failedCount: 1,
      pushedCount: 1,
      failureReasons: ['TIMEOUT'],
      skipReasons: ['DISABLED'],
    });
    expect(mocks.stats).toHaveBeenCalledWith({ moduleId: 'market', runId: 42 });
    await expect(caller.deliveryStats({ moduleId: 'unknown' as never })).rejects.toThrow();
    await expect(caller.deliveryStats({ runId: 0 })).rejects.toThrow();

    const nonAdminCaller = adminDataModuleDeliveryRouter.createCaller({ user: { id: 8, role: 'user' } } as any);
    const unauthenticatedCaller = adminDataModuleDeliveryRouter.createCaller({ user: undefined } as any);
    await expect(nonAdminCaller.deliveryStats({ moduleId: 'market' })).rejects.toThrow();
    await expect(unauthenticatedCaller.deliveryStats({ moduleId: 'market' })).rejects.toThrow();
    expect(mocks.stats).toHaveBeenCalledTimes(1);
  });
});
