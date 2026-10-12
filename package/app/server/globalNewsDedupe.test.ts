import { describe, expect, it } from 'vitest';
import { deduplicateGlobalNews, type GlobalNewsRow } from './globalNewsFeed';
const row: GlobalNewsRow = { key: 'one', sourceId: 'ecb', institution: 'ECB', region: '欧洲', language: 'en', title: 'Policy decision', summary: 'Rates are unchanged.', publishedAt: '2026-09-19T10:00:00Z', url: 'https://example.test/one' };
describe('global news duplication boundary', () => {
  it('collapses tracking URLs and fragment variants of the same article', () => {
    expect(deduplicateGlobalNews([row, { ...row, key: 'two', url: row.url + '?utm_source=rss#top' }])).toEqual([row]);
  });
  it('collapses dated identical text across publishers but retains revisions and translations', () => {
    const copy = { ...row, key: 'two', url: 'https://second.test/article', title: '  POLICY   decision  ' };
    const revision = { ...copy, key: 'three', url: 'https://second.test/revision', summary: 'Rates are increased.' };
    const translation = { ...copy, key: 'four', url: 'https://second.test/fr', language: 'fr' };
    expect(deduplicateGlobalNews([row, copy, revision, translation])).toEqual([row, revision, translation]);
  });
  it('does not remove separate publications merely sharing a headline', () => {
    expect(deduplicateGlobalNews([row, { ...row, key: 'two', url: 'https://second.test/a', publishedAt: null, summary: '' }])).toHaveLength(2);
  });
});
