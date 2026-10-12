import { describe, expect, it } from 'vitest';
import { mergeYahooObservations, type StoredYahooObservation } from './yahooFinancePersistence';

const observation = (hash: string, date = '2026-09-21'): StoredYahooObservation => ({
  symbol: 'SPY', observationDate: date, fetchedAt: '2026-09-22T00:00:00.000Z',
  source: 'yfinance community wrapper / Yahoo Finance public data',
  sourceReference: 'python-adapter:yfinance-community@1.7.0',
  payload: { close: 680.4, currency: 'USD' }, contentHash: hash,
});

describe('Yahoo canonical observation persistence', () => {
  it('does not append an identical observation during a repeated query', () => {
    const current = [observation('same-content-hash')];
    const result = mergeYahooObservations(current, [observation('same-content-hash')]);
    expect(result).toMatchObject({ inserted: 0, duplicate: 1 });
    expect(result.observations).toHaveLength(1);
  });

  it('keeps a changed observation as a revision candidate instead of overwriting history', () => {
    const current = [observation('original-hash')];
    const result = mergeYahooObservations(current, [observation('revised-hash')]);
    expect(result).toMatchObject({ inserted: 1, duplicate: 0 });
    expect(result.observations.map(item => item.contentHash)).toEqual(['original-hash', 'revised-hash']);
  });
});
