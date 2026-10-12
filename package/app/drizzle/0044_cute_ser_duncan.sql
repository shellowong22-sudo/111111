CREATE TABLE `forex_same_day_timeline_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`central_bank_ids` text NOT NULL,
	`pair_ids` text NOT NULL,
	`actions` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forex_same_day_timeline_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `forex_same_day_preset_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `forex_same_day_preset_user_updated_idx` ON `forex_same_day_timeline_presets` (`user_id`,`updated_at`);