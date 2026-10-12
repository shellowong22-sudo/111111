import { describe, expect, it } from 'vitest';
import { assertCanonicalMarketOwner, observationTimestamp } from './adminMarketIngestion';
import { assertManagedPublicDatasetUniqueness, listManagedPublicDatasets, managedDatasetRetryMinutes, managedObservationSymbol } from './adminPublicDatasetIngestion';

describe('managed global public API datasets', () => {
  it('assigns every dataset one unique id, contract and canonical module owner', () => {
    const datasets = listManagedPublicDatasets();
    expect(datasets).toHaveLength(71);
    expect(datasets.find(item => item.id === 'bls-us-cpi')?.symbol).toContain('CPIAUCNS');
    expect(datasets.find(item => item.id === 'bls-us-cpi')?.symbol).not.toContain('CPIAUCSL');
    expect(new Set(datasets.map(item => item.id)).size).toBe(datasets.length);
    expect(new Set(datasets.map(item => item.dataContractId)).size).toBe(datasets.length);
    expect(new Set(datasets.map(item => item.dataScopeKey)).size).toBe(datasets.length);
    expect(new Set(datasets.map(item => item.symbol)).size).toBe(datasets.length);
    for (const dataset of datasets) {
      expect(() => assertCanonicalMarketOwner(dataset.moduleId, dataset.dataContractId)).not.toThrow();
      expect(() => assertCanonicalMarketOwner('wrong-feature', dataset.dataContractId)).toThrow('MARKET_DATA_CONTRACT_OWNER_MISMATCH');
    }
  });

  it('rejects a repeated semantic scope before any scheduler can publish it twice', () => {
    const datasets = listManagedPublicDatasets();
    expect(() => assertManagedPublicDatasetUniqueness([
      datasets[0],
      { ...datasets[1], id: 'copy', dataContractId: 'copy.contract', symbol: 'COPY', dataScopeKey: datasets[0].dataScopeKey },
    ])).toThrow('MANAGED_PUBLIC_DATASET_DUPLICATE:scope');
  });

  it('does not expose external source URLs as a front-end delivery contract', () => {
    const datasets = listManagedPublicDatasets();
    expect(datasets.every(item => !Object.keys(item).some(key => /url|endpoint/i.test(key)))).toBe(true);
  });

  it('keeps period-only observations authoritative without inventing a timestamp', () => {
    expect(observationTimestamp('2026-09-20')?.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(observationTimestamp('2026-09')).toBeNull();
    expect(observationTimestamp('2026Q3')).toBeNull();
    expect(observationTimestamp('1960')).toBeNull();
    expect(observationTimestamp('1966-07-01')).toBeNull();
    expect(observationTimestamp('2040-01-01')).toBeNull();
    expect(observationTimestamp('2025-02-30')).toBeNull();
  });

  it('uses minute-level polling with bounded persistent backoff', () => {
    const datasets = listManagedPublicDatasets();
    expect(datasets.every(item => Number.isInteger(item.pollMinutes) && item.pollMinutes >= 1 && item.pollMinutes <= 60)).toBe(true);
    expect(datasets.find(item => item.id === 'fincept-twse-equity-valuation')?.pollMinutes).toBe(60);
    expect(datasets.find(item => item.id === 'fincept-nbp-gold-reference')?.moduleId).toBe('commodity-market');
    expect(datasets.find(item => item.id === 'fincept-nbp-usdpln-reference')?.moduleId).toBe('forex-hub');
    expect(datasets.find(item => item.id === 'fincept-nbp-fx-basket')?.moduleId).toBe('forex-hub');
    expect(datasets.find(item => item.id === 'fincept-cnb-fx-basket')?.moduleId).toBe('forex-hub');
    expect(datasets.find(item => item.id === 'fincept-boi-fx-basket')?.moduleId).toBe('forex-hub');
    expect(datasets.find(item => item.id === 'fincept-coingecko-markets')?.moduleId).toBe('crypto-market');
    expect(datasets.find(item => item.id === 'fincept-cboe-volatility-history')?.moduleId).toBe('index-hub');
    expect(datasets.find(item => item.id === 'fincept-nasdaq-screener')?.moduleId).toBe('stock-eqs');
    expect(datasets.find(item => item.id === 'fincept-cboe-index-snapshot')?.moduleId).toBe('index-hub');
    expect(datasets.find(item => item.id === 'fincept-nasdaq-earnings-calendar')?.moduleId).toBe('stock-eqs');
    expect(datasets.find(item => item.id === 'fincept-nasdaq-dividend-calendar')?.moduleId).toBe('stock-eqs');
    expect(datasets.find(item => item.id === 'fincept-nasdaq-ipo-calendar')?.moduleId).toBe('stock-eqs');
    expect(datasets.find(item => item.id === 'fincept-nasdaq-economic-calendar')?.moduleId).toBe('economic-ecst');
    expect(managedDatasetRetryMinutes(10, 0, true)).toBe(10);
    expect(managedDatasetRetryMinutes(30, 1, false)).toBe(30);
    expect(managedDatasetRetryMinutes(30, 2, false)).toBe(60);
    expect(managedDatasetRetryMinutes(60, 10, false)).toBe(360);
  });

  it('archives CoinGecko observations by asset ID, not a shared ticker', () => {
    expect(managedObservationSymbol('fincept-coingecko-markets', { coinId: 'bitcoin', symbol: 'BTC' }, 'MARKETS')).toBe('bitcoin');
    expect(managedObservationSymbol('fincept-coingecko-markets', { coinId: 'another-btc', symbol: 'BTC' }, 'MARKETS')).toBe('another-btc');
    expect(managedObservationSymbol('fincept-coingecko-markets', { coinId: '../invalid', symbol: 'BTC' }, 'MARKETS')).toBe('BTC');
    expect(managedObservationSymbol('fincept-nasdaq-screener', { coinId: 'bitcoin', symbol: 'AAPL' }, 'OTHER')).toBe('AAPL');
  });
});
