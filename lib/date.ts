import { format } from "date-fns";
import { tz } from "@date-fns/tz";

// All dateKey math is done in UTC on "YYYY-MM-DD" strings (PLAN §1 R10); never machine-local time.
const DAY_MS = 86_400_000;
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// "Today" is always Asia/Seoul (R10).
export function todayKey(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd", { in: tz("Asia/Seoul") });
}

// Regex plus a real calendar check (rejects 2026-02-30).
export function isValidDateKey(s: string): boolean {
  return KEY_RE.test(s) && fromUtcMs(toUtcMs(s)) === s;
}

export function addDaysKey(key: string, n: number): string {
  return fromUtcMs(toUtcMs(key) + n * DAY_MS);
}

export function isMonday(key: string): boolean {
  return new Date(toUtcMs(key)).getUTCDay() === 1;
}

// Weeks start on Monday and end 6 days later (R1).
export function weekEnd(startKey: string): string {
  return addDaysKey(startKey, 6);
}

export function mondayOf(key: string): string {
  const dow = new Date(toUtcMs(key)).getUTCDay(); // 0 = Sunday
  return addDaysKey(key, -((dow + 6) % 7));
}

// Inclusive; dateKeys compare correctly as strings.
export function isWithin(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export function yearOf(key: string): number {
  return Number(key.slice(0, 4));
}

// Same month/day n years later; Feb 29 falls back to Feb 28 in non-leap years.
export function addYearsKey(key: string, n: number): string {
  const next = `${String(yearOf(key) + n).padStart(4, "0")}${key.slice(4)}`;
  return isValidDateKey(next) ? next : `${next.slice(0, 8)}28`;
}
