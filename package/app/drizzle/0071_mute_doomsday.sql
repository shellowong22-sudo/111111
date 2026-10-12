CREATE TABLE `order_management_archive_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`condition_type` varchar(32) NOT NULL,
	`age_days` int,
	`cron_expression` varchar(64) NOT NULL DEFAULT '0 0 2 * * *',
	`is_enabled` boolean NOT NULL DEFAULT true,
	`schedule_cron_task_uid` varchar(65),
	`last_run_at` timestamp,
	`last_run_archived_count` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_management_archive_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_management_deviation_alert_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`threshold_bps` decimal(10,2) NOT NULL DEFAULT '25.00',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_management_deviation_alert_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_management_deviation_alert_user_uq` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `order_management_order_review_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`order_id` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL,
	`note` text,
	`action` varchar(24) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_management_order_review_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_management_order_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`order_id` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_management_order_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_management_review_uq` UNIQUE(`user_id`,`batch_id`,`order_id`)
);
--> statement-breakpoint
CREATE INDEX `order_management_archive_rule_user_idx` ON `order_management_archive_rules` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_management_archive_rule_task_uid_idx` ON `order_management_archive_rules` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `order_management_review_audit_user_batch_order_idx` ON `order_management_order_review_audits` (`user_id`,`batch_id`,`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_management_review_user_batch_idx` ON `order_management_order_reviews` (`user_id`,`batch_id`);