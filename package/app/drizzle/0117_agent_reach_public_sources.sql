CREATE TABLE IF NOT EXISTS `agent_reach_public_sources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `url_hash` varchar(64) NOT NULL,
  `website_url` varchar(1200) NOT NULL,
  `feed_url` varchar(1200) DEFAULT NULL,
  `status` enum('available','unavailable') NOT NULL DEFAULT 'unavailable',
  `last_error` varchar(600) DEFAULT NULL,
  `last_checked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_items` int NOT NULL DEFAULT 0,
  `stored_count` int NOT NULL DEFAULT 0,
  `deduplicated_count` int NOT NULL DEFAULT 0,
  `created_by_user_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_reach_source_url_uq` (`url_hash`),
  KEY `agent_reach_source_status_idx` (`status`,`last_checked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
