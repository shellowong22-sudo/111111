/**
 * 创建 analyst_ratings 和 ai_report_summaries 表
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);
console.log('[DB] Connected');

const sqls = [
  `CREATE TABLE IF NOT EXISTS analyst_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    name VARCHAR(255) DEFAULT '',
    analyst VARCHAR(255) DEFAULT '',
    firm VARCHAR(255) DEFAULT '',
    rating VARCHAR(50) DEFAULT '',
    prev_rating VARCHAR(50) DEFAULT '',
    target DECIMAL(10,2) DEFAULT NULL,
    prev_target DECIMAL(10,2) DEFAULT NULL,
    chg VARCHAR(50) DEFAULT 'maintain',
    rating_type VARCHAR(50) DEFAULT 'maintain',
    current_price DECIMAL(10,2) DEFAULT NULL,
    upside DECIMAL(8,2) DEFAULT NULL,
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticker (ticker),
    INDEX idx_rated_at (rated_at)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_report_summaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    name VARCHAR(255) DEFAULT '',
    analyst VARCHAR(255) DEFAULT '',
    rating VARCHAR(50) DEFAULT '',
    target DECIMAL(10,2) DEFAULT NULL,
    investment_thesis JSON DEFAULT NULL,
    target_price_rationale TEXT,
    target_price DECIMAL(10,2) DEFAULT NULL,
    catalysts JSON DEFAULT NULL,
    risks JSON DEFAULT NULL,
    recommendation VARCHAR(50) DEFAULT 'hold',
    time_horizon VARCHAR(50) DEFAULT '12个月',
    key_metrics JSON DEFAULT NULL,
    conclusion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticker (ticker),
    INDEX idx_created_at (created_at)
  )`,
];

for (const sql of sqls) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  try {
    await conn.execute(sql);
    console.log(`[OK] Table ${tableName} created/verified`);
  } catch (err) {
    console.error(`[ERR] ${tableName}:`, err.message);
  }
}

await conn.end();
console.log('[Done] All tables processed');
