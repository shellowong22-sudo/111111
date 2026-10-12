import {
  archiveCanonicalObservationSeries,
  auditAdminMarketIngestion,
} from "./adminMarketIngestion";
import {
  fetchBlsPublicSeries,
  fetchBankOfCanadaFx,
  fetchEiaWeeklyNaturalGasStorage,
  fetchEiaWeeklyPetroleumSeries,
  fetchEurostatEu27Unemployment,
  fetchFredPublicSeries,
  fetchHkmaDailyExchangeRates,
  fetchImfDataMapperSeries,
  fetchTreasuryTotalPublicDebt,
  fetchWorldBankIndicator,
} from "./freeMarketData";
import { eq } from "drizzle-orm";
import {
  managedPublicDatasetStates,
  standaloneSchedules,
} from "../drizzle/schema";
import { getDb } from "./db";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { fetchEuroAreaStatistic } from './eurostatStatistics';
import { annualizeQuarterlyRate } from '../shared/economicStatistics';
import {
  fetchFinceptTaiexSnapshot,
  fetchFinceptTwseEquitySnapshot,
  fetchFinceptTwseValuations,
} from './finceptTaiwanAdapter';
import { archiveFinceptObservations } from './finceptPersistence';
import { fetchFinceptNbpFxBasket, fetchFinceptNbpGold, fetchFinceptNbpUsdPln } from './finceptNbpAdapter';
import { fetchFinceptCnbFxBasket } from './finceptCnbAdapter';
import { fetchFinceptBoiFxBasket } from './finceptBoiAdapter';
import { fetchFinceptCftcDisaggregated } from './finceptCftcAdapter';
import { fetchFinceptCoinGeckoMarkets } from './finceptCryptoAdapter';
import { fetchFinceptCboeVolatilityHistory } from './finceptCboeAdapter';
import { fetchFinceptCboeIndexSnapshot } from './finceptCboeIndexAdapter';
import { fetchFinceptNasdaqScreener } from './finceptNasdaqAdapter';
import {
  fetchFinceptNasdaqDividendCalendar,
  fetchFinceptNasdaqEconomicCalendar,
  fetchFinceptNasdaqEarningsCalendar,
  fetchFinceptNasdaqIpoCalendar,
} from './finceptNasdaqCalendarAdapter';
import { fetchAkShareManagedDataset } from './akshareMarketData';
import { archiveAkShareObservations, recordAkShareFailure } from './aksharePersistence';
import { archivePublicDatasetObservations } from './publicDatasetPersistence';
import { fetchNasdaqHistorical, fetchYahooChart, INTL_BOND_ETFS } from './realDataService';

export const MANAGED_PUBLIC_DATASET_SCHEDULE_NAME =
  "finance-hub-managed-public-datasets";

