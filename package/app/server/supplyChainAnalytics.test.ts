import { describe, expect, it } from 'vitest';
import { supplyChainAnalytics } from '../shared/supplyChainAnalytics';

describe('GSCPI dedicated analytics', () => {
  it('splits high-pressure episodes at threshold and missing months', () => {
    const result = supplyChainAnalytics([
      {date:'2024-01-31',value:1.1},{date:'2024-02-29',value:1.4},{date:'2024-03-31',value:.9},
      {date:'2024-05-31',value:1.2},{date:'2024-06-30',value:1.3},{date:'2024-07-31',value:1.0},
    ]);
    expect(result.episodes).toHaveLength(2);
    expect(result.episodes[0]).toMatchObject({start:'2024-01-31',end:'2024-02-29',months:2,peak:1.4,peakDate:'2024-02-29',exitDate:'2024-03-31',status:'已降至阈值以内'});
    expect(result.episodes[0].endGap).toBeCloseTo(0);
    expect(result.episodes[1]).toMatchObject({start:'2024-05-31',end:'2024-06-30',months:2,peak:1.3,peakDate:'2024-06-30',exitDate:'2024-07-31',status:'已降至阈值以内'});
    expect(result.episodes[1].endGap).toBeCloseTo(0);
  });
  it('marks turning points without filling missing months', () => {
    const rows = supplyChainAnalytics([{date:'2024-01-31',value:-.2},{date:'2024-02-29',value:.1},{date:'2024-03-31',value:.3},{date:'2024-04-30',value:.2}]).rows;
    expect(rows.map(row=>row.turn)).toEqual(['基期不足','基期不足','上升','由升转降']);
  });
  it('cuts ongoing episodes on missing months and does not treat row count as 12 calendar months',()=>{
    const result=supplyChainAnalytics([{date:'2024-01-31',value:2},{date:'2024-03-31',value:1.5}]);
    expect(result.episodes.map(e=>e.status)).toEqual(['缺月中断','截至末次观察仍高于阈值']);
    expect(result.rows[1].delta).toBeNull();
    expect(result.rows[1].rollingPeak).toBeNull();
  });
  it('calculates a full calendar year peak and inclusive vintage percentile',()=>{
    const points=Array.from({length:12},(_,i)=>({date:`2024-${String(i+1).padStart(2,'0')}-01`,value:i===4?5:i/10}));
    const row=supplyChainAnalytics(points).rows.at(-1)!;
    expect(row.rollingPeak).toBe(5);expect(row.peakGap).toBeCloseTo(-3.9);expect(row.percentile).toBeCloseTo(11/12*100);
  });
});
