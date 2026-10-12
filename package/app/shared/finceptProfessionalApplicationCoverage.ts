/**
 * Coverage boundary for the professional applications that already have a
 * route in this terminal.
 *
 * This catalog is deliberately separate from the numbered ZIP slot map:
 * numbered slots describe ZIP page capabilities, while these entries describe
 * the application's own API/data contract.  A route or a tRPC procedure is
 * not treated as live market data until its source is verified.
 */
export type ProfessionalApplicationStatus =
  | "not_live"
  | "calculation_only"
  | "user_data_required"
  | "authorized_source_required";

export type FinceptProfessionalApplicationCoverage = {
  id: string;
  label: string;
  frontendPath: string;
  apiOwner: string;
  procedureIds: readonly string[];
  dataBoundary: string;
  status: ProfessionalApplicationStatus;
  liveData: boolean;
  reason: string;
};

export const FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE: readonly FinceptProfessionalApplicationCoverage[] = [
  {
    id: "portfolio-optimizer",
    label: "投资组合管理与风险",
    frontendPath: "/portfolio-optimizer",
    apiOwner: "portfolio",
    procedureIds: [
      "portfolio.getHoldings",
      "portfolio.getPerformance",
      "portfolio.getRiskMetrics",
      "portfolio.getAttributionAnalysis",
      "portfolio.getEfficientFrontier",
      "portfolio.getStressTest",
      "portfolio.getCorrelationMatrix",
      "portfolio.getVarTimeSeries",
      "portfolio.getPriceHistory",
      "portfolio.getOptimizationResult",
    ],
    dataBoundary: "账户持仓、授权行情与基准收益；不与 EQS/WEI 的公开快照混用。",
    status: "not_live",
    liveData: false,
    reason:
      "当前 portfolio 路由仍使用 SAMPLE_HOLDINGS 和 Math.random() 生成结果；它是页面/API 形状，不是可核验的实时账户数据，不能标记为已接入。",
  },
  {
    id: "pricing-risk",
    label: "定价与风险分析",
    frontendPath: "/pricing-risk",
    apiOwner: "pricing + pricingRisk",
    procedureIds: [
      "pricing.price",
      "pricing.priceOption",
      "pricing.calculateRisk",
      "pricing.getYieldCurve",
      "pricing.getVolatilitySurface",
      "pricingRisk.getUserPreference",
      "pricingRisk.updateUserPreference",
      "pricingRisk.createExport",
    ],
    dataBoundary: "用户输入、收益率曲线、波动率和授权报价；计算结果必须保留输入来源与时点。",
    status: "calculation_only",
    liveData: false,
    reason:
      "现有 API 可执行定价/风险计算和偏好存储，但不自带可验证的逐笔报价源；没有报价/曲线来源时不能把计算结果称为实时市场数据。",
  },
  {
    id: "order-management",
    label: "交易委托管理",
    frontendPath: "/order-management",
    apiOwner: "orderManagement + orderManagementResearch",
    procedureIds: [
      "orderManagement.getAIMOrders",
      "orderManagement.submitAIMOrder",
      "orderManagement.runComplianceCheck",
      "orderManagement.getTOMSOrders",
      "orderManagement.getMarketMakingQuotes",
      "orderManagement.getETFBasket",
      "orderManagement.getETFOrders",
      "orderManagement.getSystemStatus",
    ],
    dataBoundary: "用户/机构订单、经纪商连接、合规审计；不从公开行情推断订单状态。",
    status: "authorized_source_required",
    liveData: false,
    reason:
      "页面有受控 API，但真实委托、回执和经纪商状态需要账户授权与连接配置；未配置前只能显示真实空态/连接状态，不能生成模拟订单。",
  },
  {
    id: "electronic-trading",
    label: "电子交易界面",
    frontendPath: "/electronic-trading",
    apiOwner: "trading + electronicTradingResearch",
    procedureIds: [
      "trading.submitOrder",
      "trading.getRiskMetrics",
      "trading.getMarketData",
      "electronicTradingResearch.getDossier",
      "electronicTradingResearch.listBatches",
    ],
    dataBoundary: "经纪商报价、订单簿、成交回执和执行质量；不以静态卡片替代真实交易所数据。",
    status: "authorized_source_required",
    liveData: false,
    reason:
      "真实报价、订单簿和成交需要经纪商/交易所授权。当前仅保留既有受控入口和研究导入合同，未配置授权时不宣称可交易。",
  },
  {
    id: "stp-processing",
    label: "STP 直通式处理",
    frontendPath: "/stp-processing",
    apiOwner: "stp + stpPrivateResearch",
    procedureIds: [
      "stp.getTrades",
      "stp.getNetPositions",
      "stp.getSSIs",
      "stp.getSettlementStatus",
      "stp.getSettlementAnalytics",
      "stp.getRegulatoryReports",
      "stp.confirmTrade",
      "stp.bulkConfirm",
    ],
    dataBoundary: "用户导入的交易、头寸、SSI、结算和监管记录；每批次保留来源与审计。",
    status: "user_data_required",
    liveData: false,
    reason:
      "STP API 读取的是账户/机构数据。当前没有可核验的外部清算或结算连接，必须先导入或授权真实批次，不能用示例数据填充。",
  },
  {
    id: "trade-blotter",
    label: "交易账簿管理",
    frontendPath: "/trade-blotter",
    apiOwner: "tradeBlotter + tradeBookPrivateResearch",
    procedureIds: [
      "tradeBlotter.getTBGSStats",
      "tradeBlotter.getFuturesPositions",
      "tradeBlotter.getRollCalendar",
      "tradeBlotter.getBasisAnalysis",
      "tradeBlotter.getTradeBookSummary",
      "tradeBlotter.getTradeHistory",
      "tradeBlotter.getPnLAttribution",
      "tradeBlotter.getRiskExposure",
    ],
    dataBoundary: "真实成交、持仓、滚动日历、PnL 与风险暴露；不把行情快照复制成成交。",
    status: "user_data_required",
    liveData: false,
    reason:
      "交易账簿 API 已有读取合同，但真实成交和持仓来自用户/机构账簿；没有导入或授权连接时不能标记为实时账簿。",
  },
  {
    id: "industry-group",
    label: "行业分组分析",
    frontendPath: "/industry-group",
    apiOwner: "industryGroupPrivateResearch + industryGroupReference + industryGroupOfficial",
    procedureIds: [
      "industryGroupPrivateResearch.getDossier",
      "industryGroupReference.getSnapshot",
      "industryGroupOfficial.listDocuments",
    ],
    dataBoundary: "行业成分、指标时间序列与官方宏观背景；每个指标保留单位、币种、观察日和来源。",
    status: "user_data_required",
    liveData: false,
    reason:
      "行业工作台优先读取账户研究批次；官方参考仅用于周期/压力背景。尚无可直接替代账户行业序列的公开实时行业合同。",
  },
] as const;

export function getFinceptProfessionalApplicationCoverage() {
  return FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE.map(item => ({
    ...item,
    procedureIds: [...item.procedureIds],
  }));
}

export function assertFinceptProfessionalApplicationCoverageIntegrity() {
  const ids = FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE.map(item => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("FINCEPT_PROFESSIONAL_APPLICATION_DUPLICATE_ID");
  }
  if (
    FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE.some(
      item =>
        !item.frontendPath.startsWith("/") ||
        item.liveData ||
        item.procedureIds.length === 0 ||
        !item.reason.trim()
    )
  ) {
    throw new Error("FINCEPT_PROFESSIONAL_APPLICATION_UNSAFE_CLAIM");
  }
  return true;
}

assertFinceptProfessionalApplicationCoverageIntegrity();
