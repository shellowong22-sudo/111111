CREATE TABLE `admin_news_ingestion_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` int NOT NULL,
	`source_item_key` varchar(512) NOT NULL,
	`source_headline` varchar(700) NOT NULL,
	`source_excerpt` text,
	`source_url` varchar(1200) NOT NULL,
	`source_published_at` timestamp,
	`retrieved_at` timestamp NOT NULL DEFAULT (now()),
	`status` enum('queued','draft','approved','published','rejected','failed') NOT NULL DEFAULT 'queued',
	`ai_title` varchar(255),
	`ai_summary` text,
	`category` varchar(64),
	`sentiment` enum('positive','neutral','negative','uncertain'),
	`tickers` json,
	`ai_model` varchar(80),
	`ai_generated_at` timestamp,
	`processing_error` varchar(1000),
	`reviewed_by_user_id` int,
	`reviewed_at` timestamp,
	`published_by_user_id` int,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_news_ingestion_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_news_ingestion_article_source_key_uq` UNIQUE(`source_id`,`source_item_key`)
);
--> statement-breakpoint
CREATE TABLE `admin_news_ingestion_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` int,
	`article_id` int,
	`actor_user_id` int,
	`action` enum('source_created','source_updated','sync_started','sync_completed','article_queued','draft_generated','draft_failed','approved','published','rejected') NOT NULL,
	`detail` varchar(1200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_news_ingestion_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_news_ingestion_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`feed_url` varchar(1200) NOT NULL,
	`source_url` varchar(1200) NOT NULL,
	`source_type` enum('rss','api') NOT NULL DEFAULT 'rss',
	`is_active` boolean NOT NULL DEFAULT true,
	`max_items_per_run` int NOT NULL DEFAULT 12,
	`schedule_cron_task_uid` varchar(65),
	`last_fetched_at` timestamp,
	`last_status` enum('never','available','unavailable') NOT NULL DEFAULT 'never',
	`last_error` varchar(600),
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_news_ingestion_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_news_ingestion_source_feed_uq` UNIQUE(`feed_url`)
);
--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_article_status_updated_idx` ON `admin_news_ingestion_articles` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_article_source_published_idx` ON `admin_news_ingestion_articles` (`source_id`,`source_published_at`);--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_audit_source_created_idx` ON `admin_news_ingestion_audit_events` (`source_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_audit_article_created_idx` ON `admin_news_ingestion_audit_events` (`article_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_source_active_idx` ON `admin_news_ingestion_sources` (`is_active`,`updated_at`);--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_source_task_idx` ON `admin_news_ingestion_sources` (`schedule_cron_task_uid`);