import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const feed = vi.hoisted(() => vi.fn());
vi.mock('./globalNewsFeed', async (importOriginal) => ({ ...await importOriginal<typeof import('./globalNewsFeed')>(), getGlobalNewsFeed: feed }));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), rename: vi.fn(), writeFile: vi.fn() }));
import { allowedNewsDocumentUrl, cleanNewsDocument, getGlobalNewsDocument } from './globalNewsDocument';

const paragraph = 'The policy committee reviewed price stability, employment and financial conditions. The published decision records the observed evidence and the effective date.';
const html = `<html><nav>MENU</nav><article><h1>Policy decision</h1><p>${paragraph}</p><p>${paragraph}</p><script>malicious()</script><a href="https://example.test">Read more</a></article><div>OUTSIDE ARTICLE</div></html>`;
const response = (body = html) => new Response(body, { headers: { 'content-type': 'text/html' } });

describe('terminal inline document', () => {
  beforeEach(() => { feed.mockReset(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => vi.unstubAllGlobals());
  it('only accepts exact HTTPS source hosts without credentials or unusual ports', () => {
    const site = 'https://www.ecb.europa.eu/';
    expect(allowedNewsDocumentUrl(`${site}press/decision.html`, site)).toBe(true);
    for (const url of ['http://www.ecb.europa.eu/a', 'https://www.ecb.europa.eu.attacker.test/a', 'https://user@www.ecb.europa.eu/a', 'https://www.ecb.europa.eu:9443/a', 'https://127.0.0.1/a', 'file:///tmp/a', 'garbage']) expect(allowedNewsDocumentUrl(url, site)).toBe(false);
  });
  it('extracts the bounded body, removes active/navigation text and repeated paragraphs', () => {
    const text = cleanNewsDocument(html);
    expect(text.split(paragraph)).toHaveLength(2);
    expect(text).not.toMatch(/MENU|malicious|OUTSIDE|https?:/);
    expect(cleanNewsDocument(`<div id="main-content"><p>${paragraph}</p></div><div>OUTSIDE</div>`)).toBe(paragraph);
  });
  it('decodes entities, strips visible URLs and preserves financial signs and symbols', () => {
    const text = cleanNewsDocument(`<main><p>${paragraph}</p><p>&euro;10 &amp; -2.5% &lt; 0 &#x3c3; https://example.test/a www.example.test</p></main>`);
    expect(text).toContain('€10 & -2.5% < 0 σ');
    expect(text).not.toMatch(/https?:|www\./);
  });
  it('rejects missing or implausibly short bodies instead of returning menus as content', () => {
    expect(() => cleanNewsDocument(`<body><div>${paragraph}</div></body>`)).toThrow('DOCUMENT_BODY_UNAVAILABLE');
    expect(() => cleanNewsDocument('<article>Unavailable</article>')).toThrow('DOCUMENT_BODY_UNAVAILABLE');
  });
  it('resolves the selected feed only, coalesces concurrent requests and keeps cached retrieval time', async () => {
    const key = 'a'.repeat(24);
    feed.mockResolvedValue({ rows: [{ sourceId: 'ecb', key, url: 'https://www.ecb.europa.eu/press/a', title: 'Decision', publishedAt: null }] });
    vi.mocked(fetch).mockResolvedValue(response());
    const [a, b] = await Promise.all([getGlobalNewsDocument('ecb', key), getGlobalNewsDocument('ecb', key)]);
    expect(feed).toHaveBeenCalledWith({ sourceId: 'ecb', limit: 200 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(await getGlobalNewsDocument('ecb', key)).toEqual(a);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveProperty('url');
  });
  it('rejects unknown items without fetching arbitrary URLs', async () => {
    await expect(getGlobalNewsDocument('unknown', 'b'.repeat(24))).rejects.toThrow('DOCUMENT_SOURCE_UNKNOWN');
    feed.mockResolvedValue({ rows: [] });
    await expect(getGlobalNewsDocument('ecb', 'b'.repeat(24))).rejects.toThrow('DOCUMENT_NOT_AVAILABLE');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('upgrades legacy feed links only on the configured host and never requests plaintext', async () => {
    const key = 'f'.repeat(24);
    feed.mockResolvedValue({ rows: [{ sourceId: 'boj_ja', key, url: 'http://www.boj.or.jp/about/news.htm', title: 'News' }] });
    vi.mocked(fetch).mockResolvedValue(response());
    expect((await getGlobalNewsDocument('boj_ja', key)).text).toContain(paragraph);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://www.boj.or.jp/about/news.htm');
    feed.mockResolvedValue({ rows: [{ sourceId: 'boj_ja', key: '1'.repeat(24), url: 'http://127.0.0.1/private' }] });
    await expect(getGlobalNewsDocument('boj_ja', '1'.repeat(24))).rejects.toThrow('DOCUMENT_NOT_AVAILABLE');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects cross-origin redirects before requesting their target and allows retry after failure', async () => {
    const key = 'c'.repeat(24);
    feed.mockResolvedValue({ rows: [{ sourceId: 'ecb', key, url: 'https://www.ecb.europa.eu/press/c', title: 'Decision', publishedAt: null }] });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } })).mockResolvedValueOnce(response());
    await expect(getGlobalNewsDocument('ecb', key)).rejects.toThrow('DOCUMENT_REDIRECT_REJECTED');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await getGlobalNewsDocument('ecb', key)).text).toContain(paragraph);
  });
  it('follows same-host redirects and rejects non-HTML bodies', async () => {
    const key = 'd'.repeat(24);
    feed.mockResolvedValue({ rows: [{ sourceId: 'ecb', key, url: 'https://www.ecb.europa.eu/press/d', title: 'Decision', publishedAt: null }] });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/press/new' } })).mockResolvedValueOnce(response());
    expect((await getGlobalNewsDocument('ecb', key)).text).toContain(paragraph);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('https://www.ecb.europa.eu/press/new');
    const other = 'e'.repeat(24);
    feed.mockResolvedValue({ rows: [{ sourceId: 'ecb', key: other, url: 'https://www.ecb.europa.eu/file.pdf' }] });
    vi.mocked(fetch).mockResolvedValue(new Response('PDF', { headers: { 'content-type': 'application/pdf' } }));
    await expect(getGlobalNewsDocument('ecb', other)).rejects.toThrow('DOCUMENT_FORMAT_UNSUPPORTED');
  });
});
