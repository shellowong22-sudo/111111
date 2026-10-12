export type DynamicTimeframe = '1s' | '1m' | '1h' | '1d' | '1M' | '1Y';
export type DynamicPoint = { label: string; timestamp: number; value: number };

const FRAME_CONFIG: Record<DynamicTimeframe, { count: number; stepMs: number; label: string }> = {
  '1s': { count: 45, stepMs: 100, label: '1 秒' },
  '1m': { count: 60, stepMs: 1_000, label: '1 分钟' },
  '1h': { count: 60, stepMs: 60_000, label: '1 小时' },
  '1d': { count: 48, stepMs: 30 * 60_000, label: '1 天' },
  '1M': { count: 31, stepMs: 24 * 60 * 60_000, label: '1 月' },
  '1Y': { count: 12, stepMs: 30 * 24 * 60 * 60_000, label: '1 年' },
};

function seedOf(value: string) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 17);
}

function wave(index: number, seed: number) {
  return Math.sin(index * 0.41 + seed * 0.001) * 0.53 + Math.cos(index * 0.13 + seed * 0.003) * 0.29 + Math.sin(index * 0.071 + seed * 0.007) * 0.18;
}

export function dynamicTimeframeLabel(timeframe: DynamicTimeframe) {
  return FRAME_CONFIG[timeframe].label;
}

export function buildDynamicSimulationSeries(instrument: string, baseValue: number, relativeAmplitude: number, timeframe: DynamicTimeframe, tick: number, now = Date.now()): DynamicPoint[] {
  const config = FRAME_CONFIG[timeframe];
  const seed = seedOf(instrument);
  return Array.from({ length: config.count }, (_, index) => {
    const timestamp = now - (config.count - 1 - index) * config.stepMs;
    const microMove = index === config.count - 1 ? Math.sin(tick * 0.87 + seed) * relativeAmplitude * 0.16 : 0;
    const trend = (index - config.count / 2) * relativeAmplitude * 0.0008;
    const value = baseValue * (1 + wave(index, seed) * relativeAmplitude + trend + microMove);
    const date = new Date(timestamp);
    const label = timeframe === '1Y' ? `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}` : timeframe === '1M' ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}` : timeframe === '1d' ? `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}` : `${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`;
    return { label, timestamp, value: Number(value.toFixed(baseValue >= 100 ? 3 : baseValue >= 10 ? 4 : 6)) };
  });
}

function ema(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  const output: Array<number | null> = [];
  let previous: number | null = null;
  values.forEach((value, index) => {
    if (index < period - 1) { output.push(null); return; }
    if (previous === null) previous = values.slice(index - period + 1, index + 1).reduce((sum, point) => sum + point, 0) / period;
    else previous = (value - previous) * multiplier + previous;
    output.push(Number(previous.toFixed(6)));
  });
  return output;
}

export function calculateMacd(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const macd = values.map((_, index) => fast[index] == null || slow[index] == null ? null : Number((fast[index]! - slow[index]!).toFixed(6)));
  const signal = ema(macd.map((value) => value ?? 0), 9).map((value, index) => macd[index] == null ? null : value);
  return values.map((_, index) => ({ macd: macd[index], signal: signal[index], histogram: macd[index] == null || signal[index] == null ? null : Number((macd[index]! - signal[index]!).toFixed(6)) }));
}

export function calculateRsi(values: number[], period = 14) {
  return values.map((_, index) => {
    if (index < period) return null;
    const moves = values.slice(index - period + 1, index + 1).map((value, moveIndex, series) => moveIndex === 0 ? 0 : value - series[moveIndex - 1]);
    const gains = moves.map((move) => Math.max(move, 0)).reduce((sum, move) => sum + move, 0) / period;
    const losses = moves.map((move) => Math.max(-move, 0)).reduce((sum, move) => sum + move, 0) / period;
    if (losses === 0) return 100;
    return Number((100 - 100 / (1 + gains / losses)).toFixed(2));
  });
}

export function calculateBollingerBands(values: number[], period = 20, multiplier = 2) {
  return values.map((value, index) => {
    if (index < period - 1) return { middle: null, upper: null, lower: null };
    const window = values.slice(index - period + 1, index + 1);
    const middle = window.reduce((sum, point) => sum + point, 0) / period;
    const deviation = Math.sqrt(window.reduce((sum, point) => sum + (point - middle) ** 2, 0) / period);
    return { middle: Number(middle.toFixed(6)), upper: Number((middle + multiplier * deviation).toFixed(6)), lower: Number((middle - multiplier * deviation).toFixed(6)) };
  });
}

export function calculateKdj(values: number[], period = 9) {
  let k = 50;
  let d = 50;
  return values.map((value, index) => {
    if (index < period - 1) return { k: null, d: null, j: null };
    const window = values.slice(index - period + 1, index + 1);
    const low = Math.min(...window);
    const high = Math.max(...window);
    const rsv = high === low ? 50 : ((value - low) / (high - low)) * 100;
    k = (2 * k + rsv) / 3;
    d = (2 * d + k) / 3;
    return { k: Number(k.toFixed(2)), d: Number(d.toFixed(2)), j: Number((3 * k - 2 * d).toFixed(2)) };
  });
}
