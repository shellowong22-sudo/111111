CREATE TABLE `portfolio_risk_guardrails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`max_portfolio_duration` decimal(18,6),
	`max_dv01` decimal(24,6),
	`max_scenario_loss` decimal(24,6),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_risk_guardrails_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolio_risk_guardrail_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_risk_research_dossiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`snapshot_id` int NOT NULL,
	`guardrail_id` int,
	`scenario` enum('parallel','steepener','butterfly') NOT NULL,
	`magnitude_bp` int NOT NULL,
	`total_market_value` decimal(24,6) NOT NULL,
	`total_dv01` decimal(24,6) NOT NULL,
	`portfolio_duration` decimal(18,6) NOT NULL,
	`estimated_pnl` decimal(24,6) NOT NULL,
	`breaches` json NOT NULL,
	`source_summary` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_risk_research_dossiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `portfolio_risk_guardrail_user_active_idx` ON `portfolio_risk_guardrails` (`user_id`,`is_active`,`updated_at`);--> statement-breakpoint
CREATE INDEX `portfolio_risk_dossier_user_created_idx` ON `portfolio_risk_research_dossiers` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `portfolio_risk_dossier_user_snapshot_idx` ON `portfolio_risk_research_dossiers` (`user_id`,`snapshot_id`);--> statement-breakpoint
CREATE INDEX `portfolio_risk_dossier_user_guardrail_idx` ON `portfolio_risk_research_dossiers` (`user_id`,`guardrail_id`);