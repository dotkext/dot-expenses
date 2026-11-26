/**
 * i18n core: locales, typed dictionaries, translation + locale-aware
 * formatting. Pure (no React) so both server and client use the same code —
 * the locale always comes from loader data, keeping SSR and hydration
 * rendering identical.
 */

import { format as formatDate, type Day } from "date-fns";
import {
  de as deFns,
  enUS,
  es as esFns,
  fr as frFns,
  ro as roFns,
  type Locale as DateFnsLocale,
} from "date-fns/locale";

import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ro } from "./ro";

export const LOCALES = ["en", "es", "de", "ro", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Cookie that remembers the anonymous/request locale before sign-in. */
export const LOCALE_COOKIE = "dotexpenses_locale";

export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;
export type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  es,
  de,
  ro,
  fr,
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Coerce anything (DB column, request param) into a supported locale. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** True when `message` is a translation key (used for API error payloads). */
export function isTranslationKey(message: string): message is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, message);
}

/** Translate an API error message if it is a known key, else return it as-is. */
export function translateMessage(
  locale: Locale,
  message: string,
  params?: TranslationParams,
): string {
  return isTranslationKey(message) ? translate(locale, message, params) : message;
}

const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  ro: "ro-RO",
  fr: "fr-FR",
};

const DFNS_LOCALES: Record<Locale, DateFnsLocale> = {
  en: enUS,
  es: esFns,
  de: deFns,
  ro: roFns,
  fr: frFns,
};

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  let value: string = dictionaries[locale][key] ?? en[key] ?? String(key);
  if (params) {
    for (const [name, param] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(param));
    }
  }
  return value;
}

/** Pick the best supported locale from an Accept-Language header. */
export function pickLocaleFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      let q = 1;
      for (const param of params) {
        const [k, v] = param.trim().split("=");
        if (k === "q") q = Number(v) || 0;
      }
      return { tag: tag.toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

function parseDayLocal(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type I18n = {
  locale: Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  fmtMoney: (amount: number, currency: string, signed?: boolean) => string;
  fmtPercent: (value: number) => string;
  fmtCompact: (value: number) => string;
  /** "12 Nov 2026" */
  fmtDate: (day: string) => string;
  /** "12 Nov" */
  fmtDateShort: (day: string) => string;
  /** "12 Nov 2026, 14:05" (ISO timestamps) */
  fmtDateTime: (iso: string) => string;
  /** "November 2026" */
  fmtMonth: (month: string) => string;
  /** "November" */
  fmtMonthName: (month: string) => string;
  /** "Nov 26" (chart axis) */
  fmtMonthShort: (month: string) => string;
  weekdayName: (index: number) => string;
  currencyName: (code: string) => string;
};

export function getI18n(localeInput: Locale): I18n {
  const locale = toLocale(localeInput);
  const intl = INTL_LOCALES[locale];
  const dfns = DFNS_LOCALES[locale];

  return {
    locale,
    t: (key, params) => translate(locale, key, params),
    fmtMoney: (amount, currency, signed = false) => {
      const formatted = new Intl.NumberFormat(intl, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(amount));
      const sign = amount < 0 ? "-" : signed ? "+" : "";
      return `${sign}${formatted}`;
    },
    fmtPercent: (value) => `${Math.round(value)}%`,
    fmtCompact: (value) =>
      new Intl.NumberFormat(intl, { notation: "compact", maximumFractionDigits: 1 }).format(value),
    fmtDate: (day) => formatDate(parseDayLocal(day), "d MMM yyyy", { locale: dfns }),
    fmtDateShort: (day) => formatDate(parseDayLocal(day), "d MMM", { locale: dfns }),
    fmtDateTime: (iso) => {
      const date = new Date(iso);
      return Number.isNaN(date.getTime())
        ? "—"
        : formatDate(date, "d MMM yyyy, HH:mm", { locale: dfns });
    },
    fmtMonth: (month) => formatDate(parseDayLocal(`${month}-01`), "MMMM yyyy", { locale: dfns }),
    fmtMonthName: (month) => formatDate(parseDayLocal(`${month}-01`), "LLLL", { locale: dfns }),
    fmtMonthShort: (month) => formatDate(parseDayLocal(`${month}-01`), "MMM yy", { locale: dfns }),
    weekdayName: (index) => {
      try {
        return dfns.localize?.day(index as Day, { width: "abbreviated" }) ?? "";
      } catch {
        return "";
      }
    },
    currencyName: (code) => {
      try {
        return new Intl.DisplayNames([intl], { type: "currency" }).of(code) ?? code;
      } catch {
        return code;
      }
    },
  };
}

/** Standalone translator for server-side code (services, seeds). */
export function createTranslator(
  locale: Locale,
): (key: TranslationKey, params?: TranslationParams) => string {
  return (key, params) => translate(locale, key, params);
}
