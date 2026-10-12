import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourcePath = '/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql';
const table = 'equity_listings';
const expectedColumns = ['id', 'country', 'country_code', 'exchange', 'symbol', 'name', 'source_file', 'source_sheet', 'source_row', 'source_content_sha256', 'imported_at'];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function findStatementEnd(sql, start) {
  let quote = null;
  let escaped = false;
  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === ';') return index + 1;
  }
  return -1;
}

function countTopLevelTuples(statement) {
  const offset = statement.indexOf(' VALUES ');
  if (offset < 0) return 0;
  let count = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = offset + 8; index < statement.length; index += 1) {
    const character = statement[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === '(') {
      if (depth === 0) count += 1;
      depth += 1;
    } else if (character === ')') depth -= 1;
  }
  return count;
}

const sql = await readFile(sourcePath, 'utf8');
const marker = `INSERT INTO \`${table}\` VALUES `;
const start = sql.indexOf(marker);
if (start < 0) throw new Error(`冻结 SQL 未找到 ${table} 的 INSERT`);
const end = findStatementEnd(sql, start);
if (end < 0) throw new Error(`冻结 SQL 的 ${table} INSERT 未找到结束符`);
const statement = sql.slice(start, end);
const sourceTupleCount = countTopLevelTuples(statement);

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [columns] = await connection.execute(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position',
    [table],
  );
  const [indexes] = await connection.execute(
    'SELECT index_name, non_unique, seq_in_index, column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? ORDER BY index_name, seq_in_index',
    [table],
  );
  const [[count]] = await connection.query(`SELECT COUNT(*) AS row_count, COUNT(DISTINCT country_code) AS country_count FROM \`${table}\``);
  console.log(JSON.stringify({
    auditKind: 'read-only-baseline-equity-listing-import-preflight',
    sourcePath,
    sourceSqlSha256: sha256(sql),
    sourceInsertSha256: sha256(statement),
    sourceTupleCount,
    expectedColumns,
    currentColumns: columns.map((row) => row.column_name),
    currentIndexes: indexes,
    currentRowCount: Number(count.row_count),
    currentCountryCount: Number(count.country_count),
  }, null, 2));
} finally {
  await connection.end();
}
