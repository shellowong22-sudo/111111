import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  router,
} from "../_core/trpc";
import { publishMunicipalOfficial } from "../municipalOfficialDelivery";
import {
  deleteMunicipalResearchViewPreset,
  exportMunicipalResearchViewPresets,
  importMunicipalResearchViewPresets,
  listMunicipalResearchViewPresets,
  markMunicipalResearchViewPresetUsed,
  MUNICIPAL_RESEARCH_MODULE_IDS,
  saveMunicipalResearchViewPreset,
  setMunicipalResearchViewPresetDefault,
} from "../municipalResearchPresetDb";
import { z } from "zod";
import {
  getIssuerFundamentals,
  getMunicipalReference,
  ISSUER_TERRITORIES,
} from "../municipalWorkbenchData";
import {
  calculateMunicipalTool,
  MUNICIPAL_TOOLS,
  type MunicipalToolId,
} from "../../shared/municipalWorkbench";
import {
  getStockDisclosureCompanyFacts,
  getStockDisclosureIssuerFilings,
  getStockDisclosureIssuers,
} from "./stockMarketResearch";
import { fetchMultipleFred } from "../realDataService";

const SLGS_SECURITIES_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/slgs_securities";
const SLGS_DEMAND_RATES_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/slgs_demand_deposit_rates";
const SLGS_TIME_RATES_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/slgs_time_deposit_rates";

const normalizeDisclosureCik = (value: string | number) =>
  String(value).replace(/\D/g, "").padStart(10, "0").slice(-10);

type RawSlgsSecurity = Record<string, string | null | undefined>;
export type SlgsDurationBucket = {
  id: string;
  label: string;
  issuedAmount: number | null;
  issuedCount: number | null;
  outstandingAmount: number | null;
  outstandingCount: number | null;
};
export type SlgsDailyActivity = {
  recordDate: string;
  newSubscriptionsAmount: number | null;
  newSubscriptionsCount: number | null;
  cancelledSubscriptionsAmount: number | null;
  cancelledSubscriptionsCount: number | null;
  demandDepositRedemptionsAmount: number | null;
  timeDepositRedemptionsAmount: number | null;
  buckets: SlgsDurationBucket[];
};
type RawSlgsDemandRate = Record<string, string | null | undefined>;
type RawSlgsTimeRate = Record<string, string | null | undefined>;
export type SlgsDemandRate = {
  recordDate: string;
  annualizedEffectiveRate: number;
  dailyFactor: number;
};
export type SlgsTimeRate = {
  recordDate: string;
  from: string;
  through: string;
  monthsFrom: number;
  monthsThrough: number | null;
  rate: number;
};

const BUCKETS = [
  {
    id: "0-3m",
    label: "0–3M",
    issuedAmount: "issues_0_3_mos_amt",
    issuedCount: "issues_0_3_mos_cnt",
    outstandingAmount: "outstanding_0_3_mos_amt",
    outstandingCount: "outstanding_0_3_mos_cnt",
  },
  {
    id: "3-6m",
    label: "3–6M",
    issuedAmount: "issues_3_6_mos_amt",
    issuedCount: "issues_3_6_mos_cnt",
    outstandingAmount: "outstanding_3_6_mos_amt",
    outstandingCount: "outstanding_3_6_mos_cnt",
  },
  {
    id: "6m-2y",
    label: "6M–2Y",
    issuedAmount: "issues_6_mos_to_2_yrs_amt",
    issuedCount: "issues_6_mos_to_2_yrs_cnt",
    outstandingAmount: "outstanding_6_mos_to_2_yrs_amt",
    outstandingCount: "outstanding_6_mos_to_2_yrs_cnt",
  },
  {
    id: "2-5y",
    label: "2–5Y",
    issuedAmount: "issues_2_5_yrs_amt",
    issuedCount: "issues_2_5_yrs_cnt",
    outstandingAmount: "outstanding_2_5_yrs_amt",
    outstandingCount: "outstanding_2_5_yrs_cnt",
  },
  {
    id: "5-10y",
    label: "5–10Y",
    issuedAmount: "issues_5_10_yrs_amt",
    issuedCount: "issues_5_10_yrs_cnt",
    outstandingAmount: "outstanding_5_10_yrs_amt",
    outstandingCount: "outstanding_5_10_yrs_cnt",
  },
  {
    id: "10y+",
    label: "10Y+",
    issuedAmount: "issues_over_10_yrs_amt",
    issuedCount: "issues_over_10_yrs_cnt",
    outstandingAmount: "outstanding_over_10_yrs_amt",
    outstandingCount: "outstanding_over_10_yrs_cnt",
  },
] as const;

