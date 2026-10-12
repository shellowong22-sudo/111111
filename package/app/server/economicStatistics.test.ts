import { describe, expect, it } from 'vitest';
import { annualizeQuarterlyRate, projectStatisticHistory, summarizeAnnualizedQuarterlyGrowth, summarizeMonthlyRate, summarizeQuarterlyGrowth } from '../shared/economicStatistics';

describe('ECST archive transformations', () => {
  it('keeps quarterly rate observations available for GDP drilldown', () => {
    expect(projectStatisticHistory([
      { date: '2025-Q4', payload: { value: 0.3 } },
      { date: '2026-Q1', payload: { value: 0.6 } },
    ], 'rate')).toEqual([
      { date: '2025-Q4', value: 0.3, level: 0.3, base: null },
      { date: '2026-Q1', value: 0.6, level: 0.6, base: null },
    ]);
  });
  it('derives GDP momentum and four-quarter compound growth only from contiguous quarters', () => {
    const summary = summarizeQuarterlyGrowth([
      { date: '2025-Q3', value: 0.3 }, { date: '2025-Q4', value: 0.2 },
      { date: '2026-Q1', value: 0 }, { date: '2026-Q2', value: 0.6 },
    ]);
    expect(summary.momentumPp).toBeCloseTo(0.6);
    expect(summary.trailing4Compound).toBeCloseTo(((1.003 * 1.002 * 1 * 1.006) - 1) * 100);
    expect(summary).toMatchObject({positiveQuarters:3,negativeQuarters:0,unchangedQuarters:1,rangeLow:0,rangeHigh:0.6});
    expect(summarizeQuarterlyGrowth([{date:'2025-Q4',value:0.2},{date:'2026-Q2',value:0.6}]).momentumPp).toBeNull();
  });
  it('annualizes Japanese quarterly GDP without mixing its raw quarterly rate into the annualized contract', () => {
    expect(annualizeQuarterlyRate(0.5)).toBeCloseTo((1.005 ** 4 - 1) * 100);
    expect(annualizeQuarterlyRate(-100)).toBeNull();
    const history = projectStatisticHistory([
      {date:'2025-07-01',payload:{value:annualizeQuarterlyRate(-0.3)}},
      {date:'2025-10-01',payload:{value:annualizeQuarterlyRate(0.2)}},
      {date:'2026-01-01',payload:{value:annualizeQuarterlyRate(0.4)}},
      {date:'2026-04-01',payload:{value:annualizeQuarterlyRate(0.3)}},
    ], 'quarterly-rate');
    expect(history.map(row => row.date)).toEqual(['2025-Q3','2025-Q4','2026-Q1','2026-Q2']);
    const summary = summarizeAnnualizedQuarterlyGrowth(history);
    expect(summary.latestQuarterlyEquivalent).toBeCloseTo(0.3);
    expect(summary.trailing4ActualGrowth).toBeCloseTo(((0.997 * 1.002 * 1.004 * 1.003) - 1) * 100);
    expect(summary.positiveQuarters).toBe(3);
  });
  it('derives unemployment rolling observations without filling missing months', () => {
    const history = Array.from({length:13},(_,index)=>{
      const monthIndex = 2025 * 12 + 6 + index;
      return {date:`${Math.floor(monthIndex / 12)}-${String(monthIndex % 12 + 1).padStart(2,'0')}`,value:2.5 + index * 0.01};
    });
    const summary = summarizeMonthlyRate(history);
    expect(summary.latest?.value).toBeCloseTo(2.62);
    expect(summary.average3m).toBeCloseTo((2.60 + 2.61 + 2.62) / 3);
    expect(summary.change12mPp).toBeCloseTo(0.12);
    expect(summarizeMonthlyRate([{date:'2026-01',value:2.4},{date:'2026-03',value:2.5},{date:'2026-04',value:2.6}]).average3m).toBeNull();
  });
  it('calculates year-on-year change against the exact same calendar month', () => {
    const result = projectStatisticHistory([{date:'2024-02-01',payload:{value:100}}, {date:'2025-01-01',payload:{value:120}}, {date:'2025-02-01',payload:{value:103}}], 'yoy');
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(3);
  });
  it('converts monthly payroll changes from thousands to ten thousands, not employment levels', () => {
    const result = projectStatisticHistory([{date:'2024-12-01',payload:{value:150000}}, {date:'2025-01-01',payload:{value:150120}}, {date:'2025-03-01',payload:{value:150200}}], 'payroll-change');
    expect(result[1].value).toBe(12);
    expect(result[2].value).toBeNull();
  });
  it('rejects strings, nonfinite values, invalid periods and selects one revision per month', () => {
    const result = projectStatisticHistory([{date:'2025-01',payload:{value:4}}, {date:'2025-01',payload:{value:4.1}}, {date:'2025-02',payload:{value:'4'}}, {date:'2025-13',payload:{value:5}}, {date:'2025-03',payload:{value:NaN}}], 'rate');
    expect(result).toEqual([{date:'2025-01',value:4.1,level:4.1,base:null}]);
  });
});
