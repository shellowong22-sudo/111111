CREATE TABLE IF NOT EXISTS `ucheer_ai_search_snapshots` (
  `query_hash` varchar(64) NOT NULL,
  `results` text NOT NULL,
  `fetched_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`query_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
