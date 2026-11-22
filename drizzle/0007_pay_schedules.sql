CREATE TABLE `salary_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`currency` text NOT NULL,
	`title` text NOT NULL,
	`frequency` text NOT NULL,
	`day_of_month` integer DEFAULT 1 NOT NULL,
	`anchor_date` text,
	`expected_net` integer NOT NULL,
	`remind_days_before` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `salary_schedules_user` ON `salary_schedules` (`user_id`);