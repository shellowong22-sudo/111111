import { describe, expect, it } from 'vitest';
import { inventoryAnalytics, laborAnalytics, productivityAnalytics } from '../shared/supplySideAnalytics';
import type { EconomicSnapshot } from '../shared/economicObservations';
import { ECONOMIC_API_CONTRACTS } from '../shared/economicApiContracts';
function snapshot(inputs: Record<string, Array<[string, number]>>): EconomicSnapshot {
  return { retrievedAt: '2026-09-19', series: Object.entries(inputs).map(([id, values]) => ({ id, label: id, unit: '', frequency: '', sourceUrl: '', retrievedAt: '', status: 'available', error: null, history: values.map(([date, value]) => ({ date, value })) })) };
}
describe('original ECSU supply-side data depth', () => {
  it('registers four distinct inputs to the existing ECSU administration target', () => {
    for (const id of ['BUSINV', 'UNEMPLOY', 'OUTNFB', 'HOANBS']) {
      const contracts = ECONOMIC_API_CONTRACTS.filter(c => c.seriesId === id);
      expect(contracts).toHaveLength(1);
      expect(contracts[0].primaryModuleId).toBe('economic-ecsu');
    }
  });
  it('keeps inventory monthly gaps missing and converts millions to billions', () => {
    const data = snapshot({ ISRATIO: [['2025-01-01', 1], ['2025-03-01', 1.2]], BUSINV: [['2024-03-01', 1000000], ['2025-02-01', 1500000], ['2025-03-01', 2000000]] });
    expect(inventoryAnalytics(data).at(-1)).toMatchObject({ ratio: 1.2, change: null, inventoryBillions: 2000, inventoryChange: 500, inventoryYoy: 100 });
  });
  it('uses same-month counts for labor tightness and retains unmatched releases', () => {
    const data = snapshot({ JTSJOL: [['2025-01-01', 8000]], UNEMPLOY: [['2025-01-01', 4000], ['2025-02-01', 5000]], UNRATE: [['2025-01-01', 4]] });
    expect(laborAnalytics(data)[0]).toMatchObject({ vacancies: 8, unemployed: 4, tightness: 2, vacancyGap: 4 });
    expect(laborAnalytics(data)[1]).toMatchObject({ vacancies: null, unemployed: 5, tightness: null, vacancyGap: null });
  });
  it('does not divide by zero or mistake a missing quarter for quarterly growth', () => {
    const data = snapshot({ OPHNFB: [['2025-01-01', 120]], OUTNFB: [['2024-07-01', 100], ['2025-01-01', 120]], HOANBS: [['2025-01-01', 0]] });
    expect(productivityAnalytics(data).at(-1)).toMatchObject({ reconstructed: null, netLogGrowth: null, residual: null });
  });
  it('reconciles output and hours in additive log changes without annualizing', () => {
    const data = snapshot({ OPHNFB: [['2025-04-01', 110]], OUTNFB: [['2025-01-01', 100], ['2025-04-01', 121]], HOANBS: [['2025-01-01', 100], ['2025-04-01', 110]] });
    const row = productivityAnalytics(data).at(-1)!;
    expect(row.reconstructed).toBeCloseTo(110);
    expect(row.residual).toBeCloseTo(0);
    expect(row.netLogGrowth).toBeCloseTo(Math.log(1.1) * 100);
  });
  it('preserves missing datasets and supplies distinct analytics, not copied tables', () => {
    expect(inventoryAnalytics()).toEqual([]); expect(laborAnalytics()).toEqual([]); expect(productivityAnalytics()).toEqual([]);
    const data = snapshot({ ISRATIO: [['2025-01-01', 1]], JTSJOL: [['2025-01-01', 1]], OPHNFB: [['2025-01-01', 1]] });
    const schemas = [inventoryAnalytics, laborAnalytics, productivityAnalytics].map(fn => Object.keys(fn(data)[0]).sort().join(','));
    expect(new Set(schemas).size).toBe(3);
  });
});
