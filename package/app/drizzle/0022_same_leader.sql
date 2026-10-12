CREATE TABLE `gc_report_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(96) NOT NULL,
	`header_text` varchar(80) NOT NULL,
	`research_id_prefix` varchar(32) NOT NULL,
	`footer_text` varchar(160) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gc_report_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `gc_report_template_user_name_uq` UNIQUE(`user_id`,`name`)
);
