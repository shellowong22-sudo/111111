CREATE TABLE `admin_market_ingestion_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`target_id` int,
	`actor_user_id` int,
	`action` enum('target_created','target_updated','sync_started','sync_completed','sync_unavailable','schedule_enabled','schedule_paused') NOT NULL,
	`detail` varchar(1200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_market_ingestion_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_market_ingestion_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`market_type` enum('stock','etf','index','forex','commodity','bond','fund') NOT NULL DEFAULT 'stock',
	`history_range` enum('5d','1mo','3mo') NOT NULL DEFAULT '3mo',
	`is_active` boolean NOT NULL DEFAULT true,
	`schedule_cron_task_uid` varchar(65),
	`last_fetched_at` timestamp,
	`last_status` enum('never','available','unavailable') NOT NULL DEFAULT 'never',
	`last_error` varchar(600),
	`source` varchar(160),
	`currency` varchar(16),
	`last_observation_date` varchar(32),
	`last_close` decimal(20,6),
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_market_ingestion_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_market_ingestion_target_symbol_uq` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE INDEX `admin_market_ingestion_event_target_created_idx` ON `admin_market_ingestion_events` (`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_market_ingestion_target_active_idx` ON `admin_market_ingestion_targets` (`is_active`,`updated_at`);--> statement-breakpoint
CREATE INDEX `admin_market_ingestion_target_task_idx` ON `admin_market_ingestion_targets` (`schedule_cron_task_uid`);