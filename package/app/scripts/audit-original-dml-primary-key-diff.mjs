import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = '/home/ubuntu/finance-hub-source-pristine/Finance-Hub-Recovery-dfe46068/database/database-current.sql';
const reportPath = '/home/ubuntu/finance-hub-recovery/audit/recovery-execution/original-dml-primary-key-diff.json';
const selectedTables = new Set(['admin_ai_generation_tasks', 'admin_news_ingestion_audit_events', 'admin_runtime_health_samples', 'users']);
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

function splitRows(values) {
  const rows = [];
  let start = 0;
  let quoted = false;
  let depth = 0;
  for (let index = 0; index < values.length; index += 1) {
    const char = values[index];
    if (char === "'" && values[index - 1] !== '\\') quoted = !quoted;
    if (quoted) continue;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && char === ',' && values[index + 1] === '(') {
      rows.push(values.slice(start, index));
      start = index + 1;
    }
  }
  rows.push(values.slice(start));
  return rows;
}

const expectedByTable = new Map();
for (const statement of splitStatements(source)) {
  const match = statement.match(/^INSERT INTO `([^`]+)` VALUES (.*);$/s);
  if (!match || !selectedTables.has(match[1])) continue;
  const ids = splitRows(match[2]).map((row) => Number(row.match(/^\((\d+)/)?.[1])).filter(Number.isFinite);
  expectedByTable.set(match[1], [...(expectedByTable.get(match[1]) ?? []), ...ids]);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const tableDiffs = [];
  for (const table of [...selectedTables].sort()) {
    const expectedIds = [...new Set(expectedByTable.get(table) ?? [])].sort((a, b) => a - b);
    const [rows] = await connection.query(`SELECT id FROM \`${table}\` ORDER BY id`);
    const actualIds = rows.map((row) => Number(row.id));
    const expectedSet = new Set(expectedIds);
    const actualSet = new Set(actualIds);
    tableDiffs.push({
      table,
      expectedIds,
      actualIds,
      extraIds: actualIds.filter((id) => !expectedSet.has(id)),
      missingIds: expectedIds.filter((id) => !actualSet.has(id)),
    });
  }
  const report = { generatedAt: new Date().toISOString(), tableDiffs };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await connection.end();
}
