CREATE TABLE `sovereign_daily_fact_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_key` varchar(100) NOT NULL,
	`source_key` varchar(64) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`source_url` text NOT NULL,
	`observation_date` varchar(10) NOT NULL,
	`status` enum('available','partial','unavailable') NOT NULL,
	`record_count` int NOT NULL DEFAULT 0,
	`covered_modules` json NOT NULL,
	`payload` json NOT NULL,
	`limitation` text,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sovereign_daily_fact_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `sovereign_daily_fact_snapshots_snapshot_key_unique` UNIQUE(`snapshot_key`)
);
