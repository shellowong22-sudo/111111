/**
 * YAS — 收益率与利差分析。
 * 研究口径：公开 ETF 价格作为信用/主权风险偏好代理，联动 FRED 国债曲线；
 * 代理指标不等同于单券 OAS、CDS 或可执行报价。
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchMultipleFred, fetchMultipleYahoo } from '../realDataService';

export const YAS_PROXY_UNIVERSE = [
  { symbol: 'LQD', name: '投资级公司债', rating: 'IG', sector: '信用' },
  { symbol: 'HYG', name: '高收益公司债', rating: 'HY', sector: '信用' },
  { symbol: 'JNK', name: '高收益债替代', rating: 'HY', sector: '信用' },
  { symbol: 'EMB', name: '新兴市场主权债', rating: 'EM', sector: '主权' },
  { symbol: 'PCY', name: '新兴市场主权债替代', rating: 'EM', sector: '主权' },
  { symbol: 'TIP', name: '通胀保值债', rating: 'ILB', sector: '通胀' },
  { symbol: 'BIL', name: '短端国库券', rating: 'MM', sector: '资金' },
] as const;

type Point = { date: string; value: number };
type Quote = { price?: number; changePct?: number; history?: Point[]; dataMode?: 'OBSERVED' | 'SIM_FLOW' };

const YAS_REFERENCE_PRICES: Record<string, number> = {
  LQD: 108.42,
  HYG: 79.18,
  JNK: 96.74,
  EMB: 92.36,
  PCY: 67.52,
  TIP: 108.87,
  BIL: 91.63,
  TLT: 88.94,
};

const symbolSeed = (symbol: string) => [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);

/**
 * Yahoo 在当前运行环境不可用时，生成明确标识的动态研究情景。
 * 序列只用于保持研究工作流和联动可测试，绝不作为现券、ETF 或 CDS 报价。
 */
