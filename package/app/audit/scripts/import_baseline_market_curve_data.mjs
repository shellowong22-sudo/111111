import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const sourcePath = "/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql";
const targetTables = ["market_data", "curves", "curve_data_points"];
const expectedTupleCounts = {
  market_data: 48,
  curves: 2,
  curve_data_points: 4276,
};
const expectedColumns = {
  market_data: ["id", "symbol", "name", "market", "price", "change_val", "change_pct", "volume", "updated_at"],
  curves: ["id", "curve_id", "name", "name_en", "country", "currency", "type", "region", "category", "description", "is_active", "created_at", "updated_at"],
  curve_data_points: ["id", "curve_id", "data_date", "period", "value", "created_at", "updated_at"],
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function findStatementEnd(sql, start) {
  let quote = null;
  let escaped = false;
  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ";") {
      return index + 1;
    }
  }
  return -1;
}

function countTopLevelTuples(statement) {
  const valuesOffset = statement.indexOf(" VALUES ");
  if (valuesOffset < 0) return 0;
  let count = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = valuesOffset + 8; index < statement.length; index += 1) {
    const character = statement[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "(") {
      if (depth === 0) count += 1;
      depth += 1;
    } else if (character === ")") depth -= 1;
  }
  return count;
}

function extractInsertStatements(sql, table) {
  const marker = `INSERT INTO \`${table}\` VALUES `;
  const statements = [];
  let start = sql.indexOf(marker);
  while (start >= 0) {
    const end = findStatementEnd(sql, start);
    if (end < 0) throw new Error(`未找到 ${table} INSERT 语句的结尾`);
    statements.push(sql.slice(start, end));
    start = sql.indexOf(marker, end);
  }
  return statements;
}

const sql = await readFile(sourcePath, "utf8");
const sourceSha256 = sha256(sql);
const statementsByTable = Object.fromEntries(targetTables.map((table) => [table, extractInsertStatements(sql, table)]));
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const preflight = {};
  for (const table of targetTables) {
    const statements = statementsByTable[table];
    const tupleCount = statements.reduce((sum, statement) => sum + countTopLevelTuples(statement), 0);
    if (tupleCount !== expectedTupleCounts[table]) {
      throw new Error(`${table} 冻结转储行数预检失败：期望 ${expectedTupleCounts[table]}，实际 ${tupleCount}`);
    }
    const [columns] = await connection.execute(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position`,
      [table],
    );
    const currentColumns = columns.map((row) => row.column_name);
    if (JSON.stringify(currentColumns) !== JSON.stringify(expectedColumns[table])) {
      throw new Error(`${table} 当前列序与冻结导入预期不一致：${JSON.stringify(currentColumns)}`);
    }
    const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
    const rowCount = Number(rows[0].row_count);
    if (rowCount !== 0) {
      throw new Error(`${table} 当前非空（${rowCount} 行）；为避免覆盖或混入数据，导入已拒绝`);
    }
    preflight[table] = { tupleCount, currentColumns, initialRowCount: rowCount, insertSha256: sha256(statements.join("\n")) };
  }

  await connection.beginTransaction();
  try {
    for (const table of targetTables) {
      for (const statement of statementsByTable[table]) {
        await connection.query(statement);
      }
      const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
      const rowCount = Number(rows[0].row_count);
      if (rowCount !== expectedTupleCounts[table]) {
        throw new Error(`${table} 导入后计数不符：期望 ${expectedTupleCounts[table]}，实际 ${rowCount}`);
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }

  const result = {
    auditKind: "transactional-non-destructive-baseline-import",
    sourcePath,
    sourceSha256,
    importedTables: Object.fromEntries(await Promise.all(targetTables.map(async (table) => {
      const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
      return [table, { ...preflight[table], finalRowCount: Number(rows[0].row_count) }];
    }))),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await connection.end();
}
