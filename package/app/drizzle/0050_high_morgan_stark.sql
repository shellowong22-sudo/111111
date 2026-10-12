CREATE TABLE `comms_research_thread_version_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version_id` int NOT NULL,
	`reviewer_user_id` int NOT NULL,
	`decision` enum('approved','changes_requested') NOT NULL,
	`note` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comms_research_thread_version_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `comms_version_reviewer_uq` UNIQUE(`version_id`,`reviewer_user_id`)
);
--> statement-breakpoint
CREATE TABLE `comms_research_thread_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thread_id` int NOT NULL,
	`owner_user_id` int NOT NULL,
	`version` int NOT NULL,
	`summary` text NOT NULL,
	`status` enum('draft','submitted','approved','changes_requested') NOT NULL DEFAULT 'draft',
	`submitted_at` timestamp,
	`finalized_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comms_research_thread_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `comms_thread_version_uq` UNIQUE(`thread_id`,`version`)
);
--> statement-breakpoint
CREATE INDEX `comms_version_review_version_created_idx` ON `comms_research_thread_version_reviews` (`version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comms_thread_version_owner_status_idx` ON `comms_research_thread_versions` (`owner_user_id`,`status`,`updated_at`);