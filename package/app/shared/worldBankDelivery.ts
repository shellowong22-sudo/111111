import {WORLD_BANK_CONTRACTS,WORLD_BANK_COUNTRIES} from './worldBankContracts';
type Feed={itemKey:string;dataset?:{rows:Array<Record<string,unknown>>;metadata:{provider:string;queriedAt?:string|null}}};
export function worldBankDeliveryOwner(item:Feed):string|null{
 const ds=item.dataset;if(ds?.metadata.provider!=='World Bank'||!ds.rows.length||!Number.isFinite(Date.parse(ds.metadata.queriedAt??'')))return null;
 const ids=new Set(ds.rows.map(r=>r.indicator));if(ids.size!==1)return null;
 const c=WORLD_BANK_CONTRACTS.find(c=>c.indicator===ds.rows[0].indicator);
 if(!c||ds.rows.some(r=>typeof r.value!=='number'||!Number.isFinite(r.value)||r.unit!==c.unit||!WORLD_BANK_COUNTRIES.includes(r.country_code as any)||!/^\d{4}-01-01$/.test(String(r.date))))return null;
 if(new Set(ds.rows.map(r=>`${r.country_code}|${r.date}`)).size!==ds.rows.length)return null;
 return c.primaryModuleId;
}

type Observation = { date:string; country:string; country_code:string; indicator:string; value:number; unit:string; source_updated:string|null };
type Series = { indicator:string; status:string; error:string|null; retrievedAt?:string|null; rows:Observation[] };

/** Partial delivery updates only its observation keys; old snapshots never count as applied. */
export function mergeWorldBankDelivery<S extends Series>(snapshot:{retrievedAt:string;series:S[]}|undefined,items:Feed[],group:'ectr'|'wfii') {
 if(!snapshot)return {series:[] as S[],accepted:[] as Feed[]};
 const owned=items.filter(item=>worldBankDeliveryOwner(item)===`economic-${group}`).sort((a,b)=>Date.parse(a.dataset!.metadata.queriedAt!)-Date.parse(b.dataset!.metadata.queriedAt!));
 const candidates=new Set<Feed>();
 const series=snapshot.series.map(original=>{
  let result=original;
  // A failed recheck does not make the retained valid history older than an
  // already-received payload. Preserve its timestamp barrier across failures.
  const priorTime=Date.parse(original.retrievedAt??snapshot.retrievedAt);
  let checkedAt=original.rows.length&&Number.isFinite(priorTime)?priorTime:-Infinity;
  const rows=new Map(original.rows.map(r=>[`${r.country_code}|${r.date}`,r]));
  for(const item of owned){
   const ds=item.dataset!;
   const incomingAt=Date.parse(ds.metadata.queriedAt!);
   if(ds.rows[0].indicator!==original.indicator||incomingAt<checkedAt)continue;
   for(const row of ds.rows)rows.set(`${row.country_code}|${row.date}`,row as unknown as S['rows'][number]);
   checkedAt=incomingAt;candidates.add(item);
   result={...result,status:'available',error:null,retrievedAt:ds.metadata.queriedAt};
  }
  return {...result,rows:[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.country_code.localeCompare(b.country_code))};
 });
 const accepted=owned.filter(item=>candidates.has(item)&&item.dataset!.rows.every(r=>series.some(s=>s.indicator===r.indicator&&s.rows.some(v=>v.date===r.date&&v.country_code===r.country_code&&v.value===r.value&&v.unit===r.unit))));
 return {series,accepted};
}

export function worldBankRenderedDeliveryKeys(items:Feed[],mode:'balance'|'flows'|'fdi',country:string,year:string) {
 return [...new Set(items.filter(item=>{
  const rows=item.dataset?.rows??[];
  if(!rows.length)return false;
  if(mode==='fdi')return rows.every(r=>r.indicator==='BX.KLT.DINV.CD.WD')&&rows.some(r=>(country==='ALL'||r.country_code===country)&&[year,String(Number(year)-1)].includes(String(r.date).slice(0,4)));
  // History uses all periods of the selected country; comparison uses the selected year across countries.
  return rows.some(r=>r.country_code===country||String(r.date).slice(0,4)===year);
 }).map(item=>item.itemKey))];
}
