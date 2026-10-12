import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchYahooChart, type YahooRange } from "../realDataService";
import { FINMIND_MODULE_BINDINGS } from "../../shared/finmindModuleBindings";
import { syncFinMindBinding } from "../finmindSync";
import { readArchivedPublicDataset } from "../archivedPublicDataset";

type EquityCandle = { date: string; open: number; high: number; low: number; close: number; volume: number | null };

function calcMA(candles: EquityCandle[], period: number) {
  return candles.map((c, i) => {
    if (i < period - 1) return { date: c.date, value: null };
    const slice = candles.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.close, 0) / period;
    return { date: c.date, value: Math.round(avg * 100) / 100 };
  });
}

function calcMACD(candles: EquityCandle[]) {
  const ema = (data: number[], period: number) => {
    const k = 2 / (period + 1);
    const result: (number | null)[] = [];
    let prev: number | null = null;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      if (prev === null) { prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period; result.push(prev); continue; }
      prev = data[i] * k + prev * (1 - k);
      result.push(Math.round(prev * 10000) / 10000);
    }
    return result;
  };
  const closes = candles.map(c => c.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v !== null && ema26[i] !== null ? Math.round((v - ema26[i]!) * 10000) / 10000 : null);
  const signalInput = macdLine.filter(v => v !== null) as number[];
  const signalEma = ema(signalInput, 9);
  let sigIdx = 0;
  const signal = macdLine.map(v => v !== null ? (signalEma[sigIdx++] ?? null) : null);
  return candles.map((c, i) => ({
    date: c.date,
    macd: macdLine[i],
    signal: signal[i],
    histogram: macdLine[i] !== null && signal[i] !== null ? Math.round((macdLine[i]! - signal[i]!) * 10000) / 10000 : null,
  }));
}

function calcBollinger(candles: EquityCandle[], period: number = 20, stdMult: number = 2) {
  return candles.map((c, i) => {
    if (i < period - 1) return { date: c.date, upper: null, middle: null, lower: null };
    const slice = candles.slice(i - period + 1, i + 1).map(x => x.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return {
      date: c.date,
      upper: Math.round((mean + stdMult * std) * 100) / 100,
      middle: Math.round(mean * 100) / 100,
      lower: Math.round((mean - stdMult * std) * 100) / 100,
    };
  });
}

function calcRSI(candles: EquityCandle[], period: number = 14) {
  const rsi = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period) { rsi.push({ date: candles[i].date, value: null }); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - candles[j - 1].close;
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = gains / (losses || 0.001);
    rsi.push({ date: candles[i].date, value: Math.round((100 - 100 / (1 + rs)) * 100) / 100 });
  }
  return rsi;
}

type TechnicalEvidence = {
  indicator: "RSI" | "MACD" | "MA20" | "BOLL";
  state: "偏强" | "偏弱" | "中性" | "数据不足";
  value: number | null;
  interpretation: string;
};

