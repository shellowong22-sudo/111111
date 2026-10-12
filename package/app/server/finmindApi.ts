import { setTimeout as wait } from "node:timers/promises";

/**
 * Small, evidence-first adapter for the FinMind v4 API.
 *
 * FinMind contains many datasets with different entitlement and parameter
 * rules.  Keeping a whitelist here prevents an arbitrary dataset from being
 * forwarded to the browser and gives every consumer the same availability
 * contract.  A failed or restricted request is returned as unavailable; no
 * fallback value is generated.
 */
export const FINMIND_ENDPOINT = "https://api.finmindtrade.com/api/v4/data";

export const FINMIND_DATASETS = [
  "TaiwanStockPrice",
  "TaiwanStockPER",
  "TaiwanStockDividend",
  "TaiwanStockTotalReturnIndex",
  "USStockPrice",
  "TaiwanStockInfo",
  "USStockInfo",
  "JapanStockInfo",
  "EuropeStockInfo",
  "GoldPrice",
  "TaiwanFuturesDaily",
  "TaiwanOptionDaily",
  "TaiwanStockNews",
] as const;
export type FinMindDataset = (typeof FINMIND_DATASETS)[number];

export type FinMindRow = Record<string, string | number | boolean | null>;
export type FinMindResult = {
  available: boolean;
  dataset: FinMindDataset;
  rows: FinMindRow[];
  observedAt: string | null;
  retrievedAt: string;
  freshness: "historical" | "end_of_day" | "official_reference" | "unavailable";
  limitation: string;
};

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
const INTERNAL_KEYS = /^(?:source|source_url|source_reference|url|endpoint|api[_-]?key|token|secret|password|provider|crawler|scrap|spider|fetched|retrieved|collection)/i;

function isDataset(value: string): value is FinMindDataset {
  return (FINMIND_DATASETS as readonly string[]).includes(value);
}

function scalar(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.length <= 2_000 ? value : value.slice(0, 2_000);
  return null;
}

/** Remove transport/provenance fields before a row can be returned to a UI. */
export function cleanFinMindRow(value: unknown): FinMindRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !INTERNAL_KEYS.test(key))
    .map(([key, item]) => [key, scalar(item)])) as FinMindRow;
}

function dateFromRow(row: FinMindRow): string | null {
  for (const key of ["date", "Date", "datetime", "time", "AnnouncementDate"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.slice(0, 32);
  }
  return null;
}

function defaultDataId(dataset: FinMindDataset): string | undefined {
  const env = process.env.FINMIND_DATA_ID?.trim();
  if (env) return env;
  if (["TaiwanStockPrice", "TaiwanStockPER", "TaiwanStockDividend"].includes(dataset)) return process.env.FINMIND_TAIWAN_STOCK_ID?.trim() || "2330";
  if (dataset === "USStockPrice") return process.env.FINMIND_US_STOCK_ID?.trim() || "AAPL";
  if (dataset === "TaiwanStockTotalReturnIndex") return process.env.FINMIND_INDEX_ID?.trim() || "TAIEX";
  return undefined;
}

export function finMindDatasetRequiresDataId(dataset: FinMindDataset) {
  return ["TaiwanStockPrice", "TaiwanStockPER", "TaiwanStockDividend", "USStockPrice", "TaiwanStockTotalReturnIndex", "TaiwanStockNews", "TaiwanFuturesDaily", "TaiwanOptionDaily"].includes(dataset);
}

export function finMindDatasetFreshness(dataset: FinMindDataset): FinMindResult["freshness"] {
  if (["TaiwanStockPrice", "TaiwanStockPER", "TaiwanStockDividend", "USStockPrice", "TaiwanStockTotalReturnIndex", "TaiwanFuturesDaily", "TaiwanOptionDaily"].includes(dataset)) return "end_of_day";
  if (["GoldPrice"].includes(dataset)) return "official_reference";
  if (["TaiwanStockNews"].includes(dataset)) return "historical";
  return "historical";
}

export async function fetchFinMindDataset(input: {
  dataset: FinMindDataset | string;
  dataId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  selection?: "latest_active_options";
  signal?: AbortSignal;
}): Promise<FinMindResult> {
  const retrievedAt = new Date().toISOString();
  const dataset = String(input.dataset);
  if (!isDataset(dataset)) return { available: false, dataset: "TaiwanStockInfo", rows: [], observedAt: null, retrievedAt, freshness: "unavailable", limitation: "该数据集不在已接入能力范围。" };
  const params = new URLSearchParams({ dataset });
  const dataId = input.dataId?.trim() || defaultDataId(dataset);
  if (dataId) params.set("data_id", dataId);
  if (input.startDate) params.set("start_date", input.startDate);
  if (input.endDate) params.set("end_date", input.endDate);
  const headers: Record<string, string> = { accept: "application/json" };
  const token = process.env.FINMIND_TOKEN?.trim() || process.env.FINMIND_API_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      response = await fetch(`${FINMIND_ENDPOINT}?${params.toString()}`, { headers, signal: input.signal ?? controller.signal });
      if (response.ok || !RETRYABLE.has(response.status)) break;
      lastError = `HTTP_${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    await wait(250 * (attempt + 1));
  }
  if (!response || !response.ok) return { available: false, dataset, rows: [], observedAt: null, retrievedAt, freshness: "unavailable", limitation: lastError || "公开接口暂未返回可验证数据。" };
  let body: unknown;
  try { body = await response.json(); } catch { return { available: false, dataset, rows: [], observedAt: null, retrievedAt, freshness: "unavailable", limitation: "接口返回格式不可验证。" }; }
  const raw = body && typeof body === "object" ? body as { status?: number; msg?: string; data?: unknown } : {};
  const rows = Array.isArray(raw.data) ? raw.data.map(cleanFinMindRow).filter(row => Object.keys(row).length > 0) : [];
  const rowLimit = Math.min(Math.max(input.limit ?? 500, 1), 5_000);
  const latestDate = rows.map(dateFromRow).filter((value): value is string => Boolean(value)).sort().at(-1);
  const selected = input.selection === "latest_active_options" && dataset === "TaiwanOptionDaily"
    ? rows.filter(row => dateFromRow(row) === latestDate)
      .sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))
    : rows;
  const limited = input.selection === "latest_active_options" ? selected.slice(0, rowLimit) : selected.slice(-rowLimit);
  const observedAt = limited.map(dateFromRow).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  if (raw.status !== 200 || !rows.length) return { available: false, dataset, rows: [], observedAt, retrievedAt, freshness: "unavailable", limitation: typeof raw.msg === "string" ? raw.msg.slice(0, 300) : "公开接口没有返回可验证观察。" };
  return { available: true, dataset, rows: limited, observedAt, retrievedAt, freshness: finMindDatasetFreshness(dataset), limitation: "仅展示已返回并清洗的业务观察；不代表实时可执行报价。" };
}

export function listFinMindDatasetCatalog() {
  return FINMIND_DATASETS.map(dataset => ({ dataset, freshness: finMindDatasetFreshness(dataset), requiresDataId: finMindDatasetRequiresDataId(dataset) }));
}
