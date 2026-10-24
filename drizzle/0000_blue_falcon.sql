CREATE TABLE `send_attempts` (
	`attempt_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`draft_digest` text NOT NULL,
	`status` text NOT NULL,
	`provider_message_id` text,
	`created_at` integer NOT NULL
);
