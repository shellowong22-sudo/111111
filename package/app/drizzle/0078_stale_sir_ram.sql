CREATE TABLE `admin_runtime_health_samples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sampled_at` timestamp NOT NULL DEFAULT (now()),
	`db_latency_ms` int,
	`heap_used_bytes` bigint NOT NULL,
	`heap_total_bytes` bigint NOT NULL,
	`rss_bytes` bigint NOT NULL,
	`uptime_seconds` int NOT NULL,
	`total_users` int NOT NULL,
	`active_last_24h` int NOT NULL,
	`active_last_7d` int NOT NULL,
	CONSTRAINT `admin_runtime_health_samples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_runtime_health_sampled_idx` ON `admin_runtime_health_samples` (`sampled_at`);