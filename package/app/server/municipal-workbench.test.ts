import {describe,it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {calculateMunicipalTool, MUNICIPAL_TOOLS, bondPrice, solveYield, type MunicipalToolId} from '../shared/municipalWorkbench';
import {parseMunicipalTradeFile} from '../shared/municipalTradeFile';
import {issuerDefinitions, parseOfficialCsv} from './municipalWorkbenchData';

describe('municipal financial workspaces',()=>{
  it('prices at par when coupon equals yield and handles zero yield',()=>{
    expect(bondPrice(4,4,10)).toBeCloseTo(100,9);
    expect(bondPrice(4,0,10)).toBeCloseTo(140,9);
    expect(solveYield(0,80,10)).toBeCloseTo(((100/80)**(1/20)-1)*200,8);
  });
  it('inverts present value for TIC',()=>{
    for(const price of [50,98.3,100,149]) expect(bondPrice(4,solveYield(4,price,10),10)).toBeCloseTo(price,8);
  });
  for(const id of Object.keys(MUNICIPAL_TOOLS) as MunicipalToolId[]) {
    it(`${id} produces finite unique rows and responds to its main input`,()=>{
      const a=calculateMunicipalTool(id,{}),f=MUNICIPAL_TOOLS[id].fields[0];
      const b=calculateMunicipalTool(id,{[f.key]:f.value+1});
      expect(a.rows.length).toBeGreaterThan(0);
      expect(new Set(a.rows.map(r=>r.label)).size).toBe(a.rows.length);
      expect(b).not.toEqual(a);
      for(const row of a.rows) for(const n of Object.values(row)) if(typeof n==='number') expect(Number.isFinite(n)).toBe(true);
      expect(a.formula).not.toBe('');
    });
  }
  it('does not accept cross-module fields, NaN or invalid integer periods',()=>{
    expect(()=>calculateMunicipalTool('CDRA',{years:1.5})).toThrow();
    expect(()=>calculateMunicipalTool('BOOM',{coupon:4})).toThrow();
    expect(()=>calculateMunicipalTool('BMA',{tax:NaN})).toThrow();
    expect(()=>calculateMunicipalTool('__proto__' as MunicipalToolId,{})).toThrow();
    expect(()=>calculateMunicipalTool('PICK',{face:0.5})).not.toThrow();
  });
  it('cashflows repay principal once; floating accrual days cover the exact horizon',()=>{
    const a=calculateMunicipalTool('CDRA',{face:200,years:5,frequency:4});
    expect(a.rows.reduce((n,r)=>n+Number(r.principal),0)).toBe(200);
    const b=calculateMunicipalTool('CDRV',{days:31,reset:7});
    expect(b.rows.reduce((n,r)=>n+Number(r.days),0)).toBe(31);
    expect(b.rows.at(-1)?.days).toBe(3);
  });
  it('price drops with rising yields and DV01 is positive',()=>{
    const a=calculateMunicipalTool('SMUN',{});
    expect(a.rows.find(r=>r.shock===100)?.value).toBeLessThan(0);
    expect(a.metrics.find(m=>m.label==='DV01')?.value).toBeGreaterThan(0);
  });
  it('selected tax, recovery and inventory assumptions affect metrics even for existing scenario knots',()=>{
    for(const [id,key,a,b] of [['BMA','tax',30,40],['CACT','recovery',20,60],['BOOM','sale',25,50]] as const)
      expect(calculateMunicipalTool(id,{[key]:a}).metrics).not.toEqual(calculateMunicipalTool(id,{[key]:b}).metrics);
  });
  it('net settlement adds buyer fees and deducts seller fees',()=>{
    const a=calculateMunicipalTool('DEAL',{face:100,price:100,coupon:4,accruedDays:90,fee:10});
    expect(a.metrics[0].value).toBeCloseTo(101.1);
    expect(a.metrics[1].value).toBeCloseTo(100.9);
  });
  it('keeps legacy entry components but removes the stacked common research layer',()=>{
    const base=path.resolve(import.meta.dirname,'..');
    const wrapper=fs.readFileSync(path.join(base,'client/src/components/municipal/MunicipalPreservedModule.tsx'),'utf8');
    expect(wrapper).toContain('MunicipalTerminalWorkbench');
    expect(wrapper).not.toContain('MunicipalResearchLayer');
    expect(wrapper).not.toContain('MunicipalWorkspaceFieldSources');
  });
});
describe('official data integrity',()=>{
  afterEach(()=>vi.useRealTimers());
  it('checks headers, empty values and conflicting dates',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-09T00:00:00Z'));
    expect(parseOfficialCsv('observation_date,CAUR\n2025-01-01,5\n2025-02-01,.\n2025-01-01,5.0\n2099-01-01,9','CAUR')).toEqual([{date:'2025-01-01',value:5},{date:'2025-02-01',value:null}]);
    expect(()=>parseOfficialCsv('DATE,WRONG\n2025-01-01,4','CAUR')).toThrow('SOURCE_SCHEMA_CHANGED');
    expect(()=>parseOfficialCsv('DATE,CAUR\n2025-01-01,.','CAUR')).toThrow('SOURCE_EMPTY');
    expect(()=>parseOfficialCsv('DATE,CAUR\n2025-01-01,5\n2025-01-01,6','CAUR')).toThrow('SOURCE_DUPLICATE_DATE_CONFLICT');
  });
  it('never substitutes New York state data for New York City',()=>{
    expect(issuerDefinitions('NYC').map(s=>s.id)).toEqual(['NYNEWY1URN']);
    expect(issuerDefinitions('CA').map(s=>s.id)).toEqual(['CAUR','CAPOP','CAPCPI','CANGSP']);
  });
});
describe('authorized-file cleaning',()=>{
  const header='id,price,quantity,yield\n';
  it('deduplicates equivalent numeric values',()=>{
    const a=parseMunicipalTradeFile(header+'TEST-1,100,1000,4\nTEST-1,100.00,1000.0,4.0');
    expect(a.duplicates).toBe(1);expect(a.rows).toHaveLength(1);
  });
  it('rejects conflicting IDs without silently retaining one version',()=>{
    const a=parseMunicipalTradeFile(header+'TEST-1,100,1000,4\nTEST-1,99,1000,4');
    expect(a.rows).toHaveLength(0);expect(a.errors[0]).toContain('标识冲突');
  });
  it('handles quoted identifiers and rejects broken CSV and invalid prices',()=>{
    expect(parseMunicipalTradeFile(header+'"TEST,1",100,1000,4').rows[0].label).toBe('TEST,1');
    expect(parseMunicipalTradeFile(header+'"TEST-1,100,1000,4').errors.length).toBeGreaterThan(0);
    expect(parseMunicipalTradeFile(header+'TEST-1,0,1000,4').rows).toEqual([]);
    expect(parseMunicipalTradeFile(header+'TEST-1,100,0,4').errors.length).toBe(1);
  });
  it('does not silently truncate an over-limit input',()=>{
    const a=parseMunicipalTradeFile(header+Array.from({length:1001},(_,i)=>`TEST-${i},100,1000,4`).join('\n'));
    expect(a.rows).toHaveLength(0);expect(a.errors.join()).toContain('超过1000行');
  });
});

describe('municipal cash obligation boundaries', () => {
  it('carries unpaid interest into subsequent years instead of losing it', () => {
    const a = calculateMunicipalTool('MCAL', { face: 100, coupon: 4, years: 3, cash: 1, growth: 0 });
    expect(a.rows.map(r => r.arrears)).toEqual([3, 6, 9]);
    expect(a.rows.map(r => r.dueInterest)).toEqual([4, 7, 10]);
    expect(a.rows.at(-1)?.shortfall).toBe(109);
  });
  it('pays all arrears before reducing principal and conserves cash', () => {
    const a = calculateMunicipalTool('MCAL', { face: 100, coupon: 4, years: 8, cash: 3, growth: 50 });
    for (const r of a.rows) {
      expect(Number(r.interest) + Number(r.principal) + Number(r.value)).toBeCloseTo(Number(r.cash));
      if (Number(r.arrears) > 0) expect(r.principal).toBe(0);
    }
  });
  it('rejects a schedule that implies a negative coupon rather than showing negative interest', () => {
    expect(() => calculateMunicipalTool('PICK', { coupon: 0.2, batches: 4, step: -100 })).toThrow('票息低于0');
  });
});
