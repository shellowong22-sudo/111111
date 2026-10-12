import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  bigint,
  boolean,
  json,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "trader", "risk_manager"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Ucheer AI: each history and memory row is owned by one authenticated user.
export const ucheerAiConversations = mysqlTable("ucheer_ai_conversations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  lastSummarizedMessageId: bigint("last_summarized_message_id", { mode: "number" }).notNull().default(0),
  lastDistillAttemptedMessageId: bigint("last_distill_attempted_message_id", { mode: "number" }).notNull().default(0),
  lastDistillStatus: mysqlEnum("last_distill_status", ["never", "pending", "running", "completed", "failed"]).notNull().default("never"),
  lastDistillError: varchar("last_distill_error", { length: 500 }),
  lastDistillAt: timestamp("last_distill_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("ucheer_ai_conversations_user_updated_idx").on(table.userId, table.updatedAt)]);

export const ucheerAiMessages = mysqlTable("ucheer_ai_messages", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  conversationId: varchar("conversation_id", { length: 36 }).notNull(),
  userId: int("user_id").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  feedback: mysqlEnum("feedback", ["helpful", "unhelpful"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ucheer_ai_messages_user_conversation_idx").on(table.userId, table.conversationId, table.id),
  index("ucheer_ai_messages_feedback_idx").on(table.feedback),
]);

export const ucheerAiMemories = mysqlTable("ucheer_ai_memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  kind: mysqlEnum("kind", ["core", "daily"]).notNull(),
  content: varchar("content", { length: 600 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  memoryKey: varchar("memory_key", { length: 120 }).notNull().default(""),
  confidence: varchar("confidence", { length: 16 }).notNull().default("0.70"),
  evidence: varchar("evidence", { length: 600 }).notNull().default(""),
  status: mysqlEnum("status", ["active", "superseded"]).notNull().default("active"),
  lastSeenMessageId: bigint("last_seen_message_id", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("ucheer_ai_memories_user_fingerprint_uq").on(table.userId, table.fingerprint),
  index("ucheer_ai_memories_user_key_idx").on(table.userId, table.memoryKey, table.status),
  index("ucheer_ai_memories_user_kind_updated_idx").on(table.userId, table.kind, table.updatedAt),
]);

// Automatic memory work is durable and observable. A failed distillation is
// recorded once and retried only when a newer user turn arrives, so a bad
// model response cannot spin forever or silently discard the user's history.
export const ucheerAiEvolutionEvents = mysqlTable("ucheer_ai_evolution_events", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  conversationId: varchar("conversation_id", { length: 36 }),
  eventType: mysqlEnum("event_type", ["memory_captured", "distillation_completed", "distillation_failed", "feedback_recorded"]).notNull(),
  status: mysqlEnum("status", ["completed", "failed", "skipped"]).notNull(),
  processedMessageId: bigint("processed_message_id", { mode: "number" }),
  detail: varchar("detail", { length: 500 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ucheer_ai_evolution_events_user_created_idx").on(table.userId, table.createdAt),
  index("ucheer_ai_evolution_events_status_idx").on(table.status, table.createdAt),
]);

// Verified public document excerpts survive service restarts. They are kept
// for audit, but may be reused as fresh evidence only for a short TTL.
// The query is stored as a hash so a user's private wording is never cached.
export const ucheerAiSearchSnapshots = mysqlTable("ucheer_ai_search_snapshots", {
  queryHash: varchar("query_hash", { length: 64 }).primaryKey(),
  results: text("results").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// ─── Standalone scheduler (independent replacement for managed Heartbeat) ───
export const standaloneSchedules = mysqlTable("standalone_schedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  cronExpression: varchar("cron_expression", { length: 96 }).notNull(),
  callbackPath: varchar("callback_path", { length: 255 }).notNull(),
  callbackMethod: varchar("callback_method", { length: 8 }).notNull().default("POST"),
  callbackPayload: text("callback_payload"),
  description: varchar("description", { length: 1000 }).notNull().default(""),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastExecutedAt: timestamp("last_executed_at"),
  lastStatus: varchar("last_status", { length: 32 }).notNull().default("never"),
  lastError: varchar("last_error", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("standalone_schedules_enabled_idx").on(table.isEnabled, table.updatedAt),
]);

export type StandaloneSchedule = typeof standaloneSchedules.$inferSelect;
export type InsertStandaloneSchedule = typeof standaloneSchedules.$inferInsert;

// ─── Market Data ──────────────────────────────────────────────────────────────
export const marketData = mysqlTable("market_data", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  market: mysqlEnum("market", [
    "stock", "bond", "forex", "commodity", "index",
    "derivative", "option", "fund",
  ]).notNull().default("stock"),
  price: varchar("price", { length: 32 }).notNull().default("0"),
  changeVal: varchar("change_val", { length: 32 }).notNull().default("0"),
  changePct: varchar("change_pct", { length: 32 }).notNull().default("0"),
  volume: varchar("volume", { length: 32 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = typeof marketData.$inferInsert;

// ─── Immutable market observation history ────────────────────────────────────
// 每次公开源返回的真实观测都以不可变版本保存；market_data 仅作为当前快照。
// module_id/data_contract_id 明确唯一归属，避免同一数据集被错误复用到其它功能。
export const marketDataObservationHistory = mysqlTable("market_data_observation_history", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  dataContractId: varchar("data_contract_id", { length: 128 }).notNull(),
  targetId: int("target_id"),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  observationDate: varchar("observation_date", { length: 32 }).notNull(),
  observationAt: timestamp("observation_at"),
  fetchedAt: timestamp("fetched_at").notNull(),
  source: varchar("source", { length: 160 }).notNull(),
  sourceReference: varchar("source_reference", { length: 1200 }),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  schemaVersion: varchar("schema_version", { length: 32 }).notNull().default("market-observation-v1"),
  isRevision: boolean("is_revision").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("market_observation_content_uq").on(table.moduleId, table.dataContractId, table.symbol, table.observationDate, table.contentHash),
  index("market_observation_symbol_date_idx").on(table.symbol, table.observationDate),
  index("market_observation_contract_idx").on(table.dataContractId, table.createdAt),
]);

export type MarketDataObservationHistory = typeof marketDataObservationHistory.$inferSelect;
export type InsertMarketDataObservationHistory = typeof marketDataObservationHistory.$inferInsert;

// Persistent polling/backoff state for the managed public contracts. The
// immutable observations stay in market_data_observation_history; this table
// only records collection health so restarts do not reset rate-limit backoff.
export const managedPublicDatasetStates = mysqlTable("managed_public_dataset_states", {
  datasetId: varchar("dataset_id", { length: 96 }).primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastSuccessAt: timestamp("last_success_at"),
  nextAttemptAt: timestamp("next_attempt_at"),
  consecutiveFailures: int("consecutive_failures").notNull().default(0),
  lastStatus: varchar("last_status", { length: 32 }).notNull().default("never"),
  lastError: varchar("last_error", { length: 1000 }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("managed_public_dataset_states_next_idx").on(table.nextAttemptAt, table.lastStatus),
]);

export type ManagedPublicDatasetState = typeof managedPublicDatasetStates.$inferSelect;

// ─── Global Equity Listing Universe ───────────────────────────────────────────
// 仅保存用户提供的股票清单原始代码与名称；行情字段仍由 market_data 单独维护。
export const equityListings = mysqlTable("equity_listings", {
  id: int("id").autoincrement().primaryKey(),
  country: varchar("country", { length: 64 }).notNull(),
  countryCode: varchar("country_code", { length: 4 }).notNull(),
  exchange: varchar("exchange", { length: 128 }).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  sourceFile: varchar("source_file", { length: 255 }).notNull(),
  sourceSheet: varchar("source_sheet", { length: 128 }).notNull(),
  sourceRow: int("source_row").notNull(),
  sourceContentSha256: varchar("source_content_sha256", { length: 64 }).notNull(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("equity_listings_country_symbol_uq").on(table.countryCode, table.symbol),
  index("equity_listings_country_idx").on(table.countryCode),
  index("equity_listings_symbol_idx").on(table.symbol),
]);

export type EquityListing = typeof equityListings.$inferSelect;
export type InsertEquityListing = typeof equityListings.$inferInsert;

// ─── Verifiable Equity Quote Snapshots ─────────────────────────────────────────
// 行情快照与用户上传的证券主数据分离；不可得时记录状态而不写入合成价格。
export const equityQuoteSnapshots = mysqlTable("equity_quote_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  countryCode: varchar("country_code", { length: 4 }).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  range: mysqlEnum("range", ["1mo", "3mo", "6mo", "1y", "2y", "5y"]).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["available", "unavailable"]).notNull(),
  price: decimal("price", { precision: 24, scale: 8 }),
  changeValue: decimal("change_value", { precision: 24, scale: 8 }),
  changePct: decimal("change_pct", { precision: 16, scale: 6 }),
  currency: varchar("currency", { length: 16 }),
  marketState: varchar("market_state", { length: 32 }),
  observationAt: timestamp("observation_at"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  unavailableReason: varchar("unavailable_reason", { length: 255 }),
}, (table) => [
  uniqueIndex("equity_quote_snapshots_uq").on(table.countryCode, table.symbol, table.range, table.source),
  index("equity_quote_snapshots_symbol_idx").on(table.symbol),
  index("equity_quote_snapshots_fetched_idx").on(table.fetchedAt),
]);

export type EquityQuoteSnapshot = typeof equityQuoteSnapshots.$inferSelect;

// ─── User Preferences ─────────────────────────────────────────────────────────
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  panelLayout: text("panel_layout"),
  varConfidence: varchar("var_confidence", { length: 16 }),
  volatilityModel: varchar("volatility_model", { length: 64 }),
  valuationModel: varchar("valuation_model", { length: 64 }),
  stressScenario: varchar("stress_scenario", { length: 64 }),
  exportFormat: varchar("export_format", { length: 16 }),
  lastUpdatedPanel: varchar("last_updated_panel", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ─── NCEO Simulation Ledger ───────────────────────────────────────────────────
// 仅保存登录用户主动创建的模型仓位与动作审计；不代表券商账户、交易所成交或监管报送。
export const nceoSimulationPositions = mysqlTable("nceo_simulation_positions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  contractLabel: varchar("contract_label", { length: 160 }).notNull(),
  direction: mysqlEnum("direction", ["long", "short"]).notNull(),
  referencePrice: decimal("reference_price", { precision: 24, scale: 8 }).notNull(),
  quantity: int("quantity").notNull(),
  modelBasis: varchar("model_basis", { length: 160 }).notNull(),
  sourceBoundary: text("source_boundary").notNull(),
  parameters: json("parameters").notNull(),
  status: mysqlEnum("status", ["open", "closed"]).notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("nceo_simulation_positions_user_created_idx").on(table.userId, table.createdAt),
  index("nceo_simulation_positions_user_status_idx").on(table.userId, table.status),
]);

export type NceoSimulationPosition = typeof nceoSimulationPositions.$inferSelect;
export type InsertNceoSimulationPosition = typeof nceoSimulationPositions.$inferInsert;

export const nceoSimulationAuditEvents = mysqlTable("nceo_simulation_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  positionId: int("position_id"),
  action: mysqlEnum("action", ["model_refreshed", "position_created", "position_closed", "csv_exported"]).notNull(),
  eventSummary: varchar("event_summary", { length: 255 }).notNull(),
  parameters: json("parameters").notNull(),
  sourceBoundary: text("source_boundary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("nceo_simulation_audit_user_created_idx").on(table.userId, table.createdAt),
  index("nceo_simulation_audit_position_idx").on(table.positionId),
]);

export type NceoSimulationAuditEvent = typeof nceoSimulationAuditEvents.$inferSelect;
export type InsertNceoSimulationAuditEvent = typeof nceoSimulationAuditEvents.$inferInsert;

// ─── Stock / NCEO Research Watchlist ─────────────────────────────────────────
// 仅保存登录用户主动维护的研究观察条目和布局偏好；不代表券商账户、真实持仓、成交或委托。
export const stockNceoWatchlistCollections = mysqlTable("stock_nceo_watchlist_collections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  description: varchar("description", { length: 160 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("stock_nceo_watchlist_collections_user_name_uq").on(table.userId, table.name),
  index("stock_nceo_watchlist_collections_user_updated_idx").on(table.userId, table.updatedAt),
]);

export type StockNceoWatchlistCollection = typeof stockNceoWatchlistCollections.$inferSelect;
export type InsertStockNceoWatchlistCollection = typeof stockNceoWatchlistCollections.$inferInsert;

export const stockNceoWatchlistItems = mysqlTable("stock_nceo_watchlist_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  collectionId: int("collection_id"),
  itemKey: varchar("item_key", { length: 96 }).notNull(),
  itemType: mysqlEnum("item_type", ["stock", "nceo_model"]).notNull(),
  symbol: varchar("symbol", { length: 16 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  optionSide: mysqlEnum("option_side", ["call", "put"]),
  expiryDays: int("expiry_days"),
  displayOrder: int("display_order").notNull().default(0),
  metadata: json("metadata").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("stock_nceo_watchlist_user_key_uq").on(table.userId, table.itemKey),
  index("stock_nceo_watchlist_user_order_idx").on(table.userId, table.displayOrder),
  index("stock_nceo_watchlist_collection_order_idx").on(table.userId, table.collectionId, table.displayOrder),
]);

export type StockNceoWatchlistItem = typeof stockNceoWatchlistItems.$inferSelect;
export type InsertStockNceoWatchlistItem = typeof stockNceoWatchlistItems.$inferInsert;

export const stockNceoWatchlistLayouts = mysqlTable("stock_nceo_watchlist_layouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  gridColumns: mysqlEnum("grid_columns", ["1", "2", "3", "4"]).notNull().default("2"),
  visibleColumns: json("visible_columns").notNull(),
  layoutName: varchar("layout_name", { length: 64 }).notNull().default("股票与 NCEO 研究屏风"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type StockNceoWatchlistLayout = typeof stockNceoWatchlistLayouts.$inferSelect;
export type InsertStockNceoWatchlistLayout = typeof stockNceoWatchlistLayouts.$inferInsert;

export const stockNceoWatchlistCollectionLayouts = mysqlTable("stock_nceo_watchlist_collection_layouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  collectionId: int("collection_id").notNull(),
  layoutName: varchar("layout_name", { length: 64 }).notNull().default("股票与 NCEO 研究屏风"),
  gridColumns: mysqlEnum("grid_columns", ["1", "2", "3", "4"]).notNull().default("2"),
  visibleColumns: json("visible_columns").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("stock_nceo_watchlist_collection_layout_user_collection_uq").on(table.userId, table.collectionId),
]);

export type StockNceoWatchlistCollectionLayout = typeof stockNceoWatchlistCollectionLayouts.$inferSelect;
export type InsertStockNceoWatchlistCollectionLayout = typeof stockNceoWatchlistCollectionLayouts.$inferInsert;

// ─── Admin-curated news ingestion ───────────────────────────────────────────
// 仅供管理员维护允许的 RSS/API 来源、摘要草稿和发布审核；不抓取或保存来源网站全文。
export const adminNewsIngestionSources = mysqlTable("admin_news_ingestion_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  feedUrl: varchar("feed_url", { length: 1200 }).notNull(),
  sourceUrl: varchar("source_url", { length: 1200 }).notNull(),
  sourceType: mysqlEnum("source_type", ["rss", "api"]).notNull().default("rss"),
  isActive: boolean("is_active").notNull().default(true),
  maxItemsPerRun: int("max_items_per_run").notNull().default(50),
  processingMode: mysqlEnum("processing_mode", ["queued", "immediate"]).notNull().default("queued"),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastStatus: mysqlEnum("last_status", ["never", "available", "unavailable"]).notNull().default("never"),
  lastError: varchar("last_error", { length: 600 }),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_news_ingestion_source_feed_uq").on(table.feedUrl),
  index("admin_news_ingestion_source_active_idx").on(table.isActive, table.updatedAt),
  index("admin_news_ingestion_source_task_idx").on(table.scheduleCronTaskUid),
]);

export type AdminNewsIngestionSource = typeof adminNewsIngestionSources.$inferSelect;
export type InsertAdminNewsIngestionSource = typeof adminNewsIngestionSources.$inferInsert;

export const adminNewsIngestionArticles = mysqlTable("admin_news_ingestion_articles", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("source_id").notNull(),
  sourceItemKey: varchar("source_item_key", { length: 512 }).notNull(),
  sourceHeadline: varchar("source_headline", { length: 700 }).notNull(),
  sourceExcerpt: text("source_excerpt"),
  sourceUrl: varchar("source_url", { length: 1200 }).notNull(),
  sourcePublishedAt: timestamp("source_published_at"),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
  status: mysqlEnum("status", ["queued", "draft", "approved", "published", "rejected", "failed"]).notNull().default("queued"),
  aiTitle: varchar("ai_title", { length: 255 }),
  aiSummary: text("ai_summary"),
  category: varchar("category", { length: 64 }),
  sentiment: mysqlEnum("sentiment", ["positive", "neutral", "negative", "uncertain"]),
  tickers: json("tickers").$type<string[] | null>(),
  aiModel: varchar("ai_model", { length: 80 }),
  aiGeneratedAt: timestamp("ai_generated_at"),
  aiGenerationCatalogCode: varchar("ai_generation_catalog_code", { length: 16 }),
  processingError: varchar("processing_error", { length: 1000 }),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  publishedByUserId: int("published_by_user_id"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_news_ingestion_article_source_key_uq").on(table.sourceId, table.sourceItemKey),
  index("admin_news_ingestion_article_status_updated_idx").on(table.status, table.updatedAt),
  index("admin_news_ingestion_article_source_published_idx").on(table.sourceId, table.sourcePublishedAt),
  index("admin_news_ingestion_article_catalog_status_idx").on(table.aiGenerationCatalogCode, table.status),
]);

export type AdminNewsIngestionArticle = typeof adminNewsIngestionArticles.$inferSelect;
export type InsertAdminNewsIngestionArticle = typeof adminNewsIngestionArticles.$inferInsert;

export const adminNewsIngestionAuditEvents = mysqlTable("admin_news_ingestion_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("source_id"),
  articleId: int("article_id"),
  actorUserId: int("actor_user_id"),
  action: mysqlEnum("action", ["source_created", "source_updated", "sync_started", "sync_completed", "article_queued", "draft_generated", "draft_failed", "approved", "published", "rejected", "exported"]).notNull(),
  detail: varchar("detail", { length: 1200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_news_ingestion_audit_source_created_idx").on(table.sourceId, table.createdAt),
  index("admin_news_ingestion_audit_article_created_idx").on(table.articleId, table.createdAt),
]);

export type AdminNewsIngestionAuditEvent = typeof adminNewsIngestionAuditEvents.$inferSelect;

// ─── Admin AI generation task ledger ─────────────────────────────────────────
// 任务只处理已保存的来源元数据或草稿；所有生成结果保留在审核链路中，不自动发布。
export const adminAiGenerationTasks = mysqlTable("admin_ai_generation_tasks", {
  id: int("id").autoincrement().primaryKey(),
  generationType: mysqlEnum("generation_type", ["news", "report", "course"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).notNull().default("pending"),
  requestedCount: int("requested_count").notNull().default(1),
  processedCount: int("processed_count").notNull().default(0),
  generatedCount: int("generated_count").notNull().default(0),
  sourceId: int("source_id"),
  articleId: int("article_id"),
  catalogCode: varchar("catalog_code", { length: 16 }),
  model: varchar("model", { length: 80 }),
  detail: varchar("detail", { length: 1200 }),
  error: varchar("error", { length: 1000 }),
  createdByUserId: int("created_by_user_id").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_ai_generation_task_status_created_idx").on(table.status, table.createdAt),
  index("admin_ai_generation_task_type_created_idx").on(table.generationType, table.createdAt),
  index("admin_ai_generation_task_article_idx").on(table.articleId),
  index("admin_ai_generation_task_catalog_created_idx").on(table.catalogCode, table.createdAt),
]);

export type AdminAiGenerationTask = typeof adminAiGenerationTasks.$inferSelect;
export type InsertAdminAiGenerationTask = typeof adminAiGenerationTasks.$inferInsert;

// ─── Admin AI generation catalog configuration ───────────────────────────────
// 仅管理 AI 后台目录项的可见与启用状态。不会删除、重写或移动原新闻/研究模块、来源文章或审核记录。
export const adminAiGenerationCatalogSettings = mysqlTable("admin_ai_generation_catalog_settings", {
  catalogCode: varchar("catalog_code", { length: 16 }).primaryKey(),
  status: mysqlEnum("status", ["enabled", "disabled", "deleted"]).notNull().default("enabled"),
  updatedByUserId: int("updated_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_ai_generation_catalog_status_updated_idx").on(table.status, table.updatedAt),
]);

export const adminAiGenerationCatalogEvents = mysqlTable("admin_ai_generation_catalog_events", {
  id: int("id").autoincrement().primaryKey(),
  catalogCode: varchar("catalog_code", { length: 16 }).notNull(),
  action: mysqlEnum("action", ["enabled", "disabled", "deleted"]).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  detail: varchar("detail", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_ai_generation_catalog_event_code_created_idx").on(table.catalogCode, table.createdAt),
  index("admin_ai_generation_catalog_event_actor_created_idx").on(table.actorUserId, table.createdAt),
]);

export type AdminAiGenerationCatalogSetting = typeof adminAiGenerationCatalogSettings.$inferSelect;
export type AdminAiGenerationCatalogEvent = typeof adminAiGenerationCatalogEvents.$inferSelect;

// ─── Admin front-end data module registry ─────────────────────────────────────
// 仅记录后台管理状态、管理员备注和审计。不会更改被映射的任何前端模块、数据行或接口契约。
export const adminDataModuleSettings = mysqlTable("admin_data_module_settings", {
  moduleId: varchar("module_id", { length: 96 }).primaryKey(),
  status: mysqlEnum("status", ["managed", "attention", "restricted", "archived"]).notNull().default("managed"),
  adminNote: varchar("admin_note", { length: 600 }),
  updatedByUserId: int("updated_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_data_module_status_updated_idx").on(table.status, table.updatedAt),
]);

export const adminDataModuleEvents = mysqlTable("admin_data_module_events", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  action: mysqlEnum("action", ["managed", "attention", "restricted", "archived"]).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  detail: varchar("detail", { length: 900 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_data_module_event_module_created_idx").on(table.moduleId, table.createdAt),
  index("admin_data_module_event_actor_created_idx").on(table.actorUserId, table.createdAt),
]);

export type AdminDataModuleSetting = typeof adminDataModuleSettings.$inferSelect;
export type AdminDataModuleEvent = typeof adminDataModuleEvents.$inferSelect;

// ─── Admin data-module runtime controls ─────────────────────────────────────
// 仅供后台决定对既有服务端来源执行真实刷新、明确模拟运行或暂停后台数据操作。
// 该表不会向前端传递管理信息，也不会改写前端源码、文案、路由或接口。
export const adminDataModuleRuntimeControls = mysqlTable("admin_data_module_runtime_controls", {
  moduleId: varchar("module_id", { length: 96 }).primaryKey(),
  dataMode: mysqlEnum("data_mode", ["inherit", "real", "simulated", "paused"]).notNull().default("inherit"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  adminDetail: varchar("admin_detail", { length: 600 }),
  updatedByUserId: int("updated_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_data_module_runtime_mode_updated_idx").on(table.dataMode, table.updatedAt),
  index("admin_data_module_runtime_enabled_updated_idx").on(table.isEnabled, table.updatedAt),
]);

export type AdminDataModuleRuntimeControl = typeof adminDataModuleRuntimeControls.$inferSelect;

// ─── Admin data-module source-refresh audit ─────────────────────────────────
// 仅记录后台明确触发的既有来源刷新。不会创建模拟行情、修改前端源码或改变原模块接口。
export const adminDataModuleRefreshEvents = mysqlTable("admin_data_module_refresh_events", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  sourceGroup: mysqlEnum("source_group", ["market_ingestion", "news_ingestion", "request_time", "restricted"]).notNull(),
  status: mysqlEnum("status", ["started", "available", "partial", "unavailable", "not_configured", "restricted"]).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  detail: varchar("detail", { length: 1200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_data_module_refresh_module_created_idx").on(table.moduleId, table.createdAt),
  index("admin_data_module_refresh_status_created_idx").on(table.status, table.createdAt),
]);

export type AdminDataModuleRefreshEvent = typeof adminDataModuleRefreshEvents.$inferSelect;

// ─── Admin module automation and delivery ledger ────────────────────────────
// 仅保存管理后台的模块配置、运行与推送版本。所有数据落点必须由服务端按
// 已登记的既有前端读取契约校验，不能向业务前端返回该管理元数据。
export const adminDataModuleProfiles = mysqlTable("admin_data_module_profiles", {
  moduleId: varchar("module_id", { length: 96 }).primaryKey(),
  moduleGroup: varchar("module_group", { length: 80 }).notNull(),
  moduleCategory: varchar("module_category", { length: 80 }).notNull(),
  ownerUserId: int("owner_user_id"),
  displayArea: varchar("display_area", { length: 300 }).notNull(),
  frontendInterface: varchar("frontend_interface", { length: 300 }).notNull(),
  targetContract: varchar("target_contract", { length: 160 }).notNull(),
  targetCollection: varchar("target_collection", { length: 160 }),
  fieldMapping: json("field_mapping").notNull(),
  sourceKind: mysqlEnum("source_kind", ["real", "simulated", "mixed", "none"]).notNull().default("none"),
  sourceReference: varchar("source_reference", { length: 500 }),
  theme: varchar("theme", { length: 200 }),
  keywords: json("keywords").notNull(),
  tags: json("tags").notNull(),
  contentLimit: int("content_limit").notNull().default(10),
  updateFrequencyMinutes: int("update_frequency_minutes").notNull().default(1440),
  sortWeight: int("sort_weight").notNull().default(100),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  taskTemplate: varchar("task_template", { length: 120 }).notNull().default("ingest-review-deliver"),
  executionPriority: int("execution_priority").notNull().default(100),
  reviewPolicy: mysqlEnum("review_policy", ["manual", "auto_approved", "disabled"]).notNull().default("manual"),
  pushPolicy: mysqlEnum("push_policy", ["manual", "after_approval", "disabled"]).notNull().default("after_approval"),
  publishSchedule: varchar("publish_schedule", { length: 120 }).notNull().default("manual_after_review"),
  recommendationRule: json("recommendation_rule"),
  dedupeScope: mysqlEnum("dedupe_scope", ["module", "global", "pushed"]).notNull().default("global"),
  retryLimit: int("retry_limit").notNull().default(3),
  runtimeStatus: mysqlEnum("runtime_status", ["enabled", "paused", "pending_generation", "pending_review", "pending_delivery", "delivering", "delivered", "failed"]).notNull().default("enabled"),
  lastExecutedAt: timestamp("last_executed_at"),
  lastPushedAt: timestamp("last_pushed_at"),
  currentVersion: int("current_version").notNull().default(0),
  rollbackVersion: int("rollback_version"),
  updatedByUserId: int("updated_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_module_profile_group_idx").on(table.moduleGroup, table.moduleCategory),
  index("admin_module_profile_runtime_idx").on(table.runtimeStatus, table.automationEnabled),
  index("admin_module_profile_owner_idx").on(table.ownerUserId, table.updatedAt),
]);

export const adminDataModuleAutomationRuns = mysqlTable("admin_data_module_automation_runs", {
  id: int("id").autoincrement().primaryKey(),
  runKey: varchar("run_key", { length: 80 }).notNull().unique(),
  scope: mysqlEnum("scope", ["single", "group", "site", "batch"]).notNull(),
  moduleId: varchar("module_id", { length: 96 }),
  moduleIdsJson: text("module_ids_json"),
  moduleGroup: varchar("module_group", { length: 80 }),
  trigger: mysqlEnum("trigger", ["manual", "scheduled", "retry"]).notNull().default("manual"),
  mode: mysqlEnum("mode", ["fast_draft", "rich_content"]).notNull().default("fast_draft"),
  status: mysqlEnum("status", ["queued", "running", "completed", "partial", "failed", "cancelled"]).notNull().default("queued"),
  currentStep: varchar("current_step", { length: 160 }).notNull().default("queued"),
  requestedCount: int("requested_count").notNull().default(0),
  queuedCount: int("queued_count").notNull().default(0),
  runningCount: int("running_count").notNull().default(0),
  succeededCount: int("succeeded_count").notNull().default(0),
  failedCount: int("failed_count").notNull().default(0),
  skippedCount: int("skipped_count").notNull().default(0),
  retryCount: int("retry_count").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalDurationMs: int("total_duration_ms"),
  errorDetail: varchar("error_detail", { length: 1800 }),
  actorUserId: int("actor_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_module_run_status_created_idx").on(table.status, table.createdAt),
  index("admin_module_run_module_created_idx").on(table.moduleId, table.createdAt),
  index("admin_module_run_group_created_idx").on(table.moduleGroup, table.createdAt),
]);

export const adminDataModuleAutomationSchedules = mysqlTable("admin_data_module_automation_schedules", {
  scheduleKey: varchar("schedule_key", { length: 80 }).primaryKey(),
  cronExpression: varchar("cron_expression", { length: 64 }).notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  isEnabled: boolean("is_enabled").notNull().default(false),
  ownerUserId: int("owner_user_id").notNull(),
  lastScheduledAt: timestamp("last_scheduled_at"),
  lastRunAt: timestamp("last_run_at"),
  lastError: varchar("last_error", { length: 1800 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("adm_mod_schedule_task_uid_uq").on(table.scheduleCronTaskUid),
  index("admin_module_schedule_enabled_idx").on(table.isEnabled, table.updatedAt),
]);

export const adminDataModuleDeliveryVersions = mysqlTable("admin_data_module_delivery_versions", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  runId: int("run_id"),
  version: int("version").notNull(),
  status: mysqlEnum("status", ["pending_review", "approved", "delivering", "delivered", "failed", "reverted"]).notNull().default("pending_review"),
  targetContract: varchar("target_contract", { length: 160 }).notNull(),
  targetCollection: varchar("target_collection", { length: 160 }),
  fieldMapping: json("field_mapping").notNull(),
  payloadSnapshot: json("payload_snapshot").notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  sourceKind: mysqlEnum("source_kind", ["real", "simulated", "mixed"]).notNull(),
  itemCount: int("item_count").notNull().default(0),
  previousVersionId: int("previous_version_id"),
  approvedByUserId: int("approved_by_user_id"),
  pushedByUserId: int("pushed_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  pushedAt: timestamp("pushed_at"),
  revertedAt: timestamp("reverted_at"),
}, (table) => [
  uniqueIndex("admin_module_delivery_version_uq").on(table.moduleId, table.version),
  index("admin_module_delivery_status_created_idx").on(table.status, table.createdAt),
  index("admin_module_delivery_module_created_idx").on(table.moduleId, table.createdAt),
]);

export const adminDataModuleDeliveryEvents = mysqlTable("admin_data_module_delivery_events", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  runId: int("run_id"),
  deliveryVersionId: int("delivery_version_id"),
  action: mysqlEnum("action", ["generated", "reviewed", "push_started", "pushed", "push_failed", "retried", "reverted", "cancelled"]).notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed", "skipped"]).notNull(),
  targetContract: varchar("target_contract", { length: 160 }).notNull(),
  targetDetail: varchar("target_detail", { length: 900 }).notNull(),
  itemCount: int("item_count").notNull().default(0),
  dataVersion: int("data_version"),
  durationMs: int("duration_ms"),
  detail: varchar("detail", { length: 1800 }).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_module_delivery_event_module_created_idx").on(table.moduleId, table.createdAt),
  index("admin_module_delivery_event_run_created_idx").on(table.runId, table.createdAt),
  index("admin_module_delivery_event_status_created_idx").on(table.status, table.createdAt),
]);

export type AdminDataModuleProfile = typeof adminDataModuleProfiles.$inferSelect;
export type AdminDataModuleAutomationRun = typeof adminDataModuleAutomationRuns.$inferSelect;
export type AdminDataModuleAutomationSchedule = typeof adminDataModuleAutomationSchedules.$inferSelect;
export type AdminDataModuleDeliveryVersion = typeof adminDataModuleDeliveryVersions.$inferSelect;
export type AdminDataModuleDeliveryEvent = typeof adminDataModuleDeliveryEvents.$inferSelect;

// ─── Admin public daily investment-target ingestion ─────────────────────────
// 仅管理公开日频 OHLCV 读取任务与其最新实际观测；不代替授权实时行情、盘口或期权报价。
export const adminMarketIngestionTargets = mysqlTable("admin_market_ingestion_targets", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  marketType: mysqlEnum("market_type", ["stock", "etf", "index", "forex", "commodity", "bond", "fund"]).notNull().default("stock"),
  historyRange: mysqlEnum("history_range", ["5d", "1mo", "3mo"]).notNull().default("3mo"),
  isActive: boolean("is_active").notNull().default(true),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastStatus: mysqlEnum("last_status", ["never", "available", "unavailable"]).notNull().default("never"),
  lastError: varchar("last_error", { length: 600 }),
  source: varchar("source", { length: 160 }),
  currency: varchar("currency", { length: 16 }),
  lastObservationDate: varchar("last_observation_date", { length: 32 }),
  lastClose: decimal("last_close", { precision: 20, scale: 6 }),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_market_ingestion_target_symbol_uq").on(table.symbol),
  index("admin_market_ingestion_target_active_idx").on(table.isActive, table.updatedAt),
  index("admin_market_ingestion_target_task_idx").on(table.scheduleCronTaskUid),
]);

export type AdminMarketIngestionTarget = typeof adminMarketIngestionTargets.$inferSelect;
export type InsertAdminMarketIngestionTarget = typeof adminMarketIngestionTargets.$inferInsert;

// ─── Admin market-data API provider configuration ───────────────────────────
// 密钥绝不保存到数据库。管理员只登记提供方连接元数据和受管环境变量名称；实际凭据由项目安全配置注入。
export const adminMarketDataProviderConfigs = mysqlTable("admin_market_data_provider_configs", {
  id: int("id").autoincrement().primaryKey(),
  providerCode: varchar("provider_code", { length: 48 }).notNull(),
  providerName: varchar("provider_name", { length: 120 }).notNull(),
  apiBaseUrl: varchar("api_base_url", { length: 1200 }).notNull(),
  apiKeyEnvName: varchar("api_key_env_name", { length: 80 }).notNull(),
  marketCoverage: json("market_coverage").$type<string[]>().notNull(),
  delayLevel: mysqlEnum("delay_level", ["unknown", "realtime", "delayed", "end_of_day"]).notNull().default("unknown"),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  connectionStatus: mysqlEnum("connection_status", ["not_configured", "key_missing", "adapter_pending", "available", "unavailable"]).notNull().default("not_configured"),
  lastValidatedAt: timestamp("last_validated_at"),
  lastError: varchar("last_error", { length: 600 }),
  isActive: boolean("is_active").notNull().default(false),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_market_provider_code_uq").on(table.providerCode),
  index("admin_market_provider_status_idx").on(table.connectionStatus, table.updatedAt),
]);

export type AdminMarketDataProviderConfig = typeof adminMarketDataProviderConfigs.$inferSelect;
export type InsertAdminMarketDataProviderConfig = typeof adminMarketDataProviderConfigs.$inferInsert;

export const adminMarketIngestionEvents = mysqlTable("admin_market_ingestion_events", {
  id: int("id").autoincrement().primaryKey(),
  targetId: int("target_id"),
  actorUserId: int("actor_user_id"),
  action: mysqlEnum("action", ["target_created", "target_updated", "sync_started", "sync_completed", "sync_unavailable", "schedule_enabled", "schedule_paused"]).notNull(),
  detail: varchar("detail", { length: 1200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_market_ingestion_event_target_created_idx").on(table.targetId, table.createdAt),
]);

export type AdminMarketIngestionEvent = typeof adminMarketIngestionEvents.$inferSelect;

// ─── Pricing Risk Exports ─────────────────────────────────────────────────────
export const pricingRiskExports = mysqlTable("pricing_risk_exports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("user_id").notNull(),
  panelId: varchar("panel_id", { length: 64 }).notNull(),
  panelName: varchar("panel_name", { length: 255 }),
  exportType: varchar("export_type", { length: 32 }).notNull(),
  fileUrl: text("file_url"),
  fileSize: int("file_size"),
  dataSnapshot: text("data_snapshot"),
  exportedAt: bigint("exported_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PricingRiskExport = typeof pricingRiskExports.$inferSelect;
export type InsertPricingRiskExport = typeof pricingRiskExports.$inferInsert;

// ─── Curve Interactions ───────────────────────────────────────────────────────
export const curveInteractions = mysqlTable("curve_interactions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("user_id").notNull(),
  sourcePanelId: varchar("source_panel_id", { length: 64 }).notNull(),
  targetPanelId: varchar("target_panel_id", { length: 64 }).notNull(),
  curveId: int("curve_id"),
  period: varchar("period", { length: 16 }),
  value: varchar("value", { length: 32 }),
  parametersPassed: text("parameters_passed"),
  interactedAt: bigint("interacted_at", { mode: "number" }).notNull(),
});

export type CurveInteraction = typeof curveInteractions.$inferSelect;
export type InsertCurveInteraction = typeof curveInteractions.$inferInsert;

// ─── Complete spider platform ────────────────────────────────────────────────
// 管理后台专用。业务前台仍读取原有业务表；只有人工勾选模块后才建立推送映射。
export const spiderTasks = mysqlTable("spider_task", {
  id: int("id").autoincrement().primaryKey(),
  taskUuid: varchar("task_uuid", { length: 64 }).notNull().unique(),
  taskName: varchar("task_name", { length: 255 }).notNull(),
  taskType: varchar("task_type", { length: 80 }).notNull(),
  seedUuid: varchar("seed_uuid", { length: 64 }),
  carrierType: varchar("carrier_type", { length: 40 }).notNull().default("rss_atom"),
  priorityLevel: varchar("priority_level", { length: 24 }).notNull().default("normal"),
  region: varchar("region", { length: 80 }),
  proxyStrategy: json("proxy_strategy").$type<Record<string, unknown>>(),
  fingerprintProfile: json("fingerprint_profile").$type<Record<string, unknown>>(),
  rateLimitPolicy: json("rate_limit_policy").$type<Record<string, unknown>>(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  retryPolicy: json("retry_policy").$type<Record<string, unknown>>(),
  backfillEnabled: boolean("backfill_enabled").notNull().default(false),
  checkpointJson: json("checkpoint_json").$type<Record<string, unknown>>(),
  scheduleLevel: varchar("schedule_level", { length: 24 }).notNull().default("hourly"),
  status: varchar("status", { length: 24 }).notNull().default("paused"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("spider_task_status_priority_idx").on(table.status, table.priorityLevel, table.updatedAt)]);

export const spiderSeedPool = mysqlTable("spider_seed_pool", {
  id: int("id").autoincrement().primaryKey(), seedUuid: varchar("seed_uuid", { length: 64 }).notNull().unique(),
  seedUrl: text("seed_url").notNull(), domain: varchar("domain", { length: 255 }).notNull(), sourceName: varchar("source_name", { length: 255 }).notNull(),
  sourceCategory: varchar("source_category", { length: 80 }).notNull(), language: varchar("language", { length: 24 }), region: varchar("region", { length: 80 }),
  robotsPolicy: varchar("robots_policy", { length: 40 }).notNull().default("unknown"), crawlDepth: int("crawl_depth").notNull().default(1), priority: int("priority").notNull().default(100),
  discoveredByAi: boolean("discovered_by_ai").notNull().default(false), discoverySourceUuid: varchar("discovery_source_uuid", { length: 64 }),
  healthStatus: varchar("health_status", { length: 24 }).notNull().default("unchecked"), lastCheckedAt: timestamp("last_checked_at"), lastHttpStatus: int("last_http_status"),
  isActive: boolean("is_active").notNull().default(true), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("spider_seed_domain_status_idx").on(table.domain, table.healthStatus, table.updatedAt)]);

export const spiderRawData = mysqlTable("spider_raw_data", {
  id: int("id").autoincrement().primaryKey(), rawUuid: varchar("raw_uuid", { length: 64 }).notNull().unique(), taskUuid: varchar("task_uuid", { length: 64 }), seedUuid: varchar("seed_uuid", { length: 64 }),
  sourceUrl: text("source_url").notNull(), carrierType: varchar("carrier_type", { length: 40 }).notNull(), contentType: varchar("content_type", { length: 120 }),
  rawBinary: text("raw_binary"), rawContent: text("raw_content"), responseHeaders: json("response_headers").$type<Record<string, string>>(),
  sourceLanguage: varchar("source_language", { length: 24 }), contentHash: varchar("content_hash", { length: 64 }).notNull(), httpStatus: int("http_status"),
  crawlTime: timestamp("crawl_time").defaultNow().notNull(), parseStatus: varchar("parse_status", { length: 24 }).notNull().default("pending"), archiveSnapshot: text("archive_snapshot"),
}, (table) => [uniqueIndex("spider_raw_content_hash_uq").on(table.contentHash), index("spider_raw_task_time_idx").on(table.taskUuid, table.crawlTime)]);

export const spiderAiProcessed = mysqlTable("spider_ai_processed", {
  id: int("id").autoincrement().primaryKey(), processUuid: varchar("process_uuid", { length: 64 }).notNull().unique(), rawUuid: varchar("raw_uuid", { length: 64 }).notNull(),
  parserType: varchar("parser_type", { length: 40 }).notNull(), aiModel: varchar("ai_model", { length: 120 }), extractedEntities: json("extracted_entities").$type<Record<string, unknown>[]>(),
  normalizedContent: text("normalized_content"), rewrittenContent: text("rewritten_content"), formulaStruct: json("formula_struct").$type<Record<string, unknown>>(),
  qualityLevel: varchar("quality_level", { length: 16 }).notNull().default("L4"), qualityChecks: json("quality_checks").$type<Record<string, unknown>>(),
  processStatus: varchar("process_status", { length: 24 }).notNull().default("pending"), errorDetail: text("error_detail"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("spider_ai_raw_status_idx").on(table.rawUuid, table.processStatus, table.updatedAt)]);

export const financeWorldDataset = mysqlTable("finance_world_dataset", {
  id: int("id").autoincrement().primaryKey(), uuid: varchar("uuid", { length: 64 }).notNull().unique(), dataTopType: varchar("data_top_type", { length: 80 }).notNull(), dataSubType: varchar("data_sub_type", { length: 120 }).notNull(),
  sourceUrl: text("source_url").notNull(), sourceName: varchar("source_name", { length: 255 }).notNull(), sourceLanguage: varchar("source_language", { length: 24 }), rawBinary: text("raw_binary"), rawContent: text("raw_content"), aiProcessContent: text("ai_process_content"),
  region: varchar("region", { length: 80 }), country: varchar("country", { length: 120 }), exchange: varchar("exchange", { length: 120 }), isinCode: varchar("isin_code", { length: 32 }), sedolCode: varchar("sedol_code", { length: 32 }), assetCode: varchar("asset_code", { length: 80 }), assetType: varchar("asset_type", { length: 80 }), listStatus: varchar("list_status", { length: 40 }), listDate: date("list_date"), delistDate: date("delist_date"),
  timeSeriesJson: json("time_series_json").$type<unknown[]>(), financeArrayJson: json("finance_array_json").$type<Record<string, unknown>>(), moneyFlowJson: json("money_flow_json").$type<Record<string, unknown>>(), entityRelationIds: json("entity_relation_ids").$type<string[]>(), tagList: json("tag_list").$type<string[]>(), candidatePushModuleIds: json("candidate_push_module_ids").$type<string[]>(),
  isPush: boolean("is_push").notNull().default(false), pushRecordId: varchar("push_record_id", { length: 64 }), dataQualityLevel: varchar("data_quality_level", { length: 16 }).notNull().default("L4"), dataBloodId: varchar("data_blood_id", { length: 64 }), crawlTime: timestamp("crawl_time").defaultNow().notNull(), updateTime: timestamp("update_time").defaultNow().onUpdateNow().notNull(), archiveSnapshot: text("archive_snapshot"),
}, (table) => [index("finance_world_type_region_idx").on(table.dataTopType, table.assetType, table.region), index("finance_world_asset_idx").on(table.assetCode, table.exchange)]);

/** An explicit administrator grant; Ucheer approval (financeWorldDataset.isPush) is separate. */
export const agentReachModuleGrants = mysqlTable("agent_reach_module_grants", {
  id: int("id").autoincrement().primaryKey(),
  recordUuid: varchar("record_uuid", { length: 64 }).notNull(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  followRss: boolean("follow_rss").notNull().default(false),
  rssUrl: varchar("rss_url", { length: 1200 }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  approvedByUserId: int("approved_by_user_id").notNull(),
  approvedAt: timestamp("approved_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("agent_reach_grant_record_module_uq").on(table.recordUuid, table.moduleId),
  index("agent_reach_grant_rss_idx").on(table.isEnabled, table.followRss),
]);

export const financeToolUnionSet = mysqlTable("finance_tool_union_set", {
  id: int("id").autoincrement().primaryKey(), toolUuid: varchar("tool_uuid", { length: 64 }).notNull().unique(), toolName: varchar("tool_name", { length: 255 }).notNull(), toolTopCategory: varchar("tool_top_category", { length: 100 }).notNull(), toolSubCategory: varchar("tool_sub_category", { length: 120 }).notNull(), toolVersion: varchar("tool_version", { length: 80 }).notNull(),
  formulaRaw: text("formula_raw"), formulaParsedStruct: json("formula_parsed_struct").$type<Record<string, unknown>>(), inputParams: json("input_params").$type<Array<{ name: string; type: string; range?: string; default?: unknown; desc?: string }>>(), outputParams: json("output_params").$type<Array<{ name: string; type: string; desc?: string }>>(), dependToolUuids: json("depend_tool_uuids").$type<string[]>(), applyMarket: json("apply_market").$type<string[]>(), applyAssetType: json("apply_asset_type").$type<string[]>(),
  riskLevel: varchar("risk_level", { length: 24 }), sceneDesc: text("scene_desc"), limitationDesc: text("limitation_desc"), sampleCase: json("sample_case").$type<unknown[]>(), backtestSample: json("backtest_sample").$type<unknown[]>(), sourceUrl: text("source_url").notNull(), sourceDocRaw: text("source_doc_raw"), aiStandardDoc: text("ai_standard_doc"), tagList: json("tag_list").$type<string[]>(), candidatePushModuleIds: json("candidate_push_module_ids").$type<string[]>(), dataQualityLevel: varchar("data_quality_level", { length: 16 }).notNull().default("L4"), dataBloodId: varchar("data_blood_id", { length: 64 }), crawlTime: timestamp("crawl_time").defaultNow().notNull(), updateTime: timestamp("update_time").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("finance_tool_category_risk_idx").on(table.toolTopCategory, table.toolSubCategory, table.riskLevel)]);

export const spiderPushRelation = mysqlTable("spider_push_relation", {
  id: int("id").autoincrement().primaryKey(), uuid: varchar("uuid", { length: 64 }).notNull().unique(), dataUuid: varchar("data_uuid", { length: 64 }).notNull(), dataCollection: varchar("data_collection", { length: 64 }).notNull(),
  targetFrontModuleIds: json("target_front_module_ids").$type<string[]>().notNull(), operator: varchar("operator", { length: 160 }).notNull(), operatorUserId: int("operator_user_id").notNull(), operateTime: timestamp("operate_time").defaultNow().notNull(), pushStatus: varchar("push_status", { length: 24 }).notNull().default("pending"), pushDetail: text("push_detail"),
}, (table) => [index("spider_push_data_time_idx").on(table.dataUuid, table.operateTime)]);

export const spiderMissingScanLog = mysqlTable("spider_missing_scan_log", {
  id: int("id").autoincrement().primaryKey(), scanUuid: varchar("scan_uuid", { length: 64 }).notNull().unique(), scanType: varchar("scan_type", { length: 40 }).notNull(), sourceScope: text("source_scope"), targetScope: text("target_scope"),
  missingType: varchar("missing_type", { length: 80 }).notNull(), missingKeys: json("missing_keys").$type<string[]>(), missingCount: int("missing_count").notNull().default(0), thresholdJson: json("threshold_json").$type<Record<string, unknown>>(), generatedTaskUuids: json("generated_task_uuids").$type<string[]>(),
  scanStatus: varchar("scan_status", { length: 24 }).notNull().default("completed"), detail: text("detail"), startedAt: timestamp("started_at").defaultNow().notNull(), completedAt: timestamp("completed_at"),
}, (table) => [index("spider_missing_type_time_idx").on(table.missingType, table.startedAt)]);

export const spiderFailLog = mysqlTable("spider_fail_log", {
  id: int("id").autoincrement().primaryKey(), failUuid: varchar("fail_uuid", { length: 64 }).notNull().unique(), taskUuid: varchar("task_uuid", { length: 64 }), rawUuid: varchar("raw_uuid", { length: 64 }), stage: varchar("stage", { length: 40 }).notNull(), failType: varchar("fail_type", { length: 80 }).notNull(), sourceUrl: text("source_url"), errorDetail: text("error_detail"), retryCount: int("retry_count").notNull().default(0), retryStrategy: varchar("retry_strategy", { length: 80 }), status: varchar("status", { length: 24 }).notNull().default("open"), lastRetryAt: timestamp("last_retry_at"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("spider_fail_stage_status_idx").on(table.stage, table.status, table.updatedAt)]);

export const spiderEntityLink = mysqlTable("spider_entity_link", {
  id: int("id").autoincrement().primaryKey(), linkUuid: varchar("link_uuid", { length: 64 }).notNull().unique(), sourceEntityUuid: varchar("source_entity_uuid", { length: 64 }).notNull(), sourceEntityType: varchar("source_entity_type", { length: 60 }).notNull(), targetEntityUuid: varchar("target_entity_uuid", { length: 64 }).notNull(), targetEntityType: varchar("target_entity_type", { length: 60 }).notNull(), relationType: varchar("relation_type", { length: 80 }).notNull(), confidence: decimal("confidence", { precision: 6, scale: 4 }).notNull().default("0"), evidenceRawUuids: json("evidence_raw_uuids").$type<string[]>(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("spider_entity_source_target_idx").on(table.sourceEntityUuid, table.targetEntityUuid)]);

export const spiderDataBlood = mysqlTable("spider_data_blood", {
  id: int("id").autoincrement().primaryKey(), dataBloodId: varchar("data_blood_id", { length: 64 }).notNull().unique(), structuredDataUuid: varchar("structured_data_uuid", { length: 64 }).notNull(), collectionName: varchar("collection_name", { length: 80 }).notNull(), rawUuids: json("raw_uuids").$type<string[]>().notNull(), processUuids: json("process_uuids").$type<string[]>().notNull(), sourceUrls: json("source_urls").$type<string[]>().notNull(), transformationSteps: json("transformation_steps").$type<Record<string, unknown>[]>().notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("spider_blood_structured_idx").on(table.structuredDataUuid, table.collectionName)]);

export const spiderContentSnapshot = mysqlTable("spider_content_snapshot", {
  id: int("id").autoincrement().primaryKey(), snapshotUuid: varchar("snapshot_uuid", { length: 64 }).notNull().unique(), entityUuid: varchar("entity_uuid", { length: 64 }).notNull(), entityType: varchar("entity_type", { length: 60 }).notNull(), version: int("version").notNull(), sourceUrl: text("source_url"), contentHash: varchar("content_hash", { length: 64 }).notNull(), rawUuid: varchar("raw_uuid", { length: 64 }), snapshotContent: text("snapshot_content"), changeSummary: text("change_summary"), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("spider_snapshot_entity_version_uq").on(table.entityUuid, table.version), index("spider_snapshot_entity_time_idx").on(table.entityUuid, table.createdAt)]);

// ─── Curves ───────────────────────────────────────────────────────────────────
export const curves = mysqlTable("curves", {
  id: int("id").autoincrement().primaryKey(),
  curveId: varchar("curve_id", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }),
  country: varchar("country", { length: 64 }),
  currency: varchar("currency", { length: 16 }),
  type: varchar("type", { length: 64 }),
  region: varchar("region", { length: 64 }),
  category: varchar("category", { length: 64 }),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** URL health is independent of authorization: failed sources remain visible to admins. */
export const agentReachPublicSources = mysqlTable("agent_reach_public_sources", {
  id: int("id").autoincrement().primaryKey(),
  urlHash: varchar("url_hash", { length: 64 }).notNull(),
  websiteUrl: varchar("website_url", { length: 1200 }).notNull(),
  feedUrl: varchar("feed_url", { length: 1200 }),
  status: mysqlEnum("status", ["available", "unavailable"]).notNull().default("unavailable"),
  lastError: varchar("last_error", { length: 600 }),
  lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
  sourceItems: int("source_items").notNull().default(0),
  storedCount: int("stored_count").notNull().default(0),
  deduplicatedCount: int("deduplicated_count").notNull().default(0),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("agent_reach_source_url_uq").on(table.urlHash),
  index("agent_reach_source_status_idx").on(table.status, table.lastCheckedAt),
]);

/** Publisher RSS metadata archived independently of temporary network availability. */
export const officialNewsFeedItems = mysqlTable("official_news_feed_items", {
  id: int("id").autoincrement().primaryKey(),
  sourceKind: varchar("source_kind", { length: 32 }).notNull(),
  sourceIdHash: varchar("source_id_hash", { length: 64 }).notNull(),
  sourceId: varchar("source_id", { length: 320 }).notNull(),
  headline: varchar("headline", { length: 600 }).notNull(),
  excerpt: text("excerpt"),
  sourceUrl: varchar("source_url", { length: 1200 }).notNull(),
  publishedAt: timestamp("published_at"),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
}, table => [
  uniqueIndex("official_news_source_item_uq").on(table.sourceKind, table.sourceIdHash),
  index("official_news_source_published_idx").on(table.sourceKind, table.publishedAt),
]);

export type Curve = typeof curves.$inferSelect;
export type InsertCurve = typeof curves.$inferInsert;

// ─── Curve Data Points ────────────────────────────────────────────────────────
export const curveDataPoints = mysqlTable("curve_data_points", {
  id: int("id").autoincrement().primaryKey(),
  curveId: int("curve_id").notNull(),
  dataDate: varchar("data_date", { length: 16 }).notNull().default(""),
  period: varchar("period", { length: 16 }).notNull(),
  value: varchar("value", { length: 32 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CurveDataPoint = typeof curveDataPoints.$inferSelect;
export type InsertCurveDataPoint = typeof curveDataPoints.$inferInsert;

// ─── Official Treasury Historical Curve Import Audit ──────────────────────────
// 仅记录已导入官方历史资产的来源与覆盖边界；收益率点仍保存在 curve_data_points。
export const treasuryHistoricalCurveImports = mysqlTable("treasury_historical_curve_imports", {
  id: int("id").autoincrement().primaryKey(),
  importKey: varchar("import_key", { length: 128 }).notNull().unique(),
  curveId: int("curve_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceSha256: varchar("source_sha256", { length: 64 }).notNull(),
  sourceFirstDate: varchar("source_first_date", { length: 10 }).notNull(),
  sourceLastDate: varchar("source_last_date", { length: 10 }).notNull(),
  samplingRule: varchar("sampling_rule", { length: 160 }).notNull(),
  selectedObservationCount: int("selected_observation_count").notNull(),
  importedPointCount: int("imported_point_count").notNull(),
  fetchedAt: timestamp("fetched_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TreasuryHistoricalCurveImport = typeof treasuryHistoricalCurveImports.$inferSelect;
export type InsertTreasuryHistoricalCurveImport = typeof treasuryHistoricalCurveImports.$inferInsert;

// ─── Curve Categories ─────────────────────────────────────────────────────────
export const curveCategories = mysqlTable("curve_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CurveCategory = typeof curveCategories.$inferSelect;

// ─── Curve Regions ────────────────────────────────────────────────────────────
export const curveRegions = mysqlTable("curve_regions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  countries: text("countries"),
  code: varchar("code", { length: 16 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CurveRegion = typeof curveRegions.$inferSelect;

// ─── Fund Data ────────────────────────────────────────────────────────────────
export const fundData = mysqlTable("fund_data", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }),
  price: varchar("price", { length: 32 }).notNull().default("0"),
  changeVal: varchar("change_val", { length: 32 }).notNull().default("0"),
  changePct: varchar("change_pct", { length: 32 }).notNull().default("0"),
  fundType: varchar("fund_type", { length: 100 }),
  assetClass: varchar("asset_class", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type FundData = typeof fundData.$inferSelect;
export type InsertFundData = typeof fundData.$inferInsert;

// ─── Fund Distributions ───────────────────────────────────────────────────────
export const fundDistributions = mysqlTable("fund_distributions", {
  id: int("id").autoincrement().primaryKey(),
  fundId: int("fund_id").notNull(),
  distributionType: varchar("distribution_type", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  weight: varchar("weight", { length: 32 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FundDistribution = typeof fundDistributions.$inferSelect;

// ─── ETF Products ─────────────────────────────────────────────────────────────
export const etfProducts = mysqlTable("etf_products", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("name_en", { length: 255 }),
  price: varchar("price", { length: 32 }),
  nav: varchar("nav", { length: 32 }),
  changeVal: varchar("change_val", { length: 32 }).notNull().default("0"),
  changePct: varchar("change_pct", { length: 32 }).notNull().default("0"),
  volume: varchar("volume", { length: 32 }).notNull().default("0"),
  fundType: varchar("fund_type", { length: 100 }),
  assetClass: varchar("asset_class", { length: 100 }),
  region: varchar("region", { length: 100 }),
  rating: varchar("rating", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type EtfProduct = typeof etfProducts.$inferSelect;

// ─── ETF Holdings ─────────────────────────────────────────────────────────────
export const etfHoldings = mysqlTable("etf_holdings", {
  id: int("id").autoincrement().primaryKey(),
  etfId: int("etf_id").notNull(),
  holdingName: varchar("holding_name", { length: 255 }).notNull(),
  holdingType: varchar("holding_type", { length: 100 }),
  weight: decimal("weight", { precision: 8, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EtfHolding = typeof etfHoldings.$inferSelect;

// ─── Model Run History ──────────────────────────────────────────────────────────
export const modelRunHistory = mysqlTable("model_run_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  modelId: varchar("model_id", { length: 64 }).notNull(),
  modelLabel: varchar("model_label", { length: 128 }).notNull(),
  modelColor: varchar("model_color", { length: 32 }).notNull().default("#3b82f6"),
  params: json("params").notNull(),
  mae: decimal("mae", { precision: 12, scale: 6 }).notNull().default("0"),
  rmse: decimal("rmse", { precision: 12, scale: 6 }).notNull().default("0"),
  mape: decimal("mape", { precision: 8, scale: 4 }).notNull().default("0"),
  accuracy: decimal("accuracy", { precision: 6, scale: 2 }).notNull().default("0"),
  seed: int("seed").notNull().default(42),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ModelRunHistory = typeof modelRunHistory.$inferSelect;
export type InsertModelRunHistory = typeof modelRunHistory.$inferInsert;

// ─── Workbench Panels ─────────────────────────────────────────────────────────
export const workbenchPanels = mysqlTable("workbench_panels", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  panelCode: varchar("panel_code", { length: 50 }).notNull(),
  panelName: varchar("panel_name", { length: 255 }),
  panelType: varchar("panel_type", { length: 50 }),
  icon: varchar("icon", { length: 64 }),
  position: int("position").default(0),
  pinned: int("pinned").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type WorkbenchPanel = typeof workbenchPanels.$inferSelect;
export type InsertWorkbenchPanel = typeof workbenchPanels.$inferInsert;

// ─── CRVF Watchlist ───────────────────────────────────────────────────────────
export const crvfWatchlist = mysqlTable("crvf_watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  curveId: varchar("curve_id", { length: 64 }).notNull(),
  curveName: varchar("curve_name", { length: 255 }),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrvfWatchlistItem = typeof crvfWatchlist.$inferSelect;

// ─── Financial Metrics ────────────────────────────────────────────────────────
export const financialMetrics = mysqlTable("financial_metrics", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  category: varchar("category", { length: 64 }),
  unit: varchar("unit", { length: 32 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FinancialMetric = typeof financialMetrics.$inferSelect;

// ─── Financial Data ───────────────────────────────────────────────────────────
export const financialData = mysqlTable("financial_data", {
  id: int("id").autoincrement().primaryKey(),
  securityId: int("security_id").notNull(),
  metricId: int("metric_id").notNull(),
  year: int("year").notNull(),
  value: decimal("value", { precision: 18, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FinancialDataRow = typeof financialData.$inferSelect;

// ─── Credit Ratings ───────────────────────────────────────────────────────────
export const creditRatings = mysqlTable("credit_ratings", {
  id: int("id").autoincrement().primaryKey(),
  securityId: int("security_id").notNull(),
  ratingAgency: varchar("rating_agency", { length: 64 }),
  rating: varchar("rating", { length: 16 }),
  outlook: varchar("outlook", { length: 32 }),
  ratingDate: date("rating_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditRating = typeof creditRatings.$inferSelect;

// ─── Model Predictions ────────────────────────────────────────────────────────
export const modelPredictions = mysqlTable("model_predictions", {
  id: int("id").autoincrement().primaryKey(),
  securityId: int("security_id").notNull(),
  modelName: varchar("model_name", { length: 64 }).notNull(),
  predictionDate: date("prediction_date"),
  predictedValue: decimal("predicted_value", { precision: 18, scale: 6 }),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ModelPrediction = typeof modelPredictions.$inferSelect;

// ─── Model Metrics ────────────────────────────────────────────────────────────
export const modelMetrics = mysqlTable("model_metrics", {
  id: int("id").autoincrement().primaryKey(),
  modelName: varchar("model_name", { length: 64 }).notNull(),
  metricDate: date("metric_date"),
  metricName: varchar("metric_name", { length: 64 }),
  metricValue: decimal("metric_value", { precision: 18, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ModelMetric = typeof modelMetrics.$inferSelect;

// ─── Rating Agencies ──────────────────────────────────────────────────────────
export const ratingAgencies = mysqlTable("rating_agencies", {
  id: int("id").autoincrement().primaryKey(),
  agencyCode: varchar("agency_code", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RatingAgency = typeof ratingAgencies.$inferSelect;


// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["announcement", "system", "alert", "info"]).default("announcement").notNull(),
  relatedId: int("relatedId"),
  relatedType: varchar("relatedType", { length: 64 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  announcements: boolean("announcements").default(true).notNull(),
  systemAlerts: boolean("systemAlerts").default(true).notNull(),
  marketAlerts: boolean("marketAlerts").default(true).notNull(),
  infoMessages: boolean("infoMessages").default(true).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;

// ─── Announcements ─────────────────────────────────────────────────────────
// 公告由管理员维护；公开端只读取已发布且未到期的记录。
export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["info", "warning", "urgent", "maintenance"]).notNull().default("info"),
  priority: int("priority").notNull().default(0),
  status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  publishedAt: timestamp("publishedAt"),
  draftRevision: int("draftRevision").notNull().default(1),
  acceptedRevision: int("acceptedRevision"),
  acceptanceNote: text("acceptanceNote"),
  acceptedAt: timestamp("acceptedAt"),
  acceptedById: int("acceptedById"),
  acceptedByName: varchar("acceptedByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("announcements_status_expires_idx").on(table.status, table.expiresAt),
  index("announcements_published_idx").on(table.publishedAt),
]);

export type Announcement = typeof announcements.$inferSelect;

// 仅保存管理员实际执行的预览和确认事件；发布必须匹配已确认的草稿版本。
export const announcementAcceptanceEvents = mysqlTable("announcement_acceptance_events", {
  id: int("id").autoincrement().primaryKey(),
  announcementId: int("announcementId").notNull(),
  revision: int("revision").notNull(),
  action: mysqlEnum("action", ["previewed", "confirmed"]).notNull(),
  actorUserId: int("actorUserId").notNull(),
  actorUserName: varchar("actorUserName", { length: 255 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("announcement_acceptance_announcement_idx").on(table.announcementId, table.revision),
]);

export type AnnouncementAcceptanceEvent = typeof announcementAcceptanceEvents.$inferSelect;

// ─── Bond Portfolio Import Templates ─────────────────────────────────────────
// 映射模板与账户绑定，仅保存列头到标准字段的配置，不保存持仓文件或数据行。
export const bondPortfolioImportTemplates = mysqlTable("bond_portfolio_import_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  mapping: json("mapping").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BondPortfolioImportTemplate = typeof bondPortfolioImportTemplates.$inferSelect;

// 已保存的债券情景仅保存登录账户明确导入的标准化持仓映射与冲击参数，不保存原始 CSV 文件。
export const bondPortfolioScenarioSnapshots = mysqlTable("bond_portfolio_scenario_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  positions: json("positions").notNull(),
  magnitudeBp: int("magnitude_bp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("bond_portfolio_scenario_user_name_uq").on(table.userId, table.name),
  index("bond_portfolio_scenario_user_updated_idx").on(table.userId, table.updatedAt),
]);

export type BondPortfolioScenarioSnapshot = typeof bondPortfolioScenarioSnapshots.$inferSelect;

// ─── Research Ledger & Approval Audit ─────────────────────────────────────────
// 研究登记簿由当前登录用户创建；审批历史追加写入，不以状态更新替代审计事件。
export const researchLedgerEntries = mysqlTable("research_ledger_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleCode: varchar("module_code", { length: 32 }).notNull(),
  instrument: varchar("instrument", { length: 255 }).notNull(),
  purpose: text("purpose").notNull(),
  verifiedSource: text("verified_source").notNull(),
  methodBasis: text("method_basis").notNull(),
  complianceConfirmed: boolean("compliance_confirmed").default(false).notNull(),
  status: mysqlEnum("status", ["submitted", "approved", "rejected"]).default("submitted").notNull(),
  reviewerId: int("reviewer_id"),
  reviewNote: text("review_note"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  approvalDueAt: timestamp("approval_due_at").notNull(),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ResearchLedgerEntry = typeof researchLedgerEntries.$inferSelect;
export type InsertResearchLedgerEntry = typeof researchLedgerEntries.$inferInsert;

export const researchLedgerAuditEvents = mysqlTable("research_ledger_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  entryId: int("entry_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["submitted", "approved", "rejected"]).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ResearchLedgerAuditEvent = typeof researchLedgerAuditEvents.$inferSelect;

// ─── Sovereign Research Checklist Collaboration ───────────────────────────────
// 模板属于创建账户；可选择让所有登录账户发现，或以指定账户的只读/可编辑授权共享。
export const checklistTemplates = mysqlTable("checklist_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  items: json("items").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  archivedByUserId: int("archived_by_user_id"),
  retentionDays: int("retention_days"),
  retentionExpiresAt: timestamp("retention_expires_at"),
  archiveReviewStatus: mysqlEnum("archive_review_status", ["not_required", "pending", "approved", "changes_requested"]).default("not_required").notNull(),
  archiveReviewDueAt: timestamp("archive_review_due_at"),
  archiveReviewedByUserId: int("archive_reviewed_by_user_id"),
  archiveReviewedAt: timestamp("archive_reviewed_at"),
  archiveReviewNote: text("archive_review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = typeof checklistTemplates.$inferInsert;

// 每次保存均追加快照，避免用更新覆盖研究记录，供团队追溯和差异比较。
export const checklistSnapshots = mysqlTable("checklist_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  templateId: int("template_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  items: json("items").notNull(),
  completedItems: json("completed_items").notNull(),
  note: text("note"),
  version: int("version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChecklistSnapshot = typeof checklistSnapshots.$inferSelect;
export type InsertChecklistSnapshot = typeof checklistSnapshots.$inferInsert;

// 版本差异文件在浏览器生成后登记导出身份、签名校验码与下载时间；不保存客户端文件字节。
export const checklistExportRecords = mysqlTable("checklist_export_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  templateId: int("template_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  researchId: varchar("research_id", { length: 160 }).notNull(),
  exportFormat: mysqlEnum("export_format", ["csv", "pdf"]).notNull(),
  verificationCode: varchar("verification_code", { length: 80 }).notNull(),
  signaturePayload: text("signature_payload").notNull(),
  verificationExpiresAt: timestamp("verification_expires_at"),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChecklistExportRecord = typeof checklistExportRecords.$inferSelect;
export type InsertChecklistExportRecord = typeof checklistExportRecords.$inferInsert;

export const sovereignComparisonPresets = mysqlTable("sovereign_comparison_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  countries: json("countries").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SovereignComparisonPreset = typeof sovereignComparisonPresets.$inferSelect;

export const sovereignComparisonPresetShares = mysqlTable("sovereign_comparison_preset_shares", {
  id: int("id").autoincrement().primaryKey(),
  presetId: int("preset_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SovereignComparisonPresetShare = typeof sovereignComparisonPresetShares.$inferSelect;

export const checklistDeadlineNotificationEvents = mysqlTable("checklist_deadline_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull().unique(),
  userId: int("user_id").notNull(),
  eventType: mysqlEnum("event_type", ["signature_expiring", "review_due"]).notNull(),
  exportRecordId: int("export_record_id"),
  templateId: int("template_id"),
  dueAt: timestamp("due_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChecklistDeadlineNotificationEvent = typeof checklistDeadlineNotificationEvents.$inferSelect;

// ─── Sovereign Financing Calendar Reminders ───────────────────────────────────
// 每个账户可按事件类型与国家范围配置一条提醒；ALL 代表全部可用国家。
export const financingCalendarReminderRules = mysqlTable("financing_calendar_reminder_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventType: mysqlEnum("event_type", ["announcement", "auction", "settlement"]).notNull(),
  countryCode: varchar("country_code", { length: 8 }).default("ALL").notNull(),
  daysBeforeEvent: int("days_before_event").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("financing_reminder_rule_user_event_country_uq").on(table.userId, table.eventType, table.countryCode)]);

export type FinancingCalendarReminderRule = typeof financingCalendarReminderRules.$inferSelect;

// 已发送提醒追加写入，用于计划任务重试和每小时扫描时的幂等去重。
export const financingCalendarReminderNotificationEvents = mysqlTable("financing_calendar_reminder_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  userId: int("user_id").notNull(),
  ruleId: int("rule_id").notNull(),
  eventRecordId: varchar("event_record_id", { length: 190 }).notNull(),
  eventDate: date("event_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("fin_cal_rem_notify_key_uq").on(table.notificationKey)]);

export type FinancingCalendarReminderNotificationEvent = typeof financingCalendarReminderNotificationEvents.$inferSelect;

// ─── Credit Research Evidence & OAS Threshold Alerts ─────────────────────────
// SEC 文件高亮以用户保存的原文摘录、颜色和研究注释持久化；不缓存或重发布整份外部文件。
export const creditEvidenceLogs = mysqlTable("credit_evidence_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  issuer: varchar("issuer", { length: 255 }),
  form: varchar("form", { length: 16 }),
  filingDate: varchar("filing_date", { length: 10 }),
  sourceUrl: text("source_url").notNull(),
  quotedText: text("quoted_text").notNull(),
  annotation: text("annotation").notNull(),
  highlightColor: mysqlEnum("highlight_color", ["amber", "cyan", "rose", "emerald"]).default("amber").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CreditEvidenceLog = typeof creditEvidenceLogs.$inferSelect;

// 创建者可向指定账户授予只读或可编辑证据日志访问权；权限不通过客户端传入的 owner 字段判断。
export const creditEvidenceShares = mysqlTable("credit_evidence_shares", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: int("evidence_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("credit_evidence_share_uq").on(table.evidenceId, table.sharedWithUserId)]);

export type CreditEvidenceShare = typeof creditEvidenceShares.$inferSelect;

export const creditEvidenceAuditEvents = mysqlTable("credit_evidence_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: int("evidence_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "shared", "share_revoked"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditEvidenceAuditEvent = typeof creditEvidenceAuditEvents.$inferSelect;

// 规则采用公开 FRED OAS 的已披露观察值；仅支持超过阈值，事件表负责跨任务重试的幂等去重。
export const creditOasThresholdRules = mysqlTable("credit_oas_threshold_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  seriesId: mysqlEnum("series_id", ["BAMLC0A0CM", "BAMLC0A1CAAA", "BAMLC0A2CAA", "BAMLC0A4CBBB", "BAMLH0A0HYM2"]).notNull(),
  thresholdBps: decimal("threshold_bps", { precision: 10, scale: 1 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("credit_oas_threshold_rule_user_series_uq").on(table.userId, table.seriesId)]);

export type CreditOasThresholdRule = typeof creditOasThresholdRules.$inferSelect;

export const creditOasThresholdNotificationEvents = mysqlTable("credit_oas_threshold_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  userId: int("user_id").notNull(),
  ruleId: int("rule_id").notNull(),
  seriesId: varchar("series_id", { length: 16 }).notNull(),
  observationDate: varchar("observation_date", { length: 10 }).notNull(),
  observedBps: decimal("observed_bps", { precision: 10, scale: 1 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("credit_oas_threshold_notification_key_uq").on(table.notificationKey)]);

export type CreditOasThresholdNotificationEvent = typeof creditOasThresholdNotificationEvents.$inferSelect;

// ─── Credit Research Package Approval & Shared Workpapers ─────────────────────
// 研究模板由创建账户维护；研究包在提交时冻结内容哈希，电子签名只证明已认证账户的内部确认，不替代法定电子签名服务。
export const creditResearchPackageTemplates = mysqlTable("credit_research_package_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sections: json("sections").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CreditResearchPackageTemplate = typeof creditResearchPackageTemplates.$inferSelect;

export const creditResearchPackages = mysqlTable("credit_research_packages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  templateId: int("template_id"),
  title: varchar("title", { length: 180 }).notNull(),
  researchQuestion: text("research_question").notNull(),
  asOfDate: date("as_of_date"),
  sourceUrl: text("source_url").notNull(),
  note: text("note"),
  sections: json("sections").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "changes_requested", "approved"]).default("draft").notNull(),
  version: int("version").default(1).notNull(),
  revisionOfPackageId: int("revision_of_package_id"),
  approvalDueAt: timestamp("approval_due_at"),
  approvalReminderDays: int("approval_reminder_days").default(3).notNull(),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedByUserId: int("approved_by_user_id"),
  approvalNote: text("approval_note"),
  contentHash: varchar("content_hash", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CreditResearchPackage = typeof creditResearchPackages.$inferSelect;

export const creditResearchPackageShares = mysqlTable("credit_research_package_shares", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["editor", "reviewer", "viewer"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("credit_research_package_share_uq").on(table.packageId, table.sharedWithUserId)]);

export type CreditResearchPackageShare = typeof creditResearchPackageShares.$inferSelect;

export const creditResearchPackageSignatures = mysqlTable("credit_research_package_signatures", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  signerUserId: int("signer_user_id").notNull(),
  signerName: varchar("signer_name", { length: 255 }),
  action: mysqlEnum("action", ["submitted", "approved", "changes_requested"]).notNull(),
  attestation: text("attestation").notNull(),
  contentHash: varchar("content_hash", { length: 128 }).notNull(),
  signatureCode: varchar("signature_code", { length: 96 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditResearchPackageSignature = typeof creditResearchPackageSignatures.$inferSelect;

export const creditResearchPackageAuditEvents = mysqlTable("credit_research_package_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "template_applied", "shared", "share_revoked", "submitted", "approved", "changes_requested", "approval_due_set", "revision_created"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditResearchPackageAuditEvent = typeof creditResearchPackageAuditEvents.$inferSelect;

// 工作底稿以 JSON 载荷保存用户输入、公式和来源，不保存外部数据文件字节；每次更新提高版本并追加审计记录。
export const creditSharedWorkpapers = mysqlTable("credit_shared_workpapers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  payload: json("payload").notNull(),
  version: int("version").default(1).notNull(),
  reviewStatus: mysqlEnum("review_status", ["draft", "in_review", "approved", "changes_requested"]).default("draft").notNull(),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CreditSharedWorkpaper = typeof creditSharedWorkpapers.$inferSelect;

export const creditSharedWorkpaperShares = mysqlTable("credit_shared_workpaper_shares", {
  id: int("id").autoincrement().primaryKey(),
  workpaperId: int("workpaper_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["editor", "reviewer", "viewer"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("credit_shared_workpaper_share_uq").on(table.workpaperId, table.sharedWithUserId)]);

export type CreditSharedWorkpaperShare = typeof creditSharedWorkpaperShares.$inferSelect;

export const creditSharedWorkpaperAuditEvents = mysqlTable("credit_shared_workpaper_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  workpaperId: int("workpaper_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "shared", "share_revoked", "submitted_for_review", "approved", "changes_requested"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CreditSharedWorkpaperAuditEvent = typeof creditSharedWorkpaperAuditEvents.$inferSelect;

// ─── Mortgage Ledger Collaboration ──────────────────────────────────────────
// 抵押债台账以账户级 JSON 载荷保存用户登记的字段、来源和观察；不保存外部原始文件字节或未授权行情。
// 所有者拥有完整权限，成员可被显式授予编辑、审阅或只读权限；每个写入和授权动作均追加审计事件。
export const mortgageSharedLedgers = mysqlTable("mortgage_shared_ledgers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  localStorageKey: varchar("local_storage_key", { length: 96 }),
  name: varchar("name", { length: 160 }).notNull(),
  payload: json("payload").notNull(),
  version: int("version").default(1).notNull(),
  reviewStatus: mysqlEnum("review_status", ["draft", "in_review", "approved", "changes_requested"]).default("draft").notNull(),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  reviewDueAt: timestamp("review_due_at"),
  reviewReminderHours: int("review_reminder_hours").default(24).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type MortgageSharedLedger = typeof mortgageSharedLedgers.$inferSelect;

// MBS-24 分类标签由创建账户维护，可向指定成员共享只读或编辑权限；标签绑定的是研究分类键而非证券行情或评级。
export const mortgageTaxonomyTags = mysqlTable("mortgage_taxonomy_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 16 }).default("cyan").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mortgage_taxonomy_tag_owner_name_uq").on(table.userId, table.name)]);

export type MortgageTaxonomyTag = typeof mortgageTaxonomyTags.$inferSelect;

export const mortgageTaxonomyTagShares = mysqlTable("mortgage_taxonomy_tag_shares", {
  id: int("id").autoincrement().primaryKey(),
  tagId: int("tag_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mortgage_taxonomy_tag_share_uq").on(table.tagId, table.sharedWithUserId)]);

export type MortgageTaxonomyTagShare = typeof mortgageTaxonomyTagShares.$inferSelect;

export const mortgageTaxonomyTagAssignments = mysqlTable("mortgage_taxonomy_tag_assignments", {
  id: int("id").autoincrement().primaryKey(),
  tagId: int("tag_id").notNull(),
  categoryKey: varchar("category_key", { length: 48 }).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mortgage_taxonomy_tag_category_uq").on(table.tagId, table.categoryKey)]);

export type MortgageTaxonomyTagAssignment = typeof mortgageTaxonomyTagAssignments.$inferSelect;

// 已保存视图仅属于当前账户，保存抵押债账户级台账的筛选、排序和列可见性，不保存任何外部数据行。
export const mortgageLedgerSavedViews = mysqlTable("mortgage_ledger_saved_views", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  name: varchar("name", { length: 96 }).notNull(),
  config: json("config").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mortgage_ledger_view_user_module_name_uq").on(table.userId, table.moduleId, table.name)]);

export type MortgageLedgerSavedView = typeof mortgageLedgerSavedViews.$inferSelect;

export const mortgageSharedLedgerShares = mysqlTable("mortgage_shared_ledger_shares", {
  id: int("id").autoincrement().primaryKey(),
  ledgerId: int("ledger_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["editor", "reviewer", "viewer"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mortgage_shared_ledger_share_uq").on(table.ledgerId, table.sharedWithUserId)]);

export type MortgageSharedLedgerShare = typeof mortgageSharedLedgerShares.$inferSelect;

export const mortgageSharedLedgerAuditEvents = mysqlTable("mortgage_shared_ledger_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  ledgerId: int("ledger_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "local_migrated", "shared", "share_revoked", "submitted_for_review", "approved", "changes_requested", "exported"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MortgageSharedLedgerAuditEvent = typeof mortgageSharedLedgerAuditEvents.$inferSelect;

// 每小时检查与提交审阅均通过该表按账户、台账、时点及事件类型幂等去重；通知正文仍写入通用通知中心。
export const mortgageLedgerNotificationEvents = mysqlTable("mortgage_ledger_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  userId: int("user_id").notNull(),
  ledgerId: int("ledger_id").notNull(),
  eventType: mysqlEnum("event_type", ["review_submitted", "review_due_soon", "review_overdue"]).notNull(),
  dueAt: timestamp("due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mortgage_ledger_notification_key_uq").on(table.notificationKey)]);

export type MortgageLedgerNotificationEvent = typeof mortgageLedgerNotificationEvents.$inferSelect;

export const checklistShares = mysqlTable("checklist_shares", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChecklistShare = typeof checklistShares.$inferSelect;
export type InsertChecklistShare = typeof checklistShares.$inferInsert;

// 模板治理事件只追加不覆盖，用于还原归档、恢复、授权及撤销授权的责任与时间线。
export const checklistTemplateAuditEvents = mysqlTable("checklist_template_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["archived", "restored", "retention_set", "submitted_for_review", "review_approved", "review_changes_requested", "shared", "share_revoked", "visibility_changed"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChecklistTemplateAuditEvent = typeof checklistTemplateAuditEvents.$inferSelect;
export type InsertChecklistTemplateAuditEvent = typeof checklistTemplateAuditEvents.$inferInsert;

// ─── Daily Sovereign Source Facts ─────────────────────────────────────────────
// 每日任务只保存可追溯的原始观测、来源、抓取时点和不可用状态；不保存自动生成的研究结论。
export const sovereignDailyFactSnapshots = mysqlTable("sovereign_daily_fact_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotKey: varchar("snapshot_key", { length: 100 }).notNull().unique(),
  sourceKey: varchar("source_key", { length: 64 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  observationDate: varchar("observation_date", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["available", "partial", "unavailable"]).notNull(),
  recordCount: int("record_count").notNull().default(0),
  coveredModules: json("covered_modules").notNull(),
  payload: json("payload").notNull(),
  limitation: text("limitation"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export type SovereignDailyFactSnapshot = typeof sovereignDailyFactSnapshots.$inferSelect;

// ─── Central-bank Policy Evidence Collaboration ───────────────────────────────
// 只保存官方原文链接、内容指纹、关键词证据片段与人工批注；不存储或重新发布完整央行文件。
export const policyEvidenceDocuments = mysqlTable("policy_evidence_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceId: varchar("source_id", { length: 16 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  documentFingerprint: varchar("document_fingerprint", { length: 64 }).notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  highlights: json("highlights").notNull(),
  guidanceEvidence: json("guidance_evidence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("policy_evidence_document_owner_fingerprint_uq").on(table.userId, table.documentFingerprint)]);

export type PolicyEvidenceDocument = typeof policyEvidenceDocuments.$inferSelect;

export const policyEvidenceDocumentShares = mysqlTable("policy_evidence_document_shares", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("policy_evidence_document_share_uq").on(table.documentId, table.sharedWithUserId)]);

export type PolicyEvidenceDocumentShare = typeof policyEvidenceDocumentShares.$inferSelect;

export const policyEvidenceAnnotations = mysqlTable("policy_evidence_annotations", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  userId: int("user_id").notNull(),
  category: mysqlEnum("category", ["key_rate", "policy_action", "forward_guidance", "manual_note"]).notNull(),
  quotedText: text("quoted_text").notNull(),
  annotation: text("annotation").notNull(),
  highlightColor: mysqlEnum("highlight_color", ["amber", "cyan", "rose", "emerald", "violet"]).default("amber").notNull(),
  startOffset: int("start_offset"),
  endOffset: int("end_offset"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PolicyEvidenceAnnotation = typeof policyEvidenceAnnotations.$inferSelect;

export const policyEvidenceAuditEvents = mysqlTable("policy_evidence_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["document_captured", "annotation_added", "annotation_updated", "shared", "share_revoked", "compared", "mention_created", "mention_resolved", "version_reviewed"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PolicyEvidenceAuditEvent = typeof policyEvidenceAuditEvents.$inferSelect;

// 每个提及绑定具体批注和被提及成员；待回复状态只能由被提及成员、文档所有者或编辑成员推进。
export const policyEvidenceAnnotationMentions = mysqlTable("policy_evidence_annotation_mentions", {
  id: int("id").autoincrement().primaryKey(),
  annotationId: int("annotation_id").notNull(),
  mentionedUserId: int("mentioned_user_id").notNull(),
  status: mysqlEnum("status", ["pending", "resolved"]).default("pending").notNull(),
  responseNote: text("response_note"),
  resolvedByUserId: int("resolved_by_user_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("policy_evidence_mention_annotation_user_uq").on(table.annotationId, table.mentionedUserId)]);

export type PolicyEvidenceAnnotationMention = typeof policyEvidenceAnnotationMentions.$inferSelect;

// 即时提及和待回复提醒均由此表的通知键幂等去重，通知正文写入通用通知中心。
export const policyEvidenceMentionNotificationEvents = mysqlTable("policy_evidence_mention_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  mentionId: int("mention_id").notNull(),
  userId: int("user_id").notNull(),
  eventType: mysqlEnum("event_type", ["mentioned", "pending_reply"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("policy_evidence_mention_notification_key_uq").on(table.notificationKey)]);

export type PolicyEvidenceMentionNotificationEvent = typeof policyEvidenceMentionNotificationEvents.$inferSelect;

// 相同版本对只能有一个团队审阅状态；编辑成员可登记待审/需复核，较新文件所有者确认最终状态。
export const policyEvidenceVersionReviews = mysqlTable("policy_evidence_version_reviews", {
  id: int("id").autoincrement().primaryKey(),
  olderDocumentId: int("older_document_id").notNull(),
  newerDocumentId: int("newer_document_id").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "follow_up"]).default("pending").notNull(),
  reviewNote: text("review_note"),
  reviewedByUserId: int("reviewed_by_user_id").notNull(),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("policy_evidence_version_review_pair_uq").on(table.olderDocumentId, table.newerDocumentId)]);

export type PolicyEvidenceVersionReview = typeof policyEvidenceVersionReviews.$inferSelect;

// BOOM 预设保存实际筛选参数而非日历内容；团队成员只能读取或按授权编辑预设，ICS 始终重新读取官方拍卖记录。
export const boomSubscriptionPresets = mysqlTable("boom_subscription_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 96 }).notNull(),
  filters: json("filters").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("boom_subscription_preset_user_name_uq").on(table.userId, table.name)]);

export type BoomSubscriptionPreset = typeof boomSubscriptionPresets.$inferSelect;

export const boomSubscriptionPresetShares = mysqlTable("boom_subscription_preset_shares", {
  id: int("id").autoincrement().primaryKey(),
  presetId: int("preset_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("boom_subscription_preset_share_uq").on(table.presetId, table.sharedWithUserId)]);

export type BoomSubscriptionPresetShare = typeof boomSubscriptionPresetShares.$inferSelect;

export const boomSubscriptionPresetAuditEvents = mysqlTable("boom_subscription_preset_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  presetId: int("preset_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "shared", "share_revoked", "loaded"]).notNull(),
  targetUserId: int("target_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BoomSubscriptionPresetAuditEvent = typeof boomSubscriptionPresetAuditEvents.$inferSelect;

// GC 报告模板仅保存导出元数据；报告内容始终由当次选择的公开序列、来源和生成时点即时组成。
export const gcReportTemplates = mysqlTable("gc_report_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 96 }).notNull(),
  headerText: varchar("header_text", { length: 80 }).notNull(),
  researchIdPrefix: varchar("research_id_prefix", { length: 32 }).notNull(),
  footerText: varchar("footer_text", { length: 160 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("gc_report_template_user_name_uq").on(table.userId, table.name)]);

export type GcReportTemplate = typeof gcReportTemplates.$inferSelect;

export const gcReportTemplateShares = mysqlTable("gc_report_template_shares", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "editor", "reviewer"]).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("gc_report_template_share_uq").on(table.templateId, table.sharedWithUserId)]);

export const gcReportTemplateReviews = mysqlTable("gc_report_template_reviews", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  reviewerUserId: int("reviewer_user_id").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "changes_requested"]).notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("gc_report_template_reviewer_uq").on(table.templateId, table.reviewerUserId)]);

export const gcReportTemplateAuditEvents = mysqlTable("gc_report_template_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "deleted", "shared", "share_revoked", "reviewed"]).notNull(),
  targetUserId: int("target_user_id"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// MKTBEAT 仅记录已真实触发并已写入全局通知中心的阈值事件；同一账户、序列、窗口、阈值和观察日只通知一次。
export const mktbeatThresholdNotificationEvents = mysqlTable("mktbeat_threshold_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  userId: int("user_id").notNull(),
  seriesId: varchar("series_id", { length: 16 }).notNull(),
  windowDays: int("window_days").notNull(),
  thresholdBps: decimal("threshold_bps", { precision: 10, scale: 1 }).notNull(),
  observationDate: varchar("observation_date", { length: 10 }).notNull(),
  observedChangeBps: decimal("observed_change_bps", { precision: 12, scale: 1 }).notNull(),
  deliveryStatus: mysqlEnum("delivery_status", ["immediate", "queued", "delivered"]).notNull().default("immediate"),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mktbeat_threshold_notification_user_key_uq").on(table.userId, table.notificationKey)]);

export type MktbeatThresholdNotificationEvent = typeof mktbeatThresholdNotificationEvents.$inferSelect;

export const mktbeatNotificationRules = mysqlTable("mktbeat_notification_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  seriesId: varchar("series_id", { length: 16 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  quietStart: varchar("quiet_start", { length: 5 }),
  quietEnd: varchar("quiet_end", { length: 5 }),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  digestMode: mysqlEnum("digest_mode", ["after_quiet", "daily", "weekly", "none"]).notNull().default("after_quiet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mktbeat_notification_rule_user_series_uq").on(table.userId, table.seriesId)]);

export const mktbeatNotificationDigestDeliveries = mysqlTable("mktbeat_notification_digest_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  deliveryKey: varchar("delivery_key", { length: 190 }).notNull(),
  notificationId: int("notification_id").notNull(),
  eventCount: int("event_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mktbeat_notification_digest_delivery_uq").on(table.ruleId, table.deliveryKey)]);

// SOURCE 只基于公开序列的最近观察日判断时效；规则、事件和汇总均为账户级，且不保存或推断市场价格。
export const sourceFreshnessNotificationRules = mysqlTable("source_freshness_notification_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceId: varchar("source_id", { length: 16 }).notNull(),
  thresholdDays: int("threshold_days").notNull().default(7),
  isActive: boolean("is_active").notNull().default(true),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  digestMode: mysqlEnum("digest_mode", ["immediate", "daily"]).notNull().default("immediate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("source_freshness_rule_user_source_uq").on(table.userId, table.sourceId)]);

export const sourceFreshnessNotificationEvents = mysqlTable("source_freshness_notification_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  sourceId: varchar("source_id", { length: 16 }).notNull(),
  observationDate: varchar("observation_date", { length: 16 }).notNull(),
  ageDays: int("age_days").notNull(),
  state: mysqlEnum("state", ["stale", "unavailable"]).notNull(),
  deliveryStatus: mysqlEnum("delivery_status", ["immediate", "queued", "delivered"]).notNull().default("immediate"),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("source_freshness_event_user_key_uq").on(table.userId, table.notificationKey)]);

export const sourceFreshnessDigestDeliveries = mysqlTable("source_freshness_digest_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  deliveryKey: varchar("delivery_key", { length: 190 }).notNull(),
  notificationId: int("notification_id").notNull(),
  eventCount: int("event_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("source_freshness_digest_delivery_uq").on(table.ruleId, table.deliveryKey)]);

// SOURCE 共享仅授权既有规则的查看或编辑；批量复制会为接收账户创建可独立维护的规则。
export const sourceFreshnessRuleShares = mysqlTable("source_freshness_rule_shares", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("rule_id").notNull(),
  ownerId: int("owner_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "editor"]).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("source_freshness_rule_share_uq").on(table.ruleId, table.sharedWithUserId)]);

// EIA 季节性差异提醒只基于同周实际库存差值；规则和事件均按账户隔离，不保存市场样本或预测。
export const inventorySeasonalityAlertRules = mysqlTable("inventory_seasonality_alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: varchar("product_id", { length: 16 }).notNull(),
  thresholdKbbL: decimal("threshold_kbbl", { precision: 14, scale: 3 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("inventory_seasonality_rule_user_product_uq").on(table.userId, table.productId)]);

export const inventorySeasonalityAlertEvents = mysqlTable("inventory_seasonality_alert_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  productId: varchar("product_id", { length: 16 }).notNull(),
  observationDate: varchar("observation_date", { length: 16 }).notNull(),
  currentValueKbbL: decimal("current_value_kbbl", { precision: 14, scale: 3 }).notNull(),
  priorYearValueKbbL: decimal("prior_year_value_kbbl", { precision: 14, scale: 3 }).notNull(),
  differenceKbbL: decimal("difference_kbbl", { precision: 14, scale: 3 }).notNull(),
  thresholdKbbL: decimal("threshold_kbbl", { precision: 14, scale: 3 }).notNull(),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("inventory_seasonality_event_user_key_uq").on(table.userId, table.notificationKey), index("inventory_seasonality_event_user_product_date_idx").on(table.userId, table.productId, table.observationDate)]);

// 研究路径仅保存账户级偏好、使用次数与最近一次访问，不持久化公开数据或研究结论。
export const mmResearchPathFavorites = mysqlTable("mm_research_path_favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  fromModuleId: varchar("from_module_id", { length: 32 }).notNull(),
  toModuleId: varchar("to_module_id", { length: 32 }).notNull(),
  usageCount: int("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  isFavorited: boolean("is_favorited").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mm_research_path_favorite_uq").on(table.userId, table.fromModuleId, table.toModuleId)]);

// MMFLOW 仅保存交付包名称和已核验来源标识；实际来源字段始终在导出时从公开目录重新读取。
export const mmflowDeliveryPackages = mysqlTable("mmflow_delivery_packages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sourceIds: json("source_ids").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "changes_requested"]).notNull().default("draft"),
  approvalDeadlineAt: timestamp("approval_deadline_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mmflow_delivery_package_user_name_uq").on(table.userId, table.name)]);

// 每次提交审阅时冻结一份只含来源标识与状态的版本快照，用于受控差异比较。
export const mmflowDeliveryPackageVersions = mysqlTable("mmflow_delivery_package_versions", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  version: int("version").notNull(),
  sourceIds: json("source_ids").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "changes_requested"]).notNull(),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  actorUserId: int("actor_user_id").notNull(),
  note: varchar("note", { length: 500 }),
}, (table) => [uniqueIndex("mmflow_delivery_package_version_uq").on(table.packageId, table.version)]);

// 临近审批截止提醒使用交付包、接收人和截止时点组成幂等键，重设截止时间后才会生成新的提醒。
export const mmflowDeliveryPackageDeadlineNotifications = mysqlTable("mmflow_delivery_package_deadline_notifications", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  userId: int("user_id").notNull(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mmflow_delivery_deadline_notification_uq").on(table.notificationKey)]);

export const mmflowDeliveryPackageShares = mysqlTable("mmflow_delivery_package_shares", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "editor", "reviewer"]).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mmflow_delivery_package_share_uq").on(table.packageId, table.sharedWithUserId)]);

export const mmflowDeliveryPackageReviews = mysqlTable("mmflow_delivery_package_reviews", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  reviewerUserId: int("reviewer_user_id").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "changes_requested"]).notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("mmflow_delivery_package_reviewer_uq").on(table.packageId, table.reviewerUserId)]);

export const mmflowDeliveryPackageAuditEvents = mysqlTable("mmflow_delivery_package_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "submitted", "shared", "share_revoked", "reviewed", "status_changed"]).notNull(),
  targetUserId: int("target_user_id"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Municipal Issuer Evidence Archive and Review ──────────────────────────
// 仅保存官方文件链接、元数据、内容指纹与人工可核验证据片段；完整外部文件不写入数据库。
export const municipalIssuerEvidencePackages = mysqlTable("municipal_issuer_evidence_packages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  issuerName: varchar("issuer_name", { length: 240 }).notNull(),
  issuerIdentifier: varchar("issuer_identifier", { length: 80 }),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "changes_requested"]).notNull().default("draft"),
  approvalDeadlineAt: timestamp("approval_deadline_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_owner_name_uq").on(table.userId, table.name), index("municipal_issuer_evidence_issuer_idx").on(table.issuerName, table.updatedAt)]);

export const municipalIssuerEvidenceDocuments = mysqlTable("municipal_issuer_evidence_documents", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  storageKey: varchar("storage_key", { length: 512 }),
  storageUrl: text("storage_url"),
  uploadedFileName: varchar("uploaded_file_name", { length: 255 }),
  uploadedMimeType: varchar("uploaded_mime_type", { length: 160 }),
  uploadedSizeBytes: int("uploaded_size_bytes"),
  title: varchar("title", { length: 240 }).notNull(),
  sourceInstitution: varchar("source_institution", { length: 160 }).notNull(),
  documentType: mysqlEnum("document_type", ["official_statement", "annual_financial", "operating_disclosure", "event_notice", "rating_material", "other_official"]).notNull(),
  documentDate: date("document_date"),
  documentFingerprint: varchar("document_fingerprint", { length: 64 }).notNull(),
  evidenceExtracts: json("evidence_extracts").$type<Array<{ label: string; quotedText: string; note: string }>>().notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_document_fingerprint_uq").on(table.packageId, table.documentFingerprint), index("municipal_issuer_evidence_document_package_idx").on(table.packageId, table.updatedAt)]);

export const municipalIssuerEvidenceDocumentTags = mysqlTable("municipal_issuer_evidence_document_tags", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  tag: varchar("tag", { length: 80 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_document_tag_uq").on(table.documentId, table.tag), index("municipal_issuer_evidence_tag_document_idx").on(table.tag, table.documentId)]);

// 保存用户在有权访问的证据包中常用的关键词/标签组合；不复制或公开证据内容。
export const municipalIssuerEvidenceSearchPresets = mysqlTable("municipal_issuer_evidence_search_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  packageId: int("package_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  query: varchar("query", { length: 400 }),
  tag: varchar("tag", { length: 80 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_search_preset_uq").on(table.userId, table.packageId, table.name), index("municipal_issuer_evidence_search_preset_idx").on(table.userId, table.packageId, table.updatedAt)]);

// 账户私有地方债研究透镜设置；只保存用户选择的观察窗口和期限桶，不复制市场时间序列。
export const municipalResearchViewPresets = mysqlTable("municipal_research_view_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 20 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  windowSize: int("window_size").notNull(),
  bucketId: varchar("bucket_id", { length: 24 }),
  isDefault: int("is_default").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("municipal_research_view_preset_owner_module_name_uq").on(table.userId, table.moduleId, table.name), index("municipal_research_view_preset_owner_module_idx").on(table.userId, table.moduleId, table.updatedAt)]);

export const municipalIssuerEvidenceShares = mysqlTable("municipal_issuer_evidence_shares", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "editor", "reviewer"]).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_share_uq").on(table.packageId, table.sharedWithUserId)]);

export const municipalIssuerEvidenceVersions = mysqlTable("municipal_issuer_evidence_versions", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  version: int("version").notNull(),
  documentSnapshot: json("document_snapshot").$type<Array<{ id: number; title: string; sourceUrl: string; sourceInstitution: string; documentType: string; documentDate: string | null; documentFingerprint: string }>>().notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "changes_requested"]).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  note: varchar("note", { length: 500 }),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_version_uq").on(table.packageId, table.version)]);

export const municipalIssuerEvidenceReviews = mysqlTable("municipal_issuer_evidence_reviews", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  reviewerUserId: int("reviewer_user_id").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "changes_requested"]).notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("municipal_issuer_evidence_reviewer_uq").on(table.packageId, table.reviewerUserId)]);

export const municipalIssuerEvidenceAuditEvents = mysqlTable("municipal_issuer_evidence_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "document_saved", "document_removed", "shared", "share_revoked", "submitted", "reviewed", "status_changed"]).notNull(),
  targetUserId: int("target_user_id"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("municipal_issuer_evidence_audit_package_idx").on(table.packageId, table.createdAt)]);

// 仅记录真实公开源探测结果。每个来源每小时最多一条，未探测的资料目录来源不写入成功或失败样本。
export const moneyMarketSourceAvailabilitySnapshots = mysqlTable("money_market_source_availability_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: varchar("source_id", { length: 40 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["available", "unavailable"]).notNull(),
  recordCount: int("record_count").notNull().default(0),
  latencyMs: int("latency_ms"),
  sampledAt: timestamp("sampled_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mm_source_availability_source_hour_uq").on(table.sourceId, table.sampledAt)]);

export type MoneyMarketSourceAvailabilitySnapshot = typeof moneyMarketSourceAvailabilitySnapshots.$inferSelect;

// 仅保存实际打开的终端模块和十五分钟归并桶，用于账户自己的使用诊断，不保存输入、行情或研究内容。
export const moneyMarketModuleUsageEvents = mysqlTable("money_market_module_usage_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull(),
  activityBucket: timestamp("activity_bucket").notNull(),
  openedAt: timestamp("opened_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("mm_module_usage_user_module_bucket_uq").on(table.userId, table.moduleId, table.activityBucket)]);

export type MoneyMarketModuleUsageEvent = typeof moneyMarketModuleUsageEvents.$inferSelect;

// ─── Preferred Stock Research Packages ─────────────────────────────────────
// 仅保留用户确认的官方来源定位、文本摘录与追加审计，不存储外部文件全文或未经核验的市场数据。
export const preferredResearchPackages = mysqlTable("preferred_research_packages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  issuerName: varchar("issuer_name", { length: 240 }).notNull(),
  cik: varchar("cik", { length: 10 }),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "changes_requested"]).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("preferred_research_package_owner_name_uq").on(table.userId, table.name), index("preferred_research_package_issuer_idx").on(table.issuerName, table.updatedAt)]);

export const preferredResearchEvidence = mysqlTable("preferred_research_evidence", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  sourceInstitution: varchar("source_institution", { length: 160 }).notNull(),
  documentType: mysqlEnum("document_type", ["prospectus", "annual_report", "quarterly_report", "current_report", "security_registration", "other_official"]).notNull(),
  documentDate: date("document_date"),
  documentFingerprint: varchar("document_fingerprint", { length: 64 }).notNull(),
  evidenceExtracts: json("evidence_extracts").$type<Array<{ label: string; quotedText: string; note: string }>>().notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("preferred_research_evidence_fingerprint_uq").on(table.packageId, table.documentFingerprint), index("preferred_research_evidence_package_idx").on(table.packageId, table.updatedAt)]);

export const preferredResearchAuditEvents = mysqlTable("preferred_research_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("package_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "evidence_saved", "evidence_removed", "submitted", "status_changed"]).notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("preferred_research_audit_package_idx").on(table.packageId, table.createdAt)]);

// 仅保存账户确认导入的结构化优先股条款字段；市场报价、成交、评级和未核验结论不在此表生成。
export const preferredTermImportBatches = mysqlTable("preferred_term_import_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceFilename: varchar("source_filename", { length: 240 }).notNull(),
  totalRows: int("total_rows").notNull(),
  acceptedRows: int("accepted_rows").notNull(),
  rejectedRows: int("rejected_rows").notNull(),
  updatedRows: int("updated_rows").notNull().default(0),
  warningRows: int("warning_rows").notNull().default(0),
  coverageSummary: json("coverage_summary").$type<{ importedRecords: number; coreCoveragePct: number; conditionalCoveragePct: number; recommendedCoveragePct: number; fieldMissingCounts: Record<string, number>; typeSummary: Array<{ dividendType: string; records: number; completeRecords: number }> }>().notNull(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
}, (table) => [index("preferred_term_import_batch_user_idx").on(table.userId, table.importedAt)]);

export const preferredTermRecords = mysqlTable("preferred_term_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  securityIdentifier: varchar("security_identifier", { length: 120 }).notNull(),
  issuerName: varchar("issuer_name", { length: 240 }).notNull(),
  securityName: varchar("security_name", { length: 240 }).notNull(),
  cik: varchar("cik", { length: 10 }),
  dividendType: mysqlEnum("dividend_type", ["fixed", "floating", "fixed_to_float", "other"]).notNull(),
  couponRatePct: decimal("coupon_rate_pct", { precision: 7, scale: 4 }),
  paymentFrequency: mysqlEnum("payment_frequency", ["monthly", "quarterly", "semiannual", "annual", "other"]).notNull(),
  referenceIndex: varchar("reference_index", { length: 120 }),
  spreadBps: int("spread_bps"),
  resetFrequency: mysqlEnum("reset_frequency", ["monthly", "quarterly", "semiannual", "annual", "other"]),
  firstCallDate: date("first_call_date"),
  maturityDate: date("maturity_date"),
  liquidationPreference: decimal("liquidation_preference", { precision: 16, scale: 4 }),
  sourceReference: varchar("source_reference", { length: 240 }),
  asOfDate: date("as_of_date").notNull(),
  sourceBatchId: int("source_batch_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("preferred_term_record_user_identifier_uq").on(table.userId, table.securityIdentifier), index("preferred_term_record_user_type_idx").on(table.userId, table.dividendType, table.asOfDate), index("preferred_term_record_user_issuer_idx").on(table.userId, table.issuerName, table.updatedAt)]);

// 股市工作台布局仅保存当前账户对追加研究卡片的顺序与可见性，不保存原面板状态、行情、申报正文或外部文件。
export const stockResearchLayouts = mysqlTable("stock_research_layouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  workspaceId: varchar("workspace_id", { length: 48 }).notNull().default("stock-research"),
  layout: json("layout").$type<Array<{ id: string; visible: boolean }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("stock_research_layout_user_workspace_uq").on(table.userId, table.workspaceId)]);

// SEC 智能摘要只保存当前账户触发的结构化结果、模型标识和可核验来源指纹；申报全文始终按需读取，不写入数据库。
export const stockSecSummaryAudits = mysqlTable("stock_sec_summary_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  cik: varchar("cik", { length: 10 }).notNull(),
  accessionNumber: varchar("accession_number", { length: 32 }).notNull(),
  primaryDocument: varchar("primary_document", { length: 240 }).notNull(),
  sourceFingerprint: varchar("source_fingerprint", { length: 64 }).notNull(),
  model: varchar("model", { length: 80 }).notNull(),
  summary: json("summary").$type<{ headline: string; headlineEvidence: string; keyPoints: Array<{ point: string; evidence: string }>; financialFacts: Array<{ label: string; period: string; value: string; evidence: string }>; riskAlerts: Array<{ category: string; evidence: string }>; sourceLimitations: string }>().notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("stock_sec_summary_audit_user_source_uq").on(table.userId, table.cik, table.accessionNumber, table.primaryDocument, table.sourceFingerprint), index("stock_sec_summary_audit_user_created_idx").on(table.userId, table.createdAt)]);

// 股市研究偏好仅保存当前账户主动选择的追加筛选项，不保存 SEC 原文、外部行情或原面板状态。
export const stockResearchPreferences = mysqlTable("stock_research_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  preferenceKey: varchar("preference_key", { length: 64 }).notNull(),
  preferenceValue: json("preference_value").$type<{ forms: string[] }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("stock_research_preference_user_key_uq").on(table.userId, table.preferenceKey)]);

// FSRC 只保存用户主动维护的代码清单与最近一次服务器读取的轻量覆盖快照，绝不保存价格序列或原始行情响应。
export const stockFsrcWatchlists = mysqlTable("stock_fsrc_watchlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  tickers: json("tickers").$type<string[]>().notNull(),
  coverageSnapshot: json("coverage_snapshot").$type<Array<{ ticker: string; status: 'available' | 'unavailable'; points: number; latestDate: string | null }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("stock_fsrc_watchlist_user_uq").on(table.userId), index("stock_fsrc_watchlist_user_updated_idx").on(table.userId, table.updatedAt)]);

// 分组为账户自定义的轻量管理维度，仅保存名称与色彩标识，不含行情或交易数据。
export const commodityWatchlistGroups = mysqlTable("commodity_watchlist_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default('amber'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("commodity_watchlist_group_user_name_uq").on(table.userId, table.name), index("commodity_watchlist_group_user_updated_idx").on(table.userId, table.updatedAt)]);

// 商品观察组合只保存账户主动选择的公开序列、提醒阈值、分组、标签与上次核验快照；不保存行情原始响应、仓位或交易资料。
export const commodityWatchlists = mysqlTable("commodity_watchlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  groupId: int("group_id"),
  tags: json("tags").$type<string[]>(),
  seriesIds: json("series_ids").$type<string[]>().notNull(),
  alertThresholdPercent: decimal("alert_threshold_percent", { precision: 8, scale: 3 }).notNull().default('0.000'),
  isActive: boolean("is_active").notNull().default(true),
  latestSnapshot: json("latest_snapshot").$type<Array<{ id: string; label: string; status: 'available' | 'unavailable'; observationDate: string | null; latest: number | null }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("commodity_watchlist_user_name_uq").on(table.userId, table.name), index("commodity_watchlist_user_updated_idx").on(table.userId, table.updatedAt), index("commodity_watchlist_user_group_idx").on(table.userId, table.groupId)]);

// 每个账户组合的变动提醒以稳定键去重；通知内容仍写入共享通知中心以获得既有 SSE 推送。
export const commodityWatchlistAlertEvents = mysqlTable("commodity_watchlist_alert_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  watchlistId: int("watchlist_id").notNull(),
  notificationKey: varchar("notification_key", { length: 190 }).notNull(),
  changes: json("changes").$type<Array<{ id: string; label: string; previousDate: string | null; currentDate: string | null; previousValue: number | null; currentValue: number | null; changePercent: number | null }>>().notNull(),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("commodity_watchlist_alert_user_key_uq").on(table.userId, table.notificationKey), index("commodity_watchlist_alert_watchlist_created_idx").on(table.watchlistId, table.createdAt)]);

// 指数篮子仅保存账户主动输入的代码、名称与权重；不保存原始行情响应、指数成分全量快照、仓位或交易资料。
export const indexResearchBaskets = mysqlTable("index_research_baskets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  moduleId: varchar("module_id", { length: 32 }).notNull().default('CIXB'),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 1000 }),
  components: json("components").$type<Array<{ ticker: string; name: string; weight: number }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("index_research_basket_owner_name_uq").on(table.userId, table.name), index("index_research_basket_owner_updated_idx").on(table.userId, table.updatedAt)]);

export const indexResearchBasketShares = mysqlTable("index_research_basket_shares", {
  id: int("id").autoincrement().primaryKey(),
  basketId: int("basket_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "editor"]).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("index_research_basket_share_uq").on(table.basketId, table.sharedWithUserId)]);

export const indexResearchBasketAuditEvents = mysqlTable("index_research_basket_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  basketId: int("basket_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "updated", "shared", "share_revoked"]).notNull(),
  targetUserId: int("target_user_id"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("index_research_basket_audit_idx").on(table.basketId, table.createdAt)]);

// 只保存服务端实际读取并解析成功的官方公开指数调整公告字段与来源指纹；不可读、不可解析或未授权资料不生成归档样本。
export const indexConstituentArchiveEvents = mysqlTable("index_constituent_archive_events", {
  id: int("id").autoincrement().primaryKey(),
  sourceFingerprint: varchar("source_fingerprint", { length: 64 }).notNull(),
  sourceInstitution: varchar("source_institution", { length: 160 }).notNull(),
  sourceUrl: varchar("source_url", { length: 1000 }).notNull(),
  indexId: varchar("index_id", { length: 64 }).notNull(),
  headline: varchar("headline", { length: 320 }).notNull(),
  announcementDate: date("announcement_date"),
  effectiveDate: date("effective_date"),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  added: json("added").$type<Array<{ ticker: string; name: string }>>().notNull(),
  removed: json("removed").$type<Array<{ ticker: string; name: string }>>().notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("index_constituent_archive_source_uq").on(table.sourceFingerprint), index("index_constituent_archive_index_date_idx").on(table.indexId, table.announcementDate)]);

// 官方权重表导入只保存用户确认的结构化权重、表格日期、来源元数据与内容指纹；原始 CSV 文件字节不写入数据库。
export const indexOfficialWeightImportBatches = mysqlTable("index_official_weight_import_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  indexId: varchar("index_id", { length: 64 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  sourceUrl: varchar("source_url", { length: 1000 }).notNull(),
  sourceDate: date("source_date").notNull(),
  sourceFilename: varchar("source_filename", { length: 240 }).notNull(),
  rowCount: int("row_count").notNull(),
  totalWeightPct: decimal("total_weight_pct", { precision: 9, scale: 4 }).notNull(),
  contentFingerprint: varchar("content_fingerprint", { length: 64 }).notNull(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("index_official_weight_import_user_fingerprint_uq").on(table.userId, table.contentFingerprint), index("index_official_weight_import_user_index_date_idx").on(table.userId, table.indexId, table.sourceDate)]);

export const indexOfficialWeightImportRows = mysqlTable("index_official_weight_import_rows", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batch_id").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  name: varchar("name", { length: 240 }).notNull(),
  weightPct: decimal("weight_pct", { precision: 9, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("index_official_weight_row_batch_ticker_uq").on(table.batchId, table.ticker), index("index_official_weight_row_ticker_idx").on(table.ticker)]);

export const indexOfficialWeightImportAuditEvents = mysqlTable("index_official_weight_import_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batch_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["imported"]).notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("index_official_weight_import_audit_batch_idx").on(table.batchId, table.createdAt)]);

// 外汇央行决议归档仅保存服务端从官方公告实际解析的轻量字段、来源 URL 与稳定指纹；不存储完整公告正文、市场预期或交易结论。
export const forexCentralBankDecisionEvents = mysqlTable("forex_central_bank_decision_events", {
  id: int("id").autoincrement().primaryKey(),
  sourceFingerprint: varchar("source_fingerprint", { length: 64 }).notNull(),
  centralBankId: varchar("central_bank_id", { length: 24 }).notNull(),
  centralBankName: varchar("central_bank_name", { length: 160 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull(),
  decisionDate: date("decision_date").notNull(),
  publishedAt: timestamp("published_at"),
  effectiveDate: date("effective_date"),
  decision: varchar("decision", { length: 48 }).notNull(),
  changeBps: int("change_bps"),
  policyRates: json("policy_rates").$type<Array<{ key: string; label: string; ratePct: number; minRatePct?: number; maxRatePct?: number }>>().notNull(),
  voteSummary: varchar("vote_summary", { length: 240 }),
  officialSummary: text("official_summary").notNull(),
  sourceUrl: varchar("source_url", { length: 1000 }).notNull(),
  retrievedAt: timestamp("retrieved_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("forex_cb_decision_source_uq").on(table.sourceFingerprint), index("forex_cb_decision_bank_date_idx").on(table.centralBankId, table.decisionDate)]);

// 外汇时效规则属于账户私有配置；它不保存行情、报价或通知样例，仅保存用户对公开序列观察延迟的可视化阈值。
export const forexFreshnessAlertRules = mysqlTable("forex_freshness_alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  seriesId: varchar("series_id", { length: 32 }).notNull(),
  thresholdHours: int("threshold_hours").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("forex_freshness_rule_user_series_uq").on(table.userId, table.seriesId), index("forex_freshness_rule_user_active_idx").on(table.userId, table.isActive)]);

// 同日决议时间轴预设属于账户私有研究偏好；仅保存名称和筛选条件，不保存行情、事件副本或任何模拟资料。
export const forexSameDayTimelinePresets = mysqlTable("forex_same_day_timeline_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  centralBankIds: text("central_bank_ids").notNull(),
  pairIds: text("pair_ids").notNull(),
  actions: text("actions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("forex_same_day_preset_user_name_uq").on(table.userId, table.name), index("forex_same_day_preset_user_updated_idx").on(table.userId, table.updatedAt)]);

// 衍生品 OAS/VIX 日期预设属于账户私有研究偏好；仅保存名称和两个实际观察区间，不保存序列、比较结果或推导结论。
export const derivativesOasVixDatePresets = mysqlTable("derivatives_oas_vix_date_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  rangeAStart: varchar("range_a_start", { length: 10 }).notNull(),
  rangeAEnd: varchar("range_a_end", { length: 10 }).notNull(),
  rangeBStart: varchar("range_b_start", { length: 10 }).notNull(),
  rangeBEnd: varchar("range_b_end", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("derivatives_oas_vix_preset_user_name_uq").on(table.userId, table.name), index("derivatives_oas_vix_preset_user_updated_idx").on(table.userId, table.updatedAt)]);

// 通讯深化层只保存账户实际创建的研究分派、成员授权、正文与审计轨迹；原始本地演示消息、联系人和社区卡片保持独立且不迁移。
export const commsResearchThreads = mysqlTable("comms_research_threads", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  purpose: mysqlEnum("purpose", ["brief", "question", "handoff", "decision"]).notNull(),
  moduleCode: varchar("module_code", { length: 32 }).notNull().default("COMMS"),
  classification: mysqlEnum("classification", ["internal", "restricted"]).notNull().default("internal"),
  status: mysqlEnum("status", ["open", "acknowledged", "resolved"]).notNull().default("open"),
  dueAt: timestamp("due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("comms_thread_owner_status_updated_idx").on(table.ownerUserId, table.status, table.updatedAt), index("comms_thread_due_idx").on(table.dueAt)]);

export const commsResearchThreadMembers = mysqlTable("comms_research_thread_members", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("thread_id").notNull(),
  userId: int("user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "contributor"]).notNull().default("contributor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("comms_thread_member_uq").on(table.threadId, table.userId), index("comms_thread_member_user_idx").on(table.userId, table.threadId)]);

export const commsResearchThreadMessages = mysqlTable("comms_research_thread_messages", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("thread_id").notNull(),
  authorUserId: int("author_user_id").notNull(),
  body: text("body").notNull(),
  messageType: mysqlEnum("message_type", ["note", "question", "decision"]).notNull().default("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("comms_thread_message_thread_created_idx").on(table.threadId, table.createdAt)]);

export const commsResearchThreadAuditEvents = mysqlTable("comms_research_thread_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("thread_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["created", "member_added", "message_posted", "acknowledged", "resolved"]).notNull(),
  targetUserId: int("target_user_id"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("comms_thread_audit_thread_created_idx").on(table.threadId, table.createdAt)]);

// 研究分派到期提醒只面向分派创建者的账户内通知；事件按稳定键去重，已解决或无到期日的分派不产生事件。
export const commsResearchReminderRules = mysqlTable("comms_research_reminder_rules", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("thread_id").notNull(),
  ownerUserId: int("owner_user_id").notNull(),
  leadHours: int("lead_hours").notNull().default(24),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("comms_reminder_rule_thread_owner_uq").on(table.threadId, table.ownerUserId), index("comms_reminder_rule_owner_active_idx").on(table.ownerUserId, table.isActive)]);

export const commsResearchReminderEvents = mysqlTable("comms_research_reminder_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 220 }).notNull(),
  ruleId: int("rule_id").notNull(),
  threadId: int("thread_id").notNull(),
  userId: int("user_id").notNull(),
  dueAt: timestamp("due_at").notNull(),
  leadHours: int("lead_hours").notNull(),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("comms_reminder_event_key_uq").on(table.notificationKey), index("comms_reminder_event_user_created_idx").on(table.userId, table.createdAt), index("comms_reminder_event_thread_idx").on(table.threadId)]);

// 分派闭环版本独立于消息流保存：创建者提交摘要，已授权成员仅能确认或要求修改，并保留每次实际审阅决定。
export const commsResearchThreadVersions = mysqlTable("comms_research_thread_versions", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("thread_id").notNull(),
  ownerUserId: int("owner_user_id").notNull(),
  version: int("version").notNull(),
  summary: text("summary").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "changes_requested"]).notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("comms_thread_version_uq").on(table.threadId, table.version), index("comms_thread_version_owner_status_idx").on(table.ownerUserId, table.status, table.updatedAt)]);

export const commsResearchThreadVersionReviews = mysqlTable("comms_research_thread_version_reviews", {
  id: int("id").autoincrement().primaryKey(),
  versionId: int("version_id").notNull(),
  reviewerUserId: int("reviewer_user_id").notNull(),
  decision: mysqlEnum("decision", ["approved", "changes_requested"]).notNull(),
  note: varchar("note", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("comms_version_reviewer_uq").on(table.versionId, table.reviewerUserId), index("comms_version_review_version_created_idx").on(table.versionId, table.createdAt)]);

// 新闻研究追加层仅保存账户主动归档的官方来源元数据、受限长度证据摘录与研究状态；原新闻页面的演示内容、订阅源和阅读指标保持独立且不迁移。
export const newsResearchEvidenceCards = mysqlTable("news_research_evidence_cards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceKind: mysqlEnum("source_kind", ["sec_press", "fed_monetary", "fed_research", "sec_filing"]).notNull(),
  sourceId: varchar("source_id", { length: 320 }).notNull(),
  institution: varchar("institution", { length: 180 }).notNull(),
  headline: varchar("headline", { length: 600 }).notNull(),
  publishedAt: timestamp("published_at"),
  sourceUrl: varchar("source_url", { length: 1200 }).notNull(),
  excerpt: text("excerpt"),
  status: mysqlEnum("status", ["captured", "reading", "verified", "closed"]).notNull().default("captured"),
  researchNote: text("research_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("news_evidence_user_source_uq").on(table.userId, table.sourceKind, table.sourceId), index("news_evidence_user_status_updated_idx").on(table.userId, table.status, table.updatedAt), index("news_evidence_published_idx").on(table.publishedAt)]);

export const newsResearchEvidenceAuditEvents = mysqlTable("news_research_evidence_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("card_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["captured", "status_updated", "note_updated", "member_added", "member_removed", "review_submitted", "review_approved", "review_changes_requested"]).notNull(),
  note: varchar("note", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("news_evidence_audit_card_created_idx").on(table.cardId, table.createdAt)]);

// 官方来源时效规则仅以最近实际可读取的官方发布日期或不可读取状态判定；规则和事件均为账户私有。
export const newsResearchSourceFreshnessRules = mysqlTable("news_research_source_freshness_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceKind: mysqlEnum("source_kind", ["sec_press", "fed_monetary", "fed_research"]).notNull(),
  thresholdHours: int("threshold_hours").notNull().default(72),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("news_source_freshness_rule_user_source_uq").on(table.userId, table.sourceKind), index("news_source_freshness_rule_user_active_idx").on(table.userId, table.isActive)]);

export const newsResearchSourceFreshnessEvents = mysqlTable("news_research_source_freshness_events", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notification_key", { length: 220 }).notNull(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  sourceKind: mysqlEnum("source_kind", ["sec_press", "fed_monetary", "fed_research"]).notNull(),
  latestPublishedAt: timestamp("latest_published_at"),
  retrievedAt: timestamp("retrieved_at").notNull(),
  ageHours: int("age_hours"),
  state: mysqlEnum("state", ["stale", "unavailable"]).notNull(),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("news_source_freshness_event_user_key_uq").on(table.userId, table.notificationKey), index("news_source_freshness_event_user_created_idx").on(table.userId, table.createdAt), index("news_source_freshness_event_rule_created_idx").on(table.ruleId, table.createdAt)]);

// 证据卡团队授权与审阅闭环独立保存；原卡片的官方来源元数据和既有阅读状态不被替换。
export const newsResearchEvidenceShares = mysqlTable("news_research_evidence_shares", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("card_id").notNull(),
  ownerUserId: int("owner_user_id").notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  permission: mysqlEnum("permission", ["viewer", "editor", "reviewer"]).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("news_evidence_share_card_member_uq").on(table.cardId, table.sharedWithUserId), index("news_evidence_share_member_idx").on(table.sharedWithUserId, table.updatedAt), index("news_evidence_share_owner_idx").on(table.ownerUserId, table.cardId)]);

export const newsResearchEvidenceReviewSubmissions = mysqlTable("news_research_evidence_review_submissions", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("card_id").notNull(),
  ownerUserId: int("owner_user_id").notNull(),
  version: int("version").notNull(),
  summary: text("summary").notNull(),
  status: mysqlEnum("status", ["submitted", "approved", "changes_requested"]).notNull().default("submitted"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("news_evidence_submission_card_version_uq").on(table.cardId, table.version), index("news_evidence_submission_owner_status_idx").on(table.ownerUserId, table.status, table.updatedAt)]);

export const newsResearchEvidenceReviews = mysqlTable("news_research_evidence_reviews", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submission_id").notNull(),
  reviewerUserId: int("reviewer_user_id").notNull(),
  decision: mysqlEnum("decision", ["approved", "changes_requested"]).notNull(),
  note: varchar("note", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("news_evidence_review_submission_reviewer_uq").on(table.submissionId, table.reviewerUserId), index("news_evidence_review_submission_idx").on(table.submissionId, table.createdAt)]);

// 遗留行情字段遮蔽授权仅保存账户申请与管理员决定；不复制、修改或持久化原页面展示数值。
export const legacyFieldAccessGrants = mysqlTable("legacy_field_access_grants", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceId: varchar("source_id", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["requested", "authorized", "denied"]).notNull().default("requested"),
  reason: varchar("reason", { length: 500 }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
  decidedByUserId: int("decided_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("legacy_field_access_user_source_uq").on(table.userId, table.sourceId), index("legacy_field_access_status_requested_idx").on(table.status, table.requestedAt), index("legacy_field_access_user_updated_idx").on(table.userId, table.updatedAt)]);

// 跨模块研究路径的收藏与成员共享只记录账户偏好和权限，不修改预定义路径步骤或深链内容。
export const crossModuleResearchPathFavorites = mysqlTable("cross_module_research_path_favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  pathId: varchar("path_id", { length: 96 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cross_path_favorite_user_path_uq").on(table.userId, table.pathId), index("cross_path_favorite_user_updated_idx").on(table.userId, table.updatedAt)]);

export const crossModuleResearchPathShares = mysqlTable("cross_module_research_path_shares", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id").notNull(),
  pathId: varchar("path_id", { length: 96 }).notNull(),
  sharedWithUserId: int("shared_with_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cross_path_share_owner_path_member_uq").on(table.ownerUserId, table.pathId, table.sharedWithUserId), index("cross_path_share_member_updated_idx").on(table.sharedWithUserId, table.updatedAt), index("cross_path_share_owner_path_idx").on(table.ownerUserId, table.pathId)]);

// 授权审计事件追加记录申请、管理员决定与导出行为，作为授权表的不可替代时间线。
export const legacyFieldAccessAuditEvents = mysqlTable("legacy_field_access_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  grantId: int("grant_id").notNull(),
  subjectUserId: int("subject_user_id").notNull(),
  actorUserId: int("actor_user_id").notNull(),
  action: mysqlEnum("action", ["requested", "authorized", "denied", "exported"]).notNull(),
  sourceId: varchar("source_id", { length: 64 }).notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("legacy_field_access_audit_subject_created_idx").on(table.subjectUserId, table.createdAt), index("legacy_field_access_audit_actor_created_idx").on(table.actorUserId, table.createdAt), index("legacy_field_access_audit_grant_created_idx").on(table.grantId, table.createdAt)]);

// 路径协作备注属于路径创建者与被授予成员的固定协作组，不修改任何路径步骤、深链或数据权限。
export const crossModuleResearchPathNotes = mysqlTable("cross_module_research_path_notes", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("owner_user_id").notNull(),
  pathId: varchar("path_id", { length: 96 }).notNull(),
  authorUserId: int("author_user_id").notNull(),
  body: varchar("body", { length: 2000 }).notNull(),
  reviewStatus: mysqlEnum("review_status", ["pending", "confirmed", "changes_requested"]).notNull().default("pending"),
  reviewNote: varchar("review_note", { length: 1000 }),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("cross_path_note_owner_path_created_idx").on(table.ownerUserId, table.pathId, table.createdAt), index("cross_path_note_author_updated_idx").on(table.authorUserId, table.updatedAt), index("cross_path_note_review_status_idx").on(table.ownerUserId, table.reviewStatus, table.updatedAt)]);

// 经济日历追加层的提醒和筛选偏好均为账户私有，不替代官方读数或原日历内容。
export const economicCalendarAnomalyRules = mysqlTable("economic_calendar_anomaly_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  seriesId: varchar("series_id", { length: 96 }).notNull(),
  threshold: decimal("threshold", { precision: 20, scale: 6 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("economic_calendar_anomaly_rule_user_series_uq").on(table.userId, table.seriesId), index("economic_calendar_anomaly_rule_active_series_idx").on(table.isActive, table.seriesId)]);

export const economicCalendarAnomalyEvents = mysqlTable("economic_calendar_anomaly_events", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  seriesId: varchar("series_id", { length: 96 }).notNull(),
  observationDate: varchar("observation_date", { length: 16 }).notNull(),
  currentValue: decimal("current_value", { precision: 24, scale: 6 }).notNull(),
  previousValue: decimal("previous_value", { precision: 24, scale: 6 }).notNull(),
  changeValue: decimal("change_value", { precision: 24, scale: 6 }).notNull(),
  threshold: decimal("threshold", { precision: 20, scale: 6 }).notNull(),
  notificationKey: varchar("notification_key", { length: 255 }).notNull(),
  notificationId: int("notification_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("economic_calendar_anomaly_event_notification_uq").on(table.userId, table.notificationKey), index("economic_calendar_anomaly_event_user_created_idx").on(table.userId, table.createdAt), index("economic_calendar_anomaly_event_rule_date_idx").on(table.ruleId, table.observationDate)]);

// 风险事件处置只引用当前账户已生成的实际阈值事件；状态和受限长度的处置说明不改写原始观察快照。
export const portfolioRiskEventActions = mysqlTable("portfolio_risk_event_actions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceEventId: int("source_event_id").notNull(),
  status: mysqlEnum("status", ["open", "reviewing", "resolved"]).notNull().default("open"),
  note: varchar("note", { length: 800 }),
  handledByUserId: int("handled_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("portfolio_risk_event_action_user_event_uq").on(table.userId, table.sourceEventId), index("portfolio_risk_event_action_user_status_updated_idx").on(table.userId, table.status, table.updatedAt)]);

export type PortfolioRiskEventAction = typeof portfolioRiskEventActions.$inferSelect;

// 每次风险事件状态变更均追加写入，不以当前处置状态覆盖历史记录。
export const portfolioRiskEventActionAudits = mysqlTable("portfolio_risk_event_action_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceEventId: int("source_event_id").notNull(),
  previousStatus: mysqlEnum("previous_status", ["open", "reviewing", "resolved"]),
  status: mysqlEnum("status", ["open", "reviewing", "resolved"]).notNull(),
  note: varchar("note", { length: 800 }),
  handledByUserId: int("handled_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("portfolio_risk_audit_user_event_created_idx").on(table.userId, table.sourceEventId, table.createdAt),
  index("portfolio_risk_audit_user_status_created_idx").on(table.userId, table.status, table.createdAt),
]);

export type PortfolioRiskEventActionAudit = typeof portfolioRiskEventActionAudits.$inferSelect;

// 组合风险深化层仅保存账户主动配置的限额与从其私有情景快照导出的计算结果；不保存原始 CSV 文件或替代持仓。
export const portfolioRiskGuardrails = mysqlTable("portfolio_risk_guardrails", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  maxPortfolioDuration: decimal("max_portfolio_duration", { precision: 18, scale: 6 }),
  maxDv01: decimal("max_dv01", { precision: 24, scale: 6 }),
  maxScenarioLoss: decimal("max_scenario_loss", { precision: 24, scale: 6 }),
  alertThresholdPct: int("alert_threshold_pct").notNull().default(80),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("portfolio_risk_guardrail_user_name_uq").on(table.userId, table.name), index("portfolio_risk_guardrail_user_active_idx").on(table.userId, table.isActive, table.updatedAt)]);

// 限额版本审计只保存当前账户提交的限额快照和变更类型，不记录原始持仓、成交或外部授权凭据。
export const portfolioRiskGuardrailVersions = mysqlTable("portfolio_risk_guardrail_versions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  guardrailId: int("guardrail_id").notNull(),
  versionNumber: int("version_number").notNull(),
  changeType: mysqlEnum("change_type", ["created", "updated", "deleted"]).notNull(),
  previousState: json("previous_state"),
  currentState: json("current_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("portfolio_risk_guardrail_version_uq").on(table.userId, table.guardrailId, table.versionNumber), index("portfolio_risk_guardrail_version_user_created_idx").on(table.userId, table.createdAt), index("portfolio_risk_guardrail_version_user_guardrail_idx").on(table.userId, table.guardrailId, table.createdAt)]);

export const portfolioRiskResearchDossiers = mysqlTable("portfolio_risk_research_dossiers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  snapshotId: int("snapshot_id").notNull(),
  guardrailId: int("guardrail_id"),
  scenario: mysqlEnum("scenario", ["parallel", "steepener", "butterfly"]).notNull(),
  magnitudeBp: int("magnitude_bp").notNull(),
  totalMarketValue: decimal("total_market_value", { precision: 24, scale: 6 }).notNull(),
  totalDv01: decimal("total_dv01", { precision: 24, scale: 6 }).notNull(),
  portfolioDuration: decimal("portfolio_duration", { precision: 18, scale: 6 }).notNull(),
  estimatedPnl: decimal("estimated_pnl", { precision: 24, scale: 6 }).notNull(),
  breaches: json("breaches").notNull(),
  sourceSummary: json("source_summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("portfolio_risk_dossier_user_created_idx").on(table.userId, table.createdAt), index("portfolio_risk_dossier_user_snapshot_idx").on(table.userId, table.snapshotId), index("portfolio_risk_dossier_user_guardrail_idx").on(table.userId, table.guardrailId)]);

export type PortfolioRiskGuardrail = typeof portfolioRiskGuardrails.$inferSelect;
export type PortfolioRiskGuardrailVersion = typeof portfolioRiskGuardrailVersions.$inferSelect;
export type PortfolioRiskResearchDossier = typeof portfolioRiskResearchDossiers.$inferSelect;

// OAS 视图配置仅保存当前账户选择的评级桶和观察窗口，不保存或复制市场历史数据。
export const portfolioRiskOasViewPresets = mysqlTable("portfolio_risk_oas_view_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  selectedBuckets: json("selected_buckets").notNull(),
  startDate: varchar("start_date", { length: 16 }),
  endDate: varchar("end_date", { length: 16 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("portfolio_risk_oas_view_preset_user_name_uq").on(table.userId, table.name), index("portfolio_risk_oas_view_preset_user_updated_idx").on(table.userId, table.updatedAt)]);

export type PortfolioRiskOasViewPreset = typeof portfolioRiskOasViewPresets.$inferSelect;

export const economicCalendarRegionPresets = mysqlTable("economic_calendar_region_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  region: mysqlEnum("region", ["all", "us", "eurozone", "eu", "japan", "uk"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("economic_calendar_region_preset_user_name_uq").on(table.userId, table.name), index("economic_calendar_region_preset_user_updated_idx").on(table.userId, table.updatedAt)]);

export const economicTrendWindowPresets = mysqlTable("economic_trend_window_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  region: mysqlEnum("region", ["japan", "uk"]).notNull(),
  topic: mysqlEnum("topic", ["all", "japan-cpi-money", "uk-pay", "uk-labor", "uk-activity"]).notNull().default("all"),
  startDate: varchar("start_date", { length: 16 }).notNull(),
  endDate: varchar("end_date", { length: 16 }).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("economic_trend_window_preset_user_name_uq").on(table.userId, table.name), index("economic_trend_window_preset_user_updated_idx").on(table.userId, table.updatedAt), index("economic_trend_window_preset_user_region_idx").on(table.userId, table.region), index("economic_trend_window_preset_user_last_used_idx").on(table.userId, table.lastUsedAt)]);

// 交易委托管理深化层只保存账户主动导入的规范化事件与批次元数据；不保存原始文件、券商凭据或外部行情字节。
export const orderManagementResearchBatches = mysqlTable("order_management_research_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  asOfAt: timestamp("as_of_at").notNull(),
  recordCount: int("record_count").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("order_management_batch_user_created_idx").on(table.userId, table.createdAt)]);

export const orderManagementResearchBatchTags = mysqlTable("order_management_research_batch_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  tag: varchar("tag", { length: 60 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("order_management_batch_tag_uq").on(table.userId, table.batchId, table.tag), index("order_management_batch_tag_user_tag_idx").on(table.userId, table.tag), index("order_management_batch_tag_user_batch_idx").on(table.userId, table.batchId)]);

export const orderManagementOrderReviews = mysqlTable("order_management_order_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  orderId: varchar("order_id", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("order_management_review_uq").on(table.userId, table.batchId, table.orderId), index("order_management_review_user_batch_idx").on(table.userId, table.batchId)]);

export const orderManagementOrderReviewAudits = mysqlTable("order_management_order_review_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  orderId: varchar("order_id", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  note: text("note"),
  action: varchar("action", { length: 24 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("order_management_review_audit_user_batch_order_idx").on(table.userId, table.batchId, table.orderId, table.createdAt)]);

export const orderManagementDeviationAlertSettings = mysqlTable("order_management_deviation_alert_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  thresholdBps: decimal("threshold_bps", { precision: 10, scale: 2 }).notNull().default("25.00"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("order_management_deviation_alert_user_uq").on(table.userId)]);

export const orderManagementArchiveRules = mysqlTable("order_management_archive_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  conditionType: varchar("condition_type", { length: 32 }).notNull(),
  ageDays: int("age_days"),
  cronExpression: varchar("cron_expression", { length: 64 }).notNull().default("0 0 2 * * *"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  lastRunAt: timestamp("last_run_at"),
  lastRunArchivedCount: int("last_run_archived_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("order_management_archive_rule_user_idx").on(table.userId, table.createdAt), index("order_management_archive_rule_task_uid_idx").on(table.scheduleCronTaskUid)]);

export const orderManagementResearchEvents = mysqlTable("order_management_research_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  eventId: varchar("event_id", { length: 120 }).notNull(),
  orderId: varchar("order_id", { length: 120 }).notNull(),
  parentOrderId: varchar("parent_order_id", { length: 120 }),
  eventType: mysqlEnum("event_type", ["new", "route", "modify", "cancel", "partial_fill", "fill", "reject"]).notNull(),
  instrument: varchar("instrument", { length: 120 }).notNull(),
  assetClass: varchar("asset_class", { length: 80 }),
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  orderQty: decimal("order_qty", { precision: 24, scale: 6 }),
  eventQty: decimal("event_qty", { precision: 24, scale: 6 }),
  limitPrice: decimal("limit_price", { precision: 24, scale: 8 }),
  executionPrice: decimal("execution_price", { precision: 24, scale: 8 }),
  venue: varchar("venue", { length: 120 }),
  broker: varchar("broker", { length: 120 }),
  eventAt: timestamp("event_at").notNull(),
  eventPayload: json("event_payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("order_management_event_user_batch_event_uq").on(table.userId, table.batchId, table.eventId), index("order_management_event_user_batch_time_idx").on(table.userId, table.batchId, table.eventAt), index("order_management_event_user_batch_order_idx").on(table.userId, table.batchId, table.orderId)]);

export const electronicTradingResearchBatches = mysqlTable("electronic_trading_research_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  asOfAt: timestamp("as_of_at").notNull(),
  recordCount: int("record_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("electronic_trading_batch_user_created_idx").on(table.userId, table.createdAt)]);

export const electronicTradingResearchEvents = mysqlTable("electronic_trading_research_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  eventId: varchar("event_id", { length: 120 }).notNull(),
  orderId: varchar("order_id", { length: 120 }).notNull(),
  eventType: mysqlEnum("event_type", ["new", "route", "modify", "cancel", "partial_fill", "fill", "reject"]).notNull(),
  instrument: varchar("instrument", { length: 120 }).notNull(),
  assetClass: varchar("asset_class", { length: 80 }),
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  orderQty: decimal("order_qty", { precision: 24, scale: 6 }),
  eventQty: decimal("event_qty", { precision: 24, scale: 6 }),
  referencePrice: decimal("reference_price", { precision: 24, scale: 8 }),
  executionPrice: decimal("execution_price", { precision: 24, scale: 8 }),
  venue: varchar("venue", { length: 120 }),
  broker: varchar("broker", { length: 120 }),
  strategyLabel: varchar("strategy_label", { length: 120 }),
  routeId: varchar("route_id", { length: 120 }),
  eventAt: timestamp("event_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("electronic_trading_event_user_batch_event_uq").on(table.userId, table.batchId, table.eventId), index("electronic_trading_event_user_batch_time_idx").on(table.userId, table.batchId, table.eventAt), index("electronic_trading_event_user_batch_order_idx").on(table.userId, table.batchId, table.orderId)]);

export const electronicTradingExecutionReviews = mysqlTable("electronic_trading_execution_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  orderId: varchar("order_id", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("electronic_trading_review_user_batch_order_uq").on(table.userId, table.batchId, table.orderId), index("electronic_trading_review_user_batch_idx").on(table.userId, table.batchId)]);

export const electronicTradingExecutionReviewAudits = mysqlTable("electronic_trading_execution_review_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  orderId: varchar("order_id", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  note: text("note"),
  action: varchar("action", { length: 24 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("electronic_trading_review_audit_user_batch_order_idx").on(table.userId, table.batchId, table.orderId, table.createdAt)]);

export const electronicTradingQualitySettings = mysqlTable("electronic_trading_quality_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  adverseDeviationThresholdBps: decimal("adverse_deviation_threshold_bps", { precision: 10, scale: 2 }).notNull().default("25.00"),
  latencyThresholdSeconds: int("latency_threshold_seconds").notNull().default(300),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("electronic_trading_quality_settings_user_uq").on(table.userId)]);

export const stpPrivateBatches = mysqlTable("stp_private_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  asOfAt: timestamp("as_of_at").notNull(),
  recordCount: int("record_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("stp_private_batch_user_created_idx").on(table.userId, table.createdAt)]);

export const stpPrivateEvents = mysqlTable("stp_private_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  eventId: varchar("event_id", { length: 120 }).notNull(),
  instructionId: varchar("instruction_id", { length: 120 }).notNull(),
  tradeId: varchar("trade_id", { length: 120 }),
  eventType: mysqlEnum("event_type", ["received", "enriched", "validated", "matched", "confirmed", "settled", "exception", "rejected", "cancelled"]).notNull(),
  processingStage: mysqlEnum("processing_stage", ["capture", "enrichment", "validation", "matching", "confirmation", "settlement"]).notNull(),
  outcome: mysqlEnum("outcome", ["success", "pending", "failure"]).notNull(),
  instrument: varchar("instrument", { length: 120 }).notNull(),
  assetClass: varchar("asset_class", { length: 80 }),
  side: mysqlEnum("side", ["buy", "sell"]),
  quantity: decimal("quantity", { precision: 24, scale: 6 }),
  amount: decimal("amount", { precision: 24, scale: 6 }),
  currency: varchar("currency", { length: 12 }),
  counterparty: varchar("counterparty", { length: 160 }),
  failureCode: varchar("failure_code", { length: 120 }),
  failureReason: text("failure_reason"),
  eventAt: timestamp("event_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("stp_private_event_user_batch_event_uq").on(table.userId, table.batchId, table.eventId), index("stp_private_event_user_batch_time_idx").on(table.userId, table.batchId, table.eventAt), index("stp_private_event_user_batch_instruction_idx").on(table.userId, table.batchId, table.instructionId)]);

export const stpPrivateInstructionReviews = mysqlTable("stp_private_instruction_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  instructionId: varchar("instruction_id", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("stp_private_review_user_batch_instruction_uq").on(table.userId, table.batchId, table.instructionId), index("stp_private_review_user_batch_idx").on(table.userId, table.batchId)]);

export const stpPrivateInstructionReviewAudits = mysqlTable("stp_private_instruction_review_audits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  instructionId: varchar("instruction_id", { length: 120 }).notNull(),
  status: varchar("status", { length: 24 }).notNull(),
  note: text("note"),
  action: varchar("action", { length: 24 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("stp_private_review_audit_user_batch_instruction_idx").on(table.userId, table.batchId, table.instructionId, table.createdAt)]);

export const stpPrivateSettings = mysqlTable("stp_private_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  exceptionLatencyThresholdSeconds: int("exception_latency_threshold_seconds").notNull().default(3600),
  exceptionRateThresholdPct: decimal("exception_rate_threshold_pct", { precision: 8, scale: 2 }).notNull().default("5.00"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("stp_private_settings_user_uq").on(table.userId)]);

export const tradeBookPrivateBatches = mysqlTable("trade_book_private_batches", {
  id: int("id").autoincrement().primaryKey(), userId: int("user_id").notNull(), name: varchar("name", { length: 120 }).notNull(), sourceLabel: varchar("source_label", { length: 160 }).notNull(), asOfAt: timestamp("as_of_at").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("trade_book_private_batch_user_created_idx").on(table.userId, table.createdAt)]);
export const tradeBookPrivatePositionSnapshots = mysqlTable("trade_book_private_position_snapshots", {
  id: int("id").autoincrement().primaryKey(), userId: int("user_id").notNull(), batchId: int("batch_id").notNull(), snapshotId: varchar("snapshot_id", { length: 120 }).notNull(), accountLabel: varchar("account_label", { length: 120 }).notNull(), instrument: varchar("instrument", { length: 160 }).notNull(), quantity: decimal("quantity", { precision: 24, scale: 6 }).notNull(), marketPrice: decimal("market_price", { precision: 24, scale: 8 }), costBasis: decimal("cost_basis", { precision: 24, scale: 6 }), currency: varchar("currency", { length: 12 }), snapshotAt: timestamp("snapshot_at").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("trade_book_private_position_uq").on(table.userId, table.batchId, table.snapshotId), index("trade_book_private_position_user_batch_idx").on(table.userId, table.batchId)]);
export const tradeBookPrivateCashFlows = mysqlTable("trade_book_private_cash_flows", {
  id: int("id").autoincrement().primaryKey(), userId: int("user_id").notNull(), batchId: int("batch_id").notNull(), flowId: varchar("flow_id", { length: 120 }).notNull(), accountLabel: varchar("account_label", { length: 120 }).notNull(), flowType: varchar("flow_type", { length: 48 }).notNull(), amount: decimal("amount", { precision: 24, scale: 6 }).notNull(), currency: varchar("currency", { length: 12 }), instrument: varchar("instrument", { length: 160 }), occurredAt: timestamp("occurred_at").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("trade_book_private_cash_flow_uq").on(table.userId, table.batchId, table.flowId), index("trade_book_private_cash_flow_user_batch_idx").on(table.userId, table.batchId)]);

export const valuationAutomationSettings = mysqlTable("valuation_automation_settings", {
  id: int("id").autoincrement().primaryKey(), userId: int("user_id").notNull(), productId: varchar("product_id", { length: 16 }).notNull().default("UST10Y"), notional: decimal("notional", { precision: 24, scale: 2 }).notNull().default("10000000.00"), couponRate: decimal("coupon_rate", { precision: 12, scale: 8 }).notNull().default("0.04000000"), frequency: int("frequency").notNull().default(2), cronExpression: varchar("cron_expression", { length: 64 }).notNull().default("0 0 23 * * 1-5"), isEnabled: boolean("is_enabled").notNull().default(false), scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }), lastRunAt: timestamp("last_run_at"), lastStatus: mysqlEnum("last_status", ["never", "succeeded", "failed"]).notNull().default("never"), lastError: text("last_error"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("valuation_automation_settings_user_uq").on(table.userId), uniqueIndex("valuation_automation_settings_task_uq").on(table.scheduleCronTaskUid), index("valuation_automation_settings_task_idx").on(table.scheduleCronTaskUid)]);

export const valuationAutomationRuns = mysqlTable("valuation_automation_runs", {
  id: int("id").autoincrement().primaryKey(), userId: int("user_id").notNull(), settingId: int("setting_id").notNull(), triggerType: mysqlEnum("trigger_type", ["manual", "scheduled"]).notNull(), status: mysqlEnum("status", ["succeeded", "failed", "skipped"]).notNull(), productId: varchar("product_id", { length: 16 }).notNull(), notional: decimal("notional", { precision: 24, scale: 2 }).notNull(), couponRate: decimal("coupon_rate", { precision: 12, scale: 8 }).notNull(), frequency: int("frequency").notNull(), curveYieldPct: decimal("curve_yield_pct", { precision: 12, scale: 8 }), curveObservationDate: date("curve_observation_date"), source: varchar("source", { length: 80 }).notNull(), methodology: varchar("methodology", { length: 255 }).notNull(), presentValue: decimal("present_value", { precision: 24, scale: 6 }), cleanPricePer100: decimal("clean_price_per_100", { precision: 20, scale: 8 }), macaulayDuration: decimal("macaulay_duration", { precision: 16, scale: 8 }), modifiedDuration: decimal("modified_duration", { precision: 16, scale: 8 }), dv01: decimal("dv01", { precision: 24, scale: 8 }), errorMessage: text("error_message"), executedAt: timestamp("executed_at").defaultNow().notNull(),
}, (table) => [index("valuation_automation_runs_user_executed_idx").on(table.userId, table.executedAt), index("valuation_automation_runs_setting_executed_idx").on(table.settingId, table.executedAt)]);

// ── 行业分组分析：账户私有研究数据（仅追加，不使用原工作区静态/随机数据） ──
export const industryGroupPrivateBatches = mysqlTable("industry_group_private_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  classification: varchar("classification", { length: 80 }).notNull(),
  sourceLabel: varchar("source_label", { length: 160 }).notNull(),
  asOfAt: timestamp("as_of_at").notNull(),
  recordCount: int("record_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("industry_group_private_batch_user_created_idx").on(table.userId, table.createdAt)]);

export const industryGroupPrivateObservations = mysqlTable("industry_group_private_observations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  batchId: int("batch_id").notNull(),
  recordId: varchar("record_id", { length: 120 }).notNull(),
  industryGroup: varchar("industry_group", { length: 160 }).notNull(),
  metric: varchar("metric", { length: 120 }).notNull(),
  value: decimal("value", { precision: 28, scale: 10 }).notNull(),
  unit: varchar("unit", { length: 48 }).notNull(),
  issuerName: varchar("issuer_name", { length: 160 }),
  ticker: varchar("ticker", { length: 48 }),
  currency: varchar("currency", { length: 12 }),
  sourceReference: varchar("source_reference", { length: 255 }),
  observedAt: timestamp("observed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("industry_group_private_observation_uq").on(table.userId, table.batchId, table.recordId),
  index("industry_group_private_observation_user_batch_idx").on(table.userId, table.batchId),
  index("industry_group_private_observation_group_metric_idx").on(table.userId, table.industryGroup, table.metric, table.observedAt),
]);

// ── 独立管理后台：服务端安全审计（仅追加） ──
export const adminSecurityAuditEvents = mysqlTable("admin_security_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actor_user_id").notNull(),
  targetUserId: int("target_user_id"),
  action: varchar("action", { length: 80 }).notNull(),
  result: mysqlEnum("result", ["allowed", "blocked"]).notNull(),
  reason: varchar("reason", { length: 500 }),
  metadata: varchar("metadata", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_security_audit_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("admin_security_audit_target_created_idx").on(table.targetUserId, table.createdAt),
]);

// ── 管理首页：仅管理员可见的聚合运行时采样（不含会话、凭据或个人研究数据） ──
export const adminRuntimeHealthSamples = mysqlTable("admin_runtime_health_samples", {
  id: int("id").autoincrement().primaryKey(),
  sampledAt: timestamp("sampled_at").defaultNow().notNull(),
  dbLatencyMs: int("db_latency_ms"),
  heapUsedBytes: bigint("heap_used_bytes", { mode: "number" }).notNull(),
  heapTotalBytes: bigint("heap_total_bytes", { mode: "number" }).notNull(),
  rssBytes: bigint("rss_bytes", { mode: "number" }).notNull(),
  uptimeSeconds: int("uptime_seconds").notNull(),
  totalUsers: int("total_users").notNull(),
  activeLast24h: int("active_last_24h").notNull(),
  activeLast7d: int("active_last_7d").notNull(),
}, (table) => [index("admin_runtime_health_sampled_idx").on(table.sampledAt)]);

// ── 金融终端：最小化安全事件审计（不存储剪贴板或网络指纹） ──
export const terminalSecurityEvents = mysqlTable("terminal_security_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventType: varchar("event_type", { length: 48 }).notNull(),
  routePath: varchar("route_path", { length: 255 }).notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
}, (table) => [
  index("terminal_security_event_user_time_idx").on(table.userId, table.occurredAt),
  index("terminal_security_event_type_time_idx").on(table.eventType, table.occurredAt),
]);

// ── 金融终端：全局动态水印配置（仅管理员可修改；终端只读取当前生效状态） ──
export const terminalWatermarkSettings = mysqlTable("terminal_watermark_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 48 }).notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  opacityPercent: int("opacity_percent").notNull().default(45),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// ─── Admin module automation: durable work and delivery evidence ─────────────
// These backend-only tables never change client routes, request parameters, response
// shapes, cache behavior, or existing frontend-readable business schemas.
export const adminDataModuleContentItems = mysqlTable("admin_data_module_content_items", {
  id: int("id").autoincrement().primaryKey(),
  contentKey: varchar("content_key", { length: 160 }).notNull().unique(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  runId: int("run_id"),
  jobItemId: int("job_item_id"),
  deliveryVersionId: int("delivery_version_id"),
  contentType: mysqlEnum("content_type", ["market_snapshot", "news_article", "announcement", "download", "generic"]).notNull().default("generic"),
  sourceKind: mysqlEnum("source_kind", ["real", "simulated", "mixed"]).notNull(),
  status: mysqlEnum("status", ["generated", "pending_review", "approved", "rejected", "queued_for_delivery", "delivered", "skipped_duplicate", "failed", "reverted"]).notNull().default("generated"),
  title: varchar("title", { length: 700 }).notNull(),
  body: text("body"),
  assetUrl: varchar("asset_url", { length: 1200 }),
  topic: varchar("topic", { length: 200 }),
  category: varchar("category", { length: 80 }),
  keywords: json("keywords").$type<string[]>().notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  sortWeight: int("sort_weight").notNull().default(100),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  sourceReference: varchar("source_reference", { length: 1200 }),
  targetPayload: json("target_payload"),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  dedupeScope: varchar("dedupe_scope", { length: 128 }).notNull().default("global"),
  qualityScore: int("quality_score").notNull().default(0),
  qualityReport: json("quality_report"),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  deliveryAttempts: int("delivery_attempts").notNull().default(0),
  errorDetail: varchar("error_detail", { length: 1800 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_mod_content_dedupe_uq").on(table.dedupeScope, table.contentHash),
  index("admin_mod_content_module_status_idx").on(table.moduleId, table.status, table.updatedAt),
  index("admin_mod_content_run_status_idx").on(table.runId, table.status),
  index("admin_mod_content_version_idx").on(table.deliveryVersionId),
]);

export const adminDataModuleAutomationRunItems = mysqlTable("admin_data_module_automation_run_items", {
  id: int("id").autoincrement().primaryKey(),
  itemKey: varchar("item_key", { length: 160 }).notNull().unique(),
  runId: int("run_id").notNull(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  status: mysqlEnum("status", ["queued", "claimed", "running", "pending_review", "pending_delivery", "completed", "skipped", "failed", "cancelled"]).notNull().default("queued"),
  currentStep: varchar("current_step", { length: 120 }).notNull().default("queued"),
  priority: int("priority").notNull().default(100),
  attemptCount: int("attempt_count").notNull().default(0),
  maxAttempts: int("max_attempts").notNull().default(3),
  retryAfter: timestamp("retry_after"),
  leaseToken: varchar("lease_token", { length: 80 }),
  leaseExpiresAt: timestamp("lease_expires_at"),
  idempotencyKey: varchar("idempotency_key", { length: 190 }).notNull().unique(),
  resultSummary: json("result_summary"),
  errorDetail: varchar("error_detail", { length: 1800 }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_mod_run_item_status_priority_idx").on(table.status, table.priority, table.createdAt),
  uniqueIndex("adm_mod_run_item_run_module_uq").on(table.runId, table.moduleId),
  index("adm_mod_run_item_status_idx").on(table.status, table.updatedAt),
  index("adm_mod_run_item_run_status_idx").on(table.runId, table.status),
  index("admin_mod_run_item_lease_idx").on(table.leaseExpiresAt),
]);

export const adminDataModuleAutomationStepEvents = mysqlTable("admin_data_module_automation_step_events", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  jobItemId: int("job_item_id"),
  moduleId: varchar("module_id", { length: 96 }),
  step: varchar("step", { length: 120 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["started", "success", "failed", "skipped", "cancelled"]).notNull(),
  detail: varchar("detail", { length: 1800 }).notNull(),
  durationMs: int("duration_ms"),
  actorUserId: int("actor_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_mod_step_run_created_idx").on(table.runId, table.createdAt),
  index("admin_mod_step_item_created_idx").on(table.jobItemId, table.createdAt),
  index("admin_mod_step_module_created_idx").on(table.moduleId, table.createdAt),
]);

export const adminDataModuleDeliveryOperations = mysqlTable("admin_data_module_delivery_operations", {
  id: int("id").autoincrement().primaryKey(),
  operationKey: varchar("operation_key", { length: 160 }).notNull().unique(),
  idempotencyKey: varchar("idempotency_key", { length: 190 }).notNull().unique(),
  moduleId: varchar("module_id", { length: 96 }).notNull(),
  runId: int("run_id"),
  jobItemId: int("job_item_id"),
  deliveryVersionId: int("delivery_version_id"),
  status: mysqlEnum("status", ["queued", "applying", "applied", "failed", "reverted", "cancelled"]).notNull().default("queued"),
  targetContract: varchar("target_contract", { length: 160 }).notNull(),
  targetReference: varchar("target_reference", { length: 300 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  candidatePayload: json("candidate_payload").notNull(),
  previousTargetSnapshot: json("previous_target_snapshot"),
  resultSnapshot: json("result_snapshot"),
  itemCount: int("item_count").notNull().default(0),
  errorDetail: varchar("error_detail", { length: 1800 }),
  appliedAt: timestamp("applied_at"),
  revertedAt: timestamp("reverted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("admin_mod_delivery_operation_module_status_idx").on(table.moduleId, table.status, table.createdAt),
  index("admin_mod_delivery_operation_version_idx").on(table.deliveryVersionId),
  index("admin_mod_delivery_operation_run_idx").on(table.runId),
]);

export const adminDataModuleExecutionLocks = mysqlTable("admin_data_module_execution_locks", {
  lockKey: varchar("lock_key", { length: 190 }).primaryKey(),
  leaseToken: varchar("lease_token", { length: 80 }).notNull(),
  ownerKind: varchar("owner_kind", { length: 80 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("admin_mod_execution_lock_expires_idx").on(table.expiresAt)]);

export const adminDataModuleRequestCache = mysqlTable("admin_data_module_request_cache", {
  cacheKey: varchar("cache_key", { length: 190 }).primaryKey(),
  status: mysqlEnum("status", ["ready", "pending", "failed"]).notNull().default("pending"),
  value: json("value"),
  errorDetail: varchar("error_detail", { length: 1000 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("admin_mod_request_cache_expires_idx").on(table.expiresAt)]);

export type AdminDataModuleContentItem = typeof adminDataModuleContentItems.$inferSelect;
export type AdminDataModuleAutomationRunItem = typeof adminDataModuleAutomationRunItems.$inferSelect;
export type AdminDataModuleAutomationStepEvent = typeof adminDataModuleAutomationStepEvents.$inferSelect;
export type AdminDataModuleDeliveryOperation = typeof adminDataModuleDeliveryOperations.$inferSelect;

// ─── Admin module system settings ──────────────────────────────────────────
// 后台自动化运行参数和审计说明；不向前端返回，也不改变前端缓存或业务配置。
export const adminDataModuleSystemSettings = mysqlTable("admin_data_module_system_settings", {
  settingKey: varchar("setting_key", { length: 96 }).primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  value: json("value").notNull(),
  description: varchar("description", { length: 600 }),
  updatedByUserId: int("updated_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("admin_mod_system_settings_category_updated_idx").on(table.category, table.updatedAt)]);

export type AdminDataModuleSystemSetting = typeof adminDataModuleSystemSettings.$inferSelect;
