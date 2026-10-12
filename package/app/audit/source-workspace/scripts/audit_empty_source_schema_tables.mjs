import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const dump = fs.readFileSync(path.join(projectRoot, "_baseline_nested_source/database/finance_hub.sql"), "utf8");
const sourceTables = [...dump.matchAll(/CREATE TABLE `([^`]+)` \([\s\S]*?\) ENGINE=[\s\S]*?;/g)].map((match) => match[1]);
const insertedTables = new Set([...dump.matchAll(/INSERT INTO `([^`]+)` VALUES/g)].map((match) => match[1]));
const emptySourceTables = sourceTables.filter((table) => !insertedTables.has(table));
const summaryOnly = process.argv.includes("--summary");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existingRows] = await connection.query("SHOW TABLES");
  const existing = new Set(existingRows.map((row) => Object.values(row)[0]));
  const rows = [];
  for (const table of emptySourceTables) {
    let liveRowCount = null;
    if (existing.has(table)) {
      const [[result]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      liveRowCount = Number(result.count);
    }
    rows.push({ tableName: table, schemaRestored: existing.has(table), sourceRowCount: 0, liveRowCount, functionalAcceptance: "未验收" });
  }
  const missingSchemaCount = rows.filter((row) => !row.schemaRestored).length;
  const nonEmptyLiveTableCount = rows.filter((row) => row.liveRowCount !== 0).length;
  console.log(JSON.stringify({
    sourceCreateTableCount: sourceTables.length,
    sourceInsertedTableCount: insertedTables.size,
    sourceEmptyTableCount: rows.length,
    missingSchemaCount,
    nonEmptyLiveTableCount,
    rows: summaryOnly ? undefined : rows,
  }, null, 2));
} finally {
  await connection.end();
}
