import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dumpPath = resolve(process.cwd(), '_baseline_nested_source/database/finance_hub.sql');
const dump = readFileSync(dumpPath, 'utf8');
const match = dump.match(/INSERT INTO `equity_quote_snapshots` VALUES ([\s\S]*?);/);
if (!match) throw new Error('原始转储中未找到 equity_quote_snapshots INSERT 段。');
const values = match[1];
const symbols = [...values.matchAll(/'([A-Z0-9._-]+)'/g)].map((entry) => entry[1]);
const result = {
  sourceRowCount: (values.match(/\),\(/g)?.length ?? 0) + 1,
  snapshotSectionContainsABNIC: values.includes("'ABNIC.AD'"),
  snapshotSectionContainsAFNIC: values.includes("'AFNIC.AD'"),
  symbolTokenCount: symbols.length,
};
console.log(JSON.stringify(result));
