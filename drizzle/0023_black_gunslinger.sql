CREATE TABLE `nutrition_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`pdfUrl` text NOT NULL,
	`pdfFileKey` varchar(500) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`reportDate` timestamp NOT NULL,
	`preparedBy` varchar(255),
	`summary` json,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `nutrition_reports` ADD CONSTRAINT `nutrition_reports_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_reports` ADD CONSTRAINT `nutrition_reports_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;