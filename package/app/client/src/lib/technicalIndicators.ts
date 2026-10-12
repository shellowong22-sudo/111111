/**
 * 技术分析指标计算库
 * 支持 MA（移动平均线）、MACD、RSI（相对强弱指标）、BOLL（布林带）
 */

export interface PricePoint {
  time: string;
  price: number;
  open: number;
  high: number;
  low: number;
}

export interface MAData {
  time: string;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma50?: number;
  [key: `ma${number}`]: number | undefined;
}

export interface MACDData {
  time: string;
  macd: number;
  signal: number;
  histogram: number;
}

export interface RSIData {
  time: string;
  rsi: number | undefined;
}

export interface BOLLData {
  time: string;
  upper?: number;
  middle?: number;
  lower?: number;
}

/**
 * 计算简单移动平均线 (SMA)
 */
function sma(data: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * 计算指数移动平均线 (EMA)
 */
function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  // 第一个值使用 SMA
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i];
  }
  result.push(sum / Math.min(period, data.length));

  // 后续使用 EMA 公式
  for (let i = 1; i < data.length; i++) {
    if (i < period) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += data[j];
      result.push(s / (i + 1));
    } else {
      const prev = result[result.length - 1];
      result.push((data[i] - prev) * multiplier + prev);
    }
  }
  return result;
}

/**
 * 计算 MA 指标数据
 */
export function calculateMA(prices: PricePoint[], periods: number[] = [5, 10, 20]): MAData[] {
  const closePrices = prices.map(p => p.price);
  const maResults: Record<number, (number | undefined)[]> = {};
  for (const period of periods) {
    maResults[period] = sma(closePrices, period);
  }

  return prices.map((p, i) => {
    const row: MAData = { time: p.time };
    for (const period of periods) {
      const val = maResults[period][i];
      (row as any)[`ma${period}`] = val !== undefined ? parseFloat(val.toFixed(4)) : undefined;
    }
    return row;
  });
}

/**
 * 计算 MACD 指标
 * 标准参数：EMA12, EMA26, Signal 9
 */
export function calculateMACD(prices: PricePoint[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDData[] {
  const closePrices = prices.map(p => p.price);

  if (closePrices.length < slowPeriod) {
    return prices.map(p => ({
      time: p.time,
      macd: 0,
      signal: 0,
      histogram: 0,
    }));
  }

  const emaFast = ema(closePrices, fastPeriod);
  const emaSlow = ema(closePrices, slowPeriod);

  // DIF = EMA(fast) - EMA(slow)
  const dif: number[] = emaFast.map((v, i) => v - emaSlow[i]);

  // DEA (Signal) = EMA(signal) of DIF
  const dea = ema(dif, signalPeriod);

  // MACD Histogram = 2 * (DIF - DEA)
  return prices.map((p, i) => ({
    time: p.time,
    macd: parseFloat(dif[i].toFixed(6)),
    signal: parseFloat(dea[i].toFixed(6)),
    histogram: parseFloat(((dif[i] - dea[i]) * 2).toFixed(6)),
  }));
}

/**
 * 计算 RSI（相对强弱指标）
 * 默认周期 14
 */
export function calculateRSI(prices: PricePoint[], period: number = 14): RSIData[] {
  const closePrices = prices.map(p => p.price);
  const result: RSIData[] = [];

  if (closePrices.length < period + 1) {
    return prices.map(p => ({ time: p.time, rsi: undefined }));
  }

  // 计算价格变动
  const changes: number[] = [];
  for (let i = 1; i < closePrices.length; i++) {
    changes.push(closePrices[i] - closePrices[i - 1]);
  }

  // 第一个值无法计算
  result.push({ time: prices[0].time, rsi: undefined });

  // 初始平均涨跌幅（SMA 方式）
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // 填充前 period 个点为 undefined
  for (let i = 1; i < period; i++) {
    result.push({ time: prices[i].time, rsi: undefined });
  }

  // 第一个有效 RSI
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi0 = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs0));
  result.push({ time: prices[period].time, rsi: parseFloat(rsi0.toFixed(2)) });

  // 后续使用 Wilder 平滑法
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    result.push({ time: prices[i + 1].time, rsi: parseFloat(rsi.toFixed(2)) });
  }

  return result;
}

/**
 * 计算布林带 (BOLL)
 * 默认参数：周期 20，标准差倍数 2
 */
export function calculateBOLL(prices: PricePoint[], period: number = 20, multiplier: number = 2): BOLLData[] {
  const closePrices = prices.map(p => p.price);
  const result: BOLLData[] = [];

  for (let i = 0; i < closePrices.length; i++) {
    if (i < period - 1) {
      result.push({ time: prices[i].time, upper: undefined, middle: undefined, lower: undefined });
    } else {
      // 计算中轨（SMA）
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closePrices[j];
      }
      const middle = sum / period;

      // 计算标准差
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        variance += Math.pow(closePrices[j] - middle, 2);
      }
      const std = Math.sqrt(variance / period);

      // 上轨和下轨
      const upper = middle + multiplier * std;
      const lower = middle - multiplier * std;

      result.push({
        time: prices[i].time,
        upper: parseFloat(upper.toFixed(4)),
        middle: parseFloat(middle.toFixed(4)),
        lower: parseFloat(lower.toFixed(4)),
      });
    }
  }

  return result;
}

/**
 * 合并价格数据和 MA 数据用于图表渲染
 */
export function mergeWithMA(
  prices: PricePoint[],
  maData: MAData[]
): (PricePoint & MAData)[] {
  return prices.map((p, i) => ({
    ...p,
    ...maData[i],
  }));
}

/**
 * 根据时间周期聚合数据
 * daily: 原始数据
 * weekly: 每5个点聚合为一个
 * monthly: 每20个点聚合为一个
 */
export function aggregateByPeriod(
  prices: PricePoint[],
  period: 'daily' | 'weekly' | 'monthly'
): PricePoint[] {
  if (period === 'daily') return prices;

  const groupSize = period === 'weekly' ? 5 : 20;
  const result: PricePoint[] = [];

  for (let i = 0; i < prices.length; i += groupSize) {
    const group = prices.slice(i, Math.min(i + groupSize, prices.length));
    if (group.length === 0) continue;

    const open = group[0].open;
    const close = group[group.length - 1].price;
    const high = Math.max(...group.map(g => g.high));
    const low = Math.min(...group.map(g => g.low));

    result.push({
      time: group[group.length - 1].time,
      price: close,
      open,
      high,
      low,
    });
  }

  return result;
}
