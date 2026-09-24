export const SCHOOL_TIME_ZONE = "America/Sao_Paulo";

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateKeyInTimeZone(value: Date, timeZone = SCHOOL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Converts a civil date to a stable display value without allowing local timezone shifts. */
export function formatCivilDate(dateKey: string, locale = "pt-BR"): string {
  if (!isDateKey(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split("-").map(Number);
  const stableDate = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(stableDate).replace(".", "");
}

export function todayDateKey(timeZone = SCHOOL_TIME_ZONE, now = new Date()): string {
  return dateKeyInTimeZone(now, timeZone);
}

export function weekdayForDateKey(dateKey: string): number | null {
  if (!isDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function dateKeyFromDate(value: Date): string {
  // Database DATE values represent a civil date. UTC components avoid local-machine shifts.
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}
