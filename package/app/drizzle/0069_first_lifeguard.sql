CREATE TABLE `order_management_research_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`as_of_at` timestamp NOT NULL,
	`record_count` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_management_research_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_management_research_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`event_id` varchar(120) NOT NULL,
	`order_id` varchar(120) NOT NULL,
	`parent_order_id` varchar(120),
	`event_type` enum('new','route','modify','cancel','partial_fill','fill','reject') NOT NULL,
	`instrument` varchar(120) NOT NULL,
	`asset_class` varchar(80),
	`side` enum('buy','sell') NOT NULL,
	`order_qty` decimal(24,6),
	`event_qty` decimal(24,6),
	`limit_price` decimal(24,8),
	`execution_price` decimal(24,8),
	`venue` varchar(120),
	`broker` varchar(120),
	`event_at` timestamp NOT NULL,
	`event_payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_management_research_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_management_event_user_batch_event_uq` UNIQUE(`user_id`,`batch_id`,`event_id`)
);
--> statement-breakpoint
CREATE INDEX `order_management_batch_user_created_idx` ON `order_management_research_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_management_event_user_batch_time_idx` ON `order_management_research_events` (`user_id`,`batch_id`,`event_at`);--> statement-breakpoint
CREATE INDEX `order_management_event_user_batch_order_idx` ON `order_management_research_events` (`user_id`,`batch_id`,`order_id`);