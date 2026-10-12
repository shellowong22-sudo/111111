import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import {
  adminDataModuleContentItems,
  financeToolUnionSet,
  financeWorldDataset,
  spiderAiProcessed,
  spiderContentSnapshot,
  spiderDataBlood,
  spiderEntityLink,
  spiderFailLog,
  spiderMissingScanLog,
  spiderPushRelation,
  spiderRawData,
  spiderSeedPool,
  spiderTasks,
  users,
} from "../drizzle/schema";
import {
  ADMIN_DATA_MODULES,
  recommendAdminDataModuleIdsForType,
} from "../shared/adminDataModules";
import { getDb } from "./db";
import { getPublicModuleFeed, isNearDuplicatePublicContent, publicContentFingerprint, toPublicFeedItem } from "./adminModulePublicFeed";
import {
  isTopLongformModule,
  toPlainNewsHeadline,
} from "./newsLongform";
import {
  enqueueAdminCrawlerGapUpdate,
  getAdminDataModuleAutomationSchedule,
} from "./adminDataModuleAutomation";

const OFFICIAL_SEEDS = [
  ["SEC EDGAR", "https://www.sec.gov/edgar/search/", "监管披露", "en", "北美"],
  [
    "美国 SEC RSS",
    "https://www.sec.gov/news/pressreleases.rss",
    "监管新闻",
    "en",
    "北美",
  ],
  [
    "SEC 13F Holdings API",
    "https://data.sec.gov/submissions/",
    "机构持仓与股票基金",
    "en",
    "北美",
  ],
  [
    "Cboe Options Quotes",
    "https://www.cboe.com/us/options/market_statistics/",
    "期权报价与波动率",
    "en",
    "北美",
  ],
  [
    "OCC Options Volume",
    "https://www.theocc.com/market-data/volume",
    "期权成交与持仓",
    "en",
    "北美",
  ],
  [
    "Nasdaq Trader Market Data",
    "https://www.nasdaqtrader.com/Trader.aspx?id=DailyMarketSummary",
    "股票与 ETF 行情",
    "en",
    "北美",
  ],
  [
    "NYSE Market Data",
    "https://www.nyse.com/market-data",
    "股票与 ETF 行情",
    "en",
    "北美",
  ],
  [
    "Euronext Derivatives",
    "https://live.euronext.com/en/products/derivatives",
    "期权期货与波动率",
    "en",
    "欧洲",
  ],
  [
    "Eurex Market Data",
    "https://www.eurex.com/ex-en/markets",
    "欧洲期货期权行情",
    "en",
    "欧洲",
  ],
  [
    "香港交易所衍生产品",
    "https://www.hkex.com.hk/Products/Listed-Derivatives/Equity-Products",
    "股票期权与指数期货",
    "en",
    "亚洲",
  ],
  [
    "新加坡交易所衍生品",
    "https://www.sgx.com/derivatives",
    "亚洲期货期权行情",
    "en",
    "亚洲",
  ],
  [
    "澳大利亚证券交易所行情",
    "https://www.asx.com.au/markets/trade-our-cash-market/overview",
    "股票与 ETF 行情",
    "en",
    "大洋洲",
  ],
  [
    "iShares ETF 数据",
    "https://www.ishares.com/us/products/146727/ishares-core-sp-500-etf",
    "基金持仓与净值",
    "en",
    "北美",
  ],
  [
    "Vanguard ETF 数据",
    "https://investor.vanguard.com/investment-products/etfs/profile/vti",
    "基金持仓与净值",
    "en",
    "北美",
  ],
  [
    "Morningstar Fund Data",
    "https://www.morningstar.com/funds",
    "全球基金分类与绩效",
    "en",
    "全球",
  ],
  [
    "Stooq Market CSV",
    "https://stooq.com/q/d/l/",
    "股票基金历史行情",
    "en",
    "全球",
  ],
  [
    "美国联邦储备",
    "https://www.federalreserve.gov/feeds/press_all.xml",
    "央行与宏观",
    "en",
    "北美",
  ],
  [
    "纽约联储参考利率 API",
    "https://markets.newyorkfed.org/api/rates/all/latest.json",
    "货币市场参考利率与成交分布",
    "en",
    "北美",
  ],
  [
    "美联储商业票据统计",
    "https://www.federalreserve.gov/releases/cp/",
    "货币市场商业票据",
    "en",
    "北美",
  ],
  [
    "FHFA 房价指数数据集",
    "https://www.fhfa.gov/data/hpi/datasets",
    "抵押住房与房价",
    "en",
    "北美",
  ],
  [
    "Fannie Mae 抵押支持证券",
    "https://capitalmarkets.fanniemae.com/mortgage-backed-securities",
    "机构抵押债披露",
    "en",
    "北美",
  ],
  [
    "Freddie Mac 单户贷款级数据",
    "https://www.freddiemac.com/research/datasets/sf-loanlevel-dataset",
    "抵押贷款表现",
    "en",
    "北美",
  ],
  [
    "Ginnie Mae 披露与报告",
    "https://www.ginniemae.gov/investors/disclosures_and_reports/Pages/default.aspx",
    "机构抵押债披露",
    "en",
    "北美",
  ],
  [
    "HMDA 抵押贷款数据浏览器",
    "https://ffiec.cfpb.gov/data-browser/",
    "抵押贷款发放",
    "en",
    "北美",
  ],
  [
    "美国劳工统计局",
    "https://www.bls.gov/feed/bls_latest.rss",
    "统计局",
    "en",
    "北美",
  ],
  ["美国能源信息署", "https://www.eia.gov/rss/", "能源数据", "en", "北美"],
  ["世界银行数据", "https://api.worldbank.org/v2/", "全球宏观", "en", "全球"],
  ["IMF Data", "https://www.imf.org/en/Data", "全球宏观", "en", "全球"],
  [
    "ECB Data Portal",
    "https://data.ecb.europa.eu/",
    "央行与宏观",
    "en",
    "欧洲",
  ],
  [
    "欧洲央行关键利率",
    "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
    "货币市场政策走廊",
    "en",
    "欧洲",
  ],
  [
    "欧洲统计局",
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/",
    "统计局",
    "en",
    "欧洲",
  ],
  [
    "香港交易所",
    "https://www.hkex.com.hk/Services/RSS-Feeds/News-Releases?sc_lang=zh-HK",
    "交易所披露",
    "zh-HK",
    "亚洲",
  ],
  [
    "上海证券交易所",
    "https://www.sse.com.cn/disclosure/listedinfo/announcement/",
    "交易所披露",
    "zh-CN",
    "亚洲",
  ],
  [
    "深圳证券交易所",
    "https://www.szse.cn/disclosure/listed/notice/index.html",
    "交易所披露",
    "zh-CN",
    "亚洲",
  ],
  [
    "中国人民银行",
    "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html",
    "央行与宏观",
    "zh-CN",
    "亚洲",
  ],
  ["中国国家统计局", "https://www.stats.gov.cn/sj/", "统计局", "zh-CN", "亚洲"],
  [
    "日本交易所集团",
    "https://www.jpx.co.jp/english/news/index.html",
    "交易所披露",
    "en",
    "亚洲",
  ],
  [
    "伦敦证券交易所",
    "https://www.londonstockexchange.com/news",
    "交易所披露",
    "en",
    "欧洲",
  ],
  [
    "NASDAQ Trader",
    "https://www.nasdaqtrader.com/Trader.aspx?id=MarketSystemStatus",
    "交易所数据",
    "en",
    "北美",
  ],
  [
    "arXiv Quantitative Finance",
    "https://export.arxiv.org/api/query?search_query=cat:q-fin*",
    "金融论文",
    "en",
    "全球",
  ],
  [
    "GitHub QuantLib",
    "https://github.com/lballabio/QuantLib",
    "开源金融工具",
    "en",
    "全球",
  ],
  [
    "Gitee 量化检索",
    "https://search.gitee.com/?q=%E9%87%8F%E5%8C%96",
    "开源金融工具",
    "zh-CN",
    "亚洲",
  ],
  [
    "纽约证券交易所",
    "https://www.nyse.com/market-data/reference/nyse-group-short-interest",
    "交易所数据",
    "en",
    "北美",
  ],
  [
    "Cboe 市场数据",
    "https://www.cboe.com/us/equities/market_statistics/",
    "期权与波动率",
    "en",
    "北美",
  ],
  [
    "美国财政部",
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
    "国债与利率",
    "en",
    "北美",
  ],
  [
    "FDIC 银行数据",
    "https://www.fdic.gov/bank-data-guide",
    "银行与信用",
    "en",
    "北美",
  ],
  [
    "加拿大央行",
    "https://www.bankofcanada.ca/valet/docs",
    "央行与宏观",
    "en",
    "北美",
  ],
  [
    "英格兰银行",
    "https://www.bankofengland.co.uk/boeapps/database/",
    "央行与宏观",
    "en",
    "欧洲",
  ],
  ["瑞士国家银行", "https://data.snb.ch/en", "央行与宏观", "en", "欧洲"],
  [
    "德国联邦银行",
    "https://www.bundesbank.de/en/statistics/time-series-databases",
    "央行与宏观",
    "en",
    "欧洲",
  ],
  [
    "法国 INSEE",
    "https://www.insee.fr/en/statistiques",
    "统计局",
    "en",
    "欧洲",
  ],
  [
    "新加坡交易所",
    "https://www.sgx.com/securities/company-announcements",
    "交易所披露",
    "en",
    "亚洲",
  ],
  [
    "澳大利亚证券交易所",
    "https://www.asx.com.au/markets/trade-our-cash-market/announcements",
    "交易所披露",
    "en",
    "大洋洲",
  ],
  [
    "澳大利亚储备银行",
    "https://www.rba.gov.au/statistics/",
    "央行与宏观",
    "en",
    "大洋洲",
  ],
  ["印度储备银行", "https://data.rbi.org.in/", "央行与宏观", "en", "亚洲"],
  [
    "韩国交易所",
    "https://global.krx.co.kr/main/main.jsp",
    "交易所数据",
    "en",
    "亚洲",
  ],
  [
    "巴西央行",
    "https://www.bcb.gov.br/en/statistics",
    "央行与宏观",
    "en",
    "南美",
  ],
  ["OECD Data", "https://data-explorer.oecd.org/", "全球宏观", "en", "全球"],
  ["BIS Statistics", "https://data.bis.org/", "银行与跨境资金", "en", "全球"],
  ["UN Comtrade", "https://comtradeplus.un.org/", "全球贸易", "en", "全球"],
  ["FRED", "https://fred.stlouisfed.org/", "宏观时序", "en", "北美"],
  [
    "ESMA Registers",
    "https://registers.esma.europa.eu/publication/",
    "监管披露",
    "en",
    "欧洲",
  ],
  [
    "美国财政数据 API",
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/",
    "国债与财政融资",
    "en",
    "北美",
  ],
  [
    "TreasuryDirect 拍卖",
    "https://www.treasurydirect.gov/auctions/announcements-data-results/",
    "国债拍卖与发行",
    "en",
    "北美",
  ],
  [
    "英国债务管理办公室",
    "https://www.dmo.gov.uk/data/",
    "主权债发行与曲线",
    "en",
    "欧洲",
  ],
  [
    "加拿大债务管理",
    "https://www.canada.ca/en/department-finance/services/publications/debt-management-report.html",
    "主权债发行与持有人",
    "en",
    "北美",
  ],
  [
    "日本财务省 JGB",
    "https://www.mof.go.jp/english/policy/jgbs/",
    "主权债拍卖与持有人",
    "en",
    "亚洲",
  ],
  [
    "德国金融署",
    "https://www.deutsche-finanzagentur.de/en/federal-securities",
    "主权债发行与曲线",
    "en",
    "欧洲",
  ],
  [
    "法国国库署",
    "https://www.aft.gouv.fr/en",
    "主权债发行与曲线",
    "en",
    "欧洲",
  ],
  [
    "意大利公共债务",
    "https://www.dt.mef.gov.it/en/debito_pubblico/",
    "主权债发行与持有人",
    "en",
    "欧洲",
  ],
  [
    "澳大利亚金融管理办公室",
    "https://www.aofm.gov.au/securities",
    "主权债发行与曲线",
    "en",
    "大洋洲",
  ],
  [
    "新西兰债务管理",
    "https://debtmanagement.treasury.govt.nz/",
    "主权债发行与曲线",
    "en",
    "大洋洲",
  ],
  ["荷兰国库署", "https://english.dsta.nl/", "主权债发行与曲线", "en", "欧洲"],
  [
    "比利时债务署",
    "https://www.debtagency.be/en",
    "主权债发行与曲线",
    "en",
    "欧洲",
  ],
  [
    "瑞典国家债务办公室",
    "https://www.riksgalden.se/en/our-operations/central-government-debt/",
    "主权债发行与曲线",
    "en",
    "欧洲",
  ],
  [
    "FINRA TRACE",
    "https://www.finra.org/finra-data/browse-catalog/trace",
    "债券成交与流动性",
    "en",
    "北美",
  ],
  ["MSRB EMMA", "https://emma.msrb.org/", "市政债披露与成交", "en", "北美"],
  [
    "CFTC 持仓报告",
    "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
    "衍生品持仓与资金",
    "en",
    "北美",
  ],
  [
    "CME 产品与结算",
    "https://www.cmegroup.com/market-data.html",
    "期货期权与结算",
    "en",
    "全球",
  ],
  ["IOSCO 公告", "https://www.iosco.org/news/", "全球监管新闻", "en", "全球"],
  [
    "世界交易所联合会",
    "https://www.world-exchanges.org/our-work/statistics",
    "全球交易所统计",
    "en",
    "全球",
  ],
  [
    "日本央行统计",
    "https://www.stat-search.boj.or.jp/index_en.html",
    "央行与宏观",
    "en",
    "亚洲",
  ],
  [
    "挪威央行数据",
    "https://www.norges-bank.no/en/topics/Statistics/",
    "央行与宏观",
    "en",
    "欧洲",
  ],
  [
    "瑞典央行统计",
    "https://www.riksbank.se/en-gb/statistics/",
    "央行与宏观",
    "en",
    "欧洲",
  ],
  [
    "印度尼西亚央行统计",
    "https://www.bi.go.id/en/statistik/Default.aspx",
    "央行与宏观",
    "en",
    "亚洲",
  ],
  [
    "墨西哥央行数据",
    "https://www.banxico.org.mx/SieInternet/",
    "央行与宏观",
    "es",
    "北美",
  ],
  [
    "南非储备银行数据",
    "https://www.resbank.co.za/en/home/what-we-do/statistics",
    "央行与宏观",
    "en",
    "非洲",
  ],
  [
    "智利央行统计",
    "https://www.bcentral.cl/en/web/banco-central/areas/statistics",
    "央行与宏观",
    "en",
    "南美",
  ],
  [
    "ECB Data API",
    "https://data-api.ecb.europa.eu/service/",
    "央行时序接口",
    "en",
    "欧洲",
  ],
  [
    "OECD SDMX API",
    "https://sdmx.oecd.org/public/rest/v1/",
    "全球宏观接口",
    "en",
    "全球",
  ],
  [
    "BIS Data API",
    "https://stats.bis.org/api-doc/v1/",
    "银行跨境与债券接口",
    "en",
    "全球",
  ],
  [
    "SEC CompanyFacts API",
    "https://data.sec.gov/api/xbrl/companyfacts/",
    "企业财务披露",
    "en",
    "北美",
  ],
  [
    "英国 Companies House",
    "https://developer.company-information.service.gov.uk/",
    "企业注册与财务披露",
    "en",
    "欧洲",
  ],
  [
    "Euronext 公告",
    "https://live.euronext.com/en/resources/notices",
    "交易所公告",
    "en",
    "欧洲",
  ],
  [
    "欧盟数据门户",
    "https://data.europa.eu/api/hub/search/",
    "公开金融数据集",
    "en",
    "欧洲",
  ],
  [
    "美国联邦公报 API",
    "https://www.federalregister.gov/developers/documentation/api/v1",
    "监管与政策公告",
    "en",
    "北美",
  ],
  [
    "IMF SDMX 数据接口",
    "https://www.imf.org/external/datamapper/api/v1/",
    "全球宏观接口",
    "en",
    "全球",
  ],
  [
    "世界银行国际债务统计",
    "https://api.worldbank.org/v2/country/all/indicator/DT.DOD.DECT.CD",
    "主权外债时序",
    "en",
    "全球",
  ],
  [
    "美国财政部每日收益率",
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView",
    "国债收益率曲线",
    "en",
    "北美",
  ],
  [
    "欧洲央行政府债券统计",
    "https://data.ecb.europa.eu/data/datasets/GFS",
    "欧元区财政与政府债务",
    "en",
    "欧洲",
  ],
  [
    "欧盟委员会 AMECO",
    "https://economy-finance.ec.europa.eu/economic-research-and-databases/economic-databases/ameco-database_en",
    "财政预测与债务",
    "en",
    "欧洲",
  ],
  [
    "中国债券信息网",
    "https://www.chinabond.com.cn/",
    "国债发行与收益率",
    "zh-CN",
    "亚洲",
  ],
  [
    "中国财政部国债管理",
    "https://gks.mof.gov.cn/ztztz/guozaiguanli/",
    "国债发行与财政融资",
    "zh-CN",
    "亚洲",
  ],
  [
    "印度政府债券数据库",
    "https://www.rbi.org.in/scripts/AnnualReportPublications.aspx",
    "主权债发行与持有人",
    "en",
    "亚洲",
  ],
  [
    "新加坡政府证券",
    "https://eservices.mas.gov.sg/statistics/fdanet/BenchmarkPricesAndYields.aspx",
    "主权债收益率与发行",
    "en",
    "亚洲",
  ],
  [
    "巴西国库署公开债务",
    "https://www.tesourotransparente.gov.br/temas/divida-publica-federal",
    "主权债发行与期限结构",
    "pt",
    "南美",
  ],
  [
    "墨西哥财政部公共债务",
    "https://www.finanzaspublicas.hacienda.gob.mx/",
    "主权债发行与财政",
    "es",
    "北美",
  ],
  [
    "南非储备银行债券数据",
    "https://www.resbank.co.za/en/home/what-we-do/statistics/key-statistics/selected-historical-rates",
    "主权债利率与宏观",
    "en",
    "非洲",
  ],
] as const;

