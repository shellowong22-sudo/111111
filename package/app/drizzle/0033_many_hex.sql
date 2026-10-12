CREATE TABLE `preferred_research_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','evidence_saved','evidence_removed','submitted','status_changed') NOT NULL,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `preferred_research_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `preferred_research_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`source_url` text NOT NULL,
	`title` varchar(240) NOT NULL,
	`source_institution` varchar(160) NOT NULL,
	`document_type` enum('prospectus','annual_report','quarterly_report','current_report','security_registration','other_official') NOT NULL,
	`document_date` date,
	`document_fingerprint` varchar(64) NOT NULL,
	`evidence_extracts` json NOT NULL,
	`retrieved_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `preferred_research_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `preferred_research_evidence_fingerprint_uq` UNIQUE(`package_id`,`document_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `preferred_research_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`issuer_name` varchar(240) NOT NULL,
	`cik` varchar(10),
	`status` enum('draft','submitted','approved','changes_requested') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `preferred_research_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `preferred_research_package_owner_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `preferred_research_audit_package_idx` ON `preferred_research_audit_events` (`package_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `preferred_research_evidence_package_idx` ON `preferred_research_evidence` (`package_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `preferred_research_package_issuer_idx` ON `preferred_research_packages` (`issuer_name`,`updated_at`);