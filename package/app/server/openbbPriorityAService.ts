import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { adminDataModuleContentItems, managedPublicDatasetStates, marketDataObservationHistory, users } from "../drizzle/schema";
import { ADMIN_DATA_MODULES } from "../shared/adminDataModules";
import { FINMIND_MODULE_BINDINGS } from "../shared/finmindModuleBindings";
import { economicModuleForOperation } from '../shared/economicDataScopes';
import { ECONOMIC_API_CONTRACTS, economicApiContract } from '../shared/economicApiContracts';
import { getEconomicSeries } from './economicObservationService';
import { deliveryDatasetIdentity } from '../shared/deliveryDatasetIdentity';
import { buildApiCoverage } from './apiCoverage';
import { replaceFileWithRetry } from './atomicFileReplace';
import { WORLD_BANK_CONTRACTS } from '../shared/worldBankContracts';
import { getWorldBankObservationSnapshot } from './worldBankObservationService';
import { getManagedPublicDatasetSchedule, MANAGED_PUBLIC_DATASETS } from './adminPublicDatasetIngestion';
import { getDb } from "./db";
import { FINCEPT_CAPABILITIES } from "../shared/finceptCapabilityCatalog";
import { getFinceptTerminalStatus } from "./finceptTerminalAudit";
import { getFinceptPublicAutoSyncStatus } from "./finceptAutoSync";

type Scalar = string | number | boolean | null;
export type OpenBBParams = Record<string, Scalar>;
export type OpenBBEndpoint = {
  id: string;
  label: string;
  domain: string;
  path: string;
  description: string;
  required: string[];
  allowed: string[];
  defaults: OpenBBParams;
  suggestedModuleIds: string[];
};
export type OpenBBApiCatalogParameter = {
  name: string;
  location: string;
  required: boolean;
  type: string;
  format: string | null;
  defaultValue: Scalar;
  choices: Scalar[];
  description: string | null;
};
export type OpenBBApiCatalogOperation = {
  id: string;
  path: string;
  method: string;
  operationId: string;
  summary: string;
  description: string | null;
  tags: string[];
  parameters: OpenBBApiCatalogParameter[];
  requestBodyRequired: boolean;
  requestBodyType: string | null;
  requestBodyDescription: string | null;
  requestBodyExample: unknown | null;
  responseCodes: string[];
  responseSchema: string | null;
  securityRequired: boolean;
  assetClasses: OpenBBAssetClass[];
  controlledEndpointId: string | null;
  primaryModuleId: string | null;
  shardKey: string;
  dataContractId: string;
  executionState:
    | "controlled_ready"
    | "contract_only"
    | "restricted_write"
    | "restricted_system";
  blockReason: string | null;
};

export type OpenBBAssetClass =
  | "news"
  | "indices"
  | "crypto"
  | "commodities"
  | "bonds"
  | "forex"
  | "etf"
  | "funds"
  | "futures"
  | "options"
  | "equities"
  | "macro"
  | "fundamentals"
  | "regulatory"
  | "other";

export type OpenBBAssetClassSummary = {
  id: OpenBBAssetClass;
  label: string;
  operationCount: number;
  controlledOperationCount: number;
  verifiedOperationCount: number;
  runtimeExposure: "available" | "not_exposed";
  note: string | null;
};

const OPENBB_ASSET_CLASS_DEFINITIONS: ReadonlyArray<{
  id: OpenBBAssetClass;
  label: string;
  note?: string;
}> = [
  { id: "news", label: "新闻" },
  { id: "indices", label: "指数" },
  { id: "crypto", label: "加密货币" },
  { id: "commodities", label: "大宗商品" },
  { id: "bonds", label: "债券" },
  { id: "forex", label: "外汇" },
  { id: "etf", label: "ETF" },
  { id: "funds", label: "基金", note: "当前 OpenBB 运行时未暴露独立基金路由；基金页面仍按既有模块数据合同读取。" },
  { id: "futures", label: "期货" },
  { id: "options", label: "期权" },
  { id: "equities", label: "股票" },
  { id: "macro", label: "宏观经济" },
  { id: "fundamentals", label: "公司基本面" },
  { id: "regulatory", label: "监管与披露" },
  { id: "other", label: "其他" },
];

function classifyOpenBBAssetClasses(apiPath: string, tags: string[]): OpenBBAssetClass[] {
  const normalizedPath = apiPath.toLowerCase();
  const normalizedTags = new Set(tags.map(tag => tag.toLowerCase()));
  const classes: OpenBBAssetClass[] = [];
  const add = (value: OpenBBAssetClass) => {
    if (!classes.includes(value)) classes.push(value);
  };
  if (normalizedTags.has("news") || normalizedPath.includes("/news/")) add("news");
  if (normalizedTags.has("index") || normalizedPath.includes("/index/")) add("indices");
  if (normalizedTags.has("crypto") || normalizedPath.includes("/crypto/")) add("crypto");
  if (normalizedTags.has("commodity") || normalizedPath.includes("/commodity/")) add("commodities");
  if (normalizedTags.has("fixedincome") || normalizedPath.includes("/fixedincome/")) add("bonds");
  if (normalizedTags.has("currency") || normalizedPath.includes("/currency/")) add("forex");
  if (normalizedTags.has("etf") || normalizedPath.includes("/etf/")) add("etf");
  if (/(^|\/)funds?(\/|$)/.test(normalizedPath)) add("funds");
  if (normalizedPath.includes("/derivatives/futures/")) add("futures");
  if (normalizedPath.includes("/derivatives/options/")) add("options");
  if (normalizedTags.has("equity") || normalizedPath.includes("/equity/")) add("equities");
  if (normalizedTags.has("economy") || normalizedTags.has("imf_utils") || normalizedPath.includes("/economy/")) add("macro");
  if (normalizedTags.has("regulators") || normalizedPath.includes("/regulators/")) add("regulatory");
  if (normalizedPath.includes("/equity/fundamental/")) add("fundamentals");
  return classes.length ? classes : ["other"];
}

function summarizeOpenBBAssetClasses(
  operations: OpenBBApiCatalogOperation[],
  verifiedOperationIds: ReadonlySet<string> = new Set()
): OpenBBAssetClassSummary[] {
  return OPENBB_ASSET_CLASS_DEFINITIONS.map(definition => {
    const rows = operations.filter(operation => operation.assetClasses.includes(definition.id));
    return {
      id: definition.id,
      label: definition.label,
      operationCount: rows.length,
      controlledOperationCount: rows.filter(operation => Boolean(operation.controlledEndpointId)).length,
      verifiedOperationCount: rows.filter(operation => verifiedOperationIds.has(operation.operationId)).length,
      runtimeExposure: rows.length ? "available" : "not_exposed",
      note: definition.note ?? null,
    };
  });
}

export type OpenBBApiContractSource = "runtime" | "cached_contract" | "none";

/**
 * A cached OpenAPI document is a browsing contract only.  It must never be
 * presented as an executable runtime: all operations are explicitly marked
 * contract_only until the live OpenBB process has been reached and checked.
 */
export function markOpenBBContractOnly(catalog: ReturnType<typeof buildOpenBBApiCatalog>) {
  const operations = catalog.operations.map(operation => ({
    ...operation,
    controlledEndpointId: null,
    executionState: "contract_only" as const,
    blockReason: "OpenBB 运行时当前不可达；此处仅展示已缓存的真实 OpenAPI 合同，禁止执行。",
  }));
  return {
    ...catalog,
    controlledOperationCount: 0,
    controlledProxyOperationCount: 0,
    dedicatedAdapterCount: 0,
    dedicatedAdapterPercent: 0,
    contractOperationCount: catalog.operationCount,
    contractCoveragePercent: catalog.operationCount ? 100 : 0,
    coveragePercent: 0,
    stateCounts: {
      controlled_ready: 0,
      contract_only: catalog.operations.length,
      restricted_write: 0,
      restricted_system: 0,
    },
    assetClassSummary: summarizeOpenBBAssetClasses(operations),
    operations,
  };
}
export type OpenBBResult = {
  endpointId: string;
  label: string;
  params: OpenBBParams;
  columns: string[];
  rows: Array<Record<string, Scalar>>;
  fields: Array<{
    fieldId: string;
    dataType:
      | "number"
      | "string"
      | "boolean"
      | "date"
      | "datetime"
      | "mixed"
      | "null";
    role: "time" | "measure" | "dimension";
    nonNullCount: number;
    nullCount: number;
  }>;
  metadata: {
    provider: string;
    queriedAt: string;
    observedAt: string | null;
    rangeStart: string | null;
    rangeEnd: string | null;
    timezone: string;
    rowCount: number;
    truncated: boolean;
    numericFieldCount: number;
    nullCellCount: number;
    nullRate: number;
    quality: "provider_response" | "empty_response";
    realtimeStatus: "realtime" | "delayed" | "end_of_day" | "provider_defined";
    schemaVersion: "openbb-query-v1";
    checksum: string;
    observationIdentity?: string;
  };
};
export type OpenBBQueryRun = {
  runId: string;
  status: "running" | "succeeded" | "empty" | "failed" | "not_configured";
  endpointId: string;
  params: OpenBBParams;
  requestBody?: unknown;
  primaryModuleId?: string | null;
  dataContractId?: string;
  createdAt: string;
  startedAt: string;
  completedAt: string | null;
  actorUserId: number;
  command: string;
  error: string | null;
  logs: string[];
  result: OpenBBResult | null;
  push: OpenBBPushRecord | null;
  lastPushAttempt?: OpenBBPushRecord | null;
};

export type OpenBBPushRecord = {
  pushId: string;
  traceId: string;
  idempotencyKey: string;
  status:
    | "waiting_front_ack"
    | "front_acknowledged"
    | "failed"
    | "duplicate_blocked";
  moduleIds: string[];
  recipientUserIds: number[];
  contentKeys: string[];
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  appliedAt: string | null;
  confirmedAt: string | null;
  expiresAt: string;
  contentPreview: string;
  acknowledgement: string;
  targetCount: number;
  sentCount: number;
  successCount: number;
  pendingCount: number;
  failureCount: number;
  duplicateBlockedCount: number;
  retryCount: number;
  failureReason: string | null;
  duplicateOfPushIds?: string[];
};

const ROOT = path.join(process.cwd(), ".runtime", "openbb-admin");
const FILE = path.join(ROOT, "priority-a.json");
const LIVE_OPENAPI_FILE = path.join(ROOT, "live-openapi.json");
const DEFAULT_API = "http://127.0.0.1:6900";

/**
 * These POST routes return provider data or perform a deterministic local
 * transformation. They do not mutate an account, dataset, or runtime. Keep
 * this list explicit so a newly exposed POST never becomes executable by
 * accident.
 */
const SAFE_POST_OPERATION_IDS = new Set([
  "commodity_weather_bulletins_download",
  "derivatives_options_surface",
  "congress_gov_router_bill_text",
  "congress_gov_router_amendment_text",
]);
let writes: Promise<void> = Promise.resolve();
let healthCache: {
  until: number;
  value: Awaited<ReturnType<typeof probeUncached>>;
} | null = null;
let openApiCache: {
  until: number;
  value: Awaited<ReturnType<typeof inspectOpenBBApiUncached>>;
} | null = null;
let managedRuntime: {
  available: boolean;
  status: "idle" | "starting" | "running" | "failed";
  pid: number | null;
  executable: string | null;
  lastAttemptAt: string | null;
  error: string | null;
} = {
  available: false,
  status: "idle",
  pid: null,
  executable: null,
  lastAttemptAt: null,
  error: null,
};
const now = () => new Date().toISOString();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const unique = <T>(values: T[]) => [...new Set(values)];
const OBSERVATION_FIELDS = [
  "date",
  "datetime",
  "timestamp",
  "time",
  "period_ending",
  "fiscal_date_ending",
  "filing_date",
  "published_at",
  "report_period",
  "calendar_date",
] as const;

