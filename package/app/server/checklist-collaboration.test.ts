import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createChecklistVersionExportSignature } from './db';
import { compareChecklistSnapshotContent } from './routers/checklistCollaboration';

const schemaSource = readFileSync(resolve(import.meta.dirname, '../drizzle/schema.ts'), 'utf8');
const routerSource = readFileSync(resolve(import.meta.dirname, './routers/checklistCollaboration.ts'), 'utf8');
const comparisonSource = readFileSync(resolve(import.meta.dirname, './routers/sovereignComparison.ts'), 'utf8');
const checklistSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/SovereignResearchChecklist.tsx'), 'utf8');
const versionComparisonSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/ChecklistVersionComparisonPanel.tsx'), 'utf8');
const crossCountryComparisonSource = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/CrossCountrySovereignComparison.tsx'), 'utf8');
const dbSource = readFileSync(resolve(import.meta.dirname, './db.ts'), 'utf8');
const serverEntrySource = readFileSync(resolve(import.meta.dirname, './_core/index.ts'), 'utf8');
const adminRouterSource = readFileSync(resolve(import.meta.dirname, './routers/admin.ts'), 'utf8');
const verificationPageSource = readFileSync(resolve(import.meta.dirname, '../client/src/pages/ExportSignatureVerification.tsx'), 'utf8');
const exportRegistrySource = readFileSync(resolve(import.meta.dirname, '../client/src/pages/admin/AdminExportRegistry.tsx'), 'utf8');
const notificationCenterSource = readFileSync(resolve(import.meta.dirname, '../client/src/pages/NotificationCenter.tsx'), 'utf8');
const notificationRouterSource = readFileSync(resolve(import.meta.dirname, './routers/notification.ts'), 'utf8');