function toNumber(value: string | null | undefined) {
  const parsed = Number(value);
  return value != null && value !== "" && Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseYearMonth(value: string | null | undefined) {
  if (!value || !/^\d{2}-\d{2}$/.test(value)) return null;
  const [years, months] = value.split("-").map(Number);
  return years * 12 + months;
}

export function parseSlgsDemandRate(
  row: RawSlgsDemandRate
): SlgsDemandRate | null {
  const annualizedEffectiveRate = toNumber(row.annualized_effective_rate);
  const dailyFactor = toNumber(row.daily_factor);
  if (
    !row.record_date ||
    annualizedEffectiveRate == null ||
    dailyFactor == null
  )
    return null;
  return { recordDate: row.record_date, annualizedEffectiveRate, dailyFactor };
}

export function parseSlgsTimeRate(row: RawSlgsTimeRate): SlgsTimeRate | null {
  const monthsFrom = parseYearMonth(row.from);
  const monthsThrough =
    row.through === "ONLY" ? monthsFrom : parseYearMonth(row.through);
  const rate = toNumber(row.rate);
  if (
    !row.record_date ||
    !row.from ||
    !row.through ||
    monthsFrom == null ||
    rate == null
  )
    return null;
  return {
    recordDate: row.record_date,
    from: row.from,
    through: row.through,
    monthsFrom,
    monthsThrough,
    rate,
  };
}

export function parseSlgsSecurityRow(
  row: RawSlgsSecurity
): SlgsDailyActivity | null {
  const recordDate = row.record_date;
  if (!recordDate) return null;
  return {
    recordDate,
    newSubscriptionsAmount: toNumber(row.new_subscriptions_amt),
    newSubscriptionsCount: toNumber(row.new_subscriptions_cnt),
    cancelledSubscriptionsAmount: toNumber(row.cancelled_subscriptions_amt),
    cancelledSubscriptionsCount: toNumber(row.cancelled_subscriptions_cnt),
    demandDepositRedemptionsAmount: toNumber(
      row.demand_deposit_redemptions_amt
    ),
    timeDepositRedemptionsAmount: toNumber(row.time_deposit_redemptions_amt),
    buckets: BUCKETS.map(bucket => ({
      id: bucket.id,
      label: bucket.label,
      issuedAmount: toNumber(row[bucket.issuedAmount]),
      issuedCount: toNumber(row[bucket.issuedCount]),
      outstandingAmount: toNumber(row[bucket.outstandingAmount]),
      outstandingCount: toNumber(row[bucket.outstandingCount]),
    })),
  };
}

export const MUNICIPAL_SOURCE_REGISTRY = [
  {
    id: "TREASURY-SLGS",
    label: "美国财政部 · SLGS 证券活动",
    frequency: "日度",
    status: "probe" as const,
    sourceUrl: "https://fiscaldata.treasury.gov/datasets/slgs-securities/",
    scope: "SLGS 新认购、撤销、赎回及分期限未偿证券；不属于可交易市政债报价。",
  },
  {
    id: "TREASURY-SLGS-RATES",
    label: "美国财政部 · SLGS 日利率表",
    frequency: "日度",
    status: "probe" as const,
    sourceUrl:
      "https://fiscaldata.treasury.gov/datasets/slgs-daily-rate-table/",
    scope:
      "SLGS 期限存款与活期存款官方日利率资料；按记录日和期限清洗后供利率表、历史和用户测算使用。",
  },
  {
    id: "MSRB-EMMA",
    label: "MSRB / EMMA · 交易透明度",
    frequency: "未订阅",
    status: "unavailable" as const,
    sourceUrl: "",
    scope:
      "当前未订阅结构化成交资料。本平台不读取外部逐笔交易，也不显示替代成交、报价、收益率、库存或交易商字段。",
  },
  {
    id: "FRED-MUNI-HISTORY",
    label: "FRED · 市政债长期历史参照",
    frequency: "月度（已停止更新）",
    status: "historical" as const,
    sourceUrl: "https://fred.stlouisfed.org/series/M13023USM156NNBR",
    scope: "高评级市政债长期历史参照，不作为当前曲线、报价或可执行收益率。",
  },
] as const;

type PublicMunicipalSource = Omit<
  (typeof MUNICIPAL_SOURCE_REGISTRY)[number],
  "sourceUrl"
> & {
  availability: "available" | "unavailable" | "restricted" | "historical";
  checkedAt: string;
};
type MunicipalSnapshot = {
  asOf: string;
  lastSuccessAt: string | null;
  dataStatus: "available" | "stale" | "unavailable";
  sourceLatencyMs: number | null;
  slgs: SlgsDailyActivity[];
  sources: PublicMunicipalSource[];
};
type SlgsRateSnapshot = {
  dataContractId: "municipal-slgs-daily-rates";
  asOf: string;
  dataStatus: "available" | "stale" | "unavailable";
  sourceLatencyMs: number | null;
  demandRates: SlgsDemandRate[];
  timeRates: SlgsTimeRate[];
};
export type BoomVrdnInventorySnapshot = {
  dataContractId: "municipal-boom-vrdn-inventory";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  currentWinningRate: null;
  currentSubscriptionRatio: null;
  currentTailRate: null;
  currentVpin: null;
  nashDistribution: [];
  auctionHistory: [];
  vpinHistory: [];
  bidderBehavior: [];
  signals: [];
  inventoryHistory: [];
  rateRelationship: [];
  limitation: string;
};
export type BmaSwapIndexSnapshot = {
  dataContractId: "municipal-bma-swap-index";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  currentRate: null;
  termRates: [];
  history: [];
  ratioHistory: [];
  spreadPoints: [];
  limitation: string;
};
export type VrdnSevenDaySnapshot = {
  dataContractId: "municipal-vrdn-seven-day-market";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  securities: [];
  rateHistory: [];
  liquidityProviders: [];
  resetCycle: [];
  liquidityPoints: [];
  limitation: string;
};
export type MsrbMarketStatisticsSnapshot = {
  dataContractId: "municipal-msrb-market-statistics";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  marketStats: Array<{
    label: string;
    value: number;
    unit: string;
    changePct: number | null;
  }>;
  monthlyVolume: Array<{
    period: string;
    primaryVolumeBillions: number;
    secondaryVolumeBillions: number;
  }>;
  tradeTypes: Array<{
    type: string;
    count: number;
    volumeBillions: number;
    averageSizeThousands: number;
  }>;
  issuers: Array<{
    rank: number;
    state: string;
    name: string;
    amountBillions: number;
    count: number;
    averageSizeMillions: number;
  }>;
  complianceEvents: Array<{
    date: string;
    type: string;
    issuer: string;
    cusip: string | null;
    detail: string;
    severity: string;
    status: string;
  }>;
  activityTrend: Array<{
    date: string;
    volumeBillions: number;
    transactions: number;
  }>;
  tradeTypeDistribution: Array<{
    name: string;
    count: number;
  }>;
  concentration: Array<{
    label: string;
    value: number;
    unit: string;
  }>;
  transparency: Array<{
    label: string;
    valuePct: number;
  }>;
  limitation: string;
};
export type PickNewIssuanceSnapshot = {
  dataContractId: "municipal-pick-new-issuance";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  issues: Array<{
    id: string;
    date: string;
    issuer: string;
    state: string;
    sizeMillions: number;
    type: string;
    couponPct: number | null;
    maturity: string | null;
    rating: string | null;
    taxStatus: string | null;
    purpose: string | null;
    manager: string | null;
    oversubscribed: number | null;
    priceGuidance: string | null;
    finalYieldPct: number | null;
    status: string;
    sector: string | null;
    callDate: string | null;
  }>;
  weeklyVolume: Array<{
    period: string;
    volumeBillions: number;
    deals: number;
    averageOversubscription: number | null;
  }>;
  pricingHistory: Array<{
    period: string;
    guidanceYieldPct: number;
    finalYieldPct: number;
    concessionBps: number;
  }>;
  limitation: string;
};
export type MbwdBidWantedSnapshot = {
  dataContractId: "municipal-mbwd-bid-wanted";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  inquiries: Array<{
    requestId: string;
    cusip: string;
    issuer: string;
    sizeThousands: number;
    couponPct: number | null;
    maturity: string | null;
    rating: string | null;
    liquidity: string | null;
    lastTradePrice: number | null;
    lastTradeAt: string | null;
    bids: Array<{
      dealerId: string;
      price: number;
      yieldPct: number | null;
    }>;
  }>;
  depth: Array<{
    cusip: string;
    price: number;
    bidSizeThousands: number;
    askSizeThousands: number;
  }>;
  liquidityMatrix: Array<{
    term: string;
    generalObligationScore: number | null;
    revenueScore: number | null;
    educationScore: number | null;
    healthcareScore: number | null;
  }>;
  executionAnalyses: Array<{
    requestId: string;
    bestPrice: number;
    worstPrice: number;
    improvementPct: number;
    dealerCount: number;
  }>;
  limitation: string;
};
export type CdrnNegotiatedCalendarSnapshot = {
  dataContractId: "municipal-cdrn-negotiated-calendar";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  events: Array<{
    id: string;
    date: string;
    issuer: string;
    state: string;
    sizeMillions: number;
    couponPct: number | null;
    maturity: string | null;
    rating: string | null;
    taxStatus: string | null;
    purpose: string | null;
    callDate: string | null;
    manager: string | null;
    roadshowDays: number | null;
    priceGuidance: string | null;
    oversubscriptionEstimate: number | null;
    historicalPremiumBps: number | null;
    status: string;
    finalYieldPct: number | null;
    bidCover: number | null;
    retailOrderPct: number | null;
    institutionalOrderPct: number | null;
  }>;
  managerRankings: Array<{
    name: string;
    deals: number;
    volumeMillions: number;
    averageOversubscription: number | null;
    averagePremiumBps: number | null;
  }>;
  premiumTrend: Array<{
    period: string;
    premiumBps: number;
    oversubscription: number | null;
  }>;
  limitation: string;
};
export type CdrcCompetitiveCalendarSnapshot = {
  dataContractId: "municipal-cdrc-competitive-calendar";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  events: Array<{
    id: string;
    date: string;
    issuer: string;
    state: string;
    sizeMillions: number;
    rating: string | null;
    taxStatus: string | null;
    purpose: string | null;
    bidderCount: number | null;
    winner: string | null;
    winningYieldPct: number | null;
    secondYieldPct: number | null;
    winningSpreadBps: number | null;
    status: string;
    bidRange: string | null;
    competitiveness: string | null;
  }>;
  competitionTrend: Array<{
    period: string;
    averageBidders: number;
    averageSpreadBps: number | null;
    winnerPremiumBps: number | null;
  }>;
  limitation: string;
};
export type CdraCreditRatingSnapshot = {
  dataContractId: "municipal-cdra-credit-ratings";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  ratingDistribution: Array<{
    rating: string;
    count: number;
    percentage: number;
    spreadBps: number | null;
  }>;
  migrationMatrix: Array<{
    fromRating: string;
    toAAA: number;
    toAA: number;
    toA: number;
    toBBB: number;
    toBelowInvestmentGrade: number;
  }>;
  ratingActions: Array<{
    period: string;
    upgrades: number;
    downgrades: number;
  }>;
  spreadHistory: Array<{
    period: string;
    aaSpreadBps: number | null;
    aSpreadBps: number | null;
    bbbSpreadBps: number | null;
  }>;
  defaultHistory: Array<{
    ratingGroup: string;
    horizonYears: number;
    cumulativeDefaultPct: number;
    sampleStart: string | null;
    sampleEnd: string | null;
  }>;
  limitation: string;
};
export type CndsMunicipalNewsSnapshot = {
  dataContractId: "municipal-cnds-news-research";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  news: Array<{
    id: string;
    publishedAt: string;
    category: string;
    title: string;
    issuer: string | null;
    impact: "Positive" | "Negative" | "Neutral" | null;
    summary: string | null;
    tags: string[];
    rating: string | null;
  }>;
  researchReports: Array<{
    id: string;
    publishedAt: string;
    firm: string;
    title: string;
    reportType: string;
    pages: number | null;
    recommendation: string | null;
  }>;
  creditAlerts: Array<{
    id: string;
    observedAt: string;
    issuer: string;
    alert: string;
    level: string;
    rating: string | null;
    status: string;
  }>;
  limitation: string;
};
export type CdrvVariableRateDemandSnapshot = {
  dataContractId: "municipal-cdrv-variable-rate-demand";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  securities: Array<{
    cusip: string;
    issuer: string;
    sizeMillions: number;
    currentRatePct: number | null;
    previousRatePct: number | null;
    resetFrequency: string | null;
    liquidityProvider: string | null;
    liquidityExpiry: string | null;
    rating: string | null;
    nextReset: string | null;
  }>;
  rateHistory: Array<{
    period: string;
    benchmarkRatePct: number | null;
    fundingRatePct: number | null;
    portfolioRatePct: number | null;
  }>;
  riskAssessments: Array<{
    id: string;
    observedAt: string;
    title: string;
    level: string;
    detail: string;
    evidenceCount: number;
  }>;
  limitation: string;
};
export type DealMunicipalTradeSnapshot = {
  dataContractId: "municipal-deal-trade-execution";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  trades: Array<{
    id: string;
    occurredAt: string;
    cusip: string;
    issuer: string;
    sizeThousands: number;
    price: number | null;
    yieldPct: number | null;
    side: string | null;
    dealer: string | null;
    benchmarkPrice: number | null;
    deviationPoints: number | null;
    flag: string | null;
  }>;
  intraday: Array<{
    occurredAt: string;
    cusip: string;
    issuer: string;
    price: number | null;
    volumeThousands: number | null;
  }>;
  executionSummary: {
    averageDeviationPoints: number | null;
    maximumDeviationPoints: number | null;
    bidAskSpreadPoints: number | null;
    efficiencyScore: number | null;
    anomalyDetail: string | null;
  };
  qualityHistory: Array<{
    period: string;
    priceImprovementPct: number | null;
    executionSeconds: number | null;
    quoteValidityPct: number | null;
  }>;
  dealerScores: Array<{
    dealer: string;
    priceImprovement: number | null;
    executionSpeed: number | null;
    quoteCoverage: number | null;
    marketShare: number | null;
  }>;
  costBreakdown: Array<{
    metric: string;
    valuePct: number | null;
    description: string | null;
  }>;
  limitation: string;
};
export type McalStructuredCalendarSnapshot = {
  dataContractId: "municipal-mcal-structured-calendar";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  events: Array<{
    id: string;
    issuanceDate: string;
    issuer: string;
    state: string | null;
    dealType: string | null;
    purpose: string | null;
    amountMillions: number | null;
    rating: string | null;
    underwriter: string | null;
    couponPct: number | null;
    maturityDate: string | null;
    taxStatus: string | null;
    status: string | null;
    benchmarkSpreadBps: number | null;
  }>;
  weeklyIssuance: Array<{
    period: string;
    negotiatedMillions: number | null;
    competitiveMillions: number | null;
    shortTermMillions: number | null;
  }>;
  underwriterShare: Array<{
    underwriter: string;
    sharePct: number | null;
    amountMillions: number | null;
  }>;
  ratingYield: Array<{
    rating: string;
    yieldPct: number | null;
    benchmarkSpreadBps: number | null;
  }>;
  limitation: string;
};
export type MbixMunicipalIndexSnapshot = {
  dataContractId: "municipal-mbix-index-monitor";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  indices: Array<{
    id: string;
    name: string;
    yieldPct: number | null;
    changePct: number | null;
    ytdPct: number | null;
    durationYears: number | null;
    oasBps: number | null;
    rating: string | null;
    constituentCount: number | null;
    marketValueBillions: number | null;
  }>;
  history: Array<{
    date: string;
    aaa: number | null;
    aa: number | null;
    a: number | null;
    bbb: number | null;
  }>;
  termStructure: Array<{
    term: string;
    aaa: number | null;
    aa: number | null;
    a: number | null;
    bbb: number | null;
  }>;
  sectorSpread: Array<{
    sector: string;
    oasBps: number | null;
    constituentCount: number | null;
    marketValueBillions: number | null;
  }>;
  factorAttribution: Array<{
    period: string;
    totalReturnPct: number | null;
    interestContributionPct: number | null;
    creditContributionPct: number | null;
  }>;
  subIndexScores: Array<{
    indexName: string;
    duration: number | null;
    credit: number | null;
    liquidity: number | null;
    ratingStability: number | null;
  }>;
  historicalPercentile: Array<{ period: string; percentile: number | null }>;
  limitation: string;
};
export type AaaMunicipalCurveSnapshot = {
  dataContractId: "municipal-aaa-benchmark-curve";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  curve: Array<{
    term: string;
    municipalYieldPct: number | null;
    treasuryYieldPct: number | null;
    spreadBps: number | null;
    previousMunicipalYieldPct: number | null;
    priorWeekMunicipalYieldPct: number | null;
  }>;
  history: Array<{
    date: string;
    y1Pct: number | null;
    y5Pct: number | null;
    y10Pct: number | null;
    y30Pct: number | null;
    ratio10Pct: number | null;
  }>;
  forecasts: Array<{
    horizon: string;
    y10Pct: number | null;
    highPct: number | null;
    lowPct: number | null;
    confidencePct: number | null;
  }>;
  relativeValueSignals: Array<{
    term: string;
    signal: string;
    ratioPct: number | null;
    reason: string;
    strength: string | null;
    observedAt: string;
  }>;
  limitation: string;
};
export type SmunIssuerSearchSnapshot = {
  dataContractId: "municipal-smun-issuer-search";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  issuers: Array<{
    id: string;
    name: string;
    state: string | null;
    type: string | null;
    rating: string | null;
    outstandingDebtMillions: number | null;
    annualIssuanceMillions: number | null;
    creditWatch: boolean | null;
    sector: string | null;
    population: number | null;
    gdpPerCapita: number | null;
    debtPerCapita: number | null;
    pensionFundedPct: number | null;
    reserveFundMonths: number | null;
    revenueGrowthPct: number | null;
    debtServicePct: number | null;
    unemploymentPct: number | null;
    creditTrend: string | null;
    healthScore: number | null;
    debtToRevenue: number | null;
    interestCoverage: number | null;
    cashFlowMillions: number | null;
  }>;
  creditHistory: Array<Record<string, string | null>>;
  debtService: Array<{
    issuerId: string;
    year: string;
    principalMillions: number | null;
    interestMillions: number | null;
  }>;
  cityHealth: Array<{
    city: string;
    fiscalBalance: number | null;
    debtBurden: number | null;
    taxGrowth: number | null;
    employmentRate: number | null;
    populationChange: number | null;
  }>;
  debtTaxCreditSpread: Array<{
    city: string;
    debtToRevenue: number | null;
    creditSpreadBps: number | null;
    population: number | null;
  }>;
  limitation: string;
};
export type MsrcSecuritySearchSnapshot = {
  dataContractId: "municipal-msrc-security-search";
  checkedAt: string;
  dataStatus: "restricted";
  observedAt: null;
  securities: Array<{
    cusip: string;
    issuer: string;
    state: string | null;
    securityType: string | null;
    purpose: string | null;
    issueDate: string | null;
    maturityDate: string | null;
    couponPct: number | null;
    parAmountMillions: number | null;
    rating: string | null;
    taxStatus: string | null;
    disclosureUpdatedAt: string | null;
  }>;
  resultDistribution: Array<{
    state: string;
    parAmountMillions: number;
    securityCount: number;
    leadingRating: string | null;
  }>;
  matchedRatingChanges: Array<{
    period: string;
    upgrades: number;
    downgrades: number;
    unchanged: number;
  }>;
  stateComparison: Array<{
    state: string;
    matchedParAmountMillions: number;
    matchedSecurityCount: number;
    averageRatingScore: number | null;
    upgradeRatio: number | null;
  }>;
  limitation: string;
};
export type MunicipalCactSnapshot = {
  dataContractId: "municipal-cact-disclosure-events";
  checkedAt: string;
  dataStatus: "available" | "restricted" | "unavailable";
  observedAt: string | null;
  query: string;
  issuerMatches: Array<{ cik: string; ticker: string; name: string }>;
  events: Array<{
    filingDate: string | null;
    form: string;
    cik: string;
    ticker: string | null;
    primaryDocument: string | null;
    accessionNumber: string | null;
    eventType: "material" | "financial" | "governance";
  }>;
  epsObservations: Array<{
    periodEnd: string;
    periodType: string;
    value: number;
    unit: string;
    form: string;
    filed: string | null;
  }>;
  limitation: string;
};
export type MunicipalBtmmSnapshot = {
  dataContractId: "municipal-btmm-short-funding";
  checkedAt: string;
  dataStatus: "available" | "unavailable";
  observedAt: string | null;
  rates: Record<
    string,
    { latest: number | null; observations: Array<{ date: string; value: number }> }
  >;
  limitation: string;
};
let cached: MunicipalSnapshot | null = null;
let cachedAt = 0;
let active: Promise<MunicipalSnapshot> | null = null;
let rateCached: SlgsRateSnapshot | null = null;
let rateCachedAt = 0;
let rateActive: Promise<SlgsRateSnapshot> | null = null;

async function fetchSlgsActivities() {
  const response = await fetch(
    `${SLGS_SECURITIES_URL}?page[size]=250&sort=-record_date`,
    { signal: AbortSignal.timeout(9_000) }
  );
  if (!response.ok) throw new Error(`TREASURY_SLGS_${response.status}`);
  const body = (await response.json()) as { data?: RawSlgsSecurity[] };
  return (body.data ?? [])
    .map(parseSlgsSecurityRow)
    .filter((row): row is SlgsDailyActivity => row !== null)
    .sort((left, right) => left.recordDate.localeCompare(right.recordDate));
}

async function fetchJsonRows(url: string, size: number) {
  const response = await fetch(`${url}?page[size]=${size}&sort=-record_date`, {
    signal: AbortSignal.timeout(9_000),
  });
  if (!response.ok) throw new Error(`TREASURY_SLGS_RATES_${response.status}`);
  const body = (await response.json()) as {
    data?: Record<string, string | null | undefined>[];
  };
  return body.data ?? [];
}

async function fetchSlgsRates() {
  const [demandRows, timeRows] = await Promise.all([
    fetchJsonRows(SLGS_DEMAND_RATES_URL, 250),
    fetchJsonRows(SLGS_TIME_RATES_URL, 800),
  ]);
  const demandRates = demandRows
    .map(parseSlgsDemandRate)
    .filter((row): row is SlgsDemandRate => row !== null)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate));
  const timeRates = timeRows
    .map(parseSlgsTimeRate)
    .filter((row): row is SlgsTimeRate => row !== null)
    .sort(
      (a, b) =>
        a.recordDate.localeCompare(b.recordDate) || a.monthsFrom - b.monthsFrom
    );
  return { demandRates, timeRates };
}

