CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`save_id` text,
	`player_id` text NOT NULL,
	`understood_goal` integer NOT NULL,
	`trusted_guihang` integer NOT NULL,
	`continue_chapter_two` integer NOT NULL,
	`rating` real NOT NULL,
	`detail` text NOT NULL,
	`contact` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`save_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_saves` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`codename` text NOT NULL,
	`version` integer NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`ended_at` text
);
