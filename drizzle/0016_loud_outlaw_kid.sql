ALTER TABLE `clients` ADD `passwordSetupToken` varchar(64);--> statement-breakpoint
ALTER TABLE `clients` ADD `passwordSetupTokenExpires` timestamp;