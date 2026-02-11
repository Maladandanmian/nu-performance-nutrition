ALTER TABLE `nutrition_reports` ADD `goalsText` text;--> statement-breakpoint
ALTER TABLE `nutrition_reports` ADD `currentStatusText` text;--> statement-breakpoint
ALTER TABLE `nutrition_reports` ADD `recommendationsText` text;--> statement-breakpoint
ALTER TABLE `nutrition_reports` ADD `uploadedAt` timestamp DEFAULT (now()) NOT NULL;