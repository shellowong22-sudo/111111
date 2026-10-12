import { describe, expect, it } from 'vitest';
import { annualQualityEvidence, computeIcEvidence, factorAttribution, parseFactorReturns, parseIcEvidence, type QualityMetric } from '../client/src/components/stock/ftwFactorEvidence';

// Synthetic fixtures only. These observations are never used as terminal data.
const asOf = '2026-09-10';
type Fact = QualityMetric['observations'][number];
const annual: Fact = { start: '2024-01-01', end: '2024-12-31', value: 100, periodType: 'annual', accessionNumber: '2025-001', filed: '2025-02-01', form: '10-K' };
const metric = (id: string, values: Fact[], unit: string | undefined = 'USD'): QualityMetric => ({ id, observations: values, unit });
function facts() {
  return [
    metric('RevenueFromContractWithCustomerExcludingAssessedTax', [{ ...annual }]),
    metric('NetIncomeLoss', [{ ...annual, value: 20 }]),
    metric('StockholdersEquity', [{ ...annual, start: null, periodType: 'instant', value: 40 }]),
    metric('Assets', [{ ...annual, start: null, periodType: 'instant', value: 200 }]),
  ];
}
const icHeader = 'date\tinstrumentId\tfactorId\tfactorValue\tforwardReturn\treturnEnd\tsource\tfactorUnit\tcurrency\tmodelVersion\tavailableDate';
const icRow = (changes: Record<string, string | number> = {}) => ({ date: '2026-08-01', instrumentId: 'TEST-A', factorId: 'quality', factorValue: 1, forwardReturn: 2, returnEnd: '2026-09-01', source: 'licensed-fixture', factorUnit: 'ratio', currency: 'USD', modelVersion: 'v1', availableDate: '2026-07-31', ...changes });
const returnsHeader = 'date\tfactorId\treturnPct\tweightPct\tsource\tperiodStart\tcurrency\tmodelVersion';
const returnRow = (changes: Record<string, string | number> = {}) => ({ date: '2026-09-01', factorId: 'quality', returnPct: 10, weightPct: 40, source: 'licensed-fixture', periodStart: '2026-08-01', currency: 'USD', modelVersion: 'long-only-v1', ...changes });
const tsv = (header: string, rows: Record<string, string | number>[]) => header + '\n' + rows.map(row => header.split('\t').map(key => row[key]).join('\t')).join('\n');

describe('FTW annual financial evidence', () => {
  it('derives ratios from matching currency, exact period and accession, retaining negative equity and losses', () => {
    expect(annualQualityEvidence(facts(), asOf)[0]).toMatchObject({ netMargin: 20, equityRatio: 20, revenue: 100, netIncome: 20, unit: 'USD', revisionCount: 1 });
    const values = facts(); values[1].observations[0].value = -20; values[2].observations[0].value = -40;
    expect(annualQualityEvidence(values, asOf)[0]).toMatchObject({ netMargin: -20, equityRatio: -20 });
  });
  it('rejects unspecified, share and mismatched monetary units; balance sheet currency cannot be mixed', () => {
    for (const unit of [undefined, '', 'shares', 'USD/share']) {
      const values = facts(); values[0].unit = unit; values[1].unit = unit;
      expect(annualQualityEvidence(values, asOf)).toEqual([]);
    }
    const values = facts(); values[1].unit = 'EUR'; expect(annualQualityEvidence(values, asOf)).toEqual([]);
    values[1].unit = 'USD'; values[2].unit = 'EUR'; expect(annualQualityEvidence(values, asOf)[0].equityRatio).toBeNull();
  });
  it('does not mix year-to-date, quarterly, different start dates, versions or submission metadata', () => {
    for (const change of [{ start: '2024-10-01' }, { accessionNumber: '2025-002' }, { periodType: 'quarter' }, { filed: '2025-03-01' }, { form: '10-K/A' }]) {
      const values = facts(); Object.assign(values[1].observations[0], change); expect(annualQualityEvidence(values, asOf)).toEqual([]);
    }
    const values = facts(); values[0].observations[0].start = '2024-10-01'; values[1].observations[0].start = '2024-10-01';
    expect(annualQualityEvidence(values, asOf)).toEqual([]);
  });
  it('refuses future, invalid or missing filing dates and filing dates before period end', () => {
    for (const filed of ['2026-09-11', '2024-12-01', '2025-02-30', null, undefined]) {
      const values = facts(); values[0].observations[0].filed = filed; expect(annualQualityEvidence(values, asOf)).toEqual([]);
    }
    expect(annualQualityEvidence(facts(), 'invalid')).toEqual([]);
    const values = facts(); values[0].observations[0].form = '10-K-INVALID'; expect(annualQualityEvidence(values, asOf)).toEqual([]);
  });
  it('counts unique filing versions only and selects latest deterministically regardless of record order', () => {
    const values = facts();
    for (const row of values) row.observations.push({ ...row.observations[0] }, { ...row.observations[0], value: row.observations[0].value * 2, accessionNumber: '2025-002', filed: '2025-04-01', form: '10-K/A' });
    const expected = annualQualityEvidence(values, asOf);
    expect(expected).toHaveLength(1); expect(expected[0]).toMatchObject({ accession: '2025-002', revenue: 200, netMargin: 20, revisionCount: 2 });
    values.forEach(row => row.observations.reverse()); expect(annualQualityEvidence(values, asOf)).toEqual(expected);
    expect(annualQualityEvidence(values, '2025-03-01')[0]).toMatchObject({ accession: '2025-001', revisionCount: 1 });
  });
  it('does not select the first value from conflicting facts or duplicated metric definitions', () => {
    for (const index of [0, 1]) {
      const values = facts(); values[index].observations.push({ ...values[index].observations[0], value: 999 }); expect(annualQualityEvidence(values, asOf)).toEqual([]);
    }
    const values = facts(); values[2].observations.push({ ...values[2].observations[0], value: 999 }); expect(annualQualityEvidence(values, asOf)[0].equityRatio).toBeNull();
    const split = facts(); split.push({ ...split[1], observations: [{ ...annual, value: 99 }] }); expect(annualQualityEvidence(split, asOf)).toEqual([]);
    const aliases = facts(); aliases[1].observations[0].accn = 'conflicting-id'; expect(annualQualityEvidence(aliases, asOf)).toEqual([]);
  });
  it('never divides by nonpositive revenues/assets or returns infinite derived ratios', () => {
    for (const value of [0, -1, NaN, Infinity]) { const values = facts(); values[0].observations[0].value = value; expect(annualQualityEvidence(values, asOf)).toEqual([]); }
    const values = facts(); values[3].observations[0].value = 0; expect(annualQualityEvidence(values, asOf)[0].equityRatio).toBeNull();
    values[0].observations[0].value = 1e-300; values[1].observations[0].value = 1e300; expect(annualQualityEvidence(values, asOf)).toEqual([]);
  });
});

