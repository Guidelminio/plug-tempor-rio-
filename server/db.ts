import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  adminAuditLog,
  attendance,
  classTeachers,
  classes,
  InsertAttendanceClass,
  InsertLesson,
  InsertStudent,
  InsertUser,
  lessons,
  notifications,
  students,
  users,
  type AttendanceClass,
  type User,
} from "../drizzle/schema";
import { assertCompleteBatch, isTeacherAuthorized, lessonStatusFor, studentIsEligibleForLesson } from "../shared/attendance-rules";
import { ENV } from "./_core/env";
import { hashPassword, normalizeLogin, verifyPassword } from "./local-password";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    active: user.active,
    lastSignedIn: user.lastSignedIn,
  };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod", "passwordHash", "mustChangePassword", "active"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] as never;
      updateSet[field] = user[field];
    }
  });
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function listUsersForAdmin() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const rows = await db.select().from(users).orderBy(users.name, users.email);
  return rows.map(publicUser);
}

export async function findLocalUser(login: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const normalized = normalizeLogin(login);
  const rows = await db.select().from(users).where(or(
    eq(users.email, normalized),
    eq(users.openId, `local:${normalized}`),
  )).limit(1);
  return rows[0];
}

export async function authenticateLocalUser(login: string, password: string) {
  const user = await findLocalUser(login);
  if (!user || !user.active || user.loginMethod !== "local") return null;
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

export async function createLocalUser(input: { name: string; email: string; password: string; role?: "user" | "admin"; mustChangePassword?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const email = normalizeLogin(input.email);
  if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
  if (await findLocalUser(email)) throw new Error("Já existe uma conta com esse e-mail.");
  const passwordHash = await hashPassword(input.password);
  const row: InsertUser = {
    openId: `local:${email}`,
    name: input.name.trim(),
    email,
    loginMethod: "local",
    passwordHash,
    role: input.role ?? "user",
    active: true,
    mustChangePassword: input.mustChangePassword ?? true,
    lastSignedIn: new Date(),
  };
  await db.insert(users).values(row);
  const created = await getUserByOpenId(row.openId);
  if (!created) throw new Error("Não foi possível criar a conta.");
  return created;
}

export async function bootstrapInitialAdmin() {
  if (!ENV.initialAdminEmail || !ENV.initialAdminPassword) return null;
  const current = await findLocalUser(ENV.initialAdminEmail);
  if (current) return current;
  return createLocalUser({
    name: "Administrador",
    email: ENV.initialAdminEmail,
    password: ENV.initialAdminPassword,
    role: "admin",
    mustChangePassword: true,
  });
}

export async function changeLocalPassword(userId: number, currentPassword: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const user = await getUserById(userId);
  if (!user || user.loginMethod !== "local" || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("Senha atual inválida.");
  }
  await db.update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function resetLocalPassword(userId: number, temporaryPassword: string, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const user = await getUserById(userId);
  if (!user || user.loginMethod !== "local") throw new Error("Conta local não encontrada.");
  await db.update(users).set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit(actorUserId, "RESET_PASSWORD", "user", String(userId));
}

export async function updateLocalUser(userId: number, input: { name?: string; active?: boolean; role?: "user" | "admin" }, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const user = await getUserById(userId);
  if (!user) throw new Error("Conta não encontrada.");
  if (user.role === "admin" && input.active === false) throw new Error("Uma conta administrativa não pode ser bloqueada por este fluxo.");
  await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit(actorUserId, input.active === false ? "BLOCK_USER" : "UPDATE_USER", "user", String(userId));
}

export async function audit(actorUserId: number, action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAuditLog).values({
    actorUserId,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    detailsJson: details ? JSON.stringify(details) : null,
  });
}

export async function createNotification(userId: number, input: { type: string; title: string; message: string; referenceType?: string; referenceId?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({
    userId,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
  });
}

export async function listNotifications(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(60);
}

export async function markNotificationRead(user: User, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));
}

function normalizedEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function dateFromKey(value: string): Date {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data de aula inválida.");
  return parsed;
}

function isAdmin(user: User) {
  return user.role === "admin";
}

async function explicitClassIdsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const rows = await db.select().from(classTeachers).where(and(eq(classTeachers.userId, userId), eq(classTeachers.active, true)));
  return rows.map((row) => row.classId);
}

export async function listClassesForUser(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const all = await db.select().from(classes).where(eq(classes.active, true)).orderBy(classes.name);
  if (isAdmin(user)) return all;
  const explicitIds = await explicitClassIdsForUser(user.id);
  if (explicitIds.length) return all.filter((item) => explicitIds.includes(item.id));
  const email = normalizedEmail(user.email);
  return all.filter((item) => normalizedEmail(item.teacherEmail) === email);
}

