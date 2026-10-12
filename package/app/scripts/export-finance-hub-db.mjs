import mysql from "mysql2/promise";
import fs from "node:fs/promises";

const out = process.argv[2];
if (!out) throw new Error("output path required");
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: false });
const quoteIdent = (value) => "\x60" + String(value).replaceAll("\x60", "\x60\x60") + "\x60";
const esc = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return "'" + value.toISOString().slice(0, 19).replace("T", " ") + "'";
  if (Buffer.isBuffer(value)) return "X'" + value.toString("hex") + "'";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return "'" + String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\0", "\\0") + "'";
};
const [tableRows] = await conn.query("SHOW TABLES");
const tableKey = Object.keys(tableRows[0] ?? {})[0];
const tables = tableRows.map((row) => row[tableKey]).sort();
let sql = ["-- finance-hub database snapshot", "-- generated_at_utc: " + new Date().toISOString(), "SET FOREIGN_KEY_CHECKS=0;", "SET NAMES utf8mb4;", ""];
const summary = [];
for (const table of tables) {
  const safe = quoteIdent(table);
  const [createRows] = await conn.query("SHOW CREATE TABLE " + safe);
  const createSql = createRows[0]["Create Table"];
  sql.push("-- TABLE " + table, "DROP TABLE IF EXISTS " + safe + ";", createSql + ";", "");
  const [rows] = await conn.query("SELECT * FROM " + safe);
  summary.push({ table, rows: rows.length });
  if (rows.length) {
    const columns = Object.keys(rows[0]).map(quoteIdent).join(", ");
    for (const row of rows) sql.push("INSERT INTO " + safe + " (" + columns + ") VALUES (" + Object.values(row).map(esc).join(", ") + ");");
    sql.push("");
  }
}
sql.push("SET FOREIGN_KEY_CHECKS=1;", "");
await fs.writeFile(out, sql.join("\n"), "utf8");
await fs.writeFile(out + ".summary.json", JSON.stringify({ generatedAt: new Date().toISOString(), tableCount: tables.length, tables: summary }, null, 2));
await conn.end();
console.log(JSON.stringify({ tableCount: tables.length, totalRows: summary.reduce((n, item) => n + item.rows, 0), output: out }));
