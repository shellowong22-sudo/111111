CREATE TABLE `stock_fsrc_watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tickers` json NOT NULL,
	`coverage_snapshot` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_fsrc_watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_fsrc_watchlist_user_uq` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_research_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`preference_key` varchar(64) NOT NULL,
	`preference_value` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_research_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_research_preference_user_key_uq` UNIQUE(`user_id`,`preference_key`)
);
--> statement-breakpoint
CREATE INDEX `stock_fsrc_watchlist_user_updated_idx` ON `stock_fsrc_watchlists` (`user_id`,`updated_at`);