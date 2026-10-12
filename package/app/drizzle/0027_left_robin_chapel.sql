CREATE TABLE `mmflow_delivery_package_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','submitted','shared','share_revoked','reviewed','status_changed') NOT NULL,
	`target_user_id` int,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mmflow_delivery_package_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mmflow_delivery_package_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`reviewer_user_id` int NOT NULL,
	`status` enum('pending','approved','changes_requested') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`reviewed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mmflow_delivery_package_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `mmflow_delivery_package_reviewer_uq` UNIQUE(`package_id`,`reviewer_user_id`)
);
--> statement-breakpoint
CREATE TABLE `mmflow_delivery_package_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('viewer','editor','reviewer') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mmflow_delivery_package_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `mmflow_delivery_package_share_uq` UNIQUE(`package_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `mmflow_delivery_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`source_ids` json NOT NULL,
	`status` enum('draft','submitted','approved','changes_requested') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mmflow_delivery_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `mmflow_delivery_package_user_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `source_freshness_digest_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`delivery_key` varchar(190) NOT NULL,
	`notification_id` int NOT NULL,
	`event_count` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_freshness_digest_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_freshness_digest_delivery_uq` UNIQUE(`rule_id`,`delivery_key`)
);
--> statement-breakpoint
CREATE TABLE `source_freshness_notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_key` varchar(190) NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`source_id` varchar(16) NOT NULL,
	`observation_date` varchar(16) NOT NULL,
	`age_days` int NOT NULL,
	`state` enum('stale','unavailable') NOT NULL,
	`delivery_status` enum('immediate','queued','delivered') NOT NULL DEFAULT 'immediate',
	`notification_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_freshness_notification_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_freshness_event_user_key_uq` UNIQUE(`user_id`,`notification_key`)
);
--> statement-breakpoint
CREATE TABLE `source_freshness_notification_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`source_id` varchar(16) NOT NULL,
	`threshold_days` int NOT NULL DEFAULT 7,
	`is_active` boolean NOT NULL DEFAULT true,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`digest_mode` enum('immediate','daily') NOT NULL DEFAULT 'immediate',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_freshness_notification_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_freshness_rule_user_source_uq` UNIQUE(`user_id`,`source_id`)
);
