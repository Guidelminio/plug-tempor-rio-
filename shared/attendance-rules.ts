import { dateKeyFromDate, isDateKey, weekdayForDateKey } from "./civil-date";

export const attendanceStatuses = ["PRESENT", "ABSENT", "EXCUSED", "NOT_MARKED"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type AttendanceBatchEntry = { studentId: number; status: AttendanceStatus };

export function assertCompleteBatch(allowedStudentIds: Iterable<number>, entries: AttendanceBatchEntry[]) {
  const allowed = new Set(allowedStudentIds);
  const received = entries.map((entry) => entry.studentId);
  const uniqueReceived = new Set(received);
  const hasSameMembership = uniqueReceived.size === allowed.size && [...allowed].every((id) => uniqueReceived.has(id));
  if (uniqueReceived.size !== received.length || !hasSameMembership) {
    throw new Error("A chamada deve conter cada aluno aplicável exatamente uma vez.");
  }
}

export function lessonStatusFor(entries: AttendanceBatchEntry[]): "CLOSED" | "PENDING" {
  return entries.every((entry) => entry.status !== "NOT_MARKED") ? "CLOSED" : "PENDING";
}

export function isTeacherAuthorized(teacherEmail: string, signedInEmail: string | null | undefined, isAdmin = false) {
  if (isAdmin) return true;
  return teacherEmail.trim().toLowerCase() === (signedInEmail ?? "").trim().toLowerCase();
}

export function studentIsEligibleForLesson(entryDate: Date | null, lessonDateKey: string) {
  return !entryDate || (isDateKey(lessonDateKey) && dateKeyFromDate(entryDate) <= lessonDateKey);
}

export function lessonWeekday(lessonDateKey: string) {
  return weekdayForDateKey(lessonDateKey);
}
