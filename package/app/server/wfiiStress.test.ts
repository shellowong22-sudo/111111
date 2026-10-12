import {describe,it,expect} from 'vitest';
import {stressHistory} from '../shared/wfiiStressAnalytics';
import {mergeWfiiStressDelivery,wfiiStressDeliveryOwner} from '../shared/wfiiStressDelivery';
import {ECONOMIC_API_CONTRACTS} from '../shared/economicApiContracts';
import type {EconomicSnapshot} from '../shared/economicObservations';

const contract=ECONOMIC_API_CONTRACTS.find(c=>c.seriesId==='STLFSI4')!;
const row={series:'STLFSI4',date:'2025-01-03',value:-0.8,unit:'标准差'};
const item=(itemKey='one',value=-0.8,queriedAt='2025-01-05T00:00:00Z')=>({itemKey,dataset:{rows:[{...row,value}],metadata:{provider:contract.provider,queriedAt}}});
const snapshot: EconomicSnapshot={retrievedAt:'2025-01-04T00:00:00Z',series:[{id:'STLFSI4',label:'美国金融压力指数',unit:'标准差',frequency:'周度',sourceUrl:'',retrievedAt:'2025-01-04T00:00:00Z',status:'available',error:null,history:[{date:'2024-12-27',value:-1},{date:'2025-01-03',value:-0.9}]}]};
describe('WFII financial stress analytics',()=>{
 it('uses trailing observations, preserving gaps and requiring a full percentile window',()=>{
  const points=[{date:'2025-01-17',value:3},{date:'2025-01-03',value:1},{date:'2025-01-10',value:2}];
  const result=stressHistory(points,3);
  expect(result[0].percentile).toBeNull();expect(result[1].high).toBeNull();
  expect(result[2]).toMatchObject({previous:2,previousDate:'2025-01-10',change:1,percentile:100,high:3,low:1,samples:3});
  expect(points[0].date).toBe('2025-01-17');
 });
 it('retains negative FSI values and handles finite-only samples',()=>{
  expect(stressHistory([{date:'2025-01-01',value:NaN},{date:'2025-01-03',value:-1}],1)[0]).toMatchObject({value:-1,percentile:100,previous:null});
 });
 it.each([0,-1,1.2,NaN])('rejects invalid window %s',w=>expect(()=>stressHistory([],w)).toThrow('INVALID_STRESS_WINDOW'));
});
describe('WFII stress data ownership and delivery',()=>{
 it('owns only real matching indicators and permits negative FSI',()=>{
  expect(wfiiStressDeliveryOwner(item())).toBe('economic-wfii');
  const vix=item();vix.dataset.rows=[{series:'VIXCLS',date:row.date,value:-1,unit:'指数点'}];
  expect(wfiiStressDeliveryOwner(vix)).toBeNull();
  vix.dataset.rows[0].value=15;expect(wfiiStressDeliveryOwner(vix)).toBe('economic-wfii');
 });
 it('rejects mixed, duplicate, wrong-unit, provider and invalid dates',()=>{
  const variants=[
   {...item(),dataset:{...item().dataset,rows:[row,row]}},
   {...item(),dataset:{...item().dataset,rows:[row,{...row,series:'VIXCLS',date:'2025-01-02'}]}},
   {...item(),dataset:{...item().dataset,rows:[{...row,unit:'美元'}]}},
   {...item(),dataset:{...item().dataset,metadata:{provider:'invalid',queriedAt:'2025-01-05'}}},
   ...['2025-02-30','2099-01-01','2025-01-06'].map(date=>({...item(),dataset:{...item().dataset,rows:[{...row,date}]}})),
   item('future',1,'2099-01-01'),item('invalid',1,'invalid'),
  ];
  variants.forEach(v=>expect(wfiiStressDeliveryOwner(v)).toBeNull());
 });
 it('merges in acquisition order, preserves history, rejects stale-same and ACKs only surviving values',()=>{
  const result=mergeWfiiStressDelivery(snapshot,[item('new',-0.6,'2025-01-07'),item('old',-0.7,'2025-01-06'),item('stale',-0.9,'2025-01-01')]);
  expect(result.data?.series[0].history).toEqual([{date:'2024-12-27',value:-1},{date:row.date,value:-0.6}]);
  expect(result.applied).toEqual(['new']);
  expect(snapshot.series[0].history[1].value).toBe(-0.9);
 });
 it('deduplicates repeated keys, never ACKs without a base snapshot',()=>{
  expect(mergeWfiiStressDelivery(snapshot,[item(),item()]).applied).toEqual(['one']);
  expect(mergeWfiiStressDelivery(undefined,[item()]).applied).toEqual([]);
 });
 it('maps both dedicated stress APIs to WFII',()=>{
  expect(ECONOMIC_API_CONTRACTS.filter(c=>['STLFSI4','VIXCLS'].includes(c.seriesId)).map(c=>c.primaryModuleId)).toEqual(['economic-wfii','economic-wfii']);
 });
});
