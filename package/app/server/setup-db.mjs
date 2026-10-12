/**
 * setup-db.mjs
 * 一次性执行所有数据库建表和迁移，使用 process.exit 避免连接挂起
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

async function run(sql, desc) {
  try {
    await conn.execute(sql);
    console.log('✓', desc);
  } catch (e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME' || 
        e.message?.includes('already exists') || e.message?.includes('Duplicate key')) {
      console.log('~ skip (exists):', desc);
    } else {
      console.warn('! warn:', desc, '-', e.message?.slice(0, 100));
    }
  }
}

// 1. market_data 表
await run(`
  CREATE TABLE IF NOT EXISTS market_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    market ENUM('stock','bond','forex','commodity','index','derivative','option','fund') NOT NULL DEFAULT 'stock',
    price VARCHAR(64) NOT NULL DEFAULT '0',
    change_val VARCHAR(64) NOT NULL DEFAULT '0',
    change_pct VARCHAR(64) NOT NULL DEFAULT '0',
    volume VARCHAR(64) NOT NULL DEFAULT '0',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol (symbol)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`, 'CREATE market_data');

// 2. 确保 market 枚举包含所有值
const [cols] = await conn.execute(`
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'market_data' AND COLUMN_NAME = 'market'
`);
const currentType = cols[0]?.COLUMN_TYPE ?? '';
const needed = ['option', 'fund', 'bond'];
const missing = needed.filter(v => !currentType.includes(`'${v}'`));
if (missing.length > 0) {
  const allValues = ['stock','bond','forex','commodity','index','derivative','option','fund'];
  const enumDef = allValues.map(v => `'${v}'`).join(',');
  await run(`ALTER TABLE market_data MODIFY COLUMN market ENUM(${enumDef}) NOT NULL DEFAULT 'stock'`, 'ALTER market enum');
} else {
  console.log('~ market enum already complete');
}

// 3. 检查现有表
const [tables] = await conn.execute('SHOW TABLES');
console.log('\nAll tables:', tables.map(r => Object.values(r)[0]).join(', '));

console.log('\n✅ Database setup complete');
process.exit(0);
