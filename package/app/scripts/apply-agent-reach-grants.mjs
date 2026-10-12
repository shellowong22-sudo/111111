import "dotenv/config";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

// A narrowly scoped, repeatable migration. Never run the whole legacy
// migration history against an existing production database to add one table.
const url = process.env.DATABASE_URL || (
  process.env.NODE_ENV !== "production"
    ? "mysql://root@127.0.0.1:3307/finance_hub"
    : ""
);
if (!url) throw new Error("DATABASE_URL is required");
const ddl = await readFile(new URL("../drizzle/0116_agent_reach_module_grants.sql", import.meta.url), "utf8");
const connection = await mysql.createConnection(url);
try {
  await connection.query(ddl);
  const [[result]] = await connection.query(
    "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'agent_reach_module_grants'"
  );
  if (Number(result.tableCount) !== 1) throw new Error("Agent Reach grants table is missing");
  console.log("agent_reach_module_grants: ready");
} finally {
  await connection.end();
}
