CREATE TABLE `stock_nceo_watchlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`item_key` varchar(96) NOT NULL,
	`item_type` enum('stock','nceo_model') NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`display_name` varchar(160) NOT NULL,
	`option_side` enum('call','put'),
	`expiry_days` int,
	`display_order` int NOT NULL DEFAULT 0,
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_nceo_watchlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_nceo_watchlist_user_key_uq` UNIQUE(`user_id`,`item_key`)
);
--> statement-breakpoint
CREATE TABLE `stock_nceo_watchlist_layouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`grid_columns` enum('1','2','3','4') NOT NULL DEFAULT '2',
	`visible_columns` json NOT NULL,
	`layout_name` varchar(64) NOT NULL DEFAULT '股票与 NCEO 研究屏风',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_nceo_watchlist_layouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_nceo_watchlist_layouts_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE INDEX `stock_nceo_watchlist_user_order_idx` ON `stock_nceo_watchlist_items` (`user_id`,`display_order`);