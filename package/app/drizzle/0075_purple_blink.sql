CREATE TABLE `valuation_automation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`setting_id` int NOT NULL,
	`trigger_type` enum('manual','scheduled') NOT NULL,
	`status` enum('succeeded','failed','skipped') NOT NULL,
	`product_id` varchar(16) NOT NULL,
	`notional` decimal(24,2) NOT NULL,
	`coupon_rate` decimal(12,8) NOT NULL,
	`frequency` int NOT NULL,
	`curve_yield_pct` decimal(12,8),
	`curve_observation_date` date,
	`source` varchar(80) NOT NULL,
	`methodology` varchar(255) NOT NULL,
	`present_value` decimal(24,6),
	`clean_price_per_100` decimal(20,8),
	`macaulay_duration` decimal(16,8),
	`modified_duration` decimal(16,8),
	`dv01` decimal(24,8),
	`error_message` text,
	`executed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `valuation_automation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `valuation_automation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` varchar(16) NOT NULL DEFAULT 'UST10Y',
	`notional` decimal(24,2) NOT NULL DEFAULT '10000000.00',
	`coupon_rate` decimal(12,8) NOT NULL DEFAULT '0.04000000',
	`frequency` int NOT NULL DEFAULT 2,
	`cron_expression` varchar(64) NOT NULL DEFAULT '0 0 23 * * 1-5',
	`is_enabled` boolean NOT NULL DEFAULT false,
	`schedule_cron_task_uid` varchar(65),
	`last_run_at` timestamp,
	`last_status` enum('never','succeeded','failed') NOT NULL DEFAULT 'never',
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `valuation_automation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `valuation_automation_settings_user_uq` UNIQUE(`user_id`),
	CONSTRAINT `valuation_automation_settings_task_uq` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE INDEX `valuation_automation_runs_user_executed_idx` ON `valuation_automation_runs` (`user_id`,`executed_at`);--> statement-breakpoint
CREATE INDEX `valuation_automation_runs_setting_executed_idx` ON `valuation_automation_runs` (`setting_id`,`executed_at`);--> statement-breakpoint
CREATE INDEX `valuation_automation_settings_task_idx` ON `valuation_automation_settings` (`schedule_cron_task_uid`);