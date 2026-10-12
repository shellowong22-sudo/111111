import { createHash } from 'node:crypto';
import { GLOBAL_NEWS_SOURCES } from '../shared/globalNewsSources';

type Source = typeof GLOBAL_NEWS_SOURCES[number];
export type GlobalNewsRow = { key: string; sourceId: string; institution: string; region: string; language: string; title: string; summary: string; url: string; publishedAt: string | null };
type SourceResult = { id: string; name: string; region: string; language: string; feedUrl: string; status: 'available' | 'unavailable'; error: string | null; fetchedAt: string; latestPublishedAt: string | null; rowCount: number; latencyMs: number; rows: GlobalNewsRow[] };
export function deduplicateGlobalNews(rows: GlobalNewsRow[]) {
  const identities = new Set<string>();
  const contents = new Set<string>();
  return rows.filter(row => {
    const identity = new URL(row.url);
    identity.hash = '';
    for (const name of [...identity.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(name)) identity.searchParams.delete(name);
    identity.searchParams.sort();
    const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    // Keep revisions and translations; only identical dated text is collapsed.
    const content = row.publishedAt && row.summary ? createHash('sha256').update([row.language, row.publishedAt, normalize(row.title), normalize(row.summary)].join('|')).digest('hex') : null;
    if (identities.has(identity.href) || (content && contents.has(content))) return false;
    identities.add(identity.href);
    if (content) contents.add(content);
    return true;
  });
}
const cache = new Map<string, { at: number; value: SourceResult }>();
const inFlight = new Map<string, Promise<SourceResult>>();
const CACHE_MS = 60_000;
const plain = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const field = (block: string, name: string) => plain(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '');

export async function boundedFeedText(response: Response, maxBytes = 4_000_000) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('FEED_TOO_LARGE');
  if (!response.body) throw new Error('SOURCE_EMPTY');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('FEED_TOO_LARGE'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

export function parseGlobalNewsFeed(xml: string, source: Source): GlobalNewsRow[] {
  const seen = new Set<string>();
  return [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].flatMap(match => {
    const block = match[1];
    const title = field(block, 'title');
    const atomLinks = [...block.matchAll(/<link\b([^>]*)>/gi)];
    const atomLink = atomLinks.find(link => /rel=["']alternate["']/.test(link[1])) ?? atomLinks[0];
    const rawUrl = field(block, 'link') || atomLink?.[1].match(/href=["']([^"']+)["']/i)?.[1];
    if (!title || !rawUrl) return [];
    let url: URL;
    try { url = new URL(rawUrl, source.websiteUrl); } catch { return []; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
    // Article retrieval validates the exact configured HTTPS host separately.
    url.hash = '';
    const key = createHash('sha256').update(url.href).digest('hex').slice(0, 24);
    if (seen.has(key)) return [];
    seen.add(key);
    const date = field(block, 'pubDate') || field(block, 'published') || field(block, 'updated') || field(block, 'dc:date');
    const ms = Date.parse(date);
    return [{ key, sourceId: source.id, institution: source.name, region: source.region, language: source.language, title: title.slice(0, 700), summary: (field(block, 'description') || field(block, 'summary')).slice(0, 1200), url: url.href, publishedAt: Number.isFinite(ms) ? new Date(ms).toISOString() : null }];
  });
}

async function readSource(source: Source): Promise<SourceResult> {
  const stored = cache.get(source.id);
  if (stored && Date.now() - stored.at < CACHE_MS) return stored.value;
  const pending = inFlight.get(source.id);
  if (pending) return pending;
  const request = (async () => {
    const started = Date.now();
    let rows: GlobalNewsRow[] = [];
    let error: string | null = null;
    try {
      const response = await fetch(source.feedUrl, { redirect: 'error', headers: { Accept: 'application/rss+xml,application/xml,text/xml', 'User-Agent': 'Finance Hub official RSS metadata reader/1.0' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const xml = await boundedFeedText(response);
      rows = parseGlobalNewsFeed(xml, source).slice(0, 100);
      if (!rows.length) throw new Error('SOURCE_EMPTY');
    } catch (e) { rows = []; error = e instanceof Error ? e.message : 'SOURCE_UNAVAILABLE'; }
    const value: SourceResult = { id: source.id, name: source.name, region: source.region, language: source.language, feedUrl: source.feedUrl, status: error ? 'unavailable' : 'available', error, fetchedAt: new Date().toISOString(), latestPublishedAt: rows.map(row => row.publishedAt).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null, rowCount: rows.length, latencyMs: Date.now() - started, rows };
    cache.set(source.id, { at: Date.now(), value });
    return value;
  })();
  inFlight.set(source.id, request);
  try { return await request; } finally { inFlight.delete(source.id); }
}

export async function getGlobalNewsFeed(input: { language?: string; region?: string; keyword?: string; limit?: number; sourceId?: string }) {
  const sources = await Promise.all(GLOBAL_NEWS_SOURCES.filter(source => !input.sourceId || source.id === input.sourceId).map(readSource));
  const keyword = input.keyword?.trim().toLowerCase() ?? '';
  const rows = deduplicateGlobalNews(sources.flatMap(source => source.rows).filter(row => (!input.language || input.language === 'all' || row.language === input.language) && (!input.region || input.region === 'all' || row.region === input.region) && (!keyword || `${row.title} ${row.summary}`.toLowerCase().includes(keyword))).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))).slice(0, Math.min(200, input.limit ?? 100));
  return { rows, sources: sources.map(({ rows: _, ...source }) => source), pollIntervalMs: CACHE_MS, mode: 'official_rss_polling' as const };
}
