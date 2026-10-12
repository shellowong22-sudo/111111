CREATE TABLE `standalone_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`cron_expression` varchar(96) NOT NULL,
	`callback_path` varchar(255) NOT NULL,
	`callback_method` varchar(8) NOT NULL DEFAULT 'POST',
	`callback_payload` text,
	`description` varchar(1000) NOT NULL DEFAULT '',
	`is_enabled` boolean NOT NULL DEFAULT true,
	`last_executed_at` timestamp,
	`last_status` varchar(32) NOT NULL DEFAULT 'never',
	`last_error` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `standalone_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `standalone_schedules_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `standalone_schedules_enabled_idx` ON `standalone_schedules` (`is_enabled`,`updated_at`);