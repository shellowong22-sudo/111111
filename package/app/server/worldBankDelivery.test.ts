import { describe,it,expect } from 'vitest';
import { mergeWorldBankDelivery,worldBankDeliveryOwner,worldBankRenderedDeliveryKeys } from '../shared/worldBankDelivery';

const row={date:'2025-01-01',country:'United States',country_code:'USA',indicator:'BX.KLT.DINV.CD.WD',value:120,unit:'美元',source_updated:'2026-01-01'};
const item=(itemKey:string,value=120,queriedAt='2026-09-19T01:00:00Z')=>({itemKey,dataset:{rows:[{...row,value}],metadata:{provider:'World Bank',queriedAt}}});
const snapshot=()=>({retrievedAt:'2026-09-19T00:00:00Z',series:[{indicator:row.indicator,status:'available',error:null,rows:[{...row,date:'2024-01-01',value:100},{...row}]}]});

describe('international observation delivery reconciliation',()=>{
 it('compares each indicator acquisition time independently of the panel request time',()=>{
  const data={...snapshot(),retrievedAt:'2026-09-19T04:00:00Z',series:[{...snapshot().series[0],retrievedAt:'2026-09-19T00:00:00Z'}]};
  const result=mergeWorldBankDelivery(data,[item('newer-than-cache',145)],'wfii');
  expect(result.accepted.map(i=>i.itemKey)).toEqual(['newer-than-cache']);
  expect(result.series[0].rows.at(-1)?.value).toBe(145);
  expect(result.series[0].retrievedAt).toBe('2026-09-19T01:00:00Z');
  data.retrievedAt='2026-09-19T00:00:00Z';data.series[0].retrievedAt='2026-09-19T02:00:00Z';
  expect(mergeWorldBankDelivery(data,[item('older-than-indicator',145)],'wfii').accepted).toEqual([]);
 });
 it('rejects missing time, duplicate keys, mismatched units and invalid owners',()=>{
  const invalid=item('bad');invalid.dataset.rows.push({...row,value:999});
  expect(worldBankDeliveryOwner(invalid)).toBeNull();
  expect(worldBankDeliveryOwner(item('time',120,''))).toBeNull();
  expect(worldBankDeliveryOwner({...item('unit'),dataset:{...item('unit').dataset,rows:[{...row,unit:'%'}]}})).toBeNull();
  expect(worldBankDeliveryOwner({...item('provider'),dataset:{...item('provider').dataset,metadata:{provider:'Other',queriedAt:'2026-09-19'}}})).toBeNull();
 });
 it('does not acknowledge stale equal values; merges revisions without losing history',()=>{
  const data=snapshot();const before=JSON.stringify(data);
  const result=mergeWorldBankDelivery(data,[item('old-equal',120,'2026-01-01'),item('new',140)],'wfii');
  expect(result.accepted.map(i=>i.itemKey)).toEqual(['new']);
  expect(result.series[0].rows.map(r=>r.value)).toEqual([100,140]);
  expect(JSON.stringify(data)).toBe(before);
 });
 it('orders timestamps by actual instant and rejects superseded values',()=>{
  const result=mergeWorldBankDelivery(snapshot(),[item('latest',150,'2026-09-19T03:00:00Z'),item('earlier',140,'2026-09-19T10:00:00+08:00')],'wfii');
  expect(result.series[0].rows.at(-1)?.value).toBe(150);
  expect(result.accepted.map(i=>i.itemKey)).toEqual(['latest']);
  expect(mergeWorldBankDelivery(snapshot(),[item('wrong-module')],'ectr').accepted).toEqual([]);
 });
 it('restores an unavailable series only from a validated delivery',()=>{
  const data=snapshot();data.series[0].status='unavailable';
  const result=mergeWorldBankDelivery(data,[item('recovered',130)],'wfii');
  expect(result.series[0].status).toBe('available');
  expect(result.series[0].rows).toHaveLength(2);
  expect(mergeWorldBankDelivery(undefined,[item('no-view')],'wfii').accepted).toEqual([]);
 });
 it('confirms only relevant country/year/indicator output and deduplicates keys',()=>{
  const current=item('fdi');
  const old=item('old');old.dataset.rows[0].date='2020-01-01';
  const outflow=item('outflow');outflow.dataset.rows[0].indicator='BM.KLT.DINV.CD.WD';
  expect(worldBankRenderedDeliveryKeys([current,current,old,outflow],'fdi','ALL','2025')).toEqual(['fdi']);
  expect(worldBankRenderedDeliveryKeys([current],'fdi','CHN','2025')).toEqual([]);
  expect(worldBankRenderedDeliveryKeys([old],'flows','USA','2025')).toEqual(['old']);
  expect(worldBankRenderedDeliveryKeys([current],'flows','CHN','2025')).toEqual(['fdi']);
 });
});
