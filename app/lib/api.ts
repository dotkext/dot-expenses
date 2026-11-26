/**
 * Typed fetch helpers for the /api resource routes.
 * All API responses are plain JSON: { error: string, params? } on failure.
 * Server errors are translation keys; they are localized here using the
 * locale provided by <I18nProvider>.
 */

import {
  DEFAULT_LOCALE,
  translateMessage,
  type Locale,
  type TranslationParams,
} from "./i18n/core";

let apiLocale: Locale = DEFAULT_LOCALE;

/** Called by the i18n provider whenever the active locale changes. */
export function setApiLocale(locale: Locale): void {
  apiLocale = locale;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string; params?: TranslationParams })
    | null;

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? translateMessage(apiLocale, String(body.error), body.params)
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