const DEFAULT_TOOLS = [
  {
    name: "Black-Scholes 欧式期权定价",
    top: "期权定价",
    sub: "欧式期权",
    formula: "C=S·N(d1)-K·e^(-rT)·N(d2)",
    risk: "中",
    market: ["股票", "指数", "外汇"],
    assets: ["期权"],
    modules: ["ovme", "index-options", "equity-derivatives"],
    source:
      "https://www.quantlib.org/reference/class_quant_lib_1_1_black_calculator.html",
  },
  {
    name: "历史模拟法 VaR",
    top: "风险模型",
    sub: "市场风险",
    formula: "VaRα=-Quantile(P&L,1-α)",
    risk: "高",
    market: ["全球"],
    assets: ["多资产组合"],
    modules: ["mars", "risk-management", "pricing-risk"],
    source: "https://www.bis.org/bcbs/publ/d457.htm",
  },
  {
    name: "夏普比率",
    top: "组合分析",
    sub: "风险调整收益",
    formula: "Sharpe=(Rp-Rf)/σp",
    risk: "低",
    market: ["全球"],
    assets: ["多资产组合"],
    modules: ["portfolio-optimizer", "bquant", "asset-allocation"],
    source:
      "https://www.cfainstitute.org/insights/professional-learning/refresher-readings/portfolio-risk-return-part-i",
  },
  {
    name: "加权平均资本成本 WACC",
    top: "估值模型",
    sub: "企业估值",
    formula: "WACC=E/V·Re+D/V·Rd·(1-Tc)",
    risk: "中",
    market: ["全球股票"],
    assets: ["股票", "企业"],
    modules: ["financial-analysis", "industry-analysis", "equity-market"],
    source: "https://pages.stern.nyu.edu/~adamodar/",
  },
  {
    name: "相对强弱指数 RSI",
    top: "技术指标",
    sub: "动量指标",
    formula: "RSI=100-100/(1+RS)",
    risk: "中",
    market: ["全球"],
    assets: ["股票", "ETF", "期货", "外汇"],
    modules: ["market", "equity-market", "bquant"],
    source: "https://www.ta-lib.org/functions/",
  },
  {
    name: "均值方差组合优化",
    top: "组合分析",
    sub: "资产配置",
    formula: "min wᵀΣw, s.t. wᵀμ≥μ*",
    risk: "高",
    market: ["全球"],
    assets: ["多资产组合"],
    modules: ["portfolio-optimizer", "asset-allocation", "mars"],
    source: "https://web.stanford.edu/~boyd/cvxbook/",
  },
] as const;

function toolDocumentation(name: string, formula: string) {
  if (name.includes("Black-Scholes"))
    return {
      inputs: [
        { name: "S", type: "number", range: "> 0", desc: "标的现价" },
        { name: "K", type: "number", range: "> 0", desc: "执行价" },
        { name: "T", type: "number", range: "> 0", desc: "剩余期限（年）" },
        {
          name: "r",
          type: "number",
          range: "-0.2~1",
          desc: "连续复利无风险利率",
        },
        { name: "sigma", type: "number", range: "> 0", desc: "年化波动率" },
      ],
      outputs: [
        { name: "optionPrice", type: "number", desc: "欧式期权理论价格" },
        {
          name: "greeks",
          type: "object",
          desc: "Delta、Gamma、Vega、Theta、Rho",
        },
      ],
      scene: "欧式、无提前行权且参数边界明确的期权理论定价与敏感度分析。",
      limitation:
        "不直接适用于美式提前行权、离散大额分红、跳跃扩散或流动性不足市场。",
      sample: {
        input: { S: 100, K: 100, T: 1, r: 0.03, sigma: 0.2 },
        expectedCallApprox: 9.41,
      },
    };
  if (name.includes("VaR"))
    return {
      inputs: [
        {
          name: "pnlSeries",
          type: "number[]",
          range: "至少 250 个观测",
          desc: "历史损益序列",
        },
        {
          name: "confidence",
          type: "number",
          range: "0.90~0.999",
          default: 0.99,
          desc: "置信水平",
        },
        {
          name: "holdingPeriod",
          type: "number",
          range: ">=1",
          default: 1,
          desc: "持有期",
        },
      ],
      outputs: [
        { name: "VaR", type: "number", desc: "给定置信水平下损失分位数" },
        { name: "ES", type: "number", desc: "尾部期望损失" },
      ],
      scene: "组合市场风险限额、历史压力观察和日常风险报告。",
      limitation:
        "历史样本不能保证覆盖未来制度变化；结果高度依赖窗口、置信水平和数据清洗。",
      sample: {
        observations: 500,
        confidence: 0.99,
        validation: "滚动窗口覆盖率回测",
      },
    };
  if (name.includes("夏普"))
    return {
      inputs: [
        { name: "portfolioReturn", type: "number[]", desc: "组合收益序列" },
        { name: "riskFreeRate", type: "number", desc: "同频无风险利率" },
        {
          name: "annualization",
          type: "number",
          default: 252,
          desc: "年化因子",
        },
      ],
      outputs: [
        { name: "sharpeRatio", type: "number", desc: "年化超额收益/波动率" },
      ],
      scene: "相同计价口径下比较策略或组合的风险调整收益。",
      limitation:
        "对非正态、强自相关和尾部风险策略可能产生误导；必须统一收益频率。",
      sample: {
        annualReturn: 0.12,
        riskFreeRate: 0.02,
        volatility: 0.15,
        resultApprox: 0.67,
      },
    };
  if (name.includes("WACC"))
    return {
      inputs: [
        { name: "equityValue", type: "number", desc: "权益市场价值" },
        { name: "debtValue", type: "number", desc: "有息债务价值" },
        { name: "costOfEquity", type: "number", desc: "权益资本成本" },
        { name: "costOfDebt", type: "number", desc: "税前债务成本" },
        { name: "taxRate", type: "number", desc: "边际税率" },
      ],
      outputs: [{ name: "wacc", type: "number", desc: "加权平均资本成本" }],
      scene: "DCF 折现率、资本结构分析和价值投资情景比较。",
      limitation:
        "资本结构、Beta、信用利差和税率变化会显著改变结果，不能机械套用单点值。",
      sample: { E: 70, D: 30, Re: 0.1, Rd: 0.05, tax: 0.25, result: 0.08125 },
    };
  if (name.includes("RSI"))
    return {
      inputs: [
        { name: "close", type: "number[]", desc: "复权收盘价序列" },
        {
          name: "period",
          type: "integer",
          range: "2~250",
          default: 14,
          desc: "Wilder 周期",
        },
      ],
      outputs: [{ name: "rsi", type: "number[]", desc: "0~100 动量指标序列" }],
      scene: "趋势和震荡市场中的动量状态观察，可与价格结构及成交量交叉验证。",
      limitation:
        "超买/超卖不等于反转信号；强趋势中可能长期钝化，需明确复权和缺失值口径。",
      sample: {
        period: 14,
        interpretation: "70 以上仅表示强势/偏热，需结合趋势确认",
      },
    };
  return {
    inputs: [
      { name: "expectedReturns", type: "number[]", desc: "资产预期收益" },
      { name: "covariance", type: "matrix", desc: "对称半正定协方差矩阵" },
      {
        name: "constraints",
        type: "object",
        desc: "权重、行业、换手与风险约束",
      },
    ],
    outputs: [
      { name: "weights", type: "number[]", desc: "满足约束的组合权重" },
      { name: "riskReturn", type: "object", desc: "预期风险收益摘要" },
    ],
    scene: "资产配置、风险预算、再平衡和约束条件下的组合权重研究。",
    limitation:
      "均值和协方差估计误差会被优化器放大，应使用收缩估计、约束与样本外验证。",
    sample: {
      assets: 4,
      constraints: "权重和为 1、单资产不高于 40%",
      validation: "滚动样本外回测",
    },
  };
}

function key(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

type SpiderDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type ContentSnapshotInput = {
  entityUuid: string;
  entityType: string;
  sourceUrl: string | null;
  contentHash: string;
  rawUuid?: string | null;
  snapshotContent: string | null;
  changeSummary: string;
};

/**
 * Append a content snapshot only when the canonical fingerprint changes.
 *
 * Historical snapshots are append-only: the previous version remains
 * addressable, while a repeat crawl of identical bytes becomes a no-op.  A
 * duplicate-version race is handled by re-reading the latest row; the caller
 * therefore never receives a synthetic version or overwrites the archive.
 */
async function recordContentSnapshot(db: SpiderDb, input: ContentSnapshotInput) {
  const latest = (
    await db
      .select({ id: spiderContentSnapshot.id, version: spiderContentSnapshot.version, contentHash: spiderContentSnapshot.contentHash })
      .from(spiderContentSnapshot)
      .where(eq(spiderContentSnapshot.entityUuid, input.entityUuid))
      .orderBy(desc(spiderContentSnapshot.version))
      .limit(1)
  )[0];
  if (latest?.contentHash === input.contentHash) {
    return { created: false as const, version: latest.version, snapshotUuid: null };
  }
  const version = (latest?.version ?? 0) + 1;
  const snapshotUuid = key("snapshot");
  try {
    await db.insert(spiderContentSnapshot).values({
      snapshotUuid,
      entityUuid: input.entityUuid,
      entityType: input.entityType,
      version,
      sourceUrl: input.sourceUrl,
      contentHash: input.contentHash,
      rawUuid: input.rawUuid ?? null,
      snapshotContent: input.snapshotContent,
      changeSummary: input.changeSummary,
    });
    return { created: true as const, version, snapshotUuid };
  } catch (error) {
    // UNIQUE(entity_uuid, version) is the final concurrency gate.  If another
    // worker inserted this version first, return its row rather than creating
    // a second historical record.
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate|unique/i.test(message)) throw error;
    const winner = (
      await db
        .select({ version: spiderContentSnapshot.version, snapshotUuid: spiderContentSnapshot.snapshotUuid, contentHash: spiderContentSnapshot.contentHash })
        .from(spiderContentSnapshot)
        .where(eq(spiderContentSnapshot.entityUuid, input.entityUuid))
        .orderBy(desc(spiderContentSnapshot.version))
        .limit(1)
    )[0];
    if (winner?.contentHash === input.contentHash) {
      return { created: false as const, version: winner.version, snapshotUuid: winner.snapshotUuid };
    }
    throw error;
  }
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block: string, name: string) {
  const match = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i")
  );
  return match ? decodeXml(match[1]) : "";
}

