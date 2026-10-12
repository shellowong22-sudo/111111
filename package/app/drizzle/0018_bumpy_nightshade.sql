CREATE TABLE `mortgage_shared_ledger_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ledger_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','local_migrated','shared','share_revoked','submitted_for_review','approved','changes_requested','exported') NOT NULL,
	`target_user_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mortgage_shared_ledger_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mortgage_shared_ledger_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ledger_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('editor','reviewer','viewer') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mortgage_shared_ledger_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `mortgage_shared_ledger_share_uq` UNIQUE(`ledger_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `mortgage_shared_ledgers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`local_storage_key` varchar(96),
	`name` varchar(160) NOT NULL,
	`payload` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`review_status` enum('draft','in_review','approved','changes_requested') NOT NULL DEFAULT 'draft',
	`reviewed_by_user_id` int,
	`review_note` text,
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mortgage_shared_ledgers_id` PRIMARY KEY(`id`)
);
