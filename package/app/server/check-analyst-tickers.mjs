import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT ticker, COUNT(*) as cnt FROM analyst_ratings GROUP BY ticker ORDER BY cnt DESC'
);
console.log('analyst_ratings by ticker:');
rows.forEach(r => console.log(`  ${r.ticker}: ${r.cnt}`));
await conn.end();
process.exit(0);
