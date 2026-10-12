CREATE TABLE `portfolio_risk_oas_view_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`selected_buckets` json NOT NULL,
	`start_date` varchar(16),
	`end_date` varchar(16),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_risk_oas_view_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolio_risk_oas_view_preset_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `portfolio_risk_oas_view_preset_user_updated_idx` ON `portfolio_risk_oas_view_presets` (`user_id`,`updated_at`);