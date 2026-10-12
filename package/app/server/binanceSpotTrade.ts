import WebSocket from "ws";

// Exact CoinGecko identity -> exchange spot pair. A ticker alone is not a
// reliable cross-provider identity; unsupported coins stay on their own source.
const SPOT_PAIRS = {
  bitcoin: "BTCUSDT",
  ethereum: "ETHUSDT",
  binancecoin: "BNBUSDT",
  solana: "SOLUSDT",
  ripple: "XRPUSDT",
  cardano: "ADAUSDT",
  dogecoin: "DOGEUSDT",
  "avalanche-2": "AVAXUSDT",
  polkadot: "DOTUSDT",
  chainlink: "LINKUSDT",
} as const;

export type BinanceSpotTrade = {
  coinId: string;
  pair: string;
  price: number;
  quantity: number;
  tradeId: number;
  observedAt: string;
  source: "Binance spot trade stream";
  quoteCurrency: "USDT";
};

export function parseBinanceSpotTrade(
  payload: unknown, coinId: string, pair: string, now = Date.now(),
): BinanceSpotTrade | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const price = typeof row.p === "string" ? Number(row.p) : NaN;
  const quantity = typeof row.q === "string" ? Number(row.q) : NaN;
  const tradeAt = typeof row.T === "number" ? row.T : NaN;
  const tradeId = typeof row.t === "number" ? row.t : NaN;
  if (row.e !== "trade" || row.s !== pair || !Number.isFinite(price) || price <= 0 ||
    !Number.isFinite(quantity) || quantity <= 0 || !Number.isSafeInteger(tradeId) ||
    !Number.isFinite(tradeAt) || tradeAt > now + 5_000 || now - tradeAt > 10_000) return null;
  return {
    coinId, pair, price, quantity, tradeId,
    observedAt: new Date(tradeAt).toISOString(),
    source: "Binance spot trade stream", quoteCurrency: "USDT",
  };
}

type Feed = {
  socket: WebSocket | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  latest: BinanceSpotTrade | null;
  interestedAt: number;
  retryAt: number;
  failures: number;
  state: "connecting" | "connected" | "unavailable";
};
const feeds = new Map<string, Feed>();
const FRESH_MS = 10_000;
const IDLE_MS = 60_000;

function connect(coinId: string, pair: string, feed: Feed) {
  if (feed.socket || Date.now() < feed.retryAt) return;
  const socket = new WebSocket(`wss://data-stream.binance.vision/ws/${pair.toLowerCase()}@trade`, {
    handshakeTimeout: 8_000,
  });
  feed.socket = socket;
  feed.state = "connecting";
  socket.on("open", () => { feed.state = "connected"; feed.failures = 0; });
  socket.on("message", raw => {
    let payload: unknown;
    try { payload = JSON.parse(String(raw)); } catch { return; }
    const trade = parseBinanceSpotTrade(payload, coinId, pair);
    if (trade && (!feed.latest || trade.tradeId > feed.latest.tradeId)) feed.latest = trade;
  });
  socket.on("error", () => { feed.state = "unavailable"; });
  socket.on("close", () => {
    if (feed.socket !== socket) return;
    feed.socket = null;
    feed.state = "unavailable";
    feed.failures = Math.min(feed.failures + 1, 6);
    feed.retryAt = Date.now() + Math.min(60_000, 2_000 * 2 ** feed.failures);
  });
}

/** The client polls this cached trade; only a matching exchange trade can change it. */
export function getLiveCryptoTrade(coinId: string) {
  const pair = SPOT_PAIRS[coinId as keyof typeof SPOT_PAIRS];
  if (!pair) return {
    trade: null, status: "unsupported" as const,
    limitation: "该币种尚无已核实的交易所现货交易对映射；不按相似代码猜测。",
  };
  const now = Date.now();
  for (const [id, feed] of feeds) {
    if (now - feed.interestedAt > IDLE_MS) {
      if (feed.idleTimer) clearTimeout(feed.idleTimer);
      feed.socket?.close();
      feeds.delete(id);
    }
  }
  let feed = feeds.get(coinId);
  if (!feed) {
    feed = { socket: null, idleTimer: null, latest: null, interestedAt: now, retryAt: 0, failures: 0, state: "connecting" };
    feeds.set(coinId, feed);
  }
  feed.interestedAt = now;
  if (feed.idleTimer) clearTimeout(feed.idleTimer);
  const activeFeed = feed;
  feed.idleTimer = setTimeout(() => {
    if (feeds.get(coinId) === activeFeed && Date.now() - activeFeed.interestedAt >= IDLE_MS) {
      feeds.delete(coinId);
      activeFeed.socket?.close();
    }
  }, IDLE_MS + 1_000);
  feed.idleTimer.unref();
  connect(coinId, pair, feed);
  const trade = feed.latest && now - Date.parse(feed.latest.observedAt) <= FRESH_MS ? feed.latest : null;
  return {
    trade, status: trade ? "live" as const : feed.state,
    limitation: trade ? null : `当前没有十秒内可验证的 ${pair} 实际成交；旧价不作为实时价。`,
  };
}
