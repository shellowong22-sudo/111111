ALTER TABLE `ucheer_ai_conversations`
  ADD COLUMN `last_distill_attempted_message_id` bigint NOT NULL DEFAULT 0 AFTER `last_summarized_message_id`,
  ADD COLUMN `last_distill_status` enum('never','pending','running','completed','failed') NOT NULL DEFAULT 'never' AFTER `last_distill_attempted_message_id`,
  ADD COLUMN `last_distill_error` varchar(500) DEFAULT NULL AFTER `last_distill_status`,
  ADD COLUMN `last_distill_at` timestamp NULL DEFAULT NULL AFTER `last_distill_error`;
--> statement-breakpoint
ALTER TABLE `ucheer_ai_memories`
  ADD COLUMN `memory_key` varchar(120) NOT NULL DEFAULT '' AFTER `fingerprint`,
  ADD COLUMN `confidence` varchar(16) NOT NULL DEFAULT '0.70' AFTER `memory_key`,
  ADD COLUMN `evidence` varchar(600) NOT NULL DEFAULT '' AFTER `confidence`,
  ADD COLUMN `status` enum('active','superseded') NOT NULL DEFAULT 'active' AFTER `evidence`,
  ADD COLUMN `last_seen_message_id` bigint NOT NULL DEFAULT 0 AFTER `status`,
  ADD KEY `ucheer_ai_memories_user_key_idx` (`user_id`,`memory_key`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ucheer_ai_evolution_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `conversation_id` varchar(36) DEFAULT NULL,
  `event_type` enum('memory_captured','distillation_completed','distillation_failed','feedback_recorded') NOT NULL,
  `status` enum('completed','failed','skipped') NOT NULL,
  `processed_message_id` bigint DEFAULT NULL,
  `detail` varchar(500) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ucheer_ai_evolution_events_user_created_idx` (`user_id`,`created_at`),
  KEY `ucheer_ai_evolution_events_status_idx` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
