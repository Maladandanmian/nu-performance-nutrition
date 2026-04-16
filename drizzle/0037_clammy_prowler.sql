-- Accounting module schema additions
-- All changes are additive and non-destructive

CREATE TABLE `business_costs` (
`id` int AUTO_INCREMENT NOT NULL,
`trainerId` int NOT NULL,
`category` enum('Rent','Software Subscriptions','Insurance','Equipment','Marketing','Other') NOT NULL,
`description` varchar(255) NOT NULL,
`amount` decimal(10,2) NOT NULL,
`isRecurring` boolean NOT NULL DEFAULT false,
`month` varchar(7) NOT NULL,
`confirmedAt` timestamp,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `business_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_types` (
`id` int AUTO_INCREMENT NOT NULL,
`trainerId` int NOT NULL,
`name` varchar(100) NOT NULL,
`createdAt` timestamp NOT NULL DEFAULT (now()),
CONSTRAINT `service_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD `serviceType` varchar(100);--> statement-breakpoint
ALTER TABLE `invoices` ADD `discountAmount` decimal(10,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `invoices` ADD `discountDescription` varchar(255);--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `sessionFee` decimal(10,2);--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `amountPaid` decimal(10,2);--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `paidAt` timestamp;--> statement-breakpoint
ALTER TABLE `business_costs` ADD CONSTRAINT `business_costs_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_types` ADD CONSTRAINT `service_types_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
