CREATE TABLE `municipal_issuer_evidence_document_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`tag` varchar(80) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `municipal_issuer_evidence_document_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `municipal_issuer_evidence_document_tag_uq` UNIQUE(`document_id`,`tag`)
);
--> statement-breakpoint
ALTER TABLE `municipal_research_view_presets` ADD `is_default` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `municipal_research_view_presets` ADD `last_used_at` timestamp;--> statement-breakpoint
CREATE INDEX `municipal_issuer_evidence_tag_document_idx` ON `municipal_issuer_evidence_document_tags` (`tag`,`document_id`);