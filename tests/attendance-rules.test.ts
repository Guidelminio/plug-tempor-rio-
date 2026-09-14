import { describe, expect, it } from "vitest";
import { assertCompleteBatch, isTeacherAuthorized, lessonStatusFor, studentIsEligibleForLesson } from "../shared/attendance-rules";
import { attendanceReminderHtml, attendanceReminderSubject, classMeetsOnDate, isReminderDue } from "../shared/reminder-rules";

describe("attendance batch rules", () => {
  it("accepts one entry for each eligible student", () => {
    expect(() => assertCompleteBatch([101, 102, 103], [
      { studentId: 101, status: "PRESENT" },
      { studentId: 102, status: "ABSENT" },
      { studentId: 103, status: "EXCUSED" },
    ])).not.toThrow();
  });

  it("rejects missing or duplicate student entries", () => {
    expect(() => assertCompleteBatch([101, 102], [
      { studentId: 101, status: "PRESENT" },
      { studentId: 101, status: "ABSENT" },
    ])).toThrow("exatamente uma vez");
  });

  it("closes a lesson only when no record remains unmarked", () => {
    expect(lessonStatusFor([{ studentId: 1, status: "PRESENT" }])).toBe("CLOSED");
    expect(lessonStatusFor([{ studentId: 1, status: "NOT_MARKED" }])).toBe("PENDING");
  });

  it("matches teacher emails case-insensitively and permits administrators", () => {
    expect(isTeacherAuthorized("lia@plug.com", "LIA@PLUG.COM")).toBe(true);
    expect(isTeacherAuthorized("lia@plug.com", "outro@plug.com")).toBe(false);
    expect(isTeacherAuthorized("lia@plug.com", "outro@plug.com", true)).toBe(true);
  });

  it("does not add a student retroactively to lessons before the entry date", () => {
    const entryDate = new Date("2026-09-12T12:00:00.000Z");
    expect(studentIsEligibleForLesson(entryDate, "2026-09-05")).toBe(false);
    expect(studentIsEligibleForLesson(entryDate, "2026-09-12")).toBe(true);
  });

  it("selects only classes scheduled for the reminder date and avoids duplicate daily reminders", () => {
    // 14 Sep 2026 is Monday (1 in JavaScript's weekday convention).
    expect(classMeetsOnDate(1, "2026-09-14")).toBe(true);
    expect(classMeetsOnDate(0, "2026-09-14")).toBe(false);
    expect(isReminderDue(new Date("2026-09-14T14:00:00.000Z"), "2026-09-14")).toBe(false);
    expect(isReminderDue(new Date("2026-09-13T23:00:00.000Z"), "2026-09-14")).toBe(true);
  });

  it("formats a direct reminder with a clear app link", () => {
    expect(attendanceReminderSubject("Turma 1", "2026-09-14")).toContain("Turma 1");
    const html = attendanceReminderHtml({
      teacherName: "Lia",
      className: "Turma 1",
      lessonDate: "2026-09-14",
      appUrl: "https://presenca.example",
    });
    expect(html).toContain("Olá, Lia.");
    expect(html).toContain("https://presenca.example");
  });
});
