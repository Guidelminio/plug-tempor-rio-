import {
  boolean,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing the existing OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const classes = mysqlTable(
  "attendance_classes",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    course: varchar("course", { length: 255 }),
    /** JavaScript weekday: 0 Sunday through 6 Saturday. */
    dayOfWeek: int("dayOfWeek"),
    startTime: varchar("startTime", { length: 5 }),
    endTime: varchar("endTime", { length: 5 }),
    teacherEmail: varchar("teacherEmail", { length: 320 }).notNull(),
    teacherName: varchar("teacherName", { length: 160 }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    teacherActiveIdx: index("attendance_classes_teacher_active_idx").on(table.teacherEmail, table.active),
  }),
);

export const students = mysqlTable(
  "attendance_students",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 64 }).notNull().unique(),
    classId: int("classId").notNull(),
    fullName: varchar("fullName", { length: 255 }).notNull(),
    active: boolean("active").default(true).notNull(),
    entryDate: date("entryDate"),
    exitDate: date("exitDate"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    classIdx: index("attendance_students_class_idx").on(table.classId),
    activeClassIdx: index("attendance_students_active_class_idx").on(table.classId, table.active),
  }),
);

export const lessons = mysqlTable(
  "attendance_lessons",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 64 }).notNull().unique(),
    classId: int("classId").notNull(),
    lessonDate: date("lessonDate").notNull(),
    startTime: varchar("startTime", { length: 5 }),
    endTime: varchar("endTime", { length: 5 }),
    status: mysqlEnum("status", ["PENDING", "CLOSED", "CANCELLED", "NO_CLASS"]).default("PENDING").notNull(),
    observation: text("observation"),
    createdByUserId: int("createdByUserId"),
    lastReminderAt: timestamp("lastReminderAt"),
    reminderCount: int("reminderCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    classDateUnique: uniqueIndex("attendance_lessons_class_date_unique").on(table.classId, table.lessonDate),
    classDateIdx: index("attendance_lessons_class_date_idx").on(table.classId, table.lessonDate),
  }),
);

export const attendance = mysqlTable(
  "attendance_records",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 64 }).notNull().unique(),
    lessonId: int("lessonId").notNull(),
    studentId: int("studentId").notNull(),
    status: mysqlEnum("status", ["PRESENT", "ABSENT", "EXCUSED", "NOT_MARKED"]).default("NOT_MARKED").notNull(),
    observation: text("observation"),
    recordedByUserId: int("recordedByUserId"),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    lessonStudentUnique: uniqueIndex("attendance_records_lesson_student_unique").on(table.lessonId, table.studentId),
    lessonIdx: index("attendance_records_lesson_idx").on(table.lessonId),
    studentIdx: index("attendance_records_student_idx").on(table.studentId),
  }),
);

/** A single configuration row controls the project-wide daily attendance reminder. */
export const attendanceReminderSettings = mysqlTable("attendance_reminder_settings", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  timeZone: varchar("timeZone", { length: 64 }).default("America/Sao_Paulo").notNull(),
  reminderHour: int("reminderHour").default(20).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Immutable per-class/day delivery attempts make scheduled delivery idempotent. */
export const attendanceReminderDispatches = mysqlTable(
  "attendance_reminder_dispatches",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 64 }).notNull().unique(),
    classId: int("classId").notNull(),
    lessonId: int("lessonId"),
    reminderDate: date("reminderDate").notNull(),
    type: mysqlEnum("type", ["TEACHER_REMINDER", "ERROR_ALERT"]).notNull(),
    status: mysqlEnum("status", ["PROCESSING", "SENT", "FAILED", "SKIPPED"]).default("PROCESSING").notNull(),
    recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
    providerMessageId: varchar("providerMessageId", { length: 128 }),
    errorMessage: text("errorMessage"),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    classDateTypeUnique: uniqueIndex("attendance_reminder_dispatches_unique").on(table.classId, table.reminderDate, table.type),
    statusIdx: index("attendance_reminder_dispatches_status_idx").on(table.status, table.reminderDate),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AttendanceClass = typeof classes.$inferSelect;
export type InsertAttendanceClass = typeof classes.$inferInsert;
export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;
export type AttendanceReminderSetting = typeof attendanceReminderSettings.$inferSelect;
export type AttendanceReminderDispatch = typeof attendanceReminderDispatches.$inferSelect;
