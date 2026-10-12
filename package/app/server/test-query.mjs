import { drizzle } from 'drizzle-orm/mysql2';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);
try {
  const [rows] = await db.execute('SELECT * FROM curves LIMIT 1');
  console.log('curves direct query OK:', rows.length, 'rows');
  if (rows.length > 0) console.log('columns:', Object.keys(rows[0]));
  
  const [rows2] = await db.execute('SELECT * FROM curve_regions LIMIT 1');
  console.log('curve_regions direct query OK:', rows2.length, 'rows');
  if (rows2.length > 0) console.log('columns:', Object.keys(rows2[0]));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