export const MANAGED_PUBLIC_DATASETS = [
  { id: "euro-area-gdp", label: "欧元区 21 国实际 GDP 季环比", moduleId: "economic-ecst", dataContractId: "macro.ea21.real-gdp.qoq.sca.v1", dataScopeKey: "ea21.gdp.real.qoq.sca", symbol: "EA21:GDP_QOQ_SCA", frequency: "quarterly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "japan-real-gdp", label: "日本实际 GDP 季环比年化", moduleId: "economic-ecst", dataContractId: "macro.jp.real-gdp.qoq-annualized.v1", dataScopeKey: "jp.gdp.real.qoq-annualized", symbol: "NAEXKP01JPQ657S", frequency: "quarterly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "japan-unemployment", label: "日本 15—64 岁季调失业率", moduleId: "economic-ecst", dataContractId: "labor.jp.unemployment.15-64.sa.v1", dataScopeKey: "jp.unemployment.15-64.sa.total", symbol: "LRUN64TTJPM156S", frequency: "monthly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "euro-area-unemployment", label: "欧元区 21 国季调失业率", moduleId: "economic-ecst", dataContractId: "labor.ea21.unemployment.sa.v1", dataScopeKey: "ea21.unemployment.sa.total", symbol: "EA21:UNEMP_SA", frequency: "monthly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "euro-area-hicp", label: "欧元区 21 国 HICP 同比", moduleId: "economic-ecst", dataContractId: "macro.ea21.hicp.yoy.v1", dataScopeKey: "ea21.hicp.all-items.yoy", symbol: "EA21:HICP_YOY", frequency: "monthly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "us-real-gdp", label: "美国实际 GDP 季环比年化", moduleId: "economic-ecst", dataContractId: "macro.us.real-gdp.qoq-annualized.v1", dataScopeKey: "us.gdp.real.qoq-annualized", symbol: "A191RL1Q225SBEA", frequency: "quarterly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "us-core-pce", label: "美国核心 PCE 价格指数", moduleId: "economic-ecst", dataContractId: "macro.us.core-pce.level.v1", dataScopeKey: "us.core-pce.sa.level", symbol: "PCEPILFE", frequency: "monthly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "us-unemployment", label: "美国季调失业率", moduleId: "economic-ecst", dataContractId: "labor.us.unemployment.sa.v1", dataScopeKey: "us.unemployment.sa.rate", symbol: "UNRATE", frequency: "monthly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  { id: "us-nonfarm-payroll", label: "美国季调非农就业人数", moduleId: "economic-ecst", dataContractId: "labor.us.nonfarm-payroll.level.sa.v1", dataScopeKey: "us.nonfarm-payroll.sa.level", symbol: "PAYEMS", frequency: "monthly", pollMinutes: 30, sourceBoundary: "latest_public_release" },
  {
    id: "bls-us-cpi",
    label: "美国 CPI 指数",
    moduleId: "economic-ecst",
    dataContractId: "macro.us.cpi.level.v1",
    dataScopeKey: "us.cpi.unadjusted.level",
    symbol: "CUUR0000SA0 / CPIAUCNS",
    frequency: "monthly",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "eia-us-ng-storage",
    label: "美国天然气库存（EIA）",
    moduleId: "commodity-market",
    dataContractId: "energy.us.natural-gas-storage.weekly.v1",
    dataScopeKey: "us.natural-gas.storage.lower48",
    symbol: "NG.STORAGE.US.W",
    frequency: "weekly",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "eia-us-commercial-crude-inventory",
    label: "美国商业原油库存",
    moduleId: "commodity-market",
    dataContractId: "energy.us.commercial-crude-inventory.eia.weekly.v1",
    dataScopeKey: "us.petroleum.commercial-crude-inventory.excluding-spr",
    symbol: "WCESTUS1",
    frequency: "weekly",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "eia-us-refinery-utilization",
    label: "美国炼厂产能利用率",
    moduleId: "commodity-market",
    dataContractId: "energy.us.refinery-utilization.eia.weekly.v1",
    dataScopeKey: "us.petroleum.refinery-operable-capacity-utilization",
    symbol: "WPULEUS3",
    frequency: "weekly",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-sofr",
    label: "SOFR（FRED）",
    moduleId: "mm-03-mktbeat",
    dataContractId: "rates.us.sofr.fred.v1",
    dataScopeKey: "us.sofr.history",
    symbol: "SOFR",
    frequency: "business_day",
    pollMinutes: 10,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "world-bank-global-gdp",
    label: "全球 GDP（World Bank）",
    moduleId: "economic-ecwb",
    dataContractId: "macro.world.gdp.world-bank.v1",
    dataScopeKey: "world.gdp.nominal.level",
    symbol: "WLD:NY.GDP.MKTP.CD",
    frequency: "annual",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "treasury-us-total-debt",
    label: "美国公共债务总额",
    moduleId: "sov-10-debt",
    dataContractId: "fiscal.us.total-public-debt.daily.v1",
    dataScopeKey: "us.public-debt.total",
    symbol: "US:DEBT_TOTAL",
    frequency: "business_day",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "imf-world-gdp-growth",
    label: "全球 GDP 增速（当前 WEO 版本）",
    moduleId: "economic-ecfc",
    dataContractId: "macro.world.gdp-growth.imf-weo.v1",
    dataScopeKey: "world.gdp.real-growth.weo-current-vintage",
    symbol: "WEOWORLD:NGDP_RPCH",
    frequency: "annual_vintage",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "eurostat-eu27-unemployment",
    label: "欧盟 27 国季调失业率",
    moduleId: "economic-ecst",
    dataContractId: "labor.eu27.unemployment.eurostat.monthly.v1",
    dataScopeKey: "eu27.unemployment.sa.total",
    symbol: "EU27_2020:UNEMP_SA",
    frequency: "monthly",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "hkma-daily-exchange-rates",
    label: "香港金管局每日参考汇率",
    moduleId: "forex-hub",
    dataContractId: "fx.hkma.daily-reference.v1",
    dataScopeKey: "hkma.fx.daily.reference.usd-eur-cny-jpy",
    symbol: "HKMA:ER:EERI:DAILY",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "official_reference",
  },
  {
    id: "bank-of-canada-usdcad",
    label: "加拿大央行 USD/CAD参考汇率",
    moduleId: "forex-hub",
    dataContractId: "fx.bank-of-canada.usdcad.v1",
    dataScopeKey: "bank-of-canada.fx.usdcad.daily-reference",
    symbol: "BOC:FXUSDCAD",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "official_reference",
  },
  {
    id: "fred-sp500-index",
    label: "美国标普 500 日收盘指数",
    moduleId: "index-hub",
    dataContractId: "index.us.sp500.fred.daily.v1",
    dataScopeKey: "us.sp500.close.daily",
    symbol: "SP500",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "yahoo-ftse100-index",
    label: "富时 100 指数日线历史",
    moduleId: "index-hub",
    dataContractId: "index.global.ftse100.yahoo.daily.v1",
    dataScopeKey: "index.global.ftse100.daily",
    symbol: "^FTSE",
    frequency: "business_day",
    pollMinutes: 15,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "yahoo-dax-index",
    label: "德国 DAX 指数日线历史",
    moduleId: "index-hub",
    dataContractId: "index.global.dax.yahoo.daily.v1",
    dataScopeKey: "index.global.dax.daily",
    symbol: "^GDAXI",
    frequency: "business_day",
    pollMinutes: 15,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "yahoo-nikkei225-index",
    label: "日经 225 指数日线历史",
    moduleId: "index-hub",
    dataContractId: "index.global.nikkei225.yahoo.daily.v1",
    dataScopeKey: "index.global.nikkei225.daily",
    symbol: "^N225",
    frequency: "business_day",
    pollMinutes: 15,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "yahoo-hsi-index",
    label: "恒生指数日线历史",
    moduleId: "index-hub",
    dataContractId: "index.global.hsi.yahoo.daily.v1",
    dataScopeKey: "index.global.hsi.daily",
    symbol: "^HSI",
    frequency: "business_day",
    pollMinutes: 15,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "yahoo-sse-index",
    label: "上证综合指数日线历史",
    moduleId: "index-hub",
    dataContractId: "index.global.sse.yahoo.daily.v1",
    dataScopeKey: "index.global.sse.daily",
    symbol: "000001.SS",
    frequency: "business_day",
    pollMinutes: 15,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "yahoo-stoxx50-index",
    label: "Euro Stoxx 50 指数日线历史",
    moduleId: "index-hub",
    dataContractId: "index.global.stoxx50.yahoo.daily.v1",
    dataScopeKey: "index.global.stoxx50.daily",
    symbol: "^STOXX50E",
    frequency: "business_day",
    pollMinutes: 15,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "fred-wti-oil",
    label: "西德州原油现货价格",
    moduleId: "commodity-market",
    dataContractId: "commodity.us.wti-spot.fred.daily.v1",
    dataScopeKey: "us.wti.spot.daily",
    symbol: "DCOILWTICO",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-bitcoin-usd",
    label: "比特币美元参考价",
    moduleId: "crypto-market",
    dataContractId: "crypto.btc-usd.fred.daily.v1",
    dataScopeKey: "crypto.btc.usd.daily",
    symbol: "CBBTCUSD",
    frequency: "daily",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-high-yield-spread",
    label: "美国高收益债期权调整利差",
    moduleId: "bond-market",
    dataContractId: "credit.us.high-yield-oas.fred.daily.v1",
    dataScopeKey: "us.credit.high-yield.oas.daily",
    symbol: "BAMLH0A0HYM2",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-effective-fed-funds",
    label: "美国有效联邦基金利率",
    moduleId: "interest-rates",
    dataContractId: "rates.us.effective-fed-funds.fred.daily.v1",
    dataScopeKey: "us.effective-fed-funds.daily",
    symbol: "DFF",
    frequency: "business_day",
    pollMinutes: 10,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-10y-2y-spread",
    label: "美国 10 年减 2 年期限利差",
    moduleId: "yield-curve",
    dataContractId: "rates.us.10y2y-spread.fred.daily.v1",
    dataScopeKey: "us.treasury.10y2y.spread.daily",
    symbol: "T10Y2Y",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-germany-long-rate",
    label: "德国长期政府债券利率",
    moduleId: "g7-curves",
    dataContractId: "rates.de.long-government-bond.fred.monthly.v1",
    dataScopeKey: "de.government.long-rate.monthly",
    symbol: "IRLTLT01DEM156N",
    frequency: "monthly",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-us-5y-treasury",
    label: "美国 5 年期国债收益率",
    moduleId: "curve-search",
    dataContractId: "rates.us.treasury-5y.fred.daily.v1",
    dataScopeKey: "us.treasury.5y.yield.daily",
    symbol: "DGS5",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-us-2y-treasury",
    label: "美国 2 年期国债收益率",
    moduleId: "curves-compare",
    dataContractId: "rates.us.treasury-2y.fred.daily.v1",
    dataScopeKey: "us.treasury.2y.yield.daily",
    symbol: "DGS2",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "nasdaq-global-bond-etfs",
    label: "全球债券 ETF 日频历史",
    moduleId: "sov-04-wb",
    dataContractId: "bond.global.etf.nasdaq.daily.v1",
    dataScopeKey: "global.bond-etf.igov-bwx-emb-pcy-vwob-emhy-emlc.daily",
    symbol: "GLOBAL_BOND_ETF_BASKET",
    frequency: "business_day",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fred-usd-eur",
    label: "欧元兑美元参考汇率（美元/欧元）",
    moduleId: "forex-curves",
    dataContractId: "fx.usd-eur.fred.daily.v1",
    dataScopeKey: "fx.usd.eur.reference.daily",
    symbol: "DEXUSEU",
    frequency: "business_day",
    pollMinutes: 30,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fincept-twse-equity-snapshot",
    label: "台湾证券交易所股票快照",
    moduleId: "stock-eqs",
    dataContractId: "equity.twse.snapshot.v1",
    dataScopeKey: "twse.equity.latest.snapshot",
    symbol: "TWSE:ALL",
    frequency: "exchange_published",
    pollMinutes: 5,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-twse-equity-valuation",
    label: "台湾股票估值指标",
    moduleId: "stock-eqs",
    dataContractId: "equity.twse.valuation.v1",
    dataScopeKey: "twse.equity.daily.valuation",
    symbol: "TWSE:VALUATIONS",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "latest_public_release",
  },
  {
    id: "fincept-twse-taiex-snapshot",
    label: "台湾加权股价指数快照",
    moduleId: "index-hub",
    dataContractId: "index.twse.taiex.snapshot.v1",
    dataScopeKey: "twse.taiex.latest.snapshot",
    symbol: "TAIEX",
    frequency: "exchange_published",
    pollMinutes: 5,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-nbp-gold-reference",
    label: "黄金兹罗提每克参考价",
    moduleId: "commodity-market",
    dataContractId: "commodity.pl.gold.nbp.daily.v1",
    dataScopeKey: "pl.gold.pln-per-gram.daily-reference",
    symbol: "NBP:GOLD:PLN:G",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-nbp-usdpln-reference",
    label: "美元兑兹罗提参考汇率",
    moduleId: "forex-hub",
    dataContractId: "fx.pl.usd-pln.nbp.daily.v1",
    dataScopeKey: "pl.fx.usd-pln.daily-reference",
    symbol: "USD/PLN",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-nbp-fx-basket",
    label: "多币种兑兹罗提参考汇率",
    moduleId: "forex-hub",
    dataContractId: "fx.pl.multi-pln.nbp.daily.v1",
    dataScopeKey: "pl.fx.multi-pln.daily-reference",
    symbol: "NBP:TABLE:A:PLN",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-cnb-fx-basket",
    label: "捷克央行多币种参考汇率",
    moduleId: "forex-hub",
    dataContractId: "fx.cz.cnb.daily-reference.v1",
    dataScopeKey: "cz.fx.cnb.daily-reference",
    symbol: "CNB:TABLE:DAILY:CZK",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-boi-fx-basket",
    label: "以色列银行多币种参考汇率",
    moduleId: "forex-hub",
    dataContractId: "fx.il.boi.daily-reference.v1",
    dataScopeKey: "il.fx.boi.daily-reference",
    symbol: "BOI:TABLE:DAILY:ILS",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "official_reference",
  },
  {
    id: "fincept-cftc-disaggregated-weekly",
    label: "CFTC 全球期货持仓周报",
    moduleId: "commodity-futures",
    dataContractId: "derivatives.global.cftc-disaggregated.weekly.v1",
    dataScopeKey: "cftc.disaggregated.futures.weekly",
    symbol: "CFTC:COT:DISAGG",
    frequency: "weekly",
    pollMinutes: 60,
    sourceBoundary: "official_public_report",
  },
  {
    id: "fincept-coingecko-markets",
    label: "全球加密资产公开市场快照",
    moduleId: "crypto-market",
    dataContractId: "crypto.global.coingecko.markets.daily.v1",
    dataScopeKey: "crypto.global.coingecko.markets",
    symbol: "COINGECKO:MARKETS",
    frequency: "daily_public",
    pollMinutes: 10,
    sourceBoundary: "public_market_observation",
  },
  {
    id: "fincept-cboe-volatility-history",
    label: "CBOE 全球波动率指数历史",
    moduleId: "index-hub",
    dataContractId: "index.global.cboe-volatility.daily.v1",
    dataScopeKey: "index.global.cboe-volatility",
    symbol: "CBOE:VOLATILITY",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "official_public_report",
  },
  {
    id: "fincept-cboe-index-snapshot",
    label: "CBOE 全球指数延迟快照",
    moduleId: "index-hub",
    dataContractId: "index.global.cboe-delayed-snapshot.daily.v1",
    dataScopeKey: "index.global.cboe-delayed-snapshot",
    symbol: "CBOE:US-INDICES",
    frequency: "delayed_public",
    pollMinutes: 10,
    sourceBoundary: "official_delayed_snapshot",
  },
  {
    id: "fincept-nasdaq-screener",
    label: "Nasdaq 公开股票筛选快照",
    moduleId: "stock-eqs",
    dataContractId: "equity.global.nasdaq-screener.daily.v1",
    dataScopeKey: "equity.global.nasdaq-screener",
    symbol: "NASDAQ:SCREENER",
    frequency: "daily_public",
    pollMinutes: 10,
    sourceBoundary: "public_delayed_observation",
  },
  {
    id: "fincept-nasdaq-earnings-calendar",
    label: "Nasdaq 全球股票财报日历",
    moduleId: "stock-eqs",
    dataContractId: "equity.global.nasdaq-earnings-calendar.daily.v1",
    dataScopeKey: "equity.global.nasdaq-earnings-calendar",
    symbol: "NASDAQ:EARNINGS",
    frequency: "daily_public",
    pollMinutes: 30,
    sourceBoundary: "public_delayed_calendar",
  },
  {
    id: "fincept-nasdaq-dividend-calendar",
    label: "Nasdaq 全球股票分红日历",
    moduleId: "stock-eqs",
    dataContractId: "equity.global.nasdaq-dividend-calendar.daily.v1",
    dataScopeKey: "equity.global.nasdaq-dividend-calendar",
    symbol: "NASDAQ:DIVIDENDS",
    frequency: "daily_public",
    pollMinutes: 30,
    sourceBoundary: "public_delayed_calendar",
  },
  {
    id: "fincept-nasdaq-ipo-calendar",
    label: "Nasdaq 全球股票 IPO 日历",
    moduleId: "stock-eqs",
    dataContractId: "equity.global.nasdaq-ipo-calendar.monthly.v1",
    dataScopeKey: "equity.global.nasdaq-ipo-calendar",
    symbol: "NASDAQ:IPO",
    frequency: "monthly_public",
    pollMinutes: 60,
    sourceBoundary: "public_delayed_calendar",
  },
  {
    id: "fincept-nasdaq-economic-calendar",
    label: "Nasdaq 全球宏观事件日历",
    moduleId: "economic-ecst",
    dataContractId: "macro.global.nasdaq-economic-calendar.daily.v1",
    dataScopeKey: "macro.global.nasdaq-economic-calendar",
    symbol: "NASDAQ:ECONOMIC",
    frequency: "daily_public",
    pollMinutes: 30,
    sourceBoundary: "public_delayed_calendar",
  },
  {
    id: "akshare-cn-stock-snapshot",
    label: "中国股票公开快照",
    moduleId: "stock-eqs",
    dataContractId: "equity.cn.a.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.a.snapshot",
    symbol: "CN:A:ALL",
    frequency: "verified_market_session",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-cn-stock-directory",
    label: "中国股票代码与名称目录",
    moduleId: "stock-eqs",
    dataContractId: "equity.cn.directory.akshare.v1",
    dataScopeKey: "akshare.cn.equity.directory",
    symbol: "CN:A:DIRECTORY",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "public_reference",
  },
  {
    id: "akshare-hk-stock-snapshot",
    label: "港股公开快照",
    moduleId: "stock-eqs",
    dataContractId: "equity.hk.snapshot.akshare.v1",
    dataScopeKey: "akshare.hk.snapshot",
    symbol: "HK:ALL",
    frequency: "intraday_public",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-us-stock-snapshot",
    label: "美股公开快照",
    moduleId: "stock-eqs",
    dataContractId: "equity.us.snapshot.akshare.v1",
    dataScopeKey: "akshare.us.snapshot",
    symbol: "US:ALL",
    frequency: "intraday_public",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-cn-index-snapshot",
    label: "中国指数公开快照",
    moduleId: "index-hub",
    dataContractId: "index.cn.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.index.snapshot",
    symbol: "CN:INDEX:ALL",
    frequency: "verified_market_session",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-global-index-snapshot",
    label: "全球指数公开快照",
    moduleId: "index-hub",
    dataContractId: "index.global.snapshot.akshare.v1",
    dataScopeKey: "akshare.global.index.snapshot",
    symbol: "GLOBAL:INDEX:ALL",
    frequency: "intraday_public",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-etf-snapshot",
    label: "ETF 交易日单位净值",
    moduleId: "fund-browse",
    dataContractId: "fund.etf.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.etf.snapshot",
    symbol: "CN:ETF:ALL",
    frequency: "daily_nav",
    pollMinutes: 60,
    sourceBoundary: "daily_nav_not_exchange_quote",
  },
  {
    id: "akshare-fund-snapshot",
    label: "开放式基金净值公开快照",
    moduleId: "fund-browse",
    dataContractId: "fund.open.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.fund.snapshot",
    symbol: "CN:FUND:ALL",
    frequency: "intraday_public",
    pollMinutes: 10,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-forex-snapshot",
    label: "外汇公开快照",
    moduleId: "forex-hub",
    dataContractId: "fx.cn.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.fx.snapshot",
    symbol: "CN:FX:ALL",
    frequency: "intraday_public",
    pollMinutes: 10,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-futures-snapshot",
    label: "期货公开快照",
    moduleId: "commodity-futures",
    dataContractId: "derivatives.global.futures.snapshot.akshare.v1",
    dataScopeKey: "akshare.global.futures.snapshot",
    symbol: "GLOBAL:FUTURES:ALL",
    frequency: "intraday_public",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-cn-futures-snapshot",
    label: "中国期货公开快照",
    moduleId: "commodity-futures",
    dataContractId: "derivatives.cn.futures.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.futures.snapshot",
    symbol: "CN:FUTURES:ALL",
    frequency: "intraday_public",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-cn-futures-inventory",
    label: "沪铜库存公开序列",
    moduleId: "commodity-futures",
    dataContractId: "derivatives.cn.futures.inventory.akshare.v1",
    dataScopeKey: "akshare.cn.futures.inventory.cu",
    symbol: "CN:FUTURES:INVENTORY:CU",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-options-snapshot",
    label: "期权公开快照",
    moduleId: "moso",
    dataContractId: "derivatives.cn.options.snapshot.akshare.v1",
    dataScopeKey: "akshare.cn.options.snapshot",
    symbol: "CN:OPTIONS:ALL",
    frequency: "intraday_public",
    pollMinutes: 5,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-bond-curve",
    label: "中美国债收益率曲线",
    moduleId: "bond-market",
    dataContractId: "rates.cn-us.bond-curve.akshare.v1",
    dataScopeKey: "akshare.cn-us.bond.curve",
    symbol: "CN_US:BOND_CURVE",
    frequency: "daily_public",
    pollMinutes: 30,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-news-publication",
    label: "公开新闻动态",
    moduleId: "news-top",
    dataContractId: "news.public.publication.akshare.v1",
    dataScopeKey: "akshare.news.publication",
    symbol: "NEWS:PUBLIC",
    frequency: "publication",
    pollMinutes: 10,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-economic-gdp",
    label: "中国宏观 GDP 观察",
    moduleId: "economic-ecst",
    dataContractId: "macro.cn.gdp.akshare.v1",
    dataScopeKey: "akshare.cn.gdp",
    symbol: "CN:GDP",
    frequency: "release",
    pollMinutes: 60,
    sourceBoundary: "public_release",
  },
  {
    id: "akshare-economic-cpi",
    label: "中国宏观 CPI 观察",
    moduleId: "economic-ecst",
    dataContractId: "macro.cn.cpi.akshare.v1",
    dataScopeKey: "akshare.cn.cpi",
    symbol: "CN:CPI",
    frequency: "release",
    pollMinutes: 60,
    sourceBoundary: "public_release",
  },
  {
    id: "akshare-economic-pmi",
    label: "中国宏观 PMI 观察",
    moduleId: "economic-ecst",
    dataContractId: "macro.cn.pmi.akshare.v1",
    dataScopeKey: "akshare.cn.pmi",
    symbol: "CN:PMI",
    frequency: "release",
    pollMinutes: 60,
    sourceBoundary: "public_release",
  },
  {
    id: "akshare-global-sox-index",
    label: "费城半导体指数历史",
    moduleId: "index-hub",
    dataContractId: "index.global.sox.akshare.v1",
    dataScopeKey: "akshare.global.sox.index",
    symbol: "GLOBAL:SOX",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-global-shipping-bdi",
    label: "波罗的海干散货指数",
    moduleId: "commodity-market",
    dataContractId: "commodity.global.bdi.akshare.v1",
    dataScopeKey: "akshare.global.shipping.bdi",
    symbol: "GLOBAL:BDI",
    frequency: "daily_public",
    pollMinutes: 60,
    sourceBoundary: "public_observation",
  },
  {
    id: "akshare-japan-bank-rate",
    label: "日本央行政策利率历史",
    moduleId: "economic-ecst",
    dataContractId: "rates.jp.bank-policy.akshare.v1",
    dataScopeKey: "akshare.jp.bank-policy.rate",
    symbol: "JP:POLICY_RATE",
    frequency: "release",
    pollMinutes: 60,
    sourceBoundary: "public_release",
  },
  {
    id: "akshare-uk-bank-rate",
    label: "英格兰银行政策利率历史",
    moduleId: "economic-ecst",
    dataContractId: "rates.uk.bank-policy.akshare.v1",
    dataScopeKey: "akshare.uk.bank-policy.rate",
    symbol: "UK:POLICY_RATE",
    frequency: "release",
    pollMinutes: 60,
    sourceBoundary: "public_release",
  },
  {
    id: "akshare-news-cctv",
    label: "央视公开新闻动态",
    moduleId: "news-top",
    dataContractId: "news.cn.cctv.akshare.v1",
    dataScopeKey: "akshare.news.cctv",
    symbol: "NEWS:CCTV",
    frequency: "publication",
    pollMinutes: 30,
    sourceBoundary: "public_observation",
  },
] as const;

export function assertManagedPublicDatasetUniqueness(
  datasets: ReadonlyArray<{
    id: string;
    moduleId: string;
    dataContractId: string;
    dataScopeKey: string;
    symbol: string;
  }> = MANAGED_PUBLIC_DATASETS
) {
  const dimensions = {
    id: datasets.map(dataset => dataset.id),
    contract: datasets.map(dataset => dataset.dataContractId),
    scope: datasets.map(dataset => dataset.dataScopeKey),
    symbol: datasets.map(dataset => dataset.symbol),
    ownership: datasets.map(
      dataset => `${dataset.moduleId}|${dataset.dataContractId}`
    ),
  };
  for (const [dimension, values] of Object.entries(dimensions)) {
    const duplicate = values.find(
      (value, index) => values.indexOf(value) !== index
    );
    if (duplicate)
      throw new Error(
        `MANAGED_PUBLIC_DATASET_DUPLICATE:${dimension}:${duplicate}`
      );
  }
  return true;
}

assertManagedPublicDatasetUniqueness();

export type ManagedPublicDatasetId =
  (typeof MANAGED_PUBLIC_DATASETS)[number]["id"];

export type ManagedBatchResult = {
  id: ManagedPublicDatasetId;
  status: "available" | "unavailable" | "deferred" | "failed";
  reason: string | null;
  observedAt?: string | null;
  nextAttemptAt: Date | null;
  archive: {
    inserted: number;
    duplicate: number;
    revisions: number;
    total: number;
    storage?: string;
  } | null;
};

type ManagedSeriesResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: boolean;
  delayStatus: string;
  limitation: string;
  history: Array<{ date: string; value: number | null; fields?: Record<string, unknown> }>;
};

