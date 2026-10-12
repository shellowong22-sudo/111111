import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [cols] = await conn.execute(
  "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='etf_products'"
);
const colNames = cols.map(c => c.COLUMN_NAME);
console.log('Existing cols:', colNames.join(', '));

const toAdd = [
  ['name_en', 'VARCHAR(128)'],
  ['description', 'VARCHAR(512)'],
  ['expense_ratio', 'VARCHAR(20)'],
  ['aum', 'VARCHAR(32)'],
];

for (const [col, type] of toAdd) {
  if (!colNames.includes(col)) {
    await conn.execute(`ALTER TABLE etf_products ADD COLUMN ${col} ${type}`);
    console.log(`Added ${col}`);
  }
}

await conn.end();
console.log('etf_products table fixed.');
