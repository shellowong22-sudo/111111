CREATE TABLE `news_research_evidence_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('captured','status_updated','note_updated') NOT NULL,
	`note` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_research_evidence_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news_research_evidence_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_kind` enum('sec_press','fed_monetary','fed_research','sec_filing') NOT NULL,
	`source_id` varchar(320) NOT NULL,
	`institution` varchar(180) NOT NULL,
	`headline` varchar(600) NOT NULL,
	`published_at` timestamp,
	`source_url` varchar(1200) NOT NULL,
	`excerpt` text,
	`status` enum('captured','reading','verified','closed') NOT NULL DEFAULT 'captured',
	`research_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_research_evidence_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_evidence_user_source_uq` UNIQUE(`user_id`,`source_kind`,`source_id`)
);
--> statement-breakpoint
CREATE INDEX `news_evidence_audit_card_created_idx` ON `news_research_evidence_audit_events` (`card_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `news_evidence_user_status_updated_idx` ON `news_research_evidence_cards` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `news_evidence_published_idx` ON `news_research_evidence_cards` (`published_at`);