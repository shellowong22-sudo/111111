ALTER TABLE `admin_data_module_automation_run_items`
  MODIFY COLUMN `status` enum('queued','claimed','running','pending_review','pending_delivery','completed','skipped','failed','cancelled') NOT NULL DEFAULT 'queued';
--> statement-breakpoint
ALTER TABLE `admin_data_module_automation_run_items`
  ADD COLUMN `item_key` varchar(160) NULL,
  ADD COLUMN `current_step` varchar(120) NOT NULL DEFAULT 'queued',
  ADD COLUMN `priority` int NOT NULL DEFAULT 100,
  ADD COLUMN `max_attempts` int NOT NULL DEFAULT 3,
  ADD COLUMN `retry_after` timestamp NULL,
  ADD COLUMN `lease_token` varchar(80) NULL,
  ADD COLUMN `lease_expires_at` timestamp NULL,
  ADD COLUMN `idempotency_key` varchar(190) NULL,
  ADD COLUMN `result_summary` json NULL;
--> statement-breakpoint
UPDATE `admin_data_module_automation_run_items`
  SET `item_key` = CONCAT('legacy-', `id`), `idempotency_key` = CONCAT('legacy-', `id`)
  WHERE `item_key` IS NULL OR `idempotency_key` IS NULL;
--> statement-breakpoint
ALTER TABLE `admin_data_module_automation_run_items`
  MODIFY COLUMN `item_key` varchar(160) NOT NULL;
--> statement-breakpoint
ALTER TABLE `admin_data_module_automation_run_items`
  MODIFY COLUMN `idempotency_key` varchar(190) NOT NULL;
--> statement-breakpoint
ALTER TABLE `admin_data_module_automation_run_items`
  ADD CONSTRAINT `admin_data_module_automation_run_items_item_key_unique` UNIQUE(`item_key`);
--> statement-breakpoint
ALTER TABLE `admin_data_module_automation_run_items`
  ADD CONSTRAINT `admin_data_module_automation_run_items_idempotency_key_unique` UNIQUE(`idempotency_key`);
--> statement-breakpoint
CREATE TABLE `admin_data_module_automation_step_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `run_id` int NOT NULL,
  `job_item_id` int,
  `module_id` varchar(96),
  `step` varchar(120) NOT NULL,
  `action` varchar(80) NOT NULL,
  `status` enum('started','success','failed','skipped','cancelled') NOT NULL,
  `detail` varchar(1800) NOT NULL,
  `duration_ms` int,
  `actor_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `admin_data_module_automation_step_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_content_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `content_key` varchar(160) NOT NULL,
  `module_id` varchar(96) NOT NULL,
  `run_id` int,
  `job_item_id` int,
  `delivery_version_id` int,
  `content_type` enum('market_snapshot','news_article','announcement','download','generic') NOT NULL DEFAULT 'generic',
  `source_kind` enum('real','simulated','mixed') NOT NULL,
  `status` enum('generated','pending_review','approved','rejected','queued_for_delivery','delivered','skipped_duplicate','failed','reverted') NOT NULL DEFAULT 'generated',
  `title` varchar(700) NOT NULL,
  `body` text,
  `asset_url` varchar(1200),
  `topic` varchar(200),
  `category` varchar(80),
  `keywords` json NOT NULL,
  `tags` json NOT NULL,
  `sort_weight` int NOT NULL DEFAULT 100,
  `scheduled_for` timestamp,
  `published_at` timestamp,
  `source_reference` varchar(1200),
  `target_payload` json,
  `content_hash` varchar(64) NOT NULL,
  `dedupe_scope` varchar(128) NOT NULL DEFAULT 'global',
  `quality_score` int NOT NULL DEFAULT 0,
  `reviewed_by_user_id` int,
  `reviewed_at` timestamp,
  `delivery_attempts` int NOT NULL DEFAULT 0,
  `error_detail` varchar(1800),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_data_module_content_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `admin_data_module_content_items_content_key_unique` UNIQUE(`content_key`),
  CONSTRAINT `admin_mod_content_dedupe_uq` UNIQUE(`dedupe_scope`,`content_hash`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_delivery_operations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `operation_key` varchar(160) NOT NULL,
  `idempotency_key` varchar(190) NOT NULL,
  `module_id` varchar(96) NOT NULL,
  `run_id` int,
  `job_item_id` int,
  `delivery_version_id` int,
  `status` enum('queued','applying','applied','failed','reverted','cancelled') NOT NULL DEFAULT 'queued',
  `target_contract` varchar(160) NOT NULL,
  `target_reference` varchar(300) NOT NULL,
  `payload_hash` varchar(64) NOT NULL,
  `candidate_payload` json NOT NULL,
  `previous_target_snapshot` json,
  `result_snapshot` json,
  `item_count` int NOT NULL DEFAULT 0,
  `error_detail` varchar(1800),
  `applied_at` timestamp,
  `reverted_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_data_module_delivery_operations_id` PRIMARY KEY(`id`),
  CONSTRAINT `admin_data_module_delivery_operations_operation_key_unique` UNIQUE(`operation_key`),
  CONSTRAINT `admin_data_module_delivery_operations_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_execution_locks` (
  `lock_key` varchar(190) NOT NULL,
  `lease_token` varchar(80) NOT NULL,
  `owner_kind` varchar(80) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `acquired_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_data_module_execution_locks_lock_key` PRIMARY KEY(`lock_key`)
);
--> statement-breakpoint
CREATE TABLE `admin_data_module_request_cache` (
  `cache_key` varchar(190) NOT NULL,
  `status` enum('ready','pending','failed') NOT NULL DEFAULT 'pending',
  `value` json,
  `error_detail` varchar(1000),
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_data_module_request_cache_cache_key` PRIMARY KEY(`cache_key`)
);
--> statement-breakpoint
CREATE INDEX `admin_mod_run_item_status_priority_idx` ON `admin_data_module_automation_run_items` (`status`,`priority`,`created_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_run_item_lease_idx` ON `admin_data_module_automation_run_items` (`lease_expires_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_step_run_created_idx` ON `admin_data_module_automation_step_events` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_step_item_created_idx` ON `admin_data_module_automation_step_events` (`job_item_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_step_module_created_idx` ON `admin_data_module_automation_step_events` (`module_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_content_module_status_idx` ON `admin_data_module_content_items` (`module_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_content_run_status_idx` ON `admin_data_module_content_items` (`run_id`,`status`);
--> statement-breakpoint
CREATE INDEX `admin_mod_content_version_idx` ON `admin_data_module_content_items` (`delivery_version_id`);
--> statement-breakpoint
CREATE INDEX `admin_mod_delivery_operation_module_status_idx` ON `admin_data_module_delivery_operations` (`module_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_delivery_operation_version_idx` ON `admin_data_module_delivery_operations` (`delivery_version_id`);
--> statement-breakpoint
CREATE INDEX `admin_mod_delivery_operation_run_idx` ON `admin_data_module_delivery_operations` (`run_id`);
--> statement-breakpoint
CREATE INDEX `admin_mod_execution_lock_expires_idx` ON `admin_data_module_execution_locks` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `admin_mod_request_cache_expires_idx` ON `admin_data_module_request_cache` (`expires_at`);
