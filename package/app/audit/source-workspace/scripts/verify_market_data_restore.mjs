import { readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const dump = await readFile("/home/ubuntu/finance-hub-recovery/audit/runtime/market_data_original_insert.sql", "utf8");
const sourceRows = [...dump.matchAll(/\((\d+),'([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/g)].map((match) => ({
  id: Number(match[1]), symbol: match[2], name: match[3], market: match[4], price: match[5], changeVal: match[6], changePct: match[7], volume: match[8], updatedAt: match[9],
}));
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [liveRows] = await connection.query("SELECT id, symbol, name, market, price, change_val AS changeVal, change_pct AS changePct, volume, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt FROM market_data ORDER BY id");
await connection.end();
const columns = ["id", "symbol", "name", "market", "price", "changeVal", "changePct", "volume", "updatedAt"];
const differences = sourceRows.flatMap((source) => {
  const live = liveRows.find((row) => row.id === source.id);
  if (!live) return [{ id: source.id, type: "missing" }];
  const mismatch = columns.filter((column) => String(source[column]) !== String(live[column]));
  return mismatch.length ? [{ id: source.id, type: "mismatch", fields: mismatch, source, live }] : [];
});
const result = { sourceCount: sourceRows.length, liveCount: liveRows.length, differences };
await writeFile("/home/ubuntu/finance-hub-recovery/audit/runtime/market_data_restore_verification.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify({ sourceCount: result.sourceCount, liveCount: result.liveCount, differenceCount: differences.length }, null, 2));