async function fetchYahooIndexDataset(
  symbol: string,
  label: string,
  region: string,
): Promise<ManagedSeriesResult> {
  const result = await fetchYahooChart(symbol, "5y", "1d");
  const history = (result?.history ?? [])
    .filter(point => Number.isFinite(point.value))
    .map(point => ({
      date: point.date,
      value: point.value,
      fields: {
        symbol,
        name: label,
        region,
        type: "equity_index",
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
        currency: result?.currency ?? null,
      },
    }));
  const observedAt = history.at(-1)?.date ?? null;
  const delayStatus = typeof result?.meta.realtimeStatus === "string"
    ? result.meta.realtimeStatus
    : "end_of_day";
  return {
    available: history.length > 0,
    symbol,
    source: result?.source ?? "Yahoo Finance public chart",
    sourceUrl: "https://query1.finance.yahoo.com/v8/finance/chart/",
    observedAt,
    retrievedAt: new Date().toISOString(),
    realtime: delayStatus === "realtime",
    delayStatus,
    history,
    limitation: result
      ? "Yahoo Finance 公共图表日线观察；保留真实观察时间和 OHLCV 字段，不将日线标记为交易所实时逐笔。"
      : "Yahoo Finance 公共图表本次未返回可验证观察；系统未补造指数值。",
  };
}

