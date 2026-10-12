CREATE TABLE `municipal_issuer_evidence_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','document_saved','document_removed','shared','share_revoked','submitted','reviewed','status_changed') NOT NULL,
	`target_user_id` int,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `municipal_issuer_evidence_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `municipal_issuer_evidence_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`source_url` text NOT NULL,
	`title` varchar(240) NOT NULL,
	`source_institution` varchar(160) NOT NULL,
	`document_type` enum('official_statement','annual_financial','operating_disclosure','event_notice','rating_material','other_official') NOT NULL,
	`document_date` date,
	`document_fingerprint` varchar(64) NOT NULL,
	`evidence_extracts` json NOT NULL,
	`retrieved_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipal_issuer_evidence_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_document_fingerprint_uq` UNIQUE(`package_id`,`document_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `municipal_issuer_evidence_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`issuer_name` varchar(240) NOT NULL,
	`issuer_identifier` varchar(80),
	`status` enum('draft','submitted','approved','changes_requested') NOT NULL DEFAULT 'draft',
	`approval_deadline_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipal_issuer_evidence_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_owner_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `municipal_issuer_evidence_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`reviewer_user_id` int NOT NULL,
	`status` enum('pending','approved','changes_requested') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`reviewed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipal_issuer_evidence_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_reviewer_uq` UNIQUE(`package_id`,`reviewer_user_id`)
);
--> statement-breakpoint
CREATE TABLE `municipal_issuer_evidence_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('viewer','editor','reviewer') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipal_issuer_evidence_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_share_uq` UNIQUE(`package_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `municipal_issuer_evidence_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`version` int NOT NULL,
	`document_snapshot` json NOT NULL,
	`status` enum('draft','submitted','approved','changes_requested') NOT NULL,
	`actor_user_id` int NOT NULL,
	`note` varchar(500),
	`snapshot_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `municipal_issuer_evidence_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_version_uq` UNIQUE(`package_id`,`version`)
);
--> statement-breakpoint
CREATE INDEX `municipal_issuer_evidence_audit_package_idx` ON `municipal_issuer_evidence_audit_events` (`package_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `municipal_issuer_evidence_document_package_idx` ON `municipal_issuer_evidence_documents` (`package_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `municipal_issuer_evidence_issuer_idx` ON `municipal_issuer_evidence_packages` (`issuer_name`,`updated_at`);