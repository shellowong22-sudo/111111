import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const execute = process.argv.includes("--execute");
const SOURCE_DUMP_SHA256 = "829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9";
const REMAP_START_ID = 1890001;
const projectRoot = path.resolve(import.meta.dirname, "../..");
const dump = fs.readFileSync(path.join(projectRoot, "_baseline_nested_source/database/finance_hub.sql"), "utf8");

function sourceInsertSqls(table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dataBlock = dump.match(new RegExp("INSERT INTO `" + escaped + "` VALUES [\\s\\S]*?\\n/\\*!40000 ALTER TABLE `" + escaped + "` ENABLE KEYS \\*/;"));
  if (!dataBlock) throw new Error(`Missing source INSERT block for ${table}`);
  return [...dataBlock[0].matchAll(new RegExp("(INSERT INTO `" + escaped + "` VALUES [\\s\\S]*?;)(?=\\n(?:INSERT INTO `" + escaped + "` VALUES|/\\*!40000 ALTER TABLE))", "g"))].map((match) => match[1]);
}

function splitInsert(insertSql) {
  const marker = " VALUES ";
  const markerIndex = insertSql.indexOf(marker);
  if (markerIndex < 0 || !insertSql.endsWith(";")) throw new Error("Unsupported source INSERT shape");
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
      if (depth < 0) throw new Error("Unbalanced source tuple");
      if (depth === 0) {
        tuples.push(values.slice(tupleStart, i + 1));
        let next = i + 1;
        while (/\s/.test(values[next] ?? "")) next += 1;
        if (next < values.length) {
          if (values[next] !== ",") throw new Error("Unexpected source tuple separator");
          tupleStart = next + 1;
          i = next;
        }
      }
    }
  }
  if (quoted || depth !== 0 || tuples.length === 0) throw new Error("Unable to parse source INSERT tuples");
  return { prefix, tuples };
}

