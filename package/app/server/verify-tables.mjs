import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const tables = ['analyst_ratings', 'ai_report_summaries'];
for (const t of tables) {
  const [rows] = await conn.execute(`SHOW TABLES LIKE '${t}'`);
  console.log(`${t}: ${rows.length > 0 ? 'EXISTS ✓' : 'MISSING ✗'}`);
}
await conn.end();
