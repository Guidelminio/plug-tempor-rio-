CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`lessonId` int NOT NULL,
	`studentId` int NOT NULL,
	`status` enum('PRESENT','ABSENT','EXCUSED','NOT_MARKED') NOT NULL DEFAULT 'NOT_MARKED',
	`observation` text,
	`recordedByUserId` int,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_records_externalId_unique` UNIQUE(`externalId`),
	CONSTRAINT `attendance_records_lesson_student_unique` UNIQUE(`lessonId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `attendance_classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`course` varchar(255),
	`dayOfWeek` int,
	`startTime` varchar(5),
	`endTime` varchar(5),
	`teacherEmail` varchar(320) NOT NULL,
	`teacherName` varchar(160),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_classes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `attendance_lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`classId` int NOT NULL,
	`lessonDate` date NOT NULL,
	`startTime` varchar(5),
	`endTime` varchar(5),
	`status` enum('PENDING','CLOSED','CANCELLED','NO_CLASS') NOT NULL DEFAULT 'PENDING',
	`observation` text,
	`createdByUserId` int,
	`lastReminderAt` timestamp,
	`reminderCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_lessons_externalId_unique` UNIQUE(`externalId`),
	CONSTRAINT `attendance_lessons_class_date_unique` UNIQUE(`classId`,`lessonDate`)
);
--> statement-breakpoint
CREATE TABLE `attendance_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`classId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`entryDate` date,
	`exitDate` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_students_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_students_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE INDEX `attendance_records_lesson_idx` ON `attendance_records` (`lessonId`);--> statement-breakpoint
CREATE INDEX `attendance_records_student_idx` ON `attendance_records` (`studentId`);--> statement-breakpoint
CREATE INDEX `attendance_classes_teacher_active_idx` ON `attendance_classes` (`teacherEmail`,`active`);--> statement-breakpoint
CREATE INDEX `attendance_lessons_class_date_idx` ON `attendance_lessons` (`classId`,`lessonDate`);--> statement-breakpoint
CREATE INDEX `attendance_students_class_idx` ON `attendance_students` (`classId`);--> statement-breakpoint
CREATE INDEX `attendance_students_active_class_idx` ON `attendance_students` (`classId`,`active`);