function buildTechnicalSummary(
  candles: EquityCandle[],
  ma20: ReturnType<typeof calcMA>,
  rsi: ReturnType<typeof calcRSI>,
  macd: ReturnType<typeof calcMACD>,
  bollinger: ReturnType<typeof calcBollinger>
) {
  const latestClose = candles.at(-1)?.close ?? null;
  const latestMa20 = ma20.at(-1)?.value ?? null;
  const latestRsi = rsi.at(-1)?.value ?? null;
  const latestMacd = macd.at(-1);
  const latestBollinger = bollinger.at(-1);
  const evidence: TechnicalEvidence[] = [];
  let score = 0;

  if (latestRsi === null) {
    evidence.push({ indicator: "RSI", state: "数据不足", value: null, interpretation: "至少需要 15 个有效收盘观察。" });
  } else if (latestRsi >= 70) {
    score -= 20;
    evidence.push({ indicator: "RSI", state: "偏弱", value: latestRsi, interpretation: "进入高位区间，短线波动和回撤风险上升。" });
  } else if (latestRsi <= 30) {
    score += 20;
    evidence.push({ indicator: "RSI", state: "偏强", value: latestRsi, interpretation: "进入低位区间，存在技术性修复迹象，但不等同于反转。" });
  } else {
    const state = latestRsi >= 50 ? "偏强" : "偏弱";
    score += state === "偏强" ? 10 : -10;
    evidence.push({ indicator: "RSI", state, value: latestRsi, interpretation: "位于 30—70 的常态区间，以方向性证据为主。" });
  }

  if (latestMacd?.histogram == null) {
    evidence.push({ indicator: "MACD", state: "数据不足", value: null, interpretation: "至少需要 34 个有效收盘观察。" });
  } else {
    const state = latestMacd.histogram > 0 ? "偏强" : latestMacd.histogram < 0 ? "偏弱" : "中性";
    score += state === "偏强" ? 25 : state === "偏弱" ? -25 : 0;
    evidence.push({ indicator: "MACD", state, value: latestMacd.histogram, interpretation: latestMacd.histogram > 0 ? "柱体在零轴上方。" : latestMacd.histogram < 0 ? "柱体在零轴下方。" : "柱体接近零轴。" });
  }

  if (latestClose === null || latestMa20 === null) {
    evidence.push({ indicator: "MA20", state: "数据不足", value: latestMa20, interpretation: "至少需要 20 个有效收盘观察。" });
  } else {
    const state = latestClose > latestMa20 ? "偏强" : latestClose < latestMa20 ? "偏弱" : "中性";
    score += state === "偏强" ? 25 : state === "偏弱" ? -25 : 0;
    evidence.push({ indicator: "MA20", state, value: latestMa20, interpretation: latestClose > latestMa20 ? "收盘价位于 20 日均线上方。" : latestClose < latestMa20 ? "收盘价位于 20 日均线下方。" : "收盘价贴近 20 日均线。" });
  }

  if (
    latestClose === null ||
    latestBollinger?.middle == null ||
    latestBollinger.upper == null ||
    latestBollinger.lower == null
  ) {
    evidence.push({ indicator: "BOLL", state: "数据不足", value: latestBollinger?.middle ?? null, interpretation: "至少需要 20 个有效收盘观察。" });
  } else {
    const state = latestClose > latestBollinger.upper
      ? "偏弱"
      : latestClose < latestBollinger.lower
        ? "偏强"
        : latestClose >= latestBollinger.middle
          ? "偏强"
          : "偏弱";
    score += state === "偏强" ? 15 : -15;
    evidence.push({ indicator: "BOLL", state, value: latestBollinger.middle, interpretation: latestClose > latestBollinger.upper ? "价格触及上轨外侧，追高风险增加。" : latestClose < latestBollinger.lower ? "价格触及下轨外侧，需结合其他指标确认。" : latestClose >= latestBollinger.middle ? "价格位于中轨上方。" : "价格位于中轨下方。" });
  }

  const usable = evidence.filter(item => item.state !== "数据不足").length;
  const boundedScore = Math.max(-100, Math.min(100, score));
  return {
    signal: usable === 0 ? "数据不足" as const : boundedScore >= 25 ? "偏强" as const : boundedScore <= -25 ? "偏弱" as const : "中性" as const,
    score: boundedScore,
    confidence: Number((usable / evidence.length).toFixed(2)),
    asOf: candles.at(-1)?.date ?? null,
    evidence,
    boundary: "仅基于已观测 OHLCV 的技术指标辅助，不构成投资建议；缺失数据不补值。",
  };
}

