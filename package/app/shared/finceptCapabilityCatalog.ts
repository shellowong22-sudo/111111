export type FinceptCapabilityStatus =
  | "connected"
  | "mixed_persistent_adapter"
  | "existing_persistent_adapter"
  | "partial_persistent_adapter"
  | "live_volatile_adapter"
  | "module_database_only"
  | "dependency_blocked";

export type FinceptCapability = {
  id: string;
  category: string;
  label: string;
  zipCapabilityCount: number;
  status: FinceptCapabilityStatus;
  moduleId: string;
  frontendPath: string;
  dataContractIds: string[];
  note: string;
};

export type FinceptPlaceholderSlotGroup = {
  category: string;
  positions: readonly number[];
  status: "mapped";
  reason: string;
};

/**
 * These are the legacy numbered slots the user identified as placeholders.
 * They are only a map for frontend page capabilities found in the ZIP.  They
 * are deliberately not the professional-application API registry: a slot
 * never changes a page into portfolio management, trading, STP, or another
 * professional application.  A slot can only be marked verified when a
 * runnable adapter and a matching existing frontend contract are both
 * verified.
 */
export const FINCEPT_PLACEHOLDER_SLOT_GROUPS: readonly FinceptPlaceholderSlotGroup[] = [
  {
    category: "股市",
    positions: [6, 13, 16, 17, 23, 25, 29, 30],
    status: "mapped",
    reason: "ZIP 前端能力映射到现有 EQS/股票工作区的行情、估值、事件、分红、IPO 和地区快照视图；每个卡槽保留独立数据范围，不代表专业应用 API。",
  },
  {
    category: "大宗商品",
    positions: [8, 12, 14, 16, 31, 32],
    status: "mapped",
    reason: "ZIP 前端能力映射到既有 COMM/OILS 功能，天然气、原油库存和炼厂利用率使用不同数据合同，不代表专业应用 API。",
  },
  {
    category: "指数",
    positions: [7, 13, 14, 17],
    status: "mapped",
    reason: "ZIP 前端能力映射到既有 WEI/指数中心，TAIEX、波动率、延迟快照和 SOX 使用独立数据合同，不代表专业应用 API。",
  },
  {
    category: "衍生品",
    positions: [1, 4, 10, 11, 14, 15, 18, 22],
    status: "mapped",
    reason: "ZIP 前端能力映射到商品期货、DERI、MOSO 和 CFTC 现有入口；CFTC 总仓与管理基金净仓使用不同视图范围，不代表专业应用 API。",
  },
  {
    category: "新闻与研究",
    positions: [13, 15, 16, 17, 20, 26, 29],
    status: "mapped",
    reason: "ZIP 前端能力映射到既有新闻与研究标签页；文章仍由一个出版账本按主题、滚动、晨报和研究视图去重，不代表专业应用 API。",
  },
  {
    category: "经济分析",
    positions: [1, 9, 18, 19],
    status: "mapped",
    reason: "ZIP 前端能力映射到既有经济分析页，GDP、CPI、PMI 和经济日历各自使用独立合同，不代表专业应用 API。",
  },
] as const;

export type FinceptPlaceholderSlotBinding = {
  category: string;
  position: number;
  functionCode: string;
  label: string;
  moduleId: string;
  frontendPath: string;
  dataContractId: string | null;
  dataScopeKey: string;
  viewKey: string;
};

/**
 * Existing professional panels that own the legacy numbered slots.
 *
 * A slot is a view into an existing module, never a new route.  `viewKey`
 * keeps separate analytical scopes (for example CFTC producer vs managed
 * money) from being counted as duplicated rows even when the canonical
 * source contract is shared.  The server resolves the runtime status from
 * the persisted observation ledger; this catalog contains no sample values.
 */
