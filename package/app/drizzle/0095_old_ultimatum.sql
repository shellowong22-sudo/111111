CREATE TABLE `admin_ai_generation_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generation_type` enum('news','report','course') NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`requested_count` int NOT NULL DEFAULT 1,
	`processed_count` int NOT NULL DEFAULT 0,
	`generated_count` int NOT NULL DEFAULT 0,
	`source_id` int,
	`article_id` int,
	`model` varchar(80),
	`detail` varchar(1200),
	`error` varchar(1000),
	`created_by_user_id` int NOT NULL,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_ai_generation_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_ai_generation_task_status_created_idx` ON `admin_ai_generation_tasks` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_ai_generation_task_type_created_idx` ON `admin_ai_generation_tasks` (`generation_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_ai_generation_task_article_idx` ON `admin_ai_generation_tasks` (`article_id`);