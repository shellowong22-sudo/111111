/**
 * corr.ts — CORR 我的相关系数矩阵 Router
 * 数据来源：Yahoo Finance（真实历史收盘价）
 * 计算：Pearson 相关系数 / 协方差 / Beta（以第一个标的为基准）
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchMultipleYahoo } from '../realDataService';

// ─── 预设标的分组 ────────────────────────────────────────────────────────────────
export const CORR_PRESETS: Record<string, { label: string; tickers: string[] }> = {
  us_equities: {
    label: '美股科技',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
  },
  us_bonds: {
    label: '美国国债',
    tickers: ['^IRX', '^FVX', '^TNX', '^TYX', 'TLT', 'IEF', 'SHY'],
  },
  global_indices: {
    label: '全球指数',
    tickers: ['^GSPC', '^DJI', '^IXIC', '^FTSE', '^N225', '^HSI', '000001.SS'],
  },
  forex_g10: {
    label: 'G10 外汇',
    tickers: ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X', 'USDCHF=X', 'NZDUSD=X'],
  },
  commodities: {
    label: '大宗商品',
    tickers: ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'ZW=F', 'ZC=F'],
  },
  cross_asset: {
    label: '跨资产',
    tickers: ['^GSPC', 'GC=F', 'CL=F', '^TNX', 'EURUSD=X', 'BTC-USD'],
  },
  china_assets: {
    label: 'A股与港股',
    tickers: ['000001.SS', '399001.SZ', '^HSI', '2318.HK', '0700.HK', 'BABA', 'PDD'],
  },
  preferred_stocks: {
    label: '优先股 ETF/个券',
    tickers: ['PFF', 'PGX', 'PGF', 'PFFD', 'PFFA', 'FPE', 'VRP'],
  },
  preferred_banks: {
    label: '银行优先股 vs 利率',
    tickers: ['PFF', 'PGF', 'BAC-PB', 'JPM-PD', '^TNX', 'TLT', 'KRE'],
  },
};

// ─── Pearson 相关系数计算 ─────────────────────────────────────────────────────
function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : parseFloat((num / denom).toFixed(4));
}

// ─── 协方差计算 ───────────────────────────────────────────────────────────────
function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
  }
  return parseFloat((cov / (n - 1)).toFixed(6));
}

// ─── Beta 计算（相对于基准） ───────────────────────────────────────────────────
function beta(asset: number[], benchmark: number[]): number {
  const n = Math.min(asset.length, benchmark.length);
  if (n < 2) return 0;
  const cov = covariance(asset.slice(0, n), benchmark.slice(0, n));
  const varBenchmark = covariance(benchmark.slice(0, n), benchmark.slice(0, n));
  return varBenchmark === 0 ? 0 : parseFloat((cov / varBenchmark).toFixed(4));
}

// ─── 对数收益率 ───────────────────────────────────────────────────────────────
function logReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      ret.push(parseFloat((Math.log(prices[i] / prices[i - 1])).toFixed(6)));
    }
  }
  return ret;
}

// ─── 对齐多个时间序列（取交集日期） ────────────────────────────────────────────
function alignSeries(
  seriesMap: Record<string, { date: string; value: number }[]>
): Record<string, number[]> {
  const symbols = Object.keys(seriesMap);
  if (symbols.length === 0) return {};

  // 找所有系列都有数据的日期交集
  const dateSets = symbols.map(s => new Set(seriesMap[s].map(p => p.date)));
  const commonDates = Array.from(dateSets[0]).filter(d => dateSets.every(ds => ds.has(d))).sort();

  const aligned: Record<string, number[]> = {};
  for (const sym of symbols) {
    const dateMap = new Map(seriesMap[sym].map(p => [p.date, p.value]));
    aligned[sym] = commonDates.map(d => dateMap.get(d) ?? 0);
  }
  return aligned;
}

// ─── 标的元数据 ───────────────────────────────────────────────────────────────
const TICKER_LABELS: Record<string, string> = {
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet', 'AMZN': 'Amazon',
  'NVDA': 'NVIDIA', 'META': 'Meta', 'TSLA': 'Tesla',
  '^IRX': 'US 3M T-Bill', '^FVX': 'US 5Y Treasury', '^TNX': 'US 10Y Treasury', '^TYX': 'US 30Y Treasury',
  'TLT': 'iShares 20Y+', 'IEF': 'iShares 7-10Y', 'SHY': 'iShares 1-3Y',
  '^GSPC': 'S&P 500', '^DJI': 'Dow Jones', '^IXIC': 'NASDAQ', '^FTSE': 'FTSE 100',
  '^N225': 'Nikkei 225', '^HSI': 'Hang Seng', '000001.SS': '上证指数',
  'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'USDJPY=X': 'USD/JPY',
  'AUDUSD=X': 'AUD/USD', 'USDCAD=X': 'USD/CAD', 'USDCHF=X': 'USD/CHF', 'NZDUSD=X': 'NZD/USD',
  'GC=F': 'Gold', 'SI=F': 'Silver', 'CL=F': 'WTI Crude', 'NG=F': 'Nat Gas',
  'HG=F': 'Copper', 'ZW=F': 'Wheat', 'ZC=F': 'Corn',
  'BTC-USD': 'Bitcoin', '399001.SZ': '深证成指', '2318.HK': '中国平安',
  '0700.HK': '腾讯控股', 'BABA': '阿里巴巴', 'PDD': '拼多多',
  'PFF': 'iShares 优先股 ETF', 'PGX': 'Invesco 优先股 ETF', 'PGF': 'Invesco 金融优先股',
  'PFFD': 'Global X 优先股 ETF', 'PFFA': 'Virtus 优先股杠杆 ETF', 'FPE': 'First Trust 优先股',
  'VRP': 'Invesco 浮息优先股', 'BAC-PB': '美国银行优先股 B', 'JPM-PD': '摩根大通优先股 D',
  'KRE': 'SPDR 区域银行 ETF',
};

export const corrRouter = router({
  // ── 1. 获取预设分组列表 ────────────────────────────────────────────────────
  getPresets: publicProcedure.query(() => {
    return Object.entries(CORR_PRESETS).map(([id, p]) => ({
      id,
      label: p.label,
      tickers: p.tickers,
    }));
  }),

  // ── 2. 计算相关系数矩阵（核心接口） ────────────────────────────────────────
  computeMatrix: publicProcedure
    .input(z.object({
      tickers: z.array(z.string().min(1).max(20)).min(2).max(15),
      range: z.enum(['1mo', '3mo', '6mo', '1y', '2y', '5y']).default('1y'),
      calcType: z.enum(['correlation', 'covariance', 'beta']).default('correlation'),
      returnType: z.enum(['log', 'simple']).default('log'),
    }))
    .query(async ({ input }) => {
      const { tickers, range, calcType, returnType } = input;

      // 1. 批量拉取 Yahoo Finance 历史数据
      const rawData = await fetchMultipleYahoo(tickers, range as '1mo' | '3mo' | '6mo' | '1y');

      // 2. 提取历史价格序列
      const priceSeriesMap: Record<string, { date: string; value: number }[]> = {};
      const latestPrices: Record<string, { price: number; change: number; changePct: number; currency: string }> = {};
      const failedTickers: string[] = [];

      for (const ticker of tickers) {
        const data = rawData[ticker];
        if (!data || !data.history || data.history.length < 5) {
          failedTickers.push(ticker);
          continue;
        }
        priceSeriesMap[ticker] = data.history;
        latestPrices[ticker] = {
          price: data.price,
          change: data.change,
          changePct: data.changePct,
          currency: data.currency,
        };
      }

      const availableTickers = tickers.filter(t => !failedTickers.includes(t));
      if (availableTickers.length < 2) {
        return {
          success: false,
          error: `数据不足：只有 ${availableTickers.length} 个标的有效，至少需要 2 个`,
          matrix: [],
          tickers: [],
          latestPrices: {},
          failedTickers,
          dataPoints: 0,
          range,
          calcType,
        };
      }

      // 3. 对齐时间序列
      const aligned = alignSeries(priceSeriesMap);
      const dataPoints = Object.values(aligned)[0]?.length ?? 0;

      // 4. 计算收益率
      const returnsMap: Record<string, number[]> = {};
      for (const ticker of availableTickers) {
        const prices = aligned[ticker];
        returnsMap[ticker] = returnType === 'log'
          ? logReturns(prices)
          : prices.slice(1).map((p, i) => prices[i] > 0 ? (p - prices[i]) / prices[i] : 0);
      }

      // 5. 构建矩阵
      const matrix: {
        row: string;
        rowLabel: string;
        cols: { col: string; colLabel: string; value: number }[];
        annualizedVol: number;
        sharpe: number;
      }[] = [];

      const benchmarkTicker = availableTickers[0];
      const benchmarkReturns = returnsMap[benchmarkTicker];

      for (const rowTicker of availableTickers) {
        const rowReturns = returnsMap[rowTicker];
        const cols = availableTickers.map(colTicker => {
          const colReturns = returnsMap[colTicker];
          let value: number;
          if (calcType === 'correlation') {
            value = pearson(rowReturns, colReturns);
          } else if (calcType === 'covariance') {
            value = covariance(rowReturns, colReturns);
          } else {
            // beta: row asset vs benchmark (first ticker)
            value = rowTicker === benchmarkTicker ? 1.0 : beta(rowReturns, benchmarkReturns);
          }
          return {
            col: colTicker,
            colLabel: TICKER_LABELS[colTicker] ?? colTicker,
            value,
          };
        });

        // 年化波动率
        const variance = covariance(rowReturns, rowReturns);
        const annualizedVol = parseFloat((Math.sqrt(variance * 252) * 100).toFixed(2));

        // 简化 Sharpe（假设无风险利率 5%）
        const avgReturn = rowReturns.reduce((a, b) => a + b, 0) / rowReturns.length;
        const annualizedReturn = avgReturn * 252 * 100;
        const sharpe = annualizedVol > 0
          ? parseFloat(((annualizedReturn - 5) / annualizedVol).toFixed(3))
          : 0;

        matrix.push({
          row: rowTicker,
          rowLabel: TICKER_LABELS[rowTicker] ?? rowTicker,
          cols,
          annualizedVol,
          sharpe,
        });
      }

      return {
        success: true,
        matrix,
        tickers: availableTickers,
        latestPrices,
        failedTickers,
        dataPoints,
        range,
        calcType,
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 3. 获取单个标的历史收益率（用于散点图） ────────────────────────────────
  getScatterData: publicProcedure
    .input(z.object({
      tickerX: z.string(),
      tickerY: z.string(),
      range: z.enum(['1mo', '3mo', '6mo', '1y', '2y']).default('1y'),
    }))
    .query(async ({ input }) => {
      const { tickerX, tickerY, range } = input;
      const rawData = await fetchMultipleYahoo([tickerX, tickerY], range as '1mo' | '3mo' | '6mo' | '1y');

      const dataX = rawData[tickerX];
      const dataY = rawData[tickerY];
      if (!dataX?.history || !dataY?.history) {
        return { success: false, points: [], correlation: 0 };
      }

      const aligned = alignSeries({ [tickerX]: dataX.history, [tickerY]: dataY.history });
      const xPrices = aligned[tickerX] ?? [];
      const yPrices = aligned[tickerY] ?? [];
      const xReturns = logReturns(xPrices);
      const yReturns = logReturns(yPrices);
      const n = Math.min(xReturns.length, yReturns.length);

      const points = Array.from({ length: n }, (_, i) => ({
        x: parseFloat((xReturns[i] * 100).toFixed(4)),
        y: parseFloat((yReturns[i] * 100).toFixed(4)),
      }));

      const corr = pearson(xReturns, yReturns);

      return {
        success: true,
        points,
        correlation: corr,
        labelX: TICKER_LABELS[tickerX] ?? tickerX,
        labelY: TICKER_LABELS[tickerY] ?? tickerY,
      };
    }),

  // ── 4. 搜索标的（支持自定义输入） ──────────────────────────────────────────
  searchTicker: publicProcedure
    .input(z.object({ query: z.string().min(1).max(20) }))
    .query(async ({ input }) => {
      // 返回预设标的中匹配的结果
      const q = input.query.toUpperCase();
      const allTickers = Object.values(CORR_PRESETS).flatMap(p => p.tickers);
      const unique = Array.from(new Set(allTickers));
      const matched = unique
        .filter(t => t.toUpperCase().includes(q) || (TICKER_LABELS[t] ?? '').toUpperCase().includes(q))
        .slice(0, 10)
        .map(t => ({ ticker: t, label: TICKER_LABELS[t] ?? t }));
      return matched;
    }),

  // ── 5. 滚动相关性时间序列（CORR 招牌功能之一） ──────────────────────────────
  rollingCorrelation: publicProcedure
    .input(z.object({
      tickerA: z.string().min(1).max(20),
      tickerB: z.string().min(1).max(20),
      range: z.enum(['6mo', '1y', '2y']).default('1y'),
      window: z.number().int().min(10).max(120).default(60),
    }))
    .query(async ({ input }) => {
      const { tickerA, tickerB, range, window } = input;
      const raw = await fetchMultipleYahoo([tickerA, tickerB], range as '6mo' | '1y');
      const a = raw[tickerA];
      const b = raw[tickerB];
      if (!a?.history || !b?.history) {
        return { success: false, series: [], avg: 0, min: 0, max: 0, latest: 0 };
      }
      const aligned = alignSeries({ [tickerA]: a.history, [tickerB]: b.history });
      const ra = logReturns(aligned[tickerA] ?? []);
      const rb = logReturns(aligned[tickerB] ?? []);
      const dates = (() => {
        // 重新取交集日期（与 returns 对齐，跳过首日）
        const setA = new Set(a.history.map(p => p.date));
        const common = b.history.map(p => p.date).filter(d => setA.has(d)).sort();
        return common.slice(1);
      })();
      const n = Math.min(ra.length, rb.length);
      const series: { date: string; value: number }[] = [];
      for (let i = window; i <= n; i++) {
        const corr = pearson(ra.slice(i - window, i), rb.slice(i - window, i));
        series.push({ date: dates[i - 1] ?? String(i), value: corr });
      }
      const vals = series.map(s => s.value);
      const avg = vals.length ? parseFloat((vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(4)) : 0;
      return {
        success: series.length > 0,
        series,
        avg,
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
        latest: vals.length ? vals[vals.length - 1] : 0,
        labelA: TICKER_LABELS[tickerA] ?? tickerA,
        labelB: TICKER_LABELS[tickerB] ?? tickerB,
        window,
      };
    }),

  // ── 6. 配对交易信号（价差 Z-Score） ───────────────────────────────────
  pairSignal: publicProcedure
    .input(z.object({
      tickerA: z.string().min(1).max(20),
      tickerB: z.string().min(1).max(20),
      range: z.enum(['6mo', '1y', '2y']).default('1y'),
      entryZ: z.number().min(1).max(4).default(2),
    }))
    .query(async ({ input }) => {
      const { tickerA, tickerB, range, entryZ } = input;
      const raw = await fetchMultipleYahoo([tickerA, tickerB], range as '6mo' | '1y');
      const a = raw[tickerA];
      const b = raw[tickerB];
      if (!a?.history || !b?.history) {
        return { success: false } as const;
      }
      const aligned = alignSeries({ [tickerA]: a.history, [tickerB]: b.history });
      const pa = aligned[tickerA] ?? [];
      const pb = aligned[tickerB] ?? [];
      const n = Math.min(pa.length, pb.length);
      if (n < 30) return { success: false } as const;
      // 价格比作为价差序列
      const ratio: number[] = [];
      for (let i = 0; i < n; i++) { if (pb[i] > 0) ratio.push(pa[i] / pb[i]); }
      const mean = ratio.reduce((x, y) => x + y, 0) / ratio.length;
      const sd = Math.sqrt(ratio.reduce((s, v) => s + (v - mean) ** 2, 0) / ratio.length);
      const latestRatio = ratio[ratio.length - 1];
      const z = sd > 0 ? parseFloat(((latestRatio - mean) / sd).toFixed(3)) : 0;
      const corr = pearson(logReturns(pa), logReturns(pb));
      let signal: 'long_a_short_b' | 'short_a_long_b' | 'neutral';
      let action: string;
      if (z >= entryZ) { signal = 'short_a_long_b'; action = `做空 ${tickerA} / 做多 ${tickerB}（价差偏高，预期回归）`; }
      else if (z <= -entryZ) { signal = 'long_a_short_b'; action = `做多 ${tickerA} / 做空 ${tickerB}（价差偏低，预期回归）`; }
      else { signal = 'neutral'; action = '价差在正常区间，暂无入场信号'; }
      const ratioSeries = ratio.map((v, i) => ({
        idx: i,
        ratio: parseFloat(v.toFixed(4)),
        z: sd > 0 ? parseFloat(((v - mean) / sd).toFixed(3)) : 0,
      }));
      return {
        success: true as const,
        z, corr, signal, action, mean: parseFloat(mean.toFixed(4)), sd: parseFloat(sd.toFixed(4)),
        latestRatio: parseFloat(latestRatio.toFixed(4)),
        entryZ,
        labelA: TICKER_LABELS[tickerA] ?? tickerA,
        labelB: TICKER_LABELS[tickerB] ?? tickerB,
        ratioSeries: ratioSeries.slice(-180),
      };
    }),

  // ── 7. 最小方差组合 + 分散化评分 ───────────────────────────────────
  minVariancePortfolio: publicProcedure
    .input(z.object({
      tickers: z.array(z.string().min(1).max(20)).min(2).max(8),
      range: z.enum(['6mo', '1y', '2y']).default('1y'),
    }))
    .query(async ({ input }) => {
      const { tickers, range } = input;
      const raw = await fetchMultipleYahoo(tickers, range as '6mo' | '1y');
      const seriesMap: Record<string, { date: string; value: number }[]> = {};
      const valid: string[] = [];
      for (const t of tickers) {
        if (raw[t]?.history && raw[t]!.history.length >= 30) { seriesMap[t] = raw[t]!.history; valid.push(t); }
      }
      if (valid.length < 2) return { success: false, weights: [], diversificationScore: 0, avgCorr: 0, portfolioVol: 0 };
      const aligned = alignSeries(seriesMap);
      const returnsMap: Record<string, number[]> = {};
      for (const t of valid) returnsMap[t] = logReturns(aligned[t]);
      // 协方差矩阵
      const k = valid.length;
      const cov: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) cov[i][j] = covariance(returnsMap[valid[i]], returnsMap[valid[j]]);
      // 逆方差加权（最小方差的稳健近似）
      const invVar = valid.map((_, i) => (cov[i][i] > 0 ? 1 / cov[i][i] : 0));
      const sumInv = invVar.reduce((a, b) => a + b, 0);
      const weights = valid.map((t, i) => ({
        ticker: t,
        label: TICKER_LABELS[t] ?? t,
        weight: sumInv > 0 ? parseFloat((invVar[i] / sumInv).toFixed(4)) : parseFloat((1 / k).toFixed(4)),
        annualVol: parseFloat((Math.sqrt(cov[i][i] * 252) * 100).toFixed(2)),
      }));
      // 组合波动率
      let pv = 0;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) pv += weights[i].weight * weights[j].weight * cov[i][j];
      const portfolioVol = parseFloat((Math.sqrt(pv * 252) * 100).toFixed(2));
      // 平均相关系数
      let cs = 0, cnt = 0;
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) { cs += pearson(returnsMap[valid[i]], returnsMap[valid[j]]); cnt++; }
      const avgCorr = cnt > 0 ? parseFloat((cs / cnt).toFixed(4)) : 0;
      // 分散化评分：相关系数越低越高（0~100）
      const diversificationScore = parseFloat((Math.max(0, Math.min(100, (1 - avgCorr) * 100)) ).toFixed(1));
      return { success: true, weights, diversificationScore, avgCorr, portfolioVol, range };
    }),
});
