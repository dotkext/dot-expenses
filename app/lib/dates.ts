/**
 * Date helpers. Dates are handled as local "YYYY-MM-DD" strings end to end
 * (DB `date` columns, API payloads, form inputs) and never pass through
 * `new Date("YYYY-MM-DD")` — which parses as UTC and shifts timezones.
 */

import { addMonths as addMonthsDate, format as fmt } from "date-fns";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidDateStr(value: string | null | undefined): value is string {
  return !!value && DATE_RE.test(value);
}

export function isValidMonthStr(value: string | null | undefined): value is string {
  return !!value && MONTH_RE.test(value);
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local today as "YYYY-MM-DD". */
export function todayStr(): string {
  return toDay(new Date());
}

export function toDay(date: Date): string {
  return fmt(date, "yyyy-MM-dd");
}

/** Current local month as "YYYY-MM". */
export function currentMonth(): string {
  return fmt(new Date(), "yyyy-MM");
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  return fmt(addMonthsDate(parseDay(`${month}-01`), n), "yyyy-MM");
}

/** Inclusive first/last day of the month, plus the previous month key. */
export function monthRange(month: string): { start: string; end: string; prev: string } {
  const first = parseDay(`${month}-01`);
  const last = addMonthsDate(first, 1);
  last.setDate(0);
  return {
    start: `${month}-01`,
    end: toDay(last),
    prev: addMonths(month, -1),
  };
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

/** "March 2026" */
export function monthLabel(month: string): string {
  return fmt(parseDay(`${month}-01`), "MMMM yyyy");
}

/** "12 Mar 2026" */
export function formatDateStr(day: string): string {
  return fmt(parseDay(day), "d MMM yyyy");
}

/** "12 Mar" */
export function formatDateShort(day: string): string {
  return fmt(parseDay(day), "d MMM");
}

/** "Mar 2026" (chart axis) */
export function monthShortLabel(month: string): string {
  return fmt(parseDay(`${month}-01`), "MMM yy");
}

export function weekdayNames(): string[] {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

/** Local date -> "YYYY-MM-DD" used when advancing recurrence dates. */
export function toDayFromDate(date: Date): string {
  return toDay(date);
}
