CREATE TABLE `portfolio_risk_event_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_event_id` int NOT NULL,
	`status` enum('open','reviewing','resolved') NOT NULL DEFAULT 'open',
	`note` varchar(800),
	`handled_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_risk_event_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolio_risk_event_action_user_event_uq` UNIQUE(`user_id`,`source_event_id`)
);
--> statement-breakpoint
CREATE INDEX `portfolio_risk_event_action_user_status_updated_idx` ON `portfolio_risk_event_actions` (`user_id`,`status`,`updated_at`);