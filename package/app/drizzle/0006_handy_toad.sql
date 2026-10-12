CREATE TABLE `checklist_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`can_edit` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`template_id` int NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`completed_items` json NOT NULL,
	`note` text,
	`version` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`module_id` varchar(32) NOT NULL,
	`items` json NOT NULL,
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklist_templates_id` PRIMARY KEY(`id`)
);
