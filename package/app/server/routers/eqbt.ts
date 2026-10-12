/**
 * EQBT Router — 股票回溯测试
 *
 * getHistoricalPrices:  获取同源真实历史价格（缺失时不生成价格）
 * runBacktest:          执行策略回测（均线交叉/RSI/MACD/布林带/KDJ/海龟），返回收益曲线、绩效指标
 * gridSearch:           策略参数网格搜索优化，返回热力图数据
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchPublicTicker } from '../stockTickerObservation';

// ─── Types ────────────────────────────────────────────────────────────────────

type PricePoint = { date: string; close: number };

type BacktestResult = {
  ticker: string;
  strategy: string;
  params: Record<string, number>;
  range: string;
  equityCurve: Array<{ date: string; portfolio: number; benchmark: number }>;
  trades: Array<{
    date: string;
    type: 'buy' | 'sell';
    price: number;
    shares: number;
    pnl: number | null;
  }>;
  metrics: {
    totalReturn: number;
    benchmarkReturn: number;
    alpha: number;
    sharpe: number;
    maxDrawdown: number;
    winRate: number;
    numTrades: number;
    annualizedReturn: number;
    volatility: number;
    calmarRatio: number;
  };
};

type GridSearchResult = {
  param1Label: string;
  param2Label: string;
  param1Values: number[];
  param2Values: number[];
  heatmap: Array<{ p1: number; p2: number; sharpe: number; totalReturn: number; maxDrawdown: number }>;
  best: { params: Record<string, number>; sharpe: number; totalReturn: number };
};

// ─── Indicators ───────────────────────────────────────────────────────────────

function sma(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function ema(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(prices.length).fill(null);
  let prev: number | null = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result[i] = null; continue; }
    if (i === period - 1) {
      prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result[i] = prev;
      continue;
    }
    prev = prices[i] * k + (prev ?? prices[i]) * (1 - k);
    result[i] = prev;
  }
  return result;
}

function rsi(prices: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function macd(prices: number[], fast = 12, slow = 26, signal = 9): {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEma = ema(prices, fast);
  const slowEma = ema(prices, slow);
  const macdLine: (number | null)[] = prices.map((_, i) => {
    const f = fastEma[i], s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });
  const macdValues = macdLine.filter((v): v is number => v !== null);
  const signalEmaRaw = ema(macdValues, signal);
  const signalLine: (number | null)[] = new Array(prices.length).fill(null);
  let macdIdx = 0;
  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] !== null) {
      signalLine[i] = signalEmaRaw[macdIdx] ?? null;
      macdIdx++;
    }
  }
  const histogram: (number | null)[] = prices.map((_, i) => {
    const m = macdLine[i], s = signalLine[i];
    return m !== null && s !== null ? m - s : null;
  });
  return { macdLine, signalLine, histogram };
}

/**
 * KDJ 随机指标（使用收盘价近似 high/low）
 */
function kdj(
  closes: number[],
  period = 9,
  signalK = 3,
  signalD = 3
): { k: (number | null)[]; d: (number | null)[]; j: (number | null)[] } {
  const n = closes.length;
  const k: (number | null)[] = new Array(n).fill(null);
  const d: (number | null)[] = new Array(n).fill(null);
  const j: (number | null)[] = new Array(n).fill(null);
  let prevK = 50, prevD = 50;
  for (let i = period - 1; i < n; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const hh = Math.max(...slice);
    const ll = Math.min(...slice);
    const rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    const kv = (2 / signalK) * rsv + ((signalK - 2) / signalK) * prevK;
    const dv = (2 / signalD) * kv + ((signalD - 2) / signalD) * prevD;
    const jv = 3 * kv - 2 * dv;
    k[i] = parseFloat(kv.toFixed(2));
    d[i] = parseFloat(dv.toFixed(2));
    j[i] = parseFloat(jv.toFixed(2));
    prevK = kv;
    prevD = dv;
  }
  return { k, d, j };
}

// ─── Backtest Engine ──────────────────────────────────────────────────────────

