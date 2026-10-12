import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getGlobalNewsFeed } from '../../server/globalNewsFeed';
import { getGlobalNewsDocument } from '../../server/globalNewsDocument';

const root = path.resolve('recovery-evidence/api-expansion-20260919');
await mkdir(root, { recursive: true });
const feed = await getGlobalNewsFeed({ limit: 200 });
const samples = await Promise.all(feed.sources.map(async source => {
  const rows = await getGlobalNewsFeed({ sourceId: source.id, limit: 200 });
  const row = rows.rows.find(item => !/\.pdf(?:\?|$)/i.test(item.url));
  if (!row) return { sourceId: source.id, status: 'unavailable', reason: source.error ?? 'No HTML item' };
  try {
    const result = await getGlobalNewsDocument(source.id, row.key);
    return { sourceId: source.id, key: row.key, title: row.title, status: 'available', characters: result.text.length, paragraphs: result.text.split('\n\n').length, hasUrl: /https?:\/\/|www\./i.test(result.text), fingerprint: result.fingerprint, retrievedAt: result.retrievedAt, excerpt: result.text.slice(0, 200) };
  } catch (error) { return { sourceId: source.id, key: row.key, status: 'unavailable', reason: error instanceof Error ? error.message : 'unknown' }; }
}));
const evidence = { checkedAt: new Date().toISOString(), returnedRows: feed.rows.length, feeds: feed.sources.map(({ feedUrl: _, ...source }) => source), samples };
await writeFile(path.join(root, 'news-inline-live.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
