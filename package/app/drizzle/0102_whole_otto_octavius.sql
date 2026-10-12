CREATE TABLE `admin_data_module_automation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_key` varchar(80) NOT NULL,
	`scope` enum('single','group','site') NOT NULL,
	`module_id` varchar(96),
	`module_group` varchar(80),
	`trigger` enum('manual','scheduled','retry') NOT NULL DEFAULT 'manual',
	`mode` enum('fast_draft','rich_content') NOT NULL DEFAULT 'fast_draft',
	`status` enum('queued','running','completed','partial','failed','cancelled') NOT NULL DEFAULT 'queued',
	`current_step` varchar(160) NOT NULL DEFAULT 'queued',
	`requested_count` int NOT NULL DEFAULT 0,
	`queued_count` int NOT NULL DEFAULT 0,
	`running_count` int NOT NULL DEFAULT 0,
	`succeeded_count` int NOT NULL DEFAULT 0,
	`failed_count` int NOT NULL DEFAULT 0,
	`skipped_count` int NOT NULL DEFAULT 0,
	`retry_count` int NOT NULL DEFAULT 0,
	`started_at` timestamp,
	`completed_at` timestamp,
	`total_duration_ms` int,
	`error_detail` varchar(1800),
	`actor_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_data_module_automation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_data_module_automation_runs_run_key_unique` UNIQUE(`run_key`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_delivery_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` varchar(96) NOT NULL,
	`run_id` int,
	`delivery_version_id` int,
	`action` enum('generated','reviewed','push_started','pushed','push_failed','retried','reverted','cancelled') NOT NULL,
	`status` enum('pending','success','failed','skipped') NOT NULL,
	`target_contract` varchar(160) NOT NULL,
	`target_detail` varchar(900) NOT NULL,
	`item_count` int NOT NULL DEFAULT 0,
	`data_version` int,
	`duration_ms` int,
	`detail` varchar(1800) NOT NULL,
	`actor_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_data_module_delivery_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_delivery_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` varchar(96) NOT NULL,
	`run_id` int,
	`version` int NOT NULL,
	`status` enum('pending_review','approved','delivering','delivered','failed','reverted') NOT NULL DEFAULT 'pending_review',
	`target_contract` varchar(160) NOT NULL,
	`target_collection` varchar(160),
	`field_mapping` json NOT NULL,
	`payload_snapshot` json NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`source_kind` enum('real','simulated','mixed') NOT NULL,
	`item_count` int NOT NULL DEFAULT 0,
	`previous_version_id` int,
	`approved_by_user_id` int,
	`pushed_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`approved_at` timestamp,
	`pushed_at` timestamp,
	`reverted_at` timestamp,
	CONSTRAINT `admin_data_module_delivery_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_module_delivery_version_uq` UNIQUE(`module_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_profiles` (
	`module_id` varchar(96) NOT NULL,
	`module_group` varchar(80) NOT NULL,
	`module_category` varchar(80) NOT NULL,
	`owner_user_id` int,
	`display_area` varchar(300) NOT NULL,
	`frontend_interface` varchar(300) NOT NULL,
	`target_contract` varchar(160) NOT NULL,
	`target_collection` varchar(160),
	`field_mapping` json NOT NULL,
	`source_kind` enum('real','simulated','mixed','none') NOT NULL DEFAULT 'none',
	`source_reference` varchar(500),
	`theme` varchar(200),
	`keywords` json NOT NULL,
	`tags` json NOT NULL,
	`content_limit` int NOT NULL DEFAULT 10,
	`update_frequency_minutes` int NOT NULL DEFAULT 1440,
	`sort_weight` int NOT NULL DEFAULT 100,
	`automation_enabled` boolean NOT NULL DEFAULT false,
	`task_template` varchar(120) NOT NULL DEFAULT 'ingest-review-deliver',
	`execution_priority` int NOT NULL DEFAULT 100,
	`review_policy` enum('manual','auto_approved','disabled') NOT NULL DEFAULT 'manual',
	`push_policy` enum('manual','after_approval','disabled') NOT NULL DEFAULT 'after_approval',
	`retry_limit` int NOT NULL DEFAULT 3,
	`runtime_status` enum('enabled','paused','pending_generation','pending_review','pending_delivery','delivering','delivered','failed') NOT NULL DEFAULT 'enabled',
	`last_executed_at` timestamp,
	`last_pushed_at` timestamp,
	`current_version` int NOT NULL DEFAULT 0,
	`rollback_version` int,
	`updated_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_data_module_profiles_module_id` PRIMARY KEY(`module_id`)
);
--> statement-breakpoint
CREATE INDEX `admin_module_run_status_created_idx` ON `admin_data_module_automation_runs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_run_module_created_idx` ON `admin_data_module_automation_runs` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_run_group_created_idx` ON `admin_data_module_automation_runs` (`module_group`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_delivery_event_module_created_idx` ON `admin_data_module_delivery_events` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_delivery_event_run_created_idx` ON `admin_data_module_delivery_events` (`run_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_delivery_event_status_created_idx` ON `admin_data_module_delivery_events` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_delivery_status_created_idx` ON `admin_data_module_delivery_versions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_delivery_module_created_idx` ON `admin_data_module_delivery_versions` (`module_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_module_profile_group_idx` ON `admin_data_module_profiles` (`module_group`,`module_category`);--> statement-breakpoint
CREATE INDEX `admin_module_profile_runtime_idx` ON `admin_data_module_profiles` (`runtime_status`,`automation_enabled`);--> statement-breakpoint
CREATE INDEX `admin_module_profile_owner_idx` ON `admin_data_module_profiles` (`owner_user_id`,`updated_at`);