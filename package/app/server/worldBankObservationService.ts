import { WORLD_BANK_CONTRACTS,WORLD_BANK_COUNTRIES } from '../shared/worldBankContracts';
export type WorldBankObservation={date:string;country:string;country_code:string;indicator:string;value:number;unit:string;source_updated:string|null};
type Observation=WorldBankObservation;
export type WorldBankSnapshot={retrievedAt:string;rows:Observation[]};
export type WorldBankPanelSeries=(typeof WORLD_BANK_CONTRACTS)[number]&{status:'available'|'unavailable';error:string|null;retrievedAt:string|null;rows:Observation[]};
export type WorldBankPanelSnapshot={group:'ectr'|'wfii';retrievedAt:string;frequency:'年度';series:WorldBankPanelSeries[]};
const cache=new Map<string,{at:number;snapshot:WorldBankSnapshot}>();
const pending=new Map<string,Promise<WorldBankSnapshot>>();
export function parseWorldBank(payload:unknown,indicator:string,unit:string):Observation[]{
 if(!Array.isArray(payload)||!payload[0]||!Array.isArray(payload[1]))throw new Error('WORLDBANK_SCHEMA_MISMATCH');
 const records=payload[1] as any[];
 if(Number(payload[0].pages)>1)throw new Error('WORLDBANK_RESPONSE_INCOMPLETE');
 return records.flatMap(row=>{
   if(row.indicator?.id!==indicator||!/^[0-9]{4}$/.test(row.date??'')||typeof row.value!=='number'||!Number.isFinite(row.value))return [];
   return [{date:`${row.date}-01-01`,country:String(row.country?.value??''),country_code:String(row.countryiso3code??''),indicator,value:row.value,unit,source_updated:payload[0].lastupdated??null}];
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.country_code.localeCompare(b.country_code));
}
export async function getWorldBankObservationSnapshot(id:string,country:string='USA',startYear:number=2015,endYear:number=new Date().getUTCFullYear(),refresh=false){
 const contract=WORLD_BANK_CONTRACTS.find(c=>c.id===id);if(!contract)throw new Error('WORLDBANK_UNKNOWN_CONTRACT');
 const codes=country.split(',').map(s=>s.trim().toUpperCase());
 if(!codes.length||codes.length>40||codes.some(c=>!(WORLD_BANK_COUNTRIES as readonly string[]).includes(c)))throw new Error('WORLDBANK_COUNTRY_NOT_ALLOWLISTED');
 if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||startYear<1960||endYear>new Date().getUTCFullYear()||endYear<startYear||endYear-startYear>50)throw new Error('WORLDBANK_INVALID_YEAR_RANGE');
 const unique=[...new Set(codes)].sort();const key=[id,unique.join(';'),startYear,endYear].join('|');const hit=cache.get(key);
 if(pending.has(key))return pending.get(key)!;
 // A cache read must retain its acquisition time. Briefly coalesce manual refreshes too.
 if(hit&&Date.now()-hit.at<(refresh?5000:3600_000))return hit.snapshot;
 const request=(async()=>{
  const url=`https://api.worldbank.org/v2/country/${unique.join(';')}/indicator/${contract.indicator}?format=json&per_page=20000&date=${startYear}:${endYear}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error(`WORLDBANK_HTTP_${response.status}`);
  const rows=parseWorldBank(await response.json(),contract.indicator,contract.unit).filter(row=>unique.includes(row.country_code));if(!rows.length)throw new Error('WORLDBANK_NO_OBSERVATIONS');
  if(cache.size>=128)cache.delete(cache.keys().next().value!);
  const at=Date.now();const snapshot={retrievedAt:new Date(at).toISOString(),rows};
  cache.set(key,{at,snapshot});return snapshot;
 })();pending.set(key,request);
 try{return await request;}finally{pending.delete(key);}
}
export async function getWorldBankObservations(id:string,country:string='USA',startYear:number=2015,endYear:number=new Date().getUTCFullYear()){
 return (await getWorldBankObservationSnapshot(id,country,startYear,endYear)).rows;
}
export async function getWorldBankPanel(group:'ectr'|'wfii',refresh=false):Promise<WorldBankPanelSnapshot>{
 const contracts=WORLD_BANK_CONTRACTS.filter(c=>c.primaryModuleId===`economic-${group}`);
 const series=await Promise.all(contracts.map(async contract=>{
  try{return {...contract,status:'available' as const,error:null,...await getWorldBankObservationSnapshot(contract.id,WORLD_BANK_COUNTRIES.join(','),2015,new Date().getUTCFullYear(),refresh)};}
  catch(e){return {...contract,status:'unavailable' as const,error:e instanceof Error?e.message:String(e),retrievedAt:null,rows:[] as Observation[]};}
 }));
 const times=series.flatMap(s=>s.retrievedAt?[s.retrievedAt]:[]).sort();
 return {group,retrievedAt:times[0]??'',frequency:'年度',series};
}
