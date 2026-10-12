CREATE TABLE `comms_research_reminder_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(220) NOT NULL,
	`rule_id` int NOT NULL,
	`thread_id` int NOT NULL,
	`user_id` int NOT NULL,
	`due_at` timestamp NOT NULL,
	`lead_hours` int NOT NULL,
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comms_research_reminder_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `comms_reminder_event_key_uq` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `comms_research_reminder_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thread_id` int NOT NULL,
	`owner_user_id` int NOT NULL,
	`lead_hours` int NOT NULL DEFAULT 24,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comms_research_reminder_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `comms_reminder_rule_thread_owner_uq` UNIQUE(`thread_id`,`owner_user_id`)
);
--> statement-breakpoint
CREATE INDEX `comms_reminder_event_user_created_idx` ON `comms_research_reminder_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comms_reminder_event_thread_idx` ON `comms_research_reminder_events` (`thread_id`);--> statement-breakpoint
CREATE INDEX `comms_reminder_rule_owner_active_idx` ON `comms_research_reminder_rules` (`owner_user_id`,`is_active`);