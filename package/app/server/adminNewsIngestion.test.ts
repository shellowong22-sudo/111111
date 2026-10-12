import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverAdminNewsFeedUrl, getAdminNewsAutoDraftLimit, parseAdminNewsRss, validateAdminNewsRssEndpoint } from './adminNewsIngestion';

const source = {
  id: 3,
  name: '测试财经 RSS',
  provider: '测试提供方',
  feedUrl: 'https://example.test/feed.xml',
  sourceUrl: 'https://example.test',
  sourceType: 'rss' as const,
  isActive: true,
  maxItemsPerRun: 50,
  processingMode: 'queued' as const,
  scheduleCronTaskUid: null,
  lastFetchedAt: null,
  lastStatus: 'never' as const,
  lastError: null,
  createdByUserId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('管理员新闻 RSS 元数据解析', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('只提取可归属的标题、链接、发布日期和有限摘要', () => {
    const rows = parseAdminNewsRss(`<?xml version="1.0"?><rss><channel><item><guid>news-001</guid><title><![CDATA[市场标题 &amp; 更新]]></title><link>https://example.test/news/001</link><pubDate>Wed, 27 Aug 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>有限摘要内容。</p>]]></description></item></channel></rss>`, source);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sourceItemKey: 'news-001', sourceHeadline: '市场标题 & 更新', sourceUrl: 'https://example.test/news/001', sourceExcerpt: '有限摘要内容。' });
    expect(rows[0].sourcePublishedAt?.toISOString()).toBe('2026-08-27T10:00:00.000Z');
  });

  it('跳过没有标题的项目，避免生成无来源草稿', () => {
    const rows = parseAdminNewsRss('<rss><channel><item><guid>missing-title</guid><link>https://example.test/empty</link></item></channel></rss>', source);
    expect(rows).toEqual([]);
  });

  it('识别 Atom 自闭合 link href，保留其来源地址与项目标识', () => {
    const rows = parseAdminNewsRss('<?xml version="1.0"?><feed><entry><title>官方金融数据更新</title><link rel="alternate" href="https://data.example.test/release/1"/><id>release-1</id><updated>2026-08-27T00:00:00Z</updated><summary>有限摘要。</summary></entry></feed>', source);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sourceItemKey: 'release-1', sourceUrl: 'https://data.example.test/release/1', sourceHeadline: '官方金融数据更新', sourceExcerpt: '有限摘要。' });
  });

  it('只接受无凭据的公开 HTTPS RSS 地址，不将本地或普通 HTTP 地址作为可抓取来源', () => {
    expect(validateAdminNewsRssEndpoint('https://rss.example.test/feed.xml').valid).toBe(true);
    expect(validateAdminNewsRssEndpoint('http://rss.example.test/feed.xml')).toMatchObject({ valid: false, reason: 'RSS_URL_REQUIRES_HTTPS' });
    expect(validateAdminNewsRssEndpoint('https://127.0.0.1/feed.xml')).toMatchObject({ valid: false, reason: 'RSS_URL_MUST_USE_PUBLIC_HOST' });
    expect(validateAdminNewsRssEndpoint('https://user:secret@example.test/feed.xml')).toMatchObject({ valid: false, reason: 'RSS_URL_CREDENTIALS_NOT_ALLOWED' });
  });

  it('只从公开主页的标准 alternate 链接发现 RSS，不读取或保存网页正文', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body>不应被存储的页面正文</body></html>', { status: 200 })));
    await expect(discoverAdminNewsFeedUrl('https://finance.example.test/news')).resolves.toBe('https://finance.example.test/feed.xml');
  });

  it('允许直接提交公开 HTTPS RSS，并拒绝本地或非 HTTPS 网站网址', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<?xml version="1.0"?><rss><channel></channel></rss>', { status: 200 })));
    await expect(discoverAdminNewsFeedUrl('https://finance.example.test/feed.xml')).resolves.toBe('https://finance.example.test/feed.xml');
    await expect(discoverAdminNewsFeedUrl('http://finance.example.test')).rejects.toThrow('RSS_URL_REQUIRES_HTTPS');
    await expect(discoverAdminNewsFeedUrl('https://127.0.0.1/feed.xml')).rejects.toThrow('RSS_URL_MUST_USE_PUBLIC_HOST');
  });

  it('将已核验的新浪财经主页受限映射到公开 RSS，并先验证 XML 响应', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<?xml version="1.0"?><rss><channel><title>财经要闻</title></channel></rss>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(discoverAdminNewsFeedUrl('https://finance.sina.com.cn/')).resolves.toBe('https://rss.sina.com.cn/roll/finance/hot_roll.xml');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://rss.sina.com.cn/roll/finance/hot_roll.xml');
  });

  it('将 queued 来源的 RSS 元数据保留给管理员显式选择的审核生成模板，不在同步时自动消耗', () => {
    expect(getAdminNewsAutoDraftLimit('queued')).toBe(0);
    expect(getAdminNewsAutoDraftLimit('immediate')).toBeGreaterThan(0);
  });
});
