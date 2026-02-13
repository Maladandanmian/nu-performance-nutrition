CREATE TABLE `vo2_max_ambient_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`temperature` decimal(4,1),
	`pressure` int,
	`humidity` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vo2_max_ambient_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vo2_max_anthropometric` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`height` decimal(4,2),
	`weight` decimal(5,1),
	`restingHeartRate` int,
	`restingBpSystolic` int,
	`restingBpDiastolic` int,
	`restingLactate` decimal(4,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vo2_max_anthropometric_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vo2_max_fitness_assessment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`aerobicThresholdLactate` decimal(4,2),
	`aerobicThresholdSpeed` decimal(5,2),
	`aerobicThresholdHr` int,
	`aerobicThresholdHrPct` int,
	`lactateThresholdLactate` decimal(4,2),
	`lactateThresholdSpeed` decimal(5,2),
	`lactateThresholdHr` int,
	`lactateThresholdHrPct` int,
	`maximumLactate` decimal(4,2),
	`maximumSpeed` decimal(5,2),
	`maximumHr` int,
	`maximumHrPct` int,
	`vo2MaxMlKgMin` decimal(5,1),
	`vo2MaxLMin` decimal(4,1),
	`vco2LMin` decimal(4,1),
	`rer` decimal(3,2),
	`rrBrMin` decimal(5,1),
	`veBtpsLMin` decimal(6,1),
	`rpe` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vo2_max_fitness_assessment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vo2_max_lactate_profile` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`stageNumber` int NOT NULL,
	`workloadSpeed` decimal(5,2) NOT NULL,
	`lactate` decimal(4,2) NOT NULL,
	`heartRate` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vo2_max_lactate_profile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vo2_max_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`pdfUrl` text NOT NULL,
	`pdfFileKey` varchar(500) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`testDate` date NOT NULL,
	`testAdministrator` varchar(255),
	`testLocation` varchar(255),
	`uploadedBy` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vo2_max_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `vo2_max_ambient_data` ADD CONSTRAINT `vo2_max_ambient_data_testId_vo2_max_tests_id_fk` FOREIGN KEY (`testId`) REFERENCES `vo2_max_tests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vo2_max_anthropometric` ADD CONSTRAINT `vo2_max_anthropometric_testId_vo2_max_tests_id_fk` FOREIGN KEY (`testId`) REFERENCES `vo2_max_tests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vo2_max_fitness_assessment` ADD CONSTRAINT `vo2_max_fitness_assessment_testId_vo2_max_tests_id_fk` FOREIGN KEY (`testId`) REFERENCES `vo2_max_tests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vo2_max_lactate_profile` ADD CONSTRAINT `vo2_max_lactate_profile_testId_vo2_max_tests_id_fk` FOREIGN KEY (`testId`) REFERENCES `vo2_max_tests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vo2_max_tests` ADD CONSTRAINT `vo2_max_tests_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vo2_max_tests` ADD CONSTRAINT `vo2_max_tests_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;