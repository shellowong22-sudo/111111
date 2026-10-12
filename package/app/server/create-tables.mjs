import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// etf_products
await conn.execute(`CREATE TABLE IF NOT EXISTS etf_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(128) NOT NULL,
  price VARCHAR(32),
  nav VARCHAR(32),
  change_val VARCHAR(32) NOT NULL DEFAULT '0',
  change_pct VARCHAR(32) NOT NULL DEFAULT '0',
  volume VARCHAR(32) NOT NULL DEFAULT '0',
  fund_type VARCHAR(100),
  asset_class VARCHAR(100),
  region VARCHAR(100),
  rating VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_etf_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
console.log('✓ etf_products');

// fund_data
await conn.execute(`CREATE TABLE IF NOT EXISTS fund_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(128) NOT NULL,
  price VARCHAR(32),
  change_val VARCHAR(32) NOT NULL DEFAULT '0',
  change_pct VARCHAR(32) NOT NULL DEFAULT '0',
  fund_type VARCHAR(100),
  asset_class VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fund_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
console.log('✓ fund_data');

// yield_curves
await conn.execute(`CREATE TABLE IF NOT EXISTS yield_curves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curve_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  country VARCHAR(64),
  currency VARCHAR(16),
  curve_type VARCHAR(64),
  category VARCHAR(64),
  description VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_curve_id (curve_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
console.log('✓ yield_curves');

// curve_data_points
await conn.execute(`CREATE TABLE IF NOT EXISTS curve_data_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curve_id VARCHAR(64) NOT NULL,
  tenor VARCHAR(16) NOT NULL,
  tenor_years DECIMAL(10,4),
  rate DECIMAL(10,6),
  date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_curve_id (curve_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
console.log('✓ curve_data_points');

await conn.end();
console.log('All tables created.');
