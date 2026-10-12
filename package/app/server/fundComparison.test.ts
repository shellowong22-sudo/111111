import { describe, expect, it } from 'vitest';
import { buildFundComparison } from '../client/src/pages/FundCompare';

describe('fund comparison', () => {
  it('uses each fund own dated NAV without filling a missing date from another fund', () => {
    const result = buildFundComparison([
      { code: '000128', observations: [
        { observationDate: '2026-09-28', netAssetValue: 0.9 },
        { observationDate: '2026-09-29', netAssetValue: 1 },
        { observationDate: '2026-09-30', netAssetValue: 1.1 },
      ] },
      { code: '000129', observations: [
        { observationDate: '2026-09-29', netAssetValue: 2 },
        { observationDate: '2026-09-30', netAssetValue: 1.8 },
      ] },
    ]);
    expect(result.chart).toEqual([
      { date: '2026-09-29', '000128': 100, '000129': 100 },
      { date: '2026-09-30', '000128': 110, '000129': 90 },
    ]);
  });

  it('does not turn invalid or zero NAV into a chart observation', () => {
    const result = buildFundComparison([{ code: '000001', observations: [
      { observationDate: '2026-09-29', netAssetValue: 0 },
      { observationDate: '2026-09-30', netAssetValue: null },
    ] }]);
    expect(result.chart).toEqual([]);
    expect(result.indexed[0].ordered).toEqual([]);
  });
});
