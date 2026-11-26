import { createContext, useContext, useMemo } from "react";

import { setApiLocale } from "@/lib/api";
import { DEFAULT_LOCALE, getI18n, type I18n, type Locale } from "@/lib/i18n/core";

const I18nContext = createContext<I18n | null>(null);

/**
 * Provides translations + locale-aware formatters. The locale always comes
 * from the root loader (DB preference → cookie → Accept-Language), so server
 * rendering and hydration use the exact same value.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => {
    setApiLocale(locale);
    return getI18n(locale);
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Current translations/formatters. Falls back to English outside the provider. */
export function useI18n(): I18n {
  return useContext(I18nContext) ?? getI18n(DEFAULT_LOCALE);
}