const fetchers: Record<
  ManagedPublicDatasetId,
  () => Promise<ManagedSeriesResult>
> = {
  "euro-area-gdp": () => fetchEuroAreaStatistic('gdp'),
  "japan-real-gdp": async () => {
    const result = await fetchFredPublicSeries("NAEXKP01JPQ657S", 240);
    return {
      ...result,
      history: result.history.flatMap(point => {
        const annualized = annualizeQuarterlyRate(point.value);
        return annualized === null ? [] : [{ date: point.date, value: annualized, fields: { quarterlyRate: point.value, transform: "compound_four_quarters" } }];
      }),
      limitation: `${result.limitation} 季环比观察按复利四次转换为年化率；不使用预测值。`,
    };
  },
  "japan-unemployment": () => fetchFredPublicSeries("LRUN64TTJPM156S", 240),
  "euro-area-unemployment": () => fetchEuroAreaStatistic('unemployment'),
  "euro-area-hicp": () => fetchEuroAreaStatistic('hicp'),
  "us-real-gdp": () => fetchFredPublicSeries("A191RL1Q225SBEA", 240),
  "us-core-pce": () => fetchFredPublicSeries("PCEPILFE", 240),
  "us-unemployment": () => fetchFredPublicSeries("UNRATE", 240),
  "us-nonfarm-payroll": () => fetchFredPublicSeries("PAYEMS", 240),
  "bls-us-cpi": async () => {
    const primary = await fetchBlsPublicSeries(
      "CUUR0000SA0",
      new Date().getUTCFullYear() - 10,
      new Date().getUTCFullYear(),
      240
    );
    if (primary.available) return primary;
    // Some server networks are denied by BLS's CDN even though the public API
    // is healthy. CPIAUCNS is the same unadjusted CPI level redistributed as a
    // public observation series. CPIAUCSL is seasonally adjusted and must not
    // be mixed into this canonical contract. Preserve the actual returned
    // symbol/source in the immutable ledger instead of pretending the primary
    // request succeeded.
    const fallback = await fetchFredPublicSeries("CPIAUCNS", 240);
    return fallback.available
      ? {
          ...fallback,
          limitation: `${fallback.limitation} BLS 直连本次不可用，已使用同一官方统计序列的公开分发通道。`,
        }
      : primary;
  },
  "eia-us-ng-storage": () => fetchEiaWeeklyNaturalGasStorage(520),
  "eia-us-commercial-crude-inventory": () => fetchEiaWeeklyPetroleumSeries("WCESTUS1", 2_500),
  "eia-us-refinery-utilization": () => fetchEiaWeeklyPetroleumSeries("WPULEUS3", 2_500),
  "fred-sofr": () => fetchFredPublicSeries("SOFR", 2_500),
  "world-bank-global-gdp": () =>
    fetchWorldBankIndicator("WLD", "NY.GDP.MKTP.CD", 80),
  "treasury-us-total-debt": () => fetchTreasuryTotalPublicDebt(1_000),
  "imf-world-gdp-growth": () =>
    fetchImfDataMapperSeries("NGDP_RPCH", "WEOWORLD", 80),
  "eurostat-eu27-unemployment": () =>
    fetchEurostatEu27Unemployment(240),
  "hkma-daily-exchange-rates": async () => {
    const result = await fetchHkmaDailyExchangeRates(100);
    return {
      available: result.available,
      symbol: "HKMA:ER:EERI:DAILY",
      source: result.source,
      sourceUrl: result.sourceUrl,
      observedAt: result.observedAt,
      retrievedAt: result.retrievedAt,
      realtime: result.realtime,
      delayStatus: result.delayStatus,
      history: result.observations.map(({ date, usd, eur, cny, jpy, index }) => ({
        date, value: usd,
        fields: { usd, eur, cny, jpy, index, unit: "HKD per foreign currency unit", indexBase: "2020 trade weighted" },
      })),
      limitation: result.limitation,
    } satisfies ManagedSeriesResult;
  },
  "bank-of-canada-usdcad": async () => ({
    ...await fetchBankOfCanadaFx(1_000), symbol: "BOC:FXUSDCAD",
  }),
  "fred-sp500-index": () => fetchFredPublicSeries("SP500", 2_500),
  "yahoo-ftse100-index": () => fetchYahooIndexDataset("^FTSE", "富时 100", "英国"),
  "yahoo-dax-index": () => fetchYahooIndexDataset("^GDAXI", "德国 DAX", "德国"),
  "yahoo-nikkei225-index": () => fetchYahooIndexDataset("^N225", "日经 225", "日本"),
  "yahoo-hsi-index": () => fetchYahooIndexDataset("^HSI", "恒生指数", "中国香港"),
  "yahoo-sse-index": () => fetchYahooIndexDataset("000001.SS", "上证综合指数", "中国大陆"),
  "yahoo-stoxx50-index": () => fetchYahooIndexDataset("^STOXX50E", "Euro Stoxx 50", "欧洲"),
  "fred-wti-oil": () => fetchFredPublicSeries("DCOILWTICO", 2_500),
  "fred-bitcoin-usd": () => fetchFredPublicSeries("CBBTCUSD", 2_500),
  "fred-high-yield-spread": () => fetchFredPublicSeries("BAMLH0A0HYM2", 2_500),
  "fred-effective-fed-funds": () => fetchFredPublicSeries("DFF", 2_500),
  "fred-10y-2y-spread": () => fetchFredPublicSeries("T10Y2Y", 2_500),
  "fred-germany-long-rate": () => fetchFredPublicSeries("IRLTLT01DEM156N", 2_500),
  "fred-us-5y-treasury": () => fetchFredPublicSeries("DGS5", 2_500),
  "fred-us-2y-treasury": () => fetchFredPublicSeries("DGS2", 2_500),
  "nasdaq-global-bond-etfs": async () => {
    const results = await Promise.all(Object.values(INTL_BOND_ETFS).map(async etf => ({
      etf,
      chart: await fetchNasdaqHistorical(etf.symbol, "1mo", "etf"),
    })));
    const history = results.flatMap(({ etf, chart }) => (chart?.history ?? []).map(point => ({
      date: point.date,
      value: point.value,
      fields: {
        symbol: etf.symbol,
        name: etf.name,
        close: point.close,
        volume: point.volume,
        currency: chart?.currency ?? "USD",
      },
    })));
    const observedAt = history.map(point => point.date).sort().at(-1) ?? null;
    return {
      available: history.length > 0,
      symbol: "GLOBAL_BOND_ETF_BASKET",
      source: "Nasdaq historical market data",
      sourceUrl: "https://api.nasdaq.com/api/quote/",
      observedAt,
      retrievedAt: new Date().toISOString(),
      realtime: false,
      delayStatus: "end_of_day",
      limitation: "实际公开日线；只按每只 ETF 代码及观测日去重，不是盘中可交易报价。",
      history,
    };
  },
  "fred-usd-eur": () => fetchFredPublicSeries("DEXUSEU", 2_500),
  "fincept-twse-equity-snapshot": async () => {
    const result = await fetchFinceptTwseEquitySnapshot();
    return {
      ...result,
      history: result.history.map(point => ({
        date: point.date,
        value: typeof point.payload.value === "number" ? point.payload.value : null,
        fields: point.payload,
      })),
    } satisfies ManagedSeriesResult;
  },
  "fincept-twse-equity-valuation": async () => {
    const result = await fetchFinceptTwseValuations();
    return {
      ...result,
      history: result.history.map(point => ({
        date: point.date,
        value: typeof point.payload.value === "number" ? point.payload.value : null,
        fields: point.payload,
      })),
    } satisfies ManagedSeriesResult;
  },
  "fincept-twse-taiex-snapshot": async () => {
    const result = await fetchFinceptTaiexSnapshot();
    return {
      ...result,
      history: result.history.map(point => ({
        date: point.date,
        value: typeof point.payload.value === "number" ? point.payload.value : null,
        fields: point.payload,
      })),
    } satisfies ManagedSeriesResult;
  },
  "fincept-nbp-gold-reference": () => fetchFinceptNbpGold(),
  "fincept-nbp-usdpln-reference": () => fetchFinceptNbpUsdPln(),
  "fincept-nbp-fx-basket": () => fetchFinceptNbpFxBasket(),
  "fincept-cnb-fx-basket": async () => fetchFinceptCnbFxBasket(),
  "fincept-boi-fx-basket": async () => fetchFinceptBoiFxBasket(),
  "fincept-cftc-disaggregated-weekly": async () => {
    const result = await fetchFinceptCftcDisaggregated();
    return {
      ...result,
      history: result.history.map(point => ({
        date: point.date,
        value: point.value,
        fields: point.fields,
        symbol: point.symbol,
      })),
    } satisfies ManagedSeriesResult;
  },
  "fincept-coingecko-markets": async () =>
    fetchFinceptCoinGeckoMarkets(250),
  "fincept-cboe-volatility-history": async () =>
    fetchFinceptCboeVolatilityHistory(),
  "fincept-cboe-index-snapshot": async () =>
    fetchFinceptCboeIndexSnapshot(),
  "fincept-nasdaq-screener": async () =>
    fetchFinceptNasdaqScreener(),
  "fincept-nasdaq-earnings-calendar": async () =>
    fetchFinceptNasdaqEarningsCalendar(),
  "fincept-nasdaq-dividend-calendar": async () =>
    fetchFinceptNasdaqDividendCalendar(),
  "fincept-nasdaq-ipo-calendar": async () =>
    fetchFinceptNasdaqIpoCalendar(),
  "fincept-nasdaq-economic-calendar": async () =>
    fetchFinceptNasdaqEconomicCalendar(),
  "akshare-cn-stock-snapshot": async () => {
    const result = await fetchAkShareManagedDataset("stock_snapshot");
    return result;
  },
  "akshare-cn-stock-directory": async () =>
    fetchAkShareManagedDataset("stock_directory"),
  "akshare-hk-stock-snapshot": async () => fetchAkShareManagedDataset("hk_stock_snapshot"),
  "akshare-us-stock-snapshot": async () => fetchAkShareManagedDataset("us_stock_snapshot"),
  "akshare-cn-index-snapshot": async () => fetchAkShareManagedDataset("cn_index_snapshot"),
  "akshare-global-index-snapshot": async () => {
    const result = await fetchAkShareManagedDataset("global_index_snapshot");
    return result;
  },
  "akshare-etf-snapshot": async () => {
    const result = await fetchAkShareManagedDataset("etf_snapshot");
    return result;
  },
  "akshare-fund-snapshot": async () => fetchAkShareManagedDataset("fund_snapshot"),
  "akshare-forex-snapshot": async () => fetchAkShareManagedDataset("forex_snapshot"),
  "akshare-futures-snapshot": async () => {
    const result = await fetchAkShareManagedDataset("futures_snapshot");
    return result;
  },
  "akshare-cn-futures-snapshot": async () => fetchAkShareManagedDataset("futures_cn_snapshot"),
  "akshare-cn-futures-inventory": async () =>
    fetchAkShareManagedDataset("futures_inventory"),
  "akshare-options-snapshot": async () => {
    const result = await fetchAkShareManagedDataset("options_snapshot");
    return result;
  },
  "akshare-bond-curve": async () => fetchAkShareManagedDataset("bond_curve"),
  "akshare-news-publication": async () => {
    const result = await fetchAkShareManagedDataset("news_publication");
    return result;
  },
  "akshare-economic-gdp": async () => {
    const result = await fetchAkShareManagedDataset("economic_gdp");
    return result;
  },
  "akshare-economic-cpi": async () => {
    const result = await fetchAkShareManagedDataset("economic_cpi");
    return result;
  },
  "akshare-economic-pmi": async () => fetchAkShareManagedDataset("economic_pmi"),
  "akshare-global-sox-index": async () =>
    fetchAkShareManagedDataset("macro_semiconductor_index"),
  "akshare-global-shipping-bdi": async () =>
    fetchAkShareManagedDataset("macro_shipping_bdi"),
  "akshare-japan-bank-rate": async () =>
    fetchAkShareManagedDataset("macro_japan_bank_rate"),
  "akshare-uk-bank-rate": async () =>
    fetchAkShareManagedDataset("macro_uk_bank_rate"),
  "akshare-news-cctv": async () =>
    fetchAkShareManagedDataset("news_cctv"),
};

