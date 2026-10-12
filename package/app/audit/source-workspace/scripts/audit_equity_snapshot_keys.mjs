import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query("SELECT `id`, `country_code`, `symbol`, `range`, `source`, `status`, `fetched_at` FROM `equity_quote_snapshots` ORDER BY `id`");
  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
} finally {
  await connection.end();
}
