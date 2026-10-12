import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { readArchivedPublicDataset } from "../archivedPublicDataset";
import { getLiveCryptoTrade } from "../binanceSpotTrade";

type CoinMarket = {
  id: string; symbol: string; name: string; current_price: number | null;
  market_cap: number | null; market_cap_rank: number | null; total_volume: number | null;
  circulating_supply: number | null; max_supply: number | null; ath: number | null; ath_date?: string | null;
  price_change_percentage_24h: number | null; price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  source?: string; observedAt?: string;
};
type MarketChart = { prices?: Array<[number, number]>; total_volumes?: Array<[number, number]> };
type Cache<T> = { at: number; value: T };

const COINGECKO = "https://api.coingecko.com/api/v3";
const BLOCKCHAIN = "https://api.blockchain.info/charts";
const FETCH_TIMEOUT_MS = 15_000;
const marketsCache: { at: number; value: CoinMarket[] } = { at: 0, value: [] };
const marketPending = new Map<string, Promise<CoinMarket[]>>();
const chartCache = new Map<string, Cache<MarketChart>>();
const COINGECKO_ARCHIVE_CONTRACT = "crypto.global.coingecko.markets.daily.v1";
export function projectArchivedCoinPrices(
  observations: Array<{ date: string; payload: Record<string, unknown> }>,
  coinId: string,
  days: number,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - Math.min(days, 365) * 86_400_000).toISOString().slice(0, 10);
  const byDate = new Map<string, number>();
  for (const row of observations) {
    if (row.payload.coinId !== coinId) continue;
    const value = typeof row.payload.price === "number" ? row.payload.price : row.payload.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date >= cutoff &&
        typeof value === "number" && Number.isFinite(value) && value > 0) byDate.set(row.date, value);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({ date, price }));
}

