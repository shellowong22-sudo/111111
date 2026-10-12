import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateMbs21FhfaGeographicExposureRows } from './db';

const root = resolve(import.meta.dirname, '..');
const db = readFileSync(resolve(root, 'server/db.ts'), 'utf8');
const adminRouter = readFileSync(resolve(root, 'server/routers/mortgageGovernanceAdmin.ts'), 'utf8');
const collaborationRouter = readFileSync(resolve(root, 'server/routers/mortgageCollaboration.ts'), 'utf8');
const ledgerPanel = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageAccountLedgerPanel.tsx'), 'utf8');
const auditPanel = readFileSync(resolve(root, 'client/src/components/mortgage/MortgageGovernanceAdminAudit.tsx'), 'utf8');

describe('抵押债协作与数据时效审计', () => {
  it('管理员审计只聚合跨模块对象数量、协作、审阅与时效，不读取或导出台账正文', () => {
    expect(adminRouter).toContain('adminProcedure');
    expect(adminRouter).toContain('getMortgageGovernanceAdminAudit');
    expect(db).toContain('MORTGAGE_GOVERNANCE_MODULES');
    expect(db).toContain("{ moduleId: '21', label: '地域暴露' }");
    expect(db).toContain('不读取或导出记录正文');
    expect(db).toContain('recordCount');
    expect(db).toContain('dueSoonCount');
    expect(db).toContain('overdueCount');
    expect(auditPanel).toContain('mortgageGovernanceAdmin.audit');
    expect(auditPanel).toContain('不展示或导出台账正文');
    expect(auditPanel).toContain('CSV 导出');
  });
});

describe('MBS-21 FHFA 地理暴露 CSV 校验', () => {
  const fhfaUrl = 'https://www.fhfa.gov/data/hpi/datasets';

  it('接受来源可追溯、日期有效且暴露权重不超过 100% 的 FHFA 行', () => {
    const result = validateMbs21FhfaGeographicExposureRows([
      { region: 'Boston-Cambridge', exposureWeightPct: 55.25, hpiChangePct: 3.1, observationDate: '2026-01-01', sourceUrl: fhfaUrl },
      { region: 'Miami-Fort Lauderdale', exposureWeightPct: 44.75, hpiChangePct: null, observationDate: '2026-01-01', sourceUrl: fhfaUrl },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toHaveLength(2);
    expect(result.validRows[0]?.sourceLabel).toBe('FHFA House Price Index 数据集');
  });

  it('拒绝非 FHFA 来源、无效日期、重复地区日期和权重合计超限', () => {
    const invalidSource = validateMbs21FhfaGeographicExposureRows([{ region: 'Boston', exposureWeightPct: 10, observationDate: '2026-01-01', sourceUrl: 'https://example.com/hpi' }]);
    expect(invalidSource.errors[0]).toContain('FHFA 官方域名');
    const invalidDate = validateMbs21FhfaGeographicExposureRows([{ region: 'Boston', exposureWeightPct: 10, observationDate: '2026-15-40', sourceUrl: fhfaUrl }]);
    expect(invalidDate.errors[0]).toContain('YYYY-MM-DD');
    const duplicate = validateMbs21FhfaGeographicExposureRows([{ region: 'Boston', exposureWeightPct: 10, observationDate: '2026-01-01', sourceUrl: fhfaUrl }, { region: 'Boston', exposureWeightPct: 10, observationDate: '2026-01-01', sourceUrl: fhfaUrl }]);
    expect(duplicate.errors[0]).toContain('重复');
    const overweight = validateMbs21FhfaGeographicExposureRows([{ region: 'Boston', exposureWeightPct: 60, observationDate: '2026-01-01', sourceUrl: fhfaUrl }, { region: 'Miami', exposureWeightPct: 50, observationDate: '2026-01-01', sourceUrl: fhfaUrl }]);
    expect(overweight.errors[0]).toContain('不得超过 100%');
  });

  it('将客户端预检和服务器二次校验、权限控制、模板和审计追溯接入 MBS-21 账户级台账', () => {
    expect(collaborationRouter).toContain('importMbs21FhfaCsv');
    expect(collaborationRouter).toContain('importMbs21FhfaGeographicExposureCsv');
    expect(db).toContain('requireMortgageLedgerPermission');
    expect(db).toContain('FHFA 地理暴露 CSV 导入');
    expect(db).toContain('不保存原始 CSV 文件字节');
    expect(ledgerPanel).toContain('FHFA 地理暴露 CSV 批量导入');
    expect(ledgerPanel).toContain('downloadFhfaTemplate');
    expect(ledgerPanel).toContain('Mbs21FhfaCsvImport');
    expect(ledgerPanel).toContain("moduleId === '21'");
  });
});
