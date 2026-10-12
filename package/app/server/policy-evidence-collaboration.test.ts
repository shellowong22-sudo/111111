import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const schema = read('drizzle/schema.ts');
const db = read('server/policyEvidenceDb.ts');
const router = read('server/routers/moneyMarketPolicyCollaboration.ts');
const index = read('server/_core/index.ts');
const ics = read('server/sovereignFinancingCalendarIcs.ts');
const filterPanel = read('client/src/components/mm/BoomSubscriptionFilters.tsx');
const collaborationPanel = read('client/src/components/mm/PolicyEvidenceCollaborationPanel.tsx');
const specialist = read('client/src/components/mm/MoneyMarketSpecialistPanels.tsx');

describe('央行政策证据团队协作', () => {
  it('持久化链接、指纹、关键词证据、共享、批注和审计，但不保存完整外部文件', () => {
    ['policyEvidenceDocuments', 'sourceUrl', 'documentFingerprint', 'highlights', 'guidanceEvidence', 'policyEvidenceDocumentShares', 'policyEvidenceAnnotations', 'policyEvidenceAuditEvents'].forEach((value) => expect(schema).toContain(value));
    expect(schema).toContain('不存储或重新发布完整央行文件');
  });
  it('服务端强制所有者共享、编辑/只读访问和批注更新权限', () => {
    ['getPolicyEvidencePermission', 'requireAccess', "mode === 'share' ? permission !== 'owner'", 'FORBIDDEN_POLICY_EVIDENCE_ANNOTATION_UPDATE', 'savePolicyEvidenceShare', 'revokePolicyEvidenceShare'].forEach((value) => expect(db).toContain(value));
    ['captureDocument', 'saveAnnotation', 'saveShare', 'revokeShare', 'listAudit', 'compareGuidance', 'protectedProcedure'].forEach((value) => expect(router).toContain(value));
  });
  it('将版本比较限定为同一央行来源，并按新增、移除和保留前瞻性证据输出', () => {
    expect(db).toContain('POLICY_EVIDENCE_COMPARE_SAME_SOURCE_REQUIRED');
    ['新增前瞻性指引片段', '移除前瞻性指引片段', '共同保留片段', "action: 'compared'"].forEach((value) => expect(db).toContain(value));
    expect(collaborationPanel).toContain('同源文件前瞻性指引差异');
    expect(collaborationPanel).toContain('比较版本');
  });
});

describe('BOOM 高级订阅筛选', () => {
  it('只从美国财政部已发布国库券拍卖中按期限、CUSIP和发行规模筛选', () => {
    ['req.query.terms', 'req.query.cusip', 'minAmount', 'maxAmount', "record.securityType.toLowerCase() === 'bill'", 'record.cusip?.toUpperCase().includes(cusip)', 'record.offeringAmount >= minAmount'].forEach((value) => expect(index).toContain(value));
    expect(index).toContain('X-Money-Market-Calendar-Filters');
  });
  it('在 ICS 条目中保留官方 CUSIP、期限和规模，并提供定制 WebCal 工作流', () => {
    expect(ics).toContain('CUSIP');
    ['订阅期限直接沿用上方发售事件轴当前选择', 'CUSIP（完整或前缀）', '最低发行规模（USD）', '定制 ICS / WebCal', '原始字段'].forEach((value) => expect(filterPanel).toContain(value));
    expect(specialist).toContain('onTermsChange={setBoomTerms}');
  });
});
