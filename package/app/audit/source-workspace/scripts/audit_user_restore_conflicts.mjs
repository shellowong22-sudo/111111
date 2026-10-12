import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const dump = fs.readFileSync(path.join(projectRoot, "_baseline_nested_source/database/finance_hub.sql"), "utf8");

function sourceInserts(table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = dump.match(new RegExp("INSERT INTO `" + escaped + "` VALUES [\\s\\S]*?\\n/\\*!40000 ALTER TABLE `" + escaped + "` ENABLE KEYS \\*/;"));
  if (!match) return [];
  return [...match[0].matchAll(new RegExp("(INSERT INTO `" + escaped + "` VALUES [\\s\\S]*?;)(?=\\n(?:INSERT INTO `" + escaped + "` VALUES|/\\*!40000 ALTER TABLE))", "g"))].map((item) => item[1]);
}

function tuples(insertSql) {
  const marker = " VALUES ";
  const values = insertSql.slice(insertSql.indexOf(marker) + marker.length, -1);
  const found = [];
  let start = 0;
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
    } else if (char === "'") quoted = true;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        found.push(values.slice(start, i + 1));
        const comma = values.indexOf(",", i + 1);
        if (comma === -1) break;
        start = comma + 1;
        i = comma;
      }
    }
  }
  return found;
}

function fields(tuple) {
  const inner = tuple.slice(1, -1);
  const values = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let i = 0; i <= inner.length; i += 1) {
    const char = inner[i];
    if (quoted) {
      if (char === "\\") { i += 1; continue; }
      if (char === "'") {
        if (inner[i + 1] === "'") { i += 1; continue; }
        quoted = false;
      }
    } else if (char === "'") quoted = true;
    else if (char === "[") depth += 1;
    else if (char === "]") depth -= 1;
    else if ((char === "," && depth === 0) || i === inner.length) {
      values.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  return values;
}

function decodeSqlString(value) {
  if (value === "NULL") return null;
  if (!value.startsWith("'") || !value.endsWith("'")) return value;
  return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function sourceRows(table) {
  return sourceInserts(table).flatMap(tuples).map(fields);
}

const sourceUsers = sourceRows("users").map((row) => ({ id: Number(row[0]), openId: decodeSqlString(row[1]) }));
const sourceLinkedUserIds = new Set([
  ...sourceRows("money_market_module_usage_events").map((row) => Number(row[1])),
  ...sourceRows("terminal_security_events").map((row) => Number(row[1])),
]);
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [liveUsers] = await connection.query("SELECT `id`, `openId` FROM `users`");
  const liveIds = new Set(liveUsers.map((row) => Number(row.id)));
  const liveOpenIds = new Set(liveUsers.map((row) => String(row.openId)));
  const sourceIds = new Set(sourceUsers.map((row) => row.id));
  const sourceOpenIds = new Set(sourceUsers.map((row) => row.openId));
  const sourceReferencedUsers = [...sourceLinkedUserIds].filter((id) => sourceIds.has(id));
  console.log(JSON.stringify({
    sourceUserCount: sourceUsers.length,
    liveUserCount: liveUsers.length,
    sourceUserIdCollisionCount: sourceUsers.filter((row) => liveIds.has(row.id)).length,
    sourceOpenIdCollisionCount: sourceUsers.filter((row) => liveOpenIds.has(row.openId)).length,
    linkedSourceUserIdCount: sourceLinkedUserIds.size,
    linkedUsersMissingFromSourceUsersCount: sourceLinkedUserIds.size - sourceReferencedUsers.length,
    action: "no_user_or_user_linked_table_data_written",
  }, null, 2));
} finally {
  await connection.end();
}
