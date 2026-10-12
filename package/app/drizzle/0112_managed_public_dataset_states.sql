CREATE TABLE IF NOT EXISTS `managed_public_dataset_states` (
  `dataset_id` varchar(96) NOT NULL,
  `last_attempt_at` timestamp NULL DEFAULT NULL,
  `last_success_at` timestamp NULL DEFAULT NULL,
  `next_attempt_at` timestamp NULL DEFAULT NULL,
  `consecutive_failures` int NOT NULL DEFAULT 0,
  `last_status` varchar(32) NOT NULL DEFAULT 'never',
  `last_error` varchar(1000) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`dataset_id`),
  KEY `managed_public_dataset_states_next_idx` (`next_attempt_at`, `last_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
