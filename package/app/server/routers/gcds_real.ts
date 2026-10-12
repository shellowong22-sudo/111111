/**
 * gcds_real.ts — GCDS 全球CDS图表 真实数据版本
 * 数据来源：Yahoo Finance CDS 代理 ETF（HYG/LQD/JNK/EMB/PCY）+ 历史数据
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchMultipleYahoo, CDS_PROXY_ETFS } from '../realDataService';

export const gcdsRealRouter = router({
  // 获取全球 CDS 代理 ETF 行情（Yahoo Finance 真实数据）
  getGlobalCDSETFs: publicProcedure
    .input(z.object({ range: z.enum(['5d', '1mo', '3mo', '6mo', '1y']).default('1y') }))
    .query(async ({ input }) => {
      const symbols = Object.values(CDS_PROXY_ETFS).map(e => e.symbol);
      const data = await fetchMultipleYahoo(symbols, input.range);

      const result = Object.entries(CDS_PROXY_ETFS).map(([key, etf]) => {
        const chartData = data[etf.symbol];
        return {
          key,
          symbol: etf.symbol,
          name: etf.name,
          category: etf.category,
          price: chartData?.price ?? 0,
          change: chartData?.change ?? 0,
          changePct: chartData?.changePct ?? 0,
          history: chartData?.history ?? [],
          lastUpdate: new Date().toISOString(),
        };
      });

      // 按类别分组
      const byCategory = result.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, typeof result>);

      return {
        success: true,
        data: result,
        byCategory,
        source: 'Yahoo Finance',
        timestamp: new Date().toISOString(),
      };
    }),

  // 获取 CDS 利差排行榜（基于 ETF 价格变化）
  getCDSRanking: publicProcedure
    .input(z.object({ category: z.string().optional(), range: z.enum(['5d', '1mo', '3mo', '6mo', '1y']).default('1y') }))
    .query(async ({ input }) => {
      const symbols = Object.values(CDS_PROXY_ETFS).map(e => e.symbol);
      const data = await fetchMultipleYahoo(symbols, input.range);

      let items = Object.entries(CDS_PROXY_ETFS).map(([key, etf]) => {
        const chartData = data[etf.symbol];
        return {
          key,
          symbol: etf.symbol,
          name: etf.name,
          category: etf.category,
          price: chartData?.price ?? 0,
          changePct: chartData?.changePct ?? 0,
          volatility: chartData?.history ? calculateVolatility(chartData.history.map(h => h.value)) : 0,
        };
      });

      if (input.category) {
        items = items.filter(i => i.category === input.category);
      }

      // 按价格变化排序（升序 = CDS 利差扩大）
      items.sort((a, b) => b.changePct - a.changePct);

      return {
        success: true,
        data: items,
        topRisers: items.slice(0, 5),
        topFallers: items.slice(-5).reverse(),
        source: 'Yahoo Finance',
        timestamp: new Date().toISOString(),
      };
    }),

  // 获取 CDS 热力图数据（按类别和时间）
  getCDSHeatmap: publicProcedure
    .input(z.object({ range: z.enum(['5d', '1mo', '3mo', '6mo', '1y']).default('1mo') }))
    .query(async ({ input }) => {
      const symbols = Object.values(CDS_PROXY_ETFS).map(e => e.symbol);
      const data = await fetchMultipleYahoo(symbols, input.range);

      // 构建热力图数据：行=类别，列=时间，值=价格变化
      const heatmapData: Record<string, Record<string, number>> = {};
      const categoriesSet = new Set(Object.values(CDS_PROXY_ETFS).map(e => e.category));
      const categories = Array.from(categoriesSet);

      for (const cat of categories) {
        heatmapData[cat] = {};
        const etfsInCat = Object.entries(CDS_PROXY_ETFS).filter(([, e]) => e.category === cat);

        for (const [, etf] of etfsInCat) {
          const history = data[etf.symbol]?.history ?? [];
          if (history.length > 0) {
            const latest = history[history.length - 1].value;
            const oldest = history[0].value;
            const pctChange = oldest ? ((latest - oldest) / oldest) * 100 : 0;
            heatmapData[cat][etf.symbol] = pctChange;
          }
        }
      }

      return {
        success: true,
        data: heatmapData,
        categories,
        source: 'Yahoo Finance',
        timestamp: new Date().toISOString(),
      };
    }),

  // 获取 CDS 历史走势对比
  compareCDSSeries: publicProcedure
    .input(z.object({
      symbols: z.array(z.string()).default(['HYG', 'LQD', 'JNK']),
      range: z.enum(['5d', '1mo', '3mo', '6mo', '1y']).default('1y'),
    }))
    .query(async ({ input }) => {
      const data = await fetchMultipleYahoo(input.symbols, input.range);

      const result = input.symbols.map(sym => {
        const chartData = data[sym];
        const etfInfo = Object.values(CDS_PROXY_ETFS).find(e => e.symbol === sym);
        return {
          symbol: sym,
          name: etfInfo?.name ?? sym,
          category: etfInfo?.category ?? 'unknown',
          price: chartData?.price ?? 0,
          change: chartData?.change ?? 0,
          changePct: chartData?.changePct ?? 0,
          history: chartData?.history ?? [],
        };
      });

      // 计算相关性
      const correlations: Record<string, number> = {};
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const key = `${result[i].symbol}-${result[j].symbol}`;
          const corr = calculateCorrelation(
            result[i].history.map(h => h.value),
            result[j].history.map(h => h.value)
          );
          correlations[key] = corr;
        }
      }

      return {
        success: true,
        data: result,
        correlations,
        source: 'Yahoo Finance',
        timestamp: new Date().toISOString(),
      };
    }),
});

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
}

function calculateCorrelation(series1: number[], series2: number[]): number {
  const n = Math.min(series1.length, series2.length);
  if (n < 2) return 0;

  const mean1 = series1.slice(-n).reduce((a, b) => a + b) / n;
  const mean2 = series2.slice(-n).reduce((a, b) => a + b) / n;

  let covariance = 0;
  let var1 = 0;
  let var2 = 0;

  for (let i = 0; i < n; i++) {
    const d1 = series1[series1.length - n + i] - mean1;
    const d2 = series2[series2.length - n + i] - mean2;
    covariance += d1 * d2;
    var1 += d1 * d1;
    var2 += d2 * d2;
  }

  const denominator = Math.sqrt(var1 * var2);
  return denominator === 0 ? 0 : covariance / denominator;
}
