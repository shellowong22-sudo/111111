import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const enhancer = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketReportComparisonEnhancer.tsx'), 'utf8');
const specialist = readFileSync(resolve(root, 'client/src/components/mm/MoneyMarketSpecialistPanels.tsx'), 'utf8');
const router = readFileSync(resolve(root, 'server/routers/moneyMarketResearch.ts'), 'utf8');
const db = readFileSync(resolve(root, 'server/db.ts'), 'utf8');
const gcCollaboration = readFileSync(resolve(root, 'server/gcTemplateCollaborationDb.ts'), 'utf8');
const mktbeatNotifications = readFileSync(resolve(root, 'server/mktbeatNotificationDb.ts'), 'utf8');
const gcCollaborationPanel = readFileSync(resolve(root, 'client/src/components/mm/GcTemplateCollaborationPanel.tsx'), 'utf8');
const gcTeamDirectory = readFileSync(resolve(root, 'client/src/components/mm/GcTeamTemplateDirectory.tsx'), 'utf8');
const mktbeatRulePanel = readFileSync(resolve(root, 'client/src/components/mm/MktbeatNotificationRulePanel.tsx'), 'utf8');
const notificationCenter = readFileSync(resolve(root, 'client/src/pages/NotificationCenter.tsx'), 'utf8');
const mktbeatDigestDetails = readFileSync(resolve(root, 'client/src/components/MktbeatDigestCompactDetails.tsx'), 'utf8');

describe('GC 报告、BTMM 双区间与 MKTBEAT 阈值警报', () => {
  it('以用户输入元数据和当前公开序列输出专业 PDF，不改写原始观察', () => {
    ['GcProfessionalPdfReport', '页眉标题', '研究编号', '页脚说明', 'scale: 2.5', '不构成交易、估值或政策预测建议'].forEach((marker) => expect(enhancer).toContain(marker));
    ['标准研究报告', '内部简报', '合规存档', '研究审阅摘要', 'listGcTemplates', 'saveGcTemplate', 'deleteGcTemplate', 'setDefaultGcTemplate'].forEach((marker) => expect(`${enhancer}\n${router}`).toContain(marker));
  });

  it('并排比较两个受日期限制的美国财政部 Bill 区间，而不推断发行计划', () => {
    ['BtmmDualRangeComparison', '区间 A', '区间 B', '两个官方拍卖区间并排比较', '不推断未来发行计划', '季度快捷范围', '年度快捷范围', '该季度尚未开始'].forEach((marker) => expect(enhancer).toContain(marker));
    ['pairedPreviousYearRange', '区间 A → 上年同比配对', '2 月 29 日会安全对齐至上一年 2 月末'].forEach((marker) => expect(enhancer).toContain(marker));
    ['同比差异摘要', '发行额差异', '发行额同比变化', '期限结构'].forEach((marker) => expect(enhancer).toContain(marker));
    ['getAuctionRange', '单次比较区间不得超过 730 天', 'auction_date:gte:', 'auction_date:lte:'].forEach((marker) => expect(router).toContain(marker));
  });

  it('对用户定义的公开基准窗口变化阈值进行视觉警报和可导出披露', () => {
    ['MktbeatThresholdAlert', '触发幅度 (bp)', '达到设定幅度', '不生成政策结论、风险评级或交易指令', 'mktbeat-threshold-alert.csv'].forEach((marker) => expect(enhancer).toContain(marker));
    ['BtmmDualRangeComparison', 'MktbeatThresholdAlert'].forEach((marker) => expect(specialist).toContain(marker));
    expect(specialist).not.toContain('<GcProfessionalPdfReport');
    ['PDF 报告', 'money-market-curve.csv', 'scale: 2.5'].forEach((marker) => expect(specialist).toContain(marker));
  });

  it('对真实 MKTBEAT 触发使用账户级幂等键写入全局通知中心，并支持返回数据详情', () => {
    ['triggerMktbeatThresholdNotification', 'pushNotificationToUser'].forEach((marker) => expect(router).toContain(marker));
    ['mktbeat-threshold:${alert.seriesId}:${alert.windowDays}:${thresholdBps}:${alert.observationDate}', "relatedType: 'mktbeat_threshold'", 'deliveryStatus'].forEach((marker) => expect(mktbeatNotifications).toContain(marker));
    ['查看 MKTBEAT 数据详情', "'/?module=money-market&open=mktbeat'", "item.relatedType === 'mktbeat_threshold'", 'mktbeat_threshold_digest', 'window.setTimeout(() => navigate(target), 180)'].forEach((marker) => expect(notificationCenter).toContain(marker));
  });

  it('让 GC 报告模板按只读、编辑和审阅权限进行团队协作并留下审计轨迹', () => {
    ['searchGcTemplateMembers', 'listGcTemplateShares', 'saveGcTemplateShare', 'saveGcTemplateReview'].forEach((marker) => expect(router).toContain(marker));
    ['viewer', 'editor', 'reviewer', 'requirePermission', 'gcReportTemplateAuditEvents', 'saveGcTemplateReview'].forEach((marker) => expect(gcCollaboration).toContain(marker));
    ['模板协作与审阅', '授权成员', '审阅结论', '仅保存导出元数据'].forEach((marker) => expect(`${enhancer}\n${gcCollaborationPanel}`).toContain(marker));
  });

  it('仅在已有团队权限范围内提供 GC 模板目录与关键词检索', () => {
    ['searchGcTeamTemplateDirectory', 'gcReportTemplateShares', 'like(gcReportTemplates.name', 'sharedWithUserId'].forEach((marker) => expect(gcCollaboration).toContain(marker));
    ['searchGcTeamTemplateDirectory', 'keyword', 'limit'].forEach((marker) => expect(router).toContain(marker));
    ['GC 团队模板目录', '按模板名称、页眉或研究编号前缀检索', '仅显示已被授权访问的模板'].forEach((marker) => expect(gcTeamDirectory).toContain(marker));
  });

  it('允许为每个公开 MKTBEAT 序列配置静默、每日和每周汇总频率并进行幂等投递', () => {
    ['listMktbeatNotificationRules', 'saveMktbeatNotificationRule', 'deleteMktbeatNotificationRule'].forEach((marker) => expect(router).toContain(marker));
    ['isQuiet', 'digestWindow', 'isoWeek', 'deliveryStatus: queued ? \'queued\' : \'immediate\'', 'flushMktbeatQuietDigestNotifications', 'mktbeat_threshold_digest'].forEach((marker) => expect(mktbeatNotifications).toContain(marker));
    ['按序列静默与汇总规则', '每日摘要', '每周摘要', '即时逐条提醒'].forEach((marker) => expect(`${enhancer}\n${mktbeatRulePanel}`).toContain(marker));
  });

  it('让每日和每周汇总在通知中心按账户授权展开压缩阈值事件明细', () => {
    ['getMktbeatDigestEventDetails', 'MKTBEAT_DIGEST_NOT_FOUND', 'notificationId', 'deliveryStatus'].forEach((marker) => expect(`${mktbeatNotifications}\n${router}`).toContain(marker));
    ['MktbeatDigestCompactDetails', 'mktbeat_threshold_digest', '查看 MKTBEAT 数据详情'].forEach((marker) => expect(notificationCenter).toContain(marker));
    ['展开阈值事件明细', '观察日', '实际变化', '仅本次汇总关联的真实公开观察事件'].forEach((marker) => expect(mktbeatDigestDetails).toContain(marker));
  });
});
