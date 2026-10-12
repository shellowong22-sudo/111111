CREATE TABLE `mktbeat_threshold_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`user_id` int NOT NULL,
	`series_id` varchar(16) NOT NULL,
	`window_days` int NOT NULL,
	`threshold_bps` decimal(10,1) NOT NULL,
	`observation_date` varchar(10) NOT NULL,
	`observed_change_bps` decimal(12,1) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mktbeat_threshold_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `mktbeat_threshold_notification_user_key_uq` UNIQUE(`user_id`,`notification_key`)
);
