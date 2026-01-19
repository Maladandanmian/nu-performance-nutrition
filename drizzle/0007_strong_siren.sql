CREATE TABLE `body_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`weight` int,
	`hydration` int,
	`notes` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `body_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`pin` varchar(6) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_pin_unique` UNIQUE(`pin`)
);
--> statement-breakpoint
CREATE TABLE `drinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`mealId` int,
	`drinkType` varchar(100) NOT NULL,
	`volumeMl` int NOT NULL,
	`calories` int NOT NULL DEFAULT 0,
	`protein` int NOT NULL DEFAULT 0,
	`fat` int NOT NULL DEFAULT 0,
	`carbs` int NOT NULL DEFAULT 0,
	`fibre` int NOT NULL DEFAULT 0,
	`notes` text,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` text NOT NULL,
	`mealType` enum('breakfast','lunch','dinner','snack') NOT NULL,
	`calories` int,
	`protein` int,
	`fat` int,
	`carbs` int,
	`fibre` int,
	`aiDescription` text,
	`aiConfidence` int,
	`nutritionScore` int,
	`notes` text,
	`beverageType` text,
	`beverageVolumeMl` int,
	`beverageCalories` int,
	`beverageProtein` int,
	`beverageFat` int,
	`beverageCarbs` int,
	`beverageFibre` int,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`caloriesTarget` int NOT NULL DEFAULT 2000,
	`proteinTarget` int NOT NULL DEFAULT 150,
	`fatTarget` int NOT NULL DEFAULT 65,
	`carbsTarget` int NOT NULL DEFAULT 250,
	`fibreTarget` int NOT NULL DEFAULT 25,
	`hydrationTarget` int NOT NULL DEFAULT 2000,
	`weightTarget` decimal(5,1),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `body_metrics` ADD CONSTRAINT `body_metrics_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drinks` ADD CONSTRAINT `drinks_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drinks` ADD CONSTRAINT `drinks_mealId_meals_id_fk` FOREIGN KEY (`mealId`) REFERENCES `meals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meals` ADD CONSTRAINT `meals_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_goals` ADD CONSTRAINT `nutrition_goals_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;