import { describe, expect, it } from 'vitest';
import { extractOpenBBTreasuryObservation, observedRateForTenor } from '../client/src/lib/openBBInterestRates';

describe('OpenBB Federal Reserve interest-rate adapter', () => {
  it('uses the latest provider row and converts decimal yields to percentages', () => {
    const observation = extractOpenBBTreasuryObservation([{
      itemKey: 'feed-1',
      title: '美国国债收益率',
      body: 'Federal Reserve provider response.',
      topic: 'rates',
      category: 'curve',
      sourceKind: 'public',
      dataset: {
        label: 'US Treasury',
        columns: ['date', 'month_3', 'year_2', 'year_10'],
        rows: [
          { date: '2026-09-17', month_3: 0.0361, year_2: 0.0354, year_10: 0.0408 },
          { date: '2026-09-16', month_3: 0.0359, year_2: 0.0352, year_10: 0.0406 },
        ],
        metadata: {
          provider: 'federal_reserve', queriedAt: '2026-09-17T10:38:43.255Z', observedAt: '2026-09-17',
          timezone: 'provider-defined', rowCount: 249, displayedRowCount: 2, truncated: true,
          quality: 'provider_response', realtimeStatus: 'provider_defined', schemaVersion: 'openbb-query-v1', checksum: 'abc123',
        },
      },
    }]);

    expect(observation).toMatchObject({ provider: 'federal_reserve', observedAt: '2026-09-17', sourceRowCount: 249 });
    expect(observedRateForTenor(observation, 2)).toBeCloseTo(3.54);
    expect(observedRateForTenor(observation, 10)).toBeCloseTo(4.08);
    expect(observation?.history10Y).toEqual([
      { date: '2026-09-16', rate: 4.06 },
      { date: '2026-09-17', rate: 4.08 },
    ]);
  });

  it('returns a real empty state for non-Federal-Reserve or empty datasets', () => {
    expect(extractOpenBBTreasuryObservation([])).toBeNull();
    expect(extractOpenBBTreasuryObservation([{
      itemKey: 'feed-2', title: 'empty', body: 'No source observations.', topic: 'rates', category: 'curve', sourceKind: 'public',
      dataset: {
        label: 'empty', columns: ['date', 'year_10'], rows: [],
        metadata: {
          provider: 'federal_reserve', queriedAt: null, observedAt: null, timezone: 'provider-defined', rowCount: 0,
          displayedRowCount: 0, truncated: false, quality: 'empty_response', realtimeStatus: 'provider_defined', schemaVersion: 'openbb-query-v1', checksum: 'empty',
        },
      },
    }])).toBeNull();
  });
});
