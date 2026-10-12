CREATE TABLE `cross_module_research_path_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_user_id` int NOT NULL,
	`path_id` varchar(96) NOT NULL,
	`author_user_id` int NOT NULL,
	`body` varchar(2000) NOT NULL,
	`review_status` enum('pending','confirmed','changes_requested') NOT NULL DEFAULT 'pending',
	`review_note` varchar(1000),
	`reviewed_by_user_id` int,
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cross_module_research_path_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cross_path_note_owner_path_created_idx` ON `cross_module_research_path_notes` (`owner_user_id`,`path_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cross_path_note_author_updated_idx` ON `cross_module_research_path_notes` (`author_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `cross_path_note_review_status_idx` ON `cross_module_research_path_notes` (`owner_user_id`,`review_status`,`updated_at`);