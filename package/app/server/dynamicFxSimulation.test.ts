import { describe, expect, it } from 'vitest';
import { buildDynamicSimulationSeries, calculateBollingerBands, calculateKdj, calculateMacd, calculateRsi, dynamicTimeframeLabel } from '../client/src/lib/dynamicFxSimulation';

describe('dynamic FX simulation', () => {
  it('creates deterministic intraminute points for the same tick and moves the terminal point when the tick advances', () => {
    const now = Date.UTC(2026, 7, 27, 0, 0, 0);
    const first = buildDynamicSimulationSeries('EUR/USD', 1.08, 0.004, '1m', 10, now);
    const repeated = buildDynamicSimulationSeries('EUR/USD', 1.08, 0.004, '1m', 10, now);
    const advanced = buildDynamicSimulationSeries('EUR/USD', 1.08, 0.004, '1m', 11, now);
    expect(first).toEqual(repeated);
    expect(first).toHaveLength(60);
    expect(first.at(-1)?.value).not.toBe(advanced.at(-1)?.value);
    expect(dynamicTimeframeLabel('1s')).toBe('1 秒');
    expect(dynamicTimeframeLabel('1Y')).toBe('1 年');
  });

  it('produces bounded RSI values and aligned MACD values for a dynamic path', () => {
    const values = buildDynamicSimulationSeries('USD/JPY', 149.8, 0.002, '1h', 4, Date.UTC(2026, 7, 27)).map((point) => point.value);
    const rsi = calculateRsi(values);
    const macd = calculateMacd(values);
    expect(rsi.filter((value): value is number => value != null).every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(macd).toHaveLength(values.length);
    expect(macd.at(-1)?.macd).not.toBeNull();
  });

  it('calculates aligned Bollinger Bands and KDJ values for long and short simulated windows', () => {
    const values = buildDynamicSimulationSeries('GBP/USD', 1.26, 0.004, '1Y', 8, Date.UTC(2026, 7, 27)).map((point) => point.value);
    const bands = calculateBollingerBands(values, 8);
    const kdj = calculateKdj(values, 6);
    const lastBand = bands.at(-1);
    expect(lastBand?.upper).not.toBeNull();
    expect(lastBand!.upper!).toBeGreaterThan(lastBand!.middle!);
    expect(lastBand!.middle!).toBeGreaterThan(lastBand!.lower!);
    expect(kdj.at(-1)?.k).not.toBeNull();
    expect(kdj.at(-1)?.d).not.toBeNull();
    expect(kdj.at(-1)?.j).not.toBeNull();
  });
});
