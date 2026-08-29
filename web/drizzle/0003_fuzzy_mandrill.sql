CREATE TABLE `invite_attempts` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invite_attempts_expiry_idx` ON `invite_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `invite_grants` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`invite_hash` text NOT NULL,
	`owner_id` text NOT NULL,
	`account_id` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invite_grants_owner_idx` ON `invite_grants` (`owner_id`);--> statement-breakpoint
CREATE INDEX `invite_grants_code_idx` ON `invite_grants` (`invite_hash`);--> statement-breakpoint
CREATE INDEX `invite_grants_account_idx` ON `invite_grants` (`account_id`);