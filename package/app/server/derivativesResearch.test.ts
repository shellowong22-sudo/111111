import { describe, expect, it } from 'vitest';
import { DERIVATIVE_MODULE_IDS, filterCotSnapshotCategories, parseFredCsv, summarizeObservedRange } from './routers/derivativesResearch';

describe('derivatives public research layer', () => {
  it('keeps every protected derivatives workspace in the explicit public-research contract', () => {
    expect(DERIVATIVE_MODULE_IDS).toEqual(['ov', 'oils', 'fom', 'wbf-ai', 'credit-monitor', 'cdsw', 'vca', 'mars', 'ovcv', 'dlib', 'moso', 'ovml']);
  });

  it('parses only actual numeric FRED observations and does not fabricate missing values', () => {
    expect(parseFredCsv('DATE,VIXCLS\n2026-08-17,15.25\n2026-08-18,.\n2026-08-19,14.89\n')).toEqual([
      { date: '2026-08-17', value: 15.25 },
      { date: '2026-08-19', value: 14.89 },
    ]);
  });

  it('compares only observations inside the user-selected range without filling missing dates', () => {
    const points = [{ date: '2026-01-02', value: 18 }, { date: '2026-01-05', value: 20 }, { date: '2026-01-09', value: 15 }];
    expect(summarizeObservedRange(points, '2026-01-03', '2026-01-08')).toMatchObject({ count: 1, first: { date: '2026-01-05', value: 20 }, last: { date: '2026-01-05', value: 20 }, min: 20, max: 20, change: 0 });
    expect(summarizeObservedRange(points, '2026-02-01', '2026-02-28')).toMatchObject({ count: 0, first: null, last: null, min: null, max: null, change: null });
  });

  it('keeps all official report categories by default and returns only selected actual categories when filtered', () => {
    const snapshot = { reportDate: '2026-08-11', contract: 'UST BOND - CHICAGO BOARD OF TRADE', openInterest: 1, source: 'CFTC', rows: [{ category: '资产管理人', long: 30, short: 10, net: 20 }, { category: '杠杆基金', long: 12, short: 20, net: -8 }] };
    expect(filterCotSnapshotCategories(snapshot, []).rows.map((row) => row.category)).toEqual(['资产管理人', '杠杆基金']);
    expect(filterCotSnapshotCategories(snapshot, ['杠杆基金']).rows).toEqual([{ category: '杠杆基金', long: 12, short: 20, net: -8 }]);
  });
});
