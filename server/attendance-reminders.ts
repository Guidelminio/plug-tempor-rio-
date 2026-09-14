import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  attendanceReminderDispatches,
  attendanceReminderSettings,
  classes,
  lessons,
} from "../drizzle/schema";
import {
  attendanceReminderHtml,
  attendanceReminderSubject,
  classMeetsOnDate,
  dateKeyInTimeZone,
  isReminderDue,
  REMINDER_TIME_ZONE,
} from "../shared/reminder-rules";
import { getDb } from "./db";
import { alertRecipient, sendTransactionalEmail } from "./reminder-email";
import { ENV } from "./_core/env";

export type ReminderCandidate = {
  classId: number;
  className: string;
  teacherName: string | null;
  teacherEmail: string;
  lessonId: number | null;
  lastReminderAt: Date | null;
};

function dateFromKey(value: string): Date {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data de lembrete inválida.");
  return parsed;
}

export async function getReminderSettings() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const rows = await db.select().from(attendanceReminderSettings).where(eq(attendanceReminderSettings.id, 1)).limit(1);
  return rows[0] ?? null;
}

export async function getPendingReminderCandidates(reminderDate: string, timeZone = REMINDER_TIME_ZONE): Promise<ReminderCandidate[]> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const scheduledClasses = (await db.select().from(classes).where(eq(classes.active, true)))
    .filter((item) => classMeetsOnDate(item.dayOfWeek, reminderDate));
  if (!scheduledClasses.length) return [];

  const reminderDateValue = dateFromKey(reminderDate);
  const candidates: ReminderCandidate[] = [];
  for (const attendanceClass of scheduledClasses) {
    const lessonRows = await db.select().from(lessons)
      .where(and(eq(lessons.classId, attendanceClass.id), eq(lessons.lessonDate, reminderDateValue)))
      .limit(1);
    const lesson = lessonRows[0] ?? null;
    if (lesson?.status === "CLOSED" || lesson?.status === "CANCELLED" || lesson?.status === "NO_CLASS") continue;
    if (lesson && !isReminderDue(lesson.lastReminderAt, reminderDate, timeZone)) continue;
    candidates.push({
      classId: attendanceClass.id,
      className: attendanceClass.name,
      teacherName: attendanceClass.teacherName,
      teacherEmail: attendanceClass.teacherEmail,
      lessonId: lesson?.id ?? null,
      lastReminderAt: lesson?.lastReminderAt ?? null,
    });
  }
  return candidates;
}

async function claimDispatch(candidate: ReminderCandidate, reminderDate: string, type: "TEACHER_REMINDER" | "ERROR_ALERT", recipientEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  try {
    await db.insert(attendanceReminderDispatches).values({
      externalId: `RMD-${randomUUID()}`,
      classId: candidate.classId,
      lessonId: candidate.lessonId,
      reminderDate: dateFromKey(reminderDate),
      type,
      status: "PROCESSING",
      recipientEmail,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") return null;
    throw error;
  }
  const created = await db.select().from(attendanceReminderDispatches)
    .where(and(
      eq(attendanceReminderDispatches.classId, candidate.classId),
      eq(attendanceReminderDispatches.reminderDate, dateFromKey(reminderDate)),
      eq(attendanceReminderDispatches.type, type),
    ))
    .limit(1);
  return created[0] ?? null;
}

async function finishDispatch(dispatchId: number, result: { status: "SENT" | "FAILED" | "SKIPPED"; providerMessageId?: string; errorMessage?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(attendanceReminderDispatches).set({
    status: result.status,
    providerMessageId: result.providerMessageId ?? null,
    errorMessage: result.errorMessage ?? null,
    sentAt: result.status === "SENT" ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(attendanceReminderDispatches.id, dispatchId));
}

async function recordLessonReminder(candidate: ReminderCandidate) {
  if (!candidate.lessonId) return;
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(lessons).set({
    lastReminderAt: new Date(),
    reminderCount: (await db.select().from(lessons).where(eq(lessons.id, candidate.lessonId)).limit(1))[0]!.reminderCount + 1,
    updatedAt: new Date(),
  }).where(eq(lessons.id, candidate.lessonId));
}

async function sendErrorAlert(candidate: ReminderCandidate, reminderDate: string, detail: string) {
  const recipient = alertRecipient();
  if (!recipient) return { status: "SKIPPED" as const };
  const dispatch = await claimDispatch(candidate, reminderDate, "ERROR_ALERT", recipient);
  if (!dispatch) return { status: "SKIPPED" as const };
  try {
    const response = await sendTransactionalEmail({
      to: recipient,
      subject: `Erro no lembrete de chamada — ${candidate.className}`,
      html: `<p>O Plug Presença não conseguiu enviar o lembrete de chamada da turma <strong>${candidate.className}</strong> para ${candidate.teacherEmail}.</p><p>Data: ${reminderDate}</p><p>Detalhe técnico: ${detail}</p>`,
      idempotencyKey: `attendance-error-${dispatch.externalId}`,
    });
    await finishDispatch(dispatch.id, { status: "SENT", providerMessageId: response.id });
    return { status: "SENT" as const };
  } catch (error) {
    await finishDispatch(dispatch.id, { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error) });
    return { status: "FAILED" as const };
  }
}

export async function runAttendanceReminderJob(taskUid: string | undefined, now = new Date()) {
  const settings = await getReminderSettings();
  if (!settings?.enabled) return { ok: true, skipped: "disabled" as const, sent: 0, failed: 0 };
  if (!settings.scheduleCronTaskUid || settings.scheduleCronTaskUid !== taskUid) {
    return { ok: true, skipped: "unconfigured-or-orphan" as const, sent: 0, failed: 0 };
  }

  const reminderDate = dateKeyInTimeZone(now, settings.timeZone || REMINDER_TIME_ZONE);
  const candidates = await getPendingReminderCandidates(reminderDate, settings.timeZone || REMINDER_TIME_ZONE);
  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const dispatch = await claimDispatch(candidate, reminderDate, "TEACHER_REMINDER", candidate.teacherEmail);
    if (!dispatch) continue;
    try {
      const response = await sendTransactionalEmail({
        to: candidate.teacherEmail,
        subject: attendanceReminderSubject(candidate.className, reminderDate),
        html: attendanceReminderHtml({
          teacherName: candidate.teacherName,
          className: candidate.className,
          lessonDate: reminderDate,
          appUrl: ENV.attendanceAppUrl,
        }),
        idempotencyKey: `attendance-reminder-${dispatch.externalId}`,
      });
      await finishDispatch(dispatch.id, { status: "SENT", providerMessageId: response.id });
      await recordLessonReminder(candidate);
      sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await finishDispatch(dispatch.id, { status: "FAILED", errorMessage: detail });
      await sendErrorAlert(candidate, reminderDate, detail);
      failed += 1;
    }
  }
  return { ok: true, skipped: null, date: reminderDate, candidates: candidates.length, sent, failed };
}