export const FINCEPT_PLACEHOLDER_SLOT_BINDINGS: readonly FinceptPlaceholderSlotBinding[] = [
  // 股市
  { category: "股市", position: 6, functionCode: "NASDAQ", label: "Nasdaq 全球股票筛选", moduleId: "stock-eqs", frontendPath: "/terminal?open=most&module=stocks", dataContractId: "equity.global.nasdaq-screener.daily.v1", dataScopeKey: "stock.global.screener", viewKey: "screener" },
  { category: "股市", position: 13, functionCode: "EQS", label: "EQS 股票筛选 / 行情", moduleId: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", dataContractId: "equity.twse.snapshot.v1", dataScopeKey: "stock.twse.snapshot", viewKey: "quote" },
  { category: "股市", position: 16, functionCode: "GF", label: "GF 基本面与估值", moduleId: "stock-eqs", frontendPath: "/terminal?open=gf&module=stocks", dataContractId: "equity.twse.valuation.v1", dataScopeKey: "stock.twse.valuation", viewKey: "valuation" },
  { category: "股市", position: 17, functionCode: "EVTS", label: "EVTS 大事日历 / 财报", moduleId: "stock-eqs", frontendPath: "/terminal?open=evts&module=stocks", dataContractId: "equity.global.nasdaq-earnings-calendar.daily.v1", dataScopeKey: "stock.global.earnings", viewKey: "earnings" },
  { category: "股市", position: 23, functionCode: "DDIS", label: "DDIS 股息分配", moduleId: "stock-eqs", frontendPath: "/terminal?open=ddis&module=stocks", dataContractId: "equity.global.nasdaq-dividend-calendar.daily.v1", dataScopeKey: "stock.global.dividend", viewKey: "dividend" },
  { category: "股市", position: 25, functionCode: "GIPO", label: "GIPO IPO 日历", moduleId: "stock-eqs", frontendPath: "/terminal?open=gipo&module=stocks", dataContractId: "equity.global.nasdaq-ipo-calendar.monthly.v1", dataScopeKey: "stock.global.ipo", viewKey: "ipo" },
  { category: "股市", position: 29, functionCode: "CN-EQS", label: "中国股票公开快照", moduleId: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", dataContractId: "equity.cn.a.snapshot.akshare.v1", dataScopeKey: "stock.cn.snapshot", viewKey: "cn" },
  { category: "股市", position: 30, functionCode: "HK-EQS", label: "港股公开快照", moduleId: "stock-eqs", frontendPath: "/terminal?open=eqs&module=stocks", dataContractId: "equity.hk.snapshot.akshare.v1", dataScopeKey: "stock.hk.snapshot", viewKey: "hk" },
  // 大宗商品
  { category: "大宗商品", position: 8, functionCode: "COMM", label: "COMM 天然气库存", moduleId: "commodity-market", frontendPath: "/menu-item/COMM", dataContractId: "energy.us.natural-gas-storage.weekly.v1", dataScopeKey: "commodity.energy.ng-storage", viewKey: "gas-storage" },
  { category: "大宗商品", position: 12, functionCode: "OILS", label: "OILS 原油库存", moduleId: "commodity-market", frontendPath: "/terminal?module=commodities&open=oils", dataContractId: "energy.us.commercial-crude-inventory.eia.weekly.v1", dataScopeKey: "commodity.energy.crude-inventory", viewKey: "crude-inventory" },
  { category: "大宗商品", position: 14, functionCode: "REFINERY", label: "炼厂产能利用率", moduleId: "commodity-market", frontendPath: "/menu-item/COMM", dataContractId: "energy.us.refinery-utilization.eia.weekly.v1", dataScopeKey: "commodity.energy.refinery", viewKey: "refinery" },
  { category: "大宗商品", position: 16, functionCode: "WTI", label: "WTI 原油现货", moduleId: "commodity-market", frontendPath: "/terminal?module=commodities&open=oils", dataContractId: "commodity.us.wti-spot.fred.daily.v1", dataScopeKey: "commodity.energy.wti-spot", viewKey: "wti-spot" },
  { category: "大宗商品", position: 31, functionCode: "GOLD", label: "黄金参考价", moduleId: "commodity-market", frontendPath: "/menu-item/COMM", dataContractId: "commodity.pl.gold.nbp.daily.v1", dataScopeKey: "commodity.metals.gold", viewKey: "gold-reference" },
  { category: "大宗商品", position: 32, functionCode: "BDI", label: "波罗的海干散货指数", moduleId: "commodity-market", frontendPath: "/menu-item/COMM", dataContractId: "commodity.global.bdi.akshare.v1", dataScopeKey: "commodity.shipping.bdi", viewKey: "bdi" },
  // 指数
  { category: "指数", position: 7, functionCode: "WEI", label: "WEI 全球股票指数", moduleId: "index-hub", frontendPath: "/index-hub?panel=WEI", dataContractId: "index.twse.taiex.snapshot.v1", dataScopeKey: "index.tw.taiex", viewKey: "taiex" },
  { category: "指数", position: 13, functionCode: "VOL", label: "CBOE 波动率历史", moduleId: "index-hub", frontendPath: "/index-hub?panel=RRG", dataContractId: "index.global.cboe-volatility.daily.v1", dataScopeKey: "index.global.volatility", viewKey: "volatility" },
  { category: "指数", position: 14, functionCode: "WT", label: "CBOE 全球指数延迟快照", moduleId: "index-hub", frontendPath: "/index-hub?panel=WT", dataContractId: "index.global.cboe-delayed-snapshot.daily.v1", dataScopeKey: "index.global.delayed", viewKey: "delayed" },
  { category: "指数", position: 17, functionCode: "SOX", label: "费城半导体指数", moduleId: "index-hub", frontendPath: "/index-hub?panel=OTHER_INDEX", dataContractId: "index.global.sox.akshare.v1", dataScopeKey: "index.global.sox", viewKey: "sox" },
  // 衍生品
  { category: "衍生品", position: 1, functionCode: "CFTC", label: "CFTC 持仓总览", moduleId: "commodity-futures", frontendPath: "/terminal?module=commodities&open=cftc", dataContractId: "derivatives.global.cftc-disaggregated.weekly.v1", dataScopeKey: "derivative.cftc", viewKey: "all" },
  { category: "衍生品", position: 4, functionCode: "FOM", label: "全球期货公开快照", moduleId: "commodity-futures", frontendPath: "/commodity-futures", dataContractId: "derivatives.global.futures.snapshot.akshare.v1", dataScopeKey: "derivative.global.futures", viewKey: "global-futures" },
  { category: "衍生品", position: 10, functionCode: "DERI", label: "中国期货公开快照", moduleId: "commodity-futures", frontendPath: "/deri", dataContractId: "derivatives.cn.futures.snapshot.akshare.v1", dataScopeKey: "derivative.cn.futures", viewKey: "cn-futures" },
  { category: "衍生品", position: 11, functionCode: "INV", label: "沪铜库存序列", moduleId: "commodity-futures", frontendPath: "/commodity-futures", dataContractId: "derivatives.cn.futures.inventory.akshare.v1", dataScopeKey: "derivative.cn.inventory", viewKey: "inventory" },
  { category: "衍生品", position: 14, functionCode: "MOSO", label: "期权公开快照", moduleId: "moso", frontendPath: "/moso", dataContractId: "derivatives.cn.options.snapshot.akshare.v1", dataScopeKey: "derivative.cn.options", viewKey: "options-snapshot" },
  { category: "衍生品", position: 15, functionCode: "DERI-FM", label: "FinMind 期货日成交", moduleId: "deri", frontendPath: "/deri", dataContractId: "derivatives.tw.futures.daily.finmind.v1", dataScopeKey: "derivative.tw.finmind-futures", viewKey: "finmind-futures" },
  { category: "衍生品", position: 18, functionCode: "MOSO-FM", label: "FinMind 期权日成交", moduleId: "moso", frontendPath: "/moso", dataContractId: "derivatives.tw.options.daily.finmind.v1", dataScopeKey: "derivative.tw.finmind-options", viewKey: "finmind-options" },
  { category: "衍生品", position: 22, functionCode: "CFTC-MM", label: "CFTC 管理基金净仓", moduleId: "commodity-futures", frontendPath: "/terminal?module=commodities&open=cftc", dataContractId: "derivatives.global.cftc-disaggregated.weekly.v1", dataScopeKey: "derivative.cftc", viewKey: "managed-money" },
  // 新闻与研究：同一出版账本按唯一视图范围分派，不复制文章记录。
  { category: "新闻与研究", position: 13, functionCode: "TOP", label: "TOP 要闻精选", moduleId: "news-top", frontendPath: "/news-hub?tab=top", dataContractId: "news.public.publication.akshare.v1", dataScopeKey: "news.publication", viewKey: "top" },
  { category: "新闻与研究", position: 15, functionCode: "CN", label: "公司新闻", moduleId: "news-cn", frontendPath: "/news-hub?tab=cn", dataContractId: "news.tw.2330.company.finmind.v1", dataScopeKey: "news.company", viewKey: "company" },
  { category: "新闻与研究", position: 16, functionCode: "NI", label: "新闻主题", moduleId: "news-ni", frontendPath: "/news-hub?tab=ni", dataContractId: "news.public.publication.akshare.v1", dataScopeKey: "news.publication", viewKey: "topic" },
  { category: "新闻与研究", position: 17, functionCode: "NH", label: "滚动新闻", moduleId: "news-hub", frontendPath: "/news-hub?tab=nh", dataContractId: "news.public.publication.akshare.v1", dataScopeKey: "news.publication", viewKey: "rolling" },
  { category: "新闻与研究", position: 20, functionCode: "NEWS", label: "新闻中心", moduleId: "news-hub", frontendPath: "/news-hub", dataContractId: "news.cn.cctv.akshare.v1", dataScopeKey: "news.cctv", viewKey: "cctv" },
  { category: "新闻与研究", position: 26, functionCode: "MREP", label: "Morning Report", moduleId: "news-hub", frontendPath: "/news-hub?tab=mrep", dataContractId: "news.public.publication.akshare.v1", dataScopeKey: "news.publication", viewKey: "morning-report" },
  { category: "新闻与研究", position: 29, functionCode: "OPIN", label: "观点与研究", moduleId: "news-hub", frontendPath: "/news-hub?tab=opin", dataContractId: "news.public.publication.akshare.v1", dataScopeKey: "news.publication", viewKey: "research" },
  // 经济分析
  { category: "经济分析", position: 1, functionCode: "ECST", label: "中国 GDP 观察", moduleId: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", dataContractId: "macro.cn.gdp.akshare.v1", dataScopeKey: "macro.cn.gdp", viewKey: "gdp" },
  { category: "经济分析", position: 9, functionCode: "CPI", label: "中国 CPI 观察", moduleId: "economic-ecst", frontendPath: "/econ-hub?tab=ecst", dataContractId: "macro.cn.cpi.akshare.v1", dataScopeKey: "macro.cn.cpi", viewKey: "cpi" },
  { category: "经济分析", position: 18, functionCode: "PMI", label: "中国 PMI 观察", moduleId: "economic-ecst", frontendPath: "/econ-hub?tab=pmi", dataContractId: "macro.cn.pmi.akshare.v1", dataScopeKey: "macro.cn.pmi", viewKey: "pmi" },
  { category: "经济分析", position: 19, functionCode: "ECO", label: "全球经济事件日历", moduleId: "economic-ecst", frontendPath: "/econ-hub?tab=eco", dataContractId: "macro.global.nasdaq-economic-calendar.daily.v1", dataScopeKey: "macro.global.calendar", viewKey: "calendar" },
] as const;

/**
 * This is an honest capability map, not a claim that every Python script in
 * FinceptTerminal is executable in the Node service.  `zipCapabilityCount`
 * records the inspected script surface; status records what is actually
 * available through this application today.
 */
export const FINCEPT_CAPABILITIES: readonly FinceptCapability[] = [
  {
    id: "stocks",
    category: "股票",
    label: "股票与证券快照",
    zipCapabilityCount: 8,
    status: "connected",
    moduleId: "stock-eqs",
    frontendPath: "/terminal?open=eqs&module=stocks",
    dataContractIds: [
      "equity.twse.snapshot.v1",
      "equity.twse.valuation.v1",
      "equity.global.nasdaq-screener.daily.v1",
      "equity.global.nasdaq-earnings-calendar.daily.v1",
      "equity.global.nasdaq-dividend-calendar.daily.v1",
      "equity.global.nasdaq-ipo-calendar.monthly.v1",
      "equity.cn.a.snapshot.akshare.v1",
      "equity.hk.snapshot.akshare.v1",
      "equity.us.snapshot.akshare.v1",
    ],
    note: "TWSE、Nasdaq 股票筛选、财报、分红、IPO 日历以及中港美公开快照均进入 EQS；事件与报价分开归档，名称、代码、日期和观察字段按唯一事件去重，不标记为逐笔实时。",
  },
  {
    id: "indices",
    category: "指数",
    label: "指数与成分观察",
    zipCapabilityCount: 30,
    status: "connected",
    moduleId: "index-hub",
    frontendPath: "/index-hub?panel=WEI",
    dataContractIds: [
      "index.twse.taiex.snapshot.v1",
      "index.global.cboe-volatility.daily.v1",
      "index.global.cboe-delayed-snapshot.daily.v1",
      "index.cn.snapshot.akshare.v1",
      "index.global.snapshot.akshare.v1",
      "index.global.sox.akshare.v1",
    ],
    note: "TAIEX、CBOE 波动率、CBOE 延迟快照、中国/全球指数快照和 SOX 历史均接入指数中心；历史、延迟快照和期权链保持独立，不互相冒充实时报价。",
  },
  {
    id: "crypto",
    category: "加密货币",
    label: "加密资产行情",
    zipCapabilityCount: 4,
    status: "mixed_persistent_adapter",
    moduleId: "crypto-market",
    frontendPath: "/crypto-market",
    dataContractIds: ["crypto.global.coingecko.markets.daily.v1", "crypto.btc-usd.fred.daily.v1"],
    note: "CoinGecko 市场快照已接入加密货币既有页面并写入日频永久观察账本；公开观察不标记为交易所逐笔实时，链上与恐贪接口仍按各自可验证状态显示。",
  },
  {
    id: "commodities",
    category: "大宗商品",
    label: "能源与商品观察",
    zipCapabilityCount: 12,
    status: "mixed_persistent_adapter",
    moduleId: "commodity-market",
    frontendPath: "/menu-item/COMM",
    dataContractIds: [
      "energy.us.natural-gas-storage.weekly.v1",
      "energy.us.commercial-crude-inventory.eia.weekly.v1",
      "energy.us.refinery-utilization.eia.weekly.v1",
      "commodity.us.wti-spot.fred.daily.v1",
      "commodity.pl.gold.nbp.daily.v1",
      "commodity.global.bdi.akshare.v1",
    ],
    note: "天然气、原油库存、炼厂利用率、WTI、黄金和 BDI 分别适配至 COMM/OILS；不同频率与单位独立归档，不把参考价冒充实时现货。",
  },
  {
    id: "bonds",
    category: "债券",
    label: "国债与债券观察",
    zipCapabilityCount: 2,
    status: "existing_persistent_adapter",
    moduleId: "bond-market",
    frontendPath: "/bond-market",
    dataContractIds: [
      "credit.us.high-yield-oas.fred.daily.v1",
      "fiscal.us.total-public-debt.daily.v1",
    ],
    note: "现有 Treasury/FRED 观察写入固收面板；单券报价仍保持授权边界。",
  },
  {
    id: "forex",
    category: "外汇",
    label: "外汇与参考汇率",
    zipCapabilityCount: 2,
    status: "mixed_persistent_adapter",
    moduleId: "forex-hub",
    frontendPath: "/terminal?open=fxc&module=forex",
    dataContractIds: [
      "fx.hkma.daily-reference.v1",
      "fx.bank-of-canada.usdcad.v1",
      "fx.frankfurter.daily.v1",
      "fx.pl.usd-pln.nbp.daily.v1",
      "fx.pl.multi-pln.nbp.daily.v1",
      "fx.cz.cnb.daily-reference.v1",
      "fx.il.boi.daily-reference.v1",
    ],
    note: "USD/PLN、NBP A 表货币对和 CNB/CZK 货币对分别直接适配至原第 6 项 FXC 汇率矩阵，其他已有货币对保留各自合同与观察日。",
  },
  {
    id: "etf",
    category: "ETF",
    label: "ETF 详情与持仓",
    zipCapabilityCount: 2,
    status: "module_database_only",
    moduleId: "etf-holdings",
    frontendPath: "/etf-holdings-admin",
    dataContractIds: [],
    note: "现有页面读取 ETF 产品与持仓数据库；当前没有经过验证的自动行情归档适配器，Fincept 资金脚本未直接写入 ETF 表。",
  },
  {
    id: "funds",
    category: "基金",
    label: "基金目录与分配",
    zipCapabilityCount: 2,
    status: "existing_persistent_adapter",
    moduleId: "fund-browse",
    frontendPath: "/fund-browse",
    dataContractIds: [
      "fund.open.snapshot.akshare.v1",
      "fund.etf.snapshot.akshare.v1",
    ],
    note: "开放式基金净值与 ETF 公开快照已写入基金浏览既有页面；字段经过清洗并以基金代码、名称和观察日去重。",
  },
  {
    id: "futures",
    category: "期货",
    label: "期货与合约观察",
    zipCapabilityCount: 1,
    status: "existing_persistent_adapter",
    moduleId: "deri",
    frontendPath: "/deri",
    dataContractIds: [
      "derivatives.tw.futures.daily.finmind.v1",
      "derivatives.global.cftc-disaggregated.weekly.v1",
      "derivatives.global.futures.snapshot.akshare.v1",
      "derivatives.cn.futures.snapshot.akshare.v1",
      "derivatives.cn.futures.inventory.akshare.v1",
    ],
    note: "FinMind 台湾期货日成交归入既有 DERI 衍生品入口；全球/中国商品期货与库存继续由商品期货入口负责，合同不跨入口复制。",
  },
  {
    id: "options",
    category: "期权",
    label: "期权链与活跃合约",
    zipCapabilityCount: 46,
    status: "existing_persistent_adapter",
    moduleId: "moso",
    frontendPath: "/moso",
    dataContractIds: [
      "derivatives.tw.options.daily.finmind.v1",
      "derivatives.cn.options.snapshot.akshare.v1",
    ],
    note: "现有期权归档与合约命名链路负责 MOSO；缺少授权链时不生成 Greeks 或报价。",
  },
  {
    id: "news",
    category: "新闻",
    label: "新闻与研究",
    zipCapabilityCount: 10,
    status: "partial_persistent_adapter",
    moduleId: "news-hub",
    frontendPath: "/news-hub",
    dataContractIds: [],
    note: "既有新闻投递和文章表支持清洗、TypeSafe 分类、去重与持久化；全局 RSS 读取层仍有内存缓存，Fincept Qt 新闻脚本未直接复制。",
  },
  {
    id: "macro",
    category: "宏观经济",
    label: "宏观、经济与官方统计",
    zipCapabilityCount: 49,
    status: "existing_persistent_adapter",
    moduleId: "economic-ecst",
    frontendPath: "/econ-hub?tab=ecst",
    dataContractIds: [
      "macro.cn.gdp.akshare.v1",
      "macro.cn.cpi.akshare.v1",
      "macro.cn.pmi.akshare.v1",
      "macro.world.gdp.world-bank.v1",
      "macro.world.gdp-growth.imf-weo.v1",
      "macro.global.nasdaq-economic-calendar.daily.v1",
    ],
    note: "公开宏观与官方统计按发布周期进入已有经济分析页面；不会把月度/季度观察标为实时行情。",
  },
] as const;

export function assertFinceptCapabilityUniqueness() {
  const ids = FINCEPT_CAPABILITIES.map(item => item.id);
  const modules = FINCEPT_CAPABILITIES.map(item => item.moduleId);
  if (new Set(ids).size !== ids.length) throw new Error("FINCEPT_CAPABILITY_ID_DUPLICATE");
  if (new Set(modules).size !== modules.length) throw new Error("FINCEPT_CAPABILITY_MODULE_DUPLICATE");
  for (const group of FINCEPT_PLACEHOLDER_SLOT_GROUPS) {
    if (!group.positions.length || new Set(group.positions).size !== group.positions.length) {
      throw new Error(`FINCEPT_PLACEHOLDER_SLOT_INVALID:${group.category}`);
    }
  }
  const slotKeys = FINCEPT_PLACEHOLDER_SLOT_BINDINGS.map(
    item => `${item.category}|${item.position}`,
  );
  if (new Set(slotKeys).size !== slotKeys.length) {
    throw new Error("FINCEPT_PLACEHOLDER_SLOT_BINDING_DUPLICATE");
  }
  const scopeKeys = FINCEPT_PLACEHOLDER_SLOT_BINDINGS.map(
    item => `${item.dataScopeKey}|${item.viewKey}`,
  );
  if (new Set(scopeKeys).size !== scopeKeys.length) {
    throw new Error("FINCEPT_PLACEHOLDER_SLOT_SCOPE_DUPLICATE");
  }
  for (const group of FINCEPT_PLACEHOLDER_SLOT_GROUPS) {
    const bound = FINCEPT_PLACEHOLDER_SLOT_BINDINGS.filter(
      item => item.category === group.category,
    ).map(item => item.position);
    if (bound.length !== group.positions.length ||
        bound.some(position => !group.positions.includes(position))) {
      throw new Error(`FINCEPT_PLACEHOLDER_SLOT_BINDING_MISSING:${group.category}`);
    }
  }
  return true;
}

assertFinceptCapabilityUniqueness();
