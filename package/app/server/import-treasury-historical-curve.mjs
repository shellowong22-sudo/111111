import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const SOURCE_URL = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rate-archives/par-yield-curve-rates-1990-2023.csv';
const IMPORT_KEY = 'treasury-par-yield-curve-month-end-v1-1990-2023';
const CURVE_CODE = 'UST_PAR_YIELD_OFFICIAL_HIST_1990_2023';
const PERIODS = [
  ['1 mo', '1M'], ['3 mo', '3M'], ['6 mo', '6M'], ['1 yr', '1Y'], ['2 yr', '2Y'], ['3 yr', '3Y'],
  ['5 yr', '5Y'], ['7 yr', '7Y'], ['10 yr', '10Y'], ['20 yr', '20Y'], ['30 yr', '30Y'],
];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const parseLine = (line) => {
    const cells = []; let cell = ''; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
      else cell += char;
    }
    cells.push(cell.trim()); return cells;
  };
  const headers = parseLine(lines[0]).map((header) => header.replace(/^\uFEFF/, '').toLowerCase());
  return lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index] ?? '', value])));
}

function isoDate(usDate) {
  const [month, day, year] = usDate.split('/').map(Number);
  if (!month || !day || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function selectActualMonthEndRows(rows) {
  const byMonth = new Map();
  for (const row of rows) {
    const date = isoDate(row.date ?? '');
    if (!date) continue;
    const month = date.slice(0, 7);
    const current = byMonth.get(month);
    if (!current || date > current.date) byMonth.set(month, { row, date });
  }
  return Array.from(byMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function downloadOfficialCsv() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'finance-hub/official-treasury-historical-import' }, signal: controller.signal });
    if (!response.ok) throw new Error(`美国财政部 CSV 返回 HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = buffer.toString('utf8');
    if (!text.startsWith('date,')) throw new Error('美国财政部 CSV 未返回预期的 date 表头。');
    return { text, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  } finally { clearTimeout(timer); }
}

async function ensureZipTestCurve(connection) {
  const [[existing]] = await connection.query('SELECT id FROM curves WHERE curve_id = ? LIMIT 1', ['ZIP_TEST_CURVE_PRESERVED']);
  if (existing?.id) return existing.id;
  const [legacyPoints] = await connection.query('SELECT id FROM curve_data_points WHERE curve_id = 1 LIMIT 1');
  if (legacyPoints.length) {
    await connection.execute(
      `INSERT INTO curves (curve_id, name, name_en, country, currency, type, region, category, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ZIP_TEST_CURVE_PRESERVED', 'ZIP 内置测试性曲线（未认证）', 'ZIP Test Curve (Unverified)', '未标注', 'N/A', 'Test', '未标注', 'Test', '为保持 ZIP 内置测试数据的既有 curve_id=1 关联而创建；不是官方历史资产。', true],
    );
    const [[created]] = await connection.query('SELECT id FROM curves WHERE curve_id = ? LIMIT 1', ['ZIP_TEST_CURVE_PRESERVED']);
    if (!created?.id) throw new Error('未能创建 ZIP 测试性曲线保留目录。');
    return created.id;
  }
  await connection.execute(
    `INSERT INTO curves (curve_id, name, name_en, country, currency, type, region, category, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ZIP_TEST_CURVE_PRESERVED', 'ZIP 内置测试性曲线（未认证）', 'ZIP Test Curve (Unverified)', '未标注', 'N/A', 'Test', '未标注', 'Test', '为隔离 ZIP 内置测试性曲线而保留；不是官方历史资产。', true],
  );
  const [[created]] = await connection.query('SELECT id FROM curves WHERE curve_id = ? LIMIT 1', ['ZIP_TEST_CURVE_PRESERVED']);
  if (!created?.id) throw new Error('未能创建 ZIP 测试性曲线保留目录。');
  return created.id;
}

async function reconcileExistingImportedCurve(connection, audit) {
  const [outOfRange] = await connection.query(
    'SELECT id FROM curve_data_points WHERE curve_id = ? AND data_date > ?',
    [audit.curve_id, audit.source_last_date],
  );
  if (!outOfRange.length) return 0;
  const zipTestCurveId = await ensureZipTestCurve(connection);
  await connection.execute(
    'UPDATE curve_data_points SET curve_id = ? WHERE curve_id = ? AND data_date > ?',
    [zipTestCurveId, audit.curve_id, audit.source_last_date],
  );
  return outOfRange.length;
}

async function main() {
  const { text, sha256 } = await downloadOfficialCsv();
  const selected = selectActualMonthEndRows(parseCsv(text));
  if (!selected.length) throw new Error('美国财政部 CSV 不含可解析的实际月末观测。');
  const points = selected.flatMap(({ row, date }) => PERIODS.flatMap(([sourceColumn, period]) => {
    const value = row[sourceColumn];
    return value && Number.isFinite(Number(value)) ? [{ dataDate: date, period, value }] : [];
  }));
  if (!points.length) throw new Error('美国财政部 CSV 不含可导入的受控期限点。');

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM treasury_historical_curve_imports WHERE import_key = ? LIMIT 1 FOR UPDATE', [IMPORT_KEY]);
    if (existing.length) {
      const [[audit]] = await connection.query('SELECT curve_id, source_last_date FROM treasury_historical_curve_imports WHERE import_key = ? LIMIT 1', [IMPORT_KEY]);
      const movedZipTestPoints = await reconcileExistingImportedCurve(connection, audit);
      await connection.commit();
      console.log(JSON.stringify({ importKey: IMPORT_KEY, status: 'already_imported', movedZipTestPoints }, null, 2));
      return;
    }
    await ensureZipTestCurve(connection);
    await connection.execute(
      `INSERT INTO curves (curve_id, name, name_en, country, currency, type, region, category, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [CURVE_CODE, '美国财政部官方历史 PAR 收益率曲线（1990–2023 月末）', 'U.S. Treasury Official Historical PAR Yield Curve (1990–2023 Month-End)', '美国', 'USD', 'Government', '美洲', 'Government', '美国财政部 Daily Treasury Par Yield Curve 归档的每月最后一个实际发布观测；独立于 ZIP 测试性曲线。', true],
    );
    const [[curve]] = await connection.query('SELECT id FROM curves WHERE curve_id = ? LIMIT 1', [CURVE_CODE]);
    if (!curve?.id) throw new Error('未能读取独立官方历史曲线的内部 ID。');
    for (let offset = 0; offset < points.length; offset += 500) {
      const batch = points.slice(offset, offset + 500);
      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const values = batch.flatMap((point) => [curve.id, point.dataDate, point.period, point.value]);
      await connection.execute(`INSERT INTO curve_data_points (curve_id, data_date, period, value) VALUES ${placeholders}`, values);
    }
    await connection.execute(
      `INSERT INTO treasury_historical_curve_imports
        (import_key, curve_id, source_url, source_sha256, source_first_date, source_last_date, sampling_rule, selected_observation_count, imported_point_count, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [IMPORT_KEY, curve.id, SOURCE_URL, sha256, selected[0].date, selected.at(-1).date, 'calendar-month last actual Treasury-published observation; no interpolation', selected.length, points.length],
    );
    await connection.commit();
    console.log(JSON.stringify({ importKey: IMPORT_KEY, curveId: curve.id, curveCode: CURVE_CODE, sourceUrl: SOURCE_URL, sourceSha256: sha256, firstDate: selected[0].date, lastDate: selected.at(-1).date, selectedObservationCount: selected.length, importedPointCount: points.length }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { await connection.end(); }
}

main().then(() => process.exit(0)).catch((error) => { console.error(`官方历史曲线导入失败：${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
