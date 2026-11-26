import { LOCALE_COOKIE, type Locale } from "./core";

/**
 * Remember the chosen locale in a cookie so the sign-in/register screens and
 * anonymous pages render in the same language. The user's stored preference
 * (users.locale) still wins once authenticated.
 */
export function setLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
