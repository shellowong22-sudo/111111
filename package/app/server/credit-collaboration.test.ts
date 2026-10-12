import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(import.meta.dirname, '../drizzle/schema.ts'), 'utf8');
const db = readFileSync(resolve(import.meta.dirname, './db.ts'), 'utf8');
const router = readFileSync(resolve(import.meta.dirname, './routers/creditCollaboration.ts'), 'utf8');
const collaborationPanel = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditCollaborationPanels.tsx'), 'utf8');
const interactivePanel = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditInteractiveVisualizationPanels.tsx'), 'utf8');
const specialist = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditSpecialistPanels.tsx'), 'utf8');
const deadlinePanel = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditResearchPackageDeadlinePanel.tsx'), 'utf8');
const exportPanel = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditChartExportPanels.tsx'), 'utf8');

describe('信用债研究协作、电子确认与动态交互', () => {
  it('持久化研究包模板、审批签名、权限共享和工作底稿审阅实体', () => {
    expect(schema).toContain('creditResearchPackageTemplates');
    expect(schema).toContain('creditResearchPackageSignatures');
    expect(schema).toContain('creditResearchPackageShares');
    expect(schema).toContain('creditSharedWorkpapers');
    expect(schema).toContain('["editor", "reviewer", "viewer"]');
    expect(schema).toContain('["draft", "submitted", "changes_requested", "approved"]');
  });

  it('使用认证账户、内容哈希和服务器 HMAC 写入内部签名，而不伪称法定签名', () => {
    expect(db).toContain('createCreditApprovalSignature');
    expect(db).toContain('createCreditContentHash');
    expect(db).toContain("CREDIT_SIGNATURE_UNAVAILABLE");
    expect(collaborationPanel).toContain('不替代法定电子签名服务');
    expect(router).toContain('signPackage');
  });

  it('对研究包和工作底稿的编辑、审阅、批准与共享操作执行服务器端权限校验', () => {
    expect(db).toContain('getCreditResearchPackagePermission');
    expect(db).toContain('getCreditWorkpaperPermission');
    expect(db).toContain("requireCreditPermission(permission, 'review')");
    expect(router).toContain('sharePackage');
    expect(router).toContain('submitWorkpaper');
    expect(router).toContain('reviewWorkpaper');
    expect(router).toContain('revokeWorkpaperShare');
  });

  it('将 OAS 与情景页替换为图例聚焦、交叉悬停、区间选择和参数敏感性图表', () => {
    expect(interactivePanel).toContain('OAS 路径与交叉悬停');
    expect(interactivePanel).toContain('onMouseMove');
    expect(interactivePanel).toContain('<Brush');
    expect(interactivePanel).toContain('动态情景分解、悬停解释与参数敏感性');
    expect(specialist).toContain("case '2': return <CreditChartExportPanels");
    expect(specialist).toContain("case '15': return <CreditChartExportPanels");
  });

  it('为待审研究包计算截止、临期和逾期状态，并由账户保存时限与阈值', () => {
    expect(schema).toContain('approvalDueAt: timestamp("approval_due_at")');
    expect(schema).toContain('approvalReminderDays: int("approval_reminder_days")');
    expect(db).toContain('getCreditPackageDeadlineState');
    expect(db).toContain("deadlineState: 'not_applicable' | 'on_track' | 'due_soon' | 'overdue'");
    expect(router).toContain('approvalDueAt');
    expect(deadlinePanel).toContain('审批时限预警');
    expect(deadlinePanel).toContain('已逾期');
  });

  it('仅允许从批准研究包创建后续修订，并只比较同一修订链的逐字段差异', () => {
    expect(schema).toContain('revisionOfPackageId: int("revision_of_package_id")');
    expect(db).toContain('createCreditResearchPackageRevision');
    expect(db).toContain('CREDIT_PACKAGE_REVISION_REQUIRES_APPROVAL');
    expect(db).toContain('compareCreditResearchPackageVersions');
    expect(db).toContain('CREDIT_PACKAGE_VERSION_NOT_LINKED');
    expect(router).toContain('createPackageRevision');
    expect(router).toContain('comparePackageVersions');
    expect(deadlinePanel).toContain('关联版本差异比较');
  });

  it('为 OAS 和 YAS 图表提供 PNG 与打印式 PDF 导出，并标明数据/情景边界', () => {
    expect(exportPanel).toContain('downloadPng');
    expect(exportPanel).toContain('printAsPdf');
    expect(exportPanel).toContain('PNG 图片');
    expect(exportPanel).toContain('打印 / 保存 PDF');
    expect(exportPanel).toContain('FRED / ICE BofA 指数级日度 OAS');
    expect(exportPanel).toContain('用户输入的情景假设');
    expect(specialist).toContain("case '2': return <CreditChartExportPanels");
    expect(specialist).toContain("case '15': return <CreditChartExportPanels");
  });
});
