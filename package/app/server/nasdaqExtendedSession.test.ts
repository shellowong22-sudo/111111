import { describe, expect, it } from 'vitest';
import { parseNasdaqExtendedSession, parseNasdaqSessionQuote } from './nasdaqExtendedSession';

const payload = (marketStatus: string, timestamp: string, symbol = 'AAPL') => ({
  data: { symbol, marketStatus, primaryData: {
    lastSalePrice: '$331.225', netChange: '+0.905',
    percentageChange: '+0.27%', lastTradeTimestamp: timestamp, isRealTime: true,
  }, secondaryData: { lastSalePrice: '$330.32', lastTradeTimestamp: 'Closed at Oct 1, 2026 4:00 PM ET' } },
});

describe('Nasdaq extended session is a current, typed observation', () => {
  it('accepts an actual pre-market clock and converts EDT to UTC', () => {
    expect(parseNasdaqExtendedSession(payload('Pre-Market', 'Oct 2, 2026 4:26 AM ET'), 'AAPL', new Date('2026-10-02T08:30:00Z'))).toMatchObject({
      symbol: 'AAPL', session: 'pre_market', price: 331.225,
      change: 0.905, changePct: 0.27, observedAt: '2026-10-02T08:26:00.000Z',
      providerRealtime: true,
    });
  });

  it('accepts after-hours only inside the exchange session, including EST', () => {
    expect(parseNasdaqExtendedSession(payload('After-Hours', 'Nov 2, 2026 4:10 PM ET'), 'AAPL', new Date('2026-11-02T21:15:00Z'))).toMatchObject({
      session: 'after_hours', observedAt: '2026-11-02T21:10:00.000Z',
    });
  });

  it('accepts a timestamped regular trade but never labels it as extended-hours', () => {
    const open = payload('Open', 'Oct 2, 2026 10:26 AM ET');
    expect(parseNasdaqSessionQuote(open, 'AAPL', new Date('2026-10-02T14:30:00Z'))).toMatchObject({
      session: 'regular', price: 331.225, observedAt: '2026-10-02T14:26:00.000Z',
    });
    expect(parseNasdaqExtendedSession(open, 'AAPL', new Date('2026-10-02T14:30:00Z'))).toBeNull();
    expect(parseNasdaqSessionQuote(payload('Closed', 'Oct 2, 2026 4:10 PM ET'), 'AAPL', new Date('2026-10-02T20:15:00Z'))).toBeNull();
  });

  it('rejects closed index prices, mismatched symbols, stale quotes and absent exchange timezones', () => {
    const now = new Date('2026-10-02T08:30:00Z');
    expect(parseNasdaqExtendedSession(payload('Pre-Market', 'Oct 1, 2026 4:26 AM ET'), 'AAPL', now)).toBeNull();
    expect(parseNasdaqExtendedSession(payload('Closed', 'Oct 2, 2026 4:26 AM ET'), 'AAPL', now)).toBeNull();
    expect(parseNasdaqExtendedSession(payload('Pre-Market', 'Oct 2, 2026 4:26 AM ET', 'COMP'), 'AAPL', now)).toBeNull();
    expect(parseNasdaqExtendedSession(payload('Pre-Market', 'Oct 2, 2026 4:26 AM'), 'AAPL', now)).toBeNull();
    expect(parseNasdaqExtendedSession(payload('Pre-Market', 'Oct 2, 2026 10:26 AM ET'), 'AAPL', new Date('2026-10-02T14:30:00Z'))).toBeNull();
  });
});
