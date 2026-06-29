import { HttpError } from "./http.js";

const KST_OFFSET = "+09:00";
const STORE_TIME_ZONE = "Asia/Seoul";

export function parseDateOnly(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, "INVALID_DATE", "Invalid date value");
  }

  return parsed;
}

export function formatDateOnly(date: Date): string;
export function formatDateOnly(date: Date | null): string | null;
export function formatDateOnly(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

export function parseStoreDateTime(value: string): Date {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00${KST_OFFSET}`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value}${KST_OFFSET}`
      : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "INVALID_DATETIME", "Invalid date-time value");
  }

  return parsed;
}

export function parseStoreDateStart(date: string): Date {
  return parseStoreDateTime(`${date}T00:00`);
}

export function parseStoreDateEnd(date: string): Date {
  const start = parseDateOnly(date);
  start.setUTCDate(start.getUTCDate() + 1);
  return parseStoreDateStart(formatDateOnly(start));
}

export function todayInStoreTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function subtractDays(date: string, days: number): string {
  const value = parseDateOnly(date);
  value.setUTCDate(value.getUTCDate() - days);
  return formatDateOnly(value);
}

export function formatTimeOnly(date: Date): string {
  return date.toISOString().slice(11, 16);
}

export function parseTimeOnly(time: string): Date {
  const [hour = "0", minute = "0", second = "0"] = time.split(":");
  return new Date(Date.UTC(1970, 0, 1, Number(hour), Number(minute), Number(second)));
}
