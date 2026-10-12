CREATE TABLE `forex_central_bank_decision_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_fingerprint` varchar(64) NOT NULL,
	`central_bank_id` varchar(24) NOT NULL,
	`central_bank_name` varchar(160) NOT NULL,
	`currency` varchar(8) NOT NULL,
	`decision_date` date NOT NULL,
	`published_at` timestamp,
	`effective_date` date,
	`decision` varchar(48) NOT NULL,
	`change_bps` int,
	`policy_rates` json NOT NULL,
	`vote_summary` varchar(240),
	`official_summary` text NOT NULL,
	`source_url` varchar(1000) NOT NULL,
	`retrieved_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forex_central_bank_decision_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `forex_cb_decision_source_uq` UNIQUE(`source_fingerprint`)
);
--> statement-breakpoint
CREATE INDEX `forex_cb_decision_bank_date_idx` ON `forex_central_bank_decision_events` (`central_bank_id`,`decision_date`);