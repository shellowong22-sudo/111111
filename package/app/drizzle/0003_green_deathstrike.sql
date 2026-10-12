CREATE TABLE `research_ledger_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entry_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`action` enum('submitted','approved','rejected') NOT NULL,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_ledger_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_ledger_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_code` varchar(32) NOT NULL,
	`instrument` varchar(255) NOT NULL,
	`purpose` text NOT NULL,
	`verified_source` text NOT NULL,
	`method_basis` text NOT NULL,
	`compliance_confirmed` boolean NOT NULL DEFAULT false,
	`status` enum('submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
	`reviewer_id` int,
	`review_note` text,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_ledger_entries_id` PRIMARY KEY(`id`)
);
