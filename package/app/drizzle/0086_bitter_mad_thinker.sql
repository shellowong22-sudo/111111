CREATE TABLE `treasury_historical_curve_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`import_key` varchar(128) NOT NULL,
	`curve_id` int NOT NULL,
	`source_url` text NOT NULL,
	`source_sha256` varchar(64) NOT NULL,
	`source_first_date` varchar(10) NOT NULL,
	`source_last_date` varchar(10) NOT NULL,
	`sampling_rule` varchar(160) NOT NULL,
	`selected_observation_count` int NOT NULL,
	`imported_point_count` int NOT NULL,
	`fetched_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treasury_historical_curve_imports_id` PRIMARY KEY(`id`),
	CONSTRAINT `treasury_historical_curve_imports_import_key_unique` UNIQUE(`import_key`)
);
