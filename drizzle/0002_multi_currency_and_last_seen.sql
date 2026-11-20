ALTER TABLE `transactions` ADD `original_amount` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `original_currency` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_seen_at` integer;
--> statement-breakpoint
UPDATE `transactions` SET `original_amount` = `amount`, `original_currency` = (SELECT `currency` FROM `users` WHERE `users`.`id` = `transactions`.`user_id`);
