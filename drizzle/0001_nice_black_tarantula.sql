CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_key_time` ON `login_attempts` (`key`,`created_at`);