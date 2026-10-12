import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runStrategy } from './routers/eqbt';

describe('EQBT execution timing', () => {
  it('executes a close-derived crossover only on the following observation', () => {
    const closes = [10, 9, 8, 12, 13, 11, 8, 7, 10, 13, 14];
    const prices = closes.map((close, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, close }));
    const result = runStrategy(prices, 'sma_cross', { fast: 2, slow: 3 }, 10000);
    expect(result.trades[0]).toMatchObject({ date: '2026-08-05', type: 'buy', price: 13 });
    expect(result.equityCurve.slice(0, 4).every(row => row.portfolio === 10000)).toBe(true);
  });
  it('preserves all execution evidence instead of truncating to 50 records', () => {
    const prices = Array.from({ length: 400 }, (_, i) => ({ date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), close: [10, 9, 8, 12, 13, 11, 8, 7, 10, 13][i % 10] }));
    const result = runStrategy(prices, 'sma_cross', { fast: 2, slow: 3 }, 10000);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(readFileSync(new URL('./routers/eqbt.ts', import.meta.url), 'utf8')).not.toContain('trades: trades.slice(-50)');
  });
});
