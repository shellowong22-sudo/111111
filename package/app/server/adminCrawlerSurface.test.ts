import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('client/src/components/AdminLayout.tsx', 'utf8');
const app = readFileSync('client/src/App.tsx', 'utf8');
const crawler = readFileSync('client/src/pages/admin/AdminCrawlerWorkbench.tsx', 'utf8');

describe('后台专属 AI 爬虫表面契约', () => {
  it('注册可进入的后台菜单与受保护路由', () => {
    expect(layout).toContain("{ path: '/admin/ai-crawler', label: '专属 AI 爬虫', icon: Bot }");
    expect(app).toContain('path="/admin/ai-crawler"');
    expect(app).toContain('label="专属 AI 爬虫"');
    expect(app).toContain('component={AdminAiCrawler}');
  });

  it('保留前台新闻研究、行情及既有采集入口', () => {
    expect(app).toContain('path={"/news-hub"}');
    expect(app).toContain('path={"/market"}');
    expect(app).toContain('path="/admin/data-ingestion" component=');
    expect(app).not.toContain('ModuleIntelligenceFeed');
  });

  it('后台支持筛选具体数据和模块、标注内容和人工定向推送，不提供一键按钮', () => {
    expect(crawler).toContain('人工筛选定向推送');
    expect(crawler).toContain('全部具体功能模块');
    expect(crawler).toContain('选择具体前端功能');
    expect(crawler).toContain('模块 ID：');
    expect(crawler).toContain('前端路径：');
    expect(crawler).toContain('爬虫数据内容');
    expect(crawler).toContain('两项都必须人工勾选');
    expect(crawler).toContain('candidatePushModuleIds');
    expect(crawler).not.toContain('一键');
  });

  it('完整显示十个后台模块', () => {
    for (const label of ['爬虫任务管理', '种子库管理', '集合大盘', '集合数据浏览', '金融工具多维筛选', '巡检配置面板', '失败监控面板', '快照归档', '实体关联图谱', '数据血缘溯源']) {
      expect(crawler).toContain(label);
    }
  });
});
