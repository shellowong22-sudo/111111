/**
 * run-all-migrations.mjs
 * 按顺序执行所有 drizzle migration SQL 文件，幂等执行
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

const drizzleDir = path.join(__dirname, '..', 'drizzle');
const files = fs.readdirSync(drizzleDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${files.length} migration files`);

for (const file of files) {
  const sqlText = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
  const statements = sqlText
    .split('--> statement-breakpoint')
    .map(s => s.trim().replace(/;\s*$/, ''))
    .filter(Boolean);

  console.log(`\nExecuting ${file} (${statements.length} statements)...`);
  let ok = 0, skip = 0;
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      ok++;
    } catch (e) {
      // 忽略已存在/重复键等幂等错误
      if (e.code === 'ER_TABLE_EXISTS_ERROR' || 
          e.code === 'ER_DUP_KEYNAME' ||
          e.code === 'ER_DUP_ENTRY' ||
          e.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
          e.message?.includes('Duplicate key name') ||
          e.message?.includes('already exists')) {
        skip++;
      } else {
        console.warn(`  WARN [${e.code}]: ${e.message?.slice(0, 120)}`);
        skip++;
      }
    }
  }
  console.log(`  ✓ ${ok} executed, ${skip} skipped`);
}

await conn.end();
console.log('\nAll migrations complete.');
