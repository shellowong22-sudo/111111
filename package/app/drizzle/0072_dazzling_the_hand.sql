CREATE TABLE `electronic_trading_execution_review_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`order_id` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL,
	`note` text,
	`action` varchar(24) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `electronic_trading_execution_review_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `electronic_trading_execution_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`order_id` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `electronic_trading_execution_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `electronic_trading_review_user_batch_order_uq` UNIQUE(`user_id`,`batch_id`,`order_id`)
);
--> statement-breakpoint
CREATE TABLE `electronic_trading_quality_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`adverse_deviation_threshold_bps` decimal(10,2) NOT NULL DEFAULT '25.00',
	`latency_threshold_seconds` int NOT NULL DEFAULT 300,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `electronic_trading_quality_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `electronic_trading_quality_settings_user_uq` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `electronic_trading_research_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`as_of_at` timestamp NOT NULL,
	`record_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `electronic_trading_research_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `electronic_trading_research_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`event_id` varchar(120) NOT NULL,
	`order_id` varchar(120) NOT NULL,
	`event_type` enum('new','route','modify','cancel','partial_fill','fill','reject') NOT NULL,
	`instrument` varchar(120) NOT NULL,
	`asset_class` varchar(80),
	`side` enum('buy','sell') NOT NULL,
	`order_qty` decimal(24,6),
	`event_qty` decimal(24,6),
	`reference_price` decimal(24,8),
	`execution_price` decimal(24,8),
	`venue` varchar(120),
	`broker` varchar(120),
	`strategy_label` varchar(120),
	`route_id` varchar(120),
	`event_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `electronic_trading_research_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `electronic_trading_event_user_batch_event_uq` UNIQUE(`user_id`,`batch_id`,`event_id`)
);
--> statement-breakpoint
CREATE INDEX `electronic_trading_review_audit_user_batch_order_idx` ON `electronic_trading_execution_review_audits` (`user_id`,`batch_id`,`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `electronic_trading_review_user_batch_idx` ON `electronic_trading_execution_reviews` (`user_id`,`batch_id`);--> statement-breakpoint
CREATE INDEX `electronic_trading_batch_user_created_idx` ON `electronic_trading_research_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `electronic_trading_event_user_batch_time_idx` ON `electronic_trading_research_events` (`user_id`,`batch_id`,`event_at`);--> statement-breakpoint
CREATE INDEX `electronic_trading_event_user_batch_order_idx` ON `electronic_trading_research_events` (`user_id`,`batch_id`,`order_id`);