CREATE TABLE `order_management_research_batch_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`tag` varchar(60) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_management_research_batch_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_management_batch_tag_uq` UNIQUE(`user_id`,`batch_id`,`tag`)
);
--> statement-breakpoint
ALTER TABLE `order_management_research_batches` ADD `is_archived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `order_management_research_batches` ADD `archived_at` timestamp;--> statement-breakpoint
CREATE INDEX `order_management_batch_tag_user_tag_idx` ON `order_management_research_batch_tags` (`user_id`,`tag`);--> statement-breakpoint
CREATE INDEX `order_management_batch_tag_user_batch_idx` ON `order_management_research_batch_tags` (`user_id`,`batch_id`);