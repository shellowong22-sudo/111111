CREATE TABLE `admin_data_module_automation_schedules` (
	`schedule_key` varchar(80) NOT NULL,
	`cron_expression` varchar(64) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`is_enabled` boolean NOT NULL DEFAULT false,
	`owner_user_id` int NOT NULL,
	`last_scheduled_at` timestamp,
	`last_run_at` timestamp,
	`last_error` varchar(1800),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_data_module_automation_schedules_schedule_key` PRIMARY KEY(`schedule_key`),
	CONSTRAINT `adm_mod_schedule_task_uid_uq` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE INDEX `admin_module_schedule_enabled_idx` ON `admin_data_module_automation_schedules` (`is_enabled`,`updated_at`);