export async function assertClassAccess(user: User, classId: number): Promise<AttendanceClass> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  const attendanceClass = result[0];
  if (!attendanceClass || !attendanceClass.active) throw new Error("Turma não encontrada ou inativa.");
  if (isAdmin(user)) return attendanceClass;
  const explicitIds = await explicitClassIdsForUser(user.id);
  const explicitlyAllowed = explicitIds.includes(classId);
  const legacyAllowed = explicitIds.length === 0 && isTeacherAuthorized(attendanceClass.teacherEmail, user.email, false);
  if (!explicitlyAllowed && !legacyAllowed) throw new Error("Sua conta não está autorizada para esta turma.");
  return attendanceClass;
}

export async function listLessonsForClass(user: User, classId: number) {
  await assertClassAccess(user, classId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db.select().from(lessons).where(eq(lessons.classId, classId)).orderBy(desc(lessons.lessonDate));
}

export async function createLessonForClass(user: User, input: { classId: number; lessonDate: string; startTime?: string; endTime?: string }) {
  const attendanceClass = await assertClassAccess(user, input.classId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const lessonDate = dateFromKey(input.lessonDate);
  const row: InsertLesson = {
    externalId: `LES-${randomUUID()}`,
    classId: input.classId,
    lessonDate,
    startTime: input.startTime || attendanceClass.startTime || null,
    endTime: input.endTime || attendanceClass.endTime || null,
    status: "PENDING",
    createdByUserId: user.id,
  };
  await db.insert(lessons).values(row).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const saved = await db.select().from(lessons).where(and(eq(lessons.classId, input.classId), eq(lessons.lessonDate, lessonDate))).limit(1);
  return saved[0];
}

export async function getAttendanceScreen(user: User, input: { classId: number; lessonDate: string }) {
  const attendanceClass = await assertClassAccess(user, input.classId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const lessonDate = dateFromKey(input.lessonDate);
  const lessonRows = await db.select().from(lessons).where(and(eq(lessons.classId, input.classId), eq(lessons.lessonDate, lessonDate))).limit(1);
  const lesson = lessonRows[0] ?? null;
  const classStudents = await db.select().from(students).where(eq(students.classId, input.classId)).orderBy(students.fullName);
  const records = lesson ? await db.select().from(attendance).where(eq(attendance.lessonId, lesson.id)) : [];
  const recordByStudent = new Map(records.map((record) => [record.studentId, record]));
  const visibleStudents = classStudents.filter((student) => recordByStudent.has(student.id) || (student.active && studentIsEligibleForLesson(student.entryDate, input.lessonDate)));
  return {
    attendanceClass,
    lesson,
    students: visibleStudents.map((student) => ({
      id: student.id,
      externalId: student.externalId,
      fullName: student.fullName,
      active: student.active,
      status: recordByStudent.get(student.id)?.status ?? "NOT_MARKED",
      observation: recordByStudent.get(student.id)?.observation ?? "",
    })),
  };
}

export async function saveAttendanceBatch(user: User, input: { classId: number; lessonDate: string; entries: Array<{ studentId: number; status: "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_MARKED"; observation?: string }> }) {
  await assertClassAccess(user, input.classId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const lessonDate = dateFromKey(input.lessonDate);

  return db.transaction(async (tx) => {
    const existingLesson = await tx.select().from(lessons).where(and(eq(lessons.classId, input.classId), eq(lessons.lessonDate, lessonDate))).limit(1);
    let lesson = existingLesson[0];
    if (!lesson) {
      await tx.insert(lessons).values({ externalId: `LES-${randomUUID()}`, classId: input.classId, lessonDate, status: "PENDING", createdByUserId: user.id });
      const created = await tx.select().from(lessons).where(and(eq(lessons.classId, input.classId), eq(lessons.lessonDate, lessonDate))).limit(1);
      lesson = created[0];
    }
    if (!lesson) throw new Error("Não foi possível criar a aula.");
    if (lesson.status === "CANCELLED" || lesson.status === "NO_CLASS") throw new Error("Esta aula está cancelada ou marcada como sem aula.");

    const classStudents = await tx.select().from(students).where(eq(students.classId, input.classId));
    const previous = await tx.select().from(attendance).where(eq(attendance.lessonId, lesson.id));
    const previousIds = new Set(previous.map((record) => record.studentId));
    const allowedStudents = classStudents.filter((student) => previousIds.has(student.id) || (student.active && studentIsEligibleForLesson(student.entryDate, input.lessonDate)));
    const allowedIds = new Set(allowedStudents.map((student) => student.id));
    assertCompleteBatch(allowedIds, input.entries);

    for (const entry of input.entries) {
      if (!allowedIds.has(entry.studentId)) throw new Error("Um aluno enviado não pertence à turma.");
      await tx.insert(attendance).values({
        externalId: `ATT-${randomUUID()}`,
        lessonId: lesson.id,
        studentId: entry.studentId,
        status: entry.status,
        observation: entry.observation?.trim() || null,
        recordedByUserId: user.id,
        recordedAt: new Date(),
      }).onDuplicateKeyUpdate({ set: { status: entry.status, observation: entry.observation?.trim() || null, recordedByUserId: user.id, recordedAt: new Date(), updatedAt: new Date() } });
    }

    const status = lessonStatusFor(input.entries);
    await tx.update(lessons).set({ status, updatedAt: new Date() }).where(eq(lessons.id, lesson.id));
    return { lessonId: lesson.id, status, entriesSaved: input.entries.length };
  });
}

export async function addStudentToClass(user: User, input: { classId: number; fullName: string; notes?: string }) {
  await assertClassAccess(user, input.classId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const normalizedName = input.fullName.trim().toLocaleLowerCase("pt-BR");
  const existing = await db.select().from(students).where(and(eq(students.classId, input.classId), eq(students.active, true)));
  if (existing.some((student) => student.fullName.trim().toLocaleLowerCase("pt-BR") === normalizedName)) throw new Error("Já existe um aluno ativo com esse nome nesta turma.");
  const row: InsertStudent = { externalId: `STU-${randomUUID()}`, classId: input.classId, fullName: input.fullName.trim(), active: true, entryDate: new Date(), notes: input.notes?.trim() || null };
  await db.insert(students).values(row);
  return row;
}

export async function deactivateStudentFromClass(user: User, studentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const row = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  const student = row[0];
  if (!student) throw new Error("Aluno não encontrado.");
  await assertClassAccess(user, student.classId);
  await db.update(students).set({ active: false, exitDate: new Date(), updatedAt: new Date() }).where(eq(students.id, studentId));
  return { success: true };
}

export async function createClassForAdmin(actor: User, input: { code: string; name: string; course?: string; dayOfWeek?: number; startTime?: string; endTime?: string; teacherIds: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const teacherIds = [...new Set(input.teacherIds)];
  const teachers = teacherIds.length ? await db.select().from(users).where(inArray(users.id, teacherIds)) : [];
  if (teachers.length !== teacherIds.length || teachers.some((teacher) => !teacher.active)) throw new Error("Um dos professores selecionados não está ativo.");
  const primary = teachers[0];
  const row: InsertAttendanceClass = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    course: input.course?.trim() || null,
    dayOfWeek: input.dayOfWeek ?? null,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    teacherEmail: primary?.email ?? "sem-professor@pendente.local",
    teacherName: primary?.name ?? null,
    active: true,
  };
  await db.insert(classes).values(row);
  const saved = await db.select().from(classes).where(eq(classes.code, row.code)).limit(1);
  const attendanceClass = saved[0];
  if (!attendanceClass) throw new Error("Não foi possível criar a turma.");
  if (teacherIds.length) await db.insert(classTeachers).values(teacherIds.map((userId) => ({ classId: attendanceClass.id, userId, permission: "TEACHER" as const, active: true }))).onDuplicateKeyUpdate({ set: { active: true, updatedAt: new Date() } });
  await audit(actor.id, "CREATE_CLASS", "class", String(attendanceClass.id), { teacherIds });
  return attendanceClass;
}

export async function setClassSpreadsheet(classId: number, spreadsheetId: string, spreadsheetUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(classes).set({ spreadsheetId, spreadsheetUrl, updatedAt: new Date() }).where(eq(classes.id, classId));
  const saved = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  return saved[0];
}

export async function updateClassForAdmin(actor: User, classId: number, input: { name?: string; course?: string | null; dayOfWeek?: number | null; startTime?: string | null; endTime?: string | null; active?: boolean; teacherIds?: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  if (!existing[0]) throw new Error("Turma não encontrada.");
  const update: Record<string, unknown> = { updatedAt: new Date() };
  (["name", "course", "dayOfWeek", "startTime", "endTime", "active"] as const).forEach((key) => { if (input[key] !== undefined) update[key] = input[key]; });
  if (input.teacherIds) {
    const ids = [...new Set(input.teacherIds)];
    const teacherRows = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : [];
    if (teacherRows.length !== ids.length || teacherRows.some((teacher) => !teacher.active)) throw new Error("Um dos professores selecionados não está ativo.");
    update.teacherEmail = teacherRows[0]?.email ?? "sem-professor@pendente.local";
    update.teacherName = teacherRows[0]?.name ?? null;
    await db.update(classTeachers).set({ active: false, updatedAt: new Date() }).where(eq(classTeachers.classId, classId));
    if (ids.length) await db.insert(classTeachers).values(ids.map((userId) => ({ classId, userId, permission: "TEACHER" as const, active: true }))).onDuplicateKeyUpdate({ set: { active: true, updatedAt: new Date() } });
  }
  await db.update(classes).set(update).where(eq(classes.id, classId));
  await audit(actor.id, "UPDATE_CLASS", "class", String(classId));
}

export async function listClassesForAdmin() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const classRows = await db.select().from(classes).orderBy(desc(classes.active), classes.name);
  const links = await db.select().from(classTeachers).where(eq(classTeachers.active, true));
  const teacherRows = await db.select().from(users);
  const teacherById = new Map(teacherRows.map((teacher) => [teacher.id, publicUser(teacher)]));
  return classRows.map((attendanceClass) => ({ ...attendanceClass, teachers: links.filter((link) => link.classId === attendanceClass.id).map((link) => teacherById.get(link.userId)).filter(Boolean) }));
}

export async function createClass(input: InsertAttendanceClass) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(classes).values(input);
}
