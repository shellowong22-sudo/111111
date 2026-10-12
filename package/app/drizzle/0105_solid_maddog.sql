CREATE TABLE `admin_data_module_system_settings` (
	`setting_key` varchar(96) NOT NULL,
	`category` varchar(64) NOT NULL,
	`value` json NOT NULL,
	`description` varchar(600),
	`updated_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_data_module_system_settings_setting_key` PRIMARY KEY(`setting_key`)
);
--> statement-breakpoint
CREATE INDEX `admin_mod_system_settings_category_updated_idx` ON `admin_data_module_system_settings` (`category`,`updated_at`);--> statement-breakpoint
