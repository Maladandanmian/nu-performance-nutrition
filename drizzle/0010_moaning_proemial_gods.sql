CREATE TABLE `dexa_bmd_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`region` varchar(50) NOT NULL,
	`area` decimal(10,2),
	`bmc` decimal(10,2),
	`bmd` decimal(10,3),
	`tScore` decimal(5,2),
	`zScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dexa_bmd_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dexa_body_comp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`totalFatMass` int,
	`totalLeanMass` int,
	`totalMass` int,
	`totalBodyFatPct` decimal(5,2),
	`totalBodyFatPctTScore` decimal(5,2),
	`totalBodyFatPctZScore` decimal(5,2),
	`trunkFatMass` int,
	`trunkFatPct` decimal(5,2),
	`androidFatMass` int,
	`androidFatPct` decimal(5,2),
	`gynoidFatMass` int,
	`gynoidFatPct` decimal(5,2),
	`fatMassHeightRatio` decimal(5,2),
	`androidGynoidRatio` decimal(5,3),
	`trunkLegsFatRatio` decimal(5,2),
	`trunkLimbFatMassRatio` decimal(5,2),
	`vatMass` int,
	`vatVolume` int,
	`vatArea` decimal(10,2),
	`leanMassHeightRatio` decimal(5,2),
	`appendicularLeanMassHeightRatio` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dexa_body_comp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dexa_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`imageType` enum('body_scan_grayscale','body_scan_colorized','fracture_risk_chart','body_fat_chart','bmd_table','body_comp_table','adipose_indices_table') NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` text NOT NULL,
	`pageNumber` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dexa_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dexa_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`trainerId` int NOT NULL,
	`pdfUrl` text NOT NULL,
	`pdfKey` text NOT NULL,
	`scanDate` date NOT NULL,
	`scanId` varchar(100),
	`scanType` varchar(100),
	`scanVersion` varchar(100),
	`operator` varchar(100),
	`model` varchar(100),
	`patientHeight` int,
	`patientWeight` int,
	`patientAge` int,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`rejectionReason` text,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dexa_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dexa_bmd_data` ADD CONSTRAINT `dexa_bmd_data_scanId_dexa_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `dexa_scans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dexa_body_comp` ADD CONSTRAINT `dexa_body_comp_scanId_dexa_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `dexa_scans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dexa_images` ADD CONSTRAINT `dexa_images_scanId_dexa_scans_id_fk` FOREIGN KEY (`scanId`) REFERENCES `dexa_scans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dexa_scans` ADD CONSTRAINT `dexa_scans_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dexa_scans` ADD CONSTRAINT `dexa_scans_trainerId_users_id_fk` FOREIGN KEY (`trainerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;