export function toPublicMunicipalSource(
  source: (typeof MUNICIPAL_SOURCE_REGISTRY)[number],
  availability: PublicMunicipalSource["availability"],
  checkedAt: string
): PublicMunicipalSource {
  const { sourceUrl: _sourceUrl, ...clean } = source;
  return { ...clean, availability, checkedAt };
}

export async function getSlgsRateSnapshot(): Promise<SlgsRateSnapshot> {
  const now = Date.now();
  if (rateCached && now - rateCachedAt < 60_000) return rateCached;
  if (rateActive) return rateActive;
  rateActive = (async (): Promise<SlgsRateSnapshot> => {
    const startedAt = Date.now();
    try {
      const { demandRates, timeRates } = await fetchSlgsRates();
      const available = demandRates.length > 0 || timeRates.length > 0;
      const snapshot: SlgsRateSnapshot = {
        dataContractId: "municipal-slgs-daily-rates",
        asOf: new Date().toISOString(),
        dataStatus: available ? "available" : "unavailable",
        sourceLatencyMs: Math.max(0, Date.now() - startedAt),
        demandRates,
        timeRates,
      };
      if (available) {
        rateCached = snapshot;
        rateCachedAt = Date.now();
      }
      return snapshot;
    } catch {
      if (rateCached && Date.now() - Date.parse(rateCached.asOf) < 86_400_000)
        return { ...rateCached, dataStatus: "stale" };
      return {
        dataContractId: "municipal-slgs-daily-rates",
        asOf: new Date().toISOString(),
        dataStatus: "unavailable",
        sourceLatencyMs: Math.max(0, Date.now() - startedAt),
        demandRates: [],
        timeRates: [],
      };
    }
  })().finally(() => {
    rateActive = null;
  });
  return rateActive!;
}

