import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = '/home/ubuntu/finance-hub-source-pristine/Finance-Hub-Recovery-dfe46068/database/database-current.sql';
const reportPath = '/home/ubuntu/finance-hub-recovery/audit/recovery-execution/original-dml-row-parity.json';
const source = fs.readFileSync(sourcePath, 'utf8');

function splitStatements(text) {
  const statements = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && text[index - 1] !== '\\') quoted = !quoted;
    if (!quoted && char === ';') {
      const statement = text.slice(start, index + 1).trim();
      if (statement.startsWith('INSERT INTO `')) statements.push(statement);
      start = index + 1;
    }
  }
  return statements;
}

function countRows(values) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    const char = values[index];
    if (char === "'" && values[index - 1] !== '\\') quoted = !quoted;
    if (!quoted && char === '(') count += 1;
  }
  return count;
}

const expected = new Map();
for (const statement of splitStatements(source)) {
  const match = statement.match(/^INSERT INTO `([^`]+)` VALUES (.*);$/s);
  if (!match || match[1] === '__drizzle_migrations') continue;
  expected.set(match[1], (expected.get(match[1]) ?? 0) + countRows(match[2]));
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const results = [];
  for (const [table, expectedRows] of [...expected.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS actual_rows FROM \`${table}\``);
    const actualRows = Number(rows[0].actual_rows);
    results.push({ table, expectedRows, actualRows, matches: expectedRows === actualRows });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    sourcePath,
    comparedTables: results.length,
    matchedTables: results.filter((item) => item.matches).length,
    mismatches: results.filter((item) => !item.matches),
    results,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ comparedTables: report.comparedTables, matchedTables: report.matchedTables, mismatches: report.mismatches }, null, 2));
} finally {
  await connection.end();
}
