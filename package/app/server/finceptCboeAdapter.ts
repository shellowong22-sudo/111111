const CBOE_BASE =
  "https://cdn.cboe.com/api/global/us_indices/daily_prices";
const INDEX_FILES = {
  VIX: "VIX_History.csv",
  VIX3M: "VIX3M_History.csv",
  VVIX: "VVIX_History.csv",
  SKEW: "SKEW_History.csv",
  VXN: "VXN_History.csv",
  VXO: "VXO_History.csv",
  GVZ: "GVZ_History.csv",
  OVX: "OVX_History.csv",
  TYVIX: "TYVIX_History.csv",
  SHORTVOL: "ShortTermVol_History.csv",
} as const;

function number(value: string | undefined) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCboeHistoryCsv(text: string, symbol: keyof typeof INDEX_FILES) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(value => value.trim().toUpperCase());
  const dateIndex = headers.indexOf("DATE");
  const closeIndex = headers.indexOf("CLOSE");
  if (dateIndex < 0 || closeIndex < 0) return [];
  return lines.slice(1).flatMap(line => {
    const fields = line.split(",").map(value => value.trim());
    const rawDate = fields[dateIndex];
    const close = number(fields[closeIndex]);
    const dateParts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rawDate ?? "");
    const date = dateParts
      ? new Date(Date.UTC(Number(dateParts[3]), Number(dateParts[1]) - 1, Number(dateParts[2])))
      : rawDate
        ? new Date(rawDate)
        : null;
    if (!date || !Number.isFinite(date.getTime()) || close === null) return [];
    return [{
      date: date.toISOString().slice(0, 10),
      value: close,
      fields: { symbol, close, open: number(fields[headers.indexOf("OPEN")]), high: number(fields[headers.indexOf("HIGH")]), low: number(fields[headers.indexOf("LOW")]), indexFamily: "CBOE volatility indices", freshness: "official_delayed_history" },
    }];
  });
}

/**
 * CBOE's public CSV history is used for historical volatility observations.
 * Values are deliberately labeled as delayed/public history and never
 * presented as live option-chain quotes.
 */
export async function fetchFinceptCboeVolatilityHistory() {
  const retrievedAt = new Date();
  const results = await Promise.all(Object.entries(INDEX_FILES).map(async ([symbol, file]) => {
    try {
      const response = await fetch(`${CBOE_BASE}/${file}`, {
        headers: { accept: "text/csv", "user-agent": "FinanceHub/1.0" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return [];
      return parseCboeHistoryCsv(await response.text(), symbol as keyof typeof INDEX_FILES);
    } catch {
      return [];
    }
  }));
  const history = results.flat();
  return {
    available: history.length > 0,
    symbol: "CBOE:VOLATILITY",
    source: "CBOE public volatility history",
    sourceUrl: CBOE_BASE,
    observedAt: history.at(-1)?.date ?? null,
    retrievedAt: retrievedAt.toISOString(),
    realtime: false,
    delayStatus: "historical",
    limitation: history.length
      ? "CBOE 公开历史波动率指数；非实时期权链或可执行报价。"
      : "CBOE 公开历史文件本次不可用；没有生成替代值。",
    history,
  };
}
