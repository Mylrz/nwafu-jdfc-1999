CREATE TABLE `player_season_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`season` text NOT NULL,
	`jersey_number` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '队员' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_season_records_player_season` ON `player_season_records` (`player_id`,`season`);--> statement-breakpoint
CREATE INDEX `idx_player_season_records_season` ON `player_season_records` (`season`);--> statement-breakpoint
CREATE INDEX `idx_player_season_records_jersey_number` ON `player_season_records` (`jersey_number`);--> statement-breakpoint
CREATE TABLE `player_submission_season_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`season` text NOT NULL,
	`jersey_number` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '队员' NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `player_profile_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_submission_seasons_submission_season` ON `player_submission_season_records` (`submission_id`,`season`);--> statement-breakpoint
CREATE INDEX `idx_player_submission_seasons_season` ON `player_submission_season_records` (`season`);--> statement-breakpoint
INSERT OR IGNORE INTO `player_season_records` (`player_id`, `season`, `jersey_number`, `position`, `role`)
SELECT `id`, `season`, `jersey_number`, `position`, `role`
FROM `players`
WHERE trim(`season`) <> '';--> statement-breakpoint
INSERT OR IGNORE INTO `player_submission_season_records` (`submission_id`, `season`, `jersey_number`, `position`, `role`)
SELECT `id`, `season`, `jersey_number`, `position`, `role`
FROM `player_profile_submissions`
WHERE trim(`season`) <> '';--> statement-breakpoint
PRAGMA optimize;
