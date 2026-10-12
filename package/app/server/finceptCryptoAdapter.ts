const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets";
const FETCH_TIMEOUT_MS = 20_000;

type CoinGeckoMarket = {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  current_price?: unknown;
  market_cap?: unknown;
  market_cap_rank?: unknown;
  total_volume?: unknown;
  circulating_supply?: unknown;
  max_supply?: unknown;
  ath?: unknown;
  ath_date?: unknown;
  price_change_percentage_24h?: unknown;
  price_change_percentage_1h_in_currency?: unknown;
  price_change_percentage_7d_in_currency?: unknown;
  last_updated?: unknown;
};

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function fetchVerifiedBtcFallback(retrievedAt: Date) {
  try {
    const { fetchYahooChart } = await import("./realDataService");
    const chart = await fetchYahooChart("BTC-USD", "5d", "1d");
    if (!chart || chart.meta.persistentFallback === true || chart.meta.live === false) {
      return null;
    }
    const history = chart.history.flatMap(point => {
      const price = point.close ?? point.value;
      if (!Number.isFinite(price) || price <= 0) return [];
      return [{
        date: point.date,
        value: price,
        fields: {
          symbol: "BTC",
          coinId: "bitcoin",
          name: "Bitcoin",
          price,
          volume24h: null,
          marketCap: null,
          rank: 1,
          changePct: null,
          observedAt: point.timestamp ?? point.date,
          freshness: "public_market_observation",
          fallback: "Yahoo Finance public chart",
        },
      }];
    });
    if (!history.length) return null;
    const observedAt = typeof chart.meta.observedAt === "string"
      ? chart.meta.observedAt
      : typeof history.at(-1)?.fields.observedAt === "string"
        ? history.at(-1)?.fields.observedAt as string
        : null;
    return {
      available: true,
      symbol: "COINGECKO:MARKETS",
      source: "Yahoo Finance public chart (CoinGecko fallback)",
      sourceUrl: "https://finance.yahoo.com/quote/BTC-USD/",
      observedAt,
      retrievedAt: retrievedAt.toISOString(),
      realtime: chart.meta.realtimeStatus === "realtime",
      delayStatus: String(chart.meta.realtimeStatus ?? "public_observation"),
      limitation: "CoinGecko 不可用时仅回退到已验证 BTC/USD 公开图表；不把单一 BTC 观察冒充全球资产列表。",
      history,
    };
  } catch {
    return null;
  }
}

/**
 * Fincept's CoinGecko connector is a public market-data adapter.  This
 * adapter intentionally stores one cleaned observation per asset and UTC day;
 * it does not claim exchange-level real-time execution prices.
 */
export async function fetchFinceptCoinGeckoMarkets(limit = 250) {
  const retrievedAt = new Date();
  try {
    const response = await fetch(
      `${COINGECKO_MARKETS}?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(Math.max(limit, 1), 250)}&page=1&sparkline=false&price_change_percentage=1h%2C7d`,
      {
        headers: { accept: "application/json", "user-agent": "FinanceHub/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const fallback = await fetchVerifiedBtcFallback(retrievedAt);
      if (fallback) return fallback;
      return {
        available: false,
        symbol: "COINGECKO:MARKETS",
        source: "CoinGecko public markets",
        sourceUrl: COINGECKO_MARKETS,
        observedAt: null,
        retrievedAt: retrievedAt.toISOString(),
        realtime: false,
        delayStatus: "unavailable",
        limitation: `CoinGecko 返回 HTTP ${response.status}；没有使用旧快照代替本次采集。`,
        history: [],
      };
    }
    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload) ? (payload as CoinGeckoMarket[]) : [];
    const history = rows.flatMap(row => {
      const symbol = text(row.symbol)?.toUpperCase();
      const id = text(row.id);
      const price = finite(row.current_price);
      const observedAt = isoDate(row.last_updated);
      if (!symbol || !id || price === null || price <= 0 || !observedAt ||
          Date.parse(observedAt) > retrievedAt.getTime() + 5 * 60_000) return [];
      return [{
        date: observedAt.slice(0, 10),
        value: price,
        fields: {
          symbol,
          coinId: id,
          name: text(row.name),
          price,
          marketCap: finite(row.market_cap),
          rank: finite(row.market_cap_rank),
          volume24h: finite(row.total_volume),
          circulatingSupply: finite(row.circulating_supply),
          maxSupply: finite(row.max_supply),
          ath: finite(row.ath),
          athDate: isoDate(row.ath_date),
          changePct: finite(row.price_change_percentage_24h),
          change1h: finite(row.price_change_percentage_1h_in_currency),
          change7d: finite(row.price_change_percentage_7d_in_currency),
          observedAt,
          freshness: "public_market_observation",
        },
      }];
    });
    if (!history.length) {
      const fallback = await fetchVerifiedBtcFallback(retrievedAt);
      if (fallback) return fallback;
      return {
        available: false,
        symbol: "COINGECKO:MARKETS",
        source: "CoinGecko public markets",
        sourceUrl: COINGECKO_MARKETS,
        observedAt: null,
        retrievedAt: retrievedAt.toISOString(),
        realtime: false,
        delayStatus: "empty",
        limitation: "CoinGecko 返回空或不完整市场观察；没有生成占位数据。",
        history: [],
      };
    }
    return {
      available: true,
      symbol: "COINGECKO:MARKETS",
      source: "CoinGecko public markets",
      sourceUrl: COINGECKO_MARKETS,
      observedAt: history.map(point => String(point.fields.observedAt)).sort().at(-1) ?? null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "public_observation",
      limitation: "公开市场观察；非交易所逐笔成交，不标记为可执行实时行情。",
      history,
    };
  } catch (error) {
    const fallback = await fetchVerifiedBtcFallback(retrievedAt);
    if (fallback) return fallback;
    return {
      available: false,
      symbol: "COINGECKO:MARKETS",
      source: "CoinGecko public markets",
      sourceUrl: COINGECKO_MARKETS,
      observedAt: null,
      retrievedAt: retrievedAt.toISOString(),
      realtime: false,
      delayStatus: "unavailable",
      limitation: `CoinGecko 请求失败：${error instanceof Error ? error.message : String(error)}`,
      history: [],
    };
  }
}
