CREATE TABLE `forex_freshness_alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`series_id` varchar(32) NOT NULL,
	`threshold_hours` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forex_freshness_alert_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `forex_freshness_rule_user_series_uq` UNIQUE(`user_id`,`series_id`)
);
--> statement-breakpoint
CREATE INDEX `forex_freshness_rule_user_active_idx` ON `forex_freshness_alert_rules` (`user_id`,`is_active`);