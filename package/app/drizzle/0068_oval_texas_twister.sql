CREATE TABLE `municipal_issuer_evidence_search_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`package_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`query` varchar(400),
	`tag` varchar(80),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipal_issuer_evidence_search_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_search_preset_uq` UNIQUE(`user_id`,`package_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `municipal_issuer_evidence_search_preset_idx` ON `municipal_issuer_evidence_search_presets` (`user_id`,`package_id`,`updated_at`);