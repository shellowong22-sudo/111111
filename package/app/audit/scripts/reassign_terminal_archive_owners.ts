import { sql } from 'drizzle-orm';
import { getDb } from '../../server/db';
import { FINMIND_MODULE_BINDINGS } from '../../shared/finmindModuleBindings';

type Assignment = { from: string; to: string; contracts: string[] };

const assignments: Assignment[] = [
  {
    from: 'equity-market',
    to: 'stock-eqs',
    contracts: FINMIND_MODULE_BINDINGS.filter(binding => binding.moduleId === 'stock-eqs').map(binding => binding.dataContractId),
  },
  {
    from: 'derivatives-enhanced',
    to: 'deri',
    contracts: ['derivatives.tw.futures.daily.finmind.v1'],
  },
  {
    from: 'energy-market',
    to: 'commodity-market',
    contracts: [
      'energy.us.natural-gas-storage.weekly.v1',
      'energy.us.commercial-crude-inventory.eia.weekly.v1',
      'energy.us.refinery-utilization.eia.weekly.v1',
    ],
  },
];

function quoted(values: string[]) {
  return values.map(value => `'${value.replaceAll("'", "''")}'`).join(',');
}

async function count(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, moduleId: string, contracts: string[]) {
  const result = await db.execute(sql.raw(`SELECT COUNT(*) AS rowCount FROM market_data_observation_history WHERE module_id='${moduleId}' AND data_contract_id IN (${quoted(contracts)})`));
  const rows = result[0] as Array<{ rowCount: number | string }>;
  return Number(rows[0]?.rowCount ?? 0);
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const apply = process.argv.includes('--apply');
  const report: Array<Record<string, string | number | boolean>> = [];

  for (const assignment of assignments) {
    const before = await count(db, assignment.from, assignment.contracts);
    const existingTarget = await count(db, assignment.to, assignment.contracts);
    if (apply && before > 0) {
      await db.execute(sql.raw(`UPDATE IGNORE market_data_observation_history SET module_id='${assignment.to}' WHERE module_id='${assignment.from}' AND data_contract_id IN (${quoted(assignment.contracts)})`));
      // UPDATE IGNORE leaves only rows whose byte-identical target copy already
      // exists. Remove those redundant copies while retaining the target row.
      await db.execute(sql.raw(`DELETE old_row FROM market_data_observation_history old_row INNER JOIN market_data_observation_history target_row ON target_row.module_id='${assignment.to}' AND target_row.data_contract_id=old_row.data_contract_id AND target_row.symbol=old_row.symbol AND target_row.observation_date=old_row.observation_date AND target_row.content_hash=old_row.content_hash WHERE old_row.module_id='${assignment.from}' AND old_row.data_contract_id IN (${quoted(assignment.contracts)})`));
    }
    report.push({
      from: assignment.from,
      to: assignment.to,
      before,
      targetBefore: existingTarget,
      remainingSource: await count(db, assignment.from, assignment.contracts),
      targetAfter: await count(db, assignment.to, assignment.contracts),
      applied: apply,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

await main();
process.exit(0);
