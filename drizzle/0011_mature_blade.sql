CREATE TABLE `dexa_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`vatTarget` decimal(5,1),
	`bodyFatPctTarget` decimal(4,1),
	`leanMassTarget` decimal(5,1),
	`boneDensityTarget` decimal(4,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dexa_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `dexa_goals_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
ALTER TABLE `dexa_goals` ADD CONSTRAINT `dexa_goals_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;