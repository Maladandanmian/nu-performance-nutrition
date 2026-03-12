ALTER TABLE `training_sessions` MODIFY COLUMN `sessionType` enum('1on1_pt','2on1_pt','nutrition_initial','nutrition_coaching','custom') NOT NULL;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `customSessionName` varchar(255);--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `customDurationMinutes` int;--> statement-breakpoint
ALTER TABLE `training_sessions` ADD `customPrice` varchar(20);