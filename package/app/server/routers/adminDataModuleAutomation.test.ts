import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(async (input: any) => ({ runId: 91, runKey: 'modrun_1234567890abcdef1234567890abcdef', requestedCount: input.scope === 'site' ? 9 : 1 })),
  process: vi.fn(async (runKey: string) => ({ runKey, status: 'completed', succeeded: 1, skipped: 0, durationMs: 22 })),
  cancel: vi.fn(async (runKey: string) => ({ runKey, status: 'cancelled' })),
  pause: vi.fn(async (runKey: string) => ({ runKey, status: 'paused' })),
  resume: vi.fn(async (runKey: string) => ({ runKey, status: 'queued' })),
  retryFailedItems: vi.fn(async (runKey: string) => ({ runKey, retried: 2 })),
  runs: vi.fn(async () => []),
  events: vi.fn(async () => []),
  schedule: vi.fn(async () => null),
  enableSchedule: vi.fn(async () => ({ scheduleKey: 'module-automation-queue', taskUid: 'task-test', isEnabled: true })),
  setSchedule: vi.fn(async () => ({ scheduleKey: 'module-automation-queue', taskUid: 'task-test', isEnabled: false })),
}));

vi.mock('../adminDataModuleAutomation', () => ({
  enqueueAdminDataModuleAutomation: mocks.enqueue,
  processAdminDataModuleAutomationRun: mocks.process,
  cancelAdminDataModuleAutomationRun: mocks.cancel,
  pauseAdminDataModuleAutomation: mocks.pause,
  resumeAdminDataModuleAutomation: mocks.resume,
  retryFailedAdminDataModuleAutomationItems: mocks.retryFailedItems,
  listAdminDataModuleAutomationRuns: mocks.runs,
  listAdminDataModuleDeliveryEvents: mocks.events,
  getAdminDataModuleAutomationSchedule: mocks.schedule,
  enableAdminDataModuleAutomationSchedule: mocks.enableSchedule,
  setAdminDataModuleAutomationScheduleEnabled: mocks.setSchedule,
}));

describe('adminDataModuleAutomationRouter', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockClear()));

  it('按单模块、分组和全站范围创建持久化任务，而不携带前端内容', async () => {
    const { adminDataModuleAutomationRouter } = await import('./adminDataModuleAutomation');
    const caller = adminDataModuleAutomationRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.startSingle({ moduleId: 'market', mode: 'fast_draft' })).resolves.toMatchObject({ requestedCount: 1 });
    await expect(caller.startGroup({ moduleGroup: '新闻内容', mode: 'rich_content' })).resolves.toMatchObject({ requestedCount: 1 });
    await expect(caller.startSite({ mode: 'fast_draft' })).resolves.toMatchObject({ requestedCount: 9 });
    expect(mocks.enqueue).toHaveBeenNthCalledWith(1, expect.objectContaining({ scope: 'single', moduleId: 'market', mode: 'fast_draft', actorUserId: 7 }));
    expect(mocks.enqueue).toHaveBeenNthCalledWith(2, expect.objectContaining({ scope: 'group', moduleGroup: '新闻内容', mode: 'rich_content', actorUserId: 7 }));
    expect(JSON.stringify(mocks.enqueue.mock.calls)).not.toContain('frontEndContent');
  });

  it('拒绝 startBatch 少于两个模块、未知模块和超过 160 项的输入', async () => {
    const { adminDataModuleAutomationRouter } = await import('./adminDataModuleAutomation');
    const caller = adminDataModuleAutomationRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.startBatch({ moduleIds: ['market'], mode: 'fast_draft' })).rejects.toThrow();
    await expect(caller.startBatch({ moduleIds: ['unknown-module', 'market'] as any, mode: 'fast_draft' })).rejects.toThrow();
    await expect(caller.startBatch({ moduleIds: Array.from({ length: 161 }, () => 'market') as any, mode: 'fast_draft' })).rejects.toThrow();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('通过 startBatch 将合法多选模块写入持久队列输入', async () => {
    const { adminDataModuleAutomationRouter } = await import('./adminDataModuleAutomation');
    const caller = adminDataModuleAutomationRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    await expect(caller.startBatch({ moduleIds: ['market', 'news-top'], mode: 'rich_content' })).resolves.toMatchObject({ runKey: expect.any(String) });
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ scope: 'batch', moduleIds: ['market', 'news-top'], mode: 'rich_content', actorUserId: 7 }));
  });

  it('支持管理员处理和取消已登记任务，并拒绝格式无效的任务键', async () => {
    const { adminDataModuleAutomationRouter } = await import('./adminDataModuleAutomation');
    const caller = adminDataModuleAutomationRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    const runKey = 'modrun_1234567890abcdef1234567890abcdef';
    await expect(caller.process({ runKey })).resolves.toMatchObject({ status: 'completed' });
    await expect(caller.cancel({ runKey })).resolves.toMatchObject({ status: 'cancelled' });
    await expect(caller.process({ runKey: 'not-a-run' })).rejects.toThrow();
    expect(mocks.process).toHaveBeenCalledWith(runKey, 7);
    expect(mocks.cancel).toHaveBeenCalledWith(runKey, 7);
  });

  it('将暂停、恢复和失败项重试映射到持久化后台服务', async () => {
    const { adminDataModuleAutomationRouter } = await import('./adminDataModuleAutomation');
    const caller = adminDataModuleAutomationRouter.createCaller({ user: { id: 7, role: 'admin' } } as any);
    const runKey = 'modrun_1234567890abcdef1234567890abcdef';
    await expect(caller.pause({ runKey })).resolves.toMatchObject({ status: 'paused' });
    await expect(caller.resume({ runKey })).resolves.toMatchObject({ status: 'queued' });
    await expect(caller.retryFailedItems({ runKey })).resolves.toMatchObject({ retried: 2 });
    expect(mocks.pause).toHaveBeenCalledWith(runKey, 7);
    expect(mocks.resume).toHaveBeenCalledWith(runKey, 7);
    expect(mocks.retryFailedItems).toHaveBeenCalledWith(runKey, 7);

    mocks.pause.mockClear();
    mocks.resume.mockClear();
    mocks.retryFailedItems.mockClear();
    const invalidRunKey = 'not-a-run';
    await expect(caller.pause({ runKey: invalidRunKey })).rejects.toThrow();
    await expect(caller.resume({ runKey: invalidRunKey })).rejects.toThrow();
    await expect(caller.retryFailedItems({ runKey: invalidRunKey })).rejects.toThrow();
    expect(mocks.pause).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(mocks.retryFailedItems).not.toHaveBeenCalled();
  });

  it('仅以管理员身份和六段 cron 表达式请求计划配置，不在路由层创建内存定时器', async () => {
    const { adminDataModuleAutomationRouter } = await import('./adminDataModuleAutomation');
    const caller = adminDataModuleAutomationRouter.createCaller({ user: { id: 7, role: 'admin' }, req: { headers: { cookie: '' } } } as any);
    await expect(caller.getSchedule()).resolves.toBeNull();
    await expect(caller.enableSchedule({ cron: '0 0 8 * * *' })).resolves.toMatchObject({ taskUid: 'task-test', isEnabled: true });
    await expect(caller.setScheduleEnabled({ enabled: false })).resolves.toMatchObject({ isEnabled: false });
    await expect(caller.enableSchedule({ cron: '0 8 * * *' })).rejects.toThrow();
    expect(mocks.enableSchedule).toHaveBeenCalledWith(7, '0 0 8 * * *', '');
    expect(JSON.stringify(mocks.enableSchedule.mock.calls)).not.toContain('setInterval');
  });
});
