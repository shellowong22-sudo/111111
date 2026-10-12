CREATE TABLE `credit_research_package_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','template_applied','shared','share_revoked','submitted','approved','changes_requested') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_research_package_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_research_package_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('editor','reviewer','viewer') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_research_package_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_research_package_share_uq` UNIQUE(`package_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `credit_research_package_signatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`signer_user_id` int NOT NULL,
	`signer_name` varchar(255),
	`action` enum('submitted','approved','changes_requested') NOT NULL,
	`attestation` text NOT NULL,
	`content_hash` varchar(128) NOT NULL,
	`signature_code` varchar(96) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_research_package_signatures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_research_package_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`sections` json NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_research_package_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_research_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`template_id` int,
	`title` varchar(180) NOT NULL,
	`research_question` text NOT NULL,
	`as_of_date` date,
	`source_url` text NOT NULL,
	`note` text,
	`sections` json NOT NULL,
	`status` enum('draft','submitted','changes_requested','approved') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`submitted_at` timestamp,
	`approved_at` timestamp,
	`approved_by_user_id` int,
	`approval_note` text,
	`content_hash` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_research_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_shared_workpaper_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workpaper_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','shared','share_revoked','submitted_for_review','approved','changes_requested') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_shared_workpaper_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_shared_workpaper_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workpaper_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('editor','reviewer','viewer') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_shared_workpaper_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_shared_workpaper_share_uq` UNIQUE(`workpaper_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `credit_shared_workpapers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`payload` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`review_status` enum('draft','in_review','approved','changes_requested') NOT NULL DEFAULT 'draft',
	`reviewed_by_user_id` int,
	`review_note` text,
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_shared_workpapers_id` PRIMARY KEY(`id`)
);
