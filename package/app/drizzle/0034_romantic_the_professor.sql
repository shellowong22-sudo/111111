CREATE TABLE `preferred_term_import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_filename` varchar(240) NOT NULL,
	`total_rows` int NOT NULL,
	`accepted_rows` int NOT NULL,
	`rejected_rows` int NOT NULL,
	`updated_rows` int NOT NULL DEFAULT 0,
	`warning_rows` int NOT NULL DEFAULT 0,
	`coverage_summary` json NOT NULL,
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `preferred_term_import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `preferred_term_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`security_identifier` varchar(120) NOT NULL,
	`issuer_name` varchar(240) NOT NULL,
	`security_name` varchar(240) NOT NULL,
	`cik` varchar(10),
	`dividend_type` enum('fixed','floating','fixed_to_float','other') NOT NULL,
	`coupon_rate_pct` decimal(7,4),
	`payment_frequency` enum('monthly','quarterly','semiannual','annual','other') NOT NULL,
	`reference_index` varchar(120),
	`spread_bps` int,
	`reset_frequency` enum('monthly','quarterly','semiannual','annual','other'),
	`first_call_date` date,
	`maturity_date` date,
	`liquidation_preference` decimal(16,4),
	`source_reference` varchar(240),
	`as_of_date` date NOT NULL,
	`source_batch_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `preferred_term_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `preferred_term_record_user_identifier_uq` UNIQUE(`user_id`,`security_identifier`)
);
--> statement-breakpoint
CREATE INDEX `preferred_term_import_batch_user_idx` ON `preferred_term_import_batches` (`user_id`,`imported_at`);--> statement-breakpoint
CREATE INDEX `preferred_term_record_user_type_idx` ON `preferred_term_records` (`user_id`,`dividend_type`,`as_of_date`);--> statement-breakpoint
CREATE INDEX `preferred_term_record_user_issuer_idx` ON `preferred_term_records` (`user_id`,`issuer_name`,`updated_at`);