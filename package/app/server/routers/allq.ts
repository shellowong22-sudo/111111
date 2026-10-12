import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchPublicFxPair } from '../freeMarketData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealerQuote {
  dealerId: string;
  dealerName: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  spread: number;
  spreadBps: number;
  timestamp: number;
  isNBBO: boolean;
  fillRate: number;
  responseTimeMs: number;
  quoteQuality: number; // 0-100
  currency: string;
  side: 'BOTH' | 'BID_ONLY' | 'ASK_ONLY';
}

interface MarketDepth {
  price: number;
  size: number;
  dealerCount: number;
  dealers: string[];
  side: 'BID' | 'ASK';
}

interface QuoteHistory {
  timestamp: number;
  bid: number;
  ask: number;
  spread: number;
  midPrice: number;
  dealerCount: number;
}

interface DealerMetrics {
  dealerId: string;
  dealerName: string;
  avgSpreadBps: number;
  fillRate: number;
  avgResponseMs: number;
  quoteCount: number;
  hitRate: number;
  reliability: number;
  rank: number;
  tier: 'TIER1' | 'TIER2' | 'TIER3';
}

interface RFQResponse {
  rfqId: string;
  instrument: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  currency: string;
  quotes: DealerQuote[];
  bestBid: number;
  bestAsk: number;
  bestDealer: string;
  expiresAt: number;
  createdAt: number;
}

// ─── Dealers ──────────────────────────────────────────────────────────────────

const DEALERS = [
  { id: 'GS', name: 'Goldman Sachs', tier: 'TIER1' as const },
  { id: 'MS', name: 'Morgan Stanley', tier: 'TIER1' as const },
  { id: 'JPM', name: 'JP Morgan', tier: 'TIER1' as const },
  { id: 'BARC', name: 'Barclays', tier: 'TIER1' as const },
  { id: 'DB', name: 'Deutsche Bank', tier: 'TIER2' as const },
  { id: 'UBS', name: 'UBS', tier: 'TIER2' as const },
  { id: 'BNPP', name: 'BNP Paribas', tier: 'TIER2' as const },
  { id: 'CITI', name: 'Citibank', tier: 'TIER1' as const },
  { id: 'HSBC', name: 'HSBC', tier: 'TIER2' as const },
  { id: 'NOMURA', name: 'Nomura', tier: 'TIER3' as const },
  { id: 'MIZUHO', name: 'Mizuho', tier: 'TIER3' as const },
  { id: 'SG', name: 'Société Générale', tier: 'TIER2' as const },
];

const INSTRUMENTS: Record<string, { currency: string; assetClass: string }> = {
  'EUR/USD': { currency: 'USD', assetClass: 'FX' },
  'GBP/USD': { currency: 'USD', assetClass: 'FX' },
  'USD/JPY': { currency: 'JPY', assetClass: 'FX' },
  'AUD/USD': { currency: 'USD', assetClass: 'FX' },
  'USD/CHF': { currency: 'CHF', assetClass: 'FX' },
  'EUR/GBP': { currency: 'GBP', assetClass: 'FX' },
  'USD/CAD': { currency: 'CAD', assetClass: 'FX' },
  'NZD/USD': { currency: 'USD', assetClass: 'FX' },
  'AAPL US': { currency: 'USD', assetClass: 'EQUITY' },
  'MSFT US': { currency: 'USD', assetClass: 'EQUITY' },
  'TSLA US': { currency: 'USD', assetClass: 'EQUITY' },
  'NVDA US': { currency: 'USD', assetClass: 'EQUITY' },
  'US10Y': { currency: 'USD', assetClass: 'FIXED_INCOME' },
  'US2Y': { currency: 'USD', assetClass: 'FIXED_INCOME' },
  'DE10Y': { currency: 'EUR', assetClass: 'FIXED_INCOME' },
  'WTI': { currency: 'USD', assetClass: 'COMMODITY' },
  'GOLD': { currency: 'USD', assetClass: 'COMMODITY' },
};

function generateDealerQuotes(instrument: string, dealerCount = 8): DealerQuote[] {
  // ALLQ 需要可执行的交易商报价源。当前没有授权交易商连接，不能用合成报价冒充盘口。
  void instrument; void dealerCount;
  return [];
}

function generateMarketDepth(instrument: string): { bids: MarketDepth[]; asks: MarketDepth[] } {
  void instrument;
  return { bids: [], asks: [] };
}

function generateQuoteHistory(instrument: string, points = 60): QuoteHistory[] {
  void instrument; void points;
  return [];
}

function generateDealerMetrics(): DealerMetrics[] {
  return [];
}

// ─── Real FX Rate Fetcher ────────────────────────────────────────────────────

