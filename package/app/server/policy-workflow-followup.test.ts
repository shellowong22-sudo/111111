import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const schema = read('drizzle/schema.ts');
const workflow = read('server/policyWorkflowDb.ts');
const router = read('server/routers/moneyMarketPolicyCollaboration.ts');
const index = read('server/_core/index.ts');
const workflowPanel = read('client/src/components/mm/PolicyEvidenceWorkflowPanel.tsx');
const presetPanel = read('client/src/components/mm/BoomSubscriptionPresetPanel.tsx');
const specialist = read('client/src/components/mm/MoneyMarketSpecialistPanels.tsx');

describe('政策提及与差异审批', () => {
  it('持久化提及、回复状态、幂等通知和版本审批，而不保存政策结论', () => {
    ['policyEvidenceAnnotationMentions', 'policyEvidenceMentionNotificationEvents', 'policyEvidenceVersionReviews', 'pending_reply', 'follow_up', 'confirmed'].forEach((value) => expect(schema).toContain(value));
    expect(schema).toContain('不存储或重新发布完整央行文件');
  });
  it('只向已拥有文件访问权的成员发送提及，并限制最终确认给较新文件所有者', () => {
    ['MENTIONED_MEMBER_MUST_HAVE_DOCUMENT_ACCESS', 'CANNOT_MENTION_SELF', 'recordMentionNotification', 'ONLY_NEWER_DOCUMENT_OWNER_CAN_CONFIRM', 'processPolicyEvidenceMentionReminders'].forEach((value) => expect(workflow).toContain(value));
    ['createMention', 'resolveMention', 'saveVersionReview', 'pushNotificationToUser'].forEach((value) => expect(router).toContain(value));
  });
  it('将超过二十四小时的未回复提及加入小时检查，并通过实时推送送达在线成员', () => {
    expect(workflow).toContain('24 * 60 * 60 * 1000');
    expect(index).toContain('processPolicyEvidenceMentionReminders()');
    expect(index).toContain('policyMentionNotifications');
    expect(index).toContain('pushNotificationToUser(notification.userId, notification)');
  });
  it('提供提及、待回复处理和版本审批的可操作界面', () => {
    ['提及成员并请求回复', '发送 @ 提及', '待回复', '记录审批状态', '版本差异人工确认'].forEach((value) => expect(workflowPanel).toContain(value));
    expect(specialist).toContain('<PolicyEvidenceWorkflowPanel initialSourceId="FED" />');
  });
});

describe('BOOM 订阅预设共享', () => {
  it('持久化实际筛选参数、团队共享和追加式审计，不保存日历内容', () => {
    ['boomSubscriptionPresets', 'boomSubscriptionPresetShares', 'boomSubscriptionPresetAuditEvents', 'filters: json("filters")'].forEach((value) => expect(schema).toContain(value));
    expect(schema).toContain('ICS 始终重新读取官方拍卖记录');
  });
  it('校验期限、CUSIP和规模区间，并以所有者/编辑/只读权限保护预设共享', () => {
    ['normalizeBoomFilters', 'BOOM_PRESET_AMOUNT_RANGE_INVALID', 'getBoomPresetPermission', 'requirePresetAccess', 'saveBoomSubscriptionPresetShare', 'revokeBoomSubscriptionPresetShare'].forEach((value) => expect(workflow).toContain(value));
    ['listBoomPresets', 'saveBoomPreset', 'saveBoomPresetShare', 'revokeBoomPresetShare'].forEach((value) => expect(router).toContain(value));
  });
  it('把保存、加载和共享并入唯一订阅筛选器，避免复刻期限、CUSIP与规模输入', () => {
    ['保存预设', '加载个人或团队预设', '共享预设', '不复制第二套输入'].forEach((value) => expect(presetPanel).toContain(value));
    expect(specialist).not.toContain('<BoomSubscriptionPresetPanel />');
    expect(read('client/src/components/mm/BoomSubscriptionFilters.tsx')).toContain('<BoomSubscriptionPresetPanel filters={filters} onApply={applyPreset} />');
  });
});