/**
 * BOOM is the retained VRDN-inventory research surface. It intentionally has
 * its own contract instead of reusing Treasury auction, SLGS, SOFR or other
 * municipal pages. Those datasets cannot prove VRDN dealer inventory,
 * bidder-level distributions, VPIN or executable signals.
 */
export function getBoomVrdnInventorySnapshot(): BoomVrdnInventorySnapshot {
  return {
    dataContractId: "municipal-boom-vrdn-inventory",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    currentWinningRate: null,
    currentSubscriptionRatio: null,
    currentTailRate: null,
    currentVpin: null,
    nashDistribution: [],
    auctionHistory: [],
    vpinHistory: [],
    bidderBehavior: [],
    signals: [],
    inventoryHistory: [],
    rateRelationship: [],
    limitation:
      "尚未配置获准的 VRDN 库存、逐笔投标或成交数据接口；不使用国债拍卖、SLGS、SOFR、静态样例或随机数替代。",
  };
}

export function getBmaSwapIndexSnapshot(): BmaSwapIndexSnapshot {
  return {
    dataContractId: "municipal-bma-swap-index",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    currentRate: null,
    termRates: [],
    history: [],
    ratioHistory: [],
    spreadPoints: [],
    limitation:
      "尚未配置获准的 BMA/SIFMA Municipal Swap Index 序列；不使用 SOFR、SLGS、VRDN 或静态利率替代。",
  };
}

