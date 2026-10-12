import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const sourcePath = "/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql";
const targetTables = ["market_data", "curves", "curve_data_points"];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function extractCreateDefinition(sql, table) {
  const marker = `CREATE TABLE \`${table}\` (`;
  const start = sql.indexOf(marker);
  if (start < 0) return null;
  const end = sql.indexOf(";", start);
  return end < 0 ? null : sql.slice(start, end + 1);
}

function findStatementEnd(sql, start) {
  let quote = null;
  let escaped = false;
  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
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
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "(") {
      if (depth === 0) count += 1;
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    }
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
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const result = {
    auditKind: "read-only-baseline-import-preflight",
    sourcePath,
    sourceSha256: sha256(sql),
    sourceBytes: Buffer.byteLength(sql),
    tables: {},
  };

  for (const table of targetTables) {
    const createDefinition = extractCreateDefinition(sql, table);
    const insertStatements = extractInsertStatements(sql, table);
    const [columns] = await connection.execute(
      `SELECT ordinal_position, column_name, column_type, is_nullable, column_key, column_default, extra
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?
       ORDER BY ordinal_position`,
      [table],
    );
    const [indexes] = await connection.execute(
      `SELECT index_name, non_unique, seq_in_index, column_name
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ?
       ORDER BY index_name, seq_in_index`,
      [table],
    );
    const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
    result.tables[table] = {
      frozenCreateSha256: createDefinition ? sha256(createDefinition) : null,
      frozenColumns: createDefinition ? [...createDefinition.matchAll(/^\s*`([^`]+)`/gm)].map((match) => match[1]) : [],
      frozenInsertStatementCount: insertStatements.length,
      frozenInsertTupleCount: insertStatements.reduce((sum, statement) => sum + countTopLevelTuples(statement), 0),
      frozenInsertSha256: sha256(insertStatements.join("\n")),
      currentColumns: columns,
      currentIndexes: indexes,
      currentRowCount: Number(rows[0].row_count),
    };
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await connection.end();
}
