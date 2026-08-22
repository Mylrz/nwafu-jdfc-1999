CREATE TABLE `media_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer,
	`title` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`season` text DEFAULT '' NOT NULL,
	`squad` text DEFAULT 'other' NOT NULL,
	`credit` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`rights_status` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_assets_submission_id` ON `media_assets` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_media_assets_status_published_at` ON `media_assets` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_media_assets_season_squad_status` ON `media_assets` (`season`,`squad`,`status`);--> statement-breakpoint
CREATE TABLE `public_form_rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`form` text NOT NULL,
	`fingerprint` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_public_form_rate_limits_window` ON `public_form_rate_limits` (`form`,`fingerprint`,`window_start`);--> statement-breakpoint
CREATE INDEX `idx_public_form_rate_limits_updated_at` ON `public_form_rate_limits` (`updated_at`);--> statement-breakpoint
CREATE TABLE `season_archives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season` text NOT NULL,
	`squad` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`cover_media_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_season_archives_season_squad` ON `season_archives` (`season`,`squad`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_season_archives_slug` ON `season_archives` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_season_archives_status_season` ON `season_archives` (`status`,`season`);--> statement-breakpoint
PRAGMA optimize;
