CREATE TABLE `policy_evidence_annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`user_id` int NOT NULL,
	`category` enum('key_rate','policy_action','forward_guidance','manual_note') NOT NULL,
	`quoted_text` text NOT NULL,
	`annotation` text NOT NULL,
	`highlight_color` enum('amber','cyan','rose','emerald','violet') NOT NULL DEFAULT 'amber',
	`start_offset` int,
	`end_offset` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_evidence_annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `policy_evidence_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('document_captured','annotation_added','annotation_updated','shared','share_revoked','compared') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `policy_evidence_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `policy_evidence_document_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`can_edit` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `policy_evidence_document_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `policy_evidence_document_share_uq` UNIQUE(`document_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `policy_evidence_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_id` varchar(16) NOT NULL,
	`source_url` text NOT NULL,
	`title` varchar(240) NOT NULL,
	`document_fingerprint` varchar(64) NOT NULL,
	`retrieved_at` timestamp NOT NULL,
	`highlights` json NOT NULL,
	`guidance_evidence` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_evidence_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `policy_evidence_document_owner_fingerprint_uq` UNIQUE(`user_id`,`document_fingerprint`)
);
