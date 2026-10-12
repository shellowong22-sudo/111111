/**
 * Public, no-key market-data adapters.
 *
 * These adapters are deliberately small and evidence-first: they return only
 * observations received from a named public provider.  A failed request is an
 * explicit unavailable result; no synthetic price, random walk or stale value
 * is produced to make a panel look populated.
 */
import { fetchEiaWeeklyPetroleumHistory, type EiaWeeklyPetroleumId } from "./eiaWeeklyPetroleum";
import { fetchEiaWeeklyNaturalGasHistory } from "./eiaWeeklyNaturalGas";

export type FreeObservation = {
  date: string;
  value: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

export type FreeSeriesResult = {
  available: boolean;
  symbol: string;
  source:
    | "Stooq public CSV"
    | "ECB Data Portal EXR"
    | "NY Fed Markets API"
    | "FRED public CSV"
    | "World Bank Indicators API"
    | "U.S. BLS Public Data API"
    | "U.S. EIA Open Data"
    | "U.S. EIA Weekly Petroleum"
    | "U.S. EIA Weekly Natural Gas"
    | "U.S. Treasury Fiscal Data API"
    | "IMF DataMapper API"
    | "Eurostat Dissemination API"
    | "Bank of Canada Valet API"
    | "Hong Kong Monetary Authority public exchange-rate API"
    | "FinMind API";
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus:
    | "end_of_day"
    | "official_reference"
    | "latest_public_release"
    | "unavailable";
  history: FreeObservation[];
  limitation: string;
};

export type FreeFxResult = {
  available: boolean;
  pair: string;
  rate: number | null;
  change: number | null;
  changePct: number | null;
  source: "ECB Data Portal EXR" | "Yahoo Finance public chart";
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "official_reference" | "end_of_day" | "unavailable";
  limitation: string;
};

export type HkmaExchangeObservation = {
  date: string;
  usd: number | null;
  eur: number | null;
  cny: number | null;
  jpy: number | null;
  index: number | null;
};

export type HkmaExchangeResult = {
  available: boolean;
  source: "Hong Kong Monetary Authority public exchange-rate API";
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "official_reference" | "unavailable";
  observations: HkmaExchangeObservation[];
  limitation: string;
};

export type BankOfCanadaFxResult = {
  available: boolean;
  pair: string;
  source: "Bank of Canada Valet API";
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "official_reference" | "unavailable";
  history: FreeObservation[];
  limitation: string;
};

export type FreeCompanyFact = {
  taxonomy: string;
  tag: string;
  label: string | null;
  unit: string;
  value: number;
  startDate: string | null;
  endDate: string | null;
  filedAt: string | null;
  form: string | null;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  frame: string | null;
  accessionNumber: string | null;
};

export type FreeCompanyFactsResult = {
  available: boolean;
  cik: string;
  source: "SEC EDGAR Company Facts";
  sourceUrl: string;
  retrievedAt: string;
  observedAt: string | null;
  realtime: false;
  delayStatus: "latest_public_release" | "unavailable";
  facts: FreeCompanyFact[];
  limitation: string;
};

export type FreeMarketDataSource = {
  id:
    | "stooq"
    | "fred"
    | "ecb-exr"
    | "ny-fed"
    | "sec-edgar"
    | "world-bank"
    | "bls"
    | "eia"
    | "treasury-fiscal-data"
    | "imf-datamapper"
    | "eurostat"
    | "hkma-exchange"
    | "bank-of-canada-valet";
  provider: string;
  assetClasses: string[];
  access: "public_no_key";
  realtime: false;
  endpoint: string;
  updateBoundary: string;
  limitation: string;
};

export type OptionalMarketDataSource = {
  id: string;
  provider: string;
  assetClasses: string[];
  access: "free_tier_api_key";
  realtime: "plan_dependent";
  endpoint: string;
  apiKeyEnvName: string;
  updateBoundary: "plan_dependent";
  adapterStatus: "implemented" | "catalog_only";
  mosoCompatible: boolean;
  limitation: string;
};

export type TwelveDataSeriesResult = {
  available: boolean;
  configured: boolean;
  symbol: string;
  source: "Twelve Data";
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "plan_dependent" | "unavailable";
  history: FreeObservation[];
  limitation: string;
};

export type AlphaVantageSeriesResult = {
  available: boolean;
  configured: boolean;
  symbol: string;
  source: "Alpha Vantage";
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "end_of_day" | "unavailable";
  history: FreeObservation[];
  limitation: string;
};

const STOOQ_BASE = "https://stooq.com/q/d/l/";
const ECB_BASE = "https://data-api.ecb.europa.eu/service/data/EXR";
const NYFED_RATES_BASE = "https://markets.newyorkfed.org/api/rates";
const NYFED_LATEST = `${NYFED_RATES_BASE}/all/latest.json`;
const FRED_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const SEC_FACTS_BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const WORLD_BANK_BASE = "https://api.worldbank.org/v2/country";
const BLS_BASE = "https://api.bls.gov/publicAPI/v2/timeseries/data";
const EIA_BASE = "https://api.eia.gov/v2";
const TREASURY_FISCAL_BASE =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2";
const IMF_DATA_MAPPER_BASE = "https://www.imf.org/external/datamapper/api/v1";
const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
const BANK_OF_CANADA_VALET_BASE = "https://www.bankofcanada.ca/valet/observations";

/**
 * A single provider registry for the no-key connectors.  This is metadata,
 * not a quote cache: no value is embedded here and every adapter still
 * returns the provider timestamp and an explicit freshness boundary.
 */
export function listFreeMarketDataSources(): FreeMarketDataSource[] {
  return [
    {
      id: "stooq",
      provider: "Stooq public CSV",
      assetClasses: ["equity", "etf", "index", "fx", "commodity"],
      access: "public_no_key",
      realtime: false,
      endpoint: STOOQ_BASE,
      updateBoundary: "end_of_day",
      limitation:
        "免费日线 OHLCV；不提供实时 bid/ask、逐笔、盘口或可执行报价。",
    },
    {
      id: "fred",
      provider: "FRED public CSV",
      assetClasses: ["macro", "rates", "credit_spread"],
      access: "public_no_key",
      realtime: false,
      endpoint: FRED_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "公开发布序列；频率和修订规则由具体 series 定义，不等于实时行情。",
    },
    {
      id: "ecb-exr",
      provider: "ECB Data Portal EXR",
      assetClasses: ["fx"],
      access: "public_no_key",
      realtime: false,
      endpoint: ECB_BASE,
      updateBoundary: "official_reference",
      limitation: "官方参考汇率；不是实时交易 bid/ask、点差或可执行报价。",
    },
    {
      id: "ny-fed",
      provider: "NY Fed Markets API",
      assetClasses: ["money_market", "repo", "rates"],
      access: "public_no_key",
      realtime: false,
      endpoint: NYFED_LATEST,
      updateBoundary: "latest_public_release",
      limitation: "公开资金市场参考记录；不代表全市场实时成交或账户融资成本。",
    },
    {
      id: "sec-edgar",
      provider: "SEC EDGAR Company Facts",
      assetClasses: ["equity", "fundamental", "filings"],
      access: "public_no_key",
      realtime: false,
      endpoint: SEC_FACTS_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "监管申报事实字段；有申报滞后、重述和口径差异，不是实时价格、盈利预测或投资建议。",
    },
    {
      id: "world-bank",
      provider: "World Bank Indicators API",
      assetClasses: ["macro", "country", "development", "demographic"],
      access: "public_no_key",
      realtime: false,
      endpoint: WORLD_BANK_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "世界银行公开国家指标；通常按年或季度发布且可能修订，不是实时市场行情。",
    },
    {
      id: "bls",
      provider: "U.S. BLS Public Data API",
      assetClasses: ["macro", "labor", "inflation", "wages", "productivity"],
      access: "public_no_key",
      realtime: false,
      endpoint: BLS_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "美国劳工统计局公开发布序列；频率与修订以序列元数据为准，不是实时市场报价。",
    },
    {
      id: "eia",
      provider: "U.S. EIA Open Data",
      assetClasses: [
        "energy",
        "commodity",
        "inventory",
        "production",
        "electricity",
      ],
      access: "public_no_key",
      realtime: false,
      endpoint: EIA_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "EIA 公开能源数据（DEMO_KEY）；频率与修订以具体序列为准，不是实时可执行商品报价。",
    },
    {
      id: "treasury-fiscal-data",
      provider: "U.S. Treasury Fiscal Data API",
      assetClasses: ["sovereign", "fiscal", "public_debt"],
      access: "public_no_key",
      realtime: false,
      endpoint: TREASURY_FISCAL_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "美国财政部官方财政发布；按记录日期更新，不是国债逐笔、持有人分布、价格或可执行报价。",
    },
    {
      id: "imf-datamapper",
      provider: "IMF DataMapper API",
      assetClasses: ["macro", "country", "forecast", "inflation"],
      access: "public_no_key",
      realtime: false,
      endpoint: IMF_DATA_MAPPER_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "IMF 公开宏观序列；历史、估计与预测边界取决于当前 WEO 版本，不是实时数据或市场一致预期。",
    },
    {
      id: "eurostat",
      provider: "Eurostat Dissemination API",
      assetClasses: ["macro", "labor", "inflation", "trade", "country"],
      access: "public_no_key",
      realtime: false,
      endpoint: EUROSTAT_BASE,
      updateBoundary: "latest_public_release",
      limitation:
        "欧盟统计局公开统计发布；数据可能修订，频率和季调口径由具体数据集决定，不是实时市场行情。",
    },
    {
      id: "hkma-exchange",
      provider: "Hong Kong Monetary Authority public exchange-rate API",
      assetClasses: ["fx", "reference"],
      access: "public_no_key",
      realtime: false,
      endpoint: "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily",
      updateBoundary: "official_reference",
      limitation:
        "香港金管局公开每日参考汇率；不是实时交易 bid/ask、点差或可执行报价。",
    },
    {
      id: "bank-of-canada-valet",
      provider: "Bank of Canada Valet API",
      assetClasses: ["fx", "rates", "macro"],
      access: "public_no_key",
      realtime: false,
      endpoint: "https://www.bankofcanada.ca/valet/observations",
      updateBoundary: "official_reference",
      limitation:
        "加拿大央行公开参考序列；频率和单位由 series 定义，不是实时交易报价。",
    },
  ];
}

/**
 * Providers with a documented free tier but an account/API key.  They are
 * listed separately from the no-key catalogue so an absent secret can never
 * be mistaken for a working live feed.
 */
export function listOptionalMarketDataSources(): OptionalMarketDataSource[] {
  return [
    {
      id: "twelve-data",
      provider: "Twelve Data",
      assetClasses: [
        "us_equity",
        "us_etf",
        "forex",
        "crypto",
        "reference",
        "technical_indicator",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.twelvedata.com/time_series",
      apiKeyEnvName: "TWELVE_DATA_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "implemented",
      mosoCompatible: false,
      limitation:
        "官方 Basic 免费层为 8 API credits、每日 800 次；覆盖美股/ETF、外汇、加密及参考/技术指标，其他市场、固定收益和再分发权限受套餐约束。未配置密钥时保持不可用。",
    },
    {
      id: "alpha-vantage",
      provider: "Alpha Vantage",
      assetClasses: [
        "equity",
        "fx",
        "crypto",
        "commodity",
        "macro",
        "technical_indicator",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://www.alphavantage.co/query",
      apiKeyEnvName: "ALPHA_VANTAGE_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "implemented",
      mosoCompatible: false,
      limitation:
        "官方免费密钥覆盖多数数据集、每日 25 次请求；美股实时及 15 分钟延迟数据为付费许可。本目录不把免费日线标记为实时行情。",
    },
    {
      id: "massive-options",
      provider: "Massive (Polygon) Market Data",
      assetClasses: [
        "us_equity",
        "options",
        "options_chain",
        "options_trades",
        "reference",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.massive.com/v3/reference/options/contracts",
      apiKeyEnvName: "MASSIVE_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: true,
      limitation:
        "MOSO 候选源。期权合约、成交、报价及历史权限取决于订阅和交易所许可；当前只登记合同，未配置密钥或字段适配时不产生行情。",
    },
    {
      id: "tradier",
      provider: "Tradier Brokerage Market Data",
      assetClasses: [
        "us_equity",
        "options",
        "options_chain",
        "options_quotes",
        "greeks",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.tradier.com/v1/markets/options/chains",
      apiKeyEnvName: "TRADIER_ACCESS_TOKEN",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: true,
      limitation:
        "MOSO 候选源。市场数据时效、Greeks 和可再分发范围受账户、协议及套餐限制；仅在真实响应验证后启用。",
    },
    {
      id: "intrinio-options",
      provider: "Intrinio Financial Data",
      assetClasses: [
        "equity",
        "options",
        "options_chain",
        "options_prices",
        "greeks",
        "fundamentals",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api-v2.intrinio.com/options/chain",
      apiKeyEnvName: "INTRINIO_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: true,
      limitation:
        "MOSO 候选源。期权实时、历史、Greeks 与交易所费用按许可提供；当前目录不表示已购买或可再分发。",
    },
    {
      id: "marketdata-app-options",
      provider: "Market Data API",
      assetClasses: [
        "us_equity",
        "options",
        "options_chain",
        "options_quotes",
        "indices",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.marketdata.app/v1/options/chain",
      apiKeyEnvName: "MARKETDATA_APP_TOKEN",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: true,
      limitation:
        "MOSO 候选源。免费额度和延迟边界按提供方计划执行；缺少令牌时仅保留接口合同。",
    },
    {
      id: "finnhub",
      provider: "Finnhub",
      assetClasses: [
        "equity",
        "forex",
        "crypto",
        "company_news",
        "fundamentals",
        "economic_calendar",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://finnhub.io/api/v1",
      apiKeyEnvName: "FINNHUB_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "免费和付费计划的频率、市场覆盖及再分发权不同；保存合同不等于行情已授权。",
    },
    {
      id: "financial-modeling-prep",
      provider: "Financial Modeling Prep",
      assetClasses: [
        "equity",
        "etf",
        "index",
        "forex",
        "crypto",
        "fundamentals",
        "news",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://financialmodelingprep.com/stable",
      apiKeyEnvName: "FMP_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "端点、频率和历史深度受套餐约束；当前为待适配合同，不会替代已验证来源。",
    },
    {
      id: "nasdaq-data-link",
      provider: "Nasdaq Data Link",
      assetClasses: [
        "economic",
        "fundamentals",
        "futures",
        "commodities",
        "alternative_data",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://data.nasdaq.com/api/v3",
      apiKeyEnvName: "NASDAQ_DATA_LINK_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "各数据集许可证、费用和更新频率独立；目录仅登记 API 合同，不宣称任一付费数据集已授权。",
    },
    {
      id: "tiingo",
      provider: "Tiingo",
      assetClasses: [
        "equity",
        "fundamentals",
        "news",
        "forex",
        "crypto",
        "iex_prices",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.tiingo.com",
      apiKeyEnvName: "TIINGO_API_TOKEN",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "覆盖与时效取决于计划和数据协议；未通过专用适配器验证前保持不可用。",
    },
    {
      id: "eodhd",
      provider: "EOD Historical Data",
      assetClasses: [
        "global_equity",
        "etf",
        "fund",
        "forex",
        "bond",
        "fundamentals",
        "news",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://eodhd.com/api",
      apiKeyEnvName: "EODHD_API_TOKEN",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "全球交易所覆盖、实时延迟与再分发权按套餐区分；当前仅登记配置入口。",
    },
    {
      id: "marketstack",
      provider: "Marketstack",
      assetClasses: [
        "global_equity",
        "intraday",
        "eod",
        "exchanges",
        "tickers",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.marketstack.com/v2",
      apiKeyEnvName: "MARKETSTACK_ACCESS_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "免费层、日内时效和市场覆盖受计划限制；合同未适配时不会产生终端数据。",
    },
    {
      id: "alpaca-market-data",
      provider: "Alpaca Market Data",
      assetClasses: [
        "us_equity",
        "options",
        "options_contracts",
        "crypto",
        "news",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://data.alpaca.markets/v2",
      apiKeyEnvName: "ALPACA_API_KEY_ID",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: true,
      limitation:
        "MOSO 候选源。SIP/IEX、期权与历史访问受账户和订阅约束；还需配套密钥 Secret，单一变量检测不等于连接可用。",
    },
    {
      id: "eia-open-data",
      provider: "U.S. EIA Open Data",
      assetClasses: [
        "energy",
        "commodity",
        "inventory",
        "production",
        "electricity",
      ],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.eia.gov/v2",
      apiKeyEnvName: "EIA_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "官方发布数据而非实时可执行商品报价；序列频率与修订以 EIA 元数据为准。",
    },
    {
      id: "bls-public-data",
      provider: "U.S. BLS Public Data API",
      assetClasses: ["macro", "labor", "inflation", "wages", "productivity"],
      access: "free_tier_api_key",
      realtime: "plan_dependent",
      endpoint: "https://api.bls.gov/publicAPI/v2/timeseries/data",
      apiKeyEnvName: "BLS_API_KEY",
      updateBoundary: "plan_dependent",
      adapterStatus: "catalog_only",
      mosoCompatible: false,
      limitation:
        "官方宏观发布数据；注册密钥用于更高请求限额，不代表实时市场数据。",
    },
  ];
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || normalized === "." || normalized.toLowerCase() === "nan")
    return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const timestamp = Date.parse(`${trimmed}T00:00:00Z`);
  return Number.isFinite(timestamp) ? trimmed : null;
}

function csvFields(line: string): string[] {
  // The public feeds used here are simple CSV; retain quoted commas correctly
  // so an upstream label cannot shift numeric columns.
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

async function fetchText(
  url: string,
  timeoutMs = 12_000,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/csv, application/json;q=0.9, */*",
      "user-agent": "FinanceHub/1.0 public-data-reader",
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.text();
}

function emptySeries(
  symbol: string,
  source: FreeSeriesResult["source"],
  sourceUrl: string,
  delayStatus: FreeSeriesResult["delayStatus"],
  limitation: string
): FreeSeriesResult {
  return {
    available: false,
    symbol,
    source,
    sourceUrl,
    observedAt: null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "unavailable",
    history: [],
    limitation,
  };
}

/** Stooq daily OHLCV CSV.  It is a free end-of-day source, not a live quote. */
export async function fetchStooqDailySeries(
  symbol: string,
  limit = 252
): Promise<FreeSeriesResult> {
  const normalized = symbol.trim().toLowerCase();
  const sourceUrl = `${STOOQ_BASE}?s=${encodeURIComponent(normalized)}&i=d`;
  if (!normalized || !/^[a-z0-9.^=_-]+$/.test(normalized))
    return emptySeries(
      symbol,
      "Stooq public CSV",
      sourceUrl,
      "unavailable",
      "代码格式不受公开 Stooq 适配器支持；未发出请求。"
    );
  try {
    const text = await fetchText(sourceUrl);
    if (/^\s*<!doctype html|<html[\s>]/i.test(text))
      return emptySeries(
        normalized,
        "Stooq public CSV",
        sourceUrl,
        "unavailable",
        "Stooq 当前返回浏览器校验页面；服务端采集不可用，系统未绕过校验或生成替代行情。"
      );
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length < 2)
      return emptySeries(
        symbol,
        "Stooq public CSV",
        sourceUrl,
        "end_of_day",
        "Stooq 未返回可验证日线记录。"
      );
    const header = csvFields(lines[0]).map(value => value.trim().toLowerCase());
    const index = (name: string) => header.indexOf(name);
    const dateIndex = index("date");
    const closeIndex = index("close");
    if (dateIndex < 0 || closeIndex < 0)
      return emptySeries(
        symbol,
        "Stooq public CSV",
        sourceUrl,
        "end_of_day",
        "Stooq 返回字段缺少 date 或 close，未将内容解释为行情。"
      );
    const points = lines
      .slice(1)
      .map((line): FreeObservation | null => {
        const fields = csvFields(line);
        const date = isoDate(fields[dateIndex]);
        const close = finiteNumber(fields[closeIndex]);
        if (!date || close === null) return null;
        const valueAt = (name: string) => {
          const position = index(name);
          return position < 0 ? null : finiteNumber(fields[position]);
        };
        return {
          date,
          value: close,
          open: valueAt("open"),
          high: valueAt("high"),
          low: valueAt("low"),
          close,
          volume: valueAt("volume"),
        };
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const history = points.slice(
      -Math.min(Math.max(Math.floor(limit), 1), 5_000)
    );
    return {
      available: history.length > 0,
      symbol: symbol.trim().toUpperCase(),
      source: "Stooq public CSV",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: history.length ? "end_of_day" : "unavailable",
      history,
      limitation: history.length
        ? "Stooq 免费日线仅为收盘级公开观察；不包含实时 bid/ask、逐笔、盘口或可执行报价。"
        : "Stooq 本次没有返回可验证日线；系统未使用静态或合成数据替代。",
    };
  } catch (error) {
    return emptySeries(
      symbol,
      "Stooq public CSV",
      sourceUrl,
      "end_of_day",
      `Stooq 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

/** World Bank public country indicators, preserving release frequency. */
export async function fetchWorldBankIndicator(
  country: string,
  indicator: string,
  limit = 60
): Promise<FreeSeriesResult> {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedIndicator = indicator.trim().toUpperCase();
  const perPage = Math.min(Math.max(Math.floor(limit), 1), 1000);
  const sourceUrl = `${WORLD_BANK_BASE}/${encodeURIComponent(normalizedCountry)}/indicator/${encodeURIComponent(normalizedIndicator)}?format=json&per_page=${perPage}`;
  if (
    !/^[A-Z0-9]{2,3}$/.test(normalizedCountry) ||
    !/^[A-Z][A-Z0-9.]{1,79}$/.test(normalizedIndicator)
  )
    return emptySeries(
      `${normalizedCountry}:${normalizedIndicator}`,
      "World Bank Indicators API",
      sourceUrl,
      "unavailable",
      "世界银行国家代码或指标代码格式无效；未发出请求。"
    );
  try {
    const payload = JSON.parse(await fetchText(sourceUrl, 15_000)) as unknown;
    const rows =
      Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
    const points = rows
      .map((row): FreeObservation | null => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const record = row as Record<string, unknown>;
        const period =
          typeof record.date === "string" &&
          /^\d{4}(?:Q[1-4])?$/.test(record.date)
            ? record.date
            : null;
        const value = finiteNumber(record.value);
        return period && value !== null ? { date: period, value } : null;
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const history = points.slice(-perPage);
    if (!history.length)
      return emptySeries(
        `${normalizedCountry}:${normalizedIndicator}`,
        "World Bank Indicators API",
        sourceUrl,
        "latest_public_release",
        "世界银行未返回可验证观察；系统未把空值解释为零。"
      );
    return {
      available: true,
      symbol: `${normalizedCountry}:${normalizedIndicator}`,
      source: "World Bank Indicators API",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history,
      limitation:
        "世界银行公开国家指标，频率、发布日期和修订政策由具体指标定义；不是实时市场报价。",
    };
  } catch (error) {
    return emptySeries(
      `${normalizedCountry}:${normalizedIndicator}`,
      "World Bank Indicators API",
      sourceUrl,
      "unavailable",
      `世界银行请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

/** BLS public v2 observations. No registration key is required for the public quota. */
export async function fetchBlsPublicSeries(
  seriesId: string,
  startYear = new Date().getUTCFullYear() - 5,
  endYear = new Date().getUTCFullYear(),
  limit = 240
): Promise<FreeSeriesResult> {
  const normalized = seriesId.trim().toUpperCase();
  const sourceUrl = BLS_BASE;
  if (!/^[A-Z0-9]{4,32}$/.test(normalized))
    return emptySeries(
      normalized || seriesId,
      "U.S. BLS Public Data API",
      sourceUrl,
      "unavailable",
      "BLS 序列代码格式无效；未发出请求。"
    );
  const from = Math.max(
    1900,
    Math.min(Math.trunc(startYear), new Date().getUTCFullYear())
  );
  const to = Math.max(
    from,
    Math.min(Math.trunc(endYear), new Date().getUTCFullYear())
  );
  try {
    const response = await fetch(sourceUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "FinanceHub/1.0 public-data-reader",
      },
      body: JSON.stringify({
        seriesid: [normalized],
        startyear: String(from),
        endyear: String(to),
        ...(process.env.BLS_API_KEY?.trim()
          ? { registrationkey: process.env.BLS_API_KEY.trim() }
          : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = (await response.json()) as {
      status?: unknown;
      Results?: { series?: Array<{ seriesID?: unknown; data?: unknown[] }> };
    };
    const rows =
      payload.Results?.series?.find(row => row.seriesID === normalized)?.data ??
      [];
    const points = rows
      .map((row): FreeObservation | null => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const item = row as Record<string, unknown>;
        const year =
          typeof item.year === "string" && /^\d{4}$/.test(item.year)
            ? item.year
            : null;
        const period = typeof item.period === "string" ? item.period : "";
        const periodName =
          typeof item.periodName === "string" ? item.periodName : "";
        const value = finiteNumber(item.value);
        if (!year || value === null || period === "M13") return null;
        const date = /^M(0[1-9]|1[0-2])$/.test(period)
          ? `${year}-${period.slice(1)}`
          : /^Q0[1-4]$/.test(period)
            ? `${year}Q${period.slice(-1)}`
            : periodName === "Annual"
              ? year
              : null;
        return date ? { date, value } : null;
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-Math.min(Math.max(Math.trunc(limit), 1), 5_000));
    if (!points.length)
      return emptySeries(
        normalized,
        "U.S. BLS Public Data API",
        sourceUrl,
        "latest_public_release",
        "BLS 未返回可验证观察；系统未填充静态或合成数值。"
      );
    return {
      available: true,
      symbol: normalized,
      source: "U.S. BLS Public Data API",
      sourceUrl,
      observedAt: points.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history: points,
      limitation:
        "BLS 官方公开发布序列；观测频率、季调和修订状态由具体序列定义，不是实时市场报价。",
    };
  } catch (error) {
    return emptySeries(
      normalized,
      "U.S. BLS Public Data API",
      sourceUrl,
      "unavailable",
      `BLS 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

/** EIA weekly U.S. petroleum observations from official released workbooks. */
export async function fetchEiaWeeklyPetroleumSeries(
  id: EiaWeeklyPetroleumId,
  limit = 2_500
): Promise<FreeSeriesResult> {
  const sourceUrl = `https://www.eia.gov/dnav/pet/hist_xls/${id}w.xls`;
  try {
    const history = (await fetchEiaWeeklyPetroleumHistory(id)).slice(-Math.min(Math.max(Math.trunc(limit), 1), 5_000));
    return {
      available: true,
      symbol: id,
      source: "U.S. EIA Weekly Petroleum",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history,
      limitation: "周度已发布观察；按原始观测日归档，不是盘中库存或可交易报价。",
    };
  } catch (error) {
    return emptySeries(
      id, "U.S. EIA Weekly Petroleum", sourceUrl, "unavailable",
      `周度观察暂不可用（${error instanceof Error ? error.message : "REQUEST_FAILED"}）；未生成替代值。`
    );
  }
}

/** Lower-48 survey observations, with the official EIA workbook as a rate-limit fallback. */
export async function fetchEiaWeeklyNaturalGasStorage(
  limit = 260
): Promise<FreeSeriesResult> {
  const sourceUrl = `${EIA_BASE}/natural-gas/stor/wkly/data/`;
  // EIA's current weekly storage dataset identifies the national Lower-48
  // working-gas series as duoarea=R48 + process=SWO. NUS is an obsolete
  // facet and returns an empty response; never turn that empty response into
  // a synthetic value.
  const requestUrl = `${sourceUrl}?api_key=${encodeURIComponent(process.env.EIA_API_KEY?.trim() || "DEMO_KEY")}&frequency=weekly&data[0]=value&facets[duoarea][]=R48&facets[process][]=SWO&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=${Math.min(Math.max(Math.trunc(limit), 1), 5000)}`;
  let primaryFailure = "NO_OBSERVATIONS";
  try {
    const payload = JSON.parse(await fetchText(requestUrl, 15_000)) as {
      response?: { data?: unknown[] };
    };
    const points = (payload.response?.data ?? [])
      .map((row): FreeObservation | null => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const item = row as Record<string, unknown>;
        const date =
          typeof item.period === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.period)
            ? item.period
            : null;
        const value = finiteNumber(item.value);
        return date && value !== null ? { date, value } : null;
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length) {
      return {
        available: true,
        symbol: "NG.STORAGE.US.W",
        source: "U.S. EIA Open Data",
        sourceUrl,
        observedAt: points.at(-1)?.date ?? null,
        retrievedAt: new Date().toISOString(),
        realtime: false,
        delayStatus: "latest_public_release",
        history: points,
        limitation:
          "EIA 官方周度美国天然气库存发布；可能修订，且不是实时期货或可执行商品报价。",
      };
    }
  } catch (error) {
    primaryFailure = error instanceof Error ? error.message : "REQUEST_FAILED";
  }
  try {
    const history = (await fetchEiaWeeklyNaturalGasHistory())
      .slice(-Math.min(Math.max(Math.trunc(limit), 1), 5_000));
    return {
      available: true,
      symbol: "NG.STORAGE.US.W",
      source: "U.S. EIA Weekly Natural Gas",
      sourceUrl: "https://ir.eia.gov/ngs/ngshistory.xls",
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history,
      limitation: "EIA-912 周度调查发布观察；不含早期推算值，也不是实时库存或可执行报价。",
    };
  } catch (error) {
    return emptySeries(
      "NG.STORAGE.US.W",
      "U.S. EIA Weekly Natural Gas",
      sourceUrl,
      "unavailable",
      `EIA 接口及官方历史表均不可用（接口：${primaryFailure}；历史表：${error instanceof Error ? error.message : "REQUEST_FAILED"}）；系统保持真实空状态。`
    );
  }
}

/** U.S. Treasury Debt to the Penny, normalized to one total-debt value per record date. */
export async function fetchTreasuryTotalPublicDebt(
  limit = 1_000
): Promise<FreeSeriesResult> {
  const sourceUrl = `${TREASURY_FISCAL_BASE}/accounting/od/debt_to_penny`;
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), 10_000);
  const requestUrl = `${sourceUrl}?sort=-record_date&page%5Bsize%5D=${pageSize}`;
  try {
    const payload = JSON.parse(await fetchText(requestUrl, 15_000)) as {
      data?: unknown[];
    };
    const points = (payload.data ?? [])
      .map((row): FreeObservation | null => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const item = row as Record<string, unknown>;
        const date = isoDate(item.record_date);
        const value = finiteNumber(item.tot_pub_debt_out_amt);
        return date && value !== null ? { date, value } : null;
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!points.length)
      return emptySeries(
        "US:DEBT_TOTAL",
        "U.S. Treasury Fiscal Data API",
        sourceUrl,
        "latest_public_release",
        "美国财政部本次未返回可验证的公共债务记录；系统未生成替代值。"
      );
    return {
      available: true,
      symbol: "US:DEBT_TOTAL",
      source: "U.S. Treasury Fiscal Data API",
      sourceUrl,
      observedAt: points.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history: points,
      limitation:
        "美国财政部 Debt to the Penny 官方记录；这里仅保留总公共债务余额与记录日期，不推算持有人结构，也不是债券行情。",
    };
  } catch (error) {
    return emptySeries(
      "US:DEBT_TOTAL",
      "U.S. Treasury Fiscal Data API",
      sourceUrl,
      "unavailable",
      `美国财政部财政数据请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

export type ImfDataMapperIndicator = "NGDP_RPCH" | "PCPIPCH";
type ImfIndicatorValues = Record<string, Record<string, number>>;

async function fetchImfIndicatorValues(
  indicator: ImfDataMapperIndicator
): Promise<ImfIndicatorValues> {
  const sourceUrl = `${IMF_DATA_MAPPER_BASE}/${indicator}`;
  const payload = JSON.parse(await fetchText(sourceUrl, 20_000)) as {
    values?: Record<string, unknown>;
  };
  const raw = payload.values?.[indicator];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: ImfIndicatorValues = {};
  for (const [economy, periods] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!/^[A-Z0-9_]{2,16}$/.test(economy)) continue;
    if (!periods || typeof periods !== "object" || Array.isArray(periods))
      continue;
    const values: Record<string, number> = {};
    for (const [period, rawValue] of Object.entries(
      periods as Record<string, unknown>
    )) {
      const value = finiteNumber(rawValue);
      if (/^\d{4}$/.test(period) && value !== null) values[period] = value;
    }
    if (Object.keys(values).length) output[economy] = values;
  }
  return output;
}

/** IMF DataMapper annual macro series. Current vintage may mix history, estimates and forecasts. */
export async function fetchImfDataMapperSeries(
  indicator: ImfDataMapperIndicator,
  economy = "WEOWORLD",
  limit = 80
): Promise<FreeSeriesResult> {
  const normalizedEconomy = economy.trim().toUpperCase();
  const sourceUrl = `${IMF_DATA_MAPPER_BASE}/${indicator}`;
  if (!/^[A-Z0-9_]{2,16}$/.test(normalizedEconomy))
    return emptySeries(
      `${economy}:${indicator}`,
      "IMF DataMapper API",
      sourceUrl,
      "unavailable",
      "IMF 经济体代码格式无效；未发出请求。"
    );
  try {
    const values = await fetchImfIndicatorValues(indicator);
    const history = Object.entries(values[normalizedEconomy] ?? {})
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-Math.min(Math.max(Math.trunc(limit), 1), 200));
    if (!history.length)
      return emptySeries(
        `${normalizedEconomy}:${indicator}`,
        "IMF DataMapper API",
        sourceUrl,
        "latest_public_release",
        "IMF DataMapper 本次未返回所选经济体和指标的可验证年度记录；系统未补造数值。"
      );
    return {
      available: true,
      symbol: `${normalizedEconomy}:${indicator}`,
      source: "IMF DataMapper API",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history,
      limitation:
        "IMF DataMapper 当前 WEO 版本年度序列；历史年份可能含估计或修订，未来年份为预测，不提供实时更新或跨版本修订历史。",
    };
  } catch (error) {
    return emptySeries(
      `${normalizedEconomy}:${indicator}`,
      "IMF DataMapper API",
      sourceUrl,
      "unavailable",
      `IMF DataMapper 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

export type NormalizedImfForecastRow = {
  economy: string;
  year: number;
  gdpGrowthPct: number | null;
  inflationPct: number | null;
  periodKind: "historical_or_estimate" | "estimate_or_forecast" | "forecast";
};

/**
 * Terminal-safe IMF forecast matrix. Provider URLs and raw response metadata
 * remain on the server; the client receives only validated country/year values.
 */
export async function fetchNormalizedImfForecastMatrix(
  economies: string[] = [
    "WEOWORLD",
    "USA",
    "CHN",
    "DEU",
    "JPN",
    "GBR",
    "IND",
    "BRA",
  ]
): Promise<{
  available: boolean;
  retrievedAt: string;
  latestPeriod: string | null;
  rows: NormalizedImfForecastRow[];
  limitation: string;
}> {
  const normalizedEconomies = [
    ...new Set(economies.map(value => value.trim().toUpperCase())),
  ]
    .filter(value => /^[A-Z0-9_]{2,16}$/.test(value))
    .slice(0, 24);
  const retrievedAt = new Date().toISOString();
  try {
    const [gdp, inflation] = await Promise.all([
      fetchImfIndicatorValues("NGDP_RPCH"),
      fetchImfIndicatorValues("PCPIPCH"),
    ]);
    const currentYear = new Date().getUTCFullYear();
    const rows = normalizedEconomies.flatMap(economy => {
      const periods = new Set([
        ...Object.keys(gdp[economy] ?? {}),
        ...Object.keys(inflation[economy] ?? {}),
      ]);
      return [...periods].sort().flatMap(period => {
        const year = Number(period);
        const gdpGrowthPct = finiteNumber(gdp[economy]?.[period]);
        const inflationPct = finiteNumber(inflation[economy]?.[period]);
        if (
          !Number.isInteger(year) ||
          (gdpGrowthPct === null && inflationPct === null)
        )
          return [];
        return [
          {
            economy,
            year,
            gdpGrowthPct,
            inflationPct,
            periodKind:
              year > currentYear
                ? ("forecast" as const)
                : year === currentYear
                  ? ("estimate_or_forecast" as const)
                  : ("historical_or_estimate" as const),
          },
        ];
      });
    });
    return {
      available: rows.length > 0,
      retrievedAt,
      latestPeriod: rows.length
        ? String(Math.max(...rows.map(row => row.year)))
        : null,
      rows,
      limitation: rows.length
        ? "仅展示当前公开宏观预测版本清洗后的 GDP 增速与消费者价格通胀年度值；不把当前版本推断为历史预测快照、实时一致预期或预测精度。"
        : "公开宏观预测接口本次未返回可验证记录；系统未使用静态样例或合成预测替代。",
    };
  } catch (error) {
    return {
      available: false,
      retrievedAt,
      latestPeriod: null,
      rows: [],
      limitation: `公开宏观预测接口请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`,
    };
  }
}

/** Eurostat monthly seasonally adjusted unemployment rate for EU27 (2020 composition). */
export async function fetchEurostatEu27Unemployment(
  limit = 120
): Promise<FreeSeriesResult> {
  const sourceUrl = `${EUROSTAT_BASE}/une_rt_m`;
  const requestUrl = `${sourceUrl}?lang=en&geo=EU27_2020&s_adj=SA&age=TOTAL&sex=T&unit=PC_ACT`;
  try {
    const payload = JSON.parse(await fetchText(requestUrl, 20_000)) as {
      id?: unknown;
      size?: unknown;
      value?: unknown;
      dimension?: Record<string, { category?: { index?: unknown } }>;
    };
    const ids = Array.isArray(payload.id) ? payload.id.map(String) : [];
    const sizes = Array.isArray(payload.size)
      ? payload.size.map(value => Number(value))
      : [];
    const timeIndex = ids.indexOf("time");
    const timeCategories = payload.dimension?.time?.category?.index;
    const values = payload.value;
    if (
      timeIndex < 0 ||
      sizes.length !== ids.length ||
      !timeCategories ||
      typeof timeCategories !== "object" ||
      Array.isArray(timeCategories) ||
      !values ||
      typeof values !== "object"
    ) {
      throw new Error("INVALID_JSON_STAT_CONTRACT");
    }
    const timeStride = sizes
      .slice(timeIndex + 1)
      .reduce((product, size) => product * size, 1);
    const points = Object.entries(timeCategories as Record<string, unknown>)
      .map(([period, rawPosition]): FreeObservation | null => {
        const position = Number(rawPosition);
        const value = finiteNumber(
          (values as Record<string, unknown>)[String(position * timeStride)]
        );
        return /^\d{4}-\d{2}$/.test(period) &&
          Number.isInteger(position) &&
          value !== null
          ? { date: period, value }
          : null;
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-Math.min(Math.max(Math.trunc(limit), 1), 1_000));
    if (!points.length)
      return emptySeries(
        "EU27_2020:UNEMP_SA",
        "Eurostat Dissemination API",
        sourceUrl,
        "latest_public_release",
        "Eurostat 本次未返回 EU27 季调月度失业率观察；系统未生成替代值。"
      );
    return {
      available: true,
      symbol: "EU27_2020:UNEMP_SA",
      source: "Eurostat Dissemination API",
      sourceUrl,
      observedAt: points.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "latest_public_release",
      history: points,
      limitation:
        "Eurostat EU27（2020 构成）总人口劳动力口径季调月度失业率；可能修订，不是实时劳动力市场指标。",
    };
  } catch (error) {
    return emptySeries(
      "EU27_2020:UNEMP_SA",
      "Eurostat Dissemination API",
      sourceUrl,
      "unavailable",
      `Eurostat 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

/** HKMA daily exchange-rate and effective exchange-rate observations. */
export async function fetchHkmaDailyExchangeRates(
  limit = 100
): Promise<HkmaExchangeResult> {
  const sourceUrl = "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily";
  const retrievedAt = new Date().toISOString();
  try {
    const requested = Math.min(Math.max(Math.trunc(limit), 1), 1_000);
    // Keep each collection to the latest 100 records; older successful
    // collections remain in the persistent ledger.
    const pageSize = Math.min(requested, 100);
    const payload = JSON.parse(await fetchText(`${sourceUrl}?offset=0&pagesize=${pageSize}&sortby=end_of_day&sortorder=desc`, 30_000)) as {
      header?: { success?: boolean };
      result?: { records?: unknown[] };
    };
    if (payload.header?.success === false) throw new Error("HKMA_APPLICATION_ERROR");
    const parsed = (payload.result?.records ?? [])
      .map((row): HkmaExchangeObservation | null => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const item = row as Record<string, unknown>;
        const date = isoDate(item.end_of_day);
        if (!date) return null;
          const numberOrNull = (key: string) => {
            const value = finiteNumber(item[key]);
            return value !== null && value > 0 ? value : null;
          };
        return {
          date,
          usd: numberOrNull("usd"),
          eur: numberOrNull("eur"),
          cny: numberOrNull("cny"),
          jpy: numberOrNull("jpy"),
          index: numberOrNull("neeri_2020_trade_wgt"),
        };
      })
        .filter((row): row is HkmaExchangeObservation => row !== null &&
          [row.usd, row.eur, row.cny, row.jpy, row.index].some(value => value !== null));
    const observations = [...new Map(parsed.map(row => [row.date, row])).values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-Math.min(Math.max(Math.trunc(limit), 1), 1_000));
    return {
      available: observations.length > 0,
      source: "Hong Kong Monetary Authority public exchange-rate API",
      sourceUrl,
      observedAt: observations.at(-1)?.date ?? null,
      retrievedAt,
      realtime: false,
      delayStatus: observations.length ? "official_reference" : "unavailable",
      observations,
      limitation: observations.length
          ? "香港金管局公开每日参考汇率和贸易加权指数，每次最多读取最近100条；不是实时交易 bid/ask、点差或可执行报价。"
        : "香港金管局本次未返回可验证记录；系统未生成替代值。",
    };
  } catch (error) {
    return {
      available: false,
      source: "Hong Kong Monetary Authority public exchange-rate API",
      sourceUrl,
      observedAt: null,
      retrievedAt,
      realtime: false,
      delayStatus: "unavailable",
      observations: [],
      limitation: `香港金管局公开接口请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`,
    };
  }
}

/** Bank of Canada Valet public daily CAD/USD reference series. */
export async function fetchBankOfCanadaFx(
  limit = 100
): Promise<BankOfCanadaFxResult> {
  const pair = "USD/CAD";
  const sourceUrl = `${BANK_OF_CANADA_VALET_BASE}/FXUSDCAD/json?recent=${Math.min(Math.max(Math.trunc(limit), 1), 1_000)}`;
  const retrievedAt = new Date().toISOString();
  try {
    const payload = JSON.parse(await fetchText(sourceUrl, 25_000)) as { observations?: unknown[] };
      const parsed = (payload.observations ?? [])
      .map((row): FreeObservation | null => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const item = row as Record<string, unknown>;
        const date = isoDate(item.d);
        const series = item.FXUSDCAD;
        const rawValue = series && typeof series === "object" && !Array.isArray(series)
          ? (series as Record<string, unknown>).v
          : null;
        const value = finiteNumber(rawValue);
          return date && value !== null && value > 0 ? { date, value } : null;
      })
        .filter((point): point is FreeObservation => point !== null);
      const history = [...new Map(parsed.map(point => [point.date, point])).values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-Math.min(Math.max(Math.trunc(limit), 1), 1_000));
    return {
      available: history.length > 0,
      pair,
      source: "Bank of Canada Valet API",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt,
      realtime: false,
      delayStatus: history.length ? "official_reference" : "unavailable",
      history,
      limitation: history.length
        ? "加拿大央行 Valet USD/CAD 官方参考序列；不是实时交易 bid/ask、点差或可执行报价。"
        : "加拿大央行 Valet 本次未返回可验证观察；系统未生成替代值。",
    };
  } catch (error) {
    return {
      available: false,
      pair,
      source: "Bank of Canada Valet API",
      sourceUrl,
      observedAt: null,
      retrievedAt,
      realtime: false,
      delayStatus: "unavailable",
      history: [],
      limitation: `加拿大央行 Valet 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`,
    };
  }
}

/** FRED CSV is a free public release and useful for rates, spreads and macro series. */
export async function fetchFredPublicSeries(
  seriesId: string,
  limit = 252
): Promise<FreeSeriesResult> {
  const normalized = seriesId.trim().toUpperCase();
  const sourceUrl = `${FRED_BASE}?id=${encodeURIComponent(normalized)}`;
  if (!/^[A-Z0-9_-]+$/.test(normalized))
    return emptySeries(
      seriesId,
      "FRED public CSV",
      sourceUrl,
      "unavailable",
      "FRED series ID 格式无效；未发出请求。"
    );
  try {
    const text = await fetchText(sourceUrl);
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length < 2)
      return emptySeries(
        normalized,
        "FRED public CSV",
        sourceUrl,
        "latest_public_release",
        "FRED 未返回可验证观察。"
      );
    const header = csvFields(lines[0]);
    const dateIndex = header.findIndex(
      field => field.trim().toLowerCase() === "observation_date"
    );
    const valueIndex = header.findIndex(field => field.trim().toUpperCase() === normalized);
    if (dateIndex < 0 || valueIndex < 0) throw new Error('FRED_SERIES_HEADER_MISMATCH');
    const points = lines
      .slice(1)
      .map((line): FreeObservation | null => {
        const fields = csvFields(line);
        const date = isoDate(fields[dateIndex >= 0 ? dateIndex : 0]);
        const value = finiteNumber(fields[valueIndex]);
        return date && value !== null ? { date, value } : null;
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const history = points.slice(
      -Math.min(Math.max(Math.floor(limit), 1), 5_000)
    );
    return {
      available: history.length > 0,
      symbol: normalized,
      source: "FRED public CSV",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: history.length ? "latest_public_release" : "unavailable",
      history,
      limitation: history.length
        ? "FRED 为公开发布序列，频率与发布时间由具体 series 定义；不是实时市场报价。"
        : "FRED 本次没有返回可验证观察；系统未补造数值。",
    };
  } catch (error) {
    return emptySeries(
      normalized,
      "FRED public CSV",
      sourceUrl,
      "latest_public_release",
      `FRED 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

const DEFAULT_SEC_FACT_TAGS = [
  "Assets",
  "Liabilities",
  "StockholdersEquity",
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "NetIncomeLoss",
  "OperatingIncomeLoss",
  "EarningsPerShareDiluted",
] as const;

function secCik(value: string): string | null {
  const normalized = value.trim().replace(/^CIK/i, "");
  return /^\d{1,10}$/.test(normalized) ? normalized.padStart(10, "0") : null;
}

function secDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) || /^\d{4}$/.test(normalized)
    ? normalized
    : null;
}

function emptyCompanyFacts(
  cik: string,
  sourceUrl: string,
  limitation: string
): FreeCompanyFactsResult {
  return {
    available: false,
    cik,
    source: "SEC EDGAR Company Facts",
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    observedAt: null,
    realtime: false,
    delayStatus: "unavailable",
    facts: [],
    limitation,
  };
}

/**
 * SEC EDGAR's company-facts JSON is a free regulatory source for US issuer
 * fundamentals.  The adapter accepts a CIK (not an ambiguous ticker), keeps
 * the filing and fiscal metadata, and never derives a quote or a forecast.
 */
export async function fetchSecCompanyFacts(
  cikInput: string,
  tags: string[] = [...DEFAULT_SEC_FACT_TAGS],
  limit = 120
): Promise<FreeCompanyFactsResult> {
  const cik = secCik(cikInput);
  const normalizedInput = cik ?? cikInput.trim();
  const sourceUrl = `${SEC_FACTS_BASE}/CIK${cik ?? "0000000000"}.json`;
  if (!cik)
    return emptyCompanyFacts(
      normalizedInput,
      sourceUrl,
      "SEC EDGAR 适配器要求 1 至 10 位 CIK；未发出请求。请勿用股票代码替代 CIK。 "
    );
  const selectedTags = [
    ...new Set(
      tags
        .map(tag => tag.trim())
        .filter(tag => /^[A-Za-z][A-Za-z0-9]{1,127}$/.test(tag))
    ),
  ].slice(0, 24);
  try {
    const text = await fetchText(sourceUrl, 15_000, {
      accept: "application/json",
      "user-agent":
        process.env.SEC_USER_AGENT?.trim() ||
        "FinanceHub/1.0 (public research; configure SEC_USER_AGENT for production)",
    });
    const payload = JSON.parse(text) as {
      facts?: Record<
        string,
        Record<
          string,
          {
            label?: string;
            units?: Record<string, Array<Record<string, unknown>>>;
          }
        >
      >;
    };
    const factsRoot = payload.facts ?? {};
    const rows: FreeCompanyFact[] = [];
    const taxonomies = Object.keys(factsRoot).sort();
    const wanted = selectedTags.length
      ? new Set(selectedTags)
      : new Set(DEFAULT_SEC_FACT_TAGS);
    for (const taxonomy of taxonomies) {
      const taxonomyFacts = factsRoot[taxonomy] ?? {};
      for (const tag of Object.keys(taxonomyFacts)) {
        if (!wanted.has(tag)) continue;
        const block = taxonomyFacts[tag];
        for (const [unit, observations] of Object.entries(block.units ?? {})) {
          for (const observation of observations) {
            const value = finiteNumber(observation.val);
            if (value === null) continue;
            rows.push({
              taxonomy,
              tag,
              label: typeof block.label === "string" ? block.label : null,
              unit,
              value,
              startDate: secDate(observation.start),
              endDate: secDate(observation.end),
              filedAt: secDate(observation.filed),
              form:
                typeof observation.form === "string" ? observation.form : null,
              fiscalYear:
                typeof observation.fy === "number" &&
                Number.isInteger(observation.fy)
                  ? observation.fy
                  : null,
              fiscalPeriod:
                typeof observation.fp === "string" ? observation.fp : null,
              frame:
                typeof observation.frame === "string"
                  ? observation.frame
                  : null,
              accessionNumber:
                typeof observation.accn === "string" ? observation.accn : null,
            });
          }
        }
      }
    }
    const unique = [
      ...new Map(
        rows.map(row => [
          [
            row.taxonomy,
            row.tag,
            row.unit,
            row.value,
            row.startDate,
            row.endDate,
            row.filedAt,
            row.accessionNumber,
          ].join("|"),
          row,
        ])
      ).values(),
    ];
    unique.sort((a, b) =>
      `${a.filedAt ?? ""}|${a.endDate ?? ""}`.localeCompare(
        `${b.filedAt ?? ""}|${b.endDate ?? ""}`
      )
    );
    const facts = unique.slice(
      -Math.min(Math.max(Math.floor(limit), 1), 2_000)
    );
    const observedAt =
      facts
        .map(row => row.filedAt ?? row.endDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    return {
      available: facts.length > 0,
      cik,
      source: "SEC EDGAR Company Facts",
      sourceUrl,
      retrievedAt: new Date().toISOString(),
      observedAt,
      realtime: false,
      delayStatus: facts.length ? "latest_public_release" : "unavailable",
      facts,
      limitation: facts.length
        ? "SEC EDGAR 公司事实来自公开监管申报；存在申报滞后、重述与会计口径差异，不是实时价格、盈利预测或投资建议。"
        : "SEC EDGAR 本次未返回所选标签的可验证申报事实；系统未以静态或合成值替代。",
    };
  } catch (error) {
    return emptyCompanyFacts(
      cik,
      sourceUrl,
      `SEC EDGAR 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

/** ECB official reference rates for a currency pair expressed as BASE/QUOTE. */
export async function fetchEcbReferenceRate(
  pair: string,
  days = 30
): Promise<FreeFxResult> {
  const parts = pair.trim().toUpperCase().split("/");
  const base = parts[0] ?? "";
  const quote = parts[1] ?? "";
  const sourceUrl = `${ECB_BASE}/D.${encodeURIComponent(base)}.${encodeURIComponent(quote)}.SP00.A?format=csvdata`;
  const invalid =
    !/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote) || base === quote;
  if (invalid)
    return {
      available: false,
      pair,
      rate: null,
      change: null,
      changePct: null,
      source: "ECB Data Portal EXR",
      sourceUrl,
      observedAt: null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "unavailable",
      limitation: "ECB 适配器要求两个不同的 ISO 货币代码；未发出请求。",
    };
  const start = new Date(
    Date.now() - Math.max(7, Math.min(days, 365)) * 86_400_000
  )
    .toISOString()
    .slice(0, 10);
  const requestUrl = `${sourceUrl}&startPeriod=${start}`;
  try {
    const text = await fetchText(requestUrl);
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error("NO_ROWS");
    const header = csvFields(lines[0]).map(value => value.trim());
    const dateIndex = header.indexOf("TIME_PERIOD");
    const valueIndex = header.indexOf("OBS_VALUE");
    const points =
      dateIndex >= 0 && valueIndex >= 0
        ? lines
            .slice(1)
            .map((line): FreeObservation | null => {
              const fields = csvFields(line);
              const date = isoDate(fields[dateIndex]);
              const value = finiteNumber(fields[valueIndex]);
              return date && value !== null ? { date, value } : null;
            })
            .filter((point): point is FreeObservation => point !== null)
            .sort((a, b) => a.date.localeCompare(b.date))
        : [];
    const latest = points.at(-1);
    const previous = points.at(-2);
    const change = latest && previous ? latest.value - previous.value : null;
    return {
      available: Boolean(latest),
      pair: `${base}/${quote}`,
      rate: latest?.value ?? null,
      change,
      changePct:
        latest && previous && previous.value !== 0
          ? (change! / previous.value) * 100
          : null,
      source: "ECB Data Portal EXR",
      sourceUrl: requestUrl,
      observedAt: latest?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: latest ? "official_reference" : "unavailable",
      limitation: latest
        ? "ECB 为官方参考汇率，按发布日提供；不是实时交易 bid/ask、订单簿或可执行报价。"
        : "ECB 本次未返回可验证参考汇率；系统未以固定快照或模拟汇率替代。",
    };
  } catch (error) {
    return {
      available: false,
      pair: `${base}/${quote}`,
      rate: null,
      change: null,
      changePct: null,
      source: "ECB Data Portal EXR",
      sourceUrl: requestUrl,
      observedAt: null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "unavailable",
      limitation: `ECB 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`,
    };
  }
}

/**
 * Resolve any BASE/QUOTE pair from ECB's EUR-denominated reference series.
 * EUR crosses are calculated from two observed ECB rates and retain the
 * original observation date; this is a reference cross, never a live quote.
 */
export async function fetchPublicFxPair(pair: string): Promise<FreeFxResult> {
  const [base, quote] = pair.trim().toUpperCase().split("/");
  if (
    !base ||
    !quote ||
    base === quote ||
    !/^[A-Z]{3}$/.test(base) ||
    !/^[A-Z]{3}$/.test(quote)
  )
    return fetchEcbReferenceRate(pair);
  if (quote === "EUR") return fetchEcbReferenceRate(`${base}/EUR`);
  if (base === "EUR") {
    const inverse = await fetchEcbReferenceRate(`${quote}/EUR`);
    if (!inverse.available || inverse.rate === null || inverse.rate === 0)
      return {
        ...inverse,
        pair: `${base}/${quote}`,
        rate: null,
        change: null,
        changePct: null,
        limitation: `${inverse.limitation} 无法从公开观察计算反向 EUR 交叉。`,
      };
    return {
      ...inverse,
      pair: `${base}/${quote}`,
      rate: 1 / inverse.rate,
      change:
        inverse.change === null
          ? null
          : -(inverse.change / (inverse.rate * inverse.rate)),
      changePct: inverse.changePct === null ? null : -inverse.changePct,
      limitation:
        "ECB 为官方参考汇率；此处为公开 EUR 交叉的倒数，不是实时交易 bid/ask。",
    };
  }
  const [baseRow, quoteRow] = await Promise.all([
    fetchEcbReferenceRate(`${base}/EUR`),
    fetchEcbReferenceRate(`${quote}/EUR`),
  ]);
  if (
    !baseRow.available ||
    !quoteRow.available ||
    baseRow.rate === null ||
    quoteRow.rate === null ||
    quoteRow.rate === 0
  )
    return {
      available: false,
      pair: `${base}/${quote}`,
      rate: null,
      change: null,
      changePct: null,
      source: "ECB Data Portal EXR",
      sourceUrl: `${ECB_BASE}/D.*.EUR.SP00.A`,
      observedAt: null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "unavailable",
      limitation:
        "ECB 交叉汇率所需的任一 EUR 参考腿不可用；系统未补造交叉价格。",
    };
  const rate = baseRow.rate / quoteRow.rate;
  const previousBase =
    baseRow.change === null ? null : baseRow.rate - baseRow.change;
  const previousQuote =
    quoteRow.change === null ? null : quoteRow.rate - quoteRow.change;
  const previous =
    previousBase !== null && previousQuote !== null && previousQuote !== 0
      ? previousBase / previousQuote
      : null;
  const change = previous === null ? null : rate - previous;
  return {
    available: true,
    pair: `${base}/${quote}`,
    rate,
    change,
    changePct:
      change === null || previous === null || previous === 0
        ? null
        : (change / previous) * 100,
    source: "ECB Data Portal EXR",
    sourceUrl: `${baseRow.sourceUrl} · ${quoteRow.sourceUrl}`,
    observedAt:
      baseRow.observedAt && quoteRow.observedAt
        ? baseRow.observedAt < quoteRow.observedAt
          ? baseRow.observedAt
          : quoteRow.observedAt
        : null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "official_reference",
    limitation:
      "ECB 为官方 EUR 参考汇率；此处由两条公开参考腿计算交叉汇率，不是实时交易 bid/ask。",
  };
}

/** NY Fed public latest endpoint, retained as a structured funding-rate probe. */
export async function fetchNyFedLatest(): Promise<{
  available: boolean;
  source: "NY Fed Markets API";
  sourceUrl: string;
  retrievedAt: string;
  observedAt: string | null;
  records: Array<Record<string, unknown>>;
  limitation: string;
}> {
  try {
    const text = await fetchText(NYFED_LATEST, 10_000);
    const body = JSON.parse(text) as {
      refRates?: unknown[];
      rates?: unknown[];
      data?: unknown[];
    };
    const records = (body.refRates ?? body.rates ?? body.data ?? []).filter(
      (row): row is Record<string, unknown> =>
        Boolean(row && typeof row === "object")
    );
    const observedAt =
      records
        .map(row =>
          String(row.effectiveDate ?? row.observationDate ?? row.asOfDate ?? "")
        )
        .find(value => /^\d{4}-\d{2}-\d{2}/.test(value)) ?? null;
    return {
      available: records.length > 0,
      source: "NY Fed Markets API",
      sourceUrl: NYFED_LATEST,
      retrievedAt: new Date().toISOString(),
      observedAt,
      records,
      limitation: records.length
        ? "纽约联储公开接口返回参考利率记录；字段和频率依具体产品定义，不等于全市场实时成交。"
        : "纽约联储本次未返回可验证记录；系统未生成替代值。",
    };
  } catch (error) {
    return {
      available: false,
      source: "NY Fed Markets API",
      sourceUrl: NYFED_LATEST,
      retrievedAt: new Date().toISOString(),
      observedAt: null,
      records: [],
      limitation: `纽约联储请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`,
    };
  }
}

export type NormalizedMoneyMarketRate = {
  instrument: "SOFR" | "EFFR" | "OBFR" | "TGCR" | "BGCR";
  effectiveDate: string;
  rate: number;
  percentile1: number | null;
  percentile25: number | null;
  percentile75: number | null;
  percentile99: number | null;
  targetFrom: number | null;
  targetTo: number | null;
  volumeInBillions: number | null;
};

export type NormalizedSofrAverage = {
  effectiveDate: string;
  average30Day: number | null;
  average90Day: number | null;
  average180Day: number | null;
  index: number | null;
};

export type NormalizedFedFundsObservation = {
  effectiveDate: string;
  targetFrom: number;
  targetTo: number;
};

export const MONEY_MARKET_FEATURE_CONTRACTS = [
  {
    featureId: "electronic-money-market-rates",
    dataContractId: "rates.us.nyfed.reference.latest.v1",
    dataScopeKey: "us.tgcr-bgcr.reference.latest",
    availability: "public" as const,
  },
  {
    featureId: "electronic-money-market-history",
    dataContractId: "rates.us.sofr-compounded-averages.nyfed.v1",
    dataScopeKey: "us.sofr.compounded-averages.history",
    availability: "public" as const,
  },
  {
    featureId: "electronic-money-market-fedfund",
    dataContractId: "policy.us.federal-funds-target-transitions.nyfed.v1",
    dataScopeKey: "us.federal-funds.target-range.transitions",
    availability: "public" as const,
  },
  {
    featureId: "electronic-money-market-repo",
    dataContractId: "trade.us.repo.executions.licensed.v1",
    dataScopeKey: "us.repo.executions.authorized-tape",
    availability: "credential_required" as const,
  },
] as const;

export function assertMoneyMarketFeatureContractUniqueness(
  contracts: ReadonlyArray<{
    featureId: string;
    dataContractId: string;
    dataScopeKey: string;
  }> = MONEY_MARKET_FEATURE_CONTRACTS
) {
  const dimensions = {
    feature: contracts.map(contract => contract.featureId),
    contract: contracts.map(contract => contract.dataContractId),
    scope: contracts.map(contract => contract.dataScopeKey),
  };
  for (const [dimension, values] of Object.entries(dimensions)) {
    const duplicate = values.find(
      (value, index) => values.indexOf(value) !== index
    );
    if (duplicate)
      throw new Error(
        `MONEY_MARKET_FEATURE_CONTRACT_DUPLICATE:${dimension}:${duplicate}`
      );
  }
  return true;
}

assertMoneyMarketFeatureContractUniqueness();

async function fetchNyFedSearchRecords(
  path: string,
  startDate: string,
  endDate: string
): Promise<Array<Record<string, unknown>>> {
  const sourceUrl = `${NYFED_RATES_BASE}/${path}/search.json?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&type=all`;
  try {
    const body = JSON.parse(await fetchText(sourceUrl, 10_000)) as {
      refRates?: unknown[];
    };
    return (body.refRates ?? []).filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object" && !Array.isArray(row))
    );
  } catch {
    return [];
  }
}

/**
 * Terminal-safe money-market contract. Raw provider records and external URLs
 * stay on the server; only validated, whitelisted reference-rate fields leave
 * this boundary. These are published observations, never executable quotes.
 */
export async function fetchNormalizedMoneyMarketSnapshot(
  requestedDays = 90
): Promise<{
  available: boolean;
  observedAt: string | null;
  retrievedAt: string;
  contracts: typeof MONEY_MARKET_FEATURE_CONTRACTS;
  rates: NormalizedMoneyMarketRate[];
  sofrAverages: NormalizedSofrAverage[];
  fedFundsHistory: NormalizedFedFundsObservation[];
  repoExecutions: never[];
  limitation: string;
}> {
  const days = Math.min(Math.max(Math.floor(requestedDays), 30), 365);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const [raw, securedHistory, fedFundsRaw] = await Promise.all([
    fetchNyFedLatest(),
    fetchNyFedSearchRecords("secured/all", startDate, endDate),
    fetchNyFedSearchRecords("unsecured/effr", startDate, endDate),
  ]);
  // MKTBEAT owns SOFR/EFFR/OBFR history. This electronic-trading slice is
  // deliberately limited to secured reference aggregates that are not
  // delivered by that feature.
  const allowed = new Set<NormalizedMoneyMarketRate["instrument"]>([
    "TGCR",
    "BGCR",
  ]);
  const nullableNumber = (value: unknown) => finiteNumber(value);
  const rates = raw.records.flatMap(record => {
    const instrument = String(
      record.type ?? ""
    ).toUpperCase() as NormalizedMoneyMarketRate["instrument"];
    const effectiveDate = isoDate(record.effectiveDate);
    const rate = finiteNumber(record.percentRate);
    if (!allowed.has(instrument) || !effectiveDate || rate === null) return [];
    return [
      {
        instrument,
        effectiveDate,
        rate,
        percentile1: nullableNumber(record.percentPercentile1),
        percentile25: nullableNumber(record.percentPercentile25),
        percentile75: nullableNumber(record.percentPercentile75),
        percentile99: nullableNumber(record.percentPercentile99),
        targetFrom: nullableNumber(record.targetRateFrom),
        targetTo: nullableNumber(record.targetRateTo),
        volumeInBillions: nullableNumber(record.volumeInBillions),
      },
    ];
  });
  const sofrAverages = securedHistory
    .flatMap((record): NormalizedSofrAverage[] => {
      if (String(record.type ?? "").toUpperCase() !== "SOFRAI") return [];
      const effectiveDate = isoDate(record.effectiveDate);
      if (!effectiveDate) return [];
      const row = {
        effectiveDate,
        average30Day: nullableNumber(record.average30day),
        average90Day: nullableNumber(record.average90day),
        average180Day: nullableNumber(record.average180day),
        index: nullableNumber(record.index),
      };
      return Object.values(row)
        .slice(1)
        .some(value => value !== null)
        ? [row]
        : [];
    })
    .sort((left, right) =>
      left.effectiveDate.localeCompare(right.effectiveDate)
    );
  const fedFundsRows = fedFundsRaw
    .flatMap((record): NormalizedFedFundsObservation[] => {
      if (String(record.type ?? "").toUpperCase() !== "EFFR") return [];
      const effectiveDate = isoDate(record.effectiveDate);
      const targetFrom = finiteNumber(record.targetRateFrom);
      const targetTo = finiteNumber(record.targetRateTo);
      if (!effectiveDate || targetFrom === null || targetTo === null) return [];
      return [
        {
          effectiveDate,
          targetFrom,
          targetTo,
        },
      ];
    })
    .sort((left, right) =>
      left.effectiveDate.localeCompare(right.effectiveDate)
    );
  const fedFundsHistory = fedFundsRows.filter((row, index) => {
    const previous = fedFundsRows[index - 1];
    return (
      !previous ||
      previous.targetFrom !== row.targetFrom ||
      previous.targetTo !== row.targetTo
    );
  });

  // Reject the same instrument/date observation crossing two front-end
  // feature slices. SOFRAI is a compounded-average series and the policy
  // series contains target-range transitions rather than EFFR observations.
  const observationKeys = [
    ...rates.map(rate => `${rate.instrument}|${rate.effectiveDate}`),
    ...sofrAverages.map(point => `SOFRAI|${point.effectiveDate}`),
    ...fedFundsHistory.map(point => `FED_TARGET|${point.effectiveDate}`),
  ];
  const duplicateObservation = observationKeys.find(
    (key, index) => observationKeys.indexOf(key) !== index
  );
  if (duplicateObservation)
    throw new Error(
      `MONEY_MARKET_FEATURE_OBSERVATION_DUPLICATE:${duplicateObservation}`
    );
  return {
    available:
      rates.length > 0 || sofrAverages.length > 0 || fedFundsHistory.length > 0,
    observedAt:
      [
        ...rates.map(rate => rate.effectiveDate),
        ...sofrAverages.map(point => point.effectiveDate),
        ...fedFundsHistory.map(point => point.effectiveDate),
      ]
        .sort()
        .at(-1) ?? null,
    retrievedAt: raw.retrievedAt,
    contracts: MONEY_MARKET_FEATURE_CONTRACTS,
    rates,
    sofrAverages,
    fedFundsHistory,
    repoExecutions: [],
    limitation:
      rates.length || sofrAverages.length || fedFundsHistory.length
        ? "TGCR/BGCR 当前参考观测、SOFR 复合均值和联邦基金目标区间变更按互斥契约分片；不包含实时逐笔、盘口、交易对手或可执行报价。"
        : raw.limitation,
  };
}

/**
 * Optional Twelve Data daily series.  A free-tier key may be used, but the
 * server never embeds or stores it.  The response's plan-dependent freshness
 * is kept explicit and is not presented as an executable real-time quote.
 */
export async function fetchTwelveDataDailySeries(
  symbol: string,
  limit = 252
): Promise<TwelveDataSeriesResult> {
  const normalized = symbol.trim().toUpperCase();
  const sourceUrl = `${"https://api.twelvedata.com/time_series"}?symbol=${encodeURIComponent(normalized)}&interval=1day&outputsize=${Math.min(Math.max(Math.floor(limit), 1), 5000)}`;
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim() ?? "";
  const unavailable = (limitation: string): TwelveDataSeriesResult => ({
    available: false,
    configured: Boolean(apiKey),
    symbol: normalized || symbol,
    source: "Twelve Data",
    sourceUrl,
    observedAt: null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "unavailable",
    history: [],
    limitation,
  });
  if (!normalized || !/^[A-Z0-9._:/-]{1,64}$/.test(normalized))
    return unavailable("Twelve Data 代码格式无效；未发出请求。");
  if (!apiKey)
    return unavailable(
      "Twelve Data 免费额度连接器尚未配置 TWELVE_DATA_API_KEY；系统未发送未授权请求，也未用公开快照替代。 "
    );
  try {
    const body = JSON.parse(
      await fetchText(sourceUrl, 15_000, { authorization: `apikey ${apiKey}` })
    ) as {
      status?: string;
      code?: number;
      message?: string;
      values?: Array<Record<string, unknown>>;
    };
    if (body.status === "error" || body.code || !Array.isArray(body.values)) {
      return unavailable(
        `Twelve Data 返回不可用响应${body.message ? `（${body.message}）` : ""}；未生成替代数据。`
      );
    }
    const points = body.values
      .map((row): FreeObservation | null => {
        const dateValue = row.datetime ?? row.date;
        const date =
          typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateValue)
            ? dateValue.slice(0, 10)
            : null;
        const close = finiteNumber(row.close);
        if (!date || close === null) return null;
        return {
          date,
          value: close,
          close,
          open: finiteNumber(row.open),
          high: finiteNumber(row.high),
          low: finiteNumber(row.low),
          volume: finiteNumber(row.volume),
        };
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const history = points.slice(
      -Math.min(Math.max(Math.floor(limit), 1), 5000)
    );
    if (!history.length)
      return unavailable(
        "Twelve Data 未返回可验证日线观察；系统未填充固定或合成数值。"
      );
    return {
      available: true,
      configured: true,
      symbol: normalized,
      source: "Twelve Data",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "plan_dependent",
      history,
      limitation:
        "Twelve Data 日线的更新频率、实时/延迟权限和免费额度由账户方案决定；本适配器只保留实际返回的 OHLCV，不承诺实时可执行报价。",
    };
  } catch (error) {
    return unavailable(
      `Twelve Data 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}

/**
 * Alpha Vantage's free-key daily endpoint. The adapter deliberately uses the
 * unadjusted daily function because adjusted and intraday entitlements may
 * differ. It exposes only actual provider rows and never upgrades them to a
 * real-time quote.
 */
export async function fetchAlphaVantageDailySeries(
  symbol: string,
  limit = 100
): Promise<AlphaVantageSeriesResult> {
  const normalized = symbol.trim().toUpperCase();
  const outputsize = limit > 100 ? "full" : "compact";
  const sourceUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(normalized)}&outputsize=${outputsize}`;
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim() ?? "";
  const unavailable = (limitation: string): AlphaVantageSeriesResult => ({
    available: false,
    configured: Boolean(apiKey),
    symbol: normalized || symbol,
    source: "Alpha Vantage",
    sourceUrl,
    observedAt: null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "unavailable",
    history: [],
    limitation,
  });
  if (!normalized || !/^[A-Z0-9._:/-]{1,32}$/.test(normalized))
    return unavailable("Alpha Vantage 代码格式无效；未发出请求。");
  if (!apiKey)
    return unavailable(
      "Alpha Vantage 免费额度连接器尚未配置 ALPHA_VANTAGE_API_KEY；系统未发送未授权请求，也未生成替代值。"
    );
  try {
    const requestUrl = `${sourceUrl}&apikey=${encodeURIComponent(apiKey)}`;
    const body = JSON.parse(await fetchText(requestUrl, 15_000)) as Record<
      string,
      unknown
    >;
    const providerError =
      body["Error Message"] ?? body.Note ?? body.Information;
    const series = body["Time Series (Daily)"];
    if (
      providerError ||
      !series ||
      typeof series !== "object" ||
      Array.isArray(series)
    ) {
      return unavailable(
        `Alpha Vantage 返回不可用响应${providerError ? `（${String(providerError)}）` : ""}；未生成替代数据。`
      );
    }
    const points = Object.entries(series as Record<string, unknown>)
      .map(([dateValue, value]): FreeObservation | null => {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
        )
          return null;
        const row = value as Record<string, unknown>;
        const close = finiteNumber(row["4. close"]);
        if (close === null) return null;
        return {
          date: dateValue,
          value: close,
          close,
          open: finiteNumber(row["1. open"]),
          high: finiteNumber(row["2. high"]),
          low: finiteNumber(row["3. low"]),
          volume: finiteNumber(row["5. volume"]),
        };
      })
      .filter((point): point is FreeObservation => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const history = points.slice(
      -Math.min(Math.max(Math.floor(limit), 1), 5000)
    );
    if (!history.length)
      return unavailable(
        "Alpha Vantage 未返回可验证日线观察；系统未填充固定或合成数值。"
      );
    return {
      available: true,
      configured: true,
      symbol: normalized,
      source: "Alpha Vantage",
      sourceUrl,
      observedAt: history.at(-1)?.date ?? null,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "end_of_day",
      history,
      limitation:
        "Alpha Vantage 免费密钥日线端点；免费调用量受账户政策限制，美股实时及 15 分钟延迟许可不包含在此适配器中。",
    };
  } catch (error) {
    return unavailable(
      `Alpha Vantage 请求失败（${error instanceof Error ? error.message : "unknown"}）；系统保持真实空状态。`
    );
  }
}
