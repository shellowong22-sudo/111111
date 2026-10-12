CREATE TABLE `index_official_weight_import_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batch_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('imported') NOT NULL,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `index_official_weight_import_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `index_official_weight_import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`index_id` varchar(64) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`source_url` varchar(1000) NOT NULL,
	`source_date` date NOT NULL,
	`source_filename` varchar(240) NOT NULL,
	`row_count` int NOT NULL,
	`total_weight_pct` decimal(9,4) NOT NULL,
	`content_fingerprint` varchar(64) NOT NULL,
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `index_official_weight_import_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `index_official_weight_import_user_fingerprint_uq` UNIQUE(`user_id`,`content_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `index_official_weight_import_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batch_id` int NOT NULL,
	`ticker` varchar(20) NOT NULL,
	`name` varchar(240) NOT NULL,
	`weight_pct` decimal(9,4) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `index_official_weight_import_rows_id` PRIMARY KEY(`id`),
	CONSTRAINT `index_official_weight_row_batch_ticker_uq` UNIQUE(`batch_id`,`ticker`)
);
--> statement-breakpoint
CREATE INDEX `index_official_weight_import_audit_batch_idx` ON `index_official_weight_import_audit_events` (`batch_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `index_official_weight_import_user_index_date_idx` ON `index_official_weight_import_batches` (`user_id`,`index_id`,`source_date`);--> statement-breakpoint
CREATE INDEX `index_official_weight_row_ticker_idx` ON `index_official_weight_import_rows` (`ticker`);