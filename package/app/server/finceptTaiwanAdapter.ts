const TWSE_API_BASE = "https://openapi.twse.com.tw/v1";
const DEFAULT_TIMEOUT_MS = 12_000;

type JsonRecord = Record<string, unknown>;

export type FinceptTaiwanObservation = {
  date: string;
  symbol: string;
  payload: Record<string, string | number | null>;
};

export type FinceptTaiwanSeriesResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: boolean;
  delayStatus: "provider_defined";
  history: FinceptTaiwanObservation[];
  limitation: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const cleaned = value.trim();
    return cleaned || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "---" || cleaned === "－") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * TWSE returns both Gregorian dates (20260923) and ROC dates (1150923).
 * Preserve the exchange's observation date without inventing an intraday time.
 */
export function normalizeTwseDate(value: unknown): string | null {
  const raw = text(value)?.replace(/[^\d]/g, "") ?? "";
  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6));
    const day = Number(raw.slice(6, 8));
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
  }
  if (/^\d{7}$/.test(raw)) {
    const year = Number(raw.slice(0, 3)) + 1911;
    const month = Number(raw.slice(3, 5));
    const day = Number(raw.slice(5, 7));
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`;
    }
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

async function twseGet(path: string): Promise<unknown> {
  const response = await fetch(`${TWSE_API_BASE}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`TWSE_HTTP_${response.status}`);
  return response.json();
}

function rows(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
}

function firstDate(records: JsonRecord[]): string | null {
  for (const record of records) {
    const date = normalizeTwseDate(record.Date ?? record.date ?? record.日期);
    if (date) return date;
  }
  return null;
}

function asSeriesResult(input: {
  symbol: string;
  sourceUrl: string;
  history: FinceptTaiwanObservation[];
  realtime: boolean;
  limitation: string;
}): FinceptTaiwanSeriesResult {
  const retrievedAt = new Date().toISOString();
  const observedAt = input.history.length
    ? input.history.map(item => item.date).sort().at(-1) ?? null
    : null;
  return {
    available: input.history.length > 0,
    symbol: input.symbol,
    source: "TWSE official public market observations",
    sourceUrl: input.sourceUrl,
    observedAt,
    retrievedAt,
    realtime: input.realtime,
    delayStatus: "provider_defined",
    history: input.history,
    limitation: input.limitation,
  };
}

/**
 * FinceptTerminal's Taiwan connector uses the TWSE OpenAPI for a public
 * exchange snapshot. The adapter normalizes only exchange fields needed by
 * the existing EQS data slot; credentials and provider metadata never cross
 * the public feed boundary.
 */
