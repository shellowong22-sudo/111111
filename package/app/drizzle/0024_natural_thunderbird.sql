CREATE TABLE `gc_report_template_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','deleted','shared','share_revoked','reviewed') NOT NULL,
	`target_user_id` int,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gc_report_template_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gc_report_template_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`reviewer_user_id` int NOT NULL,
	`status` enum('pending','approved','changes_requested') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`reviewed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gc_report_template_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `gc_report_template_reviewer_uq` UNIQUE(`template_id`,`reviewer_user_id`)
);
--> statement-breakpoint
CREATE TABLE `gc_report_template_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('viewer','editor','reviewer') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gc_report_template_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `gc_report_template_share_uq` UNIQUE(`template_id`,`shared_with_user_id`)
);
