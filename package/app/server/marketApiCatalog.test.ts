import { describe, expect, it } from 'vitest';
import { listOptionalMarketDataSources } from './freeMarketData';

describe('admin financial API contract catalogue', () => {
  it('registers configurable API contracts without claiming catalog-only adapters are live', () => {
    const sources = listOptionalMarketDataSources();
    expect(sources.length).toBeGreaterThanOrEqual(12);
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length);
    expect(sources.every((source) => source.endpoint.startsWith('https://'))).toBe(true);
    expect(sources.every((source) => /^[A-Z][A-Z0-9_]+$/.test(source.apiKeyEnvName))).toBe(true);
    expect(sources.filter((source) => source.adapterStatus === 'catalog_only').length).toBeGreaterThanOrEqual(10);
  });

  it('exposes multiple MOSO option candidates while keeping them plan-dependent', () => {
    const candidates = listOptionalMarketDataSources().filter((source) => source.mosoCompatible);
    expect(candidates.length).toBeGreaterThanOrEqual(4);
    expect(candidates.every((source) => source.assetClasses.some((asset) => asset.includes('option')))).toBe(true);
    expect(candidates.every((source) => source.realtime === 'plan_dependent')).toBe(true);
  });
});
