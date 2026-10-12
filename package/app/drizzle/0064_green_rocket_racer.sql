CREATE TABLE `portfolio_risk_guardrail_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`guardrail_id` int NOT NULL,
	`version_number` int NOT NULL,
	`change_type` enum('created','updated','deleted') NOT NULL,
	`previous_state` json,
	`current_state` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_risk_guardrail_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolio_risk_guardrail_version_uq` UNIQUE(`user_id`,`guardrail_id`,`version_number`)
);
--> statement-breakpoint
CREATE INDEX `portfolio_risk_guardrail_version_user_created_idx` ON `portfolio_risk_guardrail_versions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `portfolio_risk_guardrail_version_user_guardrail_idx` ON `portfolio_risk_guardrail_versions` (`user_id`,`guardrail_id`,`created_at`);