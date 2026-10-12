CREATE TABLE `mktbeat_notification_digest_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`delivery_key` varchar(190) NOT NULL,
	`notification_id` int NOT NULL,
	`event_count` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mktbeat_notification_digest_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `mktbeat_notification_digest_delivery_uq` UNIQUE(`rule_id`,`delivery_key`)
);
--> statement-breakpoint
CREATE TABLE `mktbeat_notification_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`series_id` varchar(16) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`quiet_start` varchar(5),
	`quiet_end` varchar(5),
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`digest_mode` enum('after_quiet','none') NOT NULL DEFAULT 'after_quiet',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mktbeat_notification_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `mktbeat_notification_rule_user_series_uq` UNIQUE(`user_id`,`series_id`)
);
--> statement-breakpoint
ALTER TABLE `mktbeat_threshold_notification_events` ADD `delivery_status` enum('immediate','queued','delivered') DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE `mktbeat_threshold_notification_events` ADD `notification_id` int;