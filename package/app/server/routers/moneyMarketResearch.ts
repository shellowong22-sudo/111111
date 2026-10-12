import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { listChecklistMemberDirectory } from "../db";
import {
  deleteGcReportTemplate,
  listGcReportTemplates,
  listGcTemplateReviews,
  listGcTemplateShares,
  revokeGcTemplateShare,
  saveGcReportTemplate,
  saveGcTemplateReview,
  saveGcTemplateShare,
  searchGcTeamTemplateDirectory,
  setDefaultGcReportTemplate,
} from "../gcTemplateCollaborationDb";
import {
  deleteMktbeatNotificationRule,
  getMktbeatDigestEventDetails,
  listMktbeatNotificationRules,
  MKTBEAT_SERIES_IDS,
  processMktbeatThresholdNotifications,
  saveMktbeatNotificationRule,
} from "../mktbeatNotificationDb";
import {
  copySourceRules,
  deleteSourceFreshnessNotificationRule,
  listSourceFreshnessNotificationRules,
  listSourceRuleShares,
  revokeSourceRuleShare,
  saveSourceFreshnessNotificationRule,
  shareSourceRule,
  SOURCE_FRESHNESS_SERIES_IDS,
  updateSharedSourceFreshnessNotificationRule,
} from "../sourceFreshnessNotificationDb";
import {
  compareMmflowVersions,
  listMmflowDeliveryPackages,
  listMmflowDeliveryReviews,
  listMmflowDeliveryShares,
  listMmflowVersions,
  revokeMmflowDeliveryShare,
  saveMmflowDeliveryPackage,
  saveMmflowDeliveryReview,
  saveMmflowDeliveryShare,
  setMmflowApprovalDeadline,
  submitMmflowDeliveryPackage,
} from "../mmflowDeliveryDb";
import {
  listMmResearchPathFavorites,
  recordMmResearchPathUsage,
  toggleMmResearchPathFavorite,
} from "../mmResearchPathDb";
import {
  listMoneyMarketModuleDiagnostics,
  listMoneyMarketSourceAvailabilityHistory,
  recordMoneyMarketModuleUsage,
  recordMoneyMarketSourceAvailability,
  type MoneyMarketModuleId,
  type SourceAvailabilityProbe,
} from "../moneyMarketObservabilityDb";
import { pushNotificationToUser } from "../uploadAndSse";

const FRED_SERIES = [
  {
    id: "SOFR",
    label: "SOFR",
    category: "担保隔夜融资",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/SOFR",
  },
  {
    id: "EFFR",
    label: "EFFR",
    category: "有效联邦基金利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/EFFR",
  },
  {
    id: "OBFR",
    label: "OBFR",
    category: "隔夜银行融资利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/OBFR",
  },
  {
    id: "IORB",
    label: "IORB",
    category: "准备金余额利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/IORB",
  },
  {
    id: "RRPONTSYD",
    label: "ON RRP 使用量",
    category: "隔夜逆回购余额",
    unit: "USD bn",
    sourceUrl: "https://fred.stlouisfed.org/series/RRPONTSYD",
  },
  {
    id: "SOFRVOL",
    label: "SOFR 成交量",
    category: "SOFR 合格交易规模",
    unit: "USD bn",
    sourceUrl: "https://fred.stlouisfed.org/series/SOFRVOL",
  },
  {
    id: "EFFRVOL",
    label: "联邦基金成交量",
    category: "有效联邦基金交易规模",
    unit: "USD bn",
    sourceUrl: "https://fred.stlouisfed.org/series/EFFRVOL",
  },
  {
    id: "DTB4WK",
    label: "4W T-Bill",
    category: "4 周国库券二级市场收益率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/DTB4WK",
  },
  {
    id: "DTB3",
    label: "3M T-Bill",
    category: "3 个月国库券二级市场收益率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/DTB3",
  },
  {
    id: "DTB6",
    label: "6M T-Bill",
    category: "6 个月国库券二级市场收益率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/DTB6",
  },
  {
    id: "DCPF3M",
    label: "3M 金融商业票据",
    category: "AA 级金融商业票据利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/DCPF3M",
  },
  {
    id: "DCPN3M",
    label: "3M 非金融商业票据",
    category: "AA 级非金融商业票据利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/DCPN3M",
  },
  {
    id: "ECBDFR",
    label: "ECB 存款便利",
    category: "欧元体系存款便利利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/ECBDFR",
  },
  {
    id: "ECBMRRFR",
    label: "ECB 主要再融资",
    category: "欧元体系主要再融资利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/ECBMRRFR",
  },
  {
    id: "ECBMLFR",
    label: "ECB 边际贷款",
    category: "欧元体系边际贷款便利利率",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/ECBMLFR",
  },
  {
    id: "IRSTCI01GBM156N",
    label: "英国短期利率",
    category: "OECD 英国短期利率月度观察",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01GBM156N",
  },
  {
    id: "IRSTCI01CAM156N",
    label: "加拿大短期利率",
    category: "OECD 加拿大短期利率月度观察",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01CAM156N",
  },
  {
    id: "IRSTCI01AUM156N",
    label: "澳大利亚短期利率",
    category: "OECD 澳大利亚短期利率月度观察",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01AUM156N",
  },
  {
    id: "IR3TIB01JPM156N",
    label: "日本 3M 银行间利率",
    category: "OECD 日本三个月银行间利率月度观察",
    unit: "%",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01JPM156N",
  },
] as const;

