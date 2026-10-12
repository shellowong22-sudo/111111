import {
  INDUSTRY_GROUP_CAPABILITIES,
  PREFERRED_STOCK_CAPABILITIES,
  STOCK_CAPABILITIES,
  type TerminalCapability,
} from "./threeModuleCapabilityCatalog";
import { ECONOMIC_DATA_SCOPES, economicModuleForPath } from './economicDataScopes';

export const ADMIN_DATA_MODULE_STATUSES = [
  "managed",
  "attention",
  "restricted",
  "archived",
] as const;
export type AdminDataModuleStatus = (typeof ADMIN_DATA_MODULE_STATUSES)[number];

export type AdminDataDeliveryGroup =
  | "market_snapshot"
  | "news_review_pipeline"
  | "announcement_publication"
  | "request_time_read"
  | "simulation_control"
  | "no_server_contract";

export type AdminDataDelivery = {
  group: AdminDataDeliveryGroup;
  label: string;
  target: string;
  canRefresh: boolean;
  canSchedule: boolean;
  detail: string;
};

export type AdminDataModule = {
  id: string;
  name: string;
  path: string;
  domain:
    | "行情与市场"
    | "利率与曲线"
    | "信用与固收"
    | "衍生品"
    | "宏观与研究"
    | "新闻与研究"
    | "交易与工作流"
    | "基金与组合"
    | "系统数据";
  specialistAdminPath?: string;
  managementCapability: "专属后台" | "统一目录配置" | "来源与审核后台";
  boundary: string;
  delivery: AdminDataDelivery;
};

const delivery = (
  group: AdminDataDeliveryGroup,
  label: string,
  target: string,
  canRefresh: boolean,
  canSchedule: boolean,
  detail: string
): AdminDataDelivery => ({
  group,
  label,
  target,
  canRefresh,
  canSchedule,
  detail,
});
const market = (
  id: string,
  name: string,
  path: string,
  boundary = "站内行情记录或公开观察；不等同于可执行报价。"
): AdminDataModule => ({
  id,
  name,
  path,
  domain: "行情与市场",
  specialistAdminPath: "/admin/market-data",
  managementCapability: "专属后台",
  boundary,
  delivery: delivery(
    "market_snapshot",
    "市场快照输送",
    "既有 market_data 读取契约",
    true,
    true,
    "后台刷新显式配置标的后写入既有市场快照；原前端下次查询会读取更新记录。"
  ),
});
const rates = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "利率与曲线",
  specialistAdminPath: "/admin/data-ingestion",
  managementCapability: "来源与审核后台",
  boundary: "仅管理已保存或已许可的利率/曲线来源，不构造缺失曲线。",
  delivery: delivery(
    "request_time_read",
    "按请求来源读取",
    "原模块既有按请求读取",
    false,
    false,
    "现有读取不共用可写入后台快照，管理员可管理来源边界和模拟状态，但不会伪造自动输送。"
  ),
});
const credit = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "信用与固收",
  managementCapability: "统一目录配置",
  boundary: "后台目录状态和审计不改变原信用/固收页面的数据或授权边界。",
  delivery: delivery(
    "simulation_control",
    "模拟数据控制",
    "原模块模拟/受限数据边界",
    false,
    false,
    "可在后台显式启停模拟数据治理；未发现统一可写入的真实数据契约。"
  ),
});
const derivatives = (
  id: string,
  name: string,
  path: string
): AdminDataModule => ({
  id,
  name,
  path,
  domain: "衍生品",
  managementCapability: "统一目录配置",
  boundary: "不生成期权链、波动率曲面、估值或交易结果来填补缺失来源。",
  delivery: delivery(
    "simulation_control",
    "模拟数据控制",
    "原模块模拟/受限数据边界",
    false,
    false,
    "可在后台显式启停模拟数据治理；未发现统一可写入的真实数据契约。"
  ),
});
const research = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "宏观与研究",
  managementCapability: "统一目录配置",
  boundary:
    "仅管理站内模块登记与审计；公开证据、私有研究和授权数据保持原有边界。",
  delivery: delivery(
    "request_time_read",
    "按请求来源读取",
    "原模块既有研究读取",
    false,
    false,
    "后台可保留来源和运行状态；当前不存在统一可写入的研究内容数据槽。"
  ),
});
const news = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "新闻与研究",
  specialistAdminPath: "/admin/ai-management?tab=generate",
  managementCapability: "来源与审核后台",
  boundary: "只基于已许可 RSS/Atom 来源元数据生成待审核草稿，不自动发布。",
  delivery: delivery(
    "news_review_pipeline",
    "新闻审核输送",
    "既有 RSS 元数据 → 待审草稿 → 已发布新闻",
    true,
    true,
    "后台同步许可 RSS 后写入既有新闻队列；AI 生成只创建 draft，发布仍需审核。"
  ),
});
const workflow = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "交易与工作流",
  managementCapability: "统一目录配置",
  boundary: "后台登记不绕过原交易、风险或操作权限，也不创建交易记录。",
  delivery: delivery(
    "no_server_contract",
    "无通用数据输送契约",
    "无安全的共享写入目标",
    false,
    false,
    "后台可记录运行状态，但不能伪造或自动创建交易数据。"
  ),
});
const funds = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "基金与组合",
  managementCapability: "统一目录配置",
  boundary: "不以后台目录状态篡改基金持仓、组合或优化结果。",
  delivery: delivery(
    "simulation_control",
    "模拟数据控制",
    "原模块模拟/受限数据边界",
    false,
    false,
    "可在后台显式启停模拟数据治理；未发现统一可写入的真实数据契约。"
  ),
});
const system = (id: string, name: string, path: string): AdminDataModule => ({
  id,
  name,
  path,
  domain: "系统数据",
  managementCapability: "统一目录配置",
  boundary: "只维护后台目录状态、说明和审计；不改写原前端数据。",
  delivery: delivery(
    "no_server_contract",
    "无通用数据输送契约",
    "无安全的共享写入目标",
    false,
    false,
    "后台不写入用户设置、通知或其他系统数据。"
  ),
});
const announcement = (
  id: string,
  name: string,
  path: string
): AdminDataModule => ({
  id,
  name,
  path,
  domain: "系统数据",
  specialistAdminPath: "/admin/announcements",
  managementCapability: "来源与审核后台",
  boundary:
    "只向既有公告横幅读取表写入已审核且明确标记来源的公告；不修改前端展示逻辑。",
  delivery: delivery(
    "announcement_publication",
    "公告审核发布",
    "既有 announcements → announcement.getPublished 读取契约",
    false,
    true,
    "后台候选内容经管理员审核后写入既有 announcements 发布记录；前端沿用既有查询、排序、到期过滤与字段。"
  ),
});
const sovereign = (
  id: string,
  name: string,
  index: number,
  domain: AdminDataModule["domain"]
): AdminDataModule => ({
  id,
  name,
  path: `/terminal?open=${index}&module=sovereign-bonds`,
  domain,
  specialistAdminPath: "/admin/ai-crawler",
  managementCapability: "专属后台",
  boundary:
    "内容只进入当前主权债功能的数据槽；终端仅渲染用户可读数据，不显示管理、采集或内部映射信息。",
  delivery: delivery(
    "request_time_read",
    "主权债模块定向内容",
    `主权债第 ${index} 功能专属数据槽`,
    true,
    true,
    "后台可人工筛选并只向该功能投递；不会出现在终端全局顶部，也不会串入其他主权债功能。"
  ),
});
const creditTerminal = (
  id: string,
  name: string,
  index: number,
  domain: AdminDataModule["domain"]
): AdminDataModule => ({
  id,
  name,
  path: `/terminal?open=${index}&module=credit-bonds`,
  domain,
  specialistAdminPath: "/admin/ai-crawler",
  managementCapability: "专属后台",
  boundary:
    "内容只进入当前信用债功能的数据槽；终端仅展示面向用户的正文、数据和观察时间，不显示采集、审核或内部映射信息。",
  delivery: delivery(
    "request_time_read",
    "信用债模块定向内容",
    `信用债第 ${index} 功能专属数据槽`,
    true,
    true,
    "后台可向该功能独立投递；前端实际渲染后返回确认回执，断线重连时补收未确认版本，同一版本不会重复显示。"
  ),
});
const mortgageTerminal = (
  id: string,
  name: string,
  index: number,
  domain: AdminDataModule["domain"]
): AdminDataModule => ({
  id,
  name,
  path: `/terminal?open=${index}&module=mortgage-bonds`,
  domain,
  specialistAdminPath: "/admin/ai-crawler",
  managementCapability: "专属后台",
  boundary:
    "内容只进入当前抵押债功能的数据槽；终端只展示业务正文、观测时间与可用数据，不显示采集、审核、内部目标或系统标识。",
  delivery: delivery(
    "request_time_read",
    "抵押债模块定向内容",
    `抵押债第 ${index} 功能专属数据槽`,
    true,
    true,
    "后台可向该原入口独立投递；前端在对应页面真实渲染后返回确认回执，重连补收未确认版本，同一版本只展示一次。"
  ),
});
const moneyMarketTerminal = (
  id: string,
  name: string,
  open: string,
  index: number,
  domain: AdminDataModule["domain"]
): AdminDataModule => ({
  id,
  name,
  path: `/terminal?open=${open}&module=money-market`,
  domain,
  specialistAdminPath: "/admin/ai-crawler",
  managementCapability: "专属后台",
  boundary:
    "内容只进入当前货币市场原入口；终端仅展示业务正文、观察值、时间与可用交互，不显示采集、审核、内部目标或系统标识。",
  delivery: delivery(
    "request_time_read",
    "货币市场定向内容",
    `货币市场第 ${index} 功能独立内容流`,
    true,
    true,
    "后台按原功能代码独立投递；前端在对应原页面完成渲染后返回确认回执，断线补收未确认版本，同一内容版本只显示一次。"
  ),
});

