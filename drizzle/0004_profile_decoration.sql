DROP TABLE `password_resets`;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_mime` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_updated_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `emoji` text;--> statement-breakpoint
ALTER TABLE `users` ADD `accent` text;