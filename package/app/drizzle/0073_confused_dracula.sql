CREATE TABLE `stp_private_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`as_of_at` timestamp NOT NULL,
	`record_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stp_private_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stp_private_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`event_id` varchar(120) NOT NULL,
	`instruction_id` varchar(120) NOT NULL,
	`trade_id` varchar(120),
	`event_type` enum('received','enriched','validated','matched','confirmed','settled','exception','rejected','cancelled') NOT NULL,
	`processing_stage` enum('capture','enrichment','validation','matching','confirmation','settlement') NOT NULL,
	`outcome` enum('success','pending','failure') NOT NULL,
	`instrument` varchar(120) NOT NULL,
	`asset_class` varchar(80),
	`side` enum('buy','sell'),
	`quantity` decimal(24,6),
	`amount` decimal(24,6),
	`currency` varchar(12),
	`counterparty` varchar(160),
	`failure_code` varchar(120),
	`failure_reason` text,
	`event_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stp_private_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stp_private_event_user_batch_event_uq` UNIQUE(`user_id`,`batch_id`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `stp_private_instruction_review_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`instruction_id` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL,
	`note` text,
	`action` varchar(24) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stp_private_instruction_review_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stp_private_instruction_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`instruction_id` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stp_private_instruction_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `stp_private_review_user_batch_instruction_uq` UNIQUE(`user_id`,`batch_id`,`instruction_id`)
);
--> statement-breakpoint
CREATE TABLE `stp_private_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`exception_latency_threshold_seconds` int NOT NULL DEFAULT 3600,
	`exception_rate_threshold_pct` decimal(8,2) NOT NULL DEFAULT '5.00',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stp_private_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `stp_private_settings_user_uq` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE INDEX `stp_private_batch_user_created_idx` ON `stp_private_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stp_private_event_user_batch_time_idx` ON `stp_private_events` (`user_id`,`batch_id`,`event_at`);--> statement-breakpoint
CREATE INDEX `stp_private_event_user_batch_instruction_idx` ON `stp_private_events` (`user_id`,`batch_id`,`instruction_id`);--> statement-breakpoint
CREATE INDEX `stp_private_review_audit_user_batch_instruction_idx` ON `stp_private_instruction_review_audits` (`user_id`,`batch_id`,`instruction_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stp_private_review_user_batch_idx` ON `stp_private_instruction_reviews` (`user_id`,`batch_id`);