const BOI_URL = "https://www.boi.org.il/PublicApi/GetExchangeRates";

type RecordValue = Record<string, unknown>;

export type BoiObservation = {
  date: string;
  value: number;
  fields: Record<string, string | number | null>;
};

export type BoiSeriesResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "provider_defined";
  history: BoiObservation[];
  limitation: string;
};

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function positiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * FinceptTerminal's public_apis_finance_data.py points at the Bank of Israel
 * exchange-rate service. The service publishes ILS per a stated currency
 * unit. We normalize to ILS per one unit while retaining the published unit
 * and raw change field. This is a daily official reference, not an executable
 * quote.
 */
export async function fetchFinceptBoiFxBasket(): Promise<BoiSeriesResult> {
  const retrievedAt = new Date();
  try {
    const response = await fetch(BOI_URL, {
      headers: { accept: "application/json", "user-agent": "FinanceHub/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`BOI_HTTP_${response.status}`);
    const payload = record(await response.json());
    const rows = Array.isArray(payload?.exchangeRates) ? payload.exchangeRates : [];
    const history: BoiObservation[] = [];
    const seen = new Set<string>();
    for (const raw of rows) {
      const row = record(raw);
      const code = String(row?.key ?? "").trim().toUpperCase();
      const unit = positiveNumber(row?.unit);
      const rawRate = positiveNumber(row?.currentExchangeRate);
      const date = isoDate(row?.lastUpdate);
      if (!/^[A-Z]{3}$/.test(code) || unit === null || rawRate === null || !date) continue;
      const value = rawRate / unit;
      if (!Number.isFinite(value) || value <= 0 || seen.has(`${date}|${code}`)) continue;
      seen.add(`${date}|${code}`);
      const change = typeof row?.currentChange === "number"
        ? row.currentChange
        : typeof row?.currentChange === "string" && Number.isFinite(Number(row.currentChange))
          ? Number(row.currentChange)
          : null;
      history.push({
        date,
        value,
        fields: {
          symbol: `${code}/ILS`,
          name: `${code}/以色列新谢克尔日频参考汇率`,
          base: code,
          quote: "ILS",
          currency: "ILS",
          unit: `ILS/${code}`,
          publishedUnit: unit,
          publishedRate: rawRate,
          changePct: change,
          observationType: "daily_fx_reference",
          lastUpdate: typeof row?.lastUpdate === "string" ? row.lastUpdate : null,
        },
      });
    }
    return {
      available: history.length > 0,
      symbol: "BOI:TABLE:DAILY:ILS",
      source: "Bank of Israel official public reference observations",
      sourceUrl: BOI_URL,
      observedAt: history.map(point => point.date).sort().at(-1) ?? null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "provider_defined",
      history,
      limitation: history.length
        ? "以色列银行每日公开参考汇率，已按公布单位归一化为 ILS/单位外币；非实时、非可执行报价。"
        : "以色列银行本次没有返回可验证参考汇率；没有生成占位数据。",
    };
  } catch (error) {
    return {
      available: false,
      symbol: "BOI:TABLE:DAILY:ILS",
      source: "Bank of Israel official public reference observations",
      sourceUrl: BOI_URL,
      observedAt: null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "provider_defined",
      history: [],
      limitation: `以色列银行参考汇率当前不可用：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
