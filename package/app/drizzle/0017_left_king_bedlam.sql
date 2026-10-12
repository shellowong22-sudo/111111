ALTER TABLE `credit_research_package_audit_events` MODIFY COLUMN `action` enum('created','updated','template_applied','shared','share_revoked','submitted','approved','changes_requested','approval_due_set','revision_created') NOT NULL;--> statement-breakpoint
ALTER TABLE `credit_research_packages` ADD `revision_of_package_id` int;--> statement-breakpoint
ALTER TABLE `credit_research_packages` ADD `approval_due_at` timestamp;--> statement-breakpoint
ALTER TABLE `credit_research_packages` ADD `approval_reminder_days` int DEFAULT 3 NOT NULL;