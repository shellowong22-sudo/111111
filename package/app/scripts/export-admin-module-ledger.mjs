import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mysql from 'mysql2/promise';

const project = '/home/ubuntu/finance-hub-recovery';
const auditDir = resolve(project, 'audit/backend-only');
const basePath = resolve(auditDir, 'admin-module-ledger.json');

function tsv(value) {
  const source = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return source.replaceAll('\t', ' ').replaceAll('\n', ' ');
}

function asJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

const baseline = JSON.parse(await readFile(basePath, 'utf8'));
const announcementRecord = {
  moduleId: 'announcement-banner',
  moduleName: '全局公告横幅',
  path: '/',
  domain: '系统数据',
  group: 'announcement_publication',
  target: 'announcements',
  sourceKind: 'simulated',
  canRefresh: false,
  canSchedule: true,
};
const base = [...(Array.isArray(baseline.records) ? baseline.records : [])];
if (!base.some((module) => module.moduleId === announcementRecord.moduleId)) base.push(announcementRecord);
if (base.length !== 140) throw new Error('MODULE_BASELINE_LEDGER_INVALID');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
await mkdir(auditDir, { recursive: true });
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [profileRows] = await connection.query('SELECT * FROM admin_data_module_profiles ORDER BY module_id');
  const [settingRows] = await connection.query('SELECT * FROM admin_data_module_settings ORDER BY module_id');
  const [controlRows] = await connection.query('SELECT * FROM admin_data_module_runtime_controls ORDER BY module_id');
  const [contentRows] = await connection.query(`SELECT module_id, COUNT(*) AS content_count, SUM(status = 'pending_review') AS pending_review_count, SUM(status = 'delivered') AS delivered_content_count, MAX(created_at) AS last_content_at FROM admin_data_module_content_items GROUP BY module_id`);
  const [qualityRows] = await connection.query('SELECT module_id, quality_score, quality_report, status, updated_at FROM admin_data_module_content_items ORDER BY module_id, updated_at DESC');
  const [deliveryRows] = await connection.query(`SELECT module_id, COUNT(*) AS delivery_event_count, SUM(action = 'pushed' AND status = 'success') AS push_success_count, SUM(action = 'push_failed' OR status = 'failed') AS push_failure_count, MAX(created_at) AS last_delivery_event_at FROM admin_data_module_delivery_events GROUP BY module_id`);
  const [moduleEventRows] = await connection.query('SELECT module_id, action, detail, created_at FROM admin_data_module_events ORDER BY created_at DESC');
  const [deliveryEventRows] = await connection.query('SELECT module_id, action, status, detail, data_version, duration_ms, created_at FROM admin_data_module_delivery_events ORDER BY created_at DESC');
  const [stepEventRows] = await connection.query('SELECT module_id, step, action, status, detail, duration_ms, created_at FROM admin_data_module_automation_step_events WHERE module_id IS NOT NULL ORDER BY created_at DESC');
  const profiles = new Map(profileRows.map((row) => [row.module_id, row]));
  const settings = new Map(settingRows.map((row) => [row.module_id, row]));
  const controls = new Map(controlRows.map((row) => [row.module_id, row]));
  const content = new Map(contentRows.map((row) => [row.module_id, row]));
  const quality = qualityRows.reduce((map, row) => {
    const current = map.get(row.module_id) ?? { scoreTotal: 0, scoreCount: 0, rejectedCount: 0, latestScore: null, latestReport: null, latestReason: null };
    const score = Number(row.quality_score);
    if (Number.isFinite(score)) { current.scoreTotal += score; current.scoreCount += 1; if (current.latestScore === null) current.latestScore = score; }
    if (row.status === 'rejected') current.rejectedCount += 1;
    if (current.latestReport === null && row.quality_report != null) {
      current.latestReport = asJson(row.quality_report, row.quality_report);
      const report = current.latestReport;
      current.latestReason = report && typeof report === 'object' ? report.reason ?? report.rejectionReason ?? report.failureReason ?? (Array.isArray(report.reasons) ? report.reasons.join('; ') : null) : null;
    }
    map.set(row.module_id, current);
    return map;
  }, new Map());
  const delivery = new Map(deliveryRows.map((row) => [row.module_id, row]));
  const groupByModule = (items) => items.reduce((map, item) => {
    const rows = map.get(item.module_id) ?? [];
    rows.push(item);
    map.set(item.module_id, rows);
    return map;
  }, new Map());
  const moduleEvents = groupByModule(moduleEventRows);
  const deliveryEvents = groupByModule(deliveryEventRows);
  const stepEvents = groupByModule(stepEventRows);
  const rows = base.map((module) => {
    const profile = profiles.get(module.moduleId) ?? null;
    const setting = settings.get(module.moduleId) ?? null;
    const control = controls.get(module.moduleId) ?? null;
    const contentSummary = content.get(module.moduleId) ?? null;
    const deliverySummary = delivery.get(module.moduleId) ?? null;
    const qualitySummary = quality.get(module.moduleId) ?? null;
    const moduleStepEvents = stepEvents.get(module.moduleId) ?? [];
    const qualityStepEvents = moduleStepEvents.filter((event) => event.step === 'quality_check_passed' || event.step === 'quality_check_rejected');
    return {
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      path: module.path,
      domain: module.domain,
      deliveryGroup: module.deliveryGroup ?? module.group,
      managementCapability: module.managementCapability ?? null,
      baseTargetContract: module.targetContract ?? module.target,
      baseSourceKind: module.sourceKind,
      canRefresh: module.canRefresh,
      canSchedule: module.canSchedule,
      status: setting?.status ?? 'managed',
      adminNote: setting?.admin_note ?? null,
      ownerUserId: profile?.owner_user_id ?? null,
      moduleGroup: profile?.module_group ?? null,
      moduleCategory: profile?.module_category ?? null,
      displayArea: profile?.display_area ?? null,
      frontendInterface: profile?.frontend_interface ?? null,
      targetContract: profile?.target_contract ?? null,
      targetCollection: profile?.target_collection ?? null,
      fieldMapping: asJson(profile?.field_mapping, {}),
      sourceKind: profile?.source_kind ?? 'none',
      sourceReference: profile?.source_reference ?? null,
      theme: profile?.theme ?? null,
      keywords: asJson(profile?.keywords, []),
      tags: asJson(profile?.tags, []),
      contentLimit: profile?.content_limit ?? null,
      updateFrequencyMinutes: profile?.update_frequency_minutes ?? null,
      sortWeight: profile?.sort_weight ?? null,
      automationEnabled: profile?.automation_enabled ?? false,
      taskTemplate: profile?.task_template ?? null,
      executionPriority: profile?.execution_priority ?? null,
      reviewPolicy: profile?.review_policy ?? null,
      pushPolicy: profile?.push_policy ?? null,
      publishSchedule: profile?.publish_schedule ?? null,
      recommendationRule: asJson(profile?.recommendation_rule, null),
      dedupeScope: profile?.dedupe_scope ?? null,
      retryLimit: profile?.retry_limit ?? null,
      runtimeStatus: profile?.runtime_status ?? 'unavailable',
      runtimeDataMode: control?.data_mode ?? 'inherit',
      runtimeEnabled: control?.is_enabled ?? true,
      runtimeDetail: control?.admin_detail ?? null,
      profileUpdatedAt: profile?.updated_at ?? null,
      settingUpdatedAt: setting?.updated_at ?? null,
      runtimeControlUpdatedAt: control?.updated_at ?? null,
      scheduleRule: module.canSchedule ? 'global_queue_only' : 'none',
      scheduleExpression: module.canSchedule ? 'global module-automation-queue (configured separately)' : null,
      lastExecutedAt: profile?.last_executed_at ?? null,
      lastPushedAt: profile?.last_pushed_at ?? null,
      currentVersion: profile?.current_version ?? 0,
      rollbackVersion: profile?.rollback_version ?? null,
      contentCount: Number(contentSummary?.content_count ?? 0),
      dataRecordCount: Number(contentSummary?.content_count ?? 0),
      pendingReviewCount: Number(contentSummary?.pending_review_count ?? 0),
      deliveredContentCount: Number(contentSummary?.delivered_content_count ?? 0),
      qualityScoreAverage: qualitySummary?.scoreCount ? Number((qualitySummary.scoreTotal / qualitySummary.scoreCount).toFixed(2)) : null,
      latestQualityScore: qualitySummary?.latestScore ?? null,
      qualityRejectedCount: qualitySummary?.rejectedCount ?? 0,
      latestQualityReason: qualitySummary?.latestReason ?? null,
      latestQualityReport: qualitySummary?.latestReport ?? null,
      qualityStepEventCount: qualityStepEvents.length,
      lastContentAt: contentSummary?.last_content_at ?? null,
      deliveryEventCount: Number(deliverySummary?.delivery_event_count ?? 0),
      pushSuccessCount: Number(deliverySummary?.push_success_count ?? 0),
      pushFailureCount: Number(deliverySummary?.push_failure_count ?? 0),
      lastDeliveryEventAt: deliverySummary?.last_delivery_event_at ?? null,
      executionRecord: profile?.last_executed_at ? 'recorded' : 'not_executed',
      pushRecord: profile?.last_pushed_at ? 'recorded' : 'not_pushed',
      auditLogSnapshot: {
        moduleEvents: moduleEvents.get(module.moduleId) ?? [],
        generationReviewPushFailureEvents: deliveryEvents.get(module.moduleId) ?? [],
        queueStepEvents: stepEvents.get(module.moduleId) ?? [],
      },
    };
  });
  const summary = {
    exportedAt: new Date().toISOString(),
    moduleCount: rows.length,
    profileCount: profileRows.length,
    settingCount: settingRows.length,
    runtimeControlCount: controlRows.length,
    modulesWithExecutionRecord: rows.filter((row) => row.executionRecord === 'recorded').length,
    modulesWithPushRecord: rows.filter((row) => row.pushRecord === 'recorded').length,
    modulesWithNoServerContract: rows.filter((row) => row.targetContract === 'no_server_contract').length,
    modulesWithRequestTimeContract: rows.filter((row) => row.targetContract === 'request_time_read').length,
  };
  const payload = { summary, rows };
  await writeFile(resolve(auditDir, 'full-admin-module-ledger.json'), `${JSON.stringify(payload, null, 2)}\n`);
  const columns = Object.keys(rows[0]);
  await writeFile(resolve(auditDir, 'full-admin-module-ledger.tsv'), `${columns.join('\t')}\n${rows.map((row) => columns.map((column) => tsv(row[column])).join('\t')).join('\n')}\n`);
  const markdown = [
    '# 全量后台模块台账快照',
    '',
    `导出时刻：${summary.exportedAt}。该文件按既有前端模块注册表逐项合并数据库档案、设置、运行控制、内容与推送审计摘要；“not_executed”和“not_pushed”是显式未运行状态，而非通过推断填充。`,
    '',
    '| 指标 | 数量 |',
    '|---|---:|',
    ...Object.entries(summary).filter(([key]) => key !== 'exportedAt').map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '| 模块 ID | 页面/路由 | 接口 | 目标表/集合 | 来源 | 自动化 | 审核/推送 | 发布时间 | 推荐规则 | 去重范围 | 运行/推送记录 | 质量平均分 | 最新质量分 | 拒绝数量 | 最新拒绝原因 | 质量步骤事件 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---:|---:|---:|---|---:|',
    ...rows.map((row) => `| ${row.moduleId} | ${row.path} | ${row.frontendInterface ?? ''} | ${row.targetCollection ?? ''} | ${row.sourceKind} | ${row.automationEnabled ? 'enabled' : 'disabled'} | ${row.reviewPolicy ?? ''}/${row.pushPolicy ?? ''} | ${row.publishSchedule ?? ''} | ${tsv(row.recommendationRule)} | ${row.dedupeScope ?? ''} | ${row.executionRecord}/${row.pushRecord} | ${row.qualityScoreAverage ?? ''} | ${row.latestQualityScore ?? ''} | ${row.qualityRejectedCount ?? 0} | ${tsv(row.latestQualityReason)} | ${row.qualityStepEventCount ?? 0} |`),
    '',
    '完整字段、负责人/备注、字段映射、缓存兼容目标、运行与版本字段请参阅同目录 JSON 和 TSV 文件。',
    '',
  ].join('\n');
  await writeFile(resolve(auditDir, 'full-admin-module-ledger.md'), markdown);
  console.log(JSON.stringify(summary));
} finally {
  connection.destroy();
}
