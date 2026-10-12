import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertCanonicalMarketOwner,
  marketObservationContentHash,
} from './adminMarketIngestion';

const identity = (payload: Record<string, unknown>) => ({
  moduleId: 'admin-market-ingestion',
  dataContractId: 'market.ohlcv.daily.v1',
  symbol: 'AAPL',
  observationDate: '2026-09-18',
  payload,
});

describe('market observation permanent ledger', () => {
  it('uses a stable fingerprint when provider field order changes', () => {
    const first = marketObservationContentHash(identity({ close: 201.2, volume: 1200, currency: 'USD' }));
    const reordered = marketObservationContentHash(identity({ currency: 'USD', volume: 1200, close: 201.2 }));
    expect(first).toBe(reordered);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates a new identity when an observed value is revised', () => {
    const original = marketObservationContentHash(identity({ close: 201.2, volume: 1200 }));
    const revised = marketObservationContentHash(identity({ close: 201.25, volume: 1200 }));
    expect(revised).not.toBe(original);
  });

  it('recomputes identity from the canonical owner after an owner migration', () => {
    const payload = { value: 3.85, frequency: 'business_day', delayStatus: 'latest_public_release' };
    const stale = marketObservationContentHash({ ...identity(payload), moduleId: 'legacy-money-market-owner' });
    const canonical = marketObservationContentHash(identity(payload));
    expect(stale).not.toBe(canonical);
    expect(marketObservationContentHash(identity({ delayStatus: 'latest_public_release', frequency: 'business_day', value: 3.85 }))).toBe(canonical);
  });

  it('rejects delivery of the OHLCV contract to a non-canonical module', () => {
    expect(() => assertCanonicalMarketOwner('admin-market-ingestion', 'market.ohlcv.daily.v1')).not.toThrow();
    expect(() => assertCanonicalMarketOwner('economic-analysis', 'market.ohlcv.daily.v1')).toThrow('MARKET_DATA_CONTRACT_OWNER_MISMATCH');
    expect(() => assertCanonicalMarketOwner('admin-market-ingestion', 'unknown.contract')).toThrow('MARKET_DATA_CONTRACT_OWNER_MISMATCH');
  });

  it('migrates an append-only table with content-level duplicate protection', () => {
    const migration = readFileSync('drizzle/0111_market_observation_history.sql', 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS `market_data_observation_history`');
    expect(migration).toContain('UNIQUE KEY `market_observation_content_uq` (`module_id`,`data_contract_id`,`symbol`,`observation_date`,`content_hash`)');
    expect(migration).not.toMatch(/ON UPDATE CURRENT_TIMESTAMP/);
  });
});