async function fetchYahooFXRate(pair: string): Promise<number | null> {
  // Yahoo Finance uses EURUSD=X format
  const yahooSymbol = pair.replace('/', '') + '=X';
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinanceHub/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } };
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const allqRouter = router({
  // 获取实时报价聚合
  getQuotes: publicProcedure
    .input(z.object({
      instrument: z.string().default('EUR/USD'),
      dealerCount: z.number().min(1).max(12).optional().default(8),
    }))
    .query(({ input }) => {
      const quotes = generateDealerQuotes(input.instrument, input.dealerCount);
      const info = INSTRUMENTS[input.instrument] || { currency: 'USD', assetClass: 'EQUITY' };

      return {
        instrument: input.instrument,
        assetClass: info.assetClass,
        currency: info.currency,
        quotes,
        nbbo: null as { bestBid: number; bestAsk: number; bestBidDealer: string; bestAskDealer: string; midPrice: number; spreadBps: number; dealerCount: number; timestamp: number } | null,
        available: false,
        limitation: '未配置已授权交易商报价连接；不以静态品种价格或随机盘口替代。',
      };
    }),

  // 获取市场深度
  getMarketDepth: publicProcedure
    .input(z.object({
      instrument: z.string().default('EUR/USD'),
    }))
    .query(({ input }) => {
      return {
        instrument: input.instrument,
        depth: generateMarketDepth(input.instrument),
        timestamp: Date.now(),
      };
    }),

  // 获取报价历史
  getQuoteHistory: publicProcedure
    .input(z.object({
      instrument: z.string().default('EUR/USD'),
      period: z.enum(['1H', '4H', '1D', '1W']).optional().default('1H'),
    }))
    .query(({ input }) => {
      const points = input.period === '1H' ? 60 : input.period === '4H' ? 240 : input.period === '1D' ? 288 : 672;
      const history = generateQuoteHistory(input.instrument, Math.min(points, 100));

      return { instrument: input.instrument, history };
    }),

  // 获取交易商评估指标
  getDealerMetrics: publicProcedure
    .input(z.object({
      sortBy: z.enum(['spread', 'fillRate', 'responseTime', 'reliability']).optional().default('spread'),
    }))
    .query(({ input }) => {
      const metrics = generateDealerMetrics();

      const sorted = [...metrics].sort((a, b) => {
        switch (input.sortBy) {
          case 'spread': return a.avgSpreadBps - b.avgSpreadBps;
          case 'fillRate': return b.fillRate - a.fillRate;
          case 'responseTime': return a.avgResponseMs - b.avgResponseMs;
          case 'reliability': return b.reliability - a.reliability;
          default: return a.avgSpreadBps - b.avgSpreadBps;
        }
      });

      return { metrics: sorted };
    }),

  // 发起 RFQ（询价请求）
  submitRFQ: publicProcedure
    .input(z.object({
      instrument: z.string(),
      direction: z.enum(['BUY', 'SELL']),
      quantity: z.number().positive(),
      currency: z.string().optional(),
      dealerIds: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => {
      return { success: false as const, rfq: null as RFQResponse | null, limitation: '未配置已授权交易商 RFQ 连接，系统不会用模拟报价提交询价。', instrument: input.instrument };
    }),

  // 执行最优报价（发送到 EMSX）
  executeQuote: publicProcedure
    .input(z.object({
      rfqId: z.string(),
      dealerId: z.string(),
      instrument: z.string(),
      direction: z.enum(['BUY', 'SELL']),
      quantity: z.number(),
      price: z.number(),
      currency: z.string(),
    }))
    .mutation(({ input }) => {
      return { success: false as const, orderId: null, executionRef: null, instrument: input.instrument, direction: input.direction, quantity: input.quantity, executedPrice: null as number | null, dealer: input.dealerId, executedAt: null, message: '未配置已授权交易商执行通道，系统不会伪造成交回执。', estimatedSettlement: null };
    }),

  // 获取可交易品种列表
  getInstruments: publicProcedure
    .query(() => {
      return {
        instruments: Object.entries(INSTRUMENTS).map(([symbol, info]) => ({
          symbol,
          ...info,
          dealerCount: null,
          lastUpdate: null,
        })),
      };
    }),

  // 获取价差分析
  getSpreadAnalysis: publicProcedure
    .input(z.object({
      instrument: z.string().default('EUR/USD'),
      period: z.enum(['1D', '1W', '1M']).optional().default('1D'),
    }))
    .query(({ input }) => {
      void input;
      return { instrument: input.instrument, spreadHistory: [] as Array<{ timestamp: number; spreadBps: number; dealerCount: number; volume: number }>, stats: null as { avgSpreadBps: number; minSpreadBps: number; maxSpreadBps: number; currentSpreadBps: number; percentile25: number; percentile75: number } | null, available: false, limitation: '未配置可验证交易商价差历史；不生成合成价差。' };
    }),

  // 获取公开可核验汇率：Yahoo 实时/日内观察优先，ECB 免费官方参考交叉作为明确延迟兜底。
  getRealFXRates: publicProcedure
    .input(z.object({
      pairs: z.array(z.string()).optional().default(['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'USD/CAD', 'NZD/USD', 'EUR/GBP']),
    }))
    .query(async ({ input }) => {
      const results = await Promise.allSettled(input.pairs.map(async (pair) => {
        const yahooPrice = await fetchYahooFXRate(pair);
        if (yahooPrice !== null) return { pair, price: yahooPrice, isReal: true, source: 'Yahoo Finance public chart' as const, change1D: null as number | null, changePct: null as number | null, delayStatus: 'end_of_day' as const, observedAt: new Date().toISOString(), limitation: 'Yahoo 公共图表返回当前公开价格；未返回可核验的一日基准时不推导涨跌。' };
        const publicRate = await fetchPublicFxPair(pair);
        if (!publicRate.available || publicRate.rate === null) return null;
        return { pair, price: publicRate.rate, isReal: false, source: publicRate.source, change1D: publicRate.change, changePct: publicRate.changePct, delayStatus: publicRate.delayStatus, observedAt: publicRate.observedAt, limitation: publicRate.limitation };
      }));
      return {
        rates: results
          .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchPublicFxPair>>> & { pair: string; price: number; isReal: boolean; source: string; change1D: number | null; changePct: number | null; delayStatus: string; observedAt: string | null; limitation: string }> => r.status === 'fulfilled' && r.value !== null)
          .map(r => ({ ...r.value, price: Number(r.value.price.toFixed(6)), timestamp: Date.now() })),
        fetchedAt: Date.now(),
        sourcePolicy: 'Yahoo Finance public chart → ECB Data Portal EXR；无可核验观察时返回空，不使用静态或随机替代。',
      };
    }),
});
