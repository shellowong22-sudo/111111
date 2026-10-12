import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const expectedPath = '/home/ubuntu/finance-hub-source-pristine/Finance-Hub-Recovery-dfe46068/database/database-export-successful-tables.txt';
const reportPath = '/home/ubuntu/finance-hub-recovery/audit/recovery-execution/original-table-diff.json';
const expected = fs.readFileSync(expectedPath, 'utf8').split(/\r?\n/).filter(Boolean).sort();
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  const actual = rows.map((row) => row.table_name).sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const report = {
    expectedCount: expected.length,
    actualCount: actual.length,
    missingFromDatabase: expected.filter((table) => !actualSet.has(table)),
    extraInDatabase: actual.filter((table) => !expectedSet.has(table)),
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await connection.end();
}