const STOCKS = [
  { symbol: "AAPL", name: "苹果公司", sector: "科技", price: 189.30, change: 1.25, changePct: 0.67, volume: "52.3M", mktCap: "2.94T", pe: 31.2, eps: 6.07, dividend: 0.96, beta: 1.18, high52w: 199.62, low52w: 164.08 },
  { symbol: "MSFT", name: "微软公司", sector: "科技", price: 415.50, change: 3.20, changePct: 0.78, volume: "21.8M", mktCap: "3.09T", pe: 38.5, eps: 10.79, dividend: 3.00, beta: 0.92, high52w: 430.82, low52w: 309.45 },
  { symbol: "NVDA", name: "英伟达", sector: "半导体", price: 875.40, change: 18.50, changePct: 2.16, volume: "48.2M", mktCap: "2.16T", pe: 72.8, eps: 12.02, dividend: 0.16, beta: 1.85, high52w: 974.00, low52w: 373.75 },
  { symbol: "GOOGL", name: "Alphabet", sector: "科技", price: 175.80, change: -0.85, changePct: -0.48, volume: "25.4M", mktCap: "2.19T", pe: 27.3, eps: 6.44, dividend: 0, beta: 1.05, high52w: 193.31, low52w: 120.21 },
  { symbol: "AMZN", name: "亚马逊", sector: "消费", price: 192.50, change: 2.10, changePct: 1.10, volume: "38.5M", mktCap: "2.03T", pe: 58.2, eps: 3.31, dividend: 0, beta: 1.22, high52w: 201.20, low52w: 118.35 },
  { symbol: "META", name: "Meta平台", sector: "科技", price: 520.30, change: 8.40, changePct: 1.64, volume: "18.2M", mktCap: "1.33T", pe: 26.8, eps: 19.41, dividend: 2.00, beta: 1.35, high52w: 544.21, low52w: 279.40 },
  { symbol: "TSLA", name: "特斯拉", sector: "汽车", price: 175.20, change: -3.80, changePct: -2.12, volume: "95.6M", mktCap: "558B", pe: 48.5, eps: 3.61, dividend: 0, beta: 2.05, high52w: 299.29, low52w: 138.80 },
  { symbol: "BRK.B", name: "伯克希尔B", sector: "金融", price: 394.80, change: 1.20, changePct: 0.30, volume: "4.2M", mktCap: "864B", pe: 22.1, eps: 17.86, dividend: 0, beta: 0.88, high52w: 407.50, low52w: 322.75 },
  { symbol: "JPM", name: "摩根大通", sector: "金融", price: 198.40, change: 0.85, changePct: 0.43, volume: "9.8M", mktCap: "573B", pe: 12.4, eps: 16.00, dividend: 5.00, beta: 1.12, high52w: 210.27, low52w: 135.19 },
  { symbol: "JNJ", name: "强生公司", sector: "医疗", price: 147.20, change: -0.35, changePct: -0.24, volume: "7.5M", mktCap: "354B", pe: 15.8, eps: 9.32, dividend: 4.76, beta: 0.62, high52w: 175.97, low52w: 143.13 },
  { symbol: "V", name: "维萨", sector: "金融", price: 278.50, change: 1.90, changePct: 0.69, volume: "6.3M", mktCap: "568B", pe: 31.5, eps: 8.84, dividend: 2.08, beta: 0.98, high52w: 290.96, low52w: 220.25 },
  { symbol: "WMT", name: "沃尔玛", sector: "消费", price: 68.40, change: 0.25, changePct: 0.37, volume: "12.8M", mktCap: "551B", pe: 29.8, eps: 2.29, dividend: 0.83, beta: 0.52, high52w: 70.06, low52w: 47.89 },
  { symbol: "XOM", name: "埃克森美孚", sector: "能源", price: 112.30, change: -1.20, changePct: -1.06, volume: "15.2M", mktCap: "449B", pe: 14.2, eps: 7.91, dividend: 3.80, beta: 1.05, high52w: 123.75, low52w: 95.77 },
  { symbol: "PG", name: "宝洁公司", sector: "消费", price: 168.50, change: 0.45, changePct: 0.27, volume: "5.8M", mktCap: "397B", pe: 27.4, eps: 6.15, dividend: 3.76, beta: 0.55, high52w: 173.55, low52w: 138.76 },
  { symbol: "UNH", name: "联合健康", sector: "医疗", price: 485.20, change: 2.80, changePct: 0.58, volume: "3.2M", mktCap: "449B", pe: 21.5, eps: 22.57, dividend: 7.52, beta: 0.72, high52w: 557.13, low52w: 417.00 },
];

