/**
 * Licensed Tonghuashun iFinD SDK surface exposed by Finance Hub.
 *
 * This is a capability catalogue, not a copied iFinD data dictionary.  The
 * desktop account remains the authority for field entitlement.  Queries are
 * executed on demand and unavailable fields are returned as unavailable; no
 * sample values are substituted.
 */

export const IFIND_DATA_CATEGORIES = [
  {
    id: "global-data",
    label: "全球数据",
    assetClass: "cross-asset",
    interfaces: ["EDB", "DataPool", "i问财"],
    description: "跨市场证券目录、经济数据库和全球数据池。",
  },
  {
    id: "bonds",
    label: "债券",
    assetClass: "bond",
    interfaces: ["实时行情", "历史行情", "基础数据", "日期序列", "估值"],
    description: "价格、收益率、票息、久期、凸性、评级、估值和成交字段。",
  },
  {
    id: "indices",
    label: "指数",
    assetClass: "index",
    interfaces: ["实时行情", "历史行情", "基础数据", "成分数据池"],
    description: "指数报价、成分、权重、成交和估值字段。",
  },
  {
    id: "funds",
    label: "基金理财",
    assetClass: "fund",
    interfaces: ["实时行情", "历史行情", "基础数据", "基金数据池"],
    description: "场内基金、ETF、净值、份额、规模、费率和持仓字段。",
  },
  {
    id: "forex",
    label: "外汇",
    assetClass: "forex",
    interfaces: ["实时行情", "高频序列", "历史行情", "日期序列"],
    description: "即期、交叉盘、买卖价、点差、成交和历史序列。",
  },
  {
    id: "futures",
    label: "期货",
    assetClass: "future",
    interfaces: ["实时行情", "高频序列", "历史行情", "基础数据"],
    description: "期货报价、持仓量、结算价、期限和主力合约字段。",
  },
  {
    id: "spot",
    label: "现货",
    assetClass: "spot",
    interfaces: ["实时行情", "历史行情", "基础数据"],
    description: "现货价格、成交、库存及关联市场字段。",
  },
  {
    id: "options",
    label: "期权",
    assetClass: "option",
    interfaces: ["实时行情", "高频序列", "历史行情", "基础数据", "估值"],
    description: "到期日、行权价、隐含波动率、Greeks、盘口和成交字段。",
  },
  {
    id: "companies",
    label: "企业",
    assetClass: "company",
    interfaces: ["基础数据", "公告研报", "事件", "i问财"],
    description: "公司资料、财务、股东、公司行动、公告、研报和事件。",
  },
  {
    id: "cn-sectors",
    label: "沪深板块指标",
    assetClass: "cn-sector",
    interfaces: ["板块数据池", "实时行情", "历史行情", "基础数据"],
    description: "沪深行业、概念、地域板块及成分指标。",
  },
  {
    id: "hk-sectors",
    label: "港股板块指标",
    assetClass: "hk-sector",
    interfaces: ["板块数据池", "实时行情", "历史行情", "基础数据"],
    description: "港股行业、主题板块及成分指标。",
  },
  {
    id: "us-sectors",
    label: "美股板块指标",
    assetClass: "us-sector",
    interfaces: ["板块数据池", "实时行情", "历史行情", "基础数据"],
    description: "美股行业、主题板块及成分指标。",
  },
  {
    id: "functions",
    label: "功能函数",
    assetClass: "function",
    interfaces: [
      "高频序列",
      "实时行情",
      "历史行情",
      "基础数据",
      "快照",
      "日期序列",
      "数据池",
      "EDB",
      "i问财",
      "研报",
      "事件",
      "代码转换",
      "实时估值",
      "最终估值",
      "交易日历",
      "行情推送",
    ],
    description: "本机 SDK 已安装的查询函数能力；执行仍受账户授权控制。",
  },
] as const;

export type IfindCategoryId = (typeof IFIND_DATA_CATEGORIES)[number]["id"];

