import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { buildOpenBBApiCatalog } from '../../server/openbbPriorityAService';
import { buildApiCoverage } from '../../server/apiCoverage';
import { ECONOMIC_API_CONTRACTS } from '../../shared/economicApiContracts';
import { getEconomicSeries } from '../../server/economicObservationService';
import { WORLD_BANK_CONTRACTS,WORLD_BANK_COUNTRIES } from '../../shared/worldBankContracts';
import { getWorldBankObservations } from '../../server/worldBankObservationService';
async function main(){
 const dir='recovery-evidence/api-expansion-20260919';mkdirSync(dir,{recursive:true});
 const catalog=buildOpenBBApiCatalog(JSON.parse(readFileSync('.runtime/openbb-admin/live-openapi.json','utf8')));
 const runs=[];
 for(const contract of ECONOMIC_API_CONTRACTS){const series=await getEconomicSeries(contract.seriesId);const run={endpointId:contract.id,status:series.status==='available'?'succeeded':'failed',completedAt:series.retrievedAt,error:series.error,primaryModuleId:contract.primaryModuleId,count:series.history.length,sourceUrl:series.sourceUrl,unit:series.unit,first:series.history[0],last:series.history.at(-1)};runs.push(run);console.log(JSON.stringify({id:contract.id,status:run.status,count:series.history.length,error:run.error}));}
 for(const contract of WORLD_BANK_CONTRACTS){
  try{const rows=await getWorldBankObservations(contract.id,WORLD_BANK_COUNTRIES.join(','));const run={endpointId:contract.id,status:'succeeded',completedAt:new Date().toISOString(),error:null,primaryModuleId:contract.primaryModuleId,count:rows.length,sourceUrl:contract.sourceUrl,unit:contract.unit,first:rows[0],last:rows.at(-1)};runs.push(run);console.log(JSON.stringify({id:contract.id,status:run.status,count:rows.length,countries:new Set(rows.map(r=>r.country_code)).size}));}
  catch(e){const run={endpointId:contract.id,status:'failed',completedAt:new Date().toISOString(),error:String(e),primaryModuleId:contract.primaryModuleId,count:0,sourceUrl:contract.sourceUrl,unit:contract.unit,first:undefined,last:undefined};runs.push(run);console.log(JSON.stringify(run));}
 }
 writeFileSync(dir+'/query-results.json',JSON.stringify(runs,null,2));
 const coverage=buildApiCoverage(catalog.operations,runs);
 writeFileSync(dir+'/coverage.json',JSON.stringify({catalog:{operations:catalog.operationCount,paths:catalog.pathCount},...coverage},null,2));
 console.log(JSON.stringify({operations:catalog.operationCount,official:ECONOMIC_API_CONTRACTS.length+WORLD_BANK_CONTRACTS.length,succeeded:runs.filter(r=>r.status==='succeeded').length,failed:runs.filter(r=>r.status!=='succeeded').length,modules:coverage.totalModules,unassigned:coverage.unassignedModules}));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
