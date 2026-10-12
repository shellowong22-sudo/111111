/** TOP BON — 债券市场观察与研究核验。公开市场数据不足时不虚构新闻、概率或套利机会。 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchMultipleYahoo, fetchYahooNews } from '../realDataService';

const WATCHLIST = [
  { symbol: 'SHY', name: '短久期美债代理', category: '短端' },
  { symbol: 'IEF', name: '中久期美债代理', category: '期限' },
  { symbol: 'TLT', name: '长久期美债代理', category: '期限' },
  { symbol: 'TIP', name: '通胀保值债代理', category: '通胀' },
  { symbol: 'EMB', name: '新兴市场主权债代理', category: '主权' },
  { symbol: 'LQD', name: '投资级信用代理', category: '信用' },
  { symbol: 'HYG', name: '高收益信用代理', category: '信用' },
  { symbol: 'GLD', name: '黄金避险代理', category: '避险' },
] as const;

type Point = { date: string; value: number };
type BondQuote = { price?: number; changePct?: number; history?: Point[]; dataMode?: 'OBSERVED' | 'SIM_FLOW' };

const TOP_REFERENCE_PRICES: Record<string, number> = { SHY: 82.41, IEF: 94.83, TLT: 88.92, TIP: 108.76, EMB: 92.31, LQD: 108.39, HYG: 79.16, GLD: 241.72 };
const TOP_DURATION_LOAD: Record<string, number> = { SHY: 0.22, IEF: 0.61, TLT: 1.18, TIP: 0.74, EMB: 0.53, LQD: 0.48, HYG: 0.27, GLD: -0.19 };
const topSeed = (symbol: string) => [...symbol].reduce((sum, character) => sum + character.charCodeAt(0), 0);

function buildTopScenarioQuote(symbol: string, now: Date): BondQuote {
  const seed = topSeed(symbol);
  const anchor = TOP_REFERENCE_PRICES[symbol] ?? 100;
  const durationLoad = TOP_DURATION_LOAD[symbol] ?? 0.4;
  const history: Point[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let accepted = 0;
  let offset = 370;
  while (accepted < 252 && offset >= 0) {
    const date = new Date(cursor);
    date.setUTCDate(date.getUTCDate() - offset);
    offset -= 1;
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    const rateCycle = Math.sin((accepted + 12) / 31) * -0.027 * durationLoad;
    const riskCycle = Math.cos((accepted + seed) / 19) * 0.015;
    const localNoise = Math.sin((accepted * 5 + seed) * 0.41) * 0.003;
    const trend = ((accepted - 126) / 252) * (((seed % 7) - 3) * 0.004);
    history.push({ date: date.toISOString().slice(0, 10), value: Number((anchor * (1 + rateCycle + riskCycle + localNoise + trend)).toFixed(3)) });
    accepted += 1;
  }
  const bucket = Math.floor(now.getTime() / 4_000);
  const livePulse = Math.sin((bucket + seed) * 0.67) * 0.0016;
  const last = history.at(-1);
  if (last) last.value = Number((last.value * (1 + livePulse)).toFixed(3));
  const previous = history.at(-2)?.value;
  const price = last?.value ?? anchor;
  return { price, changePct: previous ? (price / previous - 1) * 100 : 0, history, dataMode: 'SIM_FLOW' };
}

type TopDataset = { quotes: Record<string, BondQuote | null>; dataMode: 'OBSERVED' | 'MIXED' | 'SIM_FLOW'; source: string; timestamp: string };
let topDatasetCache: { bucket: number; promise: Promise<TopDataset> } | null = null;

function getTopDataset(): Promise<TopDataset> {
  const now = new Date();
  const bucket = Math.floor(now.getTime() / 4_000);
  if (topDatasetCache?.bucket === bucket) return topDatasetCache.promise;
  const promise = fetchMultipleYahoo(WATCHLIST.map((item) => item.symbol), '1y', true).then((observed) => {
    const quotes: Record<string, BondQuote | null> = {};
    let observedCount = 0;
    WATCHLIST.forEach(({ symbol }) => {
      const quote = observed[symbol];
      const history = (quote?.history ?? []).filter((point) => Number.isFinite(point.value));
      if (Number.isFinite(quote?.price) && (quote?.price ?? 0) > 0 && history.length >= 20) {
        quotes[symbol] = { ...quote, history, dataMode: 'OBSERVED' };
        observedCount += 1;
      } else {
        quotes[symbol] = buildTopScenarioQuote(symbol, now);
      }
    });
    const dataMode: TopDataset['dataMode'] = observedCount === WATCHLIST.length ? 'OBSERVED' : observedCount === 0 ? 'SIM_FLOW' : 'MIXED';
    return {
      quotes,
      dataMode,
      source: dataMode === 'OBSERVED' ? 'Yahoo Finance' : dataMode === 'MIXED' ? 'Yahoo Finance + 动态事件情景' : '动态事件情景（非市场报价）',
      timestamp: now.toISOString(),
    };
  });
  topDatasetCache = { bucket, promise };
  return promise;
}

const verificationByCategory: Record<string, string> = {
  短端: '对照政策利率、回购资金和国库券供给日历。',
  期限: '核对久期暴露、关键期限收益率与拍卖窗口。',
  通胀: '复查实际收益率、盈亏平衡通胀及能源价格扰动。',
  主权: '补充汇率对冲、外汇储备和国家事件证据。',
  信用: '交叉查看现券利差、违约预期和成交深度。',
  避险: '区分实际利率、美元方向与避险资金贡献。',
};
function returnPct(history: Point[], lookback: number) {
  const end = history.at(-1)?.value; const start = history[Math.max(0, history.length - 1 - lookback)]?.value;
  return end && start ? (end / start - 1) * 100 : null;
}
function zScore(history: Point[], price: number | undefined) {
  const values = history.map((item) => item.value).filter(Number.isFinite);
  if (!price || values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return variance > 0 ? (price - mean) / Math.sqrt(variance) : null;
}

export function calculateBondDurationSensitivity(portfolioValue: number, modifiedDuration: number, yieldShockBps: number) {
  const shockDecimal = yieldShockBps / 10_000;
  const estimatedPnl = -portfolioValue * modifiedDuration * shockDecimal;
  return { estimatedPnl, estimatedPnlPct: estimatedPnl / portfolioValue * 100 };
}

export const topbonRouter = router({
  getNewsFlow: publicProcedure.query(async () => {
    const items = await Promise.all(WATCHLIST.slice(0, 5).map(async (item) => {
      const result = await fetchYahooNews(item.symbol, 4, 'US');
      return result.items.map((news) => ({ ...news, symbol: item.symbol, category: item.category, name: item.name }));
    }));
    const news = items.flat().sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? ''))).slice(0, 20);
    return {
      success: true,
      available: news.length > 0,
      items: news,
      source: 'Yahoo Finance public search',
      timestamp: new Date().toISOString(),
      limitation: news.length ? '标题、发布者与时间来自公开搜索；正文请打开来源核验。' : '当前公开搜索没有返回与债券观察标的直接关联的可核验条目。',
    };
  }),
  getBondWatchlist: publicProcedure
    .input(z.object({ category: z.string().default('ALL') }))
    .query(async ({ input }) => {
      const dataset = await getTopDataset();
      const quotes = dataset.quotes;
      const filtered = WATCHLIST.filter((item) => input.category === 'ALL' || item.category === input.category);
      const items = filtered.flatMap((meta) => {
        const quote = quotes[meta.symbol];
        if (!quote?.price) return [];
        const history = quote.history ?? [];
        return [{
          ...meta,
          price: quote.price,
          dailyChangePct: quote.changePct ?? null,
          return1mPct: returnPct(history, 21),
          return3mPct: returnPct(history, 63),
          zScore: zScore(history, quote.price),
          observations: history.length,
          history: history.slice(-180),
          dataMode: quote.dataMode ?? 'OBSERVED',
        }];
      });
      return { success: true, categories: ['ALL', ...Array.from(new Set(WATCHLIST.map((item) => item.category)))], items, source: dataset.source, dataMode: dataset.dataMode, timestamp: dataset.timestamp };
    }),

  getMonitoringFlags: publicProcedure.query(async () => {
    const dataset = await getTopDataset();
    const quotes = dataset.quotes;
    const flags = WATCHLIST.map((meta) => {
      const quote = quotes[meta.symbol]; const history = quote?.history ?? []; const score = zScore(history, quote?.price);
      if (!quote?.price || history.length < 20) return { symbol: meta.symbol, name: meta.name, category: meta.category, level: '数据不足', observation: '公开价格历史不足，不能形成相对历史位置判断。', verification: '确认数据许可、交易日和标的映射。' };
      const level = score !== null && Math.abs(score) >= 2.5 ? '高关注' : score !== null && Math.abs(score) >= 1.8 ? '关注' : '常规';
      return { symbol: meta.symbol, name: meta.name, category: meta.category, level, zScore: score, dataMode: quote.dataMode ?? 'OBSERVED', observation: `${meta.category}窗口位于一年分布${score !== null && score >= 0 ? '上侧' : '下侧'}，当前偏离为 ${score == null ? '—' : score.toFixed(2)} 个标准差。`, verification: verificationByCategory[meta.category] ?? '回到对应资产的事件窗口核验。' };
    });
    return { success: true, flags, source: dataset.source, dataMode: dataset.dataMode, timestamp: dataset.timestamp };
  }),

  getResearchChecklist: publicProcedure.query(() => ({
    success: true,
    sections: [
      { title: '新闻来源', items: ['保留原始链接、发布时间、发布方与标题，不将二次转述视作事实。', '区分正式政策文件、发行人披露、媒体报道与市场评论。'] },
      { title: '市场验证', items: ['核对相关现券、期货或 ETF 的时间戳与成交流动性。', '将价格变动与曲线、信用、外汇和商品等替代解释进行比较。'] },
      { title: '组合影响', items: ['用实际久期、DV01、票息、融资、货币与信用敞口计算敏感性。', '记录情景假设、适用期限和未覆盖的尾部风险。'] },
    ],
    limitation: '系统不抓取付费新闻、社媒私域或非公开信息；也不对未发生事件给出概率、因果预测或交易建议。',
  })),

  calculateDurationSensitivity: publicProcedure
    .input(z.object({ portfolioValue: z.number().positive().max(10_000_000_000), modifiedDuration: z.number().min(0).max(100), yieldShockBps: z.number().min(-1_000).max(1_000) }))
    .query(({ input }) => {
      const sensitivity = calculateBondDurationSensitivity(input.portfolioValue, input.modifiedDuration, input.yieldShockBps);
      return {
        success: true,
        ...input,
        ...sensitivity,
        methodology: '一阶久期近似：ΔP ≈ −Dmod × Δy × P。未包含凸性、曲线非平行移动、信用利差、融资、税费、流动性及期权效应。',
      };
    }),
});
