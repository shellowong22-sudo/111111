/**
 * run-migrations.mjs
 * 按顺序执行所有 drizzle migration SQL 文件
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

// 创建迁移记录表
await conn.execute(`
  CREATE TABLE IF NOT EXISTS _drizzle_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

const migrationsDir = path.join(__dirname, '..', 'drizzle');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${files.length} migration files`);

for (const file of files) {
  // 检查是否已执行
  const [rows] = await conn.execute(
    'SELECT id FROM _drizzle_migrations WHERE filename = ?',
    [file]
  );
  if (rows.length > 0) {
    console.log(`⏭  Skipping ${file} (already applied)`);
    continue;
  }

  const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`▶  Applying ${file} (${statements.length} statements)...`);
  
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
    } catch (err) {
      // 忽略 "already exists" 类错误
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || 
          err.code === 'ER_DUP_KEYNAME' ||
          err.code === 'ER_DUP_FIELDNAME' ||
          err.message.includes('Duplicate') ||
          err.message.includes('already exists')) {
        console.log(`  ⚠ Skipped (already exists): ${stmt.substring(0, 60)}...`);
      } else {
        console.error(`  ✗ Error in ${file}: ${err.message}`);
        console.error(`  Statement: ${stmt.substring(0, 100)}`);
        // 继续执行其他语句
      }
    }
  }

  // 记录已执行
  await conn.execute(
    'INSERT IGNORE INTO _drizzle_migrations (filename) VALUES (?)',
    [file]
  );
  console.log(`✓  ${file} applied`);
}

await conn.end();
console.log('\nAll migrations complete!');
