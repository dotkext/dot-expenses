/**
 * JSON response helpers for API routes. Kept dependency-free (no db, no auth
 * imports) so every server module can use them without import cycles.
 */

import type { TranslationParams } from "@/lib/i18n/core";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/**
 * Throw a JSON error response. `message` is usually a translation key from
 * app/lib/i18n; the client fetch layer localizes it before showing it.
 */
export function apiError(
  message: string,
  status = 400,
  params?: TranslationParams,
): never {
  throw Response.json({ error: message, ...(params ? { params } : {}) }, { status });
}
