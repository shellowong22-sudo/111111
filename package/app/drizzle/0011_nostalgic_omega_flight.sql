CREATE TABLE `checklist_export_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`template_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`research_id` varchar(160) NOT NULL,
	`export_format` enum('csv','pdf') NOT NULL,
	`verification_code` varchar(80) NOT NULL,
	`signature_payload` text NOT NULL,
	`downloaded_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_export_records_id` PRIMARY KEY(`id`)
);
