/**
 * alter-market-enum.mjs
 * 扩展 market 枚举字段，添加 option / fund / bond 三种类型
 * 如果 market_data 表不存在则先创建，再确保枚举包含所有值
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

// 1. 确保 market_data 表存在（含 market 枚举列）
await conn.execute(`
  CREATE TABLE IF NOT EXISTS market_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    market ENUM('stock','bond','forex','commodity','index','derivative','option','fund') NOT NULL DEFAULT 'stock',
    price DECIMAL(18,6) NOT NULL DEFAULT 0,
    change_val DECIMAL(18,6) NOT NULL DEFAULT 0,
    change_pct DECIMAL(10,4) NOT NULL DEFAULT 0,
    volume BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol (symbol)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log('✓ market_data table ensured');

// 2. 检查当前枚举值
const [cols] = await conn.execute(`
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'market_data' AND COLUMN_NAME = 'market'
`);
const currentType = cols[0]?.COLUMN_TYPE ?? '';
console.log('Current market column type:', currentType);

// 3. 如果缺少 option/fund/bond 则 ALTER
const needed = ['option', 'fund', 'bond'];
const missing = needed.filter(v => !currentType.includes(`'${v}'`));
if (missing.length > 0) {
  const allValues = ['stock','bond','forex','commodity','index','derivative','option','fund'];
  const enumDef = allValues.map(v => `'${v}'`).join(',');
  await conn.execute(`
    ALTER TABLE market_data
    MODIFY COLUMN market ENUM(${enumDef}) NOT NULL DEFAULT 'stock'
  `);
  console.log(`✓ market enum extended with: ${missing.join(', ')}`);
} else {
  console.log('✓ market enum already contains option/fund/bond, no change needed');
}

await conn.end();
console.log('Migration complete.');
