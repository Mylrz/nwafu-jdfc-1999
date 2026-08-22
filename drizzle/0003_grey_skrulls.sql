ALTER TABLE `player_profile_submissions` ADD `kind` text DEFAULT 'create' NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profile_submissions` ADD `target_player_id` integer REFERENCES players(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `idx_player_profile_submissions_target_player_id` ON `player_profile_submissions` (`target_player_id`);
