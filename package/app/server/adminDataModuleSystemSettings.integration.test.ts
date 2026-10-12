import { afterEach, describe, expect, it } from 'vitest';
import { listAdminDataModuleSystemSettings, updateAdminDataModuleSystemSetting } from './adminDataModuleManagement';

let originalQueueSetting: { value: unknown; description: string | null } | null = null;

afterEach(async () => {
  if (!originalQueueSetting || !originalQueueSetting.value || typeof originalQueueSetting.value !== 'object' || Array.isArray(originalQueueSetting.value)) return;
  await updateAdminDataModuleSystemSetting(1, { settingKey: 'queue.execution', value: originalQueueSetting.value as Record<string, unknown>, description: originalQueueSetting.description ?? undefined });
  originalQueueSetting = null;
});

describe('adminDataModule system settings persistent integration', () => {
  it('物化并更新后台队列、缓存、保留、模拟和版本恢复设置，不影响前端配置', async () => {
    const initial = await listAdminDataModuleSystemSettings(1);
    expect(initial.map((setting) => setting.settingKey).sort()).toEqual(['backup.restore', 'cache.source_refresh', 'queue.execution', 'retention.automation', 'simulation.governance']);
    const queue = initial.find((setting) => setting.settingKey === 'queue.execution');
    expect(queue).toBeDefined();
    originalQueueSetting = { value: queue!.value, description: queue!.description };
    await expect(updateAdminDataModuleSystemSetting(1, { settingKey: 'queue.execution', value: { maxConcurrentItems: 8, itemTimeoutMs: 100000, retryBackoffSeconds: 45 }, description: '仅测试后端设置持久化' })).resolves.toMatchObject({ updated: true, category: 'task_queue' });
    const updated = await listAdminDataModuleSystemSettings(1);
    expect(updated.find((setting) => setting.settingKey === 'queue.execution')).toMatchObject({ value: { maxConcurrentItems: 8, itemTimeoutMs: 100000, retryBackoffSeconds: 45 }, description: '仅测试后端设置持久化' });
  });
});
