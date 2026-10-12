import {getEconomicObservations} from '../../server/economicObservationService';
import {centralBankDrilldown} from '../../shared/centralBankDrilldown';
import {writeFile} from 'node:fs/promises';
const result=[];
for(const group of ['fdsp','cbrt'] as const){
 const data=await getEconomicObservations(group);
 const ids=group==='fdsp'?['WALCL','TREAST','WSHOMCB','WRESBAL','WTREGEN','WCURCIR','IORB','DFF','RRPONTSYD','WLCFLPCL']:['DFEDTARU','DFEDTARL','ECBDFR','CPIAUCSL','DEXUSEU'];
 result.push({group,retrievedAt:data.retrievedAt,series:data.series.map(s=>({id:s.id,status:s.status,observations:s.history.length,observedAt:s.history.at(-1)?.date,error:s.error})),drills:ids.map(id=>{const d=centralBankDrilldown(group,id,data);return {id,label:d.label,columns:d.columns,count:d.rows.length,last:d.rows.at(-1)};})});
}
await writeFile('recovery-evidence/api-expansion-20260919/central-bank-drill-live.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(result.some(r=>r.series.some(s=>s.status!=='available')))process.exitCode=1;
