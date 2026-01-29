CREATE TABLE `athlete_monitoring` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`fatigue` int NOT NULL,
	`sleepQuality` int NOT NULL,
	`muscleSoreness` int NOT NULL,
	`stressLevels` int NOT NULL,
	`mood` int NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `athlete_monitoring_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `athlete_monitoring` ADD CONSTRAINT `athlete_monitoring_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;