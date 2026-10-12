import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dumpPath = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql';
const evidenceDirectory = path.join(projectRoot, 'recovery-evidence');
const evidencePath = path.join(evidenceDirectory, 'database-restore-result.json');
const allowedBeforeTables = new Set(['users', '__drizzle_migrations']);
const allowInitializedAuthOverwrite = process.argv.includes('--allow-initialized-auth-overwrite');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is unavailable; database restoration was not attempted.');
}

const dumpBuffer = await readFile(dumpPath);
const dumpSha256 = createHash('sha256').update(dumpBuffer).digest('hex');
const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

try {
  const [beforeRows] = await connection.query(`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY table_name
  `);
  const beforeTables = beforeRows.map((row) => row.tableName);
  const unexpectedTables = beforeTables.filter((tableName) => !allowedBeforeTables.has(tableName));
  if (unexpectedTables.length > 0) {
    throw new Error(`Refusing restore because the target database contains unexpected tables: ${unexpectedTables.join(', ')}`);
  }

  const [userCountRows] = await connection.query('SELECT COUNT(*) AS count FROM users');
  const userCount = Number(userCountRows[0]?.count ?? 0);
  if (userCount > 0 && (!allowInitializedAuthOverwrite || userCount !== 1)) {
    throw new Error(`Refusing restore because users contains ${userCount} row(s). Only a single initialization record can be overwritten with --allow-initialized-auth-overwrite.`);
  }

  await connection.query(dumpBuffer.toString('utf8'));

  const [afterRows] = await connection.query(`
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
    ORDER BY table_name
  `);
  const afterTables = afterRows.map((row) => row.tableName);
  const [marketRows] = await connection.query('SELECT COUNT(*) AS count, MAX(updated_at) AS latestUpdatedAt FROM market_data');
  const [curveRows] = await connection.query('SELECT COUNT(*) AS count FROM curve_data_points');
  const [listingRows] = await connection.query('SELECT COUNT(*) AS count FROM equity_listings');

  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify({
    restoredAt: new Date().toISOString(),
    dumpPath,
    dumpSha256,
    beforeTables,
    initializedUserCountBeforeRestore: userCount,
    initializedAuthOverwriteAllowed: allowInitializedAuthOverwrite,
    afterTableCount: afterTables.length,
    afterTables,
    keyCounts: {
      marketData: Number(marketRows[0]?.count ?? 0),
      marketDataLatestUpdatedAt: marketRows[0]?.latestUpdatedAt ?? null,
      curveDataPoints: Number(curveRows[0]?.count ?? 0),
      equityListings: Number(listingRows[0]?.count ?? 0),
    },
  }, null, 2)}\n`, 'utf8');
  process.stdout.write(`RESTORE_OK tables=${afterTables.length} market_data=${marketRows[0]?.count ?? 0} curve_data_points=${curveRows[0]?.count ?? 0} equity_listings=${listingRows[0]?.count ?? 0}\n`);
} finally {
  await connection.end();
}