export function listManagedPublicDatasets() {
  return MANAGED_PUBLIC_DATASETS.map(dataset => ({ ...dataset }));
}

export async function listManagedPublicDatasetStates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managedPublicDatasetStates);
}

export async function getManagedPublicDatasetSchedule() {
  const db = await getDb();
  if (!db) return null;
  const row = (
    await db
      .select()
      .from(standaloneSchedules)
      .where(eq(standaloneSchedules.name, MANAGED_PUBLIC_DATASET_SCHEDULE_NAME))
      .limit(1)
  )[0];
  return row
    ? {
        taskUid: `standalone:${row.id}`,
        cronExpression: row.cronExpression,
        isEnabled: row.isEnabled,
        lastExecutedAt: row.lastExecutedAt,
        lastStatus: row.lastStatus,
        lastError: row.lastError,
      }
    : null;
}

export async function enableManagedPublicDatasetSchedule(cron: string) {
  const current = await getManagedPublicDatasetSchedule();
  const job = {
    cron,
    path: "/api/scheduled/adminManagedPublicDatasets",
    method: "POST" as const,
    payload: {},
    description:
      "Finance Hub 公开数据契约定时采集：按唯一模块归属清洗、指纹去重并永久归档。",
  };
  if (current) {
    await updateHeartbeatJob(
      current.taskUid,
      { ...job, enable: true },
      ""
    );
    return { taskUid: current.taskUid, cronExpression: cron, created: false };
  }
  const created = await createHeartbeatJob(
    { ...job, name: MANAGED_PUBLIC_DATASET_SCHEDULE_NAME },
    ""
  );
  return { taskUid: created.taskUid, cronExpression: cron, created: true };
}

