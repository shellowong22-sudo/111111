/**
 * 佑诚数据模块的持久化层。表在首次使用时自动创建（与 ucheerAiMemory 相同做法），
 * 部署时不需要额外的迁移步骤。
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

export type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

let ready: Promise<void> | null = null;

const TABLES = [
  sql`CREATE TABLE IF NOT EXISTS uc_sources (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name varchar(200) NOT NULL,
    kind varchar(24) NOT NULL,
    config_json mediumtext NOT NULL,
    slot_id varchar(64) NOT NULL DEFAULT 'tool.board',
    interval_minutes int NOT NULL DEFAULT 0,
    enabled tinyint(1) NOT NULL DEFAULT 1,
    last_run_at timestamp NULL DEFAULT NULL,
    last_status varchar(24) NOT NULL DEFAULT 'never',
    last_error varchar(1000) DEFAULT NULL,
    created_by int DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY uc_sources_kind_idx (kind)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_datasets (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_id int NOT NULL,
    table_key varchar(255) NOT NULL,
    name varchar(200) NOT NULL,
    fields_json mediumtext NOT NULL,
    pipeline_json mediumtext NOT NULL,
    current_version int NOT NULL DEFAULT 0,
    published_version int NOT NULL DEFAULT 0,
    row_count int NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uc_datasets_source_table_uq (source_id, table_key(191))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_dataset_versions (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dataset_id int NOT NULL,
    version int NOT NULL,
    status enum('candidate','published','withdrawn','rejected','superseded') NOT NULL DEFAULT 'candidate',
    row_count int NOT NULL DEFAULT 0,
    stats_json mediumtext NOT NULL,
    run_id int DEFAULT NULL,
    reviewed_by int DEFAULT NULL,
    reviewed_at timestamp NULL DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uc_dataset_versions_uq (dataset_id, version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_dataset_rows (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dataset_id int NOT NULL,
    version int NOT NULL,
    row_index int NOT NULL,
    record_key varchar(255) NOT NULL DEFAULT '',
    view_json mediumtext NOT NULL,
    full_json mediumtext NOT NULL,
    KEY uc_dataset_rows_version_idx (dataset_id, version, row_index)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_modules (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code varchar(64) NOT NULL,
    name varchar(120) NOT NULL,
    dataset_id int NOT NULL,
    slot_id varchar(64) NOT NULL,
    template varchar(32) NOT NULL,
    definition_json mediumtext NOT NULL,
    status enum('draft','published','archived') NOT NULL DEFAULT 'draft',
    published_version int NOT NULL DEFAULT 0,
    sort_order int NOT NULL DEFAULT 0,
    variant_of int DEFAULT NULL,
    traffic_pct int NOT NULL DEFAULT 0,
    updated_by int DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uc_modules_code_uq (code),
    KEY uc_modules_slot_idx (slot_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_module_versions (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    module_id int NOT NULL,
    version int NOT NULL,
    definition_json mediumtext NOT NULL,
    published_by int DEFAULT NULL,
    published_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uc_module_versions_uq (module_id, version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_runs (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_id int NOT NULL,
    trigger_kind varchar(24) NOT NULL,
    status enum('running','succeeded','failed') NOT NULL DEFAULT 'running',
    started_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at timestamp NULL DEFAULT NULL,
    stats_json mediumtext,
    error varchar(2000) DEFAULT NULL,
    KEY uc_runs_source_idx (source_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_run_steps (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    run_id int NOT NULL,
    dataset_id int DEFAULT NULL,
    step varchar(24) NOT NULL,
    status varchar(16) NOT NULL,
    rows_in int NOT NULL DEFAULT 0,
    rows_out int NOT NULL DEFAULT 0,
    duration_ms int NOT NULL DEFAULT 0,
    detail varchar(2000) NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY uc_run_steps_run_idx (run_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_alerts (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    kind varchar(48) NOT NULL,
    ref varchar(120) NOT NULL,
    severity enum('info','warning','critical') NOT NULL DEFAULT 'warning',
    message varchar(1000) NOT NULL,
    status enum('open','acknowledged') NOT NULL DEFAULT 'open',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY uc_alerts_status_idx (status, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_module_events (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    module_id int NOT NULL,
    event varchar(24) NOT NULL,
    user_hash varchar(32) NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY uc_module_events_module_idx (module_id, event, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_members (
    user_id int NOT NULL PRIMARY KEY,
    uc_role varchar(24) NOT NULL DEFAULT 'developer',
    perms_json mediumtext NOT NULL,
    updated_by int DEFAULT NULL,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_push_log (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dataset_id int DEFAULT NULL,
    module_id int DEFAULT NULL,
    version int NOT NULL DEFAULT 0,
    mode varchar(16) NOT NULL,
    slots varchar(500) NOT NULL DEFAULT '',
    clients int NOT NULL DEFAULT 0,
    status varchar(16) NOT NULL,
    detail varchar(1000) NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY uc_push_log_idx (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_audit (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id int DEFAULT NULL,
    user_name varchar(120) NOT NULL DEFAULT '',
    action varchar(64) NOT NULL,
    target varchar(160) NOT NULL DEFAULT '',
    detail varchar(2000) NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY uc_audit_idx (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  // 平台自有数据仓库：新闻、K 线、分钟行情快照永久保存
  sql`CREATE TABLE IF NOT EXISTS uc_news (
    id varchar(32) NOT NULL PRIMARY KEY,
    cluster varchar(32) NOT NULL,
    title varchar(400) NOT NULL,
    summary text NULL,
    url varchar(1500) NULL,
    published_at bigint NOT NULL,
    lang varchar(8) NOT NULL,
    region varchar(32) NOT NULL,
    cats varchar(255) NOT NULL DEFAULT '',
    tone tinyint NOT NULL DEFAULT 0,
    tone_score float NOT NULL DEFAULT 0,
    tickers varchar(255) NOT NULL DEFAULT '',
    kind varchar(10) NOT NULL DEFAULT 'article',
    feed varchar(40) NOT NULL DEFAULT '',
    body mediumtext NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY uc_news_time_idx (published_at),
    KEY uc_news_cluster_idx (cluster)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  sql`CREATE TABLE IF NOT EXISTS uc_kline (
    symbol varchar(32) NOT NULL,
    period varchar(4) NOT NULL,
    t bigint NOT NULL,
    o double NOT NULL,
    h double NOT NULL,
    l double NOT NULL,
    c double NOT NULL,
    v double NULL,
    s varchar(4) NULL,
    PRIMARY KEY (symbol, period, t)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  sql`CREATE TABLE IF NOT EXISTS uc_portfolios (
    owner varchar(64) NOT NULL PRIMARY KEY,
    data_json mediumtext NOT NULL,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  sql`CREATE TABLE IF NOT EXISTS uc_series (
    series varchar(64) NOT NULL,
    d varchar(10) NOT NULL,
    v double NOT NULL,
    PRIMARY KEY (series, d)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  sql`CREATE TABLE IF NOT EXISTS uc_tick_minute (
    symbol varchar(32) NOT NULL,
    minute bigint NOT NULL,
    price double NOT NULL,
    change_pct double NULL,
    volume double NULL,
    PRIMARY KEY (symbol, minute)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/** 已建表的升级：旧版 kind 是枚举，放宽为字符串以支持 http / database / market 等新数据源 */
