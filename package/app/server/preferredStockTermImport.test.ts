import { describe, expect, it } from 'vitest';
import { buildTermCoverageReport, validatePreferredTermRows } from './preferredStockTermImport';

describe('preferred stock term import validation', () => {
  it('accepts valid fixed and floating rows and computes condition-aware field coverage', () => {
    const rows = validatePreferredTermRows([
      { securityIdentifier: 'ABC-P-A', issuerName: 'ABC Holdings', securityName: 'Series A Preferred', dividendType: 'fixed', couponRatePct: '6.25', paymentFrequency: 'quarterly', asOfDate: '2026-08-20' },
      { securityIdentifier: 'XYZ-P-B', issuerName: 'XYZ Financial', securityName: 'Series B Preferred', dividendType: 'floating', paymentFrequency: 'quarterly', referenceIndex: 'SOFR', spreadBps: '310', resetFrequency: 'quarterly', asOfDate: '2026-08-20', firstCallDate: '2028-06-15', sourceReference: 'SEC 424B5' },
    ]);
    const accepted = rows.flatMap((row) => row.normalized ? [row.normalized] : []);
    const report = buildTermCoverageReport(accepted);
    expect(accepted).toHaveLength(2);
    expect(report.coreCoveragePct).toBe(100);
    expect(report.conditionalCoveragePct).toBe(100);
    expect(report.recommendedCoveragePct).toBe(25);
    expect(report.fieldMissingCounts.maturityDate).toBe(2);
    expect(report.typeSummary).toEqual(expect.arrayContaining([
      expect.objectContaining({ dividendType: 'fixed', records: 1, completeRecords: 1 }),
      expect.objectContaining({ dividendType: 'floating', records: 1, completeRecords: 1 }),
    ]));
  });

  it('rejects duplicate identifiers and missing conditional floating-rate fields instead of importing partial terms', () => {
    const rows = validatePreferredTermRows([
      { securityIdentifier: 'DUP-P-A', issuerName: 'Issuer One', securityName: 'Series A', dividendType: 'floating', paymentFrequency: 'quarterly', asOfDate: '2026-08-20' },
      { securityIdentifier: 'DUP-P-A', issuerName: 'Issuer Two', securityName: 'Series B', dividendType: 'fixed', couponRatePct: '5.5', paymentFrequency: 'quarterly', asOfDate: '2026-08-20' },
    ]);
    expect(rows[0]?.normalized).toBeNull();
    expect(rows[0]?.errors.map((item) => item.field)).toEqual(expect.arrayContaining(['reference_index', 'spread_bps', 'reset_frequency']));
    expect(rows[1]?.normalized).toBeNull();
    expect(rows[1]?.errors.map((item) => item.field)).toContain('security_identifier');
  });
});
