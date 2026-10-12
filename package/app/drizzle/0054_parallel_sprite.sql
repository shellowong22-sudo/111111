CREATE TABLE `cross_module_research_path_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`path_id` varchar(96) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cross_module_research_path_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `cross_path_favorite_user_path_uq` UNIQUE(`user_id`,`path_id`)
);
--> statement-breakpoint
CREATE TABLE `cross_module_research_path_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_user_id` int NOT NULL,
	`path_id` varchar(96) NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cross_module_research_path_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `cross_path_share_owner_path_member_uq` UNIQUE(`owner_user_id`,`path_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `legacy_field_access_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`grant_id` int NOT NULL,
	`subject_user_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('requested','authorized','denied','exported') NOT NULL,
	`source_id` varchar(64) NOT NULL,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legacy_field_access_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cross_path_favorite_user_updated_idx` ON `cross_module_research_path_favorites` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `cross_path_share_member_updated_idx` ON `cross_module_research_path_shares` (`shared_with_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `cross_path_share_owner_path_idx` ON `cross_module_research_path_shares` (`owner_user_id`,`path_id`);--> statement-breakpoint
CREATE INDEX `legacy_field_access_audit_subject_created_idx` ON `legacy_field_access_audit_events` (`subject_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `legacy_field_access_audit_actor_created_idx` ON `legacy_field_access_audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `legacy_field_access_audit_grant_created_idx` ON `legacy_field_access_audit_events` (`grant_id`,`created_at`);