function parsePublicFeed(content: string, fallbackUrl: string) {
  const rss = [
    ...content.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
  ].map(match => match[1]);
  const atom = rss.length
    ? []
    : [...content.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map(
        match => match[1]
      );
  return [...rss, ...atom].slice(0, 25).map(block => {
    const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const textLink = xmlTag(block, "link");
    return {
      title: xmlTag(block, "title") || "未命名公开信息",
      summary:
        xmlTag(block, "description") ||
        xmlTag(block, "summary") ||
        xmlTag(block, "content"),
      publishedAt:
        xmlTag(block, "pubDate") ||
        xmlTag(block, "published") ||
        xmlTag(block, "updated"),
      url: href || textLink || xmlTag(block, "guid") || fallbackUrl,
    };
  });
}

function editorialText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(
      /^(?:简单说|换句话说|重点)(?:，这条信息(?:主要讲的|关注的)?是)?[:：，]?\s*/i,
      ""
    )
    .replace(/(?:内容仅用于信息研究，不构成投资建议。?)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function editorialFacts(value: string) {
  return [
    ...new Set(
      (
        value.match(
          /(?:\$|€|£|¥)?\d[\d,.]*(?:%|\s*(?:million|billion|trillion|mn|bn|bps))?|(?:19|20)\d{2}(?:[-/]\d{1,2})?(?:[-/]\d{1,2})?/gi
        ) ?? []
      )
        .map(item => item.trim())
        .filter(item => item.length > 1)
    ),
  ].slice(0, 6);
}

const CRAWLER_EDITORIAL_RULES = [
  {
    test: /Rule 3a12-8|European Union Debt Obligations/i,
    title: "欧盟债务工具拟纳入美国交易法豁免证券范围",
    event:
      "美国证交会提出修订《1934 年证券交易法》Rule 3a12-8，把欧盟发行的债务工具加入该规则所列的外国政府债务工具范围。当前仍处在提案阶段，不代表最终规则已经生效。",
    follow:
      "后续应逐项核对适用证券定义、意见期、最终文本、生效日和过渡安排，并把法律分类变化与信用质量、结算能力、抵押品资格及指数纳入分开判断。",
  },
  {
    test: /market statistics|initial public offerings?|\bipos?\b|proceeds raised/i,
    title: "资本市场发行统计出现新变化",
    event:
      "监管统计更新聚焦首次公开发行数量与募资规模，核心是发行活动是否真正回暖，以及融资窗口能否覆盖更多企业。",
    follow:
      "后续应对照发行宗数、募资额中位数、撤回项目比例和上市后成交表现，避免只用总额判断一级市场温度。",
  },
  {
    test: /transfer agents?/i,
    title: "证券过户代理规则进入现代化修订阶段",
    event:
      "规则提案指向证券登记、清算衔接与投资者记录维护，当前属于制度修订流程，并不等同于新规已经生效。",
    follow:
      "核验重点是意见征集截止日、适用机构范围、系统改造成本和最终生效安排。",
  },
  {
    test: /24[- ]hour trading|roundtable/i,
    title: "全天候交易准备工作进入公开讨论节点",
    event:
      "会议议程与参与方已经公布，讨论焦点落在连续交易条件下的流动性、清算、风险控制和运行保障。",
    follow: "应继续追踪会议结论、行业反馈、技术标准与正式规则之间的时间差。",
  },
  {
    test: /financial reporting|accounting unit/i,
    title: "财务报告与会计执法设立专项力量",
    event:
      "执法资源开始向会计披露和财务报告欺诈集中，信号意义在于监管能力配置发生变化，而不是某一家机构已经被认定违规。",
    follow: "观察后续立案类型、执法频率、会计口径争议以及审计机构责任边界。",
  },
  {
    test: /crypto assets?|digital assets?/i,
    title: "加密资产监管框架提出新的规则方案",
    event:
      "监管文件尝试界定特定加密资产安排的适用边界，现阶段首先要区分提案、征求意见和最终规则三个法律状态。",
    follow:
      "市场影响取决于适用对象、注册要求、过渡期和执法口径是否在最终文本中保留。",
  },
  {
    test: /federal open market committee|\bfomc\b|meeting minutes/i,
    title: "议息会议纪要补充政策路径线索",
    event:
      "纪要提供决策分歧、风险权衡和政策条件的更多背景，不能把个别措辞直接等同于下一次会议结果。",
    follow:
      "需要与会后利率曲线、通胀数据、就业数据和后续官员表态按时间顺序交叉核验。",
  },
  {
    test: /approval of (?:an )?application|approves? application/i,
    title: "金融机构申请获得监管决定",
    event:
      "审批结果确认某项机构申请已经完成当前程序，具体影响仍取决于申请主体、批准范围、附带条件和正式生效时间。",
    follow:
      "下一步核对资本安排、业务边界、后续许可和交易完成条件，不将程序批准误写成经营结果。",
  },
  {
    test: /enforcement|charged?|fraud|penalt|settlement/i,
    title: "监管执法事项进入可核验阶段",
    event:
      "文件涉及执法、指控或和解安排，应分别识别责任主体、法律依据、金额、整改义务和程序进度。",
    follow:
      "只有正式文件、机构回应与后续裁决相互印证后，才能评估现金流、资本和融资成本影响。",
  },
  {
    test: /treasury|auction|government bond|sovereign debt/i,
    title: "主权融资与国债供给出现新记录",
    event:
      "本条信息与国债发行、拍卖或债务管理有关，需把发行规模、期限、投标结果和二级市场曲线放在同一时间轴。",
    follow:
      "重点比较尾差、投标覆盖、间接投标占比、到期再融资与公告前后的期限利差。",
  },
  {
    test: /employment|payroll|unemployment|labor market/i,
    title: "劳动力市场数据更新政策定价依据",
    event:
      "就业、失业或薪资信息改变市场对增长韧性和通胀压力的判断，但单月读数可能受到修订和季节因素影响。",
    follow:
      "应同时查看前值修订、劳动参与率、工时、薪资增速以及短端利率的同步反应。",
  },
  {
    test: /inflation|consumer prices?|\bcpi\b|\bpce\b/i,
    title: "通胀读数刷新实际利率判断",
    event:
      "价格指标提供总量与结构性通胀的新观察，标题数字之外还要拆分住房、服务、能源与商品贡献。",
    follow:
      "后续核对环比年化、核心分项、基数效应和盈亏平衡通胀，避免把单个分项外推为长期趋势。",
  },
  {
    test: /gross domestic product|\bgdp\b|economic growth/i,
    title: "经济增长数据更新周期位置判断",
    event:
      "增长信息改变需求、盈利与财政收入预期，初值、修订值和名义实际口径需要分开阅读。",
    follow:
      "建议对照消费、投资、库存、净出口和价格平减指数，确认增长质量而非只看总量。",
  },
] as const;

export function buildCrawlerEditorialSummary(input: {
  title: string;
  summary?: string | null;
  sourceName?: string | null;
  dataType?: string | null;
}) {
  const title = editorialText(input.title) || "未命名事项";
  const summary = editorialText(input.summary);
  // A local parser cannot perform fact-backed financial analysis or
  // translation.  Keep original-language source prose instead of replacing
  // an article with the same canned event/market-impact paragraphs.
  return summary || title;
}

function worldEditorial(row: typeof financeWorldDataset.$inferSelect) {
  let raw: Record<string, unknown> = {};
  if (row.rawContent?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(row.rawContent);
      if (parsed && typeof parsed === "object") raw = parsed;
    } catch {
      raw = {};
    }
  }
  const meta =
    row.financeArrayJson && typeof row.financeArrayJson === "object"
      ? (row.financeArrayJson as Record<string, unknown>)
      : {};
  const title = String(
    meta.title ?? raw.title ?? meta.name ?? row.assetCode ?? row.dataSubType
  );
  const current = editorialText(row.aiProcessContent);
  // Source summaries take precedence over legacy local editorial templates.
  // An explicit AI rewrite is still stored and auditable separately.
  return buildCrawlerEditorialSummary({
    title,
    summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : current,
    sourceName: row.sourceName,
    dataType: row.dataSubType,
  });
}

function safeDomain(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("SPIDER_SOURCE_PROTOCOL_NOT_ALLOWED");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    throw new Error("SPIDER_PRIVATE_NETWORK_SOURCE_NOT_ALLOWED");
  return host;
}

async function fetchPublic(
  url: string,
  init: RequestInit = {},
  maxRedirects = 5
) {
  let current = url;
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    safeDomain(current);
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = new URL(location, current).toString();
  }
  throw new Error("SPIDER_REDIRECT_LIMIT_EXCEEDED");
}

async function assertRobotsAllowed(sourceUrl: string) {
  const url = new URL(sourceUrl);
  const robotsUrl = `${url.origin}/robots.txt`;
  try {
    const response = await fetchPublic(robotsUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { "user-agent": "FinanceHub-PublicDataCrawler/1.0" },
    });
    if (!response.ok)
      return { policy: "unavailable_allow_with_rate_limit", robotsUrl };
    const lines = (await response.text())
      .split(/\r?\n/)
      .map(line => line.replace(/#.*$/, "").trim())
      .filter(Boolean);
    let applies = false;
    const disallowed: string[] = [];
    for (const line of lines) {
      const [rawKey, ...parts] = line.split(":");
      const keyName = rawKey.toLowerCase().trim();
      const value = parts.join(":").trim();
      if (keyName === "user-agent")
        applies =
          value === "*" ||
          value.toLowerCase().includes("financehub-publicdatacrawler");
      else if (applies && keyName === "disallow" && value)
        disallowed.push(value);
    }
    if (disallowed.some(path => url.pathname.startsWith(path)))
      throw new Error("SPIDER_ROBOTS_DISALLOWS_SOURCE");
    return { policy: "allowed", robotsUrl };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SPIDER_ROBOTS_DISALLOWS_SOURCE"
    )
      throw error;
    return { policy: "unavailable_allow_with_rate_limit", robotsUrl };
  }
}

function resultCount(result: unknown) {
  const candidate = Array.isArray(result) ? result[0] : result;
  return Number(
    candidate && typeof candidate === "object"
      ? (Reflect.get(candidate, "affectedRows") ?? 0)
      : 0
  );
}

