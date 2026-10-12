import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourcePath = '/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql';
const table = 'equity_listings';
const expectedTupleCount = 5088;
const expectedInsertSha256 = '6c84ac2b18302ab7e8c2345b74e1fa7fa71f60eb0997ad447772aca8990c3dd0';
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
const tupleCount = countTopLevelTuples(statement);
const insertSha256 = sha256(statement);
if (tupleCount !== expectedTupleCount) throw new Error(`冻结清单行数不符：期望 ${expectedTupleCount}，实际 ${tupleCount}`);
if (insertSha256 !== expectedInsertSha256) throw new Error('冻结清单 INSERT 指纹不符，拒绝导入');

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [columns] = await connection.execute(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position',
    [table],
  );
  const currentColumns = columns.map((row) => row.column_name);
  if (JSON.stringify(currentColumns) !== JSON.stringify(expectedColumns)) throw new Error(`当前列序不符：${JSON.stringify(currentColumns)}`);
  const [[before]] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
  if (Number(before.row_count) !== 0) throw new Error(`目标表当前非空（${before.row_count} 行），为避免覆盖已拒绝导入`);

  await connection.beginTransaction();
  try {
    await connection.query(statement);
    const [[after]] = await connection.query(`SELECT COUNT(*) AS row_count, COUNT(DISTINCT country_code) AS country_count FROM \`${table}\``);
    if (Number(after.row_count) !== expectedTupleCount) throw new Error(`导入后行数不符：${after.row_count}`);
    await connection.commit();
    console.log(JSON.stringify({
      auditKind: 'transactional-non-destructive-baseline-equity-listing-import',
      sourcePath,
      insertSha256,
      importedRowCount: Number(after.row_count),
      importedCountryCount: Number(after.country_count),
      initialRowCount: Number(before.row_count),
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} finally {
  await connection.end();
}