export async function pauseManagedPublicDatasetSchedule() {
  const current = await getManagedPublicDatasetSchedule();
  if (!current) throw new Error("MANAGED_PUBLIC_DATASET_SCHEDULE_NOT_CONFIGURED");
  await updateHeartbeatJob(current.taskUid, { enable: false }, "");
  return { taskUid: current.taskUid, paused: true };
}

let activeBatch: Promise<Awaited<ReturnType<typeof collectDueDatasets>>> | null = null;
export function syncAllManagedPublicDatasets(actorUserId: number | null) {
  if (activeBatch) return activeBatch;
  activeBatch = collectDueDatasets(actorUserId).finally(() => { activeBatch = null; });
  return activeBatch;
}

export type FinceptBatchResult = {
  scope: "fincept" | "archive_backed";
  startedAt: string;
  completedAt: string;
  requested: number;
  available: number;
  unavailable: number;
  failed: number;
  inserted: number;
  duplicate: number;
  revisions: number;
  results: Array<ManagedBatchResult & { label: string; moduleId: string; dataContractId: string }>;
};

/**
 * Run the ZIP-backed connectors as one bounded batch.
 *
 * A ZIP inventory is not itself an API connection.  Only dataset IDs that
 * already have a server fetcher, a unique contract and a persistence path are
 * selected here.  AKShare wrappers are included in the archive_backed scope
 * because several Fincept screens delegate their public market observations to
 * that provider.  The result is intentionally per-dataset so the admin UI can
 * distinguish real data, empty responses and failed connectors instead of
 * turning a partial batch into a false “all connected” state.
 */