describe('FTW exact cross-sectional Spearman IC', () => {
  const compute = (x: number[], y: number[]) => {
    const parsed = parseIcEvidence(tsv(icHeader, x.map((value, index) => icRow({ instrumentId: `TEST-${index}`, factorValue: value, forwardReturn: y[index] }))), asOf);
    expect(parsed.error).toBe(''); return computeIcEvidence(parsed.rows)[0];
  };
  it('matches exact positive, negative and nonmonotonic ranks', () => {
    expect(compute([1, 2, 3, 4], [10, 20, 30, 40]).ic).toBe(1);
    expect(compute([1, 2, 3, 4], [40, 30, 20, 10]).ic).toBe(-1);
    expect(compute([1, 2, 3, 4], [10, 20, 40, 30]).ic).toBeCloseTo(.8, 12);
  });
  it('uses average ranks for ties, never arbitrary tie ordering', () => {
    expect(compute([1, 1, 3], [1, 2, 3]).ic).toBeCloseTo(Math.sqrt(3) / 2, 12);
    expect(compute([1, 1, 2, 3], [1, 2, 2, 3]).ic).toBeCloseTo(5 / 6, 12);
  });
  it('returns null for fewer than three securities or constant ranks', () => {
    expect(compute([1, 2], [1, 2]).ic).toBeNull();
    expect(compute([1, 1, 1], [1, 2, 3]).ic).toBeNull();
    expect(compute([1, 2, 3], [2, 2, 2]).ic).toBeNull();
  });
  it('deduplicates identical input before computing and blocks conflicting sources or values', () => {
    const rows = [icRow(), icRow(), icRow({ instrumentId: 'TEST-B' }), icRow({ instrumentId: 'TEST-C' })];
    const parsed = parseIcEvidence(tsv(icHeader, rows), asOf); expect(parsed.duplicates).toBe(1); expect(computeIcEvidence(parsed.rows)[0].count).toBe(3);
    for (const change of [{ forwardReturn: 3 }, { source: 'other-source' }]) expect(parseIcEvidence(tsv(icHeader, [icRow(), icRow(change)]), asOf).error).toContain('冲突');
  });
  it('blocks lookahead, unfinished current/future dates, invalid dates and impossible simple returns', () => {
    for (const change of [{ availableDate: '2026-08-02' }, { returnEnd: asOf }, { returnEnd: '2026-09-11' }, { returnEnd: '2026-08-01' }, { date: '2026-02-30' }, { forwardReturn: -100.1 }, { factorValue: '0x10' }, { forwardReturn: 'Infinity' }]) {
      expect(parseIcEvidence(tsv(icHeader, [icRow(change)]), asOf).error).not.toBe('');
    }
    expect(parseIcEvidence(tsv(icHeader, [icRow({ forwardReturn: -100, factorValue: 0 })]), asOf).error).toBe('');
  });
  it('requires units, currency, model version and source; cannot pool incompatible same-factor definitions', () => {
    for (const key of ['factorUnit', 'currency', 'modelVersion', 'source', 'availableDate']) expect(parseIcEvidence(tsv(icHeader, [icRow({ [key]: '' })]), asOf).error).not.toBe('');
    for (const change of [{ factorUnit: '%' }, { currency: 'EUR' }, { modelVersion: 'v2' }]) expect(parseIcEvidence(tsv(icHeader, [icRow(), icRow({ instrumentId: 'TEST-B', ...change })]), asOf).error).toContain('分开分析');
  });
  it('keeps different observation dates and return horizons separate, with collision-safe identities', () => {
    const parsed = parseIcEvidence(tsv(icHeader, [icRow(), icRow({ returnEnd: '2026-08-08' }), icRow({ instrumentId: 'A|B', factorId: 'C' }), icRow({ instrumentId: 'A', factorId: 'B|C' })]), asOf);
    expect(parsed.error).toBe(''); expect(parsed.rows).toHaveLength(4); expect(computeIcEvidence(parsed.rows)).toHaveLength(4);
  });
});

