CREATE TABLE `equity_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country` varchar(64) NOT NULL,
	`country_code` varchar(4) NOT NULL,
	`exchange` varchar(128) NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`source_file` varchar(255) NOT NULL,
	`source_sheet` varchar(128) NOT NULL,
	`source_row` int NOT NULL,
	`source_content_sha256` varchar(64) NOT NULL,
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `equity_listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `equity_listings_country_symbol_uq` UNIQUE(`country_code`,`symbol`)
);
--> statement-breakpoint
CREATE INDEX `equity_listings_country_idx` ON `equity_listings` (`country_code`);--> statement-breakpoint
CREATE INDEX `equity_listings_symbol_idx` ON `equity_listings` (`symbol`);