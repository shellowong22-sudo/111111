CREATE TABLE `index_constituent_archive_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_fingerprint` varchar(64) NOT NULL,
	`source_institution` varchar(160) NOT NULL,
	`source_url` varchar(1000) NOT NULL,
	`index_id` varchar(64) NOT NULL,
	`headline` varchar(320) NOT NULL,
	`announcement_date` date,
	`effective_date` date,
	`event_type` varchar(80) NOT NULL,
	`added` json NOT NULL,
	`removed` json NOT NULL,
	`retrieved_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `index_constituent_archive_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `index_constituent_archive_source_uq` UNIQUE(`source_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `index_research_basket_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`basket_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('created','updated','shared','share_revoked') NOT NULL,
	`target_user_id` int,
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `index_research_basket_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `index_research_basket_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`basket_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('viewer','editor') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `index_research_basket_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `index_research_basket_share_uq` UNIQUE(`basket_id`,`shared_with_user_id`)
);
--> statement-breakpoint
CREATE TABLE `index_research_baskets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL DEFAULT 'CIXB',
	`name` varchar(160) NOT NULL,
	`description` varchar(1000),
	`components` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `index_research_baskets_id` PRIMARY KEY(`id`),
	CONSTRAINT `index_research_basket_owner_name_uq` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `index_constituent_archive_index_date_idx` ON `index_constituent_archive_events` (`index_id`,`announcement_date`);--> statement-breakpoint
CREATE INDEX `index_research_basket_audit_idx` ON `index_research_basket_audit_events` (`basket_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `index_research_basket_owner_updated_idx` ON `index_research_baskets` (`user_id`,`updated_at`);