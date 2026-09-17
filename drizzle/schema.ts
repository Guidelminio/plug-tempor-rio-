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

/** Core user table backing both local-password and legacy OAuth accounts. */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 128 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    passwordHash: varchar("passwordHash", { length: 512 }),
    mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    activeRoleIdx: index("users_active_role_idx").on(table.active, table.role),
  }),
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    deviceName: varchar("deviceName", { length: 160 }),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("auth_sessions_user_idx").on(table.userId, table.revokedAt),
    expiryIdx: index("auth_sessions_expiry_idx").on(table.expiresAt),
  }),
);

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

/** Explicit professor-to-class access; teacherEmail remains as a compatibility fallback. */
export const classTeachers = mysqlTable(
  "attendance_class_teachers",
  {
    id: int("id").autoincrement().primaryKey(),
    classId: int("classId").notNull(),
    userId: int("userId").notNull(),
    permission: mysqlEnum("permission", ["TEACHER", "EDITOR"]).default("TEACHER").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    classUserUnique: uniqueIndex("attendance_class_teachers_class_user_unique").on(table.classId, table.userId),
    userIdx: index("attendance_class_teachers_user_idx").on(table.userId, table.active),
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
    updatedAt: timestamp("updatedAt").defaultNow().notNull().onUpdateNow(),
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

export const attendanceReminderSettings = mysqlTable("attendance_reminder_settings", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  timeZone: varchar("timeZone", { length: 64 }).default("America/Sao_Paulo").notNull(),
  reminderHour: int("reminderHour").default(20).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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

export const notifications = mysqlTable(
  "app_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull(),
    referenceType: varchar("referenceType", { length: 64 }),
    referenceId: varchar("referenceId", { length: 128 }),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index("app_notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt),
  }),
);

export const devicePushTokens = mysqlTable(
  "device_push_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    token: varchar("token", { length: 512 }).notNull().unique(),
    platform: varchar("platform", { length: 32 }).notNull(),
    active: boolean("active").default(true).notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userActiveIdx: index("device_push_tokens_user_active_idx").on(table.userId, table.active),
  }),
);

export const syncBatches = mysqlTable(
  "attendance_sync_batches",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 128 }).notNull().unique(),
    classId: int("classId").notNull(),
    lessonId: int("lessonId").notNull(),
    createdByUserId: int("createdByUserId"),
    payloadJson: text("payloadJson").notNull(),
    status: mysqlEnum("status", ["PENDING", "PROCESSING", "SYNCED", "FAILED"]).default("PENDING").notNull(),
    attempts: int("attempts").default(0).notNull(),
    lastError: text("lastError"),
    syncedAt: timestamp("syncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    statusIdx: index("attendance_sync_batches_status_idx").on(table.status, table.updatedAt),
    lessonIdx: index("attendance_sync_batches_lesson_idx").on(table.lessonId),
  }),
);

export const syncEvents = mysqlTable(
  "attendance_sync_events",
  {
    id: int("id").autoincrement().primaryKey(),
    batchId: int("batchId").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    responseMessage: text("responseMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    batchIdx: index("attendance_sync_events_batch_idx").on(table.batchId, table.createdAt),
  }),
);

export const adminAuditLog = mysqlTable(
  "admin_audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    targetType: varchar("targetType", { length: 64 }),
    targetId: varchar("targetId", { length: 128 }),
    detailsJson: text("detailsJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("admin_audit_log_actor_idx").on(table.actorUserId, table.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type AttendanceClass = typeof classes.$inferSelect;
export type InsertAttendanceClass = typeof classes.$inferInsert;
export type ClassTeacher = typeof classTeachers.$inferSelect;
export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type SyncBatch = typeof syncBatches.$inferSelect;
