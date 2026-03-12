CREATE TABLE `backup_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainerId` int NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`backupDate` date NOT NULL,
	`fileSizeKB` int,
	`recipientEmail` varchar(320) NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `backup_logs` ADD CONSTRAINT `backup_logs_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;