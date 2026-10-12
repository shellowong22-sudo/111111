import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dumpPath = '/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql';
const evidenceDirectory = path.join(projectRoot, 'recovery-evidence');
const evidencePath = path.join(evidenceDirectory, 'database-restore-result.json');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is unavailable; database verification was not attempted.');
}

const dumpSha256 = createHash('sha256').update(await readFile(dumpPath)).digest('hex');
const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

try {
  const [tableRows] = await connection.query(`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY table_name
  `);
  const [marketRows] = await connection.query('SELECT COUNT(*) AS count, MAX(updated_at) AS latestUpdatedAt FROM market_data');
  const [curveRows] = await connection.query('SELECT COUNT(*) AS count FROM curve_data_points');
  const [listingRows] = await connection.query('SELECT COUNT(*) AS count FROM equity_listings');
  const [userRows] = await connection.query('SELECT COUNT(*) AS count FROM users');
  const result = {
    verifiedAt: new Date().toISOString(),
    dumpPath,
    dumpSha256,
    tableCount: tableRows.length,
    tableNames: tableRows.map((row) => row.tableName),
    keyCounts: {
      marketData: Number(marketRows[0]?.count ?? 0),
      marketDataLatestUpdatedAt: marketRows[0]?.latestUpdatedAt ?? null,
      curveDataPoints: Number(curveRows[0]?.count ?? 0),
      equityListings: Number(listingRows[0]?.count ?? 0),
      users: Number(userRows[0]?.count ?? 0),
    },
  };
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`VERIFY_OK tables=${result.tableCount} market_data=${result.keyCounts.marketData} curve_data_points=${result.keyCounts.curveDataPoints} equity_listings=${result.keyCounts.equityListings}\n`);
} finally {
  await connection.end();
}
