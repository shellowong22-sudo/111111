import {ECONOMIC_API_CONTRACTS} from './economicApiContracts';
import type {EconomicSeries} from './economicObservations';
import {WFII_FX_PAIRS} from './wfiiFxAnalytics';
type Delivery={itemKey:string;dataset?:{rows:Array<Record<string,unknown>>;metadata:{provider:string;queriedAt?:string|null}}};
export function wfiiFxDeliveryOwner(item:Delivery){
 const ds=item.dataset;if(ds?.metadata.provider!=='FRED'||!ds.rows.length)return null;
 const ids=new Set(ds.rows.map(r=>r.series));if(ids.size!==1)return null;
 const c=ECONOMIC_API_CONTRACTS.find(c=>c.seriesId===ds.rows[0].series&&c.primaryModuleId==='economic-wfii');
 if(!c||!WFII_FX_PAIRS.some(([,id])=>id===c.seriesId))return null;
 if(!Number.isFinite(Date.parse(ds.metadata.queriedAt??'')))return null;
 if(ds.rows.some(r=>r.unit!==c.unit||typeof r.value!=='number'||!Number.isFinite(r.value)||r.value<=0||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))||!Number.isFinite(Date.parse(String(r.date)))))return null;
 return 'economic-wfii';
}
export function mergeWfiiFxDelivery(series:EconomicSeries[],items:Delivery[]){
 const owned=items.filter(i=>wfiiFxDeliveryOwner(i));
 const merged=series.map(s=>{
  let retrievedAt=s.retrievedAt;const values=new Map(s.history.map(p=>[p.date,p.value]));
  for(const item of [...owned].sort((a,b)=>Date.parse(a.dataset!.metadata.queriedAt!)-Date.parse(b.dataset!.metadata.queriedAt!))){
   const ds=item.dataset!;if(ds.rows[0].series!==s.id)continue;
   if(s.status==='available'&&Date.parse(ds.metadata.queriedAt!)<Date.parse(retrievedAt))continue;
   for(const r of ds.rows)values.set(String(r.date),Number(r.value));
   retrievedAt=ds.metadata.queriedAt!;
  }
  return {...s,retrievedAt,status:values.size?'available' as const:s.status,history:[...values].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}))};
 });
 const applied=owned.filter(item=>item.dataset!.rows.every(r=>merged.some(s=>s.id===r.series&&s.history.some(p=>p.date===r.date&&p.value===r.value)))).map(i=>i.itemKey);
 return {series:merged,applied};
}
