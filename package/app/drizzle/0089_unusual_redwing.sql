CREATE TABLE `stock_nceo_watchlist_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` varchar(160),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_nceo_watchlist_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_nceo_watchlist_collections_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `stock_nceo_watchlist_items` ADD `collection_id` int;--> statement-breakpoint
CREATE INDEX `stock_nceo_watchlist_collections_user_updated_idx` ON `stock_nceo_watchlist_collections` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `stock_nceo_watchlist_collection_order_idx` ON `stock_nceo_watchlist_items` (`user_id`,`collection_id`,`display_order`);