function latestObservedAt(rows: Array<Record<string, Scalar>>): string | null {
  const observations = rows.flatMap(row => {
    const value = OBSERVATION_FIELDS.map(field => row[field]).find(
      candidate =>
        candidate !== null && candidate !== undefined && candidate !== ""
    );
    if (typeof value !== "string" && typeof value !== "number") return [];
    const parsed = typeof value === "number" ? value : Date.parse(value);
    return [
      {
        value: String(value),
        order: Number.isFinite(parsed) ? parsed : Number.NaN,
      },
    ];
  });
  if (!observations.length) return null;
  const comparable = observations.filter(item => Number.isFinite(item.order));
  if (comparable.length)
    return comparable.reduce((latest, item) =>
      item.order > latest.order ? item : latest
    ).value;
  return observations.at(-1)?.value ?? null;
}

function observationRange(rows: Array<Record<string, Scalar>>) {
  const values = rows.flatMap(row => {
    const value = OBSERVATION_FIELDS.map(field => row[field]).find(
      candidate =>
        candidate !== null && candidate !== undefined && candidate !== ""
    );
    if (typeof value !== "string" && typeof value !== "number") return [];
    const parsed = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(parsed)
      ? [{ value: String(value), order: parsed }]
      : [];
  });
  if (!values.length)
    return {
      rangeStart: null as string | null,
      rangeEnd: null as string | null,
    };
  const sorted = values.sort((left, right) => left.order - right.order);
  return { rangeStart: sorted[0].value, rangeEnd: sorted.at(-1)!.value };
}

function describeFields(
  columns: string[],
  rows: Array<Record<string, Scalar>>
) {
  return columns.map(fieldId => {
    const values = rows.map(row => row[fieldId]);
    const present = values.filter(
      value => value !== null && value !== undefined && value !== ""
    );
    const kinds = unique(
      present.map(value => {
        if (typeof value === "number") return "number" as const;
        if (typeof value === "boolean") return "boolean" as const;
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
          return "date" as const;
        if (
          typeof value === "string" &&
          Number.isFinite(Date.parse(value)) &&
          /[T:]/.test(value)
        )
          return "datetime" as const;
        return "string" as const;
      })
    );
    const dataType =
      present.length === 0
        ? ("null" as const)
        : kinds.length === 1
          ? kinds[0]
          : ("mixed" as const);
    const role =
      OBSERVATION_FIELDS.includes(
        fieldId as (typeof OBSERVATION_FIELDS)[number]
      ) ||
      dataType === "date" ||
      dataType === "datetime"
        ? ("time" as const)
        : dataType === "number"
          ? ("measure" as const)
          : ("dimension" as const);
    return {
      fieldId,
      dataType,
      role,
      nonNullCount: present.length,
      nullCount: values.length - present.length,
    };
  });
}

function repairStoredObservation(run: OpenBBQueryRun): OpenBBQueryRun {
  if (!run.result) return run;
  const observedAt = latestObservedAt(run.result.rows);
  const fields = describeFields(run.result.columns, run.result.rows);
  const { rangeStart, rangeEnd } = observationRange(run.result.rows);
  const nullCellCount = fields.reduce((sum, field) => sum + field.nullCount, 0);
  const cellCount = Math.max(
    1,
    run.result.rows.length * run.result.columns.length
  );
  return {
    ...run,
    result: {
      ...run.result,
      fields,
      metadata: {
        ...run.result.metadata,
        observedAt,
        rangeStart,
        rangeEnd,
        numericFieldCount: fields.filter(field => field.dataType === "number")
          .length,
        nullCellCount,
        nullRate: Number((nullCellCount / cellCount).toFixed(6)),
      },
    },
  };
}

export function openBBDeliveryContentHash(
  moduleId: string,
  resultChecksum: string,
  recipientUserIds: number[]
) {
  const audience = unique(recipientUserIds)
    .sort((left, right) => left - right)
    .join(",");
  return digest(`${moduleId}|${resultChecksum}|users:${audience}`);
}

export function isOpenBBDuplicateKeyError(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: unknown; errno?: unknown; message?: unknown })
      : {};
  const message = typeof value.message === "string" ? value.message : "";
  return (
    value.code === "ER_DUP_ENTRY" ||
    value.errno === 1062 ||
    /\b(?:ER_DUP_ENTRY|Duplicate entry)\b/i.test(message)
  );
}

export const OPENBB_ENDPOINTS: OpenBBEndpoint[] = [
  ...WORLD_BANK_CONTRACTS.map(contract=>({id:contract.id,label:contract.label,domain:'全球年度经济数据',path:`https://api.worldbank.org/v2/country/{country}/indicator/${contract.indicator}`,description:`${contract.unit} / 年度；40国白名单；只投递 ${contract.primaryModuleId}。`,required:[],allowed:['country','start_year','end_year'],defaults:{country:'USA',start_year:2015,end_year:new Date().getUTCFullYear()},suggestedModuleIds:[contract.primaryModuleId]})),
  ...ECONOMIC_API_CONTRACTS.map(contract => ({
    id:contract.id,label:contract.label,domain:'官方经济观察',path:contract.endpoint,
    description:`${contract.unit} / ${contract.frequency}；唯一发布目标 ${contract.primaryModuleId}；共享输入读取不复制投递。`,
    required:[],allowed:[],defaults:{},suggestedModuleIds:[contract.primaryModuleId],
  })),
  {
    id: "equity_price_historical",
    label: "股票历史行情",
    domain: "股票",
    path: "/api/v1/equity/price/historical",
    description: "开高低收、成交量及复权价格时间序列。",
    required: ["symbol"],
    allowed: ["symbol", "provider", "start_date", "end_date", "interval"],
    defaults: { symbol: "AAPL", provider: "yfinance", interval: "1d" },
    suggestedModuleIds: ["equity-market"],
  },
  {
    id: "equity_price_quote",
    label: "股票报价快照",
    domain: "股票",
    path: "/api/v1/equity/price/quote",
    description: "报价、涨跌、成交量和市场时点快照。",
    required: ["symbol"],
    allowed: ["symbol", "provider"],
    defaults: { symbol: "AAPL", provider: "yfinance" },
    suggestedModuleIds: ["equity-market"],
  },
  {
    id: "equity_profile",
    label: "公司证券资料",
    domain: "股票",
    path: "/api/v1/equity/profile",
    description: "公司、行业、交易所、市值及证券基础资料。",
    required: ["symbol"],
    allowed: ["symbol", "provider"],
    defaults: { symbol: "AAPL", provider: "yfinance" },
    suggestedModuleIds: ["equity-market"],
  },
  {
    id: "index_price_historical",
    label: "指数历史行情",
    domain: "指数",
    path: "/api/v1/index/price/historical",
    description: "全球指数价格、收益与成交时间序列。",
    required: ["symbol"],
    allowed: ["symbol", "provider", "start_date", "end_date", "interval"],
    defaults: { symbol: "SPX", provider: "yfinance", interval: "1d" },
    suggestedModuleIds: ["index-hub"],
  },
  {
    id: "currency_price_historical",
    label: "外汇历史行情",
    domain: "外汇",
    path: "/api/v1/currency/price/historical",
    description: "货币对历史价格与波动序列。",
    required: ["symbol"],
    allowed: ["symbol", "provider", "start_date", "end_date", "interval"],
    defaults: { symbol: "EURUSD", provider: "yfinance", interval: "1d" },
    suggestedModuleIds: ["forex-hub"],
  },
  {
    id: "crypto_price_historical",
    label: "数字资产历史行情",
    domain: "数字资产",
    path: "/api/v1/crypto/price/historical",
    description: "数字资产现货历史价格和成交量。",
    required: ["symbol"],
    allowed: ["symbol", "provider", "start_date", "end_date", "interval"],
    defaults: { symbol: "BTCUSD", provider: "yfinance", interval: "1d" },
    suggestedModuleIds: ["crypto-market"],
  },
  {
    id: "company_news",
    label: "公司新闻",
    domain: "新闻",
    path: "/api/v1/news/company",
    description: "按证券代码检索公司新闻、发布时间与来源。",
    required: ["symbol"],
    allowed: ["symbol", "provider", "limit", "start_date", "end_date"],
    defaults: { symbol: "AAPL", limit: 50 },
    suggestedModuleIds: ["news-cn"],
  },
  {
    id: "economy_cpi",
    label: "消费者价格指数",
    domain: "宏观",
    path: "/api/v1/economy/cpi",
    description: "国家 CPI、频率、观测期和修订值。",
    required: ["country"],
    allowed: [
      "country",
      "provider",
      "start_date",
      "end_date",
      "frequency",
      "transform",
    ],
    defaults: { country: "united_states", provider: "oecd" },
    suggestedModuleIds: ["economic-ecst"],
  },
  {
    id: "treasury_rates",
    label: "美国国债收益率",
    domain: "固定收益",
    path: "/api/v1/fixedincome/government/treasury_rates",
    description: "国债收益率期限结构及历史观测值。",
    required: [],
    allowed: ["provider", "start_date", "end_date"],
    defaults: { provider: "federal_reserve" },
    suggestedModuleIds: ["interest-rates", "yield-curve", "sov-13-ycurve"],
  },
  {
    id: "equity_income_statement",
    label: "公司利润表",
    domain: "公司财务",
    path: "/api/v1/equity/fundamental/income",
    description: "SEC 原始申报口径的收入、利润与每股收益明细。",
    required: ["provider", "symbol"],
    allowed: ["provider", "symbol", "limit", "period", "fiscal_year"],
    defaults: { provider: "sec", symbol: "AAPL", limit: 5, period: "annual" },
    suggestedModuleIds: ["stock-res", "stock-bi-stox", "financial-analysis"],
  },
  {
    id: "equity_balance_sheet",
    label: "公司资产负债表",
    domain: "公司财务",
    path: "/api/v1/equity/fundamental/balance",
    description: "SEC 原始申报口径的资产、负债与股东权益明细。",
    required: ["provider", "symbol"],
    allowed: ["provider", "symbol", "limit", "period", "fiscal_year"],
    defaults: { provider: "sec", symbol: "AAPL", limit: 5, period: "annual" },
    suggestedModuleIds: ["stock-res", "stock-bi-stox", "financial-analysis"],
  },
  {
    id: "equity_cash_flow",
    label: "公司现金流量表",
    domain: "公司财务",
    path: "/api/v1/equity/fundamental/cash",
    description: "SEC 原始申报口径的经营、投资与融资现金流明细。",
    required: ["provider", "symbol"],
    allowed: ["provider", "symbol", "limit", "period", "fiscal_year"],
    defaults: { provider: "sec", symbol: "AAPL", limit: 5, period: "annual" },
    suggestedModuleIds: ["stock-res", "stock-bi-stox", "financial-analysis"],
  },
  {
    id: "economy_real_gdp",
    label: "实际国内生产总值",
    domain: "宏观",
    path: "/api/v1/economy/gdp/real",
    description: "OECD 国家实际 GDP 时间序列、频率和观测期。",
    required: ["provider"],
    allowed: ["provider", "country", "frequency", "start_date", "end_date"],
    defaults: {
      provider: "oecd",
      country: "united_states",
      frequency: "quarter",
    },
    suggestedModuleIds: ["economic-ecst"],
  },
  {
    id: "economy_unemployment",
    label: "失业率",
    domain: "宏观",
    path: "/api/v1/economy/unemployment",
    description: "OECD 国家失业率时间序列及人口分组口径。",
    required: [],
    allowed: [
      "provider",
      "country",
      "frequency",
      "start_date",
      "end_date",
      "sex",
      "age",
      "seasonal_adjustment",
    ],
    defaults: {
      provider: "oecd",
      country: "united_states",
      frequency: "monthly",
      sex: "total",
      age: "total",
      seasonal_adjustment: false,
    },
    suggestedModuleIds: ["economic-ecst"],
  },
];

