CREATE TABLE IF NOT EXISTS `official_news_feed_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_kind` varchar(32) NOT NULL,
  `source_id_hash` varchar(64) NOT NULL,
  `source_id` varchar(320) NOT NULL,
  `headline` varchar(600) NOT NULL,
  `excerpt` text DEFAULT NULL,
  `source_url` varchar(1200) NOT NULL,
  `published_at` timestamp NULL DEFAULT NULL,
  `retrieved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `official_news_source_item_uq` (`source_kind`,`source_id_hash`),
  KEY `official_news_source_published_idx` (`source_kind`,`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
