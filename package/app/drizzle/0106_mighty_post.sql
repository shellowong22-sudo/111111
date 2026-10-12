ALTER TABLE `admin_data_module_profiles` ADD `publish_schedule` varchar(120) DEFAULT 'manual_after_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_data_module_profiles` ADD `recommendation_rule` json;--> statement-breakpoint
ALTER TABLE `admin_data_module_profiles` ADD `dedupe_scope` enum('module','global','pushed') DEFAULT 'global' NOT NULL;