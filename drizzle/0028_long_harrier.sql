CREATE TABLE `supplement_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`supplementTemplateId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`dose` varchar(100) NOT NULL,
	`loggedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplement_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplement_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`dose` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplement_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `supplement_logs` ADD CONSTRAINT `supplement_logs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplement_logs` ADD CONSTRAINT `supplement_logs_supplementTemplateId_supplement_templates_id_fk` FOREIGN KEY (`supplementTemplateId`) REFERENCES `supplement_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplement_templates` ADD CONSTRAINT `supplement_templates_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;