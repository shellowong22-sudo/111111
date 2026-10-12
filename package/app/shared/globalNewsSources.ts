/** Public institution RSS endpoints; no claim of licensed newswire coverage. */
export const GLOBAL_NEWS_SOURCES = [
  { id: 'ecb', name: '欧洲中央银行', region: '欧洲', language: 'en', feedUrl: 'https://www.ecb.europa.eu/rss/press.html', websiteUrl: 'https://www.ecb.europa.eu/' },
  { id: 'boe', name: '英格兰银行', region: '欧洲', language: 'en', feedUrl: 'https://www.bankofengland.co.uk/rss/news', websiteUrl: 'https://www.bankofengland.co.uk/' },
  { id: 'bis', name: '国际清算银行', region: '全球', language: 'en', feedUrl: 'https://www.bis.org/doclist/all_pressrels.rss', websiteUrl: 'https://www.bis.org/' },
  { id: 'rba', name: '澳大利亚储备银行', region: '亚太', language: 'en', feedUrl: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml', websiteUrl: 'https://www.rba.gov.au/' },
  { id: 'boj_ja', name: '日本银行 · 日文原文', region: '亚太', language: 'ja', feedUrl: 'https://www.boj.or.jp/rss/whatsnew.xml', websiteUrl: 'https://www.boj.or.jp/' },
  { id: 'boc_fr', name: '加拿大银行 · 法文原文', region: '美洲', language: 'fr', feedUrl: 'https://www.banqueducanada.ca/content_type/communiques/feed/', websiteUrl: 'https://www.banqueducanada.ca/' },
] as const;