describe('团队研究清单协作与跨国比较', () => {
  it('比较版本时同时识别完成状态、核验项文本与备注变化', () => {
    const result = compareChecklistSnapshotContent(
      { items: ['核验发行文件', '记录数据时点'], completedItems: [0], note: '初稿' },
      { items: ['核验发行文件', '记录数据发布日期'], completedItems: [0, 1], note: '复核完成' },
    );
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ index: 1, leftCompleted: false, rightCompleted: true, leftItem: '记录数据时点', rightItem: '记录数据发布日期', kind: 'text_and_completion_changed' });
    expect(result.noteChanged).toBe(true);
  });

  it('将新增、移除和完成状态变化分类，供界面按差异性质高亮', () => {
    const result = compareChecklistSnapshotContent(
      { items: ['保留项', '待移除项'], completedItems: [], note: '' },
      { items: ['保留项', '新增项', '额外新增项'], completedItems: [0], note: '' },
    );
    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ index: 0, kind: 'completion_changed' }),
      expect.objectContaining({ index: 1, kind: 'text_changed' }),
      expect.objectContaining({ index: 2, kind: 'added' }),
    ]));
  });

  it('忽略不合法的完成项索引，避免历史记录污染版本比较', () => {
    const result = compareChecklistSnapshotContent(
      { items: ['第一项'], completedItems: ['0', -1, 1.5], note: null },
      { items: ['第一项'], completedItems: [0], note: null },
    );
    expect(result.changes).toEqual([expect.objectContaining({ index: 0, leftCompleted: false, rightCompleted: true })]);
  });

  it('以账户归属保存模板、指定共享和不可变版本快照，并保留快照清单文本', () => {
    expect(schemaSource).toContain('checklist_templates');
    expect(schemaSource).toContain('checklist_shares');
    expect(schemaSource).toContain('checklist_snapshots');
    expect(schemaSource).toContain('checklist_template_audit_events');
    expect(schemaSource).toContain('archivedAt: timestamp("archived_at")');
    expect(schemaSource).toContain('retentionDays: int("retention_days")');
    expect(schemaSource).toContain('archiveReviewStatus: mysqlEnum("archive_review_status"');
    expect(schemaSource).toContain('items: json("items").notNull()');
    expect(schemaSource).toContain('canEdit: boolean("can_edit")');
    expect(schemaSource).toContain('version: int("version").notNull()');
  });

  it('所有协作读写入口均使用受保护路由，并对查看、编辑和模板创建者共享做独立限制', () => {
    expect(routerSource).toContain('listTemplates: protectedProcedure');
    expect(routerSource).toContain('saveTemplate: protectedProcedure');
    expect(routerSource).toContain('shareTemplate: protectedProcedure');
    expect(routerSource).toContain('revokeShare: protectedProcedure');
    expect(routerSource).toContain('setTemplateArchive: protectedProcedure');
    expect(routerSource).toContain('memberDirectory: protectedProcedure');
    expect(routerSource).toContain('setArchiveRetention: protectedProcedure');
    expect(routerSource).toContain('archiveReviewQueue: adminProcedure');
    expect(routerSource).toContain('reviewArchiveTemplate: adminProcedure');
    expect(routerSource).toContain('batchReviewArchiveTemplates: adminProcedure');
    expect(routerSource).toContain('listTemplateReviewSignatures: protectedProcedure');
    expect(routerSource).toContain('saveSnapshot: protectedProcedure');
    expect(routerSource).toContain("requireTemplateAccess(permission, 'edit')");
    expect(routerSource).toContain("requireTemplateAccess(permission, 'view')");
    expect(routerSource).toContain('仅模板创建者可管理共享授权');
    expect(checklistSource).toContain('canChangeVisibility');
    expect(checklistSource).toContain('撤销共享');
    expect(checklistSource).toContain('显示我的归档模板');
    expect(checklistSource).toContain('成员目录与账户共享');
    expect(checklistSource).toContain('ChecklistGovernancePanel');
  });

  it('跨国比较使用国家别名读取已有真实曲线快照，未授权市场数据不被表述为可执行报价', () => {
    expect(comparisonSource).toContain("US: ['US', '美国']");
    expect(comparisonSource).toContain("preferredCurveByCountry");
    expect(comparisonSource).toContain('getCurveLatestSnapshot');
    expect(comparisonSource).toContain('本次未配置免费、可追溯的主权 CDS 原始报价源');
    expect(comparisonSource).toContain('不将任何字段表示为跨国可执行收益率、套保成本或投资建议');
  });

  it('前端保留未登录本地模式，并提供登录后模板、账户共享和版本比较入口', () => {
    expect(checklistSource).toContain('localStorage.setItem');
    expect(checklistSource).toContain('未登录：清单和备注仅保存在当前浏览器');
    expect(checklistSource).toContain('saveTemplate');
    expect(checklistSource).toContain('shareTemplate');
    expect(checklistSource).toContain('saveSnapshot');
    expect(checklistSource).toContain('ChecklistVersionComparisonPanel');
    expect(routerSource).toContain('compareSnapshots: protectedProcedure');
  });

  it('版本导出附带稳定研究编号、内部水印和实际管理员审阅签名字段', () => {
    expect(versionComparisonSource).toContain('SR-${moduleId.toUpperCase()}');
    expect(versionComparisonSource).toContain('内部研究记录');
    expect(versionComparisonSource).toContain('listTemplateReviewSignatures');
    expect(versionComparisonSource).toContain('审阅签名');
    expect(versionComparisonSource).toContain("['研究编号', '水印', '签名校验码', '审阅签名'");
    expect(routerSource).toContain('prepareVersionExport: protectedProcedure');
    expect(routerSource).toContain('registerVersionExport: protectedProcedure');
    expect(routerSource).toContain('EXPORT_SIGNATURE_INVALID');
  });

  it('为相同导出上下文生成稳定校验码，并将格式变化纳入签名载荷', () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'checklist-test-signing-secret';
    const base = { userId: 8, templateId: 12, moduleId: 'YAS', leftSnapshotId: 41, rightSnapshotId: 42, issuedAt: '2026-08-18T01:00:00.000Z' };
    const csv = createChecklistVersionExportSignature({ ...base, exportFormat: 'csv' });
    const sameCsv = createChecklistVersionExportSignature({ ...base, exportFormat: 'csv' });
    const pdf = createChecklistVersionExportSignature({ ...base, exportFormat: 'pdf' });
    expect(csv.researchId).toBe('SR-YAS-T12-S41-S42');
    expect(csv.verificationCode).toMatch(/^CHK-[A-F0-9]{32}$/);
    expect(csv.verificationCode).toBe(sameCsv.verificationCode);
    expect(csv.verificationCode).not.toBe(pdf.verificationCode);
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });

  it('将跨国国家组合保存为账户预设，并以创建者权限管理团队只读共享', () => {
    expect(schemaSource).toContain('sovereign_comparison_presets');
    expect(schemaSource).toContain('sovereign_comparison_preset_shares');
    expect(schemaSource).toContain('countries: json("countries").notNull()');
    expect(routerSource).toContain('listComparisonPresets: protectedProcedure');
    expect(routerSource).toContain('saveComparisonPreset: protectedProcedure');
    expect(routerSource).toContain('shareComparisonPreset: protectedProcedure');
    expect(routerSource).toContain('revokeComparisonPresetShare: protectedProcedure');
    expect(routerSource).toContain('仅预设创建者可以管理团队共享');
    expect(crossCountryComparisonSource).toContain('收藏当前选择');
    expect(crossCountryComparisonSource).toContain('共享');
    expect(crossCountryComparisonSource).toContain('revokeComparisonPresetShare');
    expect(crossCountryComparisonSource).toContain('尚无已保存或团队共享预设');
  });

  it('为即将到期的签名和待审归档提供二十四小时、按账户去重的计划任务提醒', () => {
    expect(schemaSource).toContain('checklist_deadline_notification_events');
    expect(schemaSource).toContain('verificationExpiresAt: timestamp("verification_expires_at")');
    expect(dbSource).toContain('new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)');
    expect(dbSource).toContain('findExpiringChecklistExportRecords(windowHours = 24');
    expect(dbSource).toContain('findDueChecklistArchiveReviews(windowHours = 24');
    expect(dbSource).toContain('recordChecklistDeadlineNotification');
    expect(dbSource).toContain('processChecklistDeadlineNotifications(windowHours = 24');
    expect(dbSource).toContain('signature:${record.id}:${record.userId}');
    expect(dbSource).toContain('archive-review:${review.id}:${admin.id}');
    expect(serverEntrySource).toContain('app.post("/api/scheduled/checklistDeadlineNotify"');
    expect(serverEntrySource).toContain('if (!user.isCron)');
  });

  it('允许管理员检索下载登记，并允许任何使用者在线验证研究编号和签名校验码', () => {
    expect(dbSource).toContain('adminListChecklistExportRecords');
    expect(dbSource).toContain('verifyChecklistExportSignature');
    expect(dbSource).toContain("'expired' as const");
    expect(routerSource).toContain('verifyExportSignature: publicProcedure');
    expect(adminRouterSource).toContain('listChecklistExportRecords: adminProcedure');
    expect(verificationPageSource).toContain('研究导出签名验证');
    expect(verificationPageSource).toContain('verifyExportSignature.useMutation');
    expect(exportRegistrySource).toContain('下载登记检索');
    expect(exportRegistrySource).toContain('listChecklistExportRecords.useQuery');
    expect(exportRegistrySource).toContain('verifyExportSignature.useMutation');
  });

  it('支持管理员以当前筛选导出下载登记 CSV，并以成员目录搜索方式共享国家预设', () => {
    expect(adminRouterSource).toContain('exportChecklistExportRecords: adminProcedure');
    expect(exportRegistrySource).toContain('导出 CSV');
    expect(exportRegistrySource).toContain('exportChecklistExportRecords.useMutation');
    expect(exportRegistrySource).toContain('downloadRegistryCsv');
    expect(crossCountryComparisonSource).toContain('memberDirectory.useQuery');
    expect(crossCountryComparisonSource).toContain('搜索成员');
    expect(crossCountryComparisonSource).toContain('授予只读共享');
    expect(crossCountryComparisonSource).not.toContain('成员账户编号');
  });

  it('为导出签名和归档审阅的临期通知提供账户级快捷筛选与醒目展示', () => {
    expect(notificationRouterSource).toContain("'due_soon'");
    expect(notificationRouterSource).toContain("relatedType IN ('checklist_export', 'checklist_template_archive', 'financing_calendar_event', 'mmflow_delivery_deadline')");
    expect(notificationCenterSource).toContain('即将到期');
    expect(notificationCenterSource).toContain('临期 · 签名');
    expect(notificationCenterSource).toContain('临期 · 审阅');
    expect(notificationCenterSource).toContain('dueSoonCount');
  });
});
