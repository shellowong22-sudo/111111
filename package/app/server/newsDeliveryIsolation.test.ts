import { describe, expect, it } from 'vitest';
import { resolveAdminDataModulesForPath } from '../shared/adminDataModules';
import { toPublicFeedItem, uniqueNewsDeliveries } from './adminModulePublicFeed';
import { boundedFeedText, parseGlobalNewsFeed } from './globalNewsFeed';
import { GLOBAL_NEWS_SOURCES } from '../shared/globalNewsSources';

describe('news delivery isolation and source truth', () => {
  it('limits streamed feeds before accumulating an oversized response', async () => {
    await expect(boundedFeedText(new Response('123456'), 5)).rejects.toThrow('FEED_TOO_LARGE');
    await expect(boundedFeedText(new Response('日本銀行'), 20)).resolves.toBe('日本銀行');
    await expect(boundedFeedText(new Response('small', { headers: { 'content-length': '100' } }), 5)).rejects.toThrow('FEED_TOO_LARGE');
  });
  const tabs = ['top','btdy','frnt','cn','read','ni','nh','firs','bi','beco','dayb','mag','media','medi','third','intl','commentary','opin','bnef','personal','myn','nlrt','nsub','mrep','nzpd','social','soci','tren','docs'];
  it('maps all 29 existing tabs to unique delivery namespaces without the hub broadcast', () => {
    const ids = tabs.map(tab => {
      const targets = resolveAdminDataModulesForPath(`/news-hub?tab=${tab}`);
      expect(targets, tab).toHaveLength(1);
      expect(targets[0].id).not.toBe('news-hub');
      return targets[0].id;
    });
    expect(new Set(ids).size).toBe(29);
    expect(resolveAdminDataModulesForPath('/news-hub?tab=not-found')).toEqual([]);
  });
  it('does not deliver GDP hub content into a child economic workspace', () => {
    expect(resolveAdminDataModulesForPath('/terminal?module=economics&open=eco').some(m => m.id === 'econ-hub')).toBe(false);
  });
  it('preserves NCEO as a reachable admin delivery target', () => {
    expect(resolveAdminDataModulesForPath('/terminal?module=derivatives&open=nceo').some(m => m.id === 'nceo' && m.name.includes('佑诚期权'))).toBe(true);
  });
  it('never launders simulated or mixed generated scores into factual news', () => {
    const row = { title: '金融监管机构公告', body: '多家监管机构公布了最新的公开政策文件。', sourceKind: 'real' };
    expect(toPublicFeedItem(row)).not.toBeNull();
    expect(toPublicFeedItem({ ...row, sourceKind: 'simulated' })).toBeNull();
    expect(toPublicFeedItem({ ...row, sourceKind: 'mixed', payload: { simulatedFields: ['score', 'ranking'] } })).toBeNull();
  });
  it('does not treat imported securities or unlinked macro releases as company news', () => {
    expect(toPublicFeedItem({ moduleId: 'news-cn', title: 'PAC.HM · 全球股票清单', body: '从用户提供的全球股票清单归一化导入。不含虚构行情', sourceKind: 'real' })).toBeNull();
    expect(toPublicFeedItem({ moduleId: 'news-cn', title: '央行工作组公告', body: '央行公布货币政策工作组负责人及工作目标。', category: '央行与宏观', sourceKind: 'real' })).toBeNull();
    expect(toPublicFeedItem({ moduleId: 'news-cn', title: 'Bank of England announces new office space in Leeds', body: 'The Bank of England has secured a new long-term premises in Leeds.', category: '其他', sourceKind: 'real' })).toBeNull();
    expect(toPublicFeedItem({ moduleId: 'news-cn', title: 'Company announces new manufacturing facility', body: 'The company announced a new manufacturing facility and provided the expected completion window.', payload: { symbol: 'ABC' }, sourceKind: 'real' })).not.toBeNull();
  });
  it('assigns duplicate article bodies to a single news workspace but retains unique articles', () => {
    const common = { title: '美联储政策公告', body: '美联储公布货币政策工作组负责人及工作目标。', sourceKind: 'real' };
    const rows = [{ ...common, id: 1, moduleId: 'news-btdy' }, { ...common, id: 2, moduleId: 'news-frnt' }, { ...common, id: 3, moduleId: 'news-top' }, { ...common, id: 4, moduleId: 'news-frnt', body: '英格兰银行发布新的公开市场操作安排与结算时间表。' }];
    expect(uniqueNewsDeliveries(rows, rows).map(row => row.id)).toEqual([3, 4]);
  });
  it('parses RDF dates, removes duplicate URLs and rejects executable article links', () => {
    const xml = '<rss><item><title>原始公告</title><link>https://www.boj.or.jp/a</link><dc:date>2026-09-18T09:00:00+09:00</dc:date></item><item><title>重复公告</title><link>https://www.boj.or.jp/a#top</link></item><item><title>bad</title><link>javascript:alert(1)</link></item></rss>';
    const rows = parseGlobalNewsFeed(xml, GLOBAL_NEWS_SOURCES[4]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: '原始公告', language: 'ja', publishedAt: '2026-09-18T00:00:00.000Z' });
  });
  it('parses Atom alternate links without inventing dates', () => {
    const rows = parseGlobalNewsFeed('<feed><entry><title>Publication</title><link rel="alternate" href="https://www.ecb.europa.eu/press/a" /></entry></feed>', GLOBAL_NEWS_SOURCES[0]);
    expect(rows[0]).toMatchObject({ url: 'https://www.ecb.europa.eu/press/a', publishedAt: null });
  });
  it('decodes RSS text entities without rendering source HTML', () => {
    const rows = parseGlobalNewsFeed('<rss><item><title><![CDATA[Rate 2¼&nbsp;%]]></title><link>https://www.banqueducanada.ca/test</link><description><![CDATA[<b>Decision</b> &amp; data]]></description></item></rss>', GLOBAL_NEWS_SOURCES[5]);
    expect(rows[0].title).toBe('Rate 2¼ %');
    expect(rows[0].summary).toBe('Decision & data');
  });
});