async function readState(): Promise<{
  schemaVersion: 1;
  runs: OpenBBQueryRun[];
}> {
  await mkdir(ROOT, { recursive: true });
  try {
    const value = JSON.parse(await readFile(FILE, "utf8"));
    return {
      schemaVersion: 1,
      runs: Array.isArray(value.runs)
        ? value.runs.slice(0, 100).map(repairStoredObservation)
        : [],
    };
  } catch {
    return { schemaVersion: 1, runs: [] };
  }
}
async function saveState(state: { schemaVersion: 1; runs: OpenBBQueryRun[] }) {
  const temp = `${FILE}.${randomUUID()}.tmp`;
  writes = writes.catch(() => undefined).then(async () => {
    const latest=await readState();
    const changes=new Map(state.runs.map(run=>[run.runId,run]));
    const merged=[...changes.values(),...latest.runs.filter(run=>!changes.has(run.runId))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    await writeFile(
      temp,
      JSON.stringify({ ...state, runs: merged.slice(0, 100) }, null, 2),
      "utf8"
    );
    await replaceFileWithRetry(temp, FILE);
  });
  await writes;
}
function baseUrl() {
  return (process.env.OPENBB_API_URL?.trim() || DEFAULT_API).replace(
    /\/+$/,
    ""
  );
}
async function timedFetch(
  url: string,
  init: RequestInit = {},
  timeout = 20_000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
function bundledExecutable() {
  const candidates =
    process.platform === "win32"
      ? [path.join(process.cwd(), ".venv-openbb", "Scripts", "openbb-api.exe")]
      : [path.join(process.cwd(), ".venv-openbb", "bin", "openbb-api")];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}
function ensureBundledRuntime() {
  const executable = bundledExecutable();
  managedRuntime = {
    ...managedRuntime,
    available: Boolean(executable),
    executable,
  };
  if (!executable || process.env.OPENBB_API_URL) return managedRuntime;
  const attempted = managedRuntime.lastAttemptAt
    ? Date.parse(managedRuntime.lastAttemptAt)
    : 0;
  if (managedRuntime.status === "starting" && Date.now() - attempted < 45_000)
    return managedRuntime;
  if (managedRuntime.status === "failed" && Date.now() - attempted < 15_000)
    return managedRuntime;
  const logRoot = path.join(process.cwd(), ".runtime", "openbb-api");
  mkdirSync(logRoot, { recursive: true });
  const output = openSync(path.join(logRoot, "stdout.log"), "a");
  const error = openSync(path.join(logRoot, "stderr.log"), "a");
  try {
    const child = spawn(executable, ["--host", "127.0.0.1", "--port", "6900"], {
      cwd: process.cwd(),
      detached: true,
      windowsHide: true,
      stdio: ["ignore", output, error],
    });
    managedRuntime = {
      available: true,
      status: "starting",
      pid: child.pid ?? null,
      executable,
      lastAttemptAt: now(),
      error: null,
    };
    child.once("error", reason => {
      managedRuntime = {
        ...managedRuntime,
        status: "failed",
        error: reason.message,
      };
    });
    child.once("exit", code => {
      if (code !== 0)
        managedRuntime = {
          ...managedRuntime,
          status: "failed",
          error: `OPENBB_PROCESS_EXIT_${code ?? "UNKNOWN"}`,
        };
    });
    child.unref();
  } catch (reason) {
    managedRuntime = {
      available: true,
      status: "failed",
      pid: null,
      executable,
      lastAttemptAt: now(),
      error:
        reason instanceof Error
          ? reason.message
          : "OPENBB_PROCESS_START_FAILED",
    };
  } finally {
    closeSync(output);
    closeSync(error);
  }
  return managedRuntime;
}
const delay = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));
async function probeUncached() {
  const checkedAt = now();
  const started = Date.now();
  const url = baseUrl();
  try {
    const response = await timedFetch(
      `${url}/`,
      { headers: { accept: "application/json" } },
      1800
    );
    return {
      checkedAt,
      api: {
        baseUrl: url,
        explicitlyConfigured: Boolean(process.env.OPENBB_API_URL),
        autoDetected: !process.env.OPENBB_API_URL && response.ok,
        reachable: response.ok,
        statusCode: response.status,
        latencyMs: Date.now() - started,
        error: response.ok ? null : `HTTP_${response.status}`,
      },
      python: {
        configured:
          Boolean(process.env.OPENBB_PYTHON) || Boolean(bundledExecutable()),
      },
      managed: { ...managedRuntime },
    };
  } catch (error) {
    return {
      checkedAt,
      api: {
        baseUrl: url,
        explicitlyConfigured: Boolean(process.env.OPENBB_API_URL),
        autoDetected: false,
        reachable: false,
        statusCode: null,
        latencyMs: Date.now() - started,
        error:
          error instanceof Error && error.name === "AbortError"
            ? "OPENBB_API_TIMEOUT"
            : "OPENBB_API_UNREACHABLE",
      },
      python: {
        configured:
          Boolean(process.env.OPENBB_PYTHON) || Boolean(bundledExecutable()),
      },
      managed: { ...managedRuntime },
    };
  }
}
export async function getOpenBBRuntime(force = false) {
  if (!force && healthCache && healthCache.until > Date.now())
    return healthCache.value;
  let value = await probeUncached();
  if (!value.api.reachable && !process.env.OPENBB_API_URL) {
    const launch = ensureBundledRuntime();
    if (launch.status === "starting") {
      for (let attempt = 0; attempt < 8 && !value.api.reachable; attempt++) {
        await delay(750);
        value = await probeUncached();
      }
    }
  }
  if (
    value.api.reachable &&
    !process.env.OPENBB_API_URL &&
    bundledExecutable()
  ) {
    managedRuntime = {
      ...managedRuntime,
      available: true,
      status: "running",
      error: null,
    };
    value = { ...value, managed: { ...managedRuntime } };
  }
  healthCache = { until: Date.now() + 12_000, value };
  return value;
}

