import type { Request, Response } from "express";
import { runAttendanceReminderJob } from "./attendance-reminders";
import { sdk } from "./_core/sdk";

export async function runAttendanceRemindersScheduled(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    const scheduledUser = user as typeof user & { isCron?: boolean; taskUid?: string };
    if (!scheduledUser.isCron || !scheduledUser.taskUid) {
      return res.status(403).json({ error: "Apenas a tarefa agendada pode executar os lembretes." });
    }
    const result = await runAttendanceReminderJob(scheduledUser.taskUid);
    return res.status(200).json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 401 || statusCode === 403) {
      return res.status(403).json({ error: "Apenas a tarefa agendada pode executar os lembretes." });
    }
    console.error("[Attendance reminders] scheduled execution failed", error);
    return res.status(500).json({
      error: detail,
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl },
    });
  }
}
