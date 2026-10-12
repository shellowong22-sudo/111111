import { describe, expect, it } from 'vitest';
import { ecsuDeliveryOwner, mergeEcsuDelivery } from '../shared/ecsuDelivery';
import type { EconomicSnapshot } from '../shared/economicObservations';
const input: EconomicSnapshot = { retrievedAt:'2026-09-19T10:00:00Z', series:[{id:'BUSINV',label:'库存',unit:'百万美元',frequency:'月度',sourceUrl:'',retrievedAt:'2026-09-19T10:00:00Z',status:'available',error:null,checksum:'old',history:[{date:'2026-06-01',value:10},{date:'2026-07-01',value:11}]}] };
const delivery = (value=12, time='2026-09-19T11:00:00Z', key='one') => ({itemKey:key,dataset:{metadata:{provider:'FRED',queriedAt:time},rows:[{series:'BUSINV',unit:'百万美元',date:'2026-07-01',value}]}});
describe('ECSU original-view delivery',()=>{
  it('merges an observation once, preserves other dates, invalidates stale checksum',()=>{
    const result=mergeEcsuDelivery(input,[delivery(),delivery()],3);
    expect(result.data?.series[0].history).toEqual([{date:'2026-06-01',value:10},{date:'2026-07-01',value:12}]);
    expect(result.data?.series[0].checksum).toBeUndefined();
    expect(result.applied).toEqual(['one']);
    expect(input.series[0].history[1].value).toBe(11);
  });
  it('does not acknowledge a hidden subfunction or pre-load delivery',()=>{
    expect(mergeEcsuDelivery(input,[delivery()],4).applied).toEqual([]);
    expect(mergeEcsuDelivery(undefined,[delivery()],3).applied).toEqual([]);
    expect(mergeEcsuDelivery(input,[delivery()],3).applied).toEqual(['one']);
  });
  it('rejects older snapshots and converges independently of delivery order',()=>{
    const old=delivery(4,'2026-09-19T09:00:00Z','old');
    expect(mergeEcsuDelivery(input,[old],3).data?.series[0].history[1].value).toBe(11);
    expect(mergeEcsuDelivery(input,[old],3).applied).toEqual([]);
    expect(mergeEcsuDelivery(input,[delivery(11,'2026-09-19T09:00:00Z','old-same-value')],3).applied).toEqual([]);
    const newer=delivery(13,'2026-09-19T12:00:00Z','new');
    const a=mergeEcsuDelivery(input,[newer,delivery(),old],3);
    const b=mergeEcsuDelivery(input,[old,delivery(),newer],3);
    expect(a).toEqual(b); expect(a.applied).toEqual(['new']);
  });
  it('rejects unit, provider, series, invalid calendar dates and conflicting duplicate dates',()=>{
    for(const patch of [{unit:'美元'},{series:'WALCL'},{date:'2026-02-30'},{value:NaN}]){
      const item=delivery(); Object.assign(item.dataset.rows[0],patch); expect(ecsuDeliveryOwner(item)).toBeNull();
    }
    const item=delivery();item.dataset.metadata.provider='other';expect(ecsuDeliveryOwner(item)).toBeNull();
    const duplicate=delivery();duplicate.dataset.rows.push({...duplicate.dataset.rows[0],value:999});expect(ecsuDeliveryOwner(duplicate)).toBeNull();
  });
});