const OPENAPI_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const;
function textValue(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function schemaChoices(schema: any): Scalar[] {
  const candidates = [
    schema,
    ...(Array.isArray(schema?.anyOf) ? schema.anyOf : []),
    ...(Array.isArray(schema?.oneOf) ? schema.oneOf : []),
  ];
  return unique(
    candidates
      .flatMap((item: any) =>
        Array.isArray(item?.enum)
          ? item.enum
          : item?.const !== undefined
            ? [item.const]
            : []
      )
      .filter(
        (value: unknown): value is Scalar =>
          value === null ||
          ["string", "number", "boolean"].includes(typeof value)
      )
  ).slice(0, 100);
}
function schemaType(schema: any) {
  if (typeof schema?.type === "string") return schema.type;
  if (typeof schema?.$ref === "string")
    return schema.$ref.split("/").at(-1) || "object";
  const variants = unique(
    [
      ...(Array.isArray(schema?.anyOf) ? schema.anyOf : []),
      ...(Array.isArray(schema?.oneOf) ? schema.oneOf : []),
    ]
      .map((item: any) =>
        typeof item?.type === "string"
          ? item.type
          : typeof item?.$ref === "string"
            ? item.$ref.split("/").at(-1)
            : ""
      )
      .filter(Boolean)
  );
  return variants.join(" | ") || "unknown";
}
function responseSchema(operation: any) {
  const success =
    operation?.responses?.["200"] ??
    operation?.responses?.["201"] ??
    operation?.responses?.default;
  const schema = success?.content?.["application/json"]?.schema;
  if (typeof schema?.$ref === "string")
    return schema.$ref.split("/").at(-1) || null;
  return schema ? schemaType(schema) : null;
}
function requestBodyDescriptor(operation: any) {
  const content = operation?.requestBody?.content;
  const schema =
    content?.["application/json"]?.schema ??
    content?.["text/plain"]?.schema ??
    null;
  const example =
    operation?.requestBody?.content?.["application/json"]?.example ??
    operation?.examples?.[0]?.parameters?.urls ??
    operation?.examples?.[0]?.parameters ??
    null;
  return {
    type: schema ? schemaType(schema) : null,
    description: textValue(schema?.description ?? operation?.requestBody?.description, 1200) || null,
    example,
  };
}

function isSafePostOperation(operationId: string, apiPath: string) {
  return (
    SAFE_POST_OPERATION_IDS.has(operationId) &&
    !/^\/api\/v1\/(?:system|user)(?:\/|$)/.test(apiPath)
  );
}
function catalogParameter(parameter: any): OpenBBApiCatalogParameter | null {
  const name = textValue(parameter?.name, 160);
  if (!name) return null;
  const schema =
    parameter?.schema && typeof parameter.schema === "object"
      ? parameter.schema
      : {};
  const defaultValue =
    ["string", "number", "boolean"].includes(typeof schema.default) ||
    schema.default === null
      ? (schema.default as Scalar)
      : null;
  return {
    name,
    location: textValue(parameter?.in, 40) || "query",
    required: Boolean(parameter?.required),
    type: schemaType(schema),
    format: textValue(schema?.format, 80) || null,
    defaultValue,
    choices: schemaChoices(schema),
    description:
      textValue(parameter?.description ?? schema?.description, 800) || null,
  };
}

type OpenBBShardRoute = {
  primaryModuleId: string | null;
  shardKey: string;
  dataContractId: string;
};

/**
 * Keeps each OpenBB contract on one canonical existing terminal data slot.
 * The route is derived from the operation path, so adding an API cannot
 * silently duplicate the same dataset across several front-end modules.
 */
function shardRoute(apiPath: string, operationId: string, tags: string[]): OpenBBShardRoute {
  const segments = apiPath.split("/").filter(Boolean);
  const domain = segments[2] ?? tags[0] ?? "openbb";
  const section = segments[3] ?? "root";
  const leaf = segments[4] ?? "root";
  let primaryModuleId: string | null = null;
  if (domain === "equity") {
    primaryModuleId =
      section === "calendar" ? "equity-market" :
      section === "estimates" ? "stock-bi-stox" :
      section === "discovery" || section === "search" || section === "screener" ? "stock-eqs" :
      section === "fundamental" ? "equity-market" :
      section === "ownership" ? "stock-port" :
      section === "compare" ? "equity-market" :
      section === "shorts" ? "equity-market" :
      section === "price" || section === "profile" || section === "market_snapshots" ? "equity-market" :
      null;
  } else if (domain === "etf") {
    primaryModuleId = section === "holdings" || section === "nport_disclosure" ? "etf-holdings" : "fund-browse";
  } else if (domain === "commodity") primaryModuleId = "commodity-market";
  else if (domain === "crypto") primaryModuleId = "crypto-market";
  else if (domain === "currency") {
    primaryModuleId = operationId === "currency_price_historical" ? "forex-curves" : "forex-hub";
  }
  else if (domain === "index") primaryModuleId = "index-hub";
  else if (domain === "derivatives") {
    const derivativesRoutes: Record<string, string> = {
      derivatives_options_chains: "index-options",
      derivatives_options_surface: "vca",
      derivatives_options_unusual: "moso",
      derivatives_options_snapshots: "fom",
      derivatives_futures_historical: "deri",
      derivatives_futures_curve: "deri",
    };
    primaryModuleId = derivativesRoutes[operationId] ?? null;
  }
  else if (domain === "economy" || domain === "imf_utils") primaryModuleId = economicModuleForOperation(apiPath);
  else if (domain === "fixedincome") {
    if (section === "rate") primaryModuleId = "interest-rates";
    else if (section === "spreads") primaryModuleId = "rate-trader-by-term";
    else if (section === "corporate") primaryModuleId = "credit-analysis";
    else if (operationId === "fixedincome_government_yield_curve" || operationId === "fixedincome_government_svensson_yield_curve") primaryModuleId = "yield-curve";
    else if (operationId === "fixedincome_government_treasury_rates" || operationId === "fixedincome_government_tips_yields") primaryModuleId = "g7-curves";
    else if (operationId === "fixedincome_government_treasury_auctions" || operationId === "fixedincome_government_treasury_prices") primaryModuleId = "fixed-income-trade";
    else if (operationId === "fixedincome_bond_indices") primaryModuleId = "bond-market";
    else if (operationId === "fixedincome_mortgage_indices") primaryModuleId = "fixed-income";
    else primaryModuleId = null;
  } else if (domain === "news") primaryModuleId = "news-hub";
  else if (domain === "regulators") primaryModuleId = "stock-res";
  else if (domain === "uscongress") primaryModuleId = "news-hub";
  else if (domain === "coverage") primaryModuleId = null;
  const shardKey = `${domain}.${section}.${leaf}`;
  return {
    primaryModuleId,
    shardKey,
    dataContractId: `openbb.${operationId}`,
  };
}

export function buildOpenBBApiCatalog(payload: unknown) {
  const document =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, any>)
      : {};
  const pathMap =
    document.paths &&
    typeof document.paths === "object" &&
    !Array.isArray(document.paths)
      ? (document.paths as Record<string, any>)
      : {};
  const paths = Object.keys(pathMap);
  const rootSecurity =
    Array.isArray(document.security) && document.security.length > 0;
  const operations: OpenBBApiCatalogOperation[] = [];
  for (const apiPath of paths.sort()) {
    const pathItem =
      pathMap[apiPath] && typeof pathMap[apiPath] === "object"
        ? pathMap[apiPath]
        : {};
    for (const method of OPENAPI_METHODS) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== "object") continue;
      const operationId =
        textValue(operation.operationId, 240) ||
        `${method}_${apiPath.replace(/[^a-z0-9]+/gi, "_")}`;
      const controlled =
        method === "get"
          ? (OPENBB_ENDPOINTS.find(item => item.path === apiPath) ?? null)
          : null;
      const systemRoute = /^\/api\/v1\/(?:system|user)(?:\/|$)/.test(apiPath);
      const safePost = method === "post" && isSafePostOperation(operationId, apiPath);
      const executionState: OpenBBApiCatalogOperation["executionState"] =
        systemRoute
            ? "restricted_system"
            : method !== "get" && !safePost
              ? "restricted_write"
              : "controlled_ready";
      const blockReason = controlled
        ? null
        : systemRoute
          ? "系统或用户管理接口禁止从金融数据工作台直接执行。"
          : method !== "get" && !safePost
            ? `${method.toUpperCase()} 非只读操作未进入安全白名单。`
            : null;
      const sharedParameters = Array.isArray(pathItem.parameters)
        ? pathItem.parameters
        : [];
      const ownParameters = Array.isArray(operation.parameters)
        ? operation.parameters
        : [];
      const parameters = [...sharedParameters, ...ownParameters]
        .map(catalogParameter)
        .filter((item): item is OpenBBApiCatalogParameter => Boolean(item));
      const tags = unique<string>(
        (Array.isArray(operation.tags) ? operation.tags : [])
          .map((tag: unknown) => textValue(tag, 120))
          .filter((tag: string): tag is string => Boolean(tag))
      );
      const route = shardRoute(apiPath, operationId, tags);
      const body = requestBodyDescriptor(operation);
      operations.push({
        id: `${method.toUpperCase()} ${apiPath}`,
        path: apiPath,
        method: method.toUpperCase(),
        operationId,
        summary: textValue(operation.summary, 300) || operationId,
        description: textValue(operation.description, 1200) || null,
        tags,
        parameters,
        requestBodyRequired: Boolean(operation.requestBody?.required),
        requestBodyType: body.type,
        requestBodyDescription: body.description,
        requestBodyExample: body.example,
        responseCodes: Object.keys(operation.responses ?? {}).slice(0, 30),
        responseSchema: responseSchema(operation),
        securityRequired: Array.isArray(operation.security)
          ? operation.security.length > 0
          : rootSecurity,
        assetClasses: classifyOpenBBAssetClasses(apiPath, tags),
        controlledEndpointId:
          executionState === "controlled_ready"
            ? (controlled?.id ?? operationId)
            : null,
        ...route,
        executionState,
        blockReason,
      });
    }
  }
  const declaredTags = unique<string>(
    (Array.isArray(document.tags) ? document.tags : [])
      .map((tag: any) => textValue(tag?.name, 120))
      .filter((tag: string): tag is string => Boolean(tag))
  ).sort();
  const tags = unique<string>([
    ...declaredTags,
    ...operations.flatMap(operation => operation.tags),
  ]).sort();
  const methodCounts = Object.fromEntries(
    OPENAPI_METHODS.map(
      method =>
        [
          method.toUpperCase(),
          operations.filter(
            operation => operation.method === method.toUpperCase()
          ).length,
        ] as const
    ).filter(([, count]) => count > 0)
  );
  const tagCounts = Object.fromEntries(
    tags.map(tag => [
      tag,
      operations.filter(operation => operation.tags.includes(tag)).length,
    ])
  );
  const stateCounts = Object.fromEntries(
    [
      "controlled_ready",
      "contract_only",
      "restricted_write",
      "restricted_system",
    ].map(state => [
      state,
      operations.filter(operation => operation.executionState === state).length,
    ])
  );
  // A controlled proxy can safely forward a contracted operation, but that
  // does not mean the operation has a dedicated, field-aware adapter. Keep
  // those two concepts separate so the admin UI never overstates coverage.
  const controlledOperationCount = operations.filter(
    operation => operation.controlledEndpointId
  ).length;
  const dedicatedAdapterCount = operations.filter(operation =>
    OPENBB_ENDPOINTS.some(endpoint => endpoint.id === operation.controlledEndpointId)
  ).length;
  return {
    title:
      typeof document.info?.title === "string"
        ? document.info.title.slice(0, 200)
        : null,
    version:
      typeof document.info?.version === "string"
        ? document.info.version.slice(0, 80)
        : null,
    pathCount: paths.length,
    tagCount: tags.length,
    declaredTagCount: declaredTags.length,
    declaredTags,
    operationCount: operations.length,
    contractOperationCount: operations.length,
    controlledOperationCount,
    controlledProxyOperationCount: controlledOperationCount,
    dedicatedAdapterCount,
    dedicatedAdapterPercent: operations.length
      ? Number(((dedicatedAdapterCount / operations.length) * 100).toFixed(2))
      : 0,
    contractCoveragePercent: operations.length ? 100 : 0,
    coveragePercent: operations.length
      ? Number(
          ((controlledOperationCount / operations.length) * 100).toFixed(2)
        )
      : 0,
    methods: methodCounts,
    tags,
    tagCounts,
    stateCounts,
    assetClassSummary: summarizeOpenBBAssetClasses(operations),
    operations,
    pathSample: paths.slice(0, 20),
  };
}

export function summarizeOpenBBApiDocument(payload: unknown) {
  const catalog = buildOpenBBApiCatalog(payload);
  return {
    title: catalog.title,
    version: catalog.version,
    pathCount: catalog.pathCount,
    tagCount: catalog.tagCount,
    pathSample: catalog.pathSample,
  };
}

function emptyOpenBBApiContract(error: string, statusCode: number | null = null) {
  return {
    reachable: false,
    executable: false,
    contractSource: "none" as OpenBBApiContractSource,
    statusCode,
    checksum: null as string | null,
    error,
    title: null as string | null,
    version: null as string | null,
    pathCount: 0,
    tagCount: 0,
    declaredTagCount: 0,
    declaredTags: [] as string[],
    operationCount: 0,
    contractOperationCount: 0,
    controlledOperationCount: 0,
    controlledProxyOperationCount: 0,
    dedicatedAdapterCount: 0,
    dedicatedAdapterPercent: 0,
    contractCoveragePercent: 0,
    coveragePercent: 0,
    methods: {} as Record<string, number>,
    tags: [] as string[],
    tagCounts: {} as Record<string, number>,
    stateCounts: {} as Record<string, number>,
    assetClassSummary: summarizeOpenBBAssetClasses([]),
    operations: [] as OpenBBApiCatalogOperation[],
    pathSample: [] as string[],
  };
}

async function cachedOpenBBApiContract(error: string, statusCode: number | null = null) {
  try {
    const body = await readFile(LIVE_OPENAPI_FILE, "utf8");
    const payload = JSON.parse(body) as unknown;
    const catalog = markOpenBBContractOnly(buildOpenBBApiCatalog(payload));
    if (!catalog.pathCount || !catalog.operationCount)
      return emptyOpenBBApiContract(`${error}:OPENBB_CACHED_CONTRACT_EMPTY`, statusCode);
    return {
      reachable: false,
      executable: false,
      contractSource: "cached_contract" as OpenBBApiContractSource,
      statusCode,
      checksum: digest(body),
      error,
      ...catalog,
    };
  } catch (cachedError) {
    const reason = cachedError instanceof SyntaxError
      ? "OPENBB_CACHED_CONTRACT_INVALID_JSON"
      : "OPENBB_CACHED_CONTRACT_UNAVAILABLE";
    return emptyOpenBBApiContract(`${error}:${reason}`, statusCode);
  }
}

async function inspectOpenBBApiUncached(forceRuntime = true) {
  const runtime = await getOpenBBRuntime(forceRuntime);
  if (!runtime.api.reachable) {
    return {
      runtime,
      openapi: await cachedOpenBBApiContract(runtime.api.error ?? "OPENBB_API_UNREACHABLE"),
    };
  }
  try {
    const response = await timedFetch(
      `${runtime.api.baseUrl}/openapi.json`,
      { headers: { accept: "application/json" } },
      8_000
    );
    const body = await response.text();
    if (!response.ok) {
      return {
        runtime,
        openapi: await cachedOpenBBApiContract(`OPENBB_OPENAPI_HTTP_${response.status}`, response.status),
      };
    }
    let payload: unknown;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      return {
        runtime,
        openapi: await cachedOpenBBApiContract("OPENBB_OPENAPI_INVALID_JSON", response.status),
      };
    }
    return {
      runtime,
      openapi: {
        reachable: true,
        executable: true,
        contractSource: "runtime" as OpenBBApiContractSource,
        statusCode: response.status,
        checksum: digest(body),
        error: null,
        ...buildOpenBBApiCatalog(payload),
      },
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "OPENBB_OPENAPI_TIMEOUT"
        : "OPENBB_OPENAPI_UNREACHABLE";
    return {
      runtime,
      openapi: await cachedOpenBBApiContract(reason),
    };
  }
}
export async function inspectOpenBBApi(force = true) {
  if (!force && openApiCache && openApiCache.until > Date.now())
    return openApiCache.value;
  const value = await inspectOpenBBApiUncached(force);
  openApiCache = {
    until: Date.now() + (value.openapi.reachable ? 60_000 : 10_000),
    value,
  };
  return value;
}

