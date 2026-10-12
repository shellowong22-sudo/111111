CREATE TABLE `admin_security_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int NOT NULL,
	`target_user_id` int,
	`action` varchar(80) NOT NULL,
	`result` enum('allowed','blocked') NOT NULL,
	`reason` varchar(500),
	`metadata` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_security_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_security_audit_actor_created_idx` ON `admin_security_audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_security_audit_target_created_idx` ON `admin_security_audit_events` (`target_user_id`,`created_at`);