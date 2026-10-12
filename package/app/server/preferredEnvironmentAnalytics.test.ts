import { describe, expect, it } from 'vitest';
import { cleanHistory, commonCurve, distribution, seriesStatistics, windowHistory, type EnvironmentSeries } from '../client/src/components/preferredstock/environmentAnalytics';

const series = (id: string, history: Array<{date: string; value: number}>): EnvironmentSeries => ({ id, label: id, group: 'rate', status: 'available', history, value: null, observationDate: null, limitation: 'test data only' });
describe('preferred environment analytical workbench', () => {
  it('sorts and deduplicates observations without inventing missing values', () => {
    expect(cleanHistory([{date:'2026-09-02',value:4}, {date:'2026-09-01',value:3}, {date:'2026-09-02',value:5}, {date:'2026-09-03',value:NaN}])).toEqual([{date:'2026-09-01',value:3}, {date:'2026-09-02',value:5}]);
  });
  it('labels windows as observations and computes basis points and median accurately', () => {
    const data = [{date:'2026-09-01',value:4.1}, {date:'2026-09-02',value:4.15}, {date:'2026-09-05',value:4.2}];
    const stats = seriesStatistics(windowHistory(data, 2));
    expect(stats.count).toBe(2); expect(stats.changeBps).toBeCloseTo(5); expect(stats.median).toBeCloseTo(4.175); expect(stats.percentile).toBe(50);
  });
  it('represents no observations and no distribution as unavailable, not perfect coverage', () => {
    expect(seriesStatistics([])).toMatchObject({count:0,latest:null,median:null,percentile:null,changeBps:null});
    expect(distribution([])).toEqual([]);
  });
  it('includes the maximum exactly once in a histogram', () => {
    const data = Array.from({length:9}, (_,i)=>({date:`2026-09-0${i+1}`,value:i}));
    expect(distribution(data).reduce((sum, row)=>sum+row.count,0)).toBe(9);
    expect(distribution(data).at(-1)?.count).toBe(2);
  });
  it('handles a constant series without zero-width bin errors', () => {
    expect(distribution([{date:'2026-09-01',value:4}, {date:'2026-09-02',value:4}])).toEqual([{label:'4.000',count:2}]);
  });
  it('compares tenors at a common date and sorts 2,5,10,30 numerically', () => {
    const result = commonCurve(['DGS30','DGS10','DGS2','DGS5'].map((id,index)=>series(id,[{date:'2026-09-01',value:3+index},{date:'2026-09-02',value:4+index},...(id==='DGS30'?[]:[{date:'2026-09-03',value:5+index}])])),1);
    expect(result.date).toBe('2026-09-02'); expect(result.comparisonDate).toBe('2026-09-01');
    expect(result.rows.map(r=>r.tenor)).toEqual([2,5,10,30]);
  });
  it('never substitutes the current curve when comparison history is insufficient', () => {
    expect(commonCurve([series('DGS2',[{date:'2026-09-01',value:4}])]).rows[0].previous).toBeNull();
  });
});
