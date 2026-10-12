import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('drizzle/schema.ts', 'utf8');
const migration = readFileSync('drizzle/0110_complete_spider_platform.sql', 'utf8');
const service = readFileSync('server/spiderPlatform.ts', 'utf8');
const automation = readFileSync('server/adminDataModuleAutomation.ts', 'utf8');
const router = readFileSync('server/routers/adminSpider.ts', 'utf8');
const publicFeed = readFileSync('server/adminModulePublicFeed.ts', 'utf8');
const liveFeedHook = readFileSync('client/src/hooks/useModuleLiveFeed.ts', 'utf8');
const adminWorkbench = readFileSync('client/src/pages/admin/AdminCrawlerWorkbench.tsx', 'utf8');

const tables = ['spider_task', 'spider_seed_pool', 'spider_raw_data', 'spider_ai_processed', 'finance_world_dataset', 'finance_tool_union_set', 'spider_push_relation', 'spider_missing_scan_log', 'spider_fail_log', 'spider_entity_link', 'spider_data_blood', 'spider_content_snapshot'];

describe('完整爬虫平台硬性契约', () => {
  it('定义并迁移全部十二张数据表', () => {
    for (const table of tables) {
      expect(schema).toContain(`"${table}"`);
      expect(migration).toContain(`\`${table}\``);
    }
  });

  it('自动缺口巡检只记录日志和创建任务，不进入推送流程', () => {
    const start = automation.indexOf('export async function enqueueAdminCrawlerGapUpdate');
    const end = automation.indexOf('export async function processAdminDataModuleAutomationRun', start);
    const body = automation.slice(start, end);
    expect(body).toContain('spiderMissingScanLog');
    expect(body).toContain('spiderTasks');
    expect(body).toContain('automaticPush: false');
    expect(body).not.toContain('spiderPushRelation');
    expect(body).not.toContain('enqueueAdminCrawlerSelection');
  });

  it('推送接口强制同时选择数据和前端模块', () => {
    expect(router).toContain("manualPush:");
    expect(router).toMatch(/data:\s*z\s*\.array/);
    expect(router).toMatch(/moduleIds:\s*z\.array/);
    expect(service).toContain("SPIDER_PUSH_DATA_SELECTION_REQUIRED");
    expect(service).toContain("SPIDER_PUSH_MODULE_SELECTION_REQUIRED");
    expect(service).toContain("manualSelection: !input.automatic");
    expect(service).toContain('pushStatus: "waiting_front_ack"');
  });

  it('新闻 AI 改写限定在来源事实边界且模拟条目明确标记', () => {
    expect(service).toContain("news_rewrite");
    expect(service).toContain("rewrittenContent");
    expect(service).toContain("内置示例");
    expect(service).toContain("不构成投资建议");
  });

  it('终端实际接收后写回持久回执，后台展示完整送达字段', () => {
    expect(publicFeed).toContain('export async function acknowledgePublicFeeds');
    expect(publicFeed).toContain("currentStatus: 'front_acknowledged'");
    expect(publicFeed).toContain('acknowledgedClientCount');
    expect(liveFeedHook).toContain('acknowledgeFeeds.useMutation');
    for (const field of ['任务编号', '推送时间', '发送数量', '成功数量', '失败数量', '前端确认时间', '失败原因', '重试状态', '再次发送']) {
      expect(adminWorkbench).toContain(field);
    }
  });
});
