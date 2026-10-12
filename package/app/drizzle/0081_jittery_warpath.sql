CREATE TABLE `terminal_watermark_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setting_key` varchar(48) NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`opacity_percent` int NOT NULL DEFAULT 45,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `terminal_watermark_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `terminal_watermark_settings_setting_key_unique` UNIQUE(`setting_key`)
);