const INDEX_ARCHIVES = [
  { name: "标普500", contract: "index.us.sp500.fred.daily.v1" },
  { name: "台湾加权股价报酬指数", contract: "index.tw.taiex.total-return.finmind.v1" },
] as const;

const SECTOR_ETF_REFERENCES = [
  { name: "科技", symbol: "XLK" },
  { name: "金融", symbol: "XLF" },
  { name: "医疗", symbol: "XLV" },
  { name: "消费", symbol: "XLY" },
  { name: "工业", symbol: "XLI" },
  { name: "能源", symbol: "XLE" },
  { name: "公用事业", symbol: "XLU" },
  { name: "材料", symbol: "XLB" },
  { name: "房地产", symbol: "XLRE" },
  { name: "通信", symbol: "XLC" },
] as const;

function compactNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString();
}

let observedStockCache: { until: number; value: Awaited<ReturnType<typeof loadObservedStocks>> } | null = null;
let observedStockRequest: Promise<Awaited<ReturnType<typeof loadObservedStocks>>> | null = null;

async function loadEquityHistory(symbol: string, days = 365) {
  const normalized = symbol.toUpperCase().replace(".", "-");
  const binding = FINMIND_MODULE_BINDINGS.find(item => item.dataset === "USStockPrice" && item.symbol === normalized);
  if (binding) {
    await syncFinMindBinding(binding).catch(() => undefined);
    const archived = await readArchivedPublicDataset(binding.dataContractId, Math.max(days, 90));
    const history = archived.observations.flatMap(observation => {
      const payload = observation.payload;
      const open = typeof payload.open === "number" ? payload.open : null;
      const high = typeof payload.high === "number" ? payload.high : null;
      const low = typeof payload.low === "number" ? payload.low : null;
      const close = typeof payload.close === "number" ? payload.close : typeof payload.value === "number" ? payload.value : null;
      const volume = typeof payload.volume === "number" ? payload.volume : null;
      return open !== null && high !== null && low !== null && close !== null
        ? [{ date: observation.date, open, high, low, close, volume } satisfies EquityCandle]
        : [];
    }).slice(-days);
    if (history.length) return { history, status: "永久归档" as const };
  }
  const fallback = await fetchYahooChart(symbol, yahooRangeForDays(days), "1d", "US");
  const history: EquityCandle[] = (fallback?.history ?? []).flatMap(point =>
    typeof point.open === "number" && typeof point.high === "number" && typeof point.low === "number" && typeof point.close === "number"
      ? [{ date: point.date, open: point.open, high: point.high, low: point.low, close: point.close, volume: point.volume }]
      : []
  ).slice(-days);
  return { history, status: fallback?.meta.persistentFallback === true ? "永久归档" as const : "延迟/日频观察" as const };
}

async function loadObservedStocks() {
  const charts = await Promise.all(STOCKS.map(stock => loadEquityHistory(stock.symbol)));
  return STOCKS.flatMap((stock, index) => {
    const chart = charts[index];
    if (!chart.history.length) return [];
    const highs = chart.history.map(point => point.high);
    const lows = chart.history.map(point => point.low);
    const latest = chart.history.at(-1)!;
    const previous = chart.history.at(-2)?.close ?? latest.close;
    const change = Number((latest.close - previous).toFixed(4));
    const recentVolumes = chart.history.slice(-21, -1).flatMap(point => typeof point.volume === "number" ? [point.volume] : []);
    const averageVolume = recentVolumes.length ? recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length : null;
    return [{
      ...stock,
      price: latest.close,
      change,
      changePct: previous ? Number(((change / previous) * 100).toFixed(3)) : 0,
      volume: compactNumber(latest.volume),
      volumeValue: latest.volume,
      volumeVs20d: typeof latest.volume === "number" && averageVolume ? latest.volume / averageVolume : null,
      high52w: highs.length ? Math.max(...highs) : stock.high52w,
      low52w: lows.length ? Math.min(...lows) : stock.low52w,
      observedAt: latest.date,
      currency: "USD",
      marketDataStatus: chart.status,
    }];
  });
}

