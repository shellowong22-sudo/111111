CREATE TABLE `model_run_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`model_id` varchar(64) NOT NULL,
	`model_label` varchar(128) NOT NULL,
	`model_color` varchar(32) NOT NULL DEFAULT '#3b82f6',
	`params` json NOT NULL,
	`mae` decimal(12,6) NOT NULL DEFAULT '0',
	`rmse` decimal(12,6) NOT NULL DEFAULT '0',
	`mape` decimal(8,4) NOT NULL DEFAULT '0',
	`accuracy` decimal(6,2) NOT NULL DEFAULT '0',
	`seed` int NOT NULL DEFAULT 42,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_run_history_id` PRIMARY KEY(`id`)
);
