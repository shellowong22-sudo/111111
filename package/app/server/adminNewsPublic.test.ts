import { describe, expect, it } from 'vitest';
import { toPublicPublishedAdminNews } from './adminNewsPublic';

describe('toPublicPublishedAdminNews', () => {
  it('保留冻结新闻 feed 字段并移除后台与爬虫内部字段', () => {
    const result = toPublicPublishedAdminNews({
      id: 28, sourceId: 99, sourceHeadline: '官方来源标题', sourceUrl: 'https://example.gov/news/28',
      sourcePublishedAt: new Date('2026-08-28T00:00:00.000Z'), retrievedAt: new Date('2026-08-28T00:01:00.000Z'),
      aiTitle: '审核后的站内标题', aiSummary: '审核后的站内摘要，供现有新闻 feed 展示。', category: '政策', sentiment: 'neutral', tickers: ['ABC'], publishedAt: new Date('2026-08-28T00:02:00.000Z'),
      aiModel: 'internal-model', processingError: 'secret error detail', reviewedByUserId: 7, publishedByUserId: 7, taskId: 123, sourceKind: 'crawler', processingMode: 'queued', crawlerConfig: { ipPool: 'internal' },
    }, '官方来源', '官方 RSS');
    expect(result).toMatchObject({ id: 28, title: '审核后的站内标题', summary: '审核后的站内摘要，供现有新闻 feed 展示。', category: '政策', sentiment: 'neutral' });
    expect(JSON.stringify(result)).not.toMatch(/source|provider|retrievedAt|https:|aiModel/i);
    for (const key of ['sourceId', 'aiModel', 'processingError', 'reviewedByUserId', 'publishedByUserId', 'taskId', 'sourceKind', 'processingMode', 'crawlerConfig']) expect(result).not.toHaveProperty(key);
  });
});