export const IFIND_REALTIME_FIELDS = [
  "preClose",
  "open",
  "high",
  "low",
  "latest",
  "change",
  "changeRatio",
  "avgPrice",
  "amount",
  "volume",
  "turnoverRatio",
  "bid1",
  "bid2",
  "bid3",
  "bid4",
  "bid5",
  "ask1",
  "ask2",
  "ask3",
  "ask4",
  "ask5",
  "bidSize1",
  "bidSize2",
  "bidSize3",
  "bidSize4",
  "bidSize5",
  "askSize1",
  "askSize2",
  "askSize3",
  "askSize4",
  "askSize5",
  "inflow",
  "outflow",
  "openInterest",
  "settlement",
  "preSettlement",
] as const;

export const IFIND_HISTORY_FIELDS = [
  "preClose",
  "open",
  "high",
  "low",
  "close",
  "avgPrice",
  "change",
  "changeRatio",
  "volume",
  "turnoverRatio",
  "amount",
  "transactionAmount",
  "openInterest",
  "settlement",
  "preSettlement",
] as const;

export const IFIND_BASIC_INDICATORS = [
  { id: "ths_stock_short_name_stock", label: "证券简称", appliesTo: ["companies", "cn-sectors", "hk-sectors", "us-sectors"] },
  { id: "ths_stock_code_stock", label: "证券代码", appliesTo: ["companies", "cn-sectors", "hk-sectors", "us-sectors"] },
  { id: "ths_pe_stock", label: "市盈率", appliesTo: ["companies", "indices", "cn-sectors", "hk-sectors", "us-sectors"] },
  { id: "ths_pb_stock", label: "市净率", appliesTo: ["companies", "indices", "cn-sectors", "hk-sectors", "us-sectors"] },
] as const;

export const IFIND_FUNCTIONS = [
  { id: "THS_HighFrequenceSequence", mode: "high-frequency", output: "table/time-series" },
  { id: "THS_RealtimeQuotes", mode: "realtime", output: "table" },
  { id: "THS_HistoryQuotes", mode: "history", output: "table/time-series" },
  { id: "THS_BasicData", mode: "basic", output: "table" },
  { id: "THS_Snapshot", mode: "snapshot", output: "table/time-series" },
  { id: "THS_DateSequence", mode: "date-series", output: "table/time-series" },
  { id: "THS_DataPool", mode: "data-pool", output: "table" },
  { id: "THS_EDBQuery", mode: "edb", output: "table/time-series" },
  { id: "THS_iwencai", mode: "iwencai", output: "table" },
  { id: "THS_iResearch", mode: "research", output: "table/document-metadata" },
  { id: "THS_iEvent", mode: "event", output: "table" },
  { id: "THS_iTranslate", mode: "translate", output: "table/text" },
  { id: "THS_DateQuery", mode: "calendar", output: "table" },
  { id: "THS_DateOffset", mode: "calendar-offset", output: "table" },
  { id: "THS_DateCount", mode: "calendar-count", output: "table" },
  { id: "THS_toTHSCODE", mode: "code-convert", output: "table" },
  { id: "THS_realTimeValuation", mode: "realtime-valuation", output: "table" },
  { id: "THS_finalValuation", mode: "final-valuation", output: "table" },
  { id: "THS_ReportQuery", mode: "report", output: "table/document-metadata" },
  { id: "THS_QuotesPushing", mode: "push", output: "event-stream" },
] as const;

export function getIfindDataCatalog() {
  return {
    schemaVersion: "ifind-catalog-v1",
    categories: IFIND_DATA_CATEGORIES,
    fieldGroups: {
      realtime: IFIND_REALTIME_FIELDS,
      history: IFIND_HISTORY_FIELDS,
      basic: IFIND_BASIC_INDICATORS,
    },
    functions: IFIND_FUNCTIONS,
    entitlementBoundary:
      "目录表示本机 SDK 可调用能力；只有账户已授权且 SDK 实际返回的字段才标记可用。未返回字段不会用静态或合成值补齐。",
  };
}
