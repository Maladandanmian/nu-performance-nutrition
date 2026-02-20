CREATE TABLE `group_class_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupClassId` int NOT NULL,
	`clientId` int NOT NULL,
	`paymentStatus` enum('paid','unpaid','from_package') NOT NULL DEFAULT 'unpaid',
	`packageId` int,
	`attended` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_class_attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`classType` enum('hyrox','mobility','rehab','conditioning','strength_conditioning') NOT NULL,
	`classDate` date NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`capacity` int NOT NULL DEFAULT 20,
	`recurringRuleId` int,
	`notes` text,
	`cancelled` boolean NOT NULL DEFAULT false,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `group_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_session_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`frequency` enum('weekly') NOT NULL DEFAULT 'weekly',
	`daysOfWeek` json NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_session_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`trainerId` int NOT NULL,
	`packageType` varchar(100) NOT NULL,
	`sessionsTotal` int NOT NULL,
	`sessionsRemaining` int NOT NULL,
	`purchaseDate` date NOT NULL,
	`expiryDate` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `session_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`clientId` int NOT NULL,
	`sessionType` enum('1on1_pt','2on1_pt','nutrition_initial','nutrition_coaching') NOT NULL,
	`sessionDate` date NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`paymentStatus` enum('paid','unpaid','from_package') NOT NULL DEFAULT 'unpaid',
	`packageId` int,
	`recurringRuleId` int,
	`notes` text,
	`cancelled` boolean NOT NULL DEFAULT false,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `group_class_attendance` ADD CONSTRAINT `group_class_attendance_groupClassId_group_classes_id_fk` FOREIGN KEY (`groupClassId`) REFERENCES `group_classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_class_attendance` ADD CONSTRAINT `group_class_attendance_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_class_attendance` ADD CONSTRAINT `group_class_attendance_packageId_session_packages_id_fk` FOREIGN KEY (`packageId`) REFERENCES `session_packages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_classes` ADD CONSTRAINT `group_classes_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_classes` ADD CONSTRAINT `group_classes_recurringRuleId_recurring_session_rules_id_fk` FOREIGN KEY (`recurringRuleId`) REFERENCES `recurring_session_rules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recurring_session_rules` ADD CONSTRAINT `recurring_session_rules_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_packages` ADD CONSTRAINT `session_packages_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_packages` ADD CONSTRAINT `session_packages_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_packageId_session_packages_id_fk` FOREIGN KEY (`packageId`) REFERENCES `session_packages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD CONSTRAINT `training_sessions_recurringRuleId_recurring_session_rules_id_fk` FOREIGN KEY (`recurringRuleId`) REFERENCES `recurring_session_rules`(`id`) ON DELETE set null ON UPDATE no action;