CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`clientId` int NOT NULL,
	`packageId` int,
	`invoiceNumber` varchar(50) NOT NULL,
	`lineItems` json NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`taxRate` decimal(5,2) NOT NULL DEFAULT '0.00',
	`taxAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'HKD',
	`status` enum('draft','sent','paid','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`dueDate` date,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_packageId_session_packages_id_fk` FOREIGN KEY (`packageId`) REFERENCES `session_packages`(`id`) ON DELETE set null ON UPDATE no action;