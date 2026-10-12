CREATE TABLE IF NOT EXISTS `agent_reach_module_grants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `record_uuid` varchar(64) NOT NULL,
  `module_id` varchar(96) NOT NULL,
  `follow_rss` boolean NOT NULL DEFAULT false,
  `rss_url` varchar(1200) DEFAULT NULL,
  `is_enabled` boolean NOT NULL DEFAULT true,
  `approved_by_user_id` int NOT NULL,
  `approved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_reach_grant_record_module_uq` (`record_uuid`,`module_id`),
  KEY `agent_reach_grant_rss_idx` (`is_enabled`,`follow_rss`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
