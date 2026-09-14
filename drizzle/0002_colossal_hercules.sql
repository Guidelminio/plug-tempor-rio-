CREATE TABLE `attendance_reminder_dispatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`classId` int NOT NULL,
	`lessonId` int,
	`reminderDate` date NOT NULL,
	`type` enum('TEACHER_REMINDER','ERROR_ALERT') NOT NULL,
	`status` enum('PROCESSING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PROCESSING',
	`recipientEmail` varchar(320) NOT NULL,
	`providerMessageId` varchar(128),
	`errorMessage` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_reminder_dispatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_reminder_dispatches_externalId_unique` UNIQUE(`externalId`),
	CONSTRAINT `attendance_reminder_dispatches_unique` UNIQUE(`classId`,`reminderDate`,`type`)
);
--> statement-breakpoint
CREATE TABLE `attendance_reminder_settings` (
	`id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`timeZone` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
	`reminderHour` int NOT NULL DEFAULT 20,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_reminder_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `attendance_reminder_dispatches_status_idx` ON `attendance_reminder_dispatches` (`status`,`reminderDate`);