export function getVrdnSevenDaySnapshot(): VrdnSevenDaySnapshot {
  return {
    dataContractId: "municipal-vrdn-seven-day-market",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    securities: [],
    rateHistory: [],
    liquidityProviders: [],
    resetCycle: [],
    liquidityPoints: [],
    limitation:
      "尚未配置获准的逐券 VRDN 利率、重设、流动性支持与未偿额接口；不使用 BMA/SIFMA、BOOM 库存、SLGS 或静态证券替代。",
  };
}

/**
 * MSRB/EMMA has no authorized structured feed in this deployment.  Keep the
 * statistics surface distinct: Treasury/SLGS activity, BMA, VRDN and SOFR
 * cannot prove MSRB trade counts, issuer ranks, compliance events or dealer
 * concentration.  Returning typed empty collections prevents stale sample
 * values from being mistaken for current market observations.
 */
export function getMsrbMarketStatisticsSnapshot(): MsrbMarketStatisticsSnapshot {
  return {
    dataContractId: "municipal-msrb-market-statistics",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    marketStats: [],
    monthlyVolume: [],
    tradeTypes: [],
    issuers: [],
    complianceEvents: [],
    activityTrend: [],
    tradeTypeDistribution: [],
    concentration: [],
    transparency: [],
    limitation:
      "尚未配置获准的 MSRB/EMMA 结构化统计接口；不使用 SLGS、BMA、VRDN、SOFR 或静态样例替代发行量、成交量、发行人排名、合规事件、透明度或集中度数据。",
  };
}

/**
 * PICK requires an authorized primary municipal issuance calendar and book-
 * building feed.  Treasury auctions and SLGS subscriptions are different
 * instruments and must never be projected into this surface.
 */
export function getPickNewIssuanceSnapshot(): PickNewIssuanceSnapshot {
  return {
    dataContractId: "municipal-pick-new-issuance",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    issues: [],
    weeklyVolume: [],
    pricingHistory: [],
    limitation:
      "尚未配置获准的地方债新发行日历、簿记认购与定价结果接口；不使用国债拍卖、SLGS 认购、MSRB 受限统计或静态样例替代。",
  };
}

/**
 * Dealer RFQ/Bid-Wanted responses are permissioned transactional data.  A
 * public last-sale feed, SLGS series or synthetic depth cannot substitute for
 * named responses, executable prices, liquidity matrices or best execution.
 */
export function getMbwdBidWantedSnapshot(): MbwdBidWantedSnapshot {
  return {
    dataContractId: "municipal-mbwd-bid-wanted",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    inquiries: [],
    depth: [],
    liquidityMatrix: [],
    executionAnalyses: [],
    limitation:
      "尚未配置获准的地方债询价请求、交易商回报、市场深度与执行质量接口；不使用 MSRB 汇总、SLGS、国债拍卖、静态报价或定时器模拟。",
  };
}

/** Negotiated underwriting workflow is not the PICK issuance calendar. */
export function getCdrnNegotiatedCalendarSnapshot(): CdrnNegotiatedCalendarSnapshot {
  return {
    dataContractId: "municipal-cdrn-negotiated-calendar",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    events: [],
    managerRankings: [],
    premiumTrend: [],
    limitation:
      "尚未配置获准的商议承销路演、簿记、承销商排名与新券溢价接口；不复用 PICK 发行日历、MBWD 询价、MSRB 汇总或静态承销样例。",
  };
}

export function getCdrcCompetitiveCalendarSnapshot(): CdrcCompetitiveCalendarSnapshot {
  return {
    dataContractId: "municipal-cdrc-competitive-calendar",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    events: [],
    competitionTrend: [],
    limitation:
      "尚未配置获准的地方债竞价公告、投标数量、中标结果与次优报价接口；不复用 CDRN 商议承销、PICK 发行日历、国债拍卖或静态竞价样例。",
  };
}

export function getCdraCreditRatingSnapshot(): CdraCreditRatingSnapshot {
  return {
    dataContractId: "municipal-cdra-credit-ratings",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    ratingDistribution: [],
    migrationMatrix: [],
    ratingActions: [],
    spreadHistory: [],
    defaultHistory: [],
    limitation:
      "尚未配置获准的市政债评级、评级行动、迁移研究、同口径利差与违约样本接口；不使用发行日历、MSRB 汇总、静态评级分布或推断结论替代。",
  };
}

export function getCndsMunicipalNewsSnapshot(): CndsMunicipalNewsSnapshot {
  return {
    dataContractId: "municipal-cnds-news-research",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    news: [],
    researchReports: [],
    creditAlerts: [],
    limitation:
      "尚未配置获准的地方债专属新闻、机构研究全文与信用预警事件接口；不复制新闻中心、CDRA 评级、PICK 发行数据或静态新闻样例。",
  };
}

