import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("Apps Script attendance synchronization", () => {
  it("accepts a signed idempotent attendance batch", async () => {
    const url = process.env.APPS_SCRIPT_SYNC_URL;
    const secret = process.env.APPS_SCRIPT_SYNC_SECRET;
    expect(url).toMatch(/^https:\/\//);
    expect(secret).toBeTruthy();
    const payload = {
      action: "syncAttendance",
      batch: {
        batchId: "INT-20260917-BRIDGE-UTF8",
        class: { code: "HOMOLOG", name: "Turma de Homologação", course: "Plug Presença" },
        lesson: { id: "LESSON-HOMOLOG-20260917", date: "2026-09-17", startTime: "19:00", endTime: "20:00", status: "CLOSED" },
        teacher: { id: 0, name: "Verificação técnica", email: "tecnico@plugandplus.local" },
        records: [{ studentId: "TEST-STUDENT-001", studentName: "Aluno de Homologação", status: "PRESENT", observation: "Registro técnico de validação", recordedAt: "2026-09-17T20:00:00.000Z" }],
      },
    };
    const signature = createHmac("sha256", secret!).update(Buffer.from(JSON.stringify(payload), "utf8").toString("base64")).digest("base64");
    const response = await fetch(url!, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, signature }) });
    const body = await response.json() as { ok?: boolean; error?: string };
    expect(response.status, body.error).toBe(200);
    expect(body.ok, body.error).toBe(true);
  }, 30_000);
});
