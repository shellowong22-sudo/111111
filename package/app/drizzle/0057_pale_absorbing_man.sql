CREATE TABLE `economic_trend_window_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`region` enum('japan','uk') NOT NULL,
	`start_date` varchar(16) NOT NULL,
	`end_date` varchar(16) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `economic_trend_window_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `economic_trend_window_preset_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `economic_calendar_region_presets` MODIFY COLUMN `region` enum('all','us','eurozone','eu','japan','uk') NOT NULL;--> statement-breakpoint
CREATE INDEX `economic_trend_window_preset_user_updated_idx` ON `economic_trend_window_presets` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `economic_trend_window_preset_user_region_idx` ON `economic_trend_window_presets` (`user_id`,`region`);