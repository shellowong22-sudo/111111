CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` enum('info','warning','urgent','maintenance') NOT NULL DEFAULT 'info',
	`priority` int NOT NULL DEFAULT 0,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`authorId` int NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`expiresAt` timestamp,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `announcements_status_expires_idx` ON `announcements` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `announcements_published_idx` ON `announcements` (`publishedAt`);