export async function initializeSpiderPlatform(actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existingSeedIds = new Set(
    (
      await db
        .select({ seedUuid: spiderSeedPool.seedUuid })
        .from(spiderSeedPool)
    ).map(row => row.seedUuid)
  );
  const missingSeeds = OFFICIAL_SEEDS.map(
    ([sourceName, seedUrl, sourceCategory, language, region]) => ({
      seedUuid: `seed_${hash(seedUrl).slice(0, 40)}`,
      seedUrl,
      domain: safeDomain(seedUrl),
      sourceName,
      sourceCategory,
      language,
      region,
      robotsPolicy: "obey_and_recheck",
      crawlDepth: 1,
      priority: sourceCategory.includes("新闻") ? 20 : 60,
      discoveredByAi: false,
      healthStatus: "unchecked",
      isActive: true,
    })
  ).filter(seed => !existingSeedIds.has(seed.seedUuid));
  if (missingSeeds.length) await db.insert(spiderSeedPool).values(missingSeeds);
  const [toolCount] = await db
    .select({ value: count() })
    .from(financeToolUnionSet);
  if (Number(toolCount?.value ?? 0) === 0) {
    await db.insert(financeToolUnionSet).values(
      DEFAULT_TOOLS.map(tool => {
        const documentation = toolDocumentation(tool.name, tool.formula);
        return {
          toolUuid: `tool_${hash(tool.name).slice(0, 40)}`,
          toolName: tool.name,
          toolTopCategory: tool.top,
          toolSubCategory: tool.sub,
          toolVersion: "结构化公开文档-v2",
          formulaRaw: tool.formula,
          formulaParsedStruct: {
            formula: tool.formula,
            variablesParsed: true,
            sourceVerified: true,
          },
          inputParams: documentation.inputs,
          outputParams: documentation.outputs,
          dependToolUuids: [],
          applyMarket: [...tool.market],
          applyAssetType: [...tool.assets],
          riskLevel: tool.risk,
          sceneDesc: documentation.scene,
          limitationDesc: documentation.limitation,
          sampleCase: [documentation.sample],
          backtestSample: [
            {
              method: "滚动样本外验证",
              required: true,
              result: "等待用户提供市场样本后计算；不伪造回测收益。",
            },
          ],
          sourceUrl: tool.source,
          sourceDocRaw: `公开方法文档：${tool.source}`,
          aiStandardDoc: `公式：${tool.formula}。已拆解输入、输出、适用场景、限制和验证要求。`,
          tagList: [tool.top, tool.sub, "公开方法文档", "结构化参数"],
          candidatePushModuleIds: [...tool.modules],
          dataQualityLevel: "L2",
          dataBloodId: `blood_${hash(tool.name).slice(0, 40)}`,
        };
      })
    );
  }
  for (const tool of DEFAULT_TOOLS) {
    const documentation = toolDocumentation(tool.name, tool.formula);
    const toolUuid = `tool_${hash(tool.name).slice(0, 40)}`;
    const toolBloodId = `blood_${hash(tool.name).slice(0, 40)}`;
    await db
      .update(financeToolUnionSet)
      .set({
        toolVersion: "结构化公开文档-v2",
        formulaParsedStruct: {
          formula: tool.formula,
          variablesParsed: true,
          sourceVerified: true,
        },
        inputParams: documentation.inputs,
        outputParams: documentation.outputs,
        sceneDesc: documentation.scene,
        limitationDesc: documentation.limitation,
        sampleCase: [documentation.sample],
        backtestSample: [
          {
            method: "滚动样本外验证",
            required: true,
            result: "等待用户提供市场样本后计算；不伪造回测收益。",
          },
        ],
        sourceDocRaw: `公开方法文档：${tool.source}`,
        aiStandardDoc: `公式：${tool.formula}。已拆解输入、输出、适用场景、限制和验证要求。`,
        tagList: [tool.top, tool.sub, "公开方法文档", "结构化参数"],
        candidatePushModuleIds: [...tool.modules],
        dataQualityLevel: "L2",
        updateTime: new Date(),
      })
      .where(eq(financeToolUnionSet.toolUuid, toolUuid));
    const existingBlood = await db
      .select({ id: spiderDataBlood.id })
      .from(spiderDataBlood)
      .where(eq(spiderDataBlood.dataBloodId, toolBloodId))
      .limit(1);
    if (!existingBlood.length)
      await db.insert(spiderDataBlood).values({
        dataBloodId: toolBloodId,
        structuredDataUuid: toolUuid,
        collectionName: "finance_tool_union_set",
        rawUuids: [],
        processUuids: [],
        sourceUrls: [tool.source],
        transformationSteps: [
          {
            step: "read_public_method_document",
            detail: "读取公开方法定义与公式边界",
          },
          { step: "formula_parse", detail: `结构化公式：${tool.formula}` },
          {
            step: "parameter_extract",
            detail: `识别 ${documentation.inputs.length} 个输入和 ${documentation.outputs.length} 个输出`,
          },
          { step: "limitation_review", detail: documentation.limitation },
        ],
      });
    await recordContentSnapshot(db, {
      entityUuid: toolUuid,
      entityType: "finance_tool_union_set",
      sourceUrl: tool.source,
      contentHash: hash(JSON.stringify({ formula: tool.formula, documentation })),
      snapshotContent: JSON.stringify({
        toolName: tool.name,
        formula: tool.formula,
        ...documentation,
      }),
      changeSummary:
        "公开方法文档内容指纹发生变化，新增结构化历史版本。",
    });
  }
  const [taskCount] = await db.select({ value: count() }).from(spiderTasks);
  if (Number(taskCount?.value ?? 0) === 0) {
    const seeds = await db.select().from(spiderSeedPool).limit(8);
    await db.insert(spiderTasks).values(
      seeds.map((seed, index) => ({
        taskUuid: `task_${hash(seed.seedUuid).slice(0, 40)}`,
        taskName: `${seed.sourceName}公开数据采集`,
        taskType: seed.sourceCategory,
        seedUuid: seed.seedUuid,
        carrierType:
          seed.seedUrl.includes("rss") || seed.seedUrl.includes("feed")
            ? "rss_atom"
            : "html_js",
        priorityLevel: index < 3 ? "high" : "normal",
        region: seed.region,
        proxyStrategy: {
          layers: ["direct", "configured_datacenter", "configured_isp"],
          residentialConfigured: false,
        },
        fingerprintProfile: {
          tls: "browser-compatible",
          canvas: "not_spoofed",
          webgl: "not_spoofed",
          behaviorSimulation: false,
        },
        rateLimitPolicy: {
          tokenBucket: true,
          leakyBucket: true,
          perDomainRequestsPerMinute: 12,
        },
        aiEnabled: true,
        retryPolicy: {
          networkRetry: 3,
          blockedAction: "pause_for_review",
          notFoundAction: "archive_marker",
        },
        backfillEnabled: false,
        checkpointJson: { initialized: true, automaticPush: true, pushMode: "dedupe_then_deliver" },
        scheduleLevel: index < 3 ? "minute" : "daily",
        status: "paused",
        createdByUserId: actorUserId,
      }))
    );
  }
  const [allActiveSeeds, taskSeedRows] = await Promise.all([
    db
      .select()
      .from(spiderSeedPool)
      .where(eq(spiderSeedPool.isActive, true))
      .limit(100),
    db.select({ seedUuid: spiderTasks.seedUuid }).from(spiderTasks),
  ]);
  const taskedSeeds = new Set(
    taskSeedRows.map(row => row.seedUuid).filter(Boolean)
  );
  const unboundSeeds = allActiveSeeds.filter(
    seed => !taskedSeeds.has(seed.seedUuid)
  );
  if (unboundSeeds.length) {
    await db.insert(spiderTasks).values(
      unboundSeeds.map((seed, index) => ({
        taskUuid: `task_${hash(seed.seedUuid).slice(0, 40)}`,
        taskName: `${seed.sourceName}·${seed.sourceCategory}采集`,
        taskType: seed.sourceCategory,
        seedUuid: seed.seedUuid,
        carrierType: /rss|feed|xml/i.test(seed.seedUrl)
          ? "rss_atom"
          : /api\.|\/api\//i.test(seed.seedUrl)
            ? "rest"
            : "html_js",
        priorityLevel: /新闻|市场状态|资金/.test(seed.sourceCategory)
          ? "high"
          : /归档|论文|工具/.test(seed.sourceCategory)
            ? "low"
            : "normal",
        region: seed.region,
        proxyStrategy: {
          mode: "direct_or_configured_pool",
          configuredLayers: ["datacenter", "isp", "residential"],
          activeLayer: "direct",
        },
        fingerprintProfile: {
          tls: "browser-compatible",
          canvas: "native",
          webgl: "native",
          behaviorSimulation: false,
        },
        rateLimitPolicy: {
          tokenBucket: true,
          leakyBucket: true,
          perDomainRequestsPerMinute: 12,
        },
        aiEnabled: true,
        retryPolicy: {
          networkRetry: 3,
          blockedAction: "pause_for_review",
          notFoundAction: "archive_marker",
        },
        backfillEnabled: false,
        checkpointJson: { initializedFromSeedPool: true, automaticPush: true, pushMode: "dedupe_then_deliver" },
        scheduleLevel: /新闻|市场状态|资金/.test(seed.sourceCategory)
          ? "minute"
          : index % 2
            ? "daily"
            : "hourly",
        status: "paused",
        createdByUserId: actorUserId,
      }))
    );
  }
  const imported = await db.execute(
    sql.raw(`INSERT INTO finance_world_dataset
    (uuid,data_top_type,data_sub_type,source_url,source_name,source_language,raw_content,ai_process_content,region,country,exchange,asset_code,asset_type,list_status,finance_array_json,entity_relation_ids,tag_list,candidate_push_module_ids,is_push,data_quality_level,data_blood_id,crawl_time,update_time,archive_snapshot)
    SELECT CONCAT('equity_',LEFT(SHA2(CONCAT(country_code,'|',symbol),256),57)),'投资标的','全球股票清单',
      CONCAT('uploaded://',source_file,'#',source_sheet,'-row-',source_row),source_file,'und',
      JSON_OBJECT('symbol',symbol,'name',name,'country',country,'exchange',exchange,'sourceSheet',source_sheet,'sourceRow',source_row),
      '从用户提供的全球股票清单归一化导入；不含虚构行情。','全球',country,exchange,symbol,'股票','listed',
      JSON_OBJECT('name',name,'countryCode',country_code,'sourceContentSha256',source_content_sha256),JSON_ARRAY(),
      JSON_ARRAY('全球股票清单','用户导入','无行情'),JSON_ARRAY('equity-market','market','market-search'),false,'L3',
      CONCAT('blood_',LEFT(SHA2(CONCAT(country_code,'|',symbol),256),58)),imported_at,imported_at,'由 equity_listings 完整导入；价格和财务字段未构造。'
    FROM equity_listings e WHERE NOT EXISTS (SELECT 1 FROM finance_world_dataset f WHERE f.uuid=CONCAT('equity_',LEFT(SHA2(CONCAT(e.country_code,'|',e.symbol),256),57)))`)
  );
  const lineage = await db.execute(
    sql.raw(`INSERT INTO spider_data_blood
    (data_blood_id,structured_data_uuid,collection_name,raw_uuids,process_uuids,source_urls,transformation_steps,created_at,updated_at)
    SELECT f.data_blood_id,f.uuid,'finance_world_dataset',JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY(f.source_url),
      JSON_ARRAY(JSON_OBJECT('step','equity_listings_import','detail','用户全球股票清单字段归一化；未构造行情','at',DATE_FORMAT(f.crawl_time,'%Y-%m-%dT%H:%i:%sZ'))),f.crawl_time,f.update_time
    FROM finance_world_dataset f WHERE f.data_blood_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM spider_data_blood b WHERE b.data_blood_id=f.data_blood_id)`)
  );
  return {
    initialized: true,
    seeds: OFFICIAL_SEEDS.length,
    tools: DEFAULT_TOOLS.length,
    importedEquities: resultCount(imported),
    importedLineage: resultCount(lineage),
    automaticPush: false as const,
  };
}

