const API_BASE = "https://api.nbp.pl/api";

type RecordValue = Record<string, unknown>;
type Observation = { date: string; value: number; fields: Record<string, string | number | null> };

export type NbpSeriesResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "provider_defined";
  history: Observation[];
  limitation: string;
};

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function observationDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function get(path: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`NBP_HTTP_${response.status}`);
  return response.json();
}

function series(input: {
  symbol: string;
  sourceUrl: string;
  history: Observation[];
  limitation: string;
}): NbpSeriesResult {
  return {
    available: input.history.length > 0,
    symbol: input.symbol,
    source: "NBP official public reference observations",
    sourceUrl: input.sourceUrl,
    observedAt: input.history.map(point => point.date).sort().at(-1) ?? null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "provider_defined",
    history: input.history,
    limitation: input.limitation,
  };
}

/**
 * FinceptTerminal's public_apis_finance_data.py uses these two NBP public
 * endpoints. Gold is PLN per gram, and USD/PLN is PLN per one USD; neither
 * is an executable quote or an intraday market price.
 */
export async function fetchFinceptNbpGold(): Promise<NbpSeriesResult> {
  const sourceUrl = `${API_BASE}/cenyzlota/last/30/?format=json`;
  try {
    const response = await get("/cenyzlota/last/30/?format=json");
    const history = (Array.isArray(response) ? response : []).flatMap(value => {
      const item = record(value);
      const date = observationDate(item?.data);
      const price = positiveNumber(item?.cena);
      return date && price !== null ? [{
        date,
        value: price,
        fields: {
          symbol: "NBP:GOLD:PLN:G",
          name: "黄金参考价（波兰兹罗提/克）",
          price,
          currency: "PLN",
          unit: "PLN/克",
          observationType: "gold_reference",
        },
      }] : [];
    });
    return series({
      symbol: "NBP:GOLD:PLN:G",
      sourceUrl,
      history,
      limitation: "官方每日黄金参考价，单位 PLN/克；只按发布日更新，非实时交易报价。",
    });
  } catch (error) {
    return series({
      symbol: "NBP:GOLD:PLN:G",
      sourceUrl,
      history: [],
      limitation: `黄金参考价当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export async function fetchFinceptNbpUsdPln(): Promise<NbpSeriesResult> {
  const sourceUrl = `${API_BASE}/exchangerates/rates/a/usd/last/30/?format=json`;
  try {
    const response = record(await get("/exchangerates/rates/a/usd/last/30/?format=json"));
    if (String(response?.code ?? "").toUpperCase() !== "USD") {
      throw new Error("NBP_CURRENCY_MISMATCH");
    }
    const history = (Array.isArray(response?.rates) ? response.rates : []).flatMap(value => {
      const item = record(value);
      const date = observationDate(item?.effectiveDate);
      const mid = positiveNumber(item?.mid);
      return date && mid !== null ? [{
        date,
        value: mid,
        fields: {
          symbol: "USD/PLN",
          name: "美元兑波兰兹罗提参考汇率",
          base: "USD",
          quote: "PLN",
          currency: "PLN",
          unit: "PLN/USD",
          observationType: "daily_fx_reference",
        },
      }] : [];
    });
    return series({
      symbol: "USD/PLN",
      sourceUrl,
      history,
      limitation: "官方日频中间参考汇率，单位 PLN/USD；不代表可执行买卖报价。",
    });
  } catch (error) {
    return series({
      symbol: "USD/PLN",
      sourceUrl,
      history: [],
      limitation: `USD/PLN 参考汇率当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Table A is a single daily publication containing multiple PLN reference
 * pairs. USD/PLN has its own existing contract, so this basket deliberately
 * excludes USD and never publishes the same pair through two contracts.
 */
export async function fetchFinceptNbpFxBasket(): Promise<NbpSeriesResult> {
  const sourceUrl = `${API_BASE}/exchangerates/tables/a/last/30/?format=json`;
  try {
    const response = await get("/exchangerates/tables/a/last/30/?format=json");
    const seen = new Set<string>();
    const history: Observation[] = [];
    for (const rawTable of Array.isArray(response) ? response : []) {
      const table = record(rawTable);
      if (String(table?.table ?? "").toUpperCase() !== "A") continue;
      const date = observationDate(table?.effectiveDate);
      if (!date || !Array.isArray(table?.rates)) continue;
      for (const rawRate of table.rates) {
        const rate = record(rawRate);
        const code = String(rate?.code ?? "").toUpperCase();
        const mid = positiveNumber(rate?.mid);
        if (!/^[A-Z]{3}$/.test(code) || code === "USD" || code === "PLN" || mid === null) continue;
        const pair = `${code}/PLN`;
        const identity = `${date}|${pair}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        history.push({
          date,
          value: mid,
          fields: {
            symbol: pair,
            name: `${code}/PLN 日频参考汇率`,
            base: code,
            quote: "PLN",
            currency: "PLN",
            unit: `PLN/${code}`,
            observationType: "daily_fx_reference",
          },
        });
      }
    }
    return series({
      symbol: "NBP:TABLE:A:PLN",
      sourceUrl,
      history,
      limitation: "官方 A 表多币种日频中间参考汇率；不含另行归档的 USD/PLN，不代表可执行买卖报价。",
    });
  } catch (error) {
    return series({
      symbol: "NBP:TABLE:A:PLN",
      sourceUrl,
      history: [],
      limitation: `多币种参考汇率当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
