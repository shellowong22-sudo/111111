CREATE TABLE `economic_calendar_anomaly_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`series_id` varchar(96) NOT NULL,
	`observation_date` varchar(16) NOT NULL,
	`current_value` decimal(24,6) NOT NULL,
	`previous_value` decimal(24,6) NOT NULL,
	`change_value` decimal(24,6) NOT NULL,
	`threshold` decimal(20,6) NOT NULL,
	`notification_key` varchar(255) NOT NULL,
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `economic_calendar_anomaly_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `economic_calendar_anomaly_event_notification_uq` UNIQUE(`user_id`,`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `economic_calendar_anomaly_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`series_id` varchar(96) NOT NULL,
	`threshold` decimal(20,6) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `economic_calendar_anomaly_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `economic_calendar_anomaly_rule_user_series_uq` UNIQUE(`user_id`,`series_id`)
);
--> statement-breakpoint
CREATE TABLE `economic_calendar_region_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`region` enum('all','us','eurozone','eu') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `economic_calendar_region_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `economic_calendar_region_preset_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `economic_calendar_anomaly_event_user_created_idx` ON `economic_calendar_anomaly_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `economic_calendar_anomaly_event_rule_date_idx` ON `economic_calendar_anomaly_events` (`rule_id`,`observation_date`);--> statement-breakpoint
CREATE INDEX `economic_calendar_anomaly_rule_active_series_idx` ON `economic_calendar_anomaly_rules` (`is_active`,`series_id`);--> statement-breakpoint
CREATE INDEX `economic_calendar_region_preset_user_updated_idx` ON `economic_calendar_region_presets` (`user_id`,`updated_at`);