function endpoint(id: string) {
  const value = OPENBB_ENDPOINTS.find(item => item.id === id);
  if (!value) throw new Error("OPENBB_ENDPOINT_NOT_ALLOWED");
  return value;
}

async function catalogEndpoint(operationId: string) {
  const inspection = await inspectOpenBBApi(false);
  if (!inspection.openapi.reachable)
    throw new Error(`OPENBB_API_UNAVAILABLE:${inspection.runtime.api.error ?? "OPENBB_OPENAPI_UNAVAILABLE"}`);
  const operation = inspection.openapi.operations.find(item => item.operationId === operationId);
  if (!operation) throw new Error("OPENBB_CATALOG_OPERATION_NOT_FOUND");
  if (
    operation.method !== "GET" &&
    !(operation.method === "POST" && operation.executionState === "controlled_ready")
  )
    throw new Error("OPENBB_CATALOG_OPERATION_RESTRICTED");
  if (operation.executionState === "restricted_system")
    throw new Error("OPENBB_CATALOG_SYSTEM_OPERATION_RESTRICTED");
  const defaults = Object.fromEntries(
    operation.parameters
      .filter(parameter => parameter.location === "query" || parameter.location === "path")
      .filter(parameter => parameter.defaultValue !== null)
      .map(parameter => [parameter.name, parameter.defaultValue])
  ) as OpenBBParams;
  const route = shardRoute(operation.path, operation.operationId, operation.tags);
  const definition: OpenBBEndpoint = {
    id: `catalog_${operation.operationId}`,
    label: operation.summary,
    domain: operation.tags[0] ?? "OpenBB",
    path: operation.path,
    description: operation.description ?? operation.summary,
    required: operation.parameters.filter(parameter => parameter.required).map(parameter => parameter.name),
    allowed: operation.parameters
      .filter(parameter => parameter.location === "query" || parameter.location === "path")
      .map(parameter => parameter.name),
    defaults,
    suggestedModuleIds: route.primaryModuleId ? [route.primaryModuleId] : [],
  };
  return { operation, definition };
}

function jsonByteLength(value: unknown) {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeUrlList(body: unknown) {
  const value =
    body && typeof body === "object" && !Array.isArray(body) && "urls" in body
      ? (body as Record<string, unknown>).urls
      : body;
  const urls = Array.isArray(value) ? value : [value];
  if (!urls.length || urls.length > 16 || urls.some(item => typeof item !== "string"))
    throw new Error("OPENBB_REQUEST_BODY_URL_LIST_INVALID");
  return urls.map(item => {
    const parsed = new URL(String(item));
    if (parsed.protocol !== "https:") throw new Error("OPENBB_REQUEST_URL_HTTPS_ONLY");
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host === "congress.gov" ||
      host.endsWith(".congress.gov") ||
      host === "nal.usda.gov" ||
      host.endsWith(".nal.usda.gov") ||
      host === "usda.gov" ||
      host.endsWith(".usda.gov");
    if (!allowed) throw new Error("OPENBB_REQUEST_URL_DOMAIN_NOT_ALLOWED");
    return parsed.toString();
  });
}

export function validateCatalogRequestBody(
  operation: OpenBBApiCatalogOperation,
  body: unknown
) {
  if (body === undefined || body === null) {
    if (operation.requestBodyRequired) throw new Error("OPENBB_REQUEST_BODY_REQUIRED");
    return undefined;
  }
  if (jsonByteLength(body) > 500_000) throw new Error("OPENBB_REQUEST_BODY_TOO_LARGE");
  if (
    operation.operationId === "commodity_weather_bulletins_download" ||
    operation.operationId === "congress_gov_router_bill_text" ||
    operation.operationId === "congress_gov_router_amendment_text"
  ) {
    return normalizeUrlList(body);
  }
  if (operation.operationId === "derivatives_options_surface") {
    const objectBody =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const data = objectBody?.data;
    if (!Array.isArray(data) || data.length === 0 || data.length > 5_000)
      throw new Error("OPENBB_OPTIONS_SURFACE_DATA_REQUIRED");
    for (const row of data) {
      if (!row || typeof row !== "object" || Array.isArray(row))
        throw new Error("OPENBB_OPTIONS_SURFACE_ROW_INVALID");
      const keys = Object.keys(row as Record<string, unknown>);
      if (keys.some(key => !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)))
        throw new Error("OPENBB_OPTIONS_SURFACE_FIELD_INVALID");
    }
    return body;
  }
  throw new Error("OPENBB_REQUEST_BODY_NOT_ALLOWED");
}

function cleanCatalogParams(
  operation: OpenBBApiCatalogOperation,
  input: OpenBBParams
) {
  const allowed = operation.parameters.filter(
    parameter => parameter.location === "query" || parameter.location === "path"
  );
  const output: OpenBBParams = {};
  for (const parameter of allowed) {
    const raw = input[parameter.name] ?? parameter.defaultValue;
    if (raw === null || raw === undefined || raw === "") continue;
    if (typeof raw === "string") output[parameter.name] = raw.trim().slice(0, 300);
    else if (typeof raw === "number" && Number.isFinite(raw)) output[parameter.name] = raw;
    else if (typeof raw === "boolean") output[parameter.name] = raw;
  }
  for (const parameter of allowed) {
    if (parameter.required && output[parameter.name] === undefined)
      throw new Error(`OPENBB_REQUIRED_PARAMETER:${parameter.name}`);
  }
  return output;
}
function cleanParams(def: OpenBBEndpoint, input: OpenBBParams) {
  const merged = { ...def.defaults, ...input };
  const output: OpenBBParams = {};
  for (const key of def.allowed) {
    const value = merged[key];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "string") output[key] = value.trim().slice(0, 300);
    else if (typeof value === "number" && Number.isFinite(value))
      output[key] = value;
    else if (typeof value === "boolean") output[key] = value;
  }
  for (const key of def.required)
    if (output[key] === undefined)
      throw new Error(`OPENBB_REQUIRED_PARAMETER:${key}`);
  return output;
}
function scalar(value: unknown): Scalar {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 2000);
  try {
    return JSON.stringify(value).slice(0, 2000);
  } catch {
    return String(value).slice(0, 2000);
  }
}
function sourceRows(payload: any): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.results && typeof payload.results === "object")
    return Object.entries(payload.results).map(([key, value]) => ({
      key,
      value,
    }));
  if (payload?.data && typeof payload.data === "object")
    return Object.entries(payload.data).map(([key, value]) => ({ key, value }));
  if (!payload || typeof payload !== "object") return [];
  // A provider returning `{}` is an empty response, not one valid
  // observation. Keeping it as a row made the run appear successful and
  // allowed an empty shell to reach an existing terminal module.
  return Object.keys(payload).length ? [payload] : [];
}

function openBBRealtimeStatus(params: OpenBBParams): OpenBBResult["metadata"]["realtimeStatus"] {
  const interval = String(params.interval ?? "").toLowerCase();
  if (["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h"].includes(interval))
    return "delayed";
  if (["1d", "1wk", "1mo", "daily", "weekly", "monthly"].includes(interval))
    return "end_of_day";
  return "provider_defined";
}

export function normalizeOpenBBResult(
  def: OpenBBEndpoint,
  params: OpenBBParams,
  payload: unknown
): OpenBBResult {
  const original = sourceRows(payload).filter(raw => {
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const values = Object.values(raw as Record<string, unknown>);
      return values.length > 0 && values.some(value => value !== null && value !== undefined && value !== "");
    }
    return true;
  });
  const rows = original.slice(0, 500).map((raw, index) =>
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(raw as Record<string, unknown>)
            .slice(0, 80)
            .map(([key, value]) => [key, scalar(value)])
        )
      : { row: index + 1, value: scalar(raw) }
  );
  const columns = unique(rows.flatMap(row => Object.keys(row))).slice(0, 80);
  const fields = describeFields(columns, rows);
  const meta = payload && typeof payload === "object" ? (payload as any) : {};
  const provider = String(
    meta.provider ??
      meta?.metadata?.provider ??
      params.provider ??
      "provider-defined"
  );
  const observedAt = latestObservedAt(rows);
  const { rangeStart, rangeEnd } = observationRange(rows);
  const dimensions=Object.fromEntries(['symbol','country','series_id','currency','unit','interval','frequency','period','seasonal_adjustment'].filter(key=>params[key]!==undefined).sort().map(key=>[key,params[key]]));
  const identityRows=original.map(row=>row&&typeof row==='object'?Object.fromEntries(Object.entries(row).map(([key,value])=>[key,scalar(value)])):{value:scalar(row)});
  const identityColumns=unique(identityRows.flatMap(row=>Object.keys(row)));
  const checksum = digest(JSON.stringify([dimensions,deliveryDatasetIdentity({columns:identityColumns,rows:identityRows,metadata:{provider,unit:meta?.metadata?.unit,currency:meta?.metadata?.currency}})]));
  const nullCellCount = fields.reduce((sum, field) => sum + field.nullCount, 0);
  const cellCount = Math.max(1, rows.length * columns.length);
  return {
    endpointId: def.id,
    label: def.label,
    params,
    columns,
    rows,
    fields,
    metadata: {
      provider,
      queriedAt: now(),
      observedAt,
      rangeStart,
      rangeEnd,
      timezone: String(meta?.metadata?.timezone ?? "provider-defined"),
      rowCount: original.length,
      truncated: original.length > 500,
      numericFieldCount: fields.filter(field => field.dataType === "number")
        .length,
      nullCellCount,
      nullRate: Number((nullCellCount / cellCount).toFixed(6)),
      quality: rows.length ? "provider_response" : "empty_response",
      realtimeStatus: openBBRealtimeStatus(params),
      schemaVersion: "openbb-query-v1",
      checksum,
      observationIdentity: checksum,
    },
  };
}

/**
 * A successful OpenBB query is a frontend delivery, not an admin-only result.
 * Publish it to the endpoint's single canonical existing module immediately;
 * the delivery layer performs content-hash dedupe and render ACK accounting.
 * A failed delivery never changes a verified query into a failed query, but it
 * remains visible in the run log for diagnosis.
 */
async function autoPublishOpenBBRun(run: OpenBBQueryRun): Promise<OpenBBQueryRun> {
  if (run.status !== "succeeded" || !run.result?.rows.length || !run.primaryModuleId) return run;
  try {
    const delivery = await deliverOpenBBDataset({
      dataset: run.result,
      sourceRunId: run.runId,
      moduleIds: [run.primaryModuleId],
      recipientUserIds: [run.actorUserId],
      actorUserId: run.actorUserId,
      operator: "OpenBB 自动投递",
    });
    const { frontendId: _frontendId, targetModules: _targetModules, recipients: _recipients, ackRequired: _ackRequired, ...push } = delivery;
    run.push = push;
    run.logs.push(push.status === "duplicate_blocked"
      ? "查询结果已存在于同一功能数据槽；重复投递已拦截。"
      : `查询结果已自动投递到既有功能 ${run.primaryModuleId}，等待前端渲染确认。`);
    const latest = await readState();
    const stored = latest.runs.find(item => item.runId === run.runId);
    if (stored) {
      stored.push = push;
      stored.logs = run.logs;
      await saveState(latest);
      return stored;
    }
  } catch (error) {
    run.logs.push(`查询已成功但自动投递未完成：${error instanceof Error ? error.message : String(error)}`);
  }
  return run;
}

