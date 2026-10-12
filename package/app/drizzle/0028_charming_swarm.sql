CREATE TABLE `mm_research_path_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`from_module_id` varchar(32) NOT NULL,
	`to_module_id` varchar(32) NOT NULL,
	`usage_count` int NOT NULL DEFAULT 0,
	`last_used_at` timestamp,
	`is_favorited` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mm_research_path_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `mm_research_path_favorite_uq` UNIQUE(`user_id`,`from_module_id`,`to_module_id`)
);
--> statement-breakpoint
CREATE TABLE `mmflow_delivery_package_deadline_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`user_id` int NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mmflow_delivery_package_deadline_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `mmflow_delivery_deadline_notification_uq` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `mmflow_delivery_package_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`version` int NOT NULL,
	`source_ids` json NOT NULL,
	`status` enum('draft','submitted','approved','changes_requested') NOT NULL,
	`snapshot_at` timestamp NOT NULL DEFAULT (now()),
	`actor_user_id` int NOT NULL,
	`note` varchar(500),
	CONSTRAINT `mmflow_delivery_package_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mmflow_delivery_package_version_uq` UNIQUE(`package_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `source_freshness_rule_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`owner_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('viewer','editor') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_freshness_rule_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_freshness_rule_share_uq` UNIQUE(`rule_id`,`shared_with_user_id`)
);
--> statement-breakpoint
ALTER TABLE `mmflow_delivery_packages` ADD `approval_deadline_at` timestamp;