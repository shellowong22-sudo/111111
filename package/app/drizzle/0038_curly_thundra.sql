CREATE TABLE `commodity_watchlist_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT 'amber',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commodity_watchlist_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `commodity_watchlist_group_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `commodity_watchlists` ADD `group_id` int;--> statement-breakpoint
ALTER TABLE `commodity_watchlists` ADD `tags` json;--> statement-breakpoint
CREATE INDEX `commodity_watchlist_group_user_updated_idx` ON `commodity_watchlist_groups` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `commodity_watchlist_user_group_idx` ON `commodity_watchlists` (`user_id`,`group_id`);