export async function runOpenBBQuery(input: {
  endpointId: string;
  catalogOperationId?: string;
  params: OpenBBParams;
  requestBody?: unknown;
  actorUserId: number;
}) {
  if (input.catalogOperationId)
    return runOpenBBCatalogQuery({
      operationId: input.catalogOperationId,
      params: input.params,
      requestBody: input.requestBody,
      actorUserId: input.actorUserId,
    });
  const official = economicApiContract(input.endpointId);
  const def = official ? {
    id: official.id, label: official.label, domain: '官方经济观察', path: official.endpoint,
    description: `${official.unit} / ${official.frequency}`, required: [], allowed: [], defaults: {}, suggestedModuleIds: [official.primaryModuleId],
  } : endpoint(input.endpointId);
  const params = cleanParams(def, input.params);
  const state = await readState();
  const run: OpenBBQueryRun = {
    runId: `obbrun_${randomUUID().replaceAll("-", "")}`,
    status: "running",
    endpointId: def.id,
    params,
    createdAt: now(),
    startedAt: now(),
    completedAt: null,
    actorUserId: input.actorUserId,
    command: `GET ${def.path}`,
    primaryModuleId: def.suggestedModuleIds[0] ?? null,
    dataContractId: `openbb.${def.id}`,
    error: null,
    logs: [`白名单端点校验通过：${def.label}`],
    result: null,
    push: null,
  };
  state.runs.unshift(run);
  await saveState(state);
  const worldbank=WORLD_BANK_CONTRACTS.find(contract=>contract.id===def.id);
  if(worldbank){
    try{
      const snapshot=await getWorldBankObservationSnapshot(def.id,String(params.country??'USA'),Number(params.start_year??2015),Number(params.end_year??new Date().getUTCFullYear()));
      const rows=snapshot.rows;
      run.result=normalizeOpenBBResult(def,params,{provider:'World Bank',metadata:{timezone:'annual-observation',unit:worldbank.unit},results:rows});
      run.result.metadata.queriedAt=snapshot.retrievedAt;
    run.status='succeeded';run.logs.push(`官方源 ${worldbank.sourceUrl}；${rows.length} 条年度观察。`);
    }catch(error){run.status='failed';run.error=error instanceof Error?error.message:'WORLDBANK_FAILED';}
    run.completedAt=now();await saveState(state);return autoPublishOpenBBRun(run);
  }
  if (official) {
    const series = await getEconomicSeries(official.seriesId);
    const provider = official.provider;
    run.result = normalizeOpenBBResult(def, params, {provider,metadata:{timezone:'source-defined',unit:series.unit,vintage:series.metadata?.vintage ?? null},results:series.history.slice(-500).map(point=>({date:point.date,series:series.id,value:point.value,unit:series.unit}))});
    run.result.metadata.rowCount=series.history.length;
    run.result.metadata.queriedAt=series.retrievedAt;
    run.result.metadata.truncated=series.history.length>500;
    run.status = series.status === 'available' ? 'succeeded' : 'failed';
    run.error = series.error;
    run.completedAt = now();
    run.logs.push(`官方源 ${series.sourceUrl}；${series.history.length} 条真实观测；${series.status}。`);
    await saveState(state);
    return autoPublishOpenBBRun(run);
  }
  const runtime = await getOpenBBRuntime(true);
  if (!runtime.api.reachable) {
    run.status = "not_configured";
    run.completedAt = now();
    run.error = `OPENBB_API_UNAVAILABLE:${runtime.api.error}`;
    run.logs.push("未请求数据，也未生成替代值。");
    await saveState(state);
    return run;
  }
  try {
    const url = new URL(`${baseUrl()}${def.path}`);
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, String(value))
    );
    const headers: Record<string, string> = { accept: "application/json" };
    if (process.env.OPENBB_API_TOKEN)
      headers.authorization = `Bearer ${process.env.OPENBB_API_TOKEN}`;
    const response = await timedFetch(url.toString(), { headers }, 25_000);
    const body = await response.text();
    let payload: unknown;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      payload = { detail: body.slice(0, 2000) };
    }
    if (!response.ok)
      throw new Error(
        `OPENBB_HTTP_${response.status}:${typeof (payload as any)?.detail === "string" ? (payload as any).detail.slice(0, 600) : response.statusText}`
      );
    run.result = normalizeOpenBBResult(def, params, payload);
    run.status = run.result.rows.length ? "succeeded" : "empty";
    run.completedAt = now();
    run.error = run.result.rows.length ? null : "OPENBB_QUERY_EMPTY";
    run.logs.push(
      `查询完成：${run.result.metadata.provider} 返回 ${run.result.metadata.rowCount} 行，保留 ${run.result.rows.length} 行。`
    );
  } catch (error) {
    run.status = "failed";
    run.completedAt = now();
    run.error = error instanceof Error ? error.message : "OPENBB_QUERY_FAILED";
    run.logs.push("查询失败；未写入任何前端模块。");
  }
  await saveState(state);
  return autoPublishOpenBBRun(run);
}

/** Execute a contract-approved GET or deterministic data POST operation. */
export async function runOpenBBCatalogQuery(input: {
  operationId: string;
  params: OpenBBParams;
  requestBody?: unknown;
  actorUserId: number;
}) {
  const { operation, definition } = await catalogEndpoint(input.operationId);
  const params = cleanCatalogParams(operation, input.params);
  const requestBody = validateCatalogRequestBody(operation, input.requestBody);
  const state = await readState();
  const run: OpenBBQueryRun = {
    runId: `obbrun_${randomUUID().replaceAll("-", "")}`,
    status: "running",
    endpointId: definition.id,
    params,
    createdAt: now(),
    startedAt: now(),
    completedAt: null,
    actorUserId: input.actorUserId,
    command: `${operation.method} ${operation.path}`,
    requestBody,
    primaryModuleId: operation.primaryModuleId,
    dataContractId: operation.dataContractId,
    error: null,
    logs: [`OpenAPI 合同校验通过：${operation.operationId}`, `唯一数据分片：${operation.dataContractId} → ${operation.primaryModuleId ?? "仅后台"}`],
    result: null,
    push: null,
  };
  state.runs.unshift(run);
  await saveState(state);
  const runtime = await getOpenBBRuntime(true);
  if (!runtime.api.reachable) {
    run.status = "not_configured";
    run.completedAt = now();
    run.error = `OPENBB_API_UNAVAILABLE:${runtime.api.error}`;
    run.logs.push("未请求数据，也未生成替代值。");
    await saveState(state);
    return run;
  }
  try {
    const pathParameters = operation.parameters.filter(parameter => parameter.location === "path");
    let requestPath = operation.path;
    for (const parameter of pathParameters) {
      const value = params[parameter.name];
      if (value === undefined) throw new Error(`OPENBB_REQUIRED_PARAMETER:${parameter.name}`);
      requestPath = requestPath.replace(`{${parameter.name}}`, encodeURIComponent(String(value)));
    }
    const url = new URL(`${baseUrl()}${requestPath}`);
    for (const parameter of operation.parameters.filter(parameter => parameter.location === "query")) {
      const value = params[parameter.name];
      if (value === undefined) continue;
      if (parameter.type.startsWith("array")) {
        String(value).split(",").map(item => item.trim()).filter(Boolean).forEach(item => url.searchParams.append(parameter.name, item));
      } else url.searchParams.set(parameter.name, String(value));
    }
    const headers: Record<string, string> = { accept: "application/json" };
    if (process.env.OPENBB_API_TOKEN) headers.authorization = `Bearer ${process.env.OPENBB_API_TOKEN}`;
    const requestInit: RequestInit = { method: operation.method, headers };
    if (operation.method === "POST") {
      headers["content-type"] = "application/json";
      requestInit.body = JSON.stringify(requestBody);
    }
    const response = await timedFetch(url.toString(), requestInit, 25_000);
    const body = await response.text();
    let payload: unknown;
    try { payload = body ? JSON.parse(body) : {}; }
    catch { payload = { detail: body.slice(0, 2000) }; }
    if (!response.ok)
      throw new Error(`OPENBB_HTTP_${response.status}:${typeof (payload as any)?.detail === "string" ? (payload as any).detail.slice(0, 600) : response.statusText}`);
    run.result = normalizeOpenBBResult(definition, params, payload);
    run.status = run.result.rows.length ? "succeeded" : "empty";
    run.completedAt = now();
    run.error = run.result.rows.length ? null : "OPENBB_QUERY_EMPTY";
    run.logs.push(`查询完成：${run.result.metadata.provider} 返回 ${run.result.metadata.rowCount} 行，保留 ${run.result.rows.length} 行。`);
  } catch (error) {
    run.status = "failed";
    run.completedAt = now();
    run.error = error instanceof Error ? error.message : "OPENBB_QUERY_FAILED";
    run.logs.push("查询失败；未写入任何前端模块。");
  }
  await saveState(state);
  return autoPublishOpenBBRun(run);
}
export async function retryOpenBBQuery(runId: string, actorUserId: number) {
  const state = await readState();
  const run = state.runs.find(item => item.runId === runId);
  if (!run) throw new Error("OPENBB_RUN_NOT_FOUND");
  if (run.endpointId.startsWith("catalog_"))
    return runOpenBBCatalogQuery({
      operationId: run.endpointId.slice("catalog_".length),
      params: run.params,
      requestBody: run.requestBody,
      actorUserId,
    });
  return runOpenBBQuery({
    endpointId: run.endpointId,
    params: run.params,
    actorUserId,
  });
}

const OPENBB_AUTOMATION_MARKET_INTERVAL_MS = 30 * 60_000;
const OPENBB_AUTOMATION_RELEASE_INTERVAL_MS = 6 * 60 * 60_000;
const OPENBB_AUTOMATION_RETRY_INTERVAL_MS = 15 * 60_000;

function openBBAutomationInterval(endpoint: OpenBBEndpoint) {
  return endpoint.domain === "官方经济观察" || endpoint.domain === "全球年度经济数据"
    ? OPENBB_AUTOMATION_RELEASE_INTERVAL_MS
    : OPENBB_AUTOMATION_MARKET_INTERVAL_MS;
}

/**
 * Select only stale, fully parameterized read contracts. A scheduled batch is
 * intentionally small so a minute-level heartbeat cannot become a provider
 * burst. Repeated payloads are stopped by the durable module checksum before
 * another front-end item is written.
 */
export function selectOpenBBAutomationEndpoints(
  runs: OpenBBQueryRun[],
  nowMs = Date.now(),
  maxRuns = 2,
) {
  return OPENBB_ENDPOINTS
    .map((endpoint, order) => {
      const latest = runs.find(run => run.endpointId === endpoint.id && Boolean(run.completedAt));
      const latestAt = latest?.completedAt ? Date.parse(latest.completedAt) : Number.NEGATIVE_INFINITY;
      const retryAfter = latest?.status === "succeeded"
        ? openBBAutomationInterval(endpoint)
        : OPENBB_AUTOMATION_RETRY_INTERVAL_MS;
      const parametersReady = endpoint.required.every(key => {
        const value = endpoint.defaults[key];
        return value !== undefined && value !== null && value !== "";
      });
      const priority = endpoint.domain === "官方经济观察" || endpoint.domain === "全球年度经济数据" ? 1 : 0;
      return { endpoint, order, latestAt, retryAfter, parametersReady, priority };
    })
    .filter(item =>
      item.parametersReady &&
      item.endpoint.suggestedModuleIds.length === 1 &&
      nowMs - item.latestAt >= item.retryAfter
    )
    .sort((left, right) => left.priority - right.priority || left.latestAt - right.latestAt || left.order - right.order)
    .slice(0, Math.max(0, Math.min(8, Math.floor(maxRuns))))
    .map(item => item.endpoint);
}

