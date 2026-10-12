import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

/**
 * Read-only database evidence for the recovered terminal.
 *
 * This intentionally reports drift instead of repairing it.  A repair that
 * silently creates duplicate tables or deletes duplicate content would hide
 * the evidence needed to decide which historical record is authoritative.
 */
const appRoot = path.resolve(import.meta.dirname, "../..");
const journalPath = path.join(appRoot, "drizzle", "meta", "_journal.json");
const outputPath = path.join(
  appRoot,
  "audit",
  "runtime",
  "database-health-report.json"
);
const databaseUrl =
  process.env.DATABASE_URL ?? "mysql://root@127.0.0.1:3307/finance_hub";
const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const migrationDirectory = path.join(appRoot, "drizzle");
const migrationSqlFiles = readdirSync(migrationDirectory)
  .filter(file => /^\d{4}_.+\.sql$/.test(file))
  .sort()
  .map(file => {
    const sql = readFileSync(path.join(migrationDirectory, file), "utf8");
    return {
      tag: file.replace(/\.sql$/, ""),
      file,
      sql,
      sha256: createHash("sha256").update(sql).digest("hex"),
    };
  });
const migrationFiles = migrationSqlFiles.map(migration => migration.tag);
const journalTags = new Set((journal.entries ?? []).map(entry => entry.tag));

