import { describe, expect, it } from 'vitest';
import { parseYFinancePythonResponse } from './yfinancePythonAdapter';

describe('yfinance community adapter contract', () => {
  it('parses verified OHLCV while preserving non-official provenance', () => {
    const result = parseYFinancePythonResponse({
      provider: 'yfinance-community',
      providerVersion: '1.7.0',
      officialYahooApi: false,
      symbol: 'SPY',
      currency: 'USD',
      exchangeTimezoneName: 'America/New_York',
      history: [{ date: '2026-09-21', open: 675.1, high: 681.2, low: 674.8, close: 680.4, volume: 51_000_000 }],
    });
    expect(result).toMatchObject({ provider: 'yfinance-community', providerVersion: '1.7.0', officialYahooApi: false, symbol: 'SPY' });
    expect(result.history).toEqual([{ date: '2026-09-21', open: 675.1, high: 681.2, low: 674.8, close: 680.4, volume: 51_000_000 }]);
  });

  it('rejects payloads that claim to be an official Yahoo API', () => {
    expect(() => parseYFinancePythonResponse({
      provider: 'yfinance-community', officialYahooApi: true, symbol: 'SPY', currency: 'USD', history: [],
    })).toThrow('YFINANCE_INVALID_PROVENANCE');
  });
});