export function runStrategy(
  prices: PricePoint[],
  strategy: string,
  params: Record<string, number>,
  initialCapital = 100000
): Omit<BacktestResult, 'ticker' | 'range'> {
  const closes = prices.map(p => p.close);
  const dates = prices.map(p => p.date);
  const n = closes.length;

  // 生成信号序列（1=持有，0=空仓）
  const signals: (1 | 0)[] = new Array(n).fill(0);

  if (strategy === 'sma_cross') {
    const fast = Math.round(params.fast ?? 10);
    const slow = Math.round(params.slow ?? 30);
    const fastSma = sma(closes, fast);
    const slowSma = sma(closes, slow);
    let position = 0;
    for (let i = 1; i < n; i++) {
      const f = fastSma[i], s = slowSma[i];
      const fp = fastSma[i - 1], sp = slowSma[i - 1];
      if (f !== null && s !== null && fp !== null && sp !== null) {
        if (fp <= sp && f > s) position = 1;
        if (fp >= sp && f < s) position = 0;
      }
      signals[i] = position as 1 | 0;
    }
  } else if (strategy === 'rsi') {
    const period = Math.round(params.period ?? 14);
    const oversold = params.oversold ?? 30;
    const overbought = params.overbought ?? 70;
    const rsiValues = rsi(closes, period);
    let position = 0;
    for (let i = 1; i < n; i++) {
      const r = rsiValues[i], rp = rsiValues[i - 1];
      if (r !== null && rp !== null) {
        if (rp <= oversold && r > oversold) position = 1;
        if (rp >= overbought && r < overbought) position = 0;
      }
      signals[i] = position as 1 | 0;
    }
  } else if (strategy === 'macd') {
    const fast = Math.round(params.fast ?? 12);
    const slow = Math.round(params.slow ?? 26);
    const signal = Math.round(params.signal ?? 9);
    const { macdLine, signalLine } = macd(closes, fast, slow, signal);
    let position = 0;
    for (let i = 1; i < n; i++) {
      const m = macdLine[i], s = signalLine[i];
      const mp = macdLine[i - 1], sp = signalLine[i - 1];
      if (m !== null && s !== null && mp !== null && sp !== null) {
        if (mp <= sp && m > s) position = 1;
        if (mp >= sp && m < s) position = 0;
      }
      signals[i] = position as 1 | 0;
    }
  } else if (strategy === 'bollinger') {
    const period = Math.round(params.period ?? 20);
    const stdMult = params.stdMult ?? 2;
    const smaBands = sma(closes, period);
    let position = 0;
    for (let i = period; i < n; i++) {
      const mid = smaBands[i];
      if (mid === null) continue;
      const slice = closes.slice(i - period + 1, i + 1);
      const variance = slice.reduce((acc, v) => acc + (v - mid) ** 2, 0) / period;
      const std = Math.sqrt(variance);
      const upper = mid + stdMult * std;
      const lower = mid - stdMult * std;
      if (closes[i - 1] <= lower && closes[i] > lower) position = 1;
      if (closes[i - 1] >= upper && closes[i] < upper) position = 0;
      signals[i] = position as 1 | 0;
    }
  } else if (strategy === 'kdj') {
    // KDJ 策略：K 线上穿 D 线且 J < oversold+20 买入；K 线下穿 D 线且 J > overbought-20 卖出
    const kdjPeriod = Math.round(params.period ?? 9);
    const oversold = params.oversold ?? 20;
    const overbought = params.overbought ?? 80;
    const { k: kLine, d: dLine, j: jLine } = kdj(closes, kdjPeriod);
    let position = 0;
    for (let i = 1; i < n; i++) {
      const kp = kLine[i - 1], kc = kLine[i];
      const dp = dLine[i - 1], dc = dLine[i];
      const jc = jLine[i];
      if (kp === null || kc === null || dp === null || dc === null || jc === null) continue;
      // 金叉 + J 超卖区买入
      if (kp < dp && kc >= dc && jc < oversold + 20) position = 1;
      // 死叉 + J 超买区卖出
      if (kp > dp && kc <= dc && jc > overbought - 20) position = 0;
      signals[i] = position as 1 | 0;
    }
  } else if (strategy === 'turtle') {
    // 海龟交易策略：唐奇安通道突破（N 日最高价突破买入，M 日最低价跌破卖出）
    const entryPeriod = Math.round(params.entryPeriod ?? 20);
    const exitPeriod = Math.round(params.exitPeriod ?? 10);
    let position = 0;
    for (let i = Math.max(entryPeriod, exitPeriod); i < n; i++) {
      const entryHigh = Math.max(...closes.slice(i - entryPeriod, i));
      const exitLow = Math.min(...closes.slice(i - exitPeriod, i));
      if (position === 0 && closes[i] > entryHigh) position = 1; // 突破入场
      if (position === 1 && closes[i] < exitLow) position = 0;   // 跌破出场
      signals[i] = position as 1 | 0;
    }
  }

  // 在真实历史观察上回放透明的持仓状态；不生成或提交真实订单。
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  const trades: BacktestResult['trades'] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];

  const benchmarkShares = initialCapital / closes[0];

  for (let i = 0; i < n; i++) {
    const price = closes[i];
    // A signal requiring today's close executes only on the next observation.
    const sig = i > 0 ? signals[i - 1] : 0;
    const prevSig = i > 1 ? signals[i - 2] : 0;

    // 买入信号
    if (sig === 1 && prevSig === 0 && cash > 0) {
      shares = Math.floor(cash / price);
      if (shares > 0) {
        cash -= shares * price;
        entryPrice = price;
        trades.push({ date: dates[i], type: 'buy', price, shares, pnl: null });
      }
    }
    // 卖出信号
    if (sig === 0 && prevSig === 1 && shares > 0) {
      const proceeds = shares * price;
      const pnl = proceeds - shares * entryPrice;
      cash += proceeds;
      trades.push({ date: dates[i], type: 'sell', price, shares, pnl });
      shares = 0;
      entryPrice = 0;
    }

    const portfolioValue = cash + shares * price;
    const benchmarkValue = benchmarkShares * price;
    equityCurve.push({
      date: dates[i],
      portfolio: parseFloat(portfolioValue.toFixed(2)),
      benchmark: parseFloat(benchmarkValue.toFixed(2)),
    });
  }

  // 计算绩效指标
  const finalPortfolio = equityCurve[equityCurve.length - 1]?.portfolio ?? initialCapital;
  const finalBenchmark = equityCurve[equityCurve.length - 1]?.benchmark ?? initialCapital;
  const totalReturn = (finalPortfolio - initialCapital) / initialCapital * 100;
  const benchmarkReturn = (finalBenchmark - initialCapital) / initialCapital * 100;
  const alpha = totalReturn - benchmarkReturn;

  // 最大回撤
  let peak = initialCapital;
  let maxDrawdown = 0;
  for (const p of equityCurve) {
    if (p.portfolio > peak) peak = p.portfolio;
    const dd = (peak - p.portfolio) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // 日收益率序列
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].portfolio;
    const curr = equityCurve[i].portfolio;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }

  // 年化收益率（假设 252 交易日）
  const tradingDays = Math.max(0, equityCurve.length - 1);
  const annualizedReturn = tradingDays > 0
    ? (Math.pow(finalPortfolio / initialCapital, 252 / tradingDays) - 1) * 100
    : 0;

  // 波动率（年化）
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const variance = dailyReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / (dailyReturns.length || 1);
  const volatility = Math.sqrt(variance * 252) * 100;

  // 当前没有统一可验证的同币种无风险利率输入，因此输出零利率基准下的
  // 年化收益/波动率，前端必须明确这一计算边界。
  const sharpe = volatility > 0
    ? (annualizedReturn / 100) / (volatility / 100)
    : 0;

  // 卡玛比率
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  // 胜率
  const sellTrades = trades.filter(t => t.type === 'sell' && t.pnl !== null);
  const winTrades = sellTrades.filter(t => (t.pnl ?? 0) > 0);
  const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

  return {
    strategy,
    params,
    equityCurve,
    trades,
    metrics: {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      benchmarkReturn: parseFloat(benchmarkReturn.toFixed(2)),
      alpha: parseFloat(alpha.toFixed(2)),
      sharpe: parseFloat(sharpe.toFixed(3)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      numTrades: sellTrades.length,
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      calmarRatio: parseFloat(calmarRatio.toFixed(3)),
    },
  };
}

