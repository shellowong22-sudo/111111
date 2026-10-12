ALTER TABLE `admin_ai_generation_tasks` ADD `catalog_code` varchar(16);--> statement-breakpoint
ALTER TABLE `admin_news_ingestion_articles` ADD `ai_generation_catalog_code` varchar(16);--> statement-breakpoint
CREATE INDEX `admin_ai_generation_task_catalog_created_idx` ON `admin_ai_generation_tasks` (`catalog_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_news_ingestion_article_catalog_status_idx` ON `admin_news_ingestion_articles` (`ai_generation_catalog_code`,`status`);