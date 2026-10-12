import "dotenv/config";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL || (
  process.env.NODE_ENV !== "production" ? "mysql://root@127.0.0.1:3307/finance_hub" : ""
);
if (!url) throw new Error("DATABASE_URL is required");
const connection = await mysql.createConnection(url);
try {
  const ddl = await readFile(new URL("../drizzle/0118_official_news_feed_items.sql", import.meta.url), "utf8");
  await connection.query(ddl);
  const [[result]] = await connection.query(
    "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'official_news_feed_items'"
  );
  if (Number(result.tableCount) !== 1) throw new Error("Official news archive table is missing");
  console.log("official_news_feed_items: ready");
} finally {
  await connection.end();
}
