CREATE TABLE `admin_data_module_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` varchar(96) NOT NULL,
	`action` enum('managed','attention','restricted','archived') NOT NULL,
	`actor_user_id` int NOT NULL,
	`detail` varchar(900) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_data_module_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_settings` (
	`module_id` varchar(96) NOT NULL,
	`status` enum('managed','attention','restricted','archived') NOT NULL DEFAULT 'managed',
	`admin_note` varchar(600),
	`updated_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_data_module_settings_module_id` PRIMARY KEY(`module_id`)
);
--> statement-breakpoint
CREATE INDEX `admin_data_module_event_module_created_idx` ON `admin_data_module_events` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_data_module_event_actor_created_idx` ON `admin_data_module_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_data_module_status_updated_idx` ON `admin_data_module_settings` (`status`,`updated_at`);