const MIGRATIONS = [
  sql`ALTER TABLE uc_sources MODIFY kind varchar(24) NOT NULL`,
];

export async function ucDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("数据库未连接，无法使用佑诚数据模块");
  if (!ready) {
    ready = (async () => {
      for (const statement of TABLES) await db.execute(statement);
      for (const statement of MIGRATIONS) {
        try {
          await db.execute(statement);
        } catch {
          /* 已是新结构 */
        }
      }
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
  return db;
}

/** drizzle mysql2 的 execute 返回 [rows, fields]；统一取出行。 */
export async function query<T = Record<string, unknown>>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const db = await ucDb();
  const result = (await db.execute(statement)) as unknown;
  const rows = Array.isArray(result) ? result[0] : (result as { rows?: unknown })?.rows ?? result;
  return (Array.isArray(rows) ? rows : []) as T[];
}

export async function exec(statement: ReturnType<typeof sql>): Promise<{ insertId: number; affectedRows: number }> {
  const db = await ucDb();
  const result = (await db.execute(statement)) as unknown;
  const header = (Array.isArray(result) ? result[0] : result) as { insertId?: number; affectedRows?: number };
  return { insertId: Number(header?.insertId ?? 0), affectedRows: Number(header?.affectedRows ?? 0) };
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function raiseAlert(kind: string, ref: string, message: string, severity: "info" | "warning" | "critical" = "warning") {
  try {
    await exec(sql`INSERT INTO uc_alerts (kind, ref, severity, message) VALUES (${kind}, ${ref}, ${severity}, ${message.slice(0, 1000)})`);
  } catch (error) {
    console.error("[uc] 写入告警失败", error);
  }
}

/** 操作日志：后台每一次写操作都记一笔 */
export async function audit(user: { id?: number; name?: string | null; email?: string | null } | null | undefined, action: string, target: string, detail: unknown = "") {
  try {
    const text = typeof detail === "string" ? detail : JSON.stringify(detail);
    await exec(sql`INSERT INTO uc_audit (user_id, user_name, action, target, detail)
      VALUES (${user?.id ?? null}, ${String(user?.name ?? user?.email ?? "").slice(0, 120)}, ${action.slice(0, 64)}, ${target.slice(0, 160)}, ${text.slice(0, 2000)})`);
  } catch {
    /* 日志失败不影响操作 */
  }
}
