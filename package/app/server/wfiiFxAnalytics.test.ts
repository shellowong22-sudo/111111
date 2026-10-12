import {describe,it,expect} from 'vitest';
import {fxMetrics,WFII_FX_PAIRS} from '../shared/wfiiFxAnalytics';
import {ECONOMIC_GROUPS} from '../shared/economicObservations';
import {ECONOMIC_API_CONTRACTS} from '../shared/economicApiContracts';
describe('WFII observed FX analytics',()=>{
 it('does not invent missing metrics or a year-to-date base',()=>{
  const r=fxMetrics([{date:'2026-01-02',value:2}]);
  expect(r.change).toBeNull();expect(r.ytd).toBeNull();expect(r.rsi).toBeNull();expect(r.vol).toBeNull();expect(r.support).toBeNull();
 });
 it('uses the last previous-year observation and preserves quote orientation',()=>{
  const r=fxMetrics([{date:'2025-12-30',value:100},{date:'2025-12-31',value:125},{date:'2026-01-02',value:150}]);
  expect(r.ytd).toBeCloseTo(20);expect(r.change).toBeCloseTo(20);expect(r.rate).toBe(150);expect(r.yearBaseDate).toBe('2025-12-31');
 });
 it('sorts and deduplicates periods; flat data is neutral with zero volatility',()=>{
  const p=Array.from({length:21},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,value:1}));
  const r=fxMetrics([...p].reverse().concat(p[0]));
  expect(r.points).toHaveLength(21);expect(r.rsi).toBe(50);expect(r.vol).toBe(0);expect(r.support).toBe(1);expect(r.resistance).toBe(1);
 });
 it('computes Wilder RSI for an increasing series and rejects nonpositive prices',()=>{
  const p=Array.from({length:21},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,value:i+1}));
  const r=fxMetrics([...p,{date:'2026-01-22',value:0},{date:'2026-01-23',value:NaN}]);
  expect(r.rsi).toBe(100);expect(r.signal).toBe('超买');expect(r.vol).toBeGreaterThan(0);expect(r.support).toBe(2);expect(r.resistance).toBe(21);
 });
 it('registers all eight pairs while giving shared source contracts only one owner',()=>{
  expect(WFII_FX_PAIRS.map(([,id])=>id)).toEqual(ECONOMIC_GROUPS['wfii-fx']);
  for(const [,id] of WFII_FX_PAIRS)expect(ECONOMIC_API_CONTRACTS.filter(c=>c.seriesId===id)).toHaveLength(1);
  expect(ECONOMIC_API_CONTRACTS.find(c=>c.seriesId==='DEXJPUS')?.primaryModuleId).toBe('economic-wfii');
 });
});