type OpenBBAutomationSummary = {
  status: "completed" | "already_running";
  selected: number;
  succeeded: number;
  delivered: number;
  duplicateBlocked: number;
  failed: number;
  results: Array<{
    endpointId: string;
    moduleId: string | null;
    status: OpenBBQueryRun["status"];
    deliveryStatus: OpenBBPushRecord["status"] | null;
  }>;
};

let activeOpenBBAutomation: Promise<OpenBBAutomationSummary> | null = null;

/**
 * Successful automatic queries use the same canonical-owner delivery, public
 * field cleaner, durable checksum dedupe and render-ACK path as an
 * administrator-triggered query. Empty and failed queries never reach a
 * terminal module.
 */
export function syncOpenBBAutomation(input: { actorUserId: number; maxRuns?: number }) {
  if (activeOpenBBAutomation) {
    return Promise.resolve({
      status: "already_running" as const,
      selected: 0,
      succeeded: 0,
      delivered: 0,
      duplicateBlocked: 0,
      failed: 0,
      results: [],
    });
  }
  activeOpenBBAutomation = (async () => {
    if (!Number.isInteger(input.actorUserId) || input.actorUserId < 1)
      throw new Error("OPENBB_AUTOMATION_ACTOR_REQUIRED");
    const state = await readState();
    const selected = selectOpenBBAutomationEndpoints(state.runs, Date.now(), input.maxRuns ?? 2);
    const results: OpenBBAutomationSummary["results"] = [];
    for (const endpoint of selected) {
      try {
        const run = await runOpenBBQuery({
          endpointId: endpoint.id,
          params: endpoint.defaults,
          actorUserId: input.actorUserId,
        });
        results.push({
          endpointId: endpoint.id,
          moduleId: run.primaryModuleId ?? null,
          status: run.status,
          deliveryStatus: run.push?.status ?? null,
        });
      } catch {
        results.push({
          endpointId: endpoint.id,
          moduleId: endpoint.suggestedModuleIds[0] ?? null,
          status: "failed",
          deliveryStatus: null,
        });
      }
    }
    return {
      status: "completed" as const,
      selected: selected.length,
      succeeded: results.filter(result => result.status === "succeeded").length,
      delivered: results.filter(result => result.deliveryStatus === "waiting_front_ack" || result.deliveryStatus === "front_acknowledged").length,
      duplicateBlocked: results.filter(result => result.deliveryStatus === "duplicate_blocked").length,
      failed: results.filter(result => result.status === "failed" || result.status === "not_configured").length,
      results,
    };
  })().finally(() => {
    activeOpenBBAutomation = null;
  });
  return activeOpenBBAutomation;
}

function preview(result: OpenBBResult) {
  return `${result.label}；${result.metadata.rowCount} 行；字段 ${result.columns.slice(0, 10).join("、")}；来源 ${result.metadata.provider}。`;
}
function publicBody(result: OpenBBResult) {
  const fieldSummary = result.fields
    .slice(0, 16)
    .map(field => `${field.fieldId}(${field.dataType}/${field.role})`)
    .join("、");
  return [
    `${result.label}返回 ${result.metadata.rowCount} 条观测，以下为前 ${Math.min(12, result.rows.length)} 条。`,
    ...result.rows.slice(0, 12).map(row =>
      result.columns
        .slice(0, 8)
        .map(column => `${column}: ${row[column] ?? "—"}`)
        .join(" · ")
    ),
    `字段字典：${fieldSummary || "无字段"}。`,
    `数据范围：${result.metadata.rangeStart ?? "未提供"} 至 ${result.metadata.rangeEnd ?? "未提供"}；数值字段 ${result.metadata.numericFieldCount}；空值 ${result.metadata.nullCellCount}（${(result.metadata.nullRate * 100).toFixed(2)}%）。`,
    `本次查询时间：${result.metadata.queriedAt}；最新观测期：${result.metadata.observedAt ?? "未提供"}；时区：${result.metadata.timezone}；时效状态：按数据发布状态。`,
  ]
    .join("\n\n")
    .slice(0, 60000);
}
function deliveryReceipt(
  pushId: string,
  moduleId: string,
  userIds: number[],
  sentAt: string
) {
  return {
    receiptId: pushId,
    sentAt,
    targetScope: moduleId,
    sentCount: userIds.length,
    successCount: 0,
    failureCount: 0,
    pendingCount: userIds.length,
    currentStatus: "waiting_front_ack",
    frontAckAt: null,
    latestFrontAckAt: null,
    failureReason: null,
    retryStatus: "not_required",
    acknowledgedClientCount: 0,
    acknowledgedClients: [],
    acknowledgedUserIds: [],
    acknowledgedTerminals: [],
  };
}

export async function deliverOpenBBDataset(input: {
  dataset: OpenBBResult;
  sourceRunId: string;
  moduleIds: string[];
  recipientUserIds: number[];
  actorUserId: number;
  operator: string;
  eventType?: string;
  title?: string;
  contentPreview?: string;
}) {
  const requestedTargets=unique(input.moduleIds);
  if(requestedTargets.length!==1)throw new Error('OPENBB_DATASET_SINGLE_OWNER_REQUIRED');
  const knownOwner=OPENBB_ENDPOINTS.find(def=>def.id===input.dataset.endpointId)?.suggestedModuleIds[0];
  if(knownOwner&&requestedTargets[0]!==knownOwner)throw new Error(`OPENBB_PUSH_CANONICAL_MODULE_ONLY:${knownOwner}`);
  if (!input.dataset.rows.length) throw new Error("OPENBB_DATASET_EMPTY");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const moduleIds = unique(input.moduleIds);
  const modules = ADMIN_DATA_MODULES.filter(item =>
    moduleIds.includes(item.id)
  );
  if (modules.length !== moduleIds.length)
    throw new Error("OPENBB_PUSH_MODULE_NOT_FOUND");
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users);
  const userIds = unique(input.recipientUserIds);
  const recipients = allUsers.filter(user => userIds.includes(user.id));
  if (recipients.length !== userIds.length)
    throw new Error("OPENBB_PUSH_RECIPIENT_NOT_FOUND");
  const sentAt = now();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const pushId = `obbpush_${randomUUID().replaceAll("-", "")}`;
  const traceId = `obbtrace_${randomUUID().replaceAll("-", "")}`;
  const idempotencyKey = digest(
    `${input.sourceRunId}|${moduleIds.slice().sort().join(",")}|${userIds.slice().sort().join(",")}`
  );
  const body = publicBody(input.dataset);
  const title =
    input.title ??
    [input.dataset.label, input.dataset.params.symbol ?? input.dataset.params.country].filter(Boolean).join(' · ');
  const contentKeys: string[] = [];
  const duplicateOfPushIds: string[] = [];
  let duplicateBlockedCount = 0;
  for (const module of modules) {
    const contentHash = openBBDeliveryContentHash(
      module.id,
      input.dataset.metadata.checksum,
      userIds
    );
    const findDuplicate = async () =>
      (
        await db
          .select({
            contentKey: adminDataModuleContentItems.contentKey,
            payload: adminDataModuleContentItems.targetPayload,
          })
          .from(adminDataModuleContentItems)
          .where(
            and(
              eq(adminDataModuleContentItems.moduleId, module.id),
              eq(adminDataModuleContentItems.contentHash, contentHash)
            )
          )
          .limit(1)
      )[0];
    const rememberDuplicate = (
      duplicate: { contentKey: string; payload: unknown } | undefined
    ) => {
      duplicateBlockedCount++;
      const payload =
        duplicate?.payload && typeof duplicate.payload === "object"
          ? (duplicate.payload as Record<string, unknown>)
          : {};
      if (typeof payload.pushId === "string")
        duplicateOfPushIds.push(payload.pushId);
    };
    const duplicate = await findDuplicate();
    if (duplicate) {
      rememberDuplicate(duplicate);
      continue;
    }
    const contentKey = `openbb_${randomUUID().replaceAll("-", "")}`;
    try {
      await db.insert(adminDataModuleContentItems).values({
        contentKey,
        moduleId: module.id,
        contentType: "generic",
        sourceKind: "real",
        status: "delivered",
        title,
        body,
        topic: input.dataset.label,
        category: module.domain,
        keywords: unique([
          input.dataset.endpointId,
          input.dataset.metadata.provider,
          ...Object.keys(input.dataset.params),
        ]),
        tags: ["research-data", "provider-defined"],
        publishedAt: new Date(sentAt),
        sourceReference: `openbb:${input.dataset.endpointId}`,
        contentHash,
        dedupeScope: `openbb:${module.id}:users`,
        qualityScore: 90,
        qualityReport: {
          source: input.dataset.metadata.provider,
          rowCount: input.dataset.metadata.rowCount,
          checksum: input.dataset.metadata.checksum,
          queriedAt: input.dataset.metadata.queriedAt,
          schemaVersion: input.dataset.metadata.schemaVersion,
        },
        targetPayload: {
          contentLabel: title,
          rewrittenSummary: body,
          dataset: input.dataset,
          targetAudience: {
            type: "users",
            userIds,
            recipientCount: userIds.length,
            label: `${userIds.length} 名指定用户`,
          },
          pushId,
          traceId,
          idempotencyKey,
          eventType: input.eventType ?? "openbb.dataset.publish",
          frontendId: "finance-terminal-primary",
          environmentId:
            process.env.NODE_ENV === "production"
              ? "production"
              : "local-preview",
          tenantId: "default",
          moduleId: module.id,
          pageId: module.path,
          targetType: "users",
          targetIds: userIds,
          payload: {
            datasetChecksum: input.dataset.metadata.checksum,
            rowCount: input.dataset.metadata.rowCount,
          },
          schemaVersion: "openbb-push-v1",
          sequence: 1,
          createdAt: sentAt,
          effectiveAt: sentAt,
          expiresAt,
          operatorId: input.actorUserId,
          operator: input.operator,
          checksum: input.dataset.metadata.checksum,
          deliveryReceipt: deliveryReceipt(pushId, module.id, userIds, sentAt),
        },
      });
    } catch (error) {
      if (!isOpenBBDuplicateKeyError(error)) throw error;
      rememberDuplicate(await findDuplicate());
      continue;
    }
    contentKeys.push(contentKey);
  }
  const targetCount = contentKeys.length * userIds.length;
  const push: OpenBBPushRecord = {
    pushId,
    traceId,
    idempotencyKey,
    status: contentKeys.length ? "waiting_front_ack" : "duplicate_blocked",
    moduleIds,
    recipientUserIds: userIds,
    contentKeys,
    createdAt: sentAt,
    sentAt: contentKeys.length ? sentAt : null,
    receivedAt: null,
    appliedAt: null,
    confirmedAt: null,
    expiresAt,
    contentPreview: input.contentPreview ?? preview(input.dataset),
    acknowledgement: contentKeys.length
      ? `已写入 ${contentKeys.length} 个既有模块数据流，等待 ${targetCount} 个前端投递槽完成真实渲染 ACK。`
      : "全部内容被指纹去重拦截，未重复推送。",
    targetCount,
    sentCount: contentKeys.length,
    successCount: 0,
    pendingCount: targetCount,
    failureCount: 0,
    duplicateBlockedCount,
    retryCount: 0,
    failureReason: null,
    duplicateOfPushIds: unique(duplicateOfPushIds),
  };
  return {
    ...push,
    frontendId: "finance-terminal-primary",
    targetModules: modules.map(({ id, name, path }) => ({ id, name, path })),
    recipients,
    ackRequired: contentKeys.length > 0,
  };
}

