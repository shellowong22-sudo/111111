CREATE TABLE `commodity_watchlist_alert_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`watchlist_id` int NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`changes` json NOT NULL,
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commodity_watchlist_alert_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `commodity_watchlist_alert_user_key_uq` UNIQUE(`user_id`,`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `commodity_watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`series_ids` json NOT NULL,
	`alert_threshold_percent` decimal(8,3) NOT NULL DEFAULT '0.000',
	`is_active` boolean NOT NULL DEFAULT true,
	`latest_snapshot` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commodity_watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `commodity_watchlist_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `commodity_watchlist_alert_watchlist_created_idx` ON `commodity_watchlist_alert_events` (`watchlist_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `commodity_watchlist_user_updated_idx` ON `commodity_watchlists` (`user_id`,`updated_at`);