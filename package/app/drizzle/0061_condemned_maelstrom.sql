CREATE TABLE `bond_portfolio_scenario_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`positions` json NOT NULL,
	`magnitude_bp` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bond_portfolio_scenario_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `bond_portfolio_scenario_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_risk_event_action_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_event_id` int NOT NULL,
	`previous_status` enum('open','reviewing','resolved'),
	`status` enum('open','reviewing','resolved') NOT NULL,
	`note` varchar(800),
	`handled_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_risk_event_action_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bond_portfolio_scenario_user_updated_idx` ON `bond_portfolio_scenario_snapshots` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `portfolio_risk_audit_user_event_created_idx` ON `portfolio_risk_event_action_audits` (`user_id`,`source_event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `portfolio_risk_audit_user_status_created_idx` ON `portfolio_risk_event_action_audits` (`user_id`,`status`,`created_at`);