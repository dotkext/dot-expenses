/**
 * Google OAuth 2.0 with PKCE, implemented directly against Google's
 * endpoints with Node's crypto — no third-party OAuth dependency.
 */

import { createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

export const GOOGLE_STATE_COOKIE = "dotexpenses_g_state";
export const GOOGLE_VERIFIER_COOKIE = "dotexpenses_g_verifier";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPES = ["openid", "email", "profile"];

export function googleConfigured(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret);
}

/** Redirect URI derived from the configured APP_URL or the request origin. */
export function getRedirectUri(request: Request): string {
  if (env.appUrl) {
    return `${env.appUrl.replace(/\/+$/, "")}/auth/google/callback`;
  }
  const url = new URL(request.url);
  return `${url.origin}/auth/google/callback`;
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createAuthUrl(
  state: string,
  codeVerifier: string,
  redirectUri: string,
): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", env.googleClientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleProfile = {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

/** Exchange the authorization code and decode the id_token payload. */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }

  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw new Error("Google did not return an id_token");
  }

  const payload = decodeIdToken(tokens.id_token);
  if (!payload.sub || !payload.email) {
    throw new Error("Google profile is missing an email");
  }

  return {
    providerUserId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name ?? payload.email.split("@")[0],
  };
}

function decodeIdToken(idToken: string): {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
} {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  const json = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(json);
}

/** Short-lived cookie helpers for the OAuth round-trip. */
export function oauthCookie(name: string, value: string, request: Request): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
  ];
  if (
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:"
  ) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function oauthCookieClear(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
