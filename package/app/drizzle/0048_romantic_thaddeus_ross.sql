CREATE TABLE `comms_research_thread_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thread_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','member_added','message_posted','acknowledged','resolved') NOT NULL,
	`target_user_id` int,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comms_research_thread_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comms_research_thread_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thread_id` int NOT NULL,
	`user_id` int NOT NULL,
	`permission` enum('viewer','contributor') NOT NULL DEFAULT 'contributor',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comms_research_thread_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `comms_thread_member_uq` UNIQUE(`thread_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `comms_research_thread_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thread_id` int NOT NULL,
	`author_user_id` int NOT NULL,
	`body` text NOT NULL,
	`message_type` enum('note','question','decision') NOT NULL DEFAULT 'note',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comms_research_thread_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comms_research_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_user_id` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`purpose` enum('brief','question','handoff','decision') NOT NULL,
	`module_code` varchar(32) NOT NULL DEFAULT 'COMMS',
	`classification` enum('internal','restricted') NOT NULL DEFAULT 'internal',
	`status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
	`due_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comms_research_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `comms_thread_audit_thread_created_idx` ON `comms_research_thread_audit_events` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comms_thread_member_user_idx` ON `comms_research_thread_members` (`user_id`,`thread_id`);--> statement-breakpoint
CREATE INDEX `comms_thread_message_thread_created_idx` ON `comms_research_thread_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comms_thread_owner_status_updated_idx` ON `comms_research_threads` (`owner_user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `comms_thread_due_idx` ON `comms_research_threads` (`due_at`);