function splitFields(tuple) {
  const inner = tuple.slice(1, -1);
  const fields = [];
  let start = 0;
  let quoted = false;
  let bracketDepth = 0;
  for (let i = 0; i <= inner.length; i += 1) {
    const char = inner[i];
    if (quoted) {
      if (char === "\\") { i += 1; continue; }
      if (char === "'") {
        if (inner[i + 1] === "'") { i += 1; continue; }
        quoted = false;
      }
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth -= 1;
    else if ((char === "," && bracketDepth === 0) || i === inner.length) {
      fields.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  return fields;
}

function decodeSqlString(value) {
  if (value === "NULL") return null;
  if (!value.startsWith("'") || !value.endsWith("'")) return value;
  return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function tableRows(table) {
  return sourceInsertSqls(table).flatMap((insert) => splitInsert(insert).tuples).map(splitFields);
}

function batchInsert(prefix, tuples, maxRows = 500) {
  return Array.from({ length: Math.ceil(tuples.length / maxRows) }, (_, index) => `${prefix}${tuples.slice(index * maxRows, (index + 1) * maxRows).join(",")};`);
}

const sourceUsers = tableRows("users").map((fields) => ({ id: Number(fields[0]), openId: decodeSqlString(fields[1]), fields }));
const sourceUsageEvents = tableRows("money_market_module_usage_events");
const sourceSecurityEvents = tableRows("terminal_security_events");
if (new Set(sourceUsers.map((row) => row.id)).size !== sourceUsers.length) throw new Error("Source user IDs are not unique");
const sourceDuplicateOpenIdCount = sourceUsers.length - new Set(sourceUsers.map((row) => row.openId)).size;

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [liveUsers] = await connection.query("SELECT `id`, `openId` FROM `users`");
  const liveIds = new Set(liveUsers.map((row) => Number(row.id)));
  const liveOpenIds = new Set(liveUsers.map((row) => String(row.openId)));
  const sourceOpenIdCollisionCount = sourceUsers.filter((row) => liveOpenIds.has(row.openId)).length;
  if (sourceOpenIdCollisionCount !== 0) throw new Error("Live/source openId collision detected; automatic migration is forbidden");

  const mapping = new Map();
  const assigned = new Set([...liveIds, ...sourceUsers.map((row) => row.id)]);
  let nextId = REMAP_START_ID;
  for (const user of [...sourceUsers].sort((a, b) => a.id - b.id)) {
    if (!liveIds.has(user.id)) {
      mapping.set(user.id, user.id);
      continue;
    }
    while (assigned.has(nextId)) nextId += 1;
    mapping.set(user.id, nextId);
    assigned.add(nextId);
    nextId += 1;
  }

  const remappedUsers = sourceUsers.filter((user) => mapping.get(user.id) !== user.id);
  const unresolvedUsageEvents = sourceUsageEvents.filter((row) => !mapping.has(Number(row[1]))).length;
  const unresolvedSecurityEvents = sourceSecurityEvents.filter((row) => !mapping.has(Number(row[1]))).length;
  if (unresolvedUsageEvents || unresolvedSecurityEvents) throw new Error("Source events reference a user ID absent from the mapping");
  const mappingDigest = crypto.createHash("sha256").update([...mapping.entries()].sort(([a], [b]) => a - b).map(([sourceId, targetId]) => `${sourceId}:${targetId}`).join("\n")).digest("hex");

  const summary = {
    mode: execute ? "execute" : "dry_run",
    sourceDumpSha256: SOURCE_DUMP_SHA256,
    liveUsersBefore: liveUsers.length,
    sourceUserCount: sourceUsers.length,
    sourceUsageEventCount: sourceUsageEvents.length,
    sourceSecurityEventCount: sourceSecurityEvents.length,
    sourceDuplicateOpenIdCount,
    sourceOpenIdCollisionCount,
    remappedUserCount: remappedUsers.length,
    remapStartId: REMAP_START_ID,
    firstRemap: remappedUsers[0] ? { sourceUserId: remappedUsers[0].id, targetUserId: mapping.get(remappedUsers[0].id) } : null,
    mappingDigest,
  };
  if (!execute) {
    console.log(JSON.stringify({ ...summary, action: "no_data_written" }, null, 2));
    process.exitCode = 0;
  } else {
    const requiredTables = ["money_market_module_usage_events", "terminal_security_events", "recovery_user_id_mappings"];
    for (const table of requiredTables) {
      const [exists] = await connection.query("SHOW TABLES LIKE ?", [table]);
      if (exists.length === 0) throw new Error(`Required migration table is missing: ${table}`);
      const [countRows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      if (Number(countRows[0].count) !== 0) throw new Error(`Target table is not empty: ${table}`);
    }

    const mappedUserTuples = sourceUsers.map((user) => `(${[String(mapping.get(user.id)), ...user.fields.slice(1)].join(",")})`);
    const mappedUsageTuples = sourceUsageEvents.map((fields) => `(${[fields[0], String(mapping.get(Number(fields[1]))), ...fields.slice(2)].join(",")})`);
    const mappedSecurityTuples = sourceSecurityEvents.map((fields) => `(${[fields[0], String(mapping.get(Number(fields[1]))), ...fields.slice(2)].join(",")})`);
    const mappingRows = sourceUsers.map((user) => [user.id, mapping.get(user.id), crypto.createHash("sha256").update(String(user.openId)).digest("hex"), SOURCE_DUMP_SHA256]);

    await connection.beginTransaction();
    try {
      for (const query of batchInsert("INSERT INTO `users` VALUES ", mappedUserTuples)) await connection.query(query);
      for (const query of batchInsert("INSERT INTO `money_market_module_usage_events` VALUES ", mappedUsageTuples)) await connection.query(query);
      for (const query of batchInsert("INSERT INTO `terminal_security_events` VALUES ", mappedSecurityTuples)) await connection.query(query);
      for (const group of Array.from({ length: Math.ceil(mappingRows.length / 500) }, (_, index) => mappingRows.slice(index * 500, (index + 1) * 500))) {
        await connection.query("INSERT INTO `recovery_user_id_mappings` (`source_user_id`,`target_user_id`,`source_open_id_sha256`,`source_dump_sha256`) VALUES ?", [group]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    const [[liveUserCount]] = await connection.query("SELECT COUNT(*) AS count FROM `users`");
    const [[usageCount]] = await connection.query("SELECT COUNT(*) AS count FROM `money_market_module_usage_events`");
    const [[securityCount]] = await connection.query("SELECT COUNT(*) AS count FROM `terminal_security_events`");
    const [[mappingCount]] = await connection.query("SELECT COUNT(*) AS count FROM `recovery_user_id_mappings`");
    console.log(JSON.stringify({
      ...summary,
      liveUsersAfter: Number(liveUserCount.count),
      usageEventsAfter: Number(usageCount.count),
      securityEventsAfter: Number(securityCount.count),
      mappingRowsAfter: Number(mappingCount.count),
      differenceCount: (Number(liveUserCount.count) - liveUsers.length - sourceUsers.length) + (Number(usageCount.count) - sourceUsageEvents.length) + (Number(securityCount.count) - sourceSecurityEvents.length) + (Number(mappingCount.count) - sourceUsers.length),
    }, null, 2));
  }
} finally {
  await connection.end();
}