export function projectArchivedCoinMarkets(
  observations: Array<{ date: string; payload: Record<string, unknown> }>,
): CoinMarket[] {
  const latest = new Map<string, CoinMarket>();
  for (const observation of observations) {
    const payload = observation.payload;
    const symbol = typeof payload.symbol === "string" ? payload.symbol.toLowerCase() : "";
    const id = typeof payload.coinId === "string" ? payload.coinId : "";
    const price = typeof payload.price === "number" ? payload.price : payload.value;
    if (!/^[a-z0-9-]{1,80}$/.test(id) || !/^[a-z0-9]{1,24}$/.test(symbol) ||
        typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(observation.date)) continue;
    if ((latest.get(id)?.observedAt ?? "") > observation.date) continue;
    latest.set(id, {
      id, symbol, name: typeof payload.name === "string" ? payload.name : symbol.toUpperCase(),
      current_price: price,
      market_cap: typeof payload.marketCap === "number" ? payload.marketCap : null,
      market_cap_rank: typeof payload.rank === "number" ? payload.rank : null,
      total_volume: typeof payload.volume24h === "number" ? payload.volume24h : null,
      circulating_supply: typeof payload.circulatingSupply === "number" ? payload.circulatingSupply : null,
      max_supply: typeof payload.maxSupply === "number" ? payload.maxSupply : null,
      ath: typeof payload.ath === "number" ? payload.ath : null,
      ath_date: typeof payload.athDate === "string" ? payload.athDate : null,
      price_change_percentage_24h: typeof payload.changePct === "number" ? payload.changePct : null,
      price_change_percentage_1h_in_currency: typeof payload.change1h === "number" ? payload.change1h : null,
      price_change_percentage_7d_in_currency: typeof payload.change7d === "number" ? payload.change7d : null,
      source: "CoinGecko 已归档日频快照", observedAt: observation.date,
    });
  }
  return [...latest.values()].sort((a, b) =>
    (a.market_cap_rank ?? Number.MAX_SAFE_INTEGER) - (b.market_cap_rank ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch { return null; }
}
async function getMarkets(): Promise<CoinMarket[]> {
  if (Date.now() - marketsCache.at < 120_000 && marketsCache.value.length) return marketsCache.value;
  const pending = marketPending.get("markets"); if (pending) return pending;
  const request = fetchJson<CoinMarket[]>(`${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h%2C7d`)
    .then(async value => {
      const result = Array.isArray(value) ? value : [];
      if (result.length) {
        marketsCache.at = Date.now();
        marketsCache.value = result.map(coin => ({ ...coin, source: "CoinGecko 公开市场接口",
          observedAt: new Date().toISOString() }));
        return marketsCache.value;
      }
      // The live public endpoint can be rate-limited.  Use only the
      // previously verified Fincept archive in that case; never synthesize
      // prices or treat a missing response as a fresh quote.
      const archived = await readArchivedPublicDataset(COINGECKO_ARCHIVE_CONTRACT, 5000);
      const fallback = projectArchivedCoinMarkets(archived.observations);
      if (fallback.length) {
        marketsCache.at = Date.now();
        marketsCache.value = fallback;
      }
      return fallback;
    })
    .finally(() => marketPending.delete("markets"));
  marketPending.set("markets", request); return request;
}
function categoryFor(symbol: string) { return new Set(["usdt", "usdc", "dai", "busd", "tusd"]).has(symbol.toLowerCase()) ? "稳定币" : "市场资产"; }
function formatBillions(value: number | null | undefined, suffix = "B") { return typeof value === "number" && Number.isFinite(value) ? `${(value / 1e9).toFixed(2)}${suffix}` : "—"; }
function formatTrillions(value: number | null | undefined) { return typeof value === "number" && Number.isFinite(value) ? `${(value / 1e12).toFixed(2)}T` : "—"; }
function coinRow(coin: CoinMarket, rank = coin.market_cap_rank ?? 0) {
  const price = coin.current_price; const ath = coin.ath;
  return { symbol: coin.symbol.toUpperCase(), name: coin.name, price, change: price !== null && coin.price_change_percentage_24h !== null ? price * coin.price_change_percentage_24h / 100 : null, changePct: coin.price_change_percentage_24h, volume24h: formatBillions(coin.total_volume), mktCap: formatTrillions(coin.market_cap), dominance: null, circulatingSupply: coin.circulating_supply, maxSupply: coin.max_supply, ath, athDate: coin.ath_date ?? null, category: categoryFor(coin.symbol), id: coin.id, change1h: coin.price_change_percentage_1h_in_currency ?? null, change7d: coin.price_change_percentage_7d_in_currency ?? null, athDropPct: price !== null && ath !== null && ath > 0 ? -((ath - price) / ath * 100) : null, rank, source: coin.source ?? "来源未标明", observedAt: coin.observedAt ?? null };
}
async function coinIdFor(symbol: string) {
  const normalized = symbol.toLowerCase(); const coin = (await getMarkets()).find(item => item.symbol.toLowerCase() === normalized);
  return coin?.id ?? ({ btc: "bitcoin", eth: "ethereum", bnb: "binancecoin", sol: "solana", xrp: "ripple", ada: "cardano", avax: "avalanche-2", dot: "polkadot", link: "chainlink", uni: "uniswap" } as Record<string, string>)[normalized] ?? null;
}
async function marketChart(id: string, days: number) {
  if (!id) return {};
  const key = `${id}:${days}`; const cached = chartCache.get(key); if (cached && Date.now() - cached.at < 120_000) return cached.value;
  const value = await fetchJson<MarketChart>(`${COINGECKO}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${Math.max(1, Math.min(days, 365))}&interval=daily`); const result = value ?? {};
  chartCache.set(key, { at: Date.now(), value: result }); return result;
}
function pointsToDate(points: Array<[number, number]> | undefined) {
  const daily = new Map<string, number>();
  for (const [time, value] of points ?? []) {
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;
    const date = new Date(time).toISOString().slice(0, 10);
    daily.set(date, value);
  }
  return [...daily.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
async function blockchainSeries(chart: string) { const response = await fetchJson<{ values?: Array<{ x?: number; y?: number }> }>(`${BLOCKCHAIN}/${chart}?timespan=30days&format=json&cors=true`); return (response?.values ?? []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)).map(point => ({ date: new Date((point.x as number) * 1000).toISOString().slice(0, 10), value: chart === "hash-rate" ? (point.y as number) / 1_000_000 : point.y as number })); }

export const cryptoRouter = router({
  getLiveTrade: publicProcedure.input(z.object({
    coinId: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
  })).query(({ input }) => getLiveCryptoTrade(input.coinId)),
  getCryptoList: publicProcedure.input(z.object({ category: z.string().optional(), search: z.string().optional() })).query(async ({ input }) => { let list = (await getMarkets()).map((coin, index) => coinRow(coin, index + 1)); if (input.category && input.category !== "全部") list = list.filter(coin => coin.category === input.category); if (input.search) { const query = input.search.toLowerCase(); list = list.filter(coin => coin.symbol.toLowerCase().includes(query) || coin.name.toLowerCase().includes(query)); } return list; }),
  getMarketOverview: publicProcedure.query(async () => { const global = await fetchJson<{ data?: { total_market_cap?: { usd?: number }; total_volume?: { usd?: number }; market_cap_percentage?: { btc?: number; eth?: number }; active_cryptocurrencies?: number; markets?: number } }>(`${COINGECKO}/global`); const data = global?.data; return { totalMarketCap: formatTrillions(data?.total_market_cap?.usd), totalVolume24h: formatBillions(data?.total_volume?.usd), btcDominance: data?.market_cap_percentage?.btc ?? null, ethDominance: data?.market_cap_percentage?.eth ?? null, fearGreedIndex: null, fearGreedLabel: null, activeCoins: data?.active_cryptocurrencies ?? null, exchanges: data?.markets ?? null, defiTvl: null, stablecoinMktCap: null, retrievedAt: new Date().toISOString(), limitation: data ? "公开市场总览观察；不是可执行报价。" : "公开加密市场总览暂不可用；未使用快照或随机值。" }; }),
  getCandlestickData: publicProcedure.input(z.object({ symbol: z.string(), days: z.number().default(90) })).query(async ({ input }) => { const id = await coinIdFor(input.symbol); if (!id) return []; const rows = await fetchJson<Array<[number, number, number, number, number]>>(`${COINGECKO}/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${Math.max(1, Math.min(input.days, 365))}`); return (rows ?? []).filter(row => row.length >= 5 && row.slice(1).every(Number.isFinite)).map(row => ({ date: new Date(row[0]).toISOString().slice(0, 10), open: row[1], high: row[2], low: row[3], close: row[4], volume: null })); }),
  getFearGreedHistory: publicProcedure.input(z.object({ days: z.number().default(90) })).query(async ({ input }) => { const rows = await fetchJson<{ data?: Array<{ value?: string; value_classification?: string; timestamp?: string }> }>(`https://api.alternative.me/fng/?limit=${Math.max(1, Math.min(input.days, 365))}&format=json`); return (rows?.data ?? []).flatMap(row => { const value = Number(row.value); const timestamp = Number(row.timestamp); return Number.isFinite(value) && Number.isFinite(timestamp) ? [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), value, label: row.value_classification ?? "" }] : []; }).sort((a, b) => a.date.localeCompare(b.date)); }),
  getMarketCapDistribution: publicProcedure.query(async () => (await getMarkets()).filter(coin => categoryFor(coin.symbol) !== "稳定币").slice(0, 20).map(coin => ({ name: coin.symbol.toUpperCase(), fullName: coin.name, value: coin.market_cap === null ? null : coin.market_cap / 1e9, dominance: null }))),
  getOnChainMetrics: publicProcedure.input(z.object({ symbol: z.string().default("BTC") })).query(async ({ input }) => { const emptySeries: Array<{ date: string; value: number }> = []; if (input.symbol.toUpperCase() !== "BTC") return { symbol: input.symbol, activeAddresses: emptySeries, transactionCount: emptySeries, hashRate: null, exchangeNetflow: emptySeries, limitation: "当前免密公共适配器仅覆盖 BTC 链上地址、交易和算力；其他资产不使用替代值。" }; const [activeAddresses, transactionCount, hashRate] = await Promise.all([blockchainSeries("n-unique-addresses"), blockchainSeries("n-transactions"), blockchainSeries("hash-rate")]); return { symbol: input.symbol, activeAddresses, transactionCount, hashRate, exchangeNetflow: emptySeries, limitation: "BTC 链上公开序列；交易所净流入未配置免密可验证来源，因此保持空值。" }; }),
  getDefiProtocols: publicProcedure.query(async () => { const rows = await fetchJson<Array<{ name?: string; category?: string; chain?: string; tvl?: number; change_1d?: number; change_7d?: number; symbol?: string }>>("https://api.llama.fi/protocols"); return (rows ?? []).filter(row => typeof row.tvl === "number").slice(0, 30).map(row => ({ name: row.name ?? "—", chain: row.chain ?? "—", category: row.category ?? "—", tvl: row.tvl as number, volume24h: null, fees24h: null, apy: null, change24h: row.change_1d ?? null, change7d: row.change_7d ?? null, token: row.symbol ?? "—" })); }),
  getCorrelationWithTraditional: publicProcedure.query(() => { const assets = ["BTC", "ETH", "SOL", "标普500", "纳斯达克", "黄金", "原油", "美元指数"]; return { assets, matrix: assets.map((_, i) => assets.map((__, j) => i === j ? 1 : null)), limitation: "传统资产与加密资产的同步历史配对尚未配置同频可验证序列；不使用固定相关系数。" }; }),
  getTopGainersLosers: publicProcedure.query(async () => { const list = (await getMarkets()).map((coin, index) => coinRow(coin, index + 1)).filter(coin => typeof coin.changePct === "number"); return { gainers: [...list].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 5), losers: [...list].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 5) }; }),
  getCoinList: publicProcedure.query(async () => (await getMarkets()).map((coin, index) => coinRow(coin, index + 1))),
  getPriceHistory: publicProcedure.input(z.object({
    symbol: z.string().trim().min(1).max(24),
    coinId: z.string().trim().regex(/^[a-z0-9-]{1,80}$/).optional(),
    days: z.number().int().min(1).max(365).default(90),
  })).query(async ({ input }) => {
    const id = input.coinId
      ? (await getMarkets()).find(coin => coin.id === input.coinId && coin.symbol.toUpperCase() === input.symbol.toUpperCase())?.id ?? null
      : await coinIdFor(input.symbol);
    const chart = await marketChart(id ?? "", input.days);
    let prices = pointsToDate(chart.prices).map(point => ({ date: point.date, price: point.value }));
    let volumes = pointsToDate(chart.total_volumes).map(point => ({ date: point.date, volume: point.value }));
    let source = "CoinGecko 公开日频历史";
    let limitation = "";
    if (!prices.length && id) {
      const archive = await readArchivedPublicDataset(COINGECKO_ARCHIVE_CONTRACT, 5000);
      prices = projectArchivedCoinPrices(archive.observations, id, input.days);
      volumes = [];
      source = "CoinGecko 已归档同币种日频观察";
      limitation = "CoinGecko 历史接口暂不可用；只使用该币种已采集到的实际观察日，所选区间可能不完整。归档不提供历史成交量，也不是盘中实时成交价。";
    }
    if (!prices.length) {
      limitation = "该币种的独立历史接口暂无有效观察；不会复用 BTC 或其他币种曲线。";
    }
    const ma = (window: number) => prices.map((point, index) => ({
      date: point.date,
      value: index >= window - 1
        ? prices.slice(index - window + 1, index + 1).reduce((sum, item) => sum + item.price, 0) / window
        : null,
    }));
    return { prices, volumes, ma7: ma(7), ma30: ma(30), source, limitation, observedAt: prices.at(-1)?.date ?? null };
  }),
  getDominanceHistory: publicProcedure.input(z.object({ days: z.number().default(90) })).query(async ({ input }) => { const response = await fetchJson<{ market_cap_percentage?: { btc?: Array<[number, number]>; eth?: Array<[number, number]> } }>(`${COINGECKO}/global/market_cap_chart?vs_currency=usd&days=${Math.max(1, Math.min(input.days, 365))}`); const btc = response?.market_cap_percentage?.btc ?? []; const eth = response?.market_cap_percentage?.eth ?? []; const dates = new Map<string, { btc: number | null; eth: number | null }>(); for (const [time, value] of btc) dates.set(new Date(time).toISOString().slice(0, 10), { btc: value, eth: null }); for (const [time, value] of eth) { const key = new Date(time).toISOString().slice(0, 10); dates.set(key, { ...(dates.get(key) ?? { btc: null, eth: null }), eth: value }); } return [...dates.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, btc: value.btc, eth: value.eth, others: value.btc !== null && value.eth !== null ? 100 - value.btc - value.eth : null })); }),
  getDefiMetrics: publicProcedure.query(async () => { const rows = await fetchJson<Array<{ name?: string; category?: string; chain?: string; tvl?: number; change_1d?: number; change_7d?: number; symbol?: string }>>("https://api.llama.fi/protocols"); const protocols = (rows ?? []).filter(row => typeof row.tvl === "number").slice(0, 30).map(row => ({ name: row.name ?? "—", chain: row.chain ?? "—", category: row.category ?? "—", tvl: row.tvl as number, volume24h: null, fees24h: null, apy: null, change24h: row.change_1d ?? null, change7d: row.change_7d ?? null, token: row.symbol ?? "—" })); return { totalTvl: protocols.length ? protocols.reduce((sum, row) => sum + row.tvl, 0) : null, dexVolume24h: null, activeProtocols: protocols.length || null, stablecoinMktCap: null, protocols }; }),
  getExchangeVolume: publicProcedure.query(async () => { const rows = await fetchJson<Array<{ name?: string; trade_volume_24h_btc?: number; trust_score_rank?: number }>>(`${COINGECKO}/exchanges?per_page=30&page=1`); const total = (rows ?? []).reduce((sum, row) => sum + (row.trade_volume_24h_btc ?? 0), 0); return (rows ?? []).filter(row => typeof row.trade_volume_24h_btc === "number").map(row => ({ name: row.name ?? "—", volume24h: row.trade_volume_24h_btc as number, marketShare: total > 0 ? (row.trade_volume_24h_btc as number) / total * 100 : null, rank: row.trust_score_rank ?? null })); }),
});
