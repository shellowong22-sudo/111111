import mysql from "mysql2/promise";

const requiredTables = ["market_data", "notifications", "users"];
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.query("SHOW TABLES");
const tableNames = rows.map((row) => Object.values(row)[0]).sort();
const keyTableStatus = Object.fromEntries(requiredTables.map((table) => [table, tableNames.includes(table)]));
const restoredDataTables = [
  "market_data",
  "equity_quote_snapshots",
  "equity_listings",
  "curves",
  "curve_data_points",
  "treasury_historical_curve_imports",
  "forex_central_bank_decision_events",
  "money_market_source_availability_snapshots",
  "index_constituent_archive_events",
  "admin_runtime_health_samples",
  "terminal_watermark_settings",
  "notifications",
];
const rowCounts = {};
for (const table of restoredDataTables) {
  if (!tableNames.includes(table)) continue;
  const [count] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  rowCounts[table] = Number(count[0].count);
}
console.log(JSON.stringify({ tableCount: tableNames.length, keyTableStatus, rowCounts, tableNames }, null, 2));
await connection.end();
