CREATE TABLE `trade_book_private_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`as_of_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_book_private_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trade_book_private_cash_flows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`flow_id` varchar(120) NOT NULL,
	`account_label` varchar(120) NOT NULL,
	`flow_type` varchar(48) NOT NULL,
	`amount` decimal(24,6) NOT NULL,
	`currency` varchar(12),
	`instrument` varchar(160),
	`occurred_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_book_private_cash_flows_id` PRIMARY KEY(`id`),
	CONSTRAINT `trade_book_private_cash_flow_uq` UNIQUE(`user_id`,`batch_id`,`flow_id`)
);
--> statement-breakpoint
CREATE TABLE `trade_book_private_position_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`snapshot_id` varchar(120) NOT NULL,
	`account_label` varchar(120) NOT NULL,
	`instrument` varchar(160) NOT NULL,
	`quantity` decimal(24,6) NOT NULL,
	`market_price` decimal(24,8),
	`cost_basis` decimal(24,6),
	`currency` varchar(12),
	`snapshot_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_book_private_position_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `trade_book_private_position_uq` UNIQUE(`user_id`,`batch_id`,`snapshot_id`)
);
--> statement-breakpoint
CREATE INDEX `trade_book_private_batch_user_created_idx` ON `trade_book_private_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `trade_book_private_cash_flow_user_batch_idx` ON `trade_book_private_cash_flows` (`user_id`,`batch_id`);--> statement-breakpoint
CREATE INDEX `trade_book_private_position_user_batch_idx` ON `trade_book_private_position_snapshots` (`user_id`,`batch_id`);