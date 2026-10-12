import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const appRoot = path.resolve(import.meta.dirname, "../..");
const journalPath = path.join(appRoot, "drizzle", "meta", "_journal.json");
const outputPath = path.join(
  appRoot,
  "audit",
  "runtime",
  "migration-state-report.json"
);
const journal = JSON.parse(await readFile(journalPath, "utf8"));
// The audit is read-only.  A loopback default keeps local verification
// reproducible when the shell did not export DATABASE_URL; deployments still
// must provide their own explicit connection string.
const databaseUrl =
  process.env.DATABASE_URL ?? "mysql://root@127.0.0.1:3307/finance_hub";
const connection = await mysql.createConnection(databaseUrl);

try {
  const [migrationRows] = await connection.query(
    "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at"
  );
  const [tableRows] = await connection.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  const [userColumns] = await connection.query(
    "SELECT ordinal_position, column_name, column_type, is_nullable, column_key, extra FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' ORDER BY ordinal_position"
  );
  const [userIndexes] = await connection.query(
    "SELECT index_name, non_unique, seq_in_index, column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' ORDER BY index_name, seq_in_index"
  );
  const [[userCount]] = await connection.query(
    "SELECT COUNT(*) AS row_count FROM users"
  );
  const [[openIdIntegrity]] = await connection.query(
    "SELECT SUM(`openId` IS NULL OR `openId` = '') AS missing_open_id_count, COUNT(*) - COUNT(DISTINCT `openId`) AS duplicate_open_id_excess_count FROM users"
  );
  const [journalEntryRange] = await connection.query(
    "SELECT MIN(created_at) AS first_created_at, MAX(created_at) AS last_created_at FROM __drizzle_migrations"
  );
  const report = {
    generatedAt: new Date().toISOString(),
    auditKind: "read-only-drizzle-migration-state",
    journalPath,
    database: {
      host: new URL(databaseUrl).hostname,
      port: new URL(databaseUrl).port || null,
      database: new URL(databaseUrl).pathname.replace(/^\//, ""),
    },
    archiveJournalEntryCount: journal.entries?.length ?? 0,
    archiveJournalFirstTag: journal.entries?.[0]?.tag ?? null,
    archiveJournalLastTag: journal.entries?.at(-1)?.tag ?? null,
    appliedMigrationCount: migrationRows.length,
    appliedMigrations: migrationRows,
    appliedMigrationDateRange: journalEntryRange[0],
    actualBaseTableCount: tableRows.length,
    actualBaseTables: tableRows
      .map(row => row.table_name ?? row.TABLE_NAME)
      .filter(Boolean),
    users: {
      rowCount: Number(userCount.row_count),
      columns: userColumns,
      indexes: userIndexes,
      openIdIntegrity: {
        missingOpenIdCount: Number(openIdIntegrity.missing_open_id_count),
        duplicateOpenIdExcessCount: Number(
          openIdIntegrity.duplicate_open_id_excess_count
        ),
      },
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        appliedMigrationCount: report.appliedMigrationCount,
        actualBaseTableCount: report.actualBaseTableCount,
        users: report.users,
      },
      null,
      2
    )
  );
} finally {
  await connection.end();
}
