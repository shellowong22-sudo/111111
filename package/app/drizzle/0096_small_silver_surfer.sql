CREATE TABLE `admin_ai_generation_catalog_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`catalog_code` varchar(16) NOT NULL,
	`action` enum('enabled','disabled','deleted') NOT NULL,
	`actor_user_id` int NOT NULL,
	`detail` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_ai_generation_catalog_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_ai_generation_catalog_settings` (
	`catalog_code` varchar(16) NOT NULL,
	`status` enum('enabled','disabled','deleted') NOT NULL DEFAULT 'enabled',
	`updated_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_ai_generation_catalog_settings_catalog_code` PRIMARY KEY(`catalog_code`)
);
--> statement-breakpoint
CREATE INDEX `admin_ai_generation_catalog_event_code_created_idx` ON `admin_ai_generation_catalog_events` (`catalog_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_ai_generation_catalog_event_actor_created_idx` ON `admin_ai_generation_catalog_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_ai_generation_catalog_status_updated_idx` ON `admin_ai_generation_catalog_settings` (`status`,`updated_at`);