export function getCdrvVariableRateDemandSnapshot(): CdrvVariableRateDemandSnapshot {
  return {
    dataContractId: "municipal-cdrv-variable-rate-demand",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    securities: [],
    rateHistory: [],
    riskAssessments: [],
    limitation:
      "尚未配置获准的变动利率需求票据逐券报价、重置记录、流动性支持与风险事件接口；不复用 VRDN、BMA、BOOM、SOFR、SLGS 或静态样例填充。",
  };
}

export function getDealMunicipalTradeSnapshot(): DealMunicipalTradeSnapshot {
  return {
    dataContractId: "municipal-deal-trade-execution",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    trades: [],
    intraday: [],
    executionSummary: {
      averageDeviationPoints: null,
      maximumDeviationPoints: null,
      bidAskSpreadPoints: null,
      efficiencyScore: null,
      anomalyDetail: null,
    },
    qualityHistory: [],
    dealerScores: [],
    costBreakdown: [],
    limitation:
      "尚未配置获准的地方债逐笔成交、基准价格、交易商报价与执行成本接口；不复用 MSRB 汇总、MBWD 询价、PICK 发行、CDRV 重置或静态成交样例。",
  };
}

export function getMcalStructuredCalendarSnapshot(): McalStructuredCalendarSnapshot {
  return {
    dataContractId: "municipal-mcal-structured-calendar",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    events: [],
    weeklyIssuance: [],
    underwriterShare: [],
    ratingYield: [],
    limitation:
      "尚未配置获准的市政结构融资发行、定价、承销份额与评级收益率接口；不复用 PICK 新券、CDRN 商议日程、CDRC 竞价日程、MBS 日历或静态发行样例。",
  };
}

export function getMbixMunicipalIndexSnapshot(): MbixMunicipalIndexSnapshot {
  return {
    dataContractId: "municipal-mbix-index-monitor",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    indices: [],
    history: [],
    termStructure: [],
    sectorSpread: [],
    factorAttribution: [],
    subIndexScores: [],
    historicalPercentile: [],
    limitation:
      "尚未配置获准的地方债指数成分、估值、期限结构、行业利差与归因接口；不复用 CDRA 评级、MCAL 日历、DEAL 成交、BMA 或静态指数样例。",
  };
}

export function getAaaMunicipalCurveSnapshot(): AaaMunicipalCurveSnapshot {
  return {
    dataContractId: "municipal-aaa-benchmark-curve",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    curve: [],
    history: [],
    forecasts: [],
    relativeValueSignals: [],
    limitation:
      "尚未配置获准的 AAA 地方债估值曲线、同期限国债配对、历史修订与预测接口；不复用 MBIX 指数、CDRA 评级、SLGS、BMA 或静态曲线和交易信号。",
  };
}

export function getSmunIssuerSearchSnapshot(): SmunIssuerSearchSnapshot {
  return {
    dataContractId: "municipal-smun-issuer-search",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    issuers: [],
    creditHistory: [],
    debtService: [],
    cityHealth: [],
    debtTaxCreditSpread: [],
    limitation:
      "尚未配置获准的发行人财务披露、评级历史、偿债计划与城市财政指标接口；不复用 CDRA 评级、MCAL 发行、MBIX 指数、DEAL 成交或静态发行人样例，也不生成投资建议。",
  };
}

/**
 * MSRC is a security-directory search surface.  Issuer fundamentals, broad
 * rating research and issuance calendars cannot establish a searchable CUSIP
 * universe, so they must not be projected into this contract.
 */
export function getMsrcSecuritySearchSnapshot(): MsrcSecuritySearchSnapshot {
  return {
    dataContractId: "municipal-msrc-security-search",
    checkedAt: new Date().toISOString(),
    dataStatus: "restricted",
    observedAt: null,
    securities: [],
    resultDistribution: [],
    matchedRatingChanges: [],
    stateComparison: [],
    limitation:
      "尚未配置获准的逐券地方债目录、CUSIP、发行条款、评级变动与披露更新时间接口；不复用 CDRA 评级研究、SMUN 发行人档案、PICK 发行日历、SLGS 或静态省份样例填充检索结果。",
  };
}

function cactEventType(
  form: string
): MunicipalCactSnapshot["events"][number]["eventType"] {
  if (form === "8-K") return "material";
  if (form === "DEFM14A") return "governance";
  return "financial";
}

const BTMM_SERIES = [
  "FEDFUNDS",
  "SOFR",
  "DGS3MO",
  "DGS6MO",
  "DGS1",
  "DGS2",
  "DGS10",
] as const;
let btmmCached: MunicipalBtmmSnapshot | null = null;
let btmmCachedAt = 0;
let btmmActive: Promise<MunicipalBtmmSnapshot> | null = null;

export async function getMunicipalBtmmSnapshot(): Promise<MunicipalBtmmSnapshot> {
  if (btmmCached && Date.now() - btmmCachedAt < 60_000) return btmmCached;
  if (btmmActive) return btmmActive;
  btmmActive = (async () => {
    const checkedAt = new Date().toISOString();
    try {
      const raw = await fetchMultipleFred([...BTMM_SERIES]);
      const rates: MunicipalBtmmSnapshot["rates"] = {};
      for (const series of BTMM_SERIES) {
        const observations = (raw[series] ?? [])
          .map(point => ({ date: String(point.date), value: Number(point.value) }))
          .filter(point => point.date && Number.isFinite(point.value))
          .sort((left, right) => left.date.localeCompare(right.date))
          .filter((point, index, rows) => index === 0 || rows[index - 1].date !== point.date);
        rates[series] = {
          latest: observations.at(-1)?.value ?? null,
          observations: observations.slice(-252),
        };
      }
      const observedAt = Object.values(rates)
        .flatMap(rate => rate.observations.map(point => point.date))
        .sort()
        .at(-1) ?? null;
      const available = Object.values(rates).some(rate => rate.observations.length > 0);
      const snapshot: MunicipalBtmmSnapshot = {
        dataContractId: "municipal-btmm-short-funding",
        checkedAt,
        dataStatus: available ? "available" : "unavailable",
        observedAt,
        rates,
        limitation: available
          ? "已将短端融资序列按本入口的日期、百分比和期限字段清洗；不生成报价、交易信号、政策预测或抵押品估值。"
          : "短端融资公开观察当前不可读；不使用主权债页面、SLGS、静态样例或随机值替代。",
      };
      if (available) {
        btmmCached = snapshot;
        btmmCachedAt = Date.now();
      }
      return snapshot;
    } catch {
      const unavailable: MunicipalBtmmSnapshot = {
        dataContractId: "municipal-btmm-short-funding",
        checkedAt,
        dataStatus: "unavailable",
        observedAt: null,
        rates: Object.fromEntries(BTMM_SERIES.map(series => [series, { latest: null, observations: [] }])) ,
        limitation: "短端融资公开观察当前不可读；不使用主权债页面、SLGS、静态样例或随机值替代。",
      };
      return unavailable;
    }
  })().finally(() => {
    btmmActive = null;
  });
  return btmmActive!;
}

