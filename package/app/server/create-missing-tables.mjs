/**
 * create-missing-tables.mjs
 * 创建 etf_products / fund_data 等缺失表（TiDB 兼容，text 列不使用 DEFAULT）
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const sqls = [
  `CREATE TABLE IF NOT EXISTS etf_products (
    id int AUTO_INCREMENT NOT NULL,
    symbol varchar(20) NOT NULL,
    name varchar(255) NOT NULL,
    name_en varchar(255),
    price varchar(32) NOT NULL DEFAULT '0',
    nav varchar(32),
    change_val varchar(32) NOT NULL DEFAULT '0',
    change_pct varchar(32) NOT NULL DEFAULT '0',
    volume varchar(32) NOT NULL DEFAULT '0',
    fund_type varchar(100),
    asset_class varchar(100),
    region varchar(100),
    rating varchar(20),
    created_at timestamp NOT NULL DEFAULT (now()),
    updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY etf_products_symbol_unique (symbol)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS etf_holdings (
    id int AUTO_INCREMENT NOT NULL,
    etf_id int NOT NULL,
    holding_name varchar(255) NOT NULL,
    holding_type varchar(50),
    weight varchar(32) NOT NULL DEFAULT '0',
    created_at timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS fund_data (
    id int AUTO_INCREMENT NOT NULL,
    symbol varchar(20) NOT NULL,
    name varchar(255) NOT NULL,
    name_en varchar(255),
    price varchar(32) NOT NULL DEFAULT '0',
    change_val varchar(32) NOT NULL DEFAULT '0',
    change_pct varchar(32) NOT NULL DEFAULT '0',
    fund_type varchar(100),
    asset_class varchar(100),
    created_at timestamp NOT NULL DEFAULT (now()),
    updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY fund_data_symbol_unique (symbol)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS fund_distributions (
    id int AUTO_INCREMENT NOT NULL,
    fund_id int NOT NULL,
    distribution_type varchar(50) NOT NULL,
    name varchar(255) NOT NULL,
    weight varchar(32) NOT NULL DEFAULT '0',
    created_at timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS workbench_panels (
    id int AUTO_INCREMENT NOT NULL,
    user_id int NOT NULL,
    panel_id varchar(50) NOT NULL,
    panel_type varchar(50) NOT NULL,
    title varchar(255),
    config text,
    position_x int DEFAULT 0,
    position_y int DEFAULT 0,
    width int DEFAULT 400,
    height int DEFAULT 300,
    created_at timestamp NOT NULL DEFAULT (now()),
    updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS crvf_watchlist (
    id int AUTO_INCREMENT NOT NULL,
    user_id int NOT NULL,
    curve_id varchar(50) NOT NULL,
    created_at timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

for (const sql of sqls) {
  try {
    await conn.execute(sql);
    const tname = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`✓ Table ${tname} ensured`);
  } catch (e) {
    console.log(`SKIP (${e.code}): ${e.message.slice(0, 80)}`);
  }
}

await conn.end();
console.log('All tables done.');
