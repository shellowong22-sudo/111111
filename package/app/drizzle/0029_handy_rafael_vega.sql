CREATE TABLE `money_market_module_usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`activity_bucket` timestamp NOT NULL,
	`opened_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `money_market_module_usage_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `mm_module_usage_user_module_bucket_uq` UNIQUE(`user_id`,`module_id`,`activity_bucket`)
);
--> statement-breakpoint
CREATE TABLE `money_market_source_availability_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` varchar(40) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`status` enum('available','unavailable') NOT NULL,
	`record_count` int NOT NULL DEFAULT 0,
	`sampled_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `money_market_source_availability_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `mm_source_availability_source_hour_uq` UNIQUE(`source_id`,`sampled_at`)
);
