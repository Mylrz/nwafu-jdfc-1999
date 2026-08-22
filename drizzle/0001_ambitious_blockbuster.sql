CREATE TABLE `player_profile_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season` text NOT NULL,
	`name` text NOT NULL,
	`jersey_number` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '队员' NOT NULL,
	`major` text DEFAULT '' NOT NULL,
	`class_year` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`photo_key` text DEFAULT '' NOT NULL,
	`photo_file_name` text DEFAULT '' NOT NULL,
	`photo_content_type` text DEFAULT '' NOT NULL,
	`photo_file_size` integer DEFAULT 0 NOT NULL,
	`author_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_player_profile_submissions_status_created_at` ON `player_profile_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_player_profile_submissions_name` ON `player_profile_submissions` (`name`);--> statement-breakpoint
ALTER TABLE `players` ADD `photo_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `photo_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `photo_content_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
PRAGMA optimize;
