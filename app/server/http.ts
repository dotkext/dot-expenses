/**
 * Guards and parsing for the /api resource routes: auth checks, CSRF origin
 * checks and zod body parsing. JSON error helpers live in ./json (no cycles).
 */

import { env } from "@/lib/env";
import type { User } from "@/lib/schema";
import { z } from "zod";

import { getAuth } from "./auth.service";
import { apiError } from "./json";

export { apiError, jsonOk } from "./json";

/** Require an authenticated user for an API route (throws 401 Response). */
export async function requireApiUser(request: Request): Promise<User> {
  const user = await getAuth(request);
  if (!user) apiError("errors.notAuthenticated", 401);
  return user;
}

/**
 * Lightweight CSRF protection: reject cross-origin mutations. Session cookies
 * are SameSite=Lax, this adds defense in depth.
 */
export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("Origin");
  if (!origin) return; // non-browser clients without Origin are not CSRF vectors

  const allowed = new Set<string>();
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    // ignore
  }
  if (env.appUrl) {
    try {
      allowed.add(new URL(env.appUrl).origin);
    } catch {
      // ignore
    }
  }
  if (!allowed.has(origin)) apiError("errors.crossOrigin", 403);
}

export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    apiError("errors.invalidJson");
  }
}

/** Parse + validate a JSON body with a zod schema (400 on failure). */
export function parseBody<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    apiError(first?.message || "errors.invalidInput", 400);
  }
  return result.data;
}
