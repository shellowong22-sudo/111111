CREATE TABLE `credit_evidence_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidence_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','shared','share_revoked') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_evidence_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_evidence_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ticker` varchar(10) NOT NULL,
	`issuer` varchar(255),
	`form` varchar(16),
	`filing_date` varchar(10),
	`source_url` text NOT NULL,
	`quoted_text` text NOT NULL,
	`annotation` text NOT NULL,
	`highlight_color` enum('amber','cyan','rose','emerald') NOT NULL DEFAULT 'amber',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_evidence_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_evidence_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidence_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`can_edit` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_evidence_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_evidence_share_uq` UNIQUE(`evidence_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `credit_oas_threshold_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`user_id` int NOT NULL,
	`rule_id` int NOT NULL,
	`series_id` varchar(16) NOT NULL,
	`observation_date` varchar(10) NOT NULL,
	`observed_bps` decimal(10,1) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_oas_threshold_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_oas_threshold_notification_key_uq` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `credit_oas_threshold_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`series_id` enum('BAMLC0A0CM','BAMLH0A0HYM2') NOT NULL,
	`threshold_bps` decimal(10,1) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_oas_threshold_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_oas_threshold_rule_user_series_uq` UNIQUE(`user_id`,`series_id`)
);
