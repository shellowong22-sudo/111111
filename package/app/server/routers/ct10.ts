/** CT10 Govt — 美国 10 年期国债实际利率分解、用户情景传导与跨资产历史联动。 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchMultipleFred, fetchMultipleYahoo } from '../realDataService';

type Point = { date: string; value: number };

function latest(points: Point[] | undefined): number | null {
  const value = points?.at(-1)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function returnSeries(points: Point[]): Map<string, number> {
  const result = new Map<string, number>();
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous?.value || !current || !Number.isFinite(current.value)) continue;
    result.set(current.date, (current.value - previous.value) / Math.abs(previous.value));
  }
  return result;
}

function regression(base: Map<string, number>, asset: Map<string, number>) {
  const pairs = Array.from(base.entries()).flatMap(([date, x]) => {
    const y = asset.get(date);
    return y === undefined ? [] : [[x, y] as const];
  });
  if (pairs.length < 20) return { beta: null, corr: null, observations: pairs.length };
  const meanX = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const meanY = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let covariance = 0; let varianceX = 0; let varianceY = 0;
  for (const [x, y] of pairs) {
    covariance += (x - meanX) * (y - meanY);
    varianceX += (x - meanX) ** 2;
    varianceY += (y - meanY) ** 2;
  }
  return {
    beta: varianceX ? Number((covariance / varianceX).toFixed(3)) : null,
    corr: varianceX && varianceY ? Number((covariance / Math.sqrt(varianceX * varianceY)).toFixed(3)) : null,
    observations: pairs.length,
  };
}

const SHOCK_DEFINITIONS = {
  CPI_SURPRISE: { label: 'CPI 超预期', tenYearBps: 12, curveBps: 8, usdPct: 0.45, equityPct: -0.7, commodityPct: 0.4 },
  FED_HAWKISH: { label: '美联储鹰派', tenYearBps: 9, curveBps: -6, usdPct: 0.6, equityPct: -0.9, commodityPct: -0.3 },
  GEOPOLITICAL: { label: '地缘政治', tenYearBps: -7, curveBps: -3, usdPct: 0.35, equityPct: -1.2, commodityPct: 1.1 },
  GROWTH_SHOCK: { label: '增长冲击', tenYearBps: -11, curveBps: -9, usdPct: -0.15, equityPct: -1.0, commodityPct: -0.8 },
} as const;

export const ct10Router = router({
  getMicrostructure: publicProcedure.query(async () => {
    const [fred, futures] = await Promise.all([
      fetchMultipleFred(['DGS10', 'DFII10', 'T10YIE']),
      fetchMultipleYahoo(['ZN=F'], '6mo'),
    ]);
    const dates = Array.from(new Set([
      ...(fred.DGS10 ?? []).map((point) => point.date),
      ...(fred.DFII10 ?? []).map((point) => point.date),
      ...(fred.T10YIE ?? []).map((point) => point.date),
    ])).sort().slice(-180);
    const maps = Object.fromEntries(Object.entries(fred).map(([id, points]) => [id, new Map(points.map((point) => [point.date, point.value]))]));
    const decompositionHistory = dates.map((date) => {
      const nominal = maps.DGS10?.get(date) ?? null;
      const real = maps.DFII10?.get(date) ?? null;
      const breakeven = maps.T10YIE?.get(date) ?? null;
      return { date, nominal, real, breakeven, residual: nominal !== null && real !== null && breakeven !== null ? Number((nominal - real - breakeven).toFixed(4)) : null };
    });
    const nominal = latest(fred.DGS10);
    const real = latest(fred.DFII10);
    const breakeven = latest(fred.T10YIE);
    const futuresQuote = futures['ZN=F'];
    return {
      success: true,
      available: nominal !== null || Boolean(futuresQuote?.history.length),
      symbol: 'CT10 Govt',
      name: '10Y US Treasury',
      yieldLevel: nominal,
      decomposition: [
        { component: '实际利率', value: real, color: '#22d3ee' },
        { component: '通胀预期', value: breakeven, color: '#f59e0b' },
        { component: '口径残差', value: nominal !== null && real !== null && breakeven !== null ? Number((nominal - real - breakeven).toFixed(4)) : null, color: '#64748b' },
      ],
      decompositionHistory,
      futures: futuresQuote ? { price: futuresQuote.price, changePct: futuresQuote.changePct, history: futuresQuote.history.slice(-120) } : null,
      unavailableFields: ['现券逐笔委托', '现券买卖价差', '交易者身份构成'],
      methodology: '名义收益率、实际收益率和平衡通胀均为 FRED 原始观测；10 年期国债期货仅用于公开价格与成交量参考。',
      source: 'FRED / Yahoo Finance',
      timestamp: new Date().toISOString(),
    };
  }),

  getShockTransmission: publicProcedure
    .input(z.object({ shock: z.enum(['CPI_SURPRISE', 'FED_HAWKISH', 'GEOPOLITICAL', 'GROWTH_SHOCK']).default('CPI_SURPRISE'), magnitude: z.number().min(-3).max(3).default(1) }))
    .query(({ input }) => {
      const definition = SHOCK_DEFINITIONS[input.shock];
      const multiplier = input.magnitude;
      const path = [
        { node: '用户输入冲击', horizon: 'T0', impact: multiplier, unit: 'σ' },
        { node: '10Y 情景收益率', horizon: '即时重估', impact: Number((definition.tenYearBps * multiplier).toFixed(2)), unit: 'bp' },
        { node: '2Y–10Y 曲线', horizon: '期限传导', impact: Number((definition.curveBps * multiplier).toFixed(2)), unit: 'bp' },
        { node: '美元情景', horizon: '跨资产传导', impact: Number((definition.usdPct * multiplier).toFixed(2)), unit: '%' },
        { node: '股票情景', horizon: '跨资产传导', impact: Number((definition.equityPct * multiplier).toFixed(2)), unit: '%' },
        { node: '商品情景', horizon: '跨资产传导', impact: Number((definition.commodityPct * multiplier).toFixed(2)), unit: '%' },
      ];
      const nonlinear = Array.from({ length: 13 }, (_, index) => {
        const x = (index - 6) / 2;
        const response = definition.tenYearBps * x + Math.sign(x) * 0.75 * x * x;
        return { magnitude: x, yieldResponse: Number(response.toFixed(2)) };
      });
      return { success: true, shock: input.shock, shockLabel: definition.label, magnitude: multiplier, path, nonlinear, methodology: '固定系数的用户情景敏感性，不是实时报价、预测或交易建议。', timestamp: new Date().toISOString() };
    }),

  getAssetLinkage: publicProcedure.query(async () => {
    const definitions = [
      { asset: 'S&P 500 指数', symbol: 'SP500', seriesId: 'SP500' },
      { asset: '伦敦黄金定盘价', symbol: 'GOLD', seriesId: 'GOLDAMGBD228NLBM' },
      { asset: '广义美元指数', symbol: 'USD-BROAD', seriesId: 'DTWEXBGS' },
      { asset: 'WTI 现货', symbol: 'WTI', seriesId: 'DCOILWTICO' },
      { asset: '日元兑美元', symbol: 'JPY/USD', seriesId: 'DEXJPUS' },
    ];
    const observations = await fetchMultipleFred(['DGS10', ...definitions.map((item) => item.seriesId)]);
    const base = returnSeries(observations.DGS10 ?? []);
    const linkages = definitions.map((definition) => {
      const history = observations[definition.seriesId] ?? [];
      const stats = regression(base, returnSeries(history));
      const strength = stats.corr === null ? '数据不足' : Math.abs(stats.corr) >= 0.7 ? '强联动' : Math.abs(stats.corr) >= 0.4 ? '中等联动' : '弱联动';
      return { asset: definition.asset, symbol: definition.symbol, ...stats, alert: strength, lastObservedAt: history.at(-1)?.date ?? null };
    });
    return {
      success: true,
      available: linkages.some((item) => item.corr !== null),
      linkages,
      methodology: '使用 FRED 同日公共观测，计算各资产日变化与美国 10Y 收益率日变化的 Beta 和 Pearson 相关系数；不同发布时间会自动缩减共同样本。',
      source: 'FRED',
      timestamp: new Date().toISOString(),
    };
  }),
});
