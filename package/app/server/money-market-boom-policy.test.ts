import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPolicyEvidence } from './routers/moneyMarketPolicy';

const root = resolve(import.meta.dirname, '..');
const serverEntry = readFileSync(resolve(root, 'server/_core/index.ts'), 'utf8');
const policyRouter = readFileSync(resolve(root, 'server/routers/moneyMarketPolicy.ts'), 'utf8');
const boomPanel = readFileSync(resolve(root, 'client/src/components/mm/BoomAuctionCollaborationPanel.tsx'), 'utf8');
const policyPanel = readFileSync(resolve(root, 'client/src/components/mm/CentralBankPolicyEvidencePanel.tsx'), 'utf8');
const specialist = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketSpecialistPanels.tsx'), 'utf8');

describe('BOOM 官方拍卖提醒与 ICS/WebCal', () => {
  it('将 BOOM 日历严格限定为已发布的美国官方拍卖事件', () => {
    expect(serverEntry).toContain('/api/money-market-boom.ics');
    expect(serverEntry).toContain("record.countryCode === 'US' && record.eventType === 'auction'");
    expect(serverEntry).toContain('US-Treasury-Fiscal-Data');
    expect(serverEntry).toContain('boom-us-auction-v1');
  });

  it('复用账户级融资日历提醒、暂停/恢复、发送历史及 WebCal 链接', () => {
    ['listFinancingCalendarReminderRules', 'saveFinancingCalendarReminderRule', 'setFinancingCalendarReminderRuleActive', 'listFinancingCalendarReminderNotificationHistory', 'eventType: \'auction\'', "countryCode: 'US'", 'webcal:', '首次满足已保存规则时将追加记录'].forEach((value) => expect(boomPanel).toContain(value));
    expect(specialist).toContain('<BoomAuctionCollaborationPanel />');
    expect(specialist).toContain('<BoomSubscriptionFilters');
    expect(specialist).toContain('terms={boomTerms}');
  });
});

describe('央行原始政策文件证据高亮', () => {
  it('分类关键利率、政策动作与前瞻性指引，但不自动推导政策结论', () => {
    const result = extractPolicyEvidence('The Committee decided to maintain the target range for the federal funds rate. The Committee will continue to closely monitor incoming data.');
    expect(result.map((item) => item.category)).toEqual(expect.arrayContaining(['key_rate', 'policy_action', 'forward_guidance']));
    expect(result.some((item) => item.context.includes('target range'))).toBe(true);
  });

  it('只允许已登记的央行官方 HTTPS 域名和 HTML/文本文件', () => {
    ['federalreserve.gov', 'ecb.europa.eu', 'bankofengland.co.uk', 'pbc.gov.cn', 'cbc.gov.tw', 'bcb.gov.br', "url.protocol === 'https:'", 'POLICY_DOCUMENT_URL_NOT_ALLOWED', 'POLICY_DOCUMENT_HTML_OR_TEXT_REQUIRED'].forEach((value) => expect(policyRouter).toContain(value));
    expect(policyRouter).toContain('不构成自动政策立场、利率预测或投资结论');
  });

  it('由 PBOC 独占原文核验，CENB 只承担跨央行协作与审批，避免重复子功能', () => {
    ['读取原文', '关键词辅助 · 原文优先', '打开并完整核验原始文件', '不会自动给出政策立场、利率预测或投资结论'].forEach((value) => expect(policyPanel).toContain(value));
    expect(specialist).toContain('<CentralBankPolicyEvidencePanel initialSourceId="PBOC" />');
    expect(specialist).not.toContain('<CentralBankPolicyEvidencePanel initialSourceId="FED" />');
    expect(specialist).toContain('<PolicyEvidenceCollaborationPanel initialSourceId="FED" />');
    expect(specialist).toContain('<PolicyEvidenceWorkflowPanel initialSourceId="FED" />');
  });
});
