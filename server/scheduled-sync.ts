import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { retryPendingSyncBatches } from "./attendance-sync";

export async function runAttendanceSyncScheduled(req: Request, res: Response) {
  try {
    const identity = await sdk.authenticateRequest(req) as { isCron?: boolean };
    if (!identity?.isCron) {
      res.status(403).json({ error: "Apenas o agendador de produção pode executar esta rotina." });
      return;
    }
    const results = await retryPendingSyncBatches(30);
    res.json({ ok: true, processed: results.length, synced: results.filter((item) => item.status === "SYNCED").length });
  } catch {
    res.status(403).json({ error: "Execução agendada não autorizada." });
  }
}
