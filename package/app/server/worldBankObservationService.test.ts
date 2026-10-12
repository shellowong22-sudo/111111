import {describe,it,expect,vi,afterEach} from 'vitest';
import {getWorldBankObservations,getWorldBankObservationSnapshot,parseWorldBank} from './worldBankObservationService';
import {WORLD_BANK_CONTRACTS} from '../shared/worldBankContracts';
import {ADMIN_DATA_MODULES} from '../shared/adminDataModules';
const id='NE.EXP.GNFS.CD';
const row=(value:unknown,date='2024')=>({indicator:{id},country:{value:'United States'},countryiso3code:'USA',date,value});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('World Bank official contracts',()=>{
 it('keeps cache acquisition time and explicitly refreshes with request coalescing',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-09-19T00:00:00Z'));
  let value=100;
  const fetch=vi.fn(async()=>({ok:true,json:async()=>[{pages:1},[row(value,'2013')]]}));vi.stubGlobal('fetch',fetch);
  const contract=WORLD_BANK_CONTRACTS.find(c=>c.indicator===id)!;
  const first=await getWorldBankObservationSnapshot(contract.id,'USA',2013,2013);
  clock.mockReturnValue(Date.parse('2026-09-19T00:10:00Z'));value=125;
  const cached=await getWorldBankObservationSnapshot(contract.id,'USA',2013,2013);
  expect(cached.retrievedAt).toBe(first.retrievedAt);expect(cached.rows[0].value).toBe(100);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [fresh,concurrent]=await Promise.all([getWorldBankObservationSnapshot(contract.id,'USA',2013,2013,true),getWorldBankObservationSnapshot(contract.id,'USA',2013,2013,true)]);
  expect(fresh).toEqual(concurrent);expect(fresh.retrievedAt).toBe('2026-09-19T00:10:00.000Z');expect(fresh.rows[0].value).toBe(125);
  expect(fetch).toHaveBeenCalledTimes(2);
  await getWorldBankObservationSnapshot(contract.id,'USA',2013,2013,true);
  expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('failed manual refresh retains the last valid cached observations',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-09-19T00:00:00Z'));
  const fetch=vi.fn(async()=>({ok:true,json:async()=>[{pages:1},[row(90,'2012')]]}));vi.stubGlobal('fetch',fetch);
  const contract=WORLD_BANK_CONTRACTS.find(c=>c.indicator===id)!;
  const first=await getWorldBankObservationSnapshot(contract.id,'USA',2012,2012);
  clock.mockReturnValue(Date.parse('2026-09-19T00:10:00Z'));fetch.mockRejectedValueOnce(new Error('offline'));
  await expect(getWorldBankObservationSnapshot(contract.id,'USA',2012,2012,true)).rejects.toThrow('offline');
  expect(await getWorldBankObservationSnapshot(contract.id,'USA',2012,2012)).toEqual(first);
 });
 it('registers eleven unique indicators owned by existing functions',()=>{
  expect(WORLD_BANK_CONTRACTS).toHaveLength(11);
  expect(new Set(WORLD_BANK_CONTRACTS.map(c=>c.indicator)).size).toBe(11);
  for(const c of WORLD_BANK_CONTRACTS)expect(ADMIN_DATA_MODULES.some(m=>m.id===c.primaryModuleId)).toBe(true);
 });
 it('preserves dates, country, unit and publication date; excludes null observations',()=>{
  expect(parseWorldBank([{pages:1,lastupdated:'2026-07-01'},[row(null),row(100),row(90,'2023')]],id,'美元')).toEqual([
   {date:'2023-01-01',country:'United States',country_code:'USA',indicator:id,value:90,unit:'美元',source_updated:'2026-07-01'},
   {date:'2024-01-01',country:'United States',country_code:'USA',indicator:id,value:100,unit:'美元',source_updated:'2026-07-01'},
  ]);
 });
 it('rejects partial, invalid and mismatched responses',()=>{
  expect(()=>parseWorldBank([{pages:2},[]],id,'美元')).toThrow('INCOMPLETE');
  expect(()=>parseWorldBank({message:'bad'},id,'美元')).toThrow('SCHEMA');
  expect(parseWorldBank([{pages:1},[row(Infinity),row('100'),row(2,'latest'),{...row(1),indicator:{id:'other'}}]],id,'美元')).toEqual([]);
 });
 it('rejects invalid requests before sending network traffic',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(getWorldBankObservations('unknown')).rejects.toThrow('UNKNOWN');
  await expect(getWorldBankObservations(WORLD_BANK_CONTRACTS[0].id,'USA/../../')).rejects.toThrow('COUNTRY');
  await expect(getWorldBankObservations(WORLD_BANK_CONTRACTS[0].id,'USA',2050,2010)).rejects.toThrow('YEAR');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('coalesces concurrent identical requests and caches actual observations',async()=>{
  const fetch=vi.fn(async()=>({ok:true,json:async()=>[{pages:1},[row(123,'2014')]]}));vi.stubGlobal('fetch',fetch);
  const contract=WORLD_BANK_CONTRACTS.find(c=>c.indicator===id)!;
  const [a,b]=await Promise.all([getWorldBankObservations(contract.id,'USA',2014,2014),getWorldBankObservations(contract.id,'usa,USA',2014,2014)]);
  expect(a).toEqual(b);expect(a[0].value).toBe(123);expect(fetch).toHaveBeenCalledTimes(1);
 });
});
