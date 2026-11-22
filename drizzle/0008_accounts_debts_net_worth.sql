CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`currency` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`in_net_worth` integer DEFAULT true NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`debt_id` text NOT NULL,
	`paid_on` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `debt_payments_user_debt` ON `debt_payments` (`user_id`,`debt_id`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`direction` text NOT NULL,
	`kind` text NOT NULL,
	`currency` text NOT NULL,
	`principal` integer NOT NULL,
	`interest_rate` integer DEFAULT 0 NOT NULL,
	`monthly_payment` integer,
	`payment_day` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE TABLE `net_worth_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`currency` text NOT NULL,
	`assets` integer NOT NULL,
	`liabilities` integer NOT NULL,
	`net_worth` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `net_worth_snapshots_user_date` ON `net_worth_snapshots` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `account_id` text REFERENCES accounts(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `transactions_user_account` ON `transactions` (`user_id`,`account_id`);