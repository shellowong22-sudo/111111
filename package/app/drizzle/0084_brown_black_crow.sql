CREATE TABLE `equity_quote_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country_code` varchar(4) NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`range` enum('1mo','3mo','6mo','1y','2y','5y') NOT NULL,
	`source` varchar(64) NOT NULL,
	`status` enum('available','unavailable') NOT NULL,
	`price` decimal(24,8),
	`change_value` decimal(24,8),
	`change_pct` decimal(16,6),
	`currency` varchar(16),
	`market_state` varchar(32),
	`observation_at` timestamp,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`unavailable_reason` varchar(255),
	CONSTRAINT `equity_quote_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `equity_quote_snapshots_uq` UNIQUE(`country_code`,`symbol`,`range`,`source`)
);
--> statement-breakpoint
CREATE INDEX `equity_quote_snapshots_symbol_idx` ON `equity_quote_snapshots` (`symbol`);--> statement-breakpoint
CREATE INDEX `equity_quote_snapshots_fetched_idx` ON `equity_quote_snapshots` (`fetched_at`);