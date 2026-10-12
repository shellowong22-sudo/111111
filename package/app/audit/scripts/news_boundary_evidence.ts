import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Exercise the deployed API, not a direct import of the implementation.
const base = 'http://localhost:4173/api/trpc/';
async function query(name: string, input: unknown) {
  const response = await fetch(base + name + '?input=' + encodeURIComponent(JSON.stringify({ json: input })), { signal: AbortSignal.timeout(45_000) });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  const body = await response.json();
  assert.ok(body.result?.data?.json, `${name}: no result`);
  return body.result.data.json;
}
const feed = await query('newsResearch.getGlobalFeed', { language: 'all', region: 'all', keyword: '', limit: 200 });
assert.ok(feed.rows.length > 0, 'No actual feed rows');
assert.ok(feed.rows.every((row: any) => row.url === ''), 'Article URL exposed');
assert.ok(feed.sources.every((source: any) => !('feedUrl' in source)), 'Feed URL exposed');
assert.equal(new Set(feed.rows.map((row: any) => row.key)).size, feed.rows.length, 'Repeated article key');
const article = feed.rows.find((row: any) => row.sourceId === 'ecb');
assert.ok(article, 'No ECB sample for document retrieval');
const document = await query('newsResearch.getGlobalDocument', { sourceId: article.sourceId, key: article.key });
assert.ok(document.text.length > 100, 'Missing cleaned body');
assert.ok(!/https?:\/\/|www\./i.test(document.text), 'URL in cleaned body');
const economic = await query('legacyMarketData.getEconomicObservations', { group: 'ecsu' });
const evidence = {
  checkedAt: new Date().toISOString(),
  feed: { rows: feed.rows.length, uniqueKeys: new Set(feed.rows.map((row: any) => row.key)).size, articleUrlsExposed: 0, feedUrlsExposed: 0, pollIntervalMs: feed.pollIntervalMs, sources: feed.sources.map((source: any) => ({ id: source.id, status: source.status, rows: source.rowCount, fetchedAt: source.fetchedAt })) },
  document: { title: article.title, key: article.key, characters: document.text.length, fingerprint: document.fingerprint, retrievedAt: document.retrievedAt, containsUrl: false },
  economic: { group: 'ecsu', retrievedAt: economic.retrievedAt, series: economic.series.map((series: any) => ({ id: series.id, status: series.status, observations: series.history.length })) },
};
await writeFile('recovery-evidence/api-expansion-20260919/news-boundary-live.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
