import { describe, expect, it, vi } from 'vitest';

const feed = vi.hoisted(() => vi.fn());
vi.mock('./globalNewsFeed', async importOriginal => ({
  ...await importOriginal<typeof import('./globalNewsFeed')>(),
  getGlobalNewsFeed: feed,
}));
import { newsResearchRouter } from './routers/newsResearch';

describe('terminal news API boundary', () => {
  it('keeps document keys and freshness while keeping source addresses server-side', async () => {
    const row = { key: 'a'.repeat(24), sourceId: 'ecb', institution: 'ECB', region: '欧洲', language: 'en', title: 'Policy decision', summary: 'The policy rate is 2%.', url: 'https://www.ecb.europa.eu/press/private-location', publishedAt: '2026-09-18T10:00:00Z' };
    const source = { id: 'ecb', name: 'ECB', feedUrl: 'https://www.ecb.europa.eu/rss/press.html', region: '欧洲', language: 'en', status: 'available', error: null, fetchedAt: '2026-09-19T01:00:00Z', latestPublishedAt: row.publishedAt, rowCount: 1, latencyMs: 100 };
    const original = { rows: [row], sources: [source], pollIntervalMs: 60_000, mode: 'official_rss_polling' };
    feed.mockResolvedValue(original);
    const caller = newsResearchRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    const result = await caller.getGlobalFeed({ language: 'all', region: 'all', keyword: '', limit: 100 });
    expect(result.rows).toEqual([{ ...row, url: '' }]);
    expect(result.sources[0]).not.toHaveProperty('feedUrl');
    expect(result.sources[0]).toMatchObject({ fetchedAt: source.fetchedAt, rowCount: 1 });
    expect(result.pollIntervalMs).toBe(60_000);
    expect(JSON.stringify(result)).not.toContain('https://');
    // Internal article retrieval and provenance must remain intact.
    expect(original.rows[0].url).toBe(row.url);
    expect(original.sources[0].feedUrl).toBe(source.feedUrl);
  });
});