function buildYasScenarioQuote(symbol: string, now = new Date()): Quote {
  const seed = symbolSeed(symbol);
  const base = YAS_REFERENCE_PRICES[symbol] ?? 100;
  const history: Point[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let businessDays = 0;
  let calendarOffset = 370;
  while (businessDays < 252 && calendarOffset >= 0) {
    const day = new Date(cursor);
    day.setUTCDate(day.getUTCDate() - calendarOffset);
    calendarOffset -= 1;
    const weekDay = day.getUTCDay();
    if (weekDay === 0 || weekDay === 6) continue;
    const cycle = Math.sin((businessDays + seed) / 17) * 0.016;
    const slow = Math.cos((businessDays + seed * 0.7) / 43) * 0.024;
    const drift = ((businessDays - 126) / 252) * (((seed % 9) - 4) * 0.006);
    const micro = Math.sin((businessDays * 7 + seed) * 0.37) * 0.0035;
    history.push({ date: day.toISOString().slice(0, 10), value: Number((base * (1 + cycle + slow + drift + micro)).toFixed(3)) });
    businessDays += 1;
  }
  const liveBucket = Math.floor(now.getTime() / 4_000);
  const liveShift = Math.sin((liveBucket + seed) * 0.71) * 0.0018;
  const latest = history.at(-1);
  if (latest) latest.value = Number((latest.value * (1 + liveShift)).toFixed(3));
  const previous = history.at(-2)?.value;
  const price = latest?.value ?? base;
  return {
    price,
    changePct: previous ? ((price / previous) - 1) * 100 : 0,
    history,
    dataMode: 'SIM_FLOW',
  };
}

type YasDataset = {
  quotes: Record<string, Quote | null>;
  rates: Awaited<ReturnType<typeof fetchMultipleFred>>;
  source: string;
  dataMode: 'OBSERVED' | 'MIXED' | 'SIM_FLOW';
  timestamp: string;
};

let yasDatasetCache: { bucket: number; promise: Promise<YasDataset> } | null = null;

function getYasDataset(): Promise<YasDataset> {
  const now = new Date();
  const bucket = Math.floor(now.getTime() / 4_000);
  if (yasDatasetCache?.bucket === bucket) return yasDatasetCache.promise;
  const promise = Promise.all([
    fetchMultipleYahoo([...YAS_PROXY_UNIVERSE.map((item) => item.symbol), 'TLT'], '1y', true),
    fetchMultipleFred(['DGS10', 'DGS2', 'T10Y2Y', 'DFII10']),
  ]).then(([observed, rates]) => {
    let observedCount = 0;
    const quotes: Record<string, Quote | null> = {};
    [...YAS_PROXY_UNIVERSE.map((item) => item.symbol), 'TLT'].forEach((symbol) => {
      const quote = observed[symbol];
      const validHistory = (quote?.history ?? []).filter((point) => Number.isFinite(point.value));
      if (Number.isFinite(quote?.price) && (quote?.price ?? 0) > 0 && validHistory.length >= 20) {
        quotes[symbol] = { ...quote, history: validHistory, dataMode: 'OBSERVED' };
        observedCount += 1;
      } else {
        quotes[symbol] = buildYasScenarioQuote(symbol, now);
      }
    });
    const total = Object.keys(quotes).length;
    const dataMode: YasDataset['dataMode'] = observedCount === total ? 'OBSERVED' : observedCount === 0 ? 'SIM_FLOW' : 'MIXED';
    return {
      quotes,
      rates,
      dataMode,
      source: dataMode === 'OBSERVED' ? 'Yahoo Finance + FRED' : dataMode === 'MIXED' ? 'Yahoo Finance + FRED + 动态研究情景' : 'FRED + 动态研究情景（非市场报价）',
      timestamp: now.toISOString(),
    };
  });
  yasDatasetCache = { bucket, promise };
  return promise;
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const standardDeviation = (values: number[], average: number) => values.length < 2 ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
const percentile = (values: number[], value: number) => values.length ? (values.filter((item) => item <= value).length / values.length) * 100 : null;

export function calculateYasReturnPct(points: Point[], days: number) {
  if (points.length < 2) return null;
  const start = points[Math.max(0, points.length - 1 - days)]?.value;
  const end = points[points.length - 1]?.value;
  return start && end ? ((end / start) - 1) * 100 : null;
}

export function buildYasProxySegments(data: Record<string, Quote | null>) {
  return YAS_PROXY_UNIVERSE.flatMap((meta) => {
    const quote = data[meta.symbol];
    const history = quote?.history ?? [];
    const values = history.map((point) => point.value).filter(Number.isFinite);
    const latest = quote?.price;
    if (!latest || values.length < 2) return [];
    const average = mean(values);
    const deviation = average === null ? null : standardDeviation(values, average);
    const zScore = average !== null && deviation && deviation > 0 ? (latest - average) / deviation : null;
    return [{
      name: meta.name,
      rating: meta.rating,
      sector: meta.sector,
      reference: meta.symbol,
      proxyPrice: latest,
      meanPrice: average,
      dailyChangePct: quote?.changePct ?? null,
      return1mPct: calculateYasReturnPct(history, 21),
      return3mPct: calculateYasReturnPct(history, 63),
      zScore,
      percentile: percentile(values, latest),
      isAnomaly: zScore !== null && Math.abs(zScore) >= 1.8,
      observations: values.length,
      dataMode: quote?.dataMode ?? 'OBSERVED',
      history,
    }];
  });
}

export const yasRouter = router({
  getSpreadStructure: publicProcedure
    .input(z.object({ benchmark: z.string().default('US10Y') }))
    .query(async ({ input }) => {
      const dataset = await getYasDataset();
      const { quotes, rates } = dataset;
      return {
        success: true,
        benchmark: input.benchmark,
        metricLabel: 'ETF 价格代理（非 OAS/CDS）',
        methodology: '以近一年公开 ETF 日收盘价计算价格 Z-Score、分位数与 1M/3M 收益率，用于观察风险偏好与相对表现。',
        segments: buildYasProxySegments(quotes),
        rates: { us10y: rates.DGS10?.at(-1)?.value ?? null, us2y: rates.DGS2?.at(-1)?.value ?? null, spread10y2y: rates.T10Y2Y?.at(-1)?.value ?? null },
        source: dataset.source,
        dataMode: dataset.dataMode,
        timestamp: dataset.timestamp,
      };
    }),

  getSpreadAttribution: publicProcedure
    .input(z.object({ segment: z.string().default('投资级公司债') }))
    .query(async ({ input }) => {
      const selected = YAS_PROXY_UNIVERSE.find((item) => item.name === input.segment) ?? YAS_PROXY_UNIVERSE[0];
      const dataset = await getYasDataset();
      const { quotes, rates } = dataset;
      const targetHistory = quotes[selected.symbol]?.history ?? [];
      const drivers = [
        { factor: `${selected.symbol} 1M 相对表现`, code: 'PROXY_1M', value: calculateYasReturnPct(targetHistory, 21), unit: '%' },
        { factor: 'TLT 1M 相对表现', code: 'DURATION_1M', value: calculateYasReturnPct(quotes.TLT?.history ?? [], 21), unit: '%' },
        { factor: 'BIL 1M 相对表现', code: 'CASH_1M', value: calculateYasReturnPct(quotes.BIL?.history ?? [], 21), unit: '%' },
        { factor: '10Y–2Y 曲线斜率', code: 'T10Y2Y', value: rates.T10Y2Y?.at(-1)?.value ?? null, unit: '%' },
        { factor: '10Y 实际收益率', code: 'DFII10', value: rates.DFII10?.at(-1)?.value ?? null, unit: '%' },
      ];
      return {
        success: true,
        segment: selected.name,
        symbol: selected.symbol,
        method: '同日公开价格与利率观察因子（描述性，不做因果声明）',
        drivers,
        researchQuestions: ['相对 TLT 的收益是否与久期方向一致？', '代理 ETF 的价格异常是否得到成交、新闻或现券利差数据确认？', '曲线与实际利率变化是否改变融资或再融资风险？'],
        source: dataset.source,
        dataMode: dataset.dataMode,
        timestamp: dataset.timestamp,
      };
    }),

  getAnomalyAlerts: publicProcedure.query(async () => {
    const dataset = await getYasDataset();
    const alerts = buildYasProxySegments(dataset.quotes)
      .filter((item) => item.zScore !== null && item.percentile !== null)
      .map((item) => {
        const zScore = item.zScore ?? 0;
        const pctl = item.percentile ?? 0;
        return {
          segment: item.name,
          symbol: item.reference,
          zScore,
          percentile: pctl,
          severity: Math.abs(zScore) >= 2.5 ? '高' : Math.abs(zScore) >= 1.8 ? '关注' : '正常',
          observation: zScore > 0 ? '价格处于一年样本均值上方' : '价格处于一年样本均值下方',
          verification: '请结合现券利差、成交深度、货币对冲成本和事件新闻进行复核。',
        };
      })
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    return { success: true, alerts, highCount: alerts.filter((alert) => alert.severity === '高').length, source: dataset.source, dataMode: dataset.dataMode, timestamp: dataset.timestamp };
  }),

  getArbitrageOpportunities: publicProcedure.query(async () => {
    const dataset = await getYasDataset();
    const tlt1m = calculateYasReturnPct(dataset.quotes.TLT?.history ?? [], 21);
    const observations = buildYasProxySegments(dataset.quotes)
      .filter((item) => item.return1mPct !== null && tlt1m !== null)
      .map((item) => ({
        name: item.name,
        symbol: item.reference,
        return1mPct: item.return1mPct,
        return3mPct: item.return3mPct,
        relativeToTLT1mPct: item.return1mPct! - tlt1m!,
        zScore: item.zScore,
        question: item.return1mPct! - tlt1m! >= 0 ? '相对长久期国债走强：检查信用、汇率或期限暴露是否驱动。' : '相对长久期国债走弱：检查风险偏好、流动性或融资成本是否驱动。',
      }))
      .sort((a, b) => Math.abs(b.relativeToTLT1mPct) - Math.abs(a.relativeToTLT1mPct));
    return { success: true, observations, methodology: '相对 TLT 的价格回报观察，不含交易成本、税费、外汇对冲、融资和可交易性假设。', source: dataset.source, dataMode: dataset.dataMode, timestamp: dataset.timestamp };
  }),
});
