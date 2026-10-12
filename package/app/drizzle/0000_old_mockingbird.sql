CREATE TABLE `credit_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`security_id` int NOT NULL,
	`rating_agency` varchar(64),
	`rating` varchar(16),
	`outlook` varchar(32),
	`rating_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crvf_watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`curve_id` varchar(64) NOT NULL,
	`curve_name` varchar(255),
	`note` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crvf_watchlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `curve_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curve_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `curve_categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `curve_data_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`curve_id` int NOT NULL,
	`data_date` varchar(16) NOT NULL DEFAULT '',
	`period` varchar(16) NOT NULL,
	`value` varchar(32) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `curve_data_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `curve_interactions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`source_panel_id` varchar(64) NOT NULL,
	`target_panel_id` varchar(64) NOT NULL,
	`curve_id` int,
	`period` varchar(16),
	`value` varchar(32),
	`parameters_passed` text,
	`interacted_at` bigint NOT NULL,
	CONSTRAINT `curve_interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `curve_regions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`code` varchar(16),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `curve_regions_id` PRIMARY KEY(`id`),
	CONSTRAINT `curve_regions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `curves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`curve_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`country` varchar(64),
	`currency` varchar(16),
	`type` varchar(64),
	`region` varchar(64),
	`category` varchar(64),
	`description` text,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `curves_id` PRIMARY KEY(`id`),
	CONSTRAINT `curves_curve_id_unique` UNIQUE(`curve_id`)
);
--> statement-breakpoint
CREATE TABLE `etf_holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`etf_id` int NOT NULL,
	`holding_name` varchar(255) NOT NULL,
	`holding_type` varchar(100),
	`weight` decimal(8,4) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `etf_holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `etf_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`price` varchar(32),
	`nav` varchar(32),
	`change_val` varchar(32) NOT NULL DEFAULT '0',
	`change_pct` varchar(32) NOT NULL DEFAULT '0',
	`volume` varchar(32) NOT NULL DEFAULT '0',
	`fund_type` varchar(100),
	`asset_class` varchar(100),
	`region` varchar(100),
	`rating` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `etf_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `etf_products_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `financial_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`security_id` int NOT NULL,
	`metric_id` int NOT NULL,
	`year` int NOT NULL,
	`value` decimal(18,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` varchar(64),
	`unit` varchar(32),
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fund_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`price` varchar(32) NOT NULL DEFAULT '0',
	`change_val` varchar(32) NOT NULL DEFAULT '0',
	`change_pct` varchar(32) NOT NULL DEFAULT '0',
	`fund_type` varchar(100),
	`asset_class` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fund_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `fund_data_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `fund_distributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fund_id` int NOT NULL,
	`distribution_type` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`weight` varchar(32) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fund_distributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`market` enum('stock','bond','forex','commodity','index','derivative','option','fund') NOT NULL DEFAULT 'stock',
	`price` varchar(32) NOT NULL DEFAULT '0',
	`change_val` varchar(32) NOT NULL DEFAULT '0',
	`change_pct` varchar(32) NOT NULL DEFAULT '0',
	`volume` varchar(32) NOT NULL DEFAULT '0',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_data_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `model_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`model_name` varchar(64) NOT NULL,
	`metric_date` date,
	`metric_name` varchar(64),
	`metric_value` decimal(18,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`security_id` int NOT NULL,
	`model_name` varchar(64) NOT NULL,
	`prediction_date` date,
	`predicted_value` decimal(18,6),
	`confidence` decimal(5,4),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_risk_exports` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`panel_id` varchar(64) NOT NULL,
	`panel_name` varchar(255),
	`export_type` varchar(32) NOT NULL,
	`file_url` text,
	`file_size` int,
	`data_snapshot` text,
	`exported_at` bigint NOT NULL,
	`expires_at` bigint,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricing_risk_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rating_agencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agency_code` varchar(16) NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rating_agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `rating_agencies_agency_code_unique` UNIQUE(`agency_code`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`panel_layout` text,
	`var_confidence` varchar(16),
	`volatility_model` varchar(64),
	`valuation_model` varchar(64),
	`stress_scenario` varchar(64),
	`export_format` varchar(16),
	`last_updated_panel` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin','trader','risk_manager') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workbench_panels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`panel_code` varchar(50) NOT NULL,
	`panel_name` varchar(255),
	`panel_type` varchar(50),
	`icon` varchar(64),
	`position` int DEFAULT 0,
	`pinned` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workbench_panels_id` PRIMARY KEY(`id`)
);
