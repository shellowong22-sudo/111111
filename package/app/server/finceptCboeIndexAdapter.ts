const CBOE_INDEX_SNAPSHOT_URL =
  "https://cdn.cboe.com/api/global/delayed_quotes/quotes/all_us_indices.json";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function observationDate(value: unknown, fallback: string) {
  const raw = text(value);
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : fallback;
}

/**
 * CBOE's public delayed index snapshot is a broad symbol directory and
 * observation feed. It is intentionally kept separate from the CBOE
 * volatility-history contract so a current delayed snapshot is not confused
 * with daily history or an executable quote.
 */
export function parseCboeIndexSnapshotRows(rows: unknown[], fallbackDate: string) {
  return rows.flatMap((row: any) => {
    const symbol = text(row?.symbol)?.replace(/^\^/, "").toUpperCase();
    const price = number(row?.current_price);
    if (!symbol || price === null || price <= 0) return [];
    const date = observationDate(row?.last_trade_time, fallbackDate);
    return [{
      date,
      value: price,
      fields: {
        symbol,
        currentPrice: price,
        priceChange: number(row?.price_change),
        priceChangePercent: number(row?.price_change_percent),
        bid: number(row?.bid),
        ask: number(row?.ask),
        open: number(row?.open),
        high: number(row?.high),
        low: number(row?.low),
        close: number(row?.close),
        previousClose: number(row?.prev_day_close),
        volume: number(row?.volume),
        lastTradeTime: text(row?.last_trade_time),
        securityType: text(row?.security_type),
        freshness: "official_delayed_snapshot",
      },
    }];
  });
}

export async function fetchFinceptCboeIndexSnapshot() {
  const retrievedAt = new Date();
  const fallbackDate = retrievedAt.toISOString().slice(0, 10);
  try {
    const response = await fetch(CBOE_INDEX_SNAPSHOT_URL, {
      headers: { accept: "application/json", "user-agent": "FinanceHub/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        available: false,
        symbol: "CBOE:US-INDICES",
        source: "CBOE public delayed index snapshot",
        sourceUrl: CBOE_INDEX_SNAPSHOT_URL,
        observedAt: null,
        retrievedAt: retrievedAt.toISOString(),
        realtime: false,
        delayStatus: "unavailable",
        limitation: `CBOE 指数快照返回 HTTP ${response.status}；没有使用旧数据代替本次采集。`,
        history: [],
      };
    }
    const body = await response.json() as any;
    const history = parseCboeIndexSnapshotRows(
      Array.isArray(body?.data) ? body.data : [],
      fallbackDate,
    );
    return {
      available: history.length > 0,
      symbol: "CBOE:US-INDICES",
      source: "CBOE public delayed index snapshot",
      sourceUrl: CBOE_INDEX_SNAPSHOT_URL,
      observedAt: history.map(point => point.date).sort().at(-1) ?? null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "delayed",
      limitation: history.length
        ? "CBOE 公开指数延迟观察；非逐笔实时或可执行报价。"
        : "CBOE 指数快照为空；没有生成占位数据。",
      history,
    };
  } catch (error) {
    return {
      available: false,
      symbol: "CBOE:US-INDICES",
      source: "CBOE public delayed index snapshot",
      sourceUrl: CBOE_INDEX_SNAPSHOT_URL,
      observedAt: null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "unavailable",
      limitation: `CBOE 指数快照请求失败：${error instanceof Error ? error.message : String(error)}`,
      history: [],
    };
  }
}
