ALTER TABLE `media_assets` ADD `rights_reviewed_by` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `rights_reviewed_at` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `rights_revoked_at` text;--> statement-breakpoint
ALTER TABLE `player_profile_submissions` ADD `consent_version` text;--> statement-breakpoint
ALTER TABLE `player_profile_submissions` ADD `consented_at` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `consent_version` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `consented_at` text;