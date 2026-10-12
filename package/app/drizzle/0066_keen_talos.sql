CREATE TABLE `municipal_research_view_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` varchar(20) NOT NULL,
	`name` varchar(80) NOT NULL,
	`window_size` int NOT NULL,
	`bucket_id` varchar(24),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `municipal_research_view_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_research_view_preset_owner_module_name_uq` UNIQUE(`user_id`,`module_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `municipal_issuer_evidence_documents` ADD `storage_key` varchar(512);--> statement-breakpoint
ALTER TABLE `municipal_issuer_evidence_documents` ADD `storage_url` text;--> statement-breakpoint
ALTER TABLE `municipal_issuer_evidence_documents` ADD `uploaded_file_name` varchar(255);--> statement-breakpoint
ALTER TABLE `municipal_issuer_evidence_documents` ADD `uploaded_mime_type` varchar(160);--> statement-breakpoint
ALTER TABLE `municipal_issuer_evidence_documents` ADD `uploaded_size_bytes` int;--> statement-breakpoint
CREATE INDEX `municipal_research_view_preset_owner_module_idx` ON `municipal_research_view_presets` (`user_id`,`module_id`,`updated_at`);