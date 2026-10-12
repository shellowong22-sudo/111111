CREATE TABLE `terminal_security_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_type` varchar(48) NOT NULL,
	`route_path` varchar(255) NOT NULL,
	`occurred_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `terminal_security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `terminal_security_event_user_time_idx` ON `terminal_security_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `terminal_security_event_type_time_idx` ON `terminal_security_events` (`event_type`,`occurred_at`);