const spiderCompletionMigration = migrationSqlFiles.find(
  migration => migration.tag === "0110_complete_spider_platform"
);
const spiderExpectedShapes = Object.fromEntries(
  (spiderCompletionMigration?.sql ?? "").split(/\r?\n/).flatMap(statement => {
    const tableMatch = statement.match(
      /^CREATE TABLE IF NOT EXISTS `([^`]+)` \((.*)\);$/
    );
    if (!tableMatch) return [];
    const [, tableName, body] = tableMatch;
    const columns = [
      ...new Set(
        [
          ...body.matchAll(
            /(?:^|,)`([^`]+)`\s+(?:int|varchar|text|longtext|boolean|json|timestamp|decimal|date|enum)/gi
          ),
        ].map(match => match[1])
      ),
    ];
    const indexes = [
      ...new Set(
        [...body.matchAll(/(?:UNIQUE KEY|INDEX) `([^`]+)`/g)].map(
          match => match[1]
        )
      ),
    ];
    return [[tableName, { columns, indexes }]];
  })
);

// These post-recovery SQL files are absent from the migration ledger even
// though their DDL may already have been restored. Enumerating their intended
// objects lets the audit distinguish "schema missing" from "ledger drift"
// without executing CREATE/ALTER statements a second time.
const pendingShapeExpectations = {
  "0104_tiresome_saracen": {
    admin_data_module_automation_run_items: {
      columns: [
        "status",
        "item_key",
        "current_step",
        "priority",
        "max_attempts",
        "retry_after",
        "lease_token",
        "lease_expires_at",
        "idempotency_key",
        "result_summary",
      ],
      indexes: [
        "admin_data_module_automation_run_items_item_key_unique",
        "admin_data_module_automation_run_items_idempotency_key_unique",
        "admin_mod_run_item_status_priority_idx",
        "admin_mod_run_item_lease_idx",
      ],
    },
    admin_data_module_automation_step_events: {
      columns: [
        "id",
        "run_id",
        "job_item_id",
        "module_id",
        "step",
        "action",
        "status",
        "detail",
        "duration_ms",
        "actor_user_id",
        "created_at",
      ],
      indexes: [
        "admin_mod_step_run_created_idx",
        "admin_mod_step_item_created_idx",
        "admin_mod_step_module_created_idx",
      ],
    },
    admin_data_module_content_items: {
      columns: [
        "content_key",
        "content_hash",
        "dedupe_scope",
        "delivery_version_id",
      ],
      indexes: [
        "admin_data_module_content_items_content_key_unique",
        "admin_mod_content_dedupe_uq",
        "admin_mod_content_module_status_idx",
        "admin_mod_content_run_status_idx",
        "admin_mod_content_version_idx",
      ],
    },
    admin_data_module_delivery_operations: {
      columns: [
        "operation_key",
        "idempotency_key",
        "candidate_payload",
        "result_snapshot",
      ],
      indexes: [
        "admin_data_module_delivery_operations_operation_key_unique",
        "admin_data_module_delivery_operations_idempotency_key_unique",
        "admin_mod_delivery_operation_module_status_idx",
        "admin_mod_delivery_operation_version_idx",
        "admin_mod_delivery_operation_run_idx",
      ],
    },
    admin_data_module_execution_locks: {
      columns: ["lock_key", "lease_token", "expires_at"],
      indexes: ["admin_mod_execution_lock_expires_idx"],
    },
    admin_data_module_request_cache: {
      columns: ["cache_key", "status", "value", "expires_at"],
      indexes: ["admin_mod_request_cache_expires_idx"],
    },
  },
  "0105_solid_maddog": {
    admin_data_module_system_settings: {
      columns: [
        "setting_key",
        "category",
        "value",
        "updated_by_user_id",
        "created_at",
        "updated_at",
      ],
      indexes: ["admin_mod_system_settings_category_updated_idx"],
    },
  },
  "0106_mighty_post": {
    admin_data_module_profiles: {
      columns: ["publish_schedule", "recommendation_rule", "dedupe_scope"],
      indexes: [],
    },
  },
  "0107_marvelous_vivisector": {
    admin_data_module_content_items: {
      columns: ["quality_report"],
      indexes: [],
    },
  },
  "0108_awesome_medusa": {
    admin_data_module_automation_runs: {
      columns: ["scope", "module_ids_json"],
      indexes: [],
    },
  },
  "0109_certain_maginty": {
    standalone_schedules: {
      columns: [
        "id",
        "name",
        "cron_expression",
        "callback_path",
        "callback_method",
        "callback_payload",
        "description",
        "is_enabled",
        "last_executed_at",
        "last_status",
        "last_error",
        "created_at",
        "updated_at",
      ],
      indexes: [
        "standalone_schedules_name_unique",
        "standalone_schedules_enabled_idx",
      ],
    },
  },
};
const requiredTables = [
  "users",
  "market_data",
  "admin_news_ingestion_sources",
  "admin_news_ingestion_articles",
  "admin_data_module_profiles",
  "admin_data_module_content_items",
  "admin_data_module_delivery_operations",
  "admin_data_module_delivery_events",
  "admin_data_module_refresh_events",
  "admin_data_module_automation_run_items",
  "admin_data_module_automation_step_events",
  "admin_data_module_execution_locks",
  "admin_data_module_request_cache",
  "admin_data_module_system_settings",
  "admin_data_module_automation_runs",
  "standalone_schedules",
  "spider_raw_data",
  "spider_ai_processed",
  "spider_content_snapshot",
  "finance_world_dataset",
  "spider_push_relation",
];

const schemaAuditTables = [
  ...new Set([
    ...requiredTables,
    ...Object.keys(spiderExpectedShapes),
    ...Object.values(pendingShapeExpectations).flatMap(tables =>
      Object.keys(tables)
    ),
  ]),
];

const duplicateChecks = {
  contentItemsByScopeHash: {
    table: "admin_data_module_content_items",
    sql: "SELECT dedupe_scope AS scope, content_hash AS hash, COUNT(*) AS row_count FROM admin_data_module_content_items GROUP BY dedupe_scope, content_hash HAVING COUNT(*) > 1 ORDER BY row_count DESC LIMIT 100",
  },
  rawByContentHash: {
    table: "spider_raw_data",
    sql: "SELECT content_hash AS hash, COUNT(*) AS row_count FROM spider_raw_data GROUP BY content_hash HAVING COUNT(*) > 1 ORDER BY row_count DESC LIMIT 100",
  },
  snapshotsByEntityHash: {
    table: "spider_content_snapshot",
    sql: "SELECT entity_uuid AS entity_uuid, content_hash AS hash, COUNT(*) AS row_count FROM spider_content_snapshot GROUP BY entity_uuid, content_hash HAVING COUNT(*) > 1 ORDER BY row_count DESC LIMIT 100",
  },
  articlesBySourceUrl: {
    table: "admin_news_ingestion_articles",
    sql: "SELECT source_url AS source_url, COUNT(*) AS row_count FROM admin_news_ingestion_articles GROUP BY source_url HAVING COUNT(*) > 1 ORDER BY row_count DESC LIMIT 100",
  },
  worldDataBySourceObservation: {
    table: "finance_world_dataset",
    sql: "SELECT source_url AS source_url, asset_code AS asset_code, data_sub_type AS data_sub_type, MD5(COALESCE(raw_content, '')) AS content_hash, COUNT(*) AS row_count FROM finance_world_dataset GROUP BY source_url, asset_code, data_sub_type, MD5(COALESCE(raw_content, '')) HAVING COUNT(*) > 1 ORDER BY row_count DESC LIMIT 100",
  },
};

const connection = await mysql.createConnection({
  uri: databaseUrl,
  multipleStatements: false,
});

async function query(sql, params = []) {
  const [rows] = await connection.query(sql, params);
  return rows;
}

async function tableExists(tableName) {
  const rows = await query(
    "SELECT COUNT(*) AS row_count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? AND table_type = 'BASE TABLE'",
    [tableName]
  );
  return Number(rows[0]?.row_count ?? 0) > 0;
}

async function countRows(tableName) {
  if (!(await tableExists(tableName))) return null;
  const rows = await query(
    `SELECT COUNT(*) AS row_count FROM \`${tableName}\``
  );
  return Number(rows[0]?.row_count ?? 0);
}

