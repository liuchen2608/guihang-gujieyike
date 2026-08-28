CREATE INDEX `idx_auth_sessions_user_id` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_player_save_idx` ON `feedback` (`player_id`,`save_id`);--> statement-breakpoint
CREATE INDEX `game_messages_save_id_idx` ON `game_messages` (`save_id`);--> statement-breakpoint
CREATE INDEX `idx_game_saves_player_updated` ON `game_saves` (`player_id`,`updated_at`);