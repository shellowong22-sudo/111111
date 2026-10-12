import {describe,it,expect} from 'vitest';
import {economicDrilldown,ECONOMIC_DRILL_FIELDS} from '../shared/economicDrilldown';
import {ECONOMIC_SERIES,type EconomicSnapshot,type EconomicSeriesId} from '../shared/economicObservations';
const fixture=(histories:Partial<Record<EconomicSeriesId,Array<{date:string;value:number}>>>):EconomicSnapshot=>({retrievedAt:'2026-09-19',series:Object.entries(histories).map(([id,history])=>({id,label:ECONOMIC_SERIES[id as EconomicSeriesId][0],unit:'test',frequency:'test',sourceUrl:'',retrievedAt:'2026-09-19',status:'available',error:null,history:history!}))});
describe('distinct economic drilldown responsibilities',()=>{
 it('does not expose unrelated or duplicate source histories in missing-input tabs',()=>{
  expect(ECONOMIC_DRILL_FIELDS.ecsu[0]).toEqual([]);expect(ECONOMIC_DRILL_FIELDS.fcon[1]).toEqual([]);expect(ECONOMIC_DRILL_FIELDS.tayl[5]).toEqual([]);
 });
 it('uses a different output schema for every field within each economic function',()=>{
  for(const group of ['fcon','ecsu','tayl','fdsp','cbrt'] as const){
   const ids=[...new Set(ECONOMIC_DRILL_FIELDS[group].flat())];
   const schemas=ids.map(id=>JSON.stringify(economicDrilldown(group,id,fixture({})).columns));
   expect(new Set(schemas).size).toBe(schemas.length);
  }
 });
 it('extracts tightening events instead of redisplaying the original time series',()=>{
  const data=fixture({NFCI:[{date:'2024-01-01',value:-1},{date:'2024-01-08',value:.3},{date:'2024-01-15',value:.8},{date:'2024-01-22',value:-.1}]});
  expect(economicDrilldown('fcon','NFCI',data).rows).toEqual([{start:'2024-01-08',end:'2024-01-15',weeks:2,peak:.8,status:'已退出收紧区'}]);
 });
 it('separates model GDP gaps, potential growth and inflation base-period calculations',()=>{
  const data=fixture({GDPC1:[{date:'2024-01-01',value:102}],GDPPOT:[{date:'2024-01-01',value:100}],CPIAUCSL:[{date:'2023-01-01',value:100},{date:'2024-01-01',value:103}]});
  expect(economicDrilldown('tayl','GDPC1',data).rows[0].gap).toBeCloseTo(2);
  expect(economicDrilldown('tayl','CPIAUCSL',data).rows[1].yoy).toBeCloseTo(3);
  expect(economicDrilldown('tayl','GDPPOT',data).rows[0].potentialGrowth).toBeNull();
 });
});
