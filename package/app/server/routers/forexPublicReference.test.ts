import { describe, expect, it } from 'vitest';
import { buildPublicFxReading, parseFrankfurterRates } from './forexResearch';

describe('public daily FX reference adapter', () => {
  it('keeps only valid dated positive Frankfurter observations and preserves chronological history', () => {
    const history = parseFrankfurterRates([
      { date: '2026-08-26', base: 'EUR', quote: 'USD', rate: 1.17 },
      { date: 'invalid', base: 'EUR', quote: 'USD', rate: 0 },
      { date: '2026-08-25', base: 'EUR', quote: 'USD', rate: 1.16 },
    ]);
    expect(history).toEqual([{ date: '2026-08-25', value: 1.16 }, { date: '2026-08-26', value: 1.17 }]);
  });

  it('filters to the requested base/quote and removes same-day duplicates', () => {
    const history = parseFrankfurterRates([
      { date: '2026-08-25', base: 'EUR', quote: 'USD', rate: 1.16 },
      { date: '2026-08-25', base: 'EUR', quote: 'USD', rate: 1.16 },
      { date: '2026-08-25', base: 'USD', quote: 'EUR', rate: 0.86 },
      { date: '2026-08-26', base: 'EUR', quote: 'USD', rate: 1.17 },
    ], { pair: 'EUR/USD', base: 'EUR', quote: 'USD', label: '欧元 / 美元' });
    expect(history).toEqual([{ date: '2026-08-25', value: 1.16 }, { date: '2026-08-26', value: 1.17 }]);
  });

  it('drops conflicting same-day values instead of choosing an arbitrary rate', () => {
    const history = parseFrankfurterRates([
      { date: '2026-08-25', base: 'EUR', quote: 'USD', rate: 1.16 },
      { date: '2026-08-25', base: 'EUR', quote: 'USD', rate: 1.165 },
      { date: '2026-08-26', base: 'EUR', quote: 'USD', rate: 1.17 },
    ]);
    expect(history).toEqual([{ date: '2026-08-26', value: 1.17 }]);
  });

  it('computes a reference change from actual adjacent observations without inventing bid, ask, or volume', () => {
    const reading = buildPublicFxReading({ pair: 'EUR/USD', base: 'EUR', quote: 'USD', label: '欧元 / 美元' }, [{ date: '2026-08-25', value: 1.16 }, { date: '2026-08-26', value: 1.17 }]);
    expect(reading.status).toBe('available');
    expect(reading.rate).toBe(1.17);
    expect(reading.changePct).toBeCloseTo(0.8621, 4);
    expect(reading).not.toHaveProperty('bid');
    expect(reading).not.toHaveProperty('ask');
    expect(reading).not.toHaveProperty('volume');
  });

  it('keeps an empty public response unavailable and does not generate a replacement curve', () => {
    const reading = buildPublicFxReading({ pair: 'USD/THB', base: 'USD', quote: 'THB', label: '美元 / 泰铢' }, []);
    expect(reading.status).toBe('unavailable');
    expect(reading.dataMode).toBe('public_daily');
    expect(reading.history).toEqual([]);
    expect(reading.rate).toBeNull();
    expect(reading.limitation).toContain('未接入');
  });
});