async function duplicateExcess(sql, tableName) {
  if (!(await tableExists(tableName)))
    return { groups: [], excessRows: 0, status: "table_missing" };
  const groups = await query(sql);
  const excessRows = groups.reduce(
    (total, row) => total + Math.max(0, Number(row.row_count ?? 0) - 1),
    0
  );
  return {
    groups,
    excessRows,
    status: excessRows === 0 ? "clean" : "duplicates_detected",
  };
}

try {
  const [migrationRows, tableRows, indexRows, columnRows] = await Promise.all([
    query(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at"
    ),
    query(
      "SELECT TABLE_NAME AS table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME"
    ),
    query(
      "SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name, NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS seq_in_index, COLUMN_NAME AS column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
      [schemaAuditTables]
    ),
    query(
      "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME, ORDINAL_POSITION",
      [schemaAuditTables]
    ),
  ]);

  const existingTables = new Set(tableRows.map(row => row.table_name));
  const rowCounts = {};
  for (const tableName of requiredTables)
    rowCounts[tableName] = await countRows(tableName);

  const duplicateResults = {};
  for (const [name, check] of Object.entries(duplicateChecks)) {
    duplicateResults[name] = await duplicateExcess(check.sql, check.table);
  }

  const uniqueIndexes = {};
  for (const row of indexRows) {
    if (!uniqueIndexes[row.table_name]) uniqueIndexes[row.table_name] = {};
    if (!uniqueIndexes[row.table_name][row.index_name])
      uniqueIndexes[row.table_name][row.index_name] = {
        unique: Number(row.non_unique) === 0,
        columns: [],
      };
    uniqueIndexes[row.table_name][row.index_name].columns.push(row.column_name);
  }

  const actualColumns = {};
  for (const row of columnRows) {
    if (!actualColumns[row.table_name]) actualColumns[row.table_name] = [];
    actualColumns[row.table_name].push(row.column_name);
  }
  const spiderSchemaReconciliation = Object.fromEntries(
    Object.entries(spiderExpectedShapes).map(([tableName, expected]) => {
      const actualColumnSet = new Set(actualColumns[tableName] ?? []);
      const actualIndexSet = new Set(
        Object.keys(uniqueIndexes[tableName] ?? {})
      );
      const missingColumns = expected.columns.filter(
        column => !actualColumnSet.has(column)
      );
      const missingIndexes = expected.indexes.filter(
        index => !actualIndexSet.has(index)
      );
      return [
        tableName,
        {
          exists: existingTables.has(tableName),
          expectedColumnCount: expected.columns.length,
          actualColumnCount: actualColumns[tableName]?.length ?? 0,
          missingColumns,
          missingIndexes,
          state:
            existingTables.has(tableName) &&
            missingColumns.length === 0 &&
            missingIndexes.length === 0
              ? "shape_present"
              : "repair_required",
        },
      ];
    })
  );
  const pendingMigrationSchemaReconciliation = Object.fromEntries(
    Object.entries(pendingShapeExpectations).map(([tag, tables]) => {
      const tableResults = Object.fromEntries(
        Object.entries(tables).map(([tableName, expected]) => {
          const actualColumnSet = new Set(actualColumns[tableName] ?? []);
          const actualIndexSet = new Set(
            Object.keys(uniqueIndexes[tableName] ?? {})
          );
          const missingColumns = expected.columns.filter(
            column => !actualColumnSet.has(column)
          );
          const missingIndexes = expected.indexes.filter(
            index => !actualIndexSet.has(index)
          );
          return [
            tableName,
            {
              exists: existingTables.has(tableName),
              missingColumns,
              missingIndexes,
            },
          ];
        })
      );
      return [
        tag,
        {
          tables: tableResults,
          state: Object.values(tableResults).every(
            result =>
              result.exists &&
              result.missingColumns.length === 0 &&
              result.missingIndexes.length === 0
          )
            ? "shape_present"
            : "repair_required",
        },
      ];
    })
  );
  const appliedHashes = new Set(
    migrationRows.map(row => String(row.hash).toLowerCase())
  );
  const migrationHashMatches = migrationSqlFiles
    .filter(migration => appliedHashes.has(migration.sha256))
    .map(migration => migration.tag);
  const migrationHashMissing = migrationSqlFiles
    .filter(migration => !appliedHashes.has(migration.sha256))
    .map(migration => migration.tag);

  const pendingFrontAckRows = await (tableExists("spider_push_relation")
    ? query(
        "SELECT push_status AS status, COUNT(*) AS row_count FROM spider_push_relation GROUP BY push_status ORDER BY push_status"
      )
    : Promise.resolve([]));
  const deliveryStatusRows = await (tableExists(
    "admin_data_module_delivery_operations"
  )
    ? query(
        "SELECT status AS status, COUNT(*) AS row_count FROM admin_data_module_delivery_operations GROUP BY status ORDER BY status"
      )
    : Promise.resolve([]));

  const report = {
    auditKind: "read-only-database-health",
    generatedAt: new Date().toISOString(),
    database: {
      host: parsedUrl.hostname,
      port: parsedUrl.port || null,
      database: databaseName,
    },
    paths: { appRoot, journalPath },
    migrations: {
      journalEntryCount: journal.entries?.length ?? 0,
      appliedMigrationCount: migrationRows.length,
      journalFirstTag: journal.entries?.[0]?.tag ?? null,
      journalLastTag: journal.entries?.at(-1)?.tag ?? null,
      sqlFileCount: migrationFiles.length,
      sqlFilesNotInJournal: migrationFiles.filter(tag => !journalTags.has(tag)),
      journalTagsWithoutSqlFile: [...journalTags].filter(
        tag => !migrationFiles.includes(tag)
      ),
      sqlFilesMatchedToAppliedHashes: migrationHashMatches,
      sqlFilesNotMatchedToAppliedHashes: migrationHashMissing,
      appliedHashesWithoutCurrentSqlFile:
        migrationRows.length - migrationHashMatches.length,
      state:
        migrationRows.length === (journal.entries?.length ?? 0)
          ? "aligned_count"
          : "drift_detected",
    },
    tables: {
      baseTableCount: tableRows.length,
      required: Object.fromEntries(
        requiredTables.map(tableName => [
          tableName,
          existingTables.has(tableName),
        ])
      ),
      missingRequired: requiredTables.filter(
        tableName => !existingTables.has(tableName)
      ),
      rowCounts,
    },
    uniqueIndexes,
    pendingMigrationSchemaReconciliation,
    spiderSchemaReconciliation,
    duplicateChecks: duplicateResults,
    delivery: {
      pushStatus: pendingFrontAckRows,
      operationStatus: deliveryStatusRows,
    },
    interpretation: {
      duplicatePolicy:
        "content_hash and dedupe_scope are audited read-only; no rows are deleted or overwritten by this command.",
      frontAckPolicy:
        "only front_acknowledged is a confirmed rendered receipt; waiting_front_ack and failed remain non-success states.",
      migrationPolicy:
        "migration/table drift is reported for explicit reconciliation; this audit never generates or runs a duplicate CREATE TABLE migration.",
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...report, outputPath }, null, 2));
} finally {
  await connection.end();
}