async function observedStocks() {
  if (observedStockCache && observedStockCache.until > Date.now()) return observedStockCache.value;
  if (observedStockRequest) return observedStockRequest;
  observedStockRequest = loadObservedStocks().then(value => {
    observedStockCache = { until: Date.now() + 60_000, value };
    return value;
  }).finally(() => { observedStockRequest = null; });
  return observedStockRequest;
}

function yahooRangeForDays(days: number): YahooRange {
  if (days <= 30) return "1mo";
  if (days <= 90) return "3mo";
  if (days <= 180) return "6mo";
  return "1y";
}

async function observedIndices() {
  const archives = await Promise.all(INDEX_ARCHIVES.map(index => readArchivedPublicDataset(index.contract, 10)));
  return INDEX_ARCHIVES.flatMap((index, position) => {
    const points = archives[position].observations.flatMap(observation => {
      const value = typeof observation.payload.value === "number"
        ? observation.payload.value
        : typeof observation.payload.close === "number"
          ? observation.payload.close
          : null;
      return value === null ? [] : [{ date: observation.date, value }];
    });
    const latest = points.at(-1);
    if (!latest) return [];
    const previous = points.at(-2)?.value ?? latest.value;
    const change = Number((latest.value - previous).toFixed(4));
    return [{
      name: index.name,
      value: latest.value,
      change,
      changePct: previous ? Number(((change / previous) * 100).toFixed(3)) : 0,
      observedAt: latest.date,
    }];
  });
}

