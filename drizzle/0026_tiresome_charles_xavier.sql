CREATE TABLE `notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`nutritionDeviationEnabled` boolean NOT NULL DEFAULT true,
	`nutritionDeviationThreshold` int NOT NULL DEFAULT 20,
	`nutritionDeviationDays` int NOT NULL DEFAULT 5,
	`wellnessAlertsEnabled` boolean NOT NULL DEFAULT true,
	`wellnessPoorScoreThreshold` int NOT NULL DEFAULT 2,
	`wellnessPoorScoreDays` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_settings_trainerId_unique` UNIQUE(`trainerId`)
);
--> statement-breakpoint
CREATE TABLE `trainer_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`clientId` int NOT NULL,
	`type` enum('nutrition_deviation','wellness_poor_scores') NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`isRead` boolean NOT NULL DEFAULT false,
	`isDismissed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notification_settings` ADD CONSTRAINT `notification_settings_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_notifications` ADD CONSTRAINT `trainer_notifications_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_notifications` ADD CONSTRAINT `trainer_notifications_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;