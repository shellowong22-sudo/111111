import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {getEconomicObservations} from '../../server/economicObservationService';
import {OPENBB_ENDPOINTS,runOpenBBQuery,pushOpenBBResult} from '../../server/openbbPriorityAService';
import {ECONOMIC_API_CONTRACTS} from '../../shared/economicApiContracts';
process.env.DATABASE_URL ||= 'mysql://root@127.0.0.1:3307/finance_hub';
const snapshot=await getEconomicObservations('wfii-stress');
const series=snapshot.series.map(s=>{
 assert.equal(s.status,'available',s.error??s.id);assert.ok(s.history.length>52);
 assert.equal(new Set(s.history.map(p=>p.date)).size,s.history.length);
 return {id:s.id,unit:s.unit,frequency:s.frequency,rows:s.history.length,latest:s.history.at(-1),retrievedAt:s.retrievedAt,checksum:s.checksum};
});
const runs=[];
for(const id of ['STLFSI4','VIXCLS']){
 const endpointId=`official_fred_${id}`;
 const run=await runOpenBBQuery({endpointId,params:{},actorUserId:4110001});
 assert.equal(run.status,'succeeded',run.error??endpointId);
 assert.ok(run.result?.rows.length);
 const input={runId:run.runId,moduleIds:['economic-wfii'],recipientUserIds:[4110001],actorUserId:4110001,operator:'WFII stress original-view verification'};
 const push=await pushOpenBBResult(input);const repeat=await pushOpenBBResult(input);
 assert.equal(repeat.status,'duplicate_blocked');
 runs.push({runId:run.runId,endpointId,rows:run.result?.rows.length,metadata:run.result?.metadata,push,repeat});
}
const evidence={checkedAt:new Date().toISOString(),series,runs,registeredOperations:OPENBB_ENDPOINTS.length,contracts:ECONOMIC_API_CONTRACTS.filter(c=>['STLFSI4','VIXCLS'].includes(c.seriesId))};
await writeFile('recovery-evidence/api-expansion-20260919/wfii-stress-live.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
process.exit(0);
