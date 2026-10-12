CREATE TABLE `mortgage_ledger_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`user_id` int NOT NULL,
	`ledger_id` int NOT NULL,
	`event_type` enum('review_submitted','review_due_soon','review_overdue') NOT NULL,
	`due_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mortgage_ledger_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `mortgage_ledger_notification_key_uq` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `mortgage_ledger_saved_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`name` varchar(96) NOT NULL,
	`config` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mortgage_ledger_saved_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `mortgage_ledger_view_user_module_name_uq` UNIQUE(`user_id`,`module_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `mortgage_taxonomy_tag_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag_id` int NOT NULL,
	`category_key` varchar(48) NOT NULL,
	`actor_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mortgage_taxonomy_tag_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `mortgage_taxonomy_tag_category_uq` UNIQUE(`tag_id`,`category_key`)
);
--> statement-breakpoint
CREATE TABLE `mortgage_taxonomy_tag_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`can_edit` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mortgage_taxonomy_tag_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `mortgage_taxonomy_tag_share_uq` UNIQUE(`tag_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `mortgage_taxonomy_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT 'cyan',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mortgage_taxonomy_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `mortgage_taxonomy_tag_owner_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `mortgage_shared_ledgers` ADD `review_due_at` timestamp;--> statement-breakpoint
ALTER TABLE `mortgage_shared_ledgers` ADD `review_reminder_hours` int DEFAULT 24 NOT NULL;