export async function hydrateOpenBBPushRecord(
  push: OpenBBPushRecord | null
): Promise<OpenBBPushRecord | null> {
  if (!push?.contentKeys.length) return push;
  const db = await getDb();
  if (!db) return push;
  const rows = await db
    .select({
      contentKey: adminDataModuleContentItems.contentKey,
      payload: adminDataModuleContentItems.targetPayload,
    })
    .from(adminDataModuleContentItems)
    .where(inArray(adminDataModuleContentItems.contentKey, push.contentKeys));
  const map = new Map(
    rows.map(row => [
      row.contentKey,
      row.payload && typeof row.payload === "object"
        ? (row.payload as any)
        : {},
    ])
  );
  let slots = 0,
    success = 0,
    pending = 0,
    failed = 0;
  let receivedAt: null | string = null,
    appliedAt: null | string = null;
  for (const key of push.contentKeys) {
    const receipt = map.get(key)?.deliveryReceipt ?? {};
    slots += Number(receipt.sentCount ?? push.recipientUserIds.length);
    success += Number(receipt.successCount ?? 0);
    pending += Number(receipt.pendingCount ?? 0);
    failed += Number(receipt.failureCount ?? 0);
    receivedAt = receipt.latestFrontAckAt ?? receivedAt;
    appliedAt = receipt.frontAckAt ?? appliedAt;
  }
  const complete = slots > 0 && pending === 0 && success >= slots;
  return {
    ...push,
    status: complete ? "front_acknowledged" : failed ? "failed" : push.status,
    targetCount: slots,
    successCount: success,
    pendingCount: pending,
    failureCount: failed,
    receivedAt,
    appliedAt,
    confirmedAt: complete ? appliedAt : null,
    acknowledgement: complete
      ? `前端已真实渲染并确认 ${success}/${slots} 个投递槽。`
      : `等待前端实际渲染 ACK：已确认 ${success}/${slots}。`,
  };
}

export async function pushOpenBBResult(input: {
  runId: string;
  moduleIds: string[];
  recipientUserIds: number[];
  actorUserId: number;
  operator: string;
}) {
  const state = await readState();
  const run = state.runs.find(item => item.runId === input.runId);
  if (!run) throw new Error("OPENBB_RUN_NOT_FOUND");
  if (run.status !== "succeeded" || !run.result?.rows.length)
    throw new Error("OPENBB_RUN_NOT_READY_FOR_PUSH");
  let canonicalModuleId = run.primaryModuleId;
  if (canonicalModuleId === undefined && run.endpointId.startsWith("catalog_")) {
    const inspection = await inspectOpenBBApi(false);
    canonicalModuleId = inspection.openapi.operations.find(
      item => item.operationId === run.endpointId.slice("catalog_".length)
    )?.primaryModuleId ?? null;
  }
  if (canonicalModuleId === undefined) {
    canonicalModuleId =
      OPENBB_ENDPOINTS.find(item => item.id === run.endpointId)
        ?.suggestedModuleIds[0] ?? null;
  }
  if (!canonicalModuleId) throw new Error("OPENBB_PUSH_BACKEND_ONLY_CONTRACT");
  const requestedModules = unique(input.moduleIds);
  if (
    requestedModules.length !== 1 ||
    requestedModules[0] !== canonicalModuleId
  )
    throw new Error(`OPENBB_PUSH_CANONICAL_MODULE_ONLY:${canonicalModuleId}`);
  const delivery = await deliverOpenBBDataset({
    dataset: run.result,
    sourceRunId: run.runId,
    moduleIds: [canonicalModuleId],
    recipientUserIds: input.recipientUserIds,
    actorUserId: input.actorUserId,
    operator: input.operator,
  });
  const { frontendId, targetModules, recipients, ackRequired, ...push } =
    delivery;
  run.lastPushAttempt = push;
  if (push.status !== "duplicate_blocked" || !run.push?.contentKeys.length)
    run.push = push;
  await saveState(state);
  return {
    ...push,
    frontendId,
    targetModules,
    recipients,
    ackRequired,
    duplicateOfPushId:
      push.status === "duplicate_blocked"
        ? (push.duplicateOfPushIds?.[0] ?? run.push?.pushId ?? null)
        : null,
  };
}

async function hydrate(runs: OpenBBQueryRun[]) {
  const db = await getDb();
  if (!db) return runs;
  const keys = unique(runs.flatMap(run => run.push?.contentKeys ?? []));
  if (!keys.length) return runs;
  const rows = await db
    .select({
      contentKey: adminDataModuleContentItems.contentKey,
      payload: adminDataModuleContentItems.targetPayload,
    })
    .from(adminDataModuleContentItems)
    .where(inArray(adminDataModuleContentItems.contentKey, keys));
  const map = new Map(
    rows.map(row => [
      row.contentKey,
      row.payload && typeof row.payload === "object"
        ? (row.payload as any)
        : {},
    ])
  );
  return runs.map(run => {
    if (!run.push?.contentKeys.length) return run;
    let slots = 0,
      success = 0,
      pending = 0,
      failed = 0;
    let receivedAt: null | string = null,
      appliedAt: null | string = null;
    for (const key of run.push.contentKeys) {
      const receipt = map.get(key)?.deliveryReceipt ?? {};
      slots += Number(receipt.sentCount ?? run.push.recipientUserIds.length);
      success += Number(receipt.successCount ?? 0);
      pending += Number(receipt.pendingCount ?? 0);
      failed += Number(receipt.failureCount ?? 0);
      receivedAt = receipt.latestFrontAckAt ?? receivedAt;
      appliedAt = receipt.frontAckAt ?? appliedAt;
    }
    const complete = slots > 0 && pending === 0 && success >= slots;
    return {
      ...run,
      push: {
        ...run.push,
        status: complete
          ? "front_acknowledged"
          : failed
            ? "failed"
            : run.push.status,
        targetCount: slots,
        successCount: success,
        pendingCount: pending,
        failureCount: failed,
        receivedAt,
        appliedAt,
        confirmedAt: complete ? appliedAt : null,
        acknowledgement: complete
          ? `前端已真实渲染并确认 ${success}/${slots} 个投递槽。`
          : `等待前端实际渲染 ACK：已确认 ${success}/${slots}。`,
      },
    };
  });
}

export function mergeHydratedOpenBBRuns(
  storedRuns: OpenBBQueryRun[],
  hydratedRuns: OpenBBQueryRun[]
) {
  const hydratedPushes = new Map(
    hydratedRuns.flatMap(run =>
      run.push ? [[run.runId, run.push] as const] : []
    )
  );
  let changed = false;
  const runs = storedRuns.map(run => {
    const push = hydratedPushes.get(run.runId);
    if (
      !push ||
      !run.push ||
      push.pushId !== run.push.pushId ||
      JSON.stringify(push) === JSON.stringify(run.push)
    )
      return run;
    changed = true;
    return { ...run, push };
  });
  return { runs, changed };
}

async function persistHydratedOpenBBRuns(hydratedRuns: OpenBBQueryRun[]) {
  writes = writes.catch(() => undefined).then(async () => {
    const latest = await readState();
    const merged = mergeHydratedOpenBBRuns(latest.runs, hydratedRuns);
    if (!merged.changed) return;
    const temp = `${FILE}.${randomUUID()}.tmp`;
    await writeFile(
      temp,
      JSON.stringify({ ...latest, runs: merged.runs.slice(0, 100) }, null, 2),
      "utf8"
    );
    await replaceFileWithRetry(temp, FILE);
  });
  await writes;
}

export async function getOpenBBPriorityAWorkspace(actorUserId?: number) {
  const state = await readState();
  const db = await getDb();
  const recipientRows = db
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
    : [];
  const recipients = actorUserId
    ? [...recipientRows].sort(
        (left, right) =>
          Number(right.id === actorUserId) - Number(left.id === actorUserId)
      )
    : recipientRows;
  const runs = await hydrate(state.runs);
  await persistHydratedOpenBBRuns(runs);
  const inspection = await inspectOpenBBApi(false);
  const persistedContracts = db
    ? await db
        .select({
          dataContractId: marketDataObservationHistory.dataContractId,
          rowCount: sql<number>`count(*)`,
        })
        .from(marketDataObservationHistory)
        .groupBy(marketDataObservationHistory.dataContractId)
    : [];
  const automationDatasetIds = new Set([
    ...MANAGED_PUBLIC_DATASETS.map(dataset => dataset.id),
    ...FINMIND_MODULE_BINDINGS.filter(binding => !binding.id.includes("directory")).map(binding => `finmind:${binding.id}`),
  ]);
  const [automationSchedule, allAutomationStates] = await Promise.all([
    getManagedPublicDatasetSchedule(),
    db ? db.select().from(managedPublicDatasetStates) : Promise.resolve([]),
  ]);
  const automationStates = allAutomationStates.filter(state => automationDatasetIds.has(state.datasetId));
  const lastAutomationSuccessAt = automationStates
    .flatMap(state => state.lastSuccessAt ? [state.lastSuccessAt] : [])
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const verifiedOpenBBOperationIds = new Set(
    runs
      .filter(run => run.status === "succeeded")
      .map(run => run.endpointId)
  );
  const assetClassSummary = summarizeOpenBBAssetClasses(
    inspection.openapi.operations,
    verifiedOpenBBOperationIds
  );
  const finceptTerminal = await getFinceptTerminalStatus();
  const finceptAutoSync = getFinceptPublicAutoSyncStatus();
  return {
    runtime: inspection.runtime,
    apiCatalog: {
      ...inspection.openapi,
      assetClassSummary,
    },
    coverage: buildApiCoverage(inspection.openapi.operations, runs, persistedContracts),
    automation: {
      enabled: Boolean(automationSchedule?.isEnabled) || finceptAutoSync.enabled,
      cronExpression: automationSchedule?.cronExpression ?? (finceptAutoSync.enabled ? "每 60 秒检查到期连接器" : null),
      registeredDatasetCount: automationDatasetIds.size,
      successfulDatasetCount: automationStates.filter(state => state.lastStatus === "available" || state.lastStatus === "succeeded").length,
      failedDatasetCount: automationStates.filter(state => state.lastStatus === "failed" || state.lastStatus === "unavailable").length,
      waitingDatasetCount: Math.max(0, automationDatasetIds.size - automationStates.length),
      lastSuccessAt: lastAutomationSuccessAt?.toISOString() ?? null,
      pipeline: ["自动执行", "字段清洗", "唯一功能归属", "指纹去重", "永久归档", "前端读取"],
      runtime: finceptAutoSync,
    },
    finceptCapabilities: FINCEPT_CAPABILITIES,
    finceptTerminal,
    endpoints: OPENBB_ENDPOINTS,
    runs,
    modules: ADMIN_DATA_MODULES.map(({ id, name, path, domain }) => ({
      id,
      name,
      path,
      domain,
    })),
    audience: {
      frontendId: "finance-terminal-primary",
      currentUserId: actorUserId ?? null,
      recipients,
    },
  };
}
export async function refreshOpenBBPriorityARuntime() {
  healthCache = null;
  openApiCache = null;
  return inspectOpenBBApi(true);
}
