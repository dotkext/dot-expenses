/**
 * Recurrence helpers shared by the recurring service (server) and the UI.
 * Pure functions on "YYYY-MM-DD" strings — no timezone conversions.
 */

import { DEFAULT_LOCALE, createTranslator, getI18n, type Locale } from "./i18n/core";
import { parseDay, toDay } from "./dates";

export type Frequency = {
  unit: "day" | "week" | "month" | "year";
  interval: number;
  byDay: number | null;
};

/** Next occurrence strictly after `from`, following the rule's cadence. */
export function advanceDate(from: string, rule: Frequency): string {  const d = parseDay(from);

  switch (rule.unit) {
    case "day": {
      d.setDate(d.getDate() + rule.interval);
      return toDay(d);
    }
    case "week": {
      d.setDate(d.getDate() + rule.interval * 7);
      if (rule.byDay != null) {
        const delta = (rule.byDay - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + delta);
      }
      return toDay(d);
    }
    case "month": {
      const day = rule.byDay ?? d.getDate();
      const target = new Date(d.getFullYear(), d.getMonth() + rule.interval, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(day, lastDay));
      return toDay(target);
    }
    case "year": {
      const target = new Date(d.getFullYear() + rule.interval, d.getMonth(), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(d.getDate(), lastDay));
      return toDay(target);
    }
  }
}

/** First occurrence on or after `target`, fast-forwarding from `from`. */
export function firstOccurrenceOnOrAfter(
  rule: Frequency,
  from: string,
  target: string,
  cap = 2000,
): string {
  let current = from;
  let guard = 0;
  while (current < target && guard++ < cap) current = advanceDate(current, rule);
  return current;
}

function ordinal(locale: Locale, n: number): string {
  if (locale !== "en") return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Human description, e.g. "Every 2 weeks on Mon" or "Monthly on the 1st". */
export function describeFrequency(rule: Frequency, locale: Locale = DEFAULT_LOCALE): string {
  const t = createTranslator(locale);

  switch (rule.unit) {
    case "day":
      return rule.interval === 1 ? t("freq.daily") : t("freq.everyDays", { count: rule.interval });
    case "week": {
      const index = rule.byDay ?? dOW(rule);
      const day = getI18n(locale).weekdayName(index) || String(index);
      return rule.interval === 1
        ? t("freq.weeklyOn", { day })
        : t("freq.everyWeeksOn", { count: rule.interval, day });
    }
    case "month": {
      const day = rule.byDay != null ? ordinal(locale, rule.byDay) : null;
      if (rule.interval === 1) {
        return day ? t("freq.monthlyOn", { day }) : t("freq.monthly");
      }
      return day
        ? t("freq.everyMonthsOn", { count: rule.interval, day })
        : t("freq.everyMonths", { count: rule.interval });
    }
    case "year":
      return rule.interval === 1
        ? t("freq.yearly")
        : t("freq.everyYears", { count: rule.interval });
  }
}

function dOW(_rule: Frequency): number {
  return 1; // fallback weekday when byDay is null
}

/**
 * Virtual occurrences between `from` (inclusive) and `until` (exclusive-ish
 * date string) — never materializes transactions.
 */
export function projectOccurrences(
  rule: Frequency,
  from: string,
  until: string,
  cap = 24,
): string[] {
  const dates: string[] = [];
  let current = from;
  let guard = 0;
  while (current <= until && guard++ < cap) {
    dates.push(current);
    current = advanceDate(current, rule);
  }
  return dates;
}
