CREATE TABLE `admin_data_module_runtime_controls` (
	`module_id` varchar(96) NOT NULL,
	`data_mode` enum('inherit','real','simulated','paused') NOT NULL DEFAULT 'inherit',
	`is_enabled` boolean NOT NULL DEFAULT true,
	`admin_detail` varchar(600),
	`updated_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_data_module_runtime_controls_module_id` PRIMARY KEY(`module_id`)
);
--> statement-breakpoint
CREATE INDEX `admin_data_module_runtime_mode_updated_idx` ON `admin_data_module_runtime_controls` (`data_mode`,`updated_at`);--> statement-breakpoint
CREATE INDEX `admin_data_module_runtime_enabled_updated_idx` ON `admin_data_module_runtime_controls` (`is_enabled`,`updated_at`);