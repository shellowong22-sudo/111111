CREATE TABLE `boom_subscription_preset_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`preset_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','shared','share_revoked','loaded') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `boom_subscription_preset_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boom_subscription_preset_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`preset_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`can_edit` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `boom_subscription_preset_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `boom_subscription_preset_share_uq` UNIQUE(`preset_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `boom_subscription_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(96) NOT NULL,
	`filters` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `boom_subscription_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `boom_subscription_preset_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `policy_evidence_annotation_mentions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`annotation_id` int NOT NULL,
	`mentioned_user_id` int NOT NULL,
	`status` enum('pending','resolved') NOT NULL DEFAULT 'pending',
	`response_note` text,
	`resolved_by_user_id` int,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_evidence_annotation_mentions_id` PRIMARY KEY(`id`),
	CONSTRAINT `policy_evidence_mention_annotation_user_uq` UNIQUE(`annotation_id`,`mentioned_user_id`)
);
--> statement-breakpoint
CREATE TABLE `policy_evidence_mention_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`mention_id` int NOT NULL,
	`user_id` int NOT NULL,
	`event_type` enum('mentioned','pending_reply') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `policy_evidence_mention_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `policy_evidence_mention_notification_key_uq` UNIQUE(`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `policy_evidence_version_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`older_document_id` int NOT NULL,
	`newer_document_id` int NOT NULL,
	`status` enum('pending','confirmed','follow_up') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`reviewed_by_user_id` int NOT NULL,
	`reviewed_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_evidence_version_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `policy_evidence_version_review_pair_uq` UNIQUE(`older_document_id`,`newer_document_id`)
);
--> statement-breakpoint
ALTER TABLE `policy_evidence_audit_events` MODIFY COLUMN `action` enum('document_captured','annotation_added','annotation_updated','shared','share_revoked','compared','mention_created','mention_resolved','version_reviewed') NOT NULL;