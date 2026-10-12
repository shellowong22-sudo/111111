import { describe, expect, it } from 'vitest';
import { parseNasdaqPublicSnapshot } from './nasdaqPublicSnapshot';

const payload = (data: Record<string, unknown> = {}) => ({ data: { symbol: 'COMP', primaryData: {
  lastSalePrice: '27,122.09', netChange: '+599.54', percentageChange: '+2.26%',
  lastTradeTimestamp: 'Sep 21, 2026', isRealTime: true, ...data,
} } });
describe('public quote validation', () => {
  const now = new Date('2026-09-22T08:00:00Z');
  it('preserves the actual observation date, and never upgrades a daily quote to realtime', () => {
    expect(parseNasdaqPublicSnapshot(payload(), '^IXIC', 'COMP', now)).toMatchObject({
      symbol: '^IXIC', price: 27122.09, change: 599.54, changePct: 2.26,
      observedAt: '2026-09-21', realtime: false, delayStatus: 'end_of_day', currency: null,
    });
  });
  it('rejects wrong symbols, unavailable prices and future dates', () => {
    expect(parseNasdaqPublicSnapshot(payload(), '^NDX', 'NDX', now)).toBeNull();
    expect(parseNasdaqPublicSnapshot(payload({ lastSalePrice: '--' }), '^IXIC', 'COMP', now)).toBeNull();
    expect(parseNasdaqPublicSnapshot(payload({ lastTradeTimestamp: 'Sep 24, 2026' }), '^IXIC', 'COMP', now)).toBeNull();
  });
  it('does not invent timezones for intraday observations', () => {
    expect(parseNasdaqPublicSnapshot(payload({ lastTradeTimestamp: 'Sep 21, 2026 4:00 PM' }), '^IXIC', 'COMP', now)).toBeNull();
  });
});
