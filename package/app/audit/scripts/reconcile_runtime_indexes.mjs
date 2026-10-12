import mysql from "mysql2/promise";

/**
 * Narrow, idempotent reconciliation for indexes proven missing by the
 * read-only health audit. This command never creates/drops tables or removes
 * data, and it refuses to run when the expected table/columns are absent.
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "mysql://root@127.0.0.1:3307/finance_hub";
const connection = await mysql.createConnection({
  uri: databaseUrl,
  multipleStatements: false,
});

async function query(sql, params = []) {
  const [rows] = await connection.query(sql, params);
  return rows;
}

try {
  const tableRows = await query(
    "SELECT COUNT(*) AS row_count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'standalone_schedules' AND table_type = 'BASE TABLE'"
  );
  if (Number(tableRows[0]?.row_count ?? 0) !== 1)
    throw new Error(
      "standalone_schedules table is absent; refusing index reconciliation"
    );

  const columnRows = await query(
    "SELECT COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'standalone_schedules' AND COLUMN_NAME IN ('is_enabled', 'updated_at')"
  );
  const columns = new Set(columnRows.map(row => row.column_name));
  if (!columns.has("is_enabled") || !columns.has("updated_at"))
    throw new Error(
      "standalone_schedules expected columns are absent; refusing index reconciliation"
    );

  const indexRows = await query(
    "SELECT INDEX_NAME AS index_name, SEQ_IN_INDEX AS sequence_number, COLUMN_NAME AS column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'standalone_schedules' AND index_name = 'standalone_schedules_enabled_idx' ORDER BY SEQ_IN_INDEX"
  );
  if (indexRows.length === 0) {
    await connection.query(
      "CREATE INDEX `standalone_schedules_enabled_idx` ON `standalone_schedules` (`is_enabled`, `updated_at`)"
    );
  } else {
    const signature = indexRows.map(row => row.column_name).join(",");
    if (signature !== "is_enabled,updated_at")
      throw new Error(
        `standalone_schedules_enabled_idx has unexpected columns: ${signature}`
      );
  }

  const verifiedRows = await query(
    "SELECT SEQ_IN_INDEX AS sequence_number, COLUMN_NAME AS column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'standalone_schedules' AND index_name = 'standalone_schedules_enabled_idx' ORDER BY SEQ_IN_INDEX"
  );
  console.log(
    JSON.stringify(
      {
        action:
          indexRows.length === 0 ? "created_missing_index" : "already_present",
        table: "standalone_schedules",
        index: "standalone_schedules_enabled_idx",
        columns: verifiedRows.map(row => row.column_name),
        verified:
          verifiedRows.map(row => row.column_name).join(",") ===
          "is_enabled,updated_at",
      },
      null,
      2
    )
  );
} finally {
  await connection.end();
}
