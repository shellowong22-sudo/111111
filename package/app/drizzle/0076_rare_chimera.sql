CREATE TABLE `industry_group_private_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`classification` varchar(80) NOT NULL,
	`source_label` varchar(160) NOT NULL,
	`as_of_at` timestamp NOT NULL,
	`record_count` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `industry_group_private_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `industry_group_private_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`batch_id` int NOT NULL,
	`record_id` varchar(120) NOT NULL,
	`industry_group` varchar(160) NOT NULL,
	`metric` varchar(120) NOT NULL,
	`value` decimal(28,10) NOT NULL,
	`unit` varchar(48) NOT NULL,
	`issuer_name` varchar(160),
	`ticker` varchar(48),
	`currency` varchar(12),
	`source_reference` varchar(255),
	`observed_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `industry_group_private_observations_id` PRIMARY KEY(`id`),
	CONSTRAINT `industry_group_private_observation_uq` UNIQUE(`user_id`,`batch_id`,`record_id`)
);
--> statement-breakpoint
CREATE INDEX `industry_group_private_batch_user_created_idx` ON `industry_group_private_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `industry_group_private_observation_user_batch_idx` ON `industry_group_private_observations` (`user_id`,`batch_id`);--> statement-breakpoint
CREATE INDEX `industry_group_private_observation_group_metric_idx` ON `industry_group_private_observations` (`user_id`,`industry_group`,`metric`,`observed_at`);