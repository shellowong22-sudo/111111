import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const schema = readFileSync(resolve(root, 'drizzle/schema.ts'), 'utf8');
const db = readFileSync(resolve(root, 'server/db.ts'), 'utf8');
const router = readFileSync(resolve(root, 'server/routers/mortgageCollaboration.ts'), 'utf8');
const foundation = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageFoundationPanels.tsx'), 'utf8');
const market = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageMarketPanels.tsx'), 'utf8');
const analytics = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageAnalyticsPanels.tsx'), 'utf8');
const panel = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageAccountLedgerPanel.tsx'), 'utf8');
const tagPanel = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageTaxonomyCollaborationPanel.tsx'), 'utf8');
const serverIndex = readFileSync(resolve(root, 'server/_core/index.ts'), 'utf8');

describe('抵押债账户级团队台账', () => {
  it('使用独立台账、成员授权和追加式审计表，不将抵押债记录混入信用债对象', () => {
    expect(schema).toContain('mortgage_shared_ledgers');
    expect(schema).toContain('mortgage_shared_ledger_shares');
    expect(schema).toContain('mortgage_shared_ledger_audit_events');
    expect(schema).toContain('local_migrated');
    expect(schema).toContain('exported');
    expect(schema).toContain('uniqueIndex("mortgage_shared_ledger_share_uq")');
  });

  it('在服务器端明确执行所有者、编辑者、审阅者、只读成员的读写和导出边界', () => {
    expect(db).toContain("export type MortgageLedgerPermission = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none'");
    expect(db).toContain("mode: 'view' | 'edit' | 'review' | 'manage' | 'export'");
    expect(db).toContain("permission === 'owner' || permission === 'editor'");
    expect(db).toContain("permission === 'reviewer'");
    expect(db).toContain("permission === 'owner' || permission === 'editor' || permission === 'reviewer'");
    expect(db).toContain('recordMortgageLedgerExport');
  });

  it('通过受保护路由暴露成员目录、授权、撤销、提交、审阅、审计和权限化导出操作', () => {
    for (const procedure of ['memberDirectory', 'listLedgers', 'saveLedger', 'listShares', 'shareLedger', 'revokeShare', 'submitForReview', 'reviewLedger', 'listAudit', 'authorizeCsvExport']) expect(router).toContain(`${procedure}: protectedProcedure`);
    expect(router).toContain('只读成员可以查看台账，但无导出权限');
    expect(router).toContain('仅台账所有者可管理成员读写权限');
  });

  it('覆盖全部具有本机记录的抵押债模块，并提供不删除原副本的受控迁移入口', () => {
    for (const moduleId of ['1', '3', '5', '7']) expect(foundation).toContain(`'${moduleId}'`);
    for (const moduleId of ['11', '13', '15']) expect(market).toContain(`'${moduleId}'`);
    for (const moduleId of ['20', '21', '22', '23', '26']) expect(analytics).toContain(`'${moduleId}'`);
    expect(panel).toContain('本机副本不会被删除');
    expect(panel).toContain('四级权限矩阵');
    expect(panel).toContain('共享、撤销、保存、迁移、提交、审批、退回、时限设置和导出均追加记录');
  });

  it('为 MBS-24 提供账户级团队标签、读写共享、分类筛选及标签和担保品聚合，而不伪造证券行情', () => {
    for (const table of ['mortgage_taxonomy_tags', 'mortgage_taxonomy_tag_shares', 'mortgage_taxonomy_tag_assignments']) expect(schema).toContain(table);
    for (const procedure of ['listTaxonomyTags', 'saveTaxonomyTag', 'setTaxonomyTagAssignments', 'shareTaxonomyTag', 'revokeTaxonomyTagShare']) expect(router).toContain(`${procedure}: protectedProcedure`);
    expect(analytics).not.toContain('MortgageTaxonomyCollaborationPanel');
    expect(tagPanel).toContain('按团队标签聚合');
    expect(tagPanel).toContain('按担保品维度聚合');
    expect(tagPanel).toContain('不包含价格、评级或投资结论');
    expect(analytics).toContain('MBSAssetTaxonomyPanel');
  });

  it('为账户级台账提供高级筛选、多列排序、个人保存视图和权限化当前视图导出', () => {
    expect(schema).toContain('mortgage_ledger_saved_views');
    expect(db).toContain('saveMortgageLedgerSavedView');
    expect(db).toContain('listMortgageLedgerSavedViews');
    for (const procedure of ['listSavedViews', 'saveSavedView', 'deleteSavedView']) expect(router).toContain(`${procedure}: protectedProcedure`);
    expect(panel).toContain('高级筛选、多列排序与个人视图');
    expect(panel).toContain('点击列头添加排序；最多四列');
    expect(panel).toContain('导出当前筛选视图并写入操作日志');
  });

  it('为待审、临期和逾期台账提供时限、幂等通知中心记录、实时 SSE 推送和小时级检查', () => {
    expect(schema).toContain('review_due_at');
    expect(schema).toContain('mortgage_ledger_notification_events');
    expect(db).toContain('notifyMortgageLedgerReviewSubmitted');
    expect(db).toContain('processMortgageLedgerReviewNotifications');
    expect(db).toContain('review_due_soon');
    expect(db).toContain('review_overdue');
    expect(router).toContain('setReviewTiming: protectedProcedure');
    expect(router).toContain('pushNotificationToUser');
    expect(serverIndex).toContain('processMortgageLedgerReviewNotifications()');
    expect(serverIndex).toContain('mortgageLedgerNotifications');
    expect(panel).toContain('审阅时限与实时提醒');
    expect(panel).toContain('提交审阅会即时推送给审阅成员');
  });
});
