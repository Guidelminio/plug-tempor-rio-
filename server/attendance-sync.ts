import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { attendance, classes, lessons, students, syncBatches, syncEvents, users } from "../drizzle/schema";
import { callAppsScript, isAppsScriptSyncConfigured } from "./apps-script-sync";
import { createNotification, getDb } from "./db";

export async function enqueueAttendanceSync(input: { lessonId: number; classId: number; userId: number; externalId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = await db.select().from(syncBatches).where(eq(syncBatches.externalId, input.externalId)).limit(1);
  if (existing[0]) return existing[0];

  const lesson = (await db.select().from(lessons).where(eq(lessons.id, input.lessonId)).limit(1))[0];
  const attendanceClass = (await db.select().from(classes).where(eq(classes.id, input.classId)).limit(1))[0];
  if (!lesson || !attendanceClass) throw new Error("Aula ou turma não encontrada para sincronização.");
  const records = await db.select().from(attendance).where(eq(attendance.lessonId, lesson.id));
  const studentRows = records.length ? await db.select().from(students).where(inArray(students.id, records.map((record) => record.studentId))) : [];
  const studentsById = new Map(studentRows.map((student) => [student.id, student]));
  const owner = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
  const payload = {
    batchId: input.externalId,
    class: { code: attendanceClass.code, name: attendanceClass.name, course: attendanceClass.course },
    lesson: { id: lesson.externalId, date: lesson.lessonDate, startTime: lesson.startTime, endTime: lesson.endTime, status: lesson.status },
    teacher: { id: owner?.id ?? null, name: owner?.name ?? null, email: owner?.email ?? null },
    records: records.map((record) => ({
      studentId: studentsById.get(record.studentId)?.externalId ?? String(record.studentId),
      studentName: studentsById.get(record.studentId)?.fullName ?? "Aluno não localizado",
      status: record.status,
      observation: record.observation,
      recordedAt: record.recordedAt,
    })),
  };
  await db.insert(syncBatches).values({
    externalId: input.externalId,
    classId: input.classId,
    lessonId: input.lessonId,
    createdByUserId: input.userId,
    payloadJson: JSON.stringify(payload),
    status: "PENDING",
  });
  const batch = (await db.select().from(syncBatches).where(eq(syncBatches.externalId, input.externalId)).limit(1))[0];
  if (!batch) throw new Error("Não foi possível criar o lote de sincronização.");
  return batch;
}

export async function processSyncBatch(batchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const batch = (await db.select().from(syncBatches).where(eq(syncBatches.id, batchId)).limit(1))[0];
  if (!batch) throw new Error("Lote de sincronização não encontrado.");
  if (batch.status === "SYNCED") return batch;
  if (!isAppsScriptSyncConfigured()) return markBatchFailed(batch.id, "Ponte Google Sheets não configurada.");

  await db.update(syncBatches).set({ status: "PROCESSING", attempts: batch.attempts + 1, updatedAt: new Date() }).where(eq(syncBatches.id, batch.id));
  await db.insert(syncEvents).values({ batchId: batch.id, status: "PROCESSING", responseMessage: "Envio iniciado." });
  try {
    const payload = JSON.parse(batch.payloadJson);
    await callAppsScript({ action: "syncAttendance", batch: payload });
    await db.update(syncBatches).set({ status: "SYNCED", lastError: null, syncedAt: new Date(), updatedAt: new Date() }).where(eq(syncBatches.id, batch.id));
    await db.insert(syncEvents).values({ batchId: batch.id, status: "SYNCED", responseMessage: "Planilha atualizada." });
    if (batch.createdByUserId) await createNotification(batch.createdByUserId, { type: "SYNCED", title: "Planilha atualizada", message: "A chamada foi sincronizada com o Google Sheets.", referenceType: "syncBatch", referenceId: batch.externalId });
    return { ...batch, status: "SYNCED" as const };
  } catch (error) {
    return markBatchFailed(batch.id, error instanceof Error ? error.message : "Erro desconhecido na sincronização.");
  }
}

async function markBatchFailed(batchId: number, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(syncBatches).set({ status: "FAILED", lastError: message, updatedAt: new Date() }).where(eq(syncBatches.id, batchId));
  await db.insert(syncEvents).values({ batchId, status: "FAILED", responseMessage: message });
  const batch = (await db.select().from(syncBatches).where(eq(syncBatches.id, batchId)).limit(1))[0];
  if (batch?.createdByUserId) {
    await createNotification(batch.createdByUserId, { type: "SYNC_FAILED", title: "Sincronização pendente", message: "A chamada foi salva, mas a planilha ainda não foi atualizada. O sistema tentará novamente.", referenceType: "syncBatch", referenceId: batch.externalId });
    const owner = (await db.select().from(users).where(eq(users.id, batch.createdByUserId)).limit(1))[0];
    if (owner?.email && isAppsScriptSyncConfigured()) {
      void callAppsScript({ action: "sendNotification", notification: { to: owner.email, subject: "Plug Presença: sincronização pendente", body: `<p>A chamada foi salva no aplicativo, mas a planilha ainda não foi atualizada.</p><p>Motivo: ${message}</p>` } }).catch(() => undefined);
    }
  }
  return { ...batch, status: "FAILED" as const, lastError: message };
}

export async function retryPendingSyncBatches(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const batches = await db.select().from(syncBatches).where(and(
    inArray(syncBatches.status, ["PENDING", "FAILED"]),
  )).limit(limit);
  return Promise.all(batches.map((batch) => processSyncBatch(batch.id)));
}

export function createBatchId() {
  return `SYN-${randomUUID()}`;
}