export async function fetchFinceptTwseEquitySnapshot(): Promise<FinceptTaiwanSeriesResult> {
  const sourceUrl = `${TWSE_API_BASE}/exchangeReport/STOCK_DAY_ALL`;
  try {
    const records = rows(await twseGet("/exchangeReport/STOCK_DAY_ALL"));
    const history = records.flatMap(record => {
      const symbol = text(record.Code);
      const date = normalizeTwseDate(record.Date);
      if (!symbol || !date) return [];
      const close = number(record.ClosingPrice);
      if (close === null) return [];
      return [{
        date,
        symbol,
        payload: {
          symbol,
          name: text(record.Name),
          securityName: text(record.Name),
          exchange: "TWSE",
          currency: "TWD",
          open: number(record.OpeningPrice),
          high: number(record.HighestPrice),
          low: number(record.LowestPrice),
          close,
          value: close,
          change: number(record.Change),
          volume: number(record.TradeVolume),
          tradeValue: number(record.TradeValue),
          transaction: number(record.Transaction),
          observationType: "exchange_snapshot",
          frequency: "exchange_published",
          freshness: "dated_exchange_snapshot",
        },
      }];
    });
    return asSeriesResult({
      symbol: "TWSE:ALL",
      sourceUrl,
      history,
      realtime: false,
      limitation: "交易所公开快照仅带观察日，无法验证逐笔实时性；收市后以最近公布交易日为准。",
    });
  } catch (error) {
    return asSeriesResult({
      symbol: "TWSE:ALL",
      sourceUrl,
      history: [],
      realtime: false,
      limitation: `交易所公开快照当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * The archive calls BWIBBU_d a security master, but its actual response is a
 * dated valuation table. Keep it separate from the OHLCV contract: ClosePrice
 * is deliberately not projected as another quote.
 */
export async function fetchFinceptTwseValuations(): Promise<FinceptTaiwanSeriesResult> {
  const sourceUrl = `${TWSE_API_BASE}/exchangeReport/BWIBBU_d`;
  try {
    const records = rows(await twseGet("/exchangeReport/BWIBBU_d"));
    const history = records.flatMap(record => {
      const symbol = text(record.Code);
      const date = normalizeTwseDate(record.Date);
      const pe = number(record.PEratio);
      const pbr = number(record.PBratio);
      const dividendYield = number(record.DividendYield);
      if (!symbol || !date || (pe === null && pbr === null && dividendYield === null)) return [];
      return [{
        date,
        symbol,
        payload: {
          symbol,
          name: text(record.Name),
          securityName: text(record.Name),
          exchange: "TWSE",
          currency: "TWD",
          pe,
          pbr,
          dividendYield,
          fiscalYearQuarter: text(record.FiscalYearQuarter),
          dividendYear: text(record.DividendYear),
          value: pe,
          observationType: "equity_valuation",
          frequency: "daily_public",
        },
      }];
    });
    return asSeriesResult({
      symbol: "TWSE:VALUATIONS",
      sourceUrl,
      history,
      realtime: false,
      limitation: "交易所最近公布的估值观察；非逐笔实时行情，缺失指标保持空值。",
    });
  } catch (error) {
    return asSeriesResult({
      symbol: "TWSE:VALUATIONS",
      sourceUrl,
      history: [],
      realtime: false,
      limitation: `交易所估值观察当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export async function fetchFinceptTaiexSnapshot(): Promise<FinceptTaiwanSeriesResult> {
  const sourceUrl = `${TWSE_API_BASE}/exchangeReport/FMTQIK`;
  try {
    const records = rows(await twseGet("/exchangeReport/FMTQIK"));
    const latest = records.at(-1);
    if (!latest) {
      return asSeriesResult({
        symbol: "TAIEX",
        sourceUrl,
        history: [],
        realtime: false,
        limitation: "交易所未返回可核验的 TAIEX 观察。",
      });
    }
    const date = normalizeTwseDate(latest.Date);
    const close = number(latest.TAIEX ?? latest.ClosePrice);
    if (!date || close === null) {
      return asSeriesResult({
        symbol: "TAIEX",
        sourceUrl,
        history: [],
        realtime: false,
        limitation: "交易所返回的数据缺少有效日期或指数值。",
      });
    }
    return asSeriesResult({
      symbol: "TAIEX",
      sourceUrl,
      history: [{
        date,
        symbol: "TAIEX",
        payload: {
          symbol: "TAIEX",
          name: "台湾加权股价指数",
          securityName: "台湾加权股价指数",
          exchange: "TWSE",
          currency: "TWD",
          close,
          value: close,
          change: number(latest.Change),
          volume: number(latest.TradeVolume),
          tradeValue: number(latest.TradeValue),
          transaction: number(latest.Transaction),
          observationType: "index_snapshot",
          frequency: "exchange_published",
          freshness: "dated_exchange_snapshot",
        },
      }],
      realtime: false,
      limitation: "交易所公开指数快照仅带观察日，无法验证逐笔实时性；收市后以最近公布交易日为准。",
    });
  } catch (error) {
    return asSeriesResult({
      symbol: "TAIEX",
      sourceUrl,
      history: [],
      realtime: false,
      limitation: `交易所指数快照当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export const FINCEPT_TWSE_SOURCE = {
  id: "fincept-twse-official",
  label: "TWSE 官方公开市场观察",
  apiBase: TWSE_API_BASE,
  capabilities: ["EQS 股票快照", "EQS 股票估值", "WEI/指数中心 TAIEX 指数快照"],
} as const;