export type MoneyMarketRateSeries = {
  id: string;
  label: string;
  category: string;
  unit: string;
  sourceUrl: string;
  observationDate: string | null;
  value: number | null;
  changeBps: number | null;
  history: Array<{ date: string; value: number }>;
  status: "available" | "unavailable";
  limitation: string;
};
type TreasuryAuction = {
  cusip: string | null;
  securityType: string | null;
  securityTerm: string | null;
  auctionDate: string | null;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: string | null;
  sourceUrl: string;
};
type CdiPoint = { date: string; valuePct: number };
type TaiwanPoint = { date: string; valuePct: number };
export type NyFedFundingPoint = {
  date: string;
  product: "SOFR" | "EFFR" | "OBFR";
  ratePct: number | null;
  volumeBn: number | null;
  p1Pct: number | null;
  p25Pct: number | null;
  p75Pct: number | null;
  p99Pct: number | null;
  targetLowPct: number | null;
  targetHighPct: number | null;
  revision: string;
};

function csvPoints(csv: string) {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .flatMap(line => {
      const [date, raw] = line.split(",");
      const value = Number(raw);
      return date && raw && raw !== "." && Number.isFinite(value)
        ? [{ date: date.trim(), value }]
        : [];
    });
}
async function fetchPublicResponse(url: string, timeoutMs = 4_500) {
  let lastError: unknown = new Error("公开来源读取失败");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(String(response.status));
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
export function parseFredMoneyMarketCsv(
  csv: string,
  def: (typeof FRED_SERIES)[number]
): MoneyMarketRateSeries {
  const currentDate = new Date().toISOString().slice(0, 10);
  const points = csvPoints(csv).filter(point => point.date <= currentDate);
  const latest = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;
  const isRate = def.unit !== "USD bn";
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    unit: def.unit,
    sourceUrl: def.sourceUrl,
    observationDate: latest?.date ?? null,
    value: latest?.value ?? null,
    changeBps:
      latest && previous && isRate
        ? Number(((latest.value - previous.value) * 100).toFixed(1))
        : null,
    history: points.slice(-180),
    status: latest ? "available" : "unavailable",
    limitation: isRate
      ? "FRED 公开历史观察，不是实时银行间可执行报价或个体机构融资成本。"
      : "公开统计量，单位和发布时间以原始序列为准；不是价格、利率或订单簿深度。",
  };
}
async function fetchFred(def: (typeof FRED_SERIES)[number]) {
  try {
    const response = await fetchPublicResponse(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${def.id}`
    );
    return parseFredMoneyMarketCsv(await response.text(), def);
  } catch {
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      unit: def.unit,
      sourceUrl: def.sourceUrl,
      observationDate: null,
      value: null,
      changeBps: null,
      history: [],
      status: "unavailable" as const,
      limitation:
        "当前无法读取公开原始序列；系统不使用缓存样本、随机路径或替代报价填充。",
    };
  }
}
async function fetchTreasuryAuctions(): Promise<TreasuryAuction[]> {
  const sourceUrl =
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";
  try {
    const response = await fetch(
      `${sourceUrl}?page[size]=50&sort=-auction_date`,
      { signal: AbortSignal.timeout(3_000) }
    );
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as {
      data?: Record<string, string | null>[];
    };
    return (body.data ?? [])
      .filter(item =>
        String(item.security_type ?? "")
          .toLowerCase()
          .includes("bill")
      )
      .slice(0, 20)
      .map(item => ({
        cusip: item.cusip ?? null,
        securityType: item.security_type ?? null,
        securityTerm: item.security_term ?? null,
        auctionDate: item.auction_date ?? null,
        issueDate: item.issue_date ?? null,
        maturityDate: item.maturity_date ?? null,
        offeringAmount: item.offering_amt ?? null,
        sourceUrl,
      }));
  } catch {
    return [];
  }
}
const AUCTION_SOURCE_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";
const auctionRangeCache = new Map<
  string,
  { at: number; events: TreasuryAuction[] }
>();
function mapTreasuryAuction(
  item: Record<string, string | null>
): TreasuryAuction {
  return {
    cusip: item.cusip ?? null,
    securityType: item.security_type ?? null,
    securityTerm: item.security_term ?? null,
    auctionDate: item.auction_date ?? null,
    issueDate: item.issue_date ?? null,
    maturityDate: item.maturity_date ?? null,
    offeringAmount: item.offering_amt ?? null,
    sourceUrl: AUCTION_SOURCE_URL,
  };
}
async function fetchTreasuryAuctionRange(
  startDate: string,
  endDate: string
): Promise<TreasuryAuction[]> {
  const key = `${startDate}:${endDate}`;
  const cachedRange = auctionRangeCache.get(key);
  if (cachedRange && Date.now() - cachedRange.at < 60_000)
    return cachedRange.events;
  try {
    const params = new URLSearchParams({
      "page[size]": "1000",
      sort: "auction_date",
      filter: `auction_date:gte:${startDate},auction_date:lte:${endDate}`,
    });
    const response = await fetch(`${AUCTION_SOURCE_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as {
      data?: Record<string, string | null>[];
    };
    const events = (body.data ?? [])
      .filter(item =>
        String(item.security_type ?? "")
          .toLowerCase()
          .includes("bill")
      )
      .map(mapTreasuryAuction);
    auctionRangeCache.set(key, { at: Date.now(), events });
    return events;
  } catch {
    return [];
  }
}
function toIsoBrazilDate(value: string) {
  const [day, month, year] = value.split("/");
  return day && month && year ? `${year}-${month}-${day}` : null;
}
async function fetchCdi(): Promise<CdiPoint[]> {
  try {
    const response = await fetch(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/20?formato=json",
      { signal: AbortSignal.timeout(3_000) }
    );
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as Array<{
      data?: string;
      valor?: string;
    }>;
    return body.flatMap(item => {
      const date = item.data ? toIsoBrazilDate(item.data) : null;
      const valuePct = Number(item.valor);
      return date && Number.isFinite(valuePct) ? [{ date, valuePct }] : [];
    });
  } catch {
    return [];
  }
}
async function fetchTaiwanCallRate(): Promise<TaiwanPoint[]> {
  try {
    const response = await fetch("https://www.cbc.gov.tw/en/lp-696-2.html", {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    const matches = [
      ...html.matchAll(
        /(20\d{2})\/(\d{2})\/(\d{2})[\s\S]{0,300}?>(\d+\.\d+)</g
      ),
    ];
    const seen = new Set<string>();
    return matches
      .flatMap(match => {
        const date = `${match[1]}-${match[2]}-${match[3]}`;
        const valuePct = Number(match[4]);
        return !seen.has(date) && Number.isFinite(valuePct)
          ? (seen.add(date), [{ date, valuePct }])
          : [];
      })
      .slice(0, 60)
      .reverse();
  } catch {
    return [];
  }
}

const NYFED_FUNDING_SOURCE = "https://markets.newyorkfed.org/api/rates";
export function mapNyFedPoint(
  item: Record<string, unknown>,
  product: NyFedFundingPoint["product"]
): NyFedFundingPoint | null {
  const date =
    typeof item.effectiveDate === "string" ? item.effectiveDate : null;
  if (!date) return null;
  const numberOrNull = (value: unknown) => {
    const parsed = Number(value);
    return value == null || value === "" || !Number.isFinite(parsed)
      ? null
      : parsed;
  };
  return {
    date,
    product,
    ratePct: numberOrNull(item.percentRate),
    volumeBn: numberOrNull(item.volumeInBillions),
    p1Pct: numberOrNull(item.percentPercentile1),
    p25Pct: numberOrNull(item.percentPercentile25),
    p75Pct: numberOrNull(item.percentPercentile75),
    p99Pct: numberOrNull(item.percentPercentile99),
    targetLowPct: numberOrNull(item.targetRateFrom),
    targetHighPct: numberOrNull(item.targetRateTo),
    revision:
      typeof item.revisionIndicator === "string" ? item.revisionIndicator : "",
  };
}
async function fetchNyFedFunding(): Promise<NyFedFundingPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 180 * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const requests: Array<{
    product: NyFedFundingPoint["product"];
    path: string;
  }> = [
    { product: "SOFR", path: "secured/sofr" },
    { product: "EFFR", path: "unsecured/effr" },
    { product: "OBFR", path: "unsecured/obfr" },
  ];
  const responses = await Promise.all(
    requests.map(async ({ product, path }) => {
      try {
        const response = await fetchPublicResponse(
          `${NYFED_FUNDING_SOURCE}/${path}/search.json?startDate=${startDate}&endDate=${endDate}&type=all`
        );
        const body = (await response.json()) as {
          refRates?: Record<string, unknown>[];
        };
        return (body.refRates ?? []).flatMap(item => {
          const point = mapNyFedPoint(item, product);
          return point ? [point] : [];
        });
      } catch {
        return [];
      }
    })
  );
  return responses
    .flat()
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.product.localeCompare(right.product)
    );
}

export const MONEY_MARKET_SOURCES = [
  {
    id: "FRED-SOFR",
    label: "FRED · SOFR",
    region: "美国",
    frequency: "日度",
    url: "https://fred.stlouisfed.org/series/SOFR",
    scope: "公开隔夜担保融资利率历史观察",
  },
  {
    id: "FRED-EFFR",
    label: "FRED · EFFR",
    region: "美国",
    frequency: "日度",
    url: "https://fred.stlouisfed.org/series/EFFR",
    scope: "公开有效联邦基金利率历史观察",
  },
  {
    id: "NYFED-FUNDING",
    label: "纽约联储 · 隔夜融资基准与成交量",
    region: "美国",
    frequency: "工作日",
    url: "https://www.newyorkfed.org/markets/reference-rates/sofr",
    scope: "SOFR、EFFR、OBFR 及相关合格交易规模与分位历史观察",
  },
  {
    id: "FRED-COMMERCIAL-PAPER",
    label: "美联储 · 商业票据利率",
    region: "美国",
    frequency: "工作日",
    url: "https://fred.stlouisfed.org/categories/32212",
    scope: "AA 级金融与非金融商业票据公开利率",
  },
  {
    id: "ECB-POLICY-CORRIDOR",
    label: "欧洲央行 · 政策利率走廊",
    region: "欧元区",
    frequency: "工作日",
    url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
    scope: "存款便利、主要再融资和边际贷款便利利率",
  },
  {
    id: "OECD-SHORT-RATES",
    label: "OECD · 全球短期利率",
    region: "全球",
    frequency: "月度",
    url: "https://data-explorer.oecd.org/",
    scope: "英国、加拿大、澳大利亚和日本短期货币市场观察",
  },
  {
    id: "TREASURY-AUCTIONS",
    label: "US Treasury Fiscal Data · Auctions",
    region: "美国",
    frequency: "按需要",
    url: "https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/",
    scope: "美国可交易国债公告与拍卖记录",
  },
  {
    id: "BCB-CDI",
    label: "Banco Central do Brasil SGS · CDI",
    region: "巴西",
    frequency: "日度",
    url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/20?formato=json",
    scope: "公开 CDI 日度观察",
  },
  {
    id: "CBC-CALL",
    label: "Central Bank of Taiwan · Overnight Call",
    region: "台湾",
    frequency: "日度",
    url: "https://www.cbc.gov.tw/en/lp-696-2.html",
    scope: "公开银行间隔夜拆款观察",
  },
  {
    id: "PBOC",
    label: "People’s Bank of China",
    region: "中国",
    frequency: "依公告",
    url: "https://www.pbc.gov.cn/en/3688006/index.html",
    scope: "原始政策与公开市场公告索引",
  },
  {
    id: "EFSF",
    label: "EFSF Official Website",
    region: "欧元区",
    frequency: "依披露",
    url: "https://www.efsf.europa.eu/",
    scope: "EMTN 与机构资料原件导航",
  },
] as const;

type Snapshot = {
  asOf: string;
  rates: MoneyMarketRateSeries[];
  treasuryAuctions: TreasuryAuction[];
  cdi: CdiPoint[];
  taiwanCallRate: TaiwanPoint[];
  fundingTape: NyFedFundingPoint[];
  sourceLatencyMs: Record<string, number | null>;
  sources: typeof MONEY_MARKET_SOURCES;
};
let cached: Snapshot | null = null;
let cachedAt = 0;
let active: Promise<Snapshot> | null = null;
async function measurePublicRead<T>(read: () => Promise<T>) {
  const startedAt = Date.now();
  const value = await read();
  return { value, latencyMs: Math.max(0, Date.now() - startedAt) };
}
export async function getMoneyMarketSnapshot(): Promise<Snapshot> {
  const now = Date.now();
  if (cached && now - cachedAt < 30_000) return cached;
  if (active) return active;
  active = Promise.all([
    Promise.all(
      FRED_SERIES.map(async def => ({
        id: def.id,
        ...(await measurePublicRead(() => fetchFred(def))),
      }))
    ),
    measurePublicRead(fetchTreasuryAuctions),
    measurePublicRead(fetchCdi),
    measurePublicRead(fetchTaiwanCallRate),
  ])
    .then(([fredReads, treasuryRead, cdiRead, taiwanRead]) => {
      const rates = fredReads.map(({ value }) => value);
      const sourceLatencyMs: Record<string, number | null> = {
        "FRED-SOFR":
          fredReads.find(item => item.id === "SOFR")?.latencyMs ?? null,
        "FRED-EFFR":
          fredReads.find(item => item.id === "EFFR")?.latencyMs ?? null,
        "NYFED-FUNDING": null,
        "TREASURY-AUCTIONS": treasuryRead.latencyMs,
        "BCB-CDI": cdiRead.latencyMs,
        "CBC-CALL": taiwanRead.latencyMs,
      };
      const snapshot = {
        asOf: new Date().toISOString(),
        rates,
        treasuryAuctions: treasuryRead.value,
        cdi: cdiRead.value,
        taiwanCallRate: taiwanRead.value,
        fundingTape: [] as NyFedFundingPoint[],
        sourceLatencyMs,
        sources: MONEY_MARKET_SOURCES,
      };
      cached = snapshot;
      cachedAt = Date.now();
      return snapshot;
    })
    .finally(() => {
      active = null;
    });
  return active;
}

export function availabilityProbesFromMoneyMarketSnapshot(
  snapshot: Snapshot
): SourceAvailabilityProbe[] {
  const rate = (id: string) => snapshot.rates.find(item => item.id === id);
  const probe = (
    sourceId: string,
    sourceLabel: string,
    available: boolean,
    recordCount: number
  ): SourceAvailabilityProbe => ({
    sourceId,
    sourceLabel,
    status: available ? "available" : "unavailable",
    recordCount,
    latencyMs: snapshot.sourceLatencyMs[sourceId] ?? null,
  });
  const sofr = rate("SOFR");
  const effr = rate("EFFR");
  const commercialPaper = ["DCPF3M", "DCPN3M"]
    .map(rate)
    .filter(Boolean) as MoneyMarketRateSeries[];
  const ecb = ["ECBDFR", "ECBMRRFR", "ECBMLFR"]
    .map(rate)
    .filter(Boolean) as MoneyMarketRateSeries[];
  const oecd = [
    "IRSTCI01GBM156N",
    "IRSTCI01CAM156N",
    "IRSTCI01AUM156N",
    "IR3TIB01JPM156N",
  ]
    .map(rate)
    .filter(Boolean) as MoneyMarketRateSeries[];
  return [
    probe(
      "FRED-SOFR",
      "FRED · SOFR",
      sofr?.status === "available",
      sofr?.history.length ?? 0
    ),
    probe(
      "FRED-EFFR",
      "FRED · EFFR",
      effr?.status === "available",
      effr?.history.length ?? 0
    ),
    probe("NYFED-FUNDING", "隔夜融资基准与成交量", false, 0),
    probe(
      "FRED-COMMERCIAL-PAPER",
      "美联储 · 商业票据利率",
      commercialPaper.some(item => item.status === "available"),
      commercialPaper.reduce((sum, item) => sum + item.history.length, 0)
    ),
    probe(
      "ECB-POLICY-CORRIDOR",
      "欧洲央行 · 政策利率走廊",
      ecb.some(item => item.status === "available"),
      ecb.reduce((sum, item) => sum + item.history.length, 0)
    ),
    probe(
      "OECD-SHORT-RATES",
      "OECD · 全球短期利率",
      oecd.some(item => item.status === "available"),
      oecd.reduce((sum, item) => sum + item.history.length, 0)
    ),
    probe(
      "TREASURY-AUCTIONS",
      "US Treasury Fiscal Data · Auctions",
      snapshot.treasuryAuctions.length > 0,
      snapshot.treasuryAuctions.length
    ),
    probe(
      "BCB-CDI",
      "Banco Central do Brasil SGS · CDI",
      snapshot.cdi.length > 0,
      snapshot.cdi.length
    ),
    probe(
      "CBC-CALL",
      "Central Bank of Taiwan · Overnight Call",
      snapshot.taiwanCallRate.length > 0,
      snapshot.taiwanCallRate.length
    ),
  ];
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moneyMarketModuleId = z.enum([
  "des-mm",
  "pgm",
  "mktbeat",
  "btmm",
  "boom",
  "tcon",
  "rv",
  "ycqsim",
  "gc",
  "crvf-mmkt",
  "crvf",
  "fibc",
  "cdie",
  "efsf",
  "mmidx",
  "etrade",
  "edsf",
  "wbf",
  "pboc",
  "twdi",
  "cenb",
  "news-mm",
  "source-mm",
  "mmflow",
]);
export const moneyMarketResearchRouter = router({
  getSnapshot: publicProcedure.query(async () => {
    const snapshot = await getMoneyMarketSnapshot();
    await recordMoneyMarketSourceAvailability(
      availabilityProbesFromMoneyMarketSnapshot(snapshot)
    ).catch(() => undefined);
    return snapshot;
  }),
  getSources: publicProcedure.query(() => ({
    asOf: new Date().toISOString(),
    sources: MONEY_MARKET_SOURCES,
  })),
  listSourceAvailabilityHistory: publicProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(14) }))
    .query(({ input }) => listMoneyMarketSourceAvailabilityHistory(input.days)),
  listModuleDiagnostics: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(30) }))
    .query(({ ctx, input }) =>
      listMoneyMarketModuleDiagnostics(ctx.user.id, input.days)
    ),
  recordModuleUsage: protectedProcedure
    .input(z.object({ moduleId: moneyMarketModuleId }))
    .mutation(({ ctx, input }) =>
      recordMoneyMarketModuleUsage(
        ctx.user.id,
        input.moduleId as MoneyMarketModuleId
      )
    ),
  getAuctionRange: publicProcedure
    .input(
      z
        .object({ startDate: isoDate, endDate: isoDate })
        .refine(value => value.startDate <= value.endDate, {
          message: "起始日必须早于或等于结束日",
        })
        .refine(
          value =>
            new Date(value.endDate).getTime() -
              new Date(value.startDate).getTime() <=
            730 * 86_400_000,
          { message: "单次比较区间不得超过 730 天" }
        )
    )
    .query(async ({ input }) => ({
      asOf: new Date().toISOString(),
      startDate: input.startDate,
      endDate: input.endDate,
      events: await fetchTreasuryAuctionRange(input.startDate, input.endDate),
      sourceUrl: AUCTION_SOURCE_URL,
      limitation:
        "仅返回美国财政部公开、已发布且标为 Bill 的拍卖记录；接口暂不可读或没有匹配记录时返回空数组，不推断发行计划。",
    })),
  listGcTemplates: protectedProcedure.query(({ ctx }) =>
    listGcReportTemplates(ctx.user.id)
  ),
  searchGcTeamTemplateDirectory: protectedProcedure
    .input(
      z.object({
        keyword: z.string().trim().max(80).default(""),
        limit: z.number().int().min(1).max(30).default(12),
      })
    )
    .query(({ ctx, input }) =>
      searchGcTeamTemplateDirectory(ctx.user.id, input.keyword, input.limit)
    ),
  saveGcTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(96),
        headerText: z.string().trim().min(1).max(80),
        researchIdPrefix: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{2,32}$/),
        footerText: z.string().trim().min(1).max(160),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) =>
      saveGcReportTemplate({ ...input, userId: ctx.user.id })
    ),
  deleteGcTemplate: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      deleteGcReportTemplate(ctx.user.id, input.templateId)
    ),
  setDefaultGcTemplate: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      setDefaultGcReportTemplate(ctx.user.id, input.templateId)
    ),
  searchGcTemplateMembers: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().max(80).default(""),
        limit: z.number().int().min(1).max(30).default(12),
      })
    )
    .query(({ ctx, input }) =>
      listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)
    ),
  listGcTemplateShares: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listGcTemplateShares(ctx.user.id, input.templateId)
    ),
  saveGcTemplateShare: protectedProcedure
    .input(
      z.object({
        templateId: z.number().int().positive(),
        sharedWithUserId: z.number().int().positive(),
        permission: z.enum(["viewer", "editor", "reviewer"]),
      })
    )
    .mutation(({ ctx, input }) => saveGcTemplateShare(ctx.user.id, input)),
  revokeGcTemplateShare: protectedProcedure
    .input(
      z.object({
        templateId: z.number().int().positive(),
        sharedWithUserId: z.number().int().positive(),
      })
    )
    .mutation(({ ctx, input }) =>
      revokeGcTemplateShare(
        ctx.user.id,
        input.templateId,
        input.sharedWithUserId
      )
    ),
  listGcTemplateReviews: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listGcTemplateReviews(ctx.user.id, input.templateId)
    ),
  saveGcTemplateReview: protectedProcedure
    .input(
      z.object({
        templateId: z.number().int().positive(),
        status: z.enum(["pending", "approved", "changes_requested"]),
        reviewNote: z.string().trim().max(4000).nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) => saveGcTemplateReview(ctx.user.id, input)),
  listMktbeatNotificationRules: protectedProcedure.query(({ ctx }) =>
    listMktbeatNotificationRules(ctx.user.id)
  ),
  getMktbeatDigestEventDetails: protectedProcedure
    .input(z.object({ notificationId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      getMktbeatDigestEventDetails(ctx.user.id, input.notificationId)
    ),
  saveMktbeatNotificationRule: protectedProcedure
    .input(
      z.object({
        seriesId: z.enum(MKTBEAT_SERIES_IDS),
        isActive: z.boolean().default(true),
        quietStart: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .optional(),
        quietEnd: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .optional(),
        timezone: z
          .string()
          .min(1)
          .max(64)
          .refine(value => {
            try {
              Intl.DateTimeFormat(undefined, { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }, "无效时区"),
        digestMode: z
          .enum(["after_quiet", "daily", "weekly", "none"])
          .default("after_quiet"),
      })
    )
    .mutation(({ ctx, input }) =>
      saveMktbeatNotificationRule(ctx.user.id, input)
    ),
  deleteMktbeatNotificationRule: protectedProcedure
    .input(z.object({ seriesId: z.enum(MKTBEAT_SERIES_IDS) }))
    .mutation(({ ctx, input }) =>
      deleteMktbeatNotificationRule(ctx.user.id, input.seriesId)
    ),
  listSourceFreshnessNotificationRules: protectedProcedure.query(({ ctx }) =>
    listSourceFreshnessNotificationRules(ctx.user.id)
  ),
  saveSourceFreshnessNotificationRule: protectedProcedure
    .input(
      z.object({
        sourceId: z.enum(SOURCE_FRESHNESS_SERIES_IDS),
        thresholdDays: z.number().int().min(0).max(365),
        isActive: z.boolean().default(true),
        timezone: z
          .string()
          .min(1)
          .max(64)
          .refine(value => {
            try {
              Intl.DateTimeFormat(undefined, { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }, "无效时区"),
        digestMode: z.enum(["immediate", "daily"]).default("immediate"),
      })
    )
    .mutation(({ ctx, input }) =>
      saveSourceFreshnessNotificationRule(ctx.user.id, input)
    ),
  deleteSourceFreshnessNotificationRule: protectedProcedure
    .input(z.object({ sourceId: z.enum(SOURCE_FRESHNESS_SERIES_IDS) }))
    .mutation(({ ctx, input }) =>
      deleteSourceFreshnessNotificationRule(ctx.user.id, input.sourceId)
    ),
  updateSharedSourceFreshnessNotificationRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number().int().positive(),
        thresholdDays: z.number().int().min(0).max(365),
        isActive: z.boolean(),
        timezone: z
          .string()
          .min(1)
          .max(64)
          .refine(value => {
            try {
              Intl.DateTimeFormat(undefined, { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }, "无效时区"),
        digestMode: z.enum(["immediate", "daily"]),
      })
    )
    .mutation(({ ctx, input }) =>
      updateSharedSourceFreshnessNotificationRule(ctx.user.id, input)
    ),
  searchSourceRuleMembers: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().max(80).default(""),
        limit: z.number().int().min(1).max(30).default(12),
      })
    )
    .query(({ ctx, input }) =>
      listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)
    ),
  listSourceRuleShares: protectedProcedure
    .input(z.object({ ruleId: z.number().int().positive() }))
    .query(({ ctx, input }) => listSourceRuleShares(ctx.user.id, input.ruleId)),
  shareSourceRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number().int().positive(),
        sharedWithUserId: z.number().int().positive(),
        permission: z.enum(["viewer", "editor"]),
      })
    )
    .mutation(({ ctx, input }) => shareSourceRule(ctx.user.id, input)),
  revokeSourceRuleShare: protectedProcedure
    .input(
      z.object({
        ruleId: z.number().int().positive(),
        sharedWithUserId: z.number().int().positive(),
      })
    )
    .mutation(({ ctx, input }) =>
      revokeSourceRuleShare(ctx.user.id, input.ruleId, input.sharedWithUserId)
    ),
  copySourceRules: protectedProcedure
    .input(
      z.object({
        ruleIds: z
          .array(z.number().int().positive())
          .min(1)
          .max(SOURCE_FRESHNESS_SERIES_IDS.length),
        targetUserId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await copySourceRules(ctx.user.id, input);
      result.emitted.forEach(notification =>
        pushNotificationToUser(notification.userId, notification)
      );
      return result;
    }),
  listMmResearchPathFavorites: protectedProcedure.query(({ ctx }) =>
    listMmResearchPathFavorites(ctx.user.id)
  ),
  toggleMmResearchPathFavorite: protectedProcedure
    .input(
      z.object({
        fromModuleId: moneyMarketModuleId,
        toModuleId: moneyMarketModuleId,
      })
    )
    .mutation(({ ctx, input }) =>
      toggleMmResearchPathFavorite(ctx.user.id, input)
    ),
  recordMmResearchPathUsage: protectedProcedure
    .input(
      z.object({
        fromModuleId: moneyMarketModuleId,
        toModuleId: moneyMarketModuleId,
      })
    )
    .mutation(({ ctx, input }) =>
      recordMmResearchPathUsage(ctx.user.id, input)
    ),
  listMmflowDeliveryPackages: protectedProcedure.query(({ ctx }) =>
    listMmflowDeliveryPackages(ctx.user.id)
  ),
  saveMmflowDeliveryPackage: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(120),
        sourceIds: z
          .array(
            z.enum([
              "FRED-SOFR",
              "FRED-EFFR",
              "NYFED-FUNDING",
              "FRED-COMMERCIAL-PAPER",
              "ECB-POLICY-CORRIDOR",
              "OECD-SHORT-RATES",
              "TREASURY-AUCTIONS",
              "BCB-CDI",
              "CBC-CALL",
              "PBOC",
              "EFSF",
            ])
          )
          .min(1)
          .max(11),
      })
    )
    .mutation(({ ctx, input }) =>
      saveMmflowDeliveryPackage(ctx.user.id, input)
    ),
  searchMmflowDeliveryMembers: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().max(80).default(""),
        limit: z.number().int().min(1).max(30).default(12),
      })
    )
    .query(({ ctx, input }) =>
      listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)
    ),
  listMmflowDeliveryShares: protectedProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listMmflowDeliveryShares(ctx.user.id, input.packageId)
    ),
  saveMmflowDeliveryShare: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        sharedWithUserId: z.number().int().positive(),
        permission: z.enum(["viewer", "editor", "reviewer"]),
      })
    )
    .mutation(({ ctx, input }) => saveMmflowDeliveryShare(ctx.user.id, input)),
  revokeMmflowDeliveryShare: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        sharedWithUserId: z.number().int().positive(),
      })
    )
    .mutation(({ ctx, input }) =>
      revokeMmflowDeliveryShare(
        ctx.user.id,
        input.packageId,
        input.sharedWithUserId
      )
    ),
  listMmflowDeliveryReviews: protectedProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listMmflowDeliveryReviews(ctx.user.id, input.packageId)
    ),
  setMmflowApprovalDeadline: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        approvalDeadlineAt: z.date().nullable(),
      })
    )
    .mutation(({ ctx, input }) =>
      setMmflowApprovalDeadline(ctx.user.id, input)
    ),
  listMmflowVersions: protectedProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      listMmflowVersions(ctx.user.id, input.packageId)
    ),
  compareMmflowVersions: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        leftVersion: z.number().int().positive(),
        rightVersion: z.number().int().positive(),
      })
    )
    .query(({ ctx, input }) => compareMmflowVersions(ctx.user.id, input)),
  submitMmflowDeliveryPackage: protectedProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const result = await submitMmflowDeliveryPackage(
        ctx.user.id,
        input.packageId
      );
      result.emitted.forEach(notification =>
        pushNotificationToUser(notification.userId, notification)
      );
      return result;
    }),
  saveMmflowDeliveryReview: protectedProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        status: z.enum(["approved", "changes_requested"]),
        reviewNote: z.string().trim().max(4000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await saveMmflowDeliveryReview(ctx.user.id, input);
      result.emitted.forEach(notification =>
        pushNotificationToUser(notification.userId, notification)
      );
      return result;
    }),
  triggerMktbeatThresholdNotification: protectedProcedure
    .input(
      z.object({
        alerts: z
          .array(
            z.object({
              seriesId: z.enum(MKTBEAT_SERIES_IDS),
              label: z.string().trim().min(1).max(80),
              windowDays: z.union([
                z.literal(20),
                z.literal(60),
                z.literal(120),
              ]),
              thresholdBps: z.number().finite().min(0).max(10_000),
              observationDate: isoDate,
              changeBps: z.number().finite().min(-10_000).max(10_000),
            })
          )
          .min(1)
          .max(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emitted = await processMktbeatThresholdNotifications(
        ctx.user.id,
        input.alerts
      );
      emitted.forEach(notification =>
        pushNotificationToUser(notification.userId, notification)
      );
      return { emitted: emitted.length };
    }),
});
