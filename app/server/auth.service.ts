/**
 * Authentication: argon2id passwords, database-backed sessions with
 * HttpOnly cookies, login rate limiting and new-user seeding.
 */

import { createHash, randomBytes } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "react-router";

import { db } from "@/lib/db";
import { createTranslator, DEFAULT_LOCALE, toLocale, type Locale, type TranslationKey } from "@/lib/i18n/core";
import {
  accounts,
  categories,
  oauthAccounts,
  sessions,
  users,
  type User,
} from "@/lib/schema";

import { apiError } from "./json";

export const SESSION_COOKIE = "dotexpenses_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // renew when < 15 days left

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

// OWASP recommended argon2id parameters
const HASH_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, HASH_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argonVerify(passwordHash, password);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Sessions                                                           */
/* ------------------------------------------------------------------ */

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = generateSessionToken();
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    userAgent: userAgent?.slice(0, 255) ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function validateSessionToken(token: string): Promise<User | null> {
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }

  // Rolling expiry: renew quietly when more than half the lifetime has passed.
  if (row.session.expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, row.session.id));
  }

  return row.user;
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/* ------------------------------------------------------------------ */
/* Cookies                                                            */
/* ------------------------------------------------------------------ */

function isSecure(request: Request): boolean {
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookieSet(request: Request, token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

export function sessionCookieClear(request: Request): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

/* ------------------------------------------------------------------ */
/* Request auth                                                       */
/* ------------------------------------------------------------------ */

export async function getAuth(request: Request): Promise<User | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return validateSessionToken(token);
}

/** Page loaders: redirect anonymous visitors to /login. */
export async function requireAuth(request: Request): Promise<User> {
  const user = await getAuth(request);
  if (!user) throw redirect("/login");
  return user;
}

/* ------------------------------------------------------------------ */
/* Login rate limiting (in-memory, per process)                       */
/* ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    apiError("errors.tooManyAttempts", 429, { seconds });
  }
}

/* ------------------------------------------------------------------ */
/* Registration / login                                               */
/* ------------------------------------------------------------------ */

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  currency: string;
  locale: Locale;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  if (existing[0]) apiError("errors.emailTaken", 409);

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      currency: input.currency,
      locale: input.locale,
    })
    .returning();

  await seedUserDefaults(user.id, input.locale);
  return user;
}

export async function loginWithPassword(email: string, password: string): Promise<User> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
    .limit(1);
  const user = rows[0];
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    apiError("errors.invalidCredentials", 401);
  }
  return user;
}

/* ------------------------------------------------------------------ */
/* OAuth (Google)                                                     */
/* ------------------------------------------------------------------ */

export async function linkGoogleAccount(
  userId: string,
  providerUserId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.providerUserId, providerUserId)))
    .limit(1);
  if (existing[0]) {
    if (existing[0].userId !== userId) {
      apiError("errors.googleLinkedOther", 409);
    }
    return;
  }
  await db
    .insert(oauthAccounts)
    .values({ provider: "google", providerUserId, userId })
    .onConflictDoNothing();
}

export async function unlinkGoogle(userId: string): Promise<void> {  await db
    .delete(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.userId, userId)));
}

/**
 * Sign in (or create) a user from a verified Google profile. If the email
 * matches an existing account, Google gets linked to it.
 */
export async function loginWithGoogle(
  profile: {
    providerUserId: string;
    email: string;
    name: string;
  },
  locale: Locale = DEFAULT_LOCALE,
): Promise<User> {
  const linked = await db
    .select({ user: users })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(
      and(
        eq(oauthAccounts.provider, "google"),
        eq(oauthAccounts.providerUserId, profile.providerUserId),
      ),
    )
    .limit(1);
  if (linked[0]) return linked[0].user;

  const email = profile.email.toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  if (existing[0]) {
    await linkGoogleAccount(existing[0].id, profile.providerUserId);
    return existing[0];
  }

  const [user] = await db
    .insert(users)
    .values({ email, name: profile.name.slice(0, 120) || email.split("@")[0], locale })
    .returning();
  await seedUserDefaults(user.id, locale);
  await linkGoogleAccount(user.id, profile.providerUserId);
  return user;
}

export async function getUserDTO(user: User) {
  const google = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.userId, user.id)))
    .limit(1);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    currency: user.currency,
    locale: toLocale(user.locale),
    hasPassword: Boolean(user.passwordHash),
    googleLinked: Boolean(google[0]),
  };
}

/* ------------------------------------------------------------------ */
/* New-user defaults                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_EXPENSE_CATEGORIES: Array<{
  key: TranslationKey;
  icon: string;
  color: string;
}> = [
  { key: "seed.groceries", icon: "shopping-basket", color: "#22c55e" },
  { key: "seed.dining", icon: "utensils", color: "#f97316" },
  { key: "seed.transport", icon: "car", color: "#0ea5e9" },
  { key: "seed.housing", icon: "home", color: "#8b5cf6" },
  { key: "seed.utilities", icon: "plug-zap", color: "#eab308" },
  { key: "seed.health", icon: "heart-pulse", color: "#ef4444" },
  { key: "seed.entertainment", icon: "clapperboard", color: "#ec4899" },
  { key: "seed.shopping", icon: "shopping-bag", color: "#6366f1" },
  { key: "seed.subscriptions", icon: "repeat", color: "#14b8a6" },
  { key: "seed.education", icon: "graduation-cap", color: "#3b82f6" },
  { key: "seed.travel", icon: "plane", color: "#06b6d4" },
  { key: "seed.other", icon: "circle-dashed", color: "#64748b" },
];

const DEFAULT_INCOME_CATEGORIES: Array<{
  key: TranslationKey;
  icon: string;
  color: string;
}> = [
  { key: "seed.salary", icon: "banknote", color: "#22c55e" },
  { key: "seed.freelance", icon: "laptop", color: "#0ea5e9" },
  { key: "seed.investments", icon: "trending-up", color: "#8b5cf6" },
  { key: "seed.gifts", icon: "gift", color: "#ec4899" },
  { key: "seed.other", icon: "circle-dashed", color: "#64748b" },
];

/** Create starter categories and the default cash account, in `locale`. */
export async function seedUserDefaults(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<void> {
  const t = createTranslator(locale);
  await db.insert(categories).values([
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      userId,
      name: t(c.key),
      icon: c.icon,
      color: c.color,
      kind: "expense" as const,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
      userId,
      name: t(c.key),
      icon: c.icon,
      color: c.color,
      kind: "income" as const,
    })),
  ]);
  await db.insert(accounts).values({ userId, name: t("seed.cash"), type: "cash", isDefault: true });
}