export const equityRouter = router({
  getStockList: publicProcedure
    .input(z.object({ sector: z.string().optional(), search: z.string().optional() }))
    .query(async ({ input }) => {
      let stocks = await observedStocks();
      if (input.sector) stocks = stocks.filter(s => s.sector === input.sector);
      if (input.search) {
        const q = input.search.toLowerCase();
        stocks = stocks.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
      }
      return stocks;
    }),

  getStockDetail: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const stock = (await observedStocks()).find(s => s.symbol === input.symbol);
      if (!stock) return null;
      return {
        ...stock,
        description: `${stock.name}是一家领先的${stock.sector}行业公司，在全球范围内提供创新产品和服务。`,
        employees: null,
        founded: null,
        headquarters: null,
        revenue: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: null,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        priceToBook: null,
        priceToCash: null,
        analystRating: "未接入",
        targetPrice: null,
        analystCount: null,
      };
    }),

  getCandlestickData: publicProcedure
    .input(z.object({ symbol: z.string(), days: z.number().default(90) }))
    .query(async ({ input }) => {
      const result = await loadEquityHistory(input.symbol, input.days);
      const candles = result.history;
      const ma5 = calcMA(candles, 5);
      const ma20 = calcMA(candles, 20);
      const ma60 = calcMA(candles, 60);
      const rsi = calcRSI(candles);
      const macd = calcMACD(candles);
      const bollinger = calcBollinger(candles);
      return {
        candles, ma5, ma20, ma60, rsi, macd, bollinger,
        technicalSummary: buildTechnicalSummary(candles, ma20, rsi, macd, bollinger),
        available: candles.length > 0,
        observedAt: candles.at(-1)?.date ?? null,
        freshness: result.status,
      };
    }),

  getSectorHeatmap: publicProcedure.query(async () => {
    const groups = [...new Set(STOCKS.map(stock => stock.sector))].map(name => ({
      name,
      stocks: STOCKS.filter(stock => stock.sector === name),
    }));
    const results = await Promise.all(groups.map(async group => {
      const charts = await Promise.all(group.stocks.map(stock => loadEquityHistory(stock.symbol, 365)));
      const returns = charts.map(chart => {
        const closes = chart.history.map(point => ({ date: point.date, close: point.close }));
        if (closes.length < 2) return null;
        const latest = closes.at(-1)!;
        const returnFor = (lookback: number) => {
          const base = closes[Math.max(0, closes.length - 1 - lookback)]?.close;
          return base && base !== 0 ? Number((((latest.close - base) / base) * 100).toFixed(3)) : null;
        };
        return {
          return1d: returnFor(1),
          return1w: returnFor(5),
          return1m: returnFor(21),
          returnYtd: closes[0]?.close && closes[0].close !== 0
            ? Number((((latest.close - closes[0].close) / closes[0].close) * 100).toFixed(3))
            : null,
          observedAt: latest.date,
          source: chart.status,
        };
      }).filter((row): row is NonNullable<typeof row> => row !== null);
      if (!returns.length) return null;
      const average = (key: keyof typeof returns[number]) => {
        const values = returns.flatMap(row => typeof row[key] === "number" ? [row[key] as number] : []);
        return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) : null;
      };
      const return1m = average("return1m");
      return {
        name: group.name,
        symbol: null,
        // Index constituent weights/valuation are not inferred from price data.
        weight: null,
        return1d: average("return1d"),
        return1w: average("return1w"),
        return1m,
        returnYtd: average("returnYtd"),
        pe: null,
        momentum: return1m === null ? "unknown" : return1m >= 3 ? "strong" : return1m <= -3 ? "weak" : "neutral",
        observedAt: returns.map(row => row.observedAt).sort().at(-1) ?? null,
        source: "Yahoo Finance public chart / constituent aggregation",
        available: true,
      };
    }));
    return results.filter((row): row is NonNullable<typeof row> => row !== null);
  }),

  getMarketOverview: publicProcedure.query(async () => {
    const [indices, stocks] = await Promise.all([observedIndices(), observedStocks()]);
    const advancing = stocks.filter(stock => stock.change > 0).length;
    const declining = stocks.filter(stock => stock.change < 0).length;
    const unchanged = Math.max(0, stocks.length - advancing - declining);
    const totalVolume = stocks.reduce((sum, stock) => sum + (stock.volumeValue ?? 0), 0);
    const volumeRatios = stocks.flatMap(stock => typeof stock.volumeVs20d === "number" ? [stock.volumeVs20d] : []);
    const averageVolumeRatio = volumeRatios.length ? volumeRatios.reduce((sum, value) => sum + value, 0) / volumeRatios.length : null;
    const decided = Math.max(1, advancing + declining);
    return {
      indices,
      breadth: { advancing, declining, unchanged, advanceDeclineRatio: declining ? advancing / declining : advancing },
      volume: { total: compactNumber(totalVolume), above20dAvg: averageVolumeRatio },
      sentiment: {
        bullish: Math.round((advancing / decided) * 100),
        bearish: Math.round((declining / decided) * 100),
        neutral: Math.round((unchanged / Math.max(1, stocks.length)) * 100),
      },
      observedAt: indices.map(index => index.observedAt).filter(Boolean).sort().at(-1) ?? null,
      freshness: "延迟/日频观察",
    };
  }),

  getMoneyFlow: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const history = (await loadEquityHistory(input.symbol, 30)).history;
      return history.slice(-30).map((point, index, rows) => {
        const previous = rows[index - 1]?.close ?? point.open;
        const volume = typeof point.volume === "number" && Number.isFinite(point.volume)
          ? point.volume
          : 0;
        const upVolume = point.close >= previous ? volume : 0;
        const downVolume = point.close < previous ? volume : 0;
        return {
          date: point.date,
          inflow: upVolume,
          outflow: downVolume,
          net: upVolume - downVolume,
          largeOrder: null,
          smallOrder: null,
          basis: "基于收盘方向与成交量的方向成交量代理；不等同于真实资金流或订单流。",
        };
      });
    }),

  getTopMovers: publicProcedure.query(async () => {
    const stocks = await observedStocks();
    const gainers = [...stocks].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
    const losers = [...stocks].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
    const mostActive = [...stocks].sort((a, b) => (b.volumeValue ?? 0) - (a.volumeValue ?? 0)).slice(0, 5);
    return { gainers, losers, mostActive };
  }),
});