describe('FTW comparable long-only subportfolio attribution', () => {
  it('computes percentage-point contribution from percentage weights without inventing uncovered returns', () => {
    const parsed = parseFactorReturns(tsv(returnsHeader, [returnRow(), returnRow({ factorId: 'value', returnPct: -5, weightPct: 30 })]), asOf);
    expect(parsed.error).toBe(''); const result = factorAttribution(parsed.rows);
    expect(result.map(row => row.contributionPct)).toEqual([4, -1.5]);
    expect(result.reduce((sum, row) => sum + row.contributionPct, 0)).toBe(2.5);
    expect(result.reduce((sum, row) => sum + row.weightPct, 0)).toBe(70);
  });
  it('rejects same end dates with different start dates, currencies or model versions', () => {
    for (const change of [{ periodStart: '2026-08-15' }, { currency: 'EUR' }, { modelVersion: 'v2' }]) expect(parseFactorReturns(tsv(returnsHeader, [returnRow(), returnRow({ factorId: 'value', ...change })]), asOf).error).toContain('不能合并');
  });
  it('rejects missing provenance, invalid date/numeric values, future/current periods and invalid long-only weights', () => {
    for (const change of [{ source: '' }, { periodStart: '' }, { currency: '' }, { modelVersion: '' }, { date: asOf }, { date: '2026-09-11' }, { periodStart: '2026-09-01' }, { date: '2026-02-30' }, { returnPct: -101 }, { weightPct: -1 }, { weightPct: 101 }, { returnPct: '0x10' }]) expect(parseFactorReturns(tsv(returnsHeader, [returnRow(change)]), asOf).error).not.toBe('');
  });
  it('deduplicates before weight checks and refuses conflicts or weight sums above 100%', () => {
    const parsed = parseFactorReturns(tsv(returnsHeader, [returnRow({ weightPct: 100 }), returnRow({ weightPct: 100 })]), asOf);
    expect(parsed.error).toBe(''); expect(parsed.rows).toHaveLength(1); expect(parsed.duplicates).toBe(1);
    expect(parseFactorReturns(tsv(returnsHeader, [returnRow(), returnRow({ returnPct: 11 })]), asOf).error).toContain('冲突');
    expect(parseFactorReturns(tsv(returnsHeader, [returnRow({ weightPct: 70 }), returnRow({ factorId: 'value', weightPct: 40 })]), asOf).error).toContain('超过100');
  });
  it('checks weights per period, not across periods; zero weights and a total loss remain genuine values', () => {
    const parsed = parseFactorReturns(tsv(returnsHeader, [returnRow({ weightPct: 100, returnPct: -100 }), returnRow({ date: '2026-09-02', periodStart: '2026-09-01', weightPct: 100 }), returnRow({ factorId: 'zero', weightPct: 0, returnPct: 0 })]), asOf);
    expect(parsed.error).toBe(''); expect(factorAttribution(parsed.rows)[0].contributionPct).toBe(-100); expect(parsed.rows).toHaveLength(3);
  });
  it('rejects legacy underspecified schemas rather than silently guessing periods or models', () => {
    expect(parseFactorReturns('date\tfactorId\treturnPct\tweightPct\tsource\n2026-08-01\tq\t1\t50\ts', asOf).error).toContain('表头');
    expect(parseIcEvidence('date\tinstrumentId\tfactorId\tfactorValue\tforwardReturn\treturnEnd\tsource\n2026-08-01\tA\tq\t1\t1\t2026-08-02\ts', asOf).error).toContain('表头');
  });
});
