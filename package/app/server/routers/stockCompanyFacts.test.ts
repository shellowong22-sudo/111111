import { describe, expect, it } from 'vitest';
import { deriveStockFundamentalSnapshot, normalizeStockCompanyFacts } from './stockMarketResearch';

// Synthetic values in SEC companyfacts' real response shape; test-only data.
const annual = { start: '2024-09-29', end: '2025-09-27', val: 1000, accn: '0000000001-25-000001', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31', frame: 'CY2025' };
const quarter = { ...annual, start: '2025-06-29', val: 250, frame: 'CY2025Q3' };
const amended = { ...annual, val: 1010, accn: '0000000001-26-000001', form: '10-K/A', filed: '2026-01-02' };
const body = (values: any[]) => ({ entityName: 'Fixture issuer', facts: { 'us-gaap': { RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: values } } } } });

describe('SEC companyfacts financial periods and provenance', () => {
  it('retains annual and quarter facts sharing end/fp/filing, preserves amendments, and removes only exact duplicates', () => {
    const result = normalizeStockCompanyFacts(body([annual, quarter, amended, { ...annual }]), '1');
    const metric = result.metrics[0];
    expect(metric.observations).toHaveLength(3);
    expect(metric.totalObservations).toBe(3);
    expect(metric.observations.filter((row) => row.periodType === 'annual')).toHaveLength(2);
    expect(metric.observations.filter((row) => row.periodType === 'quarter')).toHaveLength(1);
    expect(metric.observations.find((row) => row.periodType === 'quarter')).toMatchObject({ start: '2025-06-29', end: '2025-09-27', durationDays: 91, fp: 'FY', value: 250, accessionNumber: quarter.accn, filed: quarter.filed });
    const annualRows = metric.observations.filter((row) => row.periodType === 'annual');
    expect(new Set(annualRows.map((row) => row.periodId)).size).toBe(1);
    expect(new Set(metric.observations.map((row) => row.id)).size).toBe(3);
    expect(annualRows.map((row) => row.value)).toEqual([1000, 1010]);
    expect(annualRows[1]).toMatchObject({ form: '10-K/A', accessionNumber: amended.accn, accn: amended.accn, filingDate: amended.filed });
  });

  it('produces stable identities and ordering independently of SEC array order', () => {
    const forward = normalizeStockCompanyFacts(body([annual, quarter, amended]), '1');
    const reversed = normalizeStockCompanyFacts(body([amended, quarter, annual]), '0000000001');
    expect(reversed).toEqual(forward);
  });

  it('does not infer fact duration from filing fp, and distinguishes instant/unknown/duration periods', () => {
    const payload = body([
      { ...annual, start: '2025-01-01', end: '2025-06-30', fp: 'Q2' },
      { ...annual, start: '2025-01-01', end: '2025-09-30', fp: 'Q3' },
      { ...annual, start: undefined, fp: 'FY' },
      { ...annual, start: '2025-09-01', fp: 'FY' },
    ]);
    (payload.facts['us-gaap'] as any).Assets = { units: { USD: [{ ...annual, start: undefined }] } };
    const result = normalizeStockCompanyFacts(payload, '1');
    const revenue = result.metrics.find((metric) => metric.id === 'RevenueFromContractWithCustomerExcludingAssessedTax')!;
    expect(new Set(revenue.observations.map((row) => row.periodType))).toEqual(new Set(['half_year', 'nine_months', 'unknown', 'other']));
    expect(result.metrics.find((metric) => metric.id === 'Assets')!.observations[0]).toMatchObject({ start: null, durationDays: null, periodType: 'instant' });
  });

  it('puts latest observations before obsolete taxonomy and distinguishes the two revenue definitions', () => {
    const payload = body([annual]);
    (payload.facts['us-gaap'] as any).Revenues = { units: { USD: [{ ...annual, start: '2017-10-01', end: '2018-09-30', filed: '2018-10-31' }] } };
    const result = normalizeStockCompanyFacts(payload, '1');
    expect(result.metrics.map((row) => row.id)).toEqual(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues']);
    expect(result.metrics[0].latestObservationDate).toBe('2025-09-27');
    expect(result.metrics[0].label).not.toBe(result.metrics[1].label);
    expect(result.metrics[1].label).toContain('Revenues');
  });

  it('preserves 120 newest evidence records and explicitly reports the history limit', () => {
    const values = Array.from({ length: 140 }, (_, index) => ({ ...annual, val: index, filed: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), accn: `0000000001-25-${String(index).padStart(6, '0')}` }));
    const metric = normalizeStockCompanyFacts(body(values.reverse()), '1').metrics[0];
    expect(metric.observations).toHaveLength(120);
    expect(metric).toMatchObject({ totalObservations: 140, truncatedObservations: 20 });
    expect(metric.observations[0].value).toBe(20);
    expect(metric.observations.at(-1)?.value).toBe(139);
  });

  it('rejects invalid periods and non-numeric values without deleting genuine zero or negative facts', () => {
    const metric = normalizeStockCompanyFacts(body([
      { ...annual, val: null }, { ...annual, val: ' ' }, { ...annual, val: Infinity },
      { ...annual, start: '2025-02-30' }, { ...annual, start: '2026-01-01' }, { ...annual, end: 'bad-date' },
      { ...annual, val: 0 }, { ...annual, val: -10 },
    ]), '1').metrics[0];
    expect(metric.observations).toHaveLength(2);
    expect(new Set(metric.observations.map((row) => row.value))).toEqual(new Set([0, -10]));
  });

  it('derives transparent annual ratios from distinct SEC periods instead of fixed screening values', () => {
    const payload = body([]);
    const previous = { ...annual, start: '2023-10-01', end: '2024-09-28', filed: '2024-11-01', fy: 2024, val: 4 };
    (payload.facts['us-gaap'] as any).EarningsPerShareDiluted = { units: { 'USD/shares': [previous, { ...annual, val: 5 }] } };
    (payload.facts['us-gaap'] as any).NetIncomeLoss = { units: { USD: [{ ...annual, val: 100 }] } };
    (payload.facts['us-gaap'] as any).Assets = { units: { USD: [{ ...annual, start: undefined, val: 1000 }] } };
    (payload.facts['us-gaap'] as any).Liabilities = { units: { USD: [{ ...annual, start: undefined, val: 400 }] } };
    (payload.facts['us-gaap'] as any).StockholdersEquity = { units: { USD: [{ ...annual, start: undefined, val: 500 }] } };
    (payload.facts['us-gaap'] as any).EntityCommonStockSharesOutstanding = { units: { shares: [{ ...annual, start: undefined, val: 100 }] } };
    const snapshot = deriveStockFundamentalSnapshot(normalizeStockCompanyFacts(payload, '1'));
    expect(snapshot).toMatchObject({
      annualEps: 5,
      annualEpsGrowthPct: 25,
      annualNetIncome: 100,
      assets: 1000,
      liabilities: 400,
      equity: 500,
      sharesOutstanding: 100,
      roePct: 20,
      liabilitiesToAssetsPct: 40,
      fiscalPeriodEnd: '2025-09-27',
      sourceStatus: 'available',
    });
  });
});
