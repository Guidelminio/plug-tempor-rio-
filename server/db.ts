import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  attendance,
  classes,
  InsertAttendanceClass,
  InsertLesson,
  InsertStudent,
  InsertUser,
  lessons,
  students,
  users,
  type AttendanceClass,
  type User,
} from "../drizzle/schema";
import { assertCompleteBatch, isTeacherAuthorized, lessonStatusFor, studentIsEligibleForLesson } from "../shared/attendance-rules";
import { ENV } from "./_core/env";

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
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

export async function listClassesForUser(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const all = await db.select().from(classes).where(eq(classes.active, true)).orderBy(classes.name);
  if (isAdmin(user)) return all;
  const email = normalizedEmail(user.email);
  return all.filter((item) => normalizedEmail(item.teacherEmail) === email);
}

export async function assertClassAccess(user: User, classId: number): Promise<AttendanceClass> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  const attendanceClass = result[0];
  if (!attendanceClass || !attendanceClass.active) throw new Error("Turma não encontrada ou inativa.");
  if (!isTeacherAuthorized(attendanceClass.teacherEmail, user.email, isAdmin(user))) {
    throw new Error("Sua conta Google não está autorizada para esta turma.");
  }
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
  const visibleStudents = classStudents.filter((student) =>
    recordByStudent.has(student.id) || (student.active && studentIsEligibleForLesson(student.entryDate, input.lessonDate)),
  );
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

export async function saveAttendanceBatch(
  user: User,
  input: { classId: number; lessonDate: string; entries: Array<{ studentId: number; status: "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_MARKED"; observation?: string }> },
) {
  await assertClassAccess(user, input.classId);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const lessonDate = dateFromKey(input.lessonDate);

  return db.transaction(async (tx) => {
    const existingLesson = await tx.select().from(lessons).where(and(eq(lessons.classId, input.classId), eq(lessons.lessonDate, lessonDate))).limit(1);
    let lesson = existingLesson[0];
    if (!lesson) {
      await tx.insert(lessons).values({
        externalId: `LES-${randomUUID()}`,
        classId: input.classId,
        lessonDate,
        status: "PENDING",
        createdByUserId: user.id,
      });
      const created = await tx.select().from(lessons).where(and(eq(lessons.classId, input.classId), eq(lessons.lessonDate, lessonDate))).limit(1);
      lesson = created[0];
    }
    if (!lesson) throw new Error("Não foi possível criar a aula.");
    if (lesson.status === "CANCELLED" || lesson.status === "NO_CLASS") throw new Error("Esta aula está cancelada ou marcada como sem aula.");

    const classStudents = await tx.select().from(students).where(eq(students.classId, input.classId));
    const previous = await tx.select().from(attendance).where(eq(attendance.lessonId, lesson.id));
    const previousIds = new Set(previous.map((record) => record.studentId));
    const allowedStudents = classStudents.filter((student) =>
      previousIds.has(student.id) || (student.active && studentIsEligibleForLesson(student.entryDate, input.lessonDate)),
    );
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
      }).onDuplicateKeyUpdate({
        set: {
          status: entry.status,
          observation: entry.observation?.trim() || null,
          recordedByUserId: user.id,
          recordedAt: new Date(),
          updatedAt: new Date(),
        },
      });
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
  if (existing.some((student) => student.fullName.trim().toLocaleLowerCase("pt-BR") === normalizedName)) {
    throw new Error("Já existe um aluno ativo com esse nome nesta turma.");
  }
  const row: InsertStudent = {
    externalId: `STU-${randomUUID()}`,
    classId: input.classId,
    fullName: input.fullName.trim(),
    active: true,
    entryDate: new Date(),
    notes: input.notes?.trim() || null,
  };
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

export async function createClass(input: InsertAttendanceClass) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(classes).values(input);
}
