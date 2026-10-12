import { describe, expect, it } from 'vitest';
import { FX_FRESHNESS_SERIES_IDS } from './forexFreshnessAlertDb';

describe('forex account freshness alert contract', () => {
  it('limits persistent account thresholds to the supported key currency-pair source series', () => {
    expect(FX_FRESHNESS_SERIES_IDS).toEqual(['DEXUSEU', 'DEXUSUK', 'DEXJPUS', 'DEXCAUS', 'DEXSZUS']);
    expect(new Set(FX_FRESHNESS_SERIES_IDS).size).toBe(FX_FRESHNESS_SERIES_IDS.length);
  });
});
