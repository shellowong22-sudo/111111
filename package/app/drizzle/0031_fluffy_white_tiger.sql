CREATE TABLE `announcement_acceptance_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcementId` int NOT NULL,
	`revision` int NOT NULL,
	`action` enum('previewed','confirmed') NOT NULL,
	`actorUserId` int NOT NULL,
	`actorUserName` varchar(255) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcement_acceptance_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `announcements` ADD `draftRevision` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` ADD `acceptedRevision` int;--> statement-breakpoint
ALTER TABLE `announcements` ADD `acceptanceNote` text;--> statement-breakpoint
ALTER TABLE `announcements` ADD `acceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `announcements` ADD `acceptedById` int;--> statement-breakpoint
ALTER TABLE `announcements` ADD `acceptedByName` varchar(255);--> statement-breakpoint
ALTER TABLE `money_market_source_availability_snapshots` ADD `latency_ms` int;--> statement-breakpoint
CREATE INDEX `announcement_acceptance_announcement_idx` ON `announcement_acceptance_events` (`announcementId`,`revision`);