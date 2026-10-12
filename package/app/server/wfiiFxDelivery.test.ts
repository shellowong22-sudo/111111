import {describe,it,expect} from 'vitest';
import {mergeWfiiFxDelivery,wfiiFxDeliveryOwner} from '../shared/wfiiFxDelivery';
import type {EconomicSeries} from '../shared/economicObservations';
const series:EconomicSeries={id:'DEXJPUS',label:'日元每美元',unit:'日元/美元',frequency:'工作日',sourceUrl:'',retrievedAt:'2026-09-19T01:00:00Z',status:'available',error:null,history:[{date:'2026-09-17',value:140}]};
const item={itemKey:'fx-push',dataset:{metadata:{provider:'FRED',queriedAt:'2026-09-19T02:00:00Z'},rows:[{series:'DEXJPUS',date:'2026-09-17',value:141,unit:'日元/美元'}]}};
describe('WFII in-place delivery and ACK eligibility',()=>{
 it('integrates a newer delivery once and makes its exact applied identity acknowledgeable',()=>{
  const r=mergeWfiiFxDelivery([series],[item,item]);expect(r.series[0].history).toEqual([{date:'2026-09-17',value:141}]);expect(new Set(r.applied)).toEqual(new Set(['fx-push']));
 });
 it('never overwrites newer source data or ACKs a conflicting stale payload',()=>{
  const old={...item,dataset:{...item.dataset,metadata:{...item.dataset.metadata,queriedAt:'2026-09-18T00:00:00Z'}}};
  const r=mergeWfiiFxDelivery([series],[old]);expect(r.series[0].history[0].value).toBe(140);expect(r.applied).toEqual([]);
 });
 it('rejects wrong units, negative quotes and wrong ownership',()=>{
  for(const patch of [{unit:'%'},{value:-1},{series:'CPIAUCSL'}]) expect(wfiiFxDeliveryOwner({...item,dataset:{...item.dataset,rows:[{...item.dataset.rows[0],...patch}]}})).toBeNull();
 });
});
