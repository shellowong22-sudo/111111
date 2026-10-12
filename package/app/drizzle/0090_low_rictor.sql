CREATE TABLE `stock_nceo_watchlist_collection_layouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`collection_id` int NOT NULL,
	`layout_name` varchar(64) NOT NULL DEFAULT '股票与 NCEO 研究屏风',
	`grid_columns` enum('1','2','3','4') NOT NULL DEFAULT '2',
	`visible_columns` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_nceo_watchlist_collection_layouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_nceo_watchlist_collection_layout_user_collection_uq` UNIQUE(`user_id`,`collection_id`)
);
