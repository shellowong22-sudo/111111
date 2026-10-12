import { describe, expect, it } from 'vitest';
import { and, eq, gte, inArray, like } from 'drizzle-orm';
import { adminDataModuleEvents, adminDataModuleProfiles, adminDataModuleRuntimeControls, adminDataModuleSettings } from '../drizzle/schema';
import { getDb } from './db';
import { bulkUpdateAdminDataModules, exportAdminDataModuleConfiguration, getAdminDataModuleDetail, listAdminDataModuleDirectory } from './adminDataModuleManagement';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';

describe('adminDataModuleManagement persistent integration', () => {
  it('物化全部已登记模块并按现有传输契约提供可筛选分页台账和可导出配置', async () => {
    const directory = await listAdminDataModuleDirectory(1, { deliveryGroup: 'market_snapshot', page: 1, pageSize: 50 });
    expect(directory.total).toBeGreaterThan(0);
    expect(directory.rows.every((row) => row.delivery.group === 'market_snapshot')).toBe(true);
    expect(directory.rows.every((row) => row.profile?.targetContract === 'market_snapshot' && row.profile?.targetCollection === 'market_data')).toBe(true);
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    expect(await db.select().from(adminDataModuleProfiles)).toHaveLength(338);
    expect(await db.select().from(adminDataModuleSettings)).toHaveLength(338);
    expect(await db.select().from(adminDataModuleRuntimeControls)).toHaveLength(338);

    const detail = await getAdminDataModuleDetail(1, 'news-top');
    expect(detail.module).toMatchObject({ id: 'news-top', path: '/menu-item/TOP' });
    expect(detail.profile).toMatchObject({ targetContract: 'news_review_pipeline', targetCollection: 'admin_news_ingestion_articles' });

    const exportData = await exportAdminDataModuleConfiguration(1, ['market', 'news-top']);
    expect(exportData).toMatchObject({ version: 1, moduleIds: ['market', 'news-top'] });
    expect(exportData.profiles).toHaveLength(2);
    expect(ADMIN_DATA_MODULES).toHaveLength(338);
  });

  it('批量更新拒绝未知模块 ID 且不产生数据库副作用', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const startedAt = new Date();
    await expect(bulkUpdateAdminDataModules(1, { moduleIds: ['unknown-module-for-integration'], isEnabled: false })).rejects.toThrow('ADMIN_DATA_MODULE_ID_INVALID');
    const settings = await db.select().from(adminDataModuleSettings).where(eq(adminDataModuleSettings.moduleId, 'unknown-module-for-integration'));
    const controls = await db.select().from(adminDataModuleRuntimeControls).where(eq(adminDataModuleRuntimeControls.moduleId, 'unknown-module-for-integration'));
    const events = await db.select().from(adminDataModuleEvents).where(and(eq(adminDataModuleEvents.moduleId, 'unknown-module-for-integration'), gte(adminDataModuleEvents.createdAt, startedAt)));
    expect(settings).toHaveLength(0);
    expect(controls).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('批量更新已知模块并写入逐模块审计事件，结束后恢复原始配置', async () => {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const moduleIds = ['market', 'news-top'];
    const marker = `BULK_UPDATE_INTEGRATION_${Date.now()}`;
    const startedAt = new Date();
    const beforeSettings = await db.select().from(adminDataModuleSettings).where(like(adminDataModuleSettings.moduleId, 'market'));
    const beforeControls = await db.select().from(adminDataModuleRuntimeControls).where(like(adminDataModuleRuntimeControls.moduleId, 'market'));
    const beforeNewsSettings = await db.select().from(adminDataModuleSettings).where(eq(adminDataModuleSettings.moduleId, 'news-top'));
    const beforeNewsControls = await db.select().from(adminDataModuleRuntimeControls).where(eq(adminDataModuleRuntimeControls.moduleId, 'news-top'));
    try {
      const result = await bulkUpdateAdminDataModules(1, { moduleIds, status: 'attention', dataMode: 'simulated', isEnabled: false, adminNote: marker, adminDetail: marker });
      expect(result).toEqual({ moduleIds, updated: 2 });
      const settings = await db.select().from(adminDataModuleSettings).where(like(adminDataModuleSettings.adminNote, marker));
      const controls = await db.select().from(adminDataModuleRuntimeControls).where(like(adminDataModuleRuntimeControls.adminDetail, marker));
      const events = await db.select().from(adminDataModuleEvents).where(and(inArray(adminDataModuleEvents.moduleId, moduleIds), eq(adminDataModuleEvents.action, 'managed'), gte(adminDataModuleEvents.createdAt, startedAt)));
      expect(settings.map((row) => row.moduleId).sort()).toEqual(moduleIds.slice().sort());
      expect(controls.map((row) => row.moduleId).sort()).toEqual(moduleIds.slice().sort());
      expect(events.map((row) => row.moduleId).sort()).toEqual(moduleIds.slice().sort());
    } finally {
      const marketSetting = beforeSettings[0];
      const marketControl = beforeControls[0];
      const newsSetting = beforeNewsSettings[0];
      const newsControl = beforeNewsControls[0];
      if (marketSetting) await db.update(adminDataModuleSettings).set({ status: marketSetting.status, adminNote: marketSetting.adminNote, updatedByUserId: marketSetting.updatedByUserId, updatedAt: new Date() }).where(eq(adminDataModuleSettings.moduleId, 'market'));
      if (marketControl) await db.update(adminDataModuleRuntimeControls).set({ dataMode: marketControl.dataMode, isEnabled: marketControl.isEnabled, adminDetail: marketControl.adminDetail, updatedByUserId: marketControl.updatedByUserId, updatedAt: new Date() }).where(eq(adminDataModuleRuntimeControls.moduleId, 'market'));
      if (newsSetting) await db.update(adminDataModuleSettings).set({ status: newsSetting.status, adminNote: newsSetting.adminNote, updatedByUserId: newsSetting.updatedByUserId, updatedAt: new Date() }).where(eq(adminDataModuleSettings.moduleId, 'news-top'));
      if (newsControl) await db.update(adminDataModuleRuntimeControls).set({ dataMode: newsControl.dataMode, isEnabled: newsControl.isEnabled, adminDetail: newsControl.adminDetail, updatedByUserId: newsControl.updatedByUserId, updatedAt: new Date() }).where(eq(adminDataModuleRuntimeControls.moduleId, 'news-top'));
      await db.delete(adminDataModuleEvents).where(and(inArray(adminDataModuleEvents.moduleId, moduleIds), eq(adminDataModuleEvents.action, 'managed'), gte(adminDataModuleEvents.createdAt, startedAt)));
    }
  });
});
