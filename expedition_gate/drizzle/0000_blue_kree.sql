CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`setting` text NOT NULL,
	`tone` text DEFAULT '[]' NOT NULL,
	`world_brief` text DEFAULT '' NOT NULL,
	`state_json` text DEFAULT '{}' NOT NULL,
	`state_stale` integer DEFAULT false NOT NULL,
	`state_v` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_played_at` integer,
	`ended` text
);
--> statement-breakpoint
CREATE TABLE `checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`state_json` text NOT NULL,
	`messages_up_to` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checkpoints_campaign_idx` ON `checkpoints` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`seq` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_campaign_seq_idx` ON `messages` (`campaign_id`,`seq`);