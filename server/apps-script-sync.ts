import { createHmac } from "node:crypto";
import { ENV } from "./_core/env";

export type AppsScriptSyncPayload = {
  action: "syncAttendance" | "sendNotification";
  batch?: Record<string, unknown>;
  notification?: { to: string; subject: string; body: string };
};

function canonicalPayload(payload: AppsScriptSyncPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function signatureFor(payload: AppsScriptSyncPayload) {
  if (!ENV.appsScriptSyncSecret) throw new Error("O segredo da ponte Apps Script não está configurado.");
  return createHmac("sha256", ENV.appsScriptSyncSecret).update(canonicalPayload(payload)).digest("base64");
}

export function isAppsScriptSyncConfigured() {
  return Boolean(ENV.appsScriptSyncUrl && ENV.appsScriptSyncSecret);
}

export async function callAppsScript(payload: AppsScriptSyncPayload) {
  if (!isAppsScriptSyncConfigured()) throw new Error("A ponte Google Sheets ainda não foi configurada.");
  const response = await fetch(ENV.appsScriptSyncUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, signature: signatureFor(payload) }),
  });
  const text = await response.text();
  let data: { ok?: boolean; error?: string; message?: string } = {};
  try { data = JSON.parse(text); } catch { /* The Apps Script endpoint can return text on deployment errors. */ }
  if (!response.ok || !data.ok) throw new Error(data.error || text || `Ponte Google retornou ${response.status}.`);
  return data;
}
