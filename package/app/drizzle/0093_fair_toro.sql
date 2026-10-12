CREATE TABLE `admin_market_data_provider_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_code` varchar(48) NOT NULL,
	`provider_name` varchar(120) NOT NULL,
	`api_base_url` varchar(1200) NOT NULL,
	`api_key_env_name` varchar(80) NOT NULL,
	`market_coverage` json NOT NULL,
	`delay_level` enum('unknown','realtime','delayed','end_of_day') NOT NULL DEFAULT 'unknown',
	`capabilities` json NOT NULL,
	`connection_status` enum('not_configured','key_missing','adapter_pending','available','unavailable') NOT NULL DEFAULT 'not_configured',
	`last_validated_at` timestamp,
	`last_error` varchar(600),
	`is_active` boolean NOT NULL DEFAULT false,
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_market_data_provider_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_market_provider_code_uq` UNIQUE(`provider_code`)
);
--> statement-breakpoint
CREATE INDEX `admin_market_provider_status_idx` ON `admin_market_data_provider_configs` (`connection_status`,`updated_at`);