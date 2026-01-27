CREATE TABLE `login_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`attemptedPin` varchar(6),
	`success` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_locks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`lockedUntil` timestamp NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_limit_locks_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_limit_locks_ipAddress_unique` UNIQUE(`ipAddress`)
);
--> statement-breakpoint
ALTER TABLE `clients` MODIFY COLUMN `pin` varchar(72) NOT NULL;