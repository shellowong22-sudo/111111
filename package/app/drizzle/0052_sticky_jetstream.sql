CREATE TABLE `news_research_evidence_review_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card_id` int NOT NULL,
	`owner_user_id` int NOT NULL,
	`version` int NOT NULL,
	`summary` text NOT NULL,
	`status` enum('submitted','approved','changes_requested') NOT NULL DEFAULT 'submitted',
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`finalized_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_research_evidence_review_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_evidence_submission_card_version_uq` UNIQUE(`card_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `news_research_evidence_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submission_id` int NOT NULL,
	`reviewer_user_id` int NOT NULL,
	`decision` enum('approved','changes_requested') NOT NULL,
	`note` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_research_evidence_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_evidence_review_submission_reviewer_uq` UNIQUE(`submission_id`,`reviewer_user_id`)
);
--> statement-breakpoint
CREATE TABLE `news_research_evidence_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card_id` int NOT NULL,
	`owner_user_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('viewer','editor','reviewer') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_research_evidence_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_evidence_share_card_member_uq` UNIQUE(`card_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `news_research_source_freshness_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(220) NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`source_kind` enum('sec_press','fed_monetary','fed_research') NOT NULL,
	`latest_published_at` timestamp,
	`retrieved_at` timestamp NOT NULL,
	`age_hours` int,
	`state` enum('stale','unavailable') NOT NULL,
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_research_source_freshness_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_source_freshness_event_user_key_uq` UNIQUE(`user_id`,`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `news_research_source_freshness_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_kind` enum('sec_press','fed_monetary','fed_research') NOT NULL,
	`threshold_hours` int NOT NULL DEFAULT 72,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_research_source_freshness_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_source_freshness_rule_user_source_uq` UNIQUE(`user_id`,`source_kind`)
);
--> statement-breakpoint
ALTER TABLE `news_research_evidence_audit_events` MODIFY COLUMN `action` enum('captured','status_updated','note_updated','member_added','member_removed','review_submitted','review_approved','review_changes_requested') NOT NULL;--> statement-breakpoint
CREATE INDEX `news_evidence_submission_owner_status_idx` ON `news_research_evidence_review_submissions` (`owner_user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `news_evidence_review_submission_idx` ON `news_research_evidence_reviews` (`submission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `news_evidence_share_member_idx` ON `news_research_evidence_shares` (`shared_with_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `news_evidence_share_owner_idx` ON `news_research_evidence_shares` (`owner_user_id`,`card_id`);--> statement-breakpoint
CREATE INDEX `news_source_freshness_event_user_created_idx` ON `news_research_source_freshness_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `news_source_freshness_event_rule_created_idx` ON `news_research_source_freshness_events` (`rule_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `news_source_freshness_rule_user_active_idx` ON `news_research_source_freshness_rules` (`user_id`,`is_active`);