CREATE TABLE IF NOT EXISTS `ucheer_ai_conversations` (
  `id` varchar(36) NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(160) NOT NULL,
  `last_summarized_message_id` bigint NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ucheer_ai_conversations_user_updated_idx` (`user_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ucheer_ai_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` varchar(36) NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('user','assistant') NOT NULL,
  `content` text NOT NULL,
  `feedback` enum('helpful','unhelpful') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ucheer_ai_messages_user_conversation_idx` (`user_id`, `conversation_id`, `id`),
  KEY `ucheer_ai_messages_feedback_idx` (`feedback`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ucheer_ai_memories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `kind` enum('core','daily') NOT NULL,
  `content` varchar(600) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ucheer_ai_memories_user_fingerprint_uq` (`user_id`, `fingerprint`),
  KEY `ucheer_ai_memories_user_kind_updated_idx` (`user_id`, `kind`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
