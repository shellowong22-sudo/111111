import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM analyst_ratings');
console.log('analyst_ratings count:', rows[0].cnt);
const [rows2] = await conn.execute('SELECT ticker, firm, rating, date FROM analyst_ratings LIMIT 5');
console.log('sample:', JSON.stringify(rows2));
await conn.end();
process.exit(0);
