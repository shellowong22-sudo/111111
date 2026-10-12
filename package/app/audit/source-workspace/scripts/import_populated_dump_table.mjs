import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const table = process.argv[2];
if (!table || !/^[a-z0-9_]+$/.test(table)) {
  throw new Error("Usage: node audit/scripts/import_populated_dump_table.mjs <safe_table_name>");
}

const projectRoot = path.resolve(import.meta.dirname, "../..");
const dumpPath = path.join(projectRoot, "_baseline_nested_source/database/finance_hub.sql");
const dump = fs.readFileSync(dumpPath, "utf8");
const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createMatch = dump.match(new RegExp("CREATE TABLE `" + escapedTable + "` \\([\\s\\S]*?\\) ENGINE=[\\s\\S]*?;"));
const dataBlockMatch = dump.match(new RegExp("INSERT INTO `" + escapedTable + "` VALUES [\\s\\S]*?\\n/\\*!40000 ALTER TABLE `" + escapedTable + "` ENABLE KEYS \\*/;"));
const insertMatches = dataBlockMatch
  ? [...dataBlockMatch[0].matchAll(new RegExp("(INSERT INTO `" + escapedTable + "` VALUES [\\s\\S]*?;)(?=\\n(?:INSERT INTO `" + escapedTable + "` VALUES|/\\*!40000 ALTER TABLE))", "g"))].map((match) => match[1])
  : [];

if (!createMatch) throw new Error(`No CREATE TABLE definition for ${table} in immutable source dump`);
if (insertMatches.length === 0) throw new Error(`No INSERT segment for ${table} in immutable source dump`);

function splitInsertIntoBatches(insertSql, maxRows = 500) {
  const marker = " VALUES ";
  const markerIndex = insertSql.indexOf(marker);
  if (markerIndex < 0 || !insertSql.endsWith(";")) throw new Error(`Unsupported INSERT shape for ${table}`);
  const prefix = insertSql.slice(0, markerIndex + marker.length);
  const values = insertSql.slice(markerIndex + marker.length, -1);
  const tuples = [];
  let tupleStart = 0;
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < values.length; i += 1) {
    const char = values[i];
    if (quoted) {
      if (char === "\\") { i += 1; continue; }
      if (char === "'") {
        if (values[i + 1] === "'") { i += 1; continue; }
        quoted = false;
      }
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth < 0) throw new Error(`Unbalanced tuple boundary in ${table}`);
      if (depth === 0) {
        tuples.push(values.slice(tupleStart, i + 1));
        let next = i + 1;
        while (/\s/.test(values[next] ?? "")) next += 1;
        if (next < values.length) {
          if (values[next] !== ",") throw new Error(`Unexpected tuple separator in ${table} at ${next}: ${JSON.stringify(values.slice(next, next + 120))}`);
          tupleStart = next + 1;
          i = next;
        }
      }
    }
  }
  if (quoted || depth !== 0 || tuples.length === 0) throw new Error(`Unable to safely split INSERT values for ${table}`);
  return {
    sourceRowCount: tuples.length,
    sqlBatches: Array.from({ length: Math.ceil(tuples.length / maxRows) }, (_, index) => `${prefix}${tuples.slice(index * maxRows, (index + 1) * maxRows).join(",")};`),
  };
}

const sourceRowCount = insertMatches.reduce((count, insert) => count + splitInsertIntoBatches(insert).sourceRowCount, 0);

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existing] = await connection.query("SHOW TABLES LIKE ?", [table]);
  let schemaCreated = false;
  if (existing.length === 0) {
    const ddl = createMatch[0].replace(`CREATE TABLE \`${table}\``, `CREATE TABLE IF NOT EXISTS \`${table}\``);
    await connection.query(ddl);
    schemaCreated = true;
  }

  const [countRows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  const beforeCount = Number(countRows[0].count);
  if (beforeCount !== 0) {
    console.log(JSON.stringify({ table, schemaCreated, beforeCount, sourceInsertSegments: insertMatches.length, sourceRowCount, differenceCount: beforeCount - sourceRowCount, action: "skipped_nonempty" }, null, 2));
    process.exitCode = 2;
  } else {
    await connection.beginTransaction();
    let insertedRows = 0;
    for (const insert of insertMatches) {
      const { sqlBatches } = splitInsertIntoBatches(insert);
      for (const batch of sqlBatches) {
        const [result] = await connection.query(batch);
        insertedRows += Number(result.affectedRows ?? 0);
      }
    }
    await connection.commit();
    const [afterRows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    const afterCount = Number(afterRows[0].count);
    console.log(JSON.stringify({ table, schemaCreated, beforeCount, sourceInsertSegments: insertMatches.length, sourceRowCount, insertedRows, afterCount, differenceCount: afterCount - sourceRowCount }, null, 2));
  }
} catch (error) {
  try { await connection.rollback(); } catch { /* no transaction was opened */ }
  throw error;
} finally {
  await connection.end();
}
