import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { indexedObservationCurve, normalizeObservationHistory, observationChanges, observationDistribution, observationWindow } from './stockObservationModel';

const history = normalizeObservationHistory([{ date: '2026-01-01', value: 100, volume: 1000 }, { date: '2026-01-02', value: 110, volume: null }, { date: '2026-02-05', value: 105, volume: 1200 }]);

describe('stock observation transformations', () => {
  it('rejects missing/invalid numbers instead of converting them to zero', () => {
    expect(normalizeObservationHistory([{ date: '2026-01-01', value: null }, { date: '2026-01-02', value: NaN }, { date: 'bad', value: 4 }, { date: '2026-01-03', value: '5' }])).toEqual([]);
  });
  it('sorts, deduplicates exact points, and quarantines conflicting dates', () => {
    expect(normalizeObservationHistory([{ date: '2026-01-02', value: 2 }, { date: '2026-01-01', value: 1 }, { date: '2026-01-01', value: 1 }, { date: '2026-01-02', value: 3 }])).toEqual([{ date: '2026-01-01', value: 1, volume: null }]);
  });
  it('retains zero volume but rejects absent and negative volume', () => {
    expect(normalizeObservationHistory([{ date: '2026-01-01', value: 1, volume: 0 }, { date: '2026-01-02', value: 1, volume: -5 }, { date: '2026-01-03', value: 1 }]).map((point) => point.volume)).toEqual([0, null, null]);
  });
  it('computes historical changes only between actual observations', () => {
    const changes = observationChanges(history);
    expect(changes[0].changePct).toBeNull();
    expect(changes[1].changePct).toBe(10);
    expect(changes[2].change).toBe(-5);
    expect(observationChanges([{ date: '2026-01-01', value: 0, volume: null }, { date: '2026-01-02', value: 1, volume: null }])[1].changePct).toBeNull();
  });
  it('distribution counts sum to the original observation population', () => {
    const bins = observationDistribution(history);
    expect(bins.reduce((sum, row) => sum + row.count, 0)).toBe(history.length);
    expect(bins.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(100);
    expect(observationDistribution([{ date: '2026-01-01', value: 5, volume: null }, { date: '2026-01-02', value: 5, volume: null }])).toEqual([{ from: 5, to: 5, label: '5.000', count: 2, share: 100 }]);
  });
  it('uses calendar windows and does not synthesize absent dates', () => {
    expect(observationWindow(history, 30)).toEqual([history[2]]);
    expect(observationWindow(history, null)).toEqual(history);
  });
  it('normalizes only actual positive-base histories', () => {
    expect(indexedObservationCurve(history).map((point) => point.value)).toEqual([100, 110.00000000000001, 105]);
    expect(indexedObservationCurve([{ date: '2026-01-01', value: 0, volume: null }])).toEqual([]);
  });
});

describe('stock workbench structure regressions', () => {
  const source = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  it('renders one active work area rather than the old five-card grid', () => {
    const file = source('./StockResearchLayoutWorkspace.tsx');
    expect(file).toContain('role="tabpanel"');
    expect(file).toContain('ResearchSplit');
    expect(file).not.toContain('<Metric');
    expect(file).not.toContain('lg:grid-cols-2');
    expect(file).toContain('key={`${cik}-${selected?.accessionNumber');
  });
  it('has real-source chart controls and explicit missing-depth boundaries', () => {
    const file = source('./StockObservationDesk.tsx');
    expect(file).toContain('refetchInterval: 60_000');
    expect(file).toContain('refetchOnReconnect: true');
    expect(file).toContain('normalizeObservationHistory');
    expect(file).toContain('observationDistribution');
    expect(file).toContain('<Brush');
    expect(file).toContain('数值热力图');
    expect(file).toContain('买价 / 卖价 / 深度盘口');
    expect(file).toContain('网络已断开');
    expect(file).not.toContain('Math.random');
  });
  it('keeps deep data inside each original page without mounting a parallel research layer', () => {
    const file = source('./StockLegacyLivePanels.tsx');
    const preserved = source('./StockMarketPreservedModule.tsx');
    expect(file).toContain('ResearchSplit');
    expect(file).toContain('ObservationViews');
    expect(file).toContain('getWatchlistObservations.useQuery');
    expect(file).toContain('getIssuerFilings.useQuery');
    expect(preserved).not.toContain('StockMarketResearchLayer');
  });
  it('renders SEC facts by period boundary and filing version without end-date deduplication', () => {
    const file = source('./StockResearchLayoutWorkspace.tsx');
    const panel = file.slice(file.indexOf('function FactsPanel'), file.indexOf('function FilingSummary'));
    expect(panel).toContain('RevenueFromContractWithCustomerExcludingAssessedTax');
    expect(panel).toContain('期间类型筛选');
    expect(panel).toContain('申报版本筛选');
    expect(panel).toContain('row.start');
    expect(panel).toContain('row.durationDays');
    expect(panel).toContain('row.accessionNumber');
    expect(panel).toContain('row.periodType');
    expect(panel).toContain('不混合季度、累计和时点事实');
  });
});