export async function syncFinceptDatasets(
  actorUserId: number | null,
  scope: FinceptBatchResult["scope"] = "archive_backed",
) {
  const startedAt = new Date().toISOString();
  const datasets = MANAGED_PUBLIC_DATASETS.filter(dataset =>
    scope === "fincept"
      ? dataset.id.startsWith("fincept-")
      : dataset.id.startsWith("fincept-") || dataset.id.startsWith("akshare-"),
  );
  const results: FinceptBatchResult["results"] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < datasets.length) {
      const dataset = datasets[cursor++];
      try {
        const result = await syncManagedPublicDataset(dataset.id, actorUserId);
        results.push({
          ...result,
          nextAttemptAt: null,
          label: dataset.label,
          moduleId: dataset.moduleId,
          dataContractId: dataset.dataContractId,
        });
      } catch (error) {
        results.push({
          id: dataset.id,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
          nextAttemptAt: null,
          archive: null,
          label: dataset.label,
          moduleId: dataset.moduleId,
          dataContractId: dataset.dataContractId,
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, Math.max(1, datasets.length)) }, () => worker()),
  );
  const completedAt = new Date().toISOString();
  return {
    scope,
    startedAt,
    completedAt,
    requested: datasets.length,
    available: results.filter(result => result.status === "available").length,
    unavailable: results.filter(result => result.status === "unavailable").length,
    failed: results.filter(result => result.status === "failed").length,
    inserted: results.reduce((total, result) => total + (result.archive?.inserted ?? 0), 0),
    duplicate: results.reduce((total, result) => total + (result.archive?.duplicate ?? 0), 0),
    revisions: results.reduce((total, result) => total + (result.archive?.revisions ?? 0), 0),
    results: results.sort((left, right) => left.id.localeCompare(right.id)),
  } satisfies FinceptBatchResult;
}

async function collectDueDatasets(actorUserId: number | null) {
  const results: ManagedBatchResult[] = [];
  const states = await listManagedPublicDatasetStates();
  const stateById = new Map(states.map(item => [item.datasetId, item]));
  const due = MANAGED_PUBLIC_DATASETS.filter(dataset => {
    const state = stateById.get(dataset.id);
    return !(state?.nextAttemptAt && state.nextAttemptAt.getTime() > Date.now());
  });
  for (const dataset of MANAGED_PUBLIC_DATASETS) {
    const state = stateById.get(dataset.id);
    if (state?.nextAttemptAt && state.nextAttemptAt.getTime() > Date.now()) {
      results.push({
        id: dataset.id,
        status: "deferred",
        reason: state.lastError ?? null,
        nextAttemptAt: state.nextAttemptAt,
        archive: null,
      });
    }
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < due.length) {
      const dataset = due[cursor++];
      try {
        const result = await syncManagedPublicDataset(dataset.id, actorUserId);
        const updated = (await listManagedPublicDatasetStates()).find(
          item => item.datasetId === dataset.id
        );
        results.push({
          ...result,
          reason: result.reason ?? null,
          nextAttemptAt: updated?.nextAttemptAt ?? null,
        });
      } catch (error) {
        results.push({
          id: dataset.id,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
          nextAttemptAt: null,
          archive: null,
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, Math.max(1, due.length)) }, () => worker())
  );
  return results;
}

export function managedDatasetRetryMinutes(
  pollMinutes: number,
  consecutiveFailures: number,
  available: boolean
) {
  if (available) return pollMinutes;
  return Math.min(
    pollMinutes * 2 ** Math.min(Math.max(consecutiveFailures - 1, 0), 4),
    360
  );
}

