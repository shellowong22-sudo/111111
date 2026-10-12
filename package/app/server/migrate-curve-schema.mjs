/**
 * migrate-curve-schema.mjs
 * 将 curves / curve_regions / curve_data_points 三张表对齐为代码（drizzle/schema.ts + curves-db.ts）所用结构，
 * 并无损迁移已导入的数据。幂等：可重复执行。
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const conn = await mysql.createConnection({ uri: url });

async function hasColumn(table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [table, column]
  );
  return rows[0].c > 0;
}

// ---------- 1. curve_regions: 需要 code ----------
if (!(await hasColumn('curve_regions', 'code'))) {
  await conn.query("ALTER TABLE curve_regions ADD COLUMN code varchar(10) NULL AFTER name");
  console.log('✓ curve_regions.code added');
}
// 为每个 region 填充 code（基于名称映射），保证唯一非空
const regionCodeMap = {
  '美洲': 'AM', '欧洲': 'EU', '亚太': 'AP', '新兴市场': 'EM', '全球': 'GL',
};
{
  const [regions] = await conn.query('SELECT id, name, code FROM curve_regions');
  for (const r of regions) {
    if (!r.code) {
      const code = regionCodeMap[r.name] || ('R' + r.id);
      await conn.query('UPDATE curve_regions SET code=? WHERE id=?', [code, r.id]);
    }
  }
  console.log('✓ curve_regions.code populated');
}

// ---------- 2. curves: 需要 code, region_id, description ----------
if (!(await hasColumn('curves', 'code'))) {
  await conn.query("ALTER TABLE curves ADD COLUMN code varchar(50) NULL AFTER name");
  console.log('✓ curves.code added');
}
if (!(await hasColumn('curves', 'region_id'))) {
  await conn.query("ALTER TABLE curves ADD COLUMN region_id int NULL AFTER category_id");
  console.log('✓ curves.region_id added');
}
if (!(await hasColumn('curves', 'description'))) {
  await conn.query("ALTER TABLE curves ADD COLUMN description text NULL AFTER code");
  console.log('✓ curves.description added');
}
// 填充 code（来自旧 curve_id 列，如果存在）
if (await hasColumn('curves', 'curve_id')) {
  await conn.query("UPDATE curves SET code = curve_id WHERE (code IS NULL OR code='') AND curve_id IS NOT NULL");
  console.log('✓ curves.code populated from curve_id');
}
// 填充 region_id（来自旧 region 名称列映射 curve_regions.id）
if (await hasColumn('curves', 'region')) {
  await conn.query(`
    UPDATE curves c
    JOIN curve_regions r ON c.region = r.name
    SET c.region_id = r.id
    WHERE c.region_id IS NULL
  `);
  console.log('✓ curves.region_id populated from region name');
}
// 填充 description（用 name_en 兜底，避免 NULL 显示问题）
if (await hasColumn('curves', 'name_en')) {
  await conn.query("UPDATE curves SET description = name_en WHERE description IS NULL");
}

// ---------- 3. curve_data_points: 需要 maturity, yield, spread, date ----------
if (!(await hasColumn('curve_data_points', 'maturity'))) {
  await conn.query("ALTER TABLE curve_data_points ADD COLUMN maturity varchar(50) NULL AFTER curve_id");
  console.log('✓ curve_data_points.maturity added');
}
if (!(await hasColumn('curve_data_points', 'yield'))) {
  await conn.query("ALTER TABLE curve_data_points ADD COLUMN `yield` text NULL AFTER maturity");
  console.log('✓ curve_data_points.yield added');
}
if (!(await hasColumn('curve_data_points', 'spread'))) {
  await conn.query("ALTER TABLE curve_data_points ADD COLUMN spread text NULL AFTER `yield`");
  console.log('✓ curve_data_points.spread added');
}
if (!(await hasColumn('curve_data_points', 'date'))) {
  await conn.query("ALTER TABLE curve_data_points ADD COLUMN `date` varchar(10) NULL AFTER spread");
  console.log('✓ curve_data_points.date added');
}
// 迁移数据：period->maturity, value->yield, data_date->date
if (await hasColumn('curve_data_points', 'period')) {
  await conn.query("UPDATE curve_data_points SET maturity = period WHERE maturity IS NULL");
}
if (await hasColumn('curve_data_points', 'value')) {
  await conn.query("UPDATE curve_data_points SET `yield` = `value` WHERE `yield` IS NULL");
}
if (await hasColumn('curve_data_points', 'data_date')) {
  await conn.query("UPDATE curve_data_points SET `date` = data_date WHERE `date` IS NULL");
}
console.log('✓ curve_data_points data migrated (period->maturity, value->yield, data_date->date)');

await conn.end();
console.log('Curve schema migration complete.');
