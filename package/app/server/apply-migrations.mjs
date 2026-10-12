/**
 * apply-migrations.mjs
 * 读取 drizzle/0001~0003 的 SQL 文件，按 statement-breakpoint 拆分后逐条执行。
 * 已存在的表（CREATE TABLE）若冲突则跳过，确保幂等。
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.join(__dirname, '..', 'drizzle');

const files = ['0001_lethal_mister_fear.sql', '0002_military_sasquatch.sql', '0003_slippery_archangel.sql'];

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection({ uri: url, multipleStatements: false });

for (const file of files) {
  const sqlText = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
  const statements = sqlText
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean);
  for (let stmt of statements) {
    // 去掉末尾分号
    stmt = stmt.replace(/;\s*$/, '');
    if (!stmt) continue;
    // TiDB 不支持 text/blob 列的 DEFAULT，移除这些默认值子句
    stmt = stmt.replace(/(`?\w+`?\s+text)\s+NOT NULL\s+DEFAULT\s*\([^)]*\)/gi, '$1 NOT NULL');
    stmt = stmt.replace(/(`?\w+`?\s+text)\s+DEFAULT\s*\([^)]*\)/gi, '$1');
    try {
      await conn.execute(stmt);
      const m = stmt.match(/CREATE TABLE `?(\w+)`?/i);
      console.log(`✓ [${file}] ${m ? m[1] : stmt.slice(0, 40)}`);
    } catch (e) {
      if (e.code === 'ER_TABLE_EXISTS_ERROR') {
        const m = stmt.match(/CREATE TABLE `?(\w+)`?/i);
        console.log(`• [${file}] ${m ? m[1] : ''} already exists, skipped`);
      } else {
        console.error(`✗ [${file}] ${e.code}: ${e.message}`);
        throw e;
      }
    }
  }
}

await conn.end();
console.log('All migrations applied.');
