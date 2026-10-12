import {ECONOMIC_API_CONTRACTS} from './economicApiContracts';
import type {EconomicSnapshot} from './economicObservations';
type Delivery={itemKey:string;dataset?:{rows:Array<Record<string,unknown>>;metadata:{provider:string;queriedAt?:string|null}}};
export function wfiiStressDeliveryOwner(item:Delivery){
 const ds=item.dataset;if(!ds?.rows.length||!Number.isFinite(Date.parse(ds.metadata.queriedAt??'')))return null;
 const acquired=new Date(ds.metadata.queriedAt!).toISOString();
 if(Date.parse(acquired)>Date.now())return null;
 const contract=ECONOMIC_API_CONTRACTS.find(c=>c.seriesId===ds.rows[0].series&&['STLFSI4','VIXCLS'].includes(c.seriesId));
 if(!contract||ds.metadata.provider!==contract.provider)return null;
 const seen=new Set<string>();
 for(const row of ds.rows){
  const date=String(row.date),time=Date.parse(date);
  if(row.series!==contract.seriesId||row.unit!==contract.unit||typeof row.value!=='number'||!Number.isFinite(row.value)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date||seen.has(date))return null;
  if(date>new Date().toISOString().slice(0,10)||date>acquired.slice(0,10))return null;
  if(contract.seriesId==='VIXCLS'&&row.value<0)return null;
  seen.add(date);
 }
 return 'economic-wfii';
}
export function mergeWfiiStressDelivery(snapshot:EconomicSnapshot|undefined,items:Delivery[]){
 if(!snapshot)return {data:snapshot,applied:[] as string[]};
 const owned=items.filter(i=>wfiiStressDeliveryOwner(i)).sort((a,b)=>Date.parse(a.dataset!.metadata.queriedAt!)-Date.parse(b.dataset!.metadata.queriedAt!));
 const accepted=new Set<Delivery>();
 const series=snapshot.series.map(original=>{
  let result=original;
  for(const item of owned){
   const ds=item.dataset!;if(ds.rows[0].series!==result.id||(result.status==='available'&&Date.parse(ds.metadata.queriedAt!)<Date.parse(result.retrievedAt)))continue;
   const history=new Map(result.history.map(p=>[p.date,p.value]));ds.rows.forEach(r=>history.set(String(r.date),Number(r.value)));
   result={...result,status:'available',error:null,retrievedAt:ds.metadata.queriedAt!,checksum:undefined,updateState:undefined,changes:undefined,history:[...history].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}))};accepted.add(item);
  }
  return result;
 });
 const applied=[...new Set(owned.filter(i=>accepted.has(i)&&i.dataset!.rows.every(r=>series.some(s=>s.id===r.series&&s.history.some(p=>p.date===r.date&&p.value===r.value)))).map(i=>i.itemKey))];
 return {data:{...snapshot,series},applied};
}
