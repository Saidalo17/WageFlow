CREATE TABLE `salary_bonuses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`record_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`record_id`) REFERENCES `salary_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `salary_bonuses_user_record` ON `salary_bonuses` (`user_id`,`record_id`);--> statement-breakpoint
CREATE TABLE `salary_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`currency` text NOT NULL,
	`title` text,
	`pay_date` text NOT NULL,
	`mode` text NOT NULL,
	`rate` integer NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`month_hours` integer DEFAULT 16000 NOT NULL,
	`day_hours` integer DEFAULT 800 NOT NULL,
	`overtime_hours` integer DEFAULT 0 NOT NULL,
	`overtime_multiplier` integer DEFAULT 150 NOT NULL,
	`deductions` text DEFAULT '[]' NOT NULL,
	`base_pay` integer NOT NULL,
	`overtime_pay` integer DEFAULT 0 NOT NULL,
	`bonus_total` integer DEFAULT 0 NOT NULL,
	`gross` integer NOT NULL,
	`deduction_total` integer DEFAULT 0 NOT NULL,
	`net` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `salary_records_user_date` ON `salary_records` (`user_id`,`pay_date`);