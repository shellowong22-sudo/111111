CREATE TABLE `stock_research_layouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`workspace_id` varchar(48) NOT NULL DEFAULT 'stock-research',
	`layout` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_research_layouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_research_layout_user_workspace_uq` UNIQUE(`user_id`,`workspace_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_sec_summary_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`cik` varchar(10) NOT NULL,
	`accession_number` varchar(32) NOT NULL,
	`primary_document` varchar(240) NOT NULL,
	`source_fingerprint` varchar(64) NOT NULL,
	`model` varchar(80) NOT NULL,
	`summary` json NOT NULL,
	`retrieved_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_sec_summary_audits_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_sec_summary_audit_user_source_uq` UNIQUE(`user_id`,`cik`,`accession_number`,`primary_document`,`source_fingerprint`)
);
--> statement-breakpoint
CREATE INDEX `stock_sec_summary_audit_user_created_idx` ON `stock_sec_summary_audits` (`user_id`,`created_at`);