ALTER TABLE `campaigns` ADD `turn_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `session_summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `chronicle` text DEFAULT '' NOT NULL;