CREATE TABLE `derivatives_oas_vix_date_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`range_a_start` varchar(10) NOT NULL,
	`range_a_end` varchar(10) NOT NULL,
	`range_b_start` varchar(10) NOT NULL,
	`range_b_end` varchar(10) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `derivatives_oas_vix_date_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `derivatives_oas_vix_preset_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `derivatives_oas_vix_preset_user_updated_idx` ON `derivatives_oas_vix_date_presets` (`user_id`,`updated_at`);