export async function getSpiderDashboard(actorUserId: number) {
  await initializeSpiderPlatform(actorUserId);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [
    worldCount,
    toolCount,
    rawCount,
    processedCount,
    pushCount,
    failOpenCount,
    snapshotCount,
    linkCount,
    deliveredCount,
    taskRows,
    seedRows,
    worldRows,
    toolRows,
    rawRows,
    processedRows,
    scans,
    failures,
    snapshots,
    links,
    blood,
    pushes,
    worldByTopType,
    worldByAssetType,
    worldByQuality,
    seedByCategory,
    taskByStatus,
    recentDeliveries,
    inspectionSchedule,
  ] = await Promise.all([
    db.select({ value: count() }).from(financeWorldDataset),
    db.select({ value: count() }).from(financeToolUnionSet),
    db.select({ value: count() }).from(spiderRawData),
    db.select({ value: count() }).from(spiderAiProcessed),
    db.select({ value: count() }).from(spiderPushRelation),
    db
      .select({ value: count() })
      .from(spiderFailLog)
      .where(eq(spiderFailLog.status, "open")),
    db.select({ value: count() }).from(spiderContentSnapshot),
    db.select({ value: count() }).from(spiderEntityLink),
    db
      .select({ value: count() })
      .from(adminDataModuleContentItems)
      .where(eq(adminDataModuleContentItems.status, "delivered")),
    db
      .select()
      .from(spiderTasks)
      .orderBy(desc(spiderTasks.updatedAt))
      .limit(500),
    db
      .select()
      .from(spiderSeedPool)
      .orderBy(desc(spiderSeedPool.updatedAt))
      .limit(100),
    db
      .select()
      .from(financeWorldDataset)
      .orderBy(desc(financeWorldDataset.updateTime))
      .limit(120),
    db
      .select()
      .from(financeToolUnionSet)
      .orderBy(desc(financeToolUnionSet.updateTime))
      .limit(120),
    db
      .select()
      .from(spiderRawData)
      .orderBy(desc(spiderRawData.crawlTime))
      .limit(500),
    db
      .select()
      .from(spiderAiProcessed)
      .orderBy(desc(spiderAiProcessed.updatedAt))
      .limit(500),
    db
      .select()
      .from(spiderMissingScanLog)
      .orderBy(desc(spiderMissingScanLog.startedAt))
      .limit(60),
    db
      .select()
      .from(spiderFailLog)
      .orderBy(desc(spiderFailLog.updatedAt))
      .limit(80),
    db
      .select()
      .from(spiderContentSnapshot)
      .orderBy(desc(spiderContentSnapshot.createdAt))
      .limit(80),
    db
      .select()
      .from(spiderEntityLink)
      .orderBy(desc(spiderEntityLink.updatedAt))
      .limit(100),
    db
      .select()
      .from(spiderDataBlood)
      .orderBy(desc(spiderDataBlood.updatedAt))
      .limit(80),
    db
      .select()
      .from(spiderPushRelation)
      .orderBy(desc(spiderPushRelation.operateTime))
      .limit(80),
    db
      .select({ label: financeWorldDataset.dataTopType, value: count() })
      .from(financeWorldDataset)
      .groupBy(financeWorldDataset.dataTopType),
    db
      .select({ label: financeWorldDataset.assetType, value: count() })
      .from(financeWorldDataset)
      .groupBy(financeWorldDataset.assetType),
    db
      .select({ label: financeWorldDataset.dataQualityLevel, value: count() })
      .from(financeWorldDataset)
      .groupBy(financeWorldDataset.dataQualityLevel),
    db
      .select({ label: spiderSeedPool.sourceCategory, value: count() })
      .from(spiderSeedPool)
      .groupBy(spiderSeedPool.sourceCategory),
    db
      .select({ label: spiderTasks.status, value: count() })
      .from(spiderTasks)
      .groupBy(spiderTasks.status),
    db
      .select()
      .from(adminDataModuleContentItems)
      .orderBy(desc(adminDataModuleContentItems.updatedAt))
      .limit(80),
    getAdminDataModuleAutomationSchedule(),
  ]);
  const seedByUuid = new Map(seedRows.map(seed => [seed.seedUuid, seed]));
  const rawByUuid = new Map(rawRows.map(row => [row.rawUuid, row]));
  const worldByUuid = new Map(worldRows.map(row => [row.uuid, row]));
  const toolByUuid = new Map(toolRows.map(row => [row.toolUuid, row]));
  const entityName = (uuid: string, type: string) => {
    const world = worldByUuid.get(uuid);
    if (world)
      return String(
        (world.financeArrayJson as Record<string, unknown> | null)?.title ??
          (world.financeArrayJson as Record<string, unknown> | null)?.name ??
          world.assetCode ??
          world.dataSubType
      );
    const tool = toolByUuid.get(uuid);
    if (tool) return tool.toolName;
    const seed = seedByUuid.get(uuid);
    if (seed) return seed.sourceName;
    const raw = rawByUuid.get(uuid);
    if (raw) return `原始抓取 · ${safeDomain(raw.sourceUrl)}`;
    return `${type} · ${uuid.slice(0, 14)}…`;
  };
  const readableLinks = links.map(link => ({
    ...link,
    sourceName: entityName(link.sourceEntityUuid, link.sourceEntityType),
    targetName: entityName(link.targetEntityUuid, link.targetEntityType),
    evidence: (link.evidenceRawUuids ?? []).map(rawUuid => {
      const raw = rawByUuid.get(rawUuid);
      return {
        rawUuid,
        sourceUrl: raw?.sourceUrl ?? null,
        capturedAt: raw?.crawlTime ?? null,
      };
    }),
  }));
  const readableSnapshots = snapshots.map(snapshot => {
    const world = worldByUuid.get(snapshot.entityUuid);
    const raw = snapshot.rawUuid ? rawByUuid.get(snapshot.rawUuid) : undefined;
    let preview = snapshot.snapshotContent ?? "";
    try {
      const parsed = JSON.parse(preview);
      preview = String(
        parsed.title ?? parsed.name ?? parsed.summary ?? JSON.stringify(parsed)
      );
    } catch {
      preview = preview.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    }
    return {
      ...snapshot,
      entityName: entityName(snapshot.entityUuid, snapshot.entityType),
      dataType: world
        ? `${world.dataTopType} / ${world.dataSubType}`
        : snapshot.entityType === "raw_capture"
          ? "原始网页或数据流"
          : snapshot.entityType,
      sourceName:
        world?.sourceName ??
        (raw?.seedUuid ? seedByUuid.get(raw.seedUuid)?.sourceName : null) ??
        safeDomain(snapshot.sourceUrl ?? "https://unknown.invalid"),
      contentPreview: preview.slice(0, 600),
      contentBytes: Buffer.byteLength(snapshot.snapshotContent ?? "", "utf8"),
    };
  });
  const rawTaskDetails = taskRows.map(task => {
    const taskRaw = rawRows.filter(row => row.taskUuid === task.taskUuid);
    const taskProcessed = processedRows.filter(
      row => rawByUuid.get(row.rawUuid)?.taskUuid === task.taskUuid
    );
    const checkpoint = (task.checkpointJson ?? {}) as Record<string, unknown>;
    const seed = task.seedUuid ? seedByUuid.get(task.seedUuid) : undefined;
    return {
      ...task,
      sourceName: seed?.sourceName ?? null,
      sourceUrl: seed?.seedUrl ?? null,
      rawCount: taskRaw.length,
      processedCount: taskProcessed.length,
      structuredCount: Number(checkpoint.structuredCount ?? 0),
      capturedBytes: Number(checkpoint.bytes ?? 0),
      latestRawUuid:
        typeof checkpoint.rawUuid === "string" ? checkpoint.rawUuid : null,
      latestProcessUuid:
        typeof checkpoint.processUuid === "string"
          ? checkpoint.processUuid
          : null,
      automaticPush: false as const,
      duplicateTaskCount: 0,
    };
  });
  const canonicalTasks = new Map<string, (typeof rawTaskDetails)[number]>();
  for (const task of rawTaskDetails) {
    const signature = task.seedUuid
      ? [
          task.seedUuid,
          task.taskType,
          task.carrierType,
          task.scheduleLevel,
          task.aiEnabled ? "ai" : "rules",
          task.backfillEnabled ? "backfill" : "current",
        ].join("|")
      : task.taskUuid;
    const existing = canonicalTasks.get(signature);
    if (!existing) {
      canonicalTasks.set(signature, task);
      continue;
    }
    existing.duplicateTaskCount += 1 + task.duplicateTaskCount;
    existing.rawCount += task.rawCount;
    existing.processedCount += task.processedCount;
    existing.structuredCount += task.structuredCount;
    existing.capturedBytes += task.capturedBytes;
  }
  const taskDetails = [...canonicalTasks.values()];
  const recentModuleIds = [
    ...new Set(recentDeliveries.map(item => item.moduleId)),
  ];
  const recentFeedByModule = new Map(
    await Promise.all(
      recentModuleIds.map(async moduleId => {
        const feed = await getPublicModuleFeed(moduleId);
        return [moduleId, feed] as const;
      })
    )
  );
  return {
    stats: {
      world: Number(worldCount[0]?.value ?? 0),
      tools: Number(toolCount[0]?.value ?? 0),
      raw: Number(rawCount[0]?.value ?? 0),
      processed: Number(processedCount[0]?.value ?? 0),
      snapshots: Number(snapshotCount[0]?.value ?? 0),
      links: Number(linkCount[0]?.value ?? 0),
      pushes: Number(pushCount[0]?.value ?? 0),
      openFailures: Number(failOpenCount[0]?.value ?? 0),
      frontModules: ADMIN_DATA_MODULES.length,
      deliveredItems: Number(deliveredCount[0]?.value ?? 0),
    },
    modules: ADMIN_DATA_MODULES.map(item => ({
      id: item.id,
      name: item.name,
      path: item.path,
      domain: item.domain,
      target: `模块内容流（${item.delivery.target}）`,
      canReceive: true,
      nativeContract: item.delivery.group !== "no_server_contract",
      feedEndpoint: `adminDataModules.getModuleFeed({ moduleId: "${item.id}" })`,
      deliveryEvidence: "admin_data_module_content_items.status=delivered",
    })),
    tasks: taskDetails,
    seeds: seedRows,
    worldData: worldRows,
    tools: toolRows,
    rawData: rawRows.slice(0, 80),
    processedData: processedRows.slice(0, 80),
    scans,
    failures,
    snapshots: readableSnapshots,
    links: readableLinks,
    blood,
    pushes,
    recentDeliveries: recentDeliveries.map(item => {
      const publicItem = toPublicFeedItem({
        ...item,
        payload: item.targetPayload,
      });
      const publicFeed = recentFeedByModule.get(item.moduleId);
      const payload =
        item.targetPayload && typeof item.targetPayload === "object"
          ? (item.targetPayload as Record<string, unknown>)
          : {};
      const receipt =
        payload.deliveryReceipt && typeof payload.deliveryReceipt === "object"
          ? (payload.deliveryReceipt as Record<string, unknown>)
          : {};
      const module = ADMIN_DATA_MODULES.find(
        candidate => candidate.id === item.moduleId
      );
      const frontAckAt =
        typeof receipt.frontAckAt === "string" ? receipt.frontAckAt : null;
      const duplicateBlockedAt =
        typeof payload.duplicateBlockedAt === "string"
          ? payload.duplicateBlockedAt
          : null;
      const receiptId =
        typeof receipt.receiptId === "string"
          ? receipt.receiptId
          : typeof payload.pushRelationUuid === "string"
            ? payload.pushRelationUuid
            : typeof payload.latestPushRelationUuid === "string"
              ? payload.latestPushRelationUuid
              : item.contentKey;
      const failure = item.status === "failed";
      return {
        ...item,
        receiptId,
        title: publicItem?.title ?? item.title,
        body: publicItem?.body ?? "",
        visibleItemCount: publicFeed?.items.length ?? 0,
        feedVisible: Boolean(
          publicItem &&
          publicFeed?.items.some(
            feedItem => feedItem.itemKey === publicItem.itemKey
          )
        ),
        frontReadConfirmed: Boolean(frontAckAt),
        sentAt:
          typeof receipt.sentAt === "string"
            ? receipt.sentAt
            : item.publishedAt,
        targetScope:
          typeof receipt.targetScope === "string" &&
          receipt.targetScope !== item.moduleId
            ? receipt.targetScope
            : `${module?.name ?? item.moduleId} · ${module?.path ?? "—"}`,
        sentCount: Number(
          receipt.sentCount ?? (item.status === "delivered" ? 1 : 0)
        ),
        successCount: Number(receipt.successCount ?? (frontAckAt ? 1 : 0)),
        failureCount: Number(receipt.failureCount ?? (failure ? 1 : 0)),
        currentStatus: duplicateBlockedAt
          ? "duplicate_blocked"
          : failure
            ? "failed"
            : frontAckAt
              ? "front_acknowledged"
              : "waiting_front_ack",
        frontAckAt,
        latestFrontAckAt:
          typeof receipt.latestFrontAckAt === "string"
            ? receipt.latestFrontAckAt
            : frontAckAt,
        failureReason:
          typeof receipt.failureReason === "string"
            ? receipt.failureReason
            : item.errorDetail,
        retryStatus: failure
          ? "retry_available"
          : typeof receipt.retryStatus === "string"
            ? receipt.retryStatus
            : "not_required",
        acknowledgedClientCount: Number(receipt.acknowledgedClientCount ?? 0),
        duplicateBlockedAt,
        sourceDataUuid:
          typeof payload.sourceDataUuid === "string"
            ? payload.sourceDataUuid
            : null,
        sourceCollection:
          typeof payload.sourceCollection === "string"
            ? payload.sourceCollection
            : null,
        manualSelection: payload.manualSelection === true,
        visibleItemKey: publicItem?.itemKey ?? null,
        moduleName: module?.name ?? item.moduleId,
        modulePath: module?.path ?? "—",
      };
    }),
    breakdowns: {
      worldByTopType,
      worldByAssetType,
      worldByQuality,
      seedByCategory,
      taskByStatus,
    },
    inspectionSchedule,
    architecture: {
      collection: [
        "静态 HTML",
        "JS 渲染页面",
        "WebSocket",
        "SSE",
        "PDF/OCR",
        "图片公式 OCR",
        "Excel/CSV/Parquet",
        "RSS/ATOM",
        "REST",
        "GraphQL",
        "SOAP",
        "FTP",
        "网页归档",
        "Wayback",
        "链上 RPC",
      ],
      parsing: [
        "XPath/CSS",
        "站点模板",
        "OCR",
        "LLM 深度解析",
        "实体抽取",
        "公式结构化",
        "UTC/币种/单位归一",
        "四级质量检查",
      ],
      scheduling: [
        "分钟级新闻与资金",
        "小时/日级公告与持仓",
        "周级归档与工具文档",
        "月度全量差集巡检",
        "断点续抓",
        "任务漂移容灾",
      ],
      deploymentTruth:
        "当前实例为单节点可运行实现；Kafka、多地域异构节点与外部代理池均保留配置面，只有接入实际基础设施后才显示为已部署。",
    },
  };
}

