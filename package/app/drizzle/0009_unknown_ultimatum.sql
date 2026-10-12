ALTER TABLE `checklist_template_audit_events` MODIFY COLUMN `action` enum('archived','restored','retention_set','submitted_for_review','review_approved','review_changes_requested','shared','share_revoked','visibility_changed') NOT NULL;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `retention_days` int;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `retention_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `archive_review_status` enum('not_required','pending','approved','changes_requested') DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `archive_reviewed_by_user_id` int;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `archive_reviewed_at` timestamp;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD `archive_review_note` text;