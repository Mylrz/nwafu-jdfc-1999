CREATE TABLE `admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guestbook_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`years` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '老队员' NOT NULL,
	`content` text NOT NULL,
	`author_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_guestbook_status_created_at` ON `guestbook_messages` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season` text NOT NULL,
	`name` text NOT NULL,
	`jersey_number` text DEFAULT '' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '队员' NOT NULL,
	`major` text DEFAULT '' NOT NULL,
	`class_year` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_players_status_season` ON `players` (`status`,`season`);--> statement-breakpoint
CREATE INDEX `idx_players_name` ON `players` (`name`);--> statement-breakpoint
CREATE INDEX `idx_players_jersey_number` ON `players` (`jersey_number`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submitter_name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`season` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`author_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_status_created_at` ON `submissions` (`status`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
