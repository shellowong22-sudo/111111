CREATE TABLE `inventory_seasonality_alert_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`product_id` varchar(16) NOT NULL,
	`observation_date` varchar(16) NOT NULL,
	`current_value_kbbl` decimal(14,3) NOT NULL,
	`prior_year_value_kbbl` decimal(14,3) NOT NULL,
	`difference_kbbl` decimal(14,3) NOT NULL,
	`threshold_kbbl` decimal(14,3) NOT NULL,
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_seasonality_alert_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_seasonality_event_user_key_uq` UNIQUE(`user_id`,`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `inventory_seasonality_alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` varchar(16) NOT NULL,
	`threshold_kbbl` decimal(14,3) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_seasonality_alert_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_seasonality_rule_user_product_uq` UNIQUE(`user_id`,`product_id`)
);
