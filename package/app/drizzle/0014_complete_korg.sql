CREATE TABLE `financing_calendar_reminder_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`user_id` int NOT NULL,
	`rule_id` int NOT NULL,
	`event_record_id` varchar(190) NOT NULL,
	`event_date` date NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financing_calendar_reminder_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `fin_cal_rem_notify_key_uq` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `financing_calendar_reminder_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_type` enum('announcement','auction','settlement') NOT NULL,
	`country_code` varchar(8) NOT NULL DEFAULT 'ALL',
	`days_before_event` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financing_calendar_reminder_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `financing_reminder_rule_user_event_country_uq` UNIQUE(`user_id`,`event_type`,`country_code`)
);
