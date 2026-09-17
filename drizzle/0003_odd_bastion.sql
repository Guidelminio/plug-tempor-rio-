CREATE TABLE `admin_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(96) NOT NULL,
	`targetType` varchar(64),
	`targetId` varchar(128),
	`detailsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`deviceName` varchar(160),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `attendance_class_teachers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`userId` int NOT NULL,
	`permission` enum('TEACHER','EDITOR') NOT NULL DEFAULT 'TEACHER',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_class_teachers_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_class_teachers_class_user_unique` UNIQUE(`classId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `device_push_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` varchar(32) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `device_push_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_push_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `app_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`referenceType` varchar(64),
	`referenceId` varchar(128),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_sync_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(128) NOT NULL,
	`classId` int NOT NULL,
	`lessonId` int NOT NULL,
	`createdByUserId` int,
	`payloadJson` text NOT NULL,
	`status` enum('PENDING','PROCESSING','SYNCED','FAILED') NOT NULL DEFAULT 'PENDING',
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` text,
	`syncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_sync_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_sync_batches_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `attendance_sync_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`status` varchar(32) NOT NULL,
	`responseMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_sync_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `admin_audit_log_actor_idx` ON `admin_audit_log` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`userId`,`revokedAt`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `attendance_class_teachers_user_idx` ON `attendance_class_teachers` (`userId`,`active`);--> statement-breakpoint
CREATE INDEX `device_push_tokens_user_active_idx` ON `device_push_tokens` (`userId`,`active`);--> statement-breakpoint
CREATE INDEX `app_notifications_user_read_idx` ON `app_notifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `attendance_sync_batches_status_idx` ON `attendance_sync_batches` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `attendance_sync_batches_lesson_idx` ON `attendance_sync_batches` (`lessonId`);--> statement-breakpoint
CREATE INDEX `attendance_sync_events_batch_idx` ON `attendance_sync_events` (`batchId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_active_role_idx` ON `users` (`active`,`role`);