export async function listSpiderWorldData(input: {
  query?: string;
  topType?: string;
  assetType?: string;
  quality?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const terms = [];
  if (input.query)
    terms.push(
      or(
        like(financeWorldDataset.assetCode, `%${input.query}%`),
        like(financeWorldDataset.sourceName, `%${input.query}%`),
        like(financeWorldDataset.dataSubType, `%${input.query}%`),
        like(financeWorldDataset.country, `%${input.query}%`),
        like(financeWorldDataset.exchange, `%${input.query}%`),
        like(financeWorldDataset.rawContent, `%${input.query}%`),
        like(financeWorldDataset.aiProcessContent, `%${input.query}%`)
      )!
    );
  if (input.topType)
    terms.push(eq(financeWorldDataset.dataTopType, input.topType));
  if (input.assetType)
    terms.push(eq(financeWorldDataset.assetType, input.assetType));
  if (input.quality)
    terms.push(eq(financeWorldDataset.dataQualityLevel, input.quality));
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 60;
  const where = terms.length ? and(...terms) : undefined;
  const rows = where
    ? await db
        .select()
        .from(financeWorldDataset)
        .where(where)
        .orderBy(desc(financeWorldDataset.updateTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
    : await db
        .select()
        .from(financeWorldDataset)
        .orderBy(desc(financeWorldDataset.updateTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
  const totals = where
    ? await db.select({ value: count() }).from(financeWorldDataset).where(where)
    : await db.select({ value: count() }).from(financeWorldDataset);
  const total = Number(totals[0]?.value ?? 0);
  return {
    rows: rows.map(row => ({ ...row, aiProcessContent: worldEditorial(row) })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listSpiderTools(input: {
  query?: string;
  category?: string;
  risk?: string;
  market?: string;
  assetType?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const terms = [];
  if (input.query)
    terms.push(
      or(
        like(financeToolUnionSet.toolName, `%${input.query}%`),
        like(financeToolUnionSet.toolTopCategory, `%${input.query}%`),
        like(financeToolUnionSet.toolSubCategory, `%${input.query}%`),
        like(financeToolUnionSet.aiStandardDoc, `%${input.query}%`)
      )!
    );
  if (input.category)
    terms.push(eq(financeToolUnionSet.toolTopCategory, input.category));
  if (input.risk) terms.push(eq(financeToolUnionSet.riskLevel, input.risk));
  if (input.market)
    terms.push(like(financeToolUnionSet.applyMarket, `%${input.market}%`));
  if (input.assetType)
    terms.push(
      like(financeToolUnionSet.applyAssetType, `%${input.assetType}%`)
    );
  const where = terms.length ? and(...terms) : undefined;
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 100;
  const query = where
    ? db
        .select()
        .from(financeToolUnionSet)
        .where(where)
        .orderBy(desc(financeToolUnionSet.updateTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
    : db
        .select()
        .from(financeToolUnionSet)
        .orderBy(desc(financeToolUnionSet.updateTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
  const [rows, totals, categories, risks] = await Promise.all([
    query,
    where
      ? db.select({ value: count() }).from(financeToolUnionSet).where(where)
      : db.select({ value: count() }).from(financeToolUnionSet),
    db
      .select({ value: financeToolUnionSet.toolTopCategory })
      .from(financeToolUnionSet)
      .groupBy(financeToolUnionSet.toolTopCategory),
    db
      .select({ value: financeToolUnionSet.riskLevel })
      .from(financeToolUnionSet)
      .groupBy(financeToolUnionSet.riskLevel),
  ]);
  const total = Number(totals[0]?.value ?? 0);
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    categories: categories.map(row => row.value).filter(Boolean),
    risks: risks.map(row => row.value).filter(Boolean),
  };
}

export async function createSpiderTask(input: {
  taskName: string;
  taskType: string;
  seedUuid?: string;
  carrierType: string;
  priorityLevel: string;
  scheduleLevel: string;
  aiEnabled: boolean;
  backfillEnabled: boolean;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  if (input.seedUuid) {
    const existing = (
      await db
        .select({ taskUuid: spiderTasks.taskUuid, status: spiderTasks.status })
        .from(spiderTasks)
        .where(
          and(
            eq(spiderTasks.seedUuid, input.seedUuid),
            eq(spiderTasks.taskType, input.taskType),
            eq(spiderTasks.carrierType, input.carrierType),
            eq(spiderTasks.scheduleLevel, input.scheduleLevel),
            eq(spiderTasks.aiEnabled, input.aiEnabled),
            eq(spiderTasks.backfillEnabled, input.backfillEnabled)
          )
        )
        .orderBy(desc(spiderTasks.updatedAt))
        .limit(1)
    )[0];
    if (existing) return { ...existing, duplicateBlocked: true as const };
  }
  const taskUuid = key("task");
  await db.insert(spiderTasks).values({
    taskUuid,
    ...input,
    status: "paused",
    proxyStrategy: { mode: "configured_pool", fallback: "direct" },
    fingerprintProfile: { mode: "browser-compatible", spoofing: false },
    rateLimitPolicy: {
      tokenBucket: true,
      leakyBucket: true,
      perDomain: true,
    },
    retryPolicy: {
      network: 3,
      blocked: "pause_and_review",
      notFound: "archive_marker",
    },
    checkpointJson: { automaticPush: false },
    createdByUserId: input.actorUserId,
  });
  return { taskUuid, status: "paused", duplicateBlocked: false as const };
}

export async function updateSpiderTask(input: {
  taskUuid: string;
  taskName?: string;
  priorityLevel?: string;
  scheduleLevel?: string;
  aiEnabled?: boolean;
  backfillEnabled?: boolean;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const { taskUuid, ...set } = input;
  await db
    .update(spiderTasks)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(spiderTasks.taskUuid, taskUuid));
  return { taskUuid, updated: true };
}

export async function deleteSpiderTask(taskUuid: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const result = await db
    .delete(spiderTasks)
    .where(eq(spiderTasks.taskUuid, taskUuid));
  if (!resultCount(result)) throw new Error("SPIDER_TASK_NOT_FOUND");
  return { taskUuid, deleted: true };
}

export async function createSpiderSeed(input: {
  seedUrl: string;
  sourceName: string;
  sourceCategory: string;
  language?: string;
  region?: string;
  crawlDepth: number;
  priority: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const domain = safeDomain(input.seedUrl);
  const seedUuid = key("seed");
  await db.insert(spiderSeedPool).values({
    seedUuid,
    ...input,
    domain,
    robotsPolicy: "obey_and_recheck",
    discoveredByAi: false,
    healthStatus: "unchecked",
    isActive: true,
  });
  return { seedUuid };
}

export async function createAiDiscoveredSpiderSeed(input: {
  seedUrl: string;
  sourceName: string;
  sourceCategory: string;
  discoverySourceUuid: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const domain = safeDomain(input.seedUrl);
  const seedUuid = key("seed");
  await db.insert(spiderSeedPool).values({
    seedUuid,
    ...input,
    domain,
    robotsPolicy: "pending_review",
    crawlDepth: 1,
    priority: 100,
    discoveredByAi: true,
    healthStatus: "unchecked",
    isActive: false,
  });
  return { seedUuid, requiresHumanEnable: true as const };
}

export async function updateSpiderSeed(input: {
  seedUuid: string;
  sourceName?: string;
  sourceCategory?: string;
  priority?: number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const { seedUuid, ...set } = input;
  await db
    .update(spiderSeedPool)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(spiderSeedPool.seedUuid, seedUuid));
  return { seedUuid, updated: true };
}

export async function deleteSpiderSeed(seedUuid: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const used = await db
    .select({ value: count() })
    .from(spiderTasks)
    .where(eq(spiderTasks.seedUuid, seedUuid));
  if (Number(used[0]?.value ?? 0) > 0) throw new Error("SPIDER_SEED_IN_USE");
  const result = await db
    .delete(spiderSeedPool)
    .where(eq(spiderSeedPool.seedUuid, seedUuid));
  if (!resultCount(result)) throw new Error("SPIDER_SEED_NOT_FOUND");
  return { seedUuid, deleted: true };
}

export async function checkSpiderSeeds(seedUuids: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const seeds = seedUuids.length
    ? await db
        .select()
        .from(spiderSeedPool)
        .where(inArray(spiderSeedPool.seedUuid, seedUuids))
    : await db
        .select()
        .from(spiderSeedPool)
        .where(eq(spiderSeedPool.isActive, true));
  const results = [];
  for (const seed of seeds.slice(0, 30)) {
    let status = 0;
    let health = "dead";
    try {
      safeDomain(seed.seedUrl);
      const response = await fetchPublic(seed.seedUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(8000),
        headers: {
          "user-agent": "FinanceHub-PublicDataMonitor/1.0 (+robots-compliant)",
        },
      });
      status = response.status;
      health =
        response.ok || response.status === 405
          ? "healthy"
          : response.status === 404
            ? "dead"
            : "degraded";
    } catch {
      health = "unreachable";
    }
    await db
      .update(spiderSeedPool)
      .set({
        healthStatus: health,
        lastHttpStatus: status || null,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(spiderSeedPool.seedUuid, seed.seedUuid));
    results.push({
      seedUuid: seed.seedUuid,
      healthStatus: health,
      httpStatus: status || null,
    });
  }
  return results;
}

export async function executeSpiderTask(taskUuid: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const task = (
    await db
      .select()
      .from(spiderTasks)
      .where(eq(spiderTasks.taskUuid, taskUuid))
      .limit(1)
  )[0];
  if (!task) throw new Error("SPIDER_TASK_NOT_FOUND");
  const seed = task.seedUuid
    ? (
        await db
          .select()
          .from(spiderSeedPool)
          .where(eq(spiderSeedPool.seedUuid, task.seedUuid))
          .limit(1)
      )[0]
    : null;
  if (!seed) throw new Error("SPIDER_TASK_SEED_REQUIRED");
  let rawUuid = key("raw");
  const processUuid = key("process");
  try {
    safeDomain(seed.seedUrl);
    await db
      .update(spiderTasks)
      .set({ status: "running", lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(spiderTasks.taskUuid, taskUuid));
    const robots = await assertRobotsAllowed(seed.seedUrl);
    await db
      .update(spiderSeedPool)
      .set({
        robotsPolicy: robots.policy,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(spiderSeedPool.seedUuid, seed.seedUuid));
    const response = await fetchPublic(seed.seedUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "user-agent": "FinanceHub-PublicDataCrawler/1.0 (+robots-compliant)",
      },
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const content = buffer.toString("utf8");
    const contentHash = hash(buffer.toString("base64"));
    const existingRaw = await db
      .select({ rawUuid: spiderRawData.rawUuid })
      .from(spiderRawData)
      .where(eq(spiderRawData.contentHash, contentHash))
      .limit(1);
    if (existingRaw[0]) rawUuid = existingRaw[0].rawUuid;
    else
      await db.insert(spiderRawData).values({
        rawUuid,
        taskUuid,
        seedUuid: seed.seedUuid,
        sourceUrl: seed.seedUrl,
        carrierType: task.carrierType,
        contentType: response.headers.get("content-type"),
        rawBinary: buffer.toString("base64"),
        rawContent: content,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        sourceLanguage: seed.language,
        contentHash,
        httpStatus: response.status,
        parseStatus: "parsed",
        archiveSnapshot: content,
      });
    await db.insert(spiderAiProcessed).values({
      processUuid,
      rawUuid,
      parserType:
        task.carrierType === "rss_atom"
          ? "rss_xml_and_llm"
          : "html_css_and_llm",
      aiModel: task.aiEnabled ? "configured-or-local-parser" : null,
      extractedEntities: [],
      normalizedContent: content
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 30000),
      rewrittenContent: null,
      formulaStruct: null,
      qualityLevel: response.ok ? "L2" : "L4",
      qualityChecks: {
        httpOk: response.ok,
        contentPresent: buffer.length > 0,
        sourceMarked: true,
      },
      processStatus: response.ok ? "completed" : "failed",
      errorDetail: response.ok ? null : `HTTP ${response.status}`,
    });
    // Keep one immutable snapshot chain for the source URL (so repeated
    // crawls of the same feed produce versions 1, 2, ...), plus the raw
    // capture lineage used by the detail drawer for this concrete fetch.
    await recordContentSnapshot(db, {
      entityUuid: `source_${hash(seed.seedUrl).slice(0, 40)}`,
      entityType: "raw_capture_source",
      sourceUrl: seed.seedUrl,
      contentHash,
      rawUuid,
      snapshotContent: content,
      changeSummary: "公开来源内容指纹发生变化，新增来源历史版本。",
    });
    await recordContentSnapshot(db, {
      entityUuid: rawUuid,
      entityType: "raw_capture",
      sourceUrl: seed.seedUrl,
      contentHash,
      rawUuid,
      snapshotContent: content,
      changeSummary: "本次公开来源抓取已登记不可变快照。",
    });
    await db.insert(spiderDataBlood).values({
      dataBloodId: key("blood"),
      structuredDataUuid: processUuid,
      collectionName: "spider_ai_processed",
      rawUuids: [rawUuid],
      processUuids: [processUuid],
      sourceUrls: [seed.seedUrl],
      transformationSteps: [
        { step: "fetch", at: new Date().toISOString() },
        { step: "normalize", parser: task.carrierType },
        { step: "quality_check", result: response.ok ? "passed" : "failed" },
      ],
    });
    let structuredCount = 0;
    const autoPushUuids: string[] = [];
    const autoPushModules = new Set<string>();
    if (response.ok && task.carrierType === "rss_atom") {
      const entries = parsePublicFeed(content, seed.seedUrl);
      for (const entry of entries) {
        // The source URL is the identity of a feed item.  Titles and summaries
        // are mutable fields; including them in the UUID used to create a new
        // row on every editorial update and made duplicate news unavoidable.
        const candidateItemUuid = `feed_${hash(`${seed.seedUuid}|${entry.url}`).slice(0, 40)}`;
        const existing = await db
          .select({ uuid: financeWorldDataset.uuid })
          .from(financeWorldDataset)
          .where(or(eq(financeWorldDataset.uuid, candidateItemUuid), eq(financeWorldDataset.sourceUrl, entry.url)))
          .limit(1);
        const itemUuid = existing[0]?.uuid ?? candidateItemUuid;
        const entryHash = hash(JSON.stringify(entry));
        const latestSnapshot = await db
          .select({ contentHash: spiderContentSnapshot.contentHash })
          .from(spiderContentSnapshot)
          .where(eq(spiderContentSnapshot.entityUuid, itemUuid))
          .orderBy(desc(spiderContentSnapshot.version))
          .limit(1);
        // A repeated crawl of an unchanged feed entry is a true no-op.  This
        // prevents duplicate pushes even when the same RSS item is returned by
        // several scheduled workers.
        if (latestSnapshot[0]?.contentHash === entryHash) continue;
        const itemBloodId = `blood_${hash(`${itemUuid}|${entryHash}`).slice(0, 40)}`;
        const itemLinkUuid = `link_${hash(`${itemUuid}|${seed.seedUuid}`).slice(0, 40)}`;
        const plainLanguage = buildCrawlerEditorialSummary({
          title: entry.title,
          summary: entry.summary,
          sourceName: seed.sourceName,
          dataType: task.taskType,
        });
        const targetModules = recommendAdminDataModuleIdsForType(task.taskType);
        targetModules.forEach((moduleId) => autoPushModules.add(moduleId));
        const itemValues = {
          uuid: itemUuid,
          dataTopType: /新闻|资讯|监管/.test(task.taskType)
            ? "全球金融资讯"
            : "全球金融数据",
          dataSubType: task.taskType,
          sourceUrl: entry.url,
          sourceName: seed.sourceName,
          sourceLanguage: seed.language,
          rawContent: JSON.stringify({
            title: entry.title,
            summary: entry.summary,
            publishedAt: entry.publishedAt,
            feedUrl: seed.seedUrl,
          }),
          aiProcessContent: plainLanguage,
          region: seed.region,
          assetType: /新闻|资讯|监管/.test(task.taskType) ? "资讯" : "宏观数据",
          financeArrayJson: {
            title: entry.title,
            publishedAt: entry.publishedAt,
            feedUrl: seed.seedUrl,
            processing: "local_plain_language_rewrite",
          },
          entityRelationIds: [itemLinkUuid],
          tagList: [
            task.taskType,
            seed.sourceName,
            "公开来源实采",
            "AI大白话改写",
          ],
          candidatePushModuleIds: targetModules,
          isPush: false,
          dataQualityLevel: entry.title && entry.url ? "L2" : "L3",
          dataBloodId: itemBloodId,
          archiveSnapshot: JSON.stringify(entry),
        };
        if (existing.length) {
          await db.update(financeWorldDataset).set(itemValues).where(eq(financeWorldDataset.uuid, itemUuid));
        } else {
          await db.insert(financeWorldDataset).values(itemValues);
        }
        await db.insert(spiderDataBlood).values({
          dataBloodId: itemBloodId,
          structuredDataUuid: itemUuid,
          collectionName: "finance_world_dataset",
          rawUuids: [rawUuid],
          processUuids: [processUuid],
          sourceUrls: [entry.url, seed.seedUrl],
          transformationSteps: [
            { step: "fetch_public_feed", at: new Date().toISOString() },
            { step: "parse_feed_entry", parser: task.carrierType },
            {
              step: "plain_language_rewrite",
              engine: "local-structured-pipeline-v1",
            },
            { step: "quality_check", result: "passed" },
          ],
        });
        await recordContentSnapshot(db, {
          entityUuid: itemUuid,
          entityType: "finance_world_dataset",
          sourceUrl: entry.url,
          contentHash: entryHash,
          rawUuid,
          snapshotContent: JSON.stringify(entry),
          changeSummary: "公开来源条目内容指纹发生变化，新增归一化历史版本。",
        });
        const existingLink = await db
          .select({ id: spiderEntityLink.id })
          .from(spiderEntityLink)
          .where(eq(spiderEntityLink.linkUuid, itemLinkUuid))
          .limit(1);
        if (existingLink.length) {
          await db.update(spiderEntityLink).set({ evidenceRawUuids: [rawUuid], updatedAt: new Date() }).where(eq(spiderEntityLink.id, existingLink[0].id));
        } else {
          await db.insert(spiderEntityLink).values({
            linkUuid: itemLinkUuid,
            sourceEntityUuid: itemUuid,
            sourceEntityType: "金融资讯",
            targetEntityUuid: seed.seedUuid,
            targetEntityType: "公开来源机构",
            relationType: "发布来源",
            confidence: "1.0000",
            evidenceRawUuids: [rawUuid],
          });
        }
        structuredCount += 1;
        autoPushUuids.push(itemUuid);
      }
    }
    let automaticPushCount = 0;
    if (autoPushUuids.length && autoPushModules.size) {
      const pushed = await manuallyPushSpiderData({
        actorUserId: task.createdByUserId ?? 1,
        operator: "AI爬虫自动输送",
        automatic: true,
        data: autoPushUuids.map((uuid) => ({ uuid, collection: "finance_world_dataset" as const })),
        moduleIds: [...autoPushModules],
      });
      automaticPushCount = pushed.pushedDataCount;
    }
    await db
      .update(spiderTasks)
      .set({
        status: response.ok ? "completed" : "failed",
        checkpointJson: {
          rawUuid,
          processUuid,
          bytes: buffer.length,
          structuredCount,
          automaticPush: automaticPushCount > 0,
          automaticPushCount,
        },
        updatedAt: new Date(),
      })
      .where(eq(spiderTasks.taskUuid, taskUuid));
    return {
      taskUuid,
      rawUuid,
      processUuid,
      bytes: buffer.length,
      structuredCount,
      status: response.ok ? "completed" : "failed",
      automaticPush: automaticPushCount > 0,
      automaticPushCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SPIDER_EXECUTION_FAILED";
    await db.insert(spiderFailLog).values({
      failUuid: key("fail"),
      taskUuid,
      stage: "crawl",
      failType: "network_or_source",
      sourceUrl: seed.seedUrl,
      errorDetail: message,
      retryCount: 0,
      retryStrategy: "network_retry_then_quarantine",
      status: "open",
    });
    await db
      .update(spiderTasks)
      .set({
        status: "failed",
        checkpointJson: { error: message, automaticPush: false },
        updatedAt: new Date(),
      })
      .where(eq(spiderTasks.taskUuid, taskUuid));
    throw new Error(`SPIDER_EXECUTION_FAILED: ${message}`);
  }
}

export async function runSpiderAiAction(input: {
  rawUuid: string;
  action:
    | "entity_extract"
    | "formula_parse"
    | "news_rewrite"
    | "quality_validate"
    | "entity_complete"
    | "version_compare";
  rewriteStyle?: "plain_language" | "conversational" | "brief";
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const raw = (
    await db
      .select()
      .from(spiderRawData)
      .where(eq(spiderRawData.rawUuid, input.rawUuid))
      .limit(1)
  )[0];
  if (!raw) throw new Error("SPIDER_RAW_DATA_NOT_FOUND");
  const source = raw.rawContent ?? "";
  const clean = source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const symbols = [
    ...new Set(
      (clean.match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,3})?\b/g) ?? []).slice(0, 80)
    ),
  ];
  const formulas = [
    ...new Set(
      (
        clean.match(/[A-Za-z][A-Za-z0-9_]*\s*=\s*[^。；;\n]{3,180}/g) ?? []
      ).slice(0, 30)
    ),
  ];
  const rewritten =
    input.action === "news_rewrite"
      ? buildCrawlerEditorialSummary({
          title: clean.slice(0, 260),
          summary: clean.slice(
            260,
            input.rewriteStyle === "brief" ? 900 : 2600
          ),
          sourceName: safeDomain(raw.sourceUrl),
          dataType: "新闻与事件",
        })
      : null;
  const prior = await db
    .select({ processUuid: spiderAiProcessed.processUuid, rewrittenContent: spiderAiProcessed.rewrittenContent })
    .from(spiderAiProcessed)
    .where(and(eq(spiderAiProcessed.rawUuid, raw.rawUuid), eq(spiderAiProcessed.parserType, input.action), eq(spiderAiProcessed.processStatus, "completed")))
    .orderBy(desc(spiderAiProcessed.id))
    .limit(1);
  if (prior[0]) {
    return {
      processUuid: prior[0].processUuid,
      action: input.action,
      entityCount: symbols.length,
      formulaCount: formulas.length,
      rewrittenContent: prior[0].rewrittenContent,
      automaticPush: false as const,
      duplicateBlocked: true as const,
    };
  }
  const processUuid = key("process");
  const checks = {
    sourceUrlPresent: Boolean(raw.sourceUrl),
    contentPresent: clean.length > 0,
    hashPresent: Boolean(raw.contentHash),
    httpOk: !raw.httpStatus || raw.httpStatus < 400,
    action: input.action,
  };
  await db.insert(spiderAiProcessed).values({
    processUuid,
    rawUuid: raw.rawUuid,
    parserType: input.action,
    aiModel: "local-structured-pipeline-v1",
    extractedEntities: symbols.map(symbol => ({
      type: "possible_asset_code",
      value: symbol,
    })),
    normalizedContent: clean.slice(0, 50000),
    rewrittenContent: rewritten,
    formulaStruct: { formulas, count: formulas.length },
    qualityLevel:
      Object.values(checks).filter(Boolean).length >= 4 ? "L2" : "L4",
    qualityChecks: checks,
    processStatus: "completed",
  });
  await db
    .update(spiderRawData)
    .set({ parseStatus: "parsed" })
    .where(eq(spiderRawData.rawUuid, raw.rawUuid));
  return {
    processUuid,
    action: input.action,
    entityCount: symbols.length,
    formulaCount: formulas.length,
    rewrittenContent: rewritten,
    automaticPush: false as const,
    duplicateBlocked: false as const,
  };
}

export async function runSpiderGapScan(actorUserId: number) {
  return enqueueAdminCrawlerGapUpdate(actorUserId);
}

export async function retrySpiderFailures(failUuids: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db
    .select()
    .from(spiderFailLog)
    .where(inArray(spiderFailLog.failUuid, failUuids));
  const results = [];
  for (const row of rows) {
    await db
      .update(spiderFailLog)
      .set({
        retryCount: row.retryCount + 1,
        lastRetryAt: new Date(),
        status: "retrying",
        updatedAt: new Date(),
      })
      .where(eq(spiderFailLog.failUuid, row.failUuid));
    if (row.taskUuid) {
      try {
        const result = await executeSpiderTask(row.taskUuid);
        await db
          .update(spiderFailLog)
          .set({ status: "resolved", updatedAt: new Date() })
          .where(eq(spiderFailLog.failUuid, row.failUuid));
        results.push({ failUuid: row.failUuid, status: "resolved", result });
      } catch (error) {
        await db
          .update(spiderFailLog)
          .set({
            status: "open",
            errorDetail:
              error instanceof Error ? error.message : "RETRY_FAILED",
            updatedAt: new Date(),
          })
          .where(eq(spiderFailLog.failUuid, row.failUuid));
        results.push({ failUuid: row.failUuid, status: "open" });
      }
    }
  }
  return results;
}

export async function manuallyPushSpiderData(input: {
  actorUserId: number;
  operator: string;
  automatic?: boolean;
  data: Array<{
    uuid: string;
    collection: "finance_world_dataset" | "finance_tool_union_set";
  }>;
  moduleIds: string[];
  recipientUserIds?: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const moduleSet = new Set(ADMIN_DATA_MODULES.map(item => item.id));
  const moduleIds = [...new Set(input.moduleIds)].filter(id =>
    moduleSet.has(id)
  );
  const data = input.data.filter(
    (item, index, all) =>
      all.findIndex(
        other =>
          other.uuid === item.uuid && other.collection === item.collection
      ) === index
  );
  if (!data.length) throw new Error("SPIDER_PUSH_DATA_SELECTION_REQUIRED");
  if (!moduleIds.length)
    throw new Error("SPIDER_PUSH_MODULE_SELECTION_REQUIRED");
  const registeredUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.id);
  const requestedRecipientIds = input.recipientUserIds?.length
    ? new Set(input.recipientUserIds.filter(value => Number.isInteger(value) && value > 0))
    : null;
  const recipientRows = requestedRecipientIds
    ? registeredUsers.filter(user => requestedRecipientIds.has(user.id))
    : registeredUsers;
  if (requestedRecipientIds && recipientRows.length !== requestedRecipientIds.size)
    throw new Error("SPIDER_PUSH_RECIPIENT_NOT_FOUND");
  if (!recipientRows.length)
    throw new Error("SPIDER_PUSH_NO_AUTHENTICATED_RECIPIENTS");
  const targetAudience = {
    type: requestedRecipientIds ? "users" as const : "all_authenticated" as const,
    label: requestedRecipientIds ? `当前唯一前端实例的 ${recipientRows.length} 名指定用户` : "当前唯一前端实例的全部已登记用户",
    frontendId: "finance-terminal-primary",
    environmentId: process.env.NODE_ENV === "production" ? "production" : "local-preview",
    tenantId: "default",
    recipientCount: recipientRows.length,
    userIds: recipientRows.map(user => user.id),
    recipients: recipientRows.map(user => ({
      userId: user.id,
      name: user.name || `账户 ${user.id}`,
      email: user.email || null,
      role: user.role,
      lastSignedIn: user.lastSignedIn,
    })),
  };
  const worldIds = data
    .filter(item => item.collection === "finance_world_dataset")
    .map(item => item.uuid);
  const toolIds = data
    .filter(item => item.collection === "finance_tool_union_set")
    .map(item => item.uuid);
  const [worldRows, toolRows] = await Promise.all([
    worldIds.length
      ? db
          .select()
          .from(financeWorldDataset)
          .where(inArray(financeWorldDataset.uuid, worldIds))
      : [],
    toolIds.length
      ? db
          .select()
          .from(financeToolUnionSet)
          .where(inArray(financeToolUnionSet.toolUuid, toolIds))
      : [],
  ]);
  if (worldRows.length + toolRows.length !== data.length)
    throw new Error("SPIDER_PUSH_SELECTED_DATA_NOT_FOUND");
  const now = new Date();
  const relations: string[] = [];
  const contentKeys: string[] = [];
  const duplicateContentKeys = new Set<string>();
  await db.transaction(async tx => {
    for (const selected of data) {
      const world = worldRows.find(row => row.uuid === selected.uuid);
      const tool = toolRows.find(row => row.toolUuid === selected.uuid);
      const financeMeta =
        world?.financeArrayJson && typeof world.financeArrayJson === "object"
          ? (world.financeArrayJson as Record<string, unknown>)
          : {};
      let rawMeta: Record<string, unknown> = {};
      if (world?.rawContent?.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(world.rawContent);
          if (parsed && typeof parsed === "object") rawMeta = parsed;
        } catch {
          rawMeta = {};
        }
      }
      const title = world
        ? String(
            financeMeta.title ??
              rawMeta.title ??
              financeMeta.name ??
              world.assetCode ??
              world.dataSubType
          ).slice(0, 700)
        : `${tool!.toolName} · ${tool!.toolSubCategory}`;
      const body = world
        ? worldEditorial(world)
        : (tool!.aiStandardDoc ?? tool!.sceneDesc ?? "已选金融工具");
      // Serialize delivery per source entity so concurrent retries cannot
      // insert two copies, while distinct content revisions remain distinct.
      if (world) await tx.select({ id: financeWorldDataset.id }).from(financeWorldDataset).where(eq(financeWorldDataset.uuid, selected.uuid)).for("update");
      else await tx.select({ id: financeToolUnionSet.id }).from(financeToolUnionSet).where(eq(financeToolUnionSet.toolUuid, selected.uuid)).for("update");
      const relationUuid = `push_${hash(JSON.stringify([selected.collection, selected.uuid, [...moduleIds].sort(), [...targetAudience.userIds].sort((a, b) => a - b), title, body])).slice(0, 56)}`;
      const priorRelation = (await tx.select().from(spiderPushRelation).where(eq(spiderPushRelation.uuid, relationUuid)).limit(1))[0];
      if (!priorRelation) {
        await tx.insert(spiderPushRelation).values({
          uuid: relationUuid,
          dataUuid: selected.uuid,
          dataCollection: selected.collection,
          targetFrontModuleIds: moduleIds,
          operator: input.operator,
          operatorUserId: input.actorUserId,
          operateTime: now,
          pushStatus: "waiting_front_ack",
          pushDetail: input.automatic
            ? `自动清洗、去重后输送至 ${moduleIds.length} 个既有前端模块；仅写入已映射的数据槽。`
            : `管理员勾选 ${moduleIds.length} 个既有前端模块；仅写入选中模块的数据槽。`,
        });
      }
      for (const moduleId of moduleIds) {
        const module = ADMIN_DATA_MODULES.find(item => item.id === moduleId)!;
        const moduleTitle = isTopLongformModule(moduleId)
          ? toPlainNewsHeadline(title)
          : title;
        // Preserve the source article verbatim; long-form expansion belongs
        // to an explicit editorial action, never to delivery.
        const moduleBody = body;
        const candidatePublicItem = toPublicFeedItem({
          moduleId,
          title: moduleTitle,
          body: moduleBody,
          topic: world?.dataTopType ?? tool?.toolTopCategory,
          category: world?.dataSubType ?? tool?.toolSubCategory,
          sourceKind: "real",
          publishedAt: now,
          updatedAt: now,
          payload: {},
        });
        const normalizedIdentity = `${moduleId}|${publicContentFingerprint(candidatePublicItem?.body ?? moduleBody)}`;
        const contentHash = hash(normalizedIdentity);
        const exactDeliveries = await tx
            .select()
            .from(adminDataModuleContentItems)
            .where(
              and(
                eq(adminDataModuleContentItems.moduleId, moduleId),
                eq(adminDataModuleContentItems.status, "delivered"),
                eq(adminDataModuleContentItems.contentHash, contentHash)
              )
            )
            .orderBy(desc(adminDataModuleContentItems.id))
            .limit(1);
        let existingDelivery: (typeof exactDeliveries)[number] | undefined = exactDeliveries[0];
        if (!existingDelivery && candidatePublicItem) {
          const recentDeliveries = await tx
            .select()
            .from(adminDataModuleContentItems)
            .where(and(
              eq(adminDataModuleContentItems.moduleId, moduleId),
              eq(adminDataModuleContentItems.status, "delivered")
            ))
            .orderBy(desc(adminDataModuleContentItems.publishedAt), desc(adminDataModuleContentItems.id))
            .limit(80);
          existingDelivery = recentDeliveries.find(previous => {
            const previousPublicItem = toPublicFeedItem({ ...previous, payload: previous.targetPayload });
            return Boolean(previousPublicItem && isNearDuplicatePublicContent(candidatePublicItem.body, previousPublicItem.body));
          });
        }
        if (existingDelivery) {
          const previousPayload =
            existingDelivery.targetPayload &&
            typeof existingDelivery.targetPayload === "object"
              ? (existingDelivery.targetPayload as Record<string, unknown>)
              : {};
          const previousAudience = previousPayload.targetAudience && typeof previousPayload.targetAudience === "object"
            ? previousPayload.targetAudience as Record<string, unknown>
            : {};
          const previousUserIds = Array.isArray(previousAudience.userIds)
            ? previousAudience.userIds.filter((value): value is number => Number.isInteger(value))
            : registeredUsers.map(user => user.id);
          const mergedUserIds = [...new Set([...previousUserIds, ...targetAudience.userIds])].sort((a, b) => a - b);
          const addedUserIds = mergedUserIds.filter(userId => !previousUserIds.includes(userId));
          if (addedUserIds.length) {
            const previousReceipt = previousPayload.deliveryReceipt && typeof previousPayload.deliveryReceipt === "object"
              ? previousPayload.deliveryReceipt as Record<string, unknown>
              : {};
            const acknowledgedUserIds = Array.isArray(previousReceipt.acknowledgedUserIds)
              ? previousReceipt.acknowledgedUserIds.filter((value): value is number => Number.isInteger(value))
              : [];
            const successCount = mergedUserIds.filter(userId => acknowledgedUserIds.includes(userId)).length;
            const mergedRecipients = registeredUsers.filter(user => mergedUserIds.includes(user.id)).map(user => ({
              userId: user.id,
              name: user.name || `账户 ${user.id}`,
              email: user.email || null,
              role: user.role,
              lastSignedIn: user.lastSignedIn,
            }));
            await tx
              .update(adminDataModuleContentItems)
              .set({
                targetPayload: {
                  ...previousPayload,
                  sourceDataUuid: selected.uuid,
                  latestPushRelationUuid: relationUuid,
                  targetAudience: {
                    ...targetAudience,
                    label: `当前唯一前端实例的 ${mergedUserIds.length} 名指定用户`,
                    recipientCount: mergedUserIds.length,
                    userIds: mergedUserIds,
                    recipients: mergedRecipients,
                  },
                  deliveryReceipt: {
                    ...previousReceipt,
                    sentCount: mergedUserIds.length,
                    successCount,
                    pendingCount: Math.max(0, mergedUserIds.length - successCount),
                    currentStatus: successCount === mergedUserIds.length ? "front_acknowledged" : "waiting_front_ack",
                    frontAckAt: successCount === mergedUserIds.length ? previousReceipt.frontAckAt ?? now.toISOString() : null,
                    retryStatus: "not_required",
                  },
                },
                deliveryAttempts: (existingDelivery.deliveryAttempts ?? 1) + 1,
                reviewedByUserId: input.actorUserId,
                reviewedAt: now,
                updatedAt: existingDelivery.updatedAt,
              })
              .where(eq(adminDataModuleContentItems.id, existingDelivery.id));
            contentKeys.push(existingDelivery.contentKey);
            continue;
          }
          await tx
            .update(adminDataModuleContentItems)
            .set({
              targetPayload: {
                ...previousPayload,
                sourceDataUuid: selected.uuid,
                latestPushRelationUuid: relationUuid,
                duplicateBlockedAt: now.toISOString(),
              },
              deliveryAttempts: (existingDelivery.deliveryAttempts ?? 1) + 1,
              reviewedByUserId: input.actorUserId,
              reviewedAt: now,
              // A blocked retry is not new source data or a market update.
              updatedAt: existingDelivery.updatedAt,
            })
            .where(eq(adminDataModuleContentItems.id, existingDelivery.id));
          contentKeys.push(existingDelivery.contentKey);
          duplicateContentKeys.add(existingDelivery.contentKey);
          continue;
        }
        const contentKey = `spider:${relationUuid}:${moduleId}`.slice(0, 160);
        await tx.insert(adminDataModuleContentItems).values({
          contentKey,
          moduleId,
          contentType: "generic",
          sourceKind:
            world?.sourceUrl?.startsWith("simulated://") ||
            tool?.tagList?.includes("内置示例")
              ? "simulated"
              : "real",
          status: "delivered",
          title: moduleTitle.slice(0, 700),
          body: moduleBody,
          topic: world?.dataTopType ?? tool?.toolTopCategory,
          category: world?.dataSubType ?? tool?.toolSubCategory,
          keywords: world?.tagList ?? tool?.tagList ?? [],
          tags: [input.automatic ? "AI爬虫自动输送" : "AI爬虫人工推送", selected.collection, moduleId],
          sortWeight: 100,
          publishedAt: now,
          sourceReference: (world?.sourceUrl ?? tool?.sourceUrl ?? "").slice(
            0,
            1200
          ),
          targetPayload: {
            sourceDataUuid: selected.uuid,
            sourceCollection: selected.collection,
            pushRelationUuid: relationUuid,
            targetModuleId: moduleId,
            targetModuleName: module.name,
            targetPath: module.path,
            manualSelection: !input.automatic,
            automaticPush: Boolean(input.automatic),
            simulated:
              world?.sourceUrl?.startsWith("simulated://") ||
              tool?.tagList?.includes("内置示例") ||
              false,
            targetAudience,
            deliveryReceipt: {
              receiptId: relationUuid,
              sentAt: now.toISOString(),
              targetScope: `${module.name} · ${module.path}`,
              sentCount: targetAudience.recipientCount,
              successCount: 0,
              failureCount: 0,
              pendingCount: targetAudience.recipientCount,
              currentStatus: "waiting_front_ack",
              frontAckAt: null,
              latestFrontAckAt: null,
              failureReason: null,
              retryStatus: "not_required",
              acknowledgedClientCount: 0,
              acknowledgedClients: [],
              acknowledgedTerminals: [],
            },
          },
          contentHash,
          dedupeScope: `spider:${moduleId}`,
          qualityScore:
            world?.dataQualityLevel === "L1"
              ? 100
              : world?.dataQualityLevel === "L2"
                ? 90
                : 80,
          qualityReport: {
            manualSelection: !input.automatic,
            sourceBound: true,
            moduleBound: true,
          },
          reviewedByUserId: input.actorUserId,
          reviewedAt: now,
          deliveryAttempts: 1,
        });
        contentKeys.push(contentKey);
      }
      if (world)
        await tx
          .update(financeWorldDataset)
          .set({ isPush: true, pushRecordId: relationUuid, updateTime: now })
          .where(eq(financeWorldDataset.uuid, selected.uuid));
      relations.push(relationUuid);
    }
  });
  const deliveredRows = contentKeys.length
    ? await db
        .select()
        .from(adminDataModuleContentItems)
        .where(inArray(adminDataModuleContentItems.contentKey, contentKeys))
    : [];
  const feedByModule = new Map(
    await Promise.all(
      moduleIds.map(async moduleId => {
        const feed = await getPublicModuleFeed(moduleId);
        return [moduleId, feed] as const;
      })
    )
  );
  return {
    pushedDataCount: data.length,
    targetModuleCount: moduleIds.length,
    relationUuids: relations,
    deliveryReceipts: deliveredRows.map(row => {
      const module = ADMIN_DATA_MODULES.find(item => item.id === row.moduleId);
      const publicItem = toPublicFeedItem({
        ...row,
        payload: row.targetPayload,
      });
      const publicFeed = feedByModule.get(row.moduleId);
      const payload =
        row.targetPayload && typeof row.targetPayload === "object"
          ? (row.targetPayload as Record<string, unknown>)
          : {};
      const storedReceipt =
        payload.deliveryReceipt && typeof payload.deliveryReceipt === "object"
          ? (payload.deliveryReceipt as Record<string, unknown>)
          : {};
      const duplicateBlocked = duplicateContentKeys.has(row.contentKey);
      const receiptId =
        duplicateBlocked && typeof payload.latestPushRelationUuid === "string"
          ? payload.latestPushRelationUuid
          : typeof storedReceipt.receiptId === "string"
            ? storedReceipt.receiptId
            : typeof payload.pushRelationUuid === "string"
              ? payload.pushRelationUuid
              : row.contentKey;
      const frontAckAt =
        !duplicateBlocked && typeof storedReceipt.frontAckAt === "string"
          ? storedReceipt.frontAckAt
          : null;
      return {
        contentKey: row.contentKey,
        receiptId,
        moduleId: row.moduleId,
        moduleName: module?.name ?? row.moduleId,
        frontPath: module?.path ?? "—",
        status: row.status,
        duplicateBlocked,
        deliveryAction: duplicateBlocked
          ? ("duplicate_blocked" as const)
          : ("inserted" as const),
        sourceKind: row.sourceKind,
        sourceReference: row.sourceReference,
        publishedAt: row.publishedAt,
        sentAt: duplicateBlocked ? new Date() : row.publishedAt,
        targetScope: `${module?.name ?? row.moduleId} · ${module?.path ?? "—"}`,
        sentCount: duplicateBlocked ? 0 : Number(storedReceipt.sentCount ?? targetAudience.recipientCount),
        successCount: duplicateBlocked ? 0 : Number(storedReceipt.successCount ?? (frontAckAt ? 1 : 0)),
        pendingCount: duplicateBlocked ? 0 : Number(storedReceipt.pendingCount ?? Math.max(0, targetAudience.recipientCount - Number(storedReceipt.successCount ?? 0))),
        failureCount: row.status === "failed" ? 1 : 0,
        currentStatus: duplicateBlocked
          ? "duplicate_blocked"
          : frontAckAt
            ? "front_acknowledged"
            : "waiting_front_ack",
        frontAckAt,
        failureReason: row.errorDetail ?? null,
        retryStatus:
          row.status === "failed" ? "retry_available" : "not_required",
        acknowledgedClientCount: duplicateBlocked ? 0 : Number(
          storedReceipt.acknowledgedClientCount ?? 0
        ),
        acknowledgedClients: duplicateBlocked ? [] : Array.isArray(storedReceipt.acknowledgedClients) ? storedReceipt.acknowledgedClients : [],
        acknowledgedUserIds: duplicateBlocked ? [] : Array.isArray(storedReceipt.acknowledgedUserIds) ? storedReceipt.acknowledgedUserIds : [],
        acknowledgedTerminals: duplicateBlocked ? [] : Array.isArray(storedReceipt.acknowledgedTerminals) ? storedReceipt.acknowledgedTerminals : [],
        targetAudience,
        sourceDataUuid:
          typeof payload.sourceDataUuid === "string"
            ? payload.sourceDataUuid
            : null,
        sourceCollection:
          typeof payload.sourceCollection === "string"
            ? payload.sourceCollection
            : null,
        title: publicItem?.title ?? row.title,
        body: publicItem?.body ?? "",
        visibleItemKey: publicItem?.itemKey ?? null,
        visibleItemCount: publicFeed?.items.length ?? 0,
        feedVisible: Boolean(
          publicItem &&
          publicFeed?.items.some(item => item.deliveryKey === row.contentKey)
        ),
        frontReadConfirmed: Boolean(frontAckAt),
        verifiedAt: new Date(),
      };
    }),
    automaticPush: Boolean(input.automatic),
    targetAudience,
  };
}

export async function getSpiderLineage(dataUuid: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [world, tool, blood, snapshots, links, pushes] = await Promise.all([
    db
      .select()
      .from(financeWorldDataset)
      .where(eq(financeWorldDataset.uuid, dataUuid))
      .limit(1),
    db
      .select()
      .from(financeToolUnionSet)
      .where(eq(financeToolUnionSet.toolUuid, dataUuid))
      .limit(1),
    db
      .select()
      .from(spiderDataBlood)
      .where(eq(spiderDataBlood.structuredDataUuid, dataUuid))
      .limit(20),
    db
      .select()
      .from(spiderContentSnapshot)
      .where(eq(spiderContentSnapshot.entityUuid, dataUuid))
      .orderBy(desc(spiderContentSnapshot.version))
      .limit(30),
    db
      .select()
      .from(spiderEntityLink)
      .where(
        or(
          eq(spiderEntityLink.sourceEntityUuid, dataUuid),
          eq(spiderEntityLink.targetEntityUuid, dataUuid)
        )
      )
      .limit(50),
    db
      .select()
      .from(spiderPushRelation)
      .where(eq(spiderPushRelation.dataUuid, dataUuid))
      .orderBy(desc(spiderPushRelation.operateTime))
      .limit(30),
  ]);
  const data: any = world[0] ?? tool[0] ?? null;
  if (!data)
    return {
      found: false as const,
      data: null,
      summary: null,
      sources: [],
      steps: [],
      snapshots: [],
      links: [],
      pushes: [],
    };
  const rawUuids = [...new Set(blood.flatMap(row => row.rawUuids ?? []))];
  const processUuids = [
    ...new Set(blood.flatMap(row => row.processUuids ?? [])),
  ];
  const [rawRows, processRows] = await Promise.all([
    rawUuids.length
      ? db
          .select()
          .from(spiderRawData)
          .where(inArray(spiderRawData.rawUuid, rawUuids))
      : [],
    processUuids.length
      ? db
          .select()
          .from(spiderAiProcessed)
          .where(inArray(spiderAiProcessed.processUuid, processUuids))
      : [],
  ]);
  const isWorld = "uuid" in data;
  const title = isWorld
    ? String(
        (data.financeArrayJson as Record<string, unknown> | null)?.title ??
          (data.financeArrayJson as Record<string, unknown> | null)?.name ??
          data.assetCode ??
          data.dataSubType
      )
    : data.toolName;
  const sources = blood.flatMap(record =>
    (record.sourceUrls ?? []).map(sourceUrl => {
      const raw = rawRows.find(
        item =>
          item.sourceUrl === sourceUrl || item.rawUuid === record.rawUuids?.[0]
      );
      return {
        sourceUrl,
        sourceName: isWorld ? data.sourceName : "金融工具公开方法文档",
        rawUuid: raw?.rawUuid ?? null,
        httpStatus: raw?.httpStatus ?? null,
        contentHash: raw?.contentHash ?? null,
        capturedAt:
          raw?.crawlTime ?? (isWorld ? data.crawlTime : data.crawlTime),
        originalAvailable: /^https?:\/\//.test(sourceUrl),
      };
    })
  );
  const steps = blood.flatMap(record =>
    (record.transformationSteps ?? []).map((step, index) => ({
      order: index + 1,
      bloodId: record.dataBloodId,
      name: String(step.step ?? `步骤 ${index + 1}`),
      detail: String(
        step.detail ?? step.result ?? step.parser ?? step.engine ?? "已记录"
      ),
      at: step.at ?? record.updatedAt,
    }))
  );
  return {
    found: true as const,
    data,
    summary: {
      title,
      uuid: isWorld ? data.uuid : data.toolUuid,
      collection: isWorld ? "finance_world_dataset" : "finance_tool_union_set",
      dataType: isWorld
        ? `${data.dataTopType} / ${data.dataSubType}`
        : `${data.toolTopCategory} / ${data.toolSubCategory}`,
      quality: data.dataQualityLevel,
      sourceKind:
        isWorld &&
        (data.sourceUrl.startsWith("simulated://") ||
          data.sourceUrl.startsWith("uploaded://"))
          ? data.sourceUrl.startsWith("simulated://")
            ? "模拟数据"
            : "用户导入数据"
          : "公开来源数据",
      updatedAt: isWorld ? data.updateTime : data.updateTime,
      rawRecordCount: rawRows.length,
      processRecordCount: processRows.length,
      snapshotCount: snapshots.length,
      relationCount: links.length,
      pushCount: pushes.length,
    },
    sources,
    steps,
    processes: processRows.map(process => ({
      processUuid: process.processUuid,
      parser: process.parserType,
      model: process.aiModel,
      quality: process.qualityLevel,
      checks: process.qualityChecks,
      status: process.processStatus,
      processedAt: process.updatedAt,
    })),
    snapshots: snapshots.map(snapshot => ({
      ...snapshot,
      contentPreview: (snapshot.snapshotContent ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 500),
      contentBytes: Buffer.byteLength(snapshot.snapshotContent ?? "", "utf8"),
    })),
    links: links.map(link => ({
      ...link,
      evidence: (link.evidenceRawUuids ?? []).map(rawUuid => ({
        rawUuid,
        sourceUrl:
          rawRows.find(raw => raw.rawUuid === rawUuid)?.sourceUrl ?? null,
      })),
    })),
    pushes: pushes.map(push => ({
      ...push,
      targetModules: (push.targetFrontModuleIds ?? []).map(moduleId => {
        const module = ADMIN_DATA_MODULES.find(item => item.id === moduleId);
        return {
          moduleId,
          moduleName: module?.name ?? moduleId,
          path: module?.path ?? "—",
        };
      }),
    })),
  };
}

export async function exportSpiderLogs() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const [scans, failures, pushes] = await Promise.all([
    db
      .select()
      .from(spiderMissingScanLog)
      .orderBy(desc(spiderMissingScanLog.startedAt))
      .limit(1000),
    db
      .select()
      .from(spiderFailLog)
      .orderBy(desc(spiderFailLog.createdAt))
      .limit(1000),
    db
      .select()
      .from(spiderPushRelation)
      .orderBy(desc(spiderPushRelation.operateTime))
      .limit(1000),
  ]);
  return { exportedAt: new Date(), format: "json", scans, failures, pushes };
}
