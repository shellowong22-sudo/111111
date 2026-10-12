import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const SOURCE_DUMP_SHA256 = "829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9";
const excludedTables = new Set(["__drizzle_migrations"]);
const projectRoot = path.resolve(import.meta.dirname, "../..");
const dump = fs.readFileSync(path.join(projectRoot, "_baseline_nested_source/database/finance_hub.sql"), "utf8");
const sourceTables = [...dump.matchAll(/CREATE TABLE `([^`]+)` \([\s\S]*?\) ENGINE=[\s\S]*?;/g)].map((match) => ({ table: match[1], ddl: match[0] }));
if (sourceTables.length !== 188) throw new Error(`Expected 188 source CREATE TABLE statements, found ${sourceTables.length}`);

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existingRows] = await connection.query("SHOW TABLES");
  const existing = new Set(existingRows.map((row) => Object.values(row)[0]));
  const toCreate = sourceTables.filter(({ table }) => !existing.has(table) && !excludedTables.has(table));
  const createdTables = [];
  const failures = [];
  for (const { table, ddl } of toCreate) {
    try {
      await connection.query(ddl.replace(`CREATE TABLE \`${table}\``, `CREATE TABLE IF NOT EXISTS \`${table}\``));
      createdTables.push(table);
    } catch (error) {
      failures.push({ table, code: error.code ?? "UNKNOWN", message: error.message });
      break;
    }
  }
  const [afterRows] = await connection.query("SHOW TABLES");
  const after = new Set(afterRows.map((row) => Object.values(row)[0]));
  const missingSourceBusinessTables = sourceTables.map(({ table }) => table).filter((table) => !excludedTables.has(table) && !after.has(table));
  console.log(JSON.stringify({
    sourceDumpSha256: SOURCE_DUMP_SHA256,
    sourceCreateTableCount: sourceTables.length,
    excludedTables: [...excludedTables],
    existingSourceTableCountBefore: sourceTables.filter(({ table }) => existing.has(table)).length,
    requestedCreates: toCreate.length,
    createdTableCount: createdTables.length,
    createdTables,
    failureCount: failures.length,
    failures,
    missingSourceBusinessTableCountAfter: missingSourceBusinessTables.length,
    missingSourceBusinessTables,
  }, null, 2));
  if (failures.length || missingSourceBusinessTables.length) process.exitCode = 1;
} finally {
  await connection.end();
}
