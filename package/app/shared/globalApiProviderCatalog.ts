/**
 * Global provider registry used for API planning and credential governance.
 *
 * A catalog entry is not a live connection.  `configured` stays false until
 * the server has a verified adapter, credentials (when required), a legal
 * usage flag and a successful observation.  This distinction prevents a
 * long provider list from being reported as hundreds of working APIs.
 */
export type GlobalApiProvider = {
  id: string;
  name: string;
  region: string;
  assetClasses: string[];
  access: 'public_no_key' | 'optional_key' | 'requires_key' | 'licensed';
  transport: 'rest' | 'csv' | 'sdmx' | 'rss' | 'python';
  endpointFamily: string;
  configured: boolean;
  legalBoundary: string;
};

const p = (entry: Omit<GlobalApiProvider, 'configured'>): GlobalApiProvider => ({ ...entry, configured: false });
const official = (id: string, name: string, region: string, assetClasses: string[], endpointFamily: string, transport: GlobalApiProvider['transport'] = 'rest') => p({ id, name, region, assetClasses, access: 'public_no_key', transport, endpointFamily, legalBoundary: '公开统计/披露读取；不提供可执行行情或受限逐笔数据。' });

/** Public and no-key candidates that can be verified independently. */
export const GLOBAL_API_PROVIDER_CATALOG: readonly GlobalApiProvider[] = [
  official('world-bank', 'World Bank Indicators', 'global', ['macro', 'development'], 'api.worldbank.org'),
  official('imf-sdmx', 'IMF SDMX', 'global', ['macro', 'fiscal', 'fx'], 'www.imf.org/external/datamapper'),
  official('eurostat', 'Eurostat Data Browser', 'europe', ['macro', 'trade', 'labour'], 'ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'),
  official('ecb-data', 'European Central Bank Data API', 'europe', ['rates', 'fx', 'macro'], 'data-api.ecb.europa.eu/service/data', 'sdmx'),
  official('fred-public', 'FRED public series', 'united-states', ['macro', 'rates', 'credit'], 'api.stlouisfed.org/fred/series/observations'),
  official('us-treasury-fiscal', 'U.S. Treasury Fiscal Data', 'united-states', ['rates', 'debt', 'fiscal'], 'api.fiscaldata.treasury.gov/services/api/fiscal_service'),
  official('sec-edgar', 'SEC EDGAR submissions and XBRL', 'united-states', ['equities', 'fundamentals', 'filings'], 'data.sec.gov'),
  official('bls-public', 'U.S. Bureau of Labor Statistics', 'united-states', ['labour', 'inflation'], 'api.bls.gov/publicAPI/v2'),
  official('bea-public', 'U.S. Bureau of Economic Analysis', 'united-states', ['gdp', 'income', 'trade'], 'apps.bea.gov/api/data'),
  official('census-economic', 'U.S. Census Economic Indicators', 'united-states', ['trade', 'housing', 'business'], 'api.census.gov/data'),
  official('eia-open', 'U.S. Energy Information Administration', 'united-states', ['energy', 'commodities'], 'api.eia.gov/v2'),
  official('federal-reserve-board', 'Federal Reserve Board Data Download', 'united-states', ['rates', 'balance-sheet'], 'www.federalreserve.gov/data.htm', 'csv'),
  official('oecd-sdmx', 'OECD SDMX', 'global', ['macro', 'trade', 'labour'], 'sdmx.oecd.org/public/rest/v1/data', 'sdmx'),
  official('bis-sdmx', 'Bank for International Settlements SDMX', 'global', ['rates', 'credit', 'banking'], 'stats.bis.org/api/v1/data', 'sdmx'),
  official('un-data', 'United Nations Data API', 'global', ['macro', 'trade', 'development'], 'data.un.org/Handlers/DownloadHandler.ashx', 'csv'),
  official('bank-of-england', 'Bank of England IADB', 'united-kingdom', ['rates', 'macro', 'fx'], 'www.bankofengland.co.uk/boeapps/database'),
  official('bank-of-japan', 'Bank of Japan Time-Series', 'japan', ['rates', 'macro', 'fx'], 'www.stat-search.boj.or.jp'),
  official('rba-statistics', 'Reserve Bank of Australia Statistics', 'australia', ['rates', 'macro', 'fx'], 'www.rba.gov.au/statistics'),
  official('bank-of-canada', 'Bank of Canada Valet', 'canada', ['rates', 'fx', 'macro'], 'www.bankofcanada.ca/valet'),
  official('snb-data', 'Swiss National Bank Data Portal', 'switzerland', ['rates', 'fx', 'macro'], 'data.snb.ch'),
  official('norges-bank', 'Norges Bank Data', 'norway', ['rates', 'fx', 'macro'], 'data.norges-bank.no'),
  official('openfigi', 'OpenFIGI instrument mapping', 'global', ['reference'], 'api.openfigi.com/v3/mapping'),
  official('coin-gecko-demo', 'CoinGecko demo market data', 'global', ['crypto'], 'api.coingecko.com/api/v3'),
  official('stooq-csv', 'Stooq delayed end-of-day CSV', 'global', ['equities', 'indices', 'fx'], 'stooq.com/q/d/l', 'csv'),
  official('nasdaq-data-link-public', 'Nasdaq Data Link public datasets', 'global', ['macro', 'commodities', 'rates'], 'data.nasdaq.com/api/v3'),
  p({ id: 'alpha-vantage', name: 'Alpha Vantage', region: 'global', assetClasses: ['equities', 'fx', 'crypto'], access: 'requires_key', transport: 'rest', endpointFamily: 'www.alphavantage.co/query', legalBoundary: '免费额度需要用户 Key；外部展示须核对许可。' }),
  p({ id: 'finnhub', name: 'Finnhub', region: 'global', assetClasses: ['equities', 'fx', 'crypto', 'news'], access: 'requires_key', transport: 'rest', endpointFamily: 'finnhub.io/api/v1', legalBoundary: '免费额度需要用户 Key；延迟和展示许可需单独核对。' }),
  p({ id: 'twelve-data', name: 'Twelve Data', region: 'global', assetClasses: ['equities', 'fx', 'crypto'], access: 'requires_key', transport: 'rest', endpointFamily: 'api.twelvedata.com', legalBoundary: '需要用户 Key；不得在无许可时宣称实时或可执行报价。' }),
  p({ id: 'eodhd', name: 'EODHD', region: 'global', assetClasses: ['equities', 'fundamentals', 'fx'], access: 'requires_key', transport: 'rest', endpointFamily: 'eodhd.com/financial-summary', legalBoundary: '需要用户 Key；免费/试用计划的展示范围需核对。' }),
  p({ id: 'fmp', name: 'Financial Modeling Prep', region: 'global', assetClasses: ['equities', 'fundamentals'], access: 'requires_key', transport: 'rest', endpointFamily: 'financialmodelingprep.com/api/v3', legalBoundary: '需要用户 Key与计划授权。' }),
  p({ id: 'polygon', name: 'Polygon', region: 'global', assetClasses: ['equities', 'options', 'fx', 'crypto'], access: 'requires_key', transport: 'rest', endpointFamily: 'api.polygon.io', legalBoundary: '需要用户 Key和市场数据许可。' }),
  p({ id: 'marketstack', name: 'Marketstack', region: 'global', assetClasses: ['equities', 'indices'], access: 'requires_key', transport: 'rest', endpointFamily: 'api.marketstack.com/v1', legalBoundary: '需要用户 Key和计划授权。' }),
  p({ id: 'trading-economics', name: 'Trading Economics', region: 'global', assetClasses: ['macro', 'markets', 'news'], access: 'requires_key', transport: 'rest', endpointFamily: 'api.tradingeconomics.com', legalBoundary: '需要用户 Key/许可；不得以目录当作已接入。' }),
  p({ id: 'akshare', name: 'AKShare', region: 'china', assetClasses: ['equities', 'macro', 'funds'], access: 'public_no_key', transport: 'python', endpointFamily: 'akshare Python adapters', legalBoundary: '网页聚合库，稳定性和再分发许可需逐源核对；默认不作为生产实时行情。' }),
  p({ id: 'yfinance', name: 'yfinance', region: 'global', assetClasses: ['equities', 'funds', 'fx'], access: 'public_no_key', transport: 'python', endpointFamily: 'Yahoo Finance community wrapper', legalBoundary: '社区封装且非官方；不得在未核对条款时用于对外行情。' }),
];

export const GLOBAL_API_PROVIDER_SUMMARY = {
  total: GLOBAL_API_PROVIDER_CATALOG.length,
  publicNoKey: GLOBAL_API_PROVIDER_CATALOG.filter(item => item.access === 'public_no_key').length,
  requiresKey: GLOBAL_API_PROVIDER_CATALOG.filter(item => item.access === 'requires_key' || item.access === 'optional_key').length,
  licensed: GLOBAL_API_PROVIDER_CATALOG.filter(item => item.access === 'licensed').length,
  configured: GLOBAL_API_PROVIDER_CATALOG.filter(item => item.configured).length,
  boundary: '候选供应商目录与真实接入分离；只有登记凭据、许可、字段契约并完成成功观察后才计为已配置。',
};

export function assertGlobalApiProviderCatalog() {
  const ids = GLOBAL_API_PROVIDER_CATALOG.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('GLOBAL_API_PROVIDER_DUPLICATE');
  return true;
}
