CREATE TABLE `strength_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`testType` varchar(50) NOT NULL,
	`value` decimal(6,2) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`notes` text,
	`testedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `strength_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `strength_tests` ADD CONSTRAINT `strength_tests_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;