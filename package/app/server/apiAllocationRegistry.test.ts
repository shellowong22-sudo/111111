import { describe, expect, it } from 'vitest';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import { API_ALLOCATIONS, assertApiAllocationRegistry, summarizeApiAllocations } from '../shared/apiAllocationRegistry';
import { GLOBAL_API_PROVIDER_CATALOG, GLOBAL_API_PROVIDER_SUMMARY, assertGlobalApiProviderCatalog } from '../shared/globalApiProviderCatalog';
import { GLOBAL_API_CANDIDATE_SUMMARY, assertGlobalApiCandidateCatalog } from './globalApiCandidateCatalog';

describe('API allocation and global provider catalog', () => {
  it('allocates exactly one unique contract and owner to every existing module', () => {
    expect(assertApiAllocationRegistry()).toBe(true);
    expect(API_ALLOCATIONS).toHaveLength(ADMIN_DATA_MODULES.length);
    expect(new Set(API_ALLOCATIONS.map(item => item.dataContractId)).size).toBe(ADMIN_DATA_MODULES.length);
    expect(new Set(API_ALLOCATIONS.map(item => item.ownershipKey)).size).toBe(ADMIN_DATA_MODULES.length);
  });

  it('keeps allocation, configuration and successful observation as separate states', () => {
    const summary = summarizeApiAllocations();
    expect(summary.total).toBe(ADMIN_DATA_MODULES.length);
    expect(summary.publicAdapter + summary.requiresKey + summary.requiresLicense + summary.requiresUserData + summary.notConfigured).toBe(summary.total);
    expect(summary.boundary).toContain('分配不等于查询成功');
  });

  it('keeps global candidates unique and unconfigured until a verified adapter exists', () => {
    expect(assertGlobalApiProviderCatalog()).toBe(true);
    expect(GLOBAL_API_PROVIDER_SUMMARY.total).toBe(GLOBAL_API_PROVIDER_CATALOG.length);
    expect(GLOBAL_API_PROVIDER_SUMMARY.configured).toBe(0);
    expect(GLOBAL_API_PROVIDER_CATALOG.some(item => item.id === 'alpha-vantage' && item.access === 'requires_key')).toBe(true);
    expect(GLOBAL_API_PROVIDER_CATALOG.some(item => item.id === 'fred-public' && item.access === 'public_no_key')).toBe(true);
  });

  it('parses the supplied 1000-record catalog, removes duplicate names, and keeps all as unconfigured candidates', () => {
    expect(assertGlobalApiCandidateCatalog()).toBe(true);
    expect(GLOBAL_API_CANDIDATE_SUMMARY.sourceRecordCount).toBe(1000);
    expect(GLOBAL_API_CANDIDATE_SUMMARY.uniqueCandidateCount).toBeLessThanOrEqual(1000);
    expect(GLOBAL_API_CANDIDATE_SUMMARY.duplicateRecordCount).toBeGreaterThanOrEqual(0);
    expect(GLOBAL_API_CANDIDATE_SUMMARY.configured).toBe(0);
  });
});
