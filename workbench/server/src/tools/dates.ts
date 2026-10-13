const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const pad = (value: number) => String(value).padStart(2, "0");

export function localDate(value = new Date()): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday] ?? "";
}

export function formatLocalDateTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return undefined;
  return `${localDate(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function formatNow(value: Date): string {
  return `${localDate(value)} ${WEEKDAYS[value.getDay()]} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
