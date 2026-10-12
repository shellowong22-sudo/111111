import { mkdirSync, writeFileSync } from 'node:fs';
import { runOpenBBQuery, pushOpenBBResult } from '../../server/openbbPriorityAService';

async function main() {
  const actorUserId = 4110001;
  const run = await runOpenBBQuery({ endpointId: 'economy_real_gdp', params: { provider: 'oecd', country: 'united_states', frequency: 'quarter' }, actorUserId });
  const evidence: Record<string, unknown> = { checkedAt: new Date().toISOString(), status: run.status, runId: run.runId, error: run.error, metadata: run.result?.metadata, target: run.primaryModuleId };
  if (run.status === 'succeeded') {
    const result = await pushOpenBBResult({ runId: run.runId, moduleIds: ['economic-ecst'], recipientUserIds: [actorUserId], actorUserId, operator: 'economic-scope-repair' });
    evidence.push = result;
  }
  mkdirSync('recovery-evidence/economics-20260919', { recursive: true });
  writeFileSync('recovery-evidence/economics-20260919/gdp-refresh.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ status: run.status, error: run.error, rows: run.result?.rows.length, target: run.primaryModuleId, pushed: Boolean(evidence.push) }));
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
