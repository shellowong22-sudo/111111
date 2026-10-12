const NASDAQ_SCREENER =
  "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&exchange=all";

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Nasdaq's public screener is a delayed/public observation source.  The
 * result is normalized to the existing EQS contract and stored by symbol and
 * UTC observation day.  It is never labeled as an exchange execution feed.
 */
export async function fetchFinceptNasdaqScreener() {
  const retrievedAt = new Date();
  try {
    const response = await fetch(NASDAQ_SCREENER, {
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent": "Mozilla/5.0 FinanceHub/1.0",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        available: false,
        symbol: "NASDAQ:SCREENER",
        source: "Nasdaq public screener",
        sourceUrl: NASDAQ_SCREENER,
        observedAt: null,
        retrievedAt: retrievedAt.toISOString(),
        realtime: false,
        delayStatus: "unavailable",
        limitation: `Nasdaq 筛选器返回 HTTP ${response.status}；没有使用旧数据代替本次采集。`,
        history: [],
      };
    }
    const body = (await response.json()) as any;
    const rows = Array.isArray(body?.data?.table?.rows) ? body.data.table.rows : [];
    const date = retrievedAt.toISOString().slice(0, 10);
    const history = rows.flatMap((row: any) => {
      const symbol = text(row?.symbol)?.toUpperCase();
      const name = text(row?.name);
      const price = number(row?.lastsale);
      if (!symbol || !/^[A-Z][A-Z0-9.:-]{0,14}$/.test(symbol) || !name || price === null || price <= 0) return [];
      return [{
        date,
        value: price,
        fields: {
          symbol,
          name,
          price,
          change: number(row?.netchange),
          changePct: number(row?.pctchange),
          marketCap: number(row?.marketCap),
          exchange: "NASDAQ public screener",
          freshness: "public_delayed_observation",
        },
      }];
    });
    return {
      available: history.length > 0,
      symbol: "NASDAQ:SCREENER",
      source: "Nasdaq public screener",
      sourceUrl: NASDAQ_SCREENER,
      observedAt: history.length ? date : null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "delayed",
      limitation: history.length
        ? "Nasdaq 公开筛选器观察；非逐笔实时或可执行报价。"
        : "Nasdaq 筛选器返回空结果；没有生成占位数据。",
      history,
    };
  } catch (error) {
    return {
      available: false,
      symbol: "NASDAQ:SCREENER",
      source: "Nasdaq public screener",
      sourceUrl: NASDAQ_SCREENER,
      observedAt: null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "unavailable",
      limitation: `Nasdaq 筛选器请求失败：${error instanceof Error ? error.message : String(error)}`,
      history: [],
    };
  }
}
