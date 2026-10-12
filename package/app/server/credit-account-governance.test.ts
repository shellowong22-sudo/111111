import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const panels = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditAccountGovernancePanels.tsx'), 'utf8');
const specialist = readFileSync(resolve(import.meta.dirname, '../client/src/components/credit/CreditSpecialistPanels.tsx'), 'utf8');
const db = readFileSync(resolve(import.meta.dirname, './db.ts'), 'utf8');
const adminRouter = readFileSync(resolve(import.meta.dirname, './routers/creditGovernanceAdmin.ts'), 'utf8');

describe('信用治理台账账户协作与管理员审计', () => {
  it('将 17、18、21、22 项路由至账户级共享台账，而不是浏览器本机展示层', () => {
    expect(specialist).toContain("case '17': return <CreditAccountGovernancePanels moduleId={moduleId} />");
    expect(specialist).toContain("case '18': return <CreditAccountGovernancePanels moduleId={moduleId} />");
    expect(specialist).toContain("case '21': return <CreditAccountGovernancePanels moduleId={moduleId} />");
    expect(specialist).toContain("case '22': return <CreditAccountGovernancePanels moduleId={moduleId} />");
  });

  it('使用账户级工作底稿的共享、撤销、提交、审阅与追加式审计接口', () => {
    expect(panels).toContain('creditCollaboration.saveWorkpaper');
    expect(panels).toContain('creditCollaboration.shareWorkpaper');
    expect(panels).toContain('creditCollaboration.revokeWorkpaperShare');
    expect(panels).toContain('creditCollaboration.submitWorkpaper');
    expect(panels).toContain('creditCollaboration.reviewWorkpaper');
    expect(panels).toContain('listWorkpaperAudit');
    expect(panels).toContain('迁移本机记录');
  });

  it('只允许管理员读取治理汇总，并且审计不读取记录正文', () => {
    expect(adminRouter).toContain('adminProcedure.query');
    expect(db).toContain('getCreditGovernanceAdminAudit');
    expect(db).toContain('不读取或导出记录正文');
    expect(db).toContain("{ moduleId: '17', label: '库存可得性' }");
    expect(db).toContain("{ moduleId: '18', label: '研究运行' }");
    expect(db).toContain("{ moduleId: '21', label: '衍生品权限' }");
    expect(db).toContain("{ moduleId: '22', label: '风险证据' }");
  });

  it('提供真实账户对象驱动的使用、权限、审阅、时效图表与 CSV 导出', () => {
    expect(panels).toContain('ResponsiveContainer');
    expect(panels).toContain('creditGovernanceAdmin.audit');
    expect(panels).toContain('超过 30 天未更新');
    expect(panels).toContain('CSV 导出');
    expect(panels).toContain('不展示或导出用户台账正文');
  });
});
