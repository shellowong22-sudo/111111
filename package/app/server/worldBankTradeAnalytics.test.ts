import {describe,it,expect} from 'vitest';
import {tradeYearAnalytics} from '../shared/worldBankTradeAnalytics';
const row=(indicator:string,year:number,value:number,country_code='USA')=>({indicator,date:`${year}-01-01`,value,country_code});
const ex='NE.EXP.GNFS.CD',im='NE.IMP.GNFS.CD',bal='NE.RSB.GNFS.CD';
describe('existing trade table analytics',()=>{
 it('computes nominal growth, import coverage and a nonzero published-balance reconciliation',()=>{
  const data=[row(ex,2024,100e9),row(ex,2025,120e9),row(im,2024,200e9),row(im,2025,220e9),row(bal,2025,-101e9)];
  const result=tradeYearAnalytics(data,'USA','2025');
  expect(result.exportsYoy).toBeCloseTo(20);expect(result.importsYoy).toBeCloseTo(10);
  expect(result.coverage).toBeCloseTo(54.54545);expect(result.balanceResidual).toBe(-1);
 });
 it('does not fill missing prior years with other countries or older observations',()=>{
  const result=tradeYearAnalytics([row(ex,2023,100),row(ex,2024,80,'CHN'),row(ex,2025,120)],'USA','2025');
  expect(result).toEqual({exportsYoy:null,importsYoy:null,coverage:null,balanceResidual:null});
 });
 it('rejects nonpositive denominators and conflicting data, preserving exact duplicates',()=>{
  const data=[row(ex,2024,0),row(ex,2025,120),row(im,2025,0),row(im,2024,-10)];
  expect(tradeYearAnalytics(data,'USA','2025')).toEqual({exportsYoy:null,importsYoy:null,coverage:null,balanceResidual:null});
  const valid=[row(ex,2024,100),row(ex,2025,120),row(ex,2025,120)];
  expect(tradeYearAnalytics(valid,'USA','2025').exportsYoy).toBeCloseTo(20);
  expect(tradeYearAnalytics([...valid,row(ex,2025,130)],'USA','2025').exportsYoy).toBeNull();
 });
});