async function recordManagedPublicDatasetState(input: {
  datasetId: ManagedPublicDatasetId;
  attemptedAt: Date;
  succeededAt: Date | null;
  nextAttemptAt: Date;
  consecutiveFailures: number;
  lastStatus: string;
  lastError: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const values = {
    datasetId: input.datasetId,
    lastAttemptAt: input.attemptedAt,
    lastSuccessAt: input.succeededAt,
    nextAttemptAt: input.nextAttemptAt,
    consecutiveFailures: input.consecutiveFailures,
    lastStatus: input.lastStatus,
    lastError: input.lastError?.slice(0, 1000) ?? null,
    updatedAt: new Date(),
  };
  await db
    .insert(managedPublicDatasetStates)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
}

const activeDatasetSyncs = new Map<ManagedPublicDatasetId, Promise<Awaited<ReturnType<typeof collectManagedPublicDataset>>>>();

export function syncManagedPublicDataset(id: ManagedPublicDatasetId, actorUserId: number | null) {
  const active = activeDatasetSyncs.get(id);
  if (active) return active;
  const operation = (async () => {
    const dataset = MANAGED_PUBLIC_DATASETS.find(item => item.id === id);
    if (!dataset) throw new Error("MANAGED_PUBLIC_DATASET_NOT_FOUND");
    const state = (await listManagedPublicDatasetStates()).find(item => item.datasetId === id);
    const attemptedAt = new Date();
    try {
      const result = await collectManagedPublicDataset(id, actorUserId);
      const succeeded = result.status === "available";
      const failures = succeeded ? 0 : (state?.consecutiveFailures ?? 0) + 1;
      try {
        await recordManagedPublicDatasetState({
          datasetId: id, attemptedAt,
          succeededAt: succeeded ? new Date() : state?.lastSuccessAt ?? null,
          nextAttemptAt: new Date(Date.now() + managedDatasetRetryMinutes(dataset.pollMinutes, failures, succeeded) * 60_000),
          consecutiveFailures: failures, lastStatus: result.status, lastError: result.reason,
        });
      } catch (error) {
        if (
          !id.startsWith("akshare-") &&
          !id.startsWith("fincept-") &&
          !(error instanceof Error && error.message === "DATABASE_UNAVAILABLE")
        )
          throw error;
        // When the primary database is unavailable, AKShare still has a
        // durable local ledger. Persist an unavailable result there as well,
        // so the admin surface distinguishes "not checked" from a real
        // timeout/empty response and never presents an unverified capability
        // as successful.
        if (!succeeded && id.startsWith("akshare-")) {
          await recordAkShareFailure(
            dataset.dataContractId,
            result.reason ?? "AKSHARE_NO_VERIFIED_OBSERVATION",
          );
        }
      }
      return result;
    } catch (error) {
      const failures = (state?.consecutiveFailures ?? 0) + 1;
      try {
        await recordManagedPublicDatasetState({
          datasetId: id, attemptedAt, succeededAt: state?.lastSuccessAt ?? null,
          nextAttemptAt: new Date(Date.now() + managedDatasetRetryMinutes(dataset.pollMinutes, failures, false) * 60_000),
          consecutiveFailures: failures, lastStatus: "failed",
          lastError: error instanceof Error ? error.message : String(error),
        });
      } catch (stateError) {
        if (
          !id.startsWith("akshare-") &&
          !id.startsWith("fincept-") &&
          !(stateError instanceof Error && stateError.message === "DATABASE_UNAVAILABLE")
        )
          throw stateError;
        const dataset = MANAGED_PUBLIC_DATASETS.find(item => item.id === id);
        if (dataset && id.startsWith("akshare-")) {
          await recordAkShareFailure(
            dataset.dataContractId,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      throw error;
    }
  })().finally(() => activeDatasetSyncs.delete(id));
  activeDatasetSyncs.set(id, operation);
  return operation;
}

export function managedObservationSymbol(
  datasetId: string,
  fields: Record<string, unknown> | undefined,
  fallback: string,
) {
  // A ticker is not a unique coin identity. Distinct CoinGecko assets can
  // share the same ticker and disclosure day.
  if (datasetId === "fincept-coingecko-markets" &&
      typeof fields?.coinId === "string" &&
      /^[a-z0-9-]{1,80}$/.test(fields.coinId)) return fields.coinId;
  return typeof fields?.symbol === "string" && fields.symbol.trim()
    ? fields.symbol : fallback;
}

async function collectManagedPublicDataset(
  id: ManagedPublicDatasetId,
  actorUserId: number | null
) {
  const dataset = MANAGED_PUBLIC_DATASETS.find(item => item.id === id);
  if (!dataset) throw new Error("MANAGED_PUBLIC_DATASET_NOT_FOUND");
  await auditAdminMarketIngestion({
    actorUserId,
    action: "sync_started",
    detail: `开始读取并归档 ${dataset.label}，唯一归属 ${dataset.moduleId}。`,
  });
  const result = await fetchers[id]();
  if (!result.available || !result.history.length) {
    await auditAdminMarketIngestion({
      actorUserId,
      action: "sync_unavailable",
      detail: `${dataset.label} 未返回可验证观察：${result.limitation}`,
    });
    return {
      id,
      status: "unavailable" as const,
      reason: result.limitation,
      archive: null,
    };
  }
  const history = result.history.map(point => ({
    date: point.date,
    payload: {
      value: point.value,
      ...point.fields,
      frequency: dataset.frequency,
      delayStatus: result.delayStatus,
      ...(id === "imf-world-gdp-growth"
        ? {
            periodKind:
              Number(point.date) > new Date().getUTCFullYear()
                ? "forecast"
                : Number(point.date) === new Date().getUTCFullYear()
                  ? "estimate_or_forecast"
                  : "historical_or_estimate",
          }
        : {}),
    },
    // Crypto ticker symbols are not unique (distinct assets can both use
    // "BTC"). Persist CoinGecko's stable coin ID as the archive identity so
    // same-day observations cannot overwrite an unrelated asset.
    symbol: managedObservationSymbol(id, point.fields, result.symbol),
  }));
  let archive: { inserted: number; duplicate: number; revisions: number; total: number; storage?: string };
  try {
    archive = await archiveCanonicalObservationSeries({
      moduleId: dataset.moduleId,
      dataContractId: dataset.dataContractId,
      symbol: result.symbol,
      source: result.source,
      sourceReference: `backend:${dataset.id}`,
      schemaVersion: "public-observation-v1",
      fetchedAt: new Date(result.retrievedAt),
      history,
    });
  } catch (error) {
    if (id.startsWith("akshare-")) {
      archive = await archiveAkShareObservations({
        moduleId: dataset.moduleId,
        dataContractId: dataset.dataContractId,
        symbol: result.symbol,
        fetchedAt: new Date(result.retrievedAt),
        history,
      });
    } else if (id.startsWith("fincept-")) {
      archive = await archiveFinceptObservations({
        moduleId: dataset.moduleId,
        dataContractId: dataset.dataContractId,
        symbol: result.symbol,
        fetchedAt: new Date(result.retrievedAt),
        source: result.source,
        history,
      });
    } else if (error instanceof Error && error.message === "DATABASE_UNAVAILABLE") {
      archive = await archivePublicDatasetObservations({
        moduleId: dataset.moduleId,
        dataContractId: dataset.dataContractId,
        symbol: result.symbol,
        fetchedAt: new Date(result.retrievedAt),
        history,
      });
    } else throw error;
  }
  await auditAdminMarketIngestion({
    actorUserId,
    action: "sync_completed",
    detail: `${dataset.label} 归档完成：新增 ${archive.inserted}、修订 ${archive.revisions}、重复拦截 ${archive.duplicate}。`,
  });
  return {
    id,
    status: "available" as const,
    reason: null,
    observedAt: result.observedAt,
    archive,
  };
}
