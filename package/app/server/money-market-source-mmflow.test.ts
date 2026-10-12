import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('SOURCE 时效治理、MMFLOW 审阅与跨模块研究路径', () => {
  const schema = read('drizzle/schema.ts');
  const sourceDb = read('server/sourceFreshnessNotificationDb.ts');
  const mmflowDb = read('server/mmflowDeliveryDb.ts');
  const pathDb = read('server/mmResearchPathDb.ts');
  const router = read('server/routers/moneyMarketResearch.ts');
  const sourceUi = read('client/src/components/mm/SourceFreshnessPreferences.tsx');
  const sourceGovernanceUi = read('client/src/components/mm/SourceRuleGovernance.tsx');
  const mmflowUi = read('client/src/components/mm/MmflowDeliveryReviewPanel.tsx');
  const mmflowGovernanceUi = read('client/src/components/mm/MmflowVersionGovernance.tsx');
  const pathUi = read('client/src/components/mm/MoneyMarketResearchPath.tsx');
  const layer = read('client/src/components/mm/MoneyMarketDistinctiveLayer.tsx');
  const scheduler = read('server/_core/index.ts');
  const notificationRouter = read('server/routers/notification.ts');
  const notificationCenter = read('client/src/pages/NotificationCenter.tsx');
  const observabilityDb = read('server/moneyMarketObservabilityDb.ts');
  const observabilityUi = read('client/src/components/mm/MoneyMarketObservability.tsx');
  const specialistUi = read('client/src/components/mm/MoneyMarketSpecialistPanels.tsx');

  it('将 SOURCE 规则、幂等事件和每日汇总持久化为账户级记录', () => {
    expect(schema).toContain('sourceFreshnessNotificationRules');
    expect(schema).toContain('sourceFreshnessNotificationEvents');
    expect(schema).toContain('sourceFreshnessDigestDeliveries');
    expect(schema).toContain('source_freshness_event_user_key_uq');
    expect(sourceDb).toContain('processSourceFreshnessNotifications');
    expect(sourceDb).toContain('flushSourceFreshnessDailyDigests');
    expect(sourceDb).toContain("relatedType: 'source_freshness'");
    expect(sourceDb).toContain("relatedType: 'source_freshness_digest'");
  });

  it('限制 SOURCE 阈值、时区与投递偏好，并在既有受控扫描中处理', () => {
    expect(router).toContain('saveSourceFreshnessNotificationRule');
    expect(router).toContain('digestMode: z.enum(["immediate", "daily"])');
    expect(sourceUi).toContain('thresholdDays');
    expect(sourceUi).toContain('账户级时效阈值与提醒偏好');
    expect(scheduler).toContain('processSourceFreshnessNotifications(moneyMarketSnapshot.rates)');
    expect(scheduler).toContain('flushSourceFreshnessDailyDigests()');
  });

  it('将 MMFLOW 交付包、共享、审阅和审计分表，并以权限控制状态流转', () => {
    expect(schema).toContain('mmflowDeliveryPackages');
    expect(schema).toContain('mmflowDeliveryPackageShares');
    expect(schema).toContain('mmflowDeliveryPackageReviews');
    expect(schema).toContain('mmflowDeliveryPackageAuditEvents');
    expect(mmflowDb).toContain("type Permission = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none'");
    expect(mmflowDb).toContain('MMFLOW_PACKAGE_REQUIRES_REVIEWER');
    expect(mmflowDb).toContain("status: 'submitted'");
    expect(mmflowDb).toContain("'approved' : 'submitted'");
    expect(mmflowDb).toContain("relatedType: 'mmflow_delivery_review'");
  });

  it('提供真实来源交付包的保存、成员授权、审阅与完整路径跳转', () => {
    expect(router).toContain('saveMmflowDeliveryPackage');
    expect(router).toContain('submitMmflowDeliveryPackage');
    expect(router).toContain('saveMmflowDeliveryReview');
    expect(mmflowUi).toContain('受控团队交付包审阅');
    expect(mmflowUi).toContain('提交审阅');
    expect(mmflowUi).toContain('所有审阅者批准后才转为已批准');
    expect(layer).toContain('SourceFreshnessPreferences');
    expect(layer).toContain('MmflowDeliveryReviewPanel');
    expect(layer).toContain('MoneyMarketResearchPath');
    expect(pathUi).toContain('跨模块研究路径推荐');
    expect(pathUi).toContain('module=money-market&open=${step.id}');
    ['NYFED-FUNDING', 'FRED-COMMERCIAL-PAPER', 'ECB-POLICY-CORRIDOR', 'OECD-SHORT-RATES'].forEach((sourceId) => {
      expect(mmflowUi).toContain(sourceId);
      expect(mmflowDb).toContain(sourceId);
      expect(router).toContain(sourceId);
    });
    expect(router).toContain('.max(11)');
  });

  it('支持 SOURCE 自有规则的批量复制、团队授权、撤销与共享编辑权限校验', () => {
    expect(schema).toContain('sourceFreshnessRuleShares');
    expect(schema).toContain('source_freshness_rule_share_uq');
    expect(sourceDb).toContain('copySourceRules');
    expect(sourceDb).toContain('existingSourceIds');
    expect(sourceDb).toContain('同序列独立规则保持未覆盖');
    expect(sourceDb).toContain('shareSourceRule');
    expect(sourceDb).toContain('revokeSourceRuleShare');
    expect(sourceDb).toContain('FORBIDDEN_SOURCE_RULE_COPY');
    expect(sourceDb).toContain('updateSharedSourceFreshnessNotificationRule');
    expect(router).toContain('searchSourceRuleMembers');
    expect(router).toContain('listSourceRuleShares');
    expect(sourceGovernanceUi).toContain('批量复制');
    expect(sourceGovernanceUi).toContain('共享标准');
    expect(sourceGovernanceUi).toContain('团队共享规则编辑');
  });

  it('将研究路径收藏和使用频率持久化为账户级偏好，并在相同入口内优先排序', () => {
    expect(schema).toContain('mmResearchPathFavorites');
    expect(schema).toContain('mm_research_path_favorite_uq');
    expect(pathDb).toContain('toggleMmResearchPathFavorite');
    expect(pathDb).toContain('recordMmResearchPathUsage');
    expect(pathDb).toContain('usageCount: sql');
    expect(router).toContain('listMmResearchPathFavorites');
    expect(router).toContain('recordMmResearchPathUsage');
    expect(pathUi).toContain('rankedSteps');
    expect(pathUi).toContain('已使用 ${preference.usageCount} 次');
    expect(pathUi).toContain('toggleMmResearchPathFavorite');
  });

  it('为 MMFLOW 提交冻结版本快照、提供来源差异比较并以截止时点和接收人做提醒幂等键', () => {
    expect(schema).toContain('approvalDeadlineAt');
    expect(schema).toContain('mmflowDeliveryPackageVersions');
    expect(schema).toContain('mmflowDeliveryPackageDeadlineNotifications');
    expect(mmflowDb).toContain('listMmflowVersions');
    expect(mmflowDb).toContain('compareMmflowVersions');
    expect(mmflowDb).toContain('processMmflowDeliveryDeadlineNotifications');
    expect(mmflowDb).toContain('冻结版本 ${nextVersion}');
    expect(mmflowDb).toContain('mmflow-deadline:${pkg.id}:${deadline.toISOString()}:${userId}');
    expect(router).toContain('setMmflowApprovalDeadline');
    expect(router).toContain('compareMmflowVersions');
    expect(mmflowGovernanceUi).toContain('版本与审批时限治理');
    expect(mmflowGovernanceUi).toContain('临近 24 小时');
    expect(scheduler).toContain('processMmflowDeliveryDeadlineNotifications');
  });

  it('将 MMFLOW 审批截止和 SOURCE 规则复制提醒收口到全局通知中心的筛选、强调和终端深链', () => {
    expect(notificationRouter).toContain("'mmflow_delivery_deadline'");
    expect(notificationCenter).toContain("item.relatedType === 'mmflow_delivery_deadline'");
    expect(notificationCenter).toContain("item.relatedType === 'source_freshness_copy'");
    expect(notificationCenter).toContain('打开 MMFLOW 审批交付包');
    expect(notificationCenter).toContain('查看 SOURCE 时效规则');
    expect(notificationCenter).toContain("'/?module=money-market&open=mmflow'");
    expect(notificationCenter).toContain("'/?module=money-market&open=source-mm'");
  });

  it('仅对真实公开快照按来源和小时记录可用率历史，并在 SOURCE 内展示趋势而不补写模拟样本', () => {
    expect(schema).toContain('moneyMarketSourceAvailabilitySnapshots');
    expect(schema).toContain('mm_source_availability_source_hour_uq');
    expect(observabilityDb).toContain('recordMoneyMarketSourceAvailability');
    expect(observabilityDb).toContain('hourBucket');
    expect(router).toContain('availabilityProbesFromMoneyMarketSnapshot');
    expect(router).toContain('listSourceAvailabilityHistory');
    expect(scheduler).toContain('recordMoneyMarketSourceAvailability(availabilityProbesFromMoneyMarketSnapshot(moneyMarketSnapshot))');
    expect(observabilityUi).toContain('公开来源可用率历史');
    expect(observabilityUi).toContain('不会补写模拟可用率');
    expect(layer).toContain('SourceAvailabilityHistory');
  });

  it('以账户和十五分钟桶记录实际模块打开，并将真实使用与来源运行边界放入 SOURCE 诊断面板', () => {
    expect(schema).toContain('moneyMarketModuleUsageEvents');
    expect(schema).toContain('mm_module_usage_user_module_bucket_uq');
    expect(observabilityDb).toContain('recordMoneyMarketModuleUsage');
    expect(observabilityDb).toContain('activityBucket');
    expect(router).toContain('listModuleDiagnostics');
    expect(router).toContain('recordModuleUsage');
    expect(specialistUi).toContain('usage.mutate({ moduleId })');
    expect(observabilityUi).toContain('模块使用与运行诊断');
    expect(observabilityUi).toContain('当前账户真实打开过的模块');
    expect(layer).toContain('MoneyMarketModuleDiagnostics');
  });

  it('在通知和研究路径跳转时提供明确状态和短暂过渡，仍保持真实导航与使用记录', () => {
    expect(notificationCenter).toContain('navigatingNotificationId');
    expect(notificationCenter).toContain('正在打开终端详情');
    expect(notificationCenter).toContain('window.setTimeout(() => navigate(target), 180)');
    expect(pathUi).toContain('navigatingTo');
    expect(pathUi).toContain('正在切换终端模块');
    expect(pathUi).toContain('window.setTimeout(() => window.location.assign');
  });
});
