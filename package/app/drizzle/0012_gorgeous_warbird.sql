CREATE TABLE `checklist_deadline_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`user_id` int NOT NULL,
	`event_type` enum('signature_expiring','review_due') NOT NULL,
	`export_record_id` int,
	`template_id` int,
	`due_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_deadline_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `checklist_deadline_notification_events_notification_key_unique` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `sovereign_comparison_preset_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`preset_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sovereign_comparison_preset_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sovereign_comparison_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`countries` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sovereign_comparison_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `checklist_export_records` ADD `verification_expires_at` timestamp;