const capabilityTerminal = (
  prefix: "stock" | "preferred-stock" | "industry-group",
  module: "stocks" | "preferred-stock" | "industry-group",
  capability: TerminalCapability,
  index: number,
  domain: AdminDataModule["domain"]
): AdminDataModule => ({
  id: `${prefix}-${capability.id.toLowerCase()}`,
  name: `${module === "stocks" ? "股市" : module === "preferred-stock" ? "优先股" : "行业分组"} ${String(index).padStart(2, "0")} · ${capability.code} ${capability.name}`,
  path: `/terminal?open=${encodeURIComponent(capability.id)}&module=${module}`,
  domain,
  specialistAdminPath: "/admin/ai-crawler",
  managementCapability: "专属后台",
  boundary:
    capability.sourceProfile === "licensed"
      ? "仅向该功能投递有明确许可、来源和时点的数据；未配置授权源时必须保持空状态。"
      : "内容只进入该功能的唯一数据槽；不得复制到同模块其他入口，也不得把推送正文冒充行情值。",
  delivery: delivery(
    "request_time_read",
    "逐功能定向内容与刷新",
    `${capability.code} 唯一数据槽`,
    true,
    true,
    "后台按唯一功能 ID 投递经清洗和指纹去重的内容；前端完成可见渲染后返回 ACK，断线后按未确认版本补收。"
  ),
});

const municipalTerminal = (
  open: string,
  index: number,
  name: string,
  domain: AdminDataModule["domain"]
): AdminDataModule => ({
  id: `muni-${open.toLowerCase()}`,
  name: `地方债 ${String(index).padStart(2, "0")} · ${open} ${name}`,
  path: `/terminal?open=${open}&module=local-bonds`,
  domain,
  specialistAdminPath: "/admin/ai-crawler",
  managementCapability: "专属后台",
  boundary:
    "仅供当前地方债入口读取；未经授权的成交、评级和指数不自动填值。独立目标不能互相复制正文。",
  delivery: delivery(
    "request_time_read",
    "地方债定向资料",
    `${open} 唯一资料记录`,
    true,
    true,
    "复用现有内容流、指纹去重与回执；前端打开对应资料记录并完成渲染后确认，不以接口返回代替接收。"
  ),
});

export const ADMIN_DATA_MODULES: AdminDataModule[] = [
  municipalTerminal("1", 1, "证券设定", "系统数据"),
  municipalTerminal("MSRC", 2, "地方债检索", "信用与固收"),
  municipalTerminal("SMUN", 3, "发行人分析", "宏观与研究"),
  municipalTerminal("AAA", 4, "期限曲线", "利率与曲线"),
  municipalTerminal("BTMM", 5, "短端融资", "利率与曲线"),
  municipalTerminal("PICK", 6, "发行计划", "交易与工作流"),
  municipalTerminal("MBWD", 7, "询价比较", "交易与工作流"),
  municipalTerminal("CDRN", 8, "商议承销", "交易与工作流"),
  municipalTerminal("CDRC", 9, "竞价承销", "交易与工作流"),
  municipalTerminal("CDRA", 10, "固定利率日历", "交易与工作流"),
  municipalTerminal("CNDS", 11, "短期日程", "交易与工作流"),
  municipalTerminal("CDRV", 12, "浮息日历", "交易与工作流"),
  municipalTerminal("DEAL", 13, "交收记录", "交易与工作流"),
  municipalTerminal("CACT", 14, "发行人事件", "新闻与研究"),
  municipalTerminal("MCAL", 15, "结构现金流", "交易与工作流"),
  municipalTerminal("MBIX", 16, "组合归因", "基金与组合"),
  municipalTerminal("VRDN", 17, "回售备付", "利率与曲线"),
  municipalTerminal("BMA", 18, "税收等价", "衍生品"),
  municipalTerminal("BOOM", 19, "库存融资", "交易与工作流"),
  municipalTerminal("MSRB", 20, "成交统计", "行情与市场"),
  municipalTerminal("SLGS", 21, "财政部活动", "利率与曲线"),
  ...STOCK_CAPABILITIES.map((capability, index) =>
    capabilityTerminal("stock", "stocks", capability, index + 1, "行情与市场")
  ),
  ...PREFERRED_STOCK_CAPABILITIES.map((capability, index) =>
    capabilityTerminal("preferred-stock", "preferred-stock", capability, index + 1, "信用与固收")
  ),
  ...INDUSTRY_GROUP_CAPABILITIES.map((capability, index) =>
    capabilityTerminal("industry-group", "industry-group", capability, index + 1, "宏观与研究")
  ),
  market("market", "市场数据", "/market"),
  market("equity-market", "股票市场", "/equity-market"),
  market("commodity-market", "COMM · 商品目录", "/menu-item/COMM"),
  market("crypto-market", "加密资产市场", "/crypto-market"),
  market("real-estate", "房地产趋势", "/real-estate"),
  market("energy-market", "能源市场", "/energy-market"),
  market("precious-metals", "贵金属", "/precious-metals"),
  market("global-commodity-prices", "全球大宗商品价格", "/commodity-prices"),
  market("bico", "彭博商品指数", "/bico"),
  market("market-manage", "市场管理工作台", "/market-manage"),
  market("index-hub", "WEI · 全球股票指数", "/index-hub?panel=WEI"),
  market("forex-hub", "外汇中心", "/forex-hub"),
  market("secondary-markets", "二级市场", "/secondary-markets"),
  market("industry-analysis", "行业分析", "/industry-analysis"),
  market("sector-analysis", "行业板块分析", "/sector-analysis"),
  market("asset-allocation", "资产配置", "/asset-allocation"),
  rates("curve-search", "曲线搜索", "/curve-search"),
  rates("yield-curve", "收益率曲线", "/yield-curve"),
  rates("bond-market", "债券市场数据", "/bond-market"),
  rates("interest-rates", "全球利率", "/interest-rates"),
  rates("rate-trader", "利率交易员", "/rate-trader"),
  rates("rate-trader-by-term", "期限利率交易", "/rate-trader-by-term"),
  rates("multi-term-dashboard", "多期限仪表盘", "/multi-term-dashboard"),
  rates("spread-drop", "利差与下跌", "/spread-drop"),
  rates("g7-curves", "G7 曲线", "/g7-curves"),
  rates("regional-curves", "区域曲线", "/regional-curves"),
  rates("forex-curves", "外汇曲线", "/forex-curves"),
  rates("bond-trader", "债券交易员", "/bond-trader"),
  rates("curves-list", "曲线列表", "/curves-list"),
  rates("curve-detail", "曲线详情", "/curve-detail/demo"),
  rates("curves-compare", "曲线比较", "/curves-compare"),
  credit("fixed-income", "固定收益分析", "/fixed-income"),
  credit("credit-analysis", "信用分析", "/credit-analysis"),
  credit("credit-ratings", "信用评级", "/credit-ratings"),
  credit("fixed-income-trade", "固定收益交易", "/fixed-income-trade"),
  credit("cds-valuation", "CDS 估值", "/cdsw"),
  credit("global-cds", "全球 CDS", "/global-cds"),
  credit("global-cds-category", "全球 CDS 分类", "/_global-cds"),
  credit("global-cds-market", "全球 CDS 市场", "/wcds"),
  credit("convertible-bonds", "可转换债券", "/ovcv"),
  credit(
    "convertible-bonds-category",
    "可转换债券分类",
    "/_convertible-bonds-category"
  ),
  credit("bond-futures", "债券期货", "/bond-futures"),
  credit("global-bond-futures", "全球债券期货", "/wbf"),
  credit("credit-monitor", "信用监控", "/credit-monitor"),
  credit("bond-portfolio", "债券组合", "/bond-trader"),
  derivatives("derivatives-trader", "衍生品交易员", "/derivatives-trader"),
  derivatives("derivatives-base", "衍生品基础", "/_derivatives-base"),
  derivatives(
    "derivatives-enhanced",
    "衍生品增强分析",
    "/_derivatives-enhanced"
  ),
  derivatives("derivatives-news", "衍生品新闻分类", "/_derivatives-news"),
  derivatives(
    "derivatives-research",
    "衍生品研究分类",
    "/_derivatives-research"
  ),
  derivatives("credit-derivatives", "信用衍生品分类", "/_credit-derivatives"),
  derivatives("swpm", "掉期管理", "/swpm"),
  derivatives("wbf-ai", "债券期货智能分析", "/wbf-ai"),
  derivatives("ovme", "期权定价", "/ovme"),
  derivatives("moso", "活跃期权", "/moso"),
  derivatives("nceo", "佑诚期权 · NCEO", "/terminal?module=derivatives&open=nceo"),
  derivatives("fom", "期货期权监控", "/fom"),
  derivatives("ovml", "外汇与商品期权", "/ovml"),
  derivatives("wvol", "外汇波动率", "/wvol"),
  derivatives("glco", "全球商品期权", "/glco"),
  derivatives("dlib", "衍生品库", "/dlib"),
  derivatives("vca", "波动率分析", "/vca"),
  derivatives("mars", "多资产风险", "/mars"),
  derivatives("ni-drv", "衍生品新闻", "/ni-drv"),
  derivatives("deri", "衍生品高级分析", "/deri"),
  derivatives("commodity-derivatives", "商品衍生品", "/commodity-derivatives"),
  derivatives("commodity-futures", "商品期货", "/commodity-futures"),
  derivatives("equity-derivatives", "股票衍生品", "/_equity-derivatives"),
  derivatives("fx-derivatives", "外汇衍生品", "/_fx-derivatives"),
  derivatives("index-derivatives", "指数衍生品", "/_index-derivatives"),
  derivatives("index-futures", "指数期货", "/_index-futures"),
  derivatives("index-options", "指数期权", "/_index-options"),
  derivatives(
    "rate-inflation-derivatives",
    "利率与通胀衍生品",
    "/_rate-inflation-derivatives"
  ),
  research("macro-dashboard", "宏观经济仪表盘", "/macro-dashboard"),
  research("financial-analysis", "财务分析", "/financial-analysis"),
  research("model-predictions", "模型预测", "/model-predictions"),
  research("econ-hub", "经济数据中心", "/econ-hub"),
  ...ECONOMIC_DATA_SCOPES.map(([tab, name]) => research(`economic-${tab}`, `${tab.toUpperCase()} · ${name}`, `/econ-hub?tab=${tab}`)),
  research("bquant", "量化分析", "/bquant"),
  research("bmap", "BMAP 分析映射", "/bmap"),
  research("allq", "分析查询", "/allq"),
  research("bsrch", "债券研究", "/bsrch"),
  research("bvol", "债券波动率", "/bvol"),
  research("portfolio-optimizer", "组合优化", "/portfolio-optimizer"),
  research("risk-management", "风险管理", "/risk-management"),
  research("pricing-risk", "定价与风险", "/pricing-risk"),
  research("pricing-and-risk", "定价与风险分类", "/_pricing-and-risk"),
  news("news-hub", "新闻与研究中心", "/news-hub"),
  news("news-top", "TOP · 要闻精选", "/menu-item/TOP"),
  news("news-btdy", "BTDY · Bloomberg Today", "/menu-item/BTDY"),
  news("news-frnt", "FRNT · 首页", "/menu-item/FRNT"),
  news("news-cn", "CN · 公司新闻", "/menu-item/CN"),
  news("news-read", "READ · 最热门报道", "/menu-item/READ"),
  news("news-ni", "NI · 新闻主题", "/menu-item/NI"),
  news("news-nh", "NH · 滚动新闻", "/menu-item/NH"),
  news("news-firs", "FIRS · 彭博率先报道", "/menu-item/FIRS"),
  news("news-bi", "BI · 彭博行业研究", "/menu-item/BI"),
  news("news-beco", "BECO · 彭博经浏", "/menu-item/BECO"),
  news("news-dayb", "DAYB · 彭博早间新闻", "/menu-item/DAYB"),
  news("news-mag", "MAG · 彭博杂志", "/menu-item/MAG"),
  news("news-mdia", "多媒体", "/news-hub?tab=media"),
  news("news-medi", "MEDI · 彭博媒体", "/menu-item/MEDI"),
  news("news-third", "第三方优质新闻", "/news-hub?tab=third"),
  news("news-intl", "非英语新闻", "/news-hub?tab=intl"),
  news("news-cmnt", "评论与分析", "/news-hub?tab=commentary"),
  news("news-opin", "OPIN · 彭博观点", "/menu-item/OPIN"),
  news("news-bnef", "BNEF · 新能源财经研究", "/menu-item/BNEF"),
  news("news-pers", "个性化新闻", "/news-hub?tab=personal"),
  news("news-myn", "MYN · 我的新闻", "/menu-item/MYN"),
  news("news-nlrt", "NLRT · 新闻检索与提醒", "/menu-item/NLRT"),
  news("news-nsub", "NSUB · 新闻订阅", "/menu-item/NSUB"),
  news("news-mrep", "MREP · Morning Report", "/menu-item/MREP"),
  news("news-nzpd", "NZPD · 新闻设定", "/menu-item/NZPD"),
  news("news-socl", "社交媒体与分析", "/news-hub?tab=social"),
  news("news-soci", "SOCI · 社交监测", "/menu-item/SOCI"),
  news("news-tren", "TREN · 新闻趋势", "/menu-item/TREN"),
  news("news-docs", "文件与资料", "/news-hub?tab=docs"),
  workflow("electronic-trading", "电子交易", "/electronic-trading"),
  workflow("trade-book", "交易账簿", "/trade-book"),
  workflow("stp-processing", "STP 处理", "/stp-processing"),
  workflow("order-management", "订单管理", "/order-management"),
  workflow("trade-blotter", "交易流水", "/trade-blotter"),
  workflow("trading-ledger", "交易台账", "/trading-ledger"),
  workflow("comms-hub", "通讯与社区", "/comms-hub"),
  workflow("issuance", "发行日历", "/bond-trader"),
  funds("etf-detail", "ETF 详情", "/etf-detail/demo"),
  funds("etf-holdings", "ETF 持仓", "/etf-holdings-admin"),
  funds("fund-browse", "基金浏览", "/fund-browse"),
  funds("fund-holdings", "基金持仓", "/fund-holdings"),
  funds("fund-compare", "基金比较", "/fund-compare"),
  funds("portfolio", "投资组合", "/portfolio-optimizer"),
  sovereign("sov-01-info", "主权债 01 · 证券设定与字段说明", 1, "系统数据"),
  sovereign("sov-02-secf", "主权债 02 · 证券查找", 2, "信用与固收"),
  sovereign("sov-03-market", "主权债 03 · 当前市场", 3, "行情与市场"),
  sovereign("sov-04-wb", "主权债 04 · 全球债券市场", 4, "利率与曲线"),
  sovereign("sov-05-fit", "主权债 05 · 固定收益交易", 5, "交易与工作流"),
  sovereign("sov-06-btmm", "主权债 06 · 国债与货币市场", 6, "利率与曲线"),
  sovereign("sov-07-gcds", "主权债 07 · 全球 CDS 图表", 7, "信用与固收"),
  sovereign("sov-08-coun", "主权债 08 · 国家指南", 8, "宏观与研究"),
  sovereign("sov-09-mipr", "主权债 09 · 市场隐含政策利率", 9, "利率与曲线"),
  sovereign("sov-10-debt", "主权债 10 · 所有权与持有人", 10, "宏观与研究"),
  sovereign("sov-11-srsk", "主权债 11 · 信用风险", 11, "信用与固收"),
  sovereign("sov-12-gmm", "主权债 12 · 全球宏观驱动", 12, "宏观与研究"),
  sovereign("sov-13-ycurve", "主权债 13 · 收益曲线", 13, "利率与曲线"),
  sovereign("sov-14-gc", "主权债 14 · 曲线绘制", 14, "利率与曲线"),
  sovereign("sov-15-ct10", "主权债 15 · CT10 联动分析", 15, "利率与曲线"),
  sovereign("sov-16-des", "主权债 16 · 证券简介", 16, "信用与固收"),
  sovereign("sov-17-yas", "主权债 17 · 收益率与利差", 17, "利率与曲线"),
  sovereign("sov-18-topbon", "主权债 18 · 债券新闻", 18, "新闻与研究"),
  sovereign("sov-19-calc", "主权债 19 · 计算器与分析", 19, "宏观与研究"),
  sovereign("sov-20-price", "主权债 20 · 定价", 20, "信用与固收"),
  sovereign("sov-21-imgr", "主权债 21 · 库存与价格", 21, "交易与工作流"),
  sovereign("sov-22-runz", "主权债 22 · Runs 管理", 22, "交易与工作流"),
  sovereign("sov-23-nim", "主权债 23 · 新发行与评级事件", 23, "信用与固收"),
  sovereign("sov-24-ir", "主权债 24 · 利率与通胀衍生品", 24, "衍生品"),
  creditTerminal("credit-01-info", "信用债 01 · 证券与功能说明", 1, "系统数据"),
  creditTerminal("credit-02-market", "信用债 02 · 当前市场", 2, "行情与市场"),
  creditTerminal(
    "credit-03-global",
    "信用债 03 · 全球债券市场",
    3,
    "行情与市场"
  ),
  creditTerminal(
    "credit-04-btmm",
    "信用债 04 · 国债与货币市场",
    4,
    "利率与曲线"
  ),
  creditTerminal(
    "credit-05-gcds",
    "信用债 05 · 全球 CDS 图表",
    5,
    "信用与固收"
  ),
  creditTerminal("credit-06-ycurve", "信用债 06 · 收益曲线", 6, "利率与曲线"),
  creditTerminal("credit-07-gc", "信用债 07 · 绘制曲线图", 7, "利率与曲线"),
  creditTerminal(
    "credit-08-news",
    "信用债 08 · 新闻与研究报告",
    8,
    "新闻与研究"
  ),
  creditTerminal("credit-09-calc", "信用债 09 · 计算器与分析", 9, "宏观与研究"),
  creditTerminal("credit-10-in", "信用债 10 · 信债浏览器", 10, "信用与固收"),
  creditTerminal(
    "credit-11-wbix",
    "信用债 11 · 全球债券指数",
    11,
    "信用与固收"
  ),
  creditTerminal("credit-12-ins", "信用债 12 · 指数检索", 12, "信用与固收"),
  creditTerminal(
    "credit-13-issuer",
    "信用债 13 · 发行人分析",
    13,
    "信用与固收"
  ),
  creditTerminal("credit-14-des", "信用债 14 · 证券简介", 14, "信用与固收"),
  creditTerminal(
    "credit-15-yas",
    "信用债 15 · 收益率与利差分析",
    15,
    "利率与曲线"
  ),
  creditTerminal("credit-16-price", "信用债 16 · 定价", 16, "信用与固收"),
  creditTerminal(
    "credit-17-imgr",
    "信用债 17 · 库存与价格",
    17,
    "交易与工作流"
  ),
  creditTerminal("credit-18-runz", "信用债 18 · Runs 管理", 18, "交易与工作流"),
  creditTerminal(
    "credit-19-trace",
    "信用债 19 · TRACE 活动",
    19,
    "交易与工作流"
  ),
  creditTerminal(
    "credit-20-events",
    "信用债 20 · 新发行、公司大事与评级",
    20,
    "新闻与研究"
  ),
  creditTerminal(
    "credit-21-derivatives",
    "信用债 21 · 信用衍生产品",
    21,
    "衍生品"
  ),
  creditTerminal(
    "credit-22-analysis",
    "信用债 22 · 信用分析",
    22,
    "信用与固收"
  ),
  creditTerminal(
    "credit-23-fiw",
    "信用债 23 · 固定收益工作表",
    23,
    "宏观与研究"
  ),
  creditTerminal(
    "credit-24-cran",
    "信用债 24 · 信用研究分析",
    24,
    "宏观与研究"
  ),
  creditTerminal("credit-25-loan", "信用债 25 · 贷款", 25, "信用与固收"),
  creditTerminal(
    "credit-26-crmx",
    "信用债 26 · BMS 保险系统",
    26,
    "信用与固收"
  ),
  mortgageTerminal(
    "mortgage-01-info",
    "抵押债 01 · 证券与功能说明",
    1,
    "系统数据"
  ),
  mortgageTerminal("mortgage-02-secf", "抵押债 02 · 证券查找", 2, "信用与固收"),
  mortgageTerminal(
    "mortgage-03-mtgs",
    "抵押债 03 · 抵押债检索",
    3,
    "信用与固收"
  ),
  mortgageTerminal(
    "mortgage-04-mtgh",
    "抵押债 04 · 功能说明屏幕",
    4,
    "宏观与研究"
  ),
  mortgageTerminal(
    "mortgage-05-new",
    "抵押债 05 · 新发行及发售",
    5,
    "交易与工作流"
  ),
  mortgageTerminal(
    "mortgage-06-mcal",
    "抵押债 06 · 结构金融日历",
    6,
    "新闻与研究"
  ),
  mortgageTerminal(
    "mortgage-07-imgr",
    "抵押债 07 · 库存与价格",
    7,
    "交易与工作流"
  ),
  mortgageTerminal(
    "mortgage-08-stsh",
    "抵押债 08 · 结构化工具",
    8,
    "宏观与研究"
  ),
  mortgageTerminal(
    "mortgage-09-market",
    "抵押债 09 · 当前市场",
    9,
    "行情与市场"
  ),
  mortgageTerminal(
    "mortgage-10-tbpf",
    "抵押债 10 · TBA 表现",
    10,
    "行情与市场"
  ),
  mortgageTerminal(
    "mortgage-11-collateral",
    "抵押债 11 · 评级及抵押品趋势",
    11,
    "信用与固收"
  ),
  mortgageTerminal(
    "mortgage-12-bmmi",
    "抵押债 12 · 市场洞察",
    12,
    "宏观与研究"
  ),
  mortgageTerminal(
    "mortgage-13-research",
    "抵押债 13 · 新闻与研究报告",
    13,
    "新闻与研究"
  ),
  mortgageTerminal(
    "mortgage-14-firs",
    "抵押债 14 · 原始披露导航",
    14,
    "新闻与研究"
  ),
  mortgageTerminal(
    "mortgage-15-ni",
    "抵押债 15 · 结构融资管道",
    15,
    "交易与工作流"
  ),
  mortgageTerminal(
    "mortgage-16-gn455993",
    "抵押债 16 · GN 455993 分析",
    16,
    "信用与固收"
  ),
  mortgageTerminal("mortgage-17-des", "抵押债 17 · 证券简介", 17, "信用与固收"),
  mortgageTerminal("mortgage-18-yt", "抵押债 18 · 收益率表", 18, "利率与曲线"),
  mortgageTerminal(
    "mortgage-19-fibc",
    "抵押债 19 · 债券计算器",
    19,
    "宏观与研究"
  ),
  mortgageTerminal("mortgage-20-q", "抵押债 20 · 市场报价", 20, "行情与市场"),
  mortgageTerminal(
    "mortgage-21-cmap",
    "抵押债 21 · CMBS 地图",
    21,
    "宏观与研究"
  ),
  mortgageTerminal(
    "mortgage-22-index",
    "抵押债 22 · 抵押债指数",
    22,
    "信用与固收"
  ),
  mortgageTerminal(
    "mortgage-23-mccn",
    "抵押债 23 · TBA 实时监测",
    23,
    "行情与市场"
  ),
  mortgageTerminal(
    "mortgage-24-assets",
    "抵押债 24 · 资产类别",
    24,
    "信用与固收"
  ),
  mortgageTerminal(
    "mortgage-25-rmbs-cmbs",
    "抵押债 25 · 美国民用及商用",
    25,
    "宏观与研究"
  ),
  mortgageTerminal(
    "mortgage-26-volume",
    "抵押债 26 · 成交量与表现",
    26,
    "交易与工作流"
  ),
  moneyMarketTerminal(
    "mm-01-des",
    "货币市场 01 · DES 证券与功能说明",
    "des-mm",
    1,
    "系统数据"
  ),
  moneyMarketTerminal(
    "mm-02-pgm",
    "货币市场 02 · PGM 项目列表",
    "pgm",
    2,
    "交易与工作流"
  ),
  moneyMarketTerminal(
    "mm-03-mktbeat",
    "货币市场 03 · MKTBEAT 当前市场",
    "mktbeat",
    3,
    "行情与市场"
  ),
  moneyMarketTerminal(
    "mm-04-btmm",
    "货币市场 04 · BTMM 国债与货币市场",
    "btmm",
    4,
    "利率与曲线"
  ),
  moneyMarketTerminal(
    "mm-05-boom",
    "货币市场 05 · BOOM 货币市场发售",
    "boom",
    5,
    "交易与工作流"
  ),
  moneyMarketTerminal(
    "mm-06-tcon",
    "货币市场 06 · TCON 国债控制面板",
    "tcon",
    6,
    "利率与曲线"
  ),
  moneyMarketTerminal(
    "mm-07-rv",
    "货币市场 07 · RV 相对价值套利引擎",
    "rv",
    7,
    "宏观与研究"
  ),
  moneyMarketTerminal(
    "mm-08-ycqsim",
    "货币市场 08 · YCQSIM 收益曲线量子模拟",
    "ycqsim",
    8,
    "衍生品"
  ),
  moneyMarketTerminal(
    "mm-09-gc",
    "货币市场 09 · GC 绘制曲线图",
    "gc",
    9,
    "利率与曲线"
  ),
  moneyMarketTerminal(
    "mm-10-crvf-mmkt",
    "货币市场 10 · CRVF MMKT 查找曲线",
    "crvf-mmkt",
    10,
    "利率与曲线"
  ),
  moneyMarketTerminal(
    "mm-11-crvf",
    "货币市场 11 · CRVF 查找曲线",
    "crvf",
    11,
    "利率与曲线"
  ),
  moneyMarketTerminal(
    "mm-12-fibc",
    "货币市场 12 · FIBC 债券计算器",
    "fibc",
    12,
    "宏观与研究"
  ),
  moneyMarketTerminal(
    "mm-13-cdie",
    "货币市场 13 · CDIE 预测 CDI 对实际 DI 期货",
    "cdie",
    13,
    "衍生品"
  ),
  moneyMarketTerminal(
    "mm-14-efsf",
    "货币市场 14 · EFSF 分析 EMTN M-Mkt",
    "efsf",
    14,
    "信用与固收"
  ),
  moneyMarketTerminal(
    "mm-15-mmidx",
    "货币市场 15 · MMIDX 货币市场指数",
    "mmidx",
    15,
    "行情与市场"
  ),
  moneyMarketTerminal(
    "mm-16-etrade",
    "货币市场 16 · ETRADE 定价、写单、电子交易",
    "etrade",
    16,
    "交易与工作流"
  ),
  moneyMarketTerminal(
    "mm-17-edsf",
    "货币市场 17 · EDSF ED 合成 FRA",
    "edsf",
    17,
    "衍生品"
  ),
  moneyMarketTerminal(
    "mm-18-wbf",
    "货币市场 18 · WBF 全球债券期货",
    "wbf",
    18,
    "衍生品"
  ),
  moneyMarketTerminal(
    "mm-19-pboc",
    "货币市场 19 · PBOC 中国人民银行",
    "pboc",
    19,
    "宏观与研究"
  ),
  moneyMarketTerminal(
    "mm-20-twdi",
    "货币市场 20 · TWDI 台北金融业拆款定盘利率",
    "twdi",
    20,
    "行情与市场"
  ),
  moneyMarketTerminal(
    "mm-21-cenb",
    "货币市场 21 · CENB 央行查找",
    "cenb",
    21,
    "宏观与研究"
  ),
  moneyMarketTerminal(
    "mm-22-news",
    "货币市场 22 · NEWS 新闻与研究报告",
    "news-mm",
    22,
    "新闻与研究"
  ),
  moneyMarketTerminal(
    "mm-23-source",
    "货币市场 23 · SOURCE 资料时效监控",
    "source-mm",
    23,
    "系统数据"
  ),
  moneyMarketTerminal(
    "mm-24-mmflow",
    "货币市场 24 · MMFLOW 研究交付",
    "mmflow",
    24,
    "交易与工作流"
  ),
  system("terminal", "主终端", "/terminal"),
  system("workspace", "个人工作区", "/workspace"),
  system("notifications", "通知中心", "/notifications"),
  system("market-search", "市场搜索结果", "/search-results"),
  system("help", "帮助中心", "/help"),
  system("settings", "用户设置", "/settings"),
  system("export-verification", "导出签名验证", "/verify-export"),
  system("latest-features", "最新功能", "/_latest"),
  system("component-showcase", "组件展示", "/_showcase"),
  system("files", "文件与资料", "/_files"),
  announcement("announcement-banner", "全局公告横幅", "/"),
];

export const ADMIN_DATA_MODULE_IDS = ADMIN_DATA_MODULES.map(
  module => module.id
) as [string, ...string[]];

/**
 * Convert collection taxonomy text into concrete existing frontend targets.
 * This is only a recommendation for manual selection and never delivers data.
 */
export function recommendAdminDataModuleIdsForType(type: string) {
  const value = type.trim();
  if (/抵押债|按揭|MBS|TBA|CMBS|RMBS/i.test(value)) {
    return [
      "mortgage-09-market",
      "mortgage-10-tbpf",
      "mortgage-11-collateral",
      "mortgage-13-research",
      "mortgage-21-cmap",
      "mortgage-23-mccn",
    ];
  }
  if (/信用|CDS|评级|违约|利差/.test(value)) {
    return [
      "credit-analysis",
      "credit-ratings",
      "global-cds",
      "sov-07-gcds",
      "sov-11-srsk",
    ];
  }
  if (
    /货币市场.*(?:拍卖|国库券|发行)|(?:拍卖|国库券|发行).*货币市场/.test(value)
  ) {
    return ["mm-04-btmm", "mm-05-boom", "mm-06-tcon", "mm-23-source"];
  }
  if (
    /SOFRAI|SOFR|EFFR|OBFR|TGCR|BGCR|参考利率|成交分布|隔夜资金基准/i.test(
      value
    )
  ) {
    return ["mm-03-mktbeat", "mm-15-mmidx", "mm-23-source"];
  }
  if (/商业票据|commercial paper/i.test(value)) {
    return ["mm-05-boom", "mm-15-mmidx", "mm-23-source"];
  }
  if (/政策走廊|准备金|逆回购|央行工具|操作利率/i.test(value)) {
    return [
      "mm-04-btmm",
      "mm-06-tcon",
      "mm-21-cenb",
      "mm-22-news",
      "mm-23-source",
    ];
  }
  if (/货币市场.*(?:曲线|期限结构)|(?:曲线|期限结构).*货币市场/i.test(value)) {
    return ["mm-09-gc", "mm-10-crvf-mmkt", "mm-11-crvf", "mm-23-source"];
  }
  if (
    /货币市场|SOFR|EFFR|OBFR|隔夜融资|隔夜拆款|商业票据|政策走廊|准备金|逆回购|短端基准/i.test(
      value
    )
  ) {
    return ["mm-03-mktbeat", "mm-15-mmidx", "mm-23-source"];
  }
  if (/国债|主权债|债券|利率|收益率|曲线|拍卖|财政融资|发行/.test(value)) {
    return [
      "bond-market",
      "interest-rates",
      "yield-curve",
      "sov-03-market",
      "sov-04-wb",
      "sov-13-ycurve",
      "sov-23-nim",
    ];
  }
  if (/新闻|资讯|监管|公告|披露|研报/.test(value)) {
    return ["news-top", "news-hub", "news-ni", "sov-18-topbon"];
  }
  if (/央行|宏观|统计|政策|经济|通胀|就业|贸易/.test(value)) {
    return [
      "news-top",
      "macro-dashboard",
      "econ-hub",
      "sov-06-btmm",
      "sov-09-mipr",
      "sov-12-gmm",
    ];
  }
  if (/交易所|标的|股票|上市公司|证券/.test(value)) {
    return ["equity-market", "market", "market-search"];
  }
  if (/量化|工具|论文|模型|回测|计算器|SDK/.test(value)) {
    return [
      "bquant",
      "portfolio-optimizer",
      "pricing-risk",
      "sov-19-calc",
      "sov-20-price",
    ];
  }
  if (/期货|期权|互换|衍生品|波动率/.test(value)) {
    return ["derivatives-trader", "bond-futures", "swpm", "ovme", "sov-24-ir"];
  }
  if (/资金|持仓|龙虎榜|大宗交易|做空/.test(value)) {
    return [
      "market",
      "equity-market",
      "bond-portfolio",
      "sov-10-debt",
      "sov-15-ct10",
    ];
  }
  return ["market", "news-hub"];
}

const NEWS_HUB_TAB_MODULE_IDS: Record<string, string> = {
  top: "news-top",
  btdy: "news-btdy",
  frnt: "news-frnt",
  cn: "news-cn",
  read: "news-read",
  ni: "news-ni",
  nh: "news-nh",
  firs: "news-firs",
  bi: "news-bi",
  beco: "news-beco",
  dayb: "news-dayb",
  mag: "news-mag",
  media: "news-mdia",
  medi: "news-medi",
  third: "news-third",
  intl: "news-intl",
  commentary: "news-cmnt",
  opin: "news-opin",
  bnef: "news-bnef",
  personal: "news-pers",
  myn: "news-myn",
  nlrt: "news-nlrt",
  nsub: "news-nsub",
  mrep: "news-mrep",
  nzpd: "news-nzpd",
  social: "news-socl",
  soci: "news-soci",
  tren: "news-tren",
  docs: "news-docs",
};

/** Resolve the exact existing frontend functions represented by a public route. */
export function resolveAdminDataModulesForPath(inputPath: string) {
  let path = inputPath.trim() || "/";
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    } catch {
      path = "/";
    }
  }
  const [pathnameRaw, query = ""] = path.split("?");
  const pathname = pathnameRaw || "/";
  const requestedParams = new URLSearchParams(query);
  const economicModuleId = economicModuleForPath(pathname, requestedParams);
  if (economicModuleId !== undefined) {
    return ADMIN_DATA_MODULES.filter(module => module.id === economicModuleId);
  }
  const matched = new Map<string, AdminDataModule>();

  for (const module of ADMIN_DATA_MODULES) {
    const [modulePathname, moduleQuery = ""] = module.path.split("?");
    const dynamicDemoMatch =
      modulePathname.includes("/demo") &&
      pathname.startsWith(modulePathname.replace("/demo", "/"));
    if (modulePathname !== pathname && !dynamicDemoMatch) continue;
    if (moduleQuery) {
      const moduleParams = new URLSearchParams(moduleQuery);
      const queryMatches = [...moduleParams.entries()].every(
        ([key, value]) => requestedParams.get(key) === value
      );
      if (!queryMatches) continue;
    }
    matched.set(module.id, module);
  }

  if (pathname === "/news-hub") {
    const tabModuleId =
      NEWS_HUB_TAB_MODULE_IDS[(requestedParams.get("tab") ?? "").toLowerCase()];
    const tabModule = tabModuleId
      ? ADMIN_DATA_MODULES.find(module => module.id === tabModuleId)
      : undefined;
    // A tab is a separate delivery destination, not a view of the hub feed.
    // Never broadcast the hub's historic payload into all 29 workspaces.
    if (requestedParams.has("tab")) return tabModule ? [tabModule] : [];
  }
  // A child terminal route owns one feed namespace. Never merge the generic
  // terminal feed or a sibling module feed into a function-level workspace.
  const terminalPrefixByModule: Record<string, string> = {
    "local-bonds": "muni-",
    stocks: "stock-",
    "preferred-stock": "preferred-stock-",
    "industry-group": "industry-group-",
  };
  const terminalPrefix = pathname === "/terminal"
    ? terminalPrefixByModule[requestedParams.get("module") ?? ""]
    : undefined;
  if (terminalPrefix)
    return [...matched.values()].filter(module =>
      module.id.startsWith(terminalPrefix)
    );
  return [...matched.values()];
}