// ─── Grid Search ──────────────────────────────────────────────────────────────

function gridSearchStrategy(
  prices: PricePoint[],
  strategy: string,
  param1: { key: string; values: number[] },
  param2: { key: string; values: number[] },
  initialCapital: number
): GridSearchResult {
  const heatmap: GridSearchResult['heatmap'] = [];
  let best = { params: {} as Record<string, number>, sharpe: -Infinity, totalReturn: -Infinity };

  for (const p1 of param1.values) {
    for (const p2 of param2.values) {
      const params = { [param1.key]: p1, [param2.key]: p2 };
      try {
        const r = runStrategy(prices, strategy, params, initialCapital);
        heatmap.push({
          p1, p2,
          sharpe: r.metrics.sharpe,
          totalReturn: r.metrics.totalReturn,
          maxDrawdown: r.metrics.maxDrawdown,
        });
        if (r.metrics.sharpe > best.sharpe) {
          best = { params, sharpe: r.metrics.sharpe, totalReturn: r.metrics.totalReturn };
        }
      } catch {
        // 失败参数组合不写入零值，避免把计算失败误呈现为零收益或零风险。
      }
    }
  }

  return {
    param1Label: param1.key,
    param2Label: param2.key,
    param1Values: param1.values,
    param2Values: param2.values,
    heatmap,
    best,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const eqbtRouter = router({
  /**
   * 获取真实历史价格（Yahoo Finance；缺失时明确返回空状态）
   */
  getHistoricalPrices: publicProcedure
    .input(z.object({
      ticker: z.string().min(1).max(15),
      range: z.enum(['1mo', '3mo', '6mo', '1y', '2y', '5y']).default('1y'),
    }))
    .query(async ({ input }) => {
      const result = await fetchPublicTicker(input.ticker.toUpperCase(), input.range, 'stocks');
      if (!result) return { ticker: input.ticker, price: null, change: null, changePct: null, currency: null, history: [], available: false, limitation: '公开历史行情当前不可用；系统未以合成价格替代。' };
      return {
        ticker: input.ticker,
        price: result.history.at(-1)!.value,
        change: result.history.length > 1 ? result.history.at(-1)!.value - result.history.at(-2)!.value : null,
        changePct: result.history.length > 1 ? (result.history.at(-1)!.value / result.history.at(-2)!.value - 1) * 100 : null,
        currency: result.currency,
        history: result.history,
        available: true,
        source: result.source,
        observationDate: result.history.at(-1)!.date,
        retrievedAt: String(result.meta.retrievedAt),
        realtime: false,
      };
    }),

  /**
   * 执行策略回测（支持 sma_cross / rsi / macd / bollinger / kdj / turtle）
   */
  runBacktest: publicProcedure
    .input(z.object({
      ticker: z.string().min(1).max(15),
      range: z.enum(['3mo', '6mo', '1y', '2y', '5y']).default('1y'),
      strategy: z.enum(['sma_cross', 'rsi', 'macd', 'bollinger', 'kdj', 'turtle']).default('sma_cross'),
      params: z.record(z.string(), z.number()).default({}),
      initialCapital: z.number().min(1000).max(10000000).default(100000),
    }))
    .mutation(async ({ input }): Promise<BacktestResult> => {
      const result = await fetchPublicTicker(input.ticker.toUpperCase(), input.range, 'stocks');
      if (!result) throw new Error('公开历史行情当前不可用，系统不会以合成价格替代进行回测');
      const prices: PricePoint[] = result.history.map(h => ({ date: h.date, close: h.value }));

      if (prices.length < 30) {
        throw new Error(`历史数据不足（仅 ${prices.length} 条），无法进行回测`);
      }

      const backtestData = runStrategy(prices, input.strategy, input.params, input.initialCapital);

      return {
        ticker: input.ticker,
        range: input.range,
        ...backtestData,
      };
    }),

  /**
   * 策略参数网格搜索优化
   * 对两个参数的笛卡尔积进行回测，返回热力图数据（夏普比率/总收益/最大回撤）
   */
  gridSearch: publicProcedure
    .input(z.object({
      ticker: z.string().min(1).max(15),
      range: z.enum(['3mo', '6mo', '1y', '2y', '5y']).default('1y'),
      strategy: z.enum(['sma_cross', 'rsi', 'macd', 'bollinger', 'kdj', 'turtle']).default('sma_cross'),
      param1: z.object({
        key: z.string(),
        values: z.array(z.number()).min(2).max(10),
      }),
      param2: z.object({
        key: z.string(),
        values: z.array(z.number()).min(2).max(10),
      }),
      initialCapital: z.number().min(1000).max(10000000).default(100000),
    }))
    .mutation(async ({ input }): Promise<GridSearchResult> => {
      const result = await fetchPublicTicker(input.ticker.toUpperCase(), input.range, 'stocks');
      if (!result) throw new Error('公开历史行情当前不可用，系统不会以合成价格替代进行网格搜索');
      const prices: PricePoint[] = result.history.map(h => ({ date: h.date, close: h.value }));

      if (prices.length < 30) {
        throw new Error(`历史数据不足（仅 ${prices.length} 条），无法进行网格搜索`);
      }

      return gridSearchStrategy(prices, input.strategy, input.param1, input.param2, input.initialCapital);
    }),
});
