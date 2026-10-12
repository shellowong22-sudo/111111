CREATE TABLE `nceo_simulation_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`position_id` int,
	`action` enum('model_refreshed','position_created','position_closed','csv_exported') NOT NULL,
	`event_summary` varchar(255) NOT NULL,
	`parameters` json NOT NULL,
	`source_boundary` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nceo_simulation_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nceo_simulation_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`symbol` varchar(16) NOT NULL,
	`contract_label` varchar(160) NOT NULL,
	`direction` enum('long','short') NOT NULL,
	`reference_price` decimal(24,8) NOT NULL,
	`quantity` int NOT NULL,
	`model_basis` varchar(160) NOT NULL,
	`source_boundary` text NOT NULL,
	`parameters` json NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nceo_simulation_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `nceo_simulation_audit_user_created_idx` ON `nceo_simulation_audit_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `nceo_simulation_audit_position_idx` ON `nceo_simulation_audit_events` (`position_id`);--> statement-breakpoint
CREATE INDEX `nceo_simulation_positions_user_created_idx` ON `nceo_simulation_positions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `nceo_simulation_positions_user_status_idx` ON `nceo_simulation_positions` (`user_id`,`status`);