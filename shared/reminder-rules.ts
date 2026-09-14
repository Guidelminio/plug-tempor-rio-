export const REMINDER_TIME_ZONE = "America/Sao_Paulo";

export function dateKeyInTimeZone(value: Date, timeZone = REMINDER_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isReminderDue(lastReminderAt: Date | null, todayKey: string, timeZone = REMINDER_TIME_ZONE) {
  return !lastReminderAt || dateKeyInTimeZone(lastReminderAt, timeZone) !== todayKey;
}

export function classMeetsOnDate(dayOfWeek: number | null, dateKey: string) {
  if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) return false;
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return date.getUTCDay() === dayOfWeek;
}

export function attendanceReminderSubject(className: string, lessonDate: string) {
  return `Ação necessária: chamada pendente — ${className} (${lessonDate})`;
}

export function attendanceReminderHtml(input: { teacherName: string | null; className: string; lessonDate: string; appUrl?: string }) {
  const greeting = input.teacherName?.trim() ? `Olá, ${input.teacherName.trim()}.` : "Olá, professor(a).";
  const link = input.appUrl ? `<p><a href="${input.appUrl}">Abrir o aplicativo de presença</a></p>` : "";
  return `<p>${greeting}</p><p>A chamada da turma <strong>${input.className}</strong>, referente a <strong>${input.lessonDate}</strong>, ainda não foi finalizada.</p><p>Abra o aplicativo, selecione a aula e marque todos os alunos. O envio atualiza a chamada inteira de uma vez.</p>${link}<p>Mensagem automática do Plug Presença.</p>`;
}
