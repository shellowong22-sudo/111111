import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { GLOBAL_NEWS_SOURCES } from '../shared/globalNewsSources';
import { boundedFeedText, getGlobalNewsFeed } from './globalNewsFeed';

/** Accept only URLs resolved from a known feed, never an arbitrary client URL. */
export function allowedNewsDocumentUrl(raw: string, website: string) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === new URL(website).hostname && !url.username && !url.password && (!url.port || url.port === '443');
  } catch { return false; }
}

export function cleanNewsDocument(html: string) {
  const $ = load(html);
  $('script,style,nav,header,footer,aside,form,noscript,iframe,svg,[hidden],[aria-hidden="true"],.breadcrumb,.breadcrumbs,.share,.social-share,.cookie-banner').remove();
  // Select a bounded DOM subtree, never the remaining HTML after a div match.
  const body = $('article').first().length ? $('article').first() : $('main,[role="main"],#main-content,#mainContent,.article-body,.page-content,.content-area,#content').first();
  if (!body.length) throw new Error('DOCUMENT_BODY_UNAVAILABLE');
  body.find('br').replaceWith('\n');
  body.find('p,div,h1,h2,h3,h4,h5,h6,li,tr,section').append('\n');
  const text = body.text()
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, '').replace(/[ \t\u00a0]+/g, ' ')
    .split(/\n+/).map(line => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  const paragraphs = text.filter(line => { const key = line.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  if (paragraphs.join('').length < 100) throw new Error('DOCUMENT_BODY_UNAVAILABLE');
  return paragraphs.join('\n\n').slice(0, 60_000);
}

const cache = new Map<string, { at: number; value: Awaited<ReturnType<typeof readDocument>> }>();
const pending = new Map<string, Promise<Awaited<ReturnType<typeof readDocument>>>>();
async function readDocument(sourceId: string, key: string) {
  const source = GLOBAL_NEWS_SOURCES.find(item => item.id === sourceId);
  if (!source) throw new Error('DOCUMENT_SOURCE_UNKNOWN');
  const feed = await getGlobalNewsFeed({ sourceId, limit: 200 });
  const row = feed.rows.find(item => item.sourceId === sourceId && item.key === key);
  if (!row) throw new Error('DOCUMENT_NOT_AVAILABLE');
  // Some configured feeds still publish legacy HTTP links. Only upgrade the
  // exact configured host; never perform a plaintext request or widen trust.
  const candidate = new URL(row.url);
  if (candidate.protocol === 'http:' && candidate.hostname === new URL(source.websiteUrl).hostname && !candidate.port) candidate.protocol = 'https:';
  if (!allowedNewsDocumentUrl(candidate.href, source.websiteUrl)) throw new Error('DOCUMENT_NOT_AVAILABLE');
  let url = candidate.href;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { Accept: 'text/html,text/plain;q=0.9', 'User-Agent': 'Finance Hub document reader/1.0' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      const next = location ? new URL(location, url).href : '';
      if (!allowedNewsDocumentUrl(next, source.websiteUrl)) throw new Error('DOCUMENT_REDIRECT_REJECTED');
      url = next;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`DOCUMENT_HTTP_${response.status}`); }
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) { await response.body?.cancel(); throw new Error('DOCUMENT_FORMAT_UNSUPPORTED'); }
    const raw = await boundedFeedText(response, 2_000_000);
    const text = cleanNewsDocument(raw);
    const value = { key, title: row.title, publishedAt: row.publishedAt, retrievedAt: new Date().toISOString(), text, fingerprint: createHash('sha256').update(text).digest('hex'), rawFingerprint: createHash('sha256').update(raw).digest('hex') };
    const archiveRoot = path.resolve(process.cwd(), '.runtime', 'news-documents', source.id);
    await mkdir(archiveRoot, { recursive: true });
    const recordPath = path.join(archiveRoot, `${value.fingerprint}.json`);
    const tempPath = `${recordPath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify({ ...value, sourceId: source.id, sourceUrl: url, transformVersion: 1 }), 'utf8');
    await rename(tempPath, recordPath);
    return value;
  }
  throw new Error('DOCUMENT_REDIRECT_LIMIT');
}

export async function getGlobalNewsDocument(sourceId: string, key: string) {
  const id = `${sourceId}:${key}`;
  const stored = cache.get(id);
  if (stored && Date.now() - stored.at < 300_000) return stored.value;
  const active = pending.get(id);
  if (active) return active;
  const request = readDocument(sourceId, key).then(value => {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(id, { at: Date.now(), value });
    return value;
  });
  pending.set(id, request);
  try { return await request; } finally { pending.delete(id); }
}
