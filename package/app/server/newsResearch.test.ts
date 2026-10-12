import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newsResearchRouter } from './routers/newsResearch';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('新闻研究官方终端层', () => {
  it('公开读取与账户私有证据接口均已注册', () => {
    expect(Object.keys((newsResearchRouter as any)._def.procedures)).toEqual(expect.arrayContaining(['getOfficialFeed', 'getSecFilings', 'getSecFilingExcerpt', 'listEvidence', 'captureEvidence', 'updateEvidence', 'getEvidence', 'listSourceFreshnessRules', 'saveSourceFreshnessRule', 'listSourceFreshnessEvents', 'searchMemberDirectory', 'addEvidenceMember', 'removeEvidenceMember', 'submitEvidenceReview', 'reviewEvidence']));
  });

  it('官方来源时效提醒仅使用实际读取的最新发布日期，并接入既有每日事实同步', () => {
    const db = source('server/newsResearchDb.ts'); const server = source('server/_core/index.ts');
    expect(db).toContain('latestPublishedAt'); expect(db).toContain('processNewsSourceFreshnessNotifications'); expect(db).toContain('系统未使用缓存新闻或替代来源填充');
    expect(server).toContain('processNewsSourceFreshnessNotifications'); expect(server).toContain('newsSourceFreshnessNotifications');
  });

  it('匿名账户不能读取、归档或修改账户私有证据卡', async () => {
    const caller = newsResearchRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(caller.listEvidence({ status: 'all', query: '' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.captureEvidence({ sourceKind: 'sec_press', sourceId: 'official-item', institution: 'U.S. Securities and Exchange Commission', headline: '匿名账户不得归档。', publishedAt: null, sourceUrl: 'https://www.sec.gov/news/pressreleases.rss', excerpt: null, researchNote: null })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.updateEvidence({ cardId: 1, status: 'verified' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.listSourceFreshnessRules()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.saveSourceFreshnessRule({ sourceKind: 'sec_press', thresholdHours: 72, isActive: true })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.addEvidenceMember({ cardId: 1, sharedWithUserId: 2, permission: 'reviewer' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.submitEvidenceReview({ cardId: 1, summary: '这是一条账户私有的审阅摘要。' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.reviewEvidence({ submissionId: 1, decision: 'approved', note: '' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('原面板完整保留后才追加官方阅读与账户证据层，且新增层不提供离站路径或模拟新闻', () => {
    const terminal = source('client/src/pages/Terminal.tsx'); const detail = source('client/src/pages/MenuItemDetail.tsx'); const route = source('client/src/components/news/NewsResearchHubPreservedRoute.tsx'); const layer = source('client/src/components/news/NewsResearchLayer.tsx'); const preserved = source('client/src/components/news/NewsPreservedModule.tsx');
    expect(terminal).toMatch(/<NewsPreservedModule moduleId="NEWS-TERMINAL">\s*<NewsPanel title="新闻与研究报告"\s*\/>\s*<\/NewsPreservedModule>/);
    expect(detail).toContain('return <NewsPreservedModule moduleId={code}><Panel /></NewsPreservedModule>;');
    expect(route).toContain('<NewsResearchHub />');
    expect(layer).toContain('官方新闻与研究证据工作区'); expect(layer).toContain('当前筛选没有服务端实际读取的官方条目'); expect(layer).toContain('账户私有研究证据卡'); expect(layer).toContain('官方来源时效阈值提醒'); expect(layer).toContain('证据卡团队授权与审阅确认'); expect(layer).toContain('不提供离站核心路径'); expect(layer).not.toMatch(/href=|window\.open|location\.href/);
    expect(preserved).toContain('overflow-x-auto'); expect(preserved).toContain('min-w-[960px]'); expect(preserved).toContain('小视口可横向滚动原工作区以保持字段可读');
  });
});
