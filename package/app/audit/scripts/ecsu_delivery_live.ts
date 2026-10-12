import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { runOpenBBQuery, pushOpenBBResult } from '../../server/openbbPriorityAService';

process.env.DATABASE_URL ||= 'mysql://root@127.0.0.1:3307/finance_hub';
const actorUserId = 4110001;
const endpointId = process.argv[2] ?? 'official_fred_BUSINV';
assert.ok(['official_fred_BUSINV','official_fred_UNEMPLOY','official_fred_OUTNFB','official_fred_HOANBS'].includes(endpointId));
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [users] = await db.execute('SELECT id,role FROM users WHERE id=?', [actorUserId]);
  assert.equal((users as any[])[0]?.role, 'admin');
  const run = await runOpenBBQuery({endpointId,params:{},actorUserId});
  assert.equal(run.status, 'succeeded', run.error ?? 'query failed');
  assert.ok(run.result?.rows.length);
  const input = {runId:run.runId,moduleIds:['economic-ecsu'],recipientUserIds:[actorUserId],actorUserId,operator:'ECSU original-view integration verification'};
  const push = await pushOpenBBResult(input);
  const repeat = await pushOpenBBResult(input);
  assert.equal(repeat.status, 'duplicate_blocked');
  const evidence = {checkedAt:new Date().toISOString(),runId:run.runId,endpointId:run.endpointId,rows:run.result?.rows.length,metadata:run.result?.metadata,push,repeat};
  await writeFile(`recovery-evidence/api-expansion-20260919/ecsu-delivery-${endpointId}.json`,JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally { await db.end(); }
process.exit(0);
