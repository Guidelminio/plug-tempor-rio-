import { ENV } from "./_core/env";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
};

export type EmailSendResult = { id: string };

function configured() {
  return Boolean(ENV.resendApiKey && ENV.attendanceEmailFrom);
}

export async function sendTransactionalEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (!configured()) {
    throw new Error("O serviço de e-mail ainda não está configurado.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: ENV.attendanceEmailFrom,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.id !== "string") {
    const detail = typeof payload.message === "string" ? payload.message : response.statusText;
    throw new Error(`Falha no envio do e-mail (${response.status}): ${detail}`);
  }
  return { id: payload.id };
}

export function alertRecipient() {
  return ENV.attendanceAlertToEmail;
}
