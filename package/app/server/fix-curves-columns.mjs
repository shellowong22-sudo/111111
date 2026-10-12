import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const conn = await mysql.createConnection({ uri: url });

async function hasColumn(table, column) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
    [table, column]
  );
  return rows[0].c > 0;
}

// curves 表补充列
if (!(await hasColumn('curves', 'region_id'))) {
  await conn.query('ALTER TABLE curves ADD COLUMN region_id int NULL');
  console.log('✓ curves.region_id added');
} else {
  console.log('- curves.region_id already exists');
}

if (!(await hasColumn('curves', 'description'))) {
  await conn.query('ALTER TABLE curves ADD COLUMN description text NULL');
  console.log('✓ curves.description added');
} else {
  console.log('- curves.description already exists');
}

if (!(await hasColumn('curves', 'code'))) {
  await conn.query('ALTER TABLE curves ADD COLUMN code varchar(50) NULL');
  console.log('✓ curves.code added');
} else {
  console.log('- curves.code already exists');
}

// curve_data_points 表补充列
if (!(await hasColumn('curve_data_points', 'maturity'))) {
  await conn.query('ALTER TABLE curve_data_points ADD COLUMN maturity varchar(50) NULL');
  console.log('✓ curve_data_points.maturity added');
} else {
  console.log('- curve_data_points.maturity already exists');
}

if (!(await hasColumn('curve_data_points', 'yield'))) {
  await conn.query('ALTER TABLE curve_data_points ADD COLUMN `yield` text NULL');
  console.log('✓ curve_data_points.yield added');
} else {
  console.log('- curve_data_points.yield already exists');
}

if (!(await hasColumn('curve_data_points', 'spread'))) {
  await conn.query('ALTER TABLE curve_data_points ADD COLUMN spread text NULL');
  console.log('✓ curve_data_points.spread added');
} else {
  console.log('- curve_data_points.spread already exists');
}

if (!(await hasColumn('curve_data_points', 'date'))) {
  await conn.query('ALTER TABLE curve_data_points ADD COLUMN `date` varchar(10) NULL');
  console.log('✓ curve_data_points.date added');
} else {
  console.log('- curve_data_points.date already exists');
}

// 数据迁移 - 检查列存在性再迁移
const hasPeriod = await hasColumn('curve_data_points', 'period');
const hasValue = await hasColumn('curve_data_points', 'value');
const hasDataDate = await hasColumn('curve_data_points', 'data_date');
if (hasPeriod) await conn.query('UPDATE curve_data_points SET maturity = period WHERE maturity IS NULL');
if (hasValue) await conn.query('UPDATE curve_data_points SET `yield` = value WHERE `yield` IS NULL');
if (hasDataDate) await conn.query('UPDATE curve_data_points SET `date` = data_date WHERE `date` IS NULL');
console.log('✓ curve_data_points data migrated');

// 填充 curves.code
await conn.query('UPDATE curves SET code = curve_id WHERE (code IS NULL OR code = \'\') AND curve_id IS NOT NULL');
console.log('✓ curves.code populated');

// 填充 region_id
await conn.query(`
  UPDATE curves c
  JOIN curve_regions r ON c.region = r.name
  SET c.region_id = r.id
  WHERE c.region_id IS NULL
`);
console.log('✓ curves.region_id populated');

await conn.end();
console.log('Fix complete.');