export async function getMunicipalCactSnapshot(input: {
  query: string;
  cik?: string | null;
}): Promise<MunicipalCactSnapshot> {
  const query = input.query.trim().slice(0, 80);
  const checkedAt = new Date().toISOString();
  if (query.length < 2 && !input.cik) {
    return {
      dataContractId: "municipal-cact-disclosure-events",
      checkedAt,
      dataStatus: "restricted",
      observedAt: null,
      query,
      issuerMatches: [],
      events: [],
      epsObservations: [],
      limitation:
        "请输入公司代码、名称或 CIK；仅在取得真实披露后生成事件和实际 EPS，不使用地方债发行人、评级或静态公司样例。",
    };
  }
  try {
    const token = query.toLowerCase();
    const cikToken = token.replace(/\D/g, "");
    const rows = await getStockDisclosureIssuers();
    const issuerMatches = rows
      .filter(
        row =>
          row.ticker.toLowerCase().includes(token) ||
          row.title.toLowerCase().includes(token) ||
          (cikToken.length > 0 &&
            normalizeDisclosureCik(row.cik_str).includes(cikToken))
      )
      .slice(0, 6)
      .map(row => ({
        cik: normalizeDisclosureCik(row.cik_str),
        ticker: row.ticker,
        name: row.title,
      }));
    const cik =
      input.cik && /^\d{1,10}$/.test(input.cik)
        ? normalizeDisclosureCik(input.cik)
        : issuerMatches[0]?.cik;
    if (!cik) {
      return {
        dataContractId: "municipal-cact-disclosure-events",
        checkedAt,
        dataStatus: "available",
        observedAt: null,
        query,
        issuerMatches,
        events: [],
        epsObservations: [],
        limitation:
          "主体目录已返回候选，但尚未选择可核验 CIK；不从候选名称推断事件、评级或行情。",
      };
    }
    const [filings, facts] = await Promise.all([
      getStockDisclosureIssuerFilings(cik),
      getStockDisclosureCompanyFacts(cik),
    ]);
    const ticker =
      filings.issuer?.tickers?.[0] ??
      issuerMatches.find(item => item.cik === cik)?.ticker ??
      null;
    const eventByAccession = new Map<
      string,
      MunicipalCactSnapshot["events"][number]
    >();
    for (const item of filings.filings) {
      if (!["8-K", "10-K", "10-Q", "DEFM14A"].includes(item.form)) continue;
      const key =
        item.accessionNumber ??
        `${item.filingDate ?? ""}|${item.form}|${item.primaryDocument ?? ""}`;
      if (eventByAccession.has(key)) continue;
      eventByAccession.set(key, {
        filingDate: item.filingDate,
        form: item.form,
        cik,
        ticker,
        primaryDocument: item.primaryDocument,
        accessionNumber: item.accessionNumber,
        eventType: cactEventType(item.form),
      });
    }
    const events = Array.from(eventByAccession.values());
    const epsMetric = facts.metrics.find(
      (item: any) => item.id === "EarningsPerShareDiluted"
    ) as any;
    const epsByPeriod = new Map<string, any>();
    for (const item of epsMetric?.observations ?? []) {
      const value = Number(item.value);
      if (
        !["annual", "quarter"].includes(item.periodType) ||
        !item.end ||
        !Number.isFinite(value)
      )
        continue;
      const key = `${item.end}|${item.periodType}`;
      const prior = epsByPeriod.get(key);
      if (!prior || (item.filed ?? "") > (prior.filed ?? ""))
        epsByPeriod.set(key, item);
    }
    const epsObservations = Array.from(epsByPeriod.values())
      .sort(
        (left, right) =>
          left.end.localeCompare(right.end) ||
          left.periodType.localeCompare(right.periodType)
      )
      .slice(-24)
      .map((item: any) => ({
        periodEnd: item.end,
        periodType: item.periodType,
        value: Number(item.value),
        unit: epsMetric.unit,
        form: item.form,
        filed: item.filed ?? null,
      }));
    return {
      dataContractId: "municipal-cact-disclosure-events",
      checkedAt,
      dataStatus: "available",
      observedAt:
        events[0]?.filingDate ?? epsObservations.at(-1)?.filed ?? null,
      query,
      issuerMatches,
      events,
      epsObservations,
      limitation:
        "已将公开披露元数据和 XBRL 实际 EPS 清洗为本入口专属字段；不显示外部链接，不推断影响等级、一致预期、交易信号或地方债信用结论。",
    };
  } catch {
    return {
      dataContractId: "municipal-cact-disclosure-events",
      checkedAt,
      dataStatus: "unavailable",
      observedAt: null,
      query,
      issuerMatches: [],
      events: [],
      epsObservations: [],
      limitation:
        "当前无法读取公开披露清洗链路；不使用缓存样例、地方债模块数据或静态事件替代。",
    };
  }
}

export async function getMunicipalSnapshot(): Promise<MunicipalSnapshot> {
  const now = Date.now();
  if (cached && now - cachedAt < 60_000) return cached;
  if (active) return active;
  active = (async () => {
    const startedAt = Date.now();
    let slgs: SlgsDailyActivity[] = [];
    let rateAvailable = false;
    let available = false;
    const [activityResult, rateResult] = await Promise.allSettled([
      fetchSlgsActivities(),
      getSlgsRateSnapshot(),
    ]);
    if (activityResult.status === "fulfilled") {
      slgs = activityResult.value;
      available = slgs.length > 0;
    }
    if (rateResult.status === "fulfilled")
      rateAvailable = rateResult.value.dataStatus !== "unavailable";
    if (
      !available &&
      cached?.lastSuccessAt &&
      Date.now() - Date.parse(cached.lastSuccessAt) < 86_400_000
    )
      slgs = cached.slgs;
    const checkedAt = new Date().toISOString();
    const snapshot: MunicipalSnapshot = {
      asOf: checkedAt,
      lastSuccessAt: available ? checkedAt : (cached?.lastSuccessAt ?? null),
      dataStatus: available
        ? "available"
        : slgs.length
          ? "stale"
          : "unavailable",
      sourceLatencyMs: Math.max(0, Date.now() - startedAt),
      slgs,
      sources: MUNICIPAL_SOURCE_REGISTRY.map(source =>
        toPublicMunicipalSource(
          source,
          source.id === "TREASURY-SLGS"
            ? available
              ? "available"
              : "unavailable"
            : source.id === "TREASURY-SLGS-RATES"
              ? rateAvailable
                ? "available"
                : "unavailable"
              : source.status === "historical"
                ? "historical"
                : "unavailable",
          checkedAt
        )
      ),
    };
    cached = snapshot;
    cachedAt = Date.now();
    return snapshot;
  })().finally(() => {
    active = null;
  });
  return active;
}

