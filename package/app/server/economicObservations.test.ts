import { describe, expect, it } from 'vitest';
import { parseEconomicCsv,observationChanges,archiveSeries } from './economicObservationService';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import { alignSeries, periodLast, laggedGrowth, pearson } from '../shared/economicObservations';
describe('economic observation integrity', () => {
  it('retains immutable versions and recognizes withdrawn observations',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'economic-archive-test-'));
    try{
      const base={id:'DFF',label:'rate',unit:'%',frequency:'daily',sourceUrl:'https://example.invalid',retrievedAt:'2026-09-19T00:00:00Z',status:'available' as const,error:null,history:[{date:'2024-01-01',value:1},{date:'2024-02-01',value:2}]};
      const first=await archiveSeries(base,dir);expect(first.updateState).toBe('initial');
      const same=await archiveSeries({...base,history:[...base.history].reverse()},dir);expect(same.updateState).toBe('unchanged');
      const changed=await archiveSeries({...base,history:[base.history[1]]},dir);
      expect(changed.changes).toEqual([{date:'2024-01-01',before:1,after:null}]);
      expect(changed.updateState).toBe('changed');
      expect(await readdir(path.join(dir,'DFF'))).toHaveLength(2);
      expect(JSON.parse(await readFile(path.join(dir,'DFF',first.checksum+'.json'),'utf8')).history).toHaveLength(2);
      await writeFile(path.join(dir,'DFF.json'),'broken archive');
      await expect(archiveSeries(base,dir)).rejects.toThrow();
      expect(await readFile(path.join(dir,'DFF.json'),'utf8')).toBe('broken archive');
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('distinguishes identical refreshes, revisions and new periods',()=>{
    const previous=[{date:'2024-01-01',value:1},{date:'2024-02-01',value:2}];
    expect(observationChanges(previous,[...previous].reverse())).toEqual([]);
    expect(observationChanges(previous,[{date:'2024-01-01',value:3},{date:'2024-02-01',value:2},{date:'2024-03-01',value:4}])).toEqual([{date:'2024-01-01',before:1,after:3},{date:'2024-03-01',before:null,after:4}]);
  });
  it('does not turn missing source values into zeros; rejects the wrong schema', () => {
    expect(parseEconomicCsv('observation_date,NFCI\n2024-01-01,.\n2024-01-02,\n2024-01-03,0\n2024-01-04,-0.2', 'NFCI')).toEqual([{date:'2024-01-03',value:0},{date:'2024-01-04',value:-0.2}]);
    expect(()=>parseEconomicCsv('date,value\n2024-01-01,5','NFCI')).toThrow('SOURCE_SCHEMA_MISMATCH');
  });
  it('keeps exact period joins and never forward fills', () => {
    const a=[{date:'2024-01-01',value:5},{date:'2024-02-01',value:6}];
    const b=[{date:'2024-02-01',value:8}];
    expect(alignSeries({a,b})).toEqual([{date:'2024-01-01',a:5,b:null},{date:'2024-02-01',a:6,b:8}]);
    expect(alignSeries({a,b},true)).toHaveLength(1);
  });
  it('uses the last observed point within each month', () => {
    expect(periodLast([{date:'2024-02-01',value:3},{date:'2024-01-05',value:1},{date:'2024-01-26',value:2}])).toEqual([{date:'2024-01',value:2},{date:'2024-02',value:3}]);
  });
  it('pairs future GDP with the correct lagged quarter without lookahead', () => {
    const data=laggedGrowth([{date:'2024-01-05',value:1},{date:'2024-03-29',value:3},{date:'2024-07-05',value:99}],[{date:'2024-07-01',value:2.5}],2);
    expect(data).toEqual([{date:'2024-07-01',fciPeriod:'2024-Q1',x:2,y:2.5}]);
  });
  it('correlation is missing for insufficient or constant samples', () => {
    expect(pearson([{x:1,y:1},{x:2,y:2}])).toBeNull();
    expect(pearson([{x:1,y:1},{x:1,y:2},{x:1,y:3}])).toBeNull();
    expect(pearson([{x:1,y:3},{x:2,y:2},{x:3,y:1}])).toBeCloseTo(-1);
  });
});
