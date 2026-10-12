CREATE TABLE `admin_data_module_refresh_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` varchar(96) NOT NULL,
	`source_group` enum('market_ingestion','news_ingestion','request_time','restricted') NOT NULL,
	`status` enum('started','available','partial','unavailable','not_configured','restricted') NOT NULL,
	`actor_user_id` int NOT NULL,
	`detail` varchar(1200) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_data_module_refresh_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_data_module_refresh_module_created_idx` ON `admin_data_module_refresh_events` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_data_module_refresh_status_created_idx` ON `admin_data_module_refresh_events` (`status`,`created_at`);