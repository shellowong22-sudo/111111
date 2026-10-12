CREATE TABLE `checklist_template_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('archived','restored','shared','share_revoked','visibility_changed') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_template_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `archived_at` timestamp;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `archived_by_user_id` int;