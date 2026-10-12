import {readFileSync,writeFileSync} from 'node:fs';
import mysql from 'mysql2/promise';
async function main(){
 const state=JSON.parse(readFileSync('.runtime/openbb-admin/priority-a.json','utf8'));
 const runs=state.runs.filter((r:any)=>r.endpointId.startsWith('official_worldbank_')).map((r:any)=>({runId:r.runId,endpointId:r.endpointId,status:r.status,params:r.params,push:r.push,lastPushAttempt:r.lastPushAttempt,logs:r.logs}));
 const db=await mysql.createConnection(process.env.DATABASE_URL||'mysql://root@127.0.0.1:3307/finance_hub');
 try{
  const [rows]=await db.execute("SELECT content_key,module_id,status,content_hash,source_reference,JSON_EXTRACT(target_payload,'$.deliveryReceipt') AS delivery_receipt,JSON_EXTRACT(target_payload,'$.dataset.metadata') AS dataset_metadata FROM admin_data_module_content_items WHERE source_reference LIKE 'openbb:official_worldbank_%' ORDER BY id DESC LIMIT 20");
  writeFileSync('recovery-evidence/api-expansion-20260919/delivery-db-evidence.json',JSON.stringify({recordedAt:new Date().toISOString(),runs,rows},null,2));
  console.log(JSON.stringify({runs:runs.length,contentRows:(rows as any[]).length,states:runs.map((r:any)=>({run:r.runId,country:r.params?.country,push:r.push?.status,lastAttempt:r.lastPushAttempt?.status,ack:r.push?.successCount}))}));
 }finally{await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