export const municipalResearchRouter = router({
  publishOfficial: adminProcedure
    .input(z.object({ scope: z.enum(["funding", "curve", "issuers"]) }))
    .mutation(({ ctx, input }) =>
      publishMunicipalOfficial(input.scope, ctx.user.id)
    ),
  getIssuerDirectory: publicProcedure.query(() => ISSUER_TERRITORIES),
  getIssuerFundamentals: publicProcedure
    .input(
      z.object({
        id: z.enum(["CA", "NYC", "TX", "IL", "FL", "PA", "OH", "WA"]),
      })
    )
    .query(({ input }) => getIssuerFundamentals(input.id)),
  getReference: publicProcedure
    .input(z.object({ kind: z.enum(["curve", "funding"]) }))
    .query(({ input }) => getMunicipalReference(input.kind)),
  calculateWorkspace: publicProcedure
    .input(
      z.object({
        moduleId: z.string().refine(id => Object.hasOwn(MUNICIPAL_TOOLS, id)),
        values: z
          .record(z.string().max(30), z.number().finite())
          .refine(v => Object.keys(v).length <= 12),
      })
    )
    .query(({ input }) =>
      calculateMunicipalTool(input.moduleId as MunicipalToolId, input.values)
    ),
  getSnapshot: publicProcedure.query(getMunicipalSnapshot),
  getBoomVrdnInventoryStatus: publicProcedure.query(
    getBoomVrdnInventorySnapshot
  ),
  getBmaSwapIndexStatus: publicProcedure.query(getBmaSwapIndexSnapshot),
  getVrdnSevenDayStatus: publicProcedure.query(getVrdnSevenDaySnapshot),
  getMsrbMarketStatisticsStatus: publicProcedure.query(
    getMsrbMarketStatisticsSnapshot
  ),
  getPickNewIssuanceStatus: publicProcedure.query(getPickNewIssuanceSnapshot),
  getMbwdBidWantedStatus: publicProcedure.query(getMbwdBidWantedSnapshot),
  getCdrnNegotiatedCalendarStatus: publicProcedure.query(
    getCdrnNegotiatedCalendarSnapshot
  ),
  getCdrcCompetitiveCalendarStatus: publicProcedure.query(
    getCdrcCompetitiveCalendarSnapshot
  ),
  getCdraCreditRatingStatus: publicProcedure.query(getCdraCreditRatingSnapshot),
  getCndsMunicipalNewsStatus: publicProcedure.query(
    getCndsMunicipalNewsSnapshot
  ),
  getCdrvVariableRateDemandStatus: publicProcedure.query(
    getCdrvVariableRateDemandSnapshot
  ),
  getDealMunicipalTradeStatus: publicProcedure.query(
    getDealMunicipalTradeSnapshot
  ),
  getMcalStructuredCalendarStatus: publicProcedure.query(
    getMcalStructuredCalendarSnapshot
  ),
  getMbixMunicipalIndexStatus: publicProcedure.query(
    getMbixMunicipalIndexSnapshot
  ),
  getAaaMunicipalCurveStatus: publicProcedure.query(
    getAaaMunicipalCurveSnapshot
  ),
  getSmunIssuerSearchStatus: publicProcedure.query(getSmunIssuerSearchSnapshot),
  getMsrcSecuritySearchStatus: publicProcedure.query(
    getMsrcSecuritySearchSnapshot
  ),
  getMunicipalBtmmStatus: publicProcedure.query(getMunicipalBtmmSnapshot),
  getMunicipalCactStatus: publicProcedure
    .input(
      z.object({
        query: z.string().max(80).default(""),
        cik: z
          .string()
          .regex(/^\d{0,10}$/)
          .nullable()
          .optional(),
      })
    )
    .query(({ input }) => getMunicipalCactSnapshot(input)),
  getSlgsRateSnapshot: publicProcedure.query(getSlgsRateSnapshot),
  getSlgsRateHistory: publicProcedure
    .input(z.object({ months: z.number().int().min(0).max(480) }))
    .query(async ({ input }) => {
      if (input.months === 0) {
        const snapshot = await getSlgsRateSnapshot();
        return {
          dataContractId: "municipal-slgs-demand-rate-history",
          type: "Demand" as const,
          months: 0,
          observations: snapshot.demandRates,
        };
      }
      const years = Math.floor(input.months / 12)
        .toString()
        .padStart(2, "0");
      const months = (input.months % 12).toString().padStart(2, "0");
      const filter = encodeURIComponent(`from:eq:${years}-${months}`);
      const response = await fetch(
        `${SLGS_TIME_RATES_URL}?filter=${filter}&page[size]=250&sort=-record_date`,
        { signal: AbortSignal.timeout(9_000) }
      );
      if (!response.ok)
        return {
          dataContractId: "municipal-slgs-time-rate-history",
          type: "Time" as const,
          months: input.months,
          observations: [],
        };
      const body = (await response.json()) as { data?: RawSlgsTimeRate[] };
      const observations = (body.data ?? [])
        .map(parseSlgsTimeRate)
        .filter((row): row is SlgsTimeRate => row !== null)
        .sort((a, b) => a.recordDate.localeCompare(b.recordDate));
      return {
        dataContractId: "municipal-slgs-time-rate-history",
        type: "Time" as const,
        months: input.months,
        observations,
      };
    }),
  getSources: publicProcedure.query(
    async () => (await getMunicipalSnapshot()).sources
  ),
  listViewPresets: protectedProcedure
    .input(z.object({ moduleId: z.enum(MUNICIPAL_RESEARCH_MODULE_IDS) }))
    .query(({ ctx, input }) =>
      listMunicipalResearchViewPresets(ctx.user.id, input.moduleId)
    ),
  saveViewPreset: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        moduleId: z.enum(MUNICIPAL_RESEARCH_MODULE_IDS),
        name: z.string().trim().min(1).max(80),
        windowSize: z.union([z.literal(5), z.literal(10), z.literal(30)]),
        bucketId: z.string().trim().max(24).nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      saveMunicipalResearchViewPreset({ ...input, userId: ctx.user.id })
    ),
  setViewPresetDefault: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      setMunicipalResearchViewPresetDefault(ctx.user.id, input.id)
    ),
  markViewPresetUsed: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      markMunicipalResearchViewPresetUsed(ctx.user.id, input.id)
    ),
  deleteViewPreset: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      deleteMunicipalResearchViewPreset(ctx.user.id, input.id)
    ),
  exportViewPresets: protectedProcedure.query(({ ctx }) =>
    exportMunicipalResearchViewPresets(ctx.user.id)
  ),
  importViewPresets: protectedProcedure
    .input(
      z.object({
        onConflict: z.enum(["skip", "replace"]).default("skip"),
        exchange: z.object({
          format: z.literal("finance-hub/municipal-research-presets"),
          version: z.literal(1),
          exportedAt: z.string().datetime(),
          presets: z
            .array(
              z.object({
                moduleId: z.enum(MUNICIPAL_RESEARCH_MODULE_IDS),
                name: z.string().trim().min(1).max(80),
                windowSize: z.union([
                  z.literal(5),
                  z.literal(10),
                  z.literal(30),
                ]),
                bucketId: z.string().trim().max(24).nullable(),
                isDefault: z.boolean(),
              })
            )
            .max(200),
        }),
      })
    )
    .mutation(({ ctx, input }) =>
      importMunicipalResearchViewPresets(
        ctx.user.id,
        input.exchange,
        input.onConflict
      )
    ),
});
