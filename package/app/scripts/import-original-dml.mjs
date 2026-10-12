import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = '/home/ubuntu/finance-hub-source-pristine/Finance-Hub-Recovery-dfe46068/database/database-current.sql';
const reportPath = '/home/ubuntu/finance-hub-recovery/audit/recovery-execution/original-dml-import-report.json';
const backupTables = new Set(['__drizzle_migrations']);
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

function tableFromInsert(statement) {
  const match = statement.match(/^INSERT INTO `([^`]+)` VALUES /);
  if (!match) throw new Error(`无法识别 INSERT 目标：${statement.slice(0, 120)}`);
  return match[1];
}

const statements = splitStatements(source);
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const report = { sourcePath, startedAt: new Date().toISOString(), insertsFound: statements.length, inserted: [], skipped: [] };

try {
  for (const statement of statements) {
    const table = tableFromInsert(statement);
    if (backupTables.has(table)) {
      report.skipped.push({ table, reason: '迁移历史由已执行的原始迁移序列真实生成，不用转储数据覆盖。' });
      continue;
    }
    const [result] = await connection.query(statement.replace(/^INSERT INTO `/, 'INSERT IGNORE INTO `'));
    report.inserted.push({ table, affectedRows: result.affectedRows });
  }
  report.finishedAt = new Date().toISOString();
  report.insertedStatements = report.inserted.length;
  report.totalAffectedRows = report.inserted.reduce((total, item) => total + item.affectedRows, 0);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failedAt = new Date().toISOString();
  report.error = error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  throw error;
} finally {
  await connection.end();
}
