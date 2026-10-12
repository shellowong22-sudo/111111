import { mkdirSync, writeFileSync } from 'node:fs';
import { getEconomicObservations } from '../../server/economicObservationService';
import { ECONOMIC_GROUPS, type EconomicGroup } from '../../shared/economicObservations';
async function main(){
 const results=[];
 for(const group of Object.keys(ECONOMIC_GROUPS) as EconomicGroup[]){const data=await getEconomicObservations(group);results.push({group,...data,series:data.series.map(series=>({...series,history:undefined,count:series.history.length,first:series.history.at(0),last:series.history.at(-1)}))});}
 mkdirSync('recovery-evidence/economics-20260919',{recursive:true});
 writeFileSync('recovery-evidence/economics-20260919/observations-sources.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({group:r.group,available:r.series.filter(s=>s.status==='available').length,total:r.series.length,observations:r.series.reduce((s,item)=>s+item.count,0)}))));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});
