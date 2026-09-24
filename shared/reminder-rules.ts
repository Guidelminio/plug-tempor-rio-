import { dateKeyInTimeZone } from "./civil-date";
export { dateKeyInTimeZone } from "./civil-date";

export const REMINDER_TIME_ZONE = "America/Sao_Paulo";

export function isReminderDue(lastReminderAt: Date | null, todayKey: string, timeZone = REMINDER_TIME_ZONE) {
  return !lastReminderAt || dateKeyInTimeZone(lastReminderAt, timeZone) !== todayKey;
}

export function classMeetsOnDate(dayOfWeek: number | null, dateKey: string) {
  if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) return false;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return false;
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() === dayOfWeek;
}

export function attendanceReminderSubject(className: string, lessonDate: string) {
  return `Ação necessária: chamada pendente — ${className} (${lessonDate})`;
}

export function attendanceReminderHtml(input: { teacherName: string | null; className: string; lessonDate: string; appUrl?: string }) {
  const greeting = input.teacherName?.trim() ? `Olá, ${input.teacherName.trim()}.` : "Olá, professor(a).";
  const link = input.appUrl ? `<p><a href="${input.appUrl}">Abrir o aplicativo de presença</a></p>` : "";
  return `<p>${greeting}</p><p>A chamada da turma <strong>${input.className}</strong>, referente a <strong>${input.lessonDate}</strong>, ainda não foi finalizada.</p><p>Abra o aplicativo, selecione a aula e marque todos os alunos. O envio atualiza a chamada inteira de uma vez.</p>${link}<p>Mensagem automática do Plug Presença.</p>`;
}
