CREATE TABLE `legacy_field_access_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_id` varchar(64) NOT NULL,
	`status` enum('requested','authorized','denied') NOT NULL DEFAULT 'requested',
	`reason` varchar(500),
	`requested_at` timestamp NOT NULL DEFAULT (now()),
	`decided_at` timestamp,
	`decided_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legacy_field_access_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `legacy_field_access_user_source_uq` UNIQUE(`user_id`,`source_id`)
);
--> statement-breakpoint
CREATE INDEX `legacy_field_access_status_requested_idx` ON `legacy_field_access_grants` (`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `legacy_field_access_user_updated_idx` ON `legacy_field_access_grants